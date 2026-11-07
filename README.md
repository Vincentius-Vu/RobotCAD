# RobotCAD (Community Edition) — 3D Industrial Robotics Kinematics & Simulation Studio

[![License: GPL-3.0](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.0-61dafb.svg)](https://react.dev/)
[![Three.js](https://img.shields.io/badge/Three.js-r174-black.svg)](https://threejs.org/)
[![Vite](https://img.shields.io/badge/Vite-6.2-646cff.svg)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.4-38b2ac.svg)](https://tailwindcss.com/)
[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-Live%20Demo-brightgreen?logo=github)](https://vincentius-vu.github.io/RobotCAD/)

> 🚀 **Trải nghiệm trực tiếp trên trình duyệt (Không cần cài đặt):**
> ### 👉 [https://vincentius-vu.github.io/RobotCAD/](https://vincentius-vu.github.io/RobotCAD/)

An interactive, high-performance WebGL/Three.js 3D robotics simulation platform and digital twin studio for industrial manipulators and autonomous mobile robots (AGVs). Built entirely on modern web standards (**Vite**, **React 19**, **TypeScript**, **Three.js**, **Tailwind CSS**, and **Zustand**).

---

## 🌟 Key Features

### 🦾 1. Industrial Robot Manipulator Studio
- **18 Pre-configured Industrial Manipulators**:
  - **Collaborative & Research**: PUMA 560, Franka Emika Panda (7-DOF), UR5.
  - **ABB**: IRB 120, IRB 1410, IRB 2400, IRB 4400L/30, IRB 6620, IRB 6650.
  - **FANUC**: M-10iA, R-1000i, R-2000i, S-430.
  - **KUKA**: KR 5, KR 5 Sixx, KR 6/2, KR 210 Ultra.
  - **Epson**: C3-A601S.
- **Direct & Inverse Kinematics Engine**:
  - Implements standard Denavit–Hartenberg (D-H) formulation:
    $$A_i = \text{Rot}_z(\theta_i) \cdot \text{Trans}_z(d_i) \cdot \text{Trans}_x(a_i) \cdot \text{Rot}_x(\alpha_i)$$
    $$T_0^i = A_1(q_1) \cdot A_2(q_2) \cdots A_i(q_i)$$
  - 60 FPS forward kinematics matrix propagation directly to link STL meshes.
- **Interactive 3D Viewport**:
  - Realistic studio lighting with soft shadow mapping (`PCFSoftShadowMap`).
  - Coordinate frames $\{0\} \dots \{n\}$ ($\text{Red}: \hat{\mathbf{x}}, \text{Green}: \hat{\mathbf{y}}, \text{Blue}: \hat{\mathbf{z}}$).
  - Kinematic skeleton backbone connecting joint origins $O_0 \to O_1 \to \dots \to O_n$.
  - Tool Center Point (TCP) glowing marker and real-time 3D ribbon trajectory tracing.
  - Rendering styles: Solid Metallic PBR vs Ghosted Translucent X-Ray with wireframe contours.
  - Camera Presets: Isometric, Front ($X-Z$), Top ($X-Y$), Side ($Y-Z$), TCP Follow.
- **Joint Control & Singularities**:
  - Joint sliders with physical mechanical limits, numeric precision input, and deg/rad toggle.
  - Posture presets: *Home Posture*, *Zero Posture*, *Reach Singularity*, *Wrist Singularity*.
  - Real-time TCP Pose HUD ($X, Y, Z, \text{Roll}, \text{Pitch}, \text{Yaw}$) with singularity detection.

### 🚙 2. Autonomous Mobile Robot (AGV) Digital Twin
- **Dual-PMSM Differential Drive Dynamics**:
  - Chassis dynamic model with 4-point ground contact and dual swivel casters.
  - Field-Oriented Control (FOC) electrical drive model, inverter PWM, and DC bus power flow.
  - Lidar sensor simulation and waypoint path planner with trajectory follower.
- **Single Source of Truth (SSoT)**:
  - Validated analytical physical models documented in [`SSoT_MATHEMATICAL_MODEL_AND_PARAMETERS.md`](./SSoT_MATHEMATICAL_MODEL_AND_PARAMETERS.md).

### 📊 3. Multiphysics Verification & Scientific Benchmarks
- Recursive Newton-Euler (RNE) dynamic torques calculation.
- Controller benchmarks: Gravity Compensation PD, Computed Torque Control, Linear ADRC, and Custom Nonlinear PID.
- Cross-platform numerical reproducibility suite across C++17, Python 3.12, and MATLAB.

---

## 🚀 Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) (version 18.0 or newer recommended)
- Modern WebGL2-compatible browser (Chrome, Edge, Firefox, Brave)

### Option A: One-Click Launch (Windows)
Double-click `start_app.bat` in the root folder. It will install packages (if first run), start the development server, and automatically open your default browser at `http://localhost:5173`.

To stop the background server at any time, run `stop_app.bat` or press `Ctrl + C` in the terminal.

### Option B: Command Line (All Platforms)

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Vincentius-Vu/RobotCAD.git
   cd RobotCAD
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Run local development server**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.

4. **Build production bundle**:
   ```bash
   npm run build
   ```
   The production-ready assets will be generated in `dist/`.

---

## 📁 Repository Structure

```
RobotCAD/
├── public/
│   └── robots/                 # Complete 3D STL meshes and XML configs for 18 robots
├── src/
│   ├── components/             # React UI components (Viewport, Drawer, HUD, ControlPanel)
│   ├── kinematics/             # D-H solver, TrajectoryPlanner, WorkspaceGenerator
│   ├── layout/                 # Main layout, TopRibbon, Dock panels
│   ├── navigation/             # AGV Lidar sensor, PathPlanner, TrajectoryFollower
│   ├── physics/                # RNE Engine, PMSM motor models, power converters
│   ├── services/               # RobotLoader, XML parser, STL caching
│   ├── store/                  # Zustand state stores (robotStore, mobileRobotStore)
│   └── types/                  # TypeScript interface definitions
├── docs/
│   └── USER_MANUAL.md          # Comprehensive user manual and operating guide
├── scripts/                    # CoppeliaSim 3D CAD model conversion & export scripts
├── start_app.bat               # 1-click Windows launcher
├── stop_app.bat                # Safe background process stopper
├── CITATION.cff                # Academic citation metadata
└── vite.config.ts              # Vite bundler & dynamic asset streaming configuration
```

---

## 📖 Documentation
- [Comprehensive User Manual & Feature Guide](docs/USER_MANUAL.md)
- [Live Interactive Web App](https://vincentius-vu.github.io/RobotCAD/)

---

## 📜 How to Cite (Trích dẫn Khoa học)

Nếu bạn sử dụng **RobotCAD**, mô hình toán học giải tích hoặc bộ số liệu đối chuẩn trong các công trình nghiên cứu, bài báo khoa học, luận văn hoặc tài liệu giảng dạy, vui lòng trích dẫn theo định dạng sau:

### APA Format
> Vu, T.-V. (2026). *Deterministic Machine-Precision Cross-Validation and Real-Time Edge Simulation of an All-Analytical Digital Twin for Dual-PMSM Wheeled Mobile Robots: A Tri-Platform Comparative Study across C++, Python, and MATLAB*. Acta Mechanica et Automatica. https://github.com/Vincentius-Vu/RobotCAD

### BibTeX
```bibtex
@article{Vu2026RobotCAD,
  author    = {Vu, Tri-Vien},
  title     = {Deterministic Machine-Precision Cross-Validation and Real-Time Edge Simulation of an All-Analytical Digital Twin for Dual-PMSM Wheeled Mobile Robots: A Tri-Platform Comparative Study across C++, Python, and MATLAB},
  journal   = {Acta Mechanica et Automatica},
  year      = {2026},
  publisher = {Bia{\l}ystok University of Technology},
  url       = {https://github.com/Vincentius-Vu/RobotCAD}
}

@software{RobotCADStudio2026,
  author    = {Vu, Tri-Vien},
  title     = {RobotCAD: 3D Industrial Robotics Kinematics, Dynamics & Multiphysics Studio},
  year      = {2026},
  url       = {https://vincentius-vu.github.io/RobotCAD/},
  version   = {1.0.0}
}
```

---

## 📄 License & Intellectual Property

- **Academic & Open-Source License:** Dự án này được cấp phép theo điều khoản của **[GNU General Public License v3.0 (GPLv3)](LICENSE)**.
  - Bạn được tự do sử dụng, chỉnh sửa và phân phối cho mục đích học tập, giảng dạy và nghiên cứu khoa học.
  - Mọi sản phẩm hoặc phần mềm kế thừa/sử dụng mã nguồn từ RobotCAD **bắt buộc phải mở mã nguồn công khai theo chuẩn GPLv3**.
- **Commercial Inquiries (Bản quyền Thương mại):** Các doanh nghiệp, tổ chức có nhu cầu tích hợp các module của RobotCAD vào sản phẩm đóng gói thương mại hoặc ứng dụng công nghiệp mà không áp dụng điều khoản mở mã nguồn của GPLv3, vui lòng liên hệ tác giả để nhận giấy phép thương mại riêng biệt (Commercial Dual-Licensing):
  - **Tác giả:** Vũ Trí Viễn (Tri-Vien Vu)
  - **Đơn vị:** Trường Đại học Tôn Đức Thắng (TDTU), TP. Hồ Chí Minh, Việt Nam
  - **Email:** `vutrivien@tdtu.edu.vn` / `vutrivien@gmail.com`

