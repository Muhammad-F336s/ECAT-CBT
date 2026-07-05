import { useState, useEffect, useCallback, useRef } from "react";
import API from "../utils/api";
import TestResultPage from "./TestResultPage";
import "./TestWindow.css";

const OPTION_LABELS = "ABCDE";
const MAX_TIME_BOOSTS = 2;
const MAX_PAUSES = 1;
const TIME_BOOST_SECONDS = 60;
const SECONDS_PER_QUESTION = 60;

const formatTime = (totalSeconds) => {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
};

const formatClock = (date) =>
  date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const TestWindow = ({ subjectId, userId, user, onTestComplete }) => {
  const [questions, setQuestions] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [savedAnswers, setSavedAnswers] = useState({});
  const [skippedIds, setSkippedIds] = useState(new Set());
  const [pendingSelection, setPendingSelection] = useState("");
  const [maxReachedIdx, setMaxReachedIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [phase, setPhase] = useState("loading");
  const [results, setResults] = useState(null);
  const [subjectName, setSubjectName] = useState("ECAT Practice");
  const [showStudentDetails, setShowStudentDetails] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isPaused, setIsPaused] = useState(false);
  const [timeBoostsUsed, setTimeBoostsUsed] = useState(0);
  const [pausesUsed, setPausesUsed] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [paperStartTime] = useState(() => new Date());

  const timerRef = useRef(null);
  const autoSubmittedRef = useRef(false);

  const attemptedCount = Object.keys(savedAnswers).length;

  const loadTest = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await API.post("/test/generate", {
        subjectId,
        userId,
        totalQuestions: 5,
      });
      const loaded = res.data.questions || [];
      if (!loaded.length) {
        setError("No questions returned from system.");
        setPhase("error");
        return;
      }
      setQuestions(loaded);
      setSubjectName(res.data.subjectName || "ECAT Practice");
      setTimeLeft(loaded.length * SECONDS_PER_QUESTION);
      setPhase("active");
    } catch (err) {
      setError(
        err.response?.data?.error ||
          "Unable to load the practice test. Please try again.",
      );
      setPhase("error");
    } finally {
      setLoading(false);
    }
  }, [subjectId, userId]);

  useEffect(() => {
    if (subjectId && userId) loadTest();
  }, [subjectId, userId, loadTest]);

  useEffect(() => {
    if (phase !== "active" || isPaused || timeLeft <= 0) return undefined;

    timerRef.current = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timerRef.current);
  }, [phase, isPaused, timeLeft]);

  useEffect(() => {
    if (
      timeLeft === 0 &&
      phase === "active" &&
      questions.length > 0 &&
      !autoSubmittedRef.current
    ) {
      autoSubmittedRef.current = true;
      handleFinishExam(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, phase, questions.length]);

  useEffect(() => {
    const currentQuestion = questions[currentIdx];
    if (!currentQuestion) return;
    if (savedAnswers[currentQuestion.id]) {
      setPendingSelection(savedAnswers[currentQuestion.id]);
      return;
    }
    setPendingSelection("");
  }, [currentIdx, questions, savedAnswers]);

  const getQuestionStatus = (idx) => {
    const question = questions[idx];
    if (!question) return "locked";
    if (idx === currentIdx) return "current";
    if (savedAnswers[question.id]) return "attempted";
    if (skippedIds.has(question.id)) return "skipped";
    if (idx <= maxReachedIdx) return "pending";
    return "locked";
  };

  const canNavigateTo = (idx) => {
    const status = getQuestionStatus(idx);
    return status === "current" || status === "skipped" || status === "pending";
  };

  const goToQuestion = (idx) => {
    if (!canNavigateTo(idx)) return;
    setCurrentIdx(idx);
  };

  const handleSaveAndNext = () => {
    const question = questions[currentIdx];
    if (!question || !pendingSelection) return;

    setSavedAnswers((prev) => ({
      ...prev,
      [question.id]: pendingSelection,
    }));
    setSkippedIds((prev) => {
      const next = new Set(prev);
      next.delete(question.id);
      return next;
    });

    if (currentIdx < questions.length - 1) {
      const nextIdx = currentIdx + 1;
      setCurrentIdx(nextIdx);
      setMaxReachedIdx((prev) => Math.max(prev, nextIdx));
    }
  };

  const handleSkipAndNext = () => {
    const question = questions[currentIdx];
    if (!question || savedAnswers[question.id]) return;

    setSkippedIds((prev) => new Set(prev).add(question.id));

    if (currentIdx < questions.length - 1) {
      const nextIdx = currentIdx + 1;
      setCurrentIdx(nextIdx);
      setMaxReachedIdx((prev) => Math.max(prev, nextIdx));
    }
  };

  const handleFinishExam = async (autoSubmit = false) => {
    if (submitting) return;

    if (
      !autoSubmit &&
      !window.confirm("Are you sure you want to finish the exam?")
    ) {
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const questionResponses = questions.map((q) => ({
        questionId: q.id,
        selectedAnswerText: savedAnswers[q.id] || "",
      }));

      const totalAllocated = questions.length * SECONDS_PER_QUESTION;
      const timeTakenSeconds = Math.max(0, totalAllocated - timeLeft);

      const res = await API.post("/test/submit", {
        questionResponses,
        timeTakenSeconds,
        subjectName,
      });
      setResults(res.data);
      setPhase("results");
      if (timerRef.current) window.clearInterval(timerRef.current);
    } catch (err) {
      setError(
        err.response?.data?.error ||
          "Submission failed. Please try finishing again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleZoomIn = () =>
    setZoomLevel((prev) => Math.min(prev + 0.1, 1.4));
  const handleZoomOut = () =>
    setZoomLevel((prev) => Math.max(prev - 0.1, 0.8));

  const handleIncreaseTime = () => {
    if (timeBoostsUsed >= MAX_TIME_BOOSTS) return;
    setTimeLeft((prev) => prev + TIME_BOOST_SECONDS);
    setTimeBoostsUsed((prev) => prev + 1);
  };

  const handlePauseTest = () => {
    if (isPaused) {
      setIsPaused(false);
      return;
    }
    if (pausesUsed >= MAX_PAUSES) return;
    setIsPaused(true);
    setPausesUsed((prev) => prev + 1);
  };

  const handleStartNewSession = () => {
    autoSubmittedRef.current = false;
    setSavedAnswers({});
    setSkippedIds(new Set());
    setCurrentIdx(0);
    setMaxReachedIdx(0);
    setPendingSelection("");
    setResults(null);
    setError("");
    setSubmitting(false);
    setIsPaused(false);
    setTimeBoostsUsed(0);
    setPausesUsed(0);
    setZoomLevel(1);
    setPhase("loading");
    loadTest();
  };

  if (loading) {
    return (
      <div className="cbt-state-message">Loading CBT Simulator...</div>
    );
  }

  if (phase === "error") {
    return (
      <div className="cbt-state-message cbt-state-message--error">
        <p>{error}</p>
        <button type="button" className="cbt-btn cbt-btn--secondary" onClick={loadTest}>
          Retry
        </button>
      </div>
    );
  }

  if (phase === "results" && results) {
    return (
      <TestResultPage
        user={user}
        results={results}
        onStartNewSession={handleStartNewSession}
        onBackToDashboard={onTestComplete}
      />
    );
  }

  const currentQuestion = questions[currentIdx];
  const isCurrentLocked = Boolean(savedAnswers[currentQuestion?.id]);
  const isLastQuestion = currentIdx === questions.length - 1;
  const allSaved = questions.every((q) => savedAnswers[q.id]);

  return (
    <div className="cbt-exam">
      <header className="cbt-topbar">
        <div className="cbt-topbar-left">
          <button
            type="button"
            className="cbt-btn cbt-btn--outline"
            onClick={() => setShowStudentDetails(true)}
          >
            Student Details
          </button>
          <span className="cbt-attempted-count">
            Attempted Questions: {attemptedCount}/{questions.length}
          </span>
        </div>

        <div className="cbt-topbar-center">
          <button type="button" className="cbt-btn cbt-btn--tool" onClick={handleZoomOut}>
            Zoom Out
          </button>
          <button type="button" className="cbt-btn cbt-btn--tool" onClick={handleZoomIn}>
            Zoom In
          </button>
          <button
            type="button"
            className="cbt-btn cbt-btn--tool"
            onClick={handleIncreaseTime}
            disabled={timeBoostsUsed >= MAX_TIME_BOOSTS}
          >
            Increase Time ({timeBoostsUsed}/{MAX_TIME_BOOSTS})
          </button>
          <button
            type="button"
            className="cbt-btn cbt-btn--tool"
            onClick={handlePauseTest}
            disabled={!isPaused && pausesUsed >= MAX_PAUSES}
          >
            {isPaused ? "Resume Test" : `Pause Test (${pausesUsed}/${MAX_PAUSES})`}
          </button>
          <button
            type="button"
            className="cbt-btn cbt-btn--finish"
            onClick={() => handleFinishExam(false)}
            disabled={submitting}
          >
            {submitting ? "Submitting..." : "Finish Exam"}
          </button>
        </div>

        <div className="cbt-topbar-right">
          <div className="cbt-time-block">
            <span>Paper Start Time:</span>
            <strong>{formatClock(paperStartTime)}</strong>
          </div>
          <div className="cbt-time-block cbt-time-block--urgent">
            <span>Time Left:</span>
            <strong>{formatTime(timeLeft)}</strong>
          </div>
        </div>
      </header>

      {isPaused && (
        <div className="cbt-pause-banner">Test is paused. Click Resume Test to continue.</div>
      )}

      {error && <div className="cbt-inline-error">{error}</div>}

      <section className="cbt-legend">
        <span><i className="cbt-dot cbt-dot--attempted" /> Attempted questions cannot be seen again</span>
        <span><i className="cbt-dot cbt-dot--skipped" /> Skipped questions can be seen again</span>
        <span><i className="cbt-dot cbt-dot--current" /> Current question</span>
        <span><i className="cbt-dot cbt-dot--locked" /> Locked question</span>
      </section>

      <main
        className="cbt-question-panel"
        style={{ fontSize: `${zoomLevel}rem` }}
      >
        <h3 className="cbt-question-title">
          Question {currentIdx + 1} of {questions.length}
        </h3>
        <p className="cbt-question-text">{currentQuestion.statement}</p>

        <div className="cbt-options-list">
          {currentQuestion.options.map((option, index) => {
            const label = OPTION_LABELS[index] || String(index + 1);
            const isSelected = pendingSelection === option.text;
            return (
              <label
                key={option.id}
                className={`cbt-option-row ${isSelected ? "selected" : ""} ${isCurrentLocked ? "locked" : ""}`}
              >
                <input
                  type="radio"
                  name={`question-${currentQuestion.id}`}
                  value={option.text}
                  checked={isSelected}
                  disabled={isCurrentLocked || isPaused}
                  onChange={() => setPendingSelection(option.text)}
                />
                <span className="cbt-option-label">{label}.</span>
                <span className="cbt-option-text">{option.text}</span>
              </label>
            );
          })}
        </div>
      </main>

      <footer className="cbt-bottombar">
        <button
          type="button"
          className="cbt-btn cbt-btn--secondary"
          onClick={handleSkipAndNext}
          disabled={isCurrentLocked || isLastQuestion || isPaused}
        >
          Skip and Next →
        </button>

        <div className="cbt-bottom-center">
          <div className="cbt-mini-legend">
            <span><i className="cbt-dot cbt-dot--skipped" /> Skipped</span>
            <span><i className="cbt-dot cbt-dot--locked" /> Locked</span>
            <span><i className="cbt-dot cbt-dot--attempted" /> Attempted</span>
            <span><i className="cbt-dot cbt-dot--current" /> Current</span>
          </div>
          <div className="cbt-palette">
            {questions.map((question, idx) => {
              const status = getQuestionStatus(idx);
              return (
                <button
                  key={question.id}
                  type="button"
                  className={`cbt-palette-btn cbt-palette-btn--${status}`}
                  onClick={() => goToQuestion(idx)}
                  disabled={!canNavigateTo(idx) || isPaused}
                  aria-label={`Question ${idx + 1}`}
                >
                  Q{idx + 1}
                </button>
              );
            })}
          </div>
        </div>

        <div className="cbt-bottom-right">
          {!isLastQuestion ? (
            <button
              type="button"
              className="cbt-btn cbt-btn--save"
              onClick={handleSaveAndNext}
              disabled={!pendingSelection || isCurrentLocked || isPaused}
            >
              Save and Next →
            </button>
          ) : (
            <button
              type="button"
              className="cbt-btn cbt-btn--save"
              onClick={() => {
                if (pendingSelection && !isCurrentLocked) {
                  setSavedAnswers((prev) => ({
                    ...prev,
                    [currentQuestion.id]: pendingSelection,
                  }));
                }
                handleFinishExam(false);
              }}
              disabled={(!pendingSelection && !allSaved) || submitting || isPaused}
            >
              {submitting ? "Submitting..." : "Save and Finish →"}
            </button>
          )}
          <p className="cbt-warning-note">
            Note: Please select the option carefully, once you have selected the option you cannot change it.
          </p>
        </div>
      </footer>

      {showStudentDetails && (
        <div className="cbt-modal-backdrop" onClick={() => setShowStudentDetails(false)}>
          <div
            className="cbt-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <h3>Student Details</h3>
            <p><strong>Name:</strong> {user?.name || "Student"}</p>
            <p><strong>Email:</strong> {user?.email || "—"}</p>
            <p><strong>Role:</strong> Student</p>
            <button
              type="button"
              className="cbt-btn cbt-btn--primary"
              onClick={() => setShowStudentDetails(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TestWindow;
