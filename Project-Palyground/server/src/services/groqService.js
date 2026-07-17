import OpenAI from "openai";
import prisma from "../db.js";

// --- Groq Cloud CONFIGURATION ---
const groqKeys = [
  process.env.GROQ_API_KEY,
  process.env.GROQ_API_KEY_1,
  process.env.GROQ_API_KEY_2,
].filter(Boolean);
let currentKeyIndex = 0;

const groq = new OpenAI({
  apiKey: groqKeys[currentKeyIndex],
  baseURL: "https://api.groq.com/openai/v1",
});

function switchToNextKey() {
  if (currentKeyIndex < groqKeys.length - 1) {
    currentKeyIndex++;
    groq.apiKey = groqKeys[currentKeyIndex];
    console.log(
      `[Groq] Switched to API Key #${currentKeyIndex + 1} due to rate limits.`,
    );
    return true;
  }
  return false;
}

// --- MATH TO LATEX CONVERTER ---
function formatMathToLaTeX(text) {
  if (!text || typeof text !== "string") return text;

  let result = text.replace(/MATH\[(.*?)\]/g, (match, p1) => {
    let latex = p1
      .replace(/\^(\d+)/g, "^{$1}") // x^2 -> x^{2}
      .replace(/\^([a-zA-Z])/g, "^{$1}") // x^n -> x^{n}
      .replace(/sqrt\((.*?)\)/g, "\\sqrt{$1}") // sqrt(x) -> \sqrt{x}
      .replace(/\((.*?)\)\/\((.*?)\)/g, "\\frac{$1}{$2}") // (a)/(b) -> \frac{a}{b}
      .replace(/\*/g, "\\times ") // * -> \times
      .replace(/<=( )?/g, "\\leq ") // <= -> \leq
      .replace(/>=( )?/g, "\\geq ") // >= -> \geq
      .replace(/alpha/g, "\\alpha")
      .replace(/beta/g, "\\beta")
      .replace(/gamma/g, "\\gamma")
      .replace(/theta/g, "\\theta")
      .replace(/pi/g, "\\pi")
      .replace(/int/g, "\\int")
      .replace(/sum/g, "\\sum")
      .replace(/delta/g, "\\Delta")
      .replace(/lambda/g, "\\lambda")
      .replace(/phi/g, "\\phi")
      .replace(/rho/g, "\\rho")
      .replace(/sigma/g, "\\sigma")
      .replace(/inf/g, "\\infty")
      .replace(/->/g, "\\rightarrow ")
      .replace(/([A-Z][a-z]?)(\d+)/g, "$1_{$2}");

    return `$${latex}$`;
  });

  result = result.replace(/(\w+)\^(\d+)/g, (match, p1, p2) => {
    const index = result.indexOf(match);
    const before = result.substring(0, index);
    if ((before.match(/\$/g) || []).length % 2 === 1) return match;
    return `$${p1}^{${p2}}$`;
  });

  return result;
}

