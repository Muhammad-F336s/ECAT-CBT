import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../utils/api";
import "./ContentLibrary.css";

const FIELD_DISTRIBUTIONS = {
  "Pre-Engineering": {
    math: 0.3,
    physics: 0.3,
    chemistry: 0.3,
    english: 0.1,
    biology: 0,
    computer: 0,
  },
  "Pre-Medical": {
    biology: 0.3,
    physics: 0.3,
    chemistry: 0.3,
    english: 0.1,
    math: 0,
    computer: 0,
  },
  ICS: {
    computer: 0.3,
    math: 0.3,
    physics: 0.3,
    english: 0.1,
    chemistry: 0,
    biology: 0,
  },
};

const SUBJECT_MAP = {
  Mathematics: "math",
  Physics: "physics",
  Chemistry: "chemistry",
  Biology: "biology",
  English: "english",
  "Computer Science": "computer",
};

export default function ContentLibrary({ user }) {
  const navigate = useNavigate();
  const [library, setLibrary] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [questionCount, setQuestionCount] = useState(10);
  const [isStudyMode, setIsStudyMode] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const userField = localStorage.getItem("field") || "Pre-Engineering";

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [libRes, analyticsRes] = await Promise.all([
          API.get("/test/content-library"),
          API.get(`/user/analytics/${user.id}`),
        ]);
        setLibrary(libRes.data);
        setAnalytics(analyticsRes.data);
      } catch (err) {
        console.error("Fetch library/analytics error:", err);
      } finally {
        setLoading(false);
      }
    };
    if (user?.id) fetchData();
  }, [user?.id]);

  const getMastery = (subjectName, chapterId = null) => {
    if (!analytics || !analytics.subjectAnalytics) return 0;
    const subStats = analytics.subjectAnalytics[subjectName];
    if (!subStats) return 0;

    if (chapterId) {
      const chStats = subStats.chapters[chapterId];
      if (!chStats || chStats.total === 0) return 0;
      return Math.round((chStats.correct / chStats.total) * 100);
    }

    if (subStats.total === 0) return 0;
    return Math.round((subStats.correct / subStats.total) * 100);
  };

  const filterLibraryByField = () => {
    const dist =
      FIELD_DISTRIBUTIONS[userField] || FIELD_DISTRIBUTIONS["Pre-Engineering"];
    return library.filter((subject) => {
      const subId = SUBJECT_MAP[subject.name];
      return subId && dist[subId] > 0;
    });
  };

  const handleStartPractice = async () => {
    if (!selectedChapter) return;
    setIsGenerating(true);
    try {
      const res = await API.post("/test/generate-chapter-practice", {
        chapterId: selectedChapter.id,
        requestedCount: questionCount,
      });

      const { questions, subjectName, marksPerQuestion } = res.data;

      localStorage.removeItem("ecat_active_test_session");

      navigate("/test/cbt", {
        state: {
          formData: {
            subjectName,
            questionCount: questions.length,
            questions: questions, // Passing questions directly to bypass generator in TestWindow
            marksPerQuestion,
            mode: isStudyMode ? "study" : "practice",
            isChapterPractice: true,
          },
        },
      });
    } catch (err) {
      console.error("Generate practice error:", err);
      alert("Failed to generate practice test. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  if (loading)
    return (
      <div className="library-loading">Loading your content library...</div>
    );

  const filteredLibrary = filterLibraryByField();

  return (
    <div className="content-library-container">
      <div className="library-header">
        <h1>Content Library</h1>
        <p>Targeted practice: Select a chapter to master specific concepts.</p>
        <div className="field-badge">Currently viewing: {userField}</div>
      </div>

      <div className="library-layout">
        <div className="subjects-panel">
          <h3>Your Subjects</h3>
          <div className="subjects-list">
            {filteredLibrary.map((subject) => {
              const mastery = getMastery(subject.name);
              return (
                <button
                  key={subject.id}
                  className={`subject-item ${selectedSubject?.id === subject.id ? "active" : ""}`}
                  onClick={() => {
                    setSelectedSubject(subject);
                    setSelectedChapter(null);
                  }}
                >
                  <div className="subject-item-top">
                    <div className="subject-name-wrapper">
                      <span>{subject.name}</span>
                      {selectedSubject?.id === subject.id && (
                        <span className="selection-indicator">✓</span>
                      )}
                    </div>
                    <span className="count-badge">
                      {subject.chapters.reduce(
                        (acc, ch) => acc + ch._count.questions,
                        0,
                      )}{" "}
                      Qs
                    </span>
                  </div>
                  <div className="subject-mastery-track">
                    <div className="subject-mastery-fill" style={{ width: `${mastery}%` }} />
                    <span className="mastery-pct">{mastery}% Mastered</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="chapters-panel" key={selectedSubject?.id || "empty"}>
          {selectedSubject ? (
            <>
              <div className="chapter-header">
                <h3>{selectedSubject.name} Chapters</h3>
                <span className="subject-overall-stat">Overall Subject Mastery: {getMastery(selectedSubject.name)}%</span>
              </div>
              <div className="chapters-grid">
                {selectedSubject.chapters &&
                selectedSubject.chapters.length > 0 ? (
                  selectedSubject.chapters.map((chapter) => {
                    const chMastery = getMastery(selectedSubject.name, chapter.id);
                    return (
                      <div
                        key={chapter.id}
                        className={`chapter-card ${selectedChapter?.id === chapter.id ? "active" : ""}`}
                        onClick={() => setSelectedChapter(chapter)}
                      >
                        <div className="chapter-info">
                          <span className="chapter-name">{chapter.name}</span>
                          <span className="chapter-q-count">
                            {chapter._count.questions} Questions
                          </span>
                        </div>
                        <div className="chapter-mastery-container">
                          <div className="chapter-progress-ring">
                            <svg viewBox="0 0 36 36" className="circular-chart">
                              <path className="circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                              <path className="circle" strokeDasharray={`${chMastery}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                            </svg>
                            <span className="ring-text">{chMastery}%</span>
                          </div>
                        </div>
                        {selectedChapter?.id === chapter.id && (
                          <div className="selection-indicator">✓</div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="empty-state">
                    <p>No chapters available for this subject</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="empty-state">
              <p>Select a subject to view available chapters</p>
            </div>
          )}
        </div>

        {selectedChapter && (
          <div className="practice-settings-panel">
            <h3>Start Practice</h3>
            <p>
              Ready to tackle <strong>{selectedChapter.name}</strong>?
            </p>

            <div className="setting-row">
              <label className="study-mode-toggle">
                <input
                  type="checkbox"
                  checked={isStudyMode}
                  onChange={(e) => setIsStudyMode(e.target.checked)}
                />
                <span>Enable Study Mode (Instant Feedback)</span>
              </label>
            </div>

            <div className="setting-row">
              <label>Number of Questions</label>
              <input
                type="number"
                value={questionCount}
                onChange={(e) =>
                  setQuestionCount(Math.max(1, Number(e.target.value)))
                }
                min="1"
              />
            </div>

            <button
              className="start-practice-btn"
              onClick={handleStartPractice}
              disabled={isGenerating}
            >
              {isGenerating ? "Generating..." : "Start Practice session"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
