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
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    value = value.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1')
    if (!process.env[key]) process.env[key] = value
  }
}

function slug(input) {
  return String(input)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60)
}

function ensureUniqueId(preferred, isTaken) {
  if (!isTaken(preferred)) return preferred
  for (let i = 2; i < 10_000; i++) {
    const candidate = `${preferred}-${i}`
    if (!isTaken(candidate)) return candidate
  }
  throw new Error(`Unable to find unique id for ${preferred}`)
}

function normalizeRowPhases(phases) {
  // Legacy shape: phases is an array → treat as customPhases only.
  if (Array.isArray(phases)) {
    return {
      v: 1,
      customPhases: phases,
      deletedPhaseIds: [],
      phaseRenames: {},
      customTasks: [],
      deletedTaskIds: [],
      customSections: [],
      deletedSectionIds: [],
      textEdits: {},
      tipEdits: {},
      renameHint: null,
    }
  }
  if (phases && typeof phases === 'object' && phases.v === 1) {
    return {
      v: 1,
      customPhases: Array.isArray(phases.customPhases) ? phases.customPhases : [],
      deletedPhaseIds: Array.isArray(phases.deletedPhaseIds)
        ? phases.deletedPhaseIds.filter((x) => typeof x === 'number')
        : [],
      phaseRenames: phases.phaseRenames && typeof phases.phaseRenames === 'object' ? phases.phaseRenames : {},
      customTasks: Array.isArray(phases.customTasks) ? phases.customTasks : [],
      deletedTaskIds: Array.isArray(phases.deletedTaskIds)
        ? phases.deletedTaskIds.filter((x) => typeof x === 'string')
        : [],
      customSections: Array.isArray(phases.customSections) ? phases.customSections : [],
      deletedSectionIds: Array.isArray(phases.deletedSectionIds)
        ? phases.deletedSectionIds.filter((x) => typeof x === 'string')
        : [],
      textEdits: phases.textEdits && typeof phases.textEdits === 'object' ? phases.textEdits : {},
      tipEdits: phases.tipEdits && typeof phases.tipEdits === 'object' ? phases.tipEdits : {},
      renameHint: typeof phases.renameHint === 'string' ? phases.renameHint : null,
    }
  }
  // Unknown: start fresh (preserve completed_ids separately)
  return {
    v: 1,
    customPhases: [],
    deletedPhaseIds: [],
    phaseRenames: {},
    customTasks: [],
    deletedTaskIds: [],
    customSections: [],
    deletedSectionIds: [],
    textEdits: {},
    tipEdits: {},
    renameHint: null,
  }
}

const PHASE_COLORS = ['#7F77DD', '#1D9E75', '#378ADD', '#EF9F27', '#D85A30']

