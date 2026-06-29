import Dashboard from "./Dashboard";
import "./DashboardPage.css";

const ProgressPage = ({ userId }) => {
  return (
    <div className="dashboard-page-container">
      <section className="dashboard-main-grid">
        <div className="section-header">
          <div>
            <p className="section-tag">Progress</p>
            <h2>CBT analytics and account performance</h2>
          </div>
          <span className="section-note">
            Updated in real time based on your latest activity.
          </span>
        </div>

        <Dashboard userId={userId} />
      </section>
    </div>
  );
};

export default ProgressPage;
