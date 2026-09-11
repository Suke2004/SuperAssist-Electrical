// Schematics Engine for SuperAssist EE
// Generates textbook-grade, vector-accurate, high-contrast electrical circuit diagrams (SVG)
// for core electrical machines, transformers, and power systems.

export class SchematicsEngine {
    /**
     * Identify if the text or SVG content matches a standard electrical circuit
     * @param {string} text - Content or prompt
     * @returns {string|null} - Circuit key or null
     */
    static detectCircuitType(text) {
        if (!text || typeof text !== 'string') return null;
        const lower = text.toLowerCase();

        // 1. Transformer equivalent circuit
        if (
            (lower.includes('transformer') && (lower.includes('equivalent') || lower.includes('ckt') || lower.includes('circuit') || lower.includes('referred') || lower.includes('approximate'))) ||
            (lower.includes('zp = rp') && lower.includes('zs = rs')) ||
            (lower.includes('rc') && lower.includes('xm') && lower.includes('transformer')) ||
            (lower.includes('core loss') && lower.includes('magnetizing') && lower.includes('winding'))
        ) {
            return 'transformer';
        }

        // 2. Induction motor equivalent circuit
        if (
            (lower.includes('induction motor') && (lower.includes('equivalent') || lower.includes('circuit') || lower.includes('ckt') || lower.includes('per-phase') || lower.includes('stator') || lower.includes('rotor'))) ||
            (lower.includes('rr\'/s') || lower.includes("rr'/s") || lower.includes('r2\'/s') || lower.includes("r2'/s") || lower.includes('r2/s')) ||
            (lower.includes('rm || jxm') || lower.includes('rs + jxs')) ||
            (lower.includes('rotor') && lower.includes('slip') && lower.includes('stator') && lower.includes('xm'))
        ) {
            return 'induction-motor';
        }

        // 3. DC Shunt Motor
        if (
            (lower.includes('shunt motor') || lower.includes('dc shunt')) &&
            (lower.includes('circuit') || lower.includes('ckt') || lower.includes('diagram') || lower.includes('draw') || lower.includes('schematic') || lower.includes('connection'))
        ) {
            return 'dc-shunt-motor';
        }

        // 4. DC Series Motor
        if (
            (lower.includes('series motor') || lower.includes('dc series')) &&
            (lower.includes('circuit') || lower.includes('ckt') || lower.includes('diagram') || lower.includes('draw') || lower.includes('schematic'))
        ) {
            return 'dc-series-motor';
        }

        // 5. Synchronous Machine
        if (
            (lower.includes('synchronous motor') || lower.includes('synchronous generator') || lower.includes('alternator')) &&
            (lower.includes('equivalent') || lower.includes('circuit') || lower.includes('ckt') || lower.includes('xs') || lower.includes('ef'))
        ) {
            return 'synchronous-machine';
        }

        // 6. Generic/fallback match from crude box SVG
        if (lower.includes('switch') && lower.includes('fuse') && lower.includes('ra') && lower.includes('rf')) {
            return 'dc-shunt-motor';
        }

        return null;
    }

    /**
     * Helper to create horizontal zigzag resistor path
     */
    static zigzagH(x, y, length = 50, height = 12) {
        const seg = length / 6;
        return `M ${x} ${y} l ${seg * 0.5} ${-height} l ${seg} ${height * 2} l ${seg} ${-height * 2} l ${seg} ${height * 2} l ${seg} ${-height * 2} l ${seg} ${height * 2} l ${seg * 0.5} ${-height}`;
    }

    /**
     * Helper to create vertical zigzag resistor path
     */
    static zigzagV(x, y, length = 40, width = 10) {
        const seg = length / 6;
        return `M ${x} ${y} l ${-width} ${seg * 0.5} l ${width * 2} ${seg} l ${-width * 2} ${seg} l ${width * 2} ${seg} l ${-width * 2} ${seg} l ${width * 2} ${seg} l ${-width} ${seg * 0.5}`;
    }

    /**
     * Helper to create horizontal coil (inductor) path with 4 curved loops
     */
    static coilH(x, y, loops = 4, radius = 9) {
        let d = `M ${x} ${y}`;
        for (let i = 0; i < loops; i++) {
            const startX = x + i * (radius * 2);
            d += ` A ${radius} ${radius} 0 0 1 ${startX + radius * 2} ${y}`;
        }
        return d;
    }

    /**
     * Helper to create vertical coil (inductor) path with curved loops
     */
    static coilV(x, y, loops = 4, radius = 8) {
        let d = `M ${x} ${y}`;
        for (let i = 0; i < loops; i++) {
            const startY = y + i * (radius * 2);
            d += ` A ${radius} ${radius} 0 0 1 ${x} ${startY + radius * 2}`;
        }
        return d;
    }

