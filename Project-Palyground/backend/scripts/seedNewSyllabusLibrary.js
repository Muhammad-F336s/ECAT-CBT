import prisma from "../src/db.js";

// Official New Syllabus (Batch 2026+) library structure. Chapters are created
// even before they contain MCQs, so students can discover and practise every
// listed syllabus topic; the practice generator fills an empty chapter on use.
const NEW_SYLLABUS = {
  Mathematics: {
    part1: ["Complex Numbers", "Functions and Graphs", "Theory of Quadratic Functions", "Matrices and Determinants", "Partial Fractions", "Sequences and Series", "Permutations and Combinations", "Mathematical Induction and Binomial Theorem", "Division of Polynomials", "Trigonometric Identities", "Trigonometric Functions and their Graphs", "Limit and Continuity", "Differentiation", "Vectors in Space"],
    part2: ["Graphical Representation of Functions", "Further Differentiation", "Integration", "Differential Equations", "Analytical Geometry", "Conic Section", "Kinematics", "Numerical Method", "Inverse Trigonometric Functions and Their Graphs", "Solution of Trigonometric Equations", "Vector Valued Functions and Their Differentiations"],
  },
  Physics: {
    part1: ["Measurements", "Force and Motion", "Circular and Rotational Motion", "Work, Energy and Power", "Solids and Fluid Dynamics", "Heat and Thermodynamics", "Waves and Vibrations", "Physical Optics and Gravitational Waves", "Electrostatics and Current Electricity", "Electromagnetism", "Special Theory of Relativity", "Nuclear and Particle Physics"],
    part2: ["Thermal Physics", "Simple Harmonic Motion", "Physical Optics", "Electrostatics", "Alternating Current", "Quantum Physics", "Nuclear and Particle Physics", "Medical Physics", "Space and Environment"],
  },
  Chemistry: {
    part1: ["Periodic Table and Periodic Properties", "Atomic Structure", "Chemical Bonding", "Stoichiometry", "States and Phases of Matter", "Chemical Energetics", "Reaction Kinetics", "Chemical Equilibrium", "Acid-Base Chemistry", "Electrochemistry", "Hydrocarbons", "Nitrogen and Sulfur", "Halogens", "Atmosphere", "Basic Separation Techniques", "Lab Safety and Practical Skills"],
    part2: ["Group 2 Elements", "Transition Metals", "Basics of Organic Chemistry", "Aromatic Hydrocarbons", "Halogenoalkanes", "Hydroxy Compounds", "Carbonyl Compounds and Carboxylic Acids", "Organic Nitrogen Compounds", "Organic Synthesis", "Polymers", "Biochemistry", "Chromatography", "Spectroscopy-1", "Spectroscopy-2 (NMR)", "Materials and Energy", "Medicine, Agriculture and Industry", "Water"],
  },
  Biology: {
    part1: ["Biodiversity and Classification", "Bacteria and Viruses", "Cells and Subcellular Organelles", "Molecular Biology", "Enzymes", "Bioenergetics", "Structural and Computational Biology", "Plant Physiology", "Human Digestive System", "Human Respiratory System", "Human Circulatory System", "Human Skeletal and Muscular Systems"],
    part2: ["Homeostasis (Thermoregulation and Osmoregulation)", "Human Urinary System (Excretion)", "Human Nervous System", "Human Endocrine System", "Human Reproductive System", "Inheritance", "Chromosome and DNA", "Biotechnology", "Immunity", "Biostatistics", "Pharmacology", "Evolution", "Ecology"],
  },
  "Computer Science": {
    part1: ["Introduction to Software Development", "Python Programming", "Algorithms and Problem Solving", "Computational Structures", "Data Analytics", "Emerging Technologies", "Legal and Ethical Aspects of Computing System", "Online Research and Digital Literacy", "Entrepreneurship in Digital Age"],
    part2: ["Computer Networks", "Computational Thinking & Algorithms", "Object Oriented Programming Using Python", "Development of Graphical User Interface (GUI)", "Code Testing and Debugging", "Data and Databases", "Software Testing", "Applications of Computer Science", "Cybersecurity and Safe Digital Collaboration"],
  },
  English: {
    part1: ["Grammar & Parts of Speech", "Vocabulary & Synonyms", "Sentence Correction", "Reading Comprehension"],
    part2: [],
  },
};

let created = 0;
for (const [subjectName, sections] of Object.entries(NEW_SYLLABUS)) {
  const subject = await prisma.subject.upsert({
    where: { name: subjectName },
    create: { name: subjectName },
    update: {},
  });
  for (const [part, chapters] of Object.entries(sections)) {
    for (const name of chapters) {
      const existing = await prisma.chapter.findFirst({ where: { subjectId: subject.id, name } });
      if (!existing) {
        await prisma.chapter.create({ data: { subjectId: subject.id, name, part } });
        created += 1;
      }
    }
  }
}

console.log(`New syllabus library ready: ${created} chapter records added.`);
await prisma.$disconnect();
