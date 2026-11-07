export interface DHQuizQuestion {
  id: string;
  jointIndex: number;
  title: string;
  prompt: string;
  currentJointDH: {
    thetaOffsetDeg: number;
    d: number;
    a: number;
    alphaDeg: number;
    qMinDeg: number;
    qMaxDeg: number;
  };
  options: {
    id: string;
    text: string;
    isCorrect: boolean;
    explanation: string;
  }[];
  explanation: string;
  rule1Tested: string; // Xi perpendicular to Zi-1
  rule2Tested: string; // Xi intersects Zi-1
}

export interface DHQuizSubmission {
  questionId: string;
  selectedOptionId: string;
}

export interface DHQuizResult {
  totalQuestions: number;
  correctAnswers: number;
  scorePercentage: number;
  passed: boolean;
  detailedResults: {
    questionId: string;
    isCorrect: boolean;
    userSelectedText: string;
    correctText: string;
    pedagogicalFeedback: string;
  }[];
}

export interface CaliperMeasurement {
  pointA: { name: string; x: number; y: number; z: number };
  pointB: { name: string; x: number; y: number; z: number };
  deltaX: number;
  deltaY: number;
  deltaZ: number;
  distance: number;
}
