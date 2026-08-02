import { useEffect, useState } from "react";
import API from "../utils/api";
import "./AdminApprovals.css";

export default function AdminSupport() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [reply, setReply] = useState("");
  const [status, setStatus] = useState("Replied");
  const [saving, setSaving] = useState(false);

  const fetchAllTickets = async () => {
    try {
      const res = await API.get("/admin/support/tickets");
      setTickets(res.data);
    } catch (err) {
      console.error("Fetch all tickets error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllTickets();
  }, []);

  const handleUpdateTicket = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await API.patch(`/admin/support/tickets/${selectedTicket.id}`, { reply, status });
      setSelectedTicket(null);
      setReply("");
      fetchAllTickets();
    } catch (err) {
      console.error("Update ticket error:", err);
      alert("Failed to update ticket.");
    } finally {
      setSaving(false);
    }
  };

  const handleClearReply = async () => {
    if (!window.confirm("Are you sure you want to delete the reply?")) return;
    try {
      await API.patch(`/admin/support/tickets/${selectedTicket.id}`, { deleteReply: true });
      setSelectedTicket(null);
      setReply("");
      fetchAllTickets();
    } catch (err) {
      console.error("Clear reply error:", err);
      alert("Failed to clear reply.");
    }
  };

  const handleMarkFalse = async (ticket) => {
    if (!window.confirm("Mark this ticket as a false report? The student will be penalized.")) return;
    try {
      await API.patch(`/admin/support/tickets/${ticket.id}`, { isFalse: true });
      fetchAllTickets();
    } catch (err) {
      console.error("Mark false error:", err);
      alert("Failed to mark as false.");
    }
  };

  const handleFreezeStudent = async (ticket) => {
    const days = prompt("How many days should this student be frozen from their account?");
    if (!days || isNaN(days) || parseInt(days) <= 0) return;
    
    if (!window.confirm(`Freeze ${ticket.user.name} for ${days} days?`)) return;
    
    try {
      await API.patch(`/admin/support/tickets/${ticket.id}`, { freezeDays: parseInt(days) });
      fetchAllTickets();
      alert(`Student frozen for ${days} days.`);
    } catch (err) {
      console.error("Freeze error:", err);
      alert("Failed to freeze student.");
    }
  };

  if (loading) return <div className="approval-empty-state">Loading support tickets...</div>;

  return (
    <div className="approval-page">
      <header className="approval-header">
        <div>
          <p className="approval-kicker">User Assistance</p>
          <h1>Support Management</h1>
          <span>Manage and resolve student inquiries and bug reports.</span>
        </div>
      </header>

      {tickets.length === 0 ? (
        <div className="approval-empty-state">No tickets found in the system.</div>
      ) : (
        <section className="approval-card">
          <div className="approval-table-wrap">
            <table className="approval-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Request</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map(ticket => (
                  <tr key={ticket.id}>
                    <td>
                      <strong>{ticket.user.name}</strong>
                      <div style={{ fontSize: "0.8rem", color: "#777" }}>{ticket.user.email}</div>
                      {ticket.user.falseReportCount > 0 && (
                        <div style={{ fontSize: "0.75rem", color: "#e74c3c", marginTop: "2px", fontWeight: "bold" }}>
                          False Reports: {ticket.user.falseReportCount}/5
                        </div>
                      )}
                    </td>
                    <td data-label="Request Info">
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", textAlign: "left", width: "100%" }}>
                        <strong>{ticket.title}</strong>
                        <div style={{ fontSize: "0.85rem", color: "#555", marginTop: "5px" }}>{ticket.description}</div>
                        {ticket.reply && (
                          <div style={{ marginTop: "8px", padding: "8px", background: "#e8f5e9", borderLeft: "3px solid #2ecc71", fontSize: "0.85rem", textAlign: "left", width: "100%" }}>
                            <strong>Initial Reply:</strong> {ticket.reply}
                          </div>
                        )}
                        {ticket.thread && Array.isArray(ticket.thread) && ticket.thread.length > 0 && (
                          <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "8px", width: "100%" }}>
                            {ticket.thread.map((msg, idx) => (
                              <div key={idx} style={{
                                padding: "8px 12px",
                                borderRadius: "8px",
                                background: msg.sender === "admin" ? "#e8f5e9" : "#f1f1f1",
                                borderLeft: msg.sender === "admin" ? "3px solid #2ecc71" : "3px solid #3498db",
                                fontSize: "0.85rem",
                                alignSelf: msg.sender === "admin" ? "flex-start" : "flex-end",
                                maxWidth: "90%"
                              }}>
                                <strong>{msg.sender === "admin" ? "You" : "Student"}:</strong> 
                                <span style={{ marginLeft: "5px" }}>{msg.message}</span>
                                <div style={{ fontSize: "0.7rem", color: "#888", marginTop: "4px", textAlign: "right" }}>
                                  {new Date(msg.timestamp).toLocaleString()}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                    <td data-label="Category">{ticket.category}</td>
                    <td data-label="Status">
                      <span className="approval-status-pill" style={{ 
                        background: ticket.status === "Resolved" ? "#2ecc71" : (ticket.status === "Replied" ? "#3498db" : (ticket.status === "False" ? "#e74c3c" : "#f39c12")),
                        color: "#fff"
                      }}>
                        {ticket.status}
                      </span>
                    </td>
                    <td className="approval-table-actions">
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px", width: "100%" }}>
                        <button 
                          type="button" 
                          className="action-primary" 
                          onClick={() => {
                            setSelectedTicket(ticket);
                            setReply(ticket.reply || "");
                            setStatus(ticket.status === "Pending" ? "Replied" : ticket.status);
                          }}
                        >
                          Reply / Update
                        </button>
                        
                        <div style={{ display: "flex", gap: "6px" }}>
                          <button 
                            type="button" 
                            className="action-secondary" 
                            style={{ flex: 1, padding: "4px 8px", fontSize: "0.75rem", borderColor: "#e74c3c", color: "#e74c3c" }}
                            onClick={() => handleMarkFalse(ticket)}
                            disabled={ticket.isFalse || ticket.status === "False"}
                          >
                            Mark False
                          </button>
                          <button 
                            type="button" 
                            className="action-secondary" 
                            style={{ flex: 1, padding: "4px 8px", fontSize: "0.75rem", borderColor: "#8e44ad", color: "#8e44ad" }}
                            onClick={() => handleFreezeStudent(ticket)}
                          >
                            Freeze
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {selectedTicket && (
        <div className="modal-overlay" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="approval-card" style={{ width: "90%", maxWidth: "600px", padding: "25px" }}>
            <h2>Manage Request</h2>
            <div style={{ margin: "20px 0", padding: "15px", background: "#f9f9f9", borderRadius: "8px" }}>
              <strong>{selectedTicket.title}</strong>
              <p style={{ marginTop: "10px" }}>{selectedTicket.description}</p>
            </div>

            <form onSubmit={handleUpdateTicket}>
              <div style={{ marginBottom: "15px" }}>
                <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Your Reply</label>
                <textarea 
                  rows="4" 
                  style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #ddd" }}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Type your response to the student..."
                  required
                />
              </div>
              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Update Status</label>
                <select 
                  style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #ddd" }}
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="Pending">Pending</option>
                  <option value="Replied">Replied</option>
                  <option value="Resolved">Resolved</option>
                  <option value="False">False</option>
                </select>
              </div>
              <div style={{ display: "flex", gap: "10px", justifyContent: "space-between" }}>
                <div>
                  {selectedTicket.reply && (
                    <button type="button" className="action-secondary" style={{ borderColor: "#e74c3c", color: "#e74c3c" }} onClick={handleClearReply}>
                      Clear Reply
                    </button>
                  )}
                </div>
                <div style={{ display: "flex", gap: "10px" }}>
                  <button type="button" className="action-secondary" onClick={() => setSelectedTicket(null)}>Cancel</button>
                  <button type="submit" className="action-primary" disabled={saving}>
                    {saving ? "Updating..." : "Submit Response"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
