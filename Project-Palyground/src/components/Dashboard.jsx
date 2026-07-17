import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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

const Dashboard = ({ userId }) => {
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState(null);
  const [recentAttempts, setRecentAttempts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        const [analyticsRes, recentRes] = await Promise.all([
          API.get(`/user/analytics/${userId}`),
          API.get(`/test/recent-attempts`),
        ]);
        setAnalytics(analyticsRes.data);
        setRecentAttempts(recentRes.data);
      } catch (err) {
        console.error("Dashboard Data Fetch Error:", err);
      } finally {
        setLoading(false);
      }
    };

    if (userId) fetchAllData();
  }, [userId]);

  const handleRetryTest = (attempt) => {
    navigate("/test/cbt", {
      state: {
        formData: {
          subjectName: attempt.subjectName || "Retry Test",
          questionCount: attempt.questions.length,
          questions: attempt.questions,
          mode: "practice",
          isRetry: true,
        },
      },
    });
  };

  if (loading) {
    return <div className="dashboard-loading">Loading your performance analytics...</div>;
  }

  if (!analytics) {
    return <div className="dashboard-error">Failed to load performance data.</div>;
  }

  // Prepare data for Line Chart (Progress Graph)
  const chartData = {
    labels: analytics.history.slice().reverse().map((_, i) => `Test ${i + 1}`),
    datasets: [
      {
        label: "Percentage Score",
        data: analytics.history.slice().reverse().map((item) => item.percentage),
        borderColor: "rgb(47, 95, 158)",
        backgroundColor: "rgba(47, 95, 158, 0.2)",
        tension: 0.3,
        fill: true,
        pointBackgroundColor: "#fff",
        pointBorderColor: "rgb(47, 95, 158)",
        pointBorderWidth: 2,
        pointRadius: 4,
      },
    ],
  };

  // Prepare data for Subject-wise Bar Chart
  const subjects = Object.keys(analytics.subjectAnalytics || {});
  const barChartData = {
    labels: subjects,
    datasets: [
      {
        label: "Subject Strength (%)",
        data: subjects.map(sub => {
          const s = analytics.subjectAnalytics[sub];
          return s.total > 0 ? ((s.correct / s.total) * 100).toFixed(1) : 0;
        }),
        backgroundColor: "rgba(75, 192, 192, 0.6)",
        borderColor: "rgba(75, 192, 192, 1)",
        borderWidth: 1,
      },
    ],
  };

  return (
    <div className="dashboard-analytics-container">
      <div className="analytics-summary-grid">
        <div className="analytics-card analytics-card--accent">
          <p className="analytics-label">Total Tests Completed</p>
          <p className="analytics-value">{analytics.totalTests}</p>
        </div>
        <div className="analytics-card analytics-card--soft">
          <p className="analytics-label">Average Score</p>
          <p className="analytics-value">{analytics.averagePercentage}%</p>
        </div>
        <div className="analytics-card analytics-card--soft">
          <p className="analytics-label">Total Marks Obtained</p>
          <p className="analytics-value">{analytics.totalScoreObtained}</p>
          <span className="analytics-subtext">of {analytics.totalPossibleMarks}</span>
        </div>
      </div>

      <div className="analytics-charts-grid">
        <div className="analytics-chart-card">
          <div className="analytics-chart-header">
            <h3>Performance Progress</h3>
          </div>
          <div className="chart-wrapper">
            <Line 
              data={chartData} 
              options={{ responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 100 } } }} 
            />
          </div>
        </div>

        <div className="analytics-chart-card">
          <div className="analytics-chart-header">
            <h3>Subject Strengths</h3>
          </div>
          <div className="chart-wrapper">
            <Bar 
              data={barChartData} 
              options={{ responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 100 } } }} 
            />
          </div>
        </div>
      </div>

      <div className="previous-performance-card">
        <h3>Previous Performance</h3>
        <div className="performance-list">
          {recentAttempts.length === 0 ? (
            <div className="performance-empty">No previous tests found.</div>
          ) : (
            recentAttempts.map((attempt) => (
              <div key={attempt.attemptId} className="performance-item">
                <div className="item-info">
                  <span className="item-date">{new Date(attempt.submittedAt).toLocaleDateString()}</span>
                  <span className="item-score">{attempt.score} / {attempt.totalMarks} ({attempt.percentage}%)</span>
                </div>
                <div className="item-actions">
                  <button className="perf-btn perf-btn--review" onClick={() => window.location.href = `/test/result/${attempt.attemptId}`}>Review</button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
