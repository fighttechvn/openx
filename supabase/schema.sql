create extension if not exists pgcrypto;

create table if not exists public.openx_cloud_workspaces (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text,
  sync_key_hash text not null,
  is_public boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint openx_cloud_workspaces_slug_format
    check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$'),
  constraint openx_cloud_workspaces_config_object
    check (jsonb_typeof(config) = 'object')
);

alter table public.openx_cloud_workspaces
  add column if not exists is_public boolean not null default false;

create table if not exists public.openx_cloud_api_keys (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.openx_cloud_workspaces(id) on delete cascade,
  name text not null,
  key_prefix text not null,
  key_hash text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz,
  constraint openx_cloud_api_keys_name_length
    check (length(trim(name)) between 1 and 80)
);

create index if not exists openx_cloud_api_keys_workspace_id_idx
  on public.openx_cloud_api_keys (workspace_id);

alter table public.openx_cloud_workspaces enable row level security;
alter table public.openx_cloud_api_keys enable row level security;

revoke all on table public.openx_cloud_workspaces from anon, authenticated;
revoke all on table public.openx_cloud_api_keys from anon, authenticated;

create or replace function public.openx_hash_sync_key(sync_key text)
returns text
language sql
stable
set search_path = public, pg_temp
as $$
  select encode(digest(coalesce(sync_key, ''), 'sha256'), 'hex');
$$;

revoke all on function public.openx_hash_sync_key(text) from public;

create or replace function public.openx_is_valid_workspace_key(
  p_workspace_id uuid,
  p_key text
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.openx_cloud_workspaces workspace
    where workspace.id = p_workspace_id
      and workspace.sync_key_hash = public.openx_hash_sync_key(p_key)
  )
  or exists (
    select 1
    from public.openx_cloud_api_keys api_key
    where api_key.workspace_id = p_workspace_id
      and api_key.revoked_at is null
      and api_key.key_hash = public.openx_hash_sync_key(p_key)
  );
$$;

create or replace function public.openx_is_admin_workspace_key(
  p_workspace_id uuid,
  p_admin_key text
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.openx_cloud_workspaces workspace
    where workspace.id = p_workspace_id
      and workspace.sync_key_hash = public.openx_hash_sync_key(p_admin_key)
  );
$$;

create or replace function public.openx_touch_api_key(
  p_workspace_id uuid,
  p_key text
)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.openx_cloud_api_keys
    set last_used_at = now()
  where workspace_id = p_workspace_id
    and revoked_at is null
    and key_hash = public.openx_hash_sync_key(p_key);
$$;

revoke all on function public.openx_is_valid_workspace_key(uuid, text) from public;
revoke all on function public.openx_is_admin_workspace_key(uuid, text) from public;
revoke all on function public.openx_touch_api_key(uuid, text) from public;

