import MathText from "./MathText";
import { useEffect, useState } from "react";
import { FaBookOpen, FaChevronDown } from "react-icons/fa";
import API from "../utils/api";
import "./AdminApprovedQuestions.css";

const questionCount = (dates) => Object.values(dates).reduce((total, questions) => total + questions.length, 0);

export default function AdminApprovedQuestions() {
  const [groupedQuestions, setGroupedQuestions] = useState({});
  const [loading, setLoading] = useState(true);
  const [openSubjects, setOpenSubjects] = useState({});

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await API.get("/admin/questions/approved-grouped");
        setGroupedQuestions(res.data || {});
      } catch (err) {
        console.error("Failed to fetch approved questions:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const toggleSubject = (subject) => setOpenSubjects((current) => ({ ...current, [subject]: !current[subject] }));
  const subjects = Object.entries(groupedQuestions);

  if (loading) return <div className="approval-empty-state">Loading archive...</div>;

  return (
    <div className="approval-page approved-archive-page">
      <header className="approval-header">
        <div>
          <p className="approval-kicker">Archive</p>
          <h1>Approved Questions</h1>
          <span>Open a subject to browse its approved questions, grouped by date and chapter.</span>
        </div>
      </header>

      {subjects.length === 0 ? (
        <div className="approval-empty-state">No approved questions are available yet.</div>
      ) : (
        <div className="subject-archive-list">
          {subjects.map(([subject, dates]) => {
            const isOpen = Boolean(openSubjects[subject]);
            const total = questionCount(dates);
            return (
              <section key={subject} className={`subject-archive ${isOpen ? "is-open" : ""}`}>
                <button type="button" className="subject-archive-trigger" onClick={() => toggleSubject(subject)} aria-expanded={isOpen}>
                  <span className="subject-archive-icon"><FaBookOpen /></span>
                  <span className="subject-archive-name">{subject}</span>
                  <span className="subject-archive-count">{total} {total === 1 ? "question" : "questions"}</span>
                  <FaChevronDown className="subject-archive-chevron" />
                </button>

                {isOpen && (
                  <div className="subject-archive-content">
                    {Object.entries(dates).map(([date, questions]) => (
                      <section key={date} className="archive-date-group">
                        <h3>{date}<span>{questions.length} {questions.length === 1 ? "question" : "questions"}</span></h3>
                        <ol className="archive-question-list">
                          {questions.map((q, index) => (
                            <li key={q.id}>
                              <span className="archive-question-number">{index + 1}</span>
                              <div>
                                <p className="archive-question-chapter">{q.chapter?.name || "Uncategorized"}</p>
                                <div className="archive-question-statement"><MathText text={q.statement} /></div>
                              </div>
                            </li>
                          ))}
                        </ol>
                      </section>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}