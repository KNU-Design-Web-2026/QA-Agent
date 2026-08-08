create table public.qa_user_tutorials (
  user_id uuid not null references public.profiles(id) on delete cascade,
  tutorial_key text not null,
  seen_version integer not null default 0 check (seen_version >= 0),
  dismissed_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, tutorial_key)
);

create trigger qa_user_tutorials_set_updated_at
before update on public.qa_user_tutorials
for each row execute function public.set_updated_at();

alter table public.qa_user_tutorials enable row level security;
