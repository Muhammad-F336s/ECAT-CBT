import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import "./TestModeForm.css";

const SUBJECTS = [
  { id: "math", label: "Mathematics" },
  { id: "physics", label: "Physics" },
  { id: "chemistry", label: "Chemistry" },
  { id: "english", label: "English" },
  { id: "computer", label: "Computer Science" },
];
const PRE_ENGINEERING_DISTRIBUTION = {
  math: 0.3,
  physics: 0.3,
  chemistry: 0.3,
  english: 0.1,
};

const getPreEngineeringQuestions = (total) => {
  const math = Math.floor(total * PRE_ENGINEERING_DISTRIBUTION.math);
  const physics = Math.floor(total * PRE_ENGINEERING_DISTRIBUTION.physics);
  const chemistry = Math.floor(total * PRE_ENGINEERING_DISTRIBUTION.chemistry);
  const english = total - (math + physics + chemistry);

  return {
    math,
    physics,
    chemistry,
    english,
    computer: 0,
  };
};

const getDefaultSubjectQuestions = (field, total) => {
  if (field === "Pre-Engineering") {
    return getPreEngineeringQuestions(total);
  }

  return SUBJECTS.reduce((acc, subject) => {
    acc[subject.id] = 23;
    return acc;
  }, {});
};

const getDefaultSelectedSubjects = (field) => {
  const defaultSelection = SUBJECTS.reduce((acc, subject) => {
    acc[subject.id] = true;
    return acc;
  }, {});

  if (field === "Pre-Engineering") {
    defaultSelection.computer = false;
  }

  return defaultSelection;
};

const getAccessStatus = (user) => {
  if (!user) {
    return {
      label: "Standard Access",
      icon: "S",
      badge: "STANDARD",
      type: "standard",
    };
  }

  if (user.testAttemptsLimit === -1) {
    return {
      label: "Unlimited Access Enabled",
      icon: "∞",
      badge: "PREMIUM",
      type: "premium",
    };
  }

  const remaining = typeof user.testAttemptsLimit === "number" ? user.testAttemptsLimit : 0;
  return {
    label: `Standard Access • ${remaining} test${remaining === 1 ? "" : "s"} left`,
    icon: remaining > 0 ? remaining : "0",
    badge: "STANDARD",
    type: "standard",
  };
};

const SAMPLE_CHAPTERS = {
  math: ["Algebra", "Calculus", "Trigonometry", "Coordinate Geometry"],
  physics: ["Electricity", "Mechanics", "Optics", "Modern Physics"],
  chemistry: ["Organic Chemistry", "Physical Chemistry", "Inorganic Chemistry"],
  english: ["Comprehension", "Grammar", "Vocabulary", "Sentence Structure"],
  computer: ["Programming", "Data Structures", "Networks", "Web Development"],
};

const FIELDS = ["Pre-Engineering", "Pre-Medical", "ICS"];
const SYLLABUS_OPTIONS = [
  "Old Syllabus (Batch 2023-2025)",
  "New Syllabus (Batch 2026+)",
  "Mixed Syllabus (Custom %)",
];

