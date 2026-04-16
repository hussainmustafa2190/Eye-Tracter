import { useEffect, useMemo, useRef, useState } from 'react'
import { getTasksForPhase, PHASES, TASKS } from '../data/phases'
import { useTaskProgress } from '../hooks/useTaskProgress'
import { PhaseTaskList } from './PhaseTaskList'
import { phaseSectionDomId } from './PhaseSidebar'

const PROJECT_NAME = 'FEA Eye Model Tracker'

function PhaseCompleteIcon() {
  return (
    <span
      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm ring-2 ring-emerald-200/80 dark:bg-emerald-600 dark:ring-emerald-900/50"
      aria-hidden
    >
      <svg className="size-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
        <path
          fillRule="evenodd"
          d="M16.704 4.153a.75.75 0 01.143 1.052l-7.5 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 6.948-9.817a.75.75 0 011.05-.143z"
          clipRule="evenodd"
        />
      </svg>
    </span>
  )
}

export function MainView() {
  const [openByPhase, setOpenByPhase] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(PHASES.map((p, i) => [p.id, i === 0])),
  )
  const prevDoneRef = useRef<Record<string, number>>({})
  const hadProgressRef = useRef(false)
  const { completedIds, getPhaseProgress } = useTaskProgress()

  const { overallPct, doneCount, totalCount } = useMemo(() => {
    const total = TASKS.length
    const done = TASKS.filter((t) => completedIds.has(t.id)).length
    const pct = total === 0 ? 0 : Math.round((done / total) * 100)
    return { overallPct: pct, doneCount: done, totalCount: total }
  }, [completedIds])

  const { phasesFullyDone, phasesUnderway } = useMemo(() => {
    let fully = 0
    let underway = 0
    for (const p of PHASES) {
      const { done, total } = getPhaseProgress(p.id)
      if (total === 0) continue
      if (done === total) fully++
      else if (done > 0) underway++
    }
    return { phasesFullyDone: fully, phasesUnderway: underway }
  }, [completedIds, getPhaseProgress])

  useEffect(() => {
    for (const phase of PHASES) {
      const { done, total } = getPhaseProgress(phase.id)
      const prev = prevDoneRef.current[phase.id]
      prevDoneRef.current[phase.id] = done

      if (total === 0 || done !== total) continue
      const justFinished = prev === undefined ? done === total : prev < total
      if (justFinished) {
        setOpenByPhase((p) => ({ ...p, [phase.id]: false }))
      }
    }
  }, [completedIds, getPhaseProgress])

  useEffect(() => {
    if (completedIds.size > 0) hadProgressRef.current = true
    if (hadProgressRef.current && completedIds.size === 0) {
      hadProgressRef.current = false
      setOpenByPhase(Object.fromEntries(PHASES.map((p, i) => [p.id, i === 0])))
      prevDoneRef.current = {}
    }
  }, [completedIds.size])

  return (
    <div className="min-w-0 flex-1 bg-slate-50 pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:bg-slate-950">
      <div className="sticky top-0 z-40 border-b border-slate-200/90 bg-white/90 shadow-sm backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/90">
        <header className="px-3 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-4">
          <h1 className="mx-auto max-w-3xl text-base font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            {PROJECT_NAME}
          </h1>
        </header>
      </div>

      <div className="mx-auto max-w-3xl px-3 py-5 sm:px-4 sm:py-6">
        <p className="mb-4 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          Work through tasks in any order. Progress is saved in this browser.
        </p>

        <section
          className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/60 sm:p-6"
          aria-label="Completion overview"
        >
          <p className="text-center text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Overall completion
          </p>
          <p
            className="mt-1 text-center text-5xl font-bold tabular-nums tracking-tight text-teal-600 sm:text-6xl dark:text-teal-400"
            aria-live="polite"
          >
            {overallPct}%
          </p>
          <p className="mt-2 text-center text-sm text-slate-600 dark:text-slate-400">
            {doneCount === totalCount && totalCount > 0
              ? 'Outstanding — every task is complete.'
              : 'Every task you finish adds to this score.'}
          </p>

          <dl className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-6">
            <div className="rounded-xl bg-slate-50 px-4 py-3 text-center dark:bg-slate-800/50">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Tasks completed
              </dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                {doneCount}{' '}
                <span className="font-normal text-slate-500 dark:text-slate-400">/ {totalCount}</span>
              </dd>
            </div>
            <div className="rounded-xl bg-slate-50 px-4 py-3 text-center dark:bg-slate-800/50">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Phases complete
              </dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                {phasesFullyDone}{' '}
                <span className="font-normal text-slate-500 dark:text-slate-400">/ {PHASES.length}</span>
              </dd>
            </div>
            <div className="rounded-xl bg-slate-50 px-4 py-3 text-center dark:bg-slate-800/50">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Phases in progress
              </dt>
              <dd className="mt-1">
                <span className="block text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                  {phasesUnderway}
                </span>
                <span className="mt-1 block text-[10px] leading-tight text-slate-500 dark:text-slate-500">
                  At least one task done, not all yet
                </span>
              </dd>
            </div>
          </dl>

          <p className="mt-6 border-t border-slate-100 pt-4 text-center text-xs text-slate-500 dark:border-slate-700/80 dark:text-slate-400">
            Progress is saved automatically.
          </p>
        </section>

        <div className="flex flex-col gap-3">
          {PHASES.map((phase) => {
            const { done, total } = getPhaseProgress(phase.id)
            const phaseTasks = getTasksForPhase(phase.id)
            const pct = total === 0 ? 0 : Math.round((done / total) * 100)
            const phaseComplete = total > 0 && done === total

            return (
              <details
                key={phase.id}
                id={phaseSectionDomId(phase.id)}
                className={`group scroll-mt-24 rounded-xl border bg-white shadow-sm open:shadow-md dark:bg-slate-900/50 ${
                  phaseComplete
                    ? 'border-emerald-400/80 dark:border-emerald-700/70'
                    : 'border-slate-200 dark:border-slate-700'
                }`}
                open={openByPhase[phase.id] ?? false}
                onToggle={(e) => {
                  const el = e.currentTarget
                  setOpenByPhase((prev) => ({ ...prev, [phase.id]: el.open }))
                }}
              >
                <summary className="cursor-pointer list-none rounded-xl px-3 py-4 sm:px-4 [&::-webkit-details-marker]:hidden">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-1 gap-3">
                      {phaseComplete ? (
                        <div className="pt-0.5">
                          <PhaseCompleteIcon />
                        </div>
                      ) : null}
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          {phase.label}
                        </p>
                        <h2 className="mt-0.5 text-base font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                          {phase.name}
                          {phaseComplete ? (
                            <span className="sr-only"> — complete</span>
                          ) : null}
                        </h2>
                        <div className="mt-3 flex items-center gap-3">
                          <div
                            className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700/90"
                            role="progressbar"
                            aria-valuenow={pct}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label={`${phase.name} progress`}
                          >
                            <div
                              className={`h-full rounded-full transition-[width] duration-300 ease-out ${
                                phaseComplete ? 'bg-emerald-500 dark:bg-emerald-500' : ''
                              }`}
                              style={
                                phaseComplete
                                  ? { width: '100%' }
                                  : {
                                      width: `${pct}%`,
                                      backgroundColor: phase.color,
                                    }
                              }
                            />
                          </div>
                          <span className="shrink-0 text-xs font-medium tabular-nums text-slate-600 dark:text-slate-400">
                            {done}/{total}
                          </span>
                        </div>
                      </div>
                    </div>
                    <svg
                      className="mt-0.5 size-5 shrink-0 text-slate-400 transition-transform group-open:rotate-180 dark:text-slate-500"
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
                </summary>

                <div className="border-t border-slate-100 px-3 pb-4 pt-3 dark:border-slate-800 sm:px-4">
                  <PhaseTaskList tasks={phaseTasks} />
                </div>
              </details>
            )
          })}
        </div>
      </div>
    </div>
  )
}
