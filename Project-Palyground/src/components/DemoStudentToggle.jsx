import { useState } from "react";
import { FaUserGraduate, FaKey, FaTimes, FaExchangeAlt } from "react-icons/fa";
import API from "../utils/api";
import "./DemoStudentToggle.css";

export default function DemoStudentToggle() {
  const [showModal, setShowModal] = useState(false);
  const [secretCode, setSecretCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLaunchDemo = async (e) => {
    e.preventDefault();
    if (!secretCode.trim()) {
      setError("Please enter your Admin Secret Code.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await API.post("/admin/impersonate", {
        secretCode: secretCode.trim(),
      });

      const currentToken = localStorage.getItem("token");
      const currentUser = localStorage.getItem("user");

      if (currentToken) {
        localStorage.setItem("originalAdminToken", currentToken);
      }
      if (currentUser) {
        localStorage.setItem("originalAdminUser", currentUser);
      }

      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.student));

      setShowModal(false);
      window.location.href = "/dashboard";
    } catch (err) {
      console.error("Demo mode launch failed:", err);
      setError(
        err.response?.data?.error ||
          "Invalid Secret Code. Failed to launch Demo Mode."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="demo-student-toggle-btn"
        onClick={() => {
          setError("");
          setSecretCode("");
          setShowModal(true);
        }}
        title="Switch to Live Demo Student Experience"
      >
        <FaUserGraduate className="demo-toggle-icon" />
        <span className="demo-toggle-label">Demo Student View</span>
        <FaExchangeAlt className="demo-toggle-arrow" />
      </button>

      {showModal && (
        <div className="demo-modal-overlay">
          <div className="demo-modal-card">
            <div className="demo-modal-header">
              <div className="demo-modal-title">
                <FaKey className="key-icon" />
                <h3>Launch Demo Student Mode</h3>
              </div>
              <button
                type="button"
                className="demo-modal-close"
                onClick={() => setShowModal(false)}
              >
                <FaTimes />
              </button>
            </div>

            <p className="demo-modal-desc">
              Experience the CBT simulator and student workflow in real-time.
              Please enter your <strong>Admin Secret Code</strong> to authenticate:
            </p>

            {error && <div className="demo-modal-error">{error}</div>}

            <form onSubmit={handleLaunchDemo} className="demo-modal-form">
              <div className="demo-input-wrapper">
                <input
                  type="password"
                  placeholder="e.g. ADM-XXXX-XXXX"
                  value={secretCode}
                  onChange={(e) => setSecretCode(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              <div className="demo-modal-actions">
                <button
                  type="button"
                  className="demo-btn-cancel"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="demo-btn-submit"
                  disabled={loading}
                >
                  {loading ? "Verifying..." : "Enter Live Student View"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
