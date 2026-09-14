-- Moil Sigan / 모일 시간: run this once in the Supabase SQL Editor.
-- This schema intentionally makes each event readable to anyone with its link,
-- while updates require a private per-person edit token.
create extension if not exists pgcrypto;

create table if not exists public.schedule_events (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null default lower(substr(encode(gen_random_bytes(8), 'hex'), 1, 12)),
  title text not null check (char_length(title) between 1 and 100),
  dates jsonb not null check (jsonb_typeof(dates) = 'array' and jsonb_array_length(dates) > 0),
  start_time time not null,
  end_time time not null check (end_time > start_time),
  slot_minutes integer not null check (slot_minutes in (15, 30, 60)),
  timezone text not null,
  owner_token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table if not exists public.schedule_responses (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.schedule_events(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 60),
  availability jsonb not null default '[]'::jsonb check (jsonb_typeof(availability) = 'array'),
  edit_token uuid not null default gen_random_uuid(),
  updated_at timestamptz not null default now(),
  unique (event_id, display_name)
);

alter table public.schedule_events enable row level security;
alter table public.schedule_responses enable row level security;
drop policy if exists "Public schedules are readable" on public.schedule_events;
drop policy if exists "Public responses are readable" on public.schedule_responses;
create policy "Public schedules are readable" on public.schedule_events for select to anon using (true);
create policy "Public responses are readable" on public.schedule_responses for select to anon using (true);

create or replace function public.create_schedule_event(
  p_title text, p_dates jsonb, p_start_time time, p_end_time time, p_slot_minutes integer, p_timezone text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare new_event public.schedule_events;
begin
  insert into public.schedule_events (title, dates, start_time, end_time, slot_minutes, timezone)
  values (trim(p_title), p_dates, p_start_time, p_end_time, p_slot_minutes, p_timezone)
  returning * into new_event;
  return jsonb_build_object(
    'event', jsonb_build_object('id',new_event.id,'slug',new_event.slug,'title',new_event.title,'dates',new_event.dates,'start_time',new_event.start_time,'end_time',new_event.end_time,'slot_minutes',new_event.slot_minutes,'timezone',new_event.timezone,'created_at',new_event.created_at),
    'owner_token', new_event.owner_token
  );
end;
$$;

create or replace function public.save_schedule_response(
  p_event_id uuid, p_display_name text, p_availability jsonb, p_edit_token uuid default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare saved_response public.schedule_responses;
begin
  select * into saved_response from public.schedule_responses where event_id = p_event_id and display_name = trim(p_display_name);
  if found then
    if p_edit_token is null or saved_response.edit_token <> p_edit_token then
      raise exception 'This name is already in use. Please choose a different name.' using errcode = 'P0001';
    end if;
    update public.schedule_responses set availability = p_availability, updated_at = now() where id = saved_response.id returning * into saved_response;
  else
    insert into public.schedule_responses (event_id, display_name, availability) values (p_event_id, trim(p_display_name), p_availability) returning * into saved_response;
  end if;
  return jsonb_build_object('id', saved_response.id, 'edit_token', saved_response.edit_token, 'updated_at', saved_response.updated_at);
end;
$$;

grant usage on schema public to anon;
grant select on public.schedule_events, public.schedule_responses to anon;
grant execute on function public.create_schedule_event(text, jsonb, time, time, integer, text) to anon;
grant execute on function public.save_schedule_response(uuid, text, jsonb, uuid) to anon;