// --- Groq (AI) QUESTION GENERATOR ---
export async function generateQuestions(
  field,
  subjects,
  count,
  batchIndex,
  chapters,
  difficulty = 5,
  attemptNumber = 0,
  syllabusType = "mixed",
  newSyllabusPercentage = 50,
) {
  const subjectsString = subjects ? subjects.join(", ") : field;

  let chapterFocus = "";
  if (chapters && chapters.length > 0) {
    const chapterNames = chapters
      .map((c) => `chapter "${c.name}" (${c.subject})`)
      .join(", ");
    chapterFocus = `\n    STRICT FOCUS: Every single question in this batch MUST be exclusively from these specific areas: ${chapterNames}.
    Do NOT generate questions from any other topics outside these areas.`;
  }

  let subjectInstruction = "";
  if (subjects && subjects.length === 1) {
    const mainSubject = subjects[0];
    if (mainSubject === "English") {
      subjectInstruction = `
    - SPECIAL INSTRUCTION FOR ENGLISH: Generate ONE reading comprehension passage (approx 150-200 words) and ${count} questions based on it.
    - Put the passage text ONLY in the "passage" field. 
    - VERY IMPORTANT: Do NOT include any part of the passage in the "questionText" field.
    - If you give multiple questions for the same passage, repeat the EXACT same passage in the "passage" field for each question.`;
    } else {
      subjectInstruction = `
    - SUBJECT: ${mainSubject}. 
    - PROBLEM-SOLVING FOCUS: Prioritize numerical problems, conceptual calculations, and multi-step reasoning. 
    - Avoid simple theoretical definitions; focus on "Find the value of...", "Calculate...", "Which of the following is the result of...".
    - PASSAGE RULE: The "passage" field MUST be null for this subject. Do NOT generate a passage.`;
    }
  }

  let syllabusInstruction = "";
  const normalizedSyllabus = (syllabusType || "").toLowerCase().trim();
  if (normalizedSyllabus === "old" || syllabusType === "Old Syllabus (Batch 2023-2025)") {
    syllabusInstruction =
      "SYLLABUS FOCUS: Strictly follow the Old Punjab Textbook Board (PTB) syllabus used for batches 2023-2025. Do NOT use new 2026 syllabus topics.";
  } else if (normalizedSyllabus === "new" || syllabusType === "New Syllabus (Batch 2026+)") {
    syllabusInstruction =
      "SYLLABUS FOCUS: Strictly follow the New updated Punjab Textbook Board (PTB) syllabus applicable for 2026 and onward. Avoid outdated 2023-2025 topics.";
  } else {
    syllabusInstruction = `SYLLABUS FOCUS: Generate questions using a mixed syllabus: approximately ${newSyllabusPercentage}% from the new 2026 syllabus and the remaining ${100 - newSyllabusPercentage}% from the old 2023-2025 syllabus.`;
  }

  let difficultyInstruction = `DIFFICULTY LEVEL: ${difficulty}/10 (1 is easiest, 10 is most challenging ECAT level).`;
  if (difficulty >= 8) {
    difficultyInstruction += `
      - EXTREME DIFFICULTY ACTIVATED:
      - You MUST create highly complex, multi-step mathematical and scientific problems requiring deep conceptual mastery.
      - DO NOT generate simple formula-plugging questions. The questions should challenge the top 1% of students.`;
  } else if (difficulty >= 5) {
    difficultyInstruction += `
      - MODERATE TO HARD DIFFICULTY:
      - Include standard multi-step calculations and conceptual application questions.`;
  } else {
    difficultyInstruction += `
      - EASY DIFFICULTY:
      - Focus on basic formulas, direct applications, and fundamental concepts.`;
  }

  const prompt = `Generate ${count} ECAT ${subjectsString} questions for Batch #${batchIndex + 1}.
    ${chapterFocus}
    ${subjectInstruction}
    ${syllabusInstruction}
    ${difficultyInstruction}
    
    IMPORTANT: Use MATH[equation] for all mathematical terms. 
    Example: MATH[x^2 + (1)/(2)] instead of LaTeX.
    
    Return exactly ${count} questions in JSON format.`;

  try {
    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: `You are an expert ECAT examiner. Generate high-quality MCQs in JSON format.
          
          JSON SCHEMA:
          {
            "questions": [
              {
                "questionText": "Question using MATH[...]",
                "options": ["Opt 1", "Opt 2", "Opt 3", "Opt 4", "Opt 5"],
                "correctAnswer": 0-4,
                "explanation": "Brief explanation using MATH[...] if needed",
                "trick": "Short shortcut",
                "passage": "Only for English, otherwise null",
                "subject": "${subjectsString}"
              }
            ]
          }
          
          SYSTEM RULES:
          1. CHAIN OF THOUGHT: FOR EVERY QUESTION, first calculate the final numeric answer step-by-step internally in the "explanation" field. 
          2. ACCURACY: DO NOT generate options before calculating the correct answer. 
          3. VALIDATION: Once the answer is calculated, create 5 options. ONE MUST BE the correct answer. 
          4. CONSISTENCY: The "correctAnswer" (0-4) MUST match the index of the calculated answer.
          5. FORMAT: Use MATH[...] for ALL mathematical expressions, formulas, and numbers.
          6. STRICT OUTPUT: ALWAYS return exactly 5 options. If you cannot produce a mathematically sound question with 5 distinct options, do not return the question.
          7. EXPLANATION: The explanation MUST conclude with: "Therefore, the correct answer is option [X]". This ensures your answer index logic is sound.
          8. STRUCTURE: Output valid JSON only.`,
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.1, // Fixed to low temperature for maximum determinism
      response_format: { type: "json_object" },
    });

    let text = response.choices[0].message.content;
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();
    text = text.replace(/\\/g, "\\\\").replace(/\\\\\\\\/g, "\\\\");

    let content;
    try {
      content = JSON.parse(text);
    } catch (parseError) {
      console.error(
        "JSON Parse failed after sanitization. Raw Text Sample:",
        text.substring(0, 100),
      );
      throw parseError;
    }

    let rawQuestions = Array.isArray(content)
      ? content
      : content.questions || Object.values(content)[0];

    if (!Array.isArray(rawQuestions)) rawQuestions = [];

    const validQuestions = rawQuestions
      .filter((q) => {
        const hasText = q.questionText && q.questionText.trim().length > 0;
        const hasOptions = Array.isArray(q.options) && q.options.length === 5;
        const hasAnswer =
          typeof q.correctAnswer === "number" &&
          q.correctAnswer >= 0 &&
          q.correctAnswer <= 4;
        return hasText && hasOptions && hasAnswer;
      })
      .map((q) => ({
        ...q,
        questionText: formatMathToLaTeX(q.questionText),
        options: q.options.map((opt) => formatMathToLaTeX(opt)),
        explanation: formatMathToLaTeX(q.explanation),
        trick: formatMathToLaTeX(q.trick || ""),
      }));

    if (validQuestions.length === 0) {
      throw new Error("No valid questions found in AI response");
    }

    return validQuestions;
  } catch (error) {
    if (error.status === 429 && switchToNextKey()) {
      console.warn(
        `[Groq] Quota exceeded for Key #${currentKeyIndex}. Retrying...`,
      );
      return await generateQuestions(
        field,
        subjects,
        count,
        batchIndex,
        chapters,
        difficulty,
        attemptNumber,
        syllabusType,
        newSyllabusPercentage,
      );
    }
    throw error;
  }
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Retrieve chapter ID or create dummy if missing
async function getOrCreateChapterId(subjectName) {
  let subject = await prisma.subject.findUnique({
    where: { name: subjectName },
  });

  if (!subject) {
    subject = await prisma.subject.create({
      data: { name: subjectName },
    });
  }

  const aiChapterName = `AI_Generated_${subjectName}`;
  let chapter = await prisma.chapter.findFirst({
    where: { name: aiChapterName, subjectId: subject.id },
  });

  if (!chapter) {
    chapter = await prisma.chapter.create({
      data: {
        name: aiChapterName,
        subjectId: subject.id,
      },
    });
  }
  return chapter.id;
}


