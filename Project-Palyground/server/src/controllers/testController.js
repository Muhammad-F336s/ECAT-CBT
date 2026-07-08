import prisma from "../db.js";
import { generateAllQuestions } from "../services/groqService.js";

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
    const { 
      subjectId, 
      totalQuestions, 
      questionCount,
      chapterIds,
      useAI = true,
      field,
      selectedField,
      syllabusType,
      syllabusVersion,
      newSyllabusPercentage,
      newSyllabusPercent,
      subjects,
      selectedSubjects,
      subjectQuestions,
      difficulty,
      difficultyLevel,
      chapters,
      selectedChapters,
      negativeMarking
    } = req.body;

    const activeField = field || selectedField;
    const activeTotalQuestions = Number(questionCount || totalQuestions || 10);
    const activeSyllabusType = syllabusType || syllabusVersion;
    const activeNewSyllabusPercent = Number(newSyllabusPercentage !== undefined ? newSyllabusPercentage : (newSyllabusPercent !== undefined ? newSyllabusPercent : 50));
    const activeDifficulty = Number(difficulty !== undefined ? difficulty : (difficultyLevel !== undefined ? difficultyLevel : 5));

    if (!subjectId && !activeField) {
      return res.status(400).json({ error: "Subject ID or Selected Field is required." });
    }

    const access = await loadStudentAccess(userId);
    if (access.error) {
      return res.status(access.error.status).json({ error: access.error.message });
    }

    let selectedQuestions = [];
    let subjectName = "ECAT Practice";

    if (useAI && activeField) {
      console.log(`[Groq] Initiating AI Test Generation for field: ${activeField}`);
      
      let allAiQuestions = [];
      
      // Determine which subjects to generate
      let subjectsToGenerate = [];
      if (subjects && subjects.length > 0) {
        subjectsToGenerate = subjects.map(s => ({
          name: s.name,
          count: s.count
        }));
      } else if (selectedSubjects && selectedSubjects.length > 0) {
        subjectsToGenerate = selectedSubjects.map(subId => {
          const nameMap = {
            'math': 'Mathematics',
            'physics': 'Physics',
            'chemistry': 'Chemistry',
            'biology': 'Biology',
            'english': 'English',
            'computer': 'Computer Science'
          };
          const name = nameMap[subId] || subId;
          const count = subjectQuestions ? subjectQuestions[subId] : activeTotalQuestions;
          return { name, count };
        }).filter(s => s.count > 0);
      } else {
        subjectsToGenerate = [{ name: activeField, count: activeTotalQuestions }];
      }

      for (const sub of subjectsToGenerate) {
        console.log(`[Groq] Requesting ${sub.count} questions for ${sub.name}...`);
        
        // Build chapter list if provided
        let targetChapters = [];
        if (chapters && chapters.length > 0) {
          targetChapters = chapters.filter(c => c.subject.toLowerCase() === sub.name.toLowerCase());
        } else if (selectedChapters && selectedChapters[sub.name.toLowerCase()]) {
           const chapKeys = Object.keys(selectedChapters[sub.name.toLowerCase()]);
           targetChapters = chapKeys
             .filter(k => selectedChapters[sub.name.toLowerCase()][k])
             .map(name => ({ subject: sub.name, name }));
        }

        const batch = await generateAllQuestions(
          activeField,
          [sub.name],
          sub.count,
          targetChapters,
          activeDifficulty,
          activeSyllabusType,
          activeNewSyllabusPercent
        );
        allAiQuestions = allAiQuestions.concat(batch);
      }

      // Shuffle final set
      selectedQuestions = allAiQuestions.sort(() => Math.random() - 0.5).map(stripQuestionForClient);
      
      console.log("\n================ [GROQ AI GENERATED TEST] ================\n");
      console.log(JSON.stringify(selectedQuestions, null, 2));
      console.log("\n==========================================================\n");

      if (subjectsToGenerate.length === 1) {
        subjectName = subjectsToGenerate[0].name;
      }
    } else {
      // Fallback to static DB questions
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

      selectedQuestions = shuffled
        .slice(0, Number(activeTotalQuestions))
        .map(stripQuestionForClient);

      subjectName = shuffled[0]?.chapter?.subject?.name || "ECAT Practice";
    }

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
    const { questionResponses, timeTakenSeconds = 0, subjectName, negativeMarking = false } = req.body;

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

    // ===== FIXED: Single batched DB query instead of N+1 loop =====
    const questionIds = questionResponses.map((r) => r.questionId).filter(Boolean);
    const allQuestions = await prisma.question.findMany({
      where: { id: { in: questionIds } },
      include: {
        options: {
          select: { id: true, text: true },
          orderBy: { id: "asc" },
        },
      },
    });

    // Build a lookup map for O(1) access
    const questionMap = new Map(allQuestions.map((q) => [q.id, q]));

    for (let index = 0; index < questionResponses.length; index++) {
      const { questionId, selectedAnswerText } = questionResponses[index];
      const question = questionMap.get(questionId);

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
        if (negativeMarking) {
          calculatedScore -= 0.25;
        }
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
    const percentage = ((calculatedScore / totalQuestions) * 100).toFixed(1);
    const displayScore = calculatedScore * MARKS_PER_QUESTION;
    const displayTotal = totalQuestions * MARKS_PER_QUESTION;

    const attemptPayload = {
      message: "Test submitted successfully",
      subjectName: subjectName || "ECAT Practice",
      track: "Pre-Engineering",
      score: calculatedScore,
      totalMarks: totalQuestions,
      displayScore,
      displayTotal,
      marksPerQuestion: MARKS_PER_QUESTION,
      percentage,
      correctCount,
      wrongCount,
      skippedCount,
      negativeMarking: !!negativeMarking,
      timeTakenSeconds: Number(timeTakenSeconds) || 0,
      breakdown,
    };

    const attempt = await prisma.testAttempt.create({
      data: {
        userId,
        score: calculatedScore,
        totalMarks: totalQuestions,
        breakdown: attemptPayload,
      },
    });

    attemptPayload.attemptId = attempt.id;
    attemptPayload.submittedAt = attempt.createdAt;

    res.status(201).json(attemptPayload);
  } catch (error) {
    console.error("Test Submission Engine Error:", error);
    res
      .status(500)
      .json({ error: "Submission processing failed on engine level." });
  }
};

export const getTestResult = async (req, res) => {
  try {
    const userId = req.auth.id;
    const { attemptId } = req.params;

    const attempt = await prisma.testAttempt.findUnique({
      where: { id: attemptId },
    });

    if (!attempt) {
      return res.status(404).json({ error: "Attempt not found." });
    }

    if (attempt.userId !== userId) {
      return res.status(403).json({ error: "Unauthorized access to attempt." });
    }

    if (!attempt.breakdown) {
      return res.status(404).json({ error: "No detailed breakdown available for this attempt." });
    }

    res.status(200).json(attempt.breakdown);
  } catch (error) {
    console.error("Get test result error:", error);
    res.status(500).json({ error: "Failed to retrieve historic test breakdown." });
  }
};
