/** Phase-scoped task completion badge (tabs + phase card header). */
export function PhasePercentBadge({
  pct,
  phaseColor,
  size,
}: {
  pct: number
  phaseColor: string
  size: 'tab' | 'header'
}) {
  const tabCls =
    'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums leading-none'
  const headerCls =
    'inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-base font-semibold tabular-nums leading-none'
  const cls = size === 'tab' ? tabCls : headerCls

  if (pct === 0) {
    return (
      <span
        className={`${cls} bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400`}
        aria-label={`${pct}% tasks in this phase`}
      >
        0%
      </span>
    )
  }

  if (pct === 100) {
    return (
      <span
        className={`${cls} text-[#3B6D11]`}
        style={{ backgroundColor: '#EAF3DE' }}
        aria-label="All tasks in this phase complete"
      >
        ✓ 100%
      </span>
    )
  }

  const bg =
    phaseColor.length === 7 && phaseColor.startsWith('#')
      ? `${phaseColor}33`
      : phaseColor

  return (
    <span
      className={cls}
      style={{ backgroundColor: bg, color: phaseColor }}
      aria-label={`${pct}% tasks in this phase`}
    >
      {pct}%
    </span>
  )
}
