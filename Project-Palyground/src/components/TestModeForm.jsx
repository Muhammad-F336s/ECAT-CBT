import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import "./TestModeForm.css";

const SUBJECTS = [
  { id: "math", label: "Mathematics" },
  { id: "physics", label: "Physics" },
  { id: "chemistry", label: "Chemistry" },
  { id: "biology", label: "Biology" },
  { id: "english", label: "English" },
  { id: "computer", label: "Computer Science" },
];
// Field-specific question distributions
const FIELD_DISTRIBUTIONS = {
  "Pre-Engineering": { math: 0.3, physics: 0.3, chemistry: 0.3, english: 0.1, biology: 0, computer: 0 },
  "Pre-Medical":     { biology: 0.3, physics: 0.3, chemistry: 0.3, english: 0.1, math: 0, computer: 0 },
  "ICS":             { computer: 0.3, math: 0.3, physics: 0.3, english: 0.1, chemistry: 0, biology: 0 },
};

const getDefaultSubjectQuestions = (field, total) => {
  const dist = FIELD_DISTRIBUTIONS[field];
  if (!dist) {
    return SUBJECTS.reduce((acc, s) => { acc[s.id] = Math.floor(total / SUBJECTS.length); return acc; }, {});
  }
  const result = {};
  let assigned = 0;
  const ids = Object.keys(dist);
  ids.forEach((id, i) => {
    if (i === ids.length - 1) {
      // give remainder to last non-zero subject
      result[id] = dist[id] > 0 ? total - assigned : 0;
    } else {
      result[id] = Math.floor(total * dist[id]);
      assigned += result[id];
    }
  });
  return result;
};

