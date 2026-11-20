-- 1. Remplacer les quatre adresses ci-dessous par les adresses réelles.
-- 2. Exécuter ce fichier dans Supabase > SQL Editor.
-- 3. Ne PAS utiliser la clé service_role dans le navigateur.

create table if not exists public.family_members (
  email text primary key,
  display_name text not null,
  role text not null check (role in ('owner','participant')),
  avatar_url text,
  created_at timestamptz not null default now(),
  constraint family_lowercase_email check (email = lower(email))
);

create table if not exists public.gifts (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 1 and 140),
  description text not null default '',
  product_url text,
  image_url text,
  price_eur numeric(10,2) check (price_eur is null or price_eur >= 0),
  priority text not null default 'envie' check (priority in ('coup_de_coeur','envie','idee')),
  created_at timestamptz not null default now()
);

create table if not exists public.gift_claims (
  gift_id uuid primary key references public.gifts(id) on delete cascade,
  buyer_email text not null references public.family_members(email),
  status text not null default 'reserved' check (status in ('reserved','purchased')),
  reserved_at timestamptz not null default now(),
  purchased_at timestamptz,
  constraint coherent_purchase_time check ((status = 'reserved' and purchased_at is null) or (status = 'purchased' and purchased_at is not null))
);

create index if not exists idx_gifts_created on public.gifts(created_at desc);

-- Fonction de rôle: vérifie le compte Supabase authentifié contre la liste blanche.
create or replace function public.my_christmas_role()
returns text language sql stable security definer set search_path = ''
as $$
  select m.role from public.family_members m
  where m.email = lower(coalesce(auth.jwt() ->> 'email', ''))
    and auth.uid() is not null
  limit 1;
$$;

revoke all on function public.my_christmas_role() from public, anon;
grant execute on function public.my_christmas_role() to authenticated;

alter table public.family_members enable row level security;
alter table public.gifts enable row level security;
alter table public.gift_claims enable row level security;

-- Supprimer puis recréer les politiques : script réexécutable.
drop policy if exists family_select on public.family_members;
create policy family_select on public.family_members for select to authenticated
using (public.my_christmas_role() = 'participant' or email = lower(auth.jwt() ->> 'email'));

drop policy if exists gifts_select on public.gifts;
create policy gifts_select on public.gifts for select to authenticated
using (public.my_christmas_role() in ('owner','participant'));
drop policy if exists gifts_insert on public.gifts;
create policy gifts_insert on public.gifts for insert to authenticated
with check (public.my_christmas_role() = 'owner');
drop policy if exists gifts_update on public.gifts;
create policy gifts_update on public.gifts for update to authenticated
using (public.my_christmas_role() = 'owner') with check (public.my_christmas_role() = 'owner');
drop policy if exists gifts_delete on public.gifts;
create policy gifts_delete on public.gifts for delete to authenticated
using (public.my_christmas_role() = 'owner');

-- Important : le propriétaire n'a AUCUN SELECT sur les réservations.
drop policy if exists claims_select on public.gift_claims;
create policy claims_select on public.gift_claims for select to authenticated
using (public.my_christmas_role() = 'participant');
drop policy if exists claims_insert on public.gift_claims;
create policy claims_insert on public.gift_claims for insert to authenticated
with check (public.my_christmas_role() = 'participant'
  and buyer_email = lower(auth.jwt() ->> 'email')
  and status = 'reserved' and purchased_at is null);
drop policy if exists claims_update on public.gift_claims;
create policy claims_update on public.gift_claims for update to authenticated
using (public.my_christmas_role() = 'participant' and buyer_email = lower(auth.jwt() ->> 'email'))
with check (public.my_christmas_role() = 'participant' and buyer_email = lower(auth.jwt() ->> 'email')
  and ((status = 'reserved' and purchased_at is null) or (status = 'purchased' and purchased_at is not null)));
drop policy if exists claims_delete on public.gift_claims;
create policy claims_delete on public.gift_claims for delete to authenticated
using (public.my_christmas_role() = 'participant' and buyer_email = lower(auth.jwt() ->> 'email'));

revoke all on public.family_members, public.gifts, public.gift_claims from anon;
revoke all on public.family_members, public.gifts, public.gift_claims from authenticated;
grant select on public.family_members to authenticated;
grant select, insert, update, delete on public.gifts to authenticated;
grant select, insert, update, delete on public.gift_claims to authenticated;

-- PERSONNALISER CES EMAILS. Ne pas garder les exemples !
insert into public.family_members (email, display_name, role, avatar_url) values
  ('theo@example.com', 'Théo', 'owner', '/avatars/theo.png'),
  ('laurine@example.com', 'Laurine', 'participant', '/avatars/laurine.png'),
  ('maman@example.com', 'Maman', 'participant', '/avatars/maman.png'),
  ('dino@example.com', 'Dino', 'participant', '/avatars/dino.png')
on conflict (email) do update set
  display_name = excluded.display_name, role = excluded.role, avatar_url = excluded.avatar_url;

-- Exemples : ajouter facultativement des cadeaux depuis l'interface propriétaire.
