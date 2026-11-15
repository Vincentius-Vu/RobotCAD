# WHEEL-LEGGED MOBILE ROBOT (WLMR) RESEARCH PACKAGE

This package contains the complete technical foundation, CAD models, mathematical specifications, and implementation roadmap for formulating the **Full Floating-Base Multi-Body Dynamics and Whole-Body Control (WBC / VMC)** of the student's Wheel-Legged Bipedal Robot.

---

## 📁 DIRECTORY STRUCTURE

```
WLMR/
├── WLMR_SYSTEM_PROMPT.md                # System prompt for initializing the new dedicated session
├── IMPLEMENTATION_PLAN.md               # 5-Phase implementation roadmap
├── README.md                            # Package overview and quick start guide
├── docs/
│   └── MATHEMATICAL_MODEL_SPECIFICATION.md  # Full Euler-Lagrange, 5-bar kinematics & LPV-LQR math
├── models/
│   ├── Assembly_All.glb                 # Optimized 5.10MB clean CAD model (87 nodes, 19 meshes)
│   ├── Assembly_All_FullOriginal.glb    # Original raw Onshape export (39.6MB)
│   ├── Body_design_V2.step              # STEP CAD geometry of chassis and leg links
│   └── Wheel.step                       # STEP CAD geometry of driven wheel
├── scripts/
│   └── verify_cad_topology.py           # Python baseline topology verification
├── src/                                 # Dedicated directory for upcoming dynamic engine cores
└── data/                                # Simulation logs and benchmark outputs
```

---

## 🚀 HOW TO START THE NEW SESSION

1. **Create a New Session**: Open a fresh chat / session in the Antigravity IDE.
2. **Load the System Prompt**: Copy and paste the contents of `WLMR_SYSTEM_PROMPT.md` (or instruct the agent to read `robotics-visualizer/output/WLMR/WLMR_SYSTEM_PROMPT.md`).
3. **Reference Specification**: Refer the new agent to `docs/MATHEMATICAL_MODEL_SPECIFICATION.md` to begin **Phase 1** (SymPy symbolic derivation of the 5-bar linkage kinematics and floating-base equations of motion).

---

## 📊 MECHANICAL SPECIFICATION SUMMARY

- **Floating Base**: 6 DoF rigid chassis with mass $m_b = 1.42\,\text{kg}$.
- **Leg Topology**: Dual independent planar 5-bar closed-loop linkages ($l_1 = l_2 = 80\,\text{mm}$, $l_3 = l_4 = 120\,\text{mm}$).
- **Actuators**: 2x Nema17 Hip Steppers + 2x Nidec BLDC Knee Actuators + 2x Wheel Hub Motors.
- **Wheels**: $r_w = 0.035\,\text{m}$ ($35\,\text{mm}$ radius, $70\,\text{mm}$ diameter), track width $W = 0.270\,\text{m}$.
- **Virtual Leg Range**: $L_{leg} \in [0.095\,\text{m}, 0.190\,\text{m}]$ ($95\,\text{mm}$ squat to $190\,\text{mm}$ standing).
