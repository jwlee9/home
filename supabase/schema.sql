-- Scheduler backend. Safe to run again when upgrading an existing project.
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

alter table public.schedule_events add column if not exists is_closed boolean not null default false;
alter table public.schedule_events add column if not exists confirmed_date date;
alter table public.schedule_events add column if not exists confirmed_start_time time;
alter table public.schedule_events add column if not exists confirmed_end_time time;
alter table public.schedule_events add column if not exists highlight_color text not null default '#2a4997';
alter table public.schedule_responses add column if not exists password_hash text;

alter table public.schedule_events enable row level security;
alter table public.schedule_responses enable row level security;
drop policy if exists "Public schedules are readable" on public.schedule_events;
drop policy if exists "Public responses are readable" on public.schedule_responses;
revoke all on public.schedule_events, public.schedule_responses from anon;

drop function if exists public.create_schedule_event(text, jsonb, time, time, integer, text);
create or replace function public.create_schedule_event(
  p_title text, p_dates jsonb, p_start_time time, p_end_time time, p_slot_minutes integer, p_timezone text, p_highlight_color text default '#2a4997'
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare new_event public.schedule_events;
begin
  if p_highlight_color !~ '^#[0-9A-Fa-f]{6}$' then raise exception 'Invalid highlight color.' using errcode = 'P0001'; end if;
  insert into public.schedule_events (title, dates, start_time, end_time, slot_minutes, timezone, highlight_color)
  values (trim(p_title), p_dates, p_start_time, p_end_time, p_slot_minutes, p_timezone, lower(p_highlight_color))
  returning * into new_event;
  return jsonb_build_object(
    'event', jsonb_build_object('id',new_event.id,'slug',new_event.slug,'title',new_event.title,'dates',new_event.dates,'start_time',new_event.start_time,'end_time',new_event.end_time,'slot_minutes',new_event.slot_minutes,'timezone',new_event.timezone,'highlight_color',new_event.highlight_color,'is_closed',new_event.is_closed,'confirmed_date',new_event.confirmed_date,'confirmed_start_time',new_event.confirmed_start_time,'confirmed_end_time',new_event.confirmed_end_time,'created_at',new_event.created_at),
    'owner_token', new_event.owner_token
  );
end;
$$;

create or replace function public.get_schedule(p_slug text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare found_event public.schedule_events; response_list jsonb;
begin
  select * into found_event from public.schedule_events where slug = p_slug;
  if not found then raise exception 'Schedule not found.' using errcode = 'P0002'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'display_name',display_name,'availability',availability,'updated_at',updated_at,'has_password',password_hash is not null) order by updated_at), '[]'::jsonb)
  into response_list from public.schedule_responses where event_id = found_event.id;
  return jsonb_build_object(
    'event', jsonb_build_object('id',found_event.id,'slug',found_event.slug,'title',found_event.title,'dates',found_event.dates,'start_time',found_event.start_time,'end_time',found_event.end_time,'slot_minutes',found_event.slot_minutes,'timezone',found_event.timezone,'highlight_color',found_event.highlight_color,'is_closed',found_event.is_closed,'confirmed_date',found_event.confirmed_date,'confirmed_start_time',found_event.confirmed_start_time,'confirmed_end_time',found_event.confirmed_end_time,'created_at',found_event.created_at),
    'responses', response_list
  );
end;
$$;

