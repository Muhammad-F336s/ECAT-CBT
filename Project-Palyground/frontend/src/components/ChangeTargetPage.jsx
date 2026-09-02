import { useNavigate } from "react-router-dom";
import "./ChangeTargetPage.css";

export default function ChangeTargetPage({ user }) {
  const navigate = useNavigate();

  return (
    <div className="change-target-page">
      <header className="change-target-header">
        <span>Preferences</span>
        <h1>Change your target</h1>
        <p>Update the academic path used to personalise your learning, or choose the universities and entry tests you want to prepare for.</p>
      </header>

      <div className="change-target-grid">
        <section className="change-target-card change-target-card--field">
          <div className="change-target-icon">⌁</div>
          <span className="change-target-label">Academic profile</span>
          <h2>Change your field</h2>
          <p>Update your academic track and subjects. These determine the subjects visible in your test form and Content Library.</p>
          {user?.academicTrack && <div className="change-target-current">Current field: <strong>{user.academicTrack}</strong></div>}
          <button type="button" onClick={() => navigate("/academic-profile")}>Update field &amp; subjects <span>→</span></button>
        </section>

        <section className="change-target-card change-target-card--tests">
          <div className="change-target-icon">⌖</div>
          <span className="change-target-label">Exam preferences</span>
          <h2>Universities &amp; entry tests</h2>
          <p>Select the universities you are targeting or select specific entry tests to keep your dashboard relevant to your goals.</p>
          <div className="change-target-current">You can select more than one university or entry test.</div>
          <button type="button" onClick={() => navigate("/interests")}>Select universities &amp; tests <span>→</span></button>
        </section>
      </div>
    </div>
  );
}
