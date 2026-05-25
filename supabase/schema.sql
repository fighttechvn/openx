create extension if not exists pgcrypto;

create table if not exists public.openx_cloud_workspaces (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text,
  sync_key_hash text not null,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint openx_cloud_workspaces_slug_format
    check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$'),
  constraint openx_cloud_workspaces_config_object
    check (jsonb_typeof(config) = 'object')
);

alter table public.openx_cloud_workspaces enable row level security;

revoke all on table public.openx_cloud_workspaces from anon, authenticated;

create or replace function public.openx_hash_sync_key(sync_key text)
returns text
language sql
stable
set search_path = public, pg_temp
as $$
  select encode(digest(coalesce(sync_key, ''), 'sha256'), 'hex');
$$;

revoke all on function public.openx_hash_sync_key(text) from public;

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

  if target_workspace.sync_key_hash <> public.openx_hash_sync_key(p_sync_key) then
    raise exception 'Invalid workspace sync key';
  end if;

  return jsonb_build_object(
    'exists', true,
    'workspace', jsonb_build_object(
      'id', target_workspace.id,
      'slug', target_workspace.slug,
      'name', target_workspace.name,
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
    if existing_workspace.sync_key_hash <> public.openx_hash_sync_key(p_sync_key) then
      raise exception 'Invalid workspace sync key';
    end if;

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
      'updatedAt', saved_workspace.updated_at
    ),
    'config', saved_workspace.config
  );
end;
$$;

revoke all on function public.openx_pull_config(text, text) from public;
revoke all on function public.openx_push_config(text, text, jsonb, text) from public;

grant execute on function public.openx_pull_config(text, text) to anon, authenticated;
grant execute on function public.openx_push_config(text, text, jsonb, text) to anon, authenticated;
