import { useState } from "react";
import {
  FaPlus,
  FaEdit,
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
import "./AdminApprovals.css";

export default function AdminContentLibrary() {
  const [contentGroups, setContentGroups] = useState([
    {
      id: 1,
      name: "English Grammar",
      description: "Core grammar concepts and rules",
      items: [
        { id: 1, title: "Parts of Speech", points: 5 },
        { id: 2, title: "Sentence Structure", points: 4 },
      ],
      files: [
        {
          id: 1,
          name: "Grammar-Basics.pdf",
          type: "pdf",
          size: "2.4 MB",
          uploadDate: "2024-07-01",
          downloads: 45,
        },
        {
          id: 2,
          name: "Verb-Tenses-Guide.pdf",
          type: "pdf",
          size: "1.8 MB",
          uploadDate: "2024-07-02",
          downloads: 32,
        },
      ],
    },
    {
      id: 2,
      name: "Vocabulary Building",
      description: "Word lists and usage patterns",
      items: [
        { id: 1, title: "Academic Vocabulary", points: 5 },
        { id: 2, title: "Common Idioms", points: 4 },
      ],
      files: [
        {
          id: 1,
          name: "Vocabulary-List.xlsx",
          type: "word",
          size: "945 KB",
          uploadDate: "2024-07-01",
          downloads: 28,
        },
      ],
    },
    {
      id: 3,
      name: "Reading Comprehension",
      description: "Passages and comprehension strategies",
      items: [
        { id: 1, title: "Skimming Techniques", points: 3 },
        { id: 2, title: "Critical Reading", points: 5 },
      ],
      files: [
        {
          id: 1,
          name: "Reading-Passages-Collection.pdf",
          type: "pdf",
          size: "5.2 MB",
          uploadDate: "2024-07-03",
          downloads: 67,
        },
        {
          id: 2,
          name: "Comprehension-Strategies.docx",
          type: "word",
          size: "1.1 MB",
          uploadDate: "2024-07-02",
          downloads: 41,
        },
      ],
    },
    {
      id: 4,
      name: "Writing Skills",
      description: "Essay writing and composition",
      items: [
        { id: 1, title: "Essay Structure", points: 5 },
        { id: 2, title: "Paragraph Development", points: 4 },
      ],
      files: [
        {
          id: 1,
          name: "Essay-Templates.pdf",
          type: "pdf",
          size: "1.5 MB",
          uploadDate: "2024-07-01",
          downloads: 55,
        },
      ],
    },
    {
      id: 5,
      name: "Listening & Speaking",
      description: "Oral communication skills",
      items: [
        { id: 1, title: "Accent and Pronunciation", points: 4 },
        { id: 2, title: "Listening Comprehension", points: 5 },
      ],
      files: [
        {
          id: 1,
          name: "Pronunciation-Guide.pdf",
          type: "pdf",
          size: "3.2 MB",
          uploadDate: "2024-07-02",
          downloads: 38,
        },
        {
          id: 2,
          name: "Speaking-Tips.pdf",
          type: "pdf",
          size: "2.1 MB",
          uploadDate: "2024-07-03",
          downloads: 29,
        },
      ],
    },
  ]);

  const [expandedGroup, setExpandedGroup] = useState(null);
  const [uploadingGroup, setUploadingGroup] = useState(null);

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

  const handleFileUpload = (groupId, event) => {
    const files = Array.from(event.target.files || []);
    
    setContentGroups((groups) =>
      groups.map((group) => {
        if (group.id === groupId) {
          const newFiles = files.map((file) => ({
            id: Date.now() + Math.random(),
            name: file.name,
            type: getFileType(file.name),
            size: formatFileSize(file.size),
            uploadDate: new Date().toISOString().split("T")[0],
            downloads: 0,
          }));
          return {
            ...group,
            files: [...(group.files || []), ...newFiles],
          };
        }
        return group;
      }),
    );

    setUploadingGroup(null);
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

  const deleteFile = (groupId, fileId) => {
    setContentGroups((groups) =>
      groups.map((group) =>
        group.id === groupId
          ? {
              ...group,
              files: group.files.filter((f) => f.id !== fileId),
            }
          : group,
      ),
    );
  };

  const deleteItem = (groupId, itemId) => {
    setContentGroups((groups) =>
      groups.map((group) =>
        group.id === groupId
          ? {
              ...group,
              items: group.items.filter((item) => item.id !== itemId),
            }
          : group,
      ),
    );
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
        <button type="button" className="approval-refresh-button">
          <FaPlus /> Add Group
        </button>
      </header>

      <div className="content-library-grid">
        {contentGroups.map((group) => (
          <article key={group.id} className="content-group-card">
            <div className="content-group-header">
              <div className="content-group-info">
                <h2>{group.name}</h2>
                <p>{group.description}</p>
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
                            >
                              <FaDownload />
                            </button>
                            <button
                              type="button"
                              className="file-action-btn delete"
                              onClick={() => deleteFile(group.id, file.id)}
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
                  <h3 className="section-title">📚 Learning Items</h3>
                  <div className="content-items-list">
                    {group.items && group.items.length > 0 ? (
                      group.items.map((item) => (
                        <div key={item.id} className="content-item">
                          <div className="content-item-info">
                            <h4>{item.title}</h4>
                            <span className="content-item-points">{item.points} points</span>
                          </div>
                          <div className="content-item-actions">
                            <button type="button" className="content-item-button" title="Edit">
                              <FaEdit />
                            </button>
                            <button
                              type="button"
                              className="content-item-button content-item-delete"
                              onClick={() => deleteItem(group.id, item.id)}
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
                <button type="button" className="content-group-action-btn" title="Edit group">
                  <FaEdit />
                </button>
                <button type="button" className="content-group-action-btn content-group-delete" title="Delete group">
                  <FaTrash />
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
