import { createVocabularyWord } from '../models';



const normalizeSelectedDefinitions = (raw) => {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
};

const mapLibraryRowToWord = (item) => {
  const normalizedFolderIds = (() => {
    // 1. Try to read from the new Junction Table (Relation)
    if (item.library_folder_map) {
      if (Array.isArray(item.library_folder_map)) {
        const ids = item.library_folder_map
          .map(ref => ref.folder_id?.toString())
          .filter(Boolean);
        if (ids.length > 0) return ids;
      } else if (typeof item.library_folder_map === 'object') {
        // Fallback for object-type response if relationship is 1-to-1 somehow
        const folderIdStr = item.library_folder_map.folder_id?.toString();
        if (folderIdStr) return [folderIdStr];
      }
    }

    // 2. Fallback: Single folder_id (Legacy - if still populated via joins)
    const legacyFolderId = item.folder_id ?? item.folderId ?? null;
    if (legacyFolderId) {
      return [legacyFolderId.toString()];
    }

    return [];
  })();

  const normalizedSelectedDefinitions = normalizeSelectedDefinitions(item.selected_definitions);

  return createVocabularyWord({
    ...item.dictionary,
    audioUrl: item.dictionary?.audioUrl ?? item.dictionary?.audio_url ?? null,
    usAudioUrl: item.dictionary?.usAudioUrl ?? item.dictionary?.us_audio_url ?? null,
    ukAudioUrl: item.dictionary?.ukAudioUrl ?? item.dictionary?.uk_audio_url ?? null,
    id: item.word_id?.toString() || '',
    libraryId: item.id,
    folderIds: normalizedFolderIds,
    selectedDefinitions: normalizedSelectedDefinitions,
    addedAt: item.created_at || null,
    nextReview: item.next_review || item.due || new Date().toISOString(),
    proficiencyScore: item.proficiency_score,
    due: item.due || item.next_review || new Date().toISOString(),
    stability: item.stability ?? null,
    difficulty: item.difficulty ?? null,
    elapsed_days: item.elapsed_days ?? null,
    scheduled_days: item.scheduled_days ?? null,
    reps: item.reps ?? null,
    lapses: item.lapses ?? null,
    state: item.state ?? null,
    last_review: item.last_review ?? null,
    source: item.source ?? item.dictionary?.source ?? null,
    isAiGenerated: item.is_ai_generated ?? item.dictionary?.is_ai_generated ?? item.dictionary?.isAiGenerated ?? false,
    isStarred: item.is_starred ?? false
  });
};

export { mapLibraryRowToWord };
