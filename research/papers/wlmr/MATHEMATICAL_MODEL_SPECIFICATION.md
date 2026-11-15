# WHEEL-LEGGED MOBILE ROBOT (WLMR)
## FULL MATHEMATICAL MODEL SPECIFICATION & MULTI-BODY FORMULATION

This document establishes the rigorous analytical foundation for the floating-base wheel-legged bipedal robot with independent articulated 5-bar linkage legs.

---

## 1. COORDINATE FRAMES & KINEMATIC DEFINITIONS

We define the following right-handed Cartesian coordinate systems:

1. **Inertial World Frame** $\mathcal{F}_{\mathcal{I}} = \{O_{\mathcal{I}}, \mathbf{X}_{\mathcal{I}}, \mathbf{Y}_{\mathcal{I}}, \mathbf{Z}_{\mathcal{I}}\}$:
   - $\mathbf{Z}_{\mathcal{I}}$: Vertically upward (opposite gravity $\mathbf{g} = [0, 0, -g]^T$, $g = 9.81\,\text{m/s}^2$).
   - $\mathbf{X}_{\mathcal{I}}, \mathbf{Y}_{\mathcal{I}}$: Horizontal plane defining world navigation coordinates.

2. **Floating Base Frame** $\mathcal{F}_{\mathcal{B}} = \{O_{\mathcal{B}}, \mathbf{X}_{\mathcal{B}}, \mathbf{Y}_{\mathcal{B}}, \mathbf{Z}_{\mathcal{B}}\}$:
   - Fixed at the geometric center of the main robot chassis.
   - $\mathbf{X}_{\mathcal{B}}$: Longitudinal forward axis.
   - $\mathbf{Y}_{\mathcal{B}}$: Lateral axis (pointing from right hip toward left hip).
   - $\mathbf{Z}_{\mathcal{B}}$: Normal to chassis deck (pointing upward).
   - Pose of base: $\mathbf{p}_{\mathcal{B}} = [x_b, y_b, z_b]^T \in \mathbb{R}^3$, Orientation: $\mathbf{\Theta}_{\mathcal{B}} = [\phi, \theta, \psi]^T$ (Roll, Pitch, Yaw).

3. **Hip Base Pivots** $\mathcal{H}_L, \mathcal{H}_R$:
   - Left Hip Frame: Origin at $\mathbf{p}_{H, L} = \mathbf{p}_{\mathcal{B}} + \mathbf{R}_{\mathcal{B}} [0, +W/2, -h_0]^T$.
   - Right Hip Frame: Origin at $\mathbf{p}_{H, R} = \mathbf{p}_{\mathcal{B}} + \mathbf{R}_{\mathcal{B}} [0, -W/2, -h_0]^T$.
   - $W$: Track width between left and right hip centers ($\approx 0.270\,\text{m}$).

4. **Wheel Axle Frames** $\mathcal{W}_L, \mathcal{W}_R$:
   - Centers of the driven wheels ($r_w \approx 0.035\,\text{m}$).

---

## 2. 5-BAR CLOSED KINEMATIC LOOP MECHANISM

Each leg consists of a planar five-bar linkage operating in the sagittal plane ($\mathbf{X}_{\mathcal{B}} - \mathbf{Z}_{\mathcal{B}}$):

```
       Base Chassis Pivot A (Hip 1)        Base Chassis Pivot B (Hip 2)
                 ●───────────────────────────────────●
                / \                                 / \
      Link 1   /   \ θ1                   θ2       /   \  Link 2
      (l1)    /     \                             /     \ (l2)
             ●       \                           /       ●
              \       \                         /       /
      Link 3   \       \                       /       /  Link 4
      (l3)      \       \                     /       /   (l4)
                 \       \                   /       /
                  \       \                 /       /
                   \       \               /       /
                    \       \             /       /
                     \       \           /       /
                      \       ●─────────●       /
                       \     Wheel Hub / Axle  /
                        \                     /
                         \         ●         /
                          \    Wheel (rw)   /
                           \               /
                            ───────────────
                             Ground Contact
```

### A. Vector Loop Closure Equation
Let the base link between hip pivots $A$ and $B$ have length $d$ along $\mathbf{X}_{\mathcal{B}}$:
$$\mathbf{r}_A = [0, 0]^T, \quad \mathbf{r}_B = [d, 0]^T$$

The two active links 1 and 2 rotate with actuated angles $\theta_1, \theta_2$:
$$\mathbf{r}_1 = \begin{bmatrix} l_1 \cos\theta_1 \\ l_1 \sin\theta_1 \end{bmatrix}, \quad \mathbf{r}_2 = \begin{bmatrix} d + l_2 \cos\theta_2 \\ l_2 \sin\theta_2 \end{bmatrix}$$

