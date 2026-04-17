import {
  ALL_SYNCED_STORAGE_KEYS,
  APP_DATA_ROW_ID,
  CUSTOM_PHASES_KEY,
  CUSTOM_SECTIONS_KEY,
  CUSTOM_TASKS_KEY,
  DELETED_PHASES_KEY,
  DELETED_SECTIONS_KEY,
  DELETED_TASKS_KEY,
  PHASE_RENAMES_KEY,
  PROGRESS_KEY,
  RENAME_HINT_KEY,
  TEXT_EDITS_KEY,
  TIP_EDITS_KEY,
} from './storageKeys'
import { supabase } from './supabase'

/** Versioned JSON stored in the `phases` column (all non-checkbox app state). */
export type PhasesPayloadV1 = {
  v: 1
  customPhases: unknown[]
  deletedPhaseIds: number[]
  phaseRenames: Record<string, string>
  customTasks: unknown[]
  deletedTaskIds: string[]
  customSections: unknown[]
  deletedSectionIds: string[]
  textEdits: Record<string, string>
  tipEdits: Record<string, string>
  /** `null` if key absent */
  renameHint: string | null
}

export type AppDataRow = {
  id: string
  phases: PhasesPayloadV1 | unknown[] | null
  completed_ids: string[] | null
  updated_at?: string
}

function safeParseJson<T>(raw: string | null, fallback: T): T {
  if (raw == null || raw === '') return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function readLs(key: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeLs(key: string, value: unknown) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* ignore */
  }
}

function writeLsRaw(key: string, value: string) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, value)
  } catch {
    /* ignore */
  }
}

function normalizeCompletedIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((x): x is string => typeof x === 'string')
}

function buildPhasesPayloadV1FromLocalStorage(): PhasesPayloadV1 {
  const customPhases = safeParseJson<unknown[]>(readLs(CUSTOM_PHASES_KEY), [])
  const deletedPhaseIdsRaw = safeParseJson<unknown[]>(readLs(DELETED_PHASES_KEY), [])
  const deletedPhaseIds = deletedPhaseIdsRaw.filter((x): x is number => typeof x === 'number')

  const phaseRenamesObj = safeParseJson<Record<string, unknown>>(readLs(PHASE_RENAMES_KEY), {})
  const phaseRenames: Record<string, string> = {}
  for (const [k, v] of Object.entries(phaseRenamesObj)) {
    if (typeof v === 'string') phaseRenames[k] = v
  }

  const customTasks = safeParseJson<unknown[]>(readLs(CUSTOM_TASKS_KEY), [])
  const deletedTaskIds = safeParseJson<string[]>(readLs(DELETED_TASKS_KEY), []).filter(
    (x): x is string => typeof x === 'string',
  )
  const customSections = safeParseJson<unknown[]>(readLs(CUSTOM_SECTIONS_KEY), [])
  const deletedSectionIds = safeParseJson<string[]>(readLs(DELETED_SECTIONS_KEY), []).filter(
    (x): x is string => typeof x === 'string',
  )

  const textEditsRaw = safeParseJson<Record<string, unknown>>(readLs(TEXT_EDITS_KEY), {})
  const textEdits: Record<string, string> = {}
  for (const [k, v] of Object.entries(textEditsRaw)) {
    if (typeof v === 'string') textEdits[k] = v
  }
  const tipEditsRaw = safeParseJson<Record<string, unknown>>(readLs(TIP_EDITS_KEY), {})
  const tipEdits: Record<string, string> = {}
  for (const [k, v] of Object.entries(tipEditsRaw)) {
    if (typeof v === 'string') tipEdits[k] = v
  }

  const hintRaw = readLs(RENAME_HINT_KEY)
  const renameHint = hintRaw === null ? null : hintRaw

  return {
    v: 1,
    customPhases: Array.isArray(customPhases) ? customPhases : [],
    deletedPhaseIds,
    phaseRenames,
    customTasks: Array.isArray(customTasks) ? customTasks : [],
    deletedTaskIds,
    customSections: Array.isArray(customSections) ? customSections : [],
    deletedSectionIds,
    textEdits,
    tipEdits,
    renameHint,
  }
}

