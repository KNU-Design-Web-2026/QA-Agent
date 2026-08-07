-- Render's capture worker is the only runtime that claims these jobs.
create type public.capture_job_status as enum ('pending', 'processing', 'completed', 'failed');

create table public.capture_jobs (
  id uuid primary key default gen_random_uuid(),
  qa_comment_id uuid not null references public.qa_comments(id) on delete cascade,
  deployment_url text not null,
  pathname text not null,
  query_string text not null default '',
  viewport_width integer not null check (viewport_width > 0),
  viewport_height integer not null check (viewport_height > 0),
  device_scale_factor numeric(5, 2) not null default 1 check (device_scale_factor > 0),
  scroll_x integer not null default 0,
  scroll_y integer not null default 0,
  status public.capture_job_status not null default 'pending',
  attempt_count integer not null default 0,
  locked_at timestamptz,
  completed_at timestamptz,
  screenshot_object_key text,
  error_message text,
  created_at timestamptz not null default now()
);

create index capture_jobs_pending_idx on public.capture_jobs(created_at) where status = 'pending';

-- Claims exactly one job using SKIP LOCKED, allowing future worker scaling without
-- two workers capturing the same comment.
create or replace function public.claim_capture_job()
returns setof public.capture_jobs language plpgsql security definer set search_path = '' as $$
declare claimed public.capture_jobs%rowtype;
begin
  select * into claimed
  from public.capture_jobs
  where status = 'pending'
  order by created_at
  for update skip locked
  limit 1;
  if not found then return; end if;

  update public.capture_jobs
  set status = 'processing', attempt_count = attempt_count + 1, locked_at = now(), error_message = null
  where id = claimed.id
  returning * into claimed;
  return next claimed;
end;
$$;

alter table public.capture_jobs enable row level security;
create policy capture_jobs_members_read on public.capture_jobs for select to authenticated using (
  exists (select 1 from public.qa_comments c where c.id = capture_jobs.qa_comment_id and public.is_project_member(c.project_id))
);
create policy capture_jobs_members_create on public.capture_jobs for insert to authenticated with check (
  exists (select 1 from public.qa_comments c where c.id = capture_jobs.qa_comment_id and c.author_id = auth.uid())
);

insert into storage.buckets (id, name, public)
values ('qa-assets', 'qa-assets', false)
on conflict (id) do update set public = false;

-- The browser never receives a bucket-wide read policy. The Hub creates signed URLs
-- after checking the associated `assets` row and project membership.
revoke execute on function public.claim_capture_job() from public, anon, authenticated;
grant execute on function public.claim_capture_job() to service_role;