const ROADMAP = [
  {
    label: 'Phase 1',
    name: 'Orientation & Setup',
    sections: [
      {
        label: 'Advisor Alignment',
        tasks: [
          'Draft 2-3 research angle proposals on one page',
          'Schedule a 30-minute meeting with advisor',
          'Confirm deliverable type (paper, thesis chapter, poster)',
          'Confirm timeline and key milestones',
          'Write down agreed scope in one paragraph',
        ],
      },
      {
        label: 'Tool Setup',
        tasks: [
          'Install FEBio Studio (latest stable version)',
          'Set up project folder structure (models/, results/, papers/, notes/, scripts/)',
          'Initialize Git repo for version control',
          'Install febio-python or scripting library',
          'Test running a .feb file from the command line',
        ],
      },
      {
        label: 'Learn FEBio Basics',
        tasks: [
          'Complete FEBio Studio tutorial 1 (geometry + meshing)',
          'Complete FEBio Studio tutorial 2 (materials + boundary conditions)',
          'Complete FEBio Studio tutorial 3 (nonlinear or contact)',
          'Open one example .feb file and read through the XML',
          'Write a one-page FEBio cheat sheet in own words',
        ],
      },
    ],
  },
  {
    label: 'Phase 2',
    name: 'Targeted Reading',
    sections: [
      {
        label: 'Geometry Papers',
        tasks: [
          'Read Burd Judge Cross 2002 and extract lens geometry values',
          'Read Cabeza-Gil Grasa Calvo 2021 for unaccommodated-as-reference setup',
          'Read Pu et al 2023 for zonule group arrangement',
          'Create geometry_params.csv with all values and sources',
        ],
      },
      {
        label: 'Material Property Papers',
        tasks: [
          'Read Wilde Burd Judge 2012 for age-dependent shear moduli',
          'Read Pedrigi David Dziezyc Humphrey 2007 for capsule anisotropy',
          'Read Tahsini 2024 on storage effects for porcine data',
          'Create material_params.csv for ages 20, 40, 60',
        ],
      },
      {
        label: 'Context & Debates',
        tasks: [
          'Skim Schachar 2006 correspondence on material properties',
          'Skim Ye et al 2024 on solver differences',
          'Write one-page summary of key controversies',
        ],
      },
    ],
  },
  {
    label: 'Phase 3',
    name: 'Baseline Model',
    sections: [
      {
        label: 'Geometry',
        tasks: [
          'Create 2D axisymmetric sketch of 29-year-old lens',
          'Mesh with quad elements (~500-1000 elements)',
          'Define nucleus and cortex regions',
          'Save as baseline_v1.feb',
        ],
      },
      {
        label: 'Materials',
        tasks: [
          'Assign Neo-Hookean to nucleus with Wilde 2012 modulus',
          'Assign Neo-Hookean to cortex with Wilde 2012 modulus',
          "Set Poisson's ratio to ~0.49",
        ],
      },
      {
        label: 'Boundary Conditions & First Run',
        tasks: [
          'Fix axis of symmetry',
          'Apply prescribed radial displacement at equator (~0.3 mm)',
          'Run simulation and verify convergence',
          'Confirm lens thins and flattens as expected',
        ],
      },
      {
        label: 'Sanity Check',
        tasks: [
          'Plot deformed vs undeformed shape',
          'Measure anterior and posterior radius changes',
          'Compare qualitatively to Burd 2002 figures',
          'Write notes on what worked and what was surprising',
        ],
      },
    ],
  },
  {
    label: 'Phase 4',
    name: 'Full Accommodation Model',
    sections: [
      {
        label: 'Add the Capsule',
        tasks: [
          'Add thin shell layer (~15 micrometers) around lens',
          'Start with isotropic Ogden hyperelastic',
          'Re-run and confirm convergence',
          'Optional upgrade to Holzapfel-Gasser-Ogden',
        ],
      },
      {
        label: 'Add Zonules',
        tasks: [
          'Add anterior, equatorial, posterior zonule groups as line elements',
          'Use tension-only spring material',
          'Create ciliary body ring for anchoring',
          'Drive accommodation via ciliary displacement',
        ],
      },
      {
        label: 'Age Variants',
        tasks: [
          'Duplicate model for 20-year-old parameters',
          'Duplicate model for 40-year-old parameters',
          'Duplicate model for 60-year-old parameters',
          'Plot accommodation amplitude across ages',
        ],
      },
      {
        label: 'Optical Output',
        tasks: [
          'Extract deformed anterior and posterior radii of curvature',
          'Compute central optical power using thick-lens formula',
          'Compare to in-vivo values from Dubbelman or Strenk',
        ],
      },
    ],
  },
  {
    label: 'Phase 5',
    name: 'Research Contribution',
    sections: [
      {
        label: 'Pin Down the Question',
        tasks: [
          'Lock in specific contribution with advisor',
          'Write research question in one paragraph',
          'Define what success looks like',
        ],
      },
      {
        label: 'Run the Study',
        tasks: [
          'Write Python script to automate parameter sweeps',
          'Run full sweep with clear output filenames',
          'Collect results into DataFrame or CSV',
        ],
      },
      {
        label: 'Validation',
        tasks: [
          'Compare results to published dataset',
          'Investigate discrepancies',
          'Document validation decisions',
        ],
      },
    ],
  },
  {
    label: 'Phase 6',
    name: 'Documentation & Writeup',
    sections: [
      {
        label: 'Figures',
        tasks: [
          'Deformed shape comparison figure',
          'Stress distribution figure',
          'Main result figure',
          'Validation figure',
        ],
      },
      {
        label: 'Write',
        tasks: [
          'Draft introduction using controversies summary',
          'Draft methods using parameter CSVs',
          'Draft results with figures',
          'Draft discussion',
          'Get advisor feedback and revise',
        ],
      },
      {
        label: 'Share',
        tasks: [
          'Clean up .feb files and scripts',
          'Write README.md with reproduction steps',
          'Push to GitHub',
          'Prepare final presentation slides',
        ],
      },
    ],
  },
]

