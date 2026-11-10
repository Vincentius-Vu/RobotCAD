import { useTranslation } from '../../i18n';
import React, { useState, useMemo } from 'react';
import {
  GraduationCap,
  CheckCircle2,
  XCircle,
  HelpCircle,
  RotateCcw,
  X,
  Award,
  BookOpen,
} from 'lucide-react';
import { useRobotStore } from '../../store/robotStore';
import { DHQuizEngine } from '../../services/dhQuizEngine';
import { DHQuizResult } from '../../types/lab';

interface DHQuizModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DHQuizModal: React.FC<DHQuizModalProps> = ({ isOpen, onClose }) => {
  const { t, language } = useTranslation();
  const { robotModel } = useRobotStore();

  const questions = useMemo(() => {
    if (!robotModel) return [];
    return DHQuizEngine.generateQuizForRobot(robotModel, language);
  }, [robotModel]);

  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [quizResult, setQuizResult] = useState<DHQuizResult | null>(null);

  if (!isOpen || !robotModel) return null;

  const handleSelect = (questionId: string, optionId: string) => {
    if (quizResult) return; // Locked once submitted
    setSelectedAnswers((prev) => ({ ...prev, [questionId]: optionId }));
  };

  const handleSubmit = () => {
    const result = DHQuizEngine.gradeQuiz(questions, selectedAnswers);
    setQuizResult(result);
  };

  const handleReset = () => {
    setSelectedAnswers({});
    setQuizResult(null);
  };

