-- Complete account ownership references. Ordinary habit/day/import removal
-- keeps its existing foreign-key rules; only Auth account deletion cascades.
begin;

alter table public.habit_entries
  add constraint habit_entries_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.import_items
  add constraint import_items_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

-- The authenticated owner must exist for the entire RPC transaction.
-- Take the account lock before any per-account application locks, so an Auth
-- deletion and an already-running sync command cannot interleave their writes.
create or replace function private.owner()
returns uuid language plpgsql volatile set search_path = '' as $$
declare
  u uuid := auth.uid();
  confirmed_owner uuid;
begin
  if u is null then
    raise exception 'auth_required' using errcode = '42501';
  end if;

  select id into confirmed_owner
  from auth.users
  where id = u and email_confirmed_at is not null
  for key share;

  if confirmed_owner is null then
    raise exception 'auth_required' using errcode = '42501';
  end if;
  return confirmed_owner;
end $$;

revoke all on function private.owner() from public, anon, authenticated;

commit;
