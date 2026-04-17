import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { PHASES, getTasksForPhase } from './data/phases'
import { PhaseCard } from './components/PhaseCard'
import { PhasePercentBadge } from './components/PhasePercentBadge'
import { StatsBar } from './components/StatsBar'
import { useTaskProgress } from './hooks/useTaskProgress'
import type { Phase } from './data/types'
import { clearAllSyncedLocalKeys } from './lib/snapshot'
import { requestPersist } from './lib/storage'
import {
  CUSTOM_PHASES_KEY,
  CUSTOM_SECTIONS_KEY,
  CUSTOM_TASKS_KEY,
  DELETED_PHASES_KEY,
  DELETED_SECTIONS_KEY,
  DELETED_TASKS_KEY,
  PHASE_RENAMES_KEY,
  RENAME_HINT_KEY,
  TEXT_EDITS_KEY,
  TIP_EDITS_KEY,
} from './lib/storageKeys'

const PHASE_PICKER_COLORS = ['#7F77DD', '#1D9E75', '#378ADD', '#EF9F27', '#D85A30'] as const

type CustomPhase = {
  id: number
  label: string
  name: string
  color: string
}

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function persistJson(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* ignore */
  }
  requestPersist()
}

function safeBgFromColor() {
  // Keep it simple: neutral light background for custom phases.
  return '#F3F4F6'
}

