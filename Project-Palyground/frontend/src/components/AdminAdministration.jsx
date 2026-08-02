import { useEffect, useMemo, useState } from "react";
import { FaBan, FaEdit, FaKey, FaRedo, FaSearch, FaTrash } from "react-icons/fa";
import API from "../utils/api";
import "./AdminApprovals.css";

const MAIN_ADMIN_EMAIL = "muhammad.f336s@gmail.com";
const MAIN_ADMIN_RANK = "Main Admin";
const STANDARD_ADMIN_RANK = "Standard Admin";

export default function AdminAdministration() {
  const [admins, setAdmins] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showSecretModal, setShowSecretModal] = useState(false);
  const [secretTargetAdmin, setSecretTargetAdmin] = useState(null);
  const [manualSecret, setManualSecret] = useState("");
  const currentAdmin = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}");
    } catch {
      return {};
    }
  }, []);
  const isRootOwner = currentAdmin.email === MAIN_ADMIN_EMAIL;

  const loadAdmins = async () => {
    try {
      const res = await API.get("/admin/admins");
      setAdmins(res.data);
      setError("");
    } catch (err) {
      console.error("Admin load failed:", err);
      setError(
        err.response?.data?.error ||
          "Unable to load admins. Run Prisma db push and restart backend.",
      );
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(loadAdmins, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!message && !error) return undefined;
    const timer = window.setTimeout(() => {
      setMessage("");
      setError("");
    }, 4500);
    return () => window.clearTimeout(timer);
  }, [message, error]);

  const filteredAdmins = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return admins;
    return admins.filter((admin) =>
      `${admin.name} ${admin.email} ${admin.rank}`.toLowerCase().includes(query),
    );
  }, [admins, searchTerm]);

  const replaceAdmin = (admin) => {
    setAdmins((items) => items.map((item) => (item.id === admin.id ? admin : item)));
  };

  const updateAdmin = async (admin, updates) => {
    setError("");
    setMessage("");
    try {
      const res = await API.patch(`/admin/admins/${admin.id}`, updates);
      replaceAdmin(res.data.admin);
      setMessage(`${admin.name}'s admin settings updated.`);
    } catch (err) {
      console.error("Admin update failed:", err);
      setError(err.response?.data?.error || "Unable to update admin.");
    }
  };

  const openSecretModal = (admin) => {
    setSecretTargetAdmin(admin);
    setManualSecret("");
    setShowSecretModal(true);
  };

  const generateSecret = async (admin, customSecret = null) => {
    setError("");
    setMessage("");
    try {
      const payload = customSecret ? { manualSecret: customSecret } : {};
      const res = await API.post(`/admin/admins/${admin.id}/secret`, payload);
      replaceAdmin(res.data.admin);
      setMessage(`New secret generated for ${admin.name}: ${res.data.secretCode}`);
      setShowSecretModal(false);
    } catch (err) {
      console.error("Secret generation failed:", err);
      setError(err.response?.data?.error || "Unable to generate secret.");
    }
  };

  const deleteAdmin = async (admin) => {
    const isSelfDelete = admin.email === currentAdmin.email;
    const confirmed = window.confirm(
      isSelfDelete
        ? "Delete your own root owner account? This will sign you out."
        : `Delete admin ${admin.name}?`,
    );
    if (!confirmed) return;

    setError("");
    setMessage("");
    try {
      await API.delete(`/admin/admins/${admin.id}`);
      if (isSelfDelete) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        window.location.assign("/auth");
        return;
      }
      setAdmins((items) => items.filter((item) => item.id !== admin.id));
      setMessage(`${admin.name} deleted.`);
    } catch (err) {
      console.error("Admin delete failed:", err);
      setError(err.response?.data?.error || "Unable to delete admin.");
    }
  };

  return (
    <div className="approval-page">
      <header className="approval-header">
        <div>
          <p className="approval-kicker">Owner Controls</p>
          <h1>Manage Administration</h1>
          <span>
            Root owner controls admin secrets, ranks, freeze state, and deletion.
            The protected owner account cannot be modified by other admins.
          </span>
        </div>
        <button type="button" className="approval-refresh-button" onClick={loadAdmins}>
          <FaRedo /> Refresh
        </button>
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
            aria-label="Dismiss notification"
          >
            x
          </button>
        </div>
      )}

      <section className="approval-card approved-users-card">
        <div className="approval-card-header">
          <div>
            <h2>Admin Directory</h2>
            <p>
              {isRootOwner
                ? "You can promote admins to Main Admin, keep them Standard Admin, or restrict access."
                : "You can view administration structure. Root owner actions are protected."}
            </p>
          </div>
          <label className="approval-search-box">
            <FaSearch />
            <input
              type="search"
              placeholder="Search admins"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </label>
        </div>

        <div className="approval-table-wrap">
          <table className="approval-table">
            <thead>
              <tr>
                <th>Admin</th>
                <th>Rank</th>
                <th>Status</th>
                <th>Secret</th>
                <th>Owner Rights</th>
              </tr>
            </thead>
            <tbody>
              {filteredAdmins.map((admin) => {
                const isProtectedOwner = admin.email === MAIN_ADMIN_EMAIL;
                const canManage = isRootOwner && !isProtectedOwner;
                const canSelfDelete = isRootOwner && isProtectedOwner;

                return (
                  <tr key={admin.id}>
                    <td>
                      <strong>{admin.name}</strong>
                      <span>{admin.email}</span>
                    </td>
                    <td>
                      {isProtectedOwner ? (
                        <span className="approval-status approval-status--owner">
                          Root Owner
                        </span>
                      ) : (
                        admin.rank || STANDARD_ADMIN_RANK
                      )}
                    </td>
                    <td>
                      <span className={`approval-status ${admin.isFrozen ? "approval-status--paused" : ""}`}>
                        {admin.isFrozen ? "Frozen" : "Active"}
                      </span>
                    </td>
                    <td>{isProtectedOwner ? "Protected forever" : admin.secretCode || "Not allocated"}</td>
                    <td>
                      <div className="approval-table-actions">
                        <button
                          type="button"
                          onClick={() => openSecretModal(admin)}
                          disabled={!canManage}
                        >
                          <FaKey /> Generate Secret
                        </button>
                        <button
                          type="button"
                          onClick={() => updateAdmin(admin, { rank: MAIN_ADMIN_RANK })}
                          disabled={!canManage || admin.rank === MAIN_ADMIN_RANK}
                        >
                          <FaEdit /> Main Admin
                        </button>
                        <button
                          type="button"
                          onClick={() => updateAdmin(admin, { rank: STANDARD_ADMIN_RANK })}
                          disabled={!canManage || admin.rank === STANDARD_ADMIN_RANK}
                        >
                          <FaEdit /> Standard
                        </button>
                        <button
                          type="button"
                          onClick={() => updateAdmin(admin, { isFrozen: !admin.isFrozen })}
                          disabled={!canManage}
                        >
                          <FaBan /> {admin.isFrozen ? "Unfreeze" : "Freeze"}
                        </button>
                        <button
                          type="button"
                          className="approval-delete-action"
                          disabled={!canManage && !canSelfDelete}
                          onClick={() => deleteAdmin(admin)}
                        >
                          <FaTrash /> {canSelfDelete ? "Self Delete" : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!filteredAdmins.length && (
                <tr>
                  <td colSpan="5" className="approval-empty-cell">
                    No admins found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="approval-card">
        <div className="approval-summary-grid">
          <div className="approval-summary-card">
            <strong>1</strong>
            <span>Protected Owner</span>
          </div>
          <div className="approval-summary-card">
            <strong>{admins.length}</strong>
            <span>Total Admins</span>
          </div>
          <div className="approval-summary-card">
            <strong>{admins.filter((admin) => admin.isFrozen).length}</strong>
            <span>Frozen Admins</span>
          </div>
          <div className="approval-summary-card">
            <strong>{admins.filter((admin) => admin.rank === MAIN_ADMIN_RANK).length}</strong>
            <span>Main Admins</span>
          </div>
        </div>
      </section>

      {showSecretModal && secretTargetAdmin && (
        <div className="modal-overlay" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="approval-card" style={{ width: "90%", maxWidth: "450px", padding: "25px" }}>
            <h2>Generate Secret for {secretTargetAdmin.name}</h2>
            <div style={{ marginTop: "20px", display: "flex", flexDirection: "column", gap: "15px" }}>
              <button type="button" className="action-primary" onClick={() => generateSecret(secretTargetAdmin)}>
                Auto-generate Secret
              </button>
              
              {isRootOwner && (
                <div style={{ padding: "15px", background: "#f9f9f9", borderRadius: "8px", border: "1px solid #ddd" }}>
                  <h4 style={{ margin: "0 0 10px 0" }}>Manual Secret (Root Owner Only)</h4>
                  <input
                    type="text"
                    placeholder="Enter custom secret"
                    value={manualSecret}
                    onChange={(e) => setManualSecret(e.target.value)}
                    style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #ccc", marginBottom: "10px" }}
                  />
                  <button 
                    type="button" 
                    className="action-secondary" 
                    onClick={() => generateSecret(secretTargetAdmin, manualSecret)}
                    disabled={!manualSecret.trim()}
                  >
                    Set Manual Secret
                  </button>
                </div>
              )}
            </div>
            <div style={{ marginTop: "20px", textAlign: "right" }}>
              <button type="button" className="action-secondary" onClick={() => setShowSecretModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
