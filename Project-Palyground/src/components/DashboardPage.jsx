import "./DashboardPage.css";

const DashboardPage = ({ user, onStartTest, onOpenAccount }) => {
  const isAdmin = user.role === "admin";

  return (
    <div className="dashboard-page-container">
      <div className="dashboard-top-grid">
        <section className="dashboard-profile-card">
          <div className="dashboard-profile-header">
            <div className="dashboard-avatar">{user.name?.charAt(0) || "U"}</div>
            <div>
              <p className="dashboard-welcome-label">Good to see you back</p>
              <h1>{user.name}</h1>
              <p className="dashboard-email">{user.email}</p>
            </div>
          </div>

          <div className="dashboard-profile-meta">
            <span className="dashboard-role-pill">
              {isAdmin ? "Administrator" : "Student"}
            </span>
            <p>
              {isAdmin
                ? "Manage the platform, review users, and monitor CBT performance across the system."
                : "Continue practising, review your latest progress, and stay on track for the next exam."}
            </p>
          </div>

          <div className="dashboard-actions">
            <button
              type="button"
              className="action-primary"
              onClick={onStartTest}
            >
              Resume Practice
            </button>
            <button
              type="button"
              className="action-secondary"
              onClick={onOpenAccount}
            >
              Account Settings
            </button>
          </div>
        </section>

        <aside className="dashboard-status-card">
          <div className="status-label">My Learning Snapshot</div>
          <h2 className="status-title">Insights built for focused progress.</h2>
          <p className="status-copy">
            {isAdmin
              ? "Use these quick insights to make better decisions and keep your learners on track."
              : "See your progress at a glance and make each session more productive."}
          </p>

          <div className="status-metrics-grid">
            <div className="status-metric">
              <span className="metric-value">{user.name}</span>
              <span className="metric-label">Profile</span>
            </div>
            <div className="status-metric">
              <span className="metric-value">{isAdmin ? "Admin" : "Learner"}</span>
              <span className="metric-label">Account type</span>
            </div>
            <div className="status-metric">
              <span className="metric-value">{user.email.split("@")[1]}</span>
              <span className="metric-label">Email domain</span>
            </div>
          </div>
        </aside>
      </div>

    </div>
  );
};

export default DashboardPage;
