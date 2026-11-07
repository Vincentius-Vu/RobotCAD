import { RobotModel } from '../types/robot';
import { DHQuizQuestion, DHQuizResult } from '../types/lab';

export class DHQuizEngine {
  /**
   * Generates a comprehensive interactive D-H quiz tailored to the given robot
   */
  public static generateQuizForRobot(robot: RobotModel): DHQuizQuestion[] {
    const questions: DHQuizQuestion[] = [];

    // Question 1: Fundamental Rule 1 (Orthogonality)
    questions.push({
      id: 'rule-orthogonality',
      jointIndex: 1,
      title: 'Quy tắc 1 của chuẩn Denavit-Hartenberg (Tính vuông góc)',
      prompt: `Theo chuẩn Denavit-Hartenberg (D-H chuẩn), trục x_i của khâu thứ i bắt buộc phải thỏa mãn quan hệ hình học nào với trục khớp chuyển động z_{i-1}?`,
      currentJointDH: { ...robot.joints[0] },
      rule1Tested: 'x_i ⊥ z_{i-1} (Trục x_i luôn luôn vuông góc với trục z_{i-1})',
      rule2Tested: 'x_i cắt z_{i-1}',
      options: [
        {
          id: 'opt-1a',
          text: 'Trục x_i phải luôn luôn vuông góc với trục z_{i-1} (x_i ⊥ z_{i-1})',
          isCorrect: true,
          explanation: 'Chính xác! Trục x_i được định nghĩa theo hướng đường pháp tuyến chung giữa trục z_{i-1} và z_i, do đó x_i luôn luôn vuông góc với z_{i-1}.',
        },
        {
          id: 'opt-1b',
          text: 'Trục x_i phải song song với trục z_{i-1} (x_i // z_{i-1})',
          isCorrect: false,
          explanation: 'Không đúng. Nếu x_i // z_{i-1} thì không thể tạo thành hệ trục tọa độ Đề-các thuận vuông góc ba chiều tại gốc O_i.',
        },
        {
          id: 'opt-1c',
          text: 'Trục x_i có thể tạo với z_{i-1} bất kỳ góc nào tùy chọn',
          isCorrect: false,
          explanation: 'Không đúng. Chuẩn D-H quy định nghiêm ngặt trục x_i phải là pháp tuyến chung, nghĩa là vuông góc với z_{i-1}.',
        },
      ],
      explanation: 'Quy tắc vàng 1 của D-H: Trục x_i luôn vuông góc với trục z_{i-1} (x_i ⊥ z_{i-1}).',
    });

    // Question 2: Fundamental Rule 2 (Intersection)
    questions.push({
      id: 'rule-intersection',
      jointIndex: 1,
      title: 'Quy tắc 2 của chuẩn Denavit-Hartenberg (Tính cắt nhau)',
      prompt: `Khi hai trục z_{i-1} và z_i cắt nhau trong không gian (như trong cấu trúc cổ tay cầu Spherical Wrist), gốc tọa độ O_i và trục x_i được xác định như thế nào?`,
      currentJointDH: { ...robot.joints[robot.joints.length > 3 ? 3 : 0] },
      rule1Tested: 'x_i ⊥ z_{i-1}',
      rule2Tested: 'x_i cắt z_{i-1} tại giao điểm của z_{i-1} và z_i, với chiều x_i = ±(z_{i-1} × z_i)',
      options: [
        {
          id: 'opt-2a',
          text: 'Gốc O_i đặt tại giao điểm của hai trục, trục x_i vuông góc với mặt phẳng chứa (z_{i-1}, z_i) theo tích có hướng',
          isCorrect: true,
          explanation: 'Chính xác! Khi z_{i-1} và z_i cắt nhau, khoảng cách pháp tuyến chung a_i = 0, gốc O_i đặt tại giao điểm và x_i vuông góc với cả hai theo tích có hướng z_{i-1} × z_i.',
        },
        {
          id: 'opt-2b',
          text: 'Gốc O_i phải đặt tại tâm khối lượng của khâu tiếp theo',
          isCorrect: false,
          explanation: 'Không đúng. Vị trí gốc O_i trong động học D-H thuần túy được quyết định bởi giao điểm hình học của các trục khớp, không phụ thuộc vào khối tâm.',
        },
        {
          id: 'opt-2c',
          text: 'Khoảng cách giữa hai trục a_i luôn lớn hơn 0',
          isCorrect: false,
          explanation: 'Không đúng. Khi hai trục cắt nhau thì khoảng cách giữa chúng a_i = 0.',
        },
      ],
      explanation: 'Khi hai trục khớp z_{i-1} và z_i cắt nhau, khoảng cách a_i = 0 và gốc O_i nằm ngay tại giao điểm.',
    });

    // Question 3: Link Parameter Verification for Joint 2 / Joint 3
    if (robot.joints.length >= 2) {
      const j2 = robot.joints[1];
      questions.push({
        id: `joint-2-params`,
        jointIndex: 2,
        title: `Xác định ý nghĩa vật lý của tham số D-H tại Khớp 2 trên ${robot.name}`,
        prompt: `Trên robot ${robot.name}, khâu 2 (cánh tay trên/shoulder link) có chiều dài danh định a_2 = ${(j2.a).toFixed(1)} mm và góc xoắn alpha_2 = ${j2.alphaDeg}°. Ý nghĩa của góc xoắn alpha_2 là gì?`,
        currentJointDH: { ...j2 },
        rule1Tested: 'alpha_2 là góc quay quanh trục x_2 từ z_1 đến z_2',
        rule2Tested: 'Quy tắc bàn tay phải quanh trục x_2',
        options: [
          {
            id: 'opt-3a',
            text: 'Góc quay quanh trục x_2 từ trục z_1 đến trục z_2 theo quy tắc bàn tay phải',
            isCorrect: true,
            explanation: `Chính xác! Tham số xoắn alpha_i được đo bằng góc quay quanh trục x_i để đưa trục z_{i-1} trùng phương chiều với trục z_i. Với robot này, alpha_2 = ${j2.alphaDeg}°.`,
          },
          {
            id: 'opt-3b',
            text: 'Góc quay quanh trục z_1 từ x_1 đến x_2',
            isCorrect: false,
            explanation: 'Không đúng. Đó là định nghĩa của biến khớp theta_2, không phải góc xoắn alpha_2.',
          },
          {
            id: 'opt-3c',
            text: 'Khoảng cách tịnh tiến dọc theo trục x_2',
            isCorrect: false,
            explanation: 'Không đúng. Khoảng cách tịnh tiến dọc theo x_2 là tham số chiều dài khâu a_2 (đo bằng mm/m), không phải góc.',
          },
        ],
        explanation: 'Tham số alpha_i luôn là góc quay quanh trục x_i để làm cho trục z_{i-1} trùng hướng với trục z_i.',
      });
    }

    // Question 4: Offset parameter d_i
    if (robot.joints.length >= 1) {
      const j1 = robot.joints[0];
      questions.push({
        id: `joint-1-offset`,
        jointIndex: 1,
        title: `Phân biệt tham số tịnh tiến d_1 và biến khớp theta_1 trên ${robot.name}`,
        prompt: `Khớp 1 của ${robot.name} là khớp quay (Revolute Joint). Tham số nào là biến số thay đổi theo thời gian và tham số nào là hằng số kết cấu?`,
        currentJointDH: { ...j1 },
        rule1Tested: 'Khớp quay: theta_1 là biến, d_1 là hằng số',
        rule2Tested: 'Khoảng cách d_1 = ' + j1.d.toFixed(1) + ' mm',
        options: [
          {
            id: 'opt-4a',
            text: `theta_1 là biến điều khiển quay q_1(t); d_1 = ${(j1.d).toFixed(1)} mm là hằng số chiều cao bệ đỡ`,
            isCorrect: true,
            explanation: `Chính xác! Đối với khớp quay, góc theta_i là biến khớp điều khiển được. Khoảng cách tịnh tiến d_i = ${(j1.d).toFixed(1)} mm là hằng số hình học của bệ robot.`,
          },
          {
            id: 'opt-4b',
            text: 'd_1 là biến tịnh tiến di chuyển lên xuống; theta_1 là góc cố định',
            isCorrect: false,
            explanation: 'Không đúng. Robot này sử dụng 6 khớp quay, không có khớp tịnh tiến lăng trụ (prismatic).',
          },
          {
            id: 'opt-4c',
            text: 'Cả theta_1 và d_1 đều là biến tự do thay đổi đồng thời trong quá trình chuyển động',
            isCorrect: false,
            explanation: 'Không đúng. Mỗi khớp tiêu chuẩn chỉ có duy nhất 1 bậc tự do (hoặc theta_i đối với khớp quay, hoặc d_i đối với khớp lăng trụ).',
          },
        ],
        explanation: 'Khớp quay 1 DOF có biến khớp là góc theta_i, còn khoảng cách d_i là hằng số cấu trúc hình học.',
      });
    }

    return questions;
  }

  /**
   * Automatically grades student submissions and produces pedagogical feedback
   */
  public static gradeQuiz(
    questions: DHQuizQuestion[],
    answers: Record<string, string>
  ): DHQuizResult {
    let correctCount = 0;
    const detailedResults = questions.map((q) => {
      const selectedId = answers[q.id];
      const selectedOption = q.options.find((o) => o.id === selectedId);
      const correctOption = q.options.find((o) => o.isCorrect)!;

      const isCorrect = selectedOption?.isCorrect ?? false;
      if (isCorrect) correctCount++;

      return {
        questionId: q.id,
        isCorrect,
        userSelectedText: selectedOption?.text || '(Chưa chọn câu trả lời)',
        correctText: correctOption.text,
        pedagogicalFeedback: selectedOption?.explanation || correctOption.explanation,
      };
    });

    const scorePercentage = Math.round((correctCount / questions.length) * 100);

    return {
      totalQuestions: questions.length,
      correctAnswers: correctCount,
      scorePercentage,
      passed: scorePercentage >= 75,
      detailedResults,
    };
  }
}
