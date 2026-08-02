const OPTION_LABELS = "ABCDE";

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const buildQuestionBlock = (item, { blank } = {}) => {
  const optionsHtml = item.options
    .map((option, index) => {
      const label = OPTION_LABELS[index] || String(index + 1);
      const isSelected = !blank && option.text === item.selectedAnswerText;
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

  const answerNote = item.isSkipped ? '<p class="paper-skipped">Not attempted / Skipped</p>' : "";

  let solvedInfo = "";
  if (!blank) {
    const parts = (item.explanation || "").split("===TRICK===");
    const explanationText = parts[0] || "";
    const customTrick = parts[1] || "";
    const displayAnswerText = item.correctAnswerText || (item.correctAnswerLabel ? `Option ${item.correctAnswerLabel}` : "");

    solvedInfo = `
      <p class="paper-correct-answer">Correct Answer: ${escapeHtml(displayAnswerText)}</p>
      ${explanationText.trim() ? `<div class="paper-explanation"><strong>Explanation:</strong> ${escapeHtml(explanationText)}</div>` : ""}
      ${customTrick.trim() ? `<div class="paper-trick"><strong>💡 Pro Tip / Trick:</strong> ${escapeHtml(customTrick)}</div>` : ""}
    `;
  }

  return `
    <article class="paper-question">
      <h3>Q${item.questionNumber}: ${escapeHtml(item.statement)}</h3>
      <div class="paper-options">${optionsHtml}</div>
      ${answerNote}
      ${solvedInfo}
    </article>
  `;
};

export const printFullPaper = ({ user, results, blank = false }) => {
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
        <script>
          window.MathJax = {
            tex: {
              inlineMath: [['$', '$'], ['\\\\(', '\\\\)']],
              displayMath: [['$$', '$$'], ['\\\\[', '\\\\]']]
            },
            startup: {
              pageReady: () => {
                return MathJax.startup.defaultPageReady().then(() => {
                  window.dispatchEvent(new Event('mathjax-ready'));
                });
              }
            }
          };
        </script>
        <script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js" id="MathJax-script" async></script>
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
            border: none;
          }
          .paper-option {
            display: grid;
            grid-template-columns: auto auto 1fr;
            gap: 12px;
            align-items: center;
            padding: 12px 14px;
            border-bottom: 1px solid #f0f0f0;
            font-size: 0.98rem;
            line-height: 1.4;
          }
          .paper-option:last-child { border-bottom: none; }
          .paper-option.selected {
            background: #eef4fb;
            font-weight: 600;
            color: #0b3d91;
          }
          .paper-marker {
            font-size: 1rem;
            line-height: 1.2;
            color: #8a8a8a;
            margin-top: 2px;
          }
          .paper-option.selected .paper-marker {
            color: #0b3d91;
          }
          .paper-option-label {
            font-weight: 700;
            min-width: 1.2rem;
          }
          .paper-blank-line {
            display: inline-block;
            min-width: 240px;
            border-bottom: 1px solid #222;
            padding: 2px 6px;
            margin-left: 8px;
          }
          .paper-skipped {
            margin: 10px 0 0;
            font-family: Arial, sans-serif;
            font-size: 0.85rem;
            color: #9a6700;
            font-style: italic;
          }
          .paper-correct-answer {
            margin: 12px 0 6px;
            font-family: Arial, sans-serif;
            font-size: 0.94rem;
            color: #2e6b35;
            font-weight: bold;
          }
          .paper-explanation {
            margin: 8px 0;
            padding: 10px 14px;
            background: #fdfdfd;
            border-left: 3px solid #2f5f9e;
            font-family: Georgia, serif;
            font-size: 0.96rem;
            color: #333;
            line-height: 1.48;
          }
          .paper-trick {
            margin: 8px 0 0;
            padding: 10px 14px;
            background: #fffbef;
            border-left: 3px solid #e5a93b;
            font-family: Arial, sans-serif;
            font-size: 0.92rem;
            color: #725002;
            line-height: 1.45;
          }
          .paper-footer {
            margin-top: 30px;
            text-align: center;
            font-family: Arial, sans-serif;
            font-size: 0.8rem;
            color: #666;
          }
          @media print {
            @page { margin: 0; }
            body { padding: 12mm; }
          }
        </style>
      </head>
      <body>
        <header class="paper-header">
          <h1>ECAT CBT — Full Test Paper</h1>
          <p>${escapeHtml(results.subjectName || "ECAT Practice")} | ${escapeHtml(results.track || "Pre-Engineering")}</p>
        </header>

        ${!blank ? `
        <div class="paper-meta">
          <span><strong>Student:</strong> ${escapeHtml(user?.name || "Student")}</span>
          <span><strong>Email:</strong> ${escapeHtml(user?.email || "—")}</span>
          <span><strong>Test Date:</strong> ${escapeHtml(testDate)}</span>
          <span><strong>Total Questions:</strong> ${questions.length}</span>
        </div>
        ` : `
        <div class="paper-meta">
          <span><strong>Student:</strong> <span class="paper-blank-line">&nbsp;</span></span>
          <span><strong>Email:</strong> <span class="paper-blank-line">&nbsp;</span></span>
          <span><strong>Test Date:</strong> <span class="paper-blank-line">&nbsp;</span></span>
          <span><strong>Total Questions:</strong> ${questions.length}</span>
        </div>
        `}

        ${!blank ? `<div class="paper-instructions">This document contains the complete test paper with all questions and your selected responses. Filled circle (&#9679;) indicates your chosen answer. Empty circle (&#9675;) indicates unselected options.</div>` : ``}

        <main>
          ${questions.map((q) => buildQuestionBlock(q, { blank })).join("")}
        </main>

        ${!blank ? `<footer class="paper-footer">ECAT CBT Simulator — Printed on ${escapeHtml(new Date().toLocaleString())}</footer>` : ``}
      </body>
    </html>
  `;

  const iframe = document.createElement("iframe");
  iframe.setAttribute("title", "ECAT Full Test Paper Print");
  iframe.style.cssText =
    "position:fixed;width:0;height:0;border:0;visibility:hidden;";
  document.body.appendChild(iframe);

  const frameDoc = iframe.contentWindow?.document;
  if (!frameDoc) {
    document.body.removeChild(iframe);
    window.alert("Unable to prepare print view. Please try again.");
    return;
  }

  let printed = false;
  let fallbackTimer;

  const printAction = () => {
    if (printed) return;
    printed = true;
    window.clearTimeout(fallbackTimer);
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    window.setTimeout(() => {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    }, 1000);
  };

  // Listen to MathJax load & typeset completion event inside the iframe
  iframe.contentWindow.addEventListener("mathjax-ready", printAction);

  // Fallback in case MathJax library fails to load within 3.5 seconds
  fallbackTimer = window.setTimeout(printAction, 3500);

  frameDoc.open();
  frameDoc.write(paperHtml);
  frameDoc.close();
};
