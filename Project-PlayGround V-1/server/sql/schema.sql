-- Enable pgcrypto for UUID generation functions used in default values
create extension if not exists pgcrypto;

-- Prisma auth & platform tables (quoted names match schema.prisma)
create table if not exists "User" (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  email text not null unique,
  password text not null,
  role text not null default 'student',
  "isApproved" boolean not null default false,
  "testAttemptsLimit" integer not null default 0,
  "createdAt" timestamptz not null default now()
);

create table if not exists "Admin" (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  email text not null unique,
  password text not null,
  "secretHash" text not null,
  "secretCode" text,
  rank text not null default 'Admin',
  "isFrozen" boolean not null default false,
  "createdAt" timestamptz not null default now()
);

create table if not exists "LoginMessage" (
  id text primary key default gen_random_uuid()::text,
  "recipientEmail" text not null,
  "recipientRole" text not null,
  body text not null,
  "senderEmail" text,
  "showSenderEmail" boolean not null default true,
  "isRead" boolean not null default false,
  "createdAt" timestamptz not null default now()
);

create table if not exists "TestAttempt" (
  id text primary key default gen_random_uuid()::text,
  "userId" text not null references "User"(id) on delete cascade,
  score real not null,
  "totalMarks" integer not null,
  breakdown jsonb,
  "createdAt" timestamptz not null default now()
);

create index if not exists "TestAttempt_userId_idx" on "TestAttempt"("userId");
create index if not exists "LoginMessage_recipientEmail_idx" on "LoginMessage"("recipientEmail");

-- CBT content tables (Subject → Chapter → Question → Option)
create table if not exists "Subject" (
  id text primary key default gen_random_uuid()::text,
  name text not null unique,
  "createdAt" timestamptz not null default now()
);

create table if not exists "Chapter" (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  "subjectId" text not null references "Subject"(id) on delete cascade,
  "createdAt" timestamptz not null default now()
);

create table if not exists "Question" (
  id text primary key default gen_random_uuid()::text,
  statement text not null,
  "chapterId" text not null references "Chapter"(id) on delete cascade,
  "correctAnswer" text not null,
  explanation text,
  "createdAt" timestamptz not null default now()
);

create table if not exists "Option" (
  id text primary key default gen_random_uuid()::text,
  text text not null,
  "questionId" text not null references "Question"(id) on delete cascade
);

create index if not exists "Chapter_subjectId_idx" on "Chapter"("subjectId");
create index if not exists "Question_chapterId_idx" on "Question"("chapterId");
create index if not exists "Option_questionId_idx" on "Option"("questionId");

-- Resource Library tables
create table if not exists "ResourceGroup" (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  description text,
  "createdAt" timestamptz not null default now()
);

create table if not exists "ResourceFile" (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  type text not null,
  size text not null,
  "uploadDate" text not null,
  downloads integer not null default 0,
  "resourceGroupId" text not null references "ResourceGroup"(id) on delete cascade,
  "createdAt" timestamptz not null default now()
);

create table if not exists "ResourceItem" (
  id text primary key default gen_random_uuid()::text,
  title text not null,
  points integer not null default 0,
  "resourceGroupId" text not null references "ResourceGroup"(id) on delete cascade,
  "createdAt" timestamptz not null default now()
);

create index if not exists "ResourceFile_resourceGroupId_idx" on "ResourceFile"("resourceGroupId");
create index if not exists "ResourceItem_resourceGroupId_idx" on "ResourceItem"("resourceGroupId");

-- Migration: Add breakdown column to existing TestAttempt table if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'TestAttempt' AND column_name = 'breakdown'
  ) THEN
    ALTER TABLE "TestAttempt" ADD COLUMN breakdown jsonb;
  END IF;
END $$;

-- Migration: Change score column from integer to real (float) for negative marking support
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'TestAttempt' AND column_name = 'score' AND data_type = 'integer'
  ) THEN
    ALTER TABLE "TestAttempt" ALTER COLUMN score TYPE real;
  END IF;
END $$;
