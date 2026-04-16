export interface Task {
  id: string
  phaseId: number
  sectionLabel: string
  text: string
  tip?: string
}

export interface Section {
  label: string
  tasks: Task[]
}

export interface Phase {
  id: number
  label: string
  name: string
  color: string
  bgColor: string
  insight: string
  sections: Section[]
}

