import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import API from "../utils/api";
import "./AuthPage.css";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      return setError("Passwords do not match.");
    }
    setError("");
    setLoading(true);
    try {
      await API.post("/auth/reset-password", { token, newPassword: password });
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to reset password.");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="auth-page-container" style={{ justifyContent: "center", alignItems: "center", display: "flex", width: "100%", height: "100vh" }}>
        <h2 style={{ color: "red" }}>Invalid or missing reset token!</h2>
      </div>
    );
  }

  return (
    <div className="auth-page-container">
      <div className="auth-card-wrapper" style={{ margin: "auto", maxWidth: "450px", height: "auto" }}>
        <div className="form-panel-container" style={{ width: "100%", position: "relative" }}>
          <form onSubmit={handleSubmit} className="auth-core-form" style={{ padding: "40px" }}>
            <h2 className="form-main-title">Set New Password</h2>
            {success ? (
              <div style={{ textAlign: "center" }}>
                <div className="auth-success-alert">Password updated successfully!</div>
                <button
                  type="button"
                  onClick={() => navigate("/auth")}
                  className="auth-action-submit-btn"
                  style={{ marginTop: "20px" }}
                >
                  Return to Login
                </button>
              </div>
            ) : (
              <>
                <p className="form-subtext" style={{ marginBottom: "20px" }}>Enter your new strong password below.</p>
                {error && <div className="auth-error-alert">{error}</div>}
                
                <div className="input-field-group">
                  <input
                    type="password"
                    placeholder="New Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="input-field-group">
                  <input
                    type="password"
                    placeholder="Confirm New Password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
                
                <button
                  type="submit"
                  disabled={loading}
                  className="auth-action-submit-btn"
                  style={{ marginTop: "20px" }}
                >
                  {loading ? "Processing..." : "Update Password"}
                </button>
              </>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
