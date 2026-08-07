-- Store collaborator names before their first magic-link sign-in.
-- The sign-up trigger below copies this value into public.profiles.

alter table public.access_allowlist
add column if not exists display_name text;

create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare allowlist_row public.access_allowlist%rowtype;
begin
  select * into allowlist_row from public.access_allowlist
  where email = lower(new.email) and revoked_at is null;
  if not found then raise exception 'This email address is not approved for KNUD Design QA Hub'; end if;
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    lower(new.email),
    coalesce(allowlist_row.display_name, new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  insert into public.memberships (organization_id, user_id, role)
  values (allowlist_row.organization_id, new.id, allowlist_row.role)
  on conflict (organization_id, user_id) do update set role = excluded.role;
  update public.access_allowlist set activated_at = coalesce(activated_at, now()) where email = lower(new.email);
  return new;
end;
$$;
