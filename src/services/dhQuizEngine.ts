import { RobotModel } from '../types/robot';
import { DHQuizQuestion, DHQuizResult } from '../types/lab';

export class DHQuizEngine {
  /**
   * Generates a comprehensive interactive D-H quiz tailored to the given robot
   */
  public static generateQuizForRobot(robot: RobotModel, language: 'en' | 'vi' = 'vi'): DHQuizQuestion[] {
    const isVi = language === 'vi';
    const questions: DHQuizQuestion[] = [];

    // Question 1: Fundamental Rule 1 (Orthogonality)
    questions.push({
      id: 'rule-orthogonality',
      jointIndex: 1,
      title: isVi ? 'Quy tắc 1 của chuẩn Denavit-Hartenberg (Tính vuông góc)' : 'Denavit-Hartenberg Rule 1 (Orthogonality Requirement)',
      prompt: isVi ? `Theo chuẩn Denavit-Hartenberg (D-H chuẩn), trục x_i của khâu thứ i bắt buộc phải thỏa mãn quan hệ hình học nào với trục khớp chuyển động z_{i-1}?` : `According to standard Denavit-Hartenberg (D-H) convention, what geometric constraint must link axis x_i satisfy relative to motion axis z_{i-1}?`,
      currentJointDH: { ...robot.joints[0] },
      rule1Tested: isVi ? 'x_i ⊥ z_{i-1} (Trục x_i luôn luôn vuông góc với trục z_{i-1})' : 'x_i ⊥ z_{i-1} (Axis x_i must be strictly orthogonal to axis z_{i-1})',
      rule2Tested: isVi ? 'x_i cắt z_{i-1}' : 'x_i intersects z_{i-1}',
      options: [
        {
          id: 'opt-1a',
          text: isVi ? 'Trục x_i phải luôn luôn vuông góc với trục z_{i-1} (x_i ⊥ z_{i-1})' : 'Axis x_i must be perpendicular to axis z_{i-1} (x_i ⊥ z_{i-1})',
          isCorrect: true,
          explanation: isVi ? 'Chính xác! Trục x_i được định nghĩa theo hướng đường pháp tuyến chung giữa trục z_{i-1} và z_i, do đó x_i luôn luôn vuông góc với z_{i-1}.' : 'Correct! Axis x_i is defined along the common normal between z_{i-1} and z_i, and is therefore always orthogonal to z_{i-1}.',
        },
        {
          id: 'opt-1b',
          text: isVi ? 'Trục x_i phải song song với trục z_{i-1} (x_i // z_{i-1})' : 'Axis x_i must be parallel to axis z_{i-1} (x_i // z_{i-1})',
          isCorrect: false,
          explanation: isVi ? 'Không đúng. Nếu x_i // z_{i-1} thì không thể tạo thành hệ trục tọa độ Đề-các thuận vuông góc ba chiều tại gốc O_i.' : 'Incorrect. Parallel x_i and z_{i-1} cannot form a standard right-handed orthogonal Cartesian frame at origin O_i.',
        },
        {
          id: 'opt-1c',
          text: isVi ? 'Trục x_i có thể tạo với z_{i-1} bất kỳ góc nào tùy chọn' : 'Axis x_i can form any arbitrary angle with z_{i-1}',
          isCorrect: false,
          explanation: isVi ? 'Không đúng. Chuẩn D-H quy định nghiêm ngặt trục x_i phải là pháp tuyến chung, nghĩa là vuông góc với z_{i-1}.' : 'Incorrect. Standard D-H strictly requires x_i to be the common normal, hence perpendicular to z_{i-1}.',
        },
      ],
      explanation: isVi ? 'Quy tắc vàng 1 của D-H: Trục x_i luôn vuông góc với trục z_{i-1} (x_i ⊥ z_{i-1}).' : 'D-H Golden Rule 1: Axis x_i must be strictly perpendicular to axis z_{i-1} (x_i ⊥ z_{i-1}).',
    });

    // Question 2: Fundamental Rule 2 (Intersection)
    questions.push({
      id: 'rule-intersection',
      jointIndex: 1,
      title: isVi ? 'Quy tắc 2 của chuẩn Denavit-Hartenberg (Tính cắt nhau)' : 'Denavit-Hartenberg Rule 2 (Intersection Requirement)',
      prompt: isVi ? `Khi hai trục z_{i-1} và z_i cắt nhau trong không gian (như trong cấu trúc cổ tay cầu Spherical Wrist), gốc tọa độ O_i và trục x_i được xác định như thế nào?` : `When axes z_{i-1} and z_i intersect in space (e.g., in a spherical wrist architecture), how are the origin O_i and axis x_i defined?`,
      currentJointDH: { ...robot.joints[robot.joints.length > 3 ? 3 : 0] },
      rule1Tested: 'x_i ⊥ z_{i-1}',
      rule2Tested: isVi ? 'x_i cắt z_{i-1} tại giao điểm của z_{i-1} và z_i, với chiều x_i = ±(z_{i-1} × z_i)' : 'x_i intersects z_{i-1} at the intersection point, oriented along ±(z_{i-1} × z_i)',
      options: [
        {
          id: 'opt-2a',
          text: isVi ? 'Gốc O_i đặt tại giao điểm của hai trục, trục x_i vuông góc với mặt phẳng chứa (z_{i-1}, z_i) theo tích có hướng' : 'Origin O_i is located at the intersection point; axis x_i is normal to the plane containing (z_{i-1}, z_i)',
          isCorrect: true,
          explanation: isVi ? 'Chính xác! Khi z_{i-1} và z_i cắt nhau, khoảng cách pháp tuyến chung a_i = 0, gốc O_i đặt tại giao điểm và x_i vuông góc với cả hai theo tích có hướng z_{i-1} × z_i.' : 'Correct! When z_{i-1} and z_i intersect, normal offset a_i = 0, origin O_i lies at the intersection, and x_i is directed along the cross-product z_{i-1} × z_i.',
        },
        {
          id: 'opt-2b',
          text: isVi ? 'Gốc O_i phải đặt tại tâm khối lượng của khâu tiếp theo' : 'Origin O_i must be placed at the center of mass of the subsequent link',
          isCorrect: false,
          explanation: isVi ? 'Không đúng. Vị trí gốc O_i trong động học D-H thuần túy được quyết định bởi giao điểm hình học của các trục khớp, không phụ thuộc vào khối tâm.' : 'Incorrect. Origin O_i in pure D-H kinematics is determined strictly by joint axis geometry, independent of center of mass.',
        },
        {
          id: 'opt-2c',
          text: isVi ? 'Khoảng cách giữa hai trục a_i luôn lớn hơn 0' : 'The link distance a_i must always be strictly greater than 0',
          isCorrect: false,
          explanation: isVi ? 'Không đúng. Khi hai trục cắt nhau thì khoảng cách giữa chúng a_i = 0.' : 'Incorrect. When two axes intersect, their normal distance a_i is identically zero.',
        },
      ],
      explanation: isVi ? 'Khi hai trục khớp z_{i-1} và z_i cắt nhau, khoảng cách a_i = 0 và gốc O_i nằm ngay tại giao điểm.' : 'When axes z_{i-1} and z_i intersect, link length a_i = 0 and origin O_i is situated precisely at the intersection point.',
    });

    // Question 3: Link Parameter Verification for Joint 2 / Joint 3
    if (robot.joints.length >= 2) {
      const j2 = robot.joints[1];
      questions.push({
        id: `joint-2-params`,
        jointIndex: 2,
        title: isVi ? `Xác định ý nghĩa vật lý của tham số D-H tại Khớp 2 trên ${robot.name}` : `Physical Meaning of D-H Parameters at Joint 2 on ${robot.name}`,
        prompt: isVi ? `Trên robot ${robot.name}, khâu 2 (cánh tay trên/shoulder link) có chiều dài danh định a_2 = ${(j2.a).toFixed(1)} mm và góc xoắn alpha_2 = ${j2.alphaDeg}°. Ý nghĩa của góc xoắn alpha_2 là gì?` : `On manipulator ${robot.name}, link 2 (shoulder/upper-arm) has nominal link length a_2 = ${(j2.a).toFixed(1)} mm and link twist alpha_2 = ${j2.alphaDeg}°. What is the physical definition of alpha_2?`,
        currentJointDH: { ...j2 },
        rule1Tested: isVi ? 'alpha_2 là góc quay quanh trục x_2 từ z_1 đến z_2' : 'alpha_2 is rotation angle about axis x_2 from z_1 to z_2',
        rule2Tested: isVi ? 'Quy tắc bàn tay phải quanh trục x_2' : 'Right-hand rule about axis x_2',
        options: [
          {
            id: 'opt-3a',
            text: isVi ? 'Góc quay quanh trục x_2 từ trục z_1 đến trục z_2 theo quy tắc bàn tay phải' : 'Rotation angle about axis x_2 from axis z_1 to axis z_2 via right-hand rule',
            isCorrect: true,
            explanation: isVi ? `Chính xác! Tham số xoắn alpha_i được đo bằng góc quay quanh trục x_i để đưa trục z_{i-1} trùng phương chiều với trục z_i. Với robot này, alpha_2 = ${j2.alphaDeg}°.` : `Correct! Link twist alpha_i is the angle rotated about x_i to align axis z_{i-1} with axis z_i. For this robot, alpha_2 = ${j2.alphaDeg}°.`,
          },
          {
            id: 'opt-3b',
            text: isVi ? 'Góc quay quanh trục z_1 từ x_1 đến x_2' : 'Rotation angle about axis z_1 from x_1 to x_2',
            isCorrect: false,
            explanation: isVi ? 'Không đúng. Đó là định nghĩa của biến khớp theta_2, không phải góc xoắn alpha_2.' : 'Incorrect. That is the definition of joint variable theta_2, not link twist alpha_2.',
          },
          {
            id: 'opt-3c',
            text: isVi ? 'Khoảng cách tịnh tiến dọc theo trục x_2' : 'Translational displacement along axis x_2',
            isCorrect: false,
            explanation: isVi ? 'Không đúng. Khoảng cách tịnh tiến dọc theo x_2 là tham số chiều dài khâu a_2 (đo bằng mm/m), không phải góc.' : 'Incorrect. Translational displacement along x_2 is link length a_2 (in mm/m), not an angle.',
          },
        ],
        explanation: isVi ? 'Tham số alpha_i luôn là góc quay quanh trục x_i để làm cho trục z_{i-1} trùng hướng với trục z_i.' : 'Link twist alpha_i is always the rotation about x_i required to align axis z_{i-1} with axis z_i.',
      });
    }

    // Question 4: Offset parameter d_i
    if (robot.joints.length >= 1) {
      const j1 = robot.joints[0];
      questions.push({
        id: `joint-1-offset`,
        jointIndex: 1,
        title: isVi ? `Phân biệt tham số tịnh tiến d_1 và biến khớp theta_1 trên ${robot.name}` : `Distinguishing Offset d_1 vs Joint Variable theta_1 on ${robot.name}`,
        prompt: isVi ? `Khớp 1 của ${robot.name} là khớp quay (Revolute Joint). Tham số nào là biến số thay đổi theo thời gian và tham số nào là hằng số kết cấu?` : `Joint 1 of ${robot.name} is a revolute joint. Which parameter is the time-varying state variable and which is the constant structural parameter?`,
        currentJointDH: { ...j1 },
        rule1Tested: isVi ? 'Khớp quay: theta_1 là biến, d_1 là hằng số' : 'Revolute joint: theta_1 is variable, d_1 is constant',
        rule2Tested: 'Khoảng cách d_1 = ' + j1.d.toFixed(1) + ' mm',
        options: [
          {
            id: 'opt-4a',
            text: isVi ? `theta_1 là biến điều khiển quay q_1(t); d_1 = ${(j1.d).toFixed(1)} mm là hằng số chiều cao bệ đỡ` : `theta_1 is the rotational variable q_1(t); d_1 = ${(j1.d).toFixed(1)} mm is constant base pedestal height`,
            isCorrect: true,
            explanation: isVi ? `Chính xác! Đối với khớp quay, góc theta_i là biến khớp điều khiển được. Khoảng cách tịnh tiến d_i = ${(j1.d).toFixed(1)} mm là hằng số hình học của bệ robot.` : `Correct! For a revolute joint, angle theta_i is the controlled joint variable. Offset d_i = ${(j1.d).toFixed(1)} mm is a constant geometric structural offset.`,
          },
          {
            id: 'opt-4b',
            text: isVi ? 'd_1 là biến tịnh tiến di chuyển lên xuống; theta_1 là góc cố định' : 'd_1 is prismatic variable; theta_1 is a fixed constant angle',
            isCorrect: false,
            explanation: isVi ? 'Không đúng. Robot này sử dụng 6 khớp quay, không có khớp tịnh tiến lăng trụ (prismatic).' : 'Incorrect. This manipulator employs all revolute joints with zero prismatic stages.',
          },
          {
            id: 'opt-4c',
            text: isVi ? 'Cả theta_1 và d_1 đều là biến tự do thay đổi đồng thời trong quá trình chuyển động' : 'Both theta_1 and d_1 are independent degrees of freedom moving simultaneously',
            isCorrect: false,
            explanation: isVi ? 'Không đúng. Mỗi khớp tiêu chuẩn chỉ có duy nhất 1 bậc tự do (hoặc theta_i đối với khớp quay, hoặc d_i đối với khớp lăng trụ).' : 'Incorrect. Each standard 1-DOF joint permits either variable theta_i (revolute) or variable d_i (prismatic), never both simultaneously.',
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
