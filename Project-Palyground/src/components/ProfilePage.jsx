import { useState } from "react";

const ProfilePage = ({ user, onSave }) => {
  const [formData, setFormData] = useState({
    name: user.name || "",
    email: user.email || "",
    password: "",
    profileImage: "",
  });
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

    try {
      // In a real application, submit updated profile data to the backend.
      // This placeholder simulates a successful update.
      const updates = {
        name: formData.name,
      };
      onSave(updates);
      setMessage("Profile updated successfully.");
    } catch (err) {
      console.error("Profile save failed:", err);
      setError("Unable to save profile details. Please try again.");
    }
  };

  return (
    <div className="profile-page-card">
      <div className="profile-settings-header">
        <div>
          <p className="section-tag">Account</p>
          <h2>Profile & security settings</h2>
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
            placeholder="Enter a new password"
          />
        </div>

        <div className="profile-form-row">
          <label>Profile image URL</label>
          <input
            type="text"
            value={formData.profileImage}
            onChange={handleChange("profileImage")}
            placeholder="Paste an image URL"
          />
        </div>

        <div className="profile-actions">
          <button type="submit" className="action-primary">
            Save changes
          </button>
          <button type="button" className="action-secondary" onClick={() => setFormData({ ...formData, password: "" })}>
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
