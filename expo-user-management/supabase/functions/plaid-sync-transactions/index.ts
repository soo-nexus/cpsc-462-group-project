import { corsHeaders } from '../_shared/cors.ts'
import { getPlaidClient, mapPlaidCategory } from '../_shared/plaid.ts'
import { getAuthenticatedUser, getSupabaseAdmin } from '../_shared/supabase.ts'

type PlaidItemRow = {
  id: string
  user_id: string
  plaid_item_id: string
  access_token: string
  cursor: string | null
}

type ExpenseUpsertRow = {
  user_id: string
  category_name: string
  amount: number
  note: string | null
  spent_on: string
  source: string
  source_transaction_id: string
  merchant_name: string | null
  pending: boolean
  pending_transaction_id: string | null
  plaid_item_id: string
  sync_updated_at: string
  removed_at: string | null
}

type ExistingExpenseRow = {
  id: string
  source_transaction_id: string | null
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const user = await getAuthenticatedUser(request)
    const admin = getSupabaseAdmin()
    const plaid = getPlaidClient()

    const { data: items, error: itemsError } = await admin
      .from('finance_plaid_items')
      .select('id, user_id, plaid_item_id, access_token, cursor')
      .eq('user_id', user.id)
      .is('revoked_at', null)

    if (itemsError) {
      throw itemsError
    }

    if (!items || items.length === 0) {
      throw new Error('No connected Plaid item found for this user. Connect a bank account first.')
    }

    let importedCount = 0
    let modifiedCount = 0
    let removedCount = 0

    for (const item of (items ?? []) as PlaidItemRow[]) {
      let cursor = item.cursor ?? undefined
      let hasMore = true

      while (hasMore) {
        const sync = await plaid.transactionsSync({
          access_token: item.access_token,
          cursor,
          count: 100,
        })

        const syncTimestamp = new Date().toISOString()
        const upserts: ExpenseUpsertRow[] = [...sync.data.added, ...sync.data.modified].map((transaction) => ({
          user_id: user.id,
          category_name: mapPlaidCategory(transaction),
          amount: Math.abs(Number(transaction.amount)),
          note: transaction.name ?? null,
          spent_on: transaction.date,
          source: 'plaid',
          source_transaction_id: transaction.transaction_id,
          merchant_name: transaction.merchant_name ?? transaction.name ?? null,
          pending: transaction.pending,
          pending_transaction_id: transaction.pending_transaction_id ?? null,
          plaid_item_id: item.plaid_item_id,
          sync_updated_at: syncTimestamp,
          removed_at: null,
        }))

        if (upserts.length > 0) {
          const transactionIds = upserts.map((entry) => entry.source_transaction_id)
          const pendingIds = upserts
            .map((entry) => entry.pending_transaction_id)
            .filter((value): value is string => Boolean(value))

          const idsToMatch = Array.from(new Set([...transactionIds, ...pendingIds]))
          const existingByTransactionId = new Map<string, ExistingExpenseRow>()

          if (idsToMatch.length > 0) {
            const { data: existingRows, error: existingError } = await admin
              .from('finance_expenses')
              .select('id, source_transaction_id')
              .eq('user_id', user.id)
              .in('source_transaction_id', idsToMatch)

            if (existingError) {
              throw existingError
            }

            for (const row of (existingRows ?? []) as ExistingExpenseRow[]) {
              if (row.source_transaction_id) {
                existingByTransactionId.set(row.source_transaction_id, row)
              }
            }
          }

          const inserts: ExpenseUpsertRow[] = []

          for (const row of upserts) {
            const existing =
              existingByTransactionId.get(row.source_transaction_id) ??
              (row.pending_transaction_id
                ? existingByTransactionId.get(row.pending_transaction_id)
                : undefined)

            if (existing) {
              const { error: updateError } = await admin
                .from('finance_expenses')
                .update({
                  category_name: row.category_name,
                  amount: row.amount,
                  note: row.note,
                  spent_on: row.spent_on,
                  source: row.source,
                  source_transaction_id: row.source_transaction_id,
                  merchant_name: row.merchant_name,
                  pending: row.pending,
                  pending_transaction_id: row.pending_transaction_id,
                  plaid_item_id: row.plaid_item_id,
                  sync_updated_at: row.sync_updated_at,
                  removed_at: null,
                })
                .eq('id', existing.id)

              if (updateError) {
                throw updateError
              }
            } else {
              inserts.push(row)
            }
          }

          if (inserts.length > 0) {
            const { error: insertError } = await admin
              .from('finance_expenses')
              .insert(inserts)

            if (insertError) {
              throw insertError
            }
          }

          importedCount += sync.data.added.length
          modifiedCount += sync.data.modified.length
        }

        if (sync.data.removed.length > 0) {
          const removedIds = sync.data.removed.map((entry) => entry.transaction_id)
          const { error } = await admin
            .from('finance_expenses')
            .update({
              removed_at: new Date().toISOString(),
              sync_updated_at: new Date().toISOString(),
            })
            .eq('user_id', user.id)
            .in('source_transaction_id', removedIds)

          if (error) {
            throw error
          }

          removedCount += removedIds.length
        }

        cursor = sync.data.next_cursor
        hasMore = sync.data.has_more
      }

      const { error: updateItemError } = await admin
        .from('finance_plaid_items')
        .update({
          cursor: cursor ?? null,
          last_sync_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.id)

      if (updateItemError) {
        throw updateItemError
      }
    }

    return Response.json(
      { importedCount, modifiedCount, removedCount },
      { headers: corsHeaders }
    )
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unable to sync Plaid transactions' },
      { status: 400, headers: corsHeaders }
    )
  }
})
