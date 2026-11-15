# Trung Tâm Nghiên Cứu Robot Tự Hành & Robot Chân Bánh (Robotics Research Hub)

Thư mục `research/` là không gian tập trung toàn bộ các tài liệu nghiên cứu khoa học, bài báo chuẩn quốc tế (IEEE/Elsevier/Springer), kế hoạch phát triển thuật toán (Roadmap), mô hình toán học và mã nguồn thí nghiệm của phòng lab.

---

## Cấu Trúc Thư Mục `research/`

```text
research/
├── README.md                                  # Mục lục trung tâm và hướng dẫn tra cứu
├── RESEARCH_TOPICS_ROADMAP.md                 # Tài liệu chi tiết các Topic & Hướng nghiên cứu khả thi (2024–2026)
├── topics/                                    # Hồ sơ chi tiết từng hướng nghiên cứu chuyên sâu
│   ├── 01_LADRC_ESO_Slip_Compensation.md     # Topic 1: Điều khiển ADRC tuyến tính bù trượt & tải trọng biến thiên
│   ├── 02_MPCC_CBF_Safety_Contouring.md      # Topic 2: MPCC tối ưu contouring kết hợp Control Barrier Functions
│   ├── 03_PPC_NFTSMC_Fixed_Time.md           # Topic 3: Prescribed Performance & Fast Terminal Sliding Mode
│   ├── 04_Guidance_Vector_Fields.md          # Topic 4: Trường Vector dẫn hướng phi kỳ dị (GVF)
│   └── 05_WLMR_Whole_Body_Tracking.md        # Topic 5: Điều khiển toàn thân bám quỹ đạo Robot Chân-Bánh (WLMR)
└── papers/                                    # Kho lưu trữ các bài báo khoa học & bản thảo đang viết
    ├── puma560_benchmark/                     # Bài báo Benchmark điều khiển tay máy PUMA 560
    │   ├── scientific_paper_puma560_benchmark.md
    │   └── research_paper_session_system_prompt.md
    ├── d2a2s_curve/                           # Nghiên cứu quỹ đạo S-Curve bất đối xứng (D2A2S)
    │   ├── d2a2s_references.bib
    │   └── figures/
    ├── wlmr/                                  # Nghiên cứu Robot Chân Bánh (Wheel-Legged Mobile Robot)
    │   ├── MATHEMATICAL_MODEL_SPECIFICATION.md
    │   └── WLMR_SYSTEM_PROMPT.md
    └── trajectory_tracking_survey/            # Tổng quan tài liệu & trích dẫn BibTeX bám quỹ đạo (2023–2026)
        └── recent_trajectory_tracking_references.bib
```

---

## Danh Mục Các Dự Án & Bài Báo Đang Thực Hiện

| Mã Đề Tài | Tên Đề Tài & Bài Báo | Mô Hình Áp Dụng | Trạng Thái | Thư Mục Chuyên Trách |
| :--- | :--- | :--- | :---: | :--- |
| **BENCH-01** | *High-Performance Nonlinear Control Benchmark for 6-DOF Industrial Manipulators (PUMA 560)* | Tay máy nối tiếp 6 bậc | Bản thảo hoàn thiện | [`papers/puma560_benchmark/`](file:///c:/Users/T14/OneDrive%20-%20tdtu.edu.vn/BaiGiang/%C4%90%E1%BB%99ng%20l%E1%BB%B1c%20h%E1%BB%8Dc%20v%C3%A0%20%C4%91i%E1%BB%81u%20khi%E1%BB%83n%20robot/antigravity_agents/research/papers/puma560_benchmark/) |
| **TRAJ-01** | *Dual-Drive Asymmetric S-Curve Trajectory Planning with DC-Link Voltage & Thermal Constraints* | AGV 2 bánh vi sai công nghiệp | Đang thiết kế thuật toán | [`papers/d2a2s_curve/`](file:///c:/Users/T14/OneDrive%20-%20tdtu.edu.vn/BaiGiang/%C4%90%E1%BB%99ng%20l%E1%BB%B1c%20h%E1%BB%8Dc%20v%C3%A0%20%C4%91i%E1%BB%81u%20khi%E1%BB%83n%20robot/antigravity_agents/research/papers/d2a2s_curve/) |
| **WLMR-01** | *Full Nonlinear Dynamic Modeling & Whole-Body Stabilization of Wheel-Legged Mobile Robots* | Robot Chân-Bánh 2DOF/leg | Đã chốt cấu trúc CAD & hệ phương trình | [`papers/wlmr/`](file:///c:/Users/T14/OneDrive%20-%20tdtu.edu.vn/BaiGiang/%C4%90%E1%BB%99ng%20l%E1%BB%B1c%20h%E1%BB%8Dc%20v%C3%A0%20%C4%91i%E1%BB%81u%20khi%E1%BB%83n%20robot/antigravity_agents/research/papers/wlmr/) |
| **TRACK-01** | *Active Disturbance Rejection Control (LADRC-LESO) for Wheeled Mobile Robots under Severe Wheel Slip* | AMR vi sai / Mecanum | Nghiên cứu định hướng | [`topics/01_LADRC_ESO_Slip_Compensation.md`](file:///c:/Users/T14/OneDrive%20-%20tdtu.edu.vn/BaiGiang/%C4%90%E1%BB%99ng%20l%E1%BB%B1c%20h%E1%BB%8Dc%20v%C3%A0%20%C4%91i%E1%BB%81u%20khi%E1%BB%83n%20robot/antigravity_agents/research/topics/01_LADRC_ESO_Slip_Compensation.md) |
| **TRACK-02** | *Model Predictive Contouring Control with Control Barrier Functions (MPCC-CBF) for Dense Logistics* | AMR kho thông minh | Nghiên cứu định hướng | [`topics/02_MPCC_CBF_Safety_Contouring.md`](file:///c:/Users/T14/OneDrive%20-%20tdtu.edu.vn/BaiGiang/%C4%90%E1%BB%99ng%20l%E1%BB%B1c%20h%E1%BB%8Dc%20v%C3%A0%20%C4%91i%E1%BB%81u%20khi%E1%BB%83n%20robot/antigravity_agents/research/topics/02_MPCC_CBF_Safety_Contouring.md) |

---

## Hướng Dẫn Mở Session Nghiên Cứu Mới

Để đảm bảo không làm loãng ngữ cảnh (context window) giữa việc tối ưu web app và nghiên cứu hàn lâm chuyên sâu:
1. Mở một chat session mới trong Antigravity.
2. Sao chép System Prompt chuyên biệt trong từng thư mục (ví dụ: `WLMR_SYSTEM_PROMPT.md` hoặc `D2A2S_SYSTEM_PROMPT.md`).
3. Dán vào tin nhắn đầu tiên của session mới để kích hoạt đầy đủ vai trò chuyên gia, định hướng xuất bản và tiêu chuẩn khoa học.
