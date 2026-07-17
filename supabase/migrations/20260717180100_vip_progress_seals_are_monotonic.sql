-- Once a course week is sealed, no normal update may clear that state.
-- The seal endpoint remains the only path that transitions false -> true.

CREATE OR REPLACE FUNCTION public.prevent_vip_progress_unseal()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_sealed AND NOT NEW.is_sealed THEN
    RAISE EXCEPTION 'A sealed VIP course week cannot be unsealed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  -- vip_progress is currently bootstrapped by ensureVipCourseSchema rather
  -- than an earlier Supabase migration. Fresh databases get this trigger from
  -- that ensure helper once the table exists.
  IF to_regclass('public.vip_progress') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS vip_progress_prevent_unseal ON public.vip_progress;
    CREATE TRIGGER vip_progress_prevent_unseal
    BEFORE UPDATE OF is_sealed ON public.vip_progress
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_vip_progress_unseal();
  END IF;
END
$$;
