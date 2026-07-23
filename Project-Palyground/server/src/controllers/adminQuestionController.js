import prisma from "../db.js";

// 1. Get all subjects and chapters
export const getSubjectsAndChapters = async (req, res) => {
  try {
    const subjects = await prisma.subject.findMany({
      include: {
        chapters: true,
      },
      orderBy: { name: "asc" },
    });
    res.status(200).json(subjects);
  } catch (error) {
    console.error("Get subjects/chapters error:", error);
    res.status(500).json({ error: "Failed to retrieve subjects and chapters." });
  }
};

// 2. Create a new Subject
export const createSubject = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Subject name is required." });
    }

    const nameUpper = name.trim();
    // Duplication check
    const existing = await prisma.subject.findFirst({
      where: { name: { equals: nameUpper, mode: "insensitive" } },
    });
    if (existing) {
      return res.status(400).json({ error: "Subject already exists." });
    }

    const subject = await prisma.subject.create({
      data: { name: nameUpper },
      include: { chapters: true },
    });
    res.status(201).json(subject);
  } catch (error) {
    console.error("Create subject error:", error);
    res.status(500).json({ error: "Failed to create subject." });
  }
};

// 3. Create a new Chapter in a Subject
export const createChapter = async (req, res) => {
  try {
    const { name, subjectId, part } = req.body;
    if (!name || !name.trim() || !subjectId) {
      return res.status(400).json({ error: "Chapter name and Subject ID are required." });
    }

    const chapter = await prisma.chapter.create({
      data: {
        name: name.trim(),
        subjectId,
        part: part || null,
      },
    });
    res.status(201).json(chapter);
  } catch (error) {
    console.error("Create chapter error:", error);
    res.status(500).json({ error: "Failed to create chapter." });
  }
};

// 4. Fetch questions list (supports optional filtering by subject or chapter)
export const listQuestions = async (req, res) => {
  try {
    const { subjectId, chapterId, search } = req.query;

    const where = { isApproved: true }; // Only return approved questions in the main list
    if (chapterId) {
      where.chapterId = chapterId;
    } else if (subjectId) {
      where.chapter = { subjectId };
    }

    if (search && search.trim()) {
      where.statement = {
        contains: search.trim(),
        mode: "insensitive",
      };
    }

    const questions = await prisma.question.findMany({
      where,
      include: {
        options: true,
        chapter: {
          include: {
            subject: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100, // Safe limit for pagination
    });

    res.status(200).json(questions);
  } catch (error) {
    console.error("List questions error:", error);
    res.status(500).json({ error: "Failed to retrieve questions pool." });
  }
};

// 5. Create a new MCQ Question with 5 options
export const createQuestion = async (req, res) => {
  try {
    const { statement, chapterId, options, correctAnswer, explanation } = req.body;

    if (!statement || !chapterId || !options || !Array.isArray(options) || options.length !== 5 || correctAnswer === undefined) {
      return res.status(400).json({
        error: "All fields are required. Please provide a statement, chapterId, exactly 5 options, and the correctAnswer index (0-4).",
      });
    }

    const correctText = options[correctAnswer];
    if (!correctText) {
      return res.status(400).json({ error: "Invalid correctAnswer index." });
    }

    const question = await prisma.question.create({
      data: {
        statement: statement.trim(),
        chapterId,
        correctAnswer: correctText.trim(),
        explanation: explanation || "",
        options: {
          create: options.map(opt => ({ text: opt.trim() })),
        },
      },
      include: {
        options: true,
        chapter: {
          include: {
            subject: true,
          },
        },
      },
    });

    res.status(201).json(question);
  } catch (error) {
    console.error("Create question error:", error);
    res.status(500).json({ error: "Failed to create question." });
  }
};

// 6. Update question and option values
export const updateQuestion = async (req, res) => {
  try {
    const { questionId } = req.params;
    const { statement, chapterId, options, correctAnswer, explanation } = req.body;

    // Verify question exists
    const existing = await prisma.question.findUnique({
      where: { id: questionId },
      include: { options: true },
    });

    if (!existing) {
      return res.status(404).json({ error: "Question not found." });
    }

    const data = {};
    if (statement) data.statement = statement.trim();
    if (chapterId) data.chapterId = chapterId;
    if (explanation !== undefined) data.explanation = explanation;

    if (options && Array.isArray(options) && options.length === 5) {
      // Re-create options by dropping old ones and writing new ones
      await prisma.option.deleteMany({ where: { questionId } });
      data.options = {
        create: options.map(opt => ({ text: opt.trim() })),
      };

      if (correctAnswer !== undefined) {
        const correctText = options[correctAnswer];
        if (!correctText) {
          return res.status(400).json({ error: "Invalid correctAnswer index." });
        }
        data.correctAnswer = correctText.trim();
      }
    } else if (correctAnswer !== undefined) {
      // Just updating correct answer indexes of existing options list
      const targetOpt = existing.options[correctAnswer];
      if (!targetOpt) {
        return res.status(400).json({ error: "Invalid correctAnswer index." });
      }
      data.correctAnswer = targetOpt.text;
    }

    const updated = await prisma.question.update({
      where: { id: questionId },
      data,
      include: {
        options: true,
        chapter: {
          include: {
            subject: true,
          },
        },
      },
    });

    res.status(200).json(updated);
  } catch (error) {
    console.error("Update question error:", error);
    res.status(500).json({ error: "Failed to update question details." });
  }
};

// 7. Delete question
export const deleteQuestion = async (req, res) => {
  try {
    const { questionId } = req.params;
    await prisma.question.delete({
      where: { id: questionId },
    });
    res.status(200).json({ message: "Question deleted successfully." });
  } catch (error) {
    console.error("Delete question error:", error);
    res.status(500).json({ error: "Failed to delete question." });
  }
};

// 8. List all pending/unapproved AI-generated questions
export const listPendingQuestions = async (req, res) => {
  try {
    const questions = await prisma.question.findMany({
      where: { isApproved: false },
      include: {
        options: true,
        chapter: {
          include: {
            subject: true,
          },
        },
      },
      orderBy: [
        { isFlagged: "desc" }, // Flagged questions first
        { createdAt: "desc" }
      ],
    });
    res.status(200).json(questions);
  } catch (error) {
    console.error("List pending questions error:", error);
    res.status(500).json({ error: "Failed to fetch pending AI questions." });
  }
};

// 9. Approve a single pending AI-generated question
export const approveQuestion = async (req, res) => {
  try {
    const { questionId } = req.params;
    const updated = await prisma.question.update({
      where: { id: questionId },
      data: { isApproved: true },
      include: {
        options: true,
      },
    });
    res.status(200).json({ message: "Question approved successfully.", question: updated });
  } catch (error) {
    console.error("Approve question error:", error);
    res.status(500).json({ error: "Failed to approve the question." });
  }
};

// 10. Approve all non-flagged pending questions in one go
export const approveAllVerifiedQuestions = async (req, res) => {
  try {
    const result = await prisma.question.updateMany({
      where: {
        isApproved: false,
        isFlagged: false,
      },
      data: {
        isApproved: true,
      },
    });
    res.status(200).json({
      message: `${result.count} verified questions approved successfully.`,
      count: result.count,
    });
  } catch (error) {
    console.error("Batch approve error:", error);
    res.status(500).json({ error: "Failed to batch approve questions." });
  }
};
