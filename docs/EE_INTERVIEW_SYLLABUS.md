# Electrical Engineering Interview Syllabus — B.Tech Final Year

The EE analogue of "DSA + OS + DBMS + System Design" for software interviews.
Interviewers sample from these 28 domains in rough order of frequency for a
fresher core-EE role. Every domain lists what is tested and the
highest-frequency questions. Cross-questions, traps and project-defense probes
live in `CROSS_QUESTIONS_AND_TRAPS.md`; this file is the map.

---

## 1. Basic Electrical Engineering (warm-up round)

**Tests:** fluency with fundamental quantities and AC theory.

- RMS, average, form factor, peak factor of a sine wave (and why meters read RMS)
- Why is power factor penalized? What is kVAh vs kWh billing?
- Star-delta voltage/current relations (V_L = √3 V_ph, I_L = I_ph in star)
- Power triangle P, Q, S; derive pf from kVA and kW
- Ideal vs practical sources; source transformation
- Why does an AC circuit have "impedance" and not just resistance?
- Superposition theorem — and where it fails (power is not linear)

## 2. Circuit Analysis / Network Theory

- KCL/KVL, mesh and nodal analysis with dependent sources
- Thevenin/Norton equivalents; maximum power transfer (and the 50 % efficiency catch)
- RC/RL/RLC transients: time constants, initial/final value theorems
- Resonance: series vs parallel, Q factor, bandwidth
- Two-port networks (z/y/h-parameters), reciprocity
- Coupled circuits, dot convention basics

## 3. Electromagnetic Fields (fewer questions, high discrimination)

- Coulomb's law, Gauss's law applications, electric field of configurations
- Ampère's law, Biot–Savart; field of a solenoid/coax
- Faraday's law, Lenz's law; motional vs transformer EMF
- Maxwell's equations — state and interpret each
- Skin effect and proximity effect — why AC resistance > DC resistance
- Energy stored in E and B fields; Poynting vector meaning

## 4. DC Machines

- EMF equation E = ΦZNP/60A; torque equation T ∝ ΦI_a
- Characteristics (shunt/series/compound): speed-load, torque-load
- Starting: why starters, 3-point vs 4-point
- Speed control: field, armature, Ward-Leonard; chopper control
- Losses and efficiency; Swinburne's test, Hopkinson's test
- Commutation and armature reaction; interpoles

## 5. Transformers

- EMF equation E = 4.44 f Φ T; voltage ratio
- Equivalent circuit and approximate circuit; voltage regulation (up/down)
- Losses: iron (hysteresis + eddy), copper; condition for max efficiency (P_cu = P_i)
- OC/SC tests → parameters; why SC test on HV side
- All-day efficiency (distribution transformers)
- Three-phase connections and vector groups (Dyn11 meaning); parallel operation conditions
- Auto-transformer; tap changers (OLTC); Buchholz relay, breather, conservator
- Inrush current — why 6–8× FLA at switch-on at zero crossing

## 6. Induction Machines (the most-asked machine)

- Construction: squirrel cage vs slip-ring; why cage is rugged
- Slip s = (Nₛ − N)/Nₛ; rotor frequency = s·f; torque-slip curve regions
- Torque equation, max torque and slip at max torque
- Power flow: air-gap power P_ag; P_mech = (1−s)·P_ag; rotor Cu loss = s·P_ag
- Starting methods: DOL (6–8× FLA), star-delta, autotransformer, rotor resistance, soft starter, VFD
- Why star-delta reduces starting current to 1/3 (and torque to 1/3)
- No-load & blocked-rotor tests → circle diagram parameters
- Speed control: V/f (constant flux), pole changing, cascade, slip-power recovery (Kramer/Scherbius)
- Cogging, crawling, cogging prevention (skewing)
- Single-phase IM: double-field revolving theory; capacitor-start vs shaded-pole

## 7. Synchronous Machines

- EMF equation and winding factors (distribution, pitch)
- Armature reaction at unity/lag/lead pf; synchronous impedance
- Voltage regulation: EMF (synchronous impedance), MMF, ZPF (Potier) methods
- Alternator on infinite bus: conditions for synchronization (dark lamp / synchroscope)
- Infinite-bus power angle equation P = (EV/Xₛ)·sin δ; load angle physics
- Two-reaction theory (salient pole: d-q axes); slip test
- Synchronous motor: V-curves, inverted V; hunting and dampers
- Synchronous condenser for pf correction
- Why alternators are star-connected (neutral, √3, third-harmonic suppression)

## 8. Power Electronics — Devices

- Diode, SCR (two-transistor model, latching/holding current, dv/dt, snubber)
- Turn-on/off methods of SCR; commutation classes
- TRIAC, DIAC; GTO, MOSFET, IGBT — structure, comparison, applications
- Power MOSFET vs IGBT: where each wins (frequency vs voltage)
- Gate drive requirements; isolated drivers; dead-time

## 9. Power Electronics — Converters

