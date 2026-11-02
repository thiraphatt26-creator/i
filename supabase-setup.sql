-- ============================================================
-- Injanda Trading — Supabase setup.  Run once in: SQL Editor > New query.
-- Safe to run again (idempotent).
-- ============================================================

-- 1) Tables (each row = id + JSON document)
create table if not exists users    (id text primary key, data jsonb not null, updated_at timestamptz default now() not null);
create table if not exists products (id text primary key, data jsonb not null, updated_at timestamptz default now() not null);
create table if not exists orders   (id text primary key, data jsonb not null, updated_at timestamptz default now() not null);
-- NEW: store settings, banners, vouchers and a "seeded" flag
create table if not exists settings (id text primary key, data jsonb not null, updated_at timestamptz default now() not null);

alter table users    replica identity full;
alter table products replica identity full;
alter table orders   replica identity full;
alter table settings replica identity full;

-- 1b) Permissions: let the website (anon key) and logged-in users use the tables.
--     Without this you get "permission denied for table products".
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table public.users, public.products, public.orders, public.settings to anon, authenticated;

-- 2) Realtime (so every device updates instantly)
do $$
declare t text;
begin
  foreach t in array array['users','products','orders','settings'] loop
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- 3) Access policies (open, as in your original reset-admin.sql)
alter table users    enable row level security;
alter table products enable row level security;
alter table orders   enable row level security;
alter table settings enable row level security;
drop policy if exists "open_all" on users;    create policy "open_all" on users    for all using (true) with check (true);
drop policy if exists "open_all" on products; create policy "open_all" on products for all using (true) with check (true);
drop policy if exists "open_all" on orders;   create policy "open_all" on orders   for all using (true) with check (true);
drop policy if exists "open_all" on settings; create policy "open_all" on settings for all using (true) with check (true);

-- 4) Storage bucket for product photos uploaded from the admin panel
insert into storage.buckets (id, name, public) values ('product-images', 'product-images', true)
  on conflict (id) do update set public = true;
drop policy if exists "pi_read"   on storage.objects; create policy "pi_read"   on storage.objects for select using (bucket_id = 'product-images');
drop policy if exists "pi_write"  on storage.objects; create policy "pi_write"  on storage.objects for insert with check (bucket_id = 'product-images');
drop policy if exists "pi_update" on storage.objects; create policy "pi_update" on storage.objects for update using (bucket_id = 'product-images');
drop policy if exists "pi_delete" on storage.objects; create policy "pi_delete" on storage.objects for delete using (bucket_id = 'product-images');

-- Optional: wipe everything and start from scratch
-- delete from products; delete from orders; delete from settings;