create or replace function public.openx_pull_config(
  p_workspace_slug text,
  p_sync_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_workspace public.openx_cloud_workspaces;
begin
  select *
    into target_workspace
  from public.openx_cloud_workspaces
  where slug = lower(trim(p_workspace_slug));

  if target_workspace.id is null then
    return jsonb_build_object('exists', false, 'config', '{}'::jsonb);
  end if;

  if not public.openx_is_valid_workspace_key(target_workspace.id, p_sync_key) then
    raise exception 'Invalid workspace sync key';
  end if;

  perform public.openx_touch_api_key(target_workspace.id, p_sync_key);

  return jsonb_build_object(
    'exists', true,
    'workspace', jsonb_build_object(
      'id', target_workspace.id,
      'slug', target_workspace.slug,
      'name', target_workspace.name,
      'isPublic', target_workspace.is_public,
      'updatedAt', target_workspace.updated_at
    ),
    'config', target_workspace.config
  );
end;
$$;

create or replace function public.openx_push_config(
  p_workspace_slug text,
  p_sync_key text,
  p_config jsonb,
  p_workspace_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  normalized_slug text := lower(trim(p_workspace_slug));
  existing_workspace public.openx_cloud_workspaces;
  saved_workspace public.openx_cloud_workspaces;
begin
  if normalized_slug !~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$' then
    raise exception 'Invalid workspace slug';
  end if;

  if length(coalesce(p_sync_key, '')) < 12 then
    raise exception 'Sync key must be at least 12 characters';
  end if;

  if p_config is null or jsonb_typeof(p_config) <> 'object' then
    raise exception 'Config must be a JSON object';
  end if;

  if octet_length(p_config::text) > 1048576 then
    raise exception 'Config is too large';
  end if;

  select *
    into existing_workspace
  from public.openx_cloud_workspaces
  where slug = normalized_slug;

  if existing_workspace.id is null then
    insert into public.openx_cloud_workspaces (slug, name, sync_key_hash, config)
    values (
      normalized_slug,
      nullif(trim(coalesce(p_workspace_name, '')), ''),
      public.openx_hash_sync_key(p_sync_key),
      p_config
    )
    returning * into saved_workspace;
  else
    if not public.openx_is_valid_workspace_key(existing_workspace.id, p_sync_key) then
      raise exception 'Invalid workspace sync key';
    end if;

    perform public.openx_touch_api_key(existing_workspace.id, p_sync_key);

    update public.openx_cloud_workspaces
      set name = coalesce(nullif(trim(coalesce(p_workspace_name, '')), ''), name),
          config = p_config,
          updated_at = now()
    where id = existing_workspace.id
    returning * into saved_workspace;
  end if;

  return jsonb_build_object(
    'workspace', jsonb_build_object(
      'id', saved_workspace.id,
      'slug', saved_workspace.slug,
      'name', saved_workspace.name,
      'isPublic', saved_workspace.is_public,
      'updatedAt', saved_workspace.updated_at
    ),
    'config', saved_workspace.config
  );
end;
$$;

create or replace function public.openx_create_api_key(
  p_workspace_slug text,
  p_admin_key text,
  p_key_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_workspace public.openx_cloud_workspaces;
  generated_key text := 'ox_live_' || encode(gen_random_bytes(24), 'hex');
  saved_key public.openx_cloud_api_keys;
begin
  select *
    into target_workspace
  from public.openx_cloud_workspaces
  where slug = lower(trim(p_workspace_slug));

  if target_workspace.id is null then
    raise exception 'Workspace not found';
  end if;

  if not public.openx_is_admin_workspace_key(target_workspace.id, p_admin_key) then
    raise exception 'Invalid admin key';
  end if;

  insert into public.openx_cloud_api_keys (workspace_id, name, key_prefix, key_hash)
  values (
    target_workspace.id,
    coalesce(nullif(trim(p_key_name), ''), 'OpenX API Key'),
    left(generated_key, 16),
    public.openx_hash_sync_key(generated_key)
  )
  returning * into saved_key;

  return jsonb_build_object(
    'apiKey', generated_key,
    'key', jsonb_build_object(
      'id', saved_key.id,
      'name', saved_key.name,
      'prefix', saved_key.key_prefix,
      'createdAt', saved_key.created_at,
      'lastUsedAt', saved_key.last_used_at,
      'revokedAt', saved_key.revoked_at
    )
  );
end;
$$;

create or replace function public.openx_list_api_keys(
  p_workspace_slug text,
  p_admin_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_workspace public.openx_cloud_workspaces;
begin
  select *
    into target_workspace
  from public.openx_cloud_workspaces
  where slug = lower(trim(p_workspace_slug));

  if target_workspace.id is null then
    raise exception 'Workspace not found';
  end if;

  if not public.openx_is_admin_workspace_key(target_workspace.id, p_admin_key) then
    raise exception 'Invalid admin key';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', api_key.id,
      'name', api_key.name,
      'prefix', api_key.key_prefix,
      'createdAt', api_key.created_at,
      'lastUsedAt', api_key.last_used_at,
      'revokedAt', api_key.revoked_at
    ) order by api_key.created_at desc)
    from public.openx_cloud_api_keys api_key
    where api_key.workspace_id = target_workspace.id
  ), '[]'::jsonb);
end;
$$;

create or replace function public.openx_revoke_api_key(
  p_workspace_slug text,
  p_admin_key text,
  p_key_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_workspace public.openx_cloud_workspaces;
begin
  select *
    into target_workspace
  from public.openx_cloud_workspaces
  where slug = lower(trim(p_workspace_slug));

  if target_workspace.id is null then
    raise exception 'Workspace not found';
  end if;

  if not public.openx_is_admin_workspace_key(target_workspace.id, p_admin_key) then
    raise exception 'Invalid admin key';
  end if;

  update public.openx_cloud_api_keys
    set revoked_at = coalesce(revoked_at, now())
  where id = p_key_id
    and workspace_id = target_workspace.id;

  return public.openx_list_api_keys(p_workspace_slug, p_admin_key);
end;
$$;

create or replace function public.openx_list_public_workspaces()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'slug', workspace.slug,
    'name', workspace.name,
    'updatedAt', workspace.updated_at
  ) order by workspace.slug), '[]'::jsonb)
  from public.openx_cloud_workspaces workspace
  where workspace.is_public;
$$;

revoke all on function public.openx_pull_config(text, text) from public;
revoke all on function public.openx_push_config(text, text, jsonb, text) from public;
revoke all on function public.openx_create_api_key(text, text, text) from public;
revoke all on function public.openx_list_api_keys(text, text) from public;
revoke all on function public.openx_revoke_api_key(text, text, uuid) from public;
revoke all on function public.openx_list_public_workspaces() from public;

grant execute on function public.openx_pull_config(text, text) to anon, authenticated;
grant execute on function public.openx_push_config(text, text, jsonb, text) to anon, authenticated;
grant execute on function public.openx_create_api_key(text, text, text) to anon, authenticated;
grant execute on function public.openx_list_api_keys(text, text) to anon, authenticated;
grant execute on function public.openx_revoke_api_key(text, text, uuid) to anon, authenticated;
grant execute on function public.openx_list_public_workspaces() to anon, authenticated;
