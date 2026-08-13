import React, { useState, useEffect } from "react";
import API from "../utils/api";
import "./OnboardingScreen.css";

const CATEGORY_COLORS = {
  "NUST": "#1a3a5c",
  "FAST NUCES": "#0a2744",
  "UET Lahore": "#8B1A1A",
  "GIKI": "#1a4731",
  "COMSATS": "#1B3A6B",
  "PIEAS": "#2d4a1e",
  "NED University": "#4a1a1a",
  "UHS / PMDC": "#1e3a2f",
  "NUMS": "#3a1a4a",
  "Agha Khan University": "#1a1a3a",
  "KMU (ETEA)": "#3a2a1a",
  "LUMS": "#1a1a1a",
  "IBA Karachi": "#4a2a00",
  "Punjab University (PU)": "#2a1a4a",
};

const OnboardingScreen = ({ onComplete }) => {
  const [universities, setUniversities] = useState([]);
  const [exams, setExams] = useState([]);
  const [searchMode, setSearchMode] = useState("university");
  const [selectedUniversities, setSelectedUniversities] = useState([]);
  const [selectedExams, setSelectedExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await API.get("/exams/onboarding-data");
        setUniversities(res.data.universities);
        setExams(res.data.exams);
      } catch (err) {
        console.error("Failed to load onboarding data", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const toggle = (id, list, setList) => {
    setList(list.includes(id) ? list.filter(x => x !== id) : [...list, id]);
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await API.post("/exams/set-interests", {
        universityIds: selectedUniversities,
        examIds: selectedExams,
      });
      onComplete();
    } catch (err) {
      console.error("Failed to save interests", err);
    } finally {
      setSaving(false);
    }
  };

  const totalSelected = selectedUniversities.length + selectedExams.length;

  if (loading) {
    return (
      <div className="ob-fullscreen">
        <div className="ob-loader">
          <div className="ob-spinner"></div>
          <p>Loading your options...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ob-fullscreen">
      <div className="ob-wrapper">

        {/* Header */}
        <div className="ob-header">
          <div className="ob-logo-mark">🎯</div>
          <h1 className="ob-title">Select Your Interest</h1>
          <p className="ob-subtitle">
            Choose your target universities or specific entry tests.<br/>
            We'll personalize your entire dashboard just for you.
          </p>
        </div>

        {/* Mode Toggle */}
        <div className="ob-toggle-bar">
          <button
            className={`ob-toggle-btn ${searchMode === "university" ? "ob-toggle-active" : ""}`}
            onClick={() => setSearchMode("university")}
          >
            🏛️ Search by University
          </button>
          <button
            className={`ob-toggle-btn ${searchMode === "exam" ? "ob-toggle-active" : ""}`}
            onClick={() => setSearchMode("exam")}
          >
            📝 Search by Entry Test
          </button>
        </div>

        {/* Selection hint */}
        <p className="ob-hint">
          {searchMode === "university"
            ? "Click to select multiple universities. Your dashboard will be tailored accordingly."
            : "Select one or more entry tests you are preparing for."}
        </p>

        {/* Grid */}
        <div className="ob-grid">
          {searchMode === "university" ? (
            universities.map((uni) => {
              const isSelected = selectedUniversities.includes(uni.id);
              const bgColor = CATEGORY_COLORS[uni.name] || "#1a3a5c";
              return (
                <div
                  key={uni.id}
                  className={`ob-card ${isSelected ? "ob-card-selected" : ""}`}
                  onClick={() => toggle(uni.id, selectedUniversities, setSelectedUniversities)}
                  style={{ "--card-color": bgColor }}
                >
                  {isSelected && <div className="ob-checkmark">✓</div>}
                  <div className="ob-card-logo-wrap">
                    <img
                      src={uni.logoUrl}
                      alt={uni.name}
                      className="ob-card-logo"
                      onError={(e) => {
                        e.target.style.display = "none";
                        e.target.nextSibling.style.display = "flex";
                      }}
                    />
                    <div className="ob-card-logo-fallback" style={{ display: "none" }}>
                      {uni.name.split(" ").map(w => w[0]).join("").slice(0, 3)}
                    </div>
                  </div>
                  <h3 className="ob-card-name">{uni.name}</h3>
                  <p className="ob-card-sub">📍 {uni.location}</p>
                  <p className="ob-card-tests">
                    {uni.tests?.length || 0} Test{uni.tests?.length !== 1 ? "s" : ""}
                  </p>
                </div>
              );
            })
          ) : (
            exams.map((exam) => {
              const isSelected = selectedExams.includes(exam.id);
              return (
                <div
                  key={exam.id}
                  className={`ob-card ob-exam-card ${isSelected ? "ob-card-selected" : ""}`}
                  onClick={() => toggle(exam.id, selectedExams, setSelectedExams)}
                >
                  {isSelected && <div className="ob-checkmark">✓</div>}
                  <div className="ob-exam-badge">
                    {exam.name.split(" ").slice(0, 2).join(" ")}
                  </div>
                  <h3 className="ob-card-name">{exam.name}</h3>
                  <p className="ob-card-sub">🏛️ {exam.university?.name || "General"}</p>
                  {exam.examDate && (
                    <p className="ob-card-date">
                      📅 {new Date(exam.examDate).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="ob-footer">
          {totalSelected > 0 && (
            <p className="ob-selected-count">
              ✅ {totalSelected} item{totalSelected !== 1 ? "s" : ""} selected
            </p>
          )}
          <button
            className="ob-submit-btn"
            onClick={handleSubmit}
            disabled={saving || totalSelected === 0}
          >
            {saving ? (
              <><span className="ob-btn-spinner"></span> Setting up your dashboard...</>
            ) : (
              "Set My Dashboard →"
            )}
          </button>
          <button className="ob-skip-btn" onClick={onComplete}>
            Skip for now
          </button>
        </div>

      </div>
    </div>
  );
};

export default OnboardingScreen;
