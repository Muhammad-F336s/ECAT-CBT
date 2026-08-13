import prisma from "../db.js";

// Fetch all available onboarding data
export const getOnboardingData = async (req, res) => {
  try {
    const universities = await prisma.university.findMany({
      include: {
        tests: true
      }
    });

    const exams = await prisma.entryExam.findMany({
      where: { isActive: true },
      include: {
        category: true,
        university: true
      }
    });

    res.status(200).json({ universities, exams });
  } catch (error) {
    console.error("Error fetching onboarding data:", error);
    res.status(500).json({ error: "Failed to fetch data." });
  }
};

// Set User Interests (Complete Onboarding)
export const setUserInterests = async (req, res) => {
  try {
    const { universityIds, examIds } = req.body;
    const userId = req.auth.id; // auth middleware sets req.auth

    // We use set to link existing records in Many-to-Many, replacing old ones
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        hasCompletedOnboarding: true,
        selectedUniversities: universityIds && universityIds.length > 0 ? {
          set: universityIds.map(id => ({ id }))
        } : { set: [] },
        selectedExams: examIds && examIds.length > 0 ? {
          set: examIds.map(id => ({ id }))
        } : { set: [] }
      },
      include: {
        selectedUniversities: true,
        selectedExams: true
      }
    });

    res.status(200).json({ message: "Onboarding completed successfully!", user: updatedUser });
  } catch (error) {
    console.error("Error setting user interests:", error);
    res.status(500).json({ error: "Failed to save preferences." });
  }
};
