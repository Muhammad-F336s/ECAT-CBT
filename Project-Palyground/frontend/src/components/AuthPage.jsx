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

const DOMAINS = ["Engineering", "Medical", "Computer Science"];

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
    domain: "",
    cnic: "",
  });
  const [error, setError] = useState("");
  const [isFrozen, setIsFrozen] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showSecretCode, setShowSecretCode] = useState(false);

  // OTP verification state
  const [otpStep, setOtpStep] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    const popupAuth = parsePopupAuth();
    if (popupAuth) {
      localStorage.setItem("token", popupAuth.token);
      localStorage.setItem("user", JSON.stringify(popupAuth.user));
      onAuthSuccess(popupAuth.user);
    }
  }, [onAuthSuccess]);

  // Countdown timer for resend button
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const formatCnic = (value) => {
    // Auto-format CNIC as XXXXX-XXXXXXX-X
    const digits = value.replace(/\D/g, "").slice(0, 13);
    if (digits.length <= 5) return digits;
    if (digits.length <= 12) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
    return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
  };

  const handleCnicChange = (e) => {
    setFormData({ ...formData, cnic: formatCnic(e.target.value) });
  };

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
          domain: formData.domain,
          cnic: formData.cnic,
        }
      : {
          email: formData.email,
          password: formData.password,
          role,
          secretCode: role === "admin" ? adminSecretCode : undefined,
        };

    try {
      if (isForgotPassword) {
        const resetRes = await API.post("/auth/forgot-password", { email: formData.email });
        setSuccessMessage(resetRes.data.message || "Reset link dispatched.");
        setLoading(false);
        return;
      }

      const res = await API.post(endpoint, payload);

      if (isSignUp) {
        if (role === "admin") {
          setSuccessMessage("Admin registration submitted. Main admin will approve and allocate your secret key.");
          setLoading(false);
          return;
        }

        // Student signup → show OTP step
        if (res.data.requiresOtp) {
          setPendingEmail(formData.email);
          setOtpStep(true);
          setResendCooldown(60);
          setLoading(false);
          return;
        }

        setSuccessMessage(res.data.message || "Registration submitted successfully.");
        setLoading(false);
        return;
      }

      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));
      onAuthSuccess(res.data.user);
    } catch (error) {
      if (error.response?.data?.isFrozen) {
        setIsFrozen(true);
        setError(error.response.data.error);
      } else {
        setIsFrozen(false);
        setError(
          error.response?.data?.error ||
            error.message ||
            "Unable to connect to authentication server. Please check your network or ensure backend engine is running on port 8787.",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError("");
    setOtpLoading(true);
    try {
      const res = await API.post("/auth/verify-email", { email: pendingEmail, otp });
      setOtpStep(false);
      setSuccessMessage(res.data.message || "Email verified! Your account is pending admin approval.");
    } catch (err) {
      setError(err.response?.data?.error || "OTP verification failed.");
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setError("");
    try {
      await API.post("/auth/resend-otp", { email: pendingEmail });
      setResendCooldown(60);
      setSuccessMessage("A new OTP has been sent to your email.");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to resend OTP.");
    }
  };

  // ---- OTP Verification Screen ----
  if (otpStep) {
    return (
      <div className="auth-page-container">
        <div className="auth-card-wrapper">
          <div className="form-panel-container">
            <form onSubmit={handleVerifyOtp} className="auth-core-form">
              <div className="otp-icon">✉️</div>
              <h2 className="form-main-title">Verify Your Email</h2>
              <p className="form-subtext" style={{ textAlign: "center", marginBottom: "18px" }}>
                We sent a 6-digit code to <strong>{pendingEmail}</strong>. Enter it below.
              </p>

              {successMessage && <div className="auth-success-alert">{successMessage}</div>}
              {error && <div className="auth-error-alert">{error}</div>}

              <div className="input-field-group">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="Enter 6-digit OTP"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  required
                  className="otp-input"
                  style={{ letterSpacing: "8px", fontSize: "1.4rem", textAlign: "center" }}
                />
              </div>

              <button type="submit" disabled={otpLoading || otp.length < 6} className="auth-action-submit-btn">
                {otpLoading ? "Verifying..." : "Verify Email"}
              </button>

              <div style={{ textAlign: "center", marginTop: "14px" }}>
                <button
                  type="button"
                  className="auth-mobile-toggle-btn"
                  onClick={handleResendOtp}
                  disabled={resendCooldown > 0}
                  style={{ opacity: resendCooldown > 0 ? 0.5 : 1 }}
                >
                  {resendCooldown > 0 ? `Resend OTP in ${resendCooldown}s` : "Resend OTP"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page-container">
      <div className={`auth-card-wrapper ${isSignUp ? "right-panel-active" : ""}`}>
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
                  style={{ padding: "auto", margin: " 10px auto", fontSize: "0.9rem" }}
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
                    style={{ transform: role === "admin" ? "translateX(100%)" : "translateX(0)" }}
                  />
                </div>
              </div>
            )}

            {!isForgotPassword && (
              <>
                <div className="oauth-btn-row">
                  <button type="button" onClick={() => handleGoogleAuth(onAuthSuccess)} className="oauth-circle-btn">
                    <img src={googleIcon} alt="Google" />
                  </button>
                  <button type="button" onClick={() => handleGithubAuth(onAuthSuccess)} className="oauth-circle-btn">
                    <img src="https://www.svgrepo.com/show/512317/github-142.svg" alt="Github" />
                  </button>
                </div>
                <p className="form-subtext">or use your account email</p>
              </>
            )}

            {successMessage && <div className="auth-success-alert">{successMessage}</div>}
            {error && (
              <div className={`auth-error-alert ${isFrozen ? "frozen-alert" : ""}`}>
                {isFrozen ? (
                  <>
                    <strong>Account Frozen</strong>
                    <br />
                    {error}
                  </>
                ) : (
                  error
                )}
              </div>
            )}

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
                <button type="button" onClick={() => setShowPassword((value) => !value)}>
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            )}

            {isSignUp && (
              <>
                <div className="input-field-group input-field-group--with-action">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    name="confirmPassword"
                    placeholder="Confirm Password"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    required
                  />
                  <button type="button" onClick={() => setShowConfirmPassword((value) => !value)}>
                    {showConfirmPassword ? "Hide" : "Show"}
                  </button>
                </div>

                {role === "student" && (
                  <>
                    {/* Domain Selector */}
                    <div className="input-field-group">
                      <select
                        name="domain"
                        value={formData.domain}
                        onChange={handleInputChange}
                        required
                        className="auth-select"
                      >
                        <option value="">Select Your Domain</option>
                        {DOMAINS.map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>

                    {/* CNIC */}
                    <div className="input-field-group">
                      <input
                        type="text"
                        name="cnic"
                        placeholder="CNIC  e.g. 12345-1234567-1"
                        value={formData.cnic}
                        onChange={handleCnicChange}
                        required
                        maxLength={15}
                      />
                    </div>
                  </>
                )}
              </>
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
                <button type="button" onClick={() => setShowSecretCode((value) => !value)}>
                  {showSecretCode ? "Hide" : "Show"}
                </button>
              </div>
            )}

            {!isSignUp && (
              <div className="forgot-password-link">
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    setIsForgotPassword(!isForgotPassword);
                  }}
                >
                  {isForgotPassword ? "Back to Login" : "Forgot your password?"}
                </a>
              </div>
            )}

            <button type="submit" disabled={loading} className="auth-action-submit-btn">
              {loading
                ? "Processing..."
                : isForgotPassword
                  ? "Send Reset Link"
                  : isSignUp
                    ? "Sign Up"
                    : "Sign In"}
            </button>
            {!isForgotPassword && (
              <button type="button" onClick={() => setIsSignUp(!isSignUp)} className="auth-mobile-toggle-btn">
                {isSignUp ? "Already have an account? Sign in" : "Need an account? Sign up"}
              </button>
            )}
          </form>
        </div>

        {/* SIDE TOGGLE PANEL */}
        {!isForgotPassword && (
          <div className="overlay-side-panel">
            <div className="overlay-inner-content">
              <h2 className="overlay-heading">{isSignUp ? "Welcome Back!" : "Create Account"}</h2>
              <p className="overlay-paragraph">
                {isSignUp
                  ? "To keep connected with us please login with your personal info"
                  : "Join our green workspace and start collaborating right away"}
              </p>
              <button type="button" onClick={() => setIsSignUp(!isSignUp)} className="overlay-toggle-action-btn">
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
