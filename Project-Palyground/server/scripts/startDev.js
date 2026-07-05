import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const serverRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const runStep = (label, command, args) =>
  new Promise((resolvePromise, reject) => {
    console.log(`\n▶ ${label}...`);
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

const bootstrap = async () => {
  try {
    await runStep("Applying database schema", "node", ["src/setupDatabase.js"]);
    await runStep("Generating Prisma client", "npm", [
      "run",
      "prisma:generate",
    ]);
    console.log("\n✅ Database ready. Starting API server...\n");
  } catch (error) {
    console.error("\n❌ Startup database step failed:", error.message);
    console.error("Fix DATABASE_URL in server/.env, then restart.\n");
    process.exit(1);
  }

  const server = spawn("npx", ["nodemon", "src/app.js"], {
    cwd: serverRoot,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  server.on("close", (code) => process.exit(code ?? 0));
};

bootstrap();
