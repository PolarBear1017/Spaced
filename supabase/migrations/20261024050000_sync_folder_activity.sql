ALTER TABLE public.folders
ADD COLUMN IF NOT EXISTS last_activity_at timestamp with time zone;

-- Seed existing folders from the activity history that is already available.
UPDATE public.folders AS folder
SET last_activity_at = GREATEST(
  folder.created_at,
  COALESCE((
    SELECT MAX(map.created_at)
    FROM public.library_folder_map AS map
    WHERE map.folder_id = folder.id
  ), '-infinity'::timestamp with time zone),
  COALESCE((
    SELECT MAX(COALESCE(library.last_review, library.created_at))
    FROM public.library_folder_map AS map
    JOIN public.user_library AS library ON library.id = map.library_id
    WHERE map.folder_id = folder.id
  ), '-infinity'::timestamp with time zone)
)
WHERE folder.last_activity_at IS NULL;

ALTER TABLE public.folders
ALTER COLUMN last_activity_at SET DEFAULT now(),
ALTER COLUMN last_activity_at SET NOT NULL;

CREATE OR REPLACE FUNCTION public.set_folder_own_activity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF ROW(NEW.name, NEW.description) IS DISTINCT FROM ROW(OLD.name, OLD.description) THEN
    NEW.last_activity_at := clock_timestamp();
  END IF;
  RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION public.touch_mapped_folder_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  activity_time timestamp with time zone := clock_timestamp();
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.folders
    SET last_activity_at = activity_time
    WHERE id = NEW.folder_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.folders
    SET last_activity_at = activity_time
    WHERE id = OLD.folder_id;
    RETURN OLD;
  END IF;

  UPDATE public.folders
  SET last_activity_at = activity_time
  WHERE id = OLD.folder_id OR id = NEW.folder_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.touch_library_folder_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target_library_id bigint;
BEGIN
  target_library_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END;

  UPDATE public.folders AS folder
  SET last_activity_at = clock_timestamp()
  WHERE folder.id IN (
    SELECT map.folder_id
    FROM public.library_folder_map AS map
    WHERE map.library_id = target_library_id
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS folders_set_own_activity ON public.folders;
CREATE TRIGGER folders_set_own_activity
BEFORE UPDATE OF name, description ON public.folders
FOR EACH ROW
EXECUTE FUNCTION public.set_folder_own_activity();

DROP TRIGGER IF EXISTS library_folder_map_touch_activity ON public.library_folder_map;
CREATE TRIGGER library_folder_map_touch_activity
AFTER INSERT OR DELETE OR UPDATE OF folder_id ON public.library_folder_map
FOR EACH ROW
EXECUTE FUNCTION public.touch_mapped_folder_activity();

DROP TRIGGER IF EXISTS user_library_update_touch_folder_activity ON public.user_library;
CREATE TRIGGER user_library_update_touch_folder_activity
AFTER UPDATE OF proficiency_score, next_review, due, stability, difficulty,
  elapsed_days, scheduled_days, reps, lapses, state, last_review,
  selected_definitions, source, is_ai_generated, is_starred
ON public.user_library
FOR EACH ROW
EXECUTE FUNCTION public.touch_library_folder_activity();

DROP TRIGGER IF EXISTS user_library_delete_touch_folder_activity ON public.user_library;
CREATE TRIGGER user_library_delete_touch_folder_activity
BEFORE DELETE ON public.user_library
FOR EACH ROW
EXECUTE FUNCTION public.touch_library_folder_activity();

REVOKE ALL ON FUNCTION public.set_folder_own_activity() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.touch_mapped_folder_activity() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.touch_library_folder_activity() FROM PUBLIC;

-- Realtime updates let another open device reorder immediately. Focus/manual sync
-- remains the fallback when a device is temporarily disconnected.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'folders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.folders;
  END IF;
END;
$$;
