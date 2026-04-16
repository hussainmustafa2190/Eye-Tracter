import { PHASES } from './phases'

const DELETED_PHASES_KEY = 'fea-pco-deleted-phases'
const CUSTOM_PHASES_KEY = 'fea-pco-custom-phases'

function loadJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

/** Phase IDs that exist in the tab bar: built-in (none by default) + custom, minus deleted. */
export function loadVisiblePhaseIdsFromStorage(): Set<number> {
  if (typeof window === 'undefined') {
    return new Set(PHASES.map((p) => p.id))
  }
  const deletedArr = loadJson<unknown>(DELETED_PHASES_KEY, [])
  const deletedSet = new Set<number>(
    Array.isArray(deletedArr) ? deletedArr.filter((x): x is number => typeof x === 'number') : [],
  )
  const baseIds = PHASES.map((p) => p.id).filter((id) => !deletedSet.has(id))
  const customRaw = loadJson<unknown>(CUSTOM_PHASES_KEY, [])
  const customIds: number[] = []
  if (Array.isArray(customRaw)) {
    for (const item of customRaw) {
      if (!item || typeof item !== 'object') continue
      const id = (item as Record<string, unknown>).id
      if (typeof id === 'number' && !deletedSet.has(id)) customIds.push(id)
    }
  }
  return new Set([...baseIds, ...customIds])
}
