import { useEffect, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Line, Bar } from "react-chartjs-2";
import API from "../utils/api";
import "./AdminDashboard.css"; // Reuse some styles or add new ones

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

export default function AdminAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const res = await API.get("/admin/analytics");
        setData(res.data);
      } catch (err) {
        console.error("Failed to fetch admin analytics:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, []);

  if (loading) return <div className="approval-empty-state">Compiling platform analytics...</div>;
  if (!data) return <div className="approval-empty-state">Failed to load analytics.</div>;

  const activityChartData = {
    labels: data.activityTrends.map(t => t.date),
    datasets: [
      {
        label: "Tests Taken",
        data: data.activityTrends.map(t => t.count),
        borderColor: "rgb(52, 152, 219)",
        backgroundColor: "rgba(52, 152, 219, 0.2)",
        tension: 0.4,
        fill: true,
      }
    ]
  };

  const subjectChartData = {
    labels: data.subjectPerformance.map(s => s.name),
    datasets: [
      {
        label: "Avg Student Score (%)",
        data: data.subjectPerformance.map(s => s.averageScore),
        backgroundColor: "rgba(46, 204, 113, 0.6)",
        borderColor: "rgba(46, 204, 113, 1)",
        borderWidth: 1,
      }
    ]
  };

  return (
    <div className="approval-page">
      <header className="approval-header">
        <div>
          <p className="approval-kicker">Platform Intelligence</p>
          <h1>Platform Analytics</h1>
          <span>Real-time insights into student performance and content engagement.</span>
        </div>
      </header>

      <div className="analytics-summary-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "20px", marginBottom: "30px" }}>
        <div className="analytics-card" style={{ padding: "20px", background: "#fff", borderRadius: "12px", border: "1px solid #eee", textAlign: "center" }}>
          <p style={{ margin: 0, color: "#777", fontSize: "0.9rem" }}>Total Students</p>
          <h2 style={{ margin: "10px 0 0", color: "var(--ecat-blue-dark)" }}>{data.summary.totalStudents}</h2>
        </div>
        <div className="analytics-card" style={{ padding: "20px", background: "#fff", borderRadius: "12px", border: "1px solid #eee", textAlign: "center" }}>
          <p style={{ margin: 0, color: "#777", fontSize: "0.9rem" }}>Total Questions</p>
          <h2 style={{ margin: "10px 0 0", color: "var(--ecat-blue-dark)" }}>{data.summary.totalQuestions}</h2>
        </div>
        <div className="analytics-card" style={{ padding: "20px", background: "#fff", borderRadius: "12px", border: "1px solid #eee", textAlign: "center" }}>
          <p style={{ margin: 0, color: "#777", fontSize: "0.9rem" }}>Tests Attempted</p>
          <h2 style={{ margin: "10px 0 0", color: "var(--ecat-blue-dark)" }}>{data.summary.totalAttempts}</h2>
        </div>
        <div className="analytics-card" style={{ padding: "20px", background: "#fff", borderRadius: "12px", border: "1px solid #eee", textAlign: "center" }}>
          <p style={{ margin: 0, color: "#777", fontSize: "0.9rem" }}>Staff Admins</p>
          <h2 style={{ margin: "10px 0 0", color: "var(--ecat-blue-dark)" }}>{data.summary.totalAdmins}</h2>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "25px", marginBottom: "30px" }}>
        <section className="approval-card" style={{ padding: "20px" }}>
          <h3 style={{ marginBottom: "20px" }}>Activity Trends (Last 7 Days)</h3>
          <div style={{ height: "300px" }}>
            <Line data={activityChartData} options={{ responsive: true, maintainAspectRatio: false }} />
          </div>
        </section>
        <section className="approval-card" style={{ padding: "20px" }}>
          <h3 style={{ marginBottom: "20px" }}>Average Performance by Subject</h3>
          <div style={{ height: "300px" }}>
            <Bar data={subjectChartData} options={{ responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 100 } } }} />
          </div>
        </section>
      </div>

      <section className="approval-card">
        <h3>Subject Breakdown</h3>
        <div className="approval-table-wrap">
          <table className="approval-table">
            <thead>
              <tr>
                <th>Subject Name</th>
                <th>Avg. Score</th>
                <th>Total Questions</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.subjectPerformance.map((sub, idx) => (
                <tr key={idx}>
                  <td><strong>{sub.name}</strong></td>
                  <td>{sub.averageScore}%</td>
                  <td>{sub.questionCount} MCQs</td>
                  <td>
                    <span className="approval-status-pill" style={{ 
                      background: sub.questionCount > 100 ? "#27ae60" : "#f39c12",
                      color: "#fff"
                    }}>
                      {sub.questionCount > 100 ? "Healthy" : "Needs Content"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
