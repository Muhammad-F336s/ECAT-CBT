import { useState, useEffect } from "react";
import API from "../utils/api";

const TestWindow = ({ subjectId, onTestComplete }) => {
  //  userId
  const [questions, setQuestions] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  //   const [selectedAnswers, setSelectedAnswers] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTest = async () => {
      try {
        const res = await API.post("/test/generate", {
          subjectId,
          totalQuestions: 5,
        });
        setQuestions(res.data.questions);
      } catch (err) {
        console.error("Test load failure:", err);
      } finally {
        setLoading(false);
      }
    };
    if (subjectId) loadTest();
  }, [subjectId]);

  if (loading)
    return <div className="test-state-message">Loading CBT Simulator...</div>;
  if (!questions.length)
    return (
      <div className="test-state-message test-state-message--error">
        No questions returned from system.
      </div>
    );

  return (
    <div className="test-window-card">
      <div className="test-window-header">
        <h3>
          Question {currentIdx + 1} of {questions.length}
        </h3>
        <button
          onClick={onTestComplete}
          className="test-exit-button"
        >
          Exit
        </button>
      </div>
      <div className="test-question-card">
        {questions[currentIdx].statement}
      </div>
      <div className="test-controls">
        <button
          disabled={currentIdx === 0}
          onClick={() => setCurrentIdx((prev) => prev - 1)}
          className="action-secondary"
        >
          Prev
        </button>
        <button
          disabled={currentIdx === questions.length - 1}
          onClick={() => setCurrentIdx((prev) => prev + 1)}
          className="action-primary"
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default TestWindow;
