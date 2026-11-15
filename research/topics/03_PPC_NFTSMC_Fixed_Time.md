# Topic 3: Prescribed Performance Control & Non-Singular Fast Terminal Sliding Mode

## 1. Tóm Tắt Ý Tưởng Nghiên Cứu
Ứng dụng Prescribed Performance Control (PPC) kết hợp Non-Singular Fast Terminal Sliding Mode Control (NFTSMC) để triệt tiêu hiện tượng vọt lố (overshoot) và đảm bảo sai số vị trí hội tụ về phạm vi milimet trong một khoảng thời gian cố định độc lập với sai số ban đầu.

## 2. Mô Hình Toán Học
Hàm bao hiệu năng:
$$\rho(t) = (\rho_0 - \rho_\infty) e^{-a t} + \rho_\infty$$
Biến đổi sai số:
$$e(t) = \rho(t) S(\varepsilon(t))$$
Mặt trượt NFTSMC:
$$s = \dot{\varepsilon} + \alpha_1 \varepsilon + \beta_1 \varepsilon^{p/q}$$
Với $1 < p/q < 2$, đảm bảo không có điểm kỳ dị đạo hàm khi $\varepsilon \to 0$.

Luật điều khiển Super-Twisting liên tục:
$$u = -k_1 |s|^{1/2} \text{sign}(s) + v, \quad \dot{v} = -k_2 \text{sign}(s)$$

## 3. Kế Hoạch Triển Khai
- **Phase 1:** Chứng minh tính ổn định Lyapunov cho toàn bộ hệ vòng kín $V(s)$.
- **Phase 2:** Mô phỏng kịch bản cập trạm sạc tự động (Auto-docking station) yêu cầu độ chính xác $< 3\,\text{mm}$.
- **Phase 3:** Viết bài báo gửi Control Engineering Practice / IEEE Transactions on Automatic Control.
