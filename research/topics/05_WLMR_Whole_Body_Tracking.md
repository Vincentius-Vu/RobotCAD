# Topic 5: Whole-Body Control & Trajectory Tracking for Wheel-Legged Mobile Robots (WLMR)

## 1. Tóm Tắt Ý Tưởng Nghiên Cứu
Thiết kế bộ điều khiển toàn thân phân tầng (Hierarchical Whole-Body Control - WBC) kết hợp bộ điều khiển dự báo mô hình phi tuyến (NMPC) cho robot di động chân-bánh (Wheel-Legged Mobile Robot - WLMR), vừa bám quỹ đạo phẳng 2D vừa giữ cân bằng con lắc ngược và chủ động thay đổi chiều cao trọng tâm.

## 2. Mô Hình Toán Học
Hệ động lực học phi tuyến có ràng buộc tiếp xúc mặt đất:
$$M(q)\ddot{q} + C(q, \dot{q})\dot{q} + G(q) = S^T \tau + J_c(q)^T \lambda$$
Phân tầng nhiệm vụ bằng Hierarchical Quadratic Programming (HQP):
- **Cấp 1 (Primary Task):** Cân bằng góc pitch $\theta_{pitch} \to 0$ và giới hạn nón ma sát tiếp xúc đất $|\lambda_x| \le \mu \lambda_z, \lambda_z > 0$.
- **Cấp 2 (Secondary Task):** Điều chỉnh tư thế khớp gối (chiều cao $z_{COM}$ và góc roll $\phi_{roll}$ khi vào cua).
- **Cấp 3 (Tracking Task):** Bám vận tốc dài $v_d(t)$ và vận tốc góc $\omega_d(t)$ của quỹ đạo logistics.

## 3. Kế Hoạch Triển Khai
- **Phase 1:** Hoàn thiện mô hình động lực học ký hiệu (Symbolic Equations of Motion) trong Python SymPy / Pinocchio từ file CAD Onshape.
- **Phase 2:** Mô phỏng vật lý đa vật thể (CoppeliaSim / MuJoCo) kiểm chứng khả năng vượt bậc thang và cua gấp.
- **Phase 3:** Đồng bộ lên 3D Web Visualizer.
- **Phase 4:** Xuất bản bài báo chất lượng cao trên IEEE Transactions on Robotics (T-RO).
