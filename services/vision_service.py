import orjson
import asyncio
import base64
import os
import threading
from typing import Dict, List, Optional, Tuple, Any
from datetime import datetime
from openai import AsyncOpenAI, APIStatusError, Timeout
from core.config import settings
from core.key_utils import usable_keys
from core.error_utils import is_retryable_error
from api.metrics import app_metrics

# A3: explicit client timeout (matches llm_service.py). Vision requests get a
# longer ceiling than text because dense multi-screenshot batches generate
# more tokens.
VISION_TIMEOUT_SECONDS = 90.0
VISION_CONNECT_TIMEOUT_SECONDS = 10.0

class VisionManager:
    """Vision AI Manager for screenshot analysis and code problem solving"""
    
    def __init__(self, provider_name: str, base_url: str, api_key: str, model_name: str, request_params: Optional[Dict[str, Any]] = None, api_keys: Optional[List[str]] = None):
        self.provider_name = provider_name
        self.model_name = model_name
        self.base_url = base_url
        self.request_params = request_params or {}
        self.is_healthy = True
        self.last_error = None
        self.error_count = 0
        self.last_success_time = datetime.now()
        self.context_manager = None  # Will be set by VisionService
        
        # Key rotation support — drop blank/placeholder entries so a half-filled
        # config (real "apiKey" + untouched "apiKeys" placeholders) still works.
        self.api_keys = usable_keys(api_keys) or usable_keys([api_key]) or [""]
        if not self.api_keys[0]:
            print(f"⚠️ No usable vision API key for {provider_name} — set 'apiKey' or 'apiKeys' in ai_providers.json")
        self.api_key = self.api_keys[0]
        self._key_index = 0
        self._key_lock = threading.Lock()
        self._request_count = 0
        
        try:
            self.client = AsyncOpenAI(
                base_url=base_url,
                api_key=self.api_key,
                timeout=Timeout(VISION_TIMEOUT_SECONDS, connect=VISION_CONNECT_TIMEOUT_SECONDS),
            )
            print(f"✅ VisionManager initialized for: {self.provider_name} - {self.model_name} ({len(self.api_keys)} keys available)")
        except Exception as e:
            self.client = None
            self.is_healthy = False
            self.last_error = str(e)
            print(f"❌ CRITICAL: Failed to initialize VisionManager for {self.provider_name}: {e}")

    def _rotate_key(self):
        """Rotate to the next API key using round-robin."""
        if len(self.api_keys) <= 1:
            return
        with self._key_lock:
            self._key_index = (self._key_index + 1) % len(self.api_keys)
            self.api_key = self.api_keys[self._key_index]
            self.client = AsyncOpenAI(
                base_url=self.base_url,
                api_key=self.api_key,
                timeout=Timeout(VISION_TIMEOUT_SECONDS, connect=VISION_CONNECT_TIMEOUT_SECONDS),
            )
            self._request_count += 1
            app_metrics.inc("key_rotations")
            print(f"🔑 Vision key rotation [{self.provider_name}]: using key index {self._key_index}/{len(self.api_keys)}")

    def set_context_manager(self, context_manager):
        """Set the shared context manager"""
        self.context_manager = context_manager

    async def health_check(self) -> bool:
        """Check if the vision provider is healthy and responsive"""
        if not self.client:
            return False
            
        try:
            # Quick test call to verify connectivity
            await asyncio.wait_for(self.client.models.list(), timeout=5.0)
            self.is_healthy = True
            self.error_count = 0
            self.last_success_time = datetime.now()
            return True
        except asyncio.TimeoutError:
            self.is_healthy = False
            self.last_error = "Connection timeout"
            self.error_count += 1
            return False
        except Exception as e:
            self.is_healthy = False
            self.last_error = str(e)
            self.error_count += 1
            return False

    async def analyze_screenshots(self, prompt: str, screenshots: List[str], languages: List[str] = None) -> Tuple[str, Dict[str, Any]]:
        """Analyze screenshots with instant key rotation on any error — zero delay retries."""
        if not self.client:
            return "I'm sorry, the vision AI service is not available at this time.", {
                "error": "No client available",
                "provider": self.provider_name,
                "model": self.model_name
            }
        
        # Prepare the message content with text and images (once, before retry loop)
        content = [{"type": "text", "text": prompt}]
        for i, screenshot_data_url in enumerate(screenshots):
            if not screenshot_data_url.startswith('data:image/'):
                screenshot_data_url = f"data:image/jpeg;base64,{screenshot_data_url}"
            content.append({
                "type": "image_url",
                "image_url": {"url": screenshot_data_url}
            })
        
        print(f"🔍 Analyzing {len(screenshots)} screenshots with {self.provider_name}-{self.model_name}")
        
        # Try all available keys — instant retry on any error
        max_attempts = len(self.api_keys)
        last_error = None
        
        for attempt in range(max_attempts):
            try:
                # Rotate key for each attempt (first attempt uses current key)
                if attempt > 0:
                    self._rotate_key()
                    print(f"🔄 Vision instant retry attempt {attempt+1}/{max_attempts} with next key for {self.provider_name}")
                
                # Build API params
                api_params = {
                    "messages": [{"role": "user", "content": content}],
                    "model": self.model_name,
                    "temperature": 0.45,
                    "max_tokens": 8100,
                    "top_p": 0.95
                }

                # Add provider-specific routing if available
                if self.request_params:
                    if self.provider_name == "OpenRouter" and "provider" in self.request_params:
                        api_params["extra_body"] = self.request_params
                    else:
                        api_params.update(self.request_params)
                
                # Make API call
                chat_completion = await asyncio.wait_for(
                    self.client.chat.completions.create(**api_params),
                    timeout=75.0
                )
                
                analysis = chat_completion.choices[0].message.content.strip()
                
                # Add vision analysis to conversation history if context manager available
                if self.context_manager:
                    self.context_manager.add_ai_response(analysis, "vision")
                
                # Success!
                self.is_healthy = True
                self.error_count = 0
                self.last_success_time = datetime.now()
                
                return analysis, {
                    "success": True,
                    "provider": self.provider_name,
                    "model": self.model_name,
                    "key_rotated": attempt > 0,
                    "attempt": attempt + 1,
                    "screenshot_count": len(screenshots),
                    "languages": languages or [],
                    "response_time": datetime.now().isoformat(),
                    "analysis_length": len(analysis)
                }
                
            except Exception as e:
                last_error = e
                err_str = str(e)[:100]
                print(f"⚡ Vision key #{self._key_index} failed for {self.provider_name}: {err_str}")
                app_metrics.provider_error(self.provider_name)
                # C8: rotate keys only when retrying can help; client errors
                # (bad payload, unknown model, too many images) fail fast.
                if not is_retryable_error(e):
                    break
                continue
        
        # All keys exhausted (or a non-retryable error stopped the loop)
        if last_error is not None and not is_retryable_error(last_error):
            self.is_healthy = False
            self.last_error = str(last_error)
            self.error_count += 1
            error_msg = f"{self.provider_name} vision request failed (not retryable): {str(last_error)[:200]}"
            print(f"🚨 VISION FAIL FAST: {self.provider_name}-{self.model_name}: {error_msg}")
            return error_msg, {
                "error": "non_retryable_error",
                "detail": str(last_error)[:200],
                "provider": self.provider_name,
                "model": self.model_name,
                "screenshot_count": len(screenshots)
            }

        error_msg = f"All {max_attempts} vision keys failed for {self.provider_name}. Last error: {str(last_error)[:100]}"
        self.is_healthy = False
        self.last_error = str(last_error)
        self.error_count += 1
        print(f"🚨 ALL VISION KEYS EXHAUSTED: {self.provider_name}-{self.model_name}")
        
        return error_msg, {
            "error": "all_keys_failed",
            "attempts": max_attempts,
            "provider": self.provider_name,
            "model": self.model_name,
            "screenshot_count": len(screenshots)
        }

    def get_status(self) -> Dict[str, Any]:
        """Get current status of this vision manager"""
        return {
            "provider": self.provider_name,
            "model": self.model_name,
            "is_healthy": self.is_healthy,
            "error_count": self.error_count,
            "last_error": self.last_error,
            "last_success": self.last_success_time.isoformat() if self.last_success_time else None,
            "supports_vision": True
        }