async function main() {
  loadDotEnvIntoProcessEnv()

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Add them to .env or set them in the environment before running.',
    )
  }

  const supabase = createClient(supabaseUrl, supabaseKey)
  const rowId = 'user-1'

  const { data: existing, error: readErr } = await supabase
    .from('app_data')
    .select('*')
    .eq('id', rowId)
    .maybeSingle()
  if (readErr) throw new Error(readErr.message)

  const completed_ids = Array.isArray(existing?.completed_ids)
    ? existing.completed_ids.filter((x) => typeof x === 'string')
    : []

  const phasesV1 = normalizeRowPhases(existing?.phases ?? null)

  const customPhases = Array.isArray(phasesV1.customPhases) ? [...phasesV1.customPhases] : []
  const customSections = Array.isArray(phasesV1.customSections) ? [...phasesV1.customSections] : []
  const customTasks = Array.isArray(phasesV1.customTasks) ? [...phasesV1.customTasks] : []

  const deletedPhaseIds = new Set(phasesV1.deletedPhaseIds ?? [])
  const deletedTaskIds = new Set(phasesV1.deletedTaskIds ?? [])
  const deletedSectionIds = new Set(phasesV1.deletedSectionIds ?? [])

  const takenPhaseIds = new Set(
    customPhases
      .map((p) => (p && typeof p === 'object' ? p.id : null))
      .filter((x) => typeof x === 'number'),
  )
  let maxPhaseId = takenPhaseIds.size ? Math.max(...takenPhaseIds) : -1

  const phaseKeyToId = new Map()
  for (const p of customPhases) {
    if (!p || typeof p !== 'object') continue
    const name = typeof p.name === 'string' ? p.name : ''
    if (!name) continue
    phaseKeyToId.set(name, typeof p.id === 'number' ? p.id : null)
  }

  const isSectionTaken = (id) =>
    customSections.some((s) => s && typeof s === 'object' && typeof s.id === 'string' && s.id === id)
  const isTaskTaken = (id) =>
    customTasks.some((t) => t && typeof t === 'object' && typeof t.id === 'string' && t.id === id)

  let addedPhases = 0
  let addedSections = 0
  let addedTasks = 0

  for (let i = 0; i < ROADMAP.length; i++) {
    const phaseSpec = ROADMAP[i]
    let phaseId = phaseKeyToId.get(phaseSpec.name)
    if (typeof phaseId !== 'number') {
      maxPhaseId += 1
      phaseId = maxPhaseId
      while (deletedPhaseIds.has(phaseId) || takenPhaseIds.has(phaseId)) {
        maxPhaseId += 1
        phaseId = maxPhaseId
      }
      takenPhaseIds.add(phaseId)
      const color = PHASE_COLORS[i % PHASE_COLORS.length]
      customPhases.push({
        id: phaseId,
        label: phaseSpec.label,
        name: phaseSpec.name,
        color,
      })
      phaseKeyToId.set(phaseSpec.name, phaseId)
      addedPhases++
    }

    // Sections
    for (const sec of phaseSpec.sections) {
      const alreadyHasSection = customSections.some(
        (s) =>
          s &&
          typeof s === 'object' &&
          typeof s.phaseId === 'number' &&
          s.phaseId === phaseId &&
          typeof s.label === 'string' &&
          s.label === sec.label,
      )
      if (!alreadyHasSection) {
        const preferred = `seed-sec-${phaseId}-${slug(sec.label)}`
        const id = ensureUniqueId(preferred, isSectionTaken)
        if (!deletedSectionIds.has(id)) {
          customSections.push({ id, phaseId, label: sec.label })
          addedSections++
        }
      }

      // Tasks (dedupe by text within phase+section)
      for (const taskText of sec.tasks) {
        const alreadyHasTask = customTasks.some(
          (t) =>
            t &&
            typeof t === 'object' &&
            typeof t.phaseId === 'number' &&
            t.phaseId === phaseId &&
            typeof t.sectionLabel === 'string' &&
            t.sectionLabel === sec.label &&
            typeof t.text === 'string' &&
            t.text === taskText,
        )
        if (alreadyHasTask) continue

        const preferred = `seed-task-${phaseId}-${slug(sec.label)}-${slug(taskText)}`
        const id = ensureUniqueId(preferred, isTaskTaken)
        if (deletedTaskIds.has(id)) continue
        customTasks.push({ id, phaseId, sectionLabel: sec.label, text: taskText, tip: '' })
        addedTasks++
      }
    }
  }

  const nextRow = {
    id: rowId,
    phases: {
      ...phasesV1,
      v: 1,
      customPhases,
      customSections,
      customTasks,
    },
    completed_ids,
    updated_at: new Date().toISOString(),
  }

  const { error: upsertErr } = await supabase.from('app_data').upsert(nextRow, { onConflict: 'id' })
  if (upsertErr) throw new Error(upsertErr.message)

  const { data: after } = await supabase.from('app_data').select('*').eq('id', rowId).maybeSingle()

  const phasesAfter = normalizeRowPhases(after?.phases ?? null)
  const samplePhase = phasesAfter.customPhases?.[0] ?? null
  const sampleSection = phasesAfter.customSections?.[0] ?? null
  const sampleTask = phasesAfter.customTasks?.[0] ?? null

  console.log(
    JSON.stringify(
      {
        ok: true,
        added: { phases: addedPhases, sections: addedSections, tasks: addedTasks },
        sample: { customPhase: samplePhase, customSection: sampleSection, customTask: sampleTask },
      },
      null,
      2,
    ),
  )
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
