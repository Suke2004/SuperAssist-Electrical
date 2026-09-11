export const devData = {
    name: 'Rahul Sharma',
    company: 'Schneider Electric',
    role: 'Electrical Systems Engineer',
    focus: 'power-systems',
    resume: `RAHUL SHARMA
Electrical Engineer — Power Systems, Electrical Machines & Industrial Drives
Contact: rahul.sharma.ee@email.com | LinkedIn: linkedin.com/in/rahul-ee

PROFESSIONAL SUMMARY
Electrical Engineer with extensive hands-on knowledge of three-phase power systems, induction & synchronous machines, power electronics (inverters/rectifiers/VFDs), protection switchgear, and substation engineering. Skilled in load flow calculations, fault analysis, transformer sizing, cable derating (IS/IEC standards), and PLC automation.

CORE TECHNICAL SKILLS
- Electrical Machines: Transformers (testing, parallel operation, vector groups), Induction Motors (star-delta starting, VFD control, slip-ring), Synchronous Machines (V-curves, excitation, stability), DC Motors.
- Power Systems: Fault calculations (symmetrical & unsymmetrical), load flow, protection schemes (differential, distance, overcurrent/earth fault), substation layout, earthing (IS 3043).
- Power Electronics: Three-phase full-bridge inverters, SPWM modulation, buck/boost converters, harmonics analysis (IEEE-519), thyristor firing circuits.
- Standards & Sizing: IS 732, IS 3043, IEC 60287 (cable sizing), IEC 61000-4-30 (power quality), IEC 61131-3 (ladder logic).
- Tools & Software: MATLAB/Simulink, ETAP, Python (NumPy/SciPy), AutoCAD Electrical.

PROJECT EXPERIENCE
1. Grid-Connected Solar Inverter & Power Quality Analysis
- Designed a 10 kW three-phase grid-tied inverter model with LCL filter in MATLAB/Simulink.
- Maintained voltage THD below 3% conforming to IEEE-519 standards at PCC.
- Implemented PLL-based grid synchronization and anti-islanding protection.

2. Industrial Substation Protection & Cable Sizing Scheme
- Conducted short-circuit MVA calculations for a 33 kV/415 V plant distribution substation.
- Selected and sized MCCBs, air circuit breakers (ACB), CT/PT ratios, and numerical overcurrent relays.
- Calculated cable ampacity with thermal derating factors and voltage drop (< 3%) under IEC 60287.

EDUCATION
B.Tech in Electrical & Electronics Engineering
2020 – 2024`,
    objectives: `About the job
Job Title: Electrical Systems Engineer
Company: Schneider Electric / Core Engineering
Location: Bangalore / Hybrid

Key Responsibilities:
- Perform calculations for power distribution, transformer sizing, motor starting studies, and short circuit analysis.
- Review Single Line Diagrams (SLD), schematic drawings, relay coordination curves, and protection architectures.
- Collaborate on power quality assessments, harmonic mitigation (active/passive filters), and power factor correction.
- Troubleshoot plant equipment: motor trips, insulation degradation, breaker nuisance tripping, and transformer heating.
- Ensure compliance with IEC, IEEE, and national electrical codes (IS).`
};

import { devLog } from './config.js';

export function autofillForTesting() {
    devLog("Autofilling form for testing...");

    // Get form elements directly from DOM
    const onboardingForm = {
        name: document.getElementById('user-name'),
        company: document.getElementById('user-company'),
        role: document.getElementById('user-role'),
        focusCheckboxes: document.querySelectorAll('input[name="focus"]'),
        resume: document.getElementById('user-resume'),
        objectives: document.getElementById('user-objectives'),
    };

    // Check if elements exist before setting values
    if (onboardingForm.name) onboardingForm.name.value = devData.name;
    if (onboardingForm.company) onboardingForm.company.value = devData.company;
    if (onboardingForm.role) onboardingForm.role.value = devData.role;

    if (onboardingForm.focusCheckboxes) {
        onboardingForm.focusCheckboxes.forEach(cb => {
            if (cb.value === devData.focus || cb.value === 'electrical-machines' || cb.value === 'power-electronics') {
                cb.checked = true;
            }
        });
    }

    if (onboardingForm.resume) onboardingForm.resume.value = devData.resume;
    if (onboardingForm.objectives) onboardingForm.objectives.value = devData.objectives;

    devLog("✅ Form autofilled successfully with EE Profile!");
}