const getDefaultSelectedSubjects = (field) => {
  const dist = FIELD_DISTRIBUTIONS[field] || {};
  return SUBJECTS.reduce((acc, subject) => {
    // Select subject by default only if it has a non-zero distribution for this field
    acc[subject.id] = (dist[subject.id] || 0) > 0;
    return acc;
  }, {});
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

const PTB_CHAPTERS = {
  math: {
    part1: [
      "Number Systems",
      "Sets, Functions and Groups",
      "Matrices and Determinants",
      "Quadratic Equations",
      "Partial Fractions",
      "Sequences and Series",
      "Permutation, Combination and Probability",
      "Mathematical Induction and Binomial Theorem",
      "Fundamentals of Trigonometry",
      "Trigonometric Identities",
      "Trigonometric Functions and their Graphs",
      "Application of Trigonometry",
      "Inverse Trigonometric Functions",
      "Solutions of Trigonometric Equations",
    ],
    part2: [
      "Functions and Limits",
      "Differentiation",
      "Integration",
      "Introduction to Analytic Geometry",
      "Linear Inequalities and Linear Programming",
      "Conic Section",
      "Vectors (Math)",
    ],
  },
  physics: {
    part1: [
      "Measurements",
      "Vectors and Equilibrium",
      "Motion and Force",
      "Work and Energy",
      "Circular Motion",
      "Fluid Dynamics",
      "Oscillations",
      "Waves",
      "Physical Optics",
      "Optical Instruments",
      "Heat and Thermodynamics",
    ],
    part2: [
      "Electrostatics",
      "Current Electricity",
      "Electromagnetism",
      "Electromagnetic Induction",
      "Alternating Current",
      "Physics of Solids",
      "Electronics",
      "Dawn of Modern Physics",
      "Atomic Spectra",
      "Nuclear Physics",
    ],
  },
  chemistry: {
    part1: [
      "Basic Concepts",
      "Experimental Techniques in Chemistry",
      "Gases",
      "Liquids and Solids",
      "Atomic Structure",
      "Chemical Bonding",
      "Thermochemistry",
      "Chemical Equilibrium",
      "Solutions",
      "Electrochemistry",
      "Chemical Kinetics",
    ],
    part2: [
      "Periodic Classification of Elements and Periodicity",
      "s-Block Elements",
      "d & f-Block Elements",
      "Group III-A and Group IV-A Elements",
      "Group V-A and Group VI-A Elements",
      "Halogens and Noble Gases",
      "Fundamental Principles of Organic Chemistry",
      "Aliphatic Hydrocarbons",
      "Aromatic Hydrocarbons",
      "Alkyl Halides",
      "Alcohols, Phenols and Ethers",
      "Aldehydes and Ketones",
      "Carboxylic Acids",
      "Macromolecules",
      "Common Chemical Industries in Pakistan",
      "Environmental Chemistry",
    ],
  },
  biology: {
    part1: [
      "Introduction to Biology",
      "Biological Molecules",
      "Enzymes",
      "The Cell",
      "Variety of Life",
      "Kingdom Prokaryotae (Monera)",
      "The Kingdom Protista (Protoctista)",
      "Fungi (The Kingdom of Recyclers)",
      "Kingdom Plantae",
      "Kingdom Animalia",
      "Bioenergetics",
      "Nutrition",
      "Gaseous Exchange",
      "Transport",
    ],
    part2: [
      "Homeostasis",
      "Support and Movements",
      "Coordination and Control",
      "Reproduction",
      "Growth and Development",
      "Chromosomes and DNA",
      "Cell Cycle",
      "Variation and Genetics",
      "Biotechnology",
      "Evolution",
      "Ecosystem",
      "Some Major Ecosystems",
      "Man and His Environment",
    ],
  },
  english: {
    part1: [
      "Grammar & Parts of Speech",
      "Vocabulary & Synonyms",
      "Sentence Correction",
      "Reading Comprehension",
    ],
    part2: [],
  },
  computer: {
    part1: [
      "Basics of Information Technology",
      "Information Networks",
      "Data Communications",
      "Applications and Uses of Computers",
      "Computer Architecture",
      "Security, Copyright and the Law",
      "Windows Operating System",
      "Word Processing",
      "Spreadsheet",
      "Internet Browsing and E-mail",
    ],
    part2: [
      "Data Basics",
      "Basic Concepts and Terminology of Databases",
      "Database Design Process",
      "Data Integrity and Normalization",
      "Introduction to Microsoft Access",
      "MS Access Forms and Reports",
      "MS Access Queries",
      "Getting Started with C",
      "Elements of C",
      "Input and Output in C",
      "Decision Constructs in C",
      "Loop Constructs in C",
      "Functions in C",
      "File Handling in C",
    ],
  },
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
  const [expandedParts, setExpandedParts] = useState({});
  const [negativeMarking, setNegativeMarking] = useState(false);

  const currentDist = FIELD_DISTRIBUTIONS[selectedField] || {};
  const visibleSubjects = SUBJECTS.filter((s) => (currentDist[s.id] || 0) > 0);

  const togglePart = (subjectId, partKey) => {
    const key = `${subjectId}_${partKey}`;
    setExpandedParts((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleAllChaptersInPart = (subjectId, chapters, isSelected) => {
    setSelectedChapters((prev) => {
      const current = { ...(prev[subjectId] || {}) };
      chapters.forEach((ch) => { current[ch] = !isSelected; });
      return { ...prev, [subjectId]: current };
    });
  };

  const toggleSubject = (subjectId) => {
    setSelectedSubjects((prev) => ({
      ...prev,
      [subjectId]: !prev[subjectId],
    }));
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
    setSelectedSubjects(getDefaultSelectedSubjects(selectedField));
    setSubjectQuestions(getDefaultSubjectQuestions(selectedField, numberOfQuestions));
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

          <div className="form-row">
            <label>
              Select Field
              <select value={selectedField} onChange={(e) => setSelectedField(e.target.value)}>
                {FIELDS.map((field) => (
                  <option key={field} value={field}>{field}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="form-row">
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
            <div className="form-row">
              <label>
                New Syllabus Percentage (%): {newSyllabusPercent}%
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={newSyllabusPercent}
                  onChange={(e) => setNewSyllabusPercent(Number(e.target.value))}
                />
              </label>
              <span className="slider-hint">The remaining {100 - newSyllabusPercent}% will be from the Old Syllabus.</span>
            </div>
          )}

          <div className="form-row subjects-panel">
            <div className="subjects-header">
              <h2>Select Subjects & MCQs per Subject</h2>
            </div>
            <div className="subjects-list">
              {visibleSubjects.map((subject) => (
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

          <div className="form-row">
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
          </div>

          <div className="form-row">
            <label>
              Difficulty Level (1-10): {difficultyLevel}
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
              <h2>Select Chapters <span className="chapter-header-sub">(Optional — leave empty for full subject test)</span></h2>
              <input
                type="text"
                placeholder="Search chapters..."
                value={chapterSearch}
                onChange={(e) => setChapterSearch(e.target.value)}
              />
            </div>
            <div className="chapter-groups">
              {visibleSubjects.map((subject) => {
                const subChapters = PTB_CHAPTERS[subject.id] || { part1: [], part2: [] };
                const parts = [
                  { key: "part1", label: "Part 1 — Class 11", chapters: subChapters.part1 || [] },
                  { key: "part2", label: "Part 2 — Class 12", chapters: subChapters.part2 || [] },
                ];
                // Filter by search
                const filteredParts = parts.map((p) => ({
                  ...p,
                  chapters: p.chapters.filter((ch) =>
                    ch.toLowerCase().includes(chapterSearch.toLowerCase())
                  ),
                })).filter((p) => p.chapters.length > 0 || !chapterSearch);

                return (
                  <div key={subject.id} className="chapter-group">
                    <button
                      type="button"
                      className="chapter-group-toggle"
                      onClick={() => toggleChapterGroup(subject.id)}
                    >
                      <span className="cgt-label">{subject.label}</span>
                      <span className="cgt-arrow">{expandedSubjects[subject.id] ? "▲" : "▼"}</span>
                    </button>

                    {expandedSubjects[subject.id] && (
                      <div className="part-groups">
                        {filteredParts.map((part) => {
                          if (part.chapters.length === 0) return null;
                          const partKey = `${subject.id}_${part.key}`;
                          const isPartOpen = expandedParts[partKey];
                          const allSelected = part.chapters.every(
                            (ch) => selectedChapters[subject.id]?.[ch]
                          );
                          const someSelected = part.chapters.some(
                            (ch) => selectedChapters[subject.id]?.[ch]
                          );
                          return (
                            <div key={part.key} className="part-group">
                              <div className="part-group-row">
                                <label className="part-check-label">
                                  <input
                                    type="checkbox"
                                    checked={allSelected}
                                    ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                                    onChange={() => toggleAllChaptersInPart(subject.id, part.chapters, allSelected)}
                                  />
                                  <span className="part-label-text">{part.label}</span>
                                </label>
                                <button
                                  type="button"
                                  className="part-toggle-btn"
                                  onClick={() => togglePart(subject.id, part.key)}
                                >
                                  {isPartOpen ? "▲" : "▼"}
                                </button>
                              </div>
                              {isPartOpen && (
                                <div className="chapter-options">
                                  {part.chapters.map((chapter) => (
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
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="form-row neg-marking-row">
            <label className="neg-marking-label">
              <input
                type="checkbox"
                checked={negativeMarking}
                onChange={(e) => setNegativeMarking(e.target.checked)}
                className="neg-marking-check"
              />
              <span className="neg-marking-text">
                Enable Negative Marking (-1 per wrong answer)
              </span>
            </label>
          </div>

          <div className="form-actions">
            <button type="submit" className="primary-btn">
              Generate &amp; Start Test ({numberOfQuestions} MCQs)
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
