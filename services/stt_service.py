import asyncio
import re
import httpx
from deepgram import (
    DeepgramClient,
    DeepgramClientOptions,
    LiveTranscriptionEvents,
    LiveOptions,
)
from core.config import settings
from api.metrics import app_metrics


def clean_electrical_transcript(transcript: str) -> str:
    """
    Clean acoustic speech-to-text confusions for electrical engineering domain terms.
    Corrects common phonetically similar words (e.g. 'single fist' -> 'single phase',
    'index motor' -> 'induction motor', 'be able frequency drive' -> 'variable frequency drive',
    'book holes relay' -> 'Buchholz relay', 'router' -> 'rotor').
    """
    if not transcript or not isinstance(transcript, str):
        return transcript

    # Phase misheard as fist, face, or faith
    transcript = re.sub(r'\b(single|three|1|3|one|two)\s+fists?\b', r'\1 phase', transcript, flags=re.IGNORECASE)
    transcript = re.sub(r'\b(single|three|1|3|one|two)\s+faces?\b', r'\1 phase', transcript, flags=re.IGNORECASE)
    transcript = re.sub(r'\b(single|three|1|3|one|two)\s+faiths?\b', r'\1 phase', transcript, flags=re.IGNORECASE)
    transcript = re.sub(r'\bsplit\s+faces?\b', 'split phase', transcript, flags=re.IGNORECASE)
    transcript = re.sub(r'\bfists?\s+transformer\b', 'phase transformer', transcript, flags=re.IGNORECASE)
    transcript = re.sub(r'\bfaces?\s+transformer\b', 'phase transformer', transcript, flags=re.IGNORECASE)
    transcript = re.sub(r'\bfists?\s+motor\b', 'phase motor', transcript, flags=re.IGNORECASE)
    transcript = re.sub(r'\bfaces?\s+motor\b', 'phase motor', transcript, flags=re.IGNORECASE)
    transcript = re.sub(r'\bface\s+(sequence|difference|angle|voltage|current)\b', r'phase \1', transcript, flags=re.IGNORECASE)
    transcript = re.sub(r'\bpoly\s*face\b', 'polyphase', transcript, flags=re.IGNORECASE)

    # Induction motor misheard as index/injection/infection/inductance/deduction motor
    transcript = re.sub(r'\b(mode\s+)?(index|injection|infection|inductance|deduction)\s+motor\b', 'induction motor', transcript, flags=re.IGNORECASE)
    transcript = re.sub(r'\bmode\s+index\b', 'induction', transcript, flags=re.IGNORECASE)

    # Synchronous machines misheard as sink runner / sink run us / synch
    transcript = re.sub(r'\b(sink\s*run\s*us|sink\s*runner|synch)\s+motor\b', 'synchronous motor', transcript, flags=re.IGNORECASE)
    transcript = re.sub(r'\b(sink\s*run\s*us|sink\s*runner|synch)\s+(generator|machine|speed)\b', r'synchronous \2', transcript, flags=re.IGNORECASE)

    # Machine components: stator, rotor, armature, commutator, brushes
    transcript = re.sub(r'\b(girl|screw|square)\s+cage\b', 'squirrel cage', transcript, flags=re.IGNORECASE)
    transcript = re.sub(r'\b(sleep|slit)\s+rings?\b', 'slip ring', transcript, flags=re.IGNORECASE)
    transcript = re.sub(r'\b(state\s+or|stayed\s+or|stater)\b', 'stator', transcript, flags=re.IGNORECASE)
    transcript = re.sub(r'\b(wound\s+)?(router|rooter)\b', r'\1rotor', transcript, flags=re.IGNORECASE)
    transcript = re.sub(r'\b(arm\s+mature|armor\s+cher|armor\s+tour|our\s+mature)\b', 'armature', transcript, flags=re.IGNORECASE)
    transcript = re.sub(r'\b(commuter|community\s+or|common\s+tater)\b', 'commutator', transcript, flags=re.IGNORECASE)
    transcript = re.sub(r'\bcarbon\s+rushes\b', 'carbon brushes', transcript, flags=re.IGNORECASE)
    transcript = re.sub(r'\bback\s+(em\s+if|in\s+my|am\s+f|mf)\b', 'back EMF', transcript, flags=re.IGNORECASE)
    transcript = re.sub(r'\b(feel|shield)\s+winding\b', 'field winding', transcript, flags=re.IGNORECASE)
    transcript = re.sub(r'\b(silent|sealant)\s+pole\b', 'salient pole', transcript, flags=re.IGNORECASE)

    # Transformers & Equivalent circuits
    transcript = re.sub(r'\bckt\b', 'circuit', transcript, flags=re.IGNORECASE)
    transcript = re.sub(r'\bequivalent\s+(ckt|circle|socket)\b', 'equivalent circuit', transcript, flags=re.IGNORECASE)
    transcript = re.sub(r'\bmagnetizing\s+(reactants|react\s+ends)\b', 'magnetizing reactance', transcript, flags=re.IGNORECASE)
    transcript = re.sub(r'\bleakage\s+(reactants|react\s+ends)\b', 'leakage reactance', transcript, flags=re.IGNORECASE)
    transcript = re.sub(r'\b(corless|cor\s+loss)\b', 'core loss', transcript, flags=re.IGNORECASE)
    transcript = re.sub(r'\b(eddie|any)\s+currents?\b', 'eddy current', transcript, flags=re.IGNORECASE)
    transcript = re.sub(r'\b(history\s+sis|history\s+this|histeresis)\b', 'hysteresis', transcript, flags=re.IGNORECASE)
    transcript = re.sub(r'\b(book\s*holes|buckles|buckholtz|book\s*holds)\s*(relay)?\b', 'Buchholz relay', transcript, flags=re.IGNORECASE)
    transcript = re.sub(r'\b(conservative|conservation)\s+tank\b', 'conservator tank', transcript, flags=re.IGNORECASE)
    transcript = re.sub(r'\bsilicon\s+gel\b', 'silica gel', transcript, flags=re.IGNORECASE)

    # VFD misheard as VFT, BFD, be able frequency drive, major frequency drive
    transcript = re.sub(r'\b(?:be\s+able|major|variable\s+frequent)\s+frequency\s+drive\b', 'variable frequency drive', transcript, flags=re.IGNORECASE)
    transcript = re.sub(r'\b(?:be\s+able|major)\s+frequency\b', 'variable frequency', transcript, flags=re.IGNORECASE)
    transcript = re.sub(r'\bVFT\b', 'VFD', transcript)
    transcript = re.sub(r'\bBFDs?\b', 'VFD', transcript, flags=re.IGNORECASE)

    # Power electronics: MOSFET, IGBT, Thyristor, snubber, gate driver
    transcript = re.sub(r'\b(moss\s*fat|most\s*fat|moss\s*fit|mosphet)\b', 'MOSFET', transcript, flags=re.IGNORECASE)
    transcript = re.sub(r'\b(i\s*g\s*b\s*t|egbt)\b', 'IGBT', transcript, flags=re.IGNORECASE)
    transcript = re.sub(r'\b(thy\s*sister|the\s*rister|thyistor)\b', 'thyristor', transcript, flags=re.IGNORECASE)
    transcript = re.sub(r'\b(snobber|snub\s*or)\s+circuit\b', 'snubber circuit', transcript, flags=re.IGNORECASE)
    transcript = re.sub(r'\b(gay|get)\s+driver\b', 'gate driver', transcript, flags=re.IGNORECASE)
    transcript = re.sub(r'\b(cyclo\s*converter|cycle\s*converter)\b', 'cycloconverter', transcript, flags=re.IGNORECASE)

    # Switchgear & Protection
    transcript = re.sub(r'\b(mc\s*cb|empty\s*cb)\b', 'MCCB', transcript, flags=re.IGNORECASE)
    transcript = re.sub(r'\bmc\s*be\b', 'MCB', transcript, flags=re.IGNORECASE)
    transcript = re.sub(r'\bvc\s*be\b', 'VCB', transcript, flags=re.IGNORECASE)
    transcript = re.sub(r'\bac\s*be\b', 'ACB', transcript, flags=re.IGNORECASE)
    transcript = re.sub(r'\bs\s*f\s*six|\bs\s*f\s*6\b', 'SF6', transcript, flags=re.IGNORECASE)
    transcript = re.sub(r'\b(buzz|boss)\s*bar\b', 'busbar', transcript, flags=re.IGNORECASE)
    transcript = re.sub(r'\b(mega|maker)\s+(test|value|reading)\b', r'Megger \2', transcript, flags=re.IGNORECASE)
    transcript = re.sub(r'\b(art|hard)\s+fault\b', 'earth fault', transcript, flags=re.IGNORECASE)
    transcript = re.sub(r'\bthermal\s+overload\s+really\b', 'thermal overload relay', transcript, flags=re.IGNORECASE)
    transcript = re.sub(r'\bstart\s+delta\b', 'star-delta', transcript, flags=re.IGNORECASE)

    # Circuit quantities & Theorems
    transcript = re.sub(r'\b(reacting|reaction)\s+power\b', 'reactive power', transcript, flags=re.IGNORECASE)
    transcript = re.sub(r'\bpower\s+factory\b', 'power factor', transcript, flags=re.IGNORECASE)
    transcript = re.sub(r'\b(impudence|impendence)\b', 'impedance', transcript, flags=re.IGNORECASE)
    transcript = re.sub(r'\binductive\s+reactants\b', 'inductive reactance', transcript, flags=re.IGNORECASE)
    transcript = re.sub(r'\bcapacitive\s+reactants\b', 'capacitive reactance', transcript, flags=re.IGNORECASE)
    transcript = re.sub(r'\b(seven\s+in|thevnin|tevenin)\b', 'Thevenin', transcript, flags=re.IGNORECASE)
    transcript = re.sub(r'\b(curt\s*off|kirchoff|kircof)\b', 'Kirchhoff', transcript, flags=re.IGNORECASE)
    transcript = re.sub(r'\b(sign\s+you\s+saw\s+idle|sine\s+us\s+oid\s+al)\b', 'sinusoidal', transcript, flags=re.IGNORECASE)
    transcript = re.sub(r'\bk\s*bar\b', 'kVAR', transcript, flags=re.IGNORECASE)

    # Shunt/series motor misheard as mood or mower
    transcript = re.sub(r'\b(shunt|series)\s+(mood|mower)\b', r'\1 motor', transcript, flags=re.IGNORECASE)

    # Mic check misheard as my chick / my check / mike check
    transcript = re.sub(r'\b(my\s+chick|my\s+check|mike\s+check)\b', 'mic check', transcript, flags=re.IGNORECASE)

    return transcript


