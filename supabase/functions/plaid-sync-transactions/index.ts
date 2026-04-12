import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const PLAID_CLIENT_ID = Deno.env.get('PLAID_CLIENT_ID')
const PLAID_SECRET = Deno.env.get('PLAID_SECRET')
const PLAID_ENV = Deno.env.get('PLAID_ENV') || 'sandbox'

const PLAID_URL = PLAID_ENV === 'production' 
  ? 'https://production.plaid.com'
  : PLAID_ENV === 'development'
  ? 'https://development.plaid.com'
  : 'https://sandbox.plaid.com'

serve(async (req) => {
  try {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response('ok', {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        },
      })
    }

    // Get user from auth header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      throw new Error('Unauthorized')
    }

    // Get item_id from request or fetch all user's items
    const { item_id } = await req.json()

    let itemsToSync = []

    if (item_id) {
      // Sync specific item
      const { data, error } = await supabaseClient
        .from('plaid_items')
        .select('*')
        .eq('item_id', item_id)
        .eq('user_id', user.id)
        .single()

      if (error || !data) {
        throw new Error('Item not found')
      }
      itemsToSync = [data]
    } else {
      // Sync all user's items
      const { data, error } = await supabaseClient
        .from('plaid_items')
        .select('*')
        .eq('user_id', user.id)

      if (error) {
        throw new Error('Failed to fetch items')
      }
      itemsToSync = data || []
    }

    let totalAdded = 0
    let totalModified = 0
    let totalRemoved = 0

    // Sync transactions for each item
    for (const item of itemsToSync) {
      const cursor = item.transactions_cursor || null

      // Use transactions/sync endpoint
      const response = await fetch(`${PLAID_URL}/transactions/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: PLAID_CLIENT_ID,
          secret: PLAID_SECRET,
          access_token: item.access_token,
          cursor: cursor,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        console.error('Plaid API error for item:', item.item_id, data)
        continue
      }

      const { added, modified, removed, next_cursor, has_more } = data

      // Store added transactions
      if (added && added.length > 0) {
        const transactions = added.map((txn: any) => ({
          user_id: user.id,
          item_id: item.item_id,
          account_id: txn.account_id,
          transaction_id: txn.transaction_id,
          amount: txn.amount,
          date: txn.date,
          name: txn.name,
          merchant_name: txn.merchant_name,
          category: txn.category,
          pending: txn.pending,
          payment_channel: txn.payment_channel,
        }))

        await supabaseClient.from('transactions').upsert(transactions, {
          onConflict: 'transaction_id',
        })
        totalAdded += added.length
      }

      // Update modified transactions
      if (modified && modified.length > 0) {
        const transactions = modified.map((txn: any) => ({
          user_id: user.id,
          item_id: item.item_id,
          account_id: txn.account_id,
          transaction_id: txn.transaction_id,
          amount: txn.amount,
          date: txn.date,
          name: txn.name,
          merchant_name: txn.merchant_name,
          category: txn.category,
          pending: txn.pending,
          payment_channel: txn.payment_channel,
        }))

        await supabaseClient.from('transactions').upsert(transactions, {
          onConflict: 'transaction_id',
        })
        totalModified += modified.length
      }

      // Remove deleted transactions
      if (removed && removed.length > 0) {
        const transactionIds = removed.map((txn: any) => txn.transaction_id)
        await supabaseClient
          .from('transactions')
          .delete()
          .in('transaction_id', transactionIds)
        totalRemoved += removed.length
      }

      // Update cursor
      await supabaseClient
        .from('plaid_items')
        .update({ 
          transactions_cursor: next_cursor,
          last_synced_at: new Date().toISOString(),
        })
        .eq('item_id', item.item_id)

      // If has_more is true, we should continue syncing (for now, just log it)
      if (has_more) {
        console.log('More transactions available for item:', item.item_id)
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      added: totalAdded,
      modified: totalModified,
      removed: totalRemoved,
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  }
})