export default function App() {
  const {
    completedIds,
    getPhaseProgress,
    getTotalProgress,
    resetProgress,
    removeCompletedForTaskIds,
    bumpTaskInventory,
  } = useTaskProgress()
  const [customPhases, setCustomPhases] = useState<CustomPhase[]>(() =>
    typeof window === 'undefined' ? [] : loadJson<CustomPhase[]>(CUSTOM_PHASES_KEY, []),
  )
  const [deletedPhaseIds, setDeletedPhaseIds] = useState<Set<number>>(() => {
    if (typeof window === 'undefined') return new Set()
    const arr = loadJson<unknown>(DELETED_PHASES_KEY, [])
    if (!Array.isArray(arr)) return new Set()
    return new Set(arr.filter((x): x is number => typeof x === 'number'))
  })
  const [phaseRenames, setPhaseRenames] = useState<Record<number, string>>(() => {
    if (typeof window === 'undefined') return {}
    const obj = loadJson<unknown>(PHASE_RENAMES_KEY, {})
    if (!obj || typeof obj !== 'object') return {}
    const out: Record<number, string> = {}
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const id = Number(k)
      if (Number.isFinite(id) && typeof v === 'string') out[id] = v
    }
    return out
  })

  const visiblePhases: Phase[] = useMemo(() => {
    const base = PHASES.filter((p) => !deletedPhaseIds.has(p.id)).map((p) => {
      const renamed = phaseRenames[p.id]
      if (!renamed) return p
      return { ...p, label: renamed, name: renamed }
    })

    const customs: Phase[] = customPhases
      .filter((p) => !deletedPhaseIds.has(p.id))
      .map((p) => ({
        id: p.id,
        label: p.label,
        name: p.name,
        color: p.color,
        bgColor: safeBgFromColor(),
        insight: '',
        sections: [],
      }))

    return [...base, ...customs]
  }, [customPhases, deletedPhaseIds, phaseRenames])

  const [activePhaseId, setActivePhaseId] = useState<number | null>(null)
  const [openByPhase, setOpenByPhase] = useState<Record<number, boolean>>(() =>
    Object.fromEntries(visiblePhases.map((p) => [p.id, false])),
  )
  const prevDoneRef = useRef<Record<number, number>>({})
  const [menuOpenFor, setMenuOpenFor] = useState<number | null>(null)
  const [renamingPhaseId, setRenamingPhaseId] = useState<number | null>(null)
  const [renameDraft, setRenameDraft] = useState<string>('')
  const [menuDeleteConfirmPhaseId, setMenuDeleteConfirmPhaseId] = useState<number | null>(null)
  const [addTaskTrigger, setAddTaskTrigger] = useState<{ phaseId: number; nonce: number } | null>(null)
  const addTaskNonceRef = useRef(0)
  const tabWrapRefs = useRef<Record<number, HTMLDivElement | null>>({})
  const phaseMenuPortalRef = useRef<HTMLDivElement | null>(null)
  const [phaseMenuPos, setPhaseMenuPos] = useState({ top: 0, left: 0 })
  const [renameHintVisible, setRenameHintVisible] = useState(false)
  const tabClickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const skipRenameBlurCommitRef = useRef(false)
  const [addPhasePopoverOpen, setAddPhasePopoverOpen] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [newPhaseName, setNewPhaseName] = useState('')
  const [newPhaseColor, setNewPhaseColor] = useState<string>(PHASE_PICKER_COLORS[0])
  const [addPhasePopoverPos, setAddPhasePopoverPos] = useState({ top: 0, left: 0 })
  const addPhaseButtonRef = useRef<HTMLButtonElement | null>(null)
  const addPhasePopoverRef = useRef<HTMLDivElement | null>(null)
  const newPhaseInputRef = useRef<HTMLInputElement | null>(null)
  const phaseTabBarRef = useRef<HTMLDivElement | null>(null)
  const phaseTabTrackRef = useRef<HTMLDivElement | null>(null)
  const [phaseTabScroll, setPhaseTabScroll] = useState({ scrollLeft: 0, clientWidth: 0, scrollWidth: 0 })

  const updatePhaseTabScroll = useCallback(() => {
    const el = phaseTabBarRef.current
    if (!el) return
    setPhaseTabScroll({
      scrollLeft: el.scrollLeft,
      clientWidth: el.clientWidth,
      scrollWidth: el.scrollWidth,
    })
  }, [])

  useEffect(() => {
    updatePhaseTabScroll()
  }, [visiblePhases, updatePhaseTabScroll])

  useEffect(() => {
    const el = phaseTabBarRef.current
    if (!el) return
    const ro = new ResizeObserver(() => updatePhaseTabScroll())
    ro.observe(el)
    return () => ro.disconnect()
  }, [updatePhaseTabScroll])

  function cancelPendingTabSwitch() {
    if (tabClickTimerRef.current) {
      clearTimeout(tabClickTimerRef.current)
      tabClickTimerRef.current = null
    }
  }

  function scheduleTabSwitch(phaseId: number) {
    cancelPendingTabSwitch()
    tabClickTimerRef.current = setTimeout(() => {
      tabClickTimerRef.current = null
      setMenuOpenFor(null)
      setMenuDeleteConfirmPhaseId(null)
      setRenamingPhaseId(null)
      setActivePhaseId(phaseId)
    }, 280)
  }

  function positionPhaseMenu(anchor: HTMLElement) {
    const rect = anchor.getBoundingClientRect()
    const menuWidth = 160
    const top = rect.bottom + 8
    let left = rect.left
    left = Math.min(Math.max(8, left), window.innerWidth - menuWidth - 8)
    setPhaseMenuPos({ top, left })
  }

  function maybeShowRenameHintOnce() {
    if (typeof window === 'undefined') return
    if (localStorage.getItem(RENAME_HINT_KEY)) return
    localStorage.setItem(RENAME_HINT_KEY, '1')
    requestPersist()
    setRenameHintVisible(true)
  }

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === CUSTOM_PHASES_KEY) {
        const next = loadJson<CustomPhase[]>(CUSTOM_PHASES_KEY, [])
        setCustomPhases(Array.isArray(next) ? next : [])
      }
      if (e.key === DELETED_PHASES_KEY) {
        const arr = loadJson<unknown>(DELETED_PHASES_KEY, [])
        const next = Array.isArray(arr) ? new Set(arr.filter((x): x is number => typeof x === 'number')) : new Set<number>()
        setDeletedPhaseIds(next)
      }
      if (e.key === PHASE_RENAMES_KEY) {
        const obj = loadJson<unknown>(PHASE_RENAMES_KEY, {})
        const out: Record<number, string> = {}
        if (obj && typeof obj === 'object') {
          for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
            const id = Number(k)
            if (Number.isFinite(id) && typeof v === 'string') out[id] = v
          }
        }
        setPhaseRenames(out)
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  useEffect(() => {
    return () => {
      if (tabClickTimerRef.current) {
        clearTimeout(tabClickTimerRef.current)
        tabClickTimerRef.current = null
      }
    }
  }, [])

  function updateAddPhasePopoverPosition() {
    const el = addPhaseButtonRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const w = 260
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - w - 8)
    setAddPhasePopoverPos({ top: rect.bottom + 6, left })
  }

  useEffect(() => {
    if (!addPhasePopoverOpen) return
    updateAddPhasePopoverPosition()
    const t = window.requestAnimationFrame(() => newPhaseInputRef.current?.focus())
    function onScroll() {
      updateAddPhasePopoverPosition()
    }
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      window.cancelAnimationFrame(t)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [addPhasePopoverOpen])

  useEffect(() => {
    if (!addPhasePopoverOpen) return
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        setAddPhasePopoverOpen(false)
      }
    }
    document.addEventListener('keydown', onEsc)
    return () => document.removeEventListener('keydown', onEsc)
  }, [addPhasePopoverOpen])

  useEffect(() => {
    if (!addPhasePopoverOpen) return
    function onDocMouseDown(e: MouseEvent) {
      const t = e.target as Node
      if (addPhasePopoverRef.current?.contains(t)) return
      if (addPhaseButtonRef.current?.contains(t)) return
      setAddPhasePopoverOpen(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [addPhasePopoverOpen])

  useEffect(() => {
    if (menuOpenFor === null) return
    const openMenuPhaseId = menuOpenFor
    function onDocMouseDown(e: MouseEvent) {
      const t = e.target as Node
      // Portal menu lives under document.body — must ignore clicks inside it (fixes instant close before click)
      if (phaseMenuPortalRef.current?.contains(t)) return
      const wrap = tabWrapRefs.current[openMenuPhaseId]
      if (wrap?.contains(t)) return
      setMenuOpenFor(null)
      setMenuDeleteConfirmPhaseId(null)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        setMenuOpenFor(null)
        setMenuDeleteConfirmPhaseId(null)
      }
    }
    document.addEventListener('mousedown', onDocMouseDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpenFor])

  useEffect(() => {
    if (menuOpenFor === null) return
    if (!visiblePhases.some((p) => p.id === menuOpenFor)) {
      setMenuOpenFor(null)
      setMenuDeleteConfirmPhaseId(null)
    }
  }, [menuOpenFor, visiblePhases])

  useEffect(() => {
    if (visiblePhases.length === 0) {
      setActivePhaseId(null)
      return
    }
    if (activePhaseId !== null && visiblePhases.some((p) => p.id === activePhaseId)) return
    setActivePhaseId(visiblePhases[0].id)
  }, [activePhaseId, visiblePhases])

  useEffect(() => {
    // Ensure openByPhase contains all visible phases.
    setOpenByPhase((prev) => {
      const next: Record<number, boolean> = { ...prev }
      for (const p of visiblePhases) if (next[p.id] === undefined) next[p.id] = false
      for (const id of Object.keys(next)) {
        const pid = Number(id)
        if (!visiblePhases.some((p) => p.id === pid)) delete next[pid]
      }
      return next
    })
  }, [visiblePhases])

  useEffect(() => {
    for (const phase of visiblePhases) {
      const { done, total } = getPhaseProgress(phase.id)
      const prev = prevDoneRef.current[phase.id]
      prevDoneRef.current[phase.id] = done
      if (total === 0 || done !== total) continue
      const justFinished = prev === undefined ? true : prev < total
      if (justFinished) {
        setOpenByPhase((p) => ({ ...p, [phase.id]: false }))
      }
    }
  }, [completedIds, getPhaseProgress, visiblePhases])

  const phaseTasks = useMemo(
    () =>
      Object.fromEntries(
        visiblePhases.map((p) => [
          p.id,
          PHASES.some((ph) => ph.id === p.id) ? getTasksForPhase(p.id) : [],
        ]),
      ),
    [visiblePhases],
  )

  const activePhase =
    activePhaseId === null ? null : (visiblePhases.find((p) => p.id === activePhaseId) ?? null)

  const phaseForOpenMenu = useMemo(
    () => (menuOpenFor === null ? null : visiblePhases.find((p) => p.id === menuOpenFor) ?? null),
    [menuOpenFor, visiblePhases],
  )

  const phaseTabMaxScroll = Math.max(0, phaseTabScroll.scrollWidth - phaseTabScroll.clientWidth)
  const phaseTabThumbWidthPct =
    phaseTabScroll.scrollWidth <= phaseTabScroll.clientWidth || phaseTabScroll.clientWidth === 0
      ? 100
      : (phaseTabScroll.clientWidth / phaseTabScroll.scrollWidth) * 100
  const phaseTabThumbLeftPct =
    phaseTabMaxScroll <= 0 ? 0 : (phaseTabScroll.scrollLeft / phaseTabMaxScroll) * (100 - phaseTabThumbWidthPct)
  const canPhaseTabScrollLeft = phaseTabScroll.scrollLeft > 0.5
  const canPhaseTabScrollRight = phaseTabScroll.scrollLeft < phaseTabMaxScroll - 0.5
  const phaseTabThumbColor = activePhase?.color ?? '#14b8a6'

  const scrollPhaseTabsBy = useCallback((delta: number) => {
    phaseTabBarRef.current?.scrollBy({ left: delta, behavior: 'smooth' })
  }, [])

  const onPhaseTabThumbPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      const scrollEl = phaseTabBarRef.current
      const track = phaseTabTrackRef.current
      if (!scrollEl || !track) return
      const startX = e.clientX
      const startScroll = scrollEl.scrollLeft
      const maxScroll = Math.max(0, scrollEl.scrollWidth - scrollEl.clientWidth)
      const trackW = track.clientWidth
      const thumbW = (scrollEl.clientWidth / scrollEl.scrollWidth) * trackW
      const scrollRange = Math.max(0, trackW - thumbW)
      e.currentTarget.setPointerCapture(e.pointerId)
      const onMove = (ev: PointerEvent) => {
        if (scrollRange <= 0 || maxScroll <= 0) return
        const dx = ev.clientX - startX
        const dScroll = (dx / scrollRange) * maxScroll
        scrollEl.scrollLeft = Math.max(0, Math.min(maxScroll, startScroll + dScroll))
        updatePhaseTabScroll()
      }
      const onUp = (ev: PointerEvent) => {
        try {
          e.currentTarget.releasePointerCapture(ev.pointerId)
        } catch {
          /* ignore */
        }
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [updatePhaseTabScroll],
  )

  const onPhaseTabTrackPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if ((e.target as HTMLElement).dataset.phaseTabThumb != null) return
      const scrollEl = phaseTabBarRef.current
      const track = phaseTabTrackRef.current
      if (!scrollEl || !track) return
      const maxScroll = Math.max(0, scrollEl.scrollWidth - scrollEl.clientWidth)
      if (maxScroll <= 0) return
      const rect = track.getBoundingClientRect()
      const thumbPx = (scrollEl.clientWidth / scrollEl.scrollWidth) * rect.width
      const x = e.clientX - rect.left
      const scrollRange = rect.width - thumbPx
      if (scrollRange <= 0) return
      const nextScroll = ((x - thumbPx / 2) / scrollRange) * maxScroll
      scrollEl.scrollLeft = Math.max(0, Math.min(maxScroll, nextScroll))
      updatePhaseTabScroll()
    },
    [updatePhaseTabScroll],
  )

  const totalProgress = getTotalProgress()
  let fullyDonePhases = 0
  for (const p of visiblePhases) {
    const { done, total: phaseTotal } = getPhaseProgress(p.id)
    if (phaseTotal > 0 && done === phaseTotal) fullyDonePhases++
  }
  const totalPhaseCount = visiblePhases.length
  const tasksCompletePercent =
    totalProgress.total === 0 ? 0 : Math.round((totalProgress.done / totalProgress.total) * 100)
  const phasesCompletePercent =
    totalPhaseCount === 0 ? 0 : Math.round((fullyDonePhases / totalPhaseCount) * 100)

  function openAddPhasePopover() {
    cancelPendingTabSwitch()
    setNewPhaseName('')
    setNewPhaseColor(PHASE_PICKER_COLORS[0])
    updateAddPhasePopoverPosition()
    setAddPhasePopoverOpen(true)
  }

  function closeAddPhasePopover() {
    setAddPhasePopoverOpen(false)
  }

  function performFullReset() {
    clearAllSyncedLocalKeys()
    resetProgress()
    setCustomPhases([])
    setDeletedPhaseIds(new Set())
    setPhaseRenames({})
    setActivePhaseId(null)
    setOpenByPhase({})
    prevDoneRef.current = {}
    setRenamingPhaseId(null)
    setRenameDraft('')
    setMenuOpenFor(null)
    setMenuDeleteConfirmPhaseId(null)
    setAddTaskTrigger(null)
    addTaskNonceRef.current = 0
    setRenameHintVisible(false)
    setAddPhasePopoverOpen(false)
    cancelPendingTabSwitch()
    bumpTaskInventory()
    setShowResetConfirm(false)
    requestPersist()
  }

  const onAddTaskConsumed = useCallback(() => setAddTaskTrigger(null), [])

  function handleMenuAddNewTask(phaseId: number) {
    cancelPendingTabSwitch()
    setMenuOpenFor(null)
    setMenuDeleteConfirmPhaseId(null)
    setActivePhaseId(phaseId)
    setOpenByPhase((p) => ({ ...p, [phaseId]: true }))
    addTaskNonceRef.current += 1
    setAddTaskTrigger({ phaseId, nonce: addTaskNonceRef.current })
  }

  function submitNewPhase() {
    const name = newPhaseName.trim()
    if (!name) return
    const maxId = Math.max(-1, ...PHASES.map((p) => p.id), ...customPhases.map((p) => p.id))
    const nextId = maxId + 1
    const next: CustomPhase = { id: nextId, label: name, name: name, color: newPhaseColor }
    setCustomPhases((prev) => {
      const updated = [...prev, next]
      persistJson(CUSTOM_PHASES_KEY, updated)
      return updated
    })
    setDeletedPhaseIds((prev) => {
      if (!prev.has(nextId)) return prev
      const nextSet = new Set(prev)
      nextSet.delete(nextId)
      persistJson(DELETED_PHASES_KEY, Array.from(nextSet))
      return nextSet
    })
    setActivePhaseId(nextId)
    setMenuOpenFor(null)
    setMenuDeleteConfirmPhaseId(null)
    setRenamingPhaseId(null)
    setAddPhasePopoverOpen(false)
  }

  function startRename(phaseId: number) {
    cancelPendingTabSwitch()
    const phase = visiblePhases.find((p) => p.id === phaseId)
    if (!phase) return
    setRenamingPhaseId(phaseId)
    setRenameDraft(phase.label)
    setMenuOpenFor(null)
    setMenuDeleteConfirmPhaseId(null)
  }

  function commitRename(phaseId: number, nextLabel: string) {
    const trimmed = nextLabel.trim()
    if (!trimmed) {
      setRenamingPhaseId(null)
      return
    }
    const isCustom = customPhases.some((p) => p.id === phaseId)
    if (isCustom) {
      setCustomPhases((prev) => {
        const updated = prev.map((p) => (p.id === phaseId ? { ...p, label: trimmed, name: trimmed } : p))
        persistJson(CUSTOM_PHASES_KEY, updated)
        return updated
      })
    } else {
      setPhaseRenames((prev) => {
        const updated = { ...prev, [phaseId]: trimmed }
        persistJson(PHASE_RENAMES_KEY, updated)
        return updated
      })
    }
    setRenamingPhaseId(null)
  }

  function collectTaskIdsForPhase(phaseId: number): string[] {
    const ids: string[] = []
    if (PHASES.some((p) => p.id === phaseId)) {
      ids.push(...getTasksForPhase(phaseId).map((t) => t.id))
    }
    const custom = loadJson<unknown>(CUSTOM_TASKS_KEY, [])
    if (Array.isArray(custom)) {
      for (const item of custom) {
        if (!item || typeof item !== 'object') continue
        const r = item as Record<string, unknown>
        if (r.phaseId === phaseId && typeof r.id === 'string') ids.push(r.id)
      }
    }
    return [...new Set(ids)]
  }

  function purgeEditsForTaskIds(key: string, taskIds: Set<string>) {
    const obj = loadJson<Record<string, string>>(key, {})
    if (!obj || typeof obj !== 'object') return
    let changed = false
    const next: Record<string, string> = { ...obj }
    for (const id of taskIds) {
      if (id in next) {
        delete next[id]
        changed = true
      }
    }
    if (changed) persistJson(key, next)
  }

  function purgeDeletedTaskIdsForPhase(taskIds: Set<string>) {
    const arr = loadJson<unknown>(DELETED_TASKS_KEY, [])
    if (!Array.isArray(arr)) return
    const next = arr.filter((x) => typeof x === 'string' && !taskIds.has(x))
    if (next.length !== arr.length) persistJson(DELETED_TASKS_KEY, next)
  }

  function purgeDeletedSectionsForOriginalPhase(phaseId: number) {
    const prefix = `p${phaseId}:`
    const arr = loadJson<unknown>(DELETED_SECTIONS_KEY, [])
    if (!Array.isArray(arr)) return
    const next = arr.filter((x) => typeof x === 'string' && !x.startsWith(prefix))
    if (next.length !== arr.length) persistJson(DELETED_SECTIONS_KEY, next)
  }

  function removePhaseRenameEntry(phaseId: number) {
    setPhaseRenames((prev) => {
      if (!(phaseId in prev)) return prev
      const next = { ...prev }
      delete next[phaseId]
      persistJson(PHASE_RENAMES_KEY, next)
      return next
    })
  }

  function cleanupCustomDataForPhase(phaseId: number) {
    // Remove any custom tasks/sections belonging to this phase.
    const tasks = loadJson<unknown>(CUSTOM_TASKS_KEY, [])
    if (Array.isArray(tasks)) {
      const next = tasks.filter((t) => !(t && typeof t === 'object' && (t as any).phaseId === phaseId))
      persistJson(CUSTOM_TASKS_KEY, next)
    }
    const sections = loadJson<unknown>(CUSTOM_SECTIONS_KEY, [])
    if (Array.isArray(sections)) {
      const next = sections.filter((s) => !(s && typeof s === 'object' && (s as any).phaseId === phaseId))
      persistJson(CUSTOM_SECTIONS_KEY, next)
    }
  }

  function confirmDeletePhase(phaseId: number) {
    if (import.meta.env.DEV) {
      console.log('delete confirmed:', phaseId)
    }
    setMenuDeleteConfirmPhaseId(null)
    setMenuOpenFor(null)

    const isCustom = customPhases.some((p) => p.id === phaseId)
    const taskIdSet = new Set(collectTaskIdsForPhase(phaseId))

    removeCompletedForTaskIds([...taskIdSet])
    purgeEditsForTaskIds(TEXT_EDITS_KEY, taskIdSet)
    purgeEditsForTaskIds(TIP_EDITS_KEY, taskIdSet)
    purgeDeletedTaskIdsForPhase(taskIdSet)
    if (!isCustom) {
      purgeDeletedSectionsForOriginalPhase(phaseId)
      removePhaseRenameEntry(phaseId)
    }

    cleanupCustomDataForPhase(phaseId)

    if (isCustom) {
      setCustomPhases((prev) => {
        const updated = prev.filter((p) => p.id !== phaseId)
        persistJson(CUSTOM_PHASES_KEY, updated)
        return updated
      })
    } else {
      setDeletedPhaseIds((prev) => {
        const next = new Set(prev)
        next.add(phaseId)
        persistJson(DELETED_PHASES_KEY, Array.from(next))
        return next
      })
    }

    if (activePhaseId === phaseId) {
      const remaining = visiblePhases.filter((p) => p.id !== phaseId)
      if (remaining[0]) setActivePhaseId(remaining[0].id)
      else setActivePhaseId(null)
    }

    bumpTaskInventory()
  }

  return (
    <div className="min-h-svh bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-3xl px-3 py-5 sm:px-4 sm:py-8">
        <StatsBar
          completedCount={totalProgress.done}
          totalCount={totalProgress.total}
          fullyDonePhases={fullyDonePhases}
          totalPhases={totalPhaseCount}
          tasksCompletePercent={tasksCompletePercent}
          phasesCompletePercent={phasesCompletePercent}
        />

        <div className="relative mt-5 border-b border-slate-200 dark:border-slate-800">
          {renameHintVisible ? (
            <div
              className="pointer-events-none absolute bottom-full left-1/2 z-40 mb-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg dark:bg-slate-700"
              role="tooltip"
            >
              Double-click to rename
            </div>
          ) : null}

          <div className="flex flex-col gap-1">
            <div className="flex min-h-0 items-end gap-1">
              <button
                type="button"
                className={`inline-flex size-7 shrink-0 items-center justify-center rounded text-slate-400 transition-opacity hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 ${
                  canPhaseTabScrollLeft ? 'opacity-100' : 'pointer-events-none opacity-30'
                }`}
                aria-label="Scroll phase tabs left"
                aria-disabled={!canPhaseTabScrollLeft}
                onClick={() => {
                  if (canPhaseTabScrollLeft) scrollPhaseTabsBy(-200)
                }}
              >
                <svg className="size-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                  <path
                    fillRule="evenodd"
                    d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>

              <div
                ref={phaseTabBarRef}
                className="phase-tabbar-scroll flex min-h-0 min-w-0 flex-1 gap-1 overflow-x-auto pb-0"
                role="tablist"
                aria-label="Project phases"
                onMouseEnter={maybeShowRenameHintOnce}
                onMouseLeave={() => setRenameHintVisible(false)}
                onScroll={updatePhaseTabScroll}
              >
            {visiblePhases.map((phase) => {
              const { done, total } = getPhaseProgress(phase.id)
              const phaseTabPct = total === 0 ? 0 : Math.round((done / total) * 100)
              const isActive = phase.id === activePhaseId
              const isRenaming = renamingPhaseId === phase.id
              return (
                <div
                  key={phase.id}
                  ref={(el) => {
                    tabWrapRefs.current[phase.id] = el
                  }}
                  className="group relative shrink-0"
                  onContextMenu={(e) => {
                    e.preventDefault()
                    const anchor = (e.currentTarget as HTMLElement).querySelector('[data-phase-menu-anchor]')
                    if (anchor instanceof HTMLElement) positionPhaseMenu(anchor)
                    setMenuOpenFor(phase.id)
                    setMenuDeleteConfirmPhaseId(null)
                    setRenamingPhaseId(null)
                  }}
                >
                  <div
                    className={`flex items-center gap-0.5 rounded-t-lg pr-1 text-sm transition-colors ${
                      isActive
                        ? 'bg-white font-semibold text-slate-900 dark:bg-slate-900/60 dark:text-slate-100'
                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                    style={{
                      borderBottomWidth: 2,
                      borderBottomStyle: 'solid',
                      borderBottomColor: isActive ? phase.color : 'transparent',
                    }}
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      onClick={(e) => {
                        const el = e.target as HTMLElement
                        if (el.closest('input')) return
                        if (isRenaming) return

                        if (import.meta.env.DEV) {
                          console.log('tab clicked:', phase.id)
                        }

                        if (e.detail === 2) {
                          cancelPendingTabSwitch()
                          const labelEl = e.currentTarget.querySelector('[data-tab-label]')
                          if (labelEl && labelEl.contains(el)) {
                            startRename(phase.id)
                          } else {
                            setMenuOpenFor(null)
                            setMenuDeleteConfirmPhaseId(null)
                            setRenamingPhaseId(null)
                            setActivePhaseId(phase.id)
                          }
                          return
                        }
                        // Single activation: detail is 1 for mouse; 0 for some keyboard/synthetic clicks — do not require === 1
                        scheduleTabSwitch(phase.id)
                      }}
                      className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 dark:focus-visible:ring-teal-400 dark:focus-visible:ring-offset-slate-950"
                    >
                      <span
                        className="size-2 shrink-0 rounded-full ring-2 ring-white dark:ring-slate-950"
                        style={{ backgroundColor: phase.color }}
                        aria-hidden
                      />

                      {isRenaming ? (
                        <input
                          value={renameDraft}
                          autoFocus
                          onChange={(e) => setRenameDraft(e.target.value)}
                          onFocus={(e) => e.currentTarget.select()}
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              commitRename(phase.id, renameDraft)
                            }
                            if (e.key === 'Escape') {
                              e.preventDefault()
                              skipRenameBlurCommitRef.current = true
                              setRenamingPhaseId(null)
                            }
                          }}
                          onBlur={() => {
                            if (skipRenameBlurCommitRef.current) {
                              skipRenameBlurCommitRef.current = false
                              return
                            }
                            commitRename(phase.id, renameDraft)
                          }}
                          className={`min-w-0 flex-1 border-0 bg-transparent p-0 text-sm shadow-none outline-none ring-0 focus:border-0 focus:ring-0 dark:bg-transparent ${
                            isActive
                              ? 'font-semibold text-slate-900 dark:text-slate-100'
                              : 'font-normal text-slate-500 dark:text-slate-400'
                          }`}
                          style={{ width: `${Math.max(8, renameDraft.length + 1)}ch` }}
                          aria-label="Rename phase"
                        />
                      ) : (
                        <span data-tab-label className="cursor-default whitespace-nowrap select-none">
                          {phase.label}
                        </span>
                      )}

                      <PhasePercentBadge pct={phaseTabPct} phaseColor={phase.color} size="tab" />

                      <span
                        className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums ${
                          isActive
                            ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                            : 'bg-slate-100/70 text-slate-500 dark:bg-slate-800/60 dark:text-slate-400'
                        }`}
                      >
                        {done}/{total}
                      </span>
                    </button>

                    <button
                      type="button"
                      aria-label="Delete phase"
                      title="Delete phase"
                      onMouseDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                      }}
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        if (import.meta.env.DEV) {
                          console.log('delete (×) open confirm:', phase.id)
                        }
                        cancelPendingTabSwitch()
                        positionPhaseMenu(e.currentTarget)
                        setMenuOpenFor(phase.id)
                        setMenuDeleteConfirmPhaseId(phase.id)
                        setRenamingPhaseId(null)
                      }}
                      className="relative z-10 inline-flex size-7 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-700 dark:text-slate-500 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"
                    >
                      <span aria-hidden className="text-lg leading-none">
                        ×
                      </span>
                    </button>

                    <button
                      type="button"
                      aria-label="Phase menu"
                      title="Phase options"
                      data-phase-menu-anchor=""
                      onMouseDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                      }}
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        if (import.meta.env.DEV) {
                          console.log('three-dot clicked:', phase.id)
                        }
                        cancelPendingTabSwitch()
                        positionPhaseMenu(e.currentTarget)
                        setMenuOpenFor((prev) => (prev === phase.id ? null : phase.id))
                        setMenuDeleteConfirmPhaseId(null)
                        setRenamingPhaseId(null)
                      }}
                      className={`relative z-10 inline-flex size-7 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200 ${
                        isActive
                          ? 'opacity-100'
                          : 'opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:focus-visible:opacity-100'
                      }`}
                    >
                      <span aria-hidden className="text-base leading-none">
                        ⋯
                      </span>
                    </button>
                  </div>
                </div>
              )
            })}

            <div className="relative shrink-0">
              <button
                ref={addPhaseButtonRef}
                type="button"
                role="tab"
                aria-expanded={addPhasePopoverOpen}
                aria-selected="false"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  cancelPendingTabSwitch()
                  if (addPhasePopoverOpen) {
                    closeAddPhasePopover()
                  } else {
                    openAddPhasePopover()
                  }
                }}
                className="flex shrink-0 items-center gap-2 rounded-t-lg px-3 py-2 text-sm text-slate-500 transition-colors hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 dark:text-slate-400 dark:hover:text-slate-200 dark:focus-visible:ring-teal-400 dark:focus-visible:ring-offset-slate-950"
                style={{ borderBottomWidth: 2, borderBottomStyle: 'solid', borderBottomColor: 'transparent' }}
                title="Add phase"
              >
                <span className="size-2 shrink-0 rounded-full bg-slate-300 dark:bg-slate-700" aria-hidden />
                <span className="whitespace-nowrap font-medium">+</span>
              </button>
            </div>
              </div>

              <button
                type="button"
                className={`inline-flex size-7 shrink-0 items-center justify-center rounded text-slate-400 transition-opacity hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 ${
                  canPhaseTabScrollRight ? 'opacity-100' : 'pointer-events-none opacity-30'
                }`}
                aria-label="Scroll phase tabs right"
                aria-disabled={!canPhaseTabScrollRight}
                onClick={() => {
                  if (canPhaseTabScrollRight) scrollPhaseTabsBy(200)
                }}
              >
                <svg className="size-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                  <path
                    fillRule="evenodd"
                    d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>

            <div
              ref={phaseTabTrackRef}
              className="relative h-[3px] w-full select-none rounded-full bg-slate-200/90 dark:bg-slate-700/90"
              onPointerDown={onPhaseTabTrackPointerDown}
            >
              <div
                data-phase-tab-thumb="true"
                className="absolute top-0 h-full cursor-grab touch-none rounded-full active:cursor-grabbing"
                style={{
                  width: `${phaseTabThumbWidthPct}%`,
                  left: `${phaseTabThumbLeftPct}%`,
                  backgroundColor: phaseTabThumbColor,
                }}
                onPointerDown={(e) => {
                  e.stopPropagation()
                  onPhaseTabThumbPointerDown(e)
                }}
                aria-hidden
              />
            </div>
          </div>

          {phaseForOpenMenu
            ? createPortal(
                <div
                  ref={phaseMenuPortalRef}
                  className="fixed z-[200] w-40 min-w-[160px] rounded-lg border border-slate-700 bg-slate-900 py-1 shadow-xl"
                  role="menu"
                  aria-label="Phase actions"
                  style={{ top: phaseMenuPos.top, left: phaseMenuPos.left }}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  {menuDeleteConfirmPhaseId === phaseForOpenMenu.id ? (
                    <div className="px-3 py-2">
                      <p className="text-[13px] leading-snug text-slate-100">
                        Delete this phase and all its tasks?
                      </p>
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          className="flex-1 rounded-md border border-slate-600 bg-slate-800/80 px-2 py-1.5 text-[13px] font-medium text-slate-200 hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            if (import.meta.env.DEV) console.log('menu option clicked:', 'delete-cancel')
                            setMenuDeleteConfirmPhaseId(null)
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="flex-1 rounded-md px-2 py-1.5 text-[13px] font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                          style={{ backgroundColor: '#E24B4A' }}
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            confirmDeletePhase(phaseForOpenMenu.id)
                          }}
                        >
                          Yes, delete
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          if (import.meta.env.DEV) console.log('menu option clicked:', 'rename')
                          startRename(phaseForOpenMenu.id)
                        }}
                        className="flex w-full items-center px-3 py-2 text-left text-[13px] text-slate-100 hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-500/50"
                      >
                        Rename phase
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          if (import.meta.env.DEV) console.log('menu option clicked:', 'add-task')
                          handleMenuAddNewTask(phaseForOpenMenu.id)
                        }}
                        className="flex w-full items-center px-3 py-2 text-left text-[13px] text-slate-100 hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-500/50"
                      >
                        Add new task
                      </button>
                      <div className="my-1 border-t border-slate-700" aria-hidden />
                      <button
                        type="button"
                        role="menuitem"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          if (import.meta.env.DEV) console.log('menu option clicked:', 'delete')
                          cancelPendingTabSwitch()
                          setMenuDeleteConfirmPhaseId(phaseForOpenMenu.id)
                        }}
                        className="flex w-full items-center px-3 py-2 text-left text-[13px] hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-500/50"
                        style={{ color: '#E24B4A' }}
                      >
                        Delete phase
                      </button>
                    </>
                  )}
                </div>,
                document.body,
              )
            : null}

          {addPhasePopoverOpen ? (
            <div
              ref={addPhasePopoverRef}
              className="fixed z-[100] w-[260px] max-w-[min(260px,calc(100vw-1rem))] rounded-lg border border-slate-600 bg-slate-900 p-3 shadow-xl dark:border-slate-600 dark:bg-slate-900"
              style={{ top: addPhasePopoverPos.top, left: addPhasePopoverPos.left }}
              role="dialog"
              aria-label="Create new phase"
            >
              <input
                ref={newPhaseInputRef}
                type="text"
                value={newPhaseName}
                placeholder="Phase name..."
                onChange={(e) => setNewPhaseName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    submitNewPhase()
                  }
                }}
                className="w-full rounded-md border border-slate-600 bg-slate-950/80 px-2.5 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/30"
              />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {PHASE_PICKER_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Select color ${c}`}
                    aria-pressed={newPhaseColor === c}
                    onClick={() => setNewPhaseColor(c)}
                    className={`size-7 shrink-0 rounded-full ring-2 ring-offset-2 ring-offset-slate-900 transition-transform hover:scale-105 ${
                      newPhaseColor === c ? 'ring-white' : 'ring-transparent hover:ring-slate-500'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => closeAddPhasePopover()}
                  className="flex-1 rounded-md border border-slate-600 bg-slate-800/80 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => submitNewPhase()}
                  disabled={!newPhaseName.trim()}
                  className="flex-1 rounded-md bg-teal-600 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
                >
                  Create
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-6">
          {visiblePhases.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-20 text-center dark:border-slate-700 dark:bg-slate-900/40">
              <p className="text-base font-medium text-slate-800 dark:text-slate-100">No phases yet</p>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Click + to add your first phase</p>
            </div>
          ) : activePhase ? (
            <PhaseCard
              key={activePhase.id}
              phase={activePhase}
              tasks={phaseTasks[activePhase.id] ?? []}
              isOpen={openByPhase[activePhase.id] ?? false}
              onToggle={(phaseId, isOpen) => {
                setOpenByPhase((p) => ({ ...p, [phaseId]: isOpen }))
              }}
              requestAddTaskNonce={
                addTaskTrigger?.phaseId === activePhase.id ? addTaskTrigger.nonce : undefined
              }
              onAddTaskConsumed={onAddTaskConsumed}
            />
          ) : null}
        </div>

        <footer className="mt-8 flex flex-col items-center text-center">
          {showResetConfirm ? (
            <div
              className="mb-3 max-w-md px-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400"
              role="dialog"
              aria-label="Confirm reset"
            >
              <p>This will clear all checkboxes and custom tasks. Are you sure?</p>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={() => performFullReset()}
                  className="border-0 bg-transparent p-0 text-sm font-medium text-rose-600 underline-offset-2 hover:underline dark:text-rose-400"
                >
                  Yes, reset
                </button>
                <button
                  type="button"
                  onClick={() => setShowResetConfirm(false)}
                  className="border-0 bg-transparent p-0 text-sm text-slate-500 underline-offset-2 hover:underline dark:text-slate-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => setShowResetConfirm(true)}
            className="border-0 bg-transparent p-0 text-[12px] text-[color:var(--color-text-secondary)] underline-offset-2 hover:underline"
          >
            Reset all progress
          </button>
        </footer>
      </div>
    </div>
  )
}
