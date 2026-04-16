/** Single-user row for Supabase `app_data`. */
export const APP_DATA_ROW_ID = 'user-1'

export const PROGRESS_KEY = 'fea-pco-progress'
export const CUSTOM_TASKS_KEY = 'fea-pco-custom-tasks'
export const DELETED_TASKS_KEY = 'fea-pco-deleted'
export const DELETED_PHASES_KEY = 'fea-pco-deleted-phases'
export const CUSTOM_PHASES_KEY = 'fea-pco-custom-phases'
export const PHASE_RENAMES_KEY = 'fea-pco-phase-renames'
export const CUSTOM_SECTIONS_KEY = 'fea-pco-custom-sections'
export const DELETED_SECTIONS_KEY = 'fea-pco-deleted-sections'
export const TEXT_EDITS_KEY = 'fea-pco-edits'
export const TIP_EDITS_KEY = 'fea-pco-tip-edits'
export const RENAME_HINT_KEY = 'fea-pco-rename-hint'

export const ALL_SYNCED_STORAGE_KEYS = [
  PROGRESS_KEY,
  CUSTOM_TASKS_KEY,
  DELETED_TASKS_KEY,
  DELETED_PHASES_KEY,
  CUSTOM_PHASES_KEY,
  PHASE_RENAMES_KEY,
  CUSTOM_SECTIONS_KEY,
  DELETED_SECTIONS_KEY,
  TEXT_EDITS_KEY,
  TIP_EDITS_KEY,
  RENAME_HINT_KEY,
] as const