class VisionService:
    """Service for managing vision analysis requests and providers"""
    
    def __init__(self):
        self.active_vision_providers: Dict[str, VisionManager] = {}
        self.context_manager = None
        # C10: cache the parsed ai_providers.json, invalidated by mtime.
        # Previously every on-the-fly vision manager re-read the file from disk.
        self._providers_cache = None
        self._providers_cache_mtime: Optional[float] = None
        self._providers_lock = threading.Lock()

    def _load_providers_config(self):
        """Read ai_providers.json through an mtime-checked cache."""
        path = "ai_providers.json"
        try:
            mtime = os.path.getmtime(path)
        except OSError:
            self._providers_cache = None
            self._providers_cache_mtime = None
            raise
        with self._providers_lock:
            if self._providers_cache is None or mtime != self._providers_cache_mtime:
                with open(path, "rb") as f:
                    self._providers_cache = orjson.loads(f.read())
                self._providers_cache_mtime = mtime
            return self._providers_cache

    def set_context_manager(self, context_manager):
        """Set the shared context manager for future vision managers.

        C10: the old self.vision_managers cache was always empty (managers are
        created on demand), so there is nothing to iterate anymore.
        """
        self.context_manager = context_manager
        
    def load_vision_providers(self, primary_config: Optional[Dict] = None, secondary_config: Optional[Dict] = None) -> bool:
        """Load active vision providers based on user selection."""
        self.active_vision_providers = {}
        
        if primary_config and primary_config.get('provider') and primary_config.get('model'):
            manager = self._create_vision_manager(primary_config['provider'], primary_config['model'])
            if manager:
                self.active_vision_providers['primary'] = manager

        if secondary_config and secondary_config.get('provider') and secondary_config.get('model'):
            manager = self._create_vision_manager(secondary_config['provider'], secondary_config['model'])
            if manager:
                self.active_vision_providers['secondary'] = manager
        
        print(f"✅ VisionService configured with {len(self.active_vision_providers)} active vision models.")
        return len(self.active_vision_providers) > 0

    def _create_vision_manager(self, provider_name: str, model_name: str) -> Optional[VisionManager]:
        """Create and return a vision manager for a given provider and model."""
        try:
            providers_config = self._load_providers_config()

            for provider_config in providers_config:
                if provider_config["name"] == provider_name:
                    # Find the model configuration, supporting both string and dict formats
                    model_config = self._get_vision_model_config(provider_config, model_name)
                    
                    manager = VisionManager(
                        provider_name=provider_name,
                        base_url=provider_config["baseURL"],
                        api_key=provider_config.get("apiKey", ""),
                        model_name=model_config["modelName"],
                        request_params=model_config.get("requestParams"),
                        api_keys=provider_config.get("apiKeys")
                    )
                    if self.context_manager:
                        manager.set_context_manager(self.context_manager)
                    return manager
            return None
        except Exception as e:
            print(f"❌ Failed to create vision manager for {provider_name}: {e}")
            return None

    def _get_vision_model_config(self, provider_config: Dict[str, Any], model_identifier: str) -> Dict[str, Any]:
        """Finds vision model configuration, supporting both string and dict formats."""
        for model in provider_config.get("visionModels", []):
            if isinstance(model, str) and model == model_identifier:
                return {"modelName": model}  # Normalize to dict
            if isinstance(model, dict) and model.get("modelName") == model_identifier:
                return model
        raise ValueError(f"Vision model '{model_identifier}' not found for provider '{provider_config['name']}'")
    
    def get_vision_manager(self, provider_name: str, model_name: str) -> Optional[VisionManager]:
        """Get a specific vision manager, checking active providers first."""
        # Check active providers first
        for key, manager in self.active_vision_providers.items():
            if manager.provider_name == provider_name and manager.model_name == model_name:
                return manager
        
        # Fallback to creating a new one if not found in active
        print(f"⚠️ Vision manager for {provider_name} - {model_name} not found in active providers. Creating on-the-fly.")
        return self._create_vision_manager(provider_name, model_name)
    
    async def analyze_ee_problem(self, provider_name: str, model_name: str,
                                  screenshots: List[str], languages: List[str] = None) -> Tuple[str, Dict[str, Any]]:
        """Analyze electrical-engineering screenshots (nameplates, circuits,
        MCQs, scope traces) with comprehensive domain prompting."""
        vision_manager = self.get_vision_manager(provider_name, model_name)
        if not vision_manager:
            return f"Vision model {provider_name} - {model_name} not available.", {
                "error": "vision_model_not_found",
                "provider": provider_name,
                "model": model_name
            }
        prompt = self.generate_ee_analysis_prompt(languages)
        return await vision_manager.analyze_screenshots(prompt, screenshots, languages)

    # Backward-compatible alias — session_manager calls this entry point.
    async def analyze_coding_problem(self, provider_name: str, model_name: str,
                                     screenshots: List[str], languages: List[str] = None) -> Tuple[str, Dict[str, Any]]:
        return await self.analyze_ee_problem(provider_name, model_name, screenshots, languages)

    def generate_ee_analysis_prompt(self, languages: List[str] = None) -> str:
        """Generate a comprehensive prompt for analyzing electrical engineering
        screenshots: nameplates, circuit diagrams, PQ events, MCQs, scope traces."""

        lang_note = ""
        if languages and len(languages) > 0:
            lang_note = f"**Candidate's stated focus areas (context only):** {', '.join(languages)}\\n"

        return f"""You are an expert AI assistant and senior electrical engineering interview copilot. Your task is to analyze the content of the provided screenshots.

CRITICAL MINDSET: Think like a real senior EE interviewer (PSU / core-company panel) grading a candidate live, NOT a robot.
Real EE interviewers evaluate:
1. Reading the diagram/nameplate CORRECTLY before answering (voltage class, connection symbol, duty type, IP code, frame size).
2. Formula before substitution — the governing equation is stated symbolically with SI units, THEN values substituted.
3. Unit-checked arithmetic and a stated assumption when data is missing.
4. Standards awareness (IEEE-519, IEC 61000-4-30, IEC 61131-3, IS 732, IS 3043) where relevant.

**Overall Goal:** Provide a clear, accurate, and comprehensive analysis based on the dominant type of content in the screenshots.

**Content Assessment:**
First, assess the screenshots to determine the primary type of content:
1.  **Machine/Transformer Nameplate:** rating plate of a motor, transformer, alternator, or panel.
2.  **Circuit/Diagram:** schematic, wiring diagram, phasor diagram, power/ control circuit, per-phase equivalent circuit, characteristic curve.
3.  **MCQ / Numerical Question:** objective question, calculation, or gate-style problem on any EE topic.
4.  **Instrument/Scope/DAQ screenshot:** meter reading, oscilloscope trace, FFT/harmonic plot, SCADA/HMI screen, PLC program.
5.  **Mixed or Other:** combination, or something else — describe it and assist as best you can.

{lang_note}---

**SECTION 1: NAMEPLATE ANALYSIS** (if a rating plate is present)

For the nameplate:
1. **📋 Transcribe every field** — rated power (kW/kVA/kVAR), voltage (V, line/phase, connection), current (A), frequency (Hz), speed (rpm), power factor, efficiency class (IE1-IE4/IS 12615), frame (IEC 60034/ NEMA), duty cycle (S1-S10), insulation class, IP rating, connection (star/delta, Dyn11 etc.), serial.
2. **🧮 Derive the hidden numbers** the interviewer will ask:
   - Synchronous speed from poles & frequency: N_s = 120f/P
   - Full-load slip: s = (N_s - N_r)/N_s
   - Full-load current, starting current (DOL ≈ 6-8× FLA), starting torque
   - Transformer: %Z, base impedance, full-load copper loss implications
3. **🔍 Two likely follow-up questions** with one-line answers (e.g. "can this motor run on VFD?" — insulation rating & bearing currents answer).
---

**SECTION 2: CIRCUIT / DIAGRAM ANALYSIS** (if a schematic or curve is present)

1. **Describe the circuit topology** in words: source → protection → switching → load → return; label every element you can see.
2. **Explain the operating principle**: what happens at energization, at steady state, at trip/fault.
3. **Trace the sequence of operation** for control circuits (contactor aux contacts, interlocks, timer contacts, indication lamps).
4. **Redraw (as complete ```svg code block)** the circuit CLEANLY if the original is messy — the HUD renders SVG live. Label every component.
5. **Examiner's checklist**: what marks hinge on (free-wheeling diode direction, interlock contacts, R₂(1-s)/s not R₂/s, dot convention, earthing symbol).
---

**SECTION 3: MCQ / NUMERICAL ANALYSIS** (if questions are present)

For EACH question:
1. **✅ CORRECT ANSWER at LINE 1: `Option Letter - Full Option Text`** for MCQs.
2. **Numericals:** state Given/Find/Assumptions, governing formula symbolically with units, step-by-step substitution with units on every line, final answer bolded, one-line sanity check.
3. **Why each distractor is wrong** (one line each).
---

**SECTION 4: INSTRUMENT / SCOPE / SCADA SCREEN** (if a measurement display is present)

1. **Read the display precisely** — every visible value with its unit and timestamp.
2. **Interpret as an electrical engineer**: is the waveform sinusoidal? Estimate RMS, THD, PF, harmonic signature from the trace; identify the PQ event (sag/swell/transient/interruption) if visible.
3. **State the standards verdict**: e.g. "V-THD ≈ 7.2% exceeds the IEEE-519 5% limit for V ≤ 1 kV — mitigation: passive/active filter sizing".
4. **Instrument class** note if identifiable (CT/PT ratio, metering class 0.2/0.5/1.0, CAT safety rating).
---

> **💬 WHAT TO SAY OUT LOUD TO THE INTERVIEWER:**
> "[1-2 sentences naming what is on screen and the first engineering observation — e.g. 'This is a 5 HP, 415 V, 1440 rpm nameplate — 4-pole machine, so slip is 4%, and I can derive FLA and starting torque from this data.']"

**Final Instructions:**
- Use `###` numbered-section headers matching the section you used. Never prefix section titles with bullets.
- Every numeric line carries its unit.
- Ensure your analysis directly addresses the content of the screenshots.
- Never wrap your entire answer in ```markdown``` fences.
"""


