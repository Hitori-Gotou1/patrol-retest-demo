-- Optional aggregate collection. Run after gallery.sql as the project owner.
-- Enable VITE_SITE_ANALYTICS=enabled in Pages build variables only after applying.
begin;
create table if not exists public.hitori_daily_events (
 day date not null default (now() at time zone 'UTC')::date,
 target_key text not null,
 event_kind text not null check (event_kind in ('open','complete','export')),
 count bigint not null default 0 check (count between 0 and 10000000),
 primary key(day,target_key,event_kind)
);
alter table public.hitori_daily_events enable row level security;
revoke all on public.hitori_daily_events from anon;
grant select on public.hitori_daily_events to authenticated;
drop policy if exists "Only gallery owners read aggregate counts" on public.hitori_daily_events;
create policy "Only gallery owners read aggregate counts" on public.hitori_daily_events for select to authenticated using (exists(select 1 from public.gallery_admins a where a.user_id=auth.uid()));
create or replace function public.hitori_record_event(event_kind text,target_key text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if event_kind not in ('open','complete','export') or target_key not in ('home','gallery','notes','works','project','calendar','pilgrimage','sources','cards','jigsaw','shop','platform','lights','comic','mix','graffiti','relay','pinball','maze','effects','companion','echo','escape','duet','photobooth','decorate','walk','search','concert','ambient','rhythm','stories','studio','practice','guestbook') then raise exception 'Invalid event';end if;
 insert into public.hitori_daily_events(day,target_key,event_kind,count) values ((now() at time zone 'UTC')::date,target_key,event_kind,1)
 on conflict on constraint hitori_daily_events_pkey do update set count=least(10000000,hitori_daily_events.count+1);
end;$$;
revoke all on function public.hitori_record_event(text,text) from public;
grant execute on function public.hitori_record_event(text,text) to anon,authenticated;
commit;
