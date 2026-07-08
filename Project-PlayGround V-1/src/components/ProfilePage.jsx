import { useState } from "react";
import API from "../utils/api";

const ProfilePage = ({ user, onSave }) => {
  const [formData, setFormData] = useState({
    name: user.name || "",
    email: user.email || "",
    password: "",
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleChange = (field) => (event) => {
    setFormData((prev) => ({
      ...prev,
      [field]: event.target.value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setSaving(true);

    try {
      const payload = { name: formData.name };
      if (formData.password.trim()) {
        payload.password = formData.password;
      }

      const res = await API.patch("/user/profile", payload);
      const updatedUser = res.data.user;

      // Sync local state and localStorage
      onSave({ name: updatedUser.name });
      setMessage(res.data.message || "Profile updated successfully.");
      setFormData((prev) => ({ ...prev, password: "" }));
    } catch (err) {
      console.error("Profile save failed:", err);
      setError(
        err.response?.data?.error ||
          "Unable to save profile details. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="profile-page-card">
      <div className="profile-settings-header">
        <div>
          <p className="section-tag">Account</p>
          <h2>Profile &amp; security settings</h2>
          <p className="section-note">
            Use this panel to keep your account secure and your profile current.
          </p>
        </div>
      </div>

      <form className="profile-form" onSubmit={handleSubmit}>
        <div className="profile-form-row">
          <label>Name</label>
          <input
            type="text"
            value={formData.name}
            onChange={handleChange("name")}
            placeholder="Your full name"
          />
        </div>

        <div className="profile-form-row">
          <label>Email</label>
          <input
            type="email"
            value={formData.email}
            onChange={handleChange("email")}
            placeholder="Email address"
            disabled
          />
        </div>

        <div className="profile-form-row">
          <label>New password</label>
          <input
            type="password"
            value={formData.password}
            onChange={handleChange("password")}
            placeholder="Enter a new password (min 6 characters)"
          />
        </div>

        <div className="profile-actions">
          <button type="submit" className="action-primary" disabled={saving}>
            {saving ? "Saving..." : "Save changes"}
          </button>
          <button
            type="button"
            className="action-secondary"
            onClick={() => setFormData({ ...formData, password: "" })}
          >
            Reset password field
          </button>
        </div>

        {message && <div className="message success">{message}</div>}
        {error && <div className="message error">{error}</div>}
      </form>
    </div>
  );
};

export default ProfilePage;
