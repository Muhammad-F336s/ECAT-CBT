import { useState, useEffect } from "react";
import {
  FaCrown,
  FaEdit,
  FaToggleOn,
  FaToggleOff,
  FaShieldAlt,
  FaSpinner,
  FaExclamationTriangle,
  FaCheckCircle,
  FaTimes,
  FaClock,
  FaCheck,
  FaPlus,
  FaTrash,
  FaArrowRight,
  FaFileAlt,
  FaInfoCircle,
} from "react-icons/fa";
import API from "../utils/api";
import "./AdminPackages.css";

const ROOT_ADMIN_EMAIL = "muhammad.f336s@gmail.com";

const DEFAULT_FEATURE_OPTIONS = [
  "Full ECAT CBT Test Attempts",
  "Days Access Validity",
  "Basic Result & Performance Review",
  "Content Library Access",
  "Selected Academic Subjects Practice",
  "Standard CBT Mode Simulation",
  "Basic Analytics & Topic Breakdown",
  "Full Multi-Subject CBT Simulator",
  "Detailed Analytics & Speed Insights",
  "Advanced Predictive Analytics",
  "Historical Attempt Breakdown & Review",
  "Full Resources & Past Papers Access",
  "Vector Bot AI Mentor Access",
  "Priority Support Response",
  "One-time account activation",
];