- Single-phase/three-phase controlled rectifiers; output equations, ripple
- Firing angle effect on V_avg and displacement pf (and why rectifiers worsen pf)
- Choppers (A/B/C/D/E classes); buck/boost/buck-boost duty-cycle relations
- Inverters: square wave, PWM, sinusoidal PWM; harmonics of PWM
- Cycloconverters; matrix converters
- AC voltage controllers
- SMPS topologies: flyback vs forward; why flyback for < 150 W

## 10. Control Systems

- Open vs closed loop; modeling: transfer functions, block algebra, signal flow (Mason)
- Time response: first/second order, ζ, ωₙ, settling time, overshoot relations
- Routh-Hurwitz stability
- Root locus rules; gain effect on damping
- Frequency response: Bode plots, gain/phase margins; Nyquist criterion
- PID: effects of each term (P: speed+error, I: kills steady-state error, D: damping/noise amp)
- State-space basics; controllability/observability (definitions-level)
- Compensators: lead/lag — what each does to margins

## 11. Power Systems — Generation

- Thermal/hydro/nuclear layouts; efficiency chains (heat rate)
- Load curve, load factor, diversity factor, plant capacity factor — numericals
- Tariff (two-part: fixed + energy); why peak plants are gas turbines
- Interconnected grid advantages; load dispatch
- Renewable integration: variability, curtailment, must-run

## 12. Power Systems — Transmission & Distribution

- Per-unit system — why it simplifies; base conversions
- Transmission line parameters: R, L, C; skin effect; bundled conductors; transposition
- Short/medium/long line models; ABCD constants; Ferranti effect (why charging current)
- Voltage regulation and efficiency of lines; corona (factors, disadvantages, reduction)
- Insulators: pin, suspension, string efficiency
- Cable vs overhead; grading of cables
- HVDC vs EHV AC — where HVDC wins (long distance, asynchronous interconnection)
- Distribution: radial vs ring main; feeder, distributor, service mains vocabulary

## 13. Power Systems — Faults & Protection

- Symmetrical components (Fortescue) — the tool behind unbalance metrics
- Fault types and severity ordering (LLG vs LLL vs LG at generator terminals)
- Fault analysis with Thevenin + symmetrical components
- Switchgear: arc phenomenon, ARC interruption, SF6/vacuum/oil CBs, ratings (breaking/making)
- Relays: electromagnetic, induction, static, numerical; IDMT characteristic
- Protection zones; primary/backup coordination; CT/PT requirements
- Transformer protection: Buchholz, differential (and why harmonic restraint), overcurrent
- Alternator protection: differential, negative-phase-sequence, field failure
- Feeder protection: distance relays (zones), overcurrent grading
- Lightning: lightning arresters, ground wires, tower footing resistance

## 14. Power Systems — Stability & Economics

- Swing equation; power-angle curve; equal-area criterion (concept + numerical)
- Transient vs steady-state stability; factors improving stability
- Economic dispatch; unit commitment (conceptual)
- Load frequency control (primary/secondary); AGC
- Voltage control: excitation, taps, shunt capacitors/reactors, SVC/STATCOM

## 15. Utilization & Traction

- Illumination: laws (inverse square, Lambert), MHCP, lighting calculations
- Heating/welding: resistance welding types, induction heating principle
- Electric traction: speed-time curves, trapezoidal, specific energy consumption
- Traction motors (why DC series historically; now VFD+IM); regenerative braking
- Electrolysis/electroplating basics

## 16. Measurement & Instrumentation

- PMMC, MI, electrodynamometer — which for AC/DC and why
- Moving iron: square-law scale; expansion due to harmonics
- Wattmeter: two-wattmeter method for 3φ power (and pf from readings, tan φ formula)
- Energy meter: induction type, creeping, adjustments
- CT/PT: why CT secondary never open; metering vs protection class (0.5 vs 5P10)
- Bridges: Wheatstone, Kelvin (low R), Maxwell (L), Schering (C, dielectric loss), Wien (f)
- Oscilloscope, function generator basics; DMM architecture
- Error analysis: gross/systematic/random; accuracy class; loading effect
- Digital instruments: DVM, DPM; sample-and-hold; ADC types (SAR vs flash vs dual-slope)

## 17. Digital Electronics (light for EE)

- Number systems, Boolean algebra, K-map minimization
- Combinational: adders, MUX/DEMUX, encoder/decoder
- Sequential: flip-flops (SR/JK/D/T), race-around, master-slave
- Counters and shift registers; ripple vs synchronous
- ADC/DAC resolution and quantization error

## 18. Microcontrollers & Embedded (frequent for automation roles)

- 8051/AVR/ARM architecture; von Neumann vs Harvard
- GPIO, timers, interrupts (edge vs level, ISR discipline), PWM
- ADC sampling: Nyquist, aliasing — why anti-alias filter
- UART/I2C/SPI comparison (wires, speed, masters, use case)
- Watchdog, brownout; RTOS basics (priority inversion one-liner)

## 19. Industrial Automation — PLC/SCADA/DCS

