export function convertMathPlaceholders(text) {
  if (!text || typeof text !== "string") return text;

  const converted = text.replace(/MATH\[([\s\S]*?)\]/g, (match, p1) => {
    let latex = p1
      .replace(/[\u00D7×]/g, "\\times ")
      .replace(/÷/g, "\\div ")
      .replace(/\*\*/g, "^")
      .replace(/sqrt\(\s*([^)]+?)\s*\)/g, "\\sqrt{$1}")
      .replace(/\(\s*([^)]+?)\s*\)\s*\/\s*\(\s*([^)]+?)\s*\)/g, "\\frac{$1}{$2}")
      .replace(/\^\s*\(\s*([^)]+?)\s*\)/g, (_, expr) => `^{${expr}}`)
      .replace(/\^\s*([A-Za-z0-9]+)/g, (_, expr) => `^{${expr}}`)
      .replace(/<=/g, "\\leq ")
      .replace(/>=/g, "\\geq ")
      .replace(/->/g, "\\rightarrow ")
      .replace(/\bpi\b/g, "\\pi")
      .replace(/\balpha\b/g, "\\alpha")
      .replace(/\bbeta\b/g, "\\beta")
      .replace(/\bgamma\b/g, "\\gamma")
      .replace(/\btheta\b/g, "\\theta")
      .replace(/\bint\b/g, "\\int")
      .replace(/\bsum\b/g, "\\sum")
      .replace(/\bdelta\b/g, "\\Delta")
      .replace(/\blambda\b/g, "\\lambda")
      .replace(/\bphi\b/g, "\\phi")
      .replace(/\brho\b/g, "\\rho")
      .replace(/\bsigma\b/g, "\\sigma")
      .replace(/\binf\b/g, "\\infty")
      .replace(/([A-Za-z]+)(\d+)/g, (_, letters, nums) => `${letters}_{${nums}}`)
      .replace(/\*/g, "\\times ");

    return `$${latex}$`;
  });

  // AI responses sometimes contain a matrix as a JavaScript-style nested
  // array, e.g. [[0, 1], [2, 3]]. Turn it into real LaTeX before rendering.
  const withMatrices = converted.replace(
    /\[\s*\[\s*(.*?)\s*\](?:\s*,\s*\[\s*(.*?)\s*\])+\s*\]/g,
    (matrix) => {
      const matrixRows = matrix.slice(1, -1);
      const rows = [...matrixRows.matchAll(/\[\s*(.*?)\s*\]/g)]
        .map((row) => row[1].split(",").map((value) => value.trim()).join(" & "));
      return `$\\begin{bmatrix}${rows.join(" \\\\ ")}\\end{bmatrix}$`;
    },
  );

  // Some AI models return valid LaTex directly instead of the requested
  // MATH[...] wrapper. React-Latex needs `$...$` delimiters, so preserve the
  // surrounding sentence while placing the LaTex expression into math mode.
  if (!withMatrices.includes("$") && /\\(?:int|sum|frac|sqrt|sin|cos|tan|log|ln|pi|theta|alpha|beta|gamma|Delta|infty|times|div|leq|geq)/.test(withMatrices)) {
    return withMatrices.replace(
      /(\\(?:int|sum|frac|sqrt|sin|cos|tan|log|ln|pi|theta|alpha|beta|gamma|Delta|infty|times|div|leq|geq)[^.,;!?]*)(?=[.,;!?]|$)/g,
      "$$1$",
    );
  }

  return withMatrices;
}
