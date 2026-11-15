# Topic 2: Model Predictive Contouring Control with Control Barrier Functions (MPCC-CBF)

## 1. Tóm Tắt Ý Tưởng Nghiên Cứu
Xây dựng bộ điều khiển dự báo mô hình tối ưu đường viền (Model Predictive Contouring Control - MPCC) kết hợp hàm rào cản an toàn (Control Barrier Functions - CBF) cho phép xe tự hành AMR vừa tối đa hóa tiến độ di chuyển vừa đảm bảo không bao giờ vi phạm vùng an toàn với chướng ngại vật động.

## 2. Mô Hình Toán Học
Tối ưu hóa đa mục tiêu với biến tiến độ ảo $\theta(t)$:
$$\min_{u, v_\theta} \sum_{k=0}^{N-1} \left( \|e_k^c\|_{Q_c}^2 + \|e_k^l\|_{Q_l}^2 - q_\theta v_{\theta, k} + \|u_k\|_R^2 + \|\Delta u_k\|_{R_d}^2 \right) + V_N(x_N)$$

Ràng buộc CBF cho từng vật cản động $j$:
$$h_j(p_k) = \|p_k - p_{obs, j, k}\|^2 - d_{safe}^2 \ge 0$$
$$\Delta h_j(p_k, u_k) \ge -\gamma h_j(p_k)$$

## 3. Kế Hoạch Triển Khai
- **Phase 1:** Rời rạc hóa bài toán tối ưu phi tuyến sang Quadratic Programming (QP) hoặc Sequential Quadratic Programming (SQP) sử dụng CasADi / qpOASES.
- **Phase 2:** Kiểm chứng thời gian giải trên CPU Intel i5/i7 và bo mạch nhúng ARM Cortex.
- **Phase 3:** Thử nghiệm trong môi trường kho hẹp có công nhân và xe nâng di chuyển cắt mặt.
- **Phase 4:** Hoàn thiện bài báo gửi Automatica hoặc IEEE RA-L.
