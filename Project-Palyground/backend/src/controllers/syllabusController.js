import prisma from "../db.js";

export const getSyllabusMetadata = async (req, res) => {
  try {
    const subjects = await prisma.subject.findMany({
      include: {
        chapters: {
          orderBy: { name: "asc" }
        }
      },
      orderBy: { name: "asc" }
    });
    res.status(200).json(subjects);
  } catch (error) {
    console.error("Get syllabus metadata error:", error);
    res.status(500).json({ error: "Failed to fetch syllabus metadata from database." });
  }
};
