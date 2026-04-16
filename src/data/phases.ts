import type { Phase, Section, Task } from './types'

/** No built-in phases — users create everything via Add phase / section / task. */
export const PHASES: Phase[] = []

export const getAllTasks = (): Task[] =>
  PHASES.flatMap((p) => p.sections.flatMap((s) => s.tasks))

export const getTasksForPhase = (phaseId: number): Task[] => {
  const p = PHASES.find((ph) => ph.id === phaseId)
  if (!p) return []
  return p.sections.flatMap((s) => s.tasks)
}

export const TASKS: Task[] = getAllTasks()

export const getSectionsForPhase = (phaseId: number): Section[] => {
  const p = PHASES.find((ph) => ph.id === phaseId)
  return p?.sections ?? []
}