    /**
     * Generate 1. Transformer Exact & Approximate Equivalent Circuit (SVG)
     */
    static getTransformerCircuitSVG() {
        return `<svg viewBox="0 0 880 340" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" class="ee-schematic-svg">
  <defs>
    <!-- Arrow marker for currents and voltages -->
    <marker id="ee-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#38bdf8" />
    </marker>
    <marker id="ee-arrow-amber" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#fbbf24" />
    </marker>
    <!-- Component label badge styling -->
    <style>
      .ee-line { stroke: #38bdf8; stroke-width: 2.2; fill: none; stroke-linecap: round; stroke-linejoin: round; }
      .ee-core-line { stroke: #94a3b8; stroke-width: 2.5; stroke-dasharray: 4 2; }
      .ee-wire { stroke: #64748b; stroke-width: 2; fill: none; }
      .ee-bus { stroke: #e2e8f0; stroke-width: 2.5; fill: none; }
      .ee-text-title { fill: #38bdf8; font-family: Inter, sans-serif; font-size: 14px; font-weight: 700; }
      .ee-text-main { fill: #f8fafc; font-family: Inter, sans-serif; font-size: 12px; font-weight: 600; text-anchor: middle; }
      .ee-text-sub { fill: #94a3b8; font-family: Inter, sans-serif; font-size: 10.5px; text-anchor: middle; }
      .ee-text-val { fill: #38bdf8; font-family: monospace; font-size: 11px; text-anchor: middle; }
      .ee-dot { fill: #38bdf8; }
      .ee-badge { fill: #0f172a; stroke: #334155; stroke-width: 1; rx: 4; }
    </style>
  </defs>

  <!-- Title & Subtitle Badge -->
  <rect x="20" y="12" width="460" height="26" class="ee-badge" />
  <text x="32" y="30" class="ee-text-title">⚡ TRANSFORMER EQUIVALENT CIRCUIT (REFERRED TO PRIMARY)</text>

  <!-- Ground / Neutral Return Bus at Bottom (y = 280) -->
  <line x1="60" y1="280" x2="820" y2="280" class="ee-bus" />
  <!-- Ground symbol at center bottom -->
  <line x1="440" y1="280" x2="440" y2="295" class="ee-wire" />
  <line x1="428" y1="295" x2="452" y2="295" class="ee-bus" />
  <line x1="432" y1="300" x2="448" y2="300" class="ee-bus" />
  <line x1="437" y1="305" x2="443" y2="305" class="ee-bus" />
  <text x="440" y="322" class="ee-text-sub">Common Reference / Ground (0 V)</text>

  <!-- ================= PRIMARY SUPPLY V1 ================= -->
  <!-- AC Source Circle -->
  <circle cx="80" cy="180" r="22" class="ee-line" fill="#0f172a" />
  <!-- Sine wave inside source -->
  <path d="M 68 180 q 6 -10 12 0 t 12 0" class="ee-line" />
  <!-- Terminals -->
  <line x1="80" y1="80" x2="80" y2="158" class="ee-bus" />
  <line x1="80" y1="202" x2="80" y2="280" class="ee-bus" />
  <text x="80" y="70" class="ee-text-main">+ V₁</text>
  <text x="80" y="270" class="ee-text-sub">-</text>
  <!-- Supply Voltage Arrow -->
  <line x1="45" y1="260" x2="45" y2="100" class="ee-line" stroke="#38bdf8" marker-end="url(#ee-arrow)" />
  <text x="35" y="185" class="ee-text-val" transform="rotate(-90 35 185)">Supply V₁</text>

  <!-- Primary Current I1 Arrow -->
  <line x1="80" y1="80" x2="115" y2="80" class="ee-bus" />
  <line x1="100" y1="72" x2="135" y2="72" class="ee-line" marker-end="url(#ee-arrow)" />
  <text x="118" y="64" class="ee-text-main">I₁ (Primary Current)</text>

  <!-- ================= PRIMARY WINDING IMPEDANCE (R1 + jX1) ================= -->
  <!-- Line into R1 -->
  <line x1="115" y1="80" x2="140" y2="80" class="ee-bus" />
  <!-- Resistor R1 (zigzag) -->
  <path d="${SchematicsEngine.zigzagH(140, 80, 50, 11)}" class="ee-line" stroke="#38bdf8" />
  <text x="165" y="58" class="ee-text-main">R₁</text>
  <text x="165" y="108" class="ee-text-sub">Primary Res.</text>

  <!-- Connection wire from R1 to X1 -->
  <line x1="190" y1="80" x2="215" y2="80" class="ee-bus" />
  <!-- Inductor X1 (coils) -->
  <path d="${SchematicsEngine.coilH(215, 80, 4, 8)}" class="ee-line" stroke="#38bdf8" />
  <text x="250" y="58" class="ee-text-main">jX₁</text>
  <text x="250" y="108" class="ee-text-sub">Leakage React.</text>

  <!-- Node A (after primary series impedance) -->
  <line x1="279" y1="80" x2="330" y2="80" class="ee-bus" />
  <circle cx="330" cy="80" r="3.5" class="ee-dot" />

  <!-- ================= SHUNT EXCITATION BRANCH (Rc || jXm) ================= -->
  <!-- Wire down to excitation branch split -->
  <line x1="330" y1="80" x2="330" y2="110" class="ee-bus" />
  <line x1="300" y1="110" x2="360" y2="110" class="ee-bus" />

  <!-- Branch 1: Core Loss Resistor Rc (vertical) -->
  <line x1="300" y1="110" x2="300" y2="135" class="ee-bus" />
  <path d="${SchematicsEngine.zigzagV(300, 135, 45, 9)}" class="ee-line" stroke="#fbbf24" />
  <line x1="300" y1="180" x2="300" y2="280" class="ee-bus" />
  <text x="275" y="162" class="ee-text-main" fill="#fbbf24">Rc</text>
  <text x="275" y="176" class="ee-text-sub">Core Loss</text>
  <!-- Current Ic arrow -->
  <line x1="290" y1="120" x2="290" y2="140" class="ee-line" stroke="#fbbf24" marker-end="url(#ee-arrow-amber)" />
  <text x="278" y="132" class="ee-text-sub" fill="#fbbf24">Ic</text>

  <!-- Branch 2: Magnetizing Reactance Xm (vertical) -->
  <line x1="360" y1="110" x2="360" y2="135" class="ee-bus" />
  <path d="${SchematicsEngine.coilV(360, 135, 3, 7.5)}" class="ee-line" stroke="#38bdf8" />
  <line x1="360" y1="180" x2="360" y2="280" class="ee-bus" />
  <text x="390" y="162" class="ee-text-main">jXm</text>
  <text x="390" y="176" class="ee-text-sub">Magnetizing</text>
  <!-- Current Im arrow -->
  <line x1="372" y1="120" x2="372" y2="140" class="ee-line" marker-end="url(#ee-arrow)" />
  <text x="384" y="132" class="ee-text-sub">Im</text>

  <!-- Excitation current label I0 -->
  <text x="348" y="98" class="ee-text-main" fill="#38bdf8">I₀</text>

  <!-- Node connection back to bottom bus -->
  <circle cx="300" cy="280" r="3" class="ee-dot" />
  <circle cx="360" cy="280" r="3" class="ee-dot" />

  <!-- ================= IDEAL TRANSFORMER / COUPLING ================= -->
  <!-- Wire from Node A to Ideal Primary Winding -->
  <line x1="330" y1="80" x2="450" y2="80" class="ee-bus" />
  <line x1="450" y1="80" x2="450" y2="130" class="ee-bus" />

  <!-- Primary Winding N1 (vertical coil) -->
  <path d="${SchematicsEngine.coilV(450, 130, 4, 8)}" class="ee-line" stroke="#38bdf8" />
  <line x1="450" y1="194" x2="450" y2="280" class="ee-bus" />
  <circle cx="450" cy="280" r="3" class="ee-dot" />
  <!-- Polarity Dot Primary -->
  <circle cx="438" cy="135" r="3.5" class="ee-dot" />
  <text x="432" y="166" class="ee-text-main">N₁</text>

  <!-- Ferromagnetic Core (2 parallel vertical dashed lines) -->
  <line x1="468" y1="120" x2="468" y2="204" class="ee-core-line" />
  <line x1="474" y1="120" x2="474" y2="204" class="ee-core-line" />
  <text x="471" y="105" class="ee-text-sub">Core</text>

  <!-- Secondary Winding N2 (vertical coil) -->
  <line x1="492" y1="80" x2="492" y2="130" class="ee-bus" />
  <path d="${SchematicsEngine.coilV(492, 130, 4, 8)}" class="ee-line" stroke="#38bdf8" />
  <line x1="492" y1="194" x2="492" y2="280" class="ee-bus" />
  <circle cx="492" cy="280" r="3" class="ee-dot" />
  <!-- Polarity Dot Secondary -->
  <circle cx="504" cy="135" r="3.5" class="ee-dot" />
  <text x="510" y="166" class="ee-text-main">N₂</text>

  <!-- Ideal Transformer Turns Ratio Box -->
  <rect x="440" y="215" width="62" height="20" class="ee-badge" />
  <text x="471" y="229" class="ee-text-sub">1 : a</text>

  <!-- ================= SECONDARY BRANCH (R2' + jX2') ================= -->
  <!-- Wire from secondary winding top to R2' -->
  <line x1="492" y1="80" x2="540" y2="80" class="ee-bus" />
  <!-- Secondary Current I2' Arrow -->
  <line x1="505" y1="72" x2="535" y2="72" class="ee-line" marker-end="url(#ee-arrow)" />
  <text x="520" y="64" class="ee-text-main">I₂'</text>

  <!-- Resistor R2' (zigzag) -->
  <path d="${SchematicsEngine.zigzagH(540, 80, 50, 11)}" class="ee-line" stroke="#38bdf8" />
  <text x="565" y="58" class="ee-text-main">R₂'</text>
  <text x="565" y="108" class="ee-text-sub">Sec. Res. (Ref)</text>

  <!-- Connection wire from R2' to X2' -->
  <line x1="590" y1="80" x2="615" y2="80" class="ee-bus" />
  <!-- Inductor X2' (coils) -->
  <path d="${SchematicsEngine.coilH(615, 80, 4, 8)}" class="ee-line" stroke="#38bdf8" />
  <text x="650" y="58" class="ee-text-main">jX₂'</text>
  <text x="650" y="108" class="ee-text-sub">Sec. Leakage</text>

  <!-- Connection to Load Terminals -->
  <line x1="679" y1="80" x2="750" y2="80" class="ee-bus" />

  <!-- ================= LOAD IMPEDANCE ZL' ================= -->
  <!-- Output Terminals -->
  <circle cx="750" cy="80" r="4" fill="#0f172a" stroke="#38bdf8" stroke-width="2" />
  <circle cx="750" cy="280" r="4" fill="#0f172a" stroke="#38bdf8" stroke-width="2" />
  <text x="750" y="68" class="ee-text-main">+ V₂'</text>
  <text x="750" y="296" class="ee-text-sub">-</text>

  <!-- Load Impedance Box (or resistor) -->
  <line x1="750" y1="84" x2="790" y2="84" class="ee-bus" />
  <line x1="790" y1="84" x2="790" y2="140" class="ee-bus" />
  <rect x="770" y="140" width="40" height="80" fill="#0f172a" stroke="#38bdf8" stroke-width="2" rx="4" />
  <text x="790" y="184" class="ee-text-main" fill="#38bdf8">ZL'</text>
  <text x="790" y="200" class="ee-text-sub">Load</text>
  <line x1="790" y1="220" x2="790" y2="280" class="ee-bus" />
  <line x1="790" y1="280" x2="754" y2="280" class="ee-bus" />

  <!-- Key Relations Summary Box at top right -->
  <rect x="580" y="12" width="280" height="26" class="ee-badge" />
  <text x="720" y="29" class="ee-text-val">R₂' = a²·R₂ | X₂' = a²·X₂ | V₂' = a·V₂</text>
</svg>`;
    }

