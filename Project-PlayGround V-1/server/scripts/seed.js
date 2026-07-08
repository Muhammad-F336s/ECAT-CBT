import "dotenv/config";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing. Add it to server/.env before running the Prisma seed.");
}

const adapter = new PrismaNeon({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

const SYLLABUS = [
  {
    subject: "Mathematics",
    chapters: {
      part1: [
        "Number Systems", "Sets, Functions and Groups", "Matrices and Determinants", "Quadratic Equations",
        "Partial Fractions", "Sequences and Series", "Permutation, Combination and Probability",
        "Mathematical Induction and Binomial Theorem", "Fundamentals of Trigonometry", "Trigonometric Identities",
        "Trigonometric Functions and their Graphs", "Application of Trigonometry", "Inverse Trigonometric Functions",
        "Solutions of Trigonometric Equations"
      ],
      part2: [
        "Functions and Limits", "Differentiation", "Integration", "Introduction to Analytic Geometry",
        "Linear Inequalities and Linear Programming", "Conic Section", "Vectors (Math)"
      ]
    }
  },
  {
    subject: "Physics",
    chapters: {
      part1: [
        "Measurements", "Vectors and Equilibrium", "Motion and Force", "Work and Energy", "Circular Motion",
        "Fluid Dynamics", "Oscillations", "Waves", "Physical Optics", "Optical Instruments", "Heat and Thermodynamics"
      ],
      part2: [
        "Electrostatics", "Current Electricity", "Electromagnetism", "Electromagnetic Induction", "Alternating Current",
        "Physics of Solids", "Electronics", "Dawn of Modern Physics", "Atomic Spectra", "Nuclear Physics"
      ]
    }
  },
  {
    subject: "Chemistry",
    chapters: {
      part1: [
        "Basic Concepts", "Experimental Techniques in Chemistry", "Gases", "Liquids and Solids", "Atomic Structure",
        "Chemical Bonding", "Thermochemistry", "Chemical Equilibrium", "Solutions", "Electrochemistry", "Chemical Kinetics"
      ],
      part2: [
        "Periodic Classification of Elements and Periodicity", "s-Block Elements", "d & f-Block Elements",
        "Group III-A and Group IV-A Elements", "Group V-A and Group VI-A Elements", "Halogens and Noble Gases",
        "Fundamental Principles of Organic Chemistry", "Aliphatic Hydrocarbons", "Aromatic Hydrocarbons", "Alkyl Halides",
        "Alcohols, Phenols and Ethers", "Aldehydes and Ketones", "Carboxylic Acids", "Macromolecules",
        "Common Chemical Industries in Pakistan", "Environmental Chemistry"
      ]
    }
  },
  {
    subject: "Computer Science",
    chapters: {
      part1: [
        "Basics of Information Technology", "Information Networks", "Data Communications", "Applications and Uses of Computers",
        "Computer Architecture", "Security, Copyright and the Law", "Windows Operating System", "Word Processing",
        "Spreadsheet", "Internet Browsing and E-mail"
      ],
      part2: [
        "Data Basics", "Basic Concepts and Terminology of Databases", "Database Design Process", "Data Integrity and Normalization",
        "Introduction to Microsoft Access", "MS Access Forms and Reports", "MS Access Queries", "Getting Started with C",
        "Elements of C", "Input and Output in C", "Decision Constructs in C", "Loop Constructs in C", "Functions in C", "File Handling in C"
      ]
    }
  },
  {
    subject: "Biology",
    chapters: {
      part1: [
        "Introduction to Biology", "Biological Molecules", "Enzymes", "The Cell", "Variety of Life", "Kingdom Prokaryotae (Monera)",
        "The Kingdom Protista (Protoctista)", "Fungi (The Kingdom of Recyclers)", "Kingdom Plantae", "Kingdom Animalia",
        "Bioenergetics", "Nutrition", "Gaseous Exchange", "Transport"
      ],
      part2: [
        "Homeostasis", "Support and Movements", "Coordination and Control", "Reproduction", "Growth and Development",
        "Chromosomes and DNA", "Cell Cycle", "Variation and Genetics", "Biotechnology", "Evolution", "Ecosystem",
        "Some Major Ecosystems", "Man and His Environment"
      ]
    }
  },
  {
    subject: "English",
    chapters: {
      part1: [
        "Grammar & Parts of Speech", "Vocabulary & Synonyms", "Sentence Correction", "Reading Comprehension"
      ],
      part2: []
    }
  }
];

async function main() {
  console.log("Seeding started...");

  for (const item of SYLLABUS) {
    console.log(`Processing subject: ${item.subject}...`);
    
    // Upsert Subject
    const subject = await prisma.subject.upsert({
      where: { name: item.subject },
      update: {},
      create: { name: item.subject },
    });

    console.log(`Subject ready: ${subject.name} (ID: ${subject.id})`);

    const processPart = async (partName, chapterList) => {
      for (const chapterName of chapterList) {
        // Find or create Chapter
        let chapter = await prisma.chapter.findFirst({
          where: {
            name: chapterName,
            subjectId: subject.id,
          },
        });

        if (!chapter) {
          chapter = await prisma.chapter.create({
            data: {
              name: chapterName,
              subjectId: subject.id,
              part: partName,
            },
          });
          console.log(`  Chapter created: ${chapter.name} (${partName})`);
        } else {
          // Update part if it was previously missing
          if (chapter.part !== partName) {
            chapter = await prisma.chapter.update({
              where: { id: chapter.id },
              data: { part: partName },
            });
            console.log(`  Chapter updated with part: ${chapter.name} (${partName})`);
          } else {
            console.log(`  Chapter already exists: ${chapter.name} (${partName})`);
          }
        }

        // Check if this chapter already has any questions
        const questionCount = await prisma.question.count({
          where: { chapterId: chapter.id },
        });

        if (questionCount === 0) {
          console.log(`    Seeding sample questions for chapter: ${chapter.name}...`);
          
          // Seed Question 1
          await prisma.question.create({
            data: {
              statement: `Which of the following best describes the core focus of the topic "${chapter.name}" in ${subject.name}?`,
              chapterId: chapter.id,
              correctAnswer: `Fundamental study and theoretical analysis of ${chapter.name}`,
              explanation: `The topic covers key principles, equations, and applications related to ${chapter.name} as outline in the PTB curriculum.`,
              options: {
                create: [
                  { text: `Fundamental study and theoretical analysis of ${chapter.name}` },
                  { text: `An unrelated application of general science` },
                  { text: `Historical timelines before the scientific revolution` },
                  { text: `A purely computational approximation method` }
                ]
              }
            }
          });

          // Seed Question 2
          await prisma.question.create({
            data: {
              statement: `In the study of ${subject.name}, what is a primary practical application of the concepts learned in "${chapter.name}"?`,
              chapterId: chapter.id,
              correctAnswer: `Solving engineering and scientific problems involving ${chapter.name}`,
              explanation: `Understanding ${chapter.name} provides the framework for practical implementations and critical assessments in real-world scenarios.`,
              options: {
                create: [
                  { text: `Solving engineering and scientific problems involving ${chapter.name}` },
                  { text: `Basic data structures modeling` },
                  { text: `Memorizing unrelated technical terminology` },
                  { text: `None of the options listed are correct` }
                ]
              }
            }
          });
        }
      }
    };

    if (item.chapters.part1) await processPart("part1", item.chapters.part1);
    if (item.chapters.part2) await processPart("part2", item.chapters.part2);
  }

  console.log("Seeding complete!");
}

main()
  .catch((error) => {
    console.error("Error seeding data:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