export default function TestModeForm({ user }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get("mode") || "practice";
  const [studentName, setStudentName] = useState(user?.name || "");
  const [selectedField, setSelectedField] = useState(FIELDS[0]);
  const [syllabusVersion, setSyllabusVersion] = useState(SYLLABUS_OPTIONS[2]);
  const [newSyllabusPercent, setNewSyllabusPercent] = useState(50);
  const [numberOfQuestions, setNumberOfQuestions] = useState(100);
  const [selectedSubjects, setSelectedSubjects] = useState(getDefaultSelectedSubjects(FIELDS[0]));
  const [subjectQuestions, setSubjectQuestions] = useState(getDefaultSubjectQuestions(FIELDS[0], 100));
  const [difficultyLevel, setDifficultyLevel] = useState(5);
  const [chapterSearch, setChapterSearch] = useState("");
  const [expandedSubjects, setExpandedSubjects] = useState(
    SUBJECTS.reduce((acc, subject) => {
      acc[subject.id] = false;
      return acc;
    }, {}),
  );
  const [selectedChapters, setSelectedChapters] = useState({});
  const [negativeMarking, setNegativeMarking] = useState(false);

  const toggleSubject = (subjectId) => {
    setSelectedSubjects((prev) => {
      const nextSelection = {
        ...prev,
        [subjectId]: !prev[subjectId],
      };

      if (subjectId === "computer" && !prev[subjectId]) {
        nextSelection.chemistry = false;
      }

      if (subjectId === "chemistry" && !prev[subjectId] && prev.computer) {
        nextSelection.computer = false;
      }

      return nextSelection;
    });
  };

  const updateSubjectQuestions = (subjectId, value) => {
    const parsed = Number(value);
    if (Number.isNaN(parsed)) return;
    setSubjectQuestions((prev) => ({
      ...prev,
      [subjectId]: Math.max(0, Math.min(100, parsed)),
    }));
  };

  const toggleChapterGroup = (subjectId) => {
    setExpandedSubjects((prev) => ({
      ...prev,
      [subjectId]: !prev[subjectId],
    }));
  };

  const toggleChapter = (subjectId, chapter) => {
    setSelectedChapters((prev) => ({
      ...prev,
      [subjectId]: {
        ...(prev[subjectId] || {}),
        [chapter]: !prev[subjectId]?.[chapter],
      },
    }));
  };

  useEffect(() => {
    if (selectedField === "Pre-Engineering") {
      setSelectedSubjects((prev) => ({
        ...prev,
        computer: false,
      }));
      setSubjectQuestions(getDefaultSubjectQuestions("Pre-Engineering", numberOfQuestions));
    }
  }, [selectedField, numberOfQuestions]);

  const accessStatus = getAccessStatus(user);

  const handleSubmit = (event) => {
    event.preventDefault();
    const selectedSubjectIds = SUBJECTS.filter((subject) => selectedSubjects[subject.id])
      .map((subject) => subject.id);

    const formData = {
      studentName,
      selectedField,
      syllabusVersion,
      newSyllabusPercent,
      selectedSubjects: selectedSubjectIds,
      subjectQuestions,
      numberOfQuestions,
      difficultyLevel,
      selectedChapters,
      negativeMarking,
      mode,
    };

    navigate("/test/cbt", {
      state: { formData },
    });
  };

  return (
    <div className="test-mode-form-page">
      <div className="form-panel full-form-panel">
        <div className="top-banner">
          <span className="top-banner-label">{accessStatus.label}</span>
          <span className="top-banner-icon">{accessStatus.icon}</span>
        </div>

        <div className="form-heading">
          <h1>AI-Powered ECAT Test</h1>
          <span className={`badge badge-${accessStatus.type}`}>{accessStatus.badge}</span>
        </div>

        <div className="scheme-panel">
          <div className="scheme-title">Paper Scheme (Active Chapters)</div>
          <div className="scheme-chips">
            {SUBJECTS.filter((subject) => selectedSubjects[subject.id]).map((subject) => (
              <span key={subject.id} className="scheme-chip">Subject: {subject.label}</span>
            ))}
          </div>
          <button
            type="button"
            className="scheme-reset"
            onClick={() => {
              setSelectedChapters({});
              setSelectedSubjects(getDefaultSelectedSubjects(selectedField));
              setSubjectQuestions(getDefaultSubjectQuestions(selectedField, numberOfQuestions));
            }}
          >
            Reset Scheme
          </button>
        </div>

        <form className="mode-form full-form" onSubmit={handleSubmit}>
          <div className="form-row">
            <label>
              Student Name
              <input
                type="text"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="Enter your full name"
                required
              />
            </label>
          </div>

          <div className="form-row form-row--grid">
            <label>
              Select Field
              <select value={selectedField} onChange={(e) => setSelectedField(e.target.value)}>
                {FIELDS.map((field) => (
                  <option key={field} value={field}>{field}</option>
                ))}
              </select>
            </label>
            <label>
              Syllabus Version
              <select value={syllabusVersion} onChange={(e) => setSyllabusVersion(e.target.value)}>
                {SYLLABUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
          </div>

          {syllabusVersion === "Mixed Syllabus (Custom %)" && (
            <div className="form-row slider-row">
              <div>
                <label>
                  New Syllabus Percentage (%): {newSyllabusPercent}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={newSyllabusPercent}
                  onChange={(e) => setNewSyllabusPercent(Number(e.target.value))}
                />
              </div>
            </div>
          )}

          <div className="form-row subjects-panel">
            <div className="subjects-header">
              <h2>Select Subjects & MCQs per Subject</h2>
            </div>
            <div className="subjects-list">
              {SUBJECTS.map((subject) => (
                <div key={subject.id} className="subject-row">
                  <label className="subject-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedSubjects[subject.id]}
                      onChange={() => toggleSubject(subject.id)}
                    />
                    <span>{subject.label}</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={subjectQuestions[subject.id]}
                    onChange={(e) => updateSubjectQuestions(subject.id, e.target.value)}
                    className="subject-quantity"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="form-row form-row--grid">
            <label>
              Number of Questions (1-100)
              <input
                type="number"
                min="1"
                max="100"
                value={numberOfQuestions}
                onChange={(e) => setNumberOfQuestions(Number(e.target.value))}
                required
              />
            </label>
            <label className="slider-label">
              Difficulty Level: {difficultyLevel}
              <input
                type="range"
                min="1"
                max="10"
                value={difficultyLevel}
                onChange={(e) => setDifficultyLevel(Number(e.target.value))}
              />
            </label>
          </div>

          <div className="form-row chapter-panel">
            <div className="chapter-header">
              <h2>Select Chapters (Optional - Leave empty for full subject test)</h2>
              <input
                type="text"
                placeholder="Search chapters..."
                value={chapterSearch}
                onChange={(e) => setChapterSearch(e.target.value)}
              />
            </div>
            <div className="chapter-groups">
              {SUBJECTS.map((subject) => {
                const availableChapters = SAMPLE_CHAPTERS[subject.id].filter((chapter) =>
                  chapter.toLowerCase().includes(chapterSearch.toLowerCase()),
                );
                return (
                  <div key={subject.id} className="chapter-group">
                    <button
                      type="button"
                      className="chapter-group-toggle"
                      onClick={() => toggleChapterGroup(subject.id)}
                    >
                      {subject.label}
                      <span>{expandedSubjects[subject.id] ? "−" : "+"}</span>
                    </button>
                    {expandedSubjects[subject.id] && (
                      <div className="chapter-options">
                        {availableChapters.map((chapter) => (
                          <label key={chapter} className="chapter-option">
                            <input
                              type="checkbox"
                              checked={Boolean(selectedChapters[subject.id]?.[chapter])}
                              onChange={() => toggleChapter(subject.id, chapter)}
                            />
                            <span>{chapter}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="form-row form-row--checkbox">
            <label>
              <input
                type="checkbox"
                checked={negativeMarking}
                onChange={(e) => setNegativeMarking(e.target.checked)}
              />
              Enable Negative Marking (-1 per wrong answer)
            </label>
          </div>

          <div className="form-actions full-actions">
            <button type="button" className="secondary-btn" onClick={() => navigate("/test")}>Back</button>
            <button type="submit" className="primary-btn">
              Generate & Start Test ({numberOfQuestions} MCQs)
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
