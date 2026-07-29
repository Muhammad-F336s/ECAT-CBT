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
    const fetchOnMount = async () => {
      await fetchAllTickets();
    };
    fetchOnMount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
                    </td>
                    <td>
                      <strong>{ticket.title}</strong>
                      <div style={{ fontSize: "0.85rem", color: "#555", marginTop: "5px" }}>{ticket.description}</div>
                    </td>
                    <td>{ticket.category}</td>
                    <td>
                      <span className="approval-status-pill" style={{ 
                        background: ticket.status === "Resolved" ? "#2ecc71" : (ticket.status === "Replied" ? "#3498db" : "#f39c12"),
                        color: "#fff"
                      }}>
                        {ticket.status}
                      </span>
                    </td>
                    <td>
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
                </select>
              </div>
              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button type="button" className="action-secondary" onClick={() => setSelectedTicket(null)}>Cancel</button>
                <button type="submit" className="action-primary" disabled={saving}>
                  {saving ? "Updating..." : "Submit Response"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
