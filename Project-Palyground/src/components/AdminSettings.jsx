import { useEffect, useState } from "react";
import API from "../utils/api";
import "./AdminApprovals.css";

export default function AdminSettings() {
  const [settings, setSettings] = useState({
    defaultTimePerQ: 60,
    negativeMarking: false,
    maintenanceMode: false,
    supportEmail: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

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

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      await API.patch("/admin/settings", settings);
      setMessage("Settings saved successfully!");
    } catch (err) {
      console.error("Failed to save settings:", err);
      setMessage("Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="approval-empty-state">Loading settings...</div>;

  return (
    <div className="approval-page">
      <header className="approval-header">
        <h1>Platform Settings</h1>
      </header>
      <section className="approval-card" style={{ padding: "25px" }}>
        <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <label style={{ flex: 1 }}>Default Time per Question (seconds)</label>
            <input type="number" value={settings.defaultTimePerQ} onChange={(e) => setSettings({...settings, defaultTimePerQ: parseInt(e.target.value)})} style={{ padding: "8px" }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <label style={{ flex: 1 }}>Support Email</label>
            <input type="email" value={settings.supportEmail} onChange={(e) => setSettings({...settings, supportEmail: e.target.value})} style={{ padding: "8px", flex: 2 }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <label style={{ flex: 1 }}>Negative Marking</label>
            <input type="checkbox" checked={settings.negativeMarking} onChange={(e) => setSettings({...settings, negativeMarking: e.target.checked})} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <label style={{ flex: 1 }}>Maintenance Mode</label>
            <input type="checkbox" checked={settings.maintenanceMode} onChange={(e) => setSettings({...settings, maintenanceMode: e.target.checked})} />
          </div>
          <button type="submit" className="action-primary" disabled={saving}>
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </form>
        {message && <p style={{ marginTop: "15px", color: "green" }}>{message}</p>}
      </section>
    </div>
  );
}
