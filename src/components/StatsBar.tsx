export type StatsBarProps = {
  completedCount: number
  totalCount: number
  fullyDonePhases: number
  totalPhases: number
  /** completedTasks / totalTasks * 100 */
  tasksCompletePercent: number
  /** fullyDonePhases / totalPhases * 100 */
  phasesCompletePercent: number
}

export function StatsBar({
  completedCount,
  totalCount,
  fullyDonePhases,
  totalPhases,
  tasksCompletePercent,
  phasesCompletePercent,
}: StatsBarProps) {
  return (
    <section
      aria-label="Project stats"
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/60 sm:p-6"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl bg-slate-50 px-4 py-3 text-center dark:bg-slate-800/50">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Tasks completed
          </p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-100">
            {completedCount}{' '}
            <span className="font-normal text-slate-500 dark:text-slate-400">/ {totalCount}</span>
          </p>
        </div>

        <div className="rounded-xl bg-slate-50 px-4 py-3 text-center dark:bg-slate-800/50">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Phases fully done
          </p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-100">
            {fullyDonePhases}{' '}
            <span className="font-normal text-slate-500 dark:text-slate-400">/ {totalPhases}</span>
          </p>
        </div>

        <div className="rounded-xl bg-slate-50 px-4 py-3 text-center dark:bg-slate-800/50">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Tasks complete
          </p>
          <p className="mt-1 text-4xl font-bold tabular-nums tracking-tight text-teal-600 dark:text-teal-400">
            {tasksCompletePercent}%
          </p>
        </div>

        <div className="rounded-xl bg-slate-50 px-4 py-3 text-center dark:bg-slate-800/50">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Phases complete
          </p>
          <p className="mt-1 text-4xl font-bold tabular-nums tracking-tight text-teal-600 dark:text-teal-400">
            {phasesCompletePercent}%
          </p>
        </div>
      </div>
    </section>
  )
}
