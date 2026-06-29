import prisma from "../db.js";

export const getUserAnalytics = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res
        .status(400)
        .json({ error: "User ID parameter is required." });
    }

    // 1. Fetch all user attempts sorted by creation date
    const attempts = await prisma.testAttempt.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    if (attempts.length === 0) {
      return res.status(200).json({
        message: "This user has not taken any tests yet.",
        totalTests: 0,
        averagePercentage: 0,
        history: [],
      });
    }

    // 2. Metrics Mathematical Aggregations
    const totalTests = attempts.length;
    let totalScoreObtained = 0;
    let totalPossibleMarks = 0;

    const history = attempts.map((attempt) => {
      totalScoreObtained += attempt.score;
      totalPossibleMarks += attempt.totalMarks;

      return {
        attemptId: attempt.id,
        score: attempt.score,
        totalMarks: attempt.totalMarks,
        percentage:
          ((attempt.score / attempt.totalMarks) * 100).toFixed(2) + "%",
        date: attempt.createdAt,
      };
    });

    const averagePercentage =
      ((totalScoreObtained / totalPossibleMarks) * 100).toFixed(2) + "%";

    // 3. Structured Data response output
    res.status(200).json({
      userId,
      totalTests,
      averagePercentage,
      totalScoreObtained,
      totalPossibleMarks,
      history,
    });
  } catch (error) {
    console.error("Analytics Engine Crash:", error);
    res
      .status(500)
      .json({ error: "Failed to compile user metrics calculation layers." });
  }
};