    /**
     * Generate 2. 3-Phase Induction Motor Per-Phase Equivalent Circuit (SVG)
     */
    static getInductionMotorCircuitSVG() {
        return `<svg viewBox="0 0 880 340" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" class="ee-schematic-svg">
  <defs>
    <marker id="ee-im-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#38bdf8" />
    </marker>
    <style>
      .ee-line { stroke: #38bdf8; stroke-width: 2.2; fill: none; stroke-linecap: round; stroke-linejoin: round; }
      .ee-gap-line { stroke: #eab308; stroke-width: 1.8; stroke-dasharray: 5 4; }
      .ee-bus { stroke: #e2e8f0; stroke-width: 2.5; fill: none; }
      .ee-text-title { fill: #38bdf8; font-family: Inter, sans-serif; font-size: 14px; font-weight: 700; }
      .ee-text-main { fill: #f8fafc; font-family: Inter, sans-serif; font-size: 12px; font-weight: 600; text-anchor: middle; }
      .ee-text-sub { fill: #94a3b8; font-family: Inter, sans-serif; font-size: 10.5px; text-anchor: middle; }
      .ee-text-val { fill: #38bdf8; font-family: monospace; font-size: 11px; text-anchor: middle; }
      .ee-dot { fill: #38bdf8; }
      .ee-badge { fill: #0f172a; stroke: #334155; stroke-width: 1; rx: 4; }
    </style>
  </defs>

  <!-- Title Badge -->
  <rect x="20" y="12" width="510" height="26" class="ee-badge" />
  <text x="32" y="30" class="ee-text-title">⚡ 3-PHASE INDUCTION MOTOR PER-PHASE EQUIVALENT CIRCUIT</text>

  <!-- Stator vs Rotor boundary labels -->
  <rect x="180" y="44" width="160" height="20" class="ee-badge" />
  <text x="260" y="58" class="ee-text-sub" fill="#38bdf8">STATOR (Stationary)</text>

  <rect x="520" y="44" width="160" height="20" class="ee-badge" />
  <text x="600" y="58" class="ee-text-sub" fill="#eab308">ROTOR (Referred to Stator)</text>

  <!-- Air Gap Boundary Line -->
  <line x1="440" y1="40" x2="440" y2="290" class="ee-gap-line" />
  <text x="440" y="306" class="ee-text-val" fill="#eab308">Air Gap Boundary</text>

  <!-- Common Return Bus at Bottom (y = 260) -->
  <line x1="60" y1="260" x2="820" y2="260" class="ee-bus" />
  <line x1="440" y1="260" x2="440" y2="275" stroke="#64748b" stroke-width="2" />
  <line x1="428" y1="275" x2="452" y2="275" class="ee-bus" />
  <line x1="432" y1="280" x2="448" y2="280" class="ee-bus" />
  <line x1="437" y1="285" x2="443" y2="285" class="ee-bus" />

  <!-- ================= STATOR VOLTAGE V1 ================= -->
  <circle cx="80" cy="170" r="22" class="ee-line" fill="#0f172a" />
  <path d="M 68 170 q 6 -10 12 0 t 12 0" class="ee-line" />
  <line x1="80" y1="80" x2="80" y2="148" class="ee-bus" />
  <line x1="80" y1="192" x2="80" y2="260" class="ee-bus" />
  <text x="80" y="70" class="ee-text-main">+ V₁ (Phase)</text>
  <text x="80" y="250" class="ee-text-sub">-</text>

  <!-- Stator Current I1 -->
  <line x1="80" y1="80" x2="115" y2="80" class="ee-bus" />
  <line x1="95" y1="72" x2="125" y2="72" class="ee-line" marker-end="url(#ee-im-arrow)" />
  <text x="110" y="64" class="ee-text-main">I₁</text>

  <!-- ================= STATOR IMPEDANCE (R1 + jX1) ================= -->
  <line x1="115" y1="80" x2="135" y2="80" class="ee-bus" />
  <!-- Stator Resistance R1 -->
  <path d="${SchematicsEngine.zigzagH(135, 80, 50, 11)}" class="ee-line" stroke="#38bdf8" />
  <text x="160" y="58" class="ee-text-main">R₁</text>
  <text x="160" y="106" class="ee-text-sub">Stator Res.</text>

  <line x1="185" y1="80" x2="210" y2="80" class="ee-bus" />
  <!-- Stator Leakage Reactance X1 -->
  <path d="${SchematicsEngine.coilH(210, 80, 4, 8)}" class="ee-line" stroke="#38bdf8" />
  <text x="245" y="58" class="ee-text-main">jX₁</text>
  <text x="245" y="106" class="ee-text-sub">Stator Leakage</text>

  <!-- Node before air-gap -->
  <line x1="274" y1="80" x2="330" y2="80" class="ee-bus" />
  <circle cx="330" cy="80" r="3.5" class="ee-dot" />

  <!-- ================= SHUNT MAGNETIZING BRANCH (Rc || jXm) ================= -->
  <line x1="330" y1="80" x2="330" y2="105" class="ee-bus" />
  <line x1="300" y1="105" x2="360" y2="105" class="ee-bus" />

  <!-- Core loss branch Rc -->
  <line x1="300" y1="105" x2="300" y2="125" class="ee-bus" />
  <path d="${SchematicsEngine.zigzagV(300, 125, 45, 9)}" class="ee-line" stroke="#fbbf24" />
  <line x1="300" y1="170" x2="300" y2="260" class="ee-bus" />
  <circle cx="300" cy="260" r="3" class="ee-dot" />
  <text x="275" y="150" class="ee-text-main" fill="#fbbf24">Rc</text>
  <text x="275" y="164" class="ee-text-sub">Core Loss</text>

  <!-- Magnetizing reactance Xm -->
  <line x1="360" y1="105" x2="360" y2="125" class="ee-bus" />
  <path d="${SchematicsEngine.coilV(360, 125, 3, 7.5)}" class="ee-line" stroke="#38bdf8" />
  <line x1="360" y1="170" x2="360" y2="260" class="ee-bus" />
  <circle cx="360" cy="260" r="3" class="ee-dot" />
  <text x="390" y="150" class="ee-text-main">jXm</text>
  <text x="390" y="164" class="ee-text-sub">Mag. React.</text>

  <text x="348" y="96" class="ee-text-main" fill="#38bdf8">I₀</text>

  <!-- ================= ROTOR BRANCH (X2' + R2'/s) ================= -->
  <line x1="330" y1="80" x2="480" y2="80" class="ee-bus" />
  <!-- Rotor current I2' -->
  <line x1="450" y1="72" x2="480" y2="72" class="ee-line" marker-end="url(#ee-im-arrow)" />
  <text x="465" y="64" class="ee-text-main">I₂'</text>

  <!-- Rotor Leakage Reactance X2' -->
  <path d="${SchematicsEngine.coilH(480, 80, 4, 8)}" class="ee-line" stroke="#38bdf8" />
  <text x="515" y="58" class="ee-text-main">jX₂'</text>
  <text x="515" y="106" class="ee-text-sub">Rotor Leakage</text>

  <line x1="544" y1="80" x2="575" y2="80" class="ee-bus" />

  <!-- Rotor Internal Resistance R2' -->
  <path d="${SchematicsEngine.zigzagH(575, 80, 45, 11)}" class="ee-line" stroke="#38bdf8" />
  <text x="597" y="58" class="ee-text-main">R₂'</text>
  <text x="597" y="106" class="ee-text-sub">Rotor Winding</text>

  <line x1="620" y1="80" x2="655" y2="80" class="ee-bus" />

  <!-- Mechanical Load Resistance R2'(1-s)/s -->
  <path d="${SchematicsEngine.zigzagH(655, 80, 55, 11)}" class="ee-line" stroke="#eab308" />
  <!-- Variable resistor arrow across load -->
  <line x1="660" y1="98" x2="705" y2="62" stroke="#eab308" stroke-width="2" marker-end="url(#ee-im-arrow)" />
  <text x="682" y="54" class="ee-text-main" fill="#eab308">R₂'·(1-s)/s</text>
  <text x="682" y="112" class="ee-text-sub" fill="#eab308">Mech. Power (Pmech)</text>

  <!-- Complete rotor return to bus -->
  <line x1="710" y1="80" x2="760" y2="80" class="ee-bus" />
  <line x1="760" y1="80" x2="760" y2="260" class="ee-bus" />
  <line x1="760" y1="260" x2="710" y2="260" class="ee-bus" />

  <!-- Note Badge on slip -->
  <rect x="560" y="12" width="300" height="26" class="ee-badge" />
  <text x="710" y="29" class="ee-text-val">Total Rotor Resistance: R₂'/s = R₂' + R₂'(1-s)/s</text>
</svg>`;
    }

