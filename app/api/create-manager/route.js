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

  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) return Response.json({ error: 'Not signed in' }, { status: 401 });

  const callerClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const { data: { user: caller }, error: authError } = await callerClient.auth.getUser(token);
  if (authError || !caller) return Response.json({ error: 'Invalid session', authError: authError?.message }, { status: 401 });

  const admin = supabaseAdmin();

  const keyPresent = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  const keyLen = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').length;
  const urlUsed = process.env.NEXT_PUBLIC_SUPABASE_URL;

  const { count: totalProfiles, error: countError } = await admin
    .from('profiles')
    .select('*', { count: 'exact', head: true });

  const { data: callerProfile, error: profileFetchError } = await admin
    .from('profiles').select('role').eq('id', caller.id).single();

  if (profileFetchError) {
    return Response.json({
      error: 'DEBUG MODE - role check failed',
      debug: {
        callerId: caller.id,
        keyPresent,
        keyLen,
        urlUsed,
        totalProfilesVisibleToAdmin: totalProfiles,
        countError: countError?.message || null,
        profileFetchErrorMessage: profileFetchError.message,
        profileFetchErrorCode: profileFetchError.code,
      }
    }, { status: 500 });
  }
  if (callerProfile?.role !== 'management') {
    return Response.json({ error: 'Only Management can add new logins (your role: ' + (callerProfile?.role || 'unknown') + ')' }, { status: 403 });
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (createError) return Response.json({ error: createError.message }, { status: 400 });

  const { error: profileError } = await admin.from('profiles').insert({
    id: created.user.id, full_name, role,
  });
  if (profileError) return Response.json({ error: profileError.message }, { status: 400 });

  return Response.json({ ok: true, id: created.user.id });
}
