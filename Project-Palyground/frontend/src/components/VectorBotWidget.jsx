import { useState, useRef, useEffect } from "react";
import { FaPaperPlane, FaTimes } from "react-icons/fa";
import ReactMarkdown from "react-markdown";
import API from "../utils/api";
import "./VectorBotWidget.css";

const QUICK_PROMPTS = [
  "⚡ Physics Formula Sheet",
  "📐 Maths Integration Shortcut",
  "🧪 Chemistry Core Concepts",
  "⏱️ Entrace.pk Time Strategy",
];

const STORAGE_KEY = "vectorbot_chat_history";

const OCEAN_THEME = {
  "--bot-gradient": "linear-gradient(125deg,#063c56 0%,#087f8a 56%,#11a9ac 100%)",
  "--bot-accent": "#ffd16a", "--bot-accent-dark": "#f49a37", "--bot-panel": "#f1fbfc",
  "--bot-soft": "#e1f5f7", "--bot-border": "#bee6e8", "--bot-user": "#087d8a", "--bot-text": "#183d4b",
};

const defaultWelcome = (name) => ({
  id: "welcome",
  sender: "bot",
  text: `Hello ${name || "Aspirant"}! 🎯 I am **Vector Bot**, your 24/7 Entrace.pk Study Mentor.\n\nI can help you with formula shortcuts, exam timing strategies, and subject doubts (Maths, Physics, Chemistry, CS, English).\n\nWhat would you like to review today?`,
});

export default function VectorBotWidget({ user }) {
  const [isOpen, setIsOpen] = useState(false);
  const userName = user?.name?.split(" ")[0] || "Aspirant";

  // Feature gate: hide Vector Bot entirely if not in user's plan
  const hasVectorBotAccess = user?.features?.vectorBot !== false;
  if (!hasVectorBotAccess) return null;

  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn("Failed to load chat history:", e);
    }
    return [defaultWelcome(userName)];
  });

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Persist chat history
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-50)));
    } catch (e) {
      console.warn("Failed to persist chat history:", e);
    }
  }, [messages]);

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
        text: res.data.reply || "Vector Bot is ready to help you excel on Entrace.pk!",
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      console.error("Vector Bot communication error:", err);
      const errorMsg = {
        id: crypto.randomUUID(),
        sender: "bot",
        text: "🎯 I'm having trouble connecting right now. Please make sure you are logged in and try again in a moment!",
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

  return (
    <div className="vector-bot-container" style={OCEAN_THEME}>
      {!isOpen && (
        <button
          type="button"
          className="vector-bot-launcher"
          onClick={() => setIsOpen(true)}
          title="Open Vector Bot (AI Entrace.pk Mentor)"
        >
          <div className="vector-bot-icon-badge"><span className="vector-bot-face"><i></i><i></i></span></div>
          <span className="vector-bot-label"><strong>Ask Vector</strong><small>Your study co-pilot</small></span>
          <span className="vector-bot-spark">✦</span>
          <span className="vector-bot-pulse" />
        </button>
      )}

      {isOpen && (
        <div className="vector-bot-window">
          <header className="vector-bot-header">
            <div className="vector-bot-title-area">
              <div className="vector-bot-avatar"><span className="vector-bot-face"><i></i><i></i></span></div>
              <div>
                <h3>Vector Bot <span className="vector-badge">AI Mentor</span></h3>
                <p>Entrace.pk AI Study Mentor</p>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <button
                type="button"
                className="vector-bot-clear"
                onClick={() => {
                  localStorage.removeItem(STORAGE_KEY);
                  setMessages([defaultWelcome(userName)]);
                }}
                title="Clear chat history"
              >
                Clear
              </button>
              <button
                type="button"
                className="vector-bot-close"
                onClick={() => setIsOpen(false)}
                aria-label="Close Vector Bot"
              >
                <FaTimes />
              </button>
            </div>
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
