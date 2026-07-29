import { useState, useRef, useEffect } from "react";
import { FaPaperPlane, FaTimes } from "react-icons/fa";
import ReactMarkdown from "react-markdown";
import API from "../utils/api";
import "./VectorBotWidget.css";

const QUICK_PROMPTS = [
  "⚡ Physics Formula Sheet",
  "📐 Maths Integration Shortcut",
  "🧪 Chemistry Core Concepts",
  "⏱️ ECAT Time Strategy",
];

export default function VectorBotWidget({ user }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: "bot",
      text: `Hello ${user?.name?.split(" ")[0] || "Aspirant"}! 🎯 I am **Vector Bot**, your 24/7 ECAT Study Mentor.\n\nI can help you with formula shortcuts, exam timing strategies, and subject doubts (Maths, Physics, Chemistry, CS, English).\n\nWhat would you like to review today?`,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const checkFeatureFlag = async () => {
      try {
        const res = await API.get("/admin/settings");
        if (res.data && res.data.vectorBotEnabled === false) {
          setEnabled(false);
        }
      } catch (err) {
        console.error("Failed to fetch vector bot config", err);
      }
    };
    checkFeatureFlag();
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (textToSend) => {
    const query = textToSend || input;
    if (!query.trim() || loading) return;

    const userMsg = { id: crypto.randomUUID(), sender: "user", text: query.trim() };
    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput("");
    setLoading(true);

    try {
      const history = messages.map((m) => ({ sender: m.sender, text: m.text }));
      const res = await API.post("/user/vector-bot/chat", {
        message: query.trim(),
        conversationHistory: history,
      });

      const botMsg = {
        id: crypto.randomUUID(),
        sender: "bot",
        text: res.data.reply || "Vector Bot is ready to help you excel in ECAT!",
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      console.error("Vector Bot communication error:", err);
      const errorMsg = {
        id: crypto.randomUUID(),
        sender: "bot",
        text: "🎯 **Vector Bot:** I had a quick connection error. Please try asking again!",
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    handleSendMessage();
  };

  if (!enabled) return null;

  return (
    <div className="vector-bot-container">
      {!isOpen && (
        <button
          type="button"
          className="vector-bot-launcher"
          onClick={() => setIsOpen(true)}
          title="Open Vector Bot (AI ECAT Mentor)"
        >
          <div className="vector-bot-icon-badge">🎯</div>
          <span className="vector-bot-label">Vector Bot</span>
          <span className="vector-bot-pulse" />
        </button>
      )}

      {isOpen && (
        <div className="vector-bot-window">
          <header className="vector-bot-header">
            <div className="vector-bot-title-area">
              <div className="vector-bot-avatar">🎯</div>
              <div>
                <h3>Vector Bot <span className="vector-badge">AI Mentor</span></h3>
                <p>ECAT Direction & Magnitude</p>
              </div>
            </div>
            <button
              type="button"
              className="vector-bot-close"
              onClick={() => setIsOpen(false)}
              aria-label="Close Vector Bot"
            >
              <FaTimes />
            </button>
          </header>

          <div className="vector-bot-body">
            <div className="vector-bot-messages">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`vector-message ${msg.sender === "user" ? "user-message" : "bot-message"}`}
                >
                  {msg.sender === "bot" && <div className="bot-msg-icon">🎯</div>}
                  <div className="message-bubble">
                    {msg.sender === "bot" ? (
                      <ReactMarkdown>{msg.text}</ReactMarkdown>
                    ) : (
                      <p>{msg.text}</p>
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="vector-message bot-message">
                  <div className="bot-msg-icon">🎯</div>
                  <div className="message-bubble loading-bubble">
                    <span className="typing-dot"></span>
                    <span className="typing-dot"></span>
                    <span className="typing-dot"></span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="vector-bot-prompts">
              {QUICK_PROMPTS.map((prompt, index) => (
                <button
                  key={index}
                  type="button"
                  className="quick-prompt-btn"
                  onClick={() => handleSendMessage(prompt)}
                  disabled={loading}
                >
                  {prompt}
                </button>
              ))}
            </div>

            <form onSubmit={handleFormSubmit} className="vector-bot-form">
              <input
                type="text"
                placeholder="Ask Vector Bot a formula, concept or strategy..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={loading}
              />
              <button
                type="submit"
                className="vector-send-btn"
                disabled={!input.trim() || loading}
              >
                <FaPaperPlane />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