/** Build the row to upsert from current localStorage (source of truth before remote ack). */
export function buildAppDataUpsertPayload(): {
  id: string
  phases: PhasesPayloadV1
  completed_ids: string[]
  updated_at: string
} {
  const progressRaw = readLs(PROGRESS_KEY)
  const completed_ids = normalizeCompletedIds(safeParseJson(progressRaw, []))

  return {
    id: APP_DATA_ROW_ID,
    phases: buildPhasesPayloadV1FromLocalStorage(),
    completed_ids,
    updated_at: new Date().toISOString(),
  }
}

/** Write remote row into localStorage so existing hooks/components keep working. */
export function applySnapshotFromRow(row: AppDataRow) {
  const completed = normalizeCompletedIds(row.completed_ids)
  writeLs(PROGRESS_KEY, completed)

  const phases = row.phases
  if (Array.isArray(phases)) {
    writeLs(CUSTOM_PHASES_KEY, phases)
    return
  }

  if (phases && typeof phases === 'object' && (phases as PhasesPayloadV1).v === 1) {
    const p = phases as PhasesPayloadV1
    writeLs(CUSTOM_PHASES_KEY, Array.isArray(p.customPhases) ? p.customPhases : [])
    writeLs(DELETED_PHASES_KEY, Array.isArray(p.deletedPhaseIds) ? p.deletedPhaseIds : [])
    writeLs(PHASE_RENAMES_KEY, p.phaseRenames && typeof p.phaseRenames === 'object' ? p.phaseRenames : {})
    writeLs(CUSTOM_TASKS_KEY, Array.isArray(p.customTasks) ? p.customTasks : [])
    writeLs(DELETED_TASKS_KEY, Array.isArray(p.deletedTaskIds) ? p.deletedTaskIds : [])
    writeLs(CUSTOM_SECTIONS_KEY, Array.isArray(p.customSections) ? p.customSections : [])
    writeLs(DELETED_SECTIONS_KEY, Array.isArray(p.deletedSectionIds) ? p.deletedSectionIds : [])
    writeLs(TEXT_EDITS_KEY, p.textEdits && typeof p.textEdits === 'object' ? p.textEdits : {})
    writeLs(TIP_EDITS_KEY, p.tipEdits && typeof p.tipEdits === 'object' ? p.tipEdits : {})
    if (p.renameHint == null || p.renameHint === '') {
      try {
        window.localStorage.removeItem(RENAME_HINT_KEY)
      } catch {
        /* ignore */
      }
    } else {
      writeLsRaw(RENAME_HINT_KEY, p.renameHint)
    }
    return
  }

  /* Unknown shape — still apply checkbox column */
}

/** Mirror payload to localStorage after a successful remote save (cache). */
export function mirrorPayloadToLocalStorage(payload: ReturnType<typeof buildAppDataUpsertPayload>) {
  applySnapshotFromRow(payload)
}

export async function upsertSnapshotToSupabase(): Promise<{ error: Error | null }> {
  const payload = buildAppDataUpsertPayload()
  if (!supabase) {
    return { error: null }
  }
  const { error } = await supabase.from('app_data').upsert(payload, { onConflict: 'id' })
  if (!error) {
    mirrorPayloadToLocalStorage(payload)
  }
  return { error: error ? new Error(error.message) : null }
}

/** Remove every synced key from localStorage (used on full reset). */
export function clearAllSyncedLocalKeys() {
  if (typeof window === 'undefined') return
  for (const key of ALL_SYNCED_STORAGE_KEYS) {
    try {
      window.localStorage.removeItem(key)
    } catch {
      /* ignore */
    }
  }
}
