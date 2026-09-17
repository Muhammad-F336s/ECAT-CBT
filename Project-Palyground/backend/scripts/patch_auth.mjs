import fs from "fs";
let code = fs.readFileSync("src/controllers/authController.js", "utf8");
const target = `    } else {
      await prisma.user.create({
        data: {
          name: pendingUser.name,
          email: pendingUser.email,
          password: pendingUser.password,
          role: pendingUser.role,
          domain: pendingUser.domain,
          cnic: pendingUser.cnic,
          isApproved: pendingUser.isApproved,
          isEmailVerified: true,
          packageType: pendingUser.packageType,
          testAttemptsLimit: pendingUser.testAttemptsLimit,
        }
      });
    }`;

const replacement = `    } else {
      const now = new Date();
      const starterExpiresAt = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
      await prisma.user.create({
        data: {
          name: pendingUser.name,
          email: pendingUser.email,
          password: pendingUser.password,
          role: pendingUser.role,
          domain: pendingUser.domain,
          cnic: pendingUser.cnic,
          isApproved: pendingUser.isApproved,
          isEmailVerified: true,
          packageType: "STARTER",
          packageStartedAt: now,
          packageExpiresAt: starterExpiresAt,
          remainingTestAttempts: 2,
          testAttemptsLimit: 2,
          starterClaimedAt: now,
        }
      });
    }`;

const targetCRLF = target.replace(/\r?\n/g, "\r\n");
const targetLF = target.replace(/\r?\n/g, "\n");

if (code.includes(targetLF)) {
  code = code.replace(targetLF, replacement.replace(/\r?\n/g, "\n"));
  fs.writeFileSync("src/controllers/authController.js", code, "utf8");
  console.log("PATCHED_LF");
} else if (code.includes(targetCRLF)) {
  code = code.replace(targetCRLF, replacement.replace(/\r?\n/g, "\r\n"));
  fs.writeFileSync("src/controllers/authController.js", code, "utf8");
  console.log("PATCHED_CRLF");
} else {
  console.log("TARGET_NOT_FOUND");
}
