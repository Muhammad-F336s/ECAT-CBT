import { useEffect, useMemo, useState } from "react";
import {
  FaBan,
  FaEdit,
  FaInfinity,
  FaRedo,
  FaSearch,
  FaTrash,
  FaUserCheck,
} from "react-icons/fa";
import API from "../utils/api";
import "./AdminApprovals.css";

const DEFAULT_LIMIT = 5;
const formatLimit = (limit) => (limit === -1 ? "Unlimited" : `${limit} tests`);
const attemptsUsed = (user) => user?._count?.attempts ?? 0;
const getStatus = (user) => {
  if (!user.isApproved && user.testAttemptsLimit === 0) return "Pending";
  if (!user.isApproved) return "Frozen";
  return "Active";
};

export default function AdminStudents({ onPendingCountChange }) {
  const [students, setStudents] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [savingId, setSavingId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!message && !error) return undefined;

    const timer = window.setTimeout(() => {
      setMessage("");
      setError("");
    }, 4500);

    return () => window.clearTimeout(timer);
  }, [message, error]);

  const loadStudents = async () => {
    setError("");
    try {
      const [studentsRes, pendingRes] = await Promise.all([
        API.get("/user/students"),
        API.get("/user/pending-users"),
      ]);
      setStudents(studentsRes.data);
      onPendingCountChange?.(pendingRes.data.length);
    } catch (err) {
      console.error("Students load failed:", err);
      setError("Unable to load student management data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const loadInitialStudents = async () => {
      try {
        const [studentsRes, pendingRes] = await Promise.all([
          API.get("/user/students"),
          API.get("/user/pending-users"),
        ]);
        if (!isMounted) return;
        setStudents(studentsRes.data);
        onPendingCountChange?.(pendingRes.data.length);
      } catch (err) {
        if (!isMounted) return;
        console.error("Students load failed:", err);
        setError("Unable to load student management data.");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadInitialStudents();
    const intervalId = window.setInterval(loadInitialStudents, 10000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [onPendingCountChange]);

  const filteredStudents = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return students.filter((student) => {
      const status = getStatus(student);
      const matchesSearch =
        !query || `${student.name} ${student.email} ${status}`.toLowerCase().includes(query);
      const matchesStatus = statusFilter === "All" || statusFilter === status;
      return matchesSearch && matchesStatus;
    });
  }, [students, searchTerm, statusFilter]);

  const updateStudent = async (student, updates) => {
    setSavingId(student.id);
    setError("");
    setMessage("");
    try {
      const res = await API.post(`/user/update-package/${student.id}`, {
        attemptsLimit: updates.attemptsLimit ?? student.testAttemptsLimit,
        ...(typeof updates.isApproved === "boolean"
          ? { isApproved: updates.isApproved }
          : {}),
      });

      setStudents((items) =>
        items.map((item) => (item.id === student.id ? { ...item, ...res.data.user } : item)),
      );
      setMessage(`${student.name}'s admin settings updated.`);
    } catch (err) {
      console.error("Student update failed:", err);
      setError(err.response?.data?.error || "Unable to update student.");
    } finally {
      setSavingId("");
    }
  };

  const approveStudent = async (student) => {
    const nextLimit = window.prompt(
      "Set test creation limit before approving. Use -1 for unlimited.",
      String(DEFAULT_LIMIT),
    );
    if (nextLimit === null) return;
    const normalizedLimit = nextLimit.trim() === "-1" ? -1 : Number(nextLimit);
    if (!Number.isFinite(normalizedLimit) || (normalizedLimit !== -1 && normalizedLimit < 1)) {
      setError("Enter a valid test limit greater than 0, or -1 for unlimited.");
      return;
    }

    setSavingId(student.id);
    setError("");
    setMessage("");
    try {
      const res = await API.post(`/user/approve/${student.id}`, {
        approve: true,
        attemptsLimit: normalizedLimit,
      });
      setStudents((items) =>
        items.map((item) => (item.id === student.id ? { ...item, ...res.data.user } : item)),
      );
      onPendingCountChange?.(
        students.filter((item) => item.id !== student.id && getStatus(item) === "Pending").length,
      );
      setMessage(`${student.name} approved.`);
    } catch (err) {
      console.error("Approval failed:", err);
      setError(err.response?.data?.error || "Unable to approve student.");
    } finally {
      setSavingId("");
    }
  };

  const editLimit = (student) => {
    const nextLimit = window.prompt(
      "Set test creation limit. Use -1 for unlimited.",
      String(student.testAttemptsLimit),
    );
    if (nextLimit === null) return;
    const normalizedLimit = nextLimit.trim() === "-1" ? -1 : Number(nextLimit);
    if (!Number.isFinite(normalizedLimit) || (normalizedLimit !== -1 && normalizedLimit < 1)) {
      setError("Enter a valid test limit greater than 0, or -1 for unlimited.");
      return;
    }
    updateStudent(student, { attemptsLimit: normalizedLimit });
  };

  const deleteStudent = async (student) => {
    const confirmed = window.confirm(
      `Delete ${student.name}'s account permanently? This removes the account and test history.`,
    );
    if (!confirmed) return;

    setSavingId(student.id);
    setError("");
    setMessage("");
    try {
      await API.delete(`/user/reject/${student.id}`);
      const nextStudents = students.filter((item) => item.id !== student.id);
      setStudents(nextStudents);
      onPendingCountChange?.(nextStudents.filter((item) => getStatus(item) === "Pending").length);
      setMessage(`${student.name}'s account deleted.`);
    } catch (err) {
      console.error("Delete failed:", err);
      setError(err.response?.data?.error || "Unable to delete student.");
    } finally {
      setSavingId("");
    }
  };

  return (
    <div className="approval-page">
      <header className="approval-header">
        <div>
          <p className="approval-kicker">Admin Rights</p>
          <h1>Approved Students</h1>
          <span>
            Search students, approve pending users, freeze/unfreeze access, edit
            test limits, grant unlimited usage, and delete accounts.
          </span>
        </div>
        <button type="button" className="approval-refresh-button" onClick={loadStudents}>
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
            <h2>Student Management Panel</h2>
            <p>{students.length} total students in the platform.</p>
          </div>
          <label className="approval-search-box">
            <FaSearch />
            <input
              type="search"
              placeholder="Search students"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </label>
        </div>

        <div className="approval-management-toolbar">
          {["All", "Pending", "Active", "Frozen"].map((status) => (
            <button
              type="button"
              key={status}
              className={statusFilter === status ? "active" : ""}
              onClick={() => setStatusFilter(status)}
            >
              {status}
            </button>
          ))}
        </div>

        <div className="approval-table-wrap">
          <table className="approval-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Status</th>
                <th>Limit</th>
                <th>Used</th>
                <th>Joined</th>
                <th>Admin Rights</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((student) => {
                const status = getStatus(student);

                return (
                  <tr key={student.id}>
                    <td>
                      <strong>{student.name}</strong>
                      <span>{student.email}</span>
                    </td>
                    <td>
                      <span className={`approval-status ${status === "Frozen" ? "approval-status--paused" : ""}`}>
                        {status}
                      </span>
                    </td>
                    <td>{formatLimit(student.testAttemptsLimit)}</td>
                    <td>{attemptsUsed(student)}</td>
                    <td>{new Date(student.createdAt).toLocaleDateString()}</td>
                    <td>
                      <div className="approval-table-actions">
                        {status === "Pending" ? (
                          <button
                            type="button"
                            disabled={savingId === student.id}
                            onClick={() => approveStudent(student)}
                          >
                            <FaUserCheck /> Approve
                          </button>
                        ) : (
                          <>
                            <button type="button" onClick={() => editLimit(student)}>
                              <FaEdit /> Edit Limit
                            </button>
                            <button
                              type="button"
                              onClick={() => updateStudent(student, { attemptsLimit: -1 })}
                            >
                              <FaInfinity /> Unlimited
                            </button>
                            <button
                              type="button"
                              disabled={savingId === student.id}
                              onClick={() =>
                                updateStudent(student, { isApproved: !student.isApproved })
                              }
                            >
                              <FaBan /> {student.isApproved ? "Freeze" : "Unfreeze"}
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          className="approval-delete-action"
                          disabled={savingId === student.id}
                          onClick={() => deleteStudent(student)}
                        >
                          <FaTrash /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!filteredStudents.length && (
                <tr>
                  <td colSpan="6" className="approval-empty-cell">
                    {loading ? "Loading students..." : "No students match your filters."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="approval-card">
        <div className="approval-card-header">
          <div>
            <h2>Account Control Summary</h2>
            <p>Quick operational snapshot for student access management.</p>
          </div>
        </div>
        <div className="approval-summary-grid">
          <div className="approval-summary-card">
            <strong>{students.length}</strong>
            <span>Total Students</span>
          </div>
          <div className="approval-summary-card">
            <strong>{students.filter((student) => getStatus(student) === "Active").length}</strong>
            <span>Active Accounts</span>
          </div>
          <div className="approval-summary-card">
            <strong>{students.filter((student) => getStatus(student) === "Frozen").length}</strong>
            <span>Frozen Accounts</span>
          </div>
          <div className="approval-summary-card">
            <strong>{students.filter((student) => student.testAttemptsLimit === -1).length}</strong>
            <span>Unlimited Packages</span>
          </div>
        </div>
      </section>
    </div>
  );
}
