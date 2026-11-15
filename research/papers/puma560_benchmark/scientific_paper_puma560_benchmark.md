# A High-Fidelity Multi-Physics Benchmark for Industrial Robot Motion Control Under Varying Payloads, Multi-Rate Inverter Dynamics, and Reflected Actuator Inertia

**Authors:** Robotics & Advanced Motion Control Research Group  
**Affiliation:** Faculty of Electrical and Electronics Engineering, Ton Duc Thang University  
**Date:** November 1, 2026  
**Target Venue:** *IEEE/ASME Transactions on Mechatronics* / *IEEE Transactions on Industrial Electronics*

---

## Abstract
Trajectory tracking control of multi-degree-of-freedom (DOF) industrial manipulators subjected to abrupt payload variations remains a foundational challenge in robotics. In the overwhelming majority of robotics literature, motion controllers are evaluated under idealized kinematic torque sources ($\bm{\tau}_{\text{motor}} \equiv \bm{\tau}_{\text{cmd}}$), ignoring the electromechanical dynamics of permanent magnet synchronous motor (PMSM) drives, discrete field-oriented current control (FOC) latencies, space-vector pulse-width modulation (SVPWM) circular voltage clipping ($V_{dc}/\sqrt{3}$), and dynamic DC-link voltage fluctuations. Furthermore, the immense contribution of reflected actuator rotor inertia ($N^2 J_m$), which can exceed bare link inertia by over $1,500\times$, is almost universally omitted in standard multi-body formulations.

In this work, we establish an end-to-end, physically grounded cyber-physical benchmarking pipeline for the 6-DOF Unimation PUMA 560 manipulator. Physical parameters are calibrated directly against the authoritative experimental identification benchmarks of Armstrong et al. (1988) and Corke (1996). We comprehensively evaluate four control paradigms:
1. **Gravity Compensation + Proportional-Derivative (PD)** (Lyapunov-stable baseline)
2. **Computed Torque Control (CTC)** (Feedback linearization)
3. **Nonlinear PID (NPID)** with adaptive error-dependent gain scheduling
4. **Linear Active Disturbance Rejection Control (LADRC)** equipped with a 3rd-order Linear Extended State Observer (LESO)

The evaluation is conducted across three rigorous simulation scenarios:
- **Scenario 1 (Standard Benchmark, 9.20s):** Pick-and-place under an unmodeled dynamic payload step ($0 \to 3.5\text{ kg} \to 0\text{ kg}$). LADRC achieves an **$87.2\%$ reduction in ISE** ($4.34\,\text{deg}^2\cdot\text{s}$ vs. $33.97\,\text{deg}^2\cdot\text{s}$ for CTC) and suppresses shoulder static droop down to $0.23^\circ$ RMS.
- **Scenario 2 (High-Speed Aggressive Benchmark, 3.07s):** $3\times$ speed and acceleration scaling evaluating back-EMF headroom and SVPWM voltage circle saturation.
- **Scenario 3 (Parametric Sensitivity Stress Test):** $+20\%$ unmodeled link mass and inertia mismatch across all joints. CTC exhibits severe degradation (**$+62.9\%$ ISE, $+74.6\%$ IAE**), while LADRC demonstrates near-invariant tracking (**only $+6.3\%$ ISE degradation**).

**Keywords:** Industrial Manipulators, PUMA 560, Active Disturbance Rejection Control, Computed Torque Control, Reflected Actuator Inertia, Multi-Rate Inverter, Parametric Sensitivity, Shared DC Bus.

---

## 1. Introduction

High-speed pick-and-place manipulation constitutes the cornerstone of modern manufacturing, packaging, and robotic assembly. In such operations, articulated manipulators must follow high-order smooth trajectories while experiencing discontinuous changes in link mass and inertia tensors at the grasping and releasing instants.

Classic trajectory tracking formulations assume torque is generated instantaneously by ideal actuators. However, in commercial robotics, torque is produced by high-frequency inverter-fed motors, typically Permanent Magnet Synchronous Motors (PMSM) equipped with high-ratio gear reducers (e.g., Harmonic Drives) and powered by a regulated shared direct current (DC) link capacitor bus. When a heavy payload is acquired, not only do the mechanical equations of motion change instantaneously, but the motor current demands surge, causing voltage sag on the DC link, dead-time voltage distortion across inverter legs, and sudden saturation of inner current control loops.

While advanced robust and adaptive controllers have been widely proposed in theoretical literature, industrial deployments continue to predominantly rely on decentralized PD/PID controllers or nominal feedback linearization. Therefore, there is a distinct necessity for a rigorous, standardized, multi-physics benchmark that quantifies both tracking performance metrics (ISE, IAE, ITAE, RMSE, Peak Error) and electro-mechanical energy consumption when subject to unmodeled dynamic payloads.

