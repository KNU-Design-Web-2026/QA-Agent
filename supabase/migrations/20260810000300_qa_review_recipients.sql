create table public.qa_review_recipients (
  qa_comment_id uuid not null references public.qa_comments(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  requested_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (qa_comment_id, reviewer_id)
);

create index qa_review_recipients_reviewer_idx
on public.qa_review_recipients(reviewer_id, created_at desc);

alter table public.qa_review_recipients enable row level security;
