import { getFeaturesForPackage } from "../config/featureFlags.js";
import OpenAI from "openai";

// Use Groq Cloud as the LLM provider for the mentor
const groqKeys = [
  process.env.GROQ_API_KEY,
  process.env.GROQ_API_KEY_1,
  process.env.GROQ_API_KEY_2,
].filter(Boolean);

const openai = groqKeys.length > 0
  ? new OpenAI({
      apiKey: groqKeys[0],
      baseURL: "https://api.groq.com/openai/v1",
    })
  : null;

const SYSTEM_PROMPT = `You are Vector Bot (🎯), an intelligent AI Study Mentor and ECAT Entrance Test Assistant integrated into the ECAT-CBT platform.

YOUR Core Mission:
Help ECAT & CBT aspirants achieve top merit ranks in engineering entrance tests (UET, NUST, FAST, GIKI, PIEAS, etc.).

HANDLING PLATFORM/ADMIN COMPLAINTS:
If a student says the admin is not replying, support is slow, they have a problem with the platform, or any platform-related complaint — DO NOT deflect. Instead, respond empathetically and guide them:
- Acknowledge their concern warmly.
- Remind them that the support team reviews tickets regularly and they will receive a reply.
- Suggest they can check their Support page (in the student sidebar) to see ticket status.
- If it is urgent, tell them to submit a new ticket with "URGENT" in the subject.
- Then gently guide them back to studying.

SUBJECT SCOPE: You answer questions related to:
- FSc / ECAT Subjects: Mathematics, Physics, Chemistry, Computer Science, English.
- ECAT Exam Preparation: Formula shortcuts, quick calculations, time management, problem-solving techniques.
- CBT Platform Guidance: How to use practice tests, manage test timers, review analytics, and study mode.
- Platform issues / support questions: Guide them to the Support page or acknowledge their issue.

BOUNDARY ENFORCEMENT:
- If a student asks about movies, sports (cricket, football), songs, gaming, or general chit-chat completely unrelated to studies or the platform, politely decline and redirect to ECAT studies.
- Example: "I focus on ECAT prep and platform help! 🎯 What formula or concept can I help you master today?"

TONE & FORMATTING:
- Empathetic, motivational, clear, structured, and concise.
- Use bullet points, bold key terms, and formula blocks for easy readability.
- Give 2-line direct answers followed by a quick tip whenever applicable.
- Always be warm — students are stressed about exams.`;

export const handleVectorBotChat = async (req, res) => {
  try {
    const { message, conversationHistory = [] } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: "Message content is required." });
    }

    const userQuery = message.trim();

    // Check package feature access
    if (req.auth) {
      const { default: prismaDb } = await import("../db.js");
      const userRecord = await prismaDb.user.findUnique({
        where: { id: req.auth.id },
        select: { packageType: true },
      }).catch(() => null);
      if (userRecord) {
        const features = getFeaturesForPackage(userRecord.packageType);
        if (!features.vectorBot) {
          return res.status(403).json({
            error: "Vector Bot AI Mentor is available in Starter and Premium plans. Please upgrade your package to access this feature.",
            code: "FEATURE_NOT_IN_PLAN",
            feature: "vectorBot",
          });
        }
      }
    }

    // Check if OpenAI key is available for live response
    if (openai) {
      const messages = [
        { role: "system", content: SYSTEM_PROMPT },
        ...conversationHistory.slice(-6).map((msg) => ({
          role: msg.sender === "user" ? "user" : "assistant",
          content: msg.text,
        })),
        { role: "user", content: userQuery },
      ];

      const completion = await openai.chat.completions.create({
        model: "openai/gpt-oss-120b",
        messages,
        temperature: 0.5,
        max_tokens: 600,
      });

      const reply = completion.choices[0]?.message?.content || "Vector Bot is ready to help you excel in ECAT!";
      return res.status(200).json({ reply });
    }

    // Fallback intelligent mentor response engine when API key is not configured in dev
    const reply = generateFallbackMentorResponse(userQuery);
    return res.status(200).json({ reply });
  } catch (error) {
    console.error("Vector Bot chat error:", error);
    return res.status(500).json({
      error: "Vector Bot encountered a temporary hiccup. Please try asking again!",
    });
  }
};

function generateFallbackMentorResponse(query) {
  const q = query.toLowerCase();

  // Non-academic boundary filter fallback
  if (
    q.includes("movie") ||
    q.includes("game") ||
    q.includes("cricket") ||
    q.includes("song") ||
    q.includes("football")
  ) {
    return "I am **Vector Bot**, your dedicated ECAT Study Mentor! 🎯\n\nLet me help you stay on track for your engineering dream. Would you like to review **Physics Formulas**, **Maths Integration Tricks**, or **Time Management** for your next practice test?";
  }

  if (q.includes("physics") || q.includes("coulomb") || q.includes("electrostatics") || q.includes("force")) {
    return "🎯 **Physics Key Insight (Vector Bot Tip):**\n\n- **Coulomb's Law:** $F = k \\frac{|q_1 q_2|}{r^2}$ where $k \\approx 9 \\times 10^9 \\text{ N}\\cdot\\text{m}^2/\\text{C}^2$.\n- **ECAT Speed Trick:** If the distance $r$ is doubled, force becomes **1/4th**. If $r$ is halved, force becomes **4x**!\n\nKeep practicing electrostatics questions in the Targeted Practice Engine!";
  }

  if (q.includes("math") || q.includes("integration") || q.includes("derivative") || q.includes("matrix")) {
    return "🎯 **Mathematics ECAT Trick (Vector Bot Tip):**\n\n- **Integration Shortcut:** $\\int \\frac{f'(x)}{f(x)} dx = \\ln|f(x)| + C$.\n- Whenever the numerator is the exact derivative of the denominator, the answer is directly the natural log of the denominator!\n\nTry applying this rule in your next Calculus practice test!";
  }

  if (q.includes("chemistry") || q.includes("organic") || q.includes("reaction") || q.includes("mole")) {
    return "🎯 **Chemistry Core Concept (Vector Bot Tip):**\n\n- **STP Conditions:** 1 mole of any ideal gas occupies **22.414 dm³ (Liters)** at standard temperature & pressure.\n- Focus heavily on reaction mechanisms and stoichiometry calculations in ECAT Chemistry section!";
  }

  if (q.includes("time") || q.includes("strategy") || q.includes("speed") || q.includes("tips")) {
    return "🎯 **ECAT CBT Time Management Strategy:**\n\n1. **First Pass (30s per Q):** Answer all direct theory & formula questions first.\n2. **Second Pass (60s per Q):** Tackle calculation-based questions.\n3. **Skip & Return:** Don't spend more than 90 seconds on a single question — mark it and return later.\n\nUse our **Targeted Practice Engine** to build your speed under real timer conditions!";
  }

  return `🎯 **Vector Bot Assistance:**\n\nGreat question! To excel in ECAT, always focus on **Core Concepts**, **Formula Speed**, and **Time Management**.\n\nYou can ask me about:\n- 📐 **Physics & Maths Formulas & Tricks**\n- 🧪 **Chemistry & CS Quick Concepts**\n- ⏱️ **CBT Exam Time Strategies**\n\nWhat subject topic should we master next?`;
}
