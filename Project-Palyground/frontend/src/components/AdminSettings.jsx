import { useEffect, useState } from "react";
import {
  FaCog,
  FaToggleOn,
  FaToggleOff,
  FaClock,
  FaEnvelope,
  FaRobot,
  FaTools,
  FaMinusCircle,
  FaShieldAlt,
  FaSave,
  FaCheckCircle,
  FaExclamationCircle,
} from "react-icons/fa";
import API from "../utils/api";
import "./AdminSettings.css";

export default function AdminSettings({ user }) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ show: false, type: "", msg: "" });

  const isRoot = user?.rank === "Root Owner";

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await API.get("/admin/settings");
        setSettings(res.data);
      } catch (err) {
        console.error("Failed to fetch settings:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const showToast = (type, msg) => {
    setToast({ show: true, type, msg });
    setTimeout(() => setToast({ show: false, type: "", msg: "" }), 3500);
  };

  const handleSaveGeneral = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await API.patch("/admin/settings", settings);
      showToast("success", "Settings saved successfully!");
    } catch {
      showToast("error", "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (key) => {
    if (!settings) return;
    const next = { ...settings, [key]: !settings[key] };
    setSettings(next);
    try {
      await API.patch("/admin/settings", next);
      showToast("success", "Feature flag updated!");
    } catch {
      showToast("error", "Failed to update feature flag.");
      setSettings(settings);
    }
  };

  if (loading) {
    return (
      <div className="settings-page">
        <div className="settings-loading">
          <div className="settings-spinner" />
          <p>Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-page">
      {toast.show && (
        <div className={"settings-toast settings-toast--" + toast.type}>
          {toast.type === "success" ? <FaCheckCircle /> : <FaExclamationCircle />}
          {" "}{toast.msg}
        </div>
      )}

      <header className="settings-header">
        <div className="settings-header-icon"><FaCog /></div>
        <div>
          <h1>Platform Settings</h1>
          <p>Configure your ECAT-CBT platform preferences and feature flags</p>
        </div>
      </header>

      <div className="settings-grid">

        <section className="settings-card">
          <div className="settings-card-title">
            <FaShieldAlt className="settings-card-icon settings-card-icon--blue" />
            <h2>General Configuration</h2>
          </div>
          <form onSubmit={handleSaveGeneral} className="settings-form">
            <div className="settings-field">
              <label htmlFor="timePerQ">
                <FaClock className="field-icon" /> Default Time Per Question
              </label>
              <div className="settings-input-row">
                <input
                  id="timePerQ"
                  type="number"
                  min={10}
                  max={300}
                  value={settings?.defaultTimePerQ ?? 60}
                  onChange={(e) =>
                    setSettings({ ...settings, defaultTimePerQ: parseInt(e.target.value) })
                  }
                />
                <span className="input-unit">seconds</span>
              </div>
            </div>
            <div className="settings-field">
              <label htmlFor="supportEmail">
                <FaEnvelope className="field-icon" /> Support Email Address
              </label>
              <input
                id="supportEmail"
                type="email"
                placeholder="support@ecat-cbt.com"
                value={settings?.supportEmail ?? ""}
                onChange={(e) =>
                  setSettings({ ...settings, supportEmail: e.target.value })
                }
              />
            </div>
            <button type="submit" className="settings-save-btn" disabled={saving}>
              <FaSave /> {saving ? "Saving..." : "Save Changes"}
            </button>
          </form>
        </section>

        {isRoot && (
          <section className="settings-card">
            <div className="settings-card-title">
              <FaTools className="settings-card-icon settings-card-icon--green" />
              <h2>Feature Flags</h2>
              <span className="settings-root-badge">Root Owner</span>
            </div>
            <p className="settings-card-desc">
              Toggle platform features on or off instantly across the entire system.
            </p>
            <div className="settings-toggles">
              <ToggleRow icon={<FaRobot />} label="Vector Bot AI Mentor" desc="Enable the floating Vector Bot study assistant for all students." enabled={settings?.vectorBotEnabled} onToggle={() => handleToggle("vectorBotEnabled")} />
              <ToggleRow icon={<FaTools />} label="Maintenance Mode" desc="Put the platform in maintenance mode — blocks all non-admin logins." enabled={settings?.maintenanceMode} onToggle={() => handleToggle("maintenanceMode")} danger />
              <ToggleRow icon={<FaMinusCircle />} label="Negative Marking" desc="Apply negative marking (-0.25) to all CBT practice tests." enabled={settings?.negativeMarking} onToggle={() => handleToggle("negativeMarking")} />
            </div>
          </section>
        )}

        {isRoot && (
          <section className="settings-card settings-card--danger">
            <div className="settings-card-title">
              <FaShieldAlt className="settings-card-icon settings-card-icon--red" />
              <h2>Danger Zone</h2>
            </div>
            <p className="settings-card-desc">
              These actions are irreversible. Proceed with extreme caution.
            </p>
            <div className="danger-actions">
              <div className="danger-row">
                <div>
                  <strong>Reset All Test Attempts</strong>
                  <p>Clears all student test attempt records from the database.</p>
                </div>
                <button type="button" className="settings-danger-btn" disabled>Coming Soon</button>
              </div>
              <div className="danger-row">
                <div>
                  <strong>Export Platform Data</strong>
                  <p>Download a full CSV export of all student data and analytics.</p>
                </div>
                <button type="button" className="settings-danger-btn" disabled>Coming Soon</button>
              </div>
            </div>
          </section>
        )}

        <section className="settings-card settings-card--info">
          <div className="settings-card-title">
            <FaShieldAlt className="settings-card-icon settings-card-icon--purple" />
            <h2>Platform Info</h2>
          </div>
          <div className="info-grid">
            <div className="info-item"><span>Platform</span><strong>ECAT-CBT v2.0</strong></div>
            <div className="info-item"><span>Database</span><strong>Neon PostgreSQL</strong></div>
            <div className="info-item"><span>AI Model</span><strong>Llama 3.3 70B (Groq)</strong></div>
            <div className="info-item"><span>Your Rank</span><strong>{user?.rank || "Admin"}</strong></div>
            <div className="info-item"><span>Environment</span><strong>Production</strong></div>
            <div className="info-item"><span>ORM</span><strong>Prisma v7.8</strong></div>
          </div>
        </section>

      </div>
    </div>
  );
}

function ToggleRow({ icon, label, desc, enabled, onToggle, danger }) {
  return (
    <div className={"toggle-row" + (danger && enabled ? " toggle-row--danger" : "")}>
      <div className="toggle-row-icon">{icon}</div>
      <div className="toggle-row-info">
        <strong>{label}</strong>
        <p>{desc}</p>
      </div>
      <button
        type="button"
        className={"toggle-btn " + (enabled ? "toggle-btn--on" : "toggle-btn--off")}
        onClick={onToggle}
        aria-label={"Toggle " + label}
      >
        {enabled ? <FaToggleOn /> : <FaToggleOff />}
        <span>{enabled ? "On" : "Off"}</span>
      </button>
    </div>
  );
}
