const OPTION_LABELS = "ABCDE";

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const buildQuestionBlock = (item) => {
  const optionsHtml = item.options
    .map((option, index) => {
      const label = OPTION_LABELS[index] || String(index + 1);
      const isSelected = option.text === item.selectedAnswerText;
      const marker = isSelected ? "&#9679;" : "&#9675;";
      return `
        <div class="paper-option ${isSelected ? "selected" : ""}">
          <span class="paper-marker">${marker}</span>
          <span class="paper-option-label">${label}.</span>
          <span class="paper-option-text">${escapeHtml(option.text)}</span>
        </div>
      `;
    })
    .join("");

  const answerNote = item.isSkipped
    ? '<p class="paper-skipped">Not attempted / Skipped</p>'
    : "";

  return `
    <article class="paper-question">
      <h3>Q${item.questionNumber}: ${escapeHtml(item.statement)}</h3>
      <div class="paper-options">${optionsHtml}</div>
      ${answerNote}
    </article>
  `;
};

export const printFullPaper = ({ user, results }) => {
  const questions = [...(results.breakdown || [])].sort(
    (a, b) => a.questionNumber - b.questionNumber,
  );

  const testDate = results.submittedAt
    ? new Date(results.submittedAt).toLocaleString()
    : new Date().toLocaleString();

  const paperHtml = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <title>ECAT Full Test Paper</title>
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            padding: 28px;
            font-family: Georgia, "Times New Roman", serif;
            color: #1a1a1a;
            background: #fff;
          }
          .paper-header {
            text-align: center;
            border-bottom: 2px solid #2e6b35;
            padding-bottom: 18px;
            margin-bottom: 24px;
          }
          .paper-header h1 {
            margin: 0 0 8px;
            font-size: 1.6rem;
            color: #2f5f9e;
          }
          .paper-header p {
            margin: 4px 0;
            font-family: Arial, sans-serif;
            font-size: 0.92rem;
            color: #444;
          }
          .paper-meta {
            display: flex;
            justify-content: space-between;
            gap: 16px;
            flex-wrap: wrap;
            margin-bottom: 22px;
            font-family: Arial, sans-serif;
            font-size: 0.9rem;
          }
          .paper-instructions {
            background: #f5faf5;
            border: 1px solid #d5e5d7;
            border-radius: 8px;
            padding: 12px 14px;
            margin-bottom: 24px;
            font-family: Arial, sans-serif;
            font-size: 0.85rem;
            line-height: 1.5;
          }
          .paper-question {
            break-inside: avoid;
            page-break-inside: avoid;
            margin-bottom: 28px;
            padding-bottom: 18px;
            border-bottom: 1px solid #e0e0e0;
          }
          .paper-question h3 {
            margin: 0 0 14px;
            font-size: 1rem;
            line-height: 1.55;
            font-weight: 700;
          }
          .paper-options {
            display: grid;
            gap: 0;
            border: 1px solid #ccc;
          }
          .paper-option {
            display: grid;
            grid-template-columns: auto auto 1fr;
            gap: 10px;
            align-items: start;
            padding: 10px 12px;
            border-bottom: 1px solid #ddd;
            font-size: 0.95rem;
            line-height: 1.45;
          }
          .paper-option:last-child { border-bottom: none; }
          .paper-option.selected {
            background: #eef7ef;
            font-weight: 600;
          }
          .paper-marker {
            font-size: 1rem;
            line-height: 1.2;
            color: #2e6b35;
          }
          .paper-option-label {
            font-weight: 700;
            min-width: 1.2rem;
          }
          .paper-skipped {
            margin: 10px 0 0;
            font-family: Arial, sans-serif;
            font-size: 0.85rem;
            color: #9a6700;
            font-style: italic;
          }
          .paper-footer {
            margin-top: 30px;
            text-align: center;
            font-family: Arial, sans-serif;
            font-size: 0.8rem;
            color: #666;
          }
          @media print {
            body { padding: 12mm; }
          }
        </style>
      </head>
      <body>
        <header class="paper-header">
          <h1>ECAT CBT — Full Test Paper</h1>
          <p>${escapeHtml(results.subjectName || "ECAT Practice")} | ${escapeHtml(results.track || "Pre-Engineering")}</p>
        </header>

        <div class="paper-meta">
          <span><strong>Student:</strong> ${escapeHtml(user?.name || "Student")}</span>
          <span><strong>Email:</strong> ${escapeHtml(user?.email || "—")}</span>
          <span><strong>Test Date:</strong> ${escapeHtml(testDate)}</span>
          <span><strong>Total Questions:</strong> ${questions.length}</span>
        </div>

        <div class="paper-instructions">
          This document contains the complete test paper with all questions and your selected responses.
          Filled circle (&#9679;) indicates your chosen answer. Empty circle (&#9675;) indicates unselected options.
        </div>

        <main>
          ${questions.map(buildQuestionBlock).join("")}
        </main>

        <footer class="paper-footer">
          ECAT CBT Simulator — Printed on ${escapeHtml(new Date().toLocaleString())}
        </footer>
      </body>
    </html>
  `;

  const printWindow = window.open("", "_blank", "noopener,noreferrer");
  if (!printWindow) {
    window.alert("Pop-up blocked. Please allow pop-ups to print the full test paper.");
    return;
  }

  printWindow.document.open();
  printWindow.document.write(paperHtml);
  printWindow.document.close();

  printWindow.focus();
  window.setTimeout(() => {
    printWindow.print();
  }, 300);
};
