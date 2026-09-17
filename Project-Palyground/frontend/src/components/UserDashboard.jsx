import Dashboard from "./Dashboard";
import API from "../utils/api";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./UserDashboard.css";

const formatTime = (seconds) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

const PACKAGE_COLORS = {
  STARTER:        { bg: "#f0f7ff", border: "#bfdbfe", accent: "#2563eb", text: "#1e3a8a", badge: "#dbeafe" },
  BASIC:          { bg: "#fefce8", border: "#fde68a", accent: "#d97706", text: "#78350f", badge: "#fef3c7" },
  STANDARD:       { bg: "#f0fdf4", border: "#bbf7d0", accent: "#16a34a", text: "#14532d", badge: "#dcfce7" },
  PREMIUM:        { bg: "#faf5ff", border: "#e9d5ff", accent: "#7c3aed", text: "#3b0764", badge: "#ede9fe" },
  PROFILE_CHANGE: { bg: "#fff7ed", border: "#fed7aa", accent: "#ea580c", text: "#7c2d12", badge: "#ffedd5" },
};

function getDaysLeft(expiresAt) {
  if (!expiresAt) return null;
  const diff = new Date(expiresAt) - new Date();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function getDaysTotal(startedAt, expiresAt) {
  if (!startedAt || !expiresAt) return null;
  return Math.ceil((new Date(expiresAt) - new Date(startedAt)) / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" });
}

export default function UserDashboard({ user, onStartTest, onOpenAccount, onChangeAcademicProfile }) {
  const navigate = useNavigate();
  const initials = user?.name?.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "U";
  const [metrics, setMetrics] = useState({ totalTests: 0, averagePercentage: 0 });
  const [now, setNow] = useState(null);
  const editExpiresAt = user?.academicProfileEditExpiresAt ? new Date(user.academicProfileEditExpiresAt).getTime() : null;
  const secondsRemaining = useMemo(() => editExpiresAt && now ? Math.max(0, Math.ceil((editExpiresAt - now) / 1000)) : 0, [editExpiresAt, now]);
  const canChangeAcademicProfile = Boolean(user?.academicProfileCompleted && secondsRemaining > 0);

  // Package derived values
  const pkgType = user?.packageType || "STARTER";
  const pkgColors = PACKAGE_COLORS[pkgType] || PACKAGE_COLORS.STARTER;
  const daysLeft = getDaysLeft(user?.packageExpiresAt);
  const daysTotal = getDaysTotal(user?.packageStartedAt, user?.packageExpiresAt);
  const attemptsLeft = user?.remainingTestAttempts ?? 0;
  const isExpired = daysLeft === 0 && user?.packageExpiresAt;
  const isActive = user?.packageExpiresAt && !isExpired;
  const hasPackage = Boolean(user?.packageExpiresAt);
  const progressPct = daysTotal && daysLeft != null ? Math.round((daysLeft / daysTotal) * 100) : 0;
  const PKG_ATTEMPTS = { STARTER: 2, BASIC: 7, STANDARD: 20, PREMIUM: 40 };
  const attemptsTotal = PKG_ATTEMPTS[pkgType] ?? null;
  const attemptsPct = attemptsTotal ? Math.round((attemptsLeft / attemptsTotal) * 100) : null;

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
    return () => { mounted = false; };
  }, [user?.id]);

  const [showWelcomeBanner, setShowWelcomeBanner] = useState(() => {
    return localStorage.getItem(`starter_welcome_dismissed_${user?.id}`) !== "true";
  });

  const dismissWelcomeBanner = () => {
    setShowWelcomeBanner(false);
    if (user?.id) {
      localStorage.setItem(`starter_welcome_dismissed_${user.id}`, "true");
    }
  };

  return (
    <div className="dashboard-page-container">
      {/* ── STARTER WELCOME MODAL (FOCUSED FROSTED WINDOW EFFECT) ── */}
      {pkgType === "STARTER" && showWelcomeBanner && (
        <div className="starter-modal-backdrop" role="dialog" aria-modal="true">
          <div className="starter-modal-glow" aria-hidden="true" />
          <div className="starter-modal-card">
            <button
              type="button"
              className="starter-modal-close-btn"
              onClick={dismissWelcomeBanner}
              aria-label="Close welcome message"
            >
              ×
            </button>

            <div className="starter-modal-header">
              <div className="starter-modal-icon-badge">🎉</div>
              <span className="starter-modal-badge">Welcome to Entrace CBT</span>
              <h2>Your Starter Package is Now Active!</h2>
              <p className="starter-modal-subtitle">
                We have prepared your personalized practice environment.
              </p>
            </div>

            <div className="starter-modal-benefits">
              <div className="starter-benefit-item">
                <span className="starter-benefit-icon">🎯</span>
                <div>
                  <strong>2 Practice Tests</strong>
                  <span>Full CBT simulator with timer and instant result analytics</span>
                </div>
              </div>
              <div className="starter-benefit-item">
                <span className="starter-benefit-icon">⏳</span>
                <div>
                  <strong>5 Days Free Access</strong>
                  <span>Evaluate questions, interface, and performance analytics</span>
                </div>
              </div>
            </div>

            <p className="starter-modal-upgrade-hint">
              Need unlimited attempts, chapter-wise questions, and Vector AI study co-pilot? You can upgrade to a higher tier anytime.
            </p>

            <div className="starter-modal-actions">
              <button
                type="button"
                className="starter-modal-btn-primary"
                onClick={() => {
                  dismissWelcomeBanner();
                  navigate("/packages");
                }}
              >
                <span>Explore Package Plans</span>
                <span className="btn-arrow">→</span>
              </button>
              <button
                type="button"
                className="starter-modal-btn-secondary"
                onClick={dismissWelcomeBanner}
              >
                Continue with Starter
              </button>
            </div>
          </div>
        </div>
      )}

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

        {/* ── PACKAGE STATUS CARD ── */}
        <aside className="dashboard-pkg-card" style={{ "--pkg-accent": pkgColors.accent, "--pkg-bg": pkgColors.bg, "--pkg-border": pkgColors.border }}>
          <div className="pkg-card-header">
            <div>
              <p className="pkg-card-label">My Active Plan</p>
              <h2 className="pkg-card-name">{pkgType.charAt(0) + pkgType.slice(1).toLowerCase().replace("_", " ")} Plan</h2>
            </div>
            <span className={`pkg-status-badge ${isExpired ? "pkg-badge-expired" : isActive ? "pkg-badge-active" : "pkg-badge-free"}`}>
              {isExpired ? "Expired" : isActive ? "Active" : "Free Trial"}
            </span>
          </div>

          {hasPackage ? (
            <>
              {/* Days Remaining */}
              <div className="pkg-metric-block">
                <div className="pkg-metric-row">
                  <span className="pkg-metric-label">Days Remaining</span>
                  <span className="pkg-metric-val" style={{ color: pkgColors.accent }}>
                    {isExpired ? "0" : daysLeft ?? "—"}<span className="pkg-metric-unit"> days</span>
                  </span>
                </div>
                <div className="pkg-progress-track">
                  <div
                    className="pkg-progress-fill"
                    style={{
                      width: `${isExpired ? 0 : progressPct}%`,
                      background: pkgColors.accent,
                    }}
                  />
                </div>
                <div className="pkg-progress-labels">
                  <span>Expires {formatDate(user?.packageExpiresAt)}</span>
                  <span>{daysTotal ? `${daysTotal} day plan` : ""}</span>
                </div>
              </div>

              {/* Test Attempts */}
              <div className="pkg-metric-block">
                <div className="pkg-metric-row">
                  <span className="pkg-metric-label">Test Attempts Left</span>
                  <span className="pkg-metric-val" style={{ color: attemptsLeft === 0 ? "#dc2626" : pkgColors.accent }}>
                    {attemptsLeft}<span className="pkg-metric-unit">{attemptsTotal ? ` / ${attemptsTotal}` : ""}</span>
                  </span>
                </div>
                {attemptsPct != null && (
                  <div className="pkg-progress-track">
                    <div
                      className="pkg-progress-fill"
                      style={{
                        width: `${attemptsPct}%`,
                        background: attemptsLeft === 0 ? "#dc2626" : pkgColors.accent,
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Quick stats row */}
              <div className="pkg-stats-row">
                <div className="pkg-stat-chip">
                  <span className="pkg-stat-num">{metrics.totalTests}</span>
                  <span className="pkg-stat-label">Tests Done</span>
                </div>
                <div className="pkg-stat-chip">
                  <span className="pkg-stat-num">{metrics.averagePercentage}%</span>
                  <span className="pkg-stat-label">Avg Score</span>
                </div>
              </div>
            </>
          ) : (
            <div className="pkg-no-plan">
              <p>You don't have an active plan yet.</p>
              <p className="pkg-no-plan-sub">Upgrade to unlock unlimited practice tests, full content access, and more.</p>
            </div>
          )}

          <button
            type="button"
            className="pkg-cta-btn"
            onClick={() => navigate("/packages")}
          >
            {isExpired ? "Renew Plan →" : hasPackage ? "Manage Plans →" : "Browse Plans →"}
          </button>
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

