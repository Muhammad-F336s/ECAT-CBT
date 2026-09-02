import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ChevronDown } from "lucide-react";
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

// Keep the per-subject counts equal to the requested total. When students turn
// subjects off, their share is reassigned to the subjects that remain selected.
const getSubjectQuestionsForSelection = (field, total, selectedSubjects) => {
  const selected = SUBJECTS.filter((subject) => selectedSubjects[subject.id]);
  const result = SUBJECTS.reduce((acc, subject) => {
    acc[subject.id] = 0;
    return acc;
  }, {});

  if (selected.length === 0) return result;

  const distribution = FIELD_DISTRIBUTIONS[field] || {};
  const totalWeight = selected.reduce(
    (sum, subject) => sum + (distribution[subject.id] || 0),
    0,
  );
  const weightedSubjects = selected.map((subject) => ({
    id: subject.id,
    // A field without configured weights is split evenly between its selections.
    weight: totalWeight > 0 ? distribution[subject.id] || 0 : 1,
  }));
  const divisor = weightedSubjects.reduce((sum, subject) => sum + subject.weight, 0);

  let assigned = 0;
  const remainders = weightedSubjects.map((subject) => {
    const exact = (total * subject.weight) / divisor;
    const count = Math.floor(exact);
    result[subject.id] = count;
    assigned += count;
    return { id: subject.id, remainder: exact - count };
  });

  // Assign leftover questions to the largest fractional shares so the final
  // count always matches the user's requested total exactly.
  remainders
    .sort((a, b) => b.remainder - a.remainder)
    .slice(0, total - assigned)
    .forEach(({ id }) => { result[id] += 1; });

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
  
  if (user.isDemoAccount) {
    return {
      label: `Demo Account • ${remaining} test${remaining === 1 ? "" : "s"} left before expiration`,
      icon: remaining > 0 ? remaining : "0",
      badge: "DEMO",
      type: "premium",
    };
  }
  return {
    label: `Standard Access • ${remaining} test${remaining === 1 ? "" : "s"} left`,
    icon: remaining > 0 ? remaining : "0",
    badge: "STANDARD",
    type: "standard",
  };
};

