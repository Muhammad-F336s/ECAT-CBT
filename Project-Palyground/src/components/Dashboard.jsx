import { useEffect, useState } from "react";
import API from "../utils/api";

const Dashboard = ({ userId }) => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const res = await API.get(`/user/analytics/${userId}`);
        setAnalytics(res.data);
      } catch (err) {
        console.error("Frontend Metrics Fetch Error:", err);
      } finally {
        setLoading(false);
      }
    };

    if (userId) fetchMetrics();
  }, [userId]);

  if (loading)
    return (
      <div className="dashboard-loading">
        Loading historical evaluation metrics...
      </div>
    );
  if (!analytics) return <div className="dashboard-error">Failed to load data.</div>;

  return (
    <div className="dashboard-analytics-container">
      <div className="analytics-summary-grid">
        <div className="analytics-card analytics-card--accent">
          <p className="analytics-label">Total Tests Completed</p>
          <p className="analytics-value">{analytics.totalTests}</p>
        </div>
        <div className="analytics-card analytics-card--soft">
          <p className="analytics-label">Average Score</p>
          <p className="analytics-value">{analytics.averagePercentage}</p>
        </div>
        <div className="analytics-card analytics-card--soft">
          <p className="analytics-label">Marks Obtained</p>
          <p className="analytics-value">{analytics.totalScoreObtained}</p>
          <span className="analytics-subtext">of {analytics.totalPossibleMarks}</span>
        </div>
      </div>

      <div className="analytics-table-card">
        <div className="analytics-table-header">
          <div>
            <h3>Historical Evaluation Logs</h3>
            <p>Recent test attempts and score breakdowns.</p>
          </div>
        </div>
        <div className="analytics-table-wrap">
          <table className="analytics-table">
            <thead>
              <tr>
                <th>Attempt</th>
                <th>Score</th>
                <th>Percentage</th>
              </tr>
            </thead>
            <tbody>
              {analytics.history.map((item) => (
                <tr key={item.attemptId}>
                  <td>{item.attemptId.slice(0, 8)}...</td>
                  <td>{item.score} / {item.totalMarks}</td>
                  <td>{item.percentage}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