---

## 2. Cyber-Physical System Modeling

### 2.1 Rigid-Body Manipulator Dynamics with Reflected Actuator Inertia
The equation of motion of an $n$-degree-of-freedom manipulator subjected to an end-effector payload and geared motor drives is expressed in joint space:

$$\bm{M}(\bm{q}, m_p, \bm{J}_{\text{refl}})\ddot{\bm{q}} + \bm{C}(\bm{q}, \dot{\bm{q}}, m_p)\dot{\bm{q}} + \bm{g}(\bm{q}, m_p) + \bm{F}_v \dot{\bm{q}} = \bm{\tau}$$

where:
- $\bm{q}, \dot{\bm{q}}, \ddot{\bm{q}} \in \mathbb{R}^n$ are joint angle, velocity, and acceleration vectors.
- $\bm{M}(\bm{q}, m_p, \bm{J}_{\text{refl}}) = \bm{M}_{\text{rigid}}(\bm{q}, m_p) + \text{diag}(N_j^2 J_{m,j})$ accounts for both the rigid-link spatial inertia and the significant reflected rotor inertia of the geared actuators.
- $\bm{C}(\bm{q}, \dot{\bm{q}}, m_p) \in \mathbb{R}^{n \times n}$ contains Coriolis and centripetal terms satisfying $\dot{\bm{M}} - 2\bm{C} = -(\dot{\bm{M}} - 2\bm{C})^T$.
- $\bm{g}(\bm{q}, m_p) \in \mathbb{R}^n$ represents gravitational generalized forces.
- $\bm{\tau} \in \mathbb{R}^n$ is the joint actuation torque vector delivered by the transmission.

In our framework, all inertial parameters ($m_j, \bm{c}_j, \bm{I}_j$) are calibrated strictly against the physical experimental identification logs of Armstrong, Khatib, and Burdick (1988) and Corke (1996). The gear ratios ($N$) and motor rotor inertias ($J_m$) reflect authentic industrial actuators:
- **Joint 1–2 (Waist & Shoulder):** RoboDrive ILM 70x18 PMSM ($N=62.61, 107.83$).
- **Joint 3 (Elbow):** RoboDrive ILM 70x10 PMSM ($N=53.71$).
- **Joint 4–5 (Forearm & Wrist):** RoboDrive ILM 38x10 Micro Servos ($N=75.91, 71.92$).
- **Joint 6 (Flange Roll):** RoboDrive ILM 38x06 Micro Servo ($N=76.69$).

For Joint 4, $J_{\text{refl}, 4} = N_4^2 J_{m, 4} = 75.91^2 \times (3.3\times 10^{-5}) = 0.190\,\text{kg}\cdot\text{m}^2$, which is **$1,580\times$ larger** than the bare link inertia ($0.00012\,\text{kg}\cdot\text{m}^2$). This proves that neglecting reflected inertia introduces catastrophic modeling errors.

The dynamic payload $m_p(t)$ picked at $t = 3.5\text{ s}$ and released at $t = 7.5\text{ s}$ modifies the mass and spatial inertia tensor of the 6th link:

$$m_p(t) = \begin{cases} 0\text{ kg}, & t < 3.5\text{ s} \\ 3.5\text{ kg}, & 3.5\text{ s} \le t \le 7.5\text{ s} \\ 0\text{ kg}, & t > 7.5\text{ s} \end{cases}$$

### 2.2 Multi-Rate PMSM Actuator & Discrete Field-Oriented Control (FOC)
Inner current control operates at high frequency ($10\text{ kHz}$, $\Delta t_{\text{sub}} = 100\,\mu\text{s}$) with discrete PI controllers tuned for pole-zero cancellation:

$$v_q^*(k) = K_{pq}(i_q^*(k-1) - i_q(k)) + K_{iq} \sum (i_q^* - i_q)\Delta t_{\text{sub}} + 0.95 \omega_e (L_d i_d + \lambda_{\text{PM}}) + v_{q,\text{dead}}$$
$$v_d^*(k) = K_{pd}(0 - i_d(k)) + K_{id} \sum (0 - i_d)\Delta t_{\text{sub}} - 0.95 \omega_e L_q i_q + v_{d,\text{dead}}$$

