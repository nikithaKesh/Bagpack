-- Zono Index secure Supabase schema (matches the live database)
create table if not exists public.categories (
  id text primary key,
  user_id uuid not null default auth.uid(),
  name text not null,
  description text not null default '',
  created_at timestamptz not null default now(),
  unique(user_id, name)
);

create table if not exists public.resources (
  id text primary key,
  user_id uuid not null default auth.uid(),
  title text not null default '',
  url text not null,
  canonical_url text not null,
  domain text not null default '',
  note text not null default '',
  type text not null default 'resource',
  category text not null default '',
  subcategory text not null default '',
  theme text not null default '',
  tags text[] not null default '{}',
  visibility text not null default 'private',
  favorite boolean not null default false,
  pinned boolean not null default false,
  status text not null default 'active',
  cover_url text not null default '',
  open_count integer not null default 0,
  last_opened_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.collections (
  id text primary key,
  user_id uuid not null default auth.uid(),
  name text not null,
  description text not null default '',
  created_at timestamptz not null default now(),
  unique(user_id, name)
);

create table if not exists public.collection_items (
  user_id uuid not null default auth.uid(),
  collection_id text not null references public.collections(id) on delete cascade,
  resource_id text not null references public.resources(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (collection_id, resource_id)
);

create index if not exists resources_user_category_idx on public.resources(user_id, category);
create index if not exists resources_user_pinned_idx on public.resources(user_id, pinned);
create index if not exists resources_user_last_opened_idx on public.resources(user_id, last_opened_at);
create index if not exists collection_items_user_idx on public.collection_items(user_id);
create index if not exists collection_items_resource_id_idx on public.collection_items(resource_id);

alter table public.categories enable row level security;
alter table public.resources enable row level security;
alter table public.collections enable row level security;
alter table public.collection_items enable row level security;

grant select, insert, update, delete on public.categories to authenticated;
grant select, insert, update, delete on public.resources to authenticated;
grant select, insert, update, delete on public.collections to authenticated;
grant select, insert, update, delete on public.collection_items to authenticated;

revoke all on public.categories from anon;
revoke all on public.resources from anon;
revoke all on public.collections from anon;
revoke all on public.collection_items from anon;

create policy "categories_select_own" on public.categories for select to authenticated using ((select auth.uid()) = user_id);
create policy "categories_insert_own" on public.categories for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "categories_update_own" on public.categories for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "categories_delete_own" on public.categories for delete to authenticated using ((select auth.uid()) = user_id);

create policy "resources_select_own" on public.resources for select to authenticated using ((select auth.uid()) = user_id);
create policy "resources_insert_own" on public.resources for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "resources_update_own" on public.resources for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "resources_delete_own" on public.resources for delete to authenticated using ((select auth.uid()) = user_id);

create policy "collections_select_own" on public.collections for select to authenticated using ((select auth.uid()) = user_id);
create policy "collections_insert_own" on public.collections for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "collections_update_own" on public.collections for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "collections_delete_own" on public.collections for delete to authenticated using ((select auth.uid()) = user_id);

create policy "collection_items_select_own" on public.collection_items for select to authenticated using ((select auth.uid()) = user_id);
create policy "collection_items_insert_own" on public.collection_items for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "collection_items_delete_own" on public.collection_items for delete to authenticated using ((select auth.uid()) = user_id);


create table if not exists public.notes (
  id text primary key,
  user_id uuid not null default auth.uid(),
  title text not null default '',
  content text not null default '',
  color_key text not null default 'slate',
  tags text[] not null default '{}',
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.notes enable row level security;
grant select, insert, update, delete on public.notes to authenticated;
revoke all on public.notes from anon;
create policy "notes_select_own" on public.notes for select to authenticated using ((select auth.uid()) = user_id);
create policy "notes_insert_own" on public.notes for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "notes_update_own" on public.notes for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "notes_delete_own" on public.notes for delete to authenticated using ((select auth.uid()) = user_id);
create index if not exists notes_user_updated_idx on public.notes(user_id, updated_at desc);
create index if not exists resources_user_status_idx on public.resources(user_id, status);

create index if not exists resources_user_canonical_url_idx on public.resources(user_id, canonical_url);

create policy "collection_items_update_own" on public.collection_items for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
