let persistenceScheduler: (() => void) | null = null

/** Called from SaveStatusProvider on mount — debounced cloud save runs here. */
export function registerPersistenceScheduler(fn: (() => void) | null) {
  persistenceScheduler = fn
}

/** Call after any localStorage write so cloud sync can debounce. */
export function requestPersist() {
  persistenceScheduler?.()
}
