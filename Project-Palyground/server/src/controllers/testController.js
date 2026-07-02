import prisma from "../db.js";

export const generateTest = async (req, res) => {
  try {
    const { subjectId, totalQuestions = 10, chapterIds, userId } = req.body;

    if (!subjectId) {
      return res
        .status(400)
        .json({ error: "Subject ID is required." });
    }

    if (!userId) {
      return res.status(400).json({ error: "User ID is required." });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, isApproved: true, testAttemptsLimit: true },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    if (user.role !== "admin" && !user.isApproved) {
      return res.status(403).json({
        error: "Your account is pending approval by admin.",
      });
    }

    if (user.role !== "admin") {
      const attemptsUsed = await prisma.testAttempt.count({ where: { userId } });
      if (user.testAttemptsLimit >= 0 && attemptsUsed >= user.testAttemptsLimit) {
        return res.status(403).json({
          error: "Your test attempts have been completed. Renew your package or contact admin.",
        });
      }
    }

    // 1. Build the query based on the target criteria
    let whereClause = {
      chapter: {
        subjectId: subjectId,
      },
    };

    // If the student selected specific chapters (custom prep)
    if (chapterIds && chapterIds.length > 0) {
      whereClause.chapterId = { in: chapterIds };
    }

    // 2. Fetch matching questions and options from the database
    const availableQuestions = await prisma.question.findMany({
      where: whereClause,
      include: {
        options: {
          select: {
            id: true,
            text: true,
          },
        },
      },
    });

    if (availableQuestions.length === 0) {
      return res
        .status(404)
        .json({ error: "No questions found for the selected criteria." });
    }

    // 3. Algorithm: Fisher-Yates Shuffle array ko randomly re-order karne ke liye
    const shuffled = [...availableQuestions];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // 4. Slice the shuffled list to the requested number of questions
    const selectedQuestions = shuffled.slice(0, Number(totalQuestions));

    // Send response (Security note: correct answers and explanations may be hidden from frontend if needed)
    res.status(200).json({
      message: "Test successfully generated",
      count: selectedQuestions.length,
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
    // Note: a real application would derive userId from req.user via JWT middleware.
    // For testing, we accept userId from the request body.
    const { userId, questionResponses } = req.body;

    if (!userId || !questionResponses || !Array.isArray(questionResponses)) {
      return res
        .status(400)
        .json({ error: "userId and questionResponses array are required." });
    }

    let calculatedScore = 0;
    const totalQuestions = questionResponses.length;

    // 1. Array loop processing to verify each answer
    for (const response of questionResponses) {
      const { questionId, selectedAnswerText } = response;

      // Question directly database se fetch karo correct answer validation ke liye
      const question = await prisma.question.findUnique({
        where: { id: questionId },
      });

      if (question && question.correctAnswer === selectedAnswerText) {
        calculatedScore++;
      }
    }

    // 2. Database transaction logging inside TestAttempt table
    const attempt = await prisma.testAttempt.create({
      data: {
        userId,
        score: calculatedScore,
        totalMarks: totalQuestions,
      },
    });

    res.status(201).json({
      message: "Test submitted successfully",
      score: attempt.score,
      totalMarks: attempt.totalMarks,
      attemptId: attempt.id,
    });
  } catch (error) {
    console.error("Test Submission Engine Error:", error);
    res
      .status(500)
      .json({ error: "Submission processing failed on engine level." });
  }
};
