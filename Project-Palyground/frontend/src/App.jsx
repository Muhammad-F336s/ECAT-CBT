import { useState, useEffect, useCallback } from "react";
import {
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
} from "react-router-dom";
import {
  FaBars,
  FaBell,
  FaBook,
  FaChartBar,
  FaChevronDown,
  FaChevronLeft,
  FaChevronRight,
  FaCog,
  FaCommentDots,
  FaHeadset,
  FaHourglassHalf,
  FaKey,
  FaRegCheckCircle,
  FaTachometerAlt,
  FaTimes,
  FaUsers,
  FaList,
  FaEye,
  FaArchive,
} from "react-icons/fa";
import AuthPage from "./components/AuthPage";
import AdminAdministration from "./components/AdminAdministration";
import AdminAnalytics from "./components/AdminAnalytics";
import AdminApprovals from "./components/AdminApprovals";
import AdminApprovedQuestions from "./components/AdminApprovedQuestions";
import AdminContentLibrary from "./components/AdminContentLibrary";
import AdminDashboard from "./components/AdminDashboard";
import AdminQuestions from "./components/AdminQuestions";
import AdminReviewQueue from "./components/AdminReviewQueue";
import AdminMessages from "./components/AdminMessages";
import AdminStudents from "./components/AdminStudents";
import AdminSettings from "./components/AdminSettings";
import AdminSupport from "./components/AdminSupport";
import UserDashboard from "./components/UserDashboard";
import ProgressPage from "./components/ProgressPage";
import ProfilePage from "./components/ProfilePage";
import OnboardingScreen from "./components/OnboardingScreen";
import TestWindow from "./components/TestWindow";
import TestModeSelection from "./components/TestModeSelection";
import TestModeForm from "./components/TestModeForm";
import ContentLibrary from "./components/ContentLibrary";
import HistoricalResultViewer from "./components/HistoricalResultViewer";
import ResetPassword from "./components/ResetPassword";
import DemoStudentToggle from "./components/DemoStudentToggle";
import SupportPage from "./components/SupportPage";
import VectorBotWidget from "./components/VectorBotWidget";
import API from "./utils/api";

import logoutIcon from "./assets/logout-pypojw37dhfwhy26x2wxze.webp";
import "./App.css";

const ACTIVE_SUBJECT_ID = "630cd83e-318f-41f8-89dc-64c503f0e216";

const normalizeRole = (role) =>
  typeof role === "string" ? role.toLowerCase() : "";

const isAdminUser = (userPayload) =>
  normalizeRole(userPayload?.role) === "admin";

const PAGE_COPY = {
  dashboard: {
    label: "Overview",
    title: "Your learning performance in one place",
    copy: "Track your progress, review analytics, and keep your account setup polished for every session.",
  },
  test: {
    label: "Practice",
    title: "Ready for your next CBT session",
    copy: "Start the simulator, answer questions, and complete your next practice run.",
  },
  progress: {
    label: "Progress",
    title: "Review your learning progress",
    copy: "Check your practice history, scores, and subject performance in one focused view.",
  },
  profile: {
    label: "Account Settings",
    title: "Update your account and security settings",
    copy: "Change your profile details, update your password, and upload a profile image for a more professional account.",
  },
  adminDashboard: {
    label: "Admin Overview",
    title: "Dedicated admin workspace",
    copy: "Approve learners, manage access, and keep the platform aligned with your rules from one focused control panel.",
  },
};

const parseAuthFromUrl = () => {
  const params = new URLSearchParams(window.location.search);
  // VULN-07 FIX: OAuth redirects now use a short-lived code, not a raw JWT in the URL.
  // The exchange happens in AuthPage on mount. This parser is kept for compatibility
  // but no longer handles raw tokens.
  const code = params.get("code");
  if (!code) return null;
  return { code };
};

