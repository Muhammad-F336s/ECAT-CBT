import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import API from "../utils/api";
import { NEW_PTB_CHAPTERS, PTB_CHAPTERS } from "./TestModeForm";
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
  const [syllabusView, setSyllabusView] = useState("both");
  const generationAbortRef = useRef(null);

  const userField = user?.academicTrack || localStorage.getItem("field") || "Pre-Engineering";
  const profileSubjects = Array.isArray(user?.academicSubjects) && user.academicSubjects.length > 0
    ? new Set(user.academicSubjects)
    : null;

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
    return library.filter((subject) => {
      const subId = SUBJECT_MAP[subject.name];
      if (!subId) return false;
      if (profileSubjects) return profileSubjects.has(subId);
      const dist = FIELD_DISTRIBUTIONS[userField] || FIELD_DISTRIBUTIONS["Pre-Engineering"];
      return dist[subId] > 0;
    });
  };

  const handleStartPractice = async () => {
    if (!selectedChapter) return;
    generationAbortRef.current?.abort();
    const controller = new AbortController();
    generationAbortRef.current = controller;
    setIsGenerating(true);
    try {
      const res = await API.post("/test/generate-chapter-practice", {
        chapterId: selectedChapter.id,
        requestedCount: questionCount,
        syllabusType: syllabusView === "both" ? "mixed" : syllabusView,
      }, { signal: controller.signal });

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
      if (err.code === "ERR_CANCELED" || err.name === "CanceledError") return;
      console.error("Generate practice error:", err);
      alert("Failed to generate practice test. Please try again.");
    } finally {
      if (generationAbortRef.current === controller) generationAbortRef.current = null;
      setIsGenerating(false);
    }
  };

  const handleCancelPracticeGeneration = () => {
    generationAbortRef.current?.abort();
    generationAbortRef.current = null;
    setIsGenerating(false);
  };

  if (loading)
    return (
      <div className="library-loading">Loading your content library...</div>
    );

  const filteredLibrary = filterLibraryByField();
  const getVisibleChapters = (subject) => {
    const subjectId = SUBJECT_MAP[subject.name];
    if (!subjectId || syllabusView === "both") return subject.chapters || [];
    const source = syllabusView === "new" ? NEW_PTB_CHAPTERS : PTB_CHAPTERS;
    const allowedNames = new Set([
      ...(source[subjectId]?.part1 || []),
      ...(source[subjectId]?.part2 || []),
    ]);
    return (subject.chapters || []).filter((chapter) => allowedNames.has(chapter.name));
  };

  return (
    <div className="content-library-container">
      <div className="library-header">
        <h1>Content Library</h1>
        <p>Targeted practice: Select a chapter to master specific concepts.</p>
        <div className="library-header-controls">
          <div className="field-badge">Currently viewing: {userField}</div>
          <label className="library-syllabus-select">
            <span>Syllabus library</span>
            <select
              value={syllabusView}
              onChange={(event) => {
                setSyllabusView(event.target.value);
                setSelectedChapter(null);
              }}
            >
              <option value="old">Old Syllabus (2023–2025)</option>
              <option value="new">New Syllabus (2026+)</option>
              <option value="both">Both Syllabi</option>
            </select>
          </label>
        </div>
      </div>

      <div className="library-layout">
        <div className="subjects-panel">
          <h3>Your Subjects</h3>
          <div className="subjects-list">
            {filteredLibrary.map((subject) => {
              const mastery = getMastery(subject.name);
              const visibleChapters = getVisibleChapters(subject);
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
                      {visibleChapters.reduce(
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
                <div>
                  <h3>{selectedSubject.name} Chapters</h3>
                  <span className="chapter-syllabus-state">
                    {syllabusView === "both" ? "Showing old + new syllabus chapters" : `${syllabusView === "new" ? "New" : "Old"} syllabus chapters`}
                  </span>
                </div>
                <span className="subject-overall-stat">Overall Subject Mastery: {getMastery(selectedSubject.name)}%</span>
              </div>
              <div className="chapters-grid">
                {getVisibleChapters(selectedSubject).length > 0 ? (
                  getVisibleChapters(selectedSubject).map((chapter) => {
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
                    <p>No {syllabusView === "new" ? "new" : "old"} syllabus chapters are available for this subject yet.</p>
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

            {isGenerating ? (
              <div className="practice-generation-actions">
                <span className="practice-generating-label">Generating your practice session...</span>
                <button className="start-practice-btn" type="button" onClick={handleCancelPracticeGeneration}>
                  Cancel Generation
                </button>
              </div>
            ) : (
              <button className="start-practice-btn" type="button" onClick={handleStartPractice}>
                Start Practice session
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
