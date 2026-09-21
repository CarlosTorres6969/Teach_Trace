-- Ejecutar una vez en Supabase antes de desplegar con DATABASE_SYNCHRONIZE=false.
ALTER TABLE public."submissions"
  ADD COLUMN IF NOT EXISTS "aiPossibleGrade" double precision NULL,
  ADD COLUMN IF NOT EXISTS "aiStrengths" text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "aiImprovements" text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "aiComparison" text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "aiAnalyzedAt" timestamptz NULL;

-- Las preferencias y notificaciones usan simple-enum (varchar) en TypeORM;
-- no requieren una alteración de tipo para el nuevo evento AI_ANALYSIS_READY.
