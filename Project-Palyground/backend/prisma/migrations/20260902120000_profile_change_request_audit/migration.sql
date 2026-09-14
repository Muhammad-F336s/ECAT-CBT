CREATE TABLE "ProfileChangeRequestAudit" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "note" TEXT,
  "adminId" TEXT,
  "adminName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProfileChangeRequestAudit_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProfileChangeRequestAudit_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ProfileChangeRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProfileChangeRequestAudit_requestId_idx" ON "ProfileChangeRequestAudit"("requestId");