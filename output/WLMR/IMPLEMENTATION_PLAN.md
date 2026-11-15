# IMPLEMENTATION PLAN: WHEEL-LEGGED MOBILE ROBOT (WLMR)

This roadmap outlines the systematic execution phases to be conducted in the new dedicated research session.

---

## PHASE 1: KINEMATICS & SYMBOLIC DERIVATIONS (Python / SymPy)
- [ ] **Task 1.1: 5-Bar Linkage Kinematic Engine**:
  * Develop `scripts/kinematics_5bar.py` using SymPy to compute forward/inverse kinematics and closed-form Jacobian $\mathbf{J}_{leg}(\theta_1, \theta_2)$.
  * Plot workspace boundary curves ($L_{min}$ to $L_{max}$) and manipulability ellipses.
- [ ] **Task 1.2: Virtual Leg Coordinate Transformation**:
  * Implement polar virtual leg mapping: $(x_w, z_w) \leftrightarrow (L_{leg}, \theta_{leg})$.
  * Verify joint limits and singularity points ($\det(\mathbf{J}_{leg}) \to 0$).

---

## PHASE 2: FLOATING-BASE MULTI-BODY DYNAMICS (Euler-Lagrange)
- [ ] **Task 2.1: Mass Matrix $\mathbf{M}(\mathbf{q})$ & Coriolis Vector $\mathbf{C}(\mathbf{q}, \dot{\mathbf{q}})\dot{\mathbf{q}}$**:
  * Formulate Lagrangian $\mathcal{L} = T - V$ with floating base (6 DoF) + articulated legs (4 DoF) + wheels (2 DoF).
  * Automatically generate optimized C/Python code using SymPy `ccode` or NumPy lambdify.
- [ ] **Task 2.2: Contact & Constraint Force Resolver**:
  * Formulate wheel-ground rolling without slip non-holonomic constraint: $\dot{\mathbf{p}}_w \cdot \mathbf{t} - r_w \omega_w = 0$.
  * Implement semi-implicit Euler / RK4 numerical integrator with friction cone bounds ($|F_t| \le \mu F_N$).

---

## PHASE 3: WHOLE-BODY CONTROL (WBC) & LPV-LQR SYNTHESIS
- [ ] **Task 3.1: Variable-Length LPV-LQR Balance Controller**:
  * Discretize leg length $L \in [0.095\,\text{m}, 0.190\,\text{m}]$ into 20 grid points.
  * Solve continuous algebraic Riccati equation (CARE) to synthesize $\mathbf{K}_{LQR}(L)$.
  * Test pitch stability under pulse torque disturbances ($1.0\,\text{N}\cdot\text{m}$ impulse).
- [ ] **Task 3.2: Virtual Model Control (VMC) for Leg Height & Body Roll**:
  * Implement virtual spring-damper for body height $z_{b}(t)$ and roll $\phi(t)$.
  * Verify terrain adaptation: Left wheel elevated by $+50\,\text{mm}$ (e.g. curb) while chassis remains horizontal ($\phi = 0$).

---

## PHASE 4: TYPESCRIPT DIGITAL TWIN INTEGRATION
- [ ] **Task 4.1: TypeScript Physics Engine Porting**:
  * Implement `src/physics/WLMRDynamicEngine.ts` mirroring the Python verified equations.
  * Integrate with `useMobileRobotStore` as `physicsFidelity: 'wlmr_full_dynamics'`.
- [ ] **Task 4.2: 3D Articulation in Viewport**:
  * In `MobileRobotVisuals.ts`, update the rotation of the 5-bar linkage nodes (`Part 1`, `Part 2`, `Part 3`, `Part 4`) in real time matching $(\theta_1, \theta_2)$.
  * Animate dynamic pitch bobbing $\theta_p(t)$ and leg squatting/jumping.

---

## PHASE 5: BENCHMARKING & PUBLICATION
- [ ] **Task 5.1: Comparative Benchmark vs SOTA Platforms**:
  * Compare energy consumption, settling time, and maximum step-obstacle height against Ascento and Diabolo.
- [ ] **Task 5.2: LaTeX Manuscript**:
  * Generate complete paper draft with TikZ kinematic diagrams, KaTeX formulas, and simulation trajectories in `paper/`.