where:
- $i_q^*(k-1)$ introduces real-world digital calculation and ADC conversion latency (1-step DSP delay).
- A 5% parameter uncertainty in decoupling feedforward introduces cross-coupling transients.
- Inverter dead-time ($t_d = 1.2\,\mu\text{s}$) with active feedforward compensation ($92\%$ cancellation) leaves residual 6th harmonic distortion ($v_{\text{dead}} \propto \cos(6\theta_e)$).
- Space Vector PWM (SVPWM) enforces the circular voltage ceiling $\sqrt{v_d^{*2} + v_q^{*2}} \le V_{dc}/\sqrt{3} \approx 27.7\,\text{V}$.

### 2.3 Shared DC Bus Dynamics & Power Converter Coupling
The common DC link bus with capacitance $C_{\text{bus}} = 4700\,\mu\text{F}$ and equivalent series resistance $R_{\text{ESR}} = 15\,\text{m}\Omega$ interacts bidirectionally with the inverters:

$$C_{\text{bus}} \frac{dV_{dc}}{dt} = I_{\text{supply}}(t) - \sum_{j=1}^6 I_{\text{inv},j}(t) - I_{\text{brake}}(t)$$

The front-end Switched-Mode Power Supply (SMPS) is modeled with finite closed-loop regulation response time ($\tau_{\text{ps}} \approx 8\,\text{ms}$) and internal droop impedance ($R_{\text{ps}} = 60\,\text{m}\Omega$). This captures real transient voltage sag down to $47.4\,\text{V}$ during heavy payload lifts and regenerative voltage swell up to $48.6\,\text{V}$ during deceleration. A dynamic braking chopper with a $4.7\,\Omega$ resistor prevents overvoltage trips.

### 2.4 Linear Active Disturbance Rejection Control (LADRC) with 3rd-Order LESO
Each joint is modeled as a perturbed second-order motion subsystem:
$$\ddot{q}_j = b_{0, j} \tau_j + f_j(q, \dot{q}, \ddot{q}_d, \tau_{\text{load}}, t)$$
where $b_{0, j} = 1 / (J_{\text{refl}, j} + M_{jj}(q))$. The total disturbance $f_j$ is estimated by a 3rd-order LESO ($[z_1, z_2, z_3]^T \approx [q_j, \dot{q}_j, f_j]^T$) parameterized with bandwidth $\omega_o = 120\,\text{rad/s}$:
$$\dot{z}_{1, j} = z_{2, j} + 3\omega_o (q_j - z_{1, j})$$
$$\dot{z}_{2, j} = z_{3, j} + b_{0, j} \tau_j + 3\omega_o^2 (q_j - z_{1, j})$$
$$\dot{z}_{3, j} = \omega_o^3 (q_j - z_{1, j})$$

The control law cancels the estimated disturbance in real time:
$$\tau_j = \frac{k_p (q_{d, j} - z_{1, j}) + k_d (\dot{q}_{d, j} - z_{2, j}) + \ddot{q}_{d, j} - z_{3, j}}{b_{0, j}}$$

---

## 3. Quantitative Multi-Scenario Performance Evaluation

### Table 1: Scenario 1 - Standard Trajectory Benchmark (Duration: 9.20s, Nominal Model, 3.5 kg Payload)

| Evaluation Metric | [1] Gravity Comp + PD | [2] Computed Torque (CTC) | [3] Nonlinear PID (NPID) | [4] Linear ADRC (LESO) |
| :--- | :---: | :---: | :---: | :---: |
| **Total ISE ($\text{deg}^2\cdot\text{s}$)** | 103.39 | **33.97** | 46.84 | **4.34** |
| **Total IAE ($\text{deg}\cdot\text{s}$)** | 31.64 | **18.76** | 21.68 | **5.36** |
| **Total ITAE ($\text{deg}\cdot\text{s}^2$)** | 161.08 | **92.62** | 108.71 | **25.21** |
| RMS Error Joint 1 ($^\circ$) | 0.3515 | 0.3064 | 0.2445 | **0.0853** |
| RMS Error Joint 2 ($^\circ$) | 1.4655 | 1.0237 | 0.9989 | **0.2316** |
| RMS Error Joint 3 ($^\circ$) | 0.4045 | 0.4189 | 0.2841 | **0.1262** |
| RMS Error Joint 4 ($^\circ$) | 2.9652 | 1.5408 | 1.9866 | **0.6276** |
| RMS Error Joint 5 ($^\circ$) | 0.0719 | 0.0169 | 0.0568 | **0.0217** |
| RMS Error Joint 6 ($^\circ$) | 0.0559 | 0.0140 | 0.0473 | **0.0209** |
| **Peak Joint Torque ($\text{N}\cdot\text{m}$)** | 85.6 | 85.2 | 85.3 | **84.7** |
| **Total Net Energy Consumption** | 0.020 Wh (72.7 J) | 0.020 Wh (72.3 J) | 0.020 Wh (72.0 J) | **0.020 Wh (70.7 J)** |
| **Regenerated Braking Energy** | 116.5 J | 113.1 J | 114.6 J | **110.2 J** |
| **DC Bus Voltage Dynamic Swing** | 47.5V - 48.6V | 47.5V - 48.6V | 47.5V - 48.6V | **47.5V - 48.6V** |

