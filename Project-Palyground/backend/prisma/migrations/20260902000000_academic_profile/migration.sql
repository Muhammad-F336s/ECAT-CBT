ALTER TABLE "User"
  ADD COLUMN "academicTrack" TEXT,
  ADD COLUMN "academicSubjects" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "academicProfileCompleted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "academicProfileEditExpiresAt" TIMESTAMP(3);
