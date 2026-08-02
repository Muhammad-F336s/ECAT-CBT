import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import API from "../utils/api";
import TestResultPage from "./TestResultPage";

export default function HistoricalResultViewer({ user }) {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchResult = async () => {
      try {
        const res = await API.get(`/test/result/${attemptId}`);
        setResults(res.data);
      } catch (err) {
        console.error("Failed to load historical attempt:", err);
        setError("Unable to retrieve details for this past evaluation.");
      } finally {
        setLoading(false);
      }
    };
    fetchResult();
  }, [attemptId]);

  if (loading) {
    return <div style={{ padding: "40px", textAlign: "center", width: "100%" }}>Loading historical data...</div>;
  }

  if (error || !results) {
    return (
      <div style={{ padding: "40px", textAlign: "center", width: "100%", color: "red" }}>
        {error}
        <div>
          <button type="button" onClick={() => navigate("/dashboard")} style={{ padding: "10px", marginTop: "20px" }}>
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "100vh", overflowY: "auto" }}>
      <TestResultPage
        user={user}
        results={results}
        onStartNewSession={() => navigate("/test")}
        onBackToDashboard={() => navigate("/dashboard")}
      />
    </div>
  );
}
