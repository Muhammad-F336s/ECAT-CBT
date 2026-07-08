import 'dotenv/config';
import { getSql } from '../src/db.js';

const sql = getSql();

const sampleContent = {
  subject: 'Physics',
  chapter: 'Electrostatics',
  questions: [
    {
      statement: 'The electric intensity due to an infinite sheet of charge is:',
      options: [
        { text: 'σ / ε₀' },
        { text: 'σ / 2ε₀' },
        { text: '2σ / ε₀' },
        { text: 'σ / 4ε₀' },
      ],
      correctAnswer: 'σ / 2ε₀',
      explanation:
        "According to Gauss's Law, the electric field intensity near an infinite sheet of charge is E = σ / 2ε₀.",
    },
  ],
};

async function seed() {
  console.log('Seeding sample content using Neon client...');

  // Upsert subject
  const subjectRows = await sql`
    INSERT INTO "Subject" (name)
    VALUES (${sampleContent.subject})
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
    RETURNING *
  `;
  const subject = subjectRows[0];

  // Create chapter
  const chapterRows = await sql`
    INSERT INTO "Chapter" (name, "subjectId")
    VALUES (${sampleContent.chapter}, ${subject.id})
    RETURNING *
  `;
  const chapter = chapterRows[0];

  // Insert questions and options
  for (const q of sampleContent.questions) {
    const questionRows = await sql`
      INSERT INTO "Question" (statement, "chapterId", "correctAnswer", explanation)
      VALUES (${q.statement}, ${chapter.id}, ${q.correctAnswer}, ${q.explanation})
      RETURNING *
    `;
    const question = questionRows[0];

    for (const opt of q.options) {
      await sql`
        INSERT INTO "Option" (text, "questionId")
        VALUES (${opt.text}, ${question.id})
      `;
    }
  }

  console.log('✅ Seed complete');
}

seed()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