function validateQuestion(q) {
  if (!q.questionText || typeof q.questionText !== 'string' || q.questionText.trim().length === 0) return false;
  if (!Array.isArray(q.options) || q.options.length !== 5) return false;
  if (typeof q.correctAnswer !== 'number' || q.correctAnswer < 0 || q.correctAnswer > 4) return false;
  if (!q.explanation || typeof q.explanation !== 'string' || q.explanation.trim().length === 0) return false;
  return true;
}

export async function generateAllQuestions(
  field,
  subjects,
  targetCount,
  chapters,
  difficulty,
  syllabusType,
  newSyllabusPercentage,
  targetChapterId = null,
) {
  const totalQuestions = parseInt(targetCount) || 10;
  const batchSize = 10;
  const maxTotalAttempts = totalQuestions * 5; // Increased attempts
  let allQuestions = [];
  const seenTexts = new Set();
  let totalAttempts = 0;

  let consecutiveFailures = 0;

  while (
    allQuestions.length < totalQuestions &&
    totalAttempts < maxTotalAttempts
  ) {
    const remaining = totalQuestions - allQuestions.length;
    const currentRequestedCount = Math.min(batchSize, remaining);
    let newlyAdded = 0;

    try {
      const batch = await generateQuestions(
        field,
        subjects,
        currentRequestedCount,
        Math.floor(allQuestions.length / batchSize),
        chapters,
        difficulty,
        totalAttempts,
        syllabusType,
        newSyllabusPercentage,
      );

      if (batch && batch.length > 0) {
        batch.forEach((q) => {
          if (validateQuestion(q)) {
            const normalized = q.questionText.replace(/\s+/g, "").toLowerCase();
            if (
              allQuestions.length < totalQuestions &&
              !seenTexts.has(normalized)
            ) {
              seenTexts.add(normalized);
              allQuestions.push(q);
              newlyAdded++;
            }
          } else {
            console.warn("[Groq] Generated invalid question, discarding.");
          }
        });
        console.log(
          `[Groq] ${allQuestions.length}/${totalQuestions} valid unique ${subjects.join(", ")} questions collected.`,
        );
      }
    } catch (err) {
      console.warn(`[Groq] Batch generation failed: ${err.message}. Retrying...`);
      await delay(2000);
    }

    if (newlyAdded === 0) {
      consecutiveFailures++;
      if (consecutiveFailures >= 3) { // Reduced failure tolerance
        console.warn(`[Groq] Failed to generate valid questions. Waiting...`);
        await delay(3000);
      }
    } else {
      consecutiveFailures = 0;
    }

    totalAttempts++;
    await delay(500);
  }


  // Formatting and Saving to Prisma Database
  const formattedQuestions = [];
  for (const q of allQuestions) {
    const subjectName = q.subject || subjects[0] || field;
    const chapterId = targetChapterId || await getOrCreateChapterId(subjectName);

    // Create the question with options
    try {
      let finalStatement = q.questionText;
      if (q.passage) {
        finalStatement = `[PASSAGE]\n${q.passage}\n\n${q.questionText}`;
      }

      const savedQuestion = await prisma.question.create({
        data: {
          statement: finalStatement,
          chapterId: chapterId,
          correctAnswer: q.options[q.correctAnswer],
          explanation: `${q.explanation || ""}===TRICK===${q.trick || ""}`,
          options: {
            create: q.options.map((opt) => ({ text: opt })),
          },
        },
        include: { options: true },
      });

      formattedQuestions.push({
        id: savedQuestion.id,
        statement: savedQuestion.statement,
        chapterId: savedQuestion.chapterId,
        options: savedQuestion.options,
      });
    } catch (e) {
      console.error("[Groq] Failed to save AI question to DB:", e.message);
    }
  }

  // Enforce the 1500 questions compute limit rule across the whole questions table
  try {
    const totalCount = await prisma.question.count();
    if (totalCount > 1500) {
      const questionsToDeleteCount = totalCount - 1500;
      const oldestQuestions = await prisma.question.findMany({
        orderBy: { createdAt: "asc" },
        take: questionsToDeleteCount,
        select: { id: true },
      });

      const idsToDelete = oldestQuestions.map((q) => q.id);
      await prisma.question.deleteMany({
        where: { id: { in: idsToDelete } },
      });
      console.log(`[Groq] Cleaned up ${questionsToDeleteCount} old questions to preserve Neon compute limits.`);
    }
  } catch (e) {
    console.error("[Groq] Cleanup failed:", e.message);
  }

  return formattedQuestions;
}
