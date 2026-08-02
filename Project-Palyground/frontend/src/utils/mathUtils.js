export function convertMathPlaceholders(text) {
  if (!text || typeof text !== "string") return text;

  return text.replace(/MATH\[([\s\S]*?)\]/g, (match, p1) => {
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
}
