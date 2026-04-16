import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PhasePercentBadge } from './PhasePercentBadge'
import type { Phase, Task } from '../data/types'
import { useTaskProgress } from '../hooks/useTaskProgress'
import { requestPersist } from '../lib/storage'

const TEXT_EDITS_KEY = 'fea-pco-edits'
const TIP_EDITS_KEY = 'fea-pco-tip-edits'
const CUSTOM_TASKS_KEY = 'fea-pco-custom-tasks'
const DELETED_KEY = 'fea-pco-deleted'
const CUSTOM_SECTIONS_KEY = 'fea-pco-custom-sections'
const DELETED_SECTIONS_KEY = 'fea-pco-deleted-sections'

type PhaseCardProps = {
  phase: Phase
  tasks: Task[]
  isOpen?: boolean
  defaultOpen?: boolean
  onToggle?: (phaseId: number, isOpen: boolean) => void
  /** When this value changes, append a task to the last section (or "General") and open it for editing. */
  requestAddTaskNonce?: number
  onAddTaskConsumed?: () => void
}

type EditsMap = Record<string, string>

type EditingState =
  | { taskId: string; field: 'text' | 'tip'; draft: string }
  | null

type CustomTask = Pick<Task, 'id' | 'phaseId' | 'sectionLabel' | 'text' | 'tip'>
type CustomSection = { id: string; phaseId: number; label: string }

function loadEdits(key: string): EditsMap {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    const out: EditsMap = {}
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === 'string') out[k] = v
    }
    return out
  } catch {
    return {}
  }
}

