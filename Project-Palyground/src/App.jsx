import { useState, useEffect, useRef, useCallback } from "react";
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
} from "react-icons/fa";
import AuthPage from "./components/AuthPage";
import AdminAdministration from "./components/AdminAdministration";
import AdminApprovals from "./components/AdminApprovals";
import AdminContentLibrary from "./components/AdminContentLibrary";
import AdminDashboard from "./components/AdminDashboard";
import AdminMessages from "./components/AdminMessages";
import AdminStudents from "./components/AdminStudents";
import UserDashboard from "./components/UserDashboard";
import ProgressPage from "./components/ProgressPage";
import ProfilePage from "./components/ProfilePage";
import TestWindow from "./components/TestWindow";
import API from "./utils/api";
import logoutIcon from "./assets/logout-pypojw37dhfwhy26x2wxze.webp";
import "./App.css";

const ACTIVE_SUBJECT_ID = "630cd83e-318f-41f8-89dc-64c503f0e216";

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
  const token = params.get("token");
  const userParam = params.get("user");
  if (!token || !userParam) return null;

  try {
    const user = JSON.parse(decodeURIComponent(userParam));
    return { token, user };
  } catch (err) {
    console.error("Failed to parse auth callback", err);
    return null;
  }
};

function App() {
  const navigate = useNavigate();

  const [user, setUser] = useState(() => {
    try {
      const authFromUrl = parseAuthFromUrl();
      if (authFromUrl) {
        localStorage.setItem("token", authFromUrl.token);
        localStorage.setItem("user", JSON.stringify(authFromUrl.user));
        window.history.replaceState(
          {},
          "",
          authFromUrl.user.role === "admin" ? "/admin/dashboard" : "/dashboard",
        );
        return authFromUrl.user;
      }

      const storedUser = localStorage.getItem("user");
      if (storedUser) {
        return JSON.parse(storedUser);
      }

      return null;
    } catch (err) {
      console.error("Failed to parse stored user", err);
      return null;
    }
  });

  const handleAuthSuccess = useCallback((userData) => {
    localStorage.setItem("user", JSON.stringify(userData));
    setUser(userData);
    navigate(userData.role === "admin" ? "/admin/dashboard" : "/dashboard", {
      replace: true,
    });
  }, [navigate]);

  return (
    <Routes>
      <Route
        path="/auth"
        element={
          user ? (
            <Navigate
              to={user.role === "admin" ? "/admin/dashboard" : "/dashboard"}
              replace
            />
          ) : (
            <AuthPage onAuthSuccess={handleAuthSuccess} />
          )
        }
      />

      <Route
        path="/admin/*"
        element={
          user?.role === "admin" ? (
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
  );
}

function AdminAppShell({ user, setUser }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingApprovalCount, setPendingApprovalCount] = useState(0);
  const [loginMessages, setLoginMessages] = useState(user.loginMessages || []);
  const [isUserManagementOpen, setIsUserManagementOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const fetchPendingCount = async () => {
      try {
        const res = await API.get("/user/pending-users");
        if (isMounted) setPendingApprovalCount(res.data.length);
      } catch (err) {
        console.error("Pending approval count failed:", err);
      }
    };

    fetchPendingCount();
    const intervalId = window.setInterval(fetchPendingCount, 10000);

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
              className="nav-button"
            >
              <FaBook /> Content Library
            </button>
            <button
              onClick={() => handleNavigate("/admin/dashboard")}
              className="nav-button"
            >
              <FaChartBar /> Analytics
            </button>
            <button
              onClick={() => handleNavigate("/admin/dashboard")}
              className="nav-button"
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
          <button type="button" className="support-button">
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
                  headerActions={
                    <>
                      <button type="button" className="admin-icon-button" aria-label="Notifications">
                        <FaBell />
                      </button>
                      <button type="button" className="admin-icon-button" aria-label="Messages">
                        <FaCommentDots />
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [hintCount, setHintCount] = useState(0);
  const [loginMessages, setLoginMessages] = useState(user.loginMessages || []);
  const closeTimer = useRef(null);
  const hintTimer = useRef(null);

  const view = location.pathname.split("/")[1] || "dashboard";
  const pageCopy = PAGE_COPY[view] || PAGE_COPY.dashboard;

  const showSidebarHint = useCallback(() => {
    if (hintCount >= 3) return;
    setShowHint(true);
    if (hintTimer.current) {
      window.clearTimeout(hintTimer.current);
    }
    hintTimer.current = window.setTimeout(() => {
      setShowHint(false);
      setHintCount((count) => count + 1);
      hintTimer.current = null;
    }, 1000);
  }, [hintCount]);

  const hideSidebarHint = useCallback(() => {
    if (hintTimer.current) {
      window.clearTimeout(hintTimer.current);
      hintTimer.current = null;
    }
    setShowHint(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSidebarOpen(false);
      showSidebarHint();
    }, 2200);

    return () => {
      window.clearTimeout(timer);
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
      if (hintTimer.current) window.clearTimeout(hintTimer.current);
    };
  }, [showSidebarHint]);

  const handleProfileSave = (updates) => {
    const updated = { ...user, ...updates };
    setUser(updated);
    try {
      localStorage.setItem("user", JSON.stringify(updated));
    } catch (err) {
      console.error("Failed to save user to localStorage", err);
    }
  };

  const toggleSidebar = () => {
    setSidebarOpen((prev) => {
      const next = !prev;
      if (!next) {
        showSidebarHint();
      } else {
        hideSidebarHint();
      }
      return next;
    });
  };

  const handleSidebarMouseEnter = () => {
    if (closeTimer.current) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setSidebarOpen(true);
    hideSidebarHint();
  };

  const handleSidebarMouseLeave = () => {
    if (closeTimer.current) {
      window.clearTimeout(closeTimer.current);
    }
    closeTimer.current = window.setTimeout(() => {
      setSidebarOpen(false);
      showSidebarHint();
      closeTimer.current = null;
    }, 280);
  };

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
    <div className="app-shell">
      <button
        type="button"
        className="mobile-sidebar-button"
        onClick={toggleSidebar}
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
        className={`sidebar ${sidebarOpen ? "sidebar-open" : "sidebar-closed"}`}
        onMouseEnter={handleSidebarMouseEnter}
        onMouseLeave={handleSidebarMouseLeave}
      >
        {!sidebarOpen && showHint && (
          <div className="sidebar-hint-banner">
            Hover your mouse here to access side panel
          </div>
        )}

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
          </div>
        </div>

        <div className="sidebar-bottom">
          <div className="profile-card profile-card--stacked">
            <div className="profile-avatar">{user.name?.charAt(0) || "U"}</div>
            <div className="profile-info profile-info--centered">
              <p className="name">{user.name}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="logout-button">
            Logout
            <img src={logoutIcon} alt="Logout" className="logout-icon" />
          </button>
        </div>
      </aside>

      <main className="main-panel">
        <div className="page-header">
          <span>{pageCopy.label}</span>
          <h2>{pageCopy.title}</h2>
          <p>{pageCopy.copy}</p>
        </div>

        <div className="main-content">
          <LoginMessageBanner
            user={user}
            setUser={setUser}
            messages={loginMessages}
            setMessages={setLoginMessages}
          />
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
            <Route
              path="test"
              element={
                <TestWindow
                  subjectId={ACTIVE_SUBJECT_ID}
                  userId={user.id}
                  onTestComplete={() => navigate("/dashboard")}
                />
              }
            />
            <Route
              path="profile"
              element={<ProfilePage user={user} onSave={handleProfileSave} />}
            />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </div>
      </main>
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
