import { useCallback, useEffect, useState } from 'react'
import { PHASES } from '../data/phases'
import { useTaskProgress } from '../hooks/useTaskProgress'

/** DOM id for the main scroll target for a phase — use on `<section>` in page content. */
export function phaseSectionDomId(phaseId: number) {
  return `phase-section-${phaseId}`
}

type PhaseSidebarProps = {
  className?: string
}

export function PhaseSidebar({ className = '' }: PhaseSidebarProps) {
  const { getPhaseProgress } = useTaskProgress()
  const [activePhaseId, setActivePhaseId] = useState<string | null>(null)

  const scrollToPhase = useCallback((phaseId: number) => {
    setActivePhaseId(String(phaseId))
    document.getElementById(phaseSectionDomId(phaseId))?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }, [])

  useEffect(() => {
    const sections = PHASES.map((p) => document.getElementById(phaseSectionDomId(p.id))).filter(
      (el): el is HTMLElement => el != null,
    )
    if (sections.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting && e.intersectionRatio > 0)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        const top = visible[0]
        if (top?.target.id) {
          const id = top.target.id.replace(/^phase-section-/, '')
          if (id) setActivePhaseId(id)
        }
      },
      {
        root: null,
        rootMargin: '-42% 0px -42% 0px',
        threshold: [0, 0.08, 0.15, 0.25, 0.5],
      },
    )

    for (const el of sections) observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <aside
      className={`flex flex-col border-slate-200 bg-white/95 dark:border-slate-800 dark:bg-slate-950/95 ${className}`}
    >
      <nav className="min-h-0 flex-1 overflow-y-auto p-3" aria-label="Project phases">
        <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Phases
        </p>
        <ul className="flex flex-col gap-0.5">
          {PHASES.map((phase) => {
            const { done, total } = getPhaseProgress(phase.id)
            const pct = total === 0 ? 0 : Math.round((done / total) * 100)
            const isActive = activePhaseId === String(phase.id)

            return (
              <li key={phase.id}>
                <button
                  type="button"
                  onClick={() => scrollToPhase(phase.id)}
                  aria-current={isActive ? 'true' : undefined}
                  className={`w-full rounded-r-lg border-l-4 py-2.5 pl-3 pr-2 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 dark:focus-visible:ring-teal-400 dark:focus-visible:ring-offset-slate-950 ${
                    isActive
                      ? 'bg-slate-100 dark:bg-slate-800/90'
                      : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-900/70'
                  }`}
                  style={{
                    borderLeftColor: isActive ? phase.color : 'transparent',
                  }}
                >
                  <div className="flex items-start gap-2">
                    <span
                      className="mt-1.5 size-2.5 shrink-0 rounded-full ring-2 ring-white dark:ring-slate-950"
                      style={{ backgroundColor: phase.color }}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        {phase.label}
                      </div>
                      <div className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {phase.name}
                      </div>
                      <div
                        className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700/90"
                        role="progressbar"
                        aria-valuenow={pct}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      >
                        <div
                          className="h-full rounded-full transition-[width] duration-300"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: phase.color,
                          }}
                        />
                      </div>
                      <div className="mt-0.5 text-[10px] tabular-nums text-slate-500 dark:text-slate-400">
                        {done}/{total} ({pct}%)
                      </div>
                    </div>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="shrink-0 border-t border-slate-200 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:border-slate-800">
        <p className="text-center text-[11px] text-slate-500 dark:text-slate-400">
          Progress is saved automatically.
        </p>
      </div>
    </aside>
  )
}
