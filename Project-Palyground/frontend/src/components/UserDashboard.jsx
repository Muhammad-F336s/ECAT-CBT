import Dashboard from "./Dashboard";
import API from "../utils/api";
import { useEffect, useMemo, useState } from "react";
import "./UserDashboard.css";

const formatTime = (seconds) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

export default function UserDashboard({ user, onStartTest, onOpenAccount, onChangeAcademicProfile }) {
  const initials = user?.name?.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "U";
  const [metrics, setMetrics] = useState({ totalTests: 0, averagePercentage: 0 });
  const [now, setNow] = useState(null);
  const editExpiresAt = user?.academicProfileEditExpiresAt ? new Date(user.academicProfileEditExpiresAt).getTime() : null;
  const secondsRemaining = useMemo(() => editExpiresAt && now ? Math.max(0, Math.ceil((editExpiresAt - now) / 1000)) : 0, [editExpiresAt, now]);
  const canChangeAcademicProfile = Boolean(user?.academicProfileCompleted && secondsRemaining > 0);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        if (!user?.id) return;
        const res = await API.get(`/user/analytics/${user.id}`);
        if (!mounted) return;
        setMetrics({
          totalTests: res.data.totalTests || 0,
          averagePercentage: res.data.averagePercentage || 0,
        });
      } catch {
        // ignore and keep defaults
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [user?.id]);

  return (
    <div className="dashboard-page-container">
      {canChangeAcademicProfile && (
        <button type="button" className="academic-profile-countdown" onClick={onChangeAcademicProfile}>
          <span className="academic-profile-countdown-icon">✎</span>
          <span><strong>Change your field</strong><small>Update your academic profile before the edit window closes.</small></span>
          <time>{formatTime(secondsRemaining)}</time>
          <span className="academic-profile-countdown-arrow">→</span>
        </button>
      )}
      <div className="dashboard-top-grid">
        <section className="dashboard-profile-card">
          <div className="dashboard-profile-header">
            <div className="dashboard-avatar">{initials}</div>
            <div>
              <p className="dashboard-welcome-label">Good to see you back</p>
              <h1>{user?.name || "Learner"}</h1>
              <p className="dashboard-email">{user?.email || "student@example.com"}</p>
            </div>
          </div>

          <div className="dashboard-profile-meta">
            <span className="dashboard-role-pill">Student</span>
            <p>
              Stay on top of your CBT performance, review your history, and continue your learning path with confidence.
            </p>
          </div>

          <div className="dashboard-actions">
            <button type="button" className="action-primary" onClick={onStartTest}>
              Start Practice Test
            </button>
            <button type="button" className="action-secondary" onClick={onOpenAccount}>
              Open Account
            </button>
          </div>
        </section>

        <aside className="dashboard-status-card">
          <div className="status-label">My Learning Snapshot</div>
          <h2 className="status-title">Your progress, one glance away.</h2>
          <p className="status-copy">
            Review your recent results and keep moving toward your next milestone.
          </p>

          <div className="status-metrics-grid">
            <div className="status-metric">
              <span className="metric-value">{metrics.totalTests}</span>
              <span className="metric-label">Practice tests</span>
            </div>
            <div className="status-metric">
              <span className="metric-value">{metrics.averagePercentage}%</span>
              <span className="metric-label">Average score</span>
            </div>
            <div className="status-metric">
              <span className="metric-value">—</span>
              <span className="metric-label">Subjects covered</span>
            </div>
            <div className="status-metric">
              <span className="metric-value">—</span>
              <span className="metric-label">Study time</span>
            </div>
          </div>
        </aside>
      </div>

      <div className="dashboard-main-grid">
        <section className="dashboard-analytics-panel">
          <div className="section-header">
            <div>
              <span className="section-tag">Progress</span>
              <h2 className="section-title">CBT analytics and account performance</h2>
            </div>
          </div>
          <Dashboard userId={user?.id} />
        </section>
      </div>
    </div>
  );
}