# Global vision service instance
vision_service = VisionService()

# Verification function
async def verify_vision_provider_connection(base_url: str, api_key: str, model_name: str, request_params: Optional[Dict[str, Any]] = None) -> bool:
    """Verify a vision provider connection - simplified to avoid complex vision tests"""
    try:
        temp_client = AsyncOpenAI(
            base_url=base_url,
            api_key=api_key,
            timeout=Timeout(VISION_TIMEOUT_SECONDS, connect=VISION_CONNECT_TIMEOUT_SECONDS),
        )
        
        # Just test basic connectivity with models.list() - don't do complex vision tests
        await asyncio.wait_for(temp_client.models.list(), timeout=20.0)
        
        # For OpenRouter, note that we have provider routing but skip complex testing
        if request_params and "provider" in request_params:
            print(f"INFO: OpenRouter vision model {model_name} configured with provider routing: {request_params}")
            print(f"INFO: Skipping complex vision test - basic connectivity verified")
        
        print(f"✅ Vision connection to {base_url} with model {model_name} is valid.")
        return True
    except asyncio.TimeoutError:
        print(f"⏱️ TIMEOUT: Vision connection to {base_url} timed out")
        return False
    except APIStatusError as e:
        print(f"❌ ERROR: Vision API key verification failed for {base_url}. Status: {e.status_code}")
        return False
    except Exception as e:
        print(f"❌ ERROR: Vision provider verification error for {base_url}: {e}")
        return False