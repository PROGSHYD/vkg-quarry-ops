'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from './supabaseClient';

export function useProfile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let active = true;
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .eq('id', user.id)
        .single();
      if (error) console.error(error);

      let pits = [];
      if (data?.role === 'pit_manager') {
        const { data: pm } = await supabase.from('pit_managers').select('pit_id').eq('user_id', user.id);
        pits = (pm || []).map(r => r.pit_id);
      }
      if (!active) return;
      setProfile(data ? { ...data, pits } : null);
      setLoading(false);
    }
    load();
    return () => { active = false; };
  }, [router]);

  return { profile, loading };
}
