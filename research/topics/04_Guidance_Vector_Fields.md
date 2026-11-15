# Topic 4: Guidance Vector Fields (GVF) for Singularity-Free Navigation

## 1. Tóm Tắt Ý Tưởng Nghiên Cứu
Xây dựng giải thuật bám đường hình học bằng Trường Vector Dẫn Hướng (Guidance Vector Field - GVF) phi kỳ dị toàn cục, giải quyết triệt để các nhược điểm cua rộng, mất ổn định khi lệch góc $\ge 90^\circ$ của các phương pháp hình học truyền thống (Pure Pursuit, Stanley).

## 2. Mô Hình Toán Học
Biểu diễn đường cong 2D mong muốn $\Gamma$:
$$\phi(x, y) = 0$$
Vector tiếp tuyến và vector pháp tuyến:
$$\tau(p) = \begin{bmatrix} 0 & 1 \\ -1 & 0 \end{bmatrix} \nabla \phi(p), \quad n(p) = \nabla \phi(p)$$
Trường vector điều khiển:
$$\chi(p) = \tau(p) - k_e \phi(p) n(p)$$
Góc lái mong muốn:
$$\theta_d = \text{atan2}(\chi_y, \chi_x)$$
Vận tốc góc điều khiển:
$$\omega = \dot{\theta}_d - k_\theta (\theta - \theta_d)$$

## 3. Kế Hoạch Triển Khai
- **Phase 1:** Viết bộ tạo quỹ đạo mức không (level set generator) cho các đường spline đa đoạn.
- **Phase 2:** So sánh đối chuẩn trực tiếp với Pure Pursuit và Stanley trên cùng các tập quỹ đạo zic-zac và vòng cua tròn.
- **Phase 3:** Tích hợp trực tiếp vào module navigation của nền tảng web visualizer.
- **Phase 4:** Gửi bài báo IEEE RA-L hoặc IEEE TCST.
