import { createClient } from '@/lib/supabase/client'

export async function addTrade() {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('trades')
    .insert([
      {
        ticker: 'AAPL',
        direction: 'long',
        entry_price: 150,
        exit_price: 155,
        pnl: 5,
        notes: 'Тестовая сделка',
      },
    ])
    .select()

  return { data, error }
}

export async function getTrades() {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('trades')
    .select('*')
    .order('id', { ascending: false })

  return { data, error }
}