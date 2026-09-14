CREATE TABLE "ProfileChangeRequest" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "currentTrack" TEXT NOT NULL,
  "currentSubjects" TEXT[] NOT NULL,
  "requestedTrack" TEXT NOT NULL,
  "requestedSubjects" TEXT[] NOT NULL,
  "reason" TEXT NOT NULL,
  "transactionId" TEXT,
  "receiptProof" TEXT,
  "status" TEXT NOT NULL DEFAULT 'Pending payment verification',
  "adminReason" TEXT,
  "reviewedByAdminId" TEXT,
  "reviewedByName" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "appliedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProfileChangeRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProfileChangeRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProfileChangeRequest_userId_idx" ON "ProfileChangeRequest"("userId");
