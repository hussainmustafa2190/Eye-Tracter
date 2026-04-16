import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { getAllTasks } from '../data/phases'
import { loadVisiblePhaseIdsFromStorage } from '../data/phaseInventory'
import { requestPersist } from '../lib/storage'
import {
  CUSTOM_PHASES_KEY,
  CUSTOM_TASKS_KEY,
  DELETED_PHASES_KEY,
  DELETED_TASKS_KEY,
  PROGRESS_KEY,
} from '../lib/storageKeys'

/** Persists completed task ids as JSON string array (checkbox state). */
const STORAGE_KEY = PROGRESS_KEY

const BASE_TASKS = getAllTasks()

type CustomTask = {
  id: string
  phaseId: number
  sectionLabel: string
  text: string
  tip?: string
}

function loadStoredIds(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((x): x is string => typeof x === 'string'))
  } catch {
    return new Set()
  }
}

function persistIds(ids: Set<string>) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]))
  } catch {
    /* ignore quota / private mode */
  }
  requestPersist()
}

function loadCustomTasks(): CustomTask[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(CUSTOM_TASKS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    const out: CustomTask[] = []
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue
      const r = item as Record<string, unknown>
      if (
        typeof r.id === 'string' &&
        typeof r.phaseId === 'number' &&
        typeof r.sectionLabel === 'string' &&
        typeof r.text === 'string'
      ) {
        out.push({
          id: r.id,
          phaseId: r.phaseId,
          sectionLabel: r.sectionLabel,
          text: r.text,
          tip: typeof r.tip === 'string' ? r.tip : undefined,
        })
      }
    }
    return out
  } catch {
    return []
  }
}

function loadDeletedTaskIds(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = window.localStorage.getItem(DELETED_TASKS_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((x): x is string => typeof x === 'string'))
  } catch {
    return new Set()
  }
}

function getVisibleTasksSnapshot() {
  const visiblePhaseIds = loadVisiblePhaseIdsFromStorage()
  const deleted = loadDeletedTaskIds()
  let base = deleted.size ? BASE_TASKS.filter((t) => !deleted.has(t.id)) : [...BASE_TASKS]
  base = base.filter((t) => visiblePhaseIds.has(t.phaseId))

  const seenCustom = new Set<string>()
  const custom: CustomTask[] = []
  for (const t of loadCustomTasks()) {
    if (!visiblePhaseIds.has(t.phaseId)) continue
    if (seenCustom.has(t.id)) continue
    seenCustom.add(t.id)
    custom.push(t)
  }

  const all = [...base, ...custom]

  const idsByPhase: Record<number, string[]> = {}
  for (const t of all) {
    if (!idsByPhase[t.phaseId]) idsByPhase[t.phaseId] = []
    idsByPhase[t.phaseId].push(t.id)
  }

  return { all, idsByPhase }
}

export type TaskProgressContextValue = {
  completedIds: Set<string>
  toggleTask: (id: string) => void
  getPhaseProgress: (phaseId: number) => { done: number; total: number }
  getTotalProgress: () => { done: number; total: number }
  resetProgress: () => void
  removeCompletedForTaskIds: (ids: string[]) => void
  /** Call after any task inventory change in localStorage (same-tab custom tasks / deletions). */
  bumpTaskInventory: () => void
}

const TaskProgressContext = createContext<TaskProgressContextValue | null>(null)

function useTaskProgressInternal(): TaskProgressContextValue {
  const [completedIds, setCompletedIds] = useState<Set<string>>(() => loadStoredIds())
  const [taskInventoryVersion, setTaskInventoryVersion] = useState(0)

  const bumpTaskInventory = useCallback(() => {
    setTaskInventoryVersion((v) => v + 1)
  }, [])

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY && e.newValue != null) {
        try {
          const parsed = JSON.parse(e.newValue) as unknown
          if (!Array.isArray(parsed)) return
          setCompletedIds(new Set(parsed.filter((x): x is string => typeof x === 'string')))
        } catch {
          /* ignore */
        }
      }
      if (
        e.key === CUSTOM_TASKS_KEY ||
        e.key === DELETED_TASKS_KEY ||
        e.key === DELETED_PHASES_KEY ||
        e.key === CUSTOM_PHASES_KEY
      ) {
        bumpTaskInventory()
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [bumpTaskInventory])

  const toggleTask = useCallback((id: string) => {
    setCompletedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      persistIds(next)
      return next
    })
  }, [])

  const getPhaseProgress = useCallback((phaseId: number) => {
    const { idsByPhase } = getVisibleTasksSnapshot()
    const ids = idsByPhase[phaseId] ?? []
    const total = ids.length
    const done = ids.filter((taskId) => completedIds.has(taskId)).length
    return { done, total }
  }, [completedIds, taskInventoryVersion])

  const getTotalProgress = useCallback(() => {
    const { all } = getVisibleTasksSnapshot()
    const total = all.length
    const done = all.filter((t) => completedIds.has(t.id)).length
    return { done, total }
  }, [completedIds, taskInventoryVersion])

  const resetProgress = useCallback(() => {
    const empty = new Set<string>()
    setCompletedIds(empty)
    persistIds(empty)
  }, [])

  const removeCompletedForTaskIds = useCallback((ids: string[]) => {
    if (ids.length === 0) return
    const toRemove = new Set(ids)
    setCompletedIds((prev) => {
      const next = new Set(prev)
      let changed = false
      for (const id of toRemove) {
        if (next.has(id)) {
          next.delete(id)
          changed = true
        }
      }
      if (changed) persistIds(next)
      return next
    })
  }, [])

  return useMemo(
    () => ({
      completedIds,
      toggleTask,
      getPhaseProgress,
      getTotalProgress,
      resetProgress,
      removeCompletedForTaskIds,
      bumpTaskInventory,
    }),
    [
      completedIds,
      toggleTask,
      getPhaseProgress,
      getTotalProgress,
      resetProgress,
      removeCompletedForTaskIds,
      bumpTaskInventory,
    ],
  )
}

export function TaskProgressProvider({ children }: { children: ReactNode }) {
  const value = useTaskProgressInternal()
  return <TaskProgressContext.Provider value={value}>{children}</TaskProgressContext.Provider>
}

export function useTaskProgress(): TaskProgressContextValue {
  const ctx = useContext(TaskProgressContext)
  if (!ctx) {
    throw new Error('useTaskProgress must be used within TaskProgressProvider')
  }
  return ctx
}
