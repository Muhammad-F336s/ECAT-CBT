import { useEffect, useState } from "react";
import {
  FaCheck,
  FaTrash,
  FaEdit,
  FaRedo,
  FaExclamationTriangle,
  FaCheckDouble,
  FaShieldAlt,
} from "react-icons/fa";
import API from "../utils/api";
import "./AdminApprovals.css";

export default function AdminReviewQueue() {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isBatching, setIsBatching] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

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
      const res = await API.get("/admin/questions/pending");
      setQuestions(res.data || []);
    } catch (err) {
      console.error("Failed to load review queue:", err);
      setError("Unable to load the AI review queue.");
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
        console.log("MathJax error in review queue:", err)
      );
    }
  }, [questions, showModal]);

  const handleApprove = async (id) => {
    try {
      await API.post(`/admin/questions/${id}/approve`);
      setMessage("Question approved and moved to active pool.");
      setQuestions((prev) => prev.filter((q) => q.id !== id));
    } catch (err) {
      setError("Failed to approve question.");
    }
  };

  const handleBatchApprove = async () => {
    const verifiedCount = questions.filter(q => !q.isFlagged).length;
    if (verifiedCount === 0) {
      setError("No AI-Verified questions found to batch approve.");
      return;
    }

    if (!window.confirm(`Are you sure you want to approve all ${verifiedCount} AI-Verified questions at once? Flagged questions will remain for manual review.`)) return;

    setIsBatching(true);
    try {
      const res = await API.post("/admin/questions/batch-approve-verified");
      setMessage(res.data.message);
      setQuestions((prev) => prev.filter((q) => q.isFlagged));
    } catch (err) {
      setError("Batch approval failed.");
    } finally {
      setIsBatching(false);
    }
  };

  const handleReject = async (id) => {
    if (!window.confirm("Reject and delete this AI-generated question permanently?")) return;
    try {
      await API.delete(`/admin/questions/${id}`);
      setMessage("Question rejected and deleted.");
      setQuestions((prev) => prev.filter((q) => q.id !== id));
    } catch (err) {
      setError("Failed to delete question.");
    }
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

  const handleSaveAndApprove = async (e) => {
    e.preventDefault();
    setError("");

    try {
      // 1. Update the question details
      await API.put(`/admin/questions/${editingQuestion.id}`, formData);
      // 2. Approve it
      await API.post(`/admin/questions/${editingQuestion.id}/approve`);
      
      setQuestions((prev) => prev.filter((q) => q.id !== editingQuestion.id));
      setMessage("Question updated and approved.");
      setShowModal(false);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to update and approve question.");
    }
  };

  return (
    <div className="approval-page">
      <header className="approval-header">
        <div>
          <p className="approval-kicker">AI Auditor & Staging Queue</p>
          <h1>Content Review</h1>
          <span>Dual-pass AI validation active. Review flagged items and batch-approve verified ones.</span>
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          <button 
            type="button" 
            className="approval-refresh-button" 
            onClick={handleBatchApprove}
            disabled={isBatching || questions.every(q => q.isFlagged)}
            style={{ background: "var(--ecat-green-active)", color: "white" }}
          >
            <FaCheckDouble /> {isBatching ? "Approving..." : "Approve All Verified"}
          </button>
          <button type="button" className="approval-refresh-button" onClick={loadData}>
            <FaRedo /> Refresh
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

      {loading ? (
        <div className="approval-empty-state">Analyzing content queue...</div>
      ) : questions.length === 0 ? (
        <div className="approval-empty-state">
          <FaCheck style={{ fontSize: "2rem", color: "var(--ecat-green-active)", marginBottom: "10px" }} />
          <p>Queue is empty! All AI questions have been reviewed.</p>
        </div>
      ) : (
        <section className="approval-card">
          <div className="approval-table-wrap">
            <table className="approval-table">
              <thead>
                <tr>
                  <th style={{ width: "50%" }}>Question & Auditor Report</th>
                  <th>Subject / Chapter</th>
                  <th>Audit Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {questions.map((q) => (
                  <tr key={q.id} style={q.isFlagged ? { borderLeft: "4px solid #e74c3c", background: "#fffefe" } : {}}>
                    <td>
                      <div style={{ fontWeight: 500, fontSize: "0.95rem", color: "var(--ecat-blue-dark)" }} className="mathjax-question-statement">
                        {q.statement}
                      </div>
                      <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
                        <div style={{ fontSize: "0.8rem", color: "#666", padding: "8px", background: "#f1f3f5", borderRadius: "4px" }}>
                          <strong>Explanation:</strong> {q.explanation?.replace(/===TRICK===/g, " | Trick: ")}
                        </div>
                        {q.auditNotes && (
                          <div style={{ 
                            fontSize: "0.8rem", 
                            color: q.isFlagged ? "#c0392b" : "#27ae60", 
                            padding: "8px", 
                            background: q.isFlagged ? "#fdf2f2" : "#f0fdf4", 
                            borderRadius: "4px", 
                            border: `1px solid ${q.isFlagged ? "#fadbd8" : "#d4efdf"}`,
                            display: "flex",
                            alignItems: "center",
                            gap: "8px"
                          }}>
                            {q.isFlagged ? <FaExclamationTriangle /> : <FaShieldAlt />}
                            <strong>AI Auditor:</strong> {q.auditNotes}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: "0.85rem" }}>
                        <strong>{q.chapter?.subject?.name}</strong>
                        <div style={{ color: "#777" }}>{q.chapter?.name}</div>
                      </div>
                    </td>
                    <td>
                      {q.isFlagged ? (
                        <span className="approval-status-pill" style={{ background: "#e74c3c", color: "white" }}>Flagged</span>
                      ) : (
                        <span className="approval-status-pill" style={{ background: "#27ae60", color: "white" }}>Verified</span>
                      )}
                    </td>
                    <td>
                      <div className="approval-table-actions">
                        <button type="button" style={{ background: "var(--ecat-green-active)", color: "white" }} onClick={() => handleApprove(q.id)}>
                          <FaCheck /> Approve
                        </button>
                        <button type="button" onClick={() => handleOpenEditModal(q)}>
                          <FaEdit /> Edit
                        </button>
                        <button type="button" className="approval-delete-action" onClick={() => handleReject(q.id)}>
                          <FaTrash /> Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Edit & Approve Modal */}
      {showModal && (
        <div className="modal-overlay" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="approval-card" style={{ width: "90%", maxWidth: "700px", padding: "25px", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
              <h2>Review &amp; Edit Question</h2>
              <button type="button" style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.5rem" }} onClick={() => setShowModal(false)}>
                ×
              </button>
            </div>

            <form onSubmit={handleSaveAndApprove}>
              <div style={{ marginBottom: "15px" }}>
                <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Statement</label>
                <textarea
                  rows="4"
                  style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid var(--ecat-border-color)" }}
                  value={formData.statement}
                  onChange={(e) => setFormData({ ...formData, statement: e.target.value })}
                />
              </div>

              <div style={{ marginBottom: "15px" }}>
                <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Options (Check radio for correct one)</label>
                {formData.options.map((opt, idx) => (
                  <div key={idx} style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "8px" }}>
                    <span style={{ width: "20px", fontWeight: "bold" }}>{String.fromCharCode(65 + idx)}</span>
                    <input
                      type="text"
                      style={{ flex: 1, padding: "8px", borderRadius: "6px", border: "1px solid var(--ecat-border-color)" }}
                      value={opt}
                      onChange={(e) => handleOptionChange(idx, e.target.value)}
                    />
                    <input
                      type="radio"
                      name="reviewCorrectRadio"
                      checked={formData.correctAnswer === idx}
                      onChange={() => setFormData({ ...formData, correctAnswer: idx })}
                    />
                  </div>
                ))}
              </div>

              <div style={{ marginBottom: "15px" }}>
                <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Explanation / Tips</label>
                <textarea
                  rows="3"
                  style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid var(--ecat-border-color)" }}
                  value={formData.explanation}
                  onChange={(e) => setFormData({ ...formData, explanation: e.target.value })}
                />
              </div>

              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "25px" }}>
                <button type="button" className="action-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="action-primary" style={{ background: "var(--ecat-green-active)" }}>
                  Save &amp; Approve ✅
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
