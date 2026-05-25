-- Seed shared public workspaces for quick iPad/desktop cloud sync.
-- Run supabase/schema.sql first.
--
-- Public workspace API keys:
-- public1     -> openx-public-public1
-- public2     -> openx-public-public2
-- public3     -> openx-public-public3
-- fighttechvn -> openx-public-fighttechvn
-- trunghieu   -> openx-public-trunghieu
--
-- These keys are intentionally public. Anyone with the project publishable key
-- and the workspace API key can pull or push that workspace config.

with public_workspaces(slug, name, api_key) as (
  values
    ('public1', 'Public 1', 'openx-public-public1'),
    ('public2', 'Public 2', 'openx-public-public2'),
    ('public3', 'Public 3', 'openx-public-public3'),
    ('fighttechvn', 'FighttechVN', 'openx-public-fighttechvn'),
    ('trunghieu', 'Trung Hieu', 'openx-public-trunghieu')
),
default_config as (
  select jsonb_build_object(
    'version', 1,
    'machines', '[]'::jsonb,
    'fileTypes', jsonb_build_array(
      jsonb_build_object('extension', '.html', 'enabled', true),
      jsonb_build_object('extension', '.md', 'enabled', true)
    ),
    'updatedAt', now()
  ) as config
)
insert into public.openx_cloud_workspaces (
  slug,
  name,
  sync_key_hash,
  is_public,
  config
)
select
  workspace.slug,
  workspace.name,
  public.openx_hash_sync_key(workspace.api_key),
  true,
  default_config.config
from public_workspaces workspace
cross join default_config
on conflict (slug) do update
  set name = excluded.name,
      sync_key_hash = excluded.sync_key_hash,
      is_public = true,
      updated_at = now();