    /**
     * Generate 3. DC Shunt Motor Connection & Equivalent Circuit (SVG)
     */
    static getDCShuntMotorCircuitSVG() {
        return `<svg viewBox="0 0 880 340" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" class="ee-schematic-svg">
  <defs>
    <marker id="ee-dc-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#38bdf8" />
    </marker>
    <style>
      .ee-line { stroke: #38bdf8; stroke-width: 2.2; fill: none; stroke-linecap: round; stroke-linejoin: round; }
      .ee-bus { stroke: #e2e8f0; stroke-width: 2.5; fill: none; }
      .ee-text-title { fill: #38bdf8; font-family: Inter, sans-serif; font-size: 14px; font-weight: 700; }
      .ee-text-main { fill: #f8fafc; font-family: Inter, sans-serif; font-size: 12px; font-weight: 600; text-anchor: middle; }
      .ee-text-sub { fill: #94a3b8; font-family: Inter, sans-serif; font-size: 10.5px; text-anchor: middle; }
      .ee-text-val { fill: #38bdf8; font-family: monospace; font-size: 11px; text-anchor: middle; }
      .ee-dot { fill: #38bdf8; }
      .ee-badge { fill: #0f172a; stroke: #334155; stroke-width: 1; rx: 4; }
    </style>
  </defs>

  <!-- Title Badge -->
  <rect x="20" y="12" width="460" height="26" class="ee-badge" />
  <text x="32" y="30" class="ee-text-title">⚡ DC SHUNT MOTOR SCHEMATIC & EQUIVALENT CIRCUIT</text>

  <!-- Top Positive Rail (+ V_DC) -->
  <line x1="60" y1="80" x2="800" y2="80" class="ee-bus" />
  <!-- Bottom Negative Rail (- / Neutral) -->
  <line x1="60" y1="260" x2="800" y2="260" class="ee-bus" />

  <!-- ================= DC SUPPLY INPUT ================= -->
  <circle cx="80" cy="80" r="5" class="ee-dot" />
  <circle cx="80" cy="260" r="5" class="ee-dot" />
  <text x="80" y="65" class="ee-text-main">+ 220 V DC</text>
  <text x="80" y="280" class="ee-text-sub">- (Neutral / Return)</text>

  <!-- Switch & Fuse on Positive Rail -->
  <!-- Switch -->
  <circle cx="125" cy="80" r="3.5" fill="#38bdf8" />
  <line x1="125" y1="80" x2="155" y2="65" class="ee-line" stroke="#38bdf8" />
  <circle cx="160" cy="80" r="3.5" fill="#38bdf8" />
  <text x="142" y="55" class="ee-text-sub">Knife Switch</text>

  <!-- Fuse -->
  <rect x="180" y="72" width="36" height="16" fill="#0f172a" stroke="#38bdf8" stroke-width="1.8" rx="2" />
  <line x1="175" y1="80" x2="221" y2="80" class="ee-line" />
  <text x="198" y="65" class="ee-text-sub">Fuse</text>

  <!-- Total Line Current IL -->
  <line x1="235" y1="72" x2="270" y2="72" class="ee-line" marker-end="url(#ee-dc-arrow)" />
  <text x="252" y="64" class="ee-text-main">IL (Line Current)</text>

  <!-- Node 1: Branch to Shunt Field -->
  <circle cx="360" cy="80" r="4" class="ee-dot" />
  <circle cx="360" cy="260" r="4" class="ee-dot" />

  <!-- ================= SHUNT FIELD BRANCH (F1 - F2) ================= -->
  <!-- Field Current Ish -->
  <line x1="360" y1="80" x2="360" y2="105" class="ee-bus" />
  <line x1="370" y1="90" x2="370" y2="115" class="ee-line" marker-end="url(#ee-dc-arrow)" />
  <text x="390" y="105" class="ee-text-main">Ish</text>

  <!-- Field Regulator Rheostat (R_ext) -->
  <path d="${SchematicsEngine.zigzagV(360, 105, 40, 9)}" class="ee-line" stroke="#fbbf24" />
  <line x1="345" y1="135" x2="375" y2="115" stroke="#fbbf24" stroke-width="1.8" marker-end="url(#ee-dc-arrow)" />
  <text x="320" y="125" class="ee-text-main" fill="#fbbf24">Rreg</text>
  <text x="320" y="138" class="ee-text-sub">Speed Ctrl</text>

  <line x1="360" y1="145" x2="360" y2="165" class="ee-bus" />
  <text x="345" y="165" class="ee-text-val">F₁</text>

  <!-- Shunt Field Inductor Winding (Lsh / Rsh) -->
  <path d="${SchematicsEngine.coilV(360, 165, 4, 8)}" class="ee-line" stroke="#38bdf8" />
  <text x="320" y="195" class="ee-text-main">Rsh, Lsh</text>
  <text x="320" y="208" class="ee-text-sub">Shunt Field</text>

  <text x="345" y="235" class="ee-text-val">F₂</text>
  <line x1="360" y1="229" x2="360" y2="260" class="ee-bus" />

  <!-- ================= ARMATURE BRANCH (A1 - A2) ================= -->
  <!-- Line to Armature Node -->
  <circle cx="600" cy="80" r="4" class="ee-dot" />
  <circle cx="600" cy="260" r="4" class="ee-dot" />

  <!-- Armature Current Ia -->
  <line x1="600" y1="80" x2="600" y2="105" class="ee-bus" />
  <line x1="610" y1="90" x2="610" y2="115" class="ee-line" marker-end="url(#ee-dc-arrow)" />
  <text x="630" y="105" class="ee-text-main">Ia (Armature)</text>

  <!-- Armature Resistance Ra (zigzag) -->
  <path d="${SchematicsEngine.zigzagV(600, 105, 38, 8)}" class="ee-line" stroke="#38bdf8" />
  <text x="575" y="126" class="ee-text-main">Ra</text>
  <text x="575" y="138" class="ee-text-sub">Arm. Res.</text>

  <line x1="600" y1="143" x2="600" y2="160" class="ee-bus" />
  <text x="585" y="160" class="ee-text-val">A₁</text>

  <!-- Armature Rotor Circle & Carbon Brushes -->
  <!-- Top Carbon Brush -->
  <rect x="592" y="157" width="16" height="8" fill="#e2e8f0" stroke="#38bdf8" stroke-width="1.5" />
  <!-- Armature Circle -->
  <circle cx="600" cy="190" r="25" fill="#0f172a" stroke="#38bdf8" stroke-width="2.5" />
  <text x="600" y="196" font-family="Inter, sans-serif" font-size="18px" font-weight="800" fill="#38bdf8" text-anchor="middle">A</text>
  <!-- Bottom Carbon Brush -->
  <rect x="592" y="215" width="16" height="8" fill="#e2e8f0" stroke="#38bdf8" stroke-width="1.5" />

  <!-- Back-EMF Arrow Eb opposing supply -->
  <line x1="638" y1="210" x2="638" y2="170" class="ee-line" stroke="#eab308" stroke-width="2" marker-end="url(#ee-dc-arrow)" />
  <text x="662" y="192" class="ee-text-main" fill="#eab308">+ Eb</text>
  <text x="662" y="206" class="ee-text-sub" fill="#eab308">Back-EMF</text>

  <text x="585" y="235" class="ee-text-val">A₂</text>
  <line x1="600" y1="223" x2="600" y2="260" class="ee-bus" />

  <!-- Key Equations Box at Top Right -->
  <rect x="520" y="12" width="340" height="26" class="ee-badge" />
  <text x="690" y="29" class="ee-text-val">V = Eb + Ia·Ra | IL = Ia + Ish | Ish = V / Rsh</text>
</svg>`;
    }

