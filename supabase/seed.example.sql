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

-- Replace these with the four collaborators' lower-case, real email addresses.
insert into public.access_allowlist (email, organization_id, role, note) values
  ('designer-1@example.com', '00000000-0000-0000-0000-000000000001', 'designer', 'replace before running'),
  ('designer-2@example.com', '00000000-0000-0000-0000-000000000001', 'designer', 'replace before running'),
  ('developer-1@example.com', '00000000-0000-0000-0000-000000000001', 'developer', 'replace before running'),
  ('admin@example.com', '00000000-0000-0000-0000-000000000001', 'admin', 'replace before running');
