import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const serverRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const runStep = (label, command, args) =>
  new Promise((resolvePromise, reject) => {
    console.log(`▶ ${label}...`);
    const needsShell =
      process.platform === "win32" && (command === "npm" || command === "npx");
    const child = spawn(command, args, {
      cwd: serverRoot,
      stdio: "inherit",
      shell: needsShell,
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      reject(new Error(`${label} failed with exit code ${code}`));
    });
  });

try {
  await runStep("Applying database schema", "node", ["src/setupDatabase.js"]);
  await runStep("Generating Prisma client", "npm", ["run", "prisma:generate"]);
  console.log("Database ready.\n");
} catch (error) {
  console.error("Startup database step failed:", error.message);
  process.exit(1);
}

await import("../src/app.js");
