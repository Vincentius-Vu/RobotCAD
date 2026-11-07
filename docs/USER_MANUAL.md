# HƯỚNG DẪN SỬ DỤNG PHẦN MỀM ROBOCAD 3D (ROBOTICS VISUALIZER)
## Nền Tảng Mô Phỏng, Phân Tích Động Học, Động Lực Học & Điều Khiển Robot Đa Miền Vật Lý
**Phiên bản phần mềm:** 2.0 LTS  
**Khoa Điện - Điện Tử, Đại học Tôn Đức Thắng (TDTU)**  
**Dành cho:** Giảng viên, Sinh viên, Học viên Cao học & Kỹ sư Nghiên cứu R&D Robot

---

## MỤC LỤC
1. [GIỚI THIỆU TỔNG QUAN](#1-giới-thiệu-tổng-quan)
2. [CẤU TRÚC GIAO DIỆN CHUẨN CÔNG NGHIỆP](#2-cấu-trúc-giao-diện-chuẩn-công-nghiệp)
3. [NĂM CHẾ ĐỘ LÀM VIỆC CHÍNH (WORKSPACE MODES)](#3-năm-chế-độ-làm-việc-chính-workspace-modes)
   - 3.1. Chế độ Jogging & Động học thuận (FK)
   - 3.2. Chế độ Động học nghịch & Gizmo 3D (IK)
   - 3.3. Chế độ Thiết kế Quỹ đạo (Trajectory Studio)
   - 3.4. Chế độ Phân tích Không gian làm việc (Workspace Cloud)
   - 3.5. Chế độ Phòng thí nghiệm Động lực học (Dynamics Lab)
4. [BỘ DAO ĐỘNG KÝ & CỬA SỔ RỜI ĐA MÀN HÌNH (MULTI-PHYSICS SCOPE)](#4-bộ-dao-động-ký--cửa-sổ-rời-đa-màn-hình-multi-physics-scope)
   - 4.1. Cách mở và sử dụng Cửa sổ rời (Pop-out Window)
   - 4.2. Khảo sát 5 tab tín hiệu chuyên sâu (Động cơ, Biến tần, Bus DC, Mô-men, Sai số)
5. [CÁC CÔNG CỤ PHÒNG THÍ NGHIỆM ẢO & XUẤT BÁO CÁO (VIRTUAL LAB & TOOLS)](#5-các-công-cụ-phòng-thí-nghiệm-ảo--xuất-báo-cáo-virtual-lab--tools)
   - 5.1. D-H Interactive Quiz (Kiểm tra gán trục D-H tự động)
   - 5.2. Virtual 3D Caliper (Thước đo kích thước không gian)
   - 5.3. Code Exporter (Xuất code Python, C++, MATLAB, ROS 2 URDF)
   - 5.4. Academic Report & Snapshot DPI (Xuất báo cáo LaTeX & Ảnh xuất bản)
6. [HƯỚNG DẪN THỰC HÀNH TỪNG BƯỚC (STEP-BY-STEP TUTORIALS)](#6-hướng-dẫn-thực-hành-từng-bước-step-by-step-tutorials)
   - Bài 1: Gán hệ trục D-H và kiểm tra ma trận chuyển đổi
   - Bài 2: Thiết kế chu trình Pick-and-Place bằng đa thức bậc 3 và bậc 5
   - Bài 3: So sánh chất lượng các bộ điều khiển CTC, NPID và LADRC khi có tải động
   - Bài 4: Giám sát sụt áp Bus DC và dòng điện Stator trên hai màn hình
7. [BẢNG PHÍM TẮT & XỬ LÝ SỰ CỐ THƯỜNG GẶP](#7-bảng-phím-tắt--xử-lý-sự-cố-thường-gặp)

---

## 1. GIỚI THIỆU TỔNG QUAN

**RoboCAD 3D (Robotics Visualizer)** là nền tảng mô phỏng số mô phỏng đồ họa 3D tương tác thời gian thực, tích hợp sâu giữa **Động học tay máy**, **Động lực học phi tuyến đa vật thể (Recursive Newton-Euler / RK4)**, **Truyền động điện động cơ đồng bộ nam châm vĩnh cửu (PMSM Field-Oriented Control)** và **Điện tử công suất (Biến tần SVPWM & Bus DC dùng chung)**.

### Đối tượng phục vụ:
- **Giảng dạy & Học tập:** Trợ giảng ảo giúp sinh viên nắm vững nguyên lý gán trục Denavit-Hartenberg (D-H), giải động học thuận/nghịch, thiết kế quỹ đạo nội suy mượt, và hiểu rõ bản chất vật lý của các thành phần mô-men trọng lực, Coriolis, ly tâm.
- **Nghiên cứu khoa học:** Cung cấp môi trường kiểm thử (benchmark platform) chuẩn xác cao, đối chứng hiệu năng các bộ điều khiển kinh điển (Gravity-PD, CTC) và hiện đại (Nonlinear PID, Linear ADRC) dưới tác động của các ràng buộc phần cứng thực tế (quán tính rotor quy đổi $N^2 J_m$, bão hòa điện áp biến tần, trễ trích mẫu DSP $10\,\text{kHz}$, sụt áp nguồn SMPS).

---

## 2. CẤU TRÚC GIAO DIỆN CHUẨN CÔNG NGHIỆP

Giao diện phần mềm được tổ chức theo tiêu chuẩn phần mềm CAD/CAE chuyên nghiệp với 5 phân vùng chức năng:

```
+---------------------------------------------------------------------------------------------------+
| [1] TOP INDUSTRIAL RIBBON (Thanh công cụ đỉnh: Chọn Robot, Mode, Theme, Rec, Snapshot, Scope)   |
+-------------------+-----------------------------------------------------------+-------------------+
|                   |                                                           |                   |
|                   |                                                           |                   |
| [2] LEFT SIDEBAR  |              [3] CENTRAL 3D VIEWPORT                      | [4] RIGHT         |
|  - Cây khâu khớp  |   - Khung nhìn 3D tương tác Three.js                     |     INSPECTOR     |
|  - Bảng D-H       |   - Gizmo kéo IK tương tác (TransformControls)            |  - Thuộc tính     |
|  - Thanh trượt FK |   - Compact Pose HUD & Camera Presets HUD                 |  - Phân cỡ Motor  |
|  - Waypoint Studio|   - Khung tọa độ, Trọng tâm COM, Đám mây điểm             |  - Biến tần & Bus |
|  - Tham số Môi tr.|                                                           |  - Bộ điều khiển  |
|                   |                                                           |                   |
+-------------------+-----------------------------------------------------------+-------------------+
| [5] BOTTOM DOCK (Thanh Timeline phát Quỹ đạo + Đồ thị Động học q/v/a + Dao động ký Mô-men τ)     |
+---------------------------------------------------------------------------------------------------+
```

1. **Top Industrial Ribbon:**
   - **Hộp chọn Robot Model:** Chuyển đổi linh hoạt giữa các dòng robot công nghiệp phổ biến (Unimation PUMA 560, SCARA 4-DOF, KUKA KR6, Universal Robots UR5/UR10, ABB IRB120, Tay máy phẳng 2-3 DOF).
   - **Thanh chuyển đổi 5 Chế độ Làm việc (Workspace Modes):** Jogging, IK, Trajectory, Workspace, Dynamics.
   - **Công cụ Hỗ trợ:** Bật/tắt lưới tọa độ sàn (Grid), Đổi màu nền (Studio Dark / Academic White `#FFF`), Quay video mô phỏng (Rec), Chụp ảnh DPI (Camera Snapshot), Trắc nghiệm D-H Quiz, Thước đo 3D Caliper, Xuất code (Code Export), Xuất bài báo (Academic Report), và **Bộ Dao Động Ký Mở Rộng (Oscilloscope)**.
2. **Left Sidebar (Ngăn trái):** Quản lý cấu hình cấu trúc robot, bảng tham số D-H tiêu chuẩn & cải tiến Craig, bảng điều khiển góc quay khớp, danh sách điểm mốc Waypoint, và tham số tải trọng/trọng trường.
3. **Central 3D Viewport (Khung nhìn 3D trung tâm):** Không gian diễn họa WebGL Three.js với bóng đổ mềm, lưới mặt sàn, HUD hiển thị tọa độ Cartesian tức thời $(X, Y, Z, \text{Roll}, \text{Pitch}, \text{Yaw})$ và các nút góc nhìn Camera nhanh (Isometric, Top, Front, Right).
4. **Right Inspector (Ngăn phải):** Tinh chỉnh chi tiết các thuộc tính vật lý: Khối lượng $m_i$, ma trận quán tính $I_{ij}$, thông số động cơ (Loại động cơ, $K_t, K_e, R_a, L_a, J_m, N$), thông số biến tần (Tần số băm xung $f_{sw}$, Dead-time $t_d$) và thông số bộ điều khiển ($K_p, K_d, K_i, \omega_o, \omega_c$).
5. **Bottom Dock (Ngăn đáy):** Thanh điều khiển phát lại quỹ đạo (Play/Pause/Rewind/Loop, thanh trượt thời gian scrubber) kèm ngăn kéo mở rộng chứa đồ thị động học và mô-men.

---

## 3. NĂM CHẾ ĐỘ LÀM VIỆC CHÍNH (WORKSPACE MODES)

### 3.1. Chế độ Jogging & Động học thuận (FK - Forward Kinematics)
- **Mục đích:** Khảo sát ảnh hưởng của từng góc quay khớp đối với vị trí và hướng của khâu tác động cuối (End-Effector).
- **Thao tác:**
  1. Bấm nút **Jogging & FK** trên Top Ribbon (hoặc phím tắt).
  2. Tại ngăn bên trái, sử dụng các thanh trượt $q_1, q_2, \dots, q_n$ để xoay từng khớp theo độ ($^\circ$).
  3. Quan sát mô hình 3D chuyển động mượt mà.
  4. Xem ma trận chuyển đổi thuần nhất $T_0^n$ hiển thị theo thời gian thực tại bảng bên trái cùng tọa độ Cartesian $(X, Y, Z)$ và góc Euler $(\text{Roll}, \text{Pitch}, \text{Yaw})$.
- **Tùy chọn hiển thị:** Bật/tắt các khung tọa độ cục bộ $\{x_i, y_i, z_i\}$ để đối chiếu quy tắc bàn tay phải.

### 3.2. Chế độ Động học nghịch & Gizmo 3D (IK - Inverse Kinematics)
- **Mục đích:** Kéo thả đầu tác động cuối đến vị trí mong muốn trong không gian 3D, phần mềm tự động tính toán cấu hình góc khớp tương ứng.
- **Thao tác:**
  1. Chuyển sang chế độ **IK & Gizmo**.
  2. Một **Gizmo 3D** (hệ trục điều hướng có 3 mũi tên tịnh tiến và 3 vòng xoay hướng) sẽ xuất hiện tại khâu chấp hành cuối.
  3. Bấm giữ chuột trái vào các mũi tên $(X, Y, Z)$ hoặc các vòng xoay để kéo khâu chấp hành cuối đến vị trí đích.
  4. Thuật toán giải động học nghịch số (Damped Least Squares - DLS) kết hợp ma trận nghịch đảo giả Jacobian sẽ giải nghiệm thời gian thực ở tần số $60\,\text{Hz}$.
- **Cảnh báo Thông minh:**
  - **Điểm kỳ dị (Singularity Alert):** Khi cánh tay duỗi thẳng hoặc rơi vào trạng thái mất bậc tự do $(\det(J \cdot J^T) \approx 0)$, viền cảnh báo màu đỏ sẽ sáng lên kèm chỉ số độ linh hoạt Manipulability Index.
  - **Vượt vùng với (Out of Reach):** Nếu kéo Gizmo vượt quá bán kính làm việc cực đại, hệ thống tự động neo điểm chấp hành ở biên tầm với an toàn.

### 3.3. Chế độ Thiết kế Quỹ đạo (Trajectory Studio)
- **Mục đích:** Thiết kế chuỗi chuyển động công nghiệp đi qua nhiều điểm mốc (Waypoints) với các phương pháp nội suy quỹ đạo khác nhau.
- **Thao tác:**
  1. Chuyển sang chế độ **Trajectory Studio**.
  2. Đưa robot về các tư thế mong muốn (dùng Jogging hoặc IK) rồi bấm nút **"Lưu thành Waypoint"** tại ngăn trái (ví dụ: *Home, Approach Bin A, Grasp, Lift, Place, Return*).
  3. Thiết lập thời gian di chuyển (Segment Duration) cho từng đoạn (ví dụ: $1.5\,\text{s}, 2.0\,\text{s}, \dots$).
  4. Chọn thuật toán nội suy quỹ đạo tại menu thả xuống:
     - **Cubic Polynomial (Đa thức bậc 3):** Đảm bảo tính liên tục của vận tốc ($\mathcal{C}^1$), gia tốc nhảy bước tại các điểm nối.
     - **Quintic Polynomial (Đa thức bậc 5):** Đảm bảo độ trơn của cả vận tốc và gia tốc ($\mathcal{C}^2$), triệt tiêu hiện tượng giật giật (jerk) khi khởi hành và dừng.
     - **LSPB / Trapezoidal (Hình thang vận tốc):** Gia tốc không đổi, vận tốc hành trình không đổi, thường dùng trong máy CNC và đóng gói tốc độ cao.
  5. Bấm nút **Play (Space)** ở Bottom Dock để chiêm ngưỡng robot chuyển động theo quỹ đạo liên tục.

### 3.4. Chế độ Phân tích Không gian làm việc (Workspace Cloud)
- **Mục đích:** Tính toán và trực quan hóa toàn bộ phạm vi mà tay máy có thể với tới trong không gian 3 chiều.
- **Thao tác:**
  1. Chuyển sang chế độ **Workspace Cloud**.
  2. Lựa chọn số lượng mẫu ngẫu nhiên Monte Carlo (ví dụ: 5,000 đến 50,000 điểm).
  3. Lựa chọn chế độ không gian:
     - **Reachable Workspace:** Toàn bộ các vị trí $(X, Y, Z)$ mà điểm mút có thể chạm tới với ít nhất một hướng.
     - **Dextrous Workspace:** Tập hợp các vị trí mà khâu cuối có thể tiếp cận với góc định hướng bất kỳ.
  4. Bấm **"Generate Cloud"**: Đám mây điểm màu sắc đa chiều sẽ bao phủ cánh tay robot, thể hiện mật độ và biên giới hạn hình học.

### 3.5. Chế độ Phòng thí nghiệm Động lực học (Dynamics Lab)
- **Mục đích:** Mô phỏng vật lý đa miền kết hợp giữa cơ học nhiều vật thể, động cơ truyền động và điện tử công suất khi gắp tải trọng nặng thay đổi đột ngột.
- **Đặc tính mô phỏng:**
  - Tích hợp giải thuật động lực học nghịch Recursive Newton-Euler (RNE) và tích phân số RK4 tần số $500\,\text{Hz}$ ($dt = 2.0\,\text{ms}$).
  - Cho phép chọn các thuật toán điều khiển chuyển động:
    1. **Gravity Comp + PD:** Bộ điều khiển ổn định Lyapunov bù trọng trường danh định.
    2. **Computed Torque Control (CTC):** Tuyến tính hóa phản hồi triệt tiêu hoàn toàn tương tác động lực học đa trục.
    3. **Nonlinear PID (NPID):** Bộ điều khiển PID phi tuyến với hàm tăng độ lợi thích nghi $K_p(e)$ chống võng tĩnh và khâu chống tích phân bão hòa (Anti-Windup).
    4. **Linear ADRC (LESO bậc 3):** Bộ điều khiển từ chối nhiễu tích cực với bộ quan sát trạng thái mở rộng ước lượng tổng nhiễu động nội tại và tải ngoại lai trong thời gian thực.
  - Thiết lập bước nhảy tải gắp (Payload Step): ví dụ gắp vật nặng $3.5\,\text{kg}$ tại giây thứ $3.5$ và nhả tại giây thứ $7.5$.

---

## 4. BỘ DAO ĐỘNG KÝ & CỬA SỔ RỜI ĐA MÀN HÌNH (MULTI-PHYSICS SCOPE)

### 4.1. Cách mở và sử dụng Cửa sổ rời (Pop-out Window)
Nhằm phục vụ người dùng có nhu cầu giám sát chuyên sâu hoặc sử dụng **hệ thống máy tính 2 đến 3 màn hình**:
1. Bấm nút **"Oscilloscope"** trên Top Ribbon hoặc nút **"Scope Pop-out"** tại Bottom Dock.
2. Hộp thoại **Bộ Dao Động Ký & Phân Tích Vật Lý Đa Miền** sẽ hiển thị.
3. Bấm vào biểu tượng **"Mở Cửa Sổ Rời (Đa Màn Hình)"** (icon `ExternalLink` ở góc trên bên phải):
   - Trình duyệt sẽ mở một cửa sổ popup độc lập.
   - Thầy có thể kéo cửa sổ này sang **màn hình thứ 2** và bấm phóng to cực đại (Maximize).
   - **Đồng bộ trạng thái 2 chiều:** Khi kéo thanh trượt thời gian ở màn hình thứ 2, cánh tay robot trên màn hình thứ 1 lập tức chuyển động theo. Khi bấm *Mô phỏng / Tạm dừng*, đồ thị sóng tiếp tục cập nhật mượt mà.
4. Muốn thu về cửa sổ chính: Chỉ cần đóng cửa sổ rời hoặc bấm nút *"Gắn lại Cửa Sổ Chính"*.

### 4.2. Khảo sát 5 Tab Tín hiệu Chuyên sâu
Hộp thoại Dao động ký cung cấp 5 tab chuyên dụng:

| Tab Chức năng | Các Tín hiệu Trực quan hóa | Ứng dụng & Ý nghĩa Khoa học |
| :--- | :--- | :--- |
| **1. Động cơ & Dòng điện** | - Dòng điện pha Stator $I_q(t)$ [A]<br>- Tốc độ cơ học Rô-to [RPM]<br>- Công suất điện tiêu thụ $P_{\text{elec}}(t)$ [W] | Quan sát bước nhảy dòng điện khi mang tải $3.5\,\text{kg}$. Đánh giá headroom nhiệt liên tục so với dòng định mức $I_r$. |
| **2. Biến tần & Bus DC** | - Điện áp Bus DC dùng chung $V_{dc}(t)$ [V]<br>- Công suất tổng Inverter & Xả hãm [W]<br>- Nhiệt độ mối nối bán dẫn $T_j(t)$ [$^\circ\text{C}$] | Kiểm tra sụt áp động của nguồn SMPS ($47.5\,\text{V}$) khi tải nặng và dâng áp ($48.6\,\text{V}$) khi hãm tái sinh. Giám sát an toàn nhiệt IGBT. |
| **3. Mô-men Khớp** | - Mô-men điều khiển thực tế $\tau_{\text{act}}(t)$ [$\text{N}\cdot\text{m}$]<br>- Thành phần trọng lực $g(q)$ [$\text{N}\cdot\text{m}$]<br>- Quán tính gia tốc $M(q)\ddot{q}$ [$\text{N}\cdot\text{m}$] | Phân rã động lực học RNE. Phân tích ảnh hưởng của quán tính rotor quy đổi $N^2 J_m$ lớn gấp $1,580\times$ quán tính khâu trần. |
| **4. Động học** | - Góc quay khớp $q_i(t)$ [$^\circ$]<br>- Vận tốc góc $\dot{q}_i(t)$ [$^\circ/\text{s}$]<br>- Gia tốc góc $\ddot{q}_i(t)$ [$^\circ/\text{s}^2$] | Đánh giá độ trơn quỹ đạo, phát hiện hiện tượng quá gia tốc hoặc vi phạm giới hạn vận tốc góc của từng khớp. |
| **5. Sai số Bám Quỹ đạo** | - Sai số vị trí góc $e_i(t) = q_{d,i} - q_i$ [$^\circ$]<br>- Mặt trượt suy rộng $s_i(t) = \dot{e}_i + \lambda e_i$ | Đánh giá sai số võng tĩnh (*droop*) của bộ điều khiển Gravity-PD vs khả năng bù sai số triệt để của NPID và LADRC. |

---

## 5. CÁC CÔNG CỤ PHÒNG THÍ NGHIỆM ẢO & XUẤT BÁO CÁO (VIRTUAL LAB & TOOLS)

### 5.1. D-H Interactive Quiz (Kiểm tra gán trục D-H tự động)
- Bấm nút icon **Mũ Cử Nhân (GraduationCap)** trên Top Ribbon.
- Hệ thống sẽ ẩn bảng D-H chuẩn và yêu cầu người dùng xác định 4 tham số $\theta_i, d_i, a_i, \alpha_i$ cho từng khớp dựa trên quan sát hệ trục 3D trên màn hình.
- Chức năng chấm điểm tự động, chỉ ra vị trí sai sót theo từng quy tắc D-H kinh điển (trục $z_i$ trùng trục quay, trục $x_i$ vuông góc với cả $z_{i-1}$ và $z_i$).

### 5.2. Virtual 3D Caliper (Thước đo kích thước không gian)
- Bấm nút icon **Thước Kẻ (Ruler)** trên Top Ribbon.
- Bật công cụ thước đo 3D: Nhấp chuột chọn 2 điểm bất kỳ trên thân robot hoặc môi trường làm việc.
- Hệ thống hiển thị đường gióng đo kích thước kèm khoảng cách Euclid tuyệt đối (mm) và độ lệch hình chiếu $(\Delta X, \Delta Y, \Delta Z)$, hỗ trợ việc đo kiểm cơ khí và kiểm tra vùng va chạm.

### 5.3. Code Exporter (Xuất code đa nền tảng)
- Bấm nút **Code** trên Top Ribbon.
- Cho phép sinh mã nguồn hoàn chỉnh tự động để chạy trên các nền tảng khác:
  - **Python (NumPy / SymPy / Matplotlib):** Tự động tạo script tính động học thuận ma trận $4\times 4$ và vẽ đồ thị.
  - **C++ (Eigen / Pinocchio):** Mã nguồn tối ưu hóa hiệu năng cao cho hệ thống nhúng.
  - **MATLAB (Robotics System Toolbox):** Tệp script `.m` tạo đối tượng `rigidBodyTree`.
  - **ROS 2 URDF XML:** Tệp mô tả hình học và động học tay máy để nạp trực tiếp vào RViz và Gazebo.

### 5.4. Academic Report & Snapshot DPI (Xuất báo cáo LaTeX & Ảnh xuất bản)
- **Snapshot DPI (icon Camera):** Chụp ảnh khung nhìn 3D với độ phân giải tùy chọn ($96\,\text{DPI}$ màn hình, $150\,\text{DPI}$ tài liệu, $300\,\text{DPI}$ bài báo khoa học, hoặc $600\,\text{DPI}$ in ấn áp phích khổ lớn). Hỗ trợ tách nền trong suốt PNG.
- **Academic Report (icon FileText):** Tạo báo cáo kỹ thuật hoàn chỉnh gồm bảng tham số D-H, giới hạn hành trình, tensor quán tính và mã nguồn $\text{\LaTeX}$ định dạng IEEE Transactions sẵn sàng sao chép vào luận văn hoặc bài báo.

---

## 6. HƯỚNG DẪN THỰC HÀNH TỪNG BƯỚC (STEP-BY-STEP TUTORIALS)

### Bài 1: Gán hệ trục D-H và kiểm tra ma trận chuyển đổi trên PUMA 560
1. Tại Top Ribbon, chọn mô hình **Puma 560**.
2. Chuyển sang chế độ **Jogging & FK**.
3. Bật tùy chọn **Frames (Khung tọa độ)** ở góc dưới bên trái để hiện các trục $\{x_i, y_i, z_i\}$:
   - Trục $Z$ hiển thị màu **Xanh lam**.
   - Trục $X$ hiển thị màu **Đỏ**.
   - Trục $Y$ hiển thị màu **Xanh lá**.
4. Xoay thử khớp $q_1 = 45^\circ$, $q_2 = 30^\circ$, $q_3 = -45^\circ$.
5. Mở Left Sidebar, xem ma trận biến đổi thuần nhất $T_0^6$. Kiểm tra tọa độ điểm cuối có khớp với công thức giải tích.

### Bài 2: Thiết kế chu trình Pick-and-Place bằng đa thức bậc 3 và bậc 5
1. Chuyển sang chế độ **Trajectory Studio**.
2. Tạo 4 điểm Waypoint liên tiếp:
   - $WP_1$: Tư thế chờ $[0, 30, -45, 0, 30, 0]^\circ$, thời gian $1.5\,\text{s}$.
   - $WP_2$: Tư thế gắp vật $[-35, 55, -20, -20, 50, 10]^\circ$, thời gian $2.0\,\text{s}$.
   - $WP_3$: Tư thế nâng cao $[0, 25, -60, 0, 35, 0]^\circ$, thời gian $1.8\,\text{s}$.
   - $WP_4$: Tư thế đặt vật $[45, 50, -25, 20, 45, -15]^\circ$, thời gian $2.2\,\text{s}$.
3. Mở rộng Bottom Dock, chọn tab **Kinematic Curves (q, v, a)**.
4. Lần lượt đổi giữa **Cubic** và **Quintic**:
   - Quan sát đường gia tốc $\ddot{q}(t)$: Trong Cubic, gia tốc bị gãy khúc tại các điểm Waypoint; trong Quintic, gia tốc nối tiếp hình sin mềm mượt, giúp kéo dài tuổi thọ hộp số và không gây rung lắc cho robot.

### Bài 3: So sánh chất lượng các bộ điều khiển CTC, NPID và LADRC khi có tải động
1. Chuyển sang chế độ **Dynamics Lab**.
2. Thiết lập tải trọng động: End-Effector Payload $= 3.5\,\text{kg}$ kích hoạt từ $t = 3.5\,\text{s}$ đến $t = 7.5\,\text{s}$.
3. Tại Right Inspector, mục **Controller Strategy**:
   - Thử nghiệm lần 1: Chọn **Computed Torque Control (CTC)**. Bấm *Mô phỏng*. Mở tab sai số $e(t)$ để thấy khi tải $3.5\,\text{kg}$ xuất hiện, do sai lệch mô hình ma trận khối lượng danh định, sai số bám bị trượt nhẹ.
   - Thử nghiệm lần 2: Chọn **Linear ADRC (LESO bậc 3)**. Bấm *Mô phỏng*. Quan sát sai số bám quỹ đạo: Bộ quan sát trạng thái mở rộng lập tức ước lượng và triệt tiêu thành phần gia trọng của vật nặng, sai số bám gần như phẳng lì quanh trục $0$.

### Bài 4: Giám sát sụt áp Bus DC và dòng điện Stator trên hai màn hình
1. Bấm nút **"Scope Pop-out"** để đưa toàn bộ đồ thị dao động ký sang màn hình phụ thứ hai.
2. Trên màn hình phụ, chuyển sang tab **Biến Tần & Bus DC**.
3. Tại màn hình chính, bấm nút **Play / Simulate**:
   - Quan sát cánh tay robot 3D nhấc vật nặng lên cao.
   - Trên màn hình phụ, đồng thời quan sát điện áp bus DC dột giảm từ $48.0\,\text{V}$ xuống $47.5\,\text{V}$ do nhu cầu công suất đột biến của động cơ khớp vai.
   - Khi cánh tay hạ vật xuống và giảm tốc nhanh, năng lượng hãm tái sinh bơm ngược lại bus DC làm điện áp dâng lên $48.6\,\text{V}$.

---

## 7. BẢNG PHÍM TẮT & XỬ LÝ SỰ CỐ THƯỜNG GẶP

### 7.1. Bảng Phím tắt Nhanh (Keyboard Shortcuts)
| Phím tắt | Chức năng tương ứng |
| :--- | :--- |
| `Space` (Phím cách) | Bật / Tạm dừng phát quỹ đạo hoặc chạy mô phỏng vật lý |
| `Ctrl + B` / `Cmd + B` | Đóng / Mở thanh công cụ bên trái (Left Sidebar) |
| `Ctrl + I` / `Cmd + I` | Đóng / Mở thanh thuộc tính bên phải (Right Inspector) |
| `Esc` | Đóng nhanh tất cả các hộp thoại đang mở |
| `Chuột trái + Rê chuột` | Xoay góc nhìn Camera 3D (Orbit Rotate) |
| `Chuột phải + Rê chuột` | Tịnh tiến góc nhìn Camera 3D (Pan) |
| `Con lăn chuột (Scroll)` | Thu phóng Camera 3D (Zoom in / Zoom out) |

### 7.2. Xử lý Sự cố Thường gặp (Troubleshooting)
1. **Trình duyệt chặn mở Cửa sổ rời (Pop-out Window):**
   - *Nguyên nhân:* Tính năng chặn cửa sổ bật lên (Pop-up Blocker) mặc định của trình duyệt Chrome/Edge/Firefox.
   - *Khắc phục:* Nhìn vào thanh địa chỉ URL của trình duyệt, bấm vào biểu tượng cửa sổ có dấu chéo đỏ $\to$ chọn *"Luôn cho phép cửa sổ bật lên từ trang web này"* $\to$ bấm lại nút Pop-out.
2. **Khung nhìn 3D bị giật hoặc tốc độ khung hình (FPS) thấp:**
   - *Khắc phục:* Mở cài đặt đồ họa bằng nút icon **SlidersHorizontal** trên Top Ribbon $\to$ tắt bớt tính năng đổ bóng phức tạp (*Shadows*) hoặc giảm bớt số lượng mẫu Monte Carlo của đám mây không gian làm việc.
3. **Mô phỏng RK4 bị phân kỳ hoặc báo lỗi mô-men quá lớn:**
   - *Khắc phục:* Kiểm tra xem bước thời gian $dt$ có bị đặt quá lớn hay không (khuyến nghị duy trì $dt = 0.002\,\text{s}$ tức $500\,\text{Hz}$). Kiểm tra các độ lợi $K_p, K_d$ tránh đặt quá cao vượt ngưỡng tần số cắt tự nhiên của động cơ.

---
*Tài liệu được phát hành và bảo trì bởi Bộ môn Kỹ thuật Điều khiển & Tự động hóa, Khoa Điện - Điện Tử, Đại học Tôn Đức Thắng.*
