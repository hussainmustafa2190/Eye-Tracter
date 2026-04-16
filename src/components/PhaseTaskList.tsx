import { useRef, useState } from 'react'
import type { Task } from '../data/types'
import { useTaskProgress } from '../hooks/useTaskProgress'

type PhaseTaskListProps = {
  tasks: Task[]
}

export function PhaseTaskList({ tasks }: PhaseTaskListProps) {
  const { completedIds, toggleTask } = useTaskProgress()
  const [burstTaskId, setBurstTaskId] = useState<string | null>(null)
  const burstTimerRef = useRef<number | null>(null)

  function handleToggle(taskId: string) {
    const wasDone = completedIds.has(taskId)
    toggleTask(taskId)
    if (!wasDone) {
      setBurstTaskId(taskId)
      if (burstTimerRef.current != null) window.clearTimeout(burstTimerRef.current)
      burstTimerRef.current = window.setTimeout(() => {
        setBurstTaskId(null)
        burstTimerRef.current = null
      }, 900)
    }
  }

  if (tasks.length === 0) {
    return <p className="text-sm text-slate-400 dark:text-slate-500">No tasks in this phase.</p>
  }

  return (
    <ul className="flex flex-col gap-2">
      {tasks.map((task) => {
        const done = completedIds.has(task.id)
        const showBurst = burstTaskId === task.id
        return (
          <li
            key={task.id}
            className={`rounded-lg ${showBurst ? 'animate-task-complete-confetti' : ''}`}
          >
            <label className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-lg px-1 py-2 hover:bg-slate-50 sm:min-h-0 sm:py-1 dark:hover:bg-slate-800/40">
              <input
                type="checkbox"
                checked={done}
                onChange={() => handleToggle(task.id)}
                className="mt-1 size-[1.125rem] shrink-0 rounded border-slate-300 text-teal-600 focus:ring-2 focus:ring-teal-500 focus:ring-offset-0 focus:ring-offset-white dark:border-slate-600 dark:text-teal-500 dark:focus:ring-teal-400 dark:focus:ring-offset-slate-900"
              />
              <span
                className={`text-sm leading-snug transition-opacity ${
                  done
                    ? 'text-slate-500 line-through opacity-60 dark:text-slate-400 dark:opacity-55'
                    : 'text-slate-800 dark:text-slate-200'
                }`}
              >
                {task.text}
              </span>
            </label>
          </li>
        )
      })}
    </ul>
  )
}
