export const runtime = 'edge';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

export async function POST(request) {
  const { email, password, full_name, role } = await request.json();

  if (!email || !password || !full_name || !role) {
    return Response.json({ error: 'Missing fields' }, { status: 400 });
  }
  if (!['management', 'admin', 'pit_manager'].includes(role)) {
    return Response.json({ error: 'Invalid role' }, { status: 400 });
  }

  // 1. Verify the caller is logged in AND is Management, using their own access token.
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) return Response.json({ error: 'Not signed in' }, { status: 401 });

  const callerClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const { data: { user: caller }, error: authError } = await callerClient.auth.getUser(token);
  if (authError || !caller) return Response.json({ error: 'Invalid session' }, { status: 401 });

  const admin = supabaseAdmin();
  const { data: callerProfile, error: profileFetchError } = await admin.from('profiles').select('role').eq('id', caller.id).single();
  if (profileFetchError) {
    return Response.json({ error: 'Could not verify your role — server error: ' + profileFetchError.message + '. This usually means SUPABASE_SERVICE_ROLE_KEY is missing or wrong in .env.local.' }, { status: 500 });
  }
  if (callerProfile?.role !== 'management') {
    return Response.json({ error: 'Only Management can add new logins (your role: ' + (callerProfile?.role || 'unknown') + ')' }, { status: 403 });
  }

  // 2. Create the Auth user (admin-only capability).
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (createError) return Response.json({ error: createError.message }, { status: 400 });

  // 3. Create their profile row.
  const { error: profileError } = await admin.from('profiles').insert({
    id: created.user.id, full_name, role,
  });
  if (profileError) return Response.json({ error: profileError.message }, { status: 400 });

  return Response.json({ ok: true, id: created.user.id });
}
