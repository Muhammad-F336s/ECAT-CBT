import { useState, useEffect } from "react";
import {
  FaCheckCircle,
  FaCrown,
  FaFileInvoiceDollar,
  FaCopy,
  FaDownload,
  FaClock,
  FaUpload,
  FaHistory,
  FaInfoCircle,
  FaExclamationTriangle,
  FaSpinner,
  FaCheck,
  FaArrowRight,
  FaTimes,
  FaTimesCircle,
  FaLock,
} from "react-icons/fa";
import API from "../utils/api";
import { downloadChallanPdf } from "../utils/challanDownload";
import "./PackagesPage.css";


// Features that are locked per package type (shown dimmed with lock icon)
const PACKAGE_LOCKED_FEATURES = {
  STARTER:  [],
  BASIC:    ["Vector Bot AI Mentor Access", "Advanced Predictive Analytics"],
  STANDARD: ["Vector Bot AI Mentor Access"],
  PREMIUM:  [],
};

// All extra features Starter gets (shown as bonus)
const STARTER_BONUS_FEATURES = [
  "Full Multi-Subject CBT Simulator",
  "Advanced Predictive Analytics",
  "Full Resources & Past Papers Access",
  "Vector Bot AI Mentor Access",
  "Content Library Access",
  "Historical Attempt Breakdown & Review",
];

