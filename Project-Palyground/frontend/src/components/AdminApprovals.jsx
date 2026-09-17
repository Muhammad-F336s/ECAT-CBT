import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FaCheck,
  FaKey,
  FaRedo,
  FaTimes,
  FaUserCheck,
} from "react-icons/fa";
import API from "../utils/api";
import "./AdminApprovals.css";

const studentRights = [
  "Choose & assign real test package (Starter, Basic, Standard, Premium)",
  "Enforce attempts limit & expiry date according to package catalog",
  "Generate CBT practice tests & view personal analytics",
  "Automated email notifications on approval",
];

const PKG_CARDS = [
  {
    code: "STARTER",
    label: "Starter",
    badgeCls: "starter",
    attempts: "2 Tests",
    validity: "5 Days",
    desc: "Free evaluation tier with core CBT features.",
  },
  {
    code: "BASIC",
    label: "Basic",
    badgeCls: "basic",
    attempts: "7 Tests",
    validity: "15 Days",
    desc: "Essential exam practice package.",
  },
  {
    code: "STANDARD",
    label: "Standard",
    badgeCls: "standard",
    attempts: "20 Tests",
    validity: "30 Days",
    desc: "Full comprehensive preparation suite.",
  },
  {
    code: "PREMIUM",
    label: "Premium",
    badgeCls: "premium",
    attempts: "40 Tests",
    validity: "60 Days",
    desc: "All features unlocked + Vector AI bot.",
  },
];

const getStatus = (user) => {
  if (!user.isApproved && (user.testAttemptsLimit === 0 || !user.packageType)) return "Pending";
  if (!user.isApproved) return "Frozen";
  return "Active";
};

