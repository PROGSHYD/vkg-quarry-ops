'use client';
export const runtime = 'edge';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { setError(error.message); return; }
    router.push('/setup');
  }

  return (
    <div style={{ maxWidth: 360, margin: '80px auto', padding: 24 }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 24 }}>VKG Quarry Ops — Sign In</h1>
      <form onSubmit={handleLogin}>
        <label style={{ display: 'block', fontSize: 12, color: '#9AA0AE', marginBottom: 4 }}>Email</label>
        <input
          type="email" value={email} onChange={e => setEmail(e.target.value)} required
          placeholder="b.manager@vkg.in"
          style={{ width: '100%', padding: 12, marginBottom: 16, borderRadius: 10, border: '1px solid #2A2E3A', background: '#1D2029', color: '#EDEEF2' }}
        />
        <label style={{ display: 'block', fontSize: 12, color: '#9AA0AE', marginBottom: 4 }}>Password</label>
        <input
          type="password" value={password} onChange={e => setPassword(e.target.value)} required
          style={{ width: '100%', padding: 12, marginBottom: 16, borderRadius: 10, border: '1px solid #2A2E3A', background: '#1D2029', color: '#EDEEF2' }}
        />
        {error && <div style={{ color: '#F2545B', fontSize: 13, marginBottom: 12 }}>{error}</div>}
        <button type="submit" disabled={loading}
          style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', background: '#4C8DFF', color: '#fff', fontWeight: 700 }}>
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
      </form>
      <p style={{ fontSize: 12, color: '#5C6270', marginTop: 16 }}>
        Forgot your password? Contact Management or Admin — Pit Managers can't reset their own.
      </p>
    </div>
  );
}
