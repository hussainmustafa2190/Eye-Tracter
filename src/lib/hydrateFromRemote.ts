import { applySnapshotFromRow, type AppDataRow } from './snapshot'
import { APP_DATA_ROW_ID } from './storageKeys'
import { supabase, supabaseConfigured } from './supabase'

/** Load remote row into localStorage before the app reads initial state. Falls back silently on error or missing row. */
export async function hydrateFromRemote(): Promise<void> {
  if (!supabaseConfigured) return
  const { data, error } = await supabase
    .from('app_data')
    .select('*')
    .eq('id', APP_DATA_ROW_ID)
    .maybeSingle()
  if (error || !data) return
  applySnapshotFromRow(data as AppDataRow)
}
