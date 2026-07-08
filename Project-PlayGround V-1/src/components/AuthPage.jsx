import { useState, useEffect } from "react";
import API from "../utils/api";
import "./AuthPage.css";
import googleIcon from "../assets/google-icon.svg";

const OPEN_OPTIONS = "popup=yes,width=600,height=700,top=100,left=100";
const API_ORIGIN = "http://localhost:8787";

const parsePopupAuth = () => {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");
  const userParam = params.get("user");
  if (!token || !userParam) return null;

  try {
    const user = JSON.parse(decodeURIComponent(userParam));
    return { token, user };
  } catch (error) {
    console.error("Error parsing popup auth:", error);
    return null;
  }
};

const openAuthPopup = (url, onSuccess) => {
  const popup = window.open(url, "authPopup", OPEN_OPTIONS);
  if (!popup || popup.closed || typeof popup.closed === "undefined") {
    window.location.href = url;
    return null;
  }

  const interval = window.setInterval(() => {
    if (!popup || popup.closed) {
      window.clearInterval(interval);
      return;
    }

    try {
      const popupUrl = new URL(popup.location.href);
      if (popupUrl.origin !== window.location.origin) return;

      const params = popupUrl.searchParams;
      const token = params.get("token");
      const userParam = params.get("user");
      if (token && userParam) {
        const user = JSON.parse(decodeURIComponent(userParam));
        localStorage.setItem("token", token);
        localStorage.setItem("user", JSON.stringify(user));
        onSuccess(user);
        popup.close();
        window.clearInterval(interval);
      }
    } catch (error) {
      // ignore cross-origin loading states until redirected back to our app
      console.error("Error parsing popup auth:", error);
    }
  }, 500);

  popup.focus();
  return popup;
};

const handleGoogleAuth = (onSuccess) => {
  const returnTo = encodeURIComponent(window.location.origin);
  openAuthPopup(`${API_ORIGIN}/api/auth/google?returnTo=${returnTo}`, onSuccess);
};


const handleGithubAuth = (onSuccess) => {
  const returnTo = encodeURIComponent(window.location.origin);
  openAuthPopup(`${API_ORIGIN}/api/auth/github?returnTo=${returnTo}`, onSuccess);
};

