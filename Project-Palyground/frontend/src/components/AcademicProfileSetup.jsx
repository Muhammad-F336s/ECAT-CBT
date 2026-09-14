import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../utils/api";
import "./AcademicProfileSetup.css";

const TRACKS = [{ id: "Pre-Engineering", label: "FSc Pre-Engineering" }, { id: "Pre-Medical", label: "FSc Pre-Medical" }, { id: "ICS", label: "ICS" }, { id: "ICom", label: "ICom" }, { id: "FA", label: "FA / Arts" }, { id: "Other / Gap-year", label: "Other / Gap-year" }];
const SUBJECTS = [
  { id: "math", label: "Mathematics" },
  { id: "physics", label: "Physics" },
  { id: "chemistry", label: "Chemistry" },
  { id: "biology", label: "Biology" },
  { id: "english", label: "English" },
  { id: "computer", label: "Computer Science" },
];
const RECOMMENDED_SUBJECTS = {
  "Pre-Engineering": ["math", "physics", "chemistry", "english"],
  "Pre-Medical": ["biology", "physics", "chemistry", "english"],
  ICS: ["computer", "math", "physics", "english"],
  ICom: ["math", "english"],
  FA: ["english"],
  "Other / Gap-year": ["english"],
};
const ALLOWED_SUBJECTS = {
  "Pre-Engineering": ["math", "physics", "chemistry", "english"],
  "Pre-Medical": ["biology", "physics", "chemistry", "english"],
  ICS: ["computer", "math", "physics", "english"],
  ICom: ["math", "english"],
  FA: ["english"],
  "Other / Gap-year": ["math", "physics", "chemistry", "biology", "english", "computer"],
};

const formatTime = (seconds) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
const maskCnic = (cnic) => cnic ? `${cnic.slice(0, 5)}-*******-${cnic.slice(-1)}` : "Not provided";

export default function AcademicProfileSetup({ user, onComplete }) {
  const navigate = useNavigate();
  const [profileUser, setProfileUser] = useState(user);
  const [track, setTrack] = useState("");
  const [subjects, setSubjects] = useState([]);
  const [expiresAt, setExpiresAt] = useState(null);
  const [now, setNow] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const start = async () => {
      try {
        const res = await API.post("/user/academic-profile/start");
        const nextUser = res.data.user;
        setProfileUser(nextUser);
        setTrack(nextUser.academicTrack || "");
        setSubjects(nextUser.academicSubjects || []);
        setExpiresAt(nextUser.academicProfileEditExpiresAt ? new Date(nextUser.academicProfileEditExpiresAt).getTime() : null);
        setNow(Date.now());
      } catch (err) {
        setError(err.response?.data?.error || "Unable to load your profile setup.");
      } finally {
        setLoading(false);
      }
    };
    start();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const secondsRemaining = useMemo(() => expiresAt ? Math.max(0, Math.ceil((expiresAt - now) / 1000)) : 0, [expiresAt, now]);
  const hasSavedProfile = Boolean(profileUser?.academicProfileCompleted);
  const isExpired = hasSavedProfile && Boolean(expiresAt) && secondsRemaining === 0;

  const selectTrack = (nextTrack) => {
    setTrack(nextTrack);
    setSubjects(RECOMMENDED_SUBJECTS[nextTrack] || []);
    setError("");
  };

  const toggleSubject = (id) => {
    setSubjects((current) => {
      if (current.includes(id)) return current.filter((subject) => subject !== id);
      if (current.length >= 5) {
        setError("You can select a maximum of five subjects.");
        return current;
      }
      setError("");
      return [...current, id];
    });
  };

  const save = async (event) => {
    event.preventDefault();
    if (isExpired) return setError("Your 10-minute free correction window has expired. Submit a profile change request instead.");
    setSaving(true);
    setError("");
    try {
      const res = await API.put("/user/academic-profile", { academicTrack: track, academicSubjects: subjects });
      setProfileUser(res.data.user);
      setExpiresAt(res.data.user.academicProfileEditExpiresAt ? new Date(res.data.user.academicProfileEditExpiresAt).getTime() : null);
      setNow(Date.now());
      onComplete(res.data.user);
    } catch (err) {
      setError(err.response?.data?.error || "Unable to save your academic profile.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="academic-profile-loading">Preparing your academic profile…</div>;

  return (
    <main className="academic-profile-page">
      <section className="academic-profile-card">
        <div className="academic-profile-hero">
          <div className="academic-profile-heading">
            <span className="academic-profile-kicker">Student profile • Step 1 of 1</span>
            <h1>Build your <em>study path.</em></h1>
            <p>Choose the subjects that matter to you. Your practice tests and learning library will be tailored around them.</p>
          </div>
          <div className="academic-profile-orbit" aria-hidden="true">
            <span>✦</span><strong>✎</strong><i>✦</i>
          </div>
        </div>

        <div className={`academic-profile-notice ${isExpired ? "is-expired" : ""}`}>
          <div>
            <strong>{hasSavedProfile ? "Your profile has been saved." : "Review your academic profile carefully."}</strong>
            <p>{isExpired ? "This is your saved academic profile. It is now read-only; request a change for an administrator to review." : hasSavedProfile ? "You may update these details while the 10-minute free correction window is active. Once it expires, changes will be locked and cannot be made directly." : "Your academic profile personalizes tests and study content. After submitting, you have a 10-minute free correction window; after that, changes require an approved request."}</p>
          </div>
          {hasSavedProfile && <div className="academic-profile-timer" aria-live="polite">
            <span>{isExpired ? "Time expired" : "10-minute free correction window"}</span>
            <strong>{formatTime(secondsRemaining)}</strong>
          </div>}
        </div>

        <form onSubmit={save}>
          <div className="academic-profile-details">
            <label>Full name<input value={profileUser?.name || ""} disabled /></label>
            <label>Email<input value={profileUser?.email || ""} disabled /></label>
            <label>CNIC<input value={maskCnic(profileUser?.cnic)} disabled /></label>
          </div>

          <fieldset disabled={isExpired || saving}>
            <legend>Choose your academic track</legend>
            <div className="academic-track-grid">
              {TRACKS.map((item) => <button type="button" key={item.id} className={track === item.id ? "selected" : ""} onClick={() => selectTrack(item.id)}>{item.label}</button>)}
            </div>

            {track && <div className="academic-subject-section">
              <div><h2>Select your subjects</h2><p>Recommended subjects are selected automatically. Only subjects relevant to your academic track are available.</p></div>
              <div className="academic-subject-grid">
                {SUBJECTS.filter((subject) => (ALLOWED_SUBJECTS[track] || []).includes(subject.id)).map((subject) => <label key={subject.id} className={subjects.includes(subject.id) ? "selected" : ""}>
                  <input type="checkbox" checked={subjects.includes(subject.id)} onChange={() => toggleSubject(subject.id)} />
                  {subject.label}
                </label>)}
              </div>
              <small>{subjects.length}/5 subjects selected</small>
            </div>}
          </fieldset>

          {error && <p className="academic-profile-error" role="alert">{error}</p>}
          {isExpired ? (
            <button type="button" className="academic-profile-submit" onClick={() => navigate("/profile-change-request")}>
              Contact admin to ask a change
            </button>
          ) : (
            <button className="academic-profile-submit" disabled={saving || !track || subjects.length === 0}>
              {saving ? "Saving profile…" : hasSavedProfile ? "Save changes" : "Save profile and start edit window"}
            </button>
          )}
        </form>
      </section>
    </main>
  );
}
