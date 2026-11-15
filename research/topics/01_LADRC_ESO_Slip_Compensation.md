# Topic 1: Linear Active Disturbance Rejection Control (LADRC-LESO) for Mobile Robot Slip Compensation

## 1. Tóm Tắt Ý Tưởng Nghiên Cứu
Ứng dụng kỹ thuật Kháng Nhiễu Chủ Động Tuyến Tính (LADRC) kết hợp Bộ Quan Sát Trạng Thái Mở Rộng Tuyến Tính (LESO) để điều khiển bám quỹ đạo cho mobile robot 2 bánh vi sai (AGV/AMR) và 4 bánh Mecanum khi vận hành trên mặt sàn trơn trượt hoặc khi tải trọng biến thiên đột ngột (bốc xếp hàng pallet).

## 2. Mô Hình Toán Học
Phương trình động lực học tổng quát:
$$\dot{v} = f_v(v, \omega, t) + b_v u_v$$
$$\dot{\omega} = f_\omega(v, \omega, t) + b_\omega u_\omega$$

LESO bậc 3 ước lượng đồng thời vận tốc và "tổng nhiễu" $f$:
$$\dot{\hat{z}} = A_o \hat{z} + B_o u + L (y - C_o \hat{z})$$

Đặc trưng cực của bộ quan sát đặt theo băng thông Gao:
$$(s + \omega_o)^3 = s^3 + 3\omega_o s^2 + 3\omega_o^2 s + \omega_o^3$$
Do đó:
$$\beta_1 = 3\omega_o, \quad \beta_2 = 3\omega_o^2, \quad \beta_3 = \omega_o^3$$

Luật điều khiển bù trực tiếp:
$$u = \frac{k_p (v_d - \hat{z}_1) - \hat{z}_3}{b_0}$$

## 3. Kế Hoạch Triển Khai
- **Phase 1:** Viết script mô phỏng động lực học trượt lết bánh xe (Dugoff hoặc Pacejka Magic Formula tire model) trong Python.
- **Phase 2:** So sánh đối chuẩn (Benchmark) giữa LADRC với PID truyền thống và Sliding Mode Control (SMC) trên 3 kịch bản:
  1. Xe đi qua vũng dầu trơn (hệ số ma sát $\mu$ giảm từ 0.8 xuống 0.2 đột ngột).
  2. Bốc hàng $100\,\text{kg}$ tại điểm Waypoint làm khối lượng tăng $150\%$.
  3. Bám đường cong chữ S tốc độ cao.
- **Phase 3:** Tích hợp code TypeScript vào tab R&D Lab của Web App.
- **Phase 4:** Viết bản thảo bài báo gửi IEEE T-IE / T-MECH.
