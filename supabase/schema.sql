-- Enable UUID extension
create extension if not exists "pgcrypto";

-- ─── PROFILES ───────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  name text not null,
  avatar_url text,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are viewable by everyone" on public.profiles
  for select using (true);

create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── TOURNAMENTS ─────────────────────────────────────────────────────────────
create table public.tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'registration' check (status in ('registration', 'active', 'finished')),
  created_at timestamptz default now(),
  started_at timestamptz,
  finished_at timestamptz
);

alter table public.tournaments enable row level security;

create policy "Tournaments viewable by all authenticated users" on public.tournaments
  for select using (auth.role() = 'authenticated');

-- ─── PARTICIPANTS ─────────────────────────────────────────────────────────────
create table public.participants (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references public.tournaments on delete cascade not null,
  user_id uuid references public.profiles on delete cascade not null,
  joined_at timestamptz default now(),
  unique(tournament_id, user_id)
);

alter table public.participants enable row level security;

create policy "Participants viewable by all authenticated users" on public.participants
  for select using (auth.role() = 'authenticated');

create policy "Users can join open tournaments" on public.participants
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.tournaments t
      where t.id = tournament_id and t.status = 'registration'
    )
  );

-- ─── MATCHDAYS ────────────────────────────────────────────────────────────────
create table public.matchdays (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references public.tournaments on delete cascade not null,
  number integer not null,
  week_start date,
  week_end date,
  created_at timestamptz default now(),
  unique(tournament_id, number)
);

alter table public.matchdays enable row level security;

create policy "Matchdays viewable by all authenticated users" on public.matchdays
  for select using (auth.role() = 'authenticated');

-- ─── GAMES ────────────────────────────────────────────────────────────────────
create table public.games (
  id uuid primary key default gen_random_uuid(),
  matchday_id uuid references public.matchdays on delete cascade not null,
  tournament_id uuid references public.tournaments on delete cascade not null,
  home_player_id uuid references public.profiles on delete cascade not null,
  away_player_id uuid references public.profiles on delete cascade not null,
  status text not null default 'pending'
    check (status in ('pending', 'result_entered', 'confirmed', 'postponed', 'forfeited')),
  home_sets integer check (home_sets between 0 and 2),
  away_sets integer check (away_sets between 0 and 2),
  submitted_by uuid references public.profiles,
  confirmed_by uuid references public.profiles,
  submitted_at timestamptz,
  confirmed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.games enable row level security;

create policy "Games viewable by all authenticated users" on public.games
  for select using (auth.role() = 'authenticated');

create policy "Participants can submit results" on public.games
  for update using (
    auth.uid() = home_player_id or auth.uid() = away_player_id
  );

-- Auto-update updated_at
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger games_updated_at
  before update on public.games
  for each row execute procedure public.handle_updated_at();

-- ─── SCOREBOARD VIEW ──────────────────────────────────────────────────────────
create or replace view public.scoreboard as
select
  p.user_id,
  p.tournament_id,
  pr.name,
  pr.email,
  pr.avatar_url,
  coalesce(sum(
    case
      when g.home_player_id = p.user_id and g.status = 'confirmed' then
        g.home_sets + (case when g.home_sets > g.away_sets then 1 else 0 end)
      when g.away_player_id = p.user_id and g.status = 'confirmed' then
        g.away_sets + (case when g.away_sets > g.home_sets then 1 else 0 end)
      when (g.home_player_id = p.user_id or g.away_player_id = p.user_id) and g.status = 'forfeited' then 0
      else 0
    end
  ), 0) as points,
  coalesce(sum(
    case
      when g.home_player_id = p.user_id and g.status in ('confirmed', 'forfeited') then coalesce(g.home_sets, 0)
      when g.away_player_id = p.user_id and g.status in ('confirmed', 'forfeited') then coalesce(g.away_sets, 0)
      else 0
    end
  ), 0) as sets_won,
  coalesce(sum(
    case
      when g.home_player_id = p.user_id and g.status in ('confirmed', 'forfeited') then coalesce(g.away_sets, 0)
      when g.away_player_id = p.user_id and g.status in ('confirmed', 'forfeited') then coalesce(g.home_sets, 0)
      else 0
    end
  ), 0) as sets_lost,
  coalesce(sum(
    case
      when g.home_player_id = p.user_id and g.status = 'confirmed' and g.home_sets > g.away_sets then 1
      when g.away_player_id = p.user_id and g.status = 'confirmed' and g.away_sets > g.home_sets then 1
      else 0
    end
  ), 0) as victories,
  coalesce(sum(
    case
      when g.home_player_id = p.user_id and g.status = 'confirmed' and g.home_sets < g.away_sets then 1
      when g.away_player_id = p.user_id and g.status = 'confirmed' and g.away_sets < g.home_sets then 1
      when (g.home_player_id = p.user_id or g.away_player_id = p.user_id) and g.status = 'forfeited' then 1
      else 0
    end
  ), 0) as losses,
  coalesce(sum(
    case
      when (g.home_player_id = p.user_id or g.away_player_id = p.user_id)
        and g.status in ('confirmed', 'forfeited') then 1
      else 0
    end
  ), 0) as games_played
from public.participants p
join public.profiles pr on pr.id = p.user_id
left join public.games g on
  (g.home_player_id = p.user_id or g.away_player_id = p.user_id)
  and g.tournament_id = p.tournament_id
group by p.user_id, p.tournament_id, pr.name, pr.email, pr.avatar_url
order by points desc, sets_won desc, victories desc;
