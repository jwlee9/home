-- Run after schema.sql. Tests create temporary fixtures and roll everything back.
begin;
create function pg_temp.must_reject(statement text) returns void language plpgsql as $$
begin
  begin execute statement; exception when others then return; end;
  raise exception 'Expected rejection: %', statement;
end;
$$;
do $$
declare created jsonb; saved jsonb; result jsonb; event_id uuid; owner_id uuid; edit_id uuid; response_id uuid; i integer;
begin
  assert not has_table_privilege('anon','public.schedule_events','SELECT');
  assert not has_table_privilege('anon','public.schedule_responses','SELECT');
  assert not has_table_privilege('authenticated','public.schedule_events','TRUNCATE');
  assert not has_table_privilege('authenticated','public.schedule_responses','INSERT');
  assert has_function_privilege('anon','public.get_schedule(text)','EXECUTE');
  created := public.create_schedule_event('Security test — rolled back','["2026-09-21","2026-09-22"]','10:00','12:00',30,'Asia/Seoul');
  event_id := (created#>>'{event,id}')::uuid; owner_id := (created->>'owner_token')::uuid;
  assert length(created#>>'{event,slug}') = 32;
  perform pg_temp.must_reject($q$select public.create_schedule_event('bad','["2026-02-30"]','10:00','12:00',30,'Asia/Seoul')$q$);
  perform pg_temp.must_reject($q$select public.create_schedule_event('bad','["2026-09-21","2026-09-21"]','10:00','12:00',30,'Asia/Seoul')$q$);
  perform pg_temp.must_reject($q$select public.create_schedule_event('bad','["<img src=x onerror=alert(1)>"]','10:00','12:00',30,'Asia/Seoul')$q$);
  perform pg_temp.must_reject($q$select public.create_schedule_event('bad','["2026-09-21"]','10:00','10:10',30,'Asia/Seoul')$q$);
  perform pg_temp.must_reject($q$select public.create_schedule_event('bad','["2026-09-21"]','10:00','12:00',30,E'Asia/Seoul\r\nBEGIN:VEVENT')$q$);
  perform pg_temp.must_reject($q$select public.create_schedule_event(null,'["2026-09-21"]','10:00','12:00',30,'Asia/Seoul')$q$);
  saved := public.save_schedule_response(event_id,'Alice','["2026-09-21T10:00","2026-09-21T10:30"]',null,'x');
  edit_id := (saved->>'edit_token')::uuid; response_id := (saved->>'id')::uuid;
  -- One-character passwords remain supported, but are throttled.
  assert (public.authenticate_schedule_response(event_id,'Alice','x')->>'edit_token')::uuid = edit_id;
  result := public.get_schedule(created#>>'{event,slug}');
  assert not ((result->'event') ? 'owner_token');
  assert not ((result#>'{responses,0}') ? 'edit_token');
  assert not ((result#>'{responses,0}') ? 'password_hash');
  assert not ((result#>'{responses,0}') ? 'password_attempts');
  result := public.save_schedule_response(event_id,'Alice','[]',gen_random_uuid(),'wrong');
  assert result ? 'error';
  assert (select jsonb_array_length(availability) = 2 from public.schedule_responses where id = response_id);
  for i in 1..9 loop result := public.authenticate_schedule_response(event_id,'Alice','wrong'); assert result ? 'error'; end loop;
  assert (select password_attempts = 10 from public.schedule_responses where id = response_id);
  result := public.authenticate_schedule_response(event_id,'Alice','x');
  assert result->>'error' like 'Too many%';
  -- Token-authenticated edits work even during password cooldown.
  result := public.save_schedule_response(event_id,'Alice','["2026-09-22T11:00"]',edit_id);
  assert result ? 'edit_token';
  perform pg_temp.must_reject(format('select public.save_schedule_response(%L,''Alice'',''["2026-09-21T09:00"]'',%L)',event_id,edit_id));
  perform pg_temp.must_reject(format('select public.save_schedule_response(%L,''Alice'',''["2026-09-21T10:15"]'',%L)',event_id,edit_id));
  perform pg_temp.must_reject(format('select public.save_schedule_response(%L,''Alice'',''["2026-09-23T10:00"]'',%L)',event_id,edit_id));
  perform pg_temp.must_reject(format('select public.save_schedule_response(%L,''Alice'',''["2026-09-21T10:00","2026-09-21T10:00"]'',%L)',event_id,edit_id));
  saved := public.save_schedule_response(event_id,'Bob','[]');
  perform pg_temp.must_reject(format('select public.save_schedule_response(%L,''Bob'',''[]'')',event_id));
  perform pg_temp.must_reject(format('select public.authenticate_schedule_response(%L,''Bob'',''anything'')',event_id));
  perform pg_temp.must_reject(format('select public.manage_schedule_event(%L,%L,''rename'',''{"title":"Hijacked"}'')',event_id,gen_random_uuid()));
  perform pg_temp.must_reject(format('select public.manage_schedule_event(%L,%L,''confirm'',''{"date":"2026-09-21","start_time":"09:00","end_time":"11:00"}'')',event_id,owner_id));
  perform public.manage_schedule_event(event_id,owner_id,'confirm','{"date":"2026-09-21","start_time":"10:00","end_time":"11:30"}');
  perform public.manage_schedule_event(event_id,owner_id,'set_closed','{"is_closed":true}');
  perform pg_temp.must_reject(format('select public.save_schedule_response(%L,''Alice'',''[]'',%L)',event_id,edit_id));
  perform public.manage_schedule_event(event_id,owner_id,'set_closed','{"is_closed":false}');
  -- No existing data is deleted by this suite. Exercise removal using only fixture IDs.
  perform public.manage_schedule_event(event_id,owner_id,'delete_response',jsonb_build_object('response_id',response_id));
  perform pg_temp.must_reject(format('select public.save_schedule_response(%L,''Alice'',''[]'',%L)',event_id,edit_id));
end;
$$;
rollback;
select 'Security regression checks passed; all test data rolled back.' as result;
