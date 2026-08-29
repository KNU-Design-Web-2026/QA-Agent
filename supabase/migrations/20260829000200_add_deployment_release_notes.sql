alter table public.deployments
  add column if not exists version_name text,
  add column if not exists change_summary text;

comment on column public.deployments.version_name is
  '개발자가 입력하는 사람이 읽는 검수 버전 이름';

comment on column public.deployments.change_summary is
  '해당 검수 버전에서 확인할 변경 사항 요약';
