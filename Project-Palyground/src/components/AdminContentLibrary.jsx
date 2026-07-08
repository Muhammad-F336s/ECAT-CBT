import { useEffect, useState } from "react";
import {
  FaPlus,
  FaTrash,
  FaChevronDown,
  FaFilePdf,
  FaFileWord,
  FaFileImage,
  FaFile,
  FaCloudUploadAlt,
  FaTimes,
  FaDownload,
  FaClock,
} from "react-icons/fa";
import API from "../utils/api";
import "./AdminApprovals.css";

export default function AdminContentLibrary() {
  const [contentGroups, setContentGroups] = useState([]);
  const [expandedGroup, setExpandedGroup] = useState(null);
  const [uploadingGroup, setUploadingGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadResources = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await API.get("/resources");
      setContentGroups(res.data || []);
    } catch (err) {
      console.error("Failed to load resource library:", err);
      setError("Unable to load course materials from database. Check backend.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadResources();
  }, []);

  const getFileIcon = (type) => {
    switch (type) {
      case "pdf":
        return <FaFilePdf className="file-icon pdf" />;
      case "word":
        return <FaFileWord className="file-icon word" />;
      case "image":
        return <FaFileImage className="file-icon image" />;
      default:
        return <FaFile className="file-icon" />;
    }
  };

  const getFileType = (filename) => {
    const ext = filename.split(".").pop().toLowerCase();
    if (ext === "pdf") return "pdf";
    if (["doc", "docx", "xlsx", "xls"].includes(ext)) return "word";
    if (["jpg", "jpeg", "png", "gif"].includes(ext)) return "image";
    return "file";
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const handleFileUpload = async (groupId, event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    setError("");
    try {
      for (const file of files) {
        const payload = {
          name: file.name,
          type: getFileType(file.name),
          size: formatFileSize(file.size),
        };
        await API.post(`/resources/groups/${groupId}/files`, payload);
      }
      await loadResources();
    } catch (err) {
      console.error("Failed to upload file:", err);
      setError("Failed to persist file upload on server.");
    } finally {
      setUploadingGroup(null);
    }
  };

  const deleteFile = async (fileId) => {
    if (!window.confirm("Are you sure you want to delete this resource file?")) return;
    setError("");
    try {
      await API.delete(`/resources/files/${fileId}`);
      await loadResources();
    } catch (err) {
      console.error("File deletion failed:", err);
      setError("Unable to delete library file: " + (err.response?.data?.error || err.message));
    }
  };

  const deleteItem = async (itemId) => {
    if (!window.confirm("Are you sure you want to remove this learning item?")) return;
    setError("");
    try {
      await API.delete(`/resources/items/${itemId}`);
      await loadResources();
    } catch (err) {
      console.error("Item deletion failed:", err);
      setError("Unable to delete learning item.");
    }
  };

  const handleCreateGroup = async () => {
    const groupName = window.prompt("Enter name for the new Content Group:");
    if (!groupName || !groupName.trim()) return;
    const desc = window.prompt("Enter optional description for the group:");

    setError("");
    try {
      await API.post("/resources/groups", {
        name: groupName.trim(),
        description: desc?.trim() || "",
      });
      await loadResources();
    } catch (err) {
      console.error("Group creation failed:", err);
      setError("Unable to create resource group.");
    }
  };

  const handleDeleteGroup = async (groupId) => {
    if (!window.confirm("Are you sure you want to delete this resource group? All linked files will be removed.")) return;
    setError("");
    try {
      await API.delete(`/resources/groups/${groupId}`);
      await loadResources();
    } catch (err) {
      console.error("Delete group failed:", err);
      setError("Unable to delete group.");
    }
  };

  const handleAddItem = async (groupId) => {
    const title = window.prompt("Enter title for the learning item:");
    if (!title || !title.trim()) return;
    const scorePoints = window.prompt("Enter points value (number):", "5");

    setError("");
    try {
      await API.post(`/resources/groups/${groupId}/items`, {
        title: title.trim(),
        points: Number(scorePoints) || 5,
      });
      await loadResources();
    } catch (err) {
      console.error("Item creation failed:", err);
      setError("Unable to create learning item.");
    }
  };

  const toggleGroupExpand = (groupId) => {
    setExpandedGroup(expandedGroup === groupId ? null : groupId);
  };

  return (
    <div className="approval-page">
      <header className="approval-header">
        <div>
          <p className="approval-kicker">Learning Resources</p>
          <h1>Content Library</h1>
          <span>
            Upload and manage course materials (PDFs, documents, etc.) for students. Organize content by topics and track downloads.
          </span>
        </div>
        <button type="button" className="approval-refresh-button" onClick={handleCreateGroup}>
          <FaPlus /> Add Group
        </button>
      </header>

      {error && (
        <div className="approval-alert approval-alert--error">
          {error}
          <button type="button" className="approval-alert-close" onClick={() => setError("")}>
            x
          </button>
        </div>
      )}

      {loading ? (
        <div className="approval-empty-state">Loading Content Library database records...</div>
      ) : contentGroups.length ? (
        <div className="content-library-grid">
          {contentGroups.map((group) => (
            <article key={group.id} className="content-group-card">
              <div className="content-group-header">
                <div className="content-group-info">
                  <h2>{group.name}</h2>
                  <p>{group.description || "No description provided."}</p>
                </div>
                <button
                  type="button"
                  className={`content-group-toggle ${expandedGroup === group.id ? "open" : ""}`}
                  onClick={() => toggleGroupExpand(group.id)}
                  aria-label="Toggle group"
                >
                  <FaChevronDown />
                </button>
              </div>

              {expandedGroup === group.id && (
                <div className="content-group-items">
                  {/* Files Section */}
                  <div className="content-files-section">
                    <h3 className="section-title">📁 Learning Materials</h3>

                    {group.files && group.files.length > 0 ? (
                      <div className="files-list">
                        {group.files.map((file) => (
                          <div key={file.id} className="file-item">
                            <div className="file-icon-wrapper">
                              {getFileIcon(file.type)}
                            </div>
                            <div className="file-details">
                              <h4>{file.name}</h4>
                              <div className="file-meta">
                                <span className="file-size">{file.size}</span>
                                <span className="file-separator">•</span>
                                <span className="file-date">
                                  <FaClock /> {file.uploadDate}
                                </span>
                                <span className="file-separator">•</span>
                                <span className="file-downloads">{file.downloads} downloads</span>
                              </div>
                            </div>
                            <div className="file-actions">
                              <button
                                type="button"
                                className="file-action-btn download"
                                title="Download"
                                onClick={() => window.alert("Simulated file download for item: " + file.name)}
                              >
                                <FaDownload />
                              </button>
                              <button
                                type="button"
                                className="file-action-btn delete"
                                onClick={() => deleteFile(file.id)}
                                title="Delete"
                              >
                                <FaTrash />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="empty-files-message">No files uploaded yet</p>
                    )}

                    {uploadingGroup === group.id ? (
                      <div className="file-upload-area">
                        <div className="upload-close">
                          <button
                            type="button"
                            onClick={() => setUploadingGroup(null)}
                            className="upload-close-btn"
                          >
                            <FaTimes />
                          </button>
                        </div>
                        <label className="file-upload-label">
                          <FaCloudUploadAlt className="upload-icon" />
                          <span>Click to upload or drag and drop</span>
                          <small>PDF, DOC, DOCX, XLS, XLSX, JPG, PNG (Max 50MB)</small>
                          <input
                            type="file"
                            multiple
                            accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif"
                            onChange={(e) => handleFileUpload(group.id, e)}
                            style={{ display: "none" }}
                          />
                        </label>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="file-upload-trigger"
                        onClick={() => setUploadingGroup(group.id)}
                      >
                        <FaPlus /> Upload Material
                      </button>
                    )}
                  </div>

                  {/* Learning Items Section */}
                  <div className="content-items-section">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <h3 className="section-title">📚 Learning Items</h3>
                      <button
                        type="button"
                        style={{ background: "none", border: "none", color: "var(--ecat-blue)", cursor: "pointer", fontWeight: "bold", fontSize: "0.85rem" }}
                        onClick={() => handleAddItem(group.id)}
                      >
                        + Add Item
                      </button>
                    </div>
                    <div className="content-items-list">
                      {group.items && group.items.length > 0 ? (
                        group.items.map((item) => (
                          <div key={item.id} className="content-item">
                            <div className="content-item-info">
                              <h4>{item.title}</h4>
                              <span className="content-item-points">{item.points} points</span>
                            </div>
                            <div className="content-item-actions">
                              <button
                                type="button"
                                className="content-item-button content-item-delete"
                                onClick={() => deleteItem(item.id)}
                                title="Delete"
                              >
                                <FaTrash />
                              </button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="empty-items-message">No learning items yet</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="content-group-footer">
                <div className="footer-stats">
                  <span className="stat">
                    <strong>{group.files ? group.files.length : 0}</strong> files
                  </span>
                  <span className="stat">
                    <strong>{group.items ? group.items.length : 0}</strong> items
                  </span>
                </div>
                <div className="content-group-actions">
                  <button
                    type="button"
                    className="content-group-action-btn content-group-delete"
                    title="Delete group"
                    onClick={() => handleDeleteGroup(group.id)}
                  >
                    <FaTrash />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="approval-empty-state">No content groups registered. Click Add Group above to start building the library.</div>
      )}
    </div>
  );
}
