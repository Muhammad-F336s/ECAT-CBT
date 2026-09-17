import Latex from "react-latex-next";
import { convertMathPlaceholders } from "../utils/mathUtils";

// The single math-rendering gateway for questions, answers and explanations.
// Keep all LaTex normalization here so every surface renders identically.
export default function MathText({ text, className }) {
  const normalized = convertMathPlaceholders(String(text || ""));
  return <span className={className}><Latex>{normalized}</Latex></span>;
}