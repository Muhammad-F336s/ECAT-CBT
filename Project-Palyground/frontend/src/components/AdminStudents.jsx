import { useEffect, useMemo, useRef, useState } from "react";
import { FaRedo, FaSearch } from "react-icons/fa";
import API from "../utils/api";
import "./AdminApprovals.css";
import "./AdminStudents.css";

/* ─── helpers ─────────────────────────────────────────────────────────────── */
const DEFAULT_LIMIT = 5;
// Admin code required to grant packages (prevents accidental changes)
const ADMIN_GRANT_CODE = "ECAT-ADMIN-2025";

const PKG_META = {
  STARTER:  { label: "Starter",  cls: "pkg-starter"  },
  BASIC:    { label: "Basic",    cls: "pkg-basic"     },
  STANDARD: { label: "Standard", cls: "pkg-standard"  },
  PREMIUM:  { label: "Premium",  cls: "pkg-premium"   },
};

const getStatus = (user) => {
  if (!user.isApproved && user.testAttemptsLimit === 0) return "Pending";
  if (!user.isApproved) return "Frozen";
  return "Active";
};

const daysLeft = (dateStr) => {
  if (!dateStr) return null;
  const diff = new Date(dateStr) - Date.now();
  return Math.ceil(diff / 86_400_000);
};

const ExpiryBadge = ({ date, isDemoAccount }) => {
  if (isDemoAccount) return <span className="pkg-expiry pkg-expiry--permanent">♾️ Permanent</span>;
  const days = daysLeft(date);
  if (days === null) return <span className="pkg-expiry pkg-expiry--none">No package</span>;
  if (days <= 0)     return <span className="pkg-expiry pkg-expiry--expired">🔴 Expired</span>;
  if (days <= 5)     return <span className="pkg-expiry pkg-expiry--soon">🟠 {days}d left</span>;
  return                    <span className="pkg-expiry pkg-expiry--ok">🟢 {days}d left</span>;
};