export default function AdminPackages({ user }) {
  const currentUser = user || JSON.parse(localStorage.getItem("user") || "{}");
  const isRootAdmin = currentUser?.email === ROOT_ADMIN_EMAIL;

  const [packages, setPackages] = useState([]);
  const [changeRequests, setChangeRequests] = useState([]);
  const [featureOptions, setFeatureOptions] = useState(DEFAULT_FEATURE_OPTIONS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Edit Pricing Modal
  const [editPricePkg, setEditPricePkg] = useState(null);
  const [formPrice, setFormPrice] = useState(0);
  const [formValidity, setFormValidity] = useState(30);
  const [formAttempts, setFormAttempts] = useState(10);
  const [priceSecretCode, setPriceSecretCode] = useState("");
  const [priceAdminNote, setPriceAdminNote] = useState("");
  const [savingPrice, setSavingPrice] = useState(false);
  const [priceError, setPriceError] = useState("");

  // Edit Details (Features & Content) Modal
  const [editDetailPkg, setEditDetailPkg] = useState(null);
  const [formName, setFormName] = useState("");
  const [selectedFeatures, setSelectedFeatures] = useState([]);
  const [customFeatureInput, setCustomFeatureInput] = useState("");
  const [formBadgeText, setFormBadgeText] = useState("");
  const [formDisplayOrder, setFormDisplayOrder] = useState(0);
  const [detailSecretCode, setDetailSecretCode] = useState("");
  const [detailAdminNote, setDetailAdminNote] = useState("");
  const [savingDetails, setSavingDetails] = useState(false);
  const [detailError, setDetailError] = useState("");

  // Root Admin Action Modals (Approve / Reject)
  const [activeRequestModal, setActiveRequestModal] = useState(null); // { action: 'approve' | 'reject', request: ... }
  const [rootAdminNote, setRootAdminNote] = useState("");
  const [processingAction, setProcessingAction] = useState(false);
  const [actionModalError, setActionModalError] = useState("");

  // Quick Action Dialog (Toggle / Recommended)
  const [quickAction, setQuickAction] = useState(null);
  const [quickSecretCode, setQuickSecretCode] = useState("");
  const [executingQuick, setExecutingQuick] = useState(false);
  const [quickError, setQuickError] = useState("");

  const loadAllData = async () => {
    try {
      setLoading(true);
      setError("");
      const [pkgsRes, reqsRes, featRes] = await Promise.all([
        API.get("/admin/packages"),
        API.get("/admin/package-changes/requests").catch(() => ({ data: { requests: [] } })),
        API.get("/admin/package-changes/features-list").catch(() => ({ data: { features: DEFAULT_FEATURE_OPTIONS } })),
      ]);
      setPackages(pkgsRes.data || []);
      setChangeRequests(reqsRes.data?.requests || []);
      if (featRes.data?.features && Array.isArray(featRes.data.features)) {
        setFeatureOptions(featRes.data.features);
      }
    } catch (err) {
      console.error("[AdminPackages] Load error:", err);
      setError(err.response?.data?.error || "Failed to load package catalog.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // ── 1. Open Edit Pricing Modal ──────────────────────────────────────────────
  const openEditPricing = (pkg) => {
    setEditPricePkg(pkg);
    setFormPrice(pkg.price);
    setFormValidity(pkg.validityDays);
    setFormAttempts(pkg.testAttempts);
    setPriceSecretCode("");
    setPriceAdminNote("");
    setPriceError("");
  };

  // Submit Pricing Update for Approval
  const handleSubmitPricing = async (e) => {
    e.preventDefault();
    setPriceError("");

    if (!priceSecretCode.trim()) {
      setPriceError("Admin secret code is required.");
      return;
    }

    try {
      setSavingPrice(true);
      const res = await API.post("/admin/package-changes/submit", {
        secretCode: priceSecretCode.trim(),
        packageCode: editPricePkg.code,
        proposedChanges: {
          price: Number(formPrice),
          validityDays: Number(formValidity),
          testAttempts: Number(formAttempts),
        },
        adminNote: priceAdminNote.trim() || undefined,
      });

      setSuccessMsg(res.data.message || "Pricing change request submitted for Root Admin approval.");
      setEditPricePkg(null);
      loadAllData();
    } catch (err) {
      setPriceError(err.response?.data?.error || "Failed to submit pricing change request.");
    } finally {
      setSavingPrice(false);
    }
  };

  // ── 2. Open Edit Details Modal ──────────────────────────────────────────────
  const openEditDetails = (pkg) => {
    setEditDetailPkg(pkg);
    setFormName(pkg.name);
    setSelectedFeatures([...(pkg.features || [])]);
    setCustomFeatureInput("");
    setFormBadgeText(pkg.badgeText || "");
    setFormDisplayOrder(pkg.displayOrder || 0);
    setDetailSecretCode("");
    setDetailAdminNote("");
    setDetailError("");
  };

  const handleToggleFeature = (feature) => {
    setSelectedFeatures((prev) =>
      prev.includes(feature)
        ? prev.filter((f) => f !== feature)
        : [...prev, feature]
    );
  };

  const handleAddCustomFeature = () => {
    const trimmed = customFeatureInput.trim();
    if (!trimmed) return;
    if (!selectedFeatures.includes(trimmed)) {
      setSelectedFeatures((prev) => [...prev, trimmed]);
    }
    if (!featureOptions.includes(trimmed)) {
      setFeatureOptions((prev) => [...prev, trimmed]);
    }
    setCustomFeatureInput("");
  };

  const handleRemoveFeature = (feature) => {
    setSelectedFeatures((prev) => prev.filter((f) => f !== feature));
  };

  // Submit Details Update for Approval
  const handleSubmitDetails = async (e) => {
    e.preventDefault();
    setDetailError("");

    if (!detailSecretCode.trim()) {
      setDetailError("Admin secret code is required.");
      return;
    }

    try {
      setSavingDetails(true);
      const res = await API.post("/admin/package-changes/submit", {
        secretCode: detailSecretCode.trim(),
        packageCode: editDetailPkg.code,
        proposedChanges: {
          name: formName.trim(),
          features: selectedFeatures,
          badgeText: formBadgeText.trim() || null,
          displayOrder: Number(formDisplayOrder),
        },
        adminNote: detailAdminNote.trim() || undefined,
      });

      setSuccessMsg(res.data.message || "Package change request submitted for Root Admin approval.");
      setEditDetailPkg(null);
      loadAllData();
    } catch (err) {
      setDetailError(err.response?.data?.error || "Failed to submit package change request.");
    } finally {
      setSavingDetails(false);
    }
  };

  // ── 3. Root Admin Approve / Reject Handlers ────────────────────────────────
  const handleRootAdminAction = async () => {
    if (!activeRequestModal) return;
    setActionModalError("");

    try {
      setProcessingAction(true);
      const { action, request } = activeRequestModal;

      if (action === "approve") {
        const res = await API.post(`/admin/package-changes/${request.id}/approve`, {
          rootAdminNote: rootAdminNote.trim() || undefined,
        });
        setSuccessMsg(res.data.message || "Package change approved and applied live!");
      } else if (action === "reject") {
        const res = await API.post(`/admin/package-changes/${request.id}/reject`, {
          rootAdminNote: rootAdminNote.trim() || "Declined by Root Admin.",
        });
        setSuccessMsg(res.data.message || "Package change request rejected.");
      }

      setActiveRequestModal(null);
      setRootAdminNote("");
      loadAllData();
    } catch (err) {
      setActionModalError(err.response?.data?.error || "Operation failed.");
    } finally {
      setProcessingAction(false);
    }
  };

  // ── 4. Quick Action Execution (Toggle / Recommended) ──────────────────────
  const handleExecuteQuickAction = async (e) => {
    e.preventDefault();
    setQuickError("");

    if (!quickSecretCode.trim()) {
      setQuickError("Admin secret code is required.");
      return;
    }

    try {
      setExecutingQuick(true);
      if (quickAction.type === "toggle") {
        const res = await API.patch(`/admin/packages/${quickAction.pkg.code}/toggle`, {
          secretCode: quickSecretCode.trim(),
        });
        setSuccessMsg(res.data.message);
      } else if (quickAction.type === "recommended") {
        const res = await API.patch(`/admin/packages/${quickAction.pkg.code}/recommended`, {
          secretCode: quickSecretCode.trim(),
        });
        setSuccessMsg(res.data.message);
      }

      setQuickAction(null);
      setQuickSecretCode("");
      loadAllData();
    } catch (err) {
      setQuickError(err.response?.data?.error || "Operation failed.");
    } finally {
      setExecutingQuick(false);
    }
  };

  const pendingRequests = changeRequests.filter((r) => r.status === "PENDING");

  return (
    <div className="admin-packages-container">
      {/* Header */}
      <div className="admin-packages-header">
        <div>
          <span>Product Catalog & Monetization</span>
          <h1>Package Catalog Management</h1>
          <p>
            Control pricing, mock test attempts, access duration, and feature lists.
            All modifications go through Root Admin authorization before taking effect.
          </p>
        </div>
      </div>

      {/* Global Alerts */}
      {error && (
        <div className="admin-alert admin-alert-danger">
          <FaExclamationTriangle />
          <span>{error}</span>
          <button onClick={() => setError("")} className="alert-close"><FaTimes /></button>
        </div>
      )}
      {successMsg && (
        <div className="admin-alert admin-alert-success">
          <FaCheckCircle />
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg("")} className="alert-close"><FaTimes /></button>
        </div>
      )}

      {/* ── ROOT ADMIN APPROVAL SECTION (If pending requests exist) ───────── */}
      {pendingRequests.length > 0 && (
        <div className="pending-requests-section">
          <div className="pending-section-header">
            <div className="pending-header-title">
              <FaShieldAlt className="shield-icon" />
              <h3>Package Change Requests Awaiting Approval</h3>
              <span className="pending-badge-count">{pendingRequests.length} Pending</span>
            </div>
            {isRootAdmin ? (
              <span className="root-indicator">👑 You are logged in as Root Owner. You can approve or reject these changes.</span>
            ) : (
              <span className="root-indicator">🔒 Awaiting review from Root Admin ({ROOT_ADMIN_EMAIL})</span>
            )}
          </div>

          <div className="pending-cards-grid">
            {pendingRequests.map((req) => {
              const proposed = req.proposedChanges || {};
              const current = req.currentSnapshot || {};

              return (
                <div key={req.id} className="pending-request-card">
                  <div className="req-card-header">
                    <div>
                      <span className="req-pkg-badge">{req.packageCode}</span>
                      <strong className="req-pkg-name">{req.packageName}</strong>
                    </div>
                    <span className="req-time-stamp">
                      <FaClock /> {new Date(req.createdAt).toLocaleDateString("en-PK", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>

                  <div className="req-meta-info">
                    <span>Submitted by: <strong>{req.submittedByAdminName}</strong> (<code>{req.submittedByAdminEmail}</code>)</span>
                    {req.adminNote && (
                      <p className="req-admin-note">
                        <FaFileAlt /> Note: "{req.adminNote}"
                      </p>
                    )}
                  </div>

                  {/* Proposed Changes Diff View */}
                  <div className="req-diff-box">
                    <span className="diff-label">Proposed Modifications:</span>
                    <ul className="diff-list">
                      {proposed.price !== undefined && proposed.price !== current.price && (
                        <li>
                          <strong>Price:</strong> PKR {current.price} &rarr; <span className="diff-new">PKR {proposed.price}</span>
                        </li>
                      )}
                      {proposed.validityDays !== undefined && proposed.validityDays !== current.validityDays && (
                        <li>
                          <strong>Validity:</strong> {current.validityDays} days &rarr; <span className="diff-new">{proposed.validityDays} days</span>
                        </li>
                      )}
                      {proposed.testAttempts !== undefined && proposed.testAttempts !== current.testAttempts && (
                        <li>
                          <strong>Attempts:</strong> {current.testAttempts} &rarr; <span className="diff-new">{proposed.testAttempts} tests</span>
                        </li>
                      )}
                      {proposed.name && proposed.name !== current.name && (
                        <li>
                          <strong>Name:</strong> "{current.name}" &rarr; <span className="diff-new">"{proposed.name}"</span>
                        </li>
                      )}
                      {proposed.features && (
                        <li>
                          <strong>Features ({proposed.features.length} selected):</strong>
                          <div className="diff-features-tags">
                            {proposed.features.map((f, i) => {
                              const isNew = !(current.features || []).includes(f);
                              return (
                                <span key={i} className={`feature-pill ${isNew ? "pill-added" : "pill-existing"}`}>
                                  {isNew ? "+ " : ""}{f}
                                </span>
                              );
                            })}
                          </div>
                        </li>
                      )}
                    </ul>
                  </div>

                  {/* Actions for Root Admin */}
                  <div className="req-card-actions">
                    {isRootAdmin ? (
                      <>
                        <button
                          className="btn-approve-req"
                          onClick={() => {
                            setActiveRequestModal({ action: "approve", request: req });
                            setRootAdminNote("");
                            setActionModalError("");
                          }}
                        >
                          <FaCheck /> Approve & Apply Live
                        </button>
                        <button
                          className="btn-reject-req"
                          onClick={() => {
                            setActiveRequestModal({ action: "reject", request: req });
                            setRootAdminNote("");
                            setActionModalError("");
                          }}
                        >
                          <FaTimes /> Reject
                        </button>
                      </>
                    ) : (
                      <span className="awaiting-root-text">
                        ⏳ Submitted &mdash; Waiting for Root Admin review
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Packages Grid / Cards ────────────────────────────────────────── */}
      {loading ? (
        <div className="packages-loading">
          <FaSpinner className="spin" />
          <p>Loading package catalog...</p>
        </div>
      ) : (
        <div className="admin-pkgs-grid">
          {packages.map((pkg) => {
            const isStarter = pkg.code === "STARTER";
            const isInternal = pkg.code === "PROFILE_CHANGE";
            const hasPending = pendingRequests.some((r) => r.packageCode === pkg.code);

            return (
              <div
                key={pkg.id}
                className={`admin-pkg-card ${pkg.isRecommended ? "pkg-card-recommended" : ""} ${!pkg.isActive && !isInternal ? "pkg-card-disabled" : ""}`}
              >
                {/* Header */}
                <div className="pkg-card-top">
                  <div className="pkg-title-area">
                    <span className="pkg-code-pill">{pkg.code}</span>
                    {pkg.isRecommended && (
                      <span className="pkg-rec-pill">
                        <FaCrown /> Recommended
                      </span>
                    )}
                    {isInternal && (
                      <span className="pkg-rec-pill" style={{ background: "#6366f1" }}>Internal</span>
                    )}
                    {!pkg.isActive && !isInternal && (
                      <span className="pkg-disabled-pill">Disabled</span>
                    )}
                    {hasPending && (
                      <span className="pkg-pending-pill">
                        <FaClock /> Change Pending
                      </span>
                    )}
                  </div>
                  <h3 className="pkg-name">{pkg.name}</h3>
                  <div className="pkg-price-row">
                    <span className="pkg-curr">PKR</span>
                    <strong className="pkg-price-val">{pkg.price}</strong>
                    <span className="pkg-period">/ {pkg.validityDays} days</span>
                  </div>
                </div>

                {/* Stats Strip */}
                <div className="pkg-stats-strip">
                  <div className="pkg-stat-item">
                    <span>Attempts</span>
                    <strong>{pkg.testAttempts}</strong>
                  </div>
                  <div className="pkg-stat-item">
                    <span>Total Orders</span>
                    <strong>{pkg.stats?.totalOrders ?? 0}</strong>
                  </div>
                  <div className="pkg-stat-item">
                    <span>Revenue</span>
                    <strong>PKR {Number(pkg.stats?.verifiedRevenue ?? 0).toLocaleString()}</strong>
                  </div>
                </div>

                {/* Features List Preview */}
                <div className="pkg-features-preview">
                  <span className="features-header">Included Features ({pkg.features?.length || 0}):</span>
                  <ul>
                    {(pkg.features || []).slice(0, 5).map((f, i) => (
                      <li key={i}>
                        <FaCheck className="check-bullet" /> {f}
                      </li>
                    ))}
                    {(pkg.features || []).length > 5 && (
                      <li className="features-more">+{(pkg.features || []).length - 5} more</li>
                    )}
                  </ul>
                </div>

                {/* Control Action Buttons */}
                <div className="pkg-card-actions">
                  <button
                    className="btn-edit-pricing"
                    onClick={() => openEditPricing(pkg)}
                  >
                    <FaEdit /> Edit Pricing & Limits
                  </button>
                  <button
                    className="btn-edit-details"
                    onClick={() => openEditDetails(pkg)}
                  >
                    Edit Features & Content
                  </button>

                  {!isInternal && (
                    <div className="pkg-quick-actions">
                      <button
                        className={`btn-toggle-rec ${pkg.isRecommended ? "btn-is-rec" : ""}`}
                        onClick={() => setQuickAction({ type: "recommended", pkg })}
                        title="Mark as Recommended Plan"
                      >
                        <FaCrown /> {pkg.isRecommended ? "Recommended" : "Set Rec"}
                      </button>

                      {!isStarter && (
                        <button
                          className={`btn-toggle-active ${pkg.isActive ? "btn-active-on" : "btn-active-off"}`}
                          onClick={() => setQuickAction({ type: "toggle", pkg })}
                          title={pkg.isActive ? "Disable Package" : "Activate Package"}
                        >
                          {pkg.isActive ? <FaToggleOn /> : <FaToggleOff />}
                          {pkg.isActive ? "Active" : "Disabled"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── EDIT PRICING MODAL ────────────────────────────────────────────── */}
      {editPricePkg && (
        <div className="admin-modal-overlay" onClick={() => setEditPricePkg(null)}>
          <div className="admin-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <div>
                <h2>Edit Package Pricing & Limits</h2>
                <p>Package: <strong>{editPricePkg.name} ({editPricePkg.code})</strong></p>
              </div>
              <button className="modal-close" onClick={() => setEditPricePkg(null)}><FaTimes /></button>
            </div>

            <form onSubmit={handleSubmitPricing} className="admin-modal-body">
              {priceError && (
                <div className="admin-alert admin-alert-danger">
                  <FaExclamationTriangle />
                  <span>{priceError}</span>
                </div>
              )}

              <div className="security-notice-box">
                <FaShieldAlt />
                <span>
                  Pricing changes require <strong>Root Admin approval</strong>. Once submitted,
                  a request is sent to the Root Administrator ({ROOT_ADMIN_EMAIL}).
                </span>
              </div>

              <div className="form-group">
                <label>Package Price (PKR) <span className="req">*</span>:</label>
                <input
                  type="number"
                  value={formPrice}
                  onChange={(e) => setFormPrice(e.target.value)}
                  min={0}
                  disabled={editPricePkg.code === "STARTER"}
                  required
                  className="modal-input"
                />
                {editPricePkg.code === "STARTER" && (
                  <span className="help-text">Starter package is locked at PKR 0 (free trial).</span>
                )}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Validity (Days) <span className="req">*</span>:</label>
                  <input
                    type="number"
                    value={formValidity}
                    onChange={(e) => setFormValidity(e.target.value)}
                    min={1}
                    max={365}
                    required
                    className="modal-input"
                  />
                </div>
                <div className="form-group">
                  <label>Full Test Attempts <span className="req">*</span>:</label>
                  <input
                    type="number"
                    value={formAttempts}
                    onChange={(e) => setFormAttempts(e.target.value)}
                    min={0}
                    max={500}
                    required
                    className="modal-input"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Reason / Note for Root Admin (Optional):</label>
                <input
                  type="text"
                  placeholder="e.g. Updated attempts for NET-4 intake"
                  value={priceAdminNote}
                  onChange={(e) => setPriceAdminNote(e.target.value)}
                  className="modal-input"
                />
              </div>

              <div className="form-group">
                <label>Your Admin Secret Code <span className="req">*</span>:</label>
                <input
                  type="password"
                  placeholder="Enter ADM-XXXX-XXXX"
                  value={priceSecretCode}
                  onChange={(e) => setPriceSecretCode(e.target.value)}
                  required
                  className="modal-input"
                  autoFocus
                />
              </div>

              <div className="modal-buttons-row">
                <button type="submit" className="btn-confirm-verify" disabled={savingPrice}>
                  {savingPrice ? <FaSpinner className="spin" /> : "Submit for Root Admin Approval 🚀"}
                </button>
                <button type="button" className="btn-cancel" onClick={() => setEditPricePkg(null)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── EDIT DETAILS & FEATURES MODAL (CHECKBOX LIST) ──────────────────── */}
      {editDetailPkg && (
        <div className="admin-modal-overlay" onClick={() => setEditDetailPkg(null)}>
          <div className="admin-modal-card modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <div>
                <h2>Select Package Features & Content</h2>
                <p>Package: <strong>{editDetailPkg.name} ({editDetailPkg.code})</strong></p>
              </div>
              <button className="modal-close" onClick={() => setEditDetailPkg(null)}><FaTimes /></button>
            </div>

            <form onSubmit={handleSubmitDetails} className="admin-modal-body">
              {detailError && (
                <div className="admin-alert admin-alert-danger">
                  <FaExclamationTriangle />
                  <span>{detailError}</span>
                </div>
              )}

              <div className="security-notice-box">
                <FaShieldAlt />
                <span>
                  Check or uncheck the features you want included in this plan.
                  Changes require <strong>Root Admin approval</strong> before going live.
                </span>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Package Display Name <span className="req">*</span>:</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    required
                    className="modal-input"
                  />
                </div>
                <div className="form-group">
                  <label>Badge Text (e.g. Recommended):</label>
                  <input
                    type="text"
                    placeholder="e.g. Most Popular"
                    value={formBadgeText}
                    onChange={(e) => setFormBadgeText(e.target.value)}
                    className="modal-input"
                  />
                </div>
              </div>

              {/* ── CHECKBOX FEATURE SELECTOR ───────────────────────────────── */}
              <div className="form-group">
                <div className="features-select-header">
                  <label>Included Features Checklist ({selectedFeatures.length} enabled):</label>
                  <span className="features-hint">Check or uncheck to toggle features</span>
                </div>

                <div className="features-checkbox-grid">
                  {featureOptions.map((feat, idx) => {
                    const isChecked = selectedFeatures.includes(feat);
                    return (
                      <label
                        key={idx}
                        className={`feature-checkbox-item ${isChecked ? "feature-checked" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleFeature(feat)}
                        />
                        <span className="feature-item-text">{feat}</span>
                        {isChecked && <FaCheck className="feature-checked-icon" />}
                      </label>
                    );
                  })}
                </div>

                {/* Add Custom Feature Row */}
                <div className="custom-feature-add-row">
                  <input
                    type="text"
                    placeholder="Type custom feature and click Add..."
                    value={customFeatureInput}
                    onChange={(e) => setCustomFeatureInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddCustomFeature();
                      }
                    }}
                    className="modal-input custom-input"
                  />
                  <button
                    type="button"
                    className="btn-add-feature"
                    onClick={handleAddCustomFeature}
                  >
                    <FaPlus /> Add Feature
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label>Reason / Note for Root Admin (Optional):</label>
                <input
                  type="text"
                  placeholder="e.g. Added Vector Bot AI mentor to this package"
                  value={detailAdminNote}
                  onChange={(e) => setDetailAdminNote(e.target.value)}
                  className="modal-input"
                />
              </div>

              <div className="form-group">
                <label>Your Admin Secret Code <span className="req">*</span>:</label>
                <input
                  type="password"
                  placeholder="Enter ADM-XXXX-XXXX"
                  value={detailSecretCode}
                  onChange={(e) => setDetailSecretCode(e.target.value)}
                  required
                  className="modal-input"
                />
              </div>

              <div className="modal-buttons-row">
                <button type="submit" className="btn-confirm-verify" disabled={savingDetails}>
                  {savingDetails ? <FaSpinner className="spin" /> : "Submit for Root Admin Approval 🚀"}
                </button>
                <button type="button" className="btn-cancel" onClick={() => setEditDetailPkg(null)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── ROOT ADMIN APPROVE / REJECT MODAL ─────────────────────────────── */}
      {activeRequestModal && (
        <div className="admin-modal-overlay" onClick={() => setActiveRequestModal(null)}>
          <div className="admin-modal-card modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2>
                {activeRequestModal.action === "approve" ? "✅ Approve Package Change" : "❌ Reject Package Change"}
              </h2>
              <button className="modal-close" onClick={() => setActiveRequestModal(null)}><FaTimes /></button>
            </div>

            <div className="admin-modal-body">
              {actionModalError && (
                <div className="admin-alert admin-alert-danger">
                  <FaExclamationTriangle />
                  <span>{actionModalError}</span>
                </div>
              )}

              <p className="modal-confirm-text">
                {activeRequestModal.action === "approve" ? (
                  <>
                    Are you sure you want to approve changes for <strong>{activeRequestModal.request.packageName}</strong>?
                    These changes will immediately become live in the student catalog.
                  </>
                ) : (
                  <>
                    Are you sure you want to reject this request for <strong>{activeRequestModal.request.packageName}</strong>?
                    The package will remain unchanged.
                  </>
                )}
              </p>

              <div className="form-group">
                <label>Root Admin Note (Optional message to submitting admin):</label>
                <textarea
                  rows={3}
                  placeholder="e.g. Approved with standard limits."
                  value={rootAdminNote}
                  onChange={(e) => setRootAdminNote(e.target.value)}
                  className="modal-textarea"
                />
              </div>

              <div className="modal-buttons-row">
                <button
                  type="button"
                  className={activeRequestModal.action === "approve" ? "btn-confirm-verify" : "btn-cancel"}
                  style={activeRequestModal.action === "reject" ? { background: "#dc2626", color: "#fff" } : {}}
                  disabled={processingAction}
                  onClick={handleRootAdminAction}
                >
                  {processingAction ? (
                    <FaSpinner className="spin" />
                  ) : activeRequestModal.action === "approve" ? (
                    "Confirm & Apply Live ✅"
                  ) : (
                    "Confirm Reject ❌"
                  )}
                </button>
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setActiveRequestModal(null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── QUICK ACTION DIALOG (Toggle or Recommended) ───────────────────── */}
      {quickAction && (
        <div className="admin-modal-overlay" onClick={() => setQuickAction(null)}>
          <div className="admin-modal-card modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2>
                <FaShieldAlt /> Confirm Admin Action
              </h2>
              <button className="modal-close" onClick={() => setQuickAction(null)}><FaTimes /></button>
            </div>

            <form onSubmit={handleExecuteQuickAction} className="admin-modal-body">
              {quickError && (
                <div className="admin-alert admin-alert-danger">
                  <FaExclamationTriangle />
                  <span>{quickError}</span>
                </div>
              )}

              <p className="quick-action-text">
                {quickAction.type === "toggle" ? (
                  <>
                    Toggle status for <strong>{quickAction.pkg.name}</strong> from{" "}
                    <strong>{quickAction.pkg.isActive ? "ACTIVE" : "DISABLED"}</strong> to{" "}
                    <strong>{quickAction.pkg.isActive ? "DISABLED" : "ACTIVE"}</strong>.
                  </>
                ) : (
                  <>
                    Mark <strong>{quickAction.pkg.name}</strong> as the official <strong>Recommended</strong> package.
                    All other packages will lose this badge.
                  </>
                )}
              </p>

              <div className="form-group">
                <label>Admin Secret Code <span className="req">*</span>:</label>
                <input
                  type="password"
                  placeholder="Enter ADM-XXXX-XXXX"
                  value={quickSecretCode}
                  onChange={(e) => setQuickSecretCode(e.target.value)}
                  required
                  className="modal-input"
                  autoFocus
                />
              </div>

              <div className="modal-buttons-row">
                <button type="submit" className="btn-confirm-verify" disabled={executingQuick}>
                  {executingQuick ? <FaSpinner className="spin" /> : "Confirm Action"}
                </button>
                <button type="button" className="btn-cancel" onClick={() => setQuickAction(null)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
