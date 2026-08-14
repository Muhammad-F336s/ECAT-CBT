import React, { useState, useEffect } from "react";
import axios from "axios";
import "./AdminTestsManagement.css";

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8787/api",
});

API.interceptors.request.use((req) => {
  const token = localStorage.getItem("token");
  if (token) req.headers.Authorization = `Bearer ${token}`;
  return req;
});

export default function AdminTestsManagement() {
  const [activeTab, setActiveTab] = useState("tests"); // 'tests' | 'pattern'
  const [tests, setTests] = useState([]);
  const [universities, setUniversities] = useState([]);
  const [selectedTest, setSelectedTest] = useState(null);
  
  // Modals / Forms state
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [isUniModalOpen, setIsUniModalOpen] = useState(false);
  const [formData, setFormData] = useState({ name: "", universityId: "", examDate: "", status: "DRAFT" });
  const [uniFormData, setUniFormData] = useState({ name: "", location: "", logoUrl: "" });
  const [editingUni, setEditingUni] = useState(null);
  const [resumeModal, setResumeModal] = useState({ open: false, test: null, newDate: "" });
  
  // Pattern state
  const [patternText, setPatternText] = useState("");
  const [loading, setLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    fetchTests();
    fetchUniversities();
  }, []);

  const fetchTests = async () => {
    setLoading(true);
    try {
      const res = await API.get("/admin-tests");
      setTests(res.data);
    } catch (err) {
      console.error(err);
      alert("Failed to load tests");
    } finally {
      setLoading(false);
    }
  };

  const fetchUniversities = async () => {
    try {
      const res = await API.get("/admin-tests/universities");
      setUniversities(res.data);
    } catch (err) {
      console.error(err);
      alert("Failed to load universities");
    }
  };

  const handleSaveTest = async (e) => {
    e.preventDefault();
    try {
      if (selectedTest) {
        await API.put(`/admin-tests/${selectedTest.id}`, formData);
      } else {
        await API.post("/admin-tests", formData);
      }
      setIsTestModalOpen(false);
      fetchTests();
    } catch (err) {
      console.error(err);
      alert("Error saving test");
    }
  };

  const handleSaveUni = async (e) => {
    e.preventDefault();
    try {
      if (editingUni) {
        await API.put(`/admin-tests/universities/${editingUni.id}`, uniFormData);
      } else {
        await API.post("/admin-tests/universities", uniFormData);
      }
      setIsUniModalOpen(false);
      setEditingUni(null);
      fetchUniversities();
    } catch (err) {
      console.error(err);
      alert("Error saving university");
    }
  };

  const handleDeleteUni = async (uni) => {
    if (!window.confirm(`Delete "${uni.name}"? This cannot be undone.`)) return;
    try {
      await API.delete(`/admin-tests/universities/${uni.id}`);
      fetchUniversities();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || "Error deleting university");
    }
  };

  const handleDeleteTest = async (id) => {
    if (!window.confirm("Are you sure you want to delete this test?")) return;
    try {
      await API.delete(`/admin-tests/${id}`);
      fetchTests();
    } catch (err) {
      console.error(err);
      alert("Error deleting test");
    }
  };

  const handlePauseTest = async (test) => {
    if (!window.confirm(`Pause "${test.name}"? Students will no longer see this test.`)) return;
    try {
      await API.put(`/admin-tests/${test.id}`, { ...test, status: "ARCHIVED", universityId: test.universityId });
      fetchTests();
    } catch (err) {
      alert("Error pausing test");
    }
  };

  const handleResumeTest = async () => {
    const { test, newDate } = resumeModal;
    if (!newDate) return alert("Please set the next exam date.");
    try {
      await API.put(`/admin-tests/${test.id}`, {
        name: test.name,
        universityId: test.universityId,
        examDate: newDate,
        status: "PUBLISHED",
      });
      setResumeModal({ open: false, test: null, newDate: "" });
      fetchTests();
    } catch (err) {
      alert("Error resuming test");
    }
  };

  const handleOpenPattern = (test) => {
    setSelectedTest(test);
    setPatternText(test.pattern?.rawPatternText || "");
    setActiveTab("pattern");
  };

  const handleAnalyzePattern = async () => {
    if (!patternText) return alert("Please enter the pattern text.");
    setIsAnalyzing(true);
    try {
      const res = await API.post(`/admin-tests/${selectedTest.id}/pattern`, { patternText });
      alert("Pattern saved successfully!");
      // Update selected test with new pattern
      setSelectedTest(prev => ({ ...prev, pattern: res.data }));
      fetchTests();
    } catch (err) {
      console.error(err);
      alert("Failed to analyze pattern");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="admin-tests-page">
      <div className="admin-tests-header">
        <h1>Test Management</h1>
        <div className="header-actions">
          <button className="btn-refresh" onClick={() => { fetchTests(); fetchUniversities(); }} disabled={loading} title="Refresh">
            {loading ? "⟳ Refreshing..." : "⟳ Refresh"}
          </button>
          <button className="btn-primary" onClick={() => {
            setSelectedTest(null);
            setFormData({ name: "", universityId: "", examDate: "", status: "DRAFT" });
            setIsTestModalOpen(true);
          }}>+ Add New Test</button>
          <button className="btn-secondary" onClick={() => { setEditingUni(null); setUniFormData({ name: "", location: "", logoUrl: "" }); setIsUniModalOpen(true); }}>+ Add University</button>
        </div>
      </div>

      <div className="tests-tabs">
        <button className={activeTab === "tests" ? "active" : ""} onClick={() => { setActiveTab("tests"); setSelectedTest(null); }}>All Tests</button>
        <button className={activeTab === "universities" ? "active" : ""} onClick={() => { setActiveTab("universities"); setSelectedTest(null); }}>Universities ({universities.length})</button>
        {activeTab === "pattern" && selectedTest && (
          <button className="active">Pattern: {selectedTest.name}</button>
        )}
      </div>

      {activeTab === "tests" && (
        <div className="tests-table-container">
          {tests.length === 0 ? (
            <div className="empty-state-message" style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
              <p style={{ fontSize: '1.1rem', marginBottom: '10px' }}>No tests have been added.</p>
              <button 
                className="btn-primary" 
                onClick={() => {
                  setSelectedTest(null);
                  setFormData({ name: "", universityId: "", examDate: "", status: "DRAFT" });
                  setIsTestModalOpen(true);
                }}
              >
                Tap add test to add one
              </button>
            </div>
          ) : (
            <table className="tests-table">
              <thead>
                <tr>
                  <th>Test Name</th>
                  <th>University</th>
                  <th>Status</th>
                  <th>Pattern Details</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tests.map(test => (
                  <tr key={test.id}>
                    <td>{test.name}</td>
                    <td>{test.university?.name || "N/A"}</td>
                    <td>
                      <span className={`status-badge ${test.status.toLowerCase()}`}>
                        {test.status}
                      </span>
                    </td>
                    <td>
                      {test.pattern ? (
                        <span className="pattern-ok">✅ Setup ({test.pattern.totalMarks} Marks)</span>
                      ) : (
                        <span className="pattern-missing">❌ Missing</span>
                      )}
                    </td>
                    <td className="actions-cell">
                      <button className="btn-action edit" onClick={() => {
                        setSelectedTest(test);
                        setFormData({ name: test.name, universityId: test.universityId || "", examDate: test.examDate ? test.examDate.slice(0, 10) : "", status: test.status });
                        setIsTestModalOpen(true);
                      }}>Edit</button>
                      <button className="btn-action pattern" onClick={() => handleOpenPattern(test)}>Pattern</button>
                      {test.status === "ARCHIVED" ? (
                        <button className="btn-action resume" onClick={() => setResumeModal({ open: true, test, newDate: "" })}>▶ Resume</button>
                      ) : (
                        <button className="btn-action pause" onClick={() => handlePauseTest(test)}>⏸ Pause</button>
                      )}
                      <button className="btn-action delete" onClick={() => handleDeleteTest(test.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === "universities" && (
        <div className="tests-table-container">
          <table className="tests-table uni-table">
            <colgroup>
              <col style={{ width: '35%' }} />
              <col style={{ width: '30%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '20%' }} />
            </colgroup>
            <thead>
              <tr>
                <th>University</th>
                <th>Location</th>
                <th>Tests</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {universities.map(uni => (
                <tr key={uni.id}>
                  <td>
                    <div className="uni-name-cell">
                      {uni.logoUrl ? (
                        <img src={uni.logoUrl} alt="" className="uni-mini-logo" />
                      ) : (
                        <div className="uni-mini-logo-fallback">{uni.name.charAt(0)}</div>
                      )}
                      <span>{uni.name}</span>
                    </div>
                  </td>
                  <td className="muted-cell">{uni.location || '—'}</td>
                  <td>
                    <span className={`tests-count-badge ${uni.tests?.length > 0 ? 'has-tests' : 'no-tests'}`}>
                      {uni.tests?.length || 0}
                    </span>
                  </td>
                  <td className="actions-cell">
                    <button className="btn-action edit" onClick={() => {
                      setEditingUni(uni);
                      setUniFormData({ name: uni.name, location: uni.location || "", logoUrl: uni.logoUrl || "" });
                      setIsUniModalOpen(true);
                    }}>Edit</button>
                    <button className="btn-action delete" onClick={() => handleDeleteUni(uni)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}


      {activeTab === "pattern" && selectedTest && (
        <div className="pattern-editor-container">
          <h2>Configure Pattern for: {selectedTest.name}</h2>

          {selectedTest.pattern ? (
             <div className="pattern-info-card">
               <h3>Current Structure</h3>
               <p><strong>Total Marks:</strong> {selectedTest.pattern.totalMarks}</p>
               <p><strong>Total MCQs:</strong> {selectedTest.pattern.totalQuestions}</p>
               <div className="sections-grid">
                  {selectedTest.pattern.sections.map((sec, idx) => (
                    <div key={idx} className="section-card">
                      <span>{sec.subject}</span>
                      <span>{sec.questions} Qs</span>
                    </div>
                  ))}
               </div>
             </div>
          ) : (
            <div className="pattern-missing-alert">
              This test pattern is not in the db. Please add it below.
            </div>
          )}

          <div className="pattern-input-section">
            <label>Raw Pattern Description (Paste text or syllabus here):</label>
            <textarea 
              rows={8}
              value={patternText}
              onChange={(e) => setPatternText(e.target.value)}
              placeholder="e.g. Physics has 30 questions, Chemistry has 30 questions, Math has 40 questions..."
            />
            
            <div className="file-upload-section">
              <label>Upload Past Papers (Optional, Images/PDFs supported):</label>
              <input type="file" multiple accept="image/*,.pdf" />
              <small>File upload integration pending backend parsing logic.</small>
            </div>

            <button 
              className="btn-primary pattern-btn" 
              onClick={handleAnalyzePattern}
              disabled={isAnalyzing}
            >
              {isAnalyzing ? "Analyzing with AI..." : "Analyze & Save Pattern"}
            </button>
          </div>
        </div>
      )}

      {/* Test Modal */}
      {isTestModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>{selectedTest ? "Edit Test" : "Add New Test"}</h2>
            <form onSubmit={handleSaveTest}>
              <div className="form-group">
                <label>Test Name</label>
                <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div className="form-group">
                <label>University</label>
                <select required value={formData.universityId} onChange={e => setFormData({...formData, universityId: e.target.value})}>
                  <option value="">Select University</option>
                  {universities.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Exam Date</label>
                <input type="date" value={formData.examDate} onChange={e => setFormData({...formData, examDate: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Status</label>
                <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                  <option value="DRAFT">DRAFT</option>
                  <option value="PUBLISHED">PUBLISHED</option>
                  <option value="ARCHIVED">ARCHIVED</option>
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setIsTestModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* University Modal */}
      {isUniModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>{editingUni ? "Edit University" : "Add University"}</h2>
            <form onSubmit={handleSaveUni}>
              <div className="form-group">
                <label>University Name</label>
                <input required type="text" value={uniFormData.name} onChange={e => setUniFormData({...uniFormData, name: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Location</label>
                <input type="text" value={uniFormData.location} onChange={e => setUniFormData({...uniFormData, location: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Logo URL</label>
                <input type="text" placeholder="/uni-logos/some-logo.png" value={uniFormData.logoUrl} onChange={e => setUniFormData({...uniFormData, logoUrl: e.target.value})} />
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setIsUniModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Resume Modal */}
      {resumeModal.open && resumeModal.test && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="resume-modal-header">
              <span className="resume-icon">▶</span>
              <h2>Resume Test</h2>
            </div>
            <p className="resume-modal-desc">
              You are resuming <strong>{resumeModal.test.name}</strong>.<br />
              Please set the next exam date before publishing it again.
            </p>
            <div className="form-group">
              <label>Next Exam Date <span style={{ color: '#ef4444' }}>*</span></label>
              <input
                type="date"
                value={resumeModal.newDate}
                min={new Date().toISOString().split("T")[0]}
                onChange={e => setResumeModal(prev => ({ ...prev, newDate: e.target.value }))}
              />
            </div>
            <div className="modal-actions">
              <button type="button" onClick={() => setResumeModal({ open: false, test: null, newDate: "" })}>Cancel</button>
              <button className="btn-action resume" onClick={handleResumeTest}>▶ Publish & Resume</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
