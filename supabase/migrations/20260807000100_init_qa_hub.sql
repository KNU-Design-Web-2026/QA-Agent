-- KNUD Design QA Hub: initial collaboration record and access-control schema.
-- Apply with the Supabase CLI or paste into Supabase SQL Editor once per project.

create extension if not exists pgcrypto;

create type public.member_role as enum ('admin', 'designer', 'developer', 'viewer');
create type public.deployment_state as enum ('ready', 'superseded', 'archived');
create type public.qa_comment_type as enum ('visual', 'interaction', 'content', 'design_reference');
create type public.qa_priority as enum ('low', 'medium', 'high', 'blocker');
create type public.qa_status as enum ('open', 'in_progress', 'review_requested', 'done');
create type public.annotation_kind as enum ('pin', 'rect', 'arrow', 'path', 'text');
create type public.asset_kind as enum ('screenshot_authored', 'screenshot_replayed', 'figma_reference', 'diff');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.memberships (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.member_role not null default 'viewer',
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

-- Exact-email allowlist for the four invited collaborators. Never expose it to a browser.
create table public.access_allowlist (
  email text primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  role public.member_role not null default 'viewer',
  invited_by uuid references public.profiles(id) on delete set null,
  invited_at timestamptz not null default now(),
  activated_at timestamptz,
  revoked_at timestamptz,
  display_name text,
  note text
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  slug text not null,
  vercel_project_id text,
  allowed_origins text[] not null default '{}',
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (organization_id, slug)
);

create table public.deployments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  provider text not null default 'vercel',
  provider_deployment_id text not null,
  immutable_url text not null,
  production_alias text,
  git_sha text not null,
  git_ref text,
  state public.deployment_state not null default 'ready',
  deployed_at timestamptz,
  metadata_json jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (project_id, provider_deployment_id),
  unique (project_id, immutable_url)
);

