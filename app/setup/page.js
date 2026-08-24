'use client';
export const runtime = 'edge';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useProfile } from '../../lib/useProfile';

const th = { textAlign: 'left', color: '#9AA0AE', fontSize: 11, textTransform: 'uppercase', padding: '9px 10px', borderBottom: '1px solid #2A2E3A' };
const td = { padding: 10, borderBottom: '1px solid #2A2E3A' };
const input = { width: '100%', background: '#1D2029', border: '1px solid #2A2E3A', color: '#EDEEF2', padding: '8px 10px', borderRadius: 8 };
const card = { background: '#161820', border: '1px solid #2A2E3A', borderRadius: 14, overflow: 'hidden', marginBottom: 14 };
const PIT_IDS = ['A', 'B', 'C', 'D', 'E', 'F'];

export default function SetupPage() {
  const { profile, loading } = useProfile();
  const [pits, setPits] = useState([]);
  const [masses, setMasses] = useState([]);
  const [managers, setManagers] = useState([]);       // profiles with role pit_manager
  const [assignments, setAssignments] = useState([]);  // pit_managers rows
  const [newMgr, setNewMgr] = useState({ full_name: '', email: '', password: '', role: 'pit_manager' });
  const [addMsg, setAddMsg] = useState('');

  const load = useCallback(async () => {
    const { data: pitData } = await supabase.from('pits').select('*').order('id');
    const { data: massData } = await supabase.from('masses').select('*').order('pit_id');
    const { data: mgrData } = await supabase.from('profiles').select('id, full_name').eq('role', 'pit_manager').order('full_name');
    const { data: assignData } = await supabase.from('pit_managers').select('pit_id, user_id');
    setPits(pitData || []);
    setMasses(massData || []);
    setManagers(mgrData || []);
    setAssignments(assignData || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading || !profile) return <div style={{ padding: 24 }}>Loading…</div>;

  const canEdit = profile.role === 'management';
  const visiblePits = profile.role === 'pit_manager' ? pits.filter(p => profile.pits.includes(p.id)) : pits;
  const managersForPit = (pitId) => assignments.filter(a => a.pit_id === pitId).map(a => managers.find(m => m.id === a.user_id)?.full_name).filter(Boolean);

  async function updateMass(id, field, value) {
    if (!canEdit) return;
    await supabase.from('masses').update({ [field]: value }).eq('id', id);
    load(); // trg_sync_slices on the server keeps `slices` rows in sync automatically
  }
  async function updatePit(id, field, value) {
    if (!canEdit) return;
    await supabase.from('pits').update({ [field]: value }).eq('id', id);
    load();
  }
  async function addMass(pitId) {
    if (!canEdit) return;
    await supabase.from('masses').insert({ pit_id: pitId, name: 'New Mass', target: 0, active: true, target_month: new Date().toISOString().slice(0, 7) });
    load();
  }
  async function toggleAssignment(pitId, userId, isAssigned) {
    if (!canEdit) return;
    if (isAssigned) {
      await supabase.from('pit_managers').delete().eq('pit_id', pitId).eq('user_id', userId);
    } else {
      await supabase.from('pit_managers').insert({ pit_id: pitId, user_id: userId });
    }
    load();
  }
  async function createManager(e) {
    e.preventDefault();
    setAddMsg('Creating…');
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/create-manager', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify(newMgr),
    });
    const result = await res.json();
    if (!res.ok) { setAddMsg('Error: ' + result.error); return; }
    setAddMsg('✓ Created ' + newMgr.email);
    setNewMgr({ full_name: '', email: '', password: '', role: 'pit_manager' });
    load();
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: 16 }}>
      <h1 style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>Setup — {profile.full_name} ({profile.role})</h1>
      {!canEdit && <p style={{ color: '#9AA0AE', fontSize: 13, marginBottom: 16 }}>
        {profile.role === 'admin' ? 'Admin can view all Setup data. Only Management can edit.' : 'You can view your targets here but not edit them.'}
      </p>}

      <h2 style={{ fontSize: 13, color: '#9AA0AE', margin: '20px 0 10px' }}>Pit Master</h2>
      <div style={card}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead><tr><th style={th}>Pit</th><th style={th}>Name</th><th style={th}>Current Manager(s)</th></tr></thead>
        <tbody>
          {visiblePits.map(p => (
            <tr key={p.id}>
              <td style={td}><b>{p.id}</b></td>
              <td style={td}>{canEdit ? <input style={input} defaultValue={p.name} onBlur={e => updatePit(p.id, 'name', e.target.value)} /> : p.name}</td>
              <td style={td}>{managersForPit(p.id).join(', ') || <span style={{ color: '#5C6270' }}>Unassigned</span>}</td>
            </tr>
          ))}
        </tbody>
      </table></div>

      {canEdit && (
        <>
          <h2 style={{ fontSize: 13, color: '#9AA0AE', margin: '20px 0 10px' }}>Manager Assignments</h2>
          <p style={{ color: '#9AA0AE', fontSize: 12, marginBottom: 10 }}>
            Managers are flexible — assign anyone to any pit(s), anytime. Whatever's checked here
            governs that manager's Daily Entry access and pit-wise targets right now, until you
            change it again. No approval flow, no monthly lock-in.
          </p>
          <div style={card}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr><th style={th}>Manager</th>{PIT_IDS.map(pid => <th key={pid} style={{ ...th, textAlign: 'center' }}>{pid}</th>)}</tr></thead>
            <tbody>
              {managers.map(m => (
                <tr key={m.id}>
                  <td style={td}><b>{m.full_name}</b></td>
                  {PIT_IDS.map(pid => {
                    const isAssigned = assignments.some(a => a.pit_id === pid && a.user_id === m.id);
                    return (
                      <td key={pid} style={{ ...td, textAlign: 'center' }}>
                        <input type="checkbox" checked={isAssigned} onChange={() => toggleAssignment(pid, m.id, isAssigned)} />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table></div>

          <h2 style={{ fontSize: 13, color: '#9AA0AE', margin: '20px 0 10px' }}>Add New Manager / Login</h2>
          <form onSubmit={createManager} style={card}>
            <div style={{ padding: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><label style={{ fontSize: 11, color: '#9AA0AE' }}>Full Name / Initials</label>
                <input style={input} required value={newMgr.full_name} onChange={e => setNewMgr({ ...newMgr, full_name: e.target.value })} /></div>
              <div><label style={{ fontSize: 11, color: '#9AA0AE' }}>Role</label>
                <select style={input} value={newMgr.role} onChange={e => setNewMgr({ ...newMgr, role: e.target.value })}>
                  <option value="pit_manager">Pit Manager</option>
                  <option value="admin">Admin</option>
                  <option value="management">Management</option>
                </select></div>
              <div><label style={{ fontSize: 11, color: '#9AA0AE' }}>Email</label>
                <input type="email" style={input} required value={newMgr.email} onChange={e => setNewMgr({ ...newMgr, email: e.target.value })} placeholder="name@vkg.in" /></div>
              <div><label style={{ fontSize: 11, color: '#9AA0AE' }}>Temporary Password</label>
                <input type="text" style={input} required minLength={6} value={newMgr.password} onChange={e => setNewMgr({ ...newMgr, password: e.target.value })} placeholder="min 6 characters" /></div>
              <div style={{ gridColumn: '1/-1' }}>
                <button type="submit" style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: '#4C8DFF', color: '#fff', fontWeight: 700 }}>Create Login</button>
                {addMsg && <span style={{ marginLeft: 12, fontSize: 12, color: '#9AA0AE' }}>{addMsg}</span>}
              </div>
            </div>
          </form>
          <p style={{ color: '#5C6270', fontSize: 11, marginBottom: 10 }}>
            New Pit Managers still need to be checked into a pit above under Manager Assignments —
            creating the login doesn't assign them anywhere by itself.
          </p>
        </>
      )}

      <h2 style={{ fontSize: 13, color: '#9AA0AE', margin: '20px 0 10px' }}>Mass Master</h2>
      {visiblePits.map(p => (
        <div key={p.id} style={card}>
          <div style={{ padding: '12px 16px', fontWeight: 700, borderBottom: '1px solid #2A2E3A' }}>Pit {p.id}</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr><th style={th}>Mass</th><th style={th}>Target Month</th><th style={th}>Target Slices</th><th style={th}>Active</th></tr></thead>
            <tbody>
              {masses.filter(m => m.pit_id === p.id).map(m => (
                <tr key={m.id}>
                  <td style={td}>{canEdit ? <input style={input} defaultValue={m.name} onBlur={e => updateMass(m.id, 'name', e.target.value)} /> : m.name}</td>
                  <td style={td}>{canEdit ? <input type="month" style={input} defaultValue={m.target_month} onBlur={e => updateMass(m.id, 'target_month', e.target.value)} /> : m.target_month}</td>
                  <td style={td}>{canEdit ? <input type="number" style={{ ...input, width: 80 }} defaultValue={m.target} onBlur={e => updateMass(m.id, 'target', Number(e.target.value))} /> : m.target}</td>
                  <td style={td}>{canEdit
                    ? <input type="checkbox" defaultChecked={m.active} onChange={e => updateMass(m.id, 'active', e.target.checked)} />
                    : (m.active ? 'Active' : 'Inactive')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {canEdit && <div style={{ padding: 12 }}>
            <button onClick={() => addMass(p.id)} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #2A2E3A', background: '#1D2029', color: '#EDEEF2' }}>+ Add Mass</button>
          </div>}
        </div>
      ))}
    </div>
  );
}
