import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";
import API from "../utils/api";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
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
    // Navigate to CBT with original questions to allow retrying the same paper
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

      <div className="analytics-chart-card">
        <div className="analytics-chart-header">
          <h3>Performance Progress</h3>
          <p>Your score trajectory over recent attempts.</p>
        </div>
        <div className="chart-wrapper">
          <Line 
            data={chartData} 
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { display: false },
                tooltip: { mode: "index", intersect: false },
              },
              scales: {
                y: { beginAtZero: true, max: 100, ticks: { stepSize: 20 } },
                x: { grid: { display: false } },
              },
            }} 
          />
        </div>
      </div>

      <div className="previous-performance-card">
        <div className="performance-header">
          <h3>Previous Performance</h3>
          <p>Your last 5 test attempts.</p>
        </div>
        <div className="performance-list">
          {recentAttempts.length === 0 ? (
            <div className="performance-empty">No previous tests found.</div>
          ) : (
            recentAttempts.map((attempt, index) => (
              <div key={attempt.attemptId} className="performance-item">
                <div className="item-info">
                  <span className="item-date">{
                    new Date(attempt.submittedAt).toLocaleDateString()
                  }</span>
                  <span className="item-score">
                    {attempt.score} / {attempt.totalMarks} ({attempt.percentage}%)
                  </span>
                </div>
                <div className="item-actions">
                  <button 
                    className="perf-btn perf-btn--review" 
                    onClick={() => window.location.href = `/test/result/${attempt.attemptId}`}
                  >
                    Review
                  </button>
                  <button 
                    className="perf-btn perf-btn--retry" 
                    onClick={() => handleRetryTest(attempt)}
                  >
                    Retry Test
                  </button>
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
