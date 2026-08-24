-- ============================================================
-- MIGRATION: flexible manager <-> pit assignment
-- Run this in your EXISTING Supabase project (the one you already set up).
-- Safe to run once — does not touch your logins or existing profiles data.
-- ============================================================

-- 1. New table: a manager can cover several pits, a pit can have more than
--    one manager. Management reassigns this anytime via Setup; whatever it
--    currently says governs access + targets until changed again.
create table if not exists pit_managers (
  id uuid primary key default gen_random_uuid(),
  pit_id text not null references pits(id),
  user_id uuid not null references auth.users(id) on delete cascade,
  assigned_at timestamptz default now(),
  unique (pit_id, user_id)
);
alter table pit_managers enable row level security;

-- 2. Carry over your current assignments (Ashok->E, Ranganath->B) into the new table
insert into pit_managers (pit_id, user_id)
select pit_id, id from profiles where role = 'pit_manager' and pit_id is not null
on conflict do nothing;

-- 3. Replace the single-pit helper with a multi-pit one
create or replace function my_pits() returns text[] as $$
  select coalesce(array_agg(pit_id), '{}') from pit_managers where user_id = auth.uid();
$$ language sql stable security definer;

-- 4. Read access for the new table
drop policy if exists "read pit_managers" on pit_managers;
create policy "read pit_managers" on pit_managers for select using (auth.role() = 'authenticated');

-- 5. Only Management can (re)assign managers to pits
drop policy if exists "management writes pit_managers" on pit_managers;
create policy "management writes pit_managers" on pit_managers for all
  using (my_role() = 'management') with check (my_role() = 'management');

-- 6. Update the two policies that used the old single-pit check
drop policy if exists "slice updates by role" on slices;
create policy "slice updates by role" on slices for update
  using (
    my_role() in ('management','admin')
    or exists (select 1 from masses m where m.id = slices.mass_id and m.pit_id = any(my_pits()))
  );

drop policy if exists "insert daily activity" on daily_activities;
create policy "insert daily activity" on daily_activities for insert
  with check (
    my_role() in ('management','admin')
    or pit_id = any(my_pits())
  );

-- 7. Verify — should show Ashok on E and Ranganath on B
select pm.pit_id, p.full_name, u.email
from pit_managers pm
join profiles p on p.id = pm.user_id
join auth.users u on u.id = pm.user_id
order by pm.pit_id;
