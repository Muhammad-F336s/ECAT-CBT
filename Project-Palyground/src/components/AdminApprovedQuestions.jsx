import { useEffect, useState } from "react";
import API from "../utils/api";
import "./AdminApprovals.css";

export default function AdminApprovedQuestions() {
  const [groupedQuestions, setGroupedQuestions] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await API.get("/admin/questions/approved-grouped");
        setGroupedQuestions(res.data);
      } catch (err) {
        console.error("Failed to fetch approved questions:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <div className="approval-empty-state">Loading archive...</div>;

  return (
    <div className="approval-page">
      <header className="approval-header">
        <div>
          <p className="approval-kicker">Archive</p>
          <h1>Approved Questions</h1>
        </div>
      </header>

      {Object.entries(groupedQuestions).map(([subject, dates]) => (
        <section key={subject} className="approval-card" style={{ marginBottom: "20px" }}>
          <h2>{subject}</h2>
          {Object.entries(dates).map(([date, questions]) => (
            <div key={date} style={{ marginTop: "15px" }}>
              <h3 style={{ fontSize: "1rem", color: "#5b6d62", borderBottom: "1px solid #eee", paddingBottom: "5px" }}>{date}</h3>
              <ul style={{ listStyle: "none", padding: 0 }}>
                {questions.map((q) => (
                  <li key={q.id} style={{ padding: "10px", borderBottom: "1px solid #f0f0f0" }}>
                    <strong>{q.chapter.name}:</strong> {q.statement}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