create or replace function public.authenticate_schedule_response(
  p_event_id uuid, p_display_name text, p_password text
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare found_response public.schedule_responses;
begin
  select * into found_response from public.schedule_responses where event_id = p_event_id and display_name = trim(p_display_name);
  if not found then raise exception 'Name not found.' using errcode = 'P0002'; end if;
  if found_response.password_hash is null then raise exception 'This response has no password.' using errcode = 'P0001'; end if;
  if p_password is null or crypt(p_password, found_response.password_hash) <> found_response.password_hash then raise exception 'Incorrect password.' using errcode = 'P0001'; end if;
  return jsonb_build_object('edit_token',found_response.edit_token,'availability',found_response.availability);
end;
$$;

drop function if exists public.save_schedule_response(uuid, text, jsonb, uuid);
create or replace function public.save_schedule_response(
  p_event_id uuid, p_display_name text, p_availability jsonb, p_edit_token uuid default null, p_password text default null
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare saved_response public.schedule_responses; closed boolean; normalized_password text;
begin
  select is_closed into closed from public.schedule_events where id = p_event_id;
  if not found then raise exception 'Schedule not found.' using errcode = 'P0002'; end if;
  if closed then raise exception 'This schedule is closed.' using errcode = 'P0001'; end if;
  normalized_password := nullif(p_password, '');
  select * into saved_response from public.schedule_responses where event_id = p_event_id and display_name = trim(p_display_name);
  if found then
    if (p_edit_token is null or saved_response.edit_token <> p_edit_token)
       and (saved_response.password_hash is null or normalized_password is null or crypt(normalized_password, saved_response.password_hash) <> saved_response.password_hash) then
      raise exception 'Incorrect password or missing edit permission.' using errcode = 'P0001';
    end if;
    update public.schedule_responses set availability = p_availability, updated_at = now() where id = saved_response.id returning * into saved_response;
  else
    insert into public.schedule_responses (event_id, display_name, availability, password_hash)
    values (p_event_id, trim(p_display_name), p_availability, case when normalized_password is null then null else crypt(normalized_password, gen_salt('bf', 10)) end)
    returning * into saved_response;
  end if;
  return jsonb_build_object('id',saved_response.id,'edit_token',saved_response.edit_token,'updated_at',saved_response.updated_at);
end;
$$;

create or replace function public.manage_schedule_event(
  p_event_id uuid, p_owner_token uuid, p_action text, p_payload jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare found_event public.schedule_events; chosen_date date; chosen_start time; chosen_end time;
begin
  select * into found_event from public.schedule_events where id = p_event_id and owner_token = p_owner_token;
  if not found then raise exception 'Invalid organizer link.' using errcode = 'P0001'; end if;
  case p_action
    when 'rename' then
      if char_length(trim(p_payload->>'title')) not between 1 and 100 then raise exception 'Name must be 1–100 characters.' using errcode = 'P0001'; end if;
      update public.schedule_events set title = trim(p_payload->>'title') where id = p_event_id;
    when 'set_highlight_color' then
      if (p_payload->>'highlight_color') !~ '^#[0-9A-Fa-f]{6}$' then raise exception 'Invalid highlight color.' using errcode = 'P0001'; end if;
      update public.schedule_events set highlight_color = lower(p_payload->>'highlight_color') where id = p_event_id;
    when 'set_closed' then
      update public.schedule_events set is_closed = (p_payload->>'is_closed')::boolean where id = p_event_id;
    when 'delete_response' then
      delete from public.schedule_responses where id = (p_payload->>'response_id')::uuid and event_id = p_event_id;
    when 'confirm' then
      chosen_date := (p_payload->>'date')::date; chosen_start := (p_payload->>'start_time')::time; chosen_end := (p_payload->>'end_time')::time;
      if not exists (select 1 from jsonb_array_elements_text(found_event.dates) as item(value) where item.value = chosen_date::text) then raise exception 'Choose a date from this schedule.' using errcode = 'P0001'; end if;
      if chosen_end <= chosen_start then raise exception 'End time must be later than start time.' using errcode = 'P0001'; end if;
      update public.schedule_events set confirmed_date = chosen_date, confirmed_start_time = chosen_start, confirmed_end_time = chosen_end where id = p_event_id;
    when 'clear_confirmation' then
      update public.schedule_events set confirmed_date = null, confirmed_start_time = null, confirmed_end_time = null where id = p_event_id;
    else raise exception 'Unknown organizer action.' using errcode = 'P0001';
  end case;
  return jsonb_build_object('ok',true);
end;
$$;

revoke all on function public.create_schedule_event(text, jsonb, time, time, integer, text, text) from public;
revoke all on function public.get_schedule(text) from public;
revoke all on function public.authenticate_schedule_response(uuid, text, text) from public;
revoke all on function public.save_schedule_response(uuid, text, jsonb, uuid, text) from public;
revoke all on function public.manage_schedule_event(uuid, uuid, text, jsonb) from public;
grant usage on schema public to anon;
grant execute on function public.create_schedule_event(text, jsonb, time, time, integer, text, text) to anon;
grant execute on function public.get_schedule(text) to anon;
grant execute on function public.authenticate_schedule_response(uuid, text, text) to anon;
grant execute on function public.save_schedule_response(uuid, text, jsonb, uuid, text) to anon;
grant execute on function public.manage_schedule_event(uuid, uuid, text, jsonb) to anon;
