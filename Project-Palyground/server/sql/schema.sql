-- Enable pgcrypto for UUID generation functions used in default values
create extension if not exists pgcrypto;

-- Users table: stores registered users (students and admins)
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text unique,
  role text not null default 'student' check (role in ('student', 'admin')),
  created_at timestamptz not null default now()
);

-- Exams table: metadata for each exam
create table if not exists exams (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  duration_minutes integer not null default 60 check (duration_minutes > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Questions table: each question belongs to an exam
create table if not exists questions (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references exams(id) on delete cascade,
  prompt text not null,
  explanation text,
  points integer not null default 1 check (points > 0),
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- Choices table: possible choices for each question
create table if not exists choices (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references questions(id) on delete cascade,
  label text not null,
  body text not null,
  is_correct boolean not null default false,
  display_order integer not null default 0
);

-- Attempts table: one row per user attempt at an exam
create table if not exists attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  exam_id uuid not null references exams(id) on delete cascade,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  score integer not null default 0
);

-- Attempt answers: stores selected choice per question for an attempt
create table if not exists attempt_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references attempts(id) on delete cascade,
  question_id uuid not null references questions(id) on delete cascade,
  choice_id uuid references choices(id) on delete set null,
  is_correct boolean not null default false,
  answered_at timestamptz not null default now(),
  unique (attempt_id, question_id)
);

-- Indexes to speed up common queries by foreign keys
create index if not exists idx_questions_exam_id on questions(exam_id);
create index if not exists idx_choices_question_id on choices(question_id);
create index if not exists idx_attempts_exam_id on attempts(exam_id);
create index if not exists idx_attempts_user_id on attempts(user_id);
