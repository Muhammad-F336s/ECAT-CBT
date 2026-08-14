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

      {/* ── Hero Banner ── */}
      <div className="ob-hero">
        <div className="ob-hero-text">
          <div className="ob-hero-eyebrow">Personalize Your Experience</div>
          <h1 className="ob-title">
            Select Your <span>Interest</span>
          </h1>
          <p className="ob-subtitle">
            Choose your target universities or specific entry tests.
            We'll personalize your entire dashboard just for you.
          </p>
        </div>
        <div className="ob-hero-visual">
          <svg width="160" height="160" viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Outer ring */}
            <circle cx="80" cy="80" r="72" stroke="rgba(110,207,138,0.15)" strokeWidth="1.5"/>
            <circle cx="80" cy="80" r="58" stroke="rgba(110,207,138,0.12)" strokeWidth="1"/>

            {/* Graduation cap */}
            <g transform="translate(80,80)">
              {/* Cap base / board */}
              <ellipse cx="0" cy="-4" rx="34" ry="10" fill="rgba(110,207,138,0.9)"/>
              {/* Cap top */}
              <path d="M-24 -4 L0 -20 L24 -4" fill="rgba(80,170,108,0.9)"/>
              {/* Cap top board */}
              <ellipse cx="0" cy="-20" rx="26" ry="7" fill="rgba(110,207,138,0.95)"/>
              {/* Tassel string */}
              <line x1="24" y1="-4" x2="34" y2="10" stroke="rgba(200,230,210,0.7)" strokeWidth="1.5" strokeLinecap="round"/>
              {/* Tassel ball */}
              <circle cx="34" cy="13" r="4" fill="rgba(200,230,210,0.85)"/>
              {/* Body / scroll */}
              <rect x="-18" y="-3" width="36" height="22" rx="3" fill="rgba(255,255,255,0.12)"/>
              <line x1="-10" y1="5" x2="10" y2="5" stroke="rgba(255,255,255,0.25)" strokeWidth="1.2" strokeLinecap="round"/>
              <line x1="-10" y1="10" x2="6" y2="10" stroke="rgba(255,255,255,0.2)" strokeWidth="1.2" strokeLinecap="round"/>
              <line x1="-10" y1="15" x2="8" y2="15" stroke="rgba(255,255,255,0.2)" strokeWidth="1.2" strokeLinecap="round"/>
            </g>

            {/* Floating small accents */}
            <circle cx="22" cy="40" r="3" fill="rgba(110,207,138,0.3)"/>
            <circle cx="138" cy="54" r="2" fill="rgba(110,207,138,0.25)"/>
            <circle cx="30" cy="118" r="2.5" fill="rgba(110,207,138,0.2)"/>
            <circle cx="130" cy="112" r="4" fill="rgba(110,207,138,0.18)"/>

            {/* Sparkle top-right */}
            <g transform="translate(126, 32)">
              <line x1="0" y1="-7" x2="0" y2="7" stroke="rgba(110,207,138,0.5)" strokeWidth="1.2" strokeLinecap="round"/>
              <line x1="-7" y1="0" x2="7" y2="0" stroke="rgba(110,207,138,0.5)" strokeWidth="1.2" strokeLinecap="round"/>
              <line x1="-5" y1="-5" x2="5" y2="5" stroke="rgba(110,207,138,0.3)" strokeWidth="0.8" strokeLinecap="round"/>
              <line x1="5" y1="-5" x2="-5" y2="5" stroke="rgba(110,207,138,0.3)" strokeWidth="0.8" strokeLinecap="round"/>
            </g>
            {/* Sparkle bottom-left */}
            <g transform="translate(34, 128)">
              <line x1="0" y1="-5" x2="0" y2="5" stroke="rgba(110,207,138,0.35)" strokeWidth="1" strokeLinecap="round"/>
              <line x1="-5" y1="0" x2="5" y2="0" stroke="rgba(110,207,138,0.35)" strokeWidth="1" strokeLinecap="round"/>
            </g>
          </svg>
        </div>
      </div>

      <div className="ob-wrapper">

        {/* ── Mode Toggle ── */}
        <div className="ob-controls">
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
          <p className="ob-hint">
            {searchMode === "university"
              ? "Click to select multiple universities. Your dashboard will be tailored accordingly."
              : "Select one or more entry tests you are preparing for."}
          </p>
        </div>

        {/* ── Grid ── */}
        <div className="ob-grid">
          {searchMode === "university" ? (
            universities.map((uni) => {
              const isSelected = selectedUniversities.includes(uni.id);
              const bgColor = CATEGORY_COLORS[uni.name] || "#1a3a5c";
              return (
                <div
                  key={uni.id}
                  className={`ob-card ${isSelected ? "ob-card-selected" : ""}`}
                  style={{ "--card-color": bgColor }}
                  onClick={() => toggle(uni.id, selectedUniversities, setSelectedUniversities)}
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
                    {uni.tests?.filter(t => t.status === "PUBLISHED").length || 0} Test{uni.tests?.filter(t => t.status === "PUBLISHED").length !== 1 ? "s" : ""}
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

        {/* ── Selected Tests Panel (always visible in university mode) ── */}
        {searchMode === "university" && (
          <div className="ob-selected-tests-section">
            <h2 className="ob-section-title">Select Tests to Practice</h2>
            <p className="ob-section-subtitle">Pick the specific tests for your selected universities</p>

            {selectedUniversities.length === 0 ? (
              <div className="ob-empty-hint">
                <span>🏫</span>
                <span>No institute selected — choose a university above to see its available tests.</span>
              </div>
            ) : (
              <div className="ob-uni-test-groups">
                {selectedUniversities.map(uniId => {
                  const uni = universities.find(u => u.id === uniId);
                  if (!uni) return null;
                  const publishedTests = uni.tests?.filter(t => t.status === "PUBLISHED") || [];

                  return (
                    <div key={uni.id} className="ob-uni-test-group">
                      <h3 className="ob-uni-name">{uni.name}</h3>
                      {publishedTests.length > 0 ? (
                        <div className="ob-test-pills">
                          {publishedTests.map(test => {
                            const isTestSelected = selectedExams.includes(test.id);
                            return (
                              <button
                                key={test.id}
                                className={`ob-test-pill ${isTestSelected ? "active" : ""}`}
                                onClick={() => toggle(test.id, selectedExams, setSelectedExams)}
                              >
                                {test.name}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="ob-no-tests">⚠️ No upcoming tests added by admin</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Footer ── */}
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
