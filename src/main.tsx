import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { TaskProgressProvider } from './hooks/useTaskProgress'
import { hydrateFromRemote } from './lib/hydrateFromRemote'
import { SaveIndicator, SaveStatusProvider } from './lib/saveStatus'

const el = document.getElementById('root')!
const root = createRoot(el)

void (async () => {
  await hydrateFromRemote()
  root.render(
    <StrictMode>
      <SaveStatusProvider>
        <TaskProgressProvider>
          <App />
          <SaveIndicator />
        </TaskProgressProvider>
      </SaveStatusProvider>
    </StrictMode>,
  )
})()