- PLC scan cycle: input scan → program scan → output scan; scan time meaning
- Ladder logic: NO/NC contacts, seal-in (latch), timers TON/TOF/CTU
- Star-delta ladder — the classic; interlocking necessity
- PLC vs relay logic vs DCS vs SCADA (where each wins)
- SCADA architecture: field → RTU/PLC → MTU → HMI; alarm management (ISA-18.2 basics)
- Tag database concept; polling vs report-by-exception
- IEC 61131-3 languages: LD, FBD, ST, IL, SFC

## 20. Communication Protocols & Buses

- UART framing (start/data/stop, baud), RS-232 vs RS-485 (differential, multidrop, 1200 m)
- Modbus RTU/TCP: master-slave, function codes (0x03/0x04/0x06/0x10), CRC-16, exception frames
- I2C (addressing, ACK, multi-master), SPI (CPOL/CPHA, full duplex)
- CAN: differential, arbitration (dominant/recessive), use in vehicles
- Ethernet/IP, Profinet, DeviceNet; fieldbus vs IoT protocols (MQTT: pub-sub, QoS)
- IEC 61850 and smart-grid communication (GOOSE/GSV — awareness level)
- 4–20 mA current loops: why current (distance, noise immunity), live-zero

## 21. Signals & Systems (supports instrumentation + DSP)

- LTI systems, linearity/time-invariance checks
- Impulse response and convolution; causality, stability (BIBO)
- Fourier series vs transform; DFT/FFT meaning (spectral analysis)
- Sampling theorem, aliasing — why fs > 2f_max
- Energy vs power signals; autocorrelation basics

## 22. Electrical Machines — Special

- Stepper motors (variable reluctance/PM, step angle formula), servo motors
- BLDC vs PMSM (trapezoidal vs sinusoidal EMF), hall sensors vs FOC
- Universal motor; hysteresis motor; SRM basics
- Generator types summary table (shunt/series/compound characteristics)

## 23. Electrical Materials & Estimation

- Conductor/insulator/semiconductor/magnetic materials; Class A/B/F/H insulation
- Derating factors for cables (temperature, grouping); voltage-drop limits
- Copper vs aluminium conductors (weight, cost, conductivity trade)
- Estimation: load schedule → diversity → cable sizing → breaker selection → earthing sizing

## 24. Earthing, Safety & Wiring (IS 732 / IS 3043)

- Plate vs pipe earthing; earth resistance limits; earthing grid
- ELCB vs RCCB vs RCBO; MCB vs MCCB vs fuse (breaking capacity)
- Why 30 mA for shock protection; Class I vs II equipment
- TN-S/TN-C-S/TT system vocabulary; neutral vs earth
- Shock physics: let-go current, fibrillation threshold, body resistance

## 25. Batteries, Storage & EV

- Lead-acid vs Li-ion (energy density, DoD, cycles, BMS need)
- SOC/SOH estimation basics; C-rating meaning
- Cell balancing (passive/active); thermal runaway
- EV powertrain: motor choice, regen braking, charging levels, onboard vs offboard charger
- Solar + battery sizing numericals (autonomy days, DoD derating)

## 26. Renewable Energy & Power Quality

- Solar PV: V-I curve, MPP, MPPT algorithms (P&O vs IncCond), fill factor, efficiency
- Grid-tied inverter requirements (anti-islanding, THD limits, PF near unity)
- Wind: Betz limit (59.3 %), power ∝ v³, type 1–4 turbines
- Power quality vocabulary: harmonics, flicker, interharmonics, notching
- IEEE-519 harmonic limits; why 5th/7th dominate rectifier loads
- Mitigation: passive/active filters, multi-pulse, PWM rectifiers, K-rated transformers

## 27. Recent Trends (one-liner readiness)

- Smart grid concepts (AMI, demand response, self-healing)
- IoT in energy monitoring (this project!), edge vs cloud
- Digital twins for grid assets; condition monitoring (IR thermography, MCSA, partial discharge)
- V2G, microgrids, energy storage systems (ESS) roles
- AI/ML applications in load forecasting and fault detection

## 28. Software Tools (honesty round)

- MATLAB/Simulink (machine/converter models), PSCAD/EMTDC, ETAP (load flow, protection coordination), PSpice/LTspice
- Python for data analysis (this project uses NumPy DSP)
- PLC software: Allen-Bradley RSLogix/Studio 5000, Siemens TIA Portal (awareness)
- SCADA/HMI platforms (awareness); Excel for load schedules (yes, really)

---

## How interviewers actually sequence this

1. **Warm-up (5 min):** Domain 1–2 basics, one RMS/pf numerical.
2. **Core depth (15–25 min):** 1–2 domains probed deep — machines, power systems, or power electronics depending on the role.
3. **Project defense (10–15 min):** your final-year project (see `PROJECT_DEFENSE_AND_RESUME.md`).
4. **Situations (5–10 min):** troubleshooting scenarios (`SITUATION_SCENARIO_BANK.md`).
5. **Design question (5–10 min):** sizing/selection (`DESIGN_QUESTIONS_BANK.md`).
6. **HR/close:** why core EE, relocation, salary.

Practice cadence: one domain per day from this list; cross-questions from the traps file; one numerical set + one drawing per day.