async def verify_deepgram_api_key():
    """
    Verifies the Deepgram API key by making a direct HTTP request.
    This is the most reliable method, independent of SDK changes.
    Returns True if the key is valid, False otherwise.
    """
    if not settings.DEEPGRAM_API_KEY:
        return False

    url = "https://api.deepgram.com/v1/projects"
    headers = {
        "Authorization": f"Token {settings.DEEPGRAM_API_KEY}"
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=headers)
            if response.status_code == 200:
                print("INFO: Deepgram API key is valid.")
                return True
            else:
                print(f"ERROR: Deepgram API key verification failed. Status: {response.status_code}, Response: {response.text}")
                return False
    except httpx.RequestError as e:
        print(f"ERROR: A network error occurred while verifying Deepgram key: {e}")
        return False


class DeepgramManager:
    """
    Manages the connection to Deepgram for live transcription.
    """
    def __init__(self, transcript_callback, user_languages=None, language: str = "en"):
        self.transcript_callback = transcript_callback
        self.dg_connection = None
        self.is_connected = False
        self.stop_event = asyncio.Event()
        self.user_languages = user_languages or []
        # P1: transcription language — 'en' or 'multi' (Deepgram nova-3
        # supports multi-language code-switching via language="multi").
        self.language = language if language in ("en", "multi") else "en"
        self._reconnect_attempts = 0
        self._max_reconnect_attempts = 5
        self._reconnect_base_delay = 1.0  # seconds
        # A1: singleflight guard - only one reconnect loop may run at a time.
        # on_error and on_close both fire for the same dropped socket; without
        # the guard each spawns its own reconnect task and two loops race,
        # opening duplicate Deepgram connections.
        self._reconnect_task: asyncio.Task = None
        # Initial-connection retry budget (A2): the very first start() gets a
        # bounded number of attempts before we give up and raise.
        self._initial_connect_max_attempts = 3
        
        # Setup Deepgram client
        config = DeepgramClientOptions(
            verbose=False,  # Disable verbose logging to reduce spam
            options={"keepalive": "true"}
        )
        self.deepgram = DeepgramClient(settings.DEEPGRAM_API_KEY, config)

    def get_programming_keyterms(self, user_languages=None):
        """
        Generate core electrical engineering keyterms and phrases for accurate speech recognition.
        Limited to 500 tokens as per Deepgram requirements (~85 terms).
        Prioritizes machines, transformers, drives, and power system terms.
        """
        # Core Electrical Engineering concepts, machines, circuits, and terminology
        ee_keyterms = [
            # Transformers & AC Machines
            "single phase", "three phase", "single-phase", "three-phase",
            "transformer", "equivalent circuit", "induction motor", "slip",
            "synchronous motor", "synchronous generator", "alternator",
            "armature", "stator", "rotor", "field winding", "shunt motor",
            "series motor", "BLDC motor", "stepper motor", "back EMF",
            "synchronous speed", "torque", "squirrel cage", "wound rotor",
            "magnetizing reactance", "core loss", "leakage reactance",
            "open circuit test", "short circuit test", "auto transformer",
            
            # Power Electronics & Drives
            "variable frequency drive", "VFD", "VFDs", "inverter", "converter",
            "rectifier", "cycloconverter", "chopper", "PWM", "space vector",
            "IGBT", "MOSFET", "thyristor", "SCR", "snubber circuit",
            "gate driver", "buck converter", "boost converter", "buck boost",
            
            # Circuit Theory & Electrical Quantities
            "circuit diagram", "schematic", "power factor", "cos phi",
            "active power", "reactive power", "apparent power", "kVA", "kW",
            "kVAR", "impedance", "reactance", "Kirchhoff", "KVL", "KCL",
            "Thevenin", "Norton", "superposition", "star delta", "delta star",
            "phase voltage", "line voltage", "phase current", "line current",
            "neutral current", "current transformer", "potential transformer",
            
            # Protection, Switchgear & Plant Safety
            "substation", "switchgear", "circuit breaker", "MCCB", "MCB",
            "ACB", "VCB", "SF6", "Buchholz relay", "thermal overload",
            "overcurrent", "earth fault", "ground fault", "LOTO", "busbar",
            "fault current", "short circuit",
            
            # Interview audio verification
            "mic check", "check 1 2 3", "audible", "testing"
        ]
        
        # Prioritize keyterms and remove duplicates while preserving order
        seen = set()
        final_keyterms = []
        for term in ee_keyterms:
            if term.lower() not in seen:
                seen.add(term.lower())
                final_keyterms.append(term)
        
        selected_terms = final_keyterms[:85]
        print(f"🔧 Electrical engineering STT keyterms configured: {len(selected_terms)} terms")
        print(f"📝 Sample EE keyterms: {', '.join(selected_terms[:10])}...")
        
        return selected_terms

    async def start(self):
        """Starts the Deepgram transcription connection, retrying initial failures.

        A2: previously a failed first connect was only printed and every audio
        chunk was then silently dropped forever. Now the connection is retried
        with the same exponential backoff used for reconnects, and if all
        attempts fail the exception propagates so handle_start_interview can
        surface a real error to the user.
        """
        last_error = None
        for attempt in range(1, self._initial_connect_max_attempts + 1):
            try:
                await self._connect_once()
                self._reconnect_attempts = 0  # Reset on successful connect
                print("Deepgram connection started successfully")
                return
            except Exception as e:
                last_error = e
                self.is_connected = False
                app_metrics.inc("deepgram_connect_failures")
                print(f"Deepgram connect attempt {attempt}/{self._initial_connect_max_attempts} failed: {e}")
                if attempt < self._initial_connect_max_attempts:
                    delay = self._reconnect_base_delay * (2 ** (attempt - 1))
                    await asyncio.sleep(delay)

        self.is_connected = False
        print(f"ERROR: Could not start Deepgram connection after "
              f"{self._initial_connect_max_attempts} attempts: {last_error}")
        raise RuntimeError(f"Deepgram connection failed: {last_error}") from last_error

    async def _connect_once(self):
        """Create a fresh Deepgram connection and start it (single attempt)."""
        try:
            self.dg_connection = self.deepgram.listen.asyncwebsocket.v("1")
        except (AttributeError, Exception):
            self.dg_connection = self.deepgram.listen.asynclive.v("1")

        self.dg_connection.on(LiveTranscriptionEvents.Open, self.on_open)
        self.dg_connection.on(LiveTranscriptionEvents.Transcript, self.on_message)
        self.dg_connection.on(LiveTranscriptionEvents.Error, self.on_error)
        self.dg_connection.on(LiveTranscriptionEvents.Close, self.on_close)

        # Generate programming and technical keyterms for better accuracy (List[str])
        programming_keyterms = self.get_programming_keyterms(self.user_languages)
        
        # Optimized settings for real-time transcription with Nova-3
        options = LiveOptions(
            model="nova-3",  # Updated to Nova-3 for better accuracy
            language=self.language,  # P1: 'en' or 'multi' (code-switching)
            smart_format=True,
            encoding="linear16",
            channels=1,
            sample_rate=48000,  # Pinned client-side by TARGET_SAMPLE_RATE in web/js/audio_handler.js
            diarize=False,
            punctuate=True,
            # Responsive speech endpointing (300ms silence detection for fast turnaround)
            utterance_end_ms="1000",
            endpointing=300,
            # Additional settings
            vad_events=True,
            interim_results=True,
            filler_words=False,  # Suppress filler words for cleaner technical transcripts
            numerals=True,
            multichannel=False,
            alternatives=1,
            # Electrical keyterms for better technical accuracy
            keyterm=programming_keyterms,
            replace=[
                "fist:phase",
                "fists:phases",
                "single fist:single phase",
                "three fist:three phase",
                "single face:single phase",
                "three face:three phase",
                "1 fist:single phase",
                "3 fist:three phase",
                "split face:split phase",
                "index motor:induction motor",
                "injection motor:induction motor",
                "infection motor:induction motor",
                "inductance motor:induction motor",
                "mode index motor:wound rotor induction motor",
                "mode index:induction",
                "sink run us motor:synchronous motor",
                "sink runner motor:synchronous motor",
                "synch motor:synchronous motor",
                "sleep ring:slip ring",
                "girl cage:squirrel cage",
                "screw cage:squirrel cage",
                "square cage:squirrel cage",
                "router:rotor",
                "state or:stator",
                "arm mature:armature",
                "armor cher:armature",
                "community or:commutator",
                "carbon rushes:carbon brushes",
                "back em if:back EMF",
                "back in my:back EMF",
                "BFD:VFD",
                "BFDs:VFDs",
                "VFT:VFD",
                "be able frequency:variable frequency",
                "be able frequency drive:variable frequency drive",
                "major frequency:variable frequency",
                "major frequency drive:variable frequency drive",
                "moss fat:MOSFET",
                "most fat:MOSFET",
                "moss fit:MOSFET",
                "i g b t:IGBT",
                "thy sister:thyristor",
                "snobber circuit:snubber circuit",
                "snub or circuit:snubber circuit",
                "gay driver:gate driver",
                "my chick:mic check",
                "my check:mic check",
                "Mike check:mic check",
                "ckt:circuit",
                "circuits:circuit",
                "equivalent ckt:equivalent circuit",
                "equivalent circle:equivalent circuit",
                "magnetizing reactants:magnetizing reactance",
                "leakage reactants:leakage reactance",
                "corless:core loss",
                "cor loss:core loss",
                "eddie current:eddy current",
                "history sis:hysteresis",
                "book holes:Buchholz",
                "buckles relay:Buchholz relay",
                "buckholtz relay:Buchholz relay",
                "book holds relay:Buchholz relay",
                "conservative tank:conservator tank",
                "silicon gel:silica gel",
                "shunt mood:shunt motor",
                "shunt mower:shunt motor",
                "series mood:series motor",
                "mc cb:MCCB",
                "empty cb:MCCB",
                "mc be:MCB",
                "vc be:VCB",
                "ac be:ACB",
                "s f six:SF6",
                "buzz bar:busbar",
                "boss bar:busbar",
                "art fault:earth fault",
                "thermal overload really:thermal overload relay",
                "start delta:star-delta",
                "star delta:star-delta",
                "delta star:delta-star",
                "no load:no-load",
                "full load:full-load",
                "reacting power:reactive power",
                "power factory:power factor",
                "impudence:impedance",
                "inductive reactants:inductive reactance",
                "capacitive reactants:capacitive reactance",
                "seven in theorem:Thevenin theorem",
                "thevnin theorem:Thevenin theorem",
                "curt off law:Kirchhoff law",
                "kirchoff:Kirchhoff",
                "sign you saw idle:sinusoidal",
                "k bar:kVAR"
            ]
        )
        
        try:
            await self.dg_connection.start(options)
            self.is_connected = True
        except Exception as e:
            self.is_connected = False
            raise  # A2: propagate so start() can retry and eventually surface the error

    async def _reconnect(self):
        """Attempt to reconnect to Deepgram with exponential backoff.

        A1: singleflight - if a reconnect loop is already running, this call
        returns immediately instead of spawning a second racing loop.
        """
        if self.stop_event.is_set():
            return
        existing = self._reconnect_task
        if existing is not None and not existing.done():
            return  # Another reconnect loop is already in flight
        self._reconnect_task = asyncio.current_task()
        try:
            await self._reconnect_loop()
        finally:
            self._reconnect_task = None

    async def _reconnect_loop(self):
        """Reconnect rounds with exponential backoff until success or max attempts.

        All rounds run inside the SAME task (the singleflight holder), so a
        failure never spawns a replacement task and the attempt count stays honest.
        """
        if self.stop_event.is_set():
            return
        if self._reconnect_attempts >= self._max_reconnect_attempts:
            print(f"❌ Deepgram: max reconnect attempts ({self._max_reconnect_attempts}) reached, giving up")
            return

        while not self.stop_event.is_set() and self._reconnect_attempts < self._max_reconnect_attempts:
            self._reconnect_attempts += 1
            delay = self._reconnect_base_delay * (2 ** (self._reconnect_attempts - 1))
            print(f"🔄 Deepgram reconnect attempt {self._reconnect_attempts}/{self._max_reconnect_attempts} in {delay:.1f}s...")
            await asyncio.sleep(delay)

            if self.stop_event.is_set():
                return

            try:
                await self.start()  # start() applies its own per-round retry budget
                print(f"✅ Deepgram reconnected after {self._reconnect_attempts} attempt(s)")
                return
            except Exception as e:
                self.is_connected = False
                print(f"❌ Deepgram reconnect failed: {e}")
                app_metrics.inc("deepgram_reconnects")
                # Loop continues to the next backoff round

        if self._reconnect_attempts >= self._max_reconnect_attempts:
            print(f"❌ Deepgram: max reconnect attempts ({self._max_reconnect_attempts}) reached, giving up")

    async def on_open(self, *args, **kwargs):
        print("🔗 Deepgram connection opened")
        self.is_connected = True

    async def on_message(self, *args, **kwargs):
        if self.stop_event.is_set():
            return
        
        try:
            result = kwargs['result']
            
            # Check if result has the expected structure and non-empty transcript
            if (hasattr(result, 'channel') and 
                hasattr(result.channel, 'alternatives') and 
                len(result.channel.alternatives) > 0):
                
                alternative = result.channel.alternatives[0]
                transcript = clean_electrical_transcript(alternative.transcript)
                
                if len(transcript.strip()) > 0:  # Only process non-empty transcripts
                    # Check if this is a final result or interim
                    is_final = getattr(result, 'is_final', True)
                    
                    # Debug logging to track final vs interim
                    result_type = "FINAL" if is_final else "interim"
                    print(f"🔍 Deepgram result type: {result_type}, is_final: {is_final}")
                    
                    # Get speaker from words array (Deepgram's diarization format)
                    speaker = 0  # Default to candidate (when diarization is disabled, all speech is from speaker 0)
                    
                    # Only try to extract speaker info if diarization was enabled
                    # When diarization is disabled, Deepgram doesn't provide speaker information
                    try:
                        if hasattr(alternative, 'words') and len(alternative.words) > 0:
                            # Use the speaker of the first word
                            first_word = alternative.words[0]
                            if hasattr(first_word, 'speaker') and first_word.speaker is not None:
                                speaker = first_word.speaker
                            elif hasattr(first_word, '__getitem__') and 'speaker' in first_word:
                                # Fallback: try to access speaker as dictionary key
                                speaker = first_word['speaker']
                    except (AttributeError, KeyError, IndexError):
                        # If any error occurs accessing speaker info, stick with default (speaker 0)
                        # This is expected when diarization is disabled
                        pass
                    
                    if is_final:
                        # Process final results immediately - no buffering
                        print(f"✅ FINAL RESULT: Speaker {speaker} - '{transcript.strip()}'")
                        await self.send_final_result(speaker, transcript.strip())
                    else:
                        # Show interim results immediately for real-time feedback
                        print(f"📝 TRANSCRIPT (interim): Speaker {speaker} - '{transcript.strip()}'")
                        
                        # Send interim updates to client for real-time display
                        interim_data = {
                            "speaker": speaker,
                            "transcript": transcript.strip(),
                            "is_final": False
                        }
                        await self.transcript_callback(interim_data)
                        
        except Exception as e:
            print(f"❌ ERROR: Exception in transcript processing: {e}")

    # Removed buffering system - final results are now processed immediately

    async def send_final_result(self, speaker, transcript):
        """Send the final result to the callback."""
        print(f"📝 TRANSCRIPT (FINAL): Speaker {speaker} - '{transcript}'")
        
        transcript_data = {
            "speaker": speaker,
            "transcript": transcript,
            "is_final": True
        }
        await self.transcript_callback(transcript_data)

    async def on_error(self, *args, **kwargs):
        if self.stop_event.is_set():
            return
        error = kwargs.get('error', 'unknown')
        print(f"❌ Deepgram error: {error}")
        self.is_connected = False
        # Trigger auto-reconnect on error (singleflight-guarded in _reconnect)
        asyncio.create_task(self._reconnect())

    async def on_close(self, *args, **kwargs):
        print("🔌 Deepgram connection closed")
        self.is_connected = False
        # Auto-reconnect if we didn't intentionally close (singleflight-guarded,
        # so on_error + on_close firing together only produces one loop)
        if not self.stop_event.is_set():
            print("⚠️ Unexpected Deepgram close, attempting reconnect...")
            asyncio.create_task(self._reconnect())

    async def send_audio(self, audio_chunk, source='unknown'):
        """Sends an audio chunk to Deepgram."""
        if self.is_connected and self.dg_connection and not self.stop_event.is_set():
            await self.dg_connection.send(audio_chunk)

    async def finish(self):
        """Signals the connection to close and finishes it."""
        print("🛑 Closing Deepgram connection...")
        self.stop_event.set()
        
        # A1: stop any in-flight reconnect loop before closing the socket.
        task = self._reconnect_task
        if task is not None and not task.done():
            task.cancel()
            try:
                await task
            except (asyncio.CancelledError, Exception):
                pass
        self._reconnect_task = None

        if self.dg_connection:
            await self.dg_connection.finish()
            print("✅ Deepgram connection closed successfully")