/* ─── modal: simple confirm ─────────────────────────────────────────────────── */
function ConfirmModal({ title, message, confirmLabel = "Confirm", danger = false, onConfirm, onCancel }) {
  return (
    <div className="as-modal-backdrop">
      <div className="as-modal">
        <h3>{title}</h3>
        <p>{message}</p>
        <div className="as-modal-actions">
          <button type="button" className="as-btn as-btn--ghost" onClick={onCancel}>Cancel</button>
          <button type="button" className={`as-btn ${danger ? "as-btn--danger" : "as-btn--primary"}`} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

/* ─── modal: set limit (for approve flow only) ──────────────────────────────── */
function LimitModal({ title, initial, onConfirm, onCancel }) {
  const [val, setVal] = useState(String(initial));
  const submit = () => {
    const n = val.trim() === "-1" ? -1 : Number(val.trim());
    if (!Number.isFinite(n) || (n !== -1 && n < 1)) return;
    onConfirm(n);
  };
  return (
    <div className="as-modal-backdrop">
      <div className="as-modal">
        <h3>{title}</h3>
        <p>Enter a number (use -1 for unlimited).</p>
        <input
          className="as-modal-input"
          type="number"
          value={val}
          min="-1"
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          autoFocus
        />
        <div className="as-modal-actions">
          <button type="button" className="as-btn as-btn--ghost" onClick={onCancel}>Cancel</button>
          <button type="button" className="as-btn as-btn--primary" onClick={submit}>Save</button>
        </div>
      </div>
    </div>
  );
}

/* ─── modal: grant package with admin code ──────────────────────────────────── */
function GrantPackageModal({ student, onConfirm, onCancel }) {
  const [pkg, setPkg]       = useState(student.packageType || "BASIC");
  const [code, setCode]     = useState("");
  const [codeErr, setCodeErr] = useState("");
  const pkgKeys = ["STARTER", "BASIC", "STANDARD", "PREMIUM"];

  const handleConfirm = () => {
    if (code.trim() !== ADMIN_GRANT_CODE) {
      setCodeErr("Galat admin code. Dobara try karo.");
      return;
    }
    onConfirm(pkg);
  };

  return (
    <div className="as-modal-backdrop">
      <div className="as-modal">
        <h3>Grant Package — {student.name}</h3>
        <p>Package select karo aur admin verification code enter karo.</p>

        {/* package picker */}
        <div className="as-pkg-grid">
          {pkgKeys.map((k) => (
            <button
              key={k}
              type="button"
              className={`as-pkg-option ${pkg === k ? "as-pkg-option--selected" : ""}`}
              onClick={() => setPkg(k)}
            >
              <span className={`as-pkg-pill ${PKG_META[k].cls}`}>{PKG_META[k].label}</span>
            </button>
          ))}
        </div>

        {/* admin code input */}
        <div className="as-code-field">
          <label className="as-code-label">🔐 Admin Code</label>
          <input
            className={`as-modal-input ${codeErr ? "as-modal-input--error" : ""}`}
            type="password"
            placeholder="Enter admin verification code"
            value={code}
            onChange={(e) => { setCode(e.target.value); setCodeErr(""); }}
            onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
            autoFocus
          />
          {codeErr && <span className="as-code-err">{codeErr}</span>}
        </div>

        <div className="as-modal-actions">
          <button type="button" className="as-btn as-btn--ghost" onClick={onCancel}>Cancel</button>
          <button type="button" className="as-btn as-btn--primary" onClick={handleConfirm}>
            Grant {PKG_META[pkg].label}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── summary card component (clickable) ─────────────────────────────────────  */
function SummaryCard({ label, value, colorCls, activeFilter, onFilterChange }) {
  const isActive = activeFilter === label;
  return (
    <button
      type="button"
      className={`as-summary-card as-summary-card--${colorCls} ${isActive ? "as-summary-card--selected" : ""}`}
      onClick={() => onFilterChange(isActive ? null : label)}
      title={`Click to filter by ${label}`}
    >
      <strong>{value}</strong>
      <span>{label}</span>
    </button>
  );
}

/* ─── main component ───────────────────────────────────────────────────────── */
export default function AdminStudents({ onPendingCountChange }) {
  const [students, setStudents]       = useState([]);
  const [searchTerm, setSearch]       = useState("");
  const [statusFilter, setFilter]     = useState("All");
  const [summaryFilter, setSummaryFilter] = useState(null); // active summary card filter
  const [savingId, setSavingId]       = useState("");
  const [message, setMessage]         = useState("");
  const [error, setError]             = useState("");
  const [loading, setLoading]         = useState(true);

  /* modal state */
  const [limitModal,  setLimitModal]  = useState(null); // { student, title, initial, isApprove }
  const [deleteModal, setDeleteModal] = useState(null); // student
  const [grantModal,  setGrantModal]  = useState(null); // student

  const dropdownRef = useRef(null);

  /* auto-dismiss toast */
  useEffect(() => {
    if (!message && !error) return undefined;
    const t = setTimeout(() => { setMessage(""); setError(""); }, 4500);
    return () => clearTimeout(t);
  }, [message, error]);

  /* ── data loading ────────────────────────────────────────────────────────── */
  const loadStudents = async () => {
    setError("");
    try {
      const [studentsRes, pendingRes] = await Promise.all([
        API.get("/user/students"),
        API.get("/user/pending-users"),
      ]);
      setStudents(studentsRes.data);
      onPendingCountChange?.(pendingRes.data.length);
    } catch {
      setError("Unable to load student data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [s, p] = await Promise.all([API.get("/user/students"), API.get("/user/pending-users")]);
        if (!mounted) return;
        setStudents(s.data);
        onPendingCountChange?.(p.data.length);
      } catch {
        if (mounted) setError("Unable to load student data.");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    const id = setInterval(load, 10000);
    return () => { mounted = false; clearInterval(id); };
  }, [onPendingCountChange]);

  /* ── filtering ───────────────────────────────────────────────────────────── */
  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();

    return students.filter((s) => {
      const status = getStatus(s);

      // search match
      const matchSearch = !q || `${s.name} ${s.email} ${s.packageType ?? ""} ${s.academicTrack ?? ""} ${status}`.toLowerCase().includes(q);

      // status tab filter
      const matchStatus = statusFilter === "All" || statusFilter === status;

      // summary card filter
      let matchSummary = true;
      if (summaryFilter) {
        const sf = summaryFilter.toUpperCase();
        if (sf === "TOTAL STUDENTS") matchSummary = true;
        else if (sf === "ACTIVE")    matchSummary = status === "Active";
        else if (sf === "FROZEN")    matchSummary = status === "Frozen";
        else if (sf === "PENDING")   matchSummary = status === "Pending";
        else if (sf === "STARTER")   matchSummary = s.packageType === "STARTER";
        else if (sf === "BASIC")     matchSummary = s.packageType === "BASIC";
        else if (sf === "STANDARD")  matchSummary = s.packageType === "STANDARD";
        else if (sf === "PREMIUM")   matchSummary = s.packageType === "PREMIUM";
        else if (sf === "EXPIRED")   matchSummary = s.packageExpiresAt && daysLeft(s.packageExpiresAt) <= 0;
      }

      return matchSearch && matchStatus && matchSummary;
    });
  }, [students, searchTerm, statusFilter, summaryFilter]);

  /* ── actions ─────────────────────────────────────────────────────────────── */
  const patch = async (student, updates, successMsg) => {
    setSavingId(student.id);
    setError(""); setMessage("");
    try {
      const res = await API.post(`/user/update-package/${student.id}`, {
        attemptsLimit: student.testAttemptsLimit,
        ...updates,
      });
      setStudents((prev) => prev.map((s) => s.id === student.id ? { ...s, ...res.data.user } : s));
      setMessage(successMsg || `${student.name} updated.`);
    } catch (err) {
      setError(err.response?.data?.error || "Unable to update student.");
    } finally {
      setSavingId("");
    }
  };

  const grantPackage = async (student, pkgType) => {
    setSavingId(student.id);
    setError(""); setMessage("");
    try {
      const res = await API.patch(`/admin/students/${student.id}/package`, { packageType: pkgType });
      setStudents((prev) => prev.map((s) => s.id === student.id ? { ...s, ...res.data.user } : s));
      setMessage(`${PKG_META[pkgType].label} granted to ${student.name}.`);
    } catch {
      /* fallback: use update-package endpoint */
      try {
        const res2 = await API.post(`/user/update-package/${student.id}`, {
          attemptsLimit: student.testAttemptsLimit,
          packageType: pkgType,
        });
        setStudents((prev) => prev.map((s) => s.id === student.id ? { ...s, ...res2.data.user } : s));
        setMessage(`${PKG_META[pkgType].label} granted to ${student.name}.`);
      } catch (err2) {
        setError(err2.response?.data?.error || "Unable to grant package.");
      }
    } finally {
      setSavingId("");
    }
  };

  const approveStudent = async (student, limit) => {
    setSavingId(student.id);
    setError(""); setMessage("");
    try {
      const res = await API.post(`/user/approve/${student.id}`, { approve: true, attemptsLimit: limit });
      setStudents((prev) => prev.map((s) => s.id === student.id ? { ...s, ...res.data.user } : s));
      onPendingCountChange?.(students.filter((s) => s.id !== student.id && getStatus(s) === "Pending").length);
      setMessage(`${student.name} approved.`);
    } catch (err) {
      setError(err.response?.data?.error || "Unable to approve student.");
    } finally {
      setSavingId("");
    }
  };

  const approveDemo = async (student) => {
    setSavingId(student.id);
    setError(""); setMessage("");
    try {
      const res = await API.post(`/user/approve-demo/${student.id}`);
      setStudents((prev) => prev.map((s) => s.id === student.id ? { ...s, ...res.data.user } : s));
      onPendingCountChange?.(students.filter((s) => s.id !== student.id && getStatus(s) === "Pending").length);
      setMessage(`${student.name} approved as Demo.`);
    } catch (err) {
      setError(err.response?.data?.error || "Unable to approve demo student.");
    } finally {
      setSavingId("");
    }
  };

  const reviveDemo = async (student, limit) => {
    setSavingId(student.id);
    setError(""); setMessage("");
    try {
      const res = await API.post(`/user/revive-demo/${student.id}`, { newLimit: limit });
      setStudents((prev) => prev.map((s) => s.id === student.id ? { ...s, ...res.data.user } : s));
      setMessage(`${student.name}'s demo account revived.`);
    } catch (err) {
      setError(err.response?.data?.error || "Unable to revive demo account.");
    } finally {
      setSavingId("");
    }
  };

  const deleteStudent = async (student) => {
    setSavingId(student.id);
    setError(""); setMessage("");
    try {
      await API.delete(`/user/reject/${student.id}`);
      const next = students.filter((s) => s.id !== student.id);
      setStudents(next);
      onPendingCountChange?.(next.filter((s) => getStatus(s) === "Pending").length);
      setMessage(`${student.name}'s account deleted.`);
    } catch (err) {
      setError(err.response?.data?.error || "Unable to delete student.");
    } finally {
      setSavingId("");
    }
  };

  /* ── summary counts ────────────────────────────────────────────────────────  */
  const counts = useMemo(() => ({
    total:    students.length,
    active:   students.filter((s) => getStatus(s) === "Active").length,
    frozen:   students.filter((s) => getStatus(s) === "Frozen").length,
    pending:  students.filter((s) => getStatus(s) === "Pending").length,
    starter:  students.filter((s) => s.packageType === "STARTER").length,
    basic:    students.filter((s) => s.packageType === "BASIC").length,
    standard: students.filter((s) => s.packageType === "STANDARD").length,
    premium:  students.filter((s) => s.packageType === "PREMIUM").length,
    expired:  students.filter((s) => s.packageExpiresAt && daysLeft(s.packageExpiresAt) <= 0).length,
  }), [students]);

  /* ─── render ─────────────────────────────────────────────────────────────── */
  return (
    <div className="approval-page">

      {/* modals */}
      {limitModal && (
        <LimitModal
          title={limitModal.title}
          initial={limitModal.initial}
          onCancel={() => setLimitModal(null)}
          onConfirm={(n) => {
            setLimitModal(null);
            if (limitModal.isApprove) approveStudent(limitModal.student, n);
            else if (limitModal.isRevive) reviveDemo(limitModal.student, n);
          }}
        />
      )}
      {deleteModal && (
        <ConfirmModal
          title="Delete Account"
          message={`Permanently delete ${deleteModal.name}'s account and all test history? This cannot be undone.`}
          confirmLabel="Delete"
          danger
          onCancel={() => setDeleteModal(null)}
          onConfirm={() => { setDeleteModal(null); deleteStudent(deleteModal); }}
        />
      )}
      {grantModal && (
        <GrantPackageModal
          student={grantModal}
          onCancel={() => setGrantModal(null)}
          onConfirm={(pkg) => { setGrantModal(null); grantPackage(grantModal, pkg); }}
        />
      )}

      {/* header */}
      <header className="approval-header">
        <div>
          <p className="approval-kicker">Admin Rights</p>
          <h1>Student Management</h1>
          <span>Search, approve, grant packages, freeze, and delete student accounts.</span>
        </div>
        <button type="button" className="approval-refresh-button" onClick={loadStudents}>
          <FaRedo /> Refresh
        </button>
      </header>

      {/* toast */}
      {(message || error) && (
        <div className={`approval-alert ${error ? "approval-alert--error" : ""}`}>
          {error || message}
          <button type="button" className="approval-alert-close" onClick={() => { setMessage(""); setError(""); }} aria-label="Dismiss">×</button>
        </div>
      )}

      {/* summary cards — INTERACTIVE (click to filter) */}
      <section className="approval-card as-summary-section">
        <div className="as-summary-header">
          <div>
            <h2>Account &amp; Package Summary</h2>
            <p>
              {summaryFilter
                ? <><span className="as-active-filter-label">Filtering: <strong>{summaryFilter}</strong></span> — <button type="button" className="as-clear-filter" onClick={() => setSummaryFilter(null)}>Clear filter ×</button></>
                : "Click a card to filter the student list below."}
            </p>
          </div>
        </div>
        <div className="as-summary-grid">
          {[
            { label: "Total Students", value: counts.total,    colorCls: "total"    },
            { label: "Active",         value: counts.active,   colorCls: "active"   },
            { label: "Frozen",         value: counts.frozen,   colorCls: "frozen"   },
            { label: "Pending",        value: counts.pending,  colorCls: "pending"  },
            { label: "Starter",        value: counts.starter,  colorCls: "starter"  },
            { label: "Basic",          value: counts.basic,    colorCls: "basic"    },
            { label: "Standard",       value: counts.standard, colorCls: "standard" },
            { label: "Premium",        value: counts.premium,  colorCls: "premium"  },
            { label: "Expired",        value: counts.expired,  colorCls: "expired"  },
          ].map(({ label, value, colorCls }) => (
            <SummaryCard
              key={label}
              label={label}
              value={value}
              colorCls={colorCls}
              activeFilter={summaryFilter}
              onFilterChange={setSummaryFilter}
            />
          ))}
        </div>
      </section>

      {/* table card */}
      <section className="approval-card approved-users-card">
        <div className="approval-card-header">
          <div>
            <h2>Student Management Panel</h2>
            <p>
              {students.length} total students ·{" "}
              <strong>{filtered.length}</strong> shown
              {summaryFilter && <span className="as-filter-tag"> (filtered: {summaryFilter})</span>}
            </p>
          </div>
          <label className="approval-search-box">
            <FaSearch />
            <input
              type="search"
              placeholder="Search name, email, package, track…"
              value={searchTerm}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>

        {/* filter tabs */}
        <div className="approval-management-toolbar">
          {["All", "Pending", "Active", "Frozen"].map((s) => (
            <button key={s} type="button" className={statusFilter === s ? "active" : ""} onClick={() => setFilter(s)}>
              {s}
            </button>
          ))}
          {summaryFilter && (
            <button type="button" className="as-btn as-btn--sm as-btn--amber" onClick={() => setSummaryFilter(null)}>
              Clear: {summaryFilter} ×
            </button>
          )}
        </div>

        <div className="approval-table-wrap">
          <table className="approval-table as-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Status</th>
                <th>Package</th>
                <th>Attempts</th>
                <th>Expiry</th>
                <th>Track</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((student) => {
                const status   = getStatus(student);
                const pkgMeta  = PKG_META[student.packageType] ?? { label: student.packageType ?? "—", cls: "pkg-starter" };
                const isSaving = savingId === student.id;
                const remaining = student.remainingTestAttempts ?? "—";
                const limit     = student.testAttemptsLimit === -1 ? "∞" : (student.testAttemptsLimit ?? "—");
                const isProtectedDemo = student.isDemoAccount || student.email?.toLowerCase() === "demo@cbt.com";

                if (isProtectedDemo) {
                  return (
                    <tr key={student.id} className="as-row--protected">
                      <td data-label="Student">
                        <div className="as-student-cell">
                          <strong>{student.name}</strong>
                          <span className="as-email">{student.email}</span>
                        </div>
                      </td>
                      <td data-label="Status">
                        <span className="approval-status approval-status--active">
                          Active
                        </span>
                      </td>
                      <td colSpan="6" style={{ textAlign: "center", color: "#64748b", fontStyle: "italic", fontWeight: 600, letterSpacing: "0.02em" }}>
                        🛡️ Protected System Account — Cannot be modified or deleted
                      </td>
                    </tr>
                  );
                }

                const isFrozen = !!student.frozenUntil;

                return (
                  <tr key={student.id} className={isFrozen ? "as-row--frozen" : ""}>
                    {/* student info */}
                    <td data-label="Student">
                      <div className="as-student-cell">
                        <strong>{student.name}</strong>
                        {isFrozen && (
                          <span className="as-badge as-badge--frozen" title={student.freezeReason ?? "Frozen"}>❄️ Frozen</span>
                        )}
                        <span className="as-email">{student.email}</span>
                      </div>
                    </td>

                    {/* status */}
                    <td data-label="Status">
                      <span className={`approval-status ${status === "Frozen" ? "approval-status--paused" : status === "Pending" ? "approval-status--pending" : ""}`}>
                        {status}
                      </span>
                    </td>

                    {/* package */}
                    <td data-label="Package">
                      <span className={`as-pkg-pill ${pkgMeta.cls}`}>{pkgMeta.label}</span>
                    </td>

                    {/* attempts */}
                    <td data-label="Attempts">
                      <span className="as-attempts">
                        <strong>{remaining}</strong>
                        <span>/ {limit}</span>
                      </span>
                    </td>

                    {/* expiry */}
                    <td data-label="Expiry">
                      <ExpiryBadge date={student.packageExpiresAt} isDemoAccount={student.isDemoAccount} />
                    </td>

                    {/* track */}
                    <td data-label="Track">
                      <span className="as-track">{student.academicTrack ?? "—"}</span>
                    </td>

                    {/* joined */}
                    <td data-label="Joined">
                      {new Date(student.createdAt).toLocaleDateString()}
                    </td>

                    {/* actions — NO "Set Limit" button (attempts = package level) */}
                    <td data-label="Actions">
                      <div className="as-actions" ref={dropdownRef}>
                        {status === "Pending" ? (
                          <>
                            <button
                              type="button"
                              className="as-btn as-btn--sm as-btn--primary"
                              disabled={isSaving}
                              onClick={() => setLimitModal({ student, title: `Set initial limit for ${student.name}`, initial: DEFAULT_LIMIT, isApprove: true })}
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              className="as-btn as-btn--sm as-btn--amber"
                              disabled={isSaving}
                              onClick={() => approveDemo(student)}
                            >
                              Demo
                            </button>
                          </>
                        ) : (
                          <>
                            {/* Grant Package — requires admin code */}
                            <button
                              type="button"
                              className="as-btn as-btn--sm as-btn--primary"
                              disabled={isSaving}
                              onClick={() => setGrantModal(student)}
                            >
                              Grant Package ▾
                            </button>

                            {/* Freeze / Unfreeze */}
                            <button
                              type="button"
                              className={`as-btn as-btn--sm ${student.isApproved ? "as-btn--ghost" : "as-btn--primary"}`}
                              disabled={isSaving}
                              onClick={() => patch(student, { isApproved: !student.isApproved }, `${student.name} ${student.isApproved ? "frozen" : "unfrozen"}.`)}
                            >
                              {student.isApproved ? "Freeze" : "Unfreeze"}
                            </button>
                          </>
                        )}

                        {/* Delete */}
                        <button
                          type="button"
                          className="as-btn as-btn--sm as-btn--danger"
                          disabled={isSaving}
                          onClick={() => setDeleteModal(student)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {!filtered.length && (
                <tr>
                  <td colSpan="8" className="approval-empty-cell">
                    {loading
                      ? "Loading students…"
                      : summaryFilter
                        ? `No students in "${summaryFilter}" category.`
                        : "No students match your filters."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