function App() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const verifyUserSession = useCallback(async (initialUser = null) => {
    console.log("[AuthDebug] verifyUserSession started. InitialUser provided:", !!initialUser);
    try {
      if (initialUser) {
        setUser({ ...initialUser, role: normalizeRole(initialUser.role) });
        setIsLoading(false);
        return;
      }

      const token = localStorage.getItem("token");
      console.log("[AuthDebug] Token found in storage:", !!token);
      if (!token) {
        console.log("[AuthDebug] No token found. Setting user to null.");
        setUser(null);
        setIsLoading(false);
        return;
      }

      console.log("[AuthDebug] Calling /user/me for session verification...");
      const res = await API.get("/user/me");
      const verifiedUser = res.data;
      console.log("[AuthDebug] Session verified successfully. User:", verifiedUser);

      setUser(verifiedUser);
      localStorage.setItem("user", JSON.stringify(verifiedUser));
    } catch (err) {
      console.error("[AuthDebug] Session verification failed:", err);
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      setUser(null);
    } finally {
      console.log("[AuthDebug] Verification process finished. Setting isLoading to false.");
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      const authFromUrl = parseAuthFromUrl();
      if (authFromUrl?.code) {
        // Code exchange is handled by AuthPage component — just clean the URL
        window.history.replaceState({}, "", window.location.pathname);
        await verifyUserSession();
      } else {
        await verifyUserSession();
      }
    };
    initAuth();
  }, [verifyUserSession]);

  const handleAuthSuccess = useCallback((userData) => {
    const normalizedUser = { ...userData, role: normalizeRole(userData.role) };
    localStorage.setItem("user", JSON.stringify(normalizedUser));
    setUser(normalizedUser);
    navigate(isAdminUser(normalizedUser) ? "/admin/dashboard" : "/dashboard", {
      replace: true,
    });
  }, [navigate]);

  if (isLoading) {
    return (
      <div className="app-loading-screen">
        <div className="loading-spinner"></div>
        <p>Verifying session...</p>
      </div>
    );
  }

  return (
    <>
      <DemoModeBanner />
      <Routes>
        <Route
          path="/auth"
          element={
            user ? (
              <Navigate
                to={isAdminUser(user) ? "/admin/dashboard" : "/dashboard"}
                replace
              />
            ) : (
              <AuthPage onAuthSuccess={handleAuthSuccess} />
            )
          }
        />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route
          path="/admin/*"
          element={
            isAdminUser(user) ? (
              <AdminAppShell user={user} setUser={setUser} />
            ) : (
              <Navigate to="/auth" replace />
            )
          }
        />

        <Route
          path="/*"
          element={
            user?.role === "student" ? (
              <AppShell user={user} setUser={setUser} />
            ) : user ? (
              <Navigate to="/admin/dashboard" replace />
            ) : (
              <Navigate to="/auth" replace />
            )
          }
        />
      </Routes>
    </>
  );
}

function DemoModeBanner() {
  const isDemoActive = !!localStorage.getItem("originalAdminToken");
  if (!isDemoActive) return null;

  const handleExitDemo = () => {
    const adminToken = localStorage.getItem("originalAdminToken");
    const adminUser = localStorage.getItem("originalAdminUser");

    if (adminToken) localStorage.setItem("token", adminToken);
    if (adminUser) localStorage.setItem("user", adminUser);

    localStorage.removeItem("originalAdminToken");
    localStorage.removeItem("originalAdminUser");

    window.location.href = "/admin/dashboard";
  };

  return (
    <div className="demo-mode-active-banner">
      <span>👁️ Demo Student Mode Active (Realtime Testing)</span>
      <button
        type="button"
        className="demo-mode-exit-btn"
        onClick={handleExitDemo}
      >
        Exit Back to Admin
      </button>
    </div>
  );
}

