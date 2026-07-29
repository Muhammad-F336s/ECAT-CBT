import { useEffect, useState } from "react";
import API from "../utils/api";
import "./AdminApprovals.css"; // Reuse card styles

export default function SupportPage({ user }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    category: "Bug",
    description: "",
  });
  const [message, setMessage] = useState("");

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
    fetchTickets();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      await API.post("/user/support/ticket", formData);
      setMessage("Ticket submitted successfully!");
      setFormData({ title: "", category: "Bug", description: "" });
      fetchTickets();
    } catch (err) {
      console.error("Submit ticket error:", err);
      setMessage("Failed to submit ticket.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="approval-page" style={{ padding: "20px" }}>
      <header className="approval-header">
        <h1>Help & Support</h1>
        <p>Report issues or ask questions directly to the admin team.</p>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: "30px", marginTop: "20px" }}>
        {/* Submit Ticket Form */}
        <section className="approval-card" style={{ padding: "25px" }}>
          <h3>Submit a New Request</h3>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "15px", marginTop: "15px" }}>
            <div>
              <label style={{ display: "block", marginBottom: "5px" }}>Subject</label>
              <input 
                type="text" 
                required 
                value={formData.title} 
                onChange={(e) => setFormData({...formData, title: e.target.value})} 
                style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #ddd" }}
                placeholder="e.g., Cannot load Physics test"
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "5px" }}>Category</label>
              <select 
                value={formData.category} 
                onChange={(e) => setFormData({...formData, category: e.target.value})}
                style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #ddd" }}
              >
                <option value="Bug">Technical Bug</option>
                <option value="Account">Account Issue</option>
                <option value="Question">Content/Question Error</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "5px" }}>Description</label>
              <textarea 
                required 
                rows="5" 
                value={formData.description} 
                onChange={(e) => setFormData({...formData, description: e.target.value})} 
                style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #ddd" }}
                placeholder="Describe your issue in detail..."
              />
            </div>
            <button type="submit" className="action-primary" disabled={submitting}>
              {submitting ? "Submitting..." : "Submit Ticket"}
            </button>
            {message && <p style={{ color: "green", fontSize: "0.9rem" }}>{message}</p>}
          </form>
        </section>

        {/* Previous Tickets */}
        <section className="approval-card" style={{ padding: "25px" }}>
          <h3>Your Recent Tickets</h3>
          {loading ? (
            <p>Loading history...</p>
          ) : tickets.length === 0 ? (
            <p style={{ color: "#777", marginTop: "20px" }}>No support requests found.</p>
          ) : (
            <div style={{ marginTop: "20px", display: "flex", flexDirection: "column", gap: "15px" }}>
              {tickets.map(ticket => (
                <div key={ticket.id} style={{ padding: "15px", borderRadius: "8px", border: "1px solid #eee", background: "#fafafa" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <strong style={{ display: "block" }}>{ticket.title}</strong>
                      <small style={{ color: "#888" }}>{ticket.category} • {new Date(ticket.createdAt).toLocaleDateString()}</small>
                    </div>
                    <span style={{ 
                      padding: "4px 10px", 
                      borderRadius: "12px", 
                      fontSize: "0.75rem", 
                      fontWeight: "bold",
                      background: ticket.status === "Resolved" ? "#2ecc71" : (ticket.status === "Replied" ? "#3498db" : "#f39c12"),
                      color: "#fff"
                    }}>
                      {ticket.status}
                    </span>
                  </div>
                  <p style={{ fontSize: "0.9rem", marginTop: "10px", color: "#555" }}>{ticket.description}</p>
                  {ticket.reply && (
                    <div style={{ marginTop: "12px", padding: "10px", background: "#e1f5fe", borderRadius: "6px", borderLeft: "4px solid #03a9f4" }}>
                      <strong style={{ fontSize: "0.85rem", color: "#0277bd" }}>Admin Reply:</strong>
                      <p style={{ fontSize: "0.85rem", color: "#333", marginTop: "5px" }}>{ticket.reply}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
