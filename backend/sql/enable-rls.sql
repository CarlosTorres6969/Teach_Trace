-- TeachTrace no usa la API REST de Supabase desde el navegador: toda lectura
-- y escritura pasa por NestJS mediante la conexión privada de PostgreSQL.
--
-- Activamos RLS en todas las tablas públicas y dejamos explícitamente
-- bloqueados los roles que usa la API pública de Supabase. No usamos FORCE
-- ROW LEVEL SECURITY porque el backend se conecta como postgres y debe seguir
-- pudiendo operar sobre sus tablas.
BEGIN;

DO $$
DECLARE
  table_record record;
BEGIN
  FOR table_record IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename <> 'spatial_ref_sys'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',
      table_record.tablename
    );

    EXECUTE format(
      'DROP POLICY IF EXISTS teachtrace_deny_public_api ON public.%I',
      table_record.tablename
    );

    EXECUTE format(
      'CREATE POLICY teachtrace_deny_public_api ON public.%I FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)',
      table_record.tablename
    );
  END LOOP;
END $$;

COMMIT;
