-- A review request points designers to the deployed screen where a fix is ready.
alter table public.qa_comments
add column if not exists review_deployment_id uuid
references public.deployments(id) on delete set null;

create index if not exists qa_comments_review_deployment_idx
on public.qa_comments(review_deployment_id)
where review_deployment_id is not null;

create or replace function public.request_qa_comment_review_as_actor(
  comment_id uuid,
  actor_id uuid,
  review_deployment_id uuid,
  note text default null
)
returns public.qa_comments language plpgsql security definer set search_path = '' as $$
declare
  current_comment public.qa_comments%rowtype;
  org_id uuid;
  actor_role public.member_role;
  target_deployment public.deployments%rowtype;
begin
  select c.* into current_comment
  from public.qa_comments c
  where c.id = comment_id
  for update;
  if not found then raise exception 'QA comment not found'; end if;

  select p.organization_id into org_id
  from public.projects p
  where p.id = current_comment.project_id;
  select m.role into actor_role
  from public.memberships m
  where m.organization_id = org_id and m.user_id = actor_id;
  if actor_role is null or actor_role not in ('admin', 'developer') then
    raise exception 'Not allowed to request QA review';
  end if;
  if current_comment.status <> 'in_progress' then
    raise exception 'Invalid QA status transition: % -> review_requested', current_comment.status;
  end if;

  select d.* into target_deployment
  from public.deployments d
  where d.id = review_deployment_id
    and d.project_id = current_comment.project_id
    and d.state = 'ready';
  if not found then
    raise exception 'Review deployment is not available for this project';
  end if;

  perform set_config('app.qa_status_transition', 'true', true);
  update public.qa_comments
  set status = 'review_requested',
      review_deployment_id = target_deployment.id,
      resolved_at = null
  where id = comment_id;

  insert into public.qa_events (
    qa_comment_id,
    actor_id,
    kind,
    from_status,
    to_status,
    payload_json
  ) values (
    comment_id,
    actor_id,
    'review_requested',
    current_comment.status,
    'review_requested',
    jsonb_strip_nulls(
      jsonb_build_object(
        'note', note,
        'review_deployment_id', target_deployment.id
      )
    )
  );

  insert into public.audit_events (
    organization_id,
    actor_id,
    action,
    subject_type,
    subject_id,
    metadata_json
  ) values (
    org_id,
    actor_id,
    'review_requested',
    'qa_comment',
    comment_id::text,
    jsonb_build_object('review_deployment_id', target_deployment.id)
  );

  return (select c from public.qa_comments c where c.id = comment_id);
end;
$$;

revoke execute on function public.request_qa_comment_review_as_actor(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.request_qa_comment_review_as_actor(uuid, uuid, uuid, text) to service_role;

notify pgrst, 'reload schema';
