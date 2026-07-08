import { useState, useEffect, useRef } from "react";
import { getAiFeedback, getProTip } from "../utils/aiFeedback";
import { printFullPaper } from "../utils/printFullPaper";
import "./TestResultPage.css";

const OPTION_LABELS = "ABCDE";

const formatDuration = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
};

const formatTestDate = (dateInput) => {
  const date = dateInput ? new Date(dateInput) : new Date();
  return date.toLocaleString();
};

const TestResultPage = ({
  user,
  results,
  onStartNewSession,
  onBackToDashboard,
}) => {
  const [activeTab, setActiveTab] = useState("wrong");
  const printRef = useRef(null);

  const feedback = getAiFeedback(
    results.percentage,
    results.score,
    results.totalMarks,
    user?.name,
  );

  const wrongAndSkipped = results.breakdown.filter(
    (item) => item.status === "wrong" || item.status === "skipped",
  );
  const correctItems = results.breakdown.filter(
    (item) => item.status === "correct",
  );
  const visibleItems = activeTab === "wrong" ? wrongAndSkipped : correctItems;

  useEffect(() => {
    const timer = setTimeout(() => {
      if (window.MathJax && window.MathJax.typesetPromise) {
        window.MathJax.typesetPromise().catch((err) =>
          console.log("MathJax typesetting error on results page:", err)
        );
      }
    }, 80);
    return () => clearTimeout(timer);
  }, [activeTab, results]);

  const handlePrintResult = () => {
    document.body.classList.add("ecat-printing-result");
    window.print();
    window.setTimeout(() => {
      document.body.classList.remove("ecat-printing-result");
    }, 300);
  };

  const handlePrintFullPaper = () => {
    // Print only blank answer sheet
    printFullPaper({ user, results, blank: true });
  };

  const handlePrintSolvedPaper = () => {
    // Print full paper containing all correct answers, explanations, and dynamic AI tips
    printFullPaper({ user, results, blank: false });
  };

  return (
    <div className="ecat-result ecat-result-page" ref={printRef}>
      <section className={`ecat-ai-banner ecat-ai-banner--${feedback.tone}`}>
        <div className="ecat-ai-icons" aria-hidden="true">
          {feedback.icons}
        </div>
        <h2 className="ecat-ai-title">{feedback.title}</h2>
        <p className="ecat-ai-body">{feedback.body}</p>
      </section>

      <section className="ecat-result-header no-print-actions">
        <h1>Official ECAT Result</h1>
        <p className="ecat-result-student">
          {user?.name || "Student"} | {results.track || "Pre-Engineering"}
        </p>
        <p className="ecat-result-date">
          Test Date: {formatTestDate(results.submittedAt)}
        </p>
        <div style={{ position: "absolute", right: 24, top: 18 }}>
          <button
            type="button"
            className="ecat-action-btn ecat-action-btn--muted"
            onClick={onBackToDashboard}
          >
            Go to Dashboard
          </button>
        </div>
      </section>

      <section className="ecat-stats-grid">
        <div className="ecat-stat-card">
          <span>Total Score</span>
          <strong>
            {results.displayScore} / {results.displayTotal}
          </strong>
        </div>
        <div className="ecat-stat-card">
          <span>Percentage</span>
          <strong>{results.percentage}%</strong>
        </div>
        <div className="ecat-stat-card">
          <span>Correct</span>
          <strong className="ecat-stat-good">{results.correctCount}</strong>
        </div>
        <div className="ecat-stat-card">
          <span>Wrong</span>
          <strong className="ecat-stat-bad">{results.wrongCount}</strong>
        </div>
        <div className="ecat-stat-card">
          <span>Skipped</span>
          <strong>{results.skippedCount}</strong>
        </div>
        <div className="ecat-stat-card">
          <span>Neg. Marking</span>
          <strong className="ecat-stat-info">
            {results.negativeMarking ? "Enabled" : "Disabled"}
          </strong>
        </div>
        <div className="ecat-stat-card ecat-stat-card--wide">
          <span>Time Taken</span>
          <strong className="ecat-stat-info">
            {formatDuration(results.timeTakenSeconds)}
          </strong>
        </div>
      </section>

      <section className="ecat-action-row no-print-actions">
        <button
          type="button"
          className="ecat-action-btn ecat-action-btn--muted"
          onClick={onStartNewSession}
        >
          Start New Session
        </button>
        <button
          type="button"
          className="ecat-action-btn ecat-action-btn--primary"
          onClick={handlePrintResult}
        >
          Print Result
        </button>
        <button
          type="button"
          className="ecat-action-btn ecat-action-btn--success"
          onClick={handlePrintFullPaper}
        >
          Print Blank Paper
        </button>
        <button
          type="button"
          className="ecat-action-btn ecat-action-btn--info"
          onClick={handlePrintSolvedPaper}
        >
          Print Solved Paper
        </button>
      </section>

      <section className="ecat-tabs no-print-actions">
        <button
          type="button"
          className={`ecat-tab ${activeTab === "wrong" ? "active wrong" : ""}`}
          onClick={() => setActiveTab("wrong")}
        >
          Wrong &amp; Skipped ({wrongAndSkipped.length})
        </button>
        <button
          type="button"
          className={`ecat-tab ${activeTab === "correct" ? "active correct" : ""}`}
          onClick={() => setActiveTab("correct")}
        >
          Correct Answers ({correctItems.length})
        </button>
      </section>

      <section className="ecat-review-section">
        <h3
          className={
            activeTab === "wrong"
              ? "ecat-review-heading ecat-review-heading--wrong"
              : "ecat-review-heading ecat-review-heading--correct"
          }
        >
          {activeTab === "wrong"
            ? `✕ Wrong & Skipped Answers`
            : `✓ Correct Answers`}
        </h3>

        {visibleItems.length === 0 ? (
          <p className="ecat-review-empty">
            {activeTab === "wrong"
              ? "No wrong or skipped questions — great job!"
              : "No correct answers in this attempt."}
          </p>
        ) : (
          visibleItems.map((item) => (
            <article key={item.questionId} className="ecat-review-card">
              <h4>
                Q{item.questionNumber}: {item.statement}
              </h4>

              <div className="ecat-review-options">
                {item.options.map((option, index) => {
                  const label = OPTION_LABELS[index] || String(index + 1);
                  const isCorrect =
                    option.text === item.correctAnswerText;
                  const isSelected =
                    option.text === item.selectedAnswerText;
                  return (
                    <p
                      key={option.id}
                      className={`ecat-review-option ${
                        isCorrect ? "correct" : ""
                      } ${isSelected && !isCorrect ? "wrong-selected" : ""}`}
                    >
                      <strong>{label}.</strong> {option.text}
                    </p>
                  );
                })}
              </div>

              <div className="ecat-answer-lines">
                <p className="ecat-your-answer">
                  Your Answer:{" "}
                  {item.isSkipped
                    ? "Skipped"
                    : item.selectedAnswerLabel || "—"}
                </p>
                <p className="ecat-correct-answer">
                  Correct Answer: {item.correctAnswerLabel || "—"}
                </p>
              </div>

              {(() => {
                const parts = (item.explanation || "").split("===TRICK===");
                const explanationText = parts[0] || "";
                const customTrick = parts[1] || "";
                return (
                  <>
                    {explanationText.trim() && (
                      <div className="ecat-explanation">
                        <strong>Explanation:</strong>
                        <p>{explanationText}</p>
                      </div>
                    )}
                    <div className="ecat-pro-tip">
                      <strong>💡 Pro Tip / Trick:</strong>
                      <p>{customTrick.trim() || getProTip(item.status)}</p>
                    </div>
                  </>
                );
              })()}
            </article>
          ))
        )}
      </section>

      <section className="ecat-result-footer no-print-actions">
        <button
          type="button"
          className="ecat-action-btn ecat-action-btn--primary"
          onClick={onBackToDashboard}
        >
          Back to Dashboard
        </button>
      </section>
    </div>
  );
};

export default TestResultPage;