  const answeredCount = Object.keys(selectedAnswers).length;
  const isAllAnswered = answeredCount === questions.length;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl max-w-4xl w-full h-[88vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-400/30 text-amber-400">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-sm font-bold text-white tracking-wide">
                  D-H Interactive Quiz Lab
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full">
                  {robotModel.name}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {language === 'vi' ? 'Thực hành thẩm định 2 quy tắc vàng Denavit-Hartenberg & thông số động học' : 'Validate the 2 golden rules of Denavit-Hartenberg & kinematic parameters'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title={t.common.close}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quiz Progress & Results Banner */}
        <div className="px-5 py-2.5 bg-slate-950/60 border-b border-slate-800/80 flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center space-x-2 text-slate-300">
            <BookOpen className="w-4 h-4 text-sky-400" />
            <span>
              {language === 'vi' ? <>Tiến độ: <strong className="text-white">{answeredCount}</strong> / {questions.length} câu hỏi</> : <>Progress: <strong className="text-white">{answeredCount}</strong> / {questions.length} questions</>}
            </span>
          </div>

          {quizResult && (
            <div className="flex items-center space-x-3">
              <span
                className={`flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold font-mono border ${
                  quizResult.passed
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                }`}
              >
                <Award className="w-3.5 h-3.5" />
                <span>
                  <span>{language === 'vi' ? 'Điểm' : 'Score'}: {quizResult.scorePercentage}% ({quizResult.correctAnswers}/{quizResult.totalQuestions}) - {quizResult.passed ? (language === 'vi' ? 'ĐẠT (PASSED)' : 'PASSED') : (language === 'vi' ? 'CẦN ÔN TẬP' : 'NEEDS REVIEW')}</span>
                </span>
              </span>

              <button
                onClick={handleReset}
                className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 text-xs font-medium transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{language === 'vi' ? 'Làm lại' : 'Reset'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Questions Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {questions.map((q, qIndex) => {
            const selectedOptId = selectedAnswers[q.id];
            const resultItem = quizResult?.detailedResults.find((r) => r.questionId === q.id);

            return (
              <div
                key={q.id}
                className={`p-4 rounded-xl border transition ${
                  resultItem
                    ? resultItem.isCorrect
                      ? 'bg-emerald-950/15 border-emerald-500/40'
                      : 'bg-rose-950/15 border-rose-500/40'
                    : 'bg-slate-900/60 border-slate-800'
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-2.5">
                  <div className="flex items-center space-x-2">
                    <span className="w-6 h-6 rounded-lg bg-sky-500/20 text-sky-400 font-mono text-xs font-bold flex items-center justify-center shrink-0">
                      {qIndex + 1}
                    </span>
                    <h3 className="text-xs font-bold text-slate-200">{q.title}</h3>
                  </div>

                  {resultItem && (
                    <div className="flex items-center space-x-1">
                      {resultItem.isCorrect ? (
                        <span className="flex items-center space-x-1 text-emerald-400 text-xs font-semibold">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>{language === 'vi' ? 'Chính xác' : 'Correct'}</span>
                        </span>
                      ) : (
                        <span className="flex items-center space-x-1 text-rose-400 text-xs font-semibold">
                          <XCircle className="w-4 h-4" />
                          <span>{language === 'vi' ? 'Chưa đúng' : 'Incorrect'}</span>
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <p className="text-xs text-slate-300 leading-relaxed mb-3">
                  {q.prompt}
                </p>

                {/* Options List */}
                <div className="space-y-2">
                  {q.options.map((opt) => {
                    const isSelected = selectedOptId === opt.id;
                    let optStyle =
                      'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800/60 hover:text-white';

                    if (quizResult) {
                      if (opt.isCorrect) {
                        optStyle = 'bg-emerald-900/30 border-emerald-500/50 text-emerald-200 font-medium';
                      } else if (isSelected && !opt.isCorrect) {
                        optStyle = 'bg-rose-900/30 border-rose-500/50 text-rose-200';
                      } else {
                        optStyle = 'bg-slate-950/30 border-slate-900 text-slate-500';
                      }
                    } else if (isSelected) {
                      optStyle = 'bg-sky-600/20 border-sky-500 text-sky-200 font-medium shadow-sm shadow-sky-500/20';
                    }

                    return (
                      <button
                        key={opt.id}
                        disabled={!!quizResult}
                        onClick={() => handleSelect(q.id, opt.id)}
                        className={`w-full text-left p-3 rounded-lg border text-xs flex items-center justify-between transition ${optStyle}`}
                      >
                        <div className="flex items-center space-x-2.5">
                          <div
                            className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                              isSelected
                                ? 'border-sky-400 bg-sky-500 text-white'
                                : 'border-slate-600 bg-transparent'
                            }`}
                          >
                            {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </div>
                          <span>{opt.text}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Feedback box upon grading */}
                {resultItem && (
                  <div className="mt-3 p-3 rounded-lg bg-slate-950/80 border border-slate-800 text-xs text-slate-300 flex items-start space-x-2">
                    <HelpCircle className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-sky-300 font-semibold">{language === 'vi' ? 'Giải thích sư phạm: ' : 'Pedagogical Explanation: '}</strong>
                      <span>{resultItem.pedagogicalFeedback}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-950 border-t border-slate-800/80 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-400">
            {quizResult
              ? (language === 'vi' ? 'Thầy/Cô và sinh viên có thể dùng điểm số này để đánh giá hiểu biết về gán hệ trục D-H.' : 'Evaluates comprehension of Denavit-Hartenberg coordinate frame assignments.') : (language === 'vi' ? 'Hãy trả lời đủ các câu hỏi và nhấn Nộp bài để nhận giải thích chi tiết.' : 'Answer all questions and submit for grading.')}
          </span>

          <div className="flex items-center space-x-2">
            {!quizResult ? (
              <button
                disabled={!isAllAnswered}
                onClick={handleSubmit}
                className={`px-4 py-2 rounded-xl text-xs font-bold font-mono transition ${
                  isAllAnswered
                    ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-md shadow-amber-600/30'
                    : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                }`}
              >
                {language === 'vi' ? 'Nộp bài & Chấm điểm' : 'Submit & Grade'}
              </button>
            ) : (
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 text-xs font-semibold transition"
              >
                {language === 'vi' ? 'Đóng bài tập' : 'Close'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
