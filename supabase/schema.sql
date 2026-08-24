-- ============================================================
-- VKG Quarry Operations Monitor — Supabase schema
-- Run this once in the Supabase SQL editor for a new project
-- (Project should be created under Progs.ceo@gmail.com)
-- ============================================================

-- 1. PITS — A–F
create table if not exists pits (
  id text primary key,               -- 'A'..'F'
  name text not null,
  created_at timestamptz default now()
);

-- 1b. PIT_MANAGERS — flexible many-to-many: a manager can cover several pits,
-- a pit can (temporarily) have more than one manager. Management reassigns this
-- freely at any time via Setup; whatever it currently says governs that pit's
-- daily-entry access and pit-wise targets until changed again — no history needed.
create table if not exists pit_managers (
  id uuid primary key default gen_random_uuid(),
  pit_id text not null references pits(id),
  user_id uuid not null references auth.users(id) on delete cascade,
  assigned_at timestamptz default now(),
  unique (pit_id, user_id)
);

-- 2. PROFILES — one row per logged-in user, links auth.users to a role
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('management','admin','pit_manager')),
  created_at timestamptz default now()
);

-- 3. MASSES — targets set by Management, one target per month
create table if not exists masses (
  id uuid primary key default gen_random_uuid(),
  pit_id text not null references pits(id),
  name text not null,
  target int not null default 0,
  active boolean not null default true,
  target_month text not null,        -- 'YYYY-MM'
  created_at timestamptz default now()
);

-- 4. SLICES — one row per planned slice (auto-created when target is set)
create table if not exists slices (
  id uuid primary key default gen_random_uuid(),
  mass_id uuid not null references masses(id) on delete cascade,
  slice_index int not null,
  drop_date date,
  removal_date date,
  unique (mass_id, slice_index)
);

-- 5. DAILY ACTIVITIES — the audit-trail log (feeds DAR/Dashboard/Reports)
create table if not exists daily_activities (
  id uuid primary key default gen_random_uuid(),
  activity_date date not null,
  pit_id text not null references pits(id),
  mass_id uuid not null references masses(id),
  manager_name text not null,
  prep text check (prep in ('WIP','Done')),
  holes int default 0,
  vertical_cutting text check (vertical_cutting in ('WIP','Done')),
  bottom_cutting text check (bottom_cutting in ('WIP','Done')),
  subcut_number int default 0,
  slice_label text,
  drop_date date,
  removal_date date,
  blocks_removed int default 0,
  dress_required int default 0,
  dress_done int default 0,
  dress_pending int default 0,
  serials text[] default '{}',
  waste_pct int default 0,
  remarks text default '',
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- ============================================================
-- Keep `slices` rows in sync with masses.target (server-side ensureSlices)
-- Adds new empty slices when target increases; removes trailing empty
-- slices (never a slice that already has a drop/removal date) when it shrinks.
-- ============================================================
create or replace function sync_slices() returns trigger as $$
begin
  insert into slices (mass_id, slice_index)
  select new.id, gs
  from generate_series(1, new.target) gs
  where not exists (select 1 from slices s where s.mass_id = new.id and s.slice_index = gs);

  delete from slices
  where mass_id = new.id
    and slice_index > new.target
    and drop_date is null and removal_date is null;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_sync_slices on masses;
create trigger trg_sync_slices
  after insert or update of target on masses
  for each row execute function sync_slices();

-- ============================================================
-- Helper: current user's role + assigned pits (a manager can cover several)
-- ============================================================
create or replace function my_role() returns text as $$
  select role from profiles where id = auth.uid();
$$ language sql stable security definer;

create or replace function my_pits() returns text[] as $$
  select coalesce(array_agg(pit_id), '{}') from pit_managers where user_id = auth.uid();
$$ language sql stable security definer;

-- ============================================================
-- Row Level Security
-- ============================================================
alter table pits enable row level security;
alter table pit_managers enable row level security;
alter table masses enable row level security;
alter table slices enable row level security;
alter table daily_activities enable row level security;
alter table profiles enable row level security;

-- Profiles: everyone can read their own row; Management can read all
create policy "read own profile" on profiles for select
  using (id = auth.uid() or my_role() = 'management');

-- Pits, assignments & Masses: readable by any logged-in user (Dashboard/DAR are open to all roles)
create policy "read pits" on pits for select using (auth.role() = 'authenticated');
create policy "read pit_managers" on pit_managers for select using (auth.role() = 'authenticated');
create policy "read masses" on masses for select using (auth.role() = 'authenticated');
create policy "read slices" on slices for select using (auth.role() = 'authenticated');
create policy "read activities" on daily_activities for select using (auth.role() = 'authenticated');

-- Setup edits: Management ONLY (not even Admin) can write Pit/Mass Master or reassign managers
create policy "management writes pits" on pits for all
  using (my_role() = 'management') with check (my_role() = 'management');
create policy "management writes pit_managers" on pit_managers for all
  using (my_role() = 'management') with check (my_role() = 'management');
create policy "management writes masses" on masses for all
  using (my_role() = 'management') with check (my_role() = 'management');
-- Slices get updated by the app logic when a Daily Activity is saved — Management/Admin/
-- any Pit Manager currently assigned to that mass's pit can update the slice row.
create policy "slice updates by role" on slices for update
  using (
    my_role() in ('management','admin')
    or exists (select 1 from masses m where m.id = slices.mass_id and m.pit_id = any(my_pits()))
  );

-- Daily Activity inserts: Management/Admin can log for any pit;
-- Pit Manager can only log for a pit they're currently assigned to.
create policy "insert daily activity" on daily_activities for insert
  with check (
    my_role() in ('management','admin')
    or pit_id = any(my_pits())
  );

-- ============================================================
-- Seed: pits only — manager assignment now lives in pit_managers,
-- set via Setup (or the migration below for an existing project).
-- ============================================================
insert into pits (id, name) values
  ('A','Pit A'), ('B','Pit B'), ('C','Pit C'), ('D','Pit D'), ('E','Pit E'), ('F','Pit F')
on conflict (id) do nothing;
