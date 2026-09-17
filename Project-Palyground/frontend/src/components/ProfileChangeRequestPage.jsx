import { useEffect, useState } from "react";
import API from "../utils/api";
import { downloadChallanPdf } from "../utils/challanDownload";
import "./ProfileChangeRequests.css";

const TRACKS = [
  "Pre-Engineering",
  "Pre-Medical",
  "ICS",
  "ICom",
  "FA",
  "Other / Gap-year",
];

const SUBJECTS = [
  ["math", "Mathematics"],
  ["physics", "Physics"],
  ["chemistry", "Chemistry"],
  ["biology", "Biology"],
  ["english", "English"],
  ["computer", "Computer Science"],
];

const ALLOWED_SUBJECTS = {
  "Pre-Engineering": ["math", "physics", "chemistry", "english"],
  "Pre-Medical": ["biology", "physics", "chemistry", "english"],
  ICS: ["computer", "math", "physics", "english"],
  ICom: ["math", "english"],
  FA: ["english"],
  "Other / Gap-year": ["math", "physics", "chemistry", "biology", "english", "computer"],
};

const labels = (items = []) =>
  items.map((item) => SUBJECTS.find(([id]) => id === item)?.[1] || item).join(", ");

export default function ProfileChangeRequestPage({ user }) {
  const [form, setForm] = useState({
    requestedTrack: user.academicTrack || "",
    requestedSubjects: user.academicSubjects || [],
    reason: "",
    transactionId: "",
    receiptProof: "",
  });

  const [requests, setRequests] = useState([]);
  const [busy, setBusy] = useState(false);
  const [challanBusy, setChallanBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const res = await API.get("/user/profile-change-requests");
      setRequests(res.data);
    } catch {
      setError("Could not load your request history.");
    }
  };

  useEffect(() => { load(); }, []);

  // Download the real PDF challan from the backend
  const downloadChallan = async () => {
    setChallanBusy(true);
    setError("");
    try {
      const res = await API.get("/user/profile-change-challan");
      const challan = res.data?.challan;
      if (!challan?.id) throw new Error("No challan returned from server.");
      await downloadChallanPdf(challan.id, challan.referenceCode);
    } catch (err) {
      setError(
        err.response?.data?.error ||
          err.message ||
          "Unable to download the challan. Please try again."
      );
    } finally {
      setChallanBusy(false);
    }
  };

  const onReceipt = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/") && file.type !== "application/pdf")
      return setError("Upload an image or PDF receipt.");
    if (file.size > 2 * 1024 * 1024) return setError("Receipt must be 2 MB or smaller.");
    const reader = new FileReader();
    reader.onload = () => setForm((x) => ({ ...x, receiptProof: reader.result }));
    reader.readAsDataURL(file);
  };

  const toggle = (id) =>
    setForm((x) => ({
      ...x,
      requestedSubjects: x.requestedSubjects.includes(id)
        ? x.requestedSubjects.filter((s) => s !== id)
        : x.requestedSubjects.length < 5
        ? [...x.requestedSubjects, id]
        : x.requestedSubjects,
    }));

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    try {
      const res = await API.post("/user/profile-change-requests", form);
      setMessage(res.data.message);
      setForm((x) => ({ ...x, reason: "", transactionId: "", receiptProof: "" }));
      await load();
    } catch (err) {
      setError(err.response?.data?.error || "Unable to submit your request.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="profile-change-page">
      <header>
        <span>Academic profile</span>
        <h1>Request a profile change</h1>
        <p>
          Your saved profile is locked. Download the official fee challan, complete
          payment, then submit your transaction details below for admin review.
        </p>
      </header>

      <button
        className="challan-button"
        type="button"
        onClick={downloadChallan}
        disabled={challanBusy}
      >
        {challanBusy ? "Generating challan\u2026" : "Download fee challan (PDF)"}
      </button>

      <form className="change-request-form" onSubmit={submit}>
        <div className="profile-compare">
          <div>
            <small>Current track</small>
            <strong>{user.academicTrack || "Not set"}</strong>
            <p>{labels(user.academicSubjects)}</p>
          </div>
          <div>
            <label>
              Requested track
              <select
                value={form.requestedTrack}
                onChange={(e) =>
                  setForm((x) => ({
                    ...x,
                    requestedTrack: e.target.value,
                    requestedSubjects: x.requestedSubjects.filter((id) =>
                      ALLOWED_SUBJECTS[e.target.value].includes(id)
                    ),
                  }))
                }
              >
                {TRACKS.map((track) => (
                  <option key={track}>{track}</option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <fieldset>
          <legend>Requested subjects (up to five)</legend>
          <div className="request-subjects">
            {SUBJECTS.filter(([id]) =>
              ALLOWED_SUBJECTS[form.requestedTrack]?.includes(id)
            ).map(([id, label]) => (
              <label key={id}>
                <input
                  type="checkbox"
                  checked={form.requestedSubjects.includes(id)}
                  onChange={() => toggle(id)}
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        <label>
          Reason for change
          <textarea
            required
            value={form.reason}
            onChange={(e) => setForm((x) => ({ ...x, reason: e.target.value }))}
            placeholder="Explain why you need this change."
          />
        </label>

        <label>
          Transaction ID <small>(optional when a receipt is uploaded)</small>
          <input
            value={form.transactionId}
            onChange={(e) => setForm((x) => ({ ...x, transactionId: e.target.value }))}
            placeholder="e.g. bank / wallet reference"
          />
        </label>

        <label>
          Payment receipt <small>(optional when a transaction ID is entered)</small>
          <input type="file" accept="image/*,application/pdf" onChange={onReceipt} />
          {form.receiptProof && <small>Receipt attached.</small>}
        </label>

        {error && <p className="request-error">{error}</p>}
        {message && <p className="request-success">{message}</p>}

        <button className="request-primary" disabled={busy}>
          {busy ? "Submitting\u2026" : "Submit change request"}
        </button>
      </form>

      <section className="request-history">
        <h2>Your request history</h2>
        {requests.length === 0 ? (
          <p>No requests submitted yet.</p>
        ) : (
          requests.map((request) => (
            <article key={request.id}>
              <div>
                <strong>{request.requestedTrack}</strong>
                <p>
                  {labels(request.requestedSubjects)} \u00B7 submitted{" "}
                  {new Date(request.createdAt).toLocaleString()}
                </p>
              </div>
              <span
                className={"request-status " + request.status.replaceAll(" ", "-").toLowerCase()}
              >
                {request.status}
              </span>
              {request.adminReason && (
                <p className="admin-reason">Admin note: {request.adminReason}</p>
              )}
              {request.appliedAt && (
                <p className="fulfilled">
                  Fulfilled {new Date(request.appliedAt).toLocaleString()} by{" "}
                  {request.reviewedByName || "admin"}
                </p>
              )}
            </article>
          ))
        )}
      </section>
    </div>
  );
}