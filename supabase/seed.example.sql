-- Run after the migration. Replace every placeholder before executing.
-- Add collaborators to the allowlist, then send a Supabase invitation or magic link.

insert into public.organizations (id, name)
values ('00000000-0000-0000-0000-000000000001', 'KNU Design Web 2026');

insert into public.projects (id, organization_id, name, slug, allowed_origins)
values (
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000001',
  'KNUD Exhibition',
  'knud-exhibition',
  array['https://qa-agent-hub-rust.vercel.app']
);

-- Register the production site before the first QA comment is saved.
-- `provider_deployment_id` must be the Vercel deployment ID, not the project ID.
-- Obtain the Git SHA from the deployment's Source tab in Vercel.
insert into public.deployments (
  project_id,
  provider,
  provider_deployment_id,
  immutable_url,
  production_alias,
  git_sha,
  git_ref,
  deployed_at
) values (
  '00000000-0000-0000-0000-000000000010',
  'vercel',
  'replace-with-vercel-deployment-id',
  'https://knud-2026-exhibition.vercel.app',
  'https://knud-2026-exhibition.vercel.app',
  'replace-with-git-sha',
  'main',
  now()
);

-- Replace these with the four collaborators' lower-case, real email addresses.
insert into public.access_allowlist (email, organization_id, role, display_name, note) values
  ('designer-1@example.com', '00000000-0000-0000-0000-000000000001', 'designer', '디자이너 이름', 'replace before running'),
  ('designer-2@example.com', '00000000-0000-0000-0000-000000000001', 'designer', '디자이너 이름', 'replace before running'),
  ('developer-1@example.com', '00000000-0000-0000-0000-000000000001', 'developer', '개발자 이름', 'replace before running'),
  ('admin@example.com', '00000000-0000-0000-0000-000000000001', 'admin', '관리자 이름', 'replace before running');
