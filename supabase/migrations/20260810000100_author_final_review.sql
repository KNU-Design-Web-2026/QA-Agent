-- Keep development completion separate from the designer's final visual review.
create or replace function public.transition_qa_comment_as_actor(
  comment_id uuid,
  next_status public.qa_status,
  actor_id uuid,
  note text default null
)
returns public.qa_comments language plpgsql security definer set search_path = '' as $$
declare
  current_comment public.qa_comments%rowtype;
  org_id uuid;
  action_kind text;
  actor_role public.member_role;
  is_author boolean;
begin
  select c.* into current_comment from public.qa_comments c where c.id = comment_id for update;
  if not found then raise exception 'QA comment not found'; end if;

  select p.organization_id into org_id from public.projects p where p.id = current_comment.project_id;
  select m.role into actor_role from public.memberships m where m.organization_id = org_id and m.user_id = actor_id;
  if actor_role is null or actor_role not in ('admin', 'designer', 'developer') then
    raise exception 'Not allowed to transition this QA comment';
  end if;

  is_author := current_comment.author_id = actor_id;
  if not (
    (current_comment.status = 'open' and next_status = 'in_progress')
    or (current_comment.status = 'in_progress' and next_status = 'review_requested')
    or (current_comment.status = 'review_requested' and next_status = 'done' and (is_author or actor_role = 'admin'))
    or (current_comment.status = 'review_requested' and next_status = 'in_progress' and (is_author or actor_role = 'admin'))
    or (current_comment.status = 'done' and next_status = 'open' and (is_author or actor_role = 'admin'))
  ) then
    raise exception 'Invalid QA status transition: % -> %', current_comment.status, next_status;
  end if;

  perform set_config('app.qa_status_transition', 'true', true);
  update public.qa_comments
  set status = next_status,
      resolved_at = case when next_status = 'done' then now() else null end
  where id = comment_id;

  action_kind := case
    when next_status = 'review_requested' then 'review_requested'
    when current_comment.status in ('review_requested', 'done') and next_status in ('in_progress', 'open') then 'reopened'
    when next_status = 'done' then 'confirmed'
    else 'status_changed'
  end;

  insert into public.qa_events (qa_comment_id, actor_id, kind, from_status, to_status, payload_json)
  values (comment_id, actor_id, action_kind, current_comment.status, next_status, jsonb_strip_nulls(jsonb_build_object('note', note)));
  insert into public.audit_events (organization_id, actor_id, action, subject_type, subject_id, metadata_json)
  values (org_id, actor_id, action_kind, 'qa_comment', comment_id::text, jsonb_build_object('from_status', current_comment.status, 'to_status', next_status));

  return (select c from public.qa_comments c where c.id = comment_id);
end;
$$;
