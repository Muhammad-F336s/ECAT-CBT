import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import API from "../utils/api";
import { convertMathPlaceholders } from "../utils/mathUtils";
import TestResultPage from "./TestResultPage";
import "./TestWindow.css";

const OPTION_LABELS = "ABCDE";
const MAX_TIME_BOOSTS = 2;
const MAX_PAUSES = 1;
const TIME_BOOST_SECONDS = 60;

const formatTime = (totalSeconds) => {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
};

const formatClock = (date) =>
  date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const TestWindow = ({ subjectId, userId, user, onTestComplete }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const formData = location.state?.formData || {};

  const [questions, setQuestions] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [lockedIds, setLockedIds] = useState(new Set());
  const [skippedIds, setSkippedIds] = useState(new Set());
  const [maxReachedIdx, setMaxReachedIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadStepName, setLoadStepName] = useState("Initializing generator...");
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
  const [secondsPerQuestion, setSecondsPerQuestion] = useState(60);
  const [paperStartTime] = useState(() => new Date());

  const timerRef = useRef(null);
  const autoSubmittedRef = useRef(false);

  // Smooth loader state simulator to provide premium UX feedback
  useEffect(() => {
    if (!loading) {
      setLoadProgress(0);
      return;
    }

    const steps = [
      { pct: 15, text: "Configuring syllabus layout..." },
      { pct: 35, text: "Assembling Groq AI prompt context..." },
      { pct: 60, text: "Structuring step-by-step mathematical reasoning..." },
      { pct: 85, text: "Inserting customized AI pro tips & shortcuts..." },
      { pct: 95, text: "Building simulator window interface..." },
    ];

    setLoadProgress(5);
    setLoadStepName("Initializing test configuration...");

    let active = true;
    let index = 0;

    const interval = setInterval(() => {
      if (!active) return;
      if (index < steps.length) {
        setLoadProgress(steps[index].pct);
        setLoadStepName(steps[index].text);
        index++;
      } else {
        setLoadProgress((p) => Math.min(99, p + 1));
      }
    }, 1500);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [loading]);

  const attemptedCount = lockedIds.size;

  // ===== FIXED: Use API.post (axios) instead of EventSource (GET) =====
  const loadTest = useCallback(async () => {
    setLoading(true);
    setError("");
    setPhase("loading");

    try {
      const res = await API.post("/test/generate", {
        field: formData.field,
        questionCount: formData.questionCount || 10,
        difficulty: formData.difficulty || 5,
        syllabusType: formData.syllabusType || "mixed",
        newSyllabusPercentage: formData.newSyllabusPercentage || 50,
        negativeMarking: formData.negativeMarking || false,
        subjects: formData.subjects || [],
        chapters: formData.chapters || [],
        topicBatches: formData.topicBatches || [],
        useAI: true,
      });

      const data = res.data;
      const loaded = data.questions || [];

      if (!loaded.length) {
        setError("No questions returned from system.");
        setPhase("error");
        setLoading(false);
        return;
      }

      setQuestions(loaded);
      setSubjectName(data.subjectName || "ECAT Practice");
      const perQuestion = 60;
      setSecondsPerQuestion(perQuestion);
      setTimeLeft(loaded.length * perQuestion);
      setPhase("active");
      setLoading(false);
    } catch (err) {
      console.error("Test generation failed:", err);
      setError(
        err.response?.data?.error || "Failed to generate test. Please retry."
      );
      setPhase("error");
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-invoke test generation on mount
  useEffect(() => {
    if (!formData || !formData.field) {
      // No form data — redirect back to the test form
      navigate("/test/form", { replace: true });
      return;
    }
    loadTest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Timer countdown
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

  // Track remaining time for the current question and auto-advance when its slice ends
  useEffect(() => {
    if (phase !== "active" || questions.length === 0) return undefined;

    const totalAllocated = questions.length * secondsPerQuestion;
    const elapsed = totalAllocated - timeLeft;
    const currentEnd = (currentIdx + 1) * secondsPerQuestion;
    const remainingInCurrent = Math.max(0, Math.ceil(currentEnd - elapsed));

    if (remainingInCurrent === 0 && currentIdx < questions.length - 1 && !isPaused) {
      const timer = window.setTimeout(() => {
        setLockedIds((prev) => new Set(prev).add(questions[currentIdx].id));
        const nextIdx = Math.min(currentIdx + 1, questions.length - 1);
        setCurrentIdx(nextIdx);
        setMaxReachedIdx((prev) => Math.max(prev, nextIdx));
      }, 0);
      return () => window.clearTimeout(timer);
    }

    return undefined;
  }, [timeLeft, currentIdx, secondsPerQuestion, questions, phase, isPaused]);

  // MathJax latex typesetting trigger
  useEffect(() => {
    const timer = setTimeout(() => {
      if (window.MathJax && window.MathJax.typesetPromise) {
        window.MathJax.typesetPromise().catch((err) => console.log("MathJax error:", err));
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [currentIdx, questions]);

  const getQuestionStatus = (idx) => {
    const question = questions[idx];
    if (!question) return "locked";
    if (idx === currentIdx) return "current";
    if (lockedIds.has(question.id)) return "attempted";
    if (answers[question.id]) return "pending";
    if (skippedIds.has(question.id)) return "skipped";
    if (idx <= maxReachedIdx) return "pending";
    return "locked";
  };

  const canNavigateTo = (idx) => {
    const question = questions[idx];
    if (!question || lockedIds.has(question.id)) return false;

    const status = getQuestionStatus(idx);
    return status === "current" || status === "skipped" || status === "pending";
  };

  const goToQuestion = (idx) => {
    if (!canNavigateTo(idx)) return;
    setCurrentIdx(idx);
  };

  const handleSelectOption = (optionText) => {
    const question = questions[currentIdx];
    if (!question || lockedIds.has(question.id) || isPaused) return;

    setAnswers((prev) => ({
      ...prev,
      [question.id]: optionText,
    }));
    setSkippedIds((prev) => {
      const next = new Set(prev);
      next.delete(question.id);
      return next;
    });
  };

  const handleSaveAndNext = () => {
    const question = questions[currentIdx];
    if (!question || !answers[question.id] || lockedIds.has(question.id)) return;

    setLockedIds((prev) => new Set(prev).add(question.id));
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
    if (!question || lockedIds.has(question.id)) return;

    if (!answers[question.id]) {
      setSkippedIds((prev) => new Set(prev).add(question.id));
    }

    if (currentIdx < questions.length - 1) {
      const nextIdx = currentIdx + 1;
      setCurrentIdx(nextIdx);
      setMaxReachedIdx((prev) => Math.max(prev, nextIdx));
    }
  };

  async function handleFinishExam(autoSubmit = false) {
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
        selectedAnswerText: answers[q.id] || "",
      }));

      const totalAllocated = questions.length * secondsPerQuestion;
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
  }

  // Auto-submit when time runs out
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

  // ===== FIXED: Properly close function & add phase renders =====
  const handleStartNewSession = () => {
    navigate("/test");
  };

  // ===== Phase-based conditional renders =====
  if (phase === "loading" || loading) {
    return (
      <div className="cbt-state-message" style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "40px" }}>
        <h2 style={{ margin: 0, fontSize: "1.35rem", color: "var(--ecat-blue)" }}>🚀 Generating your AI-powered test... Please wait.</h2>
        <div className="cbt-progress-wrapper" style={{ width: "100%", maxWidth: "480px", margin: "15px auto 0" }}>
          <div className="cbt-progress-step-text">
            <span>{loadStepName}</span>
            <span>{loadProgress}%</span>
          </div>
          <div className="cbt-progress-track">
            <div className="cbt-progress-bar" style={{ width: `${loadProgress}%` }} />
          </div>
        </div>
      </div>
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
  const currentAnswer = answers[currentQuestion?.id] || "";
  const isCurrentLocked = lockedIds.has(currentQuestion?.id);
  const isLastQuestion = currentIdx === questions.length - 1;
  const hasAnyAnswer = questions.some((q) => answers[q.id]);
  const totalAllocated = questions.length * secondsPerQuestion;
  const elapsed = Math.max(0, totalAllocated - timeLeft);
  const currentQuestionRemaining = questions.length
    ? Math.max(0, Math.ceil((currentIdx + 1) * secondsPerQuestion - elapsed))
    : 0;

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
          <div className="cbt-question-timer">
            <small>
              Per-question: <strong>{formatTime(secondsPerQuestion)}</strong>
              {" "}• This Q: <strong>{formatTime(currentQuestionRemaining)}</strong>
            </small>
          </div>
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

      {(() => {
        const parseStatement = (stmt) => {
          if (!stmt) return { passageText: "", questionText: "" };
          if (stmt.startsWith("[PASSAGE]\n")) {
            const parts = stmt.split("\n\n");
            const passageText = parts[0].replace("[PASSAGE]\n", "").trim();
            const questionText = parts.slice(1).join("\n\n").trim();
            return { passageText, questionText };
          }
          return { passageText: "", questionText: stmt };
        };

        const { passageText, questionText } = parseStatement(currentQuestion?.statement);
        const renderedQuestionText = convertMathPlaceholders(questionText);
        const renderedPassageText = convertMathPlaceholders(passageText);

        const renderQuestionBody = () => (
          <>
            <h3 className="cbt-question-title">
              Question {currentIdx + 1} of {questions.length}
            </h3>
            <p className="cbt-question-text">{renderedQuestionText}</p>

            <div className="cbt-options-list">
              {currentQuestion.options.map((option, index) => {
                const label = OPTION_LABELS[index] || String(index + 1);
                const isSelected = currentAnswer === option.text;
                const renderedOptionText = convertMathPlaceholders(option.text);
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
                      onChange={() => handleSelectOption(option.text)}
                    />
                    <span className="cbt-option-label">{label}.</span>
                    <span className="cbt-option-text">{renderedOptionText}</span>
                  </label>
                );
              })}
            </div>
          </>
        );

        if (passageText) {
          return (
            <main className="cbt-question-panel cbt-split-container" style={{ fontSize: `${zoomLevel}rem` }}>
              <div className="cbt-passage-panel">
                <h4 className="cbt-passage-title">Reading Comprehension Passage</h4>
                <div className="cbt-passage-body">{renderedPassageText}</div>
              </div>
              <div className="cbt-question-content">
                {renderQuestionBody()}
              </div>
            </main>
          );
        }

        return (
          <main className="cbt-question-panel" style={{ fontSize: `${zoomLevel}rem` }}>
            {renderQuestionBody()}
          </main>
        );
      })()}

      <footer className="cbt-bottombar">
        <button
          type="button"
          className="cbt-btn cbt-btn--secondary"
          onClick={handleSkipAndNext}
          disabled={isCurrentLocked || isLastQuestion || isPaused || Boolean(currentAnswer)}
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
              disabled={!currentAnswer || isCurrentLocked || isPaused}
            >
              Save and Next →
            </button>
          ) : (
            <button
              type="button"
              className="cbt-btn cbt-btn--save"
              onClick={() => handleFinishExam(false)}
              disabled={(!currentAnswer && !hasAnyAnswer) || submitting || isPaused}
            >
              {submitting ? "Submitting..." : "Save and Finish →"}
            </button>
          )}
          <p className="cbt-warning-note">
            Note: Please select the option carefully. Once you select an option you must Save and Next — you cannot skip that question, and after saving you cannot return to change the answer.
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
