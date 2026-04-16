import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { upsertSnapshotToSupabase } from './snapshot'
import { registerPersistenceScheduler } from './storage'
import { supabaseConfigured } from './supabase'

type SaveUiStatus = 'idle' | 'saving' | 'saved' | 'local'

const SaveStatusContext = createContext<SaveUiStatus>('idle')

function useSaveStatus(): SaveUiStatus {
  return useContext(SaveStatusContext)
}

export function SaveStatusProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SaveUiStatus>('idle')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hideRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearHide = useCallback(() => {
    if (hideRef.current) {
      clearTimeout(hideRef.current)
      hideRef.current = null
    }
  }, [])

  const scheduleHide = useCallback(() => {
    clearHide()
    hideRef.current = setTimeout(() => setStatus('idle'), 2000)
  }, [clearHide])

  const flushSave = useCallback(async () => {
    debounceRef.current = null

    if (!supabaseConfigured) {
      setStatus('local')
      scheduleHide()
      return
    }

    const { error } = await upsertSnapshotToSupabase()
    if (error) {
      setStatus('local')
    } else {
      setStatus('saved')
    }
    scheduleHide()
  }, [scheduleHide])

  const onSchedule = useCallback(() => {
    setStatus('saving')
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      void flushSave()
    }, 1000)
  }, [flushSave])

  useLayoutEffect(() => {
    registerPersistenceScheduler(onSchedule)
    return () => {
      registerPersistenceScheduler(null)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      clearHide()
    }
  }, [onSchedule, clearHide])

  return <SaveStatusContext.Provider value={status}>{children}</SaveStatusContext.Provider>
}

export function SaveIndicator() {
  const status = useSaveStatus()
  if (status === 'idle') return null
  if (status === 'saving') {
    return (
      <div
        className="pointer-events-none fixed top-3 right-3 z-50 text-[12px] text-[color:var(--color-text-secondary)]"
        aria-live="polite"
      >
        Saving...
      </div>
    )
  }
  if (status === 'saved') {
    return (
      <div
        className="pointer-events-none fixed top-3 right-3 z-50 flex items-center gap-1.5 text-[12px] text-emerald-600 dark:text-emerald-400"
        aria-live="polite"
      >
        <span className="size-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden />
        Saved
      </div>
    )
  }
  return (
    <div
      className="pointer-events-none fixed top-3 right-3 z-50 text-[12px] text-amber-700 dark:text-amber-400"
      aria-live="polite"
    >
      Saved locally
    </div>
  )
}
