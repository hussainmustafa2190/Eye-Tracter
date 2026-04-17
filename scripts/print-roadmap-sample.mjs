import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function loadDotEnvIntoProcessEnv() {
  const envPath = path.resolve(__dirname, '..', '.env')
  if (!fs.existsSync(envPath)) return
  const raw = fs.readFileSync(envPath, 'utf8')
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i < 0) continue
    const k = t.slice(0, i).trim()
    const v = t.slice(i + 1).trim()
    if (!process.env[k]) process.env[k] = v
  }
}

function normalizeRowPhases(phases) {
  if (Array.isArray(phases)) {
    return { v: 1, customPhases: phases, customSections: [], customTasks: [] }
  }
  if (phases && typeof phases === 'object' && phases.v === 1) return phases
  return { v: 1, customPhases: [], customSections: [], customTasks: [] }
}

async function main() {
  loadDotEnvIntoProcessEnv()
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
  const supabase = createClient(supabaseUrl, supabaseKey)

  const { data, error } = await supabase.from('app_data').select('*').eq('id', 'user-1').maybeSingle()
  if (error) throw new Error(error.message)

  const v1 = normalizeRowPhases(data?.phases ?? null)
  const phase = v1.customPhases.find((p) => p && p.name === 'Orientation & Setup')
  const phaseId = phase?.id
  const section = v1.customSections.find((s) => s && s.phaseId === phaseId && s.label === 'Advisor Alignment')
  const task = v1.customTasks.find((t) => t && t.phaseId === phaseId && t.sectionLabel === 'Advisor Alignment')

  console.log(JSON.stringify({ phase, section, task }, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})

