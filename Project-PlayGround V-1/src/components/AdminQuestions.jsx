import { useEffect, useState } from "react";
import {
  FaPlus,
  FaSearch,
  FaTrash,
  FaEdit,
  FaBook,
  FaList,
  FaRedo,
} from "react-icons/fa";
import API from "../utils/api";
import "./AdminApprovals.css";

export default function AdminQuestions() {
  const [subjects, setSubjects] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [filterSubject, setFilterSubject] = useState("");
  const [filterChapter, setFilterChapter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Editor Modal Settings
  const [showModal, setShowModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [formData, setFormData] = useState({
    statement: "",
    chapterId: "",
    options: ["", "", "", "", ""],
    correctAnswer: 0,
    explanation: "",
  });

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [subsRes, questRes] = await Promise.all([
        API.get("/admin/subjects"),
        API.get("/admin/questions"),
      ]);
      setSubjects(subsRes.data || []);
      setQuestions(questRes.data || []);
    } catch (err) {
      console.error("Failed to load question pool:", err);
      setError("Unable to load subjects or questions database.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Sync MathJax on questions list update
  useEffect(() => {
    if (window.MathJax && window.MathJax.typesetPromise) {
      window.MathJax.typesetPromise().catch((err) =>
        console.log("MathJax error in admin question view:", err)
      );
    }
  }, [questions, showModal]);

  const handleCreateSubject = async () => {
    const name = window.prompt("Enter name of the Subject (e.g. Mathematics, Chemistry):");
    if (!name || !name.trim()) return;

    try {
      await API.post("/admin/subjects", { name: name.trim() });
      setMessage(`Subject "${name}" created successfully.`);
      loadData();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to create subject.");
    }
  };

  const handleCreateChapter = async () => {
    if (!subjects.length) {
      window.alert("Please create a Subject first.");
      return;
    }

    const name = window.prompt("Enter name of the Chapter (e.g. Matrices, Hydrocarbons):");
    if (!name || !name.trim()) return;

    const subNames = subjects.map((s, idx) => `${idx + 1}. ${s.name}`).join("\n");
    const subChoice = window.prompt(`Select Subject by typing the corresponding number:\n\n${subNames}`);
    if (!subChoice) return;

    const subIdx = Number(subChoice) - 1;
    const selectedSub = subjects[subIdx];
    if (!selectedSub) {
      window.alert("Invalid Subject selection.");
      return;
    }

    const part = window.prompt("Enter syllabus part label (e.g. part1 or part2, or leave blank):", "part1");

    try {
      await API.post("/admin/chapters", {
        name: name.trim(),
        subjectId: selectedSub.id,
        part: part?.trim() || null,
      });
      setMessage(`Chapter "${name}" created under ${selectedSub.name}.`);
      loadData();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to create chapter.");
    }
  };

  const handleDeleteQuestion = async (id) => {
    if (!window.confirm("Delete this question from database pool permanently?")) return;
    try {
      await API.delete(`/admin/questions/${id}`);
      setMessage("Question deleted successfully.");
      setQuestions((prev) => prev.filter((q) => q.id !== id));
    } catch (err) {
      setError("Failed to delete question.");
    }
  };

  const handleOpenAddModal = () => {
    setEditingQuestion(null);
    setFormData({
      statement: "",
      chapterId: subjects[0]?.chapters[0]?.id || "",
      options: ["", "", "", "", ""],
      correctAnswer: 0,
      explanation: "",
    });
    setShowModal(true);
  };

  const handleOpenEditModal = (q) => {
    setEditingQuestion(q);
    const correctIdx = q.options.findIndex((opt) => opt.text === q.correctAnswer);
    setFormData({
      statement: q.statement,
      chapterId: q.chapterId,
      options: q.options.map((opt) => opt.text),
      correctAnswer: correctIdx === -1 ? 0 : correctIdx,
      explanation: q.explanation || "",
    });
    setShowModal(true);
  };

  const handleOptionChange = (idx, val) => {
    setFormData((prev) => {
      const nextOpt = [...prev.options];
      nextOpt[idx] = val;
      return { ...prev, options: nextOpt };
    });
  };

  const handleSaveQuestion = async (e) => {
    e.preventDefault();
    setError("");

    if (!formData.statement.trim()) {
      setError("Question statement is required.");
      return;
    }
    if (!formData.chapterId) {
      setError("Please select a Chapter.");
      return;
    }
    if (formData.options.some((opt) => !opt.trim())) {
      setError("All 5 options must be filled.");
      return;
    }

    try {
      if (editingQuestion) {
        // Edit update
        const res = await API.put(`/admin/questions/${editingQuestion.id}`, formData);
        setQuestions((prev) =>
          prev.map((q) => (q.id === editingQuestion.id ? res.data : q))
        );
        setMessage("Question updated successfully.");
      } else {
        // Add create
        const res = await API.post("/admin/questions", formData);
        setQuestions((prev) => [res.data, ...prev]);
        setMessage("Question added to database.");
      }
      setShowModal(false);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to persist question changes.");
    }
  };

  // Get active list of chapters for filters
  const currentSubjectObj = subjects.find((s) => s.id === filterSubject);
  const filterChaptersList = currentSubjectObj ? currentSubjectObj.chapters : [];

  const filteredQuestions = questions.filter((q) => {
    const matchesSubject = !filterSubject || q.chapter?.subjectId === filterSubject;
    const matchesChapter = !filterChapter || q.chapterId === filterChapter;
    const matchesSearch =
      !searchQuery ||
      q.statement.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.correctAnswer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSubject && matchesChapter && matchesSearch;
  });

  return (
    <div className="approval-page">
      <header className="approval-header">
        <div>
          <p className="approval-kicker">CBT Engine Pool</p>
          <h1>Question Bank</h1>
          <span>Manage subjects, chapters, and MCQ questions for mock tests and exam generations.</span>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button type="button" className="approval-refresh-button" style={{ background: "var(--ecat-dark-bg)", color: "#fff" }} onClick={handleCreateSubject}>
            <FaBook /> Add Subject
          </button>
          <button type="button" className="approval-refresh-button" style={{ background: "var(--ecat-dark-bg)", color: "#fff" }} onClick={handleCreateChapter}>
            <FaList /> Add Chapter
          </button>
          <button type="button" className="approval-refresh-button" onClick={handleOpenAddModal}>
            <FaPlus /> Add Question
          </button>
        </div>
      </header>

      {(message || error) && (
        <div className={`approval-alert ${error ? "approval-alert--error" : ""}`}>
          {error || message}
          <button
            type="button"
            className="approval-alert-close"
            onClick={() => {
              setMessage("");
              setError("");
            }}
          >
            x
          </button>
        </div>
      )}

      {/* Filter toolbar */}
      <div className="approval-card" style={{ marginBottom: "20px", padding: "15px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "15px", alignItems: "center" }}>
          <div style={{ flex: 1, minWidth: "200px" }}>
            <label className="approval-search-box" style={{ width: "100%" }}>
              <FaSearch />
              <input
                type="search"
                placeholder="Search statements or answers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </label>
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            <select
              style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--ecat-border-color)" }}
              value={filterSubject}
              onChange={(e) => {
                setFilterSubject(e.target.value);
                setFilterChapter("");
              }}
            >
              <option value="">All Subjects</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>

            <select
              style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--ecat-border-color)" }}
              value={filterChapter}
              onChange={(e) => setFilterChapter(e.target.value)}
              disabled={!filterSubject}
            >
              <option value="">All Chapters</option>
              {filterChaptersList.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            <button type="button" style={{ display: "flex", alignItems: "center", gap: "5px", padding: "8px 12px", background: "none", border: "1px solid var(--ecat-border-color)", cursor: "pointer", borderRadius: "6px" }} onClick={loadData}>
              <FaRedo /> Reload
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="approval-empty-state">Loading question pools...</div>
      ) : (
        <section className="approval-card">
          <div className="approval-table-wrap">
            <table className="approval-table">
              <thead>
                <tr>
                  <th style={{ width: "40%" }}>Question / Explanation</th>
                  <th>Subject</th>
                  <th>Chapter</th>
                  <th>Correct Solution</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredQuestions.map((q) => (
                  <tr key={q.id}>
                    <td>
                      <div style={{ fontWeight: 500, fontSize: "0.95rem", color: "var(--ecat-blue-dark)" }} className="mathjax-question-statement">
                        {q.statement}
                      </div>
                      {q.explanation && (
                        <div style={{ fontSize: "0.8rem", color: "#666", marginTop: "4px" }}>
                          <strong>Explanation:</strong> {q.explanation.replace(/===TRICK===/g, " | Trick: ")}
                        </div>
                      )}
                    </td>
                    <td>{q.chapter?.subject?.name || "—"}</td>
                    <td>{q.chapter?.name || "—"}</td>
                    <td>
                      <span className="approval-package-badge approval-package-badge--premium">
                        {q.correctAnswer}
                      </span>
                    </td>
                    <td>
                      <div className="approval-table-actions">
                        <button type="button" onClick={() => handleOpenEditModal(q)}>
                          <FaEdit /> Edit
                        </button>
                        <button type="button" className="approval-delete-action" onClick={() => handleDeleteQuestion(q.id)}>
                          <FaTrash /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!filteredQuestions.length && (
                  <tr>
                    <td colSpan="5" className="approval-empty-cell">
                      No questions found matches selection.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Add / Edit Modal Overlay */}
      {showModal && (
        <div className="modal-overlay" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="approval-card" style={{ width: "90%", maxWidth: "600px", padding: "20px", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "15px" }}>
              <h2>{editingQuestion ? "Edit question bank entry" : "Create new question"}</h2>
              <button type="button" style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.2rem" }} onClick={() => setShowModal(false)}>
                ×
              </button>
            </div>

            <form onSubmit={handleSaveQuestion}>
              <div style={{ marginBottom: "15px" }}>
                <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Chapter Selection</label>
                <select
                  style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid var(--ecat-border-color)" }}
                  value={formData.chapterId}
                  onChange={(e) => setFormData({ ...formData, chapterId: e.target.value })}
                >
                  <option value="" disabled>Select Chapter</option>
                  {subjects.map((s) => (
                    <optgroup key={s.id} label={s.name}>
                      {s.chapters.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: "15px" }}>
                <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Question Statement (Markdown / LaTeX supported)</label>
                <textarea
                  rows="3"
                  style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid var(--ecat-border-color)" }}
                  placeholder="e.g. Find the value of \\lim_{x \\to 0} \\frac{\\sin x}{x}"
                  value={formData.statement}
                  onChange={(e) => setFormData({ ...formData, statement: e.target.value })}
                />
              </div>

              <div style={{ marginBottom: "15px" }}>
                <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>MCQ Option Values (Exactly 5)</label>
                {formData.options.map((opt, idx) => (
                  <div key={idx} style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "8px" }}>
                    <span style={{ fontWeight: "bold" }}>{String.fromCharCode(65 + idx)}</span>
                    <input
                      type="text"
                      style={{ flex: 1, padding: "8px", borderRadius: "6px", border: "1px solid var(--ecat-border-color)" }}
                      placeholder={`Option ${String.fromCharCode(65 + idx)} value`}
                      value={opt}
                      onChange={(e) => handleOptionChange(idx, e.target.value)}
                    />
                    <input
                      type="radio"
                      name="correctRadio"
                      checked={formData.correctAnswer === idx}
                      onChange={() => setFormData({ ...formData, correctAnswer: idx })}
                    />
                    <small>Correct</small>
                  </div>
                ))}
              </div>

              <div style={{ marginBottom: "15px" }}>
                <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Step-by-step Explanation &amp; Custom Pro Tips</label>
                <textarea
                  rows="2"
                  style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid var(--ecat-border-color)" }}
                  placeholder="Provide detailed mathematical explanations, separating tips using the delimiter ===TRICK==="
                  value={formData.explanation}
                  onChange={(e) => setFormData({ ...formData, explanation: e.target.value })}
                />
              </div>

              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "20px" }}>
                <button type="button" className="action-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="action-primary">
                  Save Question
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
