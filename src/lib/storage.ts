let persistenceScheduler: (() => void) | null = null
let persistQueued = false

/** Called from SaveStatusProvider on mount — debounced cloud save runs here. */
export function registerPersistenceScheduler(fn: (() => void) | null) {
  persistenceScheduler = fn
}

/** Call after any localStorage write so cloud sync can debounce. */
export function requestPersist() {
  if (!persistenceScheduler) return
  if (persistQueued) return
  persistQueued = true
  queueMicrotask(() => {
    persistQueued = false
    persistenceScheduler?.()
  })
}
