import { useNavigate } from "react-router-dom";
import "./TestModeSelection.css";

export default function TestModeSelection() {
  const navigate = useNavigate();

  const openForm = (mode) => {
    navigate(`/test/form?mode=${mode}`);
  };

  return (
    <div className="test-mode-selection-page">
      <div className="selection-panel">
        <div className="selection-badge">Choose Your Test Flow</div>
        <h1>Select Test Mode</h1>
        <p className="selection-copy">
          Please choose a mode and then confirm your details before continuing
          to the CBT simulator.
        </p>

        <div className="selection-buttons">
          <button
            type="button"
            className="selection-button selection-button--practice"
            onClick={() => openForm("practice")}
          >
            Practice Test Sample
          </button>
          <button
            type="button"
            className="selection-button selection-button--realtime"
            onClick={() => openForm("realtime")}
          >
            Real Time Test Type
          </button>
        </div>

        <div className="selection-note">
          Both options use the same CBT theme. The Real Time Test redirects you
          directly into the full simulator flow.
        </div>
      </div>
    </div>
  );
}