const AuthPage = ({ onAuthSuccess }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [role, setRole] = useState("student");
  const [adminSecretCode, setAdminSecretCode] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showSecretCode, setShowSecretCode] = useState(false);

  useEffect(() => {
    const popupAuth = parsePopupAuth();
    if (popupAuth) {
      localStorage.setItem("token", popupAuth.token);
      localStorage.setItem("user", JSON.stringify(popupAuth.user));
      onAuthSuccess(popupAuth.user);
    }
  }, [onAuthSuccess]);

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // const handleRoleChange = (e) => {
  //   setRole(e.target.value);
  // };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");
    setLoading(true);

    if (isSignUp && formData.password !== formData.confirmPassword) {
      setError("Password and confirm password do not match.");
      setLoading(false);
      return;
    }

    const endpoint = isSignUp ? "/auth/signup" : "/auth/login";
    const payload = isSignUp
      ? {
          name: formData.name,
          email: formData.email,
          password: formData.password,
          role,
        }
      : {
          email: formData.email,
          password: formData.password,
          role,
          secretCode: role === "admin" ? adminSecretCode : undefined,
        };

    try {
      // handle forgot password separately
      if (isForgotPassword) {
        const resetRes = await API.post("/auth/forgot-password", { email: formData.email });
        setSuccessMessage(resetRes.data.message || "Reset link dispatched.");
        setLoading(false);
        return;
      }

      const res = await API.post(endpoint, payload);

      if (isSignUp) {
        if (role === "admin") {
          setSuccessMessage(
            "Admin registration submitted. Main admin will approve and allocate your secret key.",
          );
          setLoading(false);
          return;
        }

        setSuccessMessage(
          res.data.message || "Registration submitted successfully. Your account is pending approval by admin.",
        );
        setLoading(false);
        return;
      }

      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));
      onAuthSuccess(res.data.user);
    } catch (error) {
      setError(
        error.response?.data?.error ||
          "Authentication layer processing crashed.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page-container">
      <div
        className={`auth-card-wrapper ${isSignUp ? "right-panel-active" : ""}`}
      >
        {/* FORM CONTAINER */}
        <div className="form-panel-container">
          <form onSubmit={handleSubmit} className="auth-core-form">
            <h2 className="form-main-title">
              {isForgotPassword ? "Recover Password" : isSignUp ? "Create Account" : "Sign In"}
            </h2>
            {!isForgotPassword && (
              <div className="role-toggle-group">
                <span
                  className="role-toggle-label"
                  style={{
                    padding: "auto",
                    margin: " 10px auto",
                    fontSize: "0.9rem",
                  }}
                >
                  Select Role
                </span>
                <div className="role-toggle-wrapper">
                  <button
                    type="button"
                    className={`role-toggle-btn ${role === "student" ? "active" : ""}`}
                    onClick={() => setRole("student")}
                  >
                    User
                  </button>
                  <button
                    type="button"
                    className={`role-toggle-btn ${role === "admin" ? "active" : ""}`}
                    onClick={() => setRole("admin")}
                  >
                    Admin
                  </button>
                  <div
                    className="role-toggle-indicator"
                    style={{
                      transform:
                        role === "admin" ? "translateX(100%)" : "translateX(0)",
                    }}
                  />
                </div>
              </div>
            )}

            {!isForgotPassword && (
              <>
                <div className="oauth-btn-row">
                  <button
                    type="button"
                    onClick={() => handleGoogleAuth(onAuthSuccess)}
                    className="oauth-circle-btn"
                  >
                    <img src={googleIcon} alt="Google" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleGithubAuth(onAuthSuccess)}
                    className="oauth-circle-btn"
                  >
                    <img
                      src="https://www.svgrepo.com/show/512317/github-142.svg"
                      alt="Github"
                    />
                  </button>
                </div>
                <p className="form-subtext">or use your account email</p>
              </>
            )}
            {successMessage && (
              <div className="auth-success-alert">{successMessage}</div>
            )}
            {error && <div className="auth-error-alert">{error}</div>}

            {isSignUp && (
              <div className="input-field-group">
                <input
                  type="text"
                  name="name"
                  placeholder="Full Name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                />
              </div>
            )}

            <div className="input-field-group">
              <input
                type="email"
                name="email"
                placeholder="Email Address"
                value={formData.email}
                onChange={handleInputChange}
                required
              />
            </div>

            {!isForgotPassword && (
              <div className="input-field-group input-field-group--with-action">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder="Password"
                value={formData.password}
                onChange={handleInputChange}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            )}

            {isSignUp && (
              <div className="input-field-group input-field-group--with-action">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  name="confirmPassword"
                  placeholder="Confirm Password"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((value) => !value)}
                >
                  {showConfirmPassword ? "Hide" : "Show"}
                </button>
              </div>
            )}

            {!isSignUp && !isForgotPassword && role === "admin" && (
              <div className="input-field-group input-field-group--with-action">
                <input
                  type={showSecretCode ? "text" : "password"}
                  name="adminSecretCode"
                  placeholder="Admin Secret Code"
                  value={adminSecretCode}
                  onChange={(e) => setAdminSecretCode(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowSecretCode((value) => !value)}
                >
                  {showSecretCode ? "Hide" : "Show"}
                </button>
              </div>
            )}

            {!isSignUp && (
              <div className="forgot-password-link">
                <a href="#" onClick={(e) => { e.preventDefault(); setIsForgotPassword(!isForgotPassword); }}>
                  {isForgotPassword ? "Back to Login" : "Forgot your password?"}
                </a>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="auth-action-submit-btn"
            >
              {loading ? "Processing..." : isForgotPassword ? "Send Reset Link" : isSignUp ? "Sign Up" : "Sign In"}
            </button>
            {!isForgotPassword && (
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="auth-mobile-toggle-btn"
              >
                {isSignUp
                  ? "Already have an account? Sign in"
                  : "Need an account? Sign up"}
              </button>
            )}
          </form>
        </div>

        {/* SIDE TOGGLE PANEL (The Green Overlay Panel) */}
        {!isForgotPassword && (
          <div className="overlay-side-panel">
            <div className="overlay-inner-content">
              <h2 className="overlay-heading">
                {isSignUp ? "Welcome Back!" : "Create Account"}
              </h2>
              <p className="overlay-paragraph">
                {isSignUp
                  ? "To keep connected with us please login with your personal info"
                  : "Join our green workspace and start collaborating right away"}
              </p>
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="overlay-toggle-action-btn"
              >
                {isSignUp ? "Sign In" : "Sign Up"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuthPage;
