import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../utils/api";
import "./ContentLibrary.css";

const FIELD_DISTRIBUTIONS = {
  "Pre-Engineering": { math: 0.3, physics: 0.3, chemistry: 0.3, english: 0.1, biology: 0, computer: 0 },
  "Pre-Medical":     { biology: 0.3, physics: 0.3, chemistry: 0.3, english: 0.1, math: 0, computer: 0 },
  "ICS":             { computer: 0.3, math: 0.3, physics: 0.3, english: 0.1, chemistry: 0, biology: 0 },
};

const SUBJECT_MAP = {
  "Mathematics": "math",
  "Physics": "physics",
  "Chemistry": "chemistry",
  "Biology": "biology",
  "English": "english",
  "Computer Science": "computer",
};

export default function ContentLibrary({ user }) {
  const navigate = useNavigate();
  const [library, setLibrary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [questionCount, setQuestionCount] = useState(10);
  const [isGenerating, setIsGenerating] = useState(false);

  const userField = localStorage.getItem("field") || "Pre-Engineering";

  useEffect(() => {
    const fetchLibrary = async () => {
      try {
        const res = await API.get("/test/content-library");
        setLibrary(res.data);
      } catch (err) {
        console.error("Fetch library error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchLibrary();
  }, []);

  const filterLibraryByField = () => {
    const dist = FIELD_DISTRIBUTIONS[userField] || FIELD_DISTRIBUTIONS["Pre-Engineering"];
    return library.filter(subject => {
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

      navigate("/test/cbt", {
        state: {
          formData: {
            subjectName,
            questionCount: questions.length,
            questions: questions, // Passing questions directly to bypass generator in TestWindow
            marksPerQuestion,
            mode: "practice",
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

  if (loading) return <div className="library-loading">Loading your content library...</div>;

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
            {filteredLibrary.map(subject => (
              <button 
                key={subject.id}
                className={`subject-item ${selectedSubject?.id === subject.id ? "active" : ""}`}
                onClick={() => {
                  setSelectedSubject(subject);
                  setSelectedChapter(null);
                }}
              >
                <span>{subject.name}</span>
                <span className="count-badge">
                  {subject.chapters.reduce((acc, ch) => acc + ch._count.questions, 0)} Qs
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="chapters-panel">
          {selectedSubject ? (
            <>
              <div className="chapter-header">
                <h3>{selectedSubject.name} Chapters</h3>
              </div>
              <div className="chapters-grid">
                {selectedSubject.chapters.map(chapter => (
                  <div 
                    key={chapter.id} 
                    className={`chapter-card ${selectedChapter?.id === chapter.id ? "active" : ""}`}
                    onClick={() => setSelectedChapter(chapter)}
                  >
                    <div className="chapter-info">
                      <span className="chapter-name">{chapter.name}</span>
                      <span className="chapter-q-count">{chapter._count.questions} Questions</span>
                    </div>
                    {selectedChapter?.id === chapter.id && <div className="selection-indicator">✓</div>}
                  </div>
                ))}
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
            <p>Ready to tackle <strong>{selectedChapter.name}</strong>?</p>
            
            <div className="setting-row">
              <label>Number of Questions</label>
              <input 
                type="number" 
                value={questionCount} 
                onChange={(e) => setQuestionCount(Math.max(1, Number(e.target.value)))}
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