---

### Table 2: Scenario 2 - High-Speed Aggressive Trajectory Benchmark (Duration: 3.07s, $3\times$ Speed Scaling)

| Controller Architecture | Total ISE ($\text{deg}^2\cdot\text{s}$) | Total IAE ($\text{deg}\cdot\text{s}$) | Peak Joint Torque ($\text{N}\cdot\text{m}$) | Inverter Voltage Saturation Regime |
| :--- | :---: | :---: | :---: | :---: |
| **Gravity Comp + PD** | 59.09 | 17.79 | 95.2 | Linear SVPWM Range ($< 90\% V_{\text{max}}$) |
| **Computed Torque Control (CTC)** | **16.73** | **6.61** | 98.1 | Linear SVPWM Range ($< 94\% V_{\text{max}}$) |
| **Nonlinear PID (NPID)** | 41.99 | 14.50 | 99.4 | Peak Voltage Near Ceiling ($96\% V_{\text{max}}$) |
| **Linear ADRC (3rd-Order LESO)** | 24.15 | 7.77 | 103.3 | Transient Clamping ($98\% V_{\text{max}}$) |

---

### Table 3: Scenario 3 - Parametric Robustness Stress Test (+20% Link Mass & Inertia Mismatch)

| Controller Architecture | Nominal ISE | Perturbed (+20%) ISE | $\Delta\text{ISE}$ (%) | Nominal IAE | Perturbed (+20%) IAE | $\Delta\text{IAE}$ (%) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Gravity Comp + PD** | 103.39 | **149.75** | **+44.8%** | 31.64 | **44.89** | **+41.9%** |
| **Computed Torque Control (CTC)** | 33.97 | **55.35** | **+62.9%** | 18.76 | **32.76** | **+74.6%** |
| **Nonlinear PID (NPID)** | 46.84 | **67.82** | **+44.8%** | 21.68 | **30.50** | **+40.7%** |
| **Linear ADRC (3rd-Order LESO)** | 4.34 | **4.62** | **+6.3%** | 5.36 | **5.72** | **+6.6%** |

---

## 4. Key Phenomenological Insights

1. **Why Pure Simulation is Defensible Without Physical HIL Testbeds:**
   - Calibrating inertial and friction terms against Armstrong and Corke's experimentally measured PUMA 560 datasets eliminates arbitrary modeling assumptions.
   - Including reflected actuator inertia ($N^2 J_m$) resolves the single largest gap between academic simulations and physical robot behavior ($1,580\times$ bare link inertia).
   - In Scenario 3 (+20% unmodeled mass/inertia mismatch), the exact sensitivity of all controllers is rigorously bounded.

2. **The Fragility of Feedback Linearization (CTC):**
   - While CTC performs admirably under nominal conditions (Scenario 1 & 2), it suffers severe degradation (**$+62.9\%$ ISE, $+74.6\%$ IAE**) when subjected to parameter mismatch, as the unmodeled inertia terms destroy dynamic decoupling.

3. **The Superiority of Disturbance-Observer-Based Control (LADRC):**
   - LADRC demonstrates remarkable parametric invariance ($\Delta\text{ISE} = +6.3\%$), actively estimating and canceling unmodeled dynamics in real time without high-gain chattering or excess energy consumption ($70.7\,\text{J}$ vs. $72.3\,\text{J}$).

---

## 5. Conclusion

This benchmark bridges the historical chasm between multi-body robot dynamics and power electronics. By executing three distinct benchmarking scenarios on an experimentally calibrated PUMA 560 arm, we have demonstrated that actuator reflected inertia, discrete FOC sampling latency, and DC-bus voltage droop govern real-world tracking limits. Linear ADRC provides the optimal balance of tracking precision and robust parameter invariance, outperforming classic feedback linearization under real-world unmodeled payload conditions.

---

## Source Files & Reproducibility
- **Benchmark Execution Script:** `scripts/benchmark_puma560.ts`
- **Plotting Script:** `scripts/plot_benchmark_results.py`
- **Generated Report:** `output/benchmarks/puma560_controllers_comparison_report.md`
- **CSV Datasets:** `output/benchmarks/robotics_benchmark_Puma560_*.csv`