// Shared with Content Library so both pages apply the exact same syllabus list.
// eslint-disable-next-line react-refresh/only-export-components
export const PTB_CHAPTERS = {
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

// eslint-disable-next-line react-refresh/only-export-components
export const NEW_PTB_CHAPTERS = {
  physics: {
    part1: [
      "Measurements", "Force and Motion", "Circular and Rotational Motion", "Work, Energy and Power", "Solids and Fluid Dynamics", "Heat and Thermodynamics", "Waves and Vibrations", "Physical Optics and Gravitational Waves", "Electrostatics and Current Electricity", "Electromagnetism", "Special Theory of Relativity", "Nuclear and Particle Physics"
    ],
    part2: [
      "Thermal Physics", "Simple Harmonic Motion", "Physical Optics", "Electrostatics", "Alternating Current", "Quantum Physics", "Nuclear and Particle Physics", "Medical Physics", "Space and Environment"
    ]
  },
  chemistry: {
    part1: [
      "Periodic Table and Periodic Properties", "Atomic Structure", "Chemical Bonding", "Stoichiometry", "States and Phases of Matter", "Chemical Energetics", "Reaction Kinetics", "Chemical Equilibrium", "Acid-Base Chemistry", "Electrochemistry", "Hydrocarbons", "Nitrogen and Sulfur", "Halogens", "Atmosphere", "Basic Separation Techniques", "Lab Safety and Practical Skills"
    ],
    part2: [
      "Group 2 Elements", "Transition Metals", "Basics of Organic Chemistry", "Aromatic Hydrocarbons", "Halogenoalkanes", "Hydroxy Compounds", "Carbonyl Compounds and Carboxylic Acids", "Organic Nitrogen Compounds", "Organic Synthesis", "Polymers", "Biochemistry", "Chromatography", "Spectroscopy-1", "Spectroscopy-2 (NMR)", "Materials and Energy", "Medicine, Agriculture and Industry", "Water"
    ]
  },
  biology: {
    part1: [
      "Biodiversity and Classification", "Bacteria and Viruses", "Cells and Subcellular Organelles", "Molecular Biology", "Enzymes", "Bioenergetics", "Structural and Computational Biology", "Plant Physiology", "Human Digestive System", "Human Respiratory System", "Human Circulatory System", "Human Skeletal and Muscular Systems"
    ],
    part2: [
      "Homeostasis (Thermoregulation and Osmoregulation)", "Human Urinary System (Excretion)", "Human Nervous System", "Human Endocrine System", "Human Reproductive System", "Inheritance", "Chromosome and DNA", "Biotechnology", "Immunity", "Biostatistics", "Pharmacology", "Evolution", "Ecology"
    ]
  },
  math: {
    part1: [
      "Complex Numbers", "Functions and Graphs", "Theory of Quadratic Functions", "Matrices and Determinants", "Partial Fractions", "Sequences and Series", "Permutations and Combinations", "Mathematical Induction and Binomial Theorem", "Division of Polynomials", "Trigonometric Identities", "Trigonometric Functions and their Graphs", "Limit and Continuity", "Differentiation", "Vectors in Space"
    ],
    part2: [
      "Graphical Representation of Functions", "Further Differentiation", "Integration", "Differential Equations", "Analytical Geometry", "Conic Section", "Kinematics", "Numerical Method", "Inverse Trigonometric Functions and Their Graphs", "Solution of Trigonometric Equations", "Vector Valued Functions and Their Differentiations"
    ]
  },
  computer: {
    part1: [
      "Introduction to Software Development", "Python Programming", "Algorithms and Problem Solving", "Computational Structures", "Data Analytics", "Emerging Technologies", "Legal and Ethical Aspects of Computing System", "Online Research and Digital Literacy", "Entrepreneurship in Digital Age"
    ],
    part2: [
      "Computer Networks", "Computational Thinking & Algorithms", "Object Oriented Programming Using Python", "Development of Graphical User Interface (GUI)", "Code Testing and Debugging", "Data and Databases", "Software Testing", "Applications of Computer Science", "Cybersecurity and Safe Digital Collaboration"
    ]
  },
  english: {
    part1: [
      "Grammar & Parts of Speech", "Vocabulary & Synonyms", "Sentence Correction", "Reading Comprehension"
    ],
    part2: []
  }
};

const FIELDS = ["Pre-Engineering", "Pre-Medical", "ICS"];
const SYLLABUS_OPTIONS = [
  "Old Syllabus (Batch 2023-2025)",
  "New Syllabus (Batch 2026+)",
  "Both Syllabi (Custom Mix %)",
];

const getChaptersForSyllabus = (subjectId, syllabusVersion) => {
  if (syllabusVersion.includes("New")) return NEW_PTB_CHAPTERS[subjectId] || { part1: [], part2: [] };
  if (!syllabusVersion.includes("Both")) return PTB_CHAPTERS[subjectId] || { part1: [], part2: [] };

  const oldChapters = PTB_CHAPTERS[subjectId] || { part1: [], part2: [] };
  const newChapters = NEW_PTB_CHAPTERS[subjectId] || { part1: [], part2: [] };
  return {
    part1: [...new Set([...(oldChapters.part1 || []), ...(newChapters.part1 || [])])],
    part2: [...new Set([...(oldChapters.part2 || []), ...(newChapters.part2 || [])])],
  };
};

const getSavedScheme = () => {
  const saved = localStorage.getItem("savedPaperScheme");
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      // Invalid JSON in localStorage — return null
    }
  }
  return null;
};

