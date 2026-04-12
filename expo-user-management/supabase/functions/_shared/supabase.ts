import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export function getSupabaseAdmin() {
  const url = Deno.env.get('SUPABASE_URL')!
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  return createClient(url, serviceRole)
}

export async function getAuthenticatedUser(request: Request) {
  const authHeader = request.headers.get('Authorization') ?? ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()

  if (!token) {
    throw new Error('Unauthorized')
  }

  const admin = getSupabaseAdmin()

  const {
    data: { user },
    error,
  } = await admin.auth.getUser(token)

  if (error || !user) {
    throw new Error('Unauthorized')
  }

  return user
}
