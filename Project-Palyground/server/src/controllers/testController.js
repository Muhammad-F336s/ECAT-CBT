import prisma from "../db.js";

const MARKS_PER_QUESTION = 20;

const stripQuestionForClient = (question) => ({
  id: question.id,
  statement: question.statement,
  chapterId: question.chapterId,
  options: question.options,
});

const getOptionLabel = (options, answerText) => {
  if (!answerText) return null;
  const index = options.findIndex((opt) => opt.text === answerText);
  if (index === -1) return null;
  return String.fromCharCode(65 + index);
};

const loadStudentAccess = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, isApproved: true, testAttemptsLimit: true },
  });

  if (!user) {
    return { error: { status: 404, message: "User not found." } };
  }

  if (user.role !== "admin" && !user.isApproved) {
    return {
      error: {
        status: 403,
        message: "Your account is pending approval by admin.",
      },
    };
  }

  if (user.role !== "admin") {
    const attemptsUsed = await prisma.testAttempt.count({ where: { userId } });
    if (
      user.testAttemptsLimit >= 0 &&
      attemptsUsed >= user.testAttemptsLimit
    ) {
      return {
        error: {
          status: 403,
          message:
            "Your test attempts have been completed. Renew your package or contact admin.",
        },
      };
    }
  }

  return { user };
};

export const generateTest = async (req, res) => {
  try {
    const userId = req.auth.id;
    const { subjectId, totalQuestions = 10, chapterIds } = req.body;

    if (!subjectId) {
      return res.status(400).json({ error: "Subject ID is required." });
    }

    const access = await loadStudentAccess(userId);
    if (access.error) {
      return res.status(access.error.status).json({ error: access.error.message });
    }

    let whereClause = {
      chapter: {
        subjectId,
      },
    };

    if (chapterIds && chapterIds.length > 0) {
      whereClause.chapterId = { in: chapterIds };
    }

    const availableQuestions = await prisma.question.findMany({
      where: whereClause,
      include: {
        options: {
          select: {
            id: true,
            text: true,
          },
        },
        chapter: {
          select: {
            name: true,
            subject: {
              select: { name: true },
            },
          },
        },
      },
    });

    if (availableQuestions.length === 0) {
      return res
        .status(404)
        .json({ error: "No questions found for the selected criteria." });
    }

    const shuffled = [...availableQuestions];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const selectedQuestions = shuffled
      .slice(0, Number(totalQuestions))
      .map(stripQuestionForClient);

    const subjectName =
      shuffled[0]?.chapter?.subject?.name || "ECAT Practice";

    res.status(200).json({
      message: "Test successfully generated",
      count: selectedQuestions.length,
      subjectName,
      marksPerQuestion: MARKS_PER_QUESTION,
      questions: selectedQuestions,
    });
  } catch (error) {
    console.error("Test Generator Engine Error:", error);
    res
      .status(500)
      .json({ error: "Test generation processing layer crashed." });
  }
};

export const submitTest = async (req, res) => {
  try {
    const userId = req.auth.id;
    const { questionResponses, timeTakenSeconds = 0, subjectName } = req.body;

    if (!questionResponses || !Array.isArray(questionResponses)) {
      return res
        .status(400)
        .json({ error: "questionResponses array is required." });
    }

    const access = await loadStudentAccess(userId);
    if (access.error) {
      return res.status(access.error.status).json({ error: access.error.message });
    }

    let calculatedScore = 0;
    let correctCount = 0;
    let wrongCount = 0;
    let skippedCount = 0;
    const breakdown = [];

    for (let index = 0; index < questionResponses.length; index++) {
      const { questionId, selectedAnswerText } = questionResponses[index];

      const question = await prisma.question.findUnique({
        where: { id: questionId },
        include: {
          options: {
            select: { id: true, text: true },
            orderBy: { id: "asc" },
          },
        },
      });

      if (!question) continue;

      const selected = String(selectedAnswerText || "").trim();
      const isSkipped = !selected;
      const isCorrect = !isSkipped && question.correctAnswer === selected;

      if (isSkipped) {
        skippedCount++;
      } else if (isCorrect) {
        correctCount++;
        calculatedScore++;
      } else {
        wrongCount++;
      }

      breakdown.push({
        questionNumber: index + 1,
        questionId: question.id,
        statement: question.statement,
        options: question.options,
        selectedAnswerText: selected || null,
        selectedAnswerLabel: getOptionLabel(question.options, selected),
        correctAnswerText: question.correctAnswer,
        correctAnswerLabel: getOptionLabel(
          question.options,
          question.correctAnswer,
        ),
        explanation: question.explanation || null,
        status: isSkipped ? "skipped" : isCorrect ? "correct" : "wrong",
        isCorrect,
        isSkipped,
      });
    }

    const totalQuestions = questionResponses.length;
    const attempt = await prisma.testAttempt.create({
      data: {
        userId,
        score: calculatedScore,
        totalMarks: totalQuestions,
      },
    });

    const percentage = ((calculatedScore / totalQuestions) * 100).toFixed(1);
    const displayScore = calculatedScore * MARKS_PER_QUESTION;
    const displayTotal = totalQuestions * MARKS_PER_QUESTION;

    res.status(201).json({
      message: "Test submitted successfully",
      attemptId: attempt.id,
      submittedAt: attempt.createdAt,
      subjectName: subjectName || "ECAT Practice",
      track: "Pre-Engineering",
      score: attempt.score,
      totalMarks: attempt.totalMarks,
      displayScore,
      displayTotal,
      marksPerQuestion: MARKS_PER_QUESTION,
      percentage,
      correctCount,
      wrongCount,
      skippedCount,
      negativeMarking: false,
      timeTakenSeconds: Number(timeTakenSeconds) || 0,
      breakdown,
    });
  } catch (error) {
    console.error("Test Submission Engine Error:", error);
    res
      .status(500)
      .json({ error: "Submission processing failed on engine level." });
  }
};
