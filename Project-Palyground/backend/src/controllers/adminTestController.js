import prisma from "../db.js";
import OpenAI from "openai";

const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

// --- UNIVERSITIES ---

export const getUniversities = async (req, res) => {
  try {
    const unis = await prisma.university.findMany({
      include: { tests: true }
    });
    res.json(unis);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch universities" });
  }
};

export const createUniversity = async (req, res) => {
  try {
    const { name, location, logoUrl } = req.body;
    const uni = await prisma.university.create({
      data: { name, location, logoUrl }
    });
    res.json(uni);
  } catch (error) {
    res.status(500).json({ error: "Failed to create university" });
  }
};

export const updateUniversity = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, location, logoUrl } = req.body;
    const uni = await prisma.university.update({
      where: { id },
      data: { name, location, logoUrl }
    });
    res.json(uni);
  } catch (error) {
    res.status(500).json({ error: "Failed to update university" });
  }
};

export const deleteUniversity = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.university.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete university. Make sure no tests are linked to it first." });
  }
};

// --- TESTS ---

export const getAllTestsAdmin = async (req, res) => {
  try {
    const tests = await prisma.entryExam.findMany({
      include: {
        university: true,
        pattern: true,
      }
    });
    res.json(tests);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch tests" });
  }
};

export const createTest = async (req, res) => {
  try {
    const { name, universityId, examDate, status } = req.body;
    const test = await prisma.entryExam.create({
      data: {
        name,
        universityId,
        examDate: examDate ? new Date(examDate) : null,
        status: status || "DRAFT",
      },
      include: { university: true, pattern: true }
    });
    res.json(test);
  } catch (error) {
    res.status(500).json({ error: "Failed to create test" });
  }
};

export const updateTest = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, universityId, examDate, status } = req.body;
    const test = await prisma.entryExam.update({
      where: { id },
      data: {
        name,
        universityId,
        examDate: examDate ? new Date(examDate) : null,
        status,
      },
      include: { university: true, pattern: true }
    });
    res.json(test);
  } catch (error) {
    res.status(500).json({ error: "Failed to update test" });
  }
};

export const deleteTest = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.entryExam.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete test" });
  }
};

// --- PATTERN AI ---

export const analyzeAndSavePattern = async (req, res) => {
  try {
    const { id } = req.params;
    const { patternText, pastPapersContent } = req.body;

    const prompt = `
You are an expert curriculum analyzer. I will provide you with a raw description of a university entry test pattern and optionally some text extracted from past papers.
Your job is to parse this information and output a strict JSON object that follows this structure:

{
  "totalMarks": (number),
  "totalQuestions": (number),
  "negativeMarking": (number, 0 if none),
  "sections": [
    {
      "subject": "String (e.g., Physics, Biology, Math)",
      "questions": (number of questions for this subject)
    }
  ]
}

Raw Pattern Details:
${patternText}

Past Papers Content (if any):
${pastPapersContent}

Analyze the above data and ONLY return the JSON object. Do not wrap in markdown tags.
`;

    const completion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "openai/gpt-oss-120b",
      response_format: { type: "json_object" },
    });

    const parsedContent = completion.choices[0].message.content;
    const jsonPattern = JSON.parse(parsedContent);

    // Save to database
    const testPattern = await prisma.testPattern.upsert({
      where: { examId: id },
      update: {
        totalMarks: jsonPattern.totalMarks || 0,
        totalQuestions: jsonPattern.totalQuestions || 0,
        negativeMarking: jsonPattern.negativeMarking || 0,
        sections: jsonPattern.sections || [],
        rawPatternText: patternText,
      },
      create: {
        examId: id,
        totalMarks: jsonPattern.totalMarks || 0,
        totalQuestions: jsonPattern.totalQuestions || 0,
        negativeMarking: jsonPattern.negativeMarking || 0,
        sections: jsonPattern.sections || [],
        rawPatternText: patternText,
      }
    });

    // Auto-publish if draft? Or let admin do it? Let's keep it DRAFT so admin can review.

    res.json(testPattern);
  } catch (error) {
    console.error("AI Pattern Error:", error);
    res.status(500).json({ error: "Failed to analyze and save pattern" });
  }
};

export const pauseUniversity = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await prisma.university.update({
      where: { id },
      data: { status: "ARCHIVED" },
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to pause university" });
  }
};

export const resumeUniversity = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await prisma.university.update({
      where: { id },
      data: { status: "PUBLISHED" },
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to resume university" });
  }
};