The passive links 3 and 4 connect to the common wheel hub $C = [x_c, z_c]^T$:
$$\|\mathbf{r}_C - \mathbf{r}_1\|^2 = l_3^2$$
$$\|\mathbf{r}_C - \mathbf{r}_2\|^2 = l_4^2$$

### B. Analytical Jacobian & Virtual Leg
We define the **Virtual Leg** from hip midpoint $H_0$ to wheel axle $C$:
$$L_{leg} = \sqrt{x_c^2 + z_c^2}, \quad \alpha_{leg} = \arctan2(x_c, -z_c)$$

By differentiating the kinematic equations:
$$\begin{bmatrix} \dot{x}_c \\ \dot{z}_c \end{bmatrix} = \mathbf{J}_{leg}(\theta_1, \theta_2) \begin{bmatrix} \dot{\theta}_1 \\ \dot{\theta}_2 \end{bmatrix}$$

Where $\mathbf{J}_{leg} \in \mathbb{R}^{2 \times 2}$ is the analytical leg Jacobian:
$$\mathbf{J}_{leg} = \begin{bmatrix} \frac{\partial x_c}{\partial \theta_1} & \frac{\partial x_c}{\partial \theta_2} \\ \frac{\partial z_c}{\partial \theta_1} & \frac{\partial z_c}{\partial \theta_2} \end{bmatrix}$$

By principle of virtual work, the relationship between virtual leg forces $\mathbf{F}_{virt} = [F_x, F_z]^T$ and actuated motor torques $\boldsymbol{\tau}_{leg} = [\tau_1, \tau_2]^T$ is:
$$\boldsymbol{\tau}_{leg} = \mathbf{J}_{leg}^T \begin{bmatrix} F_x \\ F_z \end{bmatrix}$$

---

## 3. FLOATING-BASE MULTI-BODY DYNAMICS FORMULATION

### A. Equations of Motion via Euler-Lagrange
The kinetic energy $T$ and potential energy $V$ of the entire system are:
$$T = \frac{1}{2} m_b \dot{\mathbf{p}}_b^T \dot{\mathbf{p}}_b + \frac{1}{2} \boldsymbol{\omega}_b^T \mathbf{I}_b \boldsymbol{\omega}_b + \sum_{i=1}^{n_{links}} \left( \frac{1}{2} m_i \dot{\mathbf{p}}_i^T \dot{\mathbf{p}}_i + \frac{1}{2} \boldsymbol{\omega}_i^T \mathbf{I}_i \boldsymbol{\omega}_i \right) + \sum_{w \in \{L, R\}} \left( \frac{1}{2} m_w \dot{\mathbf{p}}_w^T \dot{\mathbf{p}}_w + \frac{1}{2} I_w \omega_w^2 \right)$$

$$V = m_b g z_b + \sum_{i=1}^{n_{links}} m_i g z_i + m_{wL} g z_{wL} + m_{wR} g z_{wR}$$

Applying the Lagrange equations with non-holonomic and closed-chain constraints:
$$\frac{d}{dt}\left(\frac{\partial \mathcal{L}}{\partial \dot{\mathbf{q}}}\right) - \frac{\partial \mathcal{L}}{\partial \mathbf{q}} = \mathbf{S}^T \boldsymbol{\tau} + \mathbf{J}_c^T \mathbf{F}_c + \mathbf{J}_{loop}^T \boldsymbol{\lambda}$$

In standard manipulator form:
$$\mathbf{M}(\mathbf{q})\ddot{\mathbf{q}} + \mathbf{C}(\mathbf{q}, \dot{\mathbf{q}})\dot{\mathbf{q}} + \mathbf{G}(\mathbf{q}) = \mathbf{S}^T \boldsymbol{\tau} + \mathbf{J}_c^T \mathbf{F}_c + \mathbf{J}_{loop}^T \boldsymbol{\lambda}$$

Where:
- $\mathbf{M}(\mathbf{q}) \succ 0$: Generalized symmetric positive-definite inertia matrix.
- $\mathbf{C}(\mathbf{q}, \dot{\mathbf{q}})$: Coriolis and centripetal matrix (satisfying $\dot{\mathbf{M}} - 2\mathbf{C}$ skew-symmetric).
- $\mathbf{G}(\mathbf{q})$: Gravity torque vector.
- $\mathbf{S}$: Actuation selection matrix selecting $[\tau_{1L}, \tau_{2L}, \tau_{1R}, \tau_{2R}, \tau_{wL}, \tau_{wR}]$.
- $\mathbf{J}_c$: Wheel ground contact Jacobian ($v_c = \mathbf{J}_c \dot{\mathbf{q}} = \mathbf{0}$ for non-slip rolling).
- $\mathbf{J}_{loop}$: Internal closed-loop geometric constraint Jacobian.

