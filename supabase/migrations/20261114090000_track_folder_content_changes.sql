-- Review progress does not change the contents of a folder.
DROP TRIGGER user_library_update_touch_folder_activity ON public.user_library;
CREATE TRIGGER user_library_update_touch_folder_activity
AFTER UPDATE OF selected_definitions, source, is_ai_generated, is_starred
ON public.user_library
FOR EACH ROW
WHEN (
  ROW(OLD.selected_definitions, OLD.source, OLD.is_ai_generated, OLD.is_starred)
  IS DISTINCT FROM
  ROW(NEW.selected_definitions, NEW.source, NEW.is_ai_generated, NEW.is_starred)
)
EXECUTE FUNCTION public.touch_library_folder_activity();

-- Keep existing memberships so their folders and added dates do not change.
CREATE OR REPLACE FUNCTION public.update_word_folders(
  p_user_id uuid, p_library_id bigint, p_folder_ids uuid[]
) RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  requested_ids uuid[] := COALESCE(p_folder_ids, ARRAY[]::uuid[]);
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Cannot update another user''s folder memberships' USING ERRCODE = '42501';
  END IF;

  PERFORM 1 FROM public.user_library
  WHERE id = p_library_id AND user_id = p_user_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Word not found in the current user''s library' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1 FROM unnest(requested_ids) AS requested(folder_id)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.folders
      WHERE id = requested.folder_id AND user_id = p_user_id
    )
  ) THEN
    RAISE EXCEPTION 'Folder not found in the current user''s library' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.library_folder_map
  WHERE library_id = p_library_id AND user_id = p_user_id
    AND NOT (folder_id = ANY(requested_ids));

  INSERT INTO public.library_folder_map (library_id, folder_id, user_id)
  SELECT p_library_id, requested.folder_id, p_user_id
  FROM unnest(requested_ids) AS requested(folder_id)
  ON CONFLICT (library_id, folder_id) DO NOTHING;
END;
$$;
