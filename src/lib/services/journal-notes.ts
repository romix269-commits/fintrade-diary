import { createClient } from '@/lib/supabase/client'

export async function addJournalNote() {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('journal_notes')
    .insert([
      {
        title: 'Тестовая заметка',
        content: 'Это первая тестовая запись дневника',
      },
    ])
    .select()

  return { data, error }
}

export async function getJournalNotes() {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('journal_notes')
    .select('*')
    .order('id', { ascending: false })

  return { data, error }
}