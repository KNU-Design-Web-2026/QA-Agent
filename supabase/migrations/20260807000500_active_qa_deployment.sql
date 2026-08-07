-- Exactly one deployment is the shared QA baseline for a project.
-- New deployments are recorded independently and do not change this value.
alter table public.projects
add column if not exists qa_active_deployment_id uuid references public.deployments(id) on delete set null;

create index if not exists projects_active_qa_deployment_idx
on public.projects (qa_active_deployment_id)
where qa_active_deployment_id is not null;