export default function PackagesPage({ user, onUpdateUser }) {
  const [activeTab, setActiveTab] = useState("plans"); // "plans" | "history"
  const [packages, setPackages] = useState([]);
  const [hasClaimedStarter, setHasClaimedStarter] = useState(false);
  const [bankDetails, setBankDetails] = useState(null);
  const [activeChallan, setActiveChallan] = useState(null);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Payment modal / drawer states
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [transactionId, setTransactionId] = useState("");
  const [receiptFile, setReceiptFile] = useState(null);
  const [copiedKey, setCopiedKey] = useState("");
  const [submittingReceipt, setSubmittingReceipt] = useState(false);
  const [receiptError, setReceiptError] = useState("");

  // Refresh user data & payment state
  const loadData = async () => {
    try {
      setLoading(true);
      setError("");

      const [pkgRes, bankRes, challanRes, historyRes, meRes] = await Promise.all([
        API.get("/payment/packages"),
        API.get("/payment/bank-details"),
        API.get("/payment/active-challan"),
        API.get("/payment/history"),
        API.get("/user/me"),
      ]);

      setPackages(pkgRes.data.packages || []);
      setHasClaimedStarter(pkgRes.data.hasClaimedStarter || false);
      setBankDetails(bankRes.data || null);
      setActiveChallan(challanRes.data.activeChallan || null);
      setPaymentHistory(historyRes.data || []);

      if (meRes.data && onUpdateUser) {
        onUpdateUser(meRes.data);
      }
    } catch (err) {
      console.error("[PackagesPage] Failed to load payment data:", err);
      setError("Failed to load packages and payment information. Please refresh.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const copyToClipboard = (text, key) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(""), 2500);
  };

  // 1. Claim Starter (Free trial PKR 0)
  const handleClaimStarter = async () => {
    try {
      setActionLoading(true);
      setError("");
      setSuccessMsg("");

      const res = await API.post("/payment/generate-challan", {
        packageCode: "STARTER",
      });

      if (res.data.activated) {
        setSuccessMsg(
          "🎉 Starter trial package activated! You now have 5 days of access and 2 full test attempts."
        );
        // Refresh me
        const meRes = await API.get("/user/me");
        if (meRes.data && onUpdateUser) onUpdateUser(meRes.data);
        loadData();
      }
    } catch (err) {
      setError(err.response?.data?.error || "Failed to claim Starter package.");
    } finally {
      setActionLoading(false);
    }
  };

  // 2. Select Paid Package & Initiate Challan
  const handleSelectPackage = async (pkg) => {
    try {
      setActionLoading(true);
      setError("");
      setReceiptError("");
      setSelectedPackage(pkg);

      const res = await API.post("/payment/generate-challan", {
        packageCode: pkg.code,
      });

      const order = res.data.order;
      setActiveChallan(order);
      setShowPaymentModal(true);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to initiate package challan.");
    } finally {
      setActionLoading(false);
    }
  };

  // 3. Download Challan PDF
  const handleDownloadPdf = async (orderId, refCode) => {
    try {
      setActionLoading(true);
      await downloadChallanPdf(orderId, refCode);
    } catch (err) {
      alert(err.message || "Failed to download Challan PDF.");
    } finally {
      setActionLoading(false);
    }
  };

  // 3b. Cancel Active Challan Request
  const handleCancelActiveChallan = async () => {
    if (!activeChallan) return;
    const confirmed = window.confirm(
      `Are you sure you want to cancel Challan ${activeChallan.referenceCode}?\n\nThis will discard your current pending request so you can choose another package or generate a fresh challan.`
    );
    if (!confirmed) return;

    try {
      setActionLoading(true);
      setError("");
      setSuccessMsg("");
      const res = await API.post(`/payment/cancel-challan/${activeChallan.id}`);
      setActiveChallan(null);
      setShowPaymentModal(false);
      setSuccessMsg(res.data?.message || "Challan request cancelled successfully.");
      await loadData();
    } catch (err) {
      console.error("[PackagesPage] Cancel challan error:", err);
      setError(err.response?.data?.error || "Failed to cancel challan request.");
    } finally {
      setActionLoading(false);
    }
  };

  // 4. Submit Receipt Proof
  const handleSubmitReceipt = async (e) => {
    e.preventDefault();
    setReceiptError("");

    if (!transactionId || transactionId.trim().length < 4) {
      setReceiptError("Please enter a valid bank Transaction ID / Reference (at least 4 characters).");
      return;
    }

    if (!receiptFile) {
      setReceiptError("Please select or drop your payment receipt file (JPEG, PNG, or PDF, max 2MB).");
      return;
    }

    if (receiptFile.size > 2 * 1024 * 1024) {
      setReceiptError("Receipt file exceeds the 2MB size limit. Please upload a smaller file.");
      return;
    }

    try {
      setSubmittingReceipt(true);

      const formData = new FormData();
      formData.append("orderId", activeChallan.id);
      formData.append("transactionId", transactionId.trim());
      formData.append("receipt", receiptFile);

      const res = await API.post("/payment/submit-receipt", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setActiveChallan(res.data.order);
      setSuccessMsg(
        "✅ Receipt submitted successfully! Our admin team will verify it shortly. Access will be activated once verified."
      );
      setTransactionId("");
      setReceiptFile(null);
      loadData();
    } catch (err) {
      setReceiptError(err.response?.data?.error || "Failed to submit receipt.");
    } finally {
      setSubmittingReceipt(false);
    }
  };

  // Expiry check
  const now = new Date();
  const isExpired = user?.packageExpiresAt && new Date(user.packageExpiresAt) < now;
  const daysLeft = user?.packageExpiresAt
    ? Math.ceil((new Date(user.packageExpiresAt) - now) / (1000 * 60 * 60 * 24))
    : 0;

  return (
    <div className="packages-container">
      {/* Top Header Card */}
      <div className="packages-header">
        <div className="packages-header-content">
          <div className="packages-badge">
            <FaCrown className="packages-badge-icon" />
            <span>ECAT CBT Preparation Plans</span>
          </div>
          <h1>Choose the Right Plan for Your Success</h1>
          <p>
            Secure, verified manual bank transfer. Access real-feel ECAT simulators, topic-wise practice, and comprehensive progress analytics.
          </p>
        </div>

        {/* Current Student Subscription Status Card */}
        <div className={`current-plan-card ${isExpired ? "plan-expired" : ""}`}>
          <div className="plan-card-status-row">
            <span className="current-plan-label">Current Status</span>
            <span className={`status-pill ${isExpired ? "status-expired" : "status-active"}`}>
              {isExpired ? "Expired" : "Active"}
            </span>
          </div>
          <h3 className="current-plan-name">
            {user?.packageType || "STARTER"} Plan
          </h3>
          <div className="current-plan-stats">
            <div className="plan-stat">
              <span className="stat-label">Remaining Attempts</span>
              <span className="stat-val">{user?.remainingTestAttempts ?? 0}</span>
            </div>
            <div className="plan-stat">
              <span className="stat-label">Validity</span>
              <span className="stat-val">
                {user?.packageExpiresAt
                  ? isExpired
                    ? "Expired"
                    : `${daysLeft} days left`
                  : "No active plan"}
              </span>
            </div>
          </div>
          {isExpired && (
            <div className="plan-expired-warning">
              <FaExclamationTriangle />
              <span>Renew your plan to unlock CBT practice & content.</span>
            </div>
          )}
        </div>
      </div>

      {/* Global Alerts */}
      {error && (
        <div className="packages-alert packages-alert-danger">
          <FaExclamationTriangle />
          <span>{error}</span>
          <button onClick={() => setError("")} className="alert-dismiss-btn">
            <FaTimes />
          </button>
        </div>
      )}
      {successMsg && (
        <div className="packages-alert packages-alert-success">
          <FaCheckCircle />
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg("")} className="alert-dismiss-btn">
            <FaTimes />
          </button>
        </div>
      )}

      {/* Active Pending Challan Alert Banner */}
      {activeChallan && (
        <div className="active-challan-banner">
          <div className="active-challan-left">
            <FaFileInvoiceDollar className="active-challan-icon" />
            <div>
              <h4>
                Active Challan: <strong>{activeChallan.referenceCode}</strong>
              </h4>
              <p>
                Amount Due: <strong>PKR {activeChallan.expectedAmount}</strong> &bull; Status:{" "}
                <span className="challan-status-tag">{activeChallan.status}</span>
              </p>
            </div>
          </div>
          <div className="active-challan-actions">
            <button
              className="btn-download-challan"
              onClick={() => handleDownloadPdf(activeChallan.id, activeChallan.referenceCode)}
              disabled={actionLoading}
            >
              <FaDownload /> Download Challan PDF
            </button>
            <button
              className="btn-open-payment"
              onClick={() => {
                setSelectedPackage(activeChallan.package || { name: activeChallan.packageCode });
                setShowPaymentModal(true);
              }}
            >
              {activeChallan.status === "RECEIPT_SUBMITTED" ? "View Submission" : "Submit Receipt & Pay"}
            </button>
            <button
              type="button"
              className="btn-cancel-challan"
              onClick={handleCancelActiveChallan}
              disabled={actionLoading}
              title="Cancel this challan request"
            >
              <FaTimesCircle /> Cancel Request
            </button>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="packages-tab-bar">
        <button
          className={`tab-btn ${activeTab === "plans" ? "tab-btn-active" : ""}`}
          onClick={() => setActiveTab("plans")}
        >
          <FaCrown /> Available Packages
        </button>
        <button
          className={`tab-btn ${activeTab === "history" ? "tab-btn-active" : ""}`}
          onClick={() => setActiveTab("history")}
        >
          <FaHistory /> Payment History ({paymentHistory.length})
        </button>
      </div>

      {/* TAB 1: PLANS CATALOG */}
      {activeTab === "plans" && (
        <div className="plans-grid">
          {loading ? (
            <div className="loading-state">
              <FaSpinner className="spin" />
              <p>Loading package catalog...</p>
            </div>
          ) : (
            packages.map((pkg) => {
              const isStarter = pkg.code === "STARTER";
              const isRecommended = pkg.isRecommended;

              return (
                <div
                  key={pkg.id}
                  className={`plan-card ${isRecommended ? "plan-card-recommended" : ""}`}
                >
                  {isRecommended && (
                    <div className="recommended-badge">
                      <FaCrown /> Most Popular &bull; Recommended
                    </div>
                  )}

                  <div className="plan-card-header">
                    <h3 className="plan-name">{pkg.name}</h3>
                    <div className="plan-price-block">
                      <span className="currency">PKR</span>
                      <span className="amount">{pkg.price}</span>
                      <span className="duration">/ {pkg.validityDays} days</span>
                    </div>
                    <p className="plan-desc">
                      {isStarter
                        ? "Free one-time trial to experience the real-feel ECAT simulator."
                        : `Complete ${pkg.validityDays}-day access with ${pkg.testAttempts} full mock tests.`}
                    </p>
                  </div>

                  <div className="plan-card-body">
                    <div className="plan-stats-pill">
                      <span><strong>{pkg.testAttempts}</strong> Full CBT Tests</span>
                      <span><strong>{pkg.validityDays}</strong> Days Validity</span>
                    </div>

                    <ul className="plan-features-list">
                      {pkg.features?.map((f, i) => {
                        const isLocked = (PACKAGE_LOCKED_FEATURES[pkg.code] || []).includes(f);
                        return (
                          <li key={i} className={isLocked ? "feature-item-locked" : ""}>
                            {isLocked
                              ? <FaLock className="feature-lock-icon" />
                              : <FaCheck className="feature-check-icon" />}
                            <span>{f}</span>
                            {isLocked && <span className="feature-upgrade-hint">Upgrade</span>}
                          </li>
                        );
                      })}
                    </ul>
                  </div>

                  <div className="plan-card-footer">
                    {isStarter ? (
                      <button
                        className="btn-plan-action btn-starter"
                        onClick={handleClaimStarter}
                        disabled={hasClaimedStarter || actionLoading}
                      >
                        {hasClaimedStarter ? (
                          <>
                            <FaCheck /> Claimed (1-Time Lifetime)
                          </>
                        ) : actionLoading ? (
                          <FaSpinner className="spin" />
                        ) : (
                          "Claim Free Trial (PKR 0)"
                        )}
                      </button>
                    ) : (
                      <button
                        className={`btn-plan-action ${isRecommended ? "btn-primary" : "btn-secondary"}`}
                        onClick={() => handleSelectPackage(pkg)}
                        disabled={actionLoading}
                      >
                        {actionLoading ? (
                          <FaSpinner className="spin" />
                        ) : (
                          <>
                            Select Plan & Pay <FaArrowRight />
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB 2: PAYMENT HISTORY */}
      {activeTab === "history" && (
        <div className="history-table-container">
          {paymentHistory.length === 0 ? (
            <div className="empty-history">
              <FaFileInvoiceDollar className="empty-icon" />
              <h3>No Payment Orders Yet</h3>
              <p>You haven't generated any payment challans. Select a plan above to start.</p>
            </div>
          ) : (
            <table className="history-table">
              <thead>
                <tr>
                  <th>Reference Code</th>
                  <th>Package / Purpose</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Issued Date</th>
                  <th>Transaction ID</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paymentHistory.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <span className="order-ref-code">{order.referenceCode}</span>
                    </td>
                    <td>
                      <strong>{order.package?.name || order.packageCode}</strong>
                      <span className="purpose-tag"> ({order.purpose})</span>
                    </td>
                    <td>
                      <strong>PKR {order.expectedAmount}</strong>
                    </td>
                    <td>
                      <span className={`status-pill status-${order.status.toLowerCase()}`}>
                        {order.status}
                      </span>
                    </td>
                    <td>{new Date(order.issuedAt).toLocaleDateString()}</td>
                    <td>
                      {order.transactionId ? (
                        <span className="order-trx-code">{order.transactionId}</span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td>
                      <button
                        className="btn-table-action"
                        onClick={() => handleDownloadPdf(order.id, order.referenceCode)}
                        title="Download Challan PDF"
                      >
                        <FaDownload /> PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* MANUAL BANK TRANSFER & RECEIPT MODAL */}
      {showPaymentModal && activeChallan && (
        <div className="modal-overlay" onClick={() => setShowPaymentModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>Manual Bank Transfer & Payment</h2>
                <p className="modal-sub">
                  Challan Reference: <strong>{activeChallan.referenceCode}</strong>
                </p>
              </div>
              <button
                className="modal-close-btn"
                onClick={() => setShowPaymentModal(false)}
              >
                <FaTimes />
              </button>
            </div>

            <div className="modal-body">
              {/* Order Summary */}
              <div className="payment-summary-box">
                <div className="summary-item">
                  <span>Package</span>
                  <strong>{selectedPackage?.name || activeChallan.packageCode}</strong>
                </div>
                <div className="summary-item">
                  <span>Amount Due</span>
                  <strong className="summary-amount">PKR {activeChallan.expectedAmount}</strong>
                </div>
                <div className="summary-item">
                  <span>Status</span>
                  <span className={`status-pill status-${activeChallan.status.toLowerCase()}`}>
                    {activeChallan.status}
                  </span>
                </div>
              </div>

              {/* Bank Transfer Details Box */}
              {bankDetails && (
                <div className="bank-details-card">
                  <div className="bank-card-title">
                    <h4>Official Owner Bank Details</h4>
                    <span className="secure-tag">Manual Transfer Only</span>
                  </div>

                  <div className="bank-detail-row">
                    <span className="bank-label">Bank Name:</span>
                    <strong className="bank-val">{bankDetails.bankName}</strong>
                  </div>

                  <div className="bank-detail-row">
                    <span className="bank-label">Account Title:</span>
                    <strong className="bank-val">{bankDetails.accountTitle}</strong>
                  </div>

                  <div className="bank-detail-row bank-detail-copyable">
                    <span className="bank-label">IBAN:</span>
                    <div className="copyable-wrap">
                      <code className="bank-iban">{bankDetails.iban}</code>
                      <button
                        className="btn-copy"
                        onClick={() => copyToClipboard(bankDetails.iban, "iban")}
                      >
                        {copiedKey === "iban" ? <FaCheck /> : <FaCopy />}
                        {copiedKey === "iban" ? "Copied" : "Copy"}
                      </button>
                    </div>
                  </div>

                  {bankDetails.raastId && (
                    <div className="bank-detail-row bank-detail-copyable">
                      <span className="bank-label">Raast ID:</span>
                      <div className="copyable-wrap">
                        <code>{bankDetails.raastId}</code>
                        <button
                          className="btn-copy"
                          onClick={() => copyToClipboard(bankDetails.raastId, "raast")}
                        >
                          {copiedKey === "raast" ? <FaCheck /> : <FaCopy />}
                          {copiedKey === "raast" ? "Copied" : "Copy"}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Mobile Banking / Raast QR Code */}
                  {(activeChallan?.qrCode || bankDetails?.qrCode) && (
                    <div className="bank-qr-container">
                      <div className="bank-qr-box">
                        <img
                          src={activeChallan?.qrCode || bankDetails?.qrCode}
                          alt="Scan to Pay QR Code"
                          className="bank-qr-image"
                        />
                      </div>
                      <div className="bank-qr-info">
                        <div className="bank-qr-badge">⚡ Instant Scan &amp; Pay</div>
                        <h5>Scan with Banking / Raast App</h5>
                        <p>
                          Open <strong>NayaPay, SadaPay, Easypaisa, JazzCash</strong> or your mobile banking app, tap <strong>Scan QR</strong> to autofill payment details.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="bank-download-row">
                    <button
                      type="button"
                      className="btn-modal-pdf"
                      onClick={() => handleDownloadPdf(activeChallan.id, activeChallan.referenceCode)}
                      disabled={actionLoading}
                    >
                      <FaDownload /> Download Official Challan PDF
                    </button>
                    <button
                      type="button"
                      className="btn-modal-cancel"
                      onClick={handleCancelActiveChallan}
                      disabled={actionLoading}
                      title="Cancel this challan request"
                    >
                      <FaTimesCircle /> Cancel Request
                    </button>
                  </div>
                </div>
              )}

              {/* Instructions Callout */}
              <div className="instructions-box">
                <FaInfoCircle className="inst-icon" />
                <div>
                  <strong>Payment Instructions:</strong>
                  <ol>
                    <li>Transfer <strong>PKR {activeChallan.expectedAmount}</strong> to the IBAN above via mobile banking or ATM.</li>
                    <li>Enter Reference <strong>{activeChallan.referenceCode}</strong> in the remarks/purpose.</li>
                    <li>Save the screenshot/receipt and upload below with your Transaction ID.</li>
                    <li>Our admin team will verify it within 2-4 hours and activate your access.</li>
                  </ol>
                </div>
              </div>

              {/* Submission Form */}
              <div className="receipt-form-section">
                <h3>Submit Payment Proof</h3>

                {receiptError && (
                  <div className="packages-alert packages-alert-danger">
                    <FaExclamationTriangle />
                    <span>{receiptError}</span>
                  </div>
                )}

                {activeChallan.status === "RECEIPT_SUBMITTED" || activeChallan.status === "UNDER_REVIEW" ? (
                  <div className="already-submitted-box">
                    <FaClock className="submitted-icon" />
                    <div>
                      <h4>Receipt Already Submitted & Under Review</h4>
                      <p>
                        Transaction ID: <strong>{activeChallan.transactionId}</strong>
                      </p>
                      <p className="submitted-note">
                        Your package will be activated after our admin team verifies your payment. Please do not submit duplicate receipts.
                      </p>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSubmitReceipt} className="receipt-form">
                    <div className="form-group">
                      <label>
                        Bank Transaction ID / Reference Number <span className="req">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 240819123456 or Meezan Ref ID"
                        value={transactionId}
                        onChange={(e) => setTransactionId(e.target.value)}
                        required
                        className="text-input"
                      />
                    </div>

                    <div className="form-group">
                      <label>
                        Upload Payment Receipt / Screenshot <span className="req">*</span> (Max 2MB)
                      </label>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        onChange={(e) => setReceiptFile(e.target.files[0] || null)}
                        required
                        className="file-input"
                      />
                      <span className="help-text">
                        Accepted formats: JPG, PNG, WEBP, PDF (Maximum file size: 2MB)
                      </span>
                    </div>

                    <button
                      type="submit"
                      className="btn-submit-receipt"
                      disabled={submittingReceipt}
                    >
                      {submittingReceipt ? (
                        <>
                          <FaSpinner className="spin" /> Submitting for Review...
                        </>
                      ) : (
                        <>
                          <FaUpload /> Submit Receipt for Admin Review
                        </>
                      )}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
