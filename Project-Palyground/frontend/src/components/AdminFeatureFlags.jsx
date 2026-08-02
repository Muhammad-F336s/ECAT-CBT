import { useEffect, useState } from "react";
import API from "../utils/api";
import "./AdminApprovals.css";

export default function AdminFeatureFlags({ user }) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (user?.rank !== "Root Owner") {
      setLoading(false);
      return;
    }
    const fetchOnMount = async () => {
      try {
        const res = await API.get("/admin/settings");
        setSettings(res.data);
      } catch (err) {
        console.error("Failed to fetch settings:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchOnMount();
  }, [user]);

  const handleToggle = async (key) => {
    if (!settings) return;
    const nextSettings = { ...settings, [key]: !settings[key] };
    setSettings(nextSettings);
    
    setSaving(true);
    setMessage("");
    try {
      await API.patch("/admin/settings", nextSettings);
      setMessage("Feature flags updated successfully!");
    } catch (err) {
      console.error("Failed to update flag:", err);
      setMessage("Failed to update feature flag.");
    } finally {
      setSaving(false);
    }
  };

  if (user?.rank !== "Root Owner") {
    return (
      <div className="approval-empty-state">
        <p>Access Denied: Only the Root Owner can manage feature flags.</p>
      </div>
    );
  }

  if (loading) return <div className="approval-empty-state">Loading feature flags...</div>;

  return (
    <div className="approval-page">
      <header className="approval-header">
        <div>
          <h1>Global Feature Flags</h1>
          <p>Toggle core platform features on or off instantly across the system.</p>
        </div>
      </header>
      
      <section className="approval-card" style={{ padding: "25px", maxWidth: "600px" }}>
        
        <div className="feature-toggle-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "15px 0", borderBottom: "1px solid #e1e8ed" }}>
          <div>
            <h3 style={{ margin: "0 0 5px 0" }}>🎯 Vector Bot AI Mentor</h3>
            <p style={{ margin: 0, fontSize: "14px", color: "#657786" }}>
              Enable the floating Vector Bot study mentor for all students.
            </p>
          </div>
          <button 
            type="button" 
            className={`action-${settings?.vectorBotEnabled ? 'primary' : 'secondary'}`}
            onClick={() => handleToggle("vectorBotEnabled")}
            disabled={saving}
          >
            {settings?.vectorBotEnabled ? "Enabled" : "Disabled"}
          </button>
        </div>
        
        <div className="feature-toggle-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "15px 0", borderBottom: "1px solid #e1e8ed" }}>
          <div>
            <h3 style={{ margin: "0 0 5px 0" }}>🔧 Maintenance Mode</h3>
            <p style={{ margin: 0, fontSize: "14px", color: "#657786" }}>
              Put the platform in maintenance mode (blocks non-admin users).
            </p>
          </div>
          <button 
            type="button" 
            className={`action-${settings?.maintenanceMode ? 'primary' : 'secondary'}`}
            onClick={() => handleToggle("maintenanceMode")}
            disabled={saving}
          >
            {settings?.maintenanceMode ? "Enabled" : "Disabled"}
          </button>
        </div>
        
        <div className="feature-toggle-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "15px 0" }}>
          <div>
            <h3 style={{ margin: "0 0 5px 0" }}>➖ Negative Marking</h3>
            <p style={{ margin: 0, fontSize: "14px", color: "#657786" }}>
              Enable negative marking scheme for all CBT practices.
            </p>
          </div>
          <button 
            type="button" 
            className={`action-${settings?.negativeMarking ? 'primary' : 'secondary'}`}
            onClick={() => handleToggle("negativeMarking")}
            disabled={saving}
          >
            {settings?.negativeMarking ? "Enabled" : "Disabled"}
          </button>
        </div>

        {message && <p style={{ marginTop: "20px", color: "green", fontWeight: "bold" }}>{message}</p>}
      </section>
    </div>
  );
}