create table public.qa_comments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  deployment_id uuid not null references public.deployments(id) on delete restrict,
  author_id uuid not null references public.profiles(id) on delete restrict,
  title text not null default '',
  body text not null,
  type public.qa_comment_type not null,
  priority public.qa_priority not null default 'medium',
  status public.qa_status not null default 'open',
  pathname text not null,
  query_string text not null default '',
  viewport_width integer not null check (viewport_width > 0),
  viewport_height integer not null check (viewport_height > 0),
  device_scale_factor numeric(5, 2) not null default 1 check (device_scale_factor > 0),
  zoom numeric(5, 2) not null default 1 check (zoom > 0),
  scroll_x integer not null default 0,
  scroll_y integer not null default 0,
  element_qa_id text,
  element_key text,
  selector_hint_json jsonb not null default '{}',
  element_rect_json jsonb,
  normalized_anchor_json jsonb not null,
  figma_node_url text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table public.annotations (
  id uuid primary key default gen_random_uuid(),
  qa_comment_id uuid not null references public.qa_comments(id) on delete cascade,
  kind public.annotation_kind not null,
  geometry_json jsonb not null,
  style_json jsonb not null default '{}',
  z_index integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.qa_assignments (
  qa_comment_id uuid primary key references public.qa_comments(id) on delete cascade,
  assignee_id uuid not null references public.profiles(id) on delete restrict,
  assigned_by uuid not null references public.profiles(id) on delete restrict,
  assigned_at timestamptz not null default now()
);

-- Immutable user-facing collaboration history. Browser clients never write this table.
create table public.qa_events (
  id uuid primary key default gen_random_uuid(),
  qa_comment_id uuid not null references public.qa_comments(id) on delete restrict,
  actor_id uuid references public.profiles(id) on delete set null,
  kind text not null,
  from_status public.qa_status,
  to_status public.qa_status,
  payload_json jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  qa_comment_id uuid not null references public.qa_comments(id) on delete cascade,
  kind public.asset_kind not null,
  object_key text not null unique,
  mime_type text not null,
  width integer check (width > 0),
  height integer check (height > 0),
  sha256 text,
  capture_metadata_json jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  qa_comment_id uuid not null references public.qa_comments(id) on delete cascade,
  kind text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.qa_sessions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  deployment_id uuid not null references public.deployments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  token_jti_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

-- Administrative/security audit history. Keep append-only.
create table public.audit_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  subject_type text not null,
  subject_id text not null,
  metadata_json jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index qa_comments_project_status_created_idx on public.qa_comments(project_id, status, created_at desc);
create index qa_comments_deployment_created_idx on public.qa_comments(deployment_id, created_at desc);
create index qa_comments_author_created_idx on public.qa_comments(author_id, created_at desc);
create index qa_events_comment_created_idx on public.qa_events(qa_comment_id, created_at);
create index audit_events_org_created_idx on public.audit_events(organization_id, created_at desc);
create index notifications_user_unread_idx on public.notifications(user_id, created_at desc) where read_at is null;

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger comments_set_updated_at before update on public.qa_comments
for each row execute function public.set_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare allowlist_row public.access_allowlist%rowtype;
begin
  select * into allowlist_row from public.access_allowlist
  where email = lower(new.email) and revoked_at is null;
  if not found then raise exception 'This email address is not approved for KNUD Design QA Hub'; end if;
  insert into public.profiles (id, email, display_name, avatar_url)
  values (new.id, lower(new.email), coalesce(allowlist_row.display_name, new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)), new.raw_user_meta_data ->> 'avatar_url');
  insert into public.memberships (organization_id, user_id, role)
  values (allowlist_row.organization_id, new.id, allowlist_row.role)
  on conflict (organization_id, user_id) do update set role = excluded.role;
  update public.access_allowlist set activated_at = coalesce(activated_at, now()) where email = lower(new.email);
  return new;
end;
$$;

-- Configure as Supabase Auth's "Before User Created" hook to deny all non-allowlisted signup attempts.
create or replace function public.before_user_created_allowlist(event jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare candidate_email text := lower(event -> 'user' ->> 'email');
begin
  if not exists (select 1 from public.access_allowlist where email = candidate_email and revoked_at is null) then
    return jsonb_build_object('error', jsonb_build_object('http_code', 403, 'message', 'This email address is not approved for KNUD Design QA Hub.'));
  end if;
  return '{}'::jsonb;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users for each row execute procedure public.handle_new_auth_user();

create or replace function public.is_org_member(target_organization_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.memberships m where m.organization_id = target_organization_id and m.user_id = auth.uid());
$$;

create or replace function public.is_project_member(target_project_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.projects p join public.memberships m on m.organization_id = p.organization_id where p.id = target_project_id and m.user_id = auth.uid());
$$;

create or replace function public.has_project_role(target_project_id uuid, allowed_roles public.member_role[])
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.projects p join public.memberships m on m.organization_id = p.organization_id where p.id = target_project_id and m.user_id = auth.uid() and m.role = any(allowed_roles));
$$;

-- Status must be changed through the RPC below, which writes the event in the same transaction.
create or replace function public.reject_untracked_status_change()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.status is distinct from new.status and current_setting('app.qa_status_transition', true) is distinct from 'true' then
    raise exception 'Use transition_qa_comment() to change QA status';
  end if;
  return new;
end;
$$;
create trigger comments_guard_status before update on public.qa_comments
for each row execute function public.reject_untracked_status_change();

create or replace function public.transition_qa_comment(comment_id uuid, next_status public.qa_status, note text default null)
returns public.qa_comments language plpgsql security definer set search_path = '' as $$
declare current_comment public.qa_comments%rowtype; org_id uuid; action_kind text;
begin
  select c.* into current_comment from public.qa_comments c where c.id = comment_id for update;
  if not found then raise exception 'QA comment not found'; end if;
  select organization_id into org_id from public.projects where id = current_comment.project_id;
  if not public.has_project_role(current_comment.project_id, array['admin','designer','developer']::public.member_role[]) then raise exception 'Not allowed to transition this QA comment'; end if;
  if not ((current_comment.status = 'open' and next_status = 'in_progress') or (current_comment.status = 'in_progress' and next_status in ('review_requested', 'open')) or (current_comment.status = 'review_requested' and next_status in ('done', 'in_progress')) or (current_comment.status = 'done' and next_status = 'open')) then
    raise exception 'Invalid QA status transition: % -> %', current_comment.status, next_status;
  end if;
  perform set_config('app.qa_status_transition', 'true', true);
  update public.qa_comments set status = next_status, resolved_at = case when next_status = 'done' then now() else null end where id = comment_id;
  action_kind := case when current_comment.status = 'done' and next_status = 'open' then 'reopened' else 'status_changed' end;
  insert into public.qa_events (qa_comment_id, actor_id, kind, from_status, to_status, payload_json)
  values (comment_id, auth.uid(), action_kind, current_comment.status, next_status, jsonb_strip_nulls(jsonb_build_object('note', note)));
  insert into public.audit_events (organization_id, actor_id, action, subject_type, subject_id, metadata_json)
  values (org_id, auth.uid(), action_kind, 'qa_comment', comment_id::text, jsonb_build_object('from_status', current_comment.status, 'to_status', next_status));
  return (select c from public.qa_comments c where c.id = comment_id);
end;
$$;

create or replace function public.record_new_qa_comment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare org_id uuid;
begin
  select organization_id into org_id from public.projects where id = new.project_id;
  insert into public.qa_events (qa_comment_id, actor_id, kind, to_status, payload_json)
  values (new.id, new.author_id, 'created', new.status, jsonb_build_object('type', new.type, 'priority', new.priority));
  insert into public.audit_events (organization_id, actor_id, action, subject_type, subject_id, metadata_json)
  values (org_id, new.author_id, 'created', 'qa_comment', new.id::text, jsonb_build_object('deployment_id', new.deployment_id));
  return new;
end;
$$;
create trigger comments_record_created after insert on public.qa_comments
for each row execute function public.record_new_qa_comment();

create view public.qa_comment_metrics with (security_invoker = true) as
select c.project_id, c.type, c.priority, c.status, date_trunc('week', c.created_at) as created_week,
  count(*) as comment_count,
  count(*) filter (where c.status = 'done') as completed_count,
  avg(extract(epoch from (c.resolved_at - c.created_at)) / 3600.0) filter (where c.resolved_at is not null) as average_resolution_hours
from public.qa_comments c where c.archived_at is null
group by c.project_id, c.type, c.priority, c.status, date_trunc('week', c.created_at);

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.access_allowlist enable row level security;
alter table public.projects enable row level security;
alter table public.deployments enable row level security;
alter table public.qa_comments enable row level security;
alter table public.annotations enable row level security;
alter table public.qa_assignments enable row level security;
alter table public.qa_events enable row level security;
alter table public.assets enable row level security;
alter table public.notifications enable row level security;
alter table public.qa_sessions enable row level security;
alter table public.audit_events enable row level security;

create policy profiles_visible_to_org_members on public.profiles for select to authenticated using (id = auth.uid() or exists (select 1 from public.memberships mine join public.memberships theirs on mine.organization_id = theirs.organization_id where mine.user_id = auth.uid() and theirs.user_id = profiles.id));
create policy profiles_self_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy organizations_members_read on public.organizations for select to authenticated using (public.is_org_member(id));
create policy memberships_members_read on public.memberships for select to authenticated using (public.is_org_member(organization_id));
create policy projects_members_read on public.projects for select to authenticated using (public.is_org_member(organization_id));
create policy deployments_members_read on public.deployments for select to authenticated using (public.is_project_member(project_id));
create policy comments_members_read on public.qa_comments for select to authenticated using (public.is_project_member(project_id));
create policy comments_members_create on public.qa_comments for insert to authenticated with check (author_id = auth.uid() and public.has_project_role(project_id, array['admin','designer','developer']::public.member_role[]));
create policy comments_members_update on public.qa_comments for update to authenticated using (public.has_project_role(project_id, array['admin','designer','developer']::public.member_role[])) with check (public.has_project_role(project_id, array['admin','designer','developer']::public.member_role[]));
create policy annotations_members_read on public.annotations for select to authenticated using (exists (select 1 from public.qa_comments c where c.id = annotations.qa_comment_id and public.is_project_member(c.project_id)));
create policy annotations_members_write on public.annotations for all to authenticated using (exists (select 1 from public.qa_comments c where c.id = annotations.qa_comment_id and public.has_project_role(c.project_id, array['admin','designer','developer']::public.member_role[]))) with check (exists (select 1 from public.qa_comments c where c.id = annotations.qa_comment_id and public.has_project_role(c.project_id, array['admin','designer','developer']::public.member_role[])));
create policy assignments_members_read on public.qa_assignments for select to authenticated using (exists (select 1 from public.qa_comments c where c.id = qa_assignments.qa_comment_id and public.is_project_member(c.project_id)));
create policy assignments_members_write on public.qa_assignments for all to authenticated using (exists (select 1 from public.qa_comments c where c.id = qa_assignments.qa_comment_id and public.has_project_role(c.project_id, array['admin','designer','developer']::public.member_role[]))) with check (exists (select 1 from public.qa_comments c where c.id = qa_assignments.qa_comment_id and public.has_project_role(c.project_id, array['admin','designer','developer']::public.member_role[])));
create policy events_members_read on public.qa_events for select to authenticated using (exists (select 1 from public.qa_comments c where c.id = qa_events.qa_comment_id and public.is_project_member(c.project_id)));
create policy assets_members_read on public.assets for select to authenticated using (exists (select 1 from public.qa_comments c where c.id = assets.qa_comment_id and public.is_project_member(c.project_id)));
create policy assets_members_write on public.assets for insert to authenticated with check (exists (select 1 from public.qa_comments c where c.id = assets.qa_comment_id and public.has_project_role(c.project_id, array['admin','designer','developer']::public.member_role[])));
create policy notifications_own_read on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_own_update on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy sessions_own_read on public.qa_sessions for select to authenticated using (user_id = auth.uid());
create policy audit_admin_read on public.audit_events for select to authenticated using (exists (select 1 from public.memberships m where m.organization_id = audit_events.organization_id and m.user_id = auth.uid() and m.role = 'admin'));

revoke all on public.access_allowlist, public.qa_events, public.audit_events from anon, authenticated;
grant select, insert, update on public.profiles, public.organizations, public.memberships, public.projects, public.deployments, public.qa_comments, public.annotations, public.qa_assignments, public.assets, public.notifications, public.qa_sessions to authenticated;
grant select on public.qa_comment_metrics to authenticated;
revoke execute on function public.transition_qa_comment(uuid, public.qa_status, text) from public, anon;
grant execute on function public.transition_qa_comment(uuid, public.qa_status, text) to authenticated;
revoke execute on function public.before_user_created_allowlist(jsonb) from public, anon, authenticated;