export default function AdminApprovals({ onPendingCountChange }) {
  const [pendingUsers, setPendingUsers] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedPackage, setSelectedPackage] = useState("STARTER");
  const [adminSecretCode, setAdminSecretCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const syncPendingCount = useCallback(
    (users) => onPendingCountChange?.(users.length),
    [onPendingCountChange],
  );

  useEffect(() => {
    if (!message && !error) return undefined;

    const timer = window.setTimeout(() => {
      setMessage("");
      setError("");
    }, 4500);

    return () => window.clearTimeout(timer);
  }, [message, error]);

  const loadUsers = async () => {
    setLoading(true);
    setError("");
    try {
      const [pendingRes, studentsRes] = await Promise.all([
        API.get("/user/pending-users"),
        API.get("/user/students"),
      ]);
      setPendingUsers(pendingRes.data);
      syncPendingCount(pendingRes.data);
      setStudents(studentsRes.data);
    } catch (err) {
      console.error("Approval data load failed:", err);
      setError("Unable to load approval data. Check backend server connection.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const fetchInitialUsers = async () => {
      try {
        const [pendingRes, studentsRes] = await Promise.all([
          API.get("/user/pending-users"),
          API.get("/user/students"),
        ]);

        if (!isMounted) return;
        setPendingUsers(pendingRes.data);
        syncPendingCount(pendingRes.data);
        setStudents(studentsRes.data);
      } catch (err) {
        if (!isMounted) return;
        console.error("Approval data load failed:", err);
        setError("Unable to load approval data. Check backend server connection.");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchInitialUsers();
    const intervalId = window.setInterval(fetchInitialUsers, 10000);
    const handleFocus = () => fetchInitialUsers();
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleFocus);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleFocus);
    };
  }, [syncPendingCount]);

  const lastActivity = useMemo(() => students.slice(0, 5), [students]);

  const openApprovalPanel = (user) => {
    setSelectedUser(user);
    setSelectedPackage("STARTER");
    setAdminSecretCode("");
    setMessage("");
    setError("");
  };

  const closeApprovalPanel = () => {
    setSelectedUser(null);
  };

  const approveSelectedUser = async () => {
    if (!selectedUser) return;

    if (selectedUser.role === "admin" && !adminSecretCode.trim()) {
      setError("Allocate an admin secret key before approving this admin.");
      return;
    }

    setSavingId(selectedUser.id);
    setError("");
    setMessage("");
    try {
      const res = await API.post(`/user/approve/${selectedUser.id}`, {
        approve: true,
        packageCode: selectedPackage,
        adminSecretCode: adminSecretCode.trim(),
      });
      setPendingUsers((users) => {
        const nextUsers = users.filter((user) => user.id !== selectedUser.id);
        syncPendingCount(nextUsers);
        return nextUsers;
      });
      setStudents((users) =>
        users.map((user) => (user.id === selectedUser.id ? { ...user, ...res.data.user } : user)),
      );
      setMessage(
        selectedUser.role === "admin"
          ? `${selectedUser.name} approved as admin and secret allocated.`
          : `${selectedUser.name} approved with ${selectedPackage} package!`,
      );
      closeApprovalPanel();
    } catch (err) {
      console.error("Approval failed:", err);
      setError(err.response?.data?.error || "Unable to approve account.");
    } finally {
      setSavingId("");
    }
  };

  const rejectUser = async (user) => {
    setSavingId(user.id);
    setError("");
    setMessage("");
    try {
      await API.delete(`/user/reject/${user.id}`);
      setPendingUsers((users) => {
        const nextUsers = users.filter((item) => item.id !== user.id);
        syncPendingCount(nextUsers);
        return nextUsers;
      });
      setStudents((users) => users.filter((item) => item.id !== user.id));
      setMessage(`${user.name} rejected and removed.`);
      if (selectedUser?.id === user.id) closeApprovalPanel();
    } catch (err) {
      console.error("Reject failed:", err);
      setError(err.response?.data?.error || "Unable to reject student.");
    } finally {
      setSavingId("");
    }
  };

  return (
    <div className="approval-page">
      <header className="approval-header">
        <div>
          <p className="approval-kicker">Admin Controls</p>
          <h1>Pending Approvals</h1>
          <span>
            Review new student signups, grant authentic practice packages, and manage access requests.
          </span>
        </div>
        <button type="button" className="approval-refresh-button" onClick={loadUsers}>
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
            ×
          </button>
        </div>
      )}

      <section className="approval-grid">
        <article className="approval-card approval-queue-card">
          <div className="approval-card-header">
            <div>
              <h2>Approval Queue</h2>
              <p>
                {pendingUsers.length} new candidate
                {pendingUsers.length === 1 ? "" : "s"} waiting for admin review.
              </p>
            </div>
            <span className="approval-count-pill">{pendingUsers.length}</span>
          </div>

          {loading ? (
            <div className="approval-empty-state">Loading approval queue...</div>
          ) : pendingUsers.length ? (
            <div className="approval-user-list">
              {pendingUsers.map((user) => (
                <div key={user.id} className="approval-user-row">
                  <div className="approval-user-main">
                    <div className="approval-avatar">{user.name?.charAt(0) || "S"}</div>
                    <div>
                      <h3>{user.name}</h3>
                      <p>{user.email}</p>
                      <small>
                        {user.role === "admin" ? "Admin" : "Student"} request ·{" "}
                        {user.domain ? `Track: ${user.domain} · ` : ""}
                        {new Date(user.createdAt).toLocaleDateString()}
                      </small>
                    </div>
                  </div>
                  <div className="approval-row-actions">
                    <button
                      type="button"
                      className="approval-secondary-button"
                      onClick={() => openApprovalPanel(user)}
                    >
                      <FaUserCheck /> Review
                    </button>
                    <button
                      type="button"
                      className="approval-danger-button"
                      disabled={savingId === user.id}
                      onClick={() => rejectUser(user)}
                    >
                      <FaTimes /> Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="approval-empty-state">No pending approvals right now.</div>
          )}
        </article>

        <aside className="approval-card approval-rights-card">
          <h2>Package Assignment on Approval</h2>
          <p>
            Students receive full package validity and attempts automatically upon approval.
          </p>
          <ul>
            {studentRights.map((right) => (
              <li key={right}>
                <FaCheck /> {right}
              </li>
            ))}
          </ul>
        </aside>
      </section>

      <section className="approval-card approved-users-card">
        <div className="approval-card-header">
          <div>
            <h2>Last Activity</h2>
            <p>Latest five student account events from real platform data.</p>
          </div>
        </div>
        <div className="approval-user-list">
          {lastActivity.map((student) => (
            <div key={student.id} className="approval-user-row">
              <div className="approval-user-main">
                <div className="approval-avatar">{student.name?.charAt(0) || "S"}</div>
                <div>
                  <h3>{student.name}</h3>
                  <p>{student.email}</p>
                  <small>
                    {getStatus(student)} · joined {new Date(student.createdAt).toLocaleDateString()}
                  </small>
                </div>
              </div>
              <span className="approval-status">{getStatus(student)}</span>
            </div>
          ))}
          {!lastActivity.length && (
            <div className="approval-empty-state">No student activity yet.</div>
          )}
        </div>
      </section>

      {/* Review & Package Selection Modal */}
      {selectedUser && (
        <div className="approval-modal-backdrop" role="presentation">
          <section className="approval-modal" role="dialog" aria-modal="true">
            <button
              type="button"
              className="approval-modal-close"
              onClick={closeApprovalPanel}
              aria-label="Close approval dialog"
            >
              <FaTimes />
            </button>
            <p className="approval-kicker">Review Application</p>
            <h2>{selectedUser.name}</h2>
            <span className="approval-modal-email">{selectedUser.email}</span>

            {selectedUser.domain && (
              <div className="approval-modal-meta">
                <span>Domain: <strong>{selectedUser.domain}</strong></span>
                {selectedUser.cnic && <span>CNIC: <strong>{selectedUser.cnic}</strong></span>}
              </div>
            )}

            {selectedUser.role === "admin" ? (
              <div className="approval-limit-box">
                <label htmlFor="admin-secret-code">
                  <FaKey /> Allocate admin secret key
                </label>
                <input
                  id="admin-secret-code"
                  type="text"
                  placeholder="Example: ADM-OWNER-2026"
                  value={adminSecretCode}
                  onChange={(event) => setAdminSecretCode(event.target.value)}
                />
              </div>
            ) : (
              <div className="approval-pkg-select-box">
                <label className="approval-pkg-title">Select Initial Package to Assign:</label>
                <div className="approval-pkg-options">
                  {PKG_CARDS.map((pkg) => {
                    const isSelected = selectedPackage === pkg.code;
                    return (
                      <div
                        key={pkg.code}
                        className={`approval-pkg-card ${isSelected ? "selected" : ""}`}
                        onClick={() => setSelectedPackage(pkg.code)}
                      >
                        <div className="approval-pkg-card-top">
                          <input
                            type="radio"
                            name="approvalPackage"
                            checked={isSelected}
                            onChange={() => setSelectedPackage(pkg.code)}
                          />
                          <span className={`approval-pkg-badge approval-pkg-badge--${pkg.badgeCls}`}>
                            {pkg.label}
                          </span>
                        </div>
                        <div className="approval-pkg-card-body">
                          <div className="approval-pkg-stats">
                            <span>🎯 {pkg.attempts}</span>
                            <span>⏳ {pkg.validity}</span>
                          </div>
                          <p>{pkg.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="approval-modal-actions">
              <button
                type="button"
                className="approval-primary-button"
                disabled={savingId === selectedUser.id}
                onClick={approveSelectedUser}
              >
                <FaCheck /> Approve {selectedUser.role === "admin" ? "Admin" : `with ${selectedPackage}`}
              </button>
              <button
                type="button"
                className="approval-danger-button"
                disabled={savingId === selectedUser.id}
                onClick={() => rejectUser(selectedUser)}
              >
                <FaTimes /> Reject
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
