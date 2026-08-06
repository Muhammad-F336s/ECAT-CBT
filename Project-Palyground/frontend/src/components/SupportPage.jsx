import { useEffect, useState } from "react";
import { FaHeadset, FaPaperPlane, FaCheckCircle, FaHourglassHalf, FaCommentDots, FaRedo } from "react-icons/fa";
import API from "../utils/api";
import "./SupportPage.css";

const CATEGORIES = ["Bug", "Account", "Content/Question Error", "Other"];

const STATUS_META = {
  Pending:  { color: "#f39c12", label: "Pending",  icon: <FaHourglassHalf /> },
  Replied:  { color: "#3498db", label: "Replied",   icon: <FaCommentDots /> },
  Resolved: { color: "#27ae60", label: "Resolved",  icon: <FaCheckCircle /> },
};

export default function SupportPage() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({ title: "", category: "Bug", description: "" });
  const [notice, setNotice] = useState({ type: "", text: "" });
  const [replyTexts, setReplyTexts] = useState({});

  const fetchTickets = async () => {
    try {
      const res = await API.get("/user/support/tickets");
      setTickets(res.data);
    } catch (err) {
      console.error("Fetch tickets error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchOnMount = async () => {
      await fetchTickets();
    };
    fetchOnMount();
  }, []);

  useEffect(() => {
    if (!notice.text) return;
    const t = setTimeout(() => setNotice({ type: "", text: "" }), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.description.trim()) return;
    setSubmitting(true);
    try {
      await API.post("/user/support/ticket", formData);
      setNotice({ type: "success", text: "Your request has been submitted! We'll get back to you soon." });
      setFormData({ title: "", category: "Bug", description: "" });
      fetchTickets();
      setTimeout(() => setNotice({ type: "", text: "" }), 5000);
    } catch (error) {
      console.error(error);
      setNotice({ type: "error", text: "Failed to submit ticket. Try again." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReplySubmit = async (ticketId) => {
    try {
      const text = replyTexts[ticketId];
      if (!text || text.trim() === "") return;
      await API.post(`/user/support/tickets/${ticketId}/reply`, { reply: text });
      setReplyTexts({ ...replyTexts, [ticketId]: "" });
      fetchTickets();
    } catch (err) {
      console.error(err);
      alert("Failed to send reply");
    }
  };

  return (
    <div className="support-page">
      {/* Hero */}
      <div className="support-hero">
        <div className="support-hero-icon"><FaHeadset /></div>
        <div>
          <h1>Help &amp; Support</h1>
          <p>Have a problem or question? Submit a ticket and our admin team will assist you promptly.</p>
        </div>
      </div>

      {notice.text && (
        <div className={`support-notice support-notice--${notice.type}`}>{notice.text}</div>
      )}

      <div className="support-grid">
        {/* ── Submit Form ── */}
        <section className="support-card">
          <h2 className="support-card-title"><FaPaperPlane /> New Request</h2>
          <form className="support-form" onSubmit={handleSubmit}>
            <div className="support-field">
              <label htmlFor="sup-title">Subject</label>
              <input
                id="sup-title"
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., Cannot load Physics test"
              />
            </div>
            <div className="support-field">
              <label htmlFor="sup-cat">Category</label>
              <select
                id="sup-cat"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              >
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="support-field">
              <label htmlFor="sup-desc">Description</label>
              <textarea
                id="sup-desc"
                required
                rows="6"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe your issue in detail so we can help you faster..."
              />
            </div>
            <button type="submit" className="support-submit" disabled={submitting}>
              {submitting ? "Submitting…" : <><FaPaperPlane /> Submit Ticket</>}
            </button>
          </form>
        </section>

        {/* ── Ticket History ── */}
        <section className="support-card">
          <div className="support-card-title-row">
            <h2 className="support-card-title">Your Tickets</h2>
            <button type="button" className="support-refresh" onClick={fetchTickets} aria-label="Refresh">
              <FaRedo />
            </button>
          </div>

          {loading ? (
            <div className="support-empty">Loading…</div>
          ) : tickets.length === 0 ? (
            <div className="support-empty">
              <FaHeadset />
              <p>No tickets yet. Submit your first request!</p>
            </div>
          ) : (
            <div className="support-ticket-list">
              {tickets.map((ticket) => {
                const meta = STATUS_META[ticket.status] || STATUS_META.Pending;
                return (
                  <div key={ticket.id} className="support-ticket">
                    <div className="support-ticket-header">
                      <div>
                        <strong>{ticket.title}</strong>
                        <span className="support-ticket-meta">
                          {ticket.category} &bull; {new Date(ticket.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <span className="support-status-badge" style={{ background: meta.color }}>
                        {meta.icon} {meta.label}
                      </span>
                    </div>
                    <p className="support-ticket-desc">{ticket.description}</p>
                    
                    {/* Render legacy reply if exists and not in thread */}
                    {ticket.reply && (
                      <div className="support-admin-reply">
                        <strong>Admin Reply:</strong>
                        <p>{ticket.reply}</p>
                      </div>
                    )}

                    {/* Render Thread */}
                    {ticket.thread && Array.isArray(ticket.thread) && ticket.thread.length > 0 && (
                      <div className="support-thread" style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                        {ticket.thread.map((msg, idx) => (
                          <div key={idx} style={{
                            padding: "8px 12px",
                            borderRadius: "8px",
                            background: msg.sender === "admin" ? "#e8f5e9" : "#f1f1f1",
                            borderLeft: msg.sender === "admin" ? "3px solid #2ecc71" : "3px solid #95a5a6",
                            fontSize: "0.85rem",
                            alignSelf: msg.sender === "admin" ? "flex-start" : "flex-end",
                            maxWidth: "90%"
                          }}>
                            <strong>{msg.sender === "admin" ? "Admin" : "You"}:</strong> 
                            <span style={{ marginLeft: "5px" }}>{msg.message}</span>
                            <div style={{ fontSize: "0.7rem", color: "#888", marginTop: "4px", textAlign: "right" }}>
                              {new Date(msg.timestamp).toLocaleString()}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Reply Form */}
                    {ticket.status !== "Resolved" && (
                      <div style={{ marginTop: "12px", display: "flex", gap: "8px" }}>
                        <input 
                          type="text" 
                          value={replyTexts[ticket.id] || ""}
                          onChange={(e) => setReplyTexts({ ...replyTexts, [ticket.id]: e.target.value })}
                          placeholder="Reply to this ticket..." 
                          style={{ flex: 1, padding: "8px", borderRadius: "6px", border: "1px solid #ccc", fontSize: "0.85rem" }}
                        />
                        <button 
                          onClick={() => handleReplySubmit(ticket.id)}
                          style={{ background: "#2d6a4f", color: "#fff", border: "none", padding: "0 12px", borderRadius: "6px", cursor: "pointer", fontSize: "0.85rem" }}
                        >
                          Send
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
