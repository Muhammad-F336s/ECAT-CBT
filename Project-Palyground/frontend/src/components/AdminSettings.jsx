import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  FaDownload,
  FaTrashAlt,
  FaClipboardList,
  FaUserCheck,
  FaUserShield,
  FaSnowflake,
  FaBox,
  FaKey,
  FaLock,
  FaSync,
  FaUniversity,
  FaTimes,
  FaInfoCircle,
} from "react-icons/fa";
import API from "../utils/api";
import "./AdminSettings.css";

export default function AdminSettings({ user }) {
  const navigate = useNavigate();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dangerBusy, setDangerBusy] = useState("");
  const [toast, setToast] = useState({ show: false, type: "", msg: "" });
  const [aiAccessToken, setAiAccessToken] = useState("");
  const [aiConfig, setAiConfig] = useState(null);
  const [groqModels, setGroqModels] = useState([]);
  const [aiModel, setAiModel] = useState("");
  const [newAiKey, setNewAiKey] = useState("");
  const [aiBusy, setAiBusy] = useState("");

  // Bank settings & 2-step verification state
  const [bankSettings, setBankSettings] = useState({ activeBank: null, pendingRequest: null });
  const [showBankForm, setShowBankForm] = useState(false);
  const [bankForm, setBankForm] = useState({
    proposedBankName: "",
    proposedAccountTitle: "",
    proposedIban: "",
    proposedRaastId: "",
    proposedSupportContact: "",
    adminSecretCode: "",
  });
  const [rootAuthCode, setRootAuthCode] = useState("");
  const [bankBusy, setBankBusy] = useState("");
  const [showCancelAllPrompt, setShowCancelAllPrompt] = useState(false);
  const [cancelAllCode, setCancelAllCode] = useState("");

  const isRoot =
    user?.rank === "Root Owner" || user?.email === "muhammad.f336s@gmail.com";

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
    fetchBankSettings();
  }, []);

  const fetchBankSettings = async () => {
    try {
      const res = await API.get("/admin/bank-settings");
      setBankSettings(res.data);
      if (res.data.activeBank) {
        setBankForm((prev) => ({
          ...prev,
          proposedBankName: res.data.activeBank.bankName || "",
          proposedAccountTitle: res.data.activeBank.accountTitle || "",
          proposedIban: res.data.activeBank.iban || "",
          proposedRaastId: res.data.activeBank.raastId || "",
          proposedSupportContact: res.data.activeBank.supportContact || "",
        }));
      }
    } catch (err) {
      console.error("Failed to load bank settings:", err);
    }
  };

  const handleRequestBankChange = async (e) => {
    e.preventDefault();
    setBankBusy("request");
    try {
      const res = await API.post("/admin/bank-settings/request-change", bankForm);
      showToast("success", res.data.message);
      setBankForm((prev) => ({ ...prev, adminSecretCode: "" }));
      setShowBankForm(false);
      await fetchBankSettings();
    } catch (err) {
      showToast("error", err.response?.data?.error || "Failed to submit bank change request.");
    } finally {
      setBankBusy("");
    }
  };

  const handleApproveBankChange = async () => {
    if (!bankSettings.pendingRequest || !rootAuthCode.trim()) {
      showToast("error", "Please enter the Root Authorization Secret Code.");
      return;
    }
    setBankBusy("approve");
    try {
      const res = await API.post("/admin/bank-settings/approve-change", {
        requestId: bankSettings.pendingRequest.id,
        rootSecretCode: rootAuthCode.trim(),
      });
      showToast("success", res.data.message);
      setRootAuthCode("");
      await fetchBankSettings();
    } catch (err) {
      showToast("error", err.response?.data?.error || "Failed to approve bank change.");
    } finally {
      setBankBusy("");
    }
  };

  const handleCancelBankChange = async () => {
    const adminCode = window.prompt("Enter your Admin Secret Code to cancel this request:");
    if (!adminCode) return;
    setBankBusy("cancel");
    try {
      const res = await API.post("/admin/bank-settings/cancel-change", {
        requestId: bankSettings.pendingRequest.id,
        adminSecretCode: adminCode.trim(),
      });
      showToast("success", res.data.message);
      await fetchBankSettings();
    } catch (err) {
      showToast("error", err.response?.data?.error || "Failed to cancel change request.");
    } finally {
      setBankBusy("");
    }
  };

  const handleCancelAllBankRequests = async () => {
    if (!cancelAllCode.trim()) {
      showToast("error", "Please enter your Admin Secret Code.");
      return;
    }
    setBankBusy("cancelAll");
    try {
      const res = await API.post("/admin/bank-settings/cancel-all", {
        adminSecretCode: cancelAllCode.trim(),
      });
      showToast("success", res.data.message);
      setCancelAllCode("");
      setShowCancelAllPrompt(false);
      await fetchBankSettings();
    } catch (err) {
      showToast("error", err.response?.data?.error || "Failed to cancel requests.");
    } finally {
      setBankBusy("");
    }
  };

  const showToast = (type, msg) => {
    setToast({ show: true, type, msg });
    setTimeout(() => setToast({ show: false, type: "", msg: "" }), 3500);
  };

  const handleSaveAll = async () => {
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

  const handleResetAttempts = async () => {
    const confirmed = window.confirm(
      "⚠️ IRREVERSIBLE ACTION\n\nThis will permanently delete ALL student test attempt records from the database.\n\nAre you absolutely sure?",
    );
    if (!confirmed) return;

    const doubleConfirm = window.prompt(
      'Type "RESET" to confirm. This cannot be undone.',
    );
    if (doubleConfirm?.trim().toUpperCase() !== "RESET") {
      showToast("error", "Reset cancelled — confirmation did not match.");
      return;
    }

    setDangerBusy("reset");
    try {
      const res = await API.post("/admin/danger/reset-attempts");
      showToast("success", res.data.message || "All test attempts cleared.");
    } catch (err) {
      console.error("Reset attempts failed:", err);
      showToast("error", err.response?.data?.error || "Failed to reset attempts.");
    } finally {
      setDangerBusy("");
    }
  };

  const handleExportData = async () => {
    setDangerBusy("export");
    try {
      const res = await API.get("/admin/danger/export-data", {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      const disposition = res.headers["content-disposition"] || "";
      const match = disposition.match(/filename="?([^"]+)"?/);
      link.setAttribute("download", match ? match[1] : "ecat-cbt-students.csv");
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      showToast("success", "CSV export downloaded successfully.");
    } catch (err) {
      console.error("Export data failed:", err);
      showToast("error", err.response?.data?.error || "Failed to export data.");
    } finally {
      setDangerBusy("");
    }
  };

  const aiHeaders = (token = aiAccessToken) => ({ headers: { "x-ai-config-token": token } });

  const unlockAiSettings = async () => {
    const secretCode = window.prompt("Enter your Admin Secret Code to unlock AI configuration for 10 minutes:");
    if (!secretCode) return;
    setAiBusy("unlock");
    try {
      const unlock = await API.post("/admin/ai/unlock", { secretCode });
      const token = unlock.data.accessToken;
      setAiAccessToken(token);
      const [configRes, modelsRes] = await Promise.all([
        API.get("/admin/ai/config", aiHeaders(token)),
        API.get("/admin/ai/models", aiHeaders(token)),
      ]);
      setAiConfig(configRes.data);
      setAiModel(configRes.data.model);
      setGroqModels(modelsRes.data.models || []);
      showToast("success", "AI configuration unlocked securely.");
    } catch (err) {
      showToast("error", err.response?.data?.error || "Could not unlock AI configuration.");
    } finally {
      setAiBusy("");
    }
  };

  const refreshGroqModels = async () => {
    setAiBusy("models");
    try {
      const res = await API.get("/admin/ai/models", aiHeaders());
      setGroqModels(res.data.models || []);
      showToast("success", "Groq model list refreshed.");
    } catch (err) {
      showToast("error", err.response?.data?.error || "Could not load Groq models.");
    } finally {
      setAiBusy("");
    }
  };

  const saveAiConfiguration = async () => {
    setAiBusy("save");
    try {
      const res = await API.patch("/admin/ai/config", { model: aiModel, apiKey: newAiKey }, aiHeaders());
      setAiConfig(res.data.config);
      setAiModel(res.data.config.model);
      setNewAiKey("");
      showToast("success", res.data.emailSent ? "AI configuration saved; Root Owner was emailed." : "AI configuration saved. Email alert is unavailable.");
    } catch (err) {
      showToast("error", err.response?.data?.error || "Could not save AI configuration.");
    } finally {
      setAiBusy("");
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
        <button
          type="button"
          className="settings-save-btn settings-save-btn--header"
          disabled={saving}
          onClick={handleSaveAll}
        >
          <FaSave /> {saving ? "Saving..." : "Save All Settings"}
        </button>
      </header>

      <div className="settings-grid">

        {/* General Configuration */}
        <section className="settings-card">
          <div className="settings-card-title">
            <FaShieldAlt className="settings-card-icon settings-card-icon--blue" />
            <h2>General Configuration</h2>
          </div>
          <div className="settings-form">
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
          </div>
        </section>

        {/* Exam Configuration */}
        <section className="settings-card">
          <div className="settings-card-title">
            <FaClipboardList className="settings-card-icon settings-card-icon--blue" />
            <h2>Exam Configuration</h2>
          </div>
          <p className="settings-card-desc">
            Configure default test parameters for the CBT engine.
          </p>
          <div className="settings-form">
            <div className="settings-field">
              <label htmlFor="defaultTestSize">
                <FaClipboardList className="field-icon" /> Default Test Size
              </label>
              <div className="settings-input-row">
                <input
                  id="defaultTestSize"
                  type="number"
                  min={5}
                  max={200}
                  value={settings?.defaultTestSize ?? 40}
                  onChange={(e) =>
                    setSettings({ ...settings, defaultTestSize: parseInt(e.target.value) || 40 })
                  }
                />
                <span className="input-unit">questions per test</span>
              </div>
            </div>
            <div className="settings-field">
              <label htmlFor="maxPracticeQuestions">
                <FaClipboardList className="field-icon" /> Max Practice Questions
              </label>
              <div className="settings-input-row">
                <input
                  id="maxPracticeQuestions"
                  type="number"
                  min={1}
                  max={500}
                  value={settings?.maxPracticeQuestions ?? 100}
                  onChange={(e) =>
                    setSettings({ ...settings, maxPracticeQuestions: parseInt(e.target.value) || 100 })
                  }
                />
                <span className="input-unit">per session</span>
              </div>
            </div>
            <div className="settings-field">
              <label htmlFor="defaultPackage">
                <FaBox className="field-icon" /> Default Package
              </label>
              <select
                id="defaultPackage"
                value={settings?.defaultPackage ?? "STANDARD"}
                onChange={(e) =>
                  setSettings({ ...settings, defaultPackage: e.target.value })
                }
              >
                <option value="STANDARD">Standard</option>
                <option value="PREMIUM">Premium</option>
              </select>
            </div>
          </div>
        </section>

        {/* Security & Access */}
        <section className="settings-card">
          <div className="settings-card-title">
            <FaUserShield className="settings-card-icon settings-card-icon--green" />
            <h2>Security &amp; Access</h2>
          </div>
          <p className="settings-card-desc">
            Control registration, verification, and student access policies.
          </p>
          <div className="settings-toggles">
            <ToggleRow
              icon={<FaUserCheck />}
              label="Auto-Approve Students"
              desc="Newly registered students are instantly approved without admin review."
              enabled={settings?.autoApproveStudents}
              onToggle={() => handleToggle("autoApproveStudents")}
            />
            <ToggleRow
              icon={<FaEnvelope />}
              label="Email Verification Required"
              desc="Students must verify their email via OTP before they can log in."
              enabled={settings?.emailVerificationRequired}
              onToggle={() => handleToggle("emailVerificationRequired")}
              danger
            />
          </div>
          <div className="settings-field settings-field--spaced">
            <label htmlFor="registrationMode">
              <FaUserShield className="field-icon" /> Registration Mode
            </label>
            <select
              id="registrationMode"
              value={settings?.registrationMode ?? "Open"}
              onChange={(e) =>
                setSettings({ ...settings, registrationMode: e.target.value })
              }
            >
              <option value="Open">Open — Anyone can register</option>
              <option value="Approval">Approval — Admin must approve each student</option>
              <option value="Invite">Invite Only — Requires an invite code</option>
            </select>
          </div>
          <div className="settings-field settings-field--spaced">
            <label htmlFor="freezeThreshold">
              <FaSnowflake className="field-icon" /> Freeze Threshold
            </label>
            <div className="settings-input-row">
              <input
                id="freezeThreshold"
                type="number"
                min={1}
                max={20}
                value={settings?.freezeThreshold ?? 3}
                onChange={(e) =>
                  setSettings({ ...settings, freezeThreshold: parseInt(e.target.value) || 3 })
                }
              />
              <span className="input-unit">false reports → auto-freeze</span>
            </div>
          </div>
        </section>

        {/* Feature Flags */}
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

        {/* AI Provider Configuration */}
        <section className="settings-card ai-config-card">
          <div className="settings-card-title">
            <FaRobot className="settings-card-icon settings-card-icon--purple" />
            <h2>AI Provider Configuration</h2>
            <span className="settings-root-badge">Secret Code Required</span>
          </div>
          <p className="settings-card-desc">
            Manage the active Groq model and API key. Keys are encrypted server-side and can never be viewed or copied after saving.
          </p>
          {!aiAccessToken ? (
            <div className="ai-config-locked">
              <FaLock />
              <div><strong>Protected settings</strong><p>Enter your own admin secret code to continue.</p></div>
              <button type="button" className="settings-save-btn" onClick={unlockAiSettings} disabled={aiBusy === "unlock"}>
                <FaKey /> {aiBusy === "unlock" ? "Verifying..." : "Unlock AI Settings"}
              </button>
            </div>
          ) : (
            <div className="settings-form ai-config-form">
              <div className="ai-config-status"><FaLock /> API key: <strong>{aiConfig?.keyConfigured ? `${aiConfig.keySource} (${aiConfig.keyLastFour})` : "Not configured"}</strong></div>
              <div className="settings-field">
                <label htmlFor="groqModel"><FaRobot className="field-icon" /> Active Groq Model</label>
                <div className="ai-model-row">
                  <select id="groqModel" value={aiModel} onChange={(e) => setAiModel(e.target.value)}>
                    {aiModel && !groqModels.includes(aiModel) && <option value={aiModel}>{aiModel} (current)</option>}
                    {groqModels.map((model) => <option key={model} value={model}>{model}</option>)}
                  </select>
                  <button type="button" className="ai-refresh-btn" onClick={refreshGroqModels} disabled={aiBusy === "models"} title="Refresh models from Groq"><FaSync /></button>
                </div>
              </div>
              <div className="settings-field">
                <label htmlFor="groqKey"><FaKey className="field-icon" /> Replace Groq API Key <span className="field-optional">(optional)</span></label>
                <input id="groqKey" type="password" autoComplete="new-password" value={newAiKey} onChange={(e) => setNewAiKey(e.target.value)} placeholder="Paste a new key only when replacing it" />
                <small className="ai-key-note">The current key is never displayed. Leaving this blank preserves it.</small>
              </div>
              <button type="button" className="settings-save-btn" onClick={saveAiConfiguration} disabled={aiBusy === "save" || !aiModel}>
                <FaSave /> {aiBusy === "save" ? "Saving securely..." : "Save AI Configuration"}
              </button>
            </div>
          )}
        </section>

        {/* Official Payment Receiving Account (2-Step Root Verification) */}
        <section className="settings-card bank-settings-card">
          <div className="settings-card-title">
            <FaUniversity className="settings-card-icon settings-card-icon--green" />
            <div>
              <h2>Payment Receiving Account (IBAN)</h2>
              <p className="settings-card-subtitle">Official destination for student package & profile change bank transfers</p>
            </div>
            {bankSettings?.activeBank && (
              <span className="bank-active-tag">
                <FaCheckCircle /> {bankSettings.activeBank.bankName}
              </span>
            )}
          </div>

          {/* Active Bank Details Display */}
          {bankSettings?.activeBank && (
            <div className="bank-current-preview">
              <div className="bank-preview-grid">
                <div className="bank-preview-item">
                  <span>Bank Name</span>
                  <strong>{bankSettings.activeBank.bankName}</strong>
                </div>
                <div className="bank-preview-item">
                  <span>Account Title</span>
                  <strong>{bankSettings.activeBank.accountTitle}</strong>
                </div>
                <div className="bank-preview-item bank-preview-iban">
                  <span>Official IBAN</span>
                  <code>{bankSettings.activeBank.iban}</code>
                </div>
                <div className="bank-preview-item">
                  <span>Raast ID</span>
                  <strong>{bankSettings.activeBank.raastId || "—"}</strong>
                </div>
                <div className="bank-preview-item">
                  <span>Support Email</span>
                  <strong>{bankSettings.activeBank.supportContact || "—"}</strong>
                </div>
              </div>
            </div>
          )}

          {/* Pending Approval Box (if any request is active) */}
          {bankSettings?.pendingRequest ? (
            <div className="bank-pending-alert">
              <div className="bank-pending-header">
                <div className="bank-pending-badge">
                  <FaLock /> 2-Step Root Authorization Required
                </div>
                <span className="bank-pending-expiry">
                  Expires: {new Date(bankSettings.pendingRequest.expiresAt).toLocaleTimeString("en-PK", { timeZone: "Asia/Karachi", hour: "2-digit", minute: "2-digit" })} PKT
                </span>
              </div>

              <div className="bank-pending-desc">
                <p>
                  <strong>{bankSettings.pendingRequest.requestedByAdminName}</strong> ({bankSettings.pendingRequest.requestedByAdminEmail}) requested to update payment details:
                </p>
                <div className="bank-pending-diff">
                  <div><span>Proposed Bank:</span> <strong>{bankSettings.pendingRequest.proposedBankName}</strong></div>
                  <div><span>Proposed Title:</span> <strong>{bankSettings.pendingRequest.proposedAccountTitle}</strong></div>
                  <div><span>Proposed IBAN:</span> <code>{bankSettings.pendingRequest.proposedIban}</code></div>
                  {bankSettings.pendingRequest.proposedRaastId && <div><span>Proposed Raast ID:</span> <strong>{bankSettings.pendingRequest.proposedRaastId}</strong></div>}
                </div>
                <p className="bank-pending-instruction">
                  <FaInfoCircle /> A secret authorization code was dispatched to <strong>muhammad.f336s@gmail.com</strong> (Root Owner). Enter it below to apply these changes across all student challans and portal screens:
                </p>
              </div>

              <div className="bank-auth-action-row">
                <input
                  type="text"
                  placeholder="Enter Root Code (e.g. BANK-XXXXXX)"
                  value={rootAuthCode}
                  onChange={(e) => setRootAuthCode(e.target.value)}
                  className="bank-auth-input"
                />
                <button
                  type="button"
                  className="settings-save-btn bank-approve-btn"
                  onClick={handleApproveBankChange}
                  disabled={bankBusy === "approve" || !rootAuthCode.trim()}
                >
                  <FaCheckCircle /> {bankBusy === "approve" ? "Applying..." : "Authorize & Update"}
                </button>
                <button
                  type="button"
                  className="settings-danger-btn bank-cancel-btn"
                  onClick={handleCancelBankChange}
                  disabled={bankBusy === "cancel"}
                >
                  <FaTimes /> Cancel Request
                </button>
              </div>

              {/* Cancel All Pending Requests — inline secret prompt */}
              {!showCancelAllPrompt ? (
                <div className="bank-cancel-all-row">
                  <button
                    type="button"
                    className="bank-cancel-all-btn"
                    onClick={() => setShowCancelAllPrompt(true)}
                    disabled={bankBusy !== ""}
                  >
                    <FaTrashAlt /> Cancel All Pending Requests
                  </button>
                </div>
              ) : (
                <div className="bank-cancel-all-prompt">
                  <p className="bank-cancel-all-warn">
                    <FaExclamationCircle /> This will cancel <strong>all</strong> stuck pending requests. Enter your Admin Secret Code to confirm:
                  </p>
                  <div className="bank-cancel-all-inputs">
                    <input
                      type="password"
                      className="bank-auth-input"
                      placeholder="Your Admin Secret Code"
                      value={cancelAllCode}
                      onChange={(e) => setCancelAllCode(e.target.value)}
                    />
                    <button
                      type="button"
                      className="settings-danger-btn"
                      onClick={handleCancelAllBankRequests}
                      disabled={bankBusy === "cancelAll" || !cancelAllCode.trim()}
                    >
                      <FaTrashAlt /> {bankBusy === "cancelAll" ? "Cancelling..." : "Confirm Cancel All"}
                    </button>
                    <button
                      type="button"
                      className="settings-cancel-btn"
                      onClick={() => { setShowCancelAllPrompt(false); setCancelAllCode(""); }}
                    >
                      Back
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bank-actions-area">
              {!showBankForm ? (
                <button
                  type="button"
                  className="settings-save-btn bank-open-form-btn"
                  onClick={() => setShowBankForm(true)}
                >
                  <FaShieldAlt /> Request IBAN / Bank Details Change
                </button>
              ) : (
                <form onSubmit={handleRequestBankChange} className="bank-change-form">
                  <div className="bank-form-header">
                    <h4>Propose New Receiving Account</h4>
                    <button type="button" className="bank-close-form" onClick={() => setShowBankForm(false)}>
                      <FaTimes />
                    </button>
                  </div>

                  <div className="bank-form-grid">
                    <div className="settings-field">
                      <label>Bank Name *</label>
                      <input
                        type="text"
                        required
                        value={bankForm.proposedBankName}
                        onChange={(e) => setBankForm({ ...bankForm, proposedBankName: e.target.value })}
                        placeholder="e.g. Meezan Bank, NayaPay, HBL"
                      />
                    </div>
                    <div className="settings-field">
                      <label>Account Title *</label>
                      <input
                        type="text"
                        required
                        value={bankForm.proposedAccountTitle}
                        onChange={(e) => setBankForm({ ...bankForm, proposedAccountTitle: e.target.value })}
                        placeholder="e.g. Hafiz Muhammad Faizan"
                      />
                    </div>
                    <div className="settings-field bank-field-full">
                      <label>New IBAN *</label>
                      <input
                        type="text"
                        required
                        value={bankForm.proposedIban}
                        onChange={(e) => setBankForm({ ...bankForm, proposedIban: e.target.value })}
                        placeholder="PK..."
                      />
                    </div>
                    <div className="settings-field">
                      <label>Raast ID (Mobile No)</label>
                      <input
                        type="text"
                        value={bankForm.proposedRaastId}
                        onChange={(e) => setBankForm({ ...bankForm, proposedRaastId: e.target.value })}
                        placeholder="03001234567"
                      />
                    </div>
                    <div className="settings-field">
                      <label>Payment Support Contact</label>
                      <input
                        type="text"
                        value={bankForm.proposedSupportContact}
                        onChange={(e) => setBankForm({ ...bankForm, proposedSupportContact: e.target.value })}
                        placeholder="support@entrace.pk"
                      />
                    </div>
                    <div className="settings-field bank-field-full bank-secret-field">
                      <label><FaKey /> Your Admin Secret Code *</label>
                      <input
                        type="password"
                        required
                        placeholder="Enter ADM-XXXX-XXXX"
                        value={bankForm.adminSecretCode}
                        onChange={(e) => setBankForm({ ...bankForm, adminSecretCode: e.target.value })}
                      />
                      <small className="bank-sec-hint">
                        <FaLock /> Protected 2-Step Action: Submitting this will email a one-time secret authorization code to the Root Owner (muhammad.f336s@gmail.com). Changes will NOT apply until that code is entered.
                      </small>
                    </div>
                  </div>

                  <div className="bank-form-buttons">
                    <button
                      type="submit"
                      className="settings-save-btn"
                      disabled={bankBusy === "request"}
                    >
                      <FaShieldAlt /> {bankBusy === "request" ? "Submitting..." : "Submit Request to Root Owner"}
                    </button>
                    <button
                      type="button"
                      className="settings-cancel-btn"
                      onClick={() => setShowBankForm(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </section>

        {/* Administration Controls */}
        <section className="settings-card">
          <div className="settings-card-title">
            <FaUserShield className="settings-card-icon settings-card-icon--green" />
            <h2>Administration Controls</h2>
            {isRoot && <span className="settings-root-badge">Root Owner</span>}
          </div>
          <p className="settings-card-desc">
            Manage admin ranks, approval queue, student access, and direct login messages.
          </p>
          <div className="settings-admin-links">
            <button type="button" onClick={() => navigate("/admin/administration")}>
              <FaUserShield /> Manage Admins
            </button>
            <button type="button" onClick={() => navigate("/admin/approvals")}>
              <FaUserCheck /> Pending Approvals
            </button>
            <button type="button" onClick={() => navigate("/admin/students")}>
              <FaClipboardList /> Student Access
            </button>
            <button type="button" onClick={() => navigate("/admin/messages")}>
              <FaEnvelope /> Message Center
            </button>
          </div>
        </section>

        {/* Danger Zone */}
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
                <button
                  type="button"
                  className="settings-danger-btn"
                  disabled={dangerBusy === "reset"}
                  onClick={handleResetAttempts}
                >
                  <FaTrashAlt /> {dangerBusy === "reset" ? "Resetting..." : "Reset Now"}
                </button>
              </div>
              <div className="danger-row">
                <div>
                  <strong>Export Platform Data</strong>
                  <p>Download a full CSV export of all student data and analytics.</p>
                </div>
                <button
                  type="button"
                  className="settings-danger-btn"
                  disabled={dangerBusy === "export"}
                  onClick={handleExportData}
                >
                  <FaDownload /> {dangerBusy === "export" ? "Exporting..." : "Download CSV"}
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Platform Info */}
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