    /**
     * Generate 4. DC Series Motor Equivalent Circuit (SVG)
     */
    static getDCSeriesMotorCircuitSVG() {
        return `<svg viewBox="0 0 880 300" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" class="ee-schematic-svg">
  <defs>
    <marker id="ee-ser-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#38bdf8" />
    </marker>
    <style>
      .ee-line { stroke: #38bdf8; stroke-width: 2.2; fill: none; stroke-linecap: round; stroke-linejoin: round; }
      .ee-bus { stroke: #e2e8f0; stroke-width: 2.5; fill: none; }
      .ee-text-title { fill: #38bdf8; font-family: Inter, sans-serif; font-size: 14px; font-weight: 700; }
      .ee-text-main { fill: #f8fafc; font-family: Inter, sans-serif; font-size: 12px; font-weight: 600; text-anchor: middle; }
      .ee-text-sub { fill: #94a3b8; font-family: Inter, sans-serif; font-size: 10.5px; text-anchor: middle; }
      .ee-text-val { fill: #38bdf8; font-family: monospace; font-size: 11px; text-anchor: middle; }
      .ee-dot { fill: #38bdf8; }
      .ee-badge { fill: #0f172a; stroke: #334155; stroke-width: 1; rx: 4; }
    </style>
  </defs>

  <rect x="20" y="12" width="460" height="26" class="ee-badge" />
  <text x="32" y="30" class="ee-text-title">⚡ DC SERIES MOTOR EQUIVALENT CIRCUIT</text>

  <!-- Return Bus at Bottom -->
  <line x1="80" y1="230" x2="780" y2="230" class="ee-bus" />

  <!-- Supply V_DC -->
  <circle cx="80" cy="80" r="5" class="ee-dot" />
  <circle cx="80" cy="230" r="5" class="ee-dot" />
  <text x="80" y="65" class="ee-text-main">+ V_DC</text>
  <text x="80" y="250" class="ee-text-sub">- (Return)</text>

  <!-- Series Line Current IL = Ise = Ia -->
  <line x1="85" y1="80" x2="160" y2="80" class="ee-bus" />
  <line x1="105" y1="72" x2="140" y2="72" class="ee-line" marker-end="url(#ee-ser-arrow)" />
  <text x="122" y="64" class="ee-text-main">IL = Ise = Ia</text>

  <!-- Series Field Winding Rse (coil loops in line) -->
  <path d="${SchematicsEngine.coilH(160, 80, 4, 8)}" class="ee-line" stroke="#38bdf8" />
  <text x="195" y="58" class="ee-text-main">Rse, Lse</text>
  <text x="195" y="106" class="ee-text-sub">Series Field</text>

  <line x1="225" y1="80" x2="280" y2="80" class="ee-bus" />

  <!-- Armature Resistance Ra (zigzag) -->
  <path d="${SchematicsEngine.zigzagH(280, 80, 50, 11)}" class="ee-line" stroke="#38bdf8" />
  <text x="305" y="58" class="ee-text-main">Ra</text>
  <text x="305" y="106" class="ee-text-sub">Armature Res.</text>

  <line x1="330" y1="80" x2="440" y2="80" class="ee-bus" />
  <line x1="440" y1="80" x2="440" y2="120" class="ee-bus" />

  <!-- Armature Rotor Circle with Brushes -->
  <rect x="432" y="120" width="16" height="8" fill="#e2e8f0" stroke="#38bdf8" stroke-width="1.5" />
  <circle cx="440" cy="155" r="27" fill="#0f172a" stroke="#38bdf8" stroke-width="2.5" />
  <text x="440" y="162" font-family="Inter, sans-serif" font-size="20px" font-weight="800" fill="#38bdf8" text-anchor="middle">A</text>
  <rect x="432" y="182" width="16" height="8" fill="#e2e8f0" stroke="#38bdf8" stroke-width="1.5" />

  <!-- Back-EMF Arrow Eb -->
  <line x1="480" y1="180" x2="480" y2="135" class="ee-line" stroke="#eab308" stroke-width="2" marker-end="url(#ee-ser-arrow)" />
  <text x="508" y="155" class="ee-text-main" fill="#eab308">+ Eb</text>
  <text x="508" y="168" class="ee-text-sub" fill="#eab308">Back-EMF</text>

  <line x1="440" y1="190" x2="440" y2="230" class="ee-bus" />

  <!-- Key characteristics summary box -->
  <rect x="520" y="12" width="340" height="26" class="ee-badge" />
  <text x="690" y="29" class="ee-text-val">V = Eb + Ia·(Ra + Rse) | Torque T ∝ Ia²</text>
</svg>`;
    }