export default function TestModeForm({ user }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get("mode") || "practice";
  
  const savedScheme = getSavedScheme();

  const [studentName, setStudentName] = useState(() => localStorage.getItem("studentName") || user?.name || "");
  const [selectedField, setSelectedField] = useState(() => savedScheme?.selectedField || localStorage.getItem("field") || FIELDS[0]);
  const [syllabusVersion, setSyllabusVersion] = useState(() => {
    const savedVersion = savedScheme?.syllabusVersion;
    return savedVersion === "Mixed Syllabus (Custom %)" ? SYLLABUS_OPTIONS[2] : savedVersion || SYLLABUS_OPTIONS[2];
  });
  const [newSyllabusPercent, setNewSyllabusPercent] = useState(() => savedScheme?.newSyllabusPercent || 50);
  const [numberOfQuestions, setNumberOfQuestions] = useState(() => savedScheme?.numberOfQuestions || 100);
  const [selectedSubjects, setSelectedSubjects] = useState(() => savedScheme?.selectedSubjects || getDefaultSelectedSubjects(savedScheme?.selectedField || localStorage.getItem("field") || FIELDS[0]));
  const [subjectQuestions, setSubjectQuestions] = useState(() => savedScheme?.subjectQuestions || getDefaultSubjectQuestions(savedScheme?.selectedField || localStorage.getItem("field") || FIELDS[0], savedScheme?.numberOfQuestions || 100));
  const [difficultyLevel, setDifficultyLevel] = useState(() => savedScheme?.difficultyLevel || 5);
  const [chapterSearch, setChapterSearch] = useState("");
  const [expandedSubjects, setExpandedSubjects] = useState(
    SUBJECTS.reduce((acc, subject) => {
      acc[subject.id] = false;
      return acc;
    }, {}),
  );
  const [selectedChapters, setSelectedChapters] = useState(() => savedScheme?.selectedChapters || {});
  const [expandedParts, setExpandedParts] = useState({});
  const [negativeMarking, setNegativeMarking] = useState(() => savedScheme?.negativeMarking || false);

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
    const nextSubjects = {
      ...selectedSubjects,
      [subjectId]: !selectedSubjects[subjectId],
    };
    setSelectedSubjects(nextSubjects);
    setSubjectQuestions(
      getSubjectQuestionsForSelection(selectedField, numberOfQuestions, nextSubjects),
    );
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

  // Persist selections on change (Paper Scheme Persistency)
  useEffect(() => {
    const scheme = {
      selectedField,
      syllabusVersion,
      newSyllabusPercent,
      numberOfQuestions,
      selectedSubjects,
      subjectQuestions,
      difficultyLevel,
      selectedChapters,
      negativeMarking
    };
    localStorage.setItem("savedPaperScheme", JSON.stringify(scheme));
  }, [
    selectedField,
    syllabusVersion,
    newSyllabusPercent,
    numberOfQuestions,
    selectedSubjects,
    subjectQuestions,
    difficultyLevel,
    selectedChapters,
    negativeMarking
  ]);

  const accessStatus = getAccessStatus(user);

  const handleSubmit = (event) => {
    event.preventDefault();
    
    // Persist Student Name & Field directly
    localStorage.setItem("studentName", studentName);
    localStorage.setItem("field", selectedField);

    // Map UI values to exact API Payload specification
    let syllabusType = "mixed";
    if (syllabusVersion.includes("Old")) syllabusType = "old";
    else if (syllabusVersion.includes("New")) syllabusType = "new";

    const subjectsPayload = visibleSubjects
      .filter((s) => selectedSubjects[s.id])
      .map((s) => ({
        name: s.label,
        count: subjectQuestions[s.id] || 0
      }));

    const chaptersPayload = [];
    Object.keys(selectedChapters).forEach((subjectId) => {
      const subjectLabel = SUBJECTS.find(s => s.id === subjectId)?.label || subjectId;
      Object.keys(selectedChapters[subjectId] || {}).forEach((chapterName) => {
        if (selectedChapters[subjectId][chapterName]) {
          chaptersPayload.push({
            subject: subjectLabel,
            name: chapterName,
            topics: []
          });
        }
      });
    });

    const formData = {
      name: studentName,
      field: selectedField,
      syllabusType,
      newSyllabusPercentage: newSyllabusPercent,
      subjects: subjectsPayload,
      questionCount: numberOfQuestions,
      difficulty: difficultyLevel,
      chapters: chaptersPayload,
      topicBatches: [],
      negativeMarking,
      mode,
    };

    localStorage.removeItem("ecat_active_test_session");

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
        {user?.isDemoAccount && (
          <div style={{ background: "#fffbeb", border: "1px solid #f59e0b", color: "#b45309", padding: "12px", borderRadius: "8px", margin: "16px 0", textAlign: "center", fontWeight: "bold" }}>
            You are using a demo account which will expire when your test limit is reached.
            {(user.testAttemptsLimit <= 0) && " Your demo account has expired. Please contact admin."}
          </div>
        )}

        <div className="form-heading">
          <div className="form-heading-title">
            <button type="button" className="form-dashboard-back" onClick={() => navigate("/dashboard")}>
              ← Back to Dashboard
            </button>
            <h1>AI-Powered ECAT Test</h1>
          </div>
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
              <select
                value={selectedField}
                onChange={(e) => {
                  const field = e.target.value;
                  setSelectedField(field);
                  setSelectedSubjects(getDefaultSelectedSubjects(field));
                  setSubjectQuestions(getDefaultSubjectQuestions(field, numberOfQuestions));
                }}
              >
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

          {syllabusVersion === "Both Syllabi (Custom Mix %)" && (
            <div className="form-row">
              <label>
                New Syllabus Percentage: {newSyllabusPercent}%
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={newSyllabusPercent}
                  onChange={(e) => setNewSyllabusPercent(Number(e.target.value))}
                />
              </label>
              <span className="slider-hint">Your test will include {newSyllabusPercent}% new-syllabus and {100 - newSyllabusPercent}% old-syllabus MCQs. Both chapter lists are available below.</span>
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
                onChange={(e) => {
                  const total = Number(e.target.value);
                  setNumberOfQuestions(total);
                  setSubjectQuestions(
                    getSubjectQuestionsForSelection(selectedField, total, selectedSubjects),
                  );
                }}
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
                const subChapters = getChaptersForSyllabus(subject.id, syllabusVersion);
                const subjectChapters = [...(subChapters.part1 || []), ...(subChapters.part2 || [])];
                const isEntireSubjectSelected = subjectChapters.length > 0 && subjectChapters.every(
                  (chapter) => selectedChapters[subject.id]?.[chapter],
                );
                const isSubjectPartiallySelected = subjectChapters.some(
                  (chapter) => selectedChapters[subject.id]?.[chapter],
                );
                const selectedChapterCount = Object.values(selectedChapters[subject.id] || {}).filter(Boolean).length;
                const parts = [
                  { key: "part1", label: "Part 1 — Class 11", chapters: subChapters.part1 || [] },
                  { key: "part2", label: "Part 2 — Class 12", chapters: subChapters.part2 || [] },
                ];
                const filteredParts = parts.map((p) => ({
                  ...p,
                  chapters: p.chapters.filter((ch) =>
                    ch.toLowerCase().includes(chapterSearch.toLowerCase())
                  ),
                })).filter((p) => p.chapters.length > 0 || !chapterSearch);

                return (
                  <div
                    key={subject.id}
                    className={`chapter-group ${expandedSubjects[subject.id] ? "is-open" : ""} ${selectedChapterCount ? "has-selections" : ""}`}
                  >
                    <div className="chapter-group-heading">
                      <label className="subject-all-check" title={`Select all ${subject.label} chapters`}>
                        <input
                          type="checkbox"
                          checked={isEntireSubjectSelected}
                          ref={(el) => { if (el) el.indeterminate = isSubjectPartiallySelected && !isEntireSubjectSelected; }}
                          onChange={() => toggleAllChaptersInPart(subject.id, subjectChapters, isEntireSubjectSelected)}
                        />
                        <span className="sr-only">Select all {subject.label} chapters</span>
                      </label>
                      <button
                        type="button"
                        className="chapter-group-toggle"
                        onClick={() => toggleChapterGroup(subject.id)}
                        aria-expanded={expandedSubjects[subject.id]}
                      >
                        <span className="cgt-label">{subject.label}</span>
                        <span className="cgt-meta">
                          <span className="cgt-count">
                            {selectedChapterCount ? `${selectedChapterCount} selected` : "All chapters"}
                          </span>
                          <span className="cgt-arrow" aria-hidden="true"><ChevronDown size={16} strokeWidth={2.8} /></span>
                        </span>
                      </button>
                    </div>

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
                                  aria-expanded={isPartOpen}
                                  aria-label={`${isPartOpen ? "Collapse" : "Expand"} ${part.label}`}
                                >
                                  <ChevronDown size={15} strokeWidth={2.8} />
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
            <button 
              type="submit" 
              className="primary-btn"
              disabled={user && user.testAttemptsLimit !== -1 && user.testAttemptsLimit <= 0}
            >
              Generate &amp; Start Test ({numberOfQuestions} MCQs)
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
