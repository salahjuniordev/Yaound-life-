-- Content report moderation workflow.
-- Additive and safe to rerun. Clients can submit and read their own reports;
-- only the service role can list or resolve the review queue.

alter table public.reports
  add column if not exists status text not null default 'open';
alter table public.reports
  add column if not exists reviewed_at timestamptz;
alter table public.reports
  add column if not exists reviewed_by uuid references auth.users (id) on delete set null;
alter table public.reports
  add column if not exists resolution text;

do $$
begin
  alter table public.reports
    add constraint reports_status_check
    check (status in ('open', 'reviewing', 'resolved', 'dismissed'));
exception
  when duplicate_object then null;
end $$;

create index if not exists reports_status_created_idx
  on public.reports (status, created_at desc);

-- Let a reporter withdraw a report while it is still open, but keep resolved
-- and dismissed reports for the audit trail.
drop policy if exists "reports_delete_own_open" on public.reports;
create policy "reports_delete_own_open" on public.reports
  for delete using (user_id = auth.uid() and status = 'open');

create or replace function public.list_content_reports(
  p_status text default 'open',
  p_limit integer default 50
)
returns setof public.reports
language sql
security definer
set search_path = public
as $$
  select *
  from public.reports
  where p_status is null
     or p_status = ''
     or p_status = 'all'
     or status = p_status
  order by created_at desc
  limit greatest(1, least(coalesce(p_limit, 50), 200));
$$;

create or replace function public.resolve_content_report(
  p_report_id bigint,
  p_status text,
  p_resolution text default null
)
returns public.reports
language plpgsql
security definer
set search_path = public
as $$
declare
  updated public.reports;
begin
  if p_status not in ('open', 'reviewing', 'resolved', 'dismissed') then
    raise exception 'invalid report status: %', p_status using errcode = '22023';
  end if;

  update public.reports
     set status = p_status,
         resolution = nullif(btrim(coalesce(p_resolution, '')), ''),
         reviewed_at = now(),
         reviewed_by = coalesce(auth.uid(), reviewed_by)
   where id = p_report_id
  returning * into updated;

  if updated.id is null then
    raise exception 'report % not found', p_report_id using errcode = 'P0002';
  end if;

  return updated;
end;
$$;

revoke all on function public.list_content_reports(text, integer) from public, anon, authenticated;
revoke all on function public.resolve_content_report(bigint, text, text) from public, anon, authenticated;
grant execute on function public.list_content_reports(text, integer) to service_role;
grant execute on function public.resolve_content_report(bigint, text, text) to service_role;

comment on function public.list_content_reports(text, integer)
  is 'Service-role-only report queue for moderation.';
comment on function public.resolve_content_report(bigint, text, text)
  is 'Service-role-only report status update for moderation.';