function AdminAppShell({ user, setUser }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingApprovalCount, setPendingApprovalCount] = useState(0);
  const [pendingQuestionCount, setPendingQuestionCount] = useState(0);
  const [pendingTicketsCount, setPendingTicketsCount] = useState(0);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [loginMessages, setLoginMessages] = useState(user.loginMessages || []);
  const [isUserManagementOpen, setIsUserManagementOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchCounts = async () => {
      try {
        const [usersRes, questionsRes, notifRes] = await Promise.all([
          API.get("/user/pending-users"),
          API.get("/admin/questions/pending"),
          API.get("/admin/notifications/counts")
        ]);
        if (isMounted) {
          setPendingApprovalCount(usersRes.data.length);
          setPendingQuestionCount(questionsRes.data.length);
          setPendingTicketsCount(notifRes.data.pendingTickets);
          setUnreadMessagesCount(notifRes.data.unreadMessages);
        }
      } catch (err) {
        console.error("Dashboard counts fetch failed:", err);
      }
    };
    fetchCounts();
    const intervalId = window.setInterval(fetchCounts, 10000);
    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const handleNavigate = (path) => {
    navigate(path);
    if (window.matchMedia("(max-width: 860px)").matches) {
      setSidebarOpen(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    navigate("/auth", { replace: true });
  };

  return (
    <div className="app-shell admin-shell">
      <button
        type="button"
        className="mobile-sidebar-button"
        onClick={() => setSidebarOpen((prev) => !prev)}
        aria-label={sidebarOpen ? "Close side panel" : "Open side panel"}
      >
        {sidebarOpen ? <FaTimes /> : <FaBars />}
      </button>
      {sidebarOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close side panel"
        />
      )}
      <aside
        className={`sidebar admin-sidebar ${sidebarOpen ? "sidebar-open" : "sidebar-closed"}`}
      >
        <div className="sidebar-top">
          <div className="sidebar-brand">
            <p>ECAT CBT</p>
            <h1>Admin</h1>
          </div>
          <div className="sidebar-links">
            <div className="sidebar-section-label">Workspace</div>
            <button
              onClick={() => handleNavigate("/admin/dashboard")}
              className={`nav-button ${location.pathname === "/admin/dashboard" ? "active" : ""}`}
            >
              <FaTachometerAlt /> Account Overview
            </button>
            <button
              onClick={() => handleNavigate("/admin/approvals")}
              className={`nav-button ${location.pathname === "/admin/approvals" ? "active" : ""}`}
            >
              <FaHourglassHalf /> Pending Approvals{" "}
              <span className="nav-count">{pendingApprovalCount}</span>
            </button>
            <button
              onClick={() => handleNavigate("/admin/students")}
              className={`nav-button ${location.pathname === "/admin/students" ? "active" : ""}`}
            >
              <FaRegCheckCircle /> Approved Students
            </button>
            <button
              onClick={() => setIsUserManagementOpen(!isUserManagementOpen)}
              className="nav-button"
            >
              <FaUsers /> Users Management{" "}
              <FaChevronDown
                className={`nav-end-icon ${isUserManagementOpen ? "open" : ""}`}
              />
            </button>
            <div
              className={`dropdown-menu ${isUserManagementOpen ? "open" : ""}`}
            >
              <button
                onClick={() => handleNavigate("/admin/messages")}
                className={`nav-button dropdown-item ${
                  location.pathname === "/admin/messages" ? "active" : ""
                }`}
              >
                <FaCommentDots /> Message Center
              </button>
              <button
                onClick={() => handleNavigate("/admin/administration")}
                className={`nav-button dropdown-item ${
                  location.pathname === "/admin/administration" ? "active" : ""
                }`}
              >
                <FaKey /> Manage Administration
              </button>
            </div>
            <button
              onClick={() => handleNavigate("/admin/content-library")}
              className={`nav-button ${location.pathname === "/admin/content-library" ? "active" : ""}`}
            >
              <FaBook /> Content Library
            </button>
            <button
              onClick={() => handleNavigate("/admin/questions")}
              className={`nav-button ${location.pathname === "/admin/questions" ? "active" : ""}`}
            >
              <FaList /> Question Bank
            </button>
            <button
              onClick={() => handleNavigate("/admin/review-queue")}
              className={`nav-button ${location.pathname === "/admin/review-queue" ? "active" : ""}`}
            >
              <FaEye /> AI Review Queue{" "}
              <span className="nav-count">{pendingQuestionCount}</span>
            </button>
            <button
              onClick={() => handleNavigate("/admin/approved-questions")}
              className={`nav-button ${location.pathname === "/admin/approved-questions" ? "active" : ""}`}
            >
              <FaArchive /> Approved Archive
            </button>
            <button
              onClick={() => handleNavigate("/admin/analytics")}
              className={`nav-button ${location.pathname === "/admin/analytics" ? "active" : ""}`}
            >
              <FaChartBar /> Analytics
            </button>

            <button
              onClick={() => handleNavigate("/admin/settings")}
              className={`nav-button ${location.pathname === "/admin/settings" ? "active" : ""}`}
            >
              <FaCog /> Settings
            </button>
          </div>
        </div>
        <div className="sidebar-bottom">
          <div className="profile-card profile-card--stacked">
            <div className="profile-avatar">{user.name?.charAt(0) || "A"}</div>
            <div className="profile-info profile-info--centered">
              <p className="name">{user.name}</p>
              <span>{user.rank || "Admin"}</span>
            </div>
          </div>
          <button 
            type="button" 
            className="support-button"
            onClick={() => handleNavigate("/admin/support")}
          >
            <FaHeadset /> Support
          </button>
          <button onClick={handleLogout} className="logout-button">
            Logout <img src={logoutIcon} alt="Logout" className="logout-icon" />
          </button>
        </div>
      </aside>

      <main className="main-panel admin-main-panel">
        <div className="main-content">
          <LoginMessageBanner
            user={user}
            setUser={setUser}
            messages={loginMessages}
            setMessages={setLoginMessages}
          />
          <Routes>
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route
              path="dashboard"
              element={
                <AdminDashboard
                  user={user}
                  onLogout={handleLogout}
                  pendingTicketsCount={pendingTicketsCount}
                  unreadMessagesCount={unreadMessagesCount}
                  headerActions={
                    <>
                      <DemoStudentToggle user={user} />
                      <button 
                        type="button" 
                        className="admin-icon-button" 
                        aria-label="Notifications"
                        onClick={() => navigate("/admin/support")}
                      >
                        <FaBell />
                        {pendingTicketsCount > 0 && (
                          <span className="notification-badge">{pendingTicketsCount}</span>
                        )}
                      </button>
                      <button 
                        type="button" 
                        className="admin-icon-button" 
                        aria-label="Messages"
                        onClick={() => navigate("/admin/messages")}
                      >
                        <FaCommentDots />
                        {unreadMessagesCount > 0 && (
                          <span className="notification-badge">{unreadMessagesCount}</span>
                        )}
                      </button>
                    </>
                  }
                />
              }
            />
            <Route
              path="approvals"
              element={
                <AdminApprovals
                  onPendingCountChange={setPendingApprovalCount}
                />
              }
            />
            <Route
              path="students"
              element={
                <AdminStudents
                  onPendingCountChange={setPendingApprovalCount}
                />
              }
            />
            <Route path="messages" element={<AdminMessages />} />
            <Route path="administration" element={<AdminAdministration />} />
            <Route path="content-library" element={<AdminContentLibrary />} />
            <Route path="questions" element={<AdminQuestions />} />
            <Route path="review-queue" element={<AdminReviewQueue />} />
            <Route path="approved-questions" element={<AdminApprovedQuestions />} />
            <Route path="analytics" element={<AdminAnalytics />} />
            <Route path="features" element={<Navigate to="/admin/settings" replace />} />
            <Route path="settings" element={<AdminSettings user={user} />} />
            <Route path="support" element={<AdminSupport />} />
            <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

function AppShell({ user, setUser }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loginMessages, setLoginMessages] = useState(user.loginMessages || []);

  const view = location.pathname.split("/")[1] || "dashboard";
  const pageCopy = PAGE_COPY[view] || PAGE_COPY.dashboard;
  const isTestView = view === "test";

  const handleProfileSave = (updates) => {
    const updated = { ...user, ...updates };
    setUser(updated);
    try {
      localStorage.setItem("user", JSON.stringify(updated));
    } catch (err) {
      console.error("Failed to save user to localStorage", err);
    }
  };

  const toggleSidebar = () => setSidebarOpen((prev) => !prev);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    navigate("/auth", { replace: true });
  };

  const handleNavigate = (path) => {
    navigate(path);
    if (window.matchMedia("(max-width: 860px)").matches) {
      setSidebarOpen(false);
    }
  };

  return (
    <div className={`app-shell ${isTestView ? "test-shell" : ""}`}>
      {!isTestView && (
        <button
          type="button"
          className="mobile-sidebar-button"
          onClick={toggleSidebar}
          aria-label={sidebarOpen ? "Close side panel" : "Open side panel"}
        >
          {sidebarOpen ? <FaTimes /> : <FaBars />}
        </button>
      )}
      {sidebarOpen && !isTestView && (
        <button
          type="button"
          className="sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close side panel"
        />
      )}
      {!isTestView && (
        <aside
          className={`sidebar ${sidebarOpen ? "sidebar-open" : "sidebar-closed"}`}
        >
          <div className="sidebar-top">
            <div className="sidebar-brand">
              <p>ECAT CBT</p>
              <h1>Simulator</h1>
            </div>
            <button className="sidebar-toggle-button" onClick={toggleSidebar}>
              {sidebarOpen ? <FaChevronLeft /> : <FaChevronRight />}
            </button>
            <div className="sidebar-links">
              <div className="sidebar-section-label">Workspace</div>
              <button
                onClick={() => handleNavigate("/dashboard")}
                className={`nav-button ${view === "dashboard" ? "active" : ""}`}
              >
                Overview
              </button>
              <button
                onClick={() => handleNavigate("/test")}
                className={`nav-button ${view === "test" ? "active" : ""}`}
              >
                Practice
              </button>
              <button
                onClick={() => handleNavigate("/library")}
                className={`nav-button ${view === "library" ? "active" : ""}`}
              >
                Content Library
              </button>
              <button
                onClick={() => handleNavigate("/progress")}
                className={`nav-button ${view === "progress" ? "active" : ""}`}
              >
                Progress
              </button>
              <button
                onClick={() => handleNavigate("/profile")}
                className={`nav-button ${view === "profile" ? "active" : ""}`}
              >
                Account
              </button>
              <button
                onClick={() => handleNavigate("/support")}
                className={`nav-button ${view === "support" ? "active" : ""}`}
              >
                Support
              </button>
              <div className="sidebar-section-label" style={{ marginTop: "16px" }}>Preferences</div>
              <button
                onClick={() => handleNavigate("/interests")}
                className={`nav-button ${view === "interests" ? "active" : ""}`}
              >
                Change Target
              </button>
            </div>
          </div>
          <div className="sidebar-bottom">
            <div className="profile-card profile-card--stacked">
              <div className="profile-avatar">{user.name?.charAt(0) || "A"}</div>
              <div className="profile-info profile-info--centered">
                <p className="name">{user.name}</p>
                <span>{user.rank || "Student"}</span>
              </div>
            </div>
            <button onClick={handleLogout} className="logout-button">
              Logout
              <img src={logoutIcon} alt="Logout" className="logout-icon" />
            </button>
          </div>
        </aside>
      )}
      <main className="main-panel">
        {!isTestView && (
          <div className="page-header">
            <span>{pageCopy.label}</span>
            <h2>{pageCopy.title}</h2>
            <p>{pageCopy.copy}</p>
          </div>
        )}
        <div className="main-content">
          {!isTestView && (
            <LoginMessageBanner
              user={user}
              setUser={setUser}
              messages={loginMessages}
              setMessages={setLoginMessages}
            />
          )}
          <Routes>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route
              path="dashboard"
              element={
                <UserDashboard
                  user={user}
                  onStartTest={() => navigate("/test")}
                  onOpenAccount={() => navigate("/profile")}
                />
              }
            />
            <Route path="progress" element={<ProgressPage userId={user.id} />} />
            <Route path="library" element={<ContentLibrary user={user} />} />
            <Route
              path="test"
              element={
                <TestModeSelection user={user} />
              }
            />
            <Route
              path="test/form"
              element={
                <TestModeForm user={user} />
              }
            />
            <Route
              path="test/cbt"
              element={
                <TestWindow
                  subjectId={ACTIVE_SUBJECT_ID}
                  userId={user.id}
                  user={user}
                  onTestComplete={() => navigate("/dashboard")}
                />
              }
            />
            <Route
              path="test/result/:attemptId"
              element={
                <HistoricalResultViewer user={user} />
              }
            />
            <Route
              path="profile"
              element={
                <ProfilePage user={user} onSave={handleProfileSave} />
              }
            />
            <Route path="support" element={<SupportPage user={user} />} />
            <Route
              path="interests"
              element={
                <OnboardingScreen
                  onComplete={() => {
                    const updated = { ...user, hasCompletedOnboarding: true };
                    setUser(updated);
                    localStorage.setItem("user", JSON.stringify(updated));
                    navigate("/dashboard");
                  }}
                />
              }
            />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </div>
      </main>
      <VectorBotWidget user={user} />
    </div>
  );
}

function LoginMessageBanner({ user, setUser, messages, setMessages }) {
  if (!messages.length) return null;
  const dismissMessage = (messageId) => {
    const nextMessages = messages.filter((message) => message.id !== messageId);
    setMessages(nextMessages);
    const nextUser = { ...user, loginMessages: nextMessages };
    setUser(nextUser);
    localStorage.setItem("user", JSON.stringify(nextUser));
  };
  return (
    <div className="login-message-stack">
      {messages.map((message) => (
        <article key={message.id} className="login-message-banner">
          <div>
            <strong>Admin Message</strong>
            <p>{message.body}</p>
            {message.showSenderEmail && message.senderEmail && (
              <small>From: {message.senderEmail}</small>
            )}
          </div>
          <button
            type="button"
            onClick={() => dismissMessage(message.id)}
            aria-label="Dismiss admin message"
          >
            x
          </button>
        </article>
      ))}
    </div>
  );
}

export default App;
