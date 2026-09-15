-- Scheduler backend. Safe to run again when upgrading an existing project.
begin;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.schedule_events (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null default encode(extensions.gen_random_bytes(16), 'hex'),
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
alter table public.schedule_responses add column if not exists password_attempts integer not null default 0;
alter table public.schedule_responses add column if not exists password_window timestamptz;
-- Existing links remain valid; only newly created links use 128 bits.
alter table public.schedule_events alter column slug set default encode(extensions.gen_random_bytes(16), 'hex');

alter table public.schedule_events enable row level security;
alter table public.schedule_responses enable row level security;
drop policy if exists "Public schedules are readable" on public.schedule_events;
drop policy if exists "Public responses are readable" on public.schedule_responses;
revoke all on public.schedule_events, public.schedule_responses from public, anon, authenticated;

drop function if exists public.create_schedule_event(text, jsonb, time, time, integer, text);
create or replace function public.create_schedule_event(
  p_title text, p_dates jsonb, p_start_time time, p_end_time time, p_slot_minutes integer, p_timezone text, p_highlight_color text default '#2a4997'
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare new_event public.schedule_events; item jsonb; date_text text; previous_date text;
begin
  if p_title is null or char_length(trim(p_title)) not between 1 and 100 or p_title ~ '[[:cntrl:]]' then raise exception 'Name must be 1–100 characters without control characters.'; end if;
  if p_highlight_color is null or p_highlight_color !~ '^#[0-9A-Fa-f]{6}$' then raise exception 'Invalid highlight color.'; end if;
  if p_dates is null or jsonb_typeof(p_dates) <> 'array' then raise exception 'Choose valid dates.'; end if;
  if jsonb_array_length(p_dates) not between 1 and 31 then raise exception 'Choose at most 31 dates.'; end if;
  for item in select value from jsonb_array_elements(p_dates) loop
    date_text := item #>> '{}';
    if jsonb_typeof(item) <> 'string' or date_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'Invalid date.'; end if;
    if to_char(date_text::date, 'YYYY-MM-DD') <> date_text or date_text <= previous_date then raise exception 'Dates must be valid, unique and sorted.'; end if;
    previous_date := date_text;
  end loop;
  if p_slot_minutes is null or p_slot_minutes not in (15,30,60) or p_start_time is null or p_end_time is null or p_end_time <= p_start_time
     or extract(second from p_start_time) <> 0 or extract(second from p_end_time) <> 0
     or mod(extract(epoch from (p_end_time - p_start_time))::integer, p_slot_minutes * 60) <> 0 then
    raise exception 'Use a time range made of complete intervals.';
  end if;
  if p_timezone is null or not exists (select 1 from pg_catalog.pg_timezone_names where name = p_timezone)
     or p_timezone !~ '^[A-Za-z0-9_+/-]+$' then raise exception 'Invalid time zone.'; end if;
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
returns jsonb language plpgsql security definer set search_path = '' as $$
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
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare found_response public.schedule_responses;
begin
  select * into found_response from public.schedule_responses where event_id = p_event_id and display_name = trim(p_display_name) for update;
  if not found then raise exception 'Name not found.' using errcode = 'P0002'; end if;
  if found_response.password_hash is null then raise exception 'This response has no password.' using errcode = 'P0001'; end if;
  if found_response.password_window is null or found_response.password_window <= clock_timestamp() - interval '5 minutes' then
    update public.schedule_responses set password_attempts = 0, password_window = clock_timestamp() where id = found_response.id returning * into found_response;
  end if;
  -- Return errors instead of raising: an exception would roll back the attempt counter.
  -- The browser edit token continues to work during password cooldown.
  if found_response.password_attempts >= 10 then
    perform set_config('response.status','429',true);
    return jsonb_build_object('error','Too many password attempts. Try again in 5 minutes.','message','Too many password attempts. Try again in 5 minutes.');
  end if;
  update public.schedule_responses set password_attempts = password_attempts + 1 where id = found_response.id;
  if p_password is null or octet_length(p_password) > 72 or extensions.crypt(p_password, found_response.password_hash) <> found_response.password_hash then
    perform set_config('response.status','403',true);
    return jsonb_build_object('error','Incorrect password.','message','Incorrect password.');
  end if;
  update public.schedule_responses set password_attempts = 0, password_window = null where id = found_response.id;
  return jsonb_build_object('edit_token',found_response.edit_token,'availability',found_response.availability);
end;
$$;

drop function if exists public.save_schedule_response(uuid, text, jsonb, uuid);
create or replace function public.save_schedule_response(
  p_event_id uuid, p_display_name text, p_availability jsonb, p_edit_token uuid default null, p_password text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare saved_response public.schedule_responses; found_event public.schedule_events; normalized_password text; auth_result jsonb; item jsonb; key text; minute integer; start_minute integer; end_minute integer;
begin
  -- Serialize saves with organizer close/removal and concurrent first responses.
  select * into found_event from public.schedule_events where id = p_event_id for update;
  if not found then raise exception 'Schedule not found.' using errcode = 'P0002'; end if;
  if found_event.is_closed then raise exception 'This schedule is closed.' using errcode = 'P0001'; end if;
  if p_display_name is null or char_length(trim(p_display_name)) not between 1 and 60 or p_display_name ~ '[[:cntrl:]]' then raise exception 'Name must be 1–60 characters without control characters.'; end if;
  normalized_password := nullif(p_password, '');
  select * into saved_response from public.schedule_responses where event_id = p_event_id and display_name = trim(p_display_name);
  if found then
    if p_edit_token is null or saved_response.edit_token <> p_edit_token then
      auth_result := public.authenticate_schedule_response(p_event_id, p_display_name, normalized_password);
      if auth_result ? 'error' then return auth_result; end if;
    end if;
  elsif p_edit_token is not null then
    raise exception 'This response was removed. Start again with a new name.';
  elsif (select count(*) from public.schedule_responses where event_id = p_event_id) >= 200 then
    raise exception 'This schedule has reached its 200-person limit.';
  end if;
  if normalized_password is not null and octet_length(normalized_password) > 72 then raise exception 'Password must be at most 72 UTF-8 bytes.'; end if;
  if p_availability is null or jsonb_typeof(p_availability) <> 'array' then raise exception 'Invalid available times.'; end if;
  start_minute := extract(epoch from found_event.start_time)::integer / 60;
  end_minute := extract(epoch from found_event.end_time)::integer / 60;
  if jsonb_array_length(p_availability) > jsonb_array_length(found_event.dates) * ((end_minute - start_minute + found_event.slot_minutes - 1) / found_event.slot_minutes) then raise exception 'Too many available times.'; end if;
  for item in select value from jsonb_array_elements(p_availability) loop
    key := item #>> '{}';
    if jsonb_typeof(item) <> 'string' or key !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}$'
       or not (found_event.dates ? left(key,10)) then raise exception 'Invalid available time.'; end if;
    if substring(key from 12 for 2)::integer > 23 or right(key,2)::integer > 59 then raise exception 'Invalid clock time.'; end if;
    minute := substring(key from 12 for 2)::integer * 60 + right(key,2)::integer;
    if minute < start_minute or minute >= end_minute or mod(minute - start_minute, found_event.slot_minutes) <> 0 then raise exception 'Available time is outside this schedule.'; end if;
  end loop;
  if (select count(distinct value) from jsonb_array_elements(p_availability)) <> jsonb_array_length(p_availability) then raise exception 'Duplicate available times.'; end if;
  if saved_response.id is not null then
    update public.schedule_responses set availability = p_availability, updated_at = now() where id = saved_response.id returning * into saved_response;
  else
    insert into public.schedule_responses (event_id, display_name, availability, password_hash)
    values (p_event_id, trim(p_display_name), p_availability, case when normalized_password is null then null else extensions.crypt(normalized_password, extensions.gen_salt('bf', 10)) end)
    returning * into saved_response;
  end if;
  return jsonb_build_object('id',saved_response.id,'edit_token',saved_response.edit_token,'updated_at',saved_response.updated_at);
end;
$$;

create or replace function public.manage_schedule_event(
  p_event_id uuid, p_owner_token uuid, p_action text, p_payload jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare found_event public.schedule_events; chosen_date date; chosen_start time; chosen_end time;
begin
  select * into found_event from public.schedule_events where id = p_event_id and owner_token = p_owner_token for update;
  if not found then raise exception 'Invalid organizer link.' using errcode = 'P0001'; end if;
  case p_action
    when 'rename' then
      if p_payload->>'title' is null or char_length(trim(p_payload->>'title')) not between 1 and 100 or (p_payload->>'title') ~ '[[:cntrl:]]' then raise exception 'Name must be 1–100 characters without control characters.' using errcode = 'P0001'; end if;
      update public.schedule_events set title = trim(p_payload->>'title') where id = p_event_id;
    when 'set_highlight_color' then
      if p_payload->>'highlight_color' is null or (p_payload->>'highlight_color') !~ '^#[0-9A-Fa-f]{6}$' then raise exception 'Invalid highlight color.' using errcode = 'P0001'; end if;
      update public.schedule_events set highlight_color = lower(p_payload->>'highlight_color') where id = p_event_id;
    when 'set_closed' then
      update public.schedule_events set is_closed = (p_payload->>'is_closed')::boolean where id = p_event_id;
    when 'delete_response' then
      delete from public.schedule_responses where id = (p_payload->>'response_id')::uuid and event_id = p_event_id;
    when 'confirm' then
      chosen_date := (p_payload->>'date')::date; chosen_start := (p_payload->>'start_time')::time; chosen_end := (p_payload->>'end_time')::time;
      if not exists (select 1 from jsonb_array_elements_text(found_event.dates) as item(value) where item.value = chosen_date::text) then raise exception 'Choose a date from this schedule.' using errcode = 'P0001'; end if;
      if chosen_start is null or chosen_end is null or chosen_end <= chosen_start or chosen_start < found_event.start_time or chosen_end > found_event.end_time then raise exception 'Choose a time within this schedule.' using errcode = 'P0001'; end if;
      update public.schedule_events set confirmed_date = chosen_date, confirmed_start_time = chosen_start, confirmed_end_time = chosen_end where id = p_event_id;
    when 'clear_confirmation' then
      update public.schedule_events set confirmed_date = null, confirmed_start_time = null, confirmed_end_time = null where id = p_event_id;
    else raise exception 'Unknown organizer action.' using errcode = 'P0001';
  end case;
  return jsonb_build_object('ok',true);
end;
$$;

revoke all on function public.create_schedule_event(text, jsonb, time, time, integer, text, text) from public, authenticated;
revoke all on function public.get_schedule(text) from public, authenticated;
revoke all on function public.authenticate_schedule_response(uuid, text, text) from public, authenticated;
revoke all on function public.save_schedule_response(uuid, text, jsonb, uuid, text) from public, authenticated;
revoke all on function public.manage_schedule_event(uuid, uuid, text, jsonb) from public, authenticated;
grant usage on schema public to anon;
grant execute on function public.create_schedule_event(text, jsonb, time, time, integer, text, text) to anon;
grant execute on function public.get_schedule(text) to anon;
grant execute on function public.authenticate_schedule_response(uuid, text, text) to anon;
grant execute on function public.save_schedule_response(uuid, text, jsonb, uuid, text) to anon;
grant execute on function public.manage_schedule_event(uuid, uuid, text, jsonb) to anon;
notify pgrst, 'reload schema';
commit;