    /**
     * Generate 5. Synchronous Machine Equivalent Circuit (SVG)
     */
    static getSynchronousMachineCircuitSVG() {
        return `<svg viewBox="0 0 880 300" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" class="ee-schematic-svg">
  <defs>
    <marker id="ee-sync-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#38bdf8" />
    </marker>
    <style>
      .ee-line { stroke: #38bdf8; stroke-width: 2.2; fill: none; stroke-linecap: round; stroke-linejoin: round; }
      .ee-bus { stroke: #e2e8f0; stroke-width: 2.5; fill: none; }
      .ee-text-title { fill: #38bdf8; font-family: Inter, sans-serif; font-size: 14px; font-weight: 700; }
      .ee-text-main { fill: #f8fafc; font-family: Inter, sans-serif; font-size: 12px; font-weight: 600; text-anchor: middle; }
      .ee-text-sub { fill: #94a3b8; font-family: Inter, sans-serif; font-size: 10.5px; text-anchor: middle; }
      .ee-text-val { fill: #38bdf8; font-family: monospace; font-size: 11px; text-anchor: middle; }
      .ee-dot { fill: #38bdf8; }
      .ee-badge { fill: #0f172a; stroke: #334155; stroke-width: 1; rx: 4; }
    </style>
  </defs>

  <rect x="20" y="12" width="500" height="26" class="ee-badge" />
  <text x="32" y="30" class="ee-text-title">⚡ SYNCHRONOUS MACHINE PER-PHASE EQUIVALENT CIRCUIT (GENERATOR)</text>

  <!-- Neutral / Ground Return Bus -->
  <line x1="80" y1="230" x2="780" y2="230" class="ee-bus" />

  <!-- Internal Generated EMF Source Ef∠δ -->
  <circle cx="100" cy="155" r="26" class="ee-line" fill="#0f172a" stroke="#eab308" stroke-width="2.5" />
  <path d="M 86 155 q 7 -12 14 0 t 14 0" class="ee-line" stroke="#eab308" />
  <text x="100" y="120" class="ee-text-main" fill="#eab308">+ Ef ∠ δ</text>
  <text x="100" y="196" class="ee-text-sub" fill="#eab308">Excitation EMF</text>
  <line x1="100" y1="80" x2="100" y2="129" class="ee-bus" />
  <line x1="100" y1="181" x2="100" y2="230" class="ee-bus" />

  <!-- Armature Current Ia Arrow -->
  <line x1="100" y1="80" x2="180" y2="80" class="ee-bus" />
  <line x1="125" y1="72" x2="165" y2="72" class="ee-line" marker-end="url(#ee-sync-arrow)" />
  <text x="145" y="64" class="ee-text-main">Ia (Armature Current)</text>

  <!-- Armature Resistance Ra (zigzag) -->
  <path d="${SchematicsEngine.zigzagH(180, 80, 50, 11)}" class="ee-line" stroke="#38bdf8" />
  <text x="205" y="58" class="ee-text-main">Ra</text>
  <text x="205" y="106" class="ee-text-sub">Armature Res.</text>

  <line x1="230" y1="80" x2="280" y2="80" class="ee-bus" />

  <!-- Synchronous Reactance Xs = Xl + Xa -->
  <path d="${SchematicsEngine.coilH(280, 80, 4, 8)}" class="ee-line" stroke="#38bdf8" />
  <text x="315" y="58" class="ee-text-main">jXs</text>
  <text x="315" y="106" class="ee-text-sub">Synchronous Reactance</text>

  <!-- Connection to Terminal Voltage Vt -->
  <line x1="344" y1="80" x2="500" y2="80" class="ee-bus" />
  <line x1="500" y1="80" x2="500" y2="110" class="ee-bus" />

  <!-- Output Terminals for Vt -->
  <circle cx="500" cy="110" r="4" fill="#0f172a" stroke="#38bdf8" stroke-width="2" />
  <circle cx="500" cy="200" r="4" fill="#0f172a" stroke="#38bdf8" stroke-width="2" />
  <line x1="500" y1="200" x2="500" y2="230" class="ee-bus" />

  <text x="535" y="152" class="ee-text-main">+ Vt ∠ 0°</text>
  <text x="535" y="168" class="ee-text-sub">Terminal Voltage</text>

  <!-- Phasor relation note -->
  <rect x="540" y="12" width="320" height="26" class="ee-badge" />
  <text x="700" y="29" class="ee-text-val">Generator: Ef = Vt + Ia·(Ra + jXs) | Motor: Vt = Ef + Ia·Zs</text>
</svg>`;
    }

    /**
     * Get vector SVG for a recognized circuit type
     */
    static getCircuitSVG(type) {
        switch (type) {
            case 'transformer':
                return this.getTransformerCircuitSVG();
            case 'induction-motor':
                return this.getInductionMotorCircuitSVG();
            case 'dc-shunt-motor':
                return this.getDCShuntMotorCircuitSVG();
            case 'dc-series-motor':
                return this.getDCSeriesMotorCircuitSVG();
            case 'synchronous-machine':
                return this.getSynchronousMachineCircuitSVG();
            default:
                return null;
        }
    }
}
