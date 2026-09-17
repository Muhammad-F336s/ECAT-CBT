import { useState, useEffect } from "react";
import {
  FaFileInvoiceDollar,
  FaCheckCircle,
  FaTimesCircle,
  FaClock,
  FaSearch,
  FaFilter,
  FaDownload,
  FaEye,
  FaShieldAlt,
  FaSpinner,
  FaExclamationTriangle,
  FaTimes,
  FaCopy,
  FaCheck,
  FaUserPlus,
  FaTrash,
  FaBell,
} from "react-icons/fa";
import API from "../utils/api";
import { downloadChallanPdf } from "../utils/challanDownload";
import "./AdminPayments.css";

export default function AdminPayments() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({ awaitingReview: 0, pendingPayment: 0 });
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [packageFilter, setPackageFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Review & Verification Modal
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [adminSecretCode, setAdminSecretCode] = useState("");
  const [actionNote, setActionNote] = useState("");
  const [actionType, setActionType] = useState(""); // "verify" | "reject" | "under_review" | ""
  const [submittingAction, setSubmittingAction] = useState(false);
  const [actionError, setActionError] = useState("");
  const [copiedKey, setCopiedKey] = useState("");

  // Selection & Discard Modal States
  const [selectedOrderIds, setSelectedOrderIds] = useState([]);
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [discardTarget, setDiscardTarget] = useState(null); // { scope: 'single' | 'selected' | 'allPending', orderId, orderIds, order }
  const [discardSecretCode, setDiscardSecretCode] = useState("");
  const [discardSendMessage, setDiscardSendMessage] = useState(true);
  const [discardMessageBody, setDiscardMessageBody] = useState(
    "Dear {student_name} (ID: {student_id}), this is to inform you that our payment receiving credentials have been updated. Kindly generate a new challan for your request as we are discarding your previous challan."
  );
  const [discarding, setDiscarding] = useState(false);
  const [discardError, setDiscardError] = useState("");

  // Manual Package Grant Modal
  const [showGrantModal, setShowGrantModal] = useState(false);
  const [grantStudentEmail, setGrantStudentEmail] = useState("");
  const [grantPackageCode, setGrantPackageCode] = useState("STANDARD");
  const [grantValidityDays, setGrantValidityDays] = useState(30);
  const [grantTestAttempts, setGrantTestAttempts] = useState(20);
  const [grantNote, setGrantNote] = useState("");
  const [grantSecretCode, setGrantSecretCode] = useState("");
  const [granting, setGranting] = useState(false);
  const [grantError, setGrantError] = useState("");

  const toggleSelectOrder = (orderId) => {
    setSelectedOrderIds((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedOrderIds.length === orders.length && orders.length > 0) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(orders.map((o) => o.id));
    }
  };

  const openDiscardModal = (target) => {
    setDiscardTarget(target);
    setDiscardSecretCode("");
    setDiscardError("");
    setDiscardSendMessage(true);
    setDiscardMessageBody(
      "Dear {student_name} (ID: {student_id}), this is to inform you that our payment receiving credentials have been updated. Kindly generate a new challan for your request as we are discarding your previous challan."
    );
    setShowDiscardModal(true);
  };

  const handleConfirmDiscard = async () => {
    if (!discardSecretCode || String(discardSecretCode).trim().length < 4) {
      setDiscardError("Admin secret code is required to authorize discard.");
      return;
    }

    try {
      setDiscarding(true);
      setDiscardError("");

      const payload = {
        secretCode: discardSecretCode.trim(),
        sendMessage: discardSendMessage,
        messageBody: discardMessageBody.trim(),
      };

      if (discardTarget?.scope === "single") {
        payload.orderId = discardTarget.orderId;
      } else if (discardTarget?.scope === "selected") {
        payload.orderIds = discardTarget.orderIds;
      } else if (discardTarget?.scope === "allPending") {
        payload.allPending = true;
      }

      const res = await API.post("/admin/payments/discard", payload);
      setSuccessMsg(res.data.message || "Challan(s) discarded successfully.");
      setShowDiscardModal(false);
      if (selectedOrder) setSelectedOrder(null);
      setSelectedOrderIds([]);
      await loadData();
    } catch (err) {
      console.error("[AdminPayments] Discard error:", err);
      setDiscardError(err.response?.data?.error || "Failed to discard challan(s).");
    } finally {
      setDiscarding(false);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");

      const [ordersRes, countsRes] = await Promise.all([
        API.get("/admin/payments", {
          params: {
            status: statusFilter !== "ALL" ? statusFilter : undefined,
            packageCode: packageFilter !== "ALL" ? packageFilter : undefined,
            search: searchQuery.trim() || undefined,
            limit: 50,
          },
        }),
        API.get("/admin/payments/pending-count"),
      ]);

      setOrders(ordersRes.data.orders || []);
      setCounts(countsRes.data || { awaitingReview: 0, pendingPayment: 0 });
    } catch (err) {
      console.error("[AdminPayments] Load error:", err);
      setError(err.response?.data?.error || "Failed to load payment orders.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter, packageFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadData();
  };

  const copyText = (text, key) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(""), 2000);
  };

  // Open single order modal
  const openOrderModal = async (orderId) => {
    try {
      setModalLoading(true);
      setActionError("");
      setAdminSecretCode("");
      setActionNote("");
      setActionType("");

      const res = await API.get(`/admin/payments/${orderId}`);
      setSelectedOrder(res.data);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load order details.");
    } finally {
      setModalLoading(false);
    }
  };

  // Mark Under Review
  const handleMarkUnderReview = async () => {
    try {
      setSubmittingAction(true);
      setActionError("");

      const res = await API.post(`/admin/payments/${selectedOrder.id}/mark-under-review`);
      setSelectedOrder(res.data.order);
      setSuccessMsg(`Order ${selectedOrder.referenceCode} marked as Under Review.`);
      loadData();
    } catch (err) {
      setActionError(err.response?.data?.error || "Failed to update order status.");
    } finally {
      setSubmittingAction(false);
    }
  };

  // Verify & Activate
  const handleVerifyPayment = async () => {
    if (!adminSecretCode.trim()) {
      setActionError("Please enter your Admin Secret Code to verify this payment.");
      return;
    }

    try {
      setSubmittingAction(true);
      setActionError("");

      const res = await API.post(`/admin/payments/${selectedOrder.id}/verify`, {
        secretCode: adminSecretCode.trim(),
        note: actionNote.trim() || undefined,
      });

      setSelectedOrder(res.data.order);
      setSuccessMsg(
        `✅ Payment verified successfully! Package activated for student ${selectedOrder.user?.email || ""}.`
      );
      setActionType("");
      setAdminSecretCode("");
      loadData();
    } catch (err) {
      setActionError(err.response?.data?.error || "Payment verification failed.");
    } finally {
      setSubmittingAction(false);
    }
  };

  // Reject Payment
  const handleRejectPayment = async () => {
    if (!actionNote || actionNote.trim().length < 10) {
      setActionError("A detailed rejection reason (at least 10 characters) is mandatory.");
      return;
    }

    if (!adminSecretCode.trim()) {
      setActionError("Please enter your Admin Secret Code to reject this payment.");
      return;
    }

    try {
      setSubmittingAction(true);
      setActionError("");

      const res = await API.post(`/admin/payments/${selectedOrder.id}/reject`, {
        secretCode: adminSecretCode.trim(),
        reason: actionNote.trim(),
      });

      setSelectedOrder(res.data.order);
      setSuccessMsg(`❌ Payment rejected. Rejection notice emailed to student.`);
      setActionType("");
      setAdminSecretCode("");
      loadData();
    } catch (err) {
      setActionError(err.response?.data?.error || "Failed to reject payment.");
    } finally {
      setSubmittingAction(false);
    }
  };

  // Download Challan PDF
  const handleDownloadChallan = async (orderId, refCode) => {
    try {
      await downloadChallanPdf(orderId, refCode);
    } catch (err) {
      alert(err.message || "Failed to download PDF challan.");
    }
  };

  // Manual Grant Package
  const handleManualGrant = async (e) => {
    e.preventDefault();
    setGrantError("");

    if (!grantStudentEmail.trim()) {
      setGrantError("Student email is required.");
      return;
    }
    if (!grantSecretCode.trim()) {
      setGrantError("Admin secret code is required.");
      return;
    }

    try {
      setGranting(true);

      // Find user id by email from student list
      const studentsRes = await API.get("/admin/students");
      const found = (studentsRes.data || []).find(
        (s) => s.email.toLowerCase() === grantStudentEmail.trim().toLowerCase()
      );

      if (!found) {
        setGrantError(`No student found with email: ${grantStudentEmail}`);
        return;
      }

      await API.patch(`/admin/students/${found.id}/package`, {
        secretCode: grantSecretCode.trim(),
        packageCode: grantPackageCode,
        validityDays: Number(grantValidityDays),
        testAttempts: Number(grantTestAttempts),
        note: grantNote.trim() || undefined,
      });

      setSuccessMsg(
        `🎁 Package '${grantPackageCode}' successfully granted to ${found.name} (${found.email}) for ${grantValidityDays} days.`
      );
      setShowGrantModal(false);
      setGrantStudentEmail("");
      setGrantSecretCode("");
      setGrantNote("");
      loadData();
    } catch (err) {
      setGrantError(err.response?.data?.error || "Failed to apply manual package grant.");
    } finally {
      setGranting(false);
    }
  };

  return (
    <div className="admin-payments-container">
      {/* Header & Metrics */}
      <div className="admin-payments-header">
        <div>
          <span>Financial Operations & Control</span>
          <h1>Manual Bank Transfer & Payments</h1>
          <p>
            Verify student bank transfer receipts, activate packages, monitor pending challans, and review immutable audit logs.
          </p>
        </div>
        <div className="header-actions-row">
          <button className="btn-manual-grant" onClick={() => setShowGrantModal(true)}>
            <FaUserPlus /> Manual Package Grant
          </button>
          <button
            className="btn-discard-all-pending"
            onClick={() => openDiscardModal({ scope: "allPending" })}
            title="Discard all pending payment challans across all students"
          >
            <FaTrash /> Discard All Pending Challans
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="metrics-grid">
        <div className="metric-card metric-urgent">
          <div className="metric-icon-wrap">
            <FaClock />
          </div>
          <div>
            <span className="metric-label">Awaiting Verification</span>
            <h2 className="metric-val">{counts.awaitingReview}</h2>
            <span className="metric-sub">Receipts uploaded by students</span>
          </div>
        </div>

        <div className="metric-card metric-pending">
          <div className="metric-icon-wrap">
            <FaFileInvoiceDollar />
          </div>
          <div>
            <span className="metric-label">Pending Challans</span>
            <h2 className="metric-val">{counts.pendingPayment}</h2>
            <span className="metric-sub">Unpaid or awaiting receipt</span>
          </div>
        </div>

        <div className="metric-card metric-verified">
          <div className="metric-icon-wrap">
            <FaCheckCircle />
          </div>
          <div>
            <span className="metric-label">Loaded Orders</span>
            <h2 className="metric-val">{orders.length}</h2>
            <span className="metric-sub">Across all statuses</span>
          </div>
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

      {/* Filters Bar */}
      <div className="payments-filter-bar">
        <form onSubmit={handleSearchSubmit} className="search-form">
          <FaSearch className="search-icon" />
          <input
            type="text"
            placeholder="Search by student name, email, reference code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          <button type="submit" className="btn-search">Search</button>
        </form>

        <div className="filter-dropdowns">
          <div className="filter-item">
            <FaFilter className="filter-icon" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="filter-select"
            >
              <option value="ALL">All Statuses</option>
              <option value="RECEIPT_SUBMITTED">Receipt Submitted</option>
              <option value="UNDER_REVIEW">Under Review</option>
              <option value="VERIFIED">Verified & Active</option>
              <option value="PENDING_PAYMENT">Pending Payment</option>
              <option value="REJECTED">Rejected</option>
              <option value="EXPIRED">Expired</option>
            </select>
          </div>

          <div className="filter-item">
            <select
              value={packageFilter}
              onChange={(e) => setPackageFilter(e.target.value)}
              className="filter-select"
            >
              <option value="ALL">All Packages</option>
              <option value="STARTER">Starter</option>
              <option value="BASIC">Basic</option>
              <option value="STANDARD">Standard</option>
              <option value="PREMIUM">Premium</option>
              <option value="PROFILE_CHANGE">Profile Change</option>
            </select>
          </div>
        </div>
      </div>

      {/* Bulk Selection Bar */}
      {selectedOrderIds.length > 0 && (
        <div className="bulk-actions-toolbar">
          <div className="bulk-info">
            <strong>{selectedOrderIds.length}</strong> challan(s) selected
          </div>
          <div className="bulk-buttons">
            <button
              className="btn-discard-bulk"
              onClick={() => openDiscardModal({ scope: "selected", orderIds: selectedOrderIds })}
            >
              <FaTrash /> Discard Selected ({selectedOrderIds.length})
            </button>
            <button
              className="btn-clear-selection"
              onClick={() => setSelectedOrderIds([])}
            >
              Deselect All
            </button>
          </div>
        </div>
      )}

      {/* Orders Table */}
      <div className="payments-table-container">
        {loading ? (
          <div className="table-loading">
            <FaSpinner className="spin" />
            <p>Loading payment orders...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="table-empty">
            <FaFileInvoiceDollar className="empty-icon" />
            <h3>No Payment Orders Found</h3>
            <p>Try adjusting your search or filters.</p>
          </div>
        ) : (
          <table className="payments-table">
            <thead>
              <tr>
                <th style={{ width: "40px", textAlign: "center" }}>
                  <input
                    type="checkbox"
                    checked={selectedOrderIds.length === orders.length && orders.length > 0}
                    onChange={toggleSelectAll}
                    title="Select All"
                  />
                </th>
                <th>Reference Code</th>
                <th>Student</th>
                <th>Package</th>
                <th>Amount</th>
                <th>Transaction ID</th>
                <th>Status</th>
                <th>Issued At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const isAwaiting = ["RECEIPT_SUBMITTED", "UNDER_REVIEW"].includes(order.status);
                const isSelected = selectedOrderIds.includes(order.id);

                return (
                  <tr key={order.id} className={`${isAwaiting ? "row-urgent" : ""} ${isSelected ? "row-selected" : ""}`}>
                    <td style={{ textAlign: "center" }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectOrder(order.id)}
                      />
                    </td>
                    <td>
                      <code className="ref-code-tag">{order.referenceCode}</code>
                    </td>
                    <td>
                      <div className="student-cell">
                        <strong>{order.user?.name || "Unknown Student"}</strong>
                        <span>{order.user?.email}</span>
                      </div>
                    </td>
                    <td>
                      <span className="package-tag">
                        {order.package?.name || order.packageCode}
                      </span>
                    </td>
                    <td>
                      <strong>PKR {order.expectedAmount}</strong>
                    </td>
                    <td>
                      {order.transactionId ? (
                        <code className="trx-tag">{order.transactionId}</code>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td>
                      <span className={`status-badge status-${order.status.toLowerCase()}`}>
                        {order.status}
                      </span>
                    </td>
                    <td>{new Date(order.issuedAt).toLocaleDateString()}</td>
                    <td>
                      <div className="table-actions">
                        <button
                          className={`btn-review ${isAwaiting ? "btn-review-urgent" : ""}`}
                          onClick={() => openOrderModal(order.id)}
                          title="Review & Verify Order"
                        >
                          <FaEye /> {isAwaiting ? "Review Receipt" : "View Details"}
                        </button>
                        <button
                          className="btn-download-icon"
                          onClick={() => handleDownloadChallan(order.id, order.referenceCode)}
                          title="Download Challan PDF"
                        >
                          <FaDownload />
                        </button>
                        <button
                          className="btn-discard-icon"
                          onClick={() => openDiscardModal({ scope: "single", orderId: order.id, order })}
                          title="Discard / Delete this challan"
                        >
                          <FaTrash />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ORDER REVIEW & VERIFICATION MODAL */}
      {selectedOrder && (
        <div className="admin-modal-overlay" onClick={() => setSelectedOrder(null)}>
          <div className="admin-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <div>
                <h2>Payment Order & Receipt Review</h2>
                <p>
                  Reference: <strong>{selectedOrder.referenceCode}</strong> &bull; Status:{" "}
                  <span className={`status-badge status-${selectedOrder.status.toLowerCase()}`}>
                    {selectedOrder.status}
                  </span>
                </p>
              </div>
              <button className="modal-close" onClick={() => setSelectedOrder(null)}>
                <FaTimes />
              </button>
            </div>

            <div className="admin-modal-body">
              {/* Alert inside modal */}
              {actionError && (
                <div className="admin-alert admin-alert-danger">
                  <FaExclamationTriangle />
                  <span>{actionError}</span>
                </div>
              )}

              {/* Order & Student Details Grid */}
              <div className="review-details-grid">
                <div className="detail-box">
                  <span className="box-label">Student Details</span>
                  <h4>{selectedOrder.user?.name}</h4>
                  <p>Email: {selectedOrder.user?.email}</p>
                  <p>CNIC: {selectedOrder.user?.cnic || "Not provided"}</p>
                  <p>Current Package: {selectedOrder.user?.packageType || "None"}</p>
                </div>

                <div className="detail-box">
                  <span className="box-label">Package & Pricing</span>
                  <h4>{selectedOrder.package?.name || selectedOrder.packageCode}</h4>
                  <p>Amount Due: <strong>PKR {selectedOrder.expectedAmount}</strong></p>
                  <p>Purpose: {selectedOrder.purpose}</p>
                  <p>Validity: {selectedOrder.package?.validityDays || selectedOrder.metadata?.validityDays || 0} days</p>
                  <p>Test Attempts: {selectedOrder.package?.testAttempts || selectedOrder.metadata?.testAttempts || 0}</p>
                </div>
              </div>

              {/* Transaction ID Highlight */}
              <div className="trx-highlight-box">
                <div>
                  <span className="trx-label">Bank Transaction ID / Reference:</span>
                  <strong className="trx-value">{selectedOrder.transactionId || "NO TRANSACTION ID SUBMITTED"}</strong>
                </div>
                {selectedOrder.transactionId && (
                  <button
                    className="btn-copy-sm"
                    onClick={() => copyText(selectedOrder.transactionId, "trx")}
                  >
                    {copiedKey === "trx" ? <FaCheck /> : <FaCopy />} {copiedKey === "trx" ? "Copied" : "Copy"}
                  </button>
                )}
              </div>

              {/* Receipt Proof Viewer */}
              <div className="receipt-viewer-section">
                <h4>Payment Proof / Receipt</h4>
                {selectedOrder.receiptProof ? (
                  <div className="receipt-display">
                    {selectedOrder.receiptProof.toLowerCase().endsWith(".pdf") ? (
                      <div className="pdf-proof-box">
                        <FaFileInvoiceDollar className="pdf-icon" />
                        <div>
                          <strong>PDF Receipt Document Attached</strong>
                          <p>Click below to open and verify the full bank PDF document.</p>
                          <a
                            href={`${import.meta.env.VITE_API_URL || "http://localhost:8787/api"}/payment/receipt-file/${selectedOrder.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="btn-open-receipt"
                          >
                            Open PDF Receipt in New Tab
                          </a>
                        </div>
                      </div>
                    ) : (
                      <div className="image-proof-wrap">
                        <img
                          src={`${import.meta.env.VITE_API_URL || "http://localhost:8787/api"}/payment/receipt-file/${selectedOrder.id}`}
                          alt="Student Payment Receipt"
                          className="receipt-image-preview"
                          onError={(e) => {
                            e.target.style.display = "none";
                            e.target.nextSibling.style.display = "block";
                          }}
                        />
                        <div className="img-fallback" style={{ display: "none" }}>
                          <p>Unable to render inline image.</p>
                          <a
                            href={`${import.meta.env.VITE_API_URL || "http://localhost:8787/api"}/payment/receipt-file/${selectedOrder.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="btn-open-receipt"
                          >
                            Open Image Directly
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="no-receipt-box">
                    <p>No receipt file uploaded yet by student.</p>
                  </div>
                )}
              </div>

              {/* Immutable Audit Trail */}
              {selectedOrder.audits && selectedOrder.audits.length > 0 && (
                <div className="audits-timeline">
                  <h4>Audit History</h4>
                  <div className="timeline-items">
                    {selectedOrder.audits.map((a) => (
                      <div key={a.id} className="timeline-item">
                        <span className="timeline-dot" />
                        <div className="timeline-content">
                          <div className="timeline-top">
                            <strong>{a.action}</strong>
                            <span className="timeline-date">
                              {new Date(a.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <p>
                            {a.oldStatus ? `${a.oldStatus} → ` : ""}{a.newStatus || ""} &bull; Admin: {a.adminName || "System"}
                          </p>
                          {a.note && <p className="timeline-note">"{a.note}"</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons & Secret Code Confirmation Box */}
              <div className="review-action-panel">
                {/* Secondary Action: Mark Under Review */}
                {selectedOrder.status === "RECEIPT_SUBMITTED" && !actionType && (
                  <button
                    className="btn-secondary-action"
                    onClick={handleMarkUnderReview}
                    disabled={submittingAction}
                  >
                    Mark as "Under Review"
                  </button>
                )}

                {/* Initial Buttons */}
                {!actionType && (
                  <div className="primary-actions-row">
                    {["RECEIPT_SUBMITTED", "UNDER_REVIEW"].includes(selectedOrder.status) && (
                      <>
                        <button
                          className="btn-action-verify"
                          onClick={() => setActionType("verify")}
                        >
                          <FaCheckCircle /> Verify & Activate Package
                        </button>
                        <button
                          className="btn-action-reject"
                          onClick={() => setActionType("reject")}
                        >
                          <FaTimesCircle /> Reject Payment
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      className="btn-action-discard"
                      onClick={() => openDiscardModal({ scope: "single", orderId: selectedOrder.id, order: selectedOrder })}
                      title="Discard / Delete this challan"
                    >
                      <FaTrash /> Discard Challan
                    </button>
                  </div>
                )}

                {/* Verify Confirmation Form */}
                {actionType === "verify" && (
                  <div className="action-confirmation-box box-verify">
                    <h4>
                      <FaShieldAlt /> Confirm Payment Verification & Package Activation
                    </h4>
                    <p>
                      This will transition order to <strong>VERIFIED</strong>, immediately credit test attempts, set expiry date on student account, and send a confirmation email.
                    </p>

                    <div className="form-group">
                      <label>Verification Note (Optional):</label>
                      <input
                        type="text"
                        placeholder="e.g. Verified against Meezan Bank statement"
                        value={actionNote}
                        onChange={(e) => setActionNote(e.target.value)}
                        className="modal-input"
                      />
                    </div>

                    <div className="form-group">
                      <label>
                        Admin Secret Code <span className="req">*</span>:
                      </label>
                      <input
                        type="password"
                        placeholder="Enter your ADM-XXXX-XXXX secret key"
                        value={adminSecretCode}
                        onChange={(e) => setAdminSecretCode(e.target.value)}
                        className="modal-input"
                        autoFocus
                      />
                    </div>

                    <div className="modal-buttons-row">
                      <button
                        className="btn-confirm-verify"
                        onClick={handleVerifyPayment}
                        disabled={submittingAction}
                      >
                        {submittingAction ? <FaSpinner className="spin" /> : "Authorize & Activate Package"}
                      </button>
                      <button
                        className="btn-cancel"
                        onClick={() => { setActionType(""); setActionError(""); }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Reject Confirmation Form */}
                {actionType === "reject" && (
                  <div className="action-confirmation-box box-reject">
                    <h4>
                      <FaTimesCircle /> Confirm Payment Rejection
                    </h4>
                    <p>
                      The student will receive an email explaining why the payment was rejected with your reason below.
                    </p>

                    <div className="form-group">
                      <label>
                        Mandatory Rejection Reason <span className="req">*</span> (min 10 characters):
                      </label>
                      <textarea
                        rows={3}
                        placeholder="e.g. Transaction ID does not match our bank statement. Please verify with your bank."
                        value={actionNote}
                        onChange={(e) => setActionNote(e.target.value)}
                        className="modal-textarea"
                        required
                        autoFocus
                      />
                    </div>

                    <div className="form-group">
                      <label>
                        Admin Secret Code <span className="req">*</span>:
                      </label>
                      <input
                        type="password"
                        placeholder="Enter your ADM-XXXX-XXXX secret key"
                        value={adminSecretCode}
                        onChange={(e) => setAdminSecretCode(e.target.value)}
                        className="modal-input"
                      />
                    </div>

                    <div className="modal-buttons-row">
                      <button
                        className="btn-confirm-reject"
                        onClick={handleRejectPayment}
                        disabled={submittingAction}
                      >
                        {submittingAction ? <FaSpinner className="spin" /> : "Confirm Rejection & Send Email"}
                      </button>
                      <button
                        className="btn-cancel"
                        onClick={() => { setActionType(""); setActionError(""); }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MANUAL PACKAGE GRANT MODAL */}
      {showGrantModal && (
        <div className="admin-modal-overlay" onClick={() => setShowGrantModal(false)}>
          <div className="admin-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <div>
                <h2>Manual Package Grant</h2>
                <p>Grant or override student package access without payment (Support / Trial override).</p>
              </div>
              <button className="modal-close" onClick={() => setShowGrantModal(false)}>
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleManualGrant} className="admin-modal-body">
              {grantError && (
                <div className="admin-alert admin-alert-danger">
                  <FaExclamationTriangle />
                  <span>{grantError}</span>
                </div>
              )}

              <div className="form-group">
                <label>Student Email <span className="req">*</span>:</label>
                <input
                  type="email"
                  placeholder="student@gmail.com"
                  value={grantStudentEmail}
                  onChange={(e) => setGrantStudentEmail(e.target.value)}
                  required
                  className="modal-input"
                />
              </div>

              <div className="form-group">
                <label>Package Tier:</label>
                <select
                  value={grantPackageCode}
                  onChange={(e) => {
                    const c = e.target.value;
                    setGrantPackageCode(c);
                    if (c === "BASIC") { setGrantValidityDays(15); setGrantTestAttempts(7); }
                    else if (c === "STANDARD") { setGrantValidityDays(30); setGrantTestAttempts(20); }
                    else if (c === "PREMIUM") { setGrantValidityDays(60); setGrantTestAttempts(40); }
                    else if (c === "STARTER") { setGrantValidityDays(5); setGrantTestAttempts(2); }
                  }}
                  className="modal-select"
                >
                  <option value="STARTER">Starter (5 days, 2 attempts)</option>
                  <option value="BASIC">Basic (15 days, 7 attempts)</option>
                  <option value="STANDARD">Standard (30 days, 20 attempts)</option>
                  <option value="PREMIUM">Premium (60 days, 40 attempts)</option>
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Validity (Days):</label>
                  <input
                    type="number"
                    value={grantValidityDays}
                    onChange={(e) => setGrantValidityDays(e.target.value)}
                    min={1}
                    max={365}
                    required
                    className="modal-input"
                  />
                </div>
                <div className="form-group">
                  <label>Test Attempts:</label>
                  <input
                    type="number"
                    value={grantTestAttempts}
                    onChange={(e) => setGrantTestAttempts(e.target.value)}
                    min={0}
                    max={500}
                    required
                    className="modal-input"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Reason / Audit Note:</label>
                <input
                  type="text"
                  placeholder="e.g. Free scholarship grant, support ticket #42"
                  value={grantNote}
                  onChange={(e) => setGrantNote(e.target.value)}
                  className="modal-input"
                />
              </div>

              <div className="form-group">
                <label>Admin Secret Code <span className="req">*</span>:</label>
                <input
                  type="password"
                  placeholder="Enter ADM-XXXX-XXXX"
                  value={grantSecretCode}
                  onChange={(e) => setGrantSecretCode(e.target.value)}
                  required
                  className="modal-input"
                />
              </div>

              <div className="modal-buttons-row">
                <button
                  type="submit"
                  className="btn-confirm-verify"
                  disabled={granting}
                >
                  {granting ? <FaSpinner className="spin" /> : "Apply Manual Grant"}
                </button>
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setShowGrantModal(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DISCARD / DELETE CHALLAN MODAL */}
      {showDiscardModal && (
        <div className="admin-modal-overlay" onClick={() => !discarding && setShowDiscardModal(false)}>
          <div className="admin-modal-card discard-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header discard-modal-header">
              <div>
                <h2>
                  <FaTrash className="header-trash-icon" /> Discard Payment Challan(s)
                </h2>
                <p>
                  Permanently remove outdated challan(s) so students can generate fresh challans with updated bank details.
                </p>
              </div>
              <button
                className="modal-close"
                onClick={() => !discarding && setShowDiscardModal(false)}
                disabled={discarding}
              >
                <FaTimes />
              </button>
            </div>

            <div className="admin-modal-body">
              {discardError && (
                <div className="admin-alert admin-alert-danger">
                  <FaExclamationTriangle />
                  <span>{discardError}</span>
                </div>
              )}

              {/* Target Summary Box */}
              <div className="discard-target-summary">
                <span className="summary-label">Target Scope:</span>
                {discardTarget?.scope === "single" && (
                  <div className="target-details">
                    <p>
                      Reference: <strong><code>{discardTarget.order?.referenceCode || discardTarget.orderId}</code></strong>
                    </p>
                    <p>
                      Student: <strong>{discardTarget.order?.user?.name || "Student"}</strong> ({discardTarget.order?.user?.email})
                    </p>
                    <p>
                      Amount: <strong>PKR {discardTarget.order?.expectedAmount}</strong> &bull; Package: {discardTarget.order?.package?.name || discardTarget.order?.packageCode}
                    </p>
                  </div>
                )}
                {discardTarget?.scope === "selected" && (
                  <div className="target-details">
                    <p>
                      <strong>{discardTarget.orderIds?.length} Selected Challan(s)</strong> will be discarded simultaneously.
                    </p>
                  </div>
                )}
                {discardTarget?.scope === "allPending" && (
                  <div className="target-details">
                    <p className="urgent-text">
                      <strong>ALL PENDING CHALLANS:</strong> Every unpaid/pending challan across all students will be discarded immediately.
                    </p>
                  </div>
                )}
              </div>

              {/* Notification Section */}
              <div className="discard-notify-section">
                <label className="checkbox-label-main">
                  <input
                    type="checkbox"
                    checked={discardSendMessage}
                    onChange={(e) => setDiscardSendMessage(e.target.checked)}
                  />
                  <span>
                    <FaBell className="bell-icon" /> Notify affected student(s) via Message Center
                  </span>
                </label>
                <p className="notify-subtext">
                  A high-priority notice will appear on the student's dashboard upon login informing them to generate a new challan.
                </p>

                {discardSendMessage && (
                  <div className="message-template-box">
                    <label className="template-label">Message Content (Editable Template):</label>
                    <textarea
                      rows={4}
                      value={discardMessageBody}
                      onChange={(e) => setDiscardMessageBody(e.target.value)}
                      className="modal-textarea message-template-textarea"
                    />
                    <small className="template-hint">
                      Variables <code>&#123;student_name&#125;</code> and <code>&#123;student_id&#125;</code> are replaced automatically with each student's name and ID.
                    </small>
                  </div>
                )}
              </div>

              {/* Admin Secret Code Verification */}
              <div className="form-group" style={{ marginTop: "18px" }}>
                <label>
                  Admin Secret Code <span className="req">*</span>:
                </label>
                <input
                  type="password"
                  placeholder="Enter your ADM-XXXX-XXXX secret key"
                  value={discardSecretCode}
                  onChange={(e) => setDiscardSecretCode(e.target.value)}
                  className="modal-input"
                  autoFocus
                />
              </div>

              <div className="modal-buttons-row">
                <button
                  type="button"
                  className="btn-confirm-discard"
                  onClick={handleConfirmDiscard}
                  disabled={discarding}
                >
                  {discarding ? <FaSpinner className="spin" /> : "Authorize & Discard Challan(s)"}
                </button>
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setShowDiscardModal(false)}
                  disabled={discarding}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