---

## 4. HIERARCHICAL WHOLE-BODY CONTROL (WBC) ARCHITECTURE

### Subsystem 1: Sagittal Variable-Length LQR (LPV)
In the sagittal plane, when leg length $L_{leg}$ varies, the linearized dynamics around vertical equilibrium ($\theta_p \approx 0$) yield:
$$\dot{\mathbf{x}}_{bal} = \mathbf{A}(L) \mathbf{x}_{bal} + \mathbf{B}(L) \tau_{wheel}$$
where $\mathbf{x}_{bal} = [x, \dot{x}, \theta_p, \dot{\theta}_p]^T$.

The parameter-dependent matrices are:
$$\mathbf{A}(L) = \begin{bmatrix} 0 & 1 & 0 & 0 \\ 0 & 0 & \frac{-m^2 g L^2}{\det(\mathbf{M})} & 0 \\ 0 & 0 & 0 & 1 \\ 0 & 0 & \frac{(M+m)m g L}{\det(\mathbf{M})} & 0 \end{bmatrix}, \quad \mathbf{B}(L) = \begin{bmatrix} 0 \\ \frac{I_p + m L^2 + m L r_w}{r_w \det(\mathbf{M})} \\ 0 \\ \frac{-(M+m)r_w - m L}{r_w \det(\mathbf{M})} \end{bmatrix}$$

Using an offline Riccati solver across grid points $L \in [L_{min}, L_{max}]$:
$$\mathbf{K}_{LQR}(L) = \text{LQR}(\mathbf{A}(L), \mathbf{B}(L), \mathbf{Q}, \mathbf{R})$$
$$\tau_{bal} = -\mathbf{K}_{LQR}(L) (\mathbf{x}_{bal} - \mathbf{x}_{bal, ref})$$

### Subsystem 2: Vertical Virtual Model Control (VMC)
For each leg $i \in \{L, R\}$:
$$F_{z, i} = k_{p, z}(z_{ref} - z_i) + k_{d, z}(\dot{z}_{ref} - \dot{z}_i) + \frac{m_{total} g}{2}$$

### Subsystem 3: Lateral Roll Stabilization
$$z_{L, ref} = z_{ref} + \frac{W}{2}\tan(\phi_{ref} - \phi)$$
$$z_{R, ref} = z_{ref} - \frac{W}{2}\tan(\phi_{ref} - \phi)$$

### Subsystem 4: Yaw Differential Torque
$$\Delta \tau_{yaw} = k_{p, \psi}(\psi_{ref} - \psi) + k_{d, \psi}(\dot{\psi}_{ref} - \dot{\psi})$$
$$\tau_{wL} = \tau_{bal} + \Delta \tau_{yaw}, \quad \tau_{wR} = \tau_{bal} - \Delta \tau_{yaw}$$

---

## 5. RECONCILIATION WITH ONSHAPE CAD PARAMETERS

| Parameter | Symbol | Nominal Value | CAD Source |
| :--- | :---: | :---: | :--- |
| Chassis Mass | $m_b$ | $1.42\,\text{kg}$ | `Body_design_V2.step` (mass properties) |
| Wheel Mass (each) | $m_w$ | $0.21\,\text{kg}$ | `Wheel.step` (2 wheels) |
| Total Robot Mass | $M_{tot}$ | $2.20\,\text{kg}$ | Fully assembled robot |
| Wheel Radius | $r_w$ | $0.035\,\text{m}$ ($35\,\text{mm}$) | `Wheel.step` outer diameter $70\,\text{mm}$ |
| Track Width | $W$ | $0.270\,\text{m}$ ($270\,\text{mm}$) | Distance between wheel centerline planes |
| Link 1 Length (Upper) | $l_1$ | $0.080\,\text{m}$ ($80\,\text{mm}$) | `Part 1` length |
| Link 2 Length (Upper) | $l_2$ | $0.080\,\text{m}$ ($80\,\text{mm}$) | `Part 2` length |
| Link 3 Length (Lower) | $l_3$ | $0.120\,\text{m}$ ($120\,\text{mm}$) | `Part 3` length |
| Link 4 Length (Lower) | $l_4$ | $0.120\,\text{m}$ ($120\,\text{mm}$) | `Part 4` length |
| Leg Length Range | $L_{leg}$ | $[0.095\,\text{m}, 0.190\,\text{m}]$ | Kinematic limits |
| Actuator Max Torque | $\tau_{max}$ | $2.5\,\text{N}\cdot\text{m}$ | Nidec / Nema17 with gearbox |
