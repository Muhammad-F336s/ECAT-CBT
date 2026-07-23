import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaChartLine,
  FaChevronDown,
  FaCog,
  FaSearch,
} from "react-icons/fa";
import API from "../utils/api";
import "./AdminDashboard.css";

const filterOptions = ["All", "Approved", "Pending", "Frozen"];

const getStudentStatus = (student) => {
  if (!student.isApproved && student.testAttemptsLimit === 0) return "Pending";
  if (!student.isApproved) return "Frozen";
  return "Approved";
};

const attemptsUsed = (student) => student._count?.attempts ?? 0;

const getLatestScore = (student) => {
  const latestAttempt = student.attempts?.[0];
  if (!latestAttempt) return "-";
  return `${latestAttempt.score}/${latestAttempt.totalMarks}`;
};

const formatDate = (date) => new Date(date).toLocaleDateString();

function RingMetric({ label, value, caption, progress }) {
  return (
    <div className="admin-ring-metric">
      <div
        className="admin-ring"
        style={{ "--progress": `${progress}deg` }}
        aria-label={`${label}: ${value}`}
      >
        <span>{value}</span>
        <small>{caption}</small>
      </div>
      <p>{label}</p>
    </div>
  );
}

export default function AdminDashboard({ user, headerActions }) {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [students, setStudents] = useState([]);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [pendingQuestionsCount, setPendingQuestionsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const adminName = user?.name || "Administrator";
  const initial = adminName.charAt(0).toUpperCase();

  useEffect(() => {
    let isMounted = true;

    const loadDashboardData = async () => {
      try {
        const [studentsRes, pendingRes, questionsRes] = await Promise.all([
          API.get("/user/students"),
          API.get("/user/pending-users"),
          API.get("/admin/questions/pending"),
        ]);

        if (!isMounted) return;
        setStudents(studentsRes.data);
        setPendingUsers(pendingRes.data);
        setPendingQuestionsCount(questionsRes.data.length);
      } catch (err) {
        console.error("Admin dashboard data load failed:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadDashboardData();
    const intervalId = window.setInterval(loadDashboardData, 10000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const stats = useMemo(() => {
    const approved = students.filter((student) => student.isApproved).length;
    const frozen = students.filter(
      (student) => !student.isApproved && student.testAttemptsLimit !== 0,
    ).length;
    const totalAttempts = students.reduce(
      (sum, student) => sum + (student._count?.attempts ?? 0),
      0,
    );
    const activePercent = students.length
      ? Math.round((approved / students.length) * 100)
      : 0;
    const usagePercent = students.length
      ? Math.min(100, Math.round((totalAttempts / Math.max(students.length, 1)) * 20))
      : 0;

    return {
      approved,
      frozen,
      totalAttempts,
      activePercent,
      usagePercent,
      totalStudents: students.length,
    };
  }, [students]);

  const recentStudents = useMemo(() => students.slice(0, 5), [students]);

  const filteredStudents = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return recentStudents.filter((student) => {
      const status = getStudentStatus(student);
      const matchesSearch =
        !query || `${student.name} ${student.email} ${status}`.toLowerCase().includes(query);
      const matchesStatus = statusFilter === "All" || status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [recentStudents, searchTerm, statusFilter]);

  const latestStudent = students[0];

  return (
    <div className="admin-dashboard">
      <header className="admin-topbar">
        <div className="admin-search">
          <FaSearch />
          <input
            type="search"
            placeholder="Search"
            aria-label="Search admin dashboard"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>

        <div className="admin-top-actions">
          {headerActions}
          <div className="admin-user-chip">
            <div className="admin-user-avatar">{initial}</div>
            <div>
              <strong>{adminName}</strong>
              <span>Admin</span>
            </div>
            <FaChevronDown />
          </div>
        </div>
      </header>

      <div className="admin-title-row">
        <h1>ADMIN DASHBOARD: {adminName}</h1>
        <button type="button" className="admin-settings-button">
          <FaCog /> Settings
        </button>
      </div>

      <section className="admin-summary-grid">
        <article className="admin-card admin-health-card">
          <h2>SYSTEM HEALTH & LOGS</h2>
          <div className="admin-rings">
            <RingMetric label="Approved Rate" value={`${stats.activePercent}%`} caption="active" progress={stats.activePercent * 3.6} />
            <RingMetric label="Test Usage" value={stats.totalAttempts} caption="attempts" progress={stats.usagePercent * 3.6} />
            <RingMetric label="Frozen" value={stats.frozen} caption={<FaChartLine />} progress={stats.frozen ? 180 : 20} />
          </div>
        </article>

        <article className="admin-card admin-approval-card">
          <h2>NEW APPROVALS</h2>
          <div className="admin-big-stat-row">
            <strong>{pendingUsers.length}</strong>
            <span>{stats.totalStudents} total students</span>
          </div>
          <p>Students waiting for approval</p>
          <div className="admin-soft-strip">
            Latest: {latestStudent ? `${latestStudent.name} (${formatDate(latestStudent.createdAt)})` : "No students yet"}
          </div>
          <button
            type="button"
            className="admin-card-action"
            onClick={() => navigate("/admin/approvals")}
          >
            Review pending approvals
          </button>
        </article>

        <article className="admin-card admin-approval-card" style={{ borderLeftColor: "var(--ecat-blue-primary)" }}>
          <h2>AI REVIEW QUEUE</h2>
          <div className="admin-big-stat-row">
            <strong>{pendingQuestionsCount}</strong>
            <span>Pending Questions</span>
          </div>
          <p>AI questions needing audit</p>
          <div className="admin-soft-strip">
            Ensure quality before students see them.
          </div>
          <button
            type="button"
            className="admin-card-action"
            onClick={() => navigate("/admin/review-queue")}
          >
            Go to Review Queue
          </button>
        </article>

        <article className="admin-card admin-usage-card">
          <h2>PLATFORM USAGE</h2>
          <div className="admin-usage-stats">
            <div>
              <span>Approved Students</span>
              <strong>{stats.approved}</strong>
              <small>{stats.activePercent}%</small>
            </div>
            <div>
              <span>Total Attempts</span>
              <strong>{stats.totalAttempts}</strong>
            </div>
          </div>
          <div className="admin-sparkline" aria-hidden="true">
            <svg viewBox="0 0 300 70" role="img">
              <defs>
                <linearGradient id="usageFill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#3f7047" stopOpacity="0.42" />
                  <stop offset="100%" stopColor="#3f7047" stopOpacity="0.05" />
                </linearGradient>
              </defs>
              <path
                d={`M8 58 C46 ${58 - stats.activePercent / 2} 62 62 92 ${52 - stats.usagePercent / 4} S150 ${45 - stats.approved} 182 ${38 - stats.frozen} S238 ${30 - pendingUsers.length} 292 18 L292 66 L8 66 Z`}
                fill="url(#usageFill)"
              />
              <path
                d={`M8 58 C46 ${58 - stats.activePercent / 2} 62 62 92 ${52 - stats.usagePercent / 4} S150 ${45 - stats.approved} 182 ${38 - stats.frozen} S238 ${30 - pendingUsers.length} 292 18`}
                fill="none"
                stroke="#315f38"
                strokeWidth="4"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </article>
      </section>

      <section className="admin-work-grid">
        <article className="admin-card admin-activity-card">
          <div className="admin-card-header">
            <h2>Recent Student Activity</h2>
            <button type="button" onClick={() => navigate("/admin/students")}>
              View All
            </button>
          </div>
          <ul className="admin-activity-list">
            {recentStudents.map((student) => (
              <li key={student.id}>
                {student.name} - {getStudentStatus(student)} - {attemptsUsed(student)} attempts
              </li>
            ))}
            {!recentStudents.length && <li>{loading ? "Loading students..." : "No student activity yet."}</li>}
          </ul>
        </article>

        <article className="admin-card admin-directory-card">
          <div className="admin-card-header">
            <h2>Last 5 Students</h2>
          </div>

          <div className="admin-directory-toolbar">
            <label className="admin-directory-search">
              <FaSearch />
              <input
                type="search"
                placeholder="Search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </label>
            <select
              className="admin-filter-select"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              aria-label="Filter students by status"
            >
              {filterOptions.map((option) => (
                <option key={option} value={option}>
                  {option === "All" ? "All Filters" : option}
                </option>
              ))}
            </select>
            <button type="button" onClick={() => {
              setSearchTerm("");
              setStatusFilter("All");
            }}>
              Reset <FaChevronDown />
            </button>
          </div>

          <div className="admin-table-wrap">
            <table className="admin-student-table">
              <thead>
                <tr>
                  <th>Student Name</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Joined Date</th>
                  <th>Attempts</th>
                  <th>Limit</th>
                  <th>Latest Score</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student) => (
                  <tr key={student.id}>
                    <td>{student.name}</td>
                    <td>{student.email}</td>
                    <td><span className="admin-status-pill">{getStudentStatus(student)}</span></td>
                    <td>{formatDate(student.createdAt)}</td>
                    <td>{attemptsUsed(student)}</td>
                    <td>{student.testAttemptsLimit === -1 ? "Unlimited" : student.testAttemptsLimit}</td>
                    <td>{getLatestScore(student)}</td>
                  </tr>
                ))}
                {!filteredStudents.length && (
                  <tr>
                    <td colSpan="7" className="admin-empty-table">
                      No students match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="admin-table-note">
            Showing the latest five students from real account data.
          </p>
        </article>
      </section>
    </div>
  );
}
