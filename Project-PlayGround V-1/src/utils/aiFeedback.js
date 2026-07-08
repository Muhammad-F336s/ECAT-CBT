const MARKS_PER_QUESTION = 20;

export const getAiFeedback = (percentage, score, totalMarks, studentName = "Student") => {
  const name = studentName.split(" ")[0] || studentName;
  const pct = Number(percentage);

  if (pct <= 20) {
    return {
      tone: "fail",
      icons: "💀 ❌ 🪓",
      title: "TOTAL FAIL — SHARAM NAHI AATI?",
      body: `Oye ${name}! ${score} out of ${totalMarks} marks? Matlab ECAT tumhe reject letter bhejne wala hai, dosti nahi. PUBG chhoro, kitab uthao warna agli dafa sirf "better luck next year" milega.`,
    };
  }

  if (pct <= 40) {
    return {
      tone: "poor",
      icons: "😬 📉 ⚠️",
      title: "DANGER ZONE — WAKE UP!",
      body: `${name}, ${pct}% se ECAT clear nahi hota. Abhi syllabus pakro, roz practice karo, warna ye score tumhari CV pe nahi, warning letter pe jaega.`,
    };
  }

  if (pct <= 60) {
    return {
      tone: "average",
      icons: "📚 💪 🎯",
      title: "AVERAGE — IMPROVE KARO!",
      body: `${name}, ${pct}% matlab tum start to le chuke ho, lekin ECAT ke liye abhi bohot kaam baaki hai. Weak chapters identify karo aur un par focus karo.`,
    };
  }

  if (pct <= 80) {
    return {
      tone: "good",
      icons: "👍 ✨ 📈",
      title: "GOOD PROGRESS — KEEP PUSHING!",
      body: `Well done ${name}! ${pct}% solid foundation dikhata hai. Ab speed aur accuracy dono par kaam karo taake full mock exams mein bhi yehi level maintain ho.`,
    };
  }

  return {
    tone: "excellent",
    icons: "🏆 🔥 ⭐",
    title: "EXCELLENT — ECAT READY VIBES!",
    body: `Mubarak ho ${name}! ${pct}% brilliant performance hai. Isi consistency se chalo — ab full-length timed papers aur past paper revision pe focus karo.`,
  };
};

export const getProTip = (status) => {
  if (status === "correct") {
    return "Is concept ko short notes mein likh lo aur 48 hours baad dobara revise karo — retention strong ho jati hai.";
  }
  if (status === "skipped") {
    return "Skipped questions time management issue dikhate hain. Pehle easy questions solve karo, phir hard ones par wapas aao.";
  }
  return "Galat option par focus mat karo — pehle concept samjho, phir similar MCQs ki practice karo.";
};

export { MARKS_PER_QUESTION };
