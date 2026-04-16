const PROJECT_START = new Date(2026, 3, 20)
const PROJECT_LENGTH_WEEKS = 20

const MS_PER_DAY = 86400000

function startOfLocalDay(d: Date): Date {
  const t = new Date(d)
  t.setHours(0, 0, 0, 0)
  return t
}

function formatLongDate(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
}

export function TimelineBar() {
  const start = startOfLocalDay(PROJECT_START)
  const today = startOfLocalDay(new Date())
  const spanMs = PROJECT_LENGTH_WEEKS * 7 * MS_PER_DAY
  const startedLabel = formatLongDate(PROJECT_START)

  let pct = 0
  let weeksIn = 0
  let beforeStart = false

  if (today.getTime() < start.getTime()) {
    beforeStart = true
  } else {
    const elapsedMs = today.getTime() - start.getTime()
    const pctRaw = spanMs > 0 ? (elapsedMs / spanMs) * 100 : 0
    pct = Math.min(100, Math.max(0, pctRaw))
    weeksIn = Math.floor(elapsedMs / (7 * MS_PER_DAY))
  }

  const weeksLabel = beforeStart
    ? 'Not started yet'
    : `${weeksIn} week${weeksIn === 1 ? '' : 's'} in`

  return (
    <div className="border-b border-slate-200/90 bg-slate-50/95 dark:border-slate-800 dark:bg-slate-900/80">
      <div className="mx-auto max-w-6xl px-3 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Project timeline
        </p>
        <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="text-sm text-slate-700 dark:text-slate-300">
            <span className="text-slate-500 dark:text-slate-400">Started </span>
            <time dateTime="2026-04-20" className="font-medium text-slate-800 dark:text-slate-200">
              {startedLabel}
            </time>
          </p>
          <p className="text-sm tabular-nums text-slate-600 dark:text-slate-400">{weeksLabel}</p>
        </div>

        <div
          className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200/90 dark:bg-slate-700/80"
          role="presentation"
          aria-hidden
        >
          <div
            className="h-full rounded-full bg-slate-400/90 transition-[width] duration-500 ease-out dark:bg-slate-500"
            style={{ width: `${pct}%` }}
          />
        </div>

        <p className="mt-2 text-[11px] leading-snug text-slate-500 dark:text-slate-500">
          Work at your own pace — time shown for reference only.
        </p>
      </div>
    </div>
  )
}