function persistEdits(key: string, edits: EditsMap) {
  try {
    window.localStorage.setItem(key, JSON.stringify(edits))
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

function persistCustomTasks(tasks: CustomTask[]) {
  try {
    window.localStorage.setItem(CUSTOM_TASKS_KEY, JSON.stringify(tasks))
  } catch {
    /* ignore quota / private mode */
  }
  requestPersist()
}

/** IDs are only for custom tasks — never use built-in / total task counts from phases.ts. */
function nextCustomTaskIdFromExisting(tasks: CustomTask[]): string {
  let maxSuffix = 0
  for (const t of tasks) {
    const m = /^custom-task-(\d+)$/.exec(t.id)
    if (m) maxSuffix = Math.max(maxSuffix, Number(m[1]))
  }
  return `custom-task-${maxSuffix + 1}`
}

function loadDeletedIds(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(DELETED_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((x): x is string => typeof x === 'string')
  } catch {
    return []
  }
}

function persistDeletedIds(ids: string[]) {
  try {
    window.localStorage.setItem(DELETED_KEY, JSON.stringify(ids))
  } catch {
    /* ignore quota / private mode */
  }
  requestPersist()
}

function loadCustomSections(): CustomSection[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(CUSTOM_SECTIONS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    const out: CustomSection[] = []
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue
      const r = item as Record<string, unknown>
      if (typeof r.id === 'string' && typeof r.phaseId === 'number' && typeof r.label === 'string') {
        out.push({ id: r.id, phaseId: r.phaseId, label: r.label })
      }
    }
    return out
  } catch {
    return []
  }
}

function persistCustomSections(sections: CustomSection[]) {
  try {
    window.localStorage.setItem(CUSTOM_SECTIONS_KEY, JSON.stringify(sections))
  } catch {
    /* ignore quota / private mode */
  }
  requestPersist()
}

function loadDeletedSectionIds(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(DELETED_SECTIONS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((x): x is string => typeof x === 'string')
  } catch {
    return []
  }
}

function persistDeletedSectionIds(ids: string[]) {
  try {
    window.localStorage.setItem(DELETED_SECTIONS_KEY, JSON.stringify(ids))
  } catch {
    /* ignore quota / private mode */
  }
  requestPersist()
}

function autosize(el: HTMLTextAreaElement) {
  // Keep it simple: grow to fit content.
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

function PhaseCompleteIcon() {
  return (
    <span
      className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm ring-2 ring-emerald-200/80 dark:bg-emerald-600 dark:ring-emerald-900/50"
      aria-hidden
    >
      <svg className="size-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
        <path
          fillRule="evenodd"
          d="M16.704 4.153a.75.75 0 01.143 1.052l-7.5 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 6.948-9.817a.75.75 0 011.05-.143z"
          clipRule="evenodd"
        />
      </svg>
    </span>
  )
}

export function PhaseCard({
  phase,
  tasks,
  isOpen,
  defaultOpen = false,
  onToggle,
  requestAddTaskNonce,
  onAddTaskConsumed,
}: PhaseCardProps) {
  const { completedIds, toggleTask, bumpTaskInventory } = useTaskProgress()

  const saveCustomTasks = useCallback(
    (next: CustomTask[]) => {
      persistCustomTasks(next)
      bumpTaskInventory()
    },
    [bumpTaskInventory],
  )

  const saveDeletedTaskIds = useCallback(
    (ids: string[]) => {
      persistDeletedIds(ids)
      bumpTaskInventory()
    },
    [bumpTaskInventory],
  )
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen)
  const open = isOpen ?? uncontrolledOpen
  const [textEdits, setTextEdits] = useState<EditsMap>(() => loadEdits(TEXT_EDITS_KEY))
  const [tipEdits, setTipEdits] = useState<EditsMap>(() => loadEdits(TIP_EDITS_KEY))
  const [customTasks, setCustomTasks] = useState<CustomTask[]>(() => loadCustomTasks())
  const [deletedIds, setDeletedIds] = useState<Set<string>>(() => new Set(loadDeletedIds()))
  const [customSections, setCustomSections] = useState<CustomSection[]>(() => loadCustomSections())
  const [deletedSectionIds, setDeletedSectionIds] = useState<Set<string>>(() => new Set(loadDeletedSectionIds()))
  const [editing, setEditing] = useState<EditingState>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [confirmDeleteSectionId, setConfirmDeleteSectionId] = useState<string | null>(null)
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null)
  const [sectionDraft, setSectionDraft] = useState<string>('')

  const customBySection = useMemo(() => {
    const m = new Map<string, CustomTask[]>()
    for (const t of customTasks) {
      if (t.phaseId !== phase.id) continue
      const key = t.sectionLabel
      const prev = m.get(key)
      if (prev) prev.push(t)
      else m.set(key, [t])
    }
    return m
  }, [customTasks, phase.id])

  const visibleOriginalTasks = useMemo(() => {
    if (deletedIds.size === 0) return tasks
    return tasks.filter((t) => !deletedIds.has(t.id))
  }, [deletedIds, tasks])

  const sectionIdForOriginalLabel = (label: string) => `p${phase.id}:${label}`

  const visibleOriginalSections = useMemo(() => {
    if (deletedSectionIds.size === 0) return phase.sections
    return phase.sections.filter((s) => !deletedSectionIds.has(sectionIdForOriginalLabel(s.label)))
  }, [deletedSectionIds, phase.sections])

  const visibleCustomSections = useMemo(
    () => customSections.filter((s) => s.phaseId === phase.id),
    [customSections, phase.id],
  )

  const visibleAllSections = useMemo(
    () => [...visibleOriginalSections.map((s) => ({ id: sectionIdForOriginalLabel(s.label), label: s.label, isCustom: false })), ...visibleCustomSections.map((s) => ({ id: s.id, label: s.label, isCustom: true }))],
    [visibleCustomSections, visibleOriginalSections],
  )

  const sectionsToRender = useMemo(() => {
    return visibleAllSections.filter((s) => {
      if (s.isCustom && !s.label.trim() && editingSectionId !== s.id) return false
      return true
    })
  }, [visibleAllSections, editingSectionId])

  const sectionsToRenderRef = useRef(sectionsToRender)
  sectionsToRenderRef.current = sectionsToRender

  const visibleAllTasks = useMemo(() => {
    return [...visibleOriginalTasks, ...customTasks.filter((t) => t.phaseId === phase.id)]
  }, [customTasks, phase.id, visibleOriginalTasks])

  const { done, total, pct } = useMemo(() => {
    const total = visibleAllTasks.length
    const done = visibleAllTasks.reduce((acc, t) => acc + (completedIds.has(t.id) ? 1 : 0), 0)
    const pct = total === 0 ? 0 : Math.round((done / total) * 100)
    return { done, total, pct }
  }, [completedIds, visibleAllTasks])

  const phaseComplete = total > 0 && done === total

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === TEXT_EDITS_KEY) setTextEdits(loadEdits(TEXT_EDITS_KEY))
      if (e.key === TIP_EDITS_KEY) setTipEdits(loadEdits(TIP_EDITS_KEY))
      if (e.key === CUSTOM_TASKS_KEY) setCustomTasks(loadCustomTasks())
      if (e.key === DELETED_KEY) setDeletedIds(new Set(loadDeletedIds()))
      if (e.key === CUSTOM_SECTIONS_KEY) setCustomSections(loadCustomSections())
      if (e.key === DELETED_SECTIONS_KEY) setDeletedSectionIds(new Set(loadDeletedSectionIds()))
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  function startEdit(taskId: string, field: 'text' | 'tip', initial: string) {
    setEditing({ taskId, field, draft: initial })
  }

  function commitEdit(nextValue: string) {
    if (!editing) return
    const isCustom = customTasks.some((t) => t.id === editing.taskId)
    if (isCustom) {
      setCustomTasks((prev) => {
        const next = prev.map((t) => {
          if (t.id !== editing.taskId) return t
          return editing.field === 'text' ? { ...t, text: nextValue } : { ...t, tip: nextValue }
        })
        saveCustomTasks(next)
        return next
      })
      setEditing(null)
      return
    }
    if (editing.field === 'text') {
      setTextEdits((prev) => {
        const next = { ...prev, [editing.taskId]: nextValue }
        persistEdits(TEXT_EDITS_KEY, next)
        return next
      })
    } else {
      setTipEdits((prev) => {
        const next = { ...prev, [editing.taskId]: nextValue }
        persistEdits(TIP_EDITS_KEY, next)
        return next
      })
    }
    setEditing(null)
  }

  function addTask(sectionLabel: string) {
    let newId: string | undefined
    setCustomTasks((prev) => {
      const fromStorage = loadCustomTasks()
      const mergedById = new Map<string, CustomTask>()
      for (const t of fromStorage) mergedById.set(t.id, t)
      for (const t of prev) mergedById.set(t.id, t)
      const merged = [...mergedById.values()]
      const id = nextCustomTaskIdFromExisting(merged)
      newId = id
      const nextTask: CustomTask = { id, phaseId: phase.id, sectionLabel, text: '', tip: '' }
      const next = [...prev, nextTask]
      saveCustomTasks(next)
      return next
    })
    setConfirmDeleteId(null)
    if (newId) startEdit(newId, 'text', '')
  }

  function addTaskToLastSection() {
    let sectionLabel = sectionsToRenderRef.current[sectionsToRenderRef.current.length - 1]?.label
    if (!sectionLabel) {
      const newSectionId = `cs-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`
      sectionLabel = 'General'
      setCustomSections((prev) => {
        const next = [...prev, { id: newSectionId, phaseId: phase.id, label: sectionLabel }]
        persistCustomSections(next)
        return next
      })
    }
    let newId: string | undefined
    setCustomTasks((prev) => {
      const fromStorage = loadCustomTasks()
      const mergedById = new Map<string, CustomTask>()
      for (const t of fromStorage) mergedById.set(t.id, t)
      for (const t of prev) mergedById.set(t.id, t)
      const merged = [...mergedById.values()]
      const id = nextCustomTaskIdFromExisting(merged)
      newId = id
      const nextTask: CustomTask = { id, phaseId: phase.id, sectionLabel, text: '', tip: '' }
      const next = [...prev, nextTask]
      saveCustomTasks(next)
      return next
    })
    setConfirmDeleteId(null)
    if (newId) startEdit(newId, 'text', '')
  }

  const handledAddTaskNonceRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (requestAddTaskNonce === undefined) {
      handledAddTaskNonceRef.current = undefined
      return
    }
    if (handledAddTaskNonceRef.current === requestAddTaskNonce) return
    handledAddTaskNonceRef.current = requestAddTaskNonce
    addTaskToLastSection()
    onAddTaskConsumed?.()
  }, [requestAddTaskNonce, onAddTaskConsumed, phase.id])

  function requestDelete(taskId: string) {
    setConfirmDeleteId(taskId)
  }

  function cancelDelete() {
    setConfirmDeleteId(null)
  }

  function confirmDelete(taskId: string) {
    setConfirmDeleteId(null)
    if (editing?.taskId === taskId) setEditing(null)
    const isCustom = customTasks.some((t) => t.id === taskId)
    if (isCustom) {
      setCustomTasks((prev) => {
        const next = prev.filter((t) => t.id !== taskId)
        saveCustomTasks(next)
        return next
      })
      return
    }
    setDeletedIds((prev) => {
      const next = new Set(prev)
      next.add(taskId)
      saveDeletedTaskIds(Array.from(next))
      return next
    })
  }

  function addSection() {
    const id = `cs-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`
    const nextSection: CustomSection = { id, phaseId: phase.id, label: '' }
    setCustomSections((prev) => {
      const next = [...prev, nextSection]
      persistCustomSections(next)
      return next
    })
    setConfirmDeleteSectionId(null)
    setEditingSectionId(id)
    setSectionDraft('')
  }

  function requestDeleteSection(sectionId: string) {
    setConfirmDeleteSectionId(sectionId)
  }

  function cancelDeleteSection() {
    setConfirmDeleteSectionId(null)
  }

  function confirmDeleteSection(sectionId: string) {
    setConfirmDeleteSectionId(null)
    if (editingSectionId === sectionId) setEditingSectionId(null)

    const section = visibleAllSections.find((s) => s.id === sectionId)
    if (!section) return
    const sectionLabel = section.label

    // Remove custom tasks for this section (always).
    setCustomTasks((prev) => {
      const next = prev.filter((t) => !(t.phaseId === phase.id && t.sectionLabel === sectionLabel))
      if (next.length !== prev.length) saveCustomTasks(next)
      return next
    })

    // If it's a custom section, remove it.
    if (section.isCustom) {
      setCustomSections((prev) => {
        const next = prev.filter((s) => s.id !== sectionId)
        persistCustomSections(next)
        return next
      })
      return
    }

    // Otherwise mark original section as deleted.
    setDeletedSectionIds((prev) => {
      const next = new Set(prev)
      next.add(sectionId)
      persistDeletedSectionIds(Array.from(next))
      return next
    })
  }

  function removeCustomSectionById(sectionId: string) {
    setCustomSections((prev) => {
      const next = prev.filter((s) => s.id !== sectionId)
      persistCustomSections(next)
      return next
    })
    setEditingSectionId(null)
  }

  function commitSectionLabel(sectionId: string, nextLabel: string) {
    const trimmed = nextLabel.trim()
    const section = visibleAllSections.find((s) => s.id === sectionId)
    if (!section) return

    if (!trimmed) {
      if (section.isCustom) {
        removeCustomSectionById(sectionId)
      } else {
        setEditingSectionId(null)
      }
      return
    }

    if (!section.isCustom) {
      setEditingSectionId(null)
      return
    }

    setCustomSections((prev) => {
      const next = prev.map((s) => (s.id === sectionId ? { ...s, label: trimmed } : s))
      persistCustomSections(next)
      return next
    })
    setEditingSectionId(null)
  }

  return (
    <article className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900/50">
      <button
        type="button"
        className="flex w-full items-start justify-between gap-3 rounded-xl px-4 py-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 dark:focus-visible:ring-teal-400 dark:focus-visible:ring-offset-slate-950"
        onClick={() => {
          const next = !open
          if (isOpen === undefined) setUncontrolledOpen(next)
          onToggle?.(phase.id, next)
        }}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-3">
            <span
              className="mt-1 size-2.5 shrink-0 rounded-full ring-2 ring-white dark:ring-slate-950"
              style={{ backgroundColor: phase.color }}
              aria-hidden
            />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {phase.label}
              </p>
              <h2 className="mt-0.5 truncate text-base font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                {phase.name}
              </h2>
            </div>
          </div>
        </div>
        <div className="mt-0.5 flex shrink-0 items-center gap-2">
          <PhasePercentBadge pct={pct} phaseColor={phase.color} size="header" />
          {phaseComplete ? <PhaseCompleteIcon /> : null}
          <svg
            className={`size-5 text-slate-400 transition-transform dark:text-slate-500 ${open ? 'rotate-180' : ''}`}
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      </button>

      {open ? (
        <div className="border-t border-slate-100 px-4 pb-4 pt-4 dark:border-slate-800">
          {phase.insight.trim() ? (
            <div
              className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-300"
              style={{ borderLeftWidth: 4, borderLeftColor: phase.color }}
            >
              {phase.insight}
            </div>
          ) : null}

          <div className={`space-y-5 ${phase.insight.trim() ? 'mt-4' : ''}`}>
            {sectionsToRender.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No sections yet — click Add section to get started
              </p>
            ) : null}
            {sectionsToRender.map((section) => {
              const originalInSection = visibleOriginalTasks.filter((t) => t.sectionLabel === section.label)
              const customInSection = customBySection.get(section.label) ?? []
              const sectionTasks = [...originalInSection, ...customInSection]
              const isEditingSection = editingSectionId === section.id
              const showConfirmSection = confirmDeleteSectionId === section.id

              return (
                <section key={section.id} aria-label={section.label || 'New section'}>
                  <div className="group flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      {isEditingSection ? (
                        <input
                          value={sectionDraft}
                          autoFocus
                          onChange={(e) => setSectionDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              commitSectionLabel(section.id, sectionDraft.trim())
                            }
                            if (e.key === 'Escape') {
                              e.preventDefault()
                              if (section.isCustom && !sectionDraft.trim()) {
                                removeCustomSectionById(section.id)
                              } else {
                                setEditingSectionId(null)
                              }
                            }
                          }}
                          onBlur={() => commitSectionLabel(section.id, sectionDraft)}
                          placeholder="Section name"
                          className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700 shadow-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                        />
                      ) : (
                        <h3
                          className="cursor-text text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                          onClick={(e) => {
                            if (!section.isCustom) return
                            e.preventDefault()
                            e.stopPropagation()
                            setConfirmDeleteSectionId(null)
                            setEditingSectionId(section.id)
                            setSectionDraft(section.label)
                          }}
                        >
                          {section.label}
                        </h3>
                      )}
                    </div>

                    <div className="relative mt-0.5 shrink-0">
                      <button
                        type="button"
                        aria-label="Delete section"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          requestDeleteSection(section.id)
                        }}
                        className="invisible inline-flex size-7 items-center justify-center rounded-md text-slate-400 hover:bg-white/60 hover:text-slate-700 group-hover:visible dark:text-slate-500 dark:hover:bg-slate-900/60 dark:hover:text-slate-200"
                      >
                        <span aria-hidden className="text-lg leading-none">
                          ×
                        </span>
                      </button>

                      {showConfirmSection ? (
                        <div
                          className="absolute right-0 top-8 z-10 w-56 rounded-lg border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-950"
                          role="dialog"
                          aria-label="Confirm delete section"
                        >
                          <p className="text-xs font-medium text-slate-700 dark:text-slate-200">
                            Delete section and all its tasks?
                          </p>
                          <div className="mt-2 flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                cancelDeleteSection()
                              }}
                              className="rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-900"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                confirmDeleteSection(section.id)
                              }}
                              className="rounded-md bg-rose-600 px-2 py-1 text-xs font-semibold text-white hover:bg-rose-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950"
                            >
                              Yes
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <ul className="mt-2 flex flex-col gap-2">
                    {sectionTasks.length === 0 ? (
                      <li className="py-1 text-sm text-slate-500 dark:text-slate-400">
                        No tasks yet — click Add task
                      </li>
                    ) : null}
                    {sectionTasks.map((task, taskIndexInSection) => {
                      const done = completedIds.has(task.id)
                      const displayText = textEdits[task.id] ?? task.text
                      const displayTip = tipEdits[task.id] ?? task.tip
                      const sectionTaskNumber = taskIndexInSection + 1
                      const isEditingText = editing?.taskId === task.id && editing.field === 'text'
                      const isEditingTip = editing?.taskId === task.id && editing.field === 'tip'
                      const showConfirm = confirmDeleteId === task.id
                      return (
                        <li key={task.id} className="group rounded-lg">
                          <div className="relative flex min-h-[44px] items-start gap-3 rounded-lg px-1 py-2 hover:bg-slate-50 sm:min-h-0 sm:py-1 dark:hover:bg-slate-800/40">
                            <input
                              type="checkbox"
                              checked={done}
                              onChange={() => toggleTask(task.id)}
                              className="mt-1 size-[1.125rem] shrink-0 rounded border-slate-300 text-teal-600 focus:ring-2 focus:ring-teal-500 focus:ring-offset-0 focus:ring-offset-white dark:border-slate-600 dark:text-teal-500 dark:focus:ring-teal-400 dark:focus:ring-offset-slate-900"
                            />
                            <div className="min-w-0 flex-1">
                              {isEditingText ? (
                                <textarea
                                  value={editing.draft}
                                  autoFocus
                                  rows={1}
                                  onFocus={(e) => autosize(e.currentTarget)}
                                  onInput={(e) => autosize(e.currentTarget)}
                                  onChange={(e) =>
                                    setEditing((s) =>
                                      s && s.taskId === task.id && s.field === 'text'
                                        ? { ...s, draft: e.target.value }
                                        : s,
                                    )
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === 'Escape') {
                                      e.preventDefault()
                                      commitEdit(editing.draft)
                                    }
                                  }}
                                  onBlur={() => commitEdit(editing.draft)}
                                  placeholder={`Task ${sectionTaskNumber}`}
                                  className="w-full resize-none rounded-md border border-slate-200 bg-white px-2 py-1 text-sm leading-snug text-slate-900 shadow-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                                />
                              ) : (
                                <p
                                  className={`cursor-text text-sm leading-snug ${
                                    done
                                      ? 'text-slate-500 line-through opacity-70 dark:text-slate-400'
                                      : 'text-slate-800 dark:text-slate-200'
                                  }`}
                                  onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    setConfirmDeleteId(null)
                                    startEdit(task.id, 'text', displayText)
                                  }}
                                >
                                  {displayText.trim() ? (
                                    displayText
                                  ) : (
                                    <span className="text-slate-400 dark:text-slate-500">
                                      Task {sectionTaskNumber}
                                    </span>
                                  )}
                                </p>
                              )}

                              {isEditingTip ? (
                                <textarea
                                  value={editing.draft}
                                  autoFocus
                                  rows={1}
                                  onFocus={(e) => autosize(e.currentTarget)}
                                  onInput={(e) => autosize(e.currentTarget)}
                                  onChange={(e) =>
                                    setEditing((s) =>
                                      s && s.taskId === task.id && s.field === 'tip'
                                        ? { ...s, draft: e.target.value }
                                        : s,
                                    )
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === 'Escape') {
                                      e.preventDefault()
                                      commitEdit(editing.draft)
                                    }
                                  }}
                                  onBlur={() => commitEdit(editing.draft)}
                                  className="mt-1 w-full resize-none rounded-md border border-slate-200 bg-white px-2 py-1 text-[12px] leading-snug text-slate-700 shadow-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                                />
                              ) : displayTip ? (
                                <p
                                  className="mt-1 cursor-text text-[12px] leading-snug text-slate-500 dark:text-slate-400"
                                  onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    setConfirmDeleteId(null)
                                    startEdit(task.id, 'tip', displayTip)
                                  }}
                                >
                                  {displayTip}
                                </p>
                              ) : null}
                            </div>

                            <div className="relative mt-0.5 shrink-0">
                              <button
                                type="button"
                                aria-label="Delete task"
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  requestDelete(task.id)
                                }}
                                className="invisible inline-flex size-7 items-center justify-center rounded-md text-slate-400 hover:bg-white/60 hover:text-slate-700 group-hover:visible dark:text-slate-500 dark:hover:bg-slate-900/60 dark:hover:text-slate-200"
                              >
                                <span aria-hidden className="text-lg leading-none">
                                  ×
                                </span>
                              </button>

                              {showConfirm ? (
                                <div
                                  className="absolute right-0 top-8 z-10 w-44 rounded-lg border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-950"
                                  role="dialog"
                                  aria-label="Confirm delete"
                                >
                                  <p className="text-xs font-medium text-slate-700 dark:text-slate-200">
                                    Delete this task?
                                  </p>
                                  <div className="mt-2 flex items-center justify-end gap-2">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.preventDefault()
                                        e.stopPropagation()
                                        cancelDelete()
                                      }}
                                      className="rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-900"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.preventDefault()
                                        e.stopPropagation()
                                        confirmDelete(task.id)
                                      }}
                                      className="rounded-md bg-rose-600 px-2 py-1 text-xs font-semibold text-white hover:bg-rose-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950"
                                    >
                                      Yes
                                    </button>
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </li>
                      )
                    })}
                  </ul>

                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => addTask(section.label)}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-200 dark:hover:bg-slate-900 dark:focus-visible:ring-teal-400 dark:focus-visible:ring-offset-slate-950"
                    >
                      Add task
                    </button>
                  </div>
                </section>
              )
            })}

            <div className="pt-1">
              <button
                type="button"
                onClick={() => addSection()}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-200 dark:hover:bg-slate-900 dark:focus-visible:ring-teal-400 dark:focus-visible:ring-offset-slate-950"
              >
                Add section
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div
            className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700/90"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${phase.name} progress`}
          >
            <div
              className="h-full rounded-full transition-[width] duration-300 ease-out"
              style={{ width: `${pct}%`, backgroundColor: phase.color }}
            />
          </div>
          <span className="shrink-0 text-xs font-medium tabular-nums text-slate-600 dark:text-slate-400">
            {done}/{total}
          </span>
        </div>
      </div>
    </article>
  )
}

