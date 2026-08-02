import { useEffect, useMemo, useState } from "react";
import { FaPaperPlane, FaRedo, FaSearch } from "react-icons/fa";
import API from "../utils/api";
import "./AdminApprovals.css";

export default function AdminMessages() {
  const [recipientType, setRecipientType] = useState("User");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRecipientKey, setSelectedRecipientKey] = useState("");
  const [showSenderEmail, setShowSenderEmail] = useState(true);
  const [messageBody, setMessageBody] = useState("");
  const [recipients, setRecipients] = useState([]);
  const [sentMessages, setSentMessages] = useState([]);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const loadData = async () => {
    try {
      const [recipientsRes, messagesRes] = await Promise.all([
        API.get("/admin/recipients"),
        API.get("/admin/messages"),
        API.post("/admin/messages/mark-read").catch(() => {}), // Fire and forget
      ]);
      setRecipients([...recipientsRes.data.users, ...recipientsRes.data.admins]);
      setSentMessages(messagesRes.data);
      setError("");
    } catch (err) {
      console.error("Message center load failed:", err);
      const apiError = err.response?.data?.error;
      if (err.response?.status === 401) {
        setError("Session expired. Please log out and sign in again as admin.");
      } else if (err.response?.status === 403) {
        setError(apiError || "You do not have permission to access the message center.");
      } else if (!err.response) {
        setError("Cannot reach the backend. Start the server with npm run dev:server.");
      } else {
        setError(apiError || "Unable to load message center data.");
      }
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(loadData, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!notice && !error) return undefined;
    const timer = window.setTimeout(() => {
      setNotice("");
      setError("");
    }, 4500);
    return () => window.clearTimeout(timer);
  }, [notice, error]);

  const filteredRecipients = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return recipients.filter((recipient) => {
      const matchesType = recipientType === "All" || recipient.type === recipientType;
      const matchesSearch =
        !query || `${recipient.name} ${recipient.email}`.toLowerCase().includes(query);
      return matchesType && matchesSearch;
    });
  }, [recipients, recipientType, searchTerm]);

  const selectedRecipient = recipients.find(
    (item) => `${item.type}:${item.id}` === selectedRecipientKey,
  );

  const sendMessage = async () => {
    if (!selectedRecipient || !messageBody.trim()) {
      setNotice("Please select a recipient from the dropdown and write your message.");
      return;
    }

    setError("");
    setNotice("");
    try {
      const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
      const res = await API.post("/admin/messages", {
        recipientEmail: selectedRecipient.email,
        recipientRole: selectedRecipient.type,
        body: messageBody.trim(),
        senderEmail: currentUser.email || "muhammad.f336s@gmail.com",
        showSenderEmail,
      });
      setSentMessages((messages) => [res.data.loginMessage, ...messages]);
      setNotice(`Message queued for ${selectedRecipient.name}.`);
      setMessageBody("");
      setSelectedRecipientKey("");
      setSearchTerm("");
    } catch (err) {
      console.error("Message queue failed:", err);
      setError(err.response?.data?.error || "Unable to queue message.");
    }
  };

  const handleDeleteMessage = async (id) => {
    if (!window.confirm("Are you sure you want to delete this message?")) return;
    try {
      await API.delete(`/admin/messages/${id}`);
      setSentMessages((msgs) => msgs.filter((m) => m.id !== id));
      setNotice("Message deleted.");
    } catch (err) {
      console.error("Failed to delete message:", err);
      setError("Failed to delete message.");
    }
  };

  return (
    <div className="approval-page">
      <header className="approval-header">
        <div>
          <p className="approval-kicker">User Management</p>
          <h1>Message Center</h1>
          <span>
            Send account-level messages to admins or users. Messages persist and
            can be shown on next login.
          </span>
        </div>
        <button type="button" className="approval-refresh-button" onClick={loadData}>
          <FaRedo /> Refresh
        </button>
      </header>

      {(notice || error) && (
        <div className={`approval-alert ${error ? "approval-alert--error" : ""}`}>
          {error || notice}
          <button
            type="button"
            className="approval-alert-close"
            onClick={() => {
              setNotice("");
              setError("");
            }}
            aria-label="Dismiss notification"
          >
            x
          </button>
        </div>
      )}

      <section className="approval-grid">
        <article className="approval-card">
          <div className="approval-card-header">
            <div>
              <h2>Compose Message</h2>
              <p>Select recipient type, search account, then write the login notice.</p>
            </div>
          </div>

          <div className="approval-management-toolbar">
            {["User", "Admin", "All"].map((type) => (
              <button
                type="button"
                key={type}
                className={recipientType === type ? "active" : ""}
                onClick={() => {
                  setRecipientType(type);
                  setSelectedRecipientKey("");
                }}
              >
                {type}
              </button>
            ))}
          </div>

          <label className="approval-search-box">
            <FaSearch />
            <input
              type="search"
              placeholder="Search recipient"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </label>

          <select
            className="message-select"
            value={selectedRecipientKey}
            onChange={(event) => setSelectedRecipientKey(event.target.value)}
          >
            <option value="">Select recipient</option>
            {filteredRecipients.map((recipient) => (
              <option
                key={`${recipient.type}-${recipient.id}`}
                value={`${recipient.type}:${recipient.id}`}
              >
                {recipient.type}: {recipient.name} - {recipient.email}
              </option>
            ))}
          </select>

          <label className="message-switch">
            <input
              type="checkbox"
              checked={showSenderEmail}
              onChange={(event) => setShowSenderEmail(event.target.checked)}
            />
            Show my email to recipient
          </label>

          <textarea
            className="message-textarea"
            placeholder="Write the message shown on next login..."
            value={messageBody}
            onChange={(event) => setMessageBody(event.target.value)}
          />

          <button type="button" className="approval-primary-button" onClick={sendMessage}>
            <FaPaperPlane /> Queue Message
          </button>
        </article>

        <aside className="approval-card">
          <h2>Recent Activity</h2>
          <div className="approval-user-list">
            {sentMessages.slice(0, 3).map((message) => (
              <div key={message.id} className="approval-user-row">
                <div>
                  <strong>{message.recipientEmail}</strong>
                  <p>{message.body}</p>
                  <small>
                    {new Date(message.createdAt).toLocaleString()}
                  </small>
                </div>
              </div>
            ))}
            {!sentMessages.length && (
              <div className="approval-empty-state">No recent activity.</div>
            )}
          </div>
        </aside>
      </section>

      <section className="approval-card" style={{ marginTop: '24px' }}>
        <h2>All Recent Messages</h2>
        <div className="approval-table-wrap">
          <table className="approval-table">
            <thead>
              <tr>
                <th>Recipient</th>
                <th>Message</th>
                <th>Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {sentMessages.map((message) => (
                <tr key={message.id}>
                  <td>
                    <strong>{message.recipientEmail}</strong>
                    <div style={{ fontSize: '0.8rem', color: '#777' }}>
                      Sent by: {message.senderEmail} ({message.showSenderEmail ? "Visible" : "Hidden"})
                    </div>
                  </td>
                  <td>{message.body}</td>
                  <td>{new Date(message.createdAt).toLocaleString()}</td>
                  <td className="approval-table-actions">
                    <button 
                      type="button" 
                      className="action-secondary" 
                      style={{ borderColor: '#c0392b', color: '#c0392b', padding: "4px 8px", fontSize: "0.75rem" }} 
                      onClick={() => handleDeleteMessage(message.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {!sentMessages.length && (
                <tr>
                  <td colSpan="4" className="approval-empty-state" style={{ textAlign: 'center' }}>No messages found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
