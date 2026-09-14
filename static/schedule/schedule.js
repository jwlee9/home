(() => {
  const config = window.SCHEDULER_CONFIG || {};
  const online = Boolean(config.supabaseUrl && config.supabaseAnonKey);
  const state = {
    lang: localStorage.getItem("scheduler-language") || "en",
    event: null, responses: [], name: "", password: "", ownSlots: new Set(),
    view: "mine", person: null, dragging: false, paintValue: true,
    activePointer: null, ownerToken: null
  };
  const $ = (id) => document.getElementById(id);
  const copy = {
    en: {
      schedule:"Schedule", newEvent:"NEW EVENT", createSchedule:"Create a schedule", eventName:"Name", eventPlaceholder:"String quartet rehearsal", from:"From", to:"To", dateHint:"Choose the first and last day.", start:"Start", end:"End", interval:"Interval", timeZone:"Time zone", copyLink:"Copy link", copyOrganizerLink:"Copy organizer link", new:"New", confirmedTime:"CONFIRMED TIME", googleCalendar:"Google Calendar", downloadCalendar:"Download .ics", organizerControls:"Organizer controls", eventSettings:"Event settings", rename:"Rename", confirmTime:"Confirm a time", date:"Date", confirm:"Confirm", clear:"Clear", participants:"Participants", yourName:"Your name", namePlaceholder:"Enter your name", passwordOptional:"Password (optional)", passwordHint:"Set one if you want to edit from another device.", startMarking:"Start marking times", myAvailability:"My availability", group:"Group", saveTimes:"Save available times", updateTimes:"Update available times", closeResponses:"Close responses", reopenResponses:"Reopen responses", closedNotice:"This schedule is closed to responses.", noParticipants:"No responses yet.", remove:"Remove", dateRange:"Choose a date range.", invalidDate:"The end date must be after the start date.", invalidTime:"End time must be later than start time.", enterEventName:"Enter a schedule name.", enterName:"Enter your name first.", passwordShort:"Use at least 6 characters for a password.", passwordNeeded:"Enter the password for this name.", noRecovery:"This entry has no password and cannot be opened in this browser. Ask the organizer to remove it.", marking:"Marking availability as {name}. Drag to add or remove times.", editing:"Editing saved times for {name}.", starting:"Now marking availability as {name}.", groupHelp:"Darker cells have more people available. Tap or hover to see names.", personAvailability:"{name}'s availability.", noAvailability:"No availability has been saved yet.", people:"{count} people", person:"1 person", noOne:"no one has marked this time", saved:"Saved. You can return here and edit from any device with your password.", savedBrowser:"Saved. You can return here and edit from this browser.", copied:"Participant link copied.", organizerCopied:"Private organizer link copied.", createFailed:"Could not create the schedule.", saveFailed:"Could not save. Check your password or connection.", managed:"Changes saved.", removeConfirm:"Remove {name}'s response?", foundError:"This schedule could not be found.", confirmed:"Confirmed", calendarTitle:"Confirmed time"
    },
    ko: {
      schedule:"일정", newEvent:"새 일정", createSchedule:"일정 만들기", eventName:"일정 이름", eventPlaceholder:"현악 4중주 리허설", from:"시작일", to:"종료일", dateHint:"첫날과 마지막 날을 선택하세요.", start:"시작", end:"종료", interval:"시간 간격", timeZone:"시간대", copyLink:"참여 링크 복사", copyOrganizerLink:"관리자 링크 복사", new:"새 일정", confirmedTime:"확정된 시간", googleCalendar:"Google 캘린더", downloadCalendar:"캘린더 파일 받기", organizerControls:"관리자 설정", eventSettings:"일정 설정", rename:"이름 변경", confirmTime:"시간 확정", date:"날짜", confirm:"확정", clear:"해제", participants:"참여자", yourName:"이름", namePlaceholder:"이름 입력", passwordOptional:"비밀번호 (선택)", passwordHint:"다른 기기에서도 수정하려면 설정하세요.", startMarking:"가능한 시간 표시하기", myAvailability:"내 시간", group:"전체", saveTimes:"가능한 시간 저장", updateTimes:"가능한 시간 수정", closeResponses:"응답 마감", reopenResponses:"응답 다시 받기", closedNotice:"응답이 마감된 일정입니다.", noParticipants:"아직 응답이 없습니다.", remove:"삭제", dateRange:"날짜 범위를 선택하세요.", invalidDate:"종료일은 시작일보다 빠를 수 없습니다.", invalidTime:"종료 시간은 시작 시간보다 늦어야 합니다.", enterEventName:"일정 이름을 입력하세요.", enterName:"이름을 먼저 입력하세요.", passwordShort:"비밀번호는 6자 이상 입력하세요.", passwordNeeded:"이 이름에 설정된 비밀번호를 입력하세요.", noRecovery:"비밀번호가 없는 응답이며 이 브라우저에서는 열 수 없습니다. 관리자에게 삭제를 요청하세요.", marking:"{name} · 드래그하여 시간을 추가하거나 지우세요.", editing:"{name}의 저장된 시간을 수정합니다.", starting:"{name} · 가능한 시간을 표시합니다.", groupHelp:"색이 진할수록 가능한 사람이 많습니다. 칸을 누르거나 마우스를 올리면 이름을 볼 수 있습니다.", personAvailability:"{name}의 가능한 시간입니다.", noAvailability:"아직 저장된 응답이 없습니다.", people:"{count}명", person:"1명", noOne:"가능한 사람이 없습니다", saved:"저장했습니다. 비밀번호로 다른 기기에서도 수정할 수 있습니다.", savedBrowser:"저장했습니다. 이 브라우저에서 다시 수정할 수 있습니다.", copied:"참여 링크를 복사했습니다.", organizerCopied:"비공개 관리자 링크를 복사했습니다.", createFailed:"일정을 만들지 못했습니다.", saveFailed:"저장하지 못했습니다. 비밀번호나 인터넷 연결을 확인하세요.", managed:"변경사항을 저장했습니다.", removeConfirm:"{name}의 응답을 삭제할까요?", foundError:"일정을 찾지 못했습니다.", confirmed:"확정", calendarTitle:"확정된 일정"
    }
  };
  const tr = (key, values = {}) => Object.entries(values).reduce((text, [name, value]) => text.replace(`{${name}}`, value), copy[state.lang][key] || key);
  const locale = () => state.lang === "ko" ? "ko-KR" : "en-US";
  const getParam = (name) => new URLSearchParams(location.search).get(name);
  const pad = (number) => String(number).padStart(2, "0");
  const toMinutes = (time) => { const [hours, minutes] = time.split(":").map(Number); return hours * 60 + minutes; };
  const fromMinutes = (value) => `${pad(Math.floor(value / 60))}:${pad(value % 60)}`;
  const formatClock = (time) => time.slice(0, 5);
  const formatWeekday = (date) => new Intl.DateTimeFormat(locale(), { weekday:"short" }).format(new Date(`${date}T12:00:00`));
  const formatDate = (date) => `${date.replaceAll("-", "/")} (${formatWeekday(date)})`;
  const formatTime = (minute) => new Intl.DateTimeFormat(locale(), { hour:"numeric", minute:"2-digit" }).format(new Date(`2000-01-01T${fromMinutes(minute)}:00`));
  const slotKey = (date, minute) => `${date}T${fromMinutes(minute)}`;
  const publicUrl = (slug) => `${location.origin}${location.pathname}?event=${encodeURIComponent(slug)}`;
  const organizerUrl = () => `${publicUrl(state.event.slug)}#manage=${encodeURIComponent(state.ownerToken)}`;
  const tokenKey = (name = state.name) => `scheduler-edit-${state.event.id}-${name}`;
  const savedEditToken = (name = state.name) => localStorage.getItem(tokenKey(name)) || localStorage.getItem(`moilsigan-edit-${state.event.id}-${name}`);

  function datesInRange(start, end) {
    const dates = [], cursor = new Date(`${start}T12:00:00Z`), final = new Date(`${end}T12:00:00Z`);
    while (cursor <= final) { dates.push(cursor.toISOString().slice(0, 10)); cursor.setUTCDate(cursor.getUTCDate() + 1); }
    return dates;
  }
  function applyLanguage() {
    document.documentElement.lang = state.lang;
    $("language-toggle").textContent = state.lang === "en" ? "한국어" : "EN";
    document.querySelectorAll("[data-i18n]").forEach((node) => { node.textContent = tr(node.dataset.i18n); });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => { node.placeholder = tr(node.dataset.i18nPlaceholder); });
    $("event-title").placeholder = state.lang === "ko" ? "리허설" : "Rehearsal";
    [15, 30, 60].forEach((minutes) => { $(`slot-length`).querySelector(`option[value="${minutes}"]`).textContent = state.lang === "ko" ? `${minutes}분` : `${minutes} min`; });
    $("time-zone").querySelector('option[value="Asia/Seoul"]').textContent = state.lang === "ko" ? "한국 표준시 (KST)" : "Korea Standard Time (KST)";
    if (state.event) renderSchedule(); else updateDateSummary();
  }
  function show(view) { ["create-view", "schedule-view"].forEach((id) => $(id).classList.toggle("is-hidden", id !== view)); }
  function setMessage(id, message = "", error = false) { const node = $(id); node.textContent = message; node.classList.toggle("is-error", error); }
  function updateDateSummary() {
    const start = $("start-date").value, end = $("end-date").value;
    [["start-date-display", start], ["end-date-display", end]].forEach(([id, value]) => { $(id).textContent = value ? value.replaceAll("-", "/") : "YYYY/MM/DD"; $(id).classList.toggle("empty", !value); });
    if (!start || !end) return setMessage("date-summary", tr("dateHint"));
    if (end < start) return setMessage("date-summary", tr("invalidDate"), true);
    const days = datesInRange(start, end).length;
    setMessage("date-summary", days === 1 ? formatDate(start) : `${formatDate(start)} — ${formatDate(end)} · ${days}${state.lang === "ko" ? "일" : " days"}`);
  }
  function eventFromForm() {
    const title = $("event-title").value.trim(), startDate = $("start-date").value, endDate = $("end-date").value;
    const start = $("start-time").value, end = $("end-time").value;
    if (!title) throw new Error(tr("enterEventName"));
    if (!startDate || !endDate) throw new Error(tr("dateRange"));
    if (endDate < startDate) throw new Error(tr("invalidDate"));
    if (toMinutes(end) <= toMinutes(start)) throw new Error(tr("invalidTime"));
    return { title, dates:datesInRange(startDate, endDate), start_time:start, end_time:end, slot_minutes:Number($("slot-length").value), timezone:$("time-zone").value };
  }
  async function api(method, path, body) {
    const response = await fetch(`${config.supabaseUrl}/rest/v1/${path}`, { method, headers:{ apikey:config.supabaseAnonKey, Authorization:`Bearer ${config.supabaseAnonKey}`, "Content-Type":"application/json", Prefer:"return=representation" }, body:body ? JSON.stringify(body) : undefined });
    if (!response.ok) { let message = response.statusText; try { message = (await response.json()).message || message; } catch {} throw new Error(message); }
    return response.json();
  }
  const createOnline = (event) => api("POST", "rpc/create_schedule_event", { p_title:event.title, p_dates:event.dates, p_start_time:event.start_time, p_end_time:event.end_time, p_slot_minutes:event.slot_minutes, p_timezone:event.timezone });
  const loadOnline = (slug) => api("POST", "rpc/get_schedule", { p_slug:slug });
  const authenticateOnline = (name, password) => api("POST", "rpc/authenticate_schedule_response", { p_event_id:state.event.id, p_display_name:name, p_password:password });
  const manageOnline = (action, payload = {}) => api("POST", "rpc/manage_schedule_event", { p_event_id:state.event.id, p_owner_token:state.ownerToken, p_action:action, p_payload:payload });
  async function saveOnline() {
    const result = await api("POST", "rpc/save_schedule_response", { p_event_id:state.event.id, p_display_name:state.name, p_availability:[...state.ownSlots], p_edit_token:savedEditToken() || null, p_password:state.password || null });
    localStorage.setItem(tokenKey(), result.edit_token); return result;
  }
  const responseForName = (name) => state.responses.find((response) => response.display_name === name);
  function timeSlots() { const slots = []; for (let minute = toMinutes(state.event.start_time); minute < toMinutes(state.event.end_time); minute += Number(state.event.slot_minutes)) slots.push(minute); return slots; }
  function currentSlots() { if (state.view === "mine") return state.ownSlots; if (state.view === "person") return new Set(responseForName(state.person)?.availability || []); return new Set(); }

  function renderPeople() {
    const people = $("people-filter"); people.innerHTML = "";
    if (state.view === "mine") return people.classList.add("is-hidden");
    people.classList.remove("is-hidden");
    [{ id:null, label:state.lang === "ko" ? "모두" : "Everyone" }, ...state.responses.map((response) => ({ id:response.display_name, label:response.display_name }))].forEach((choice) => {
      const button = document.createElement("button"), selected = (state.view === "group" && !choice.id) || (state.view === "person" && choice.id === state.person);
      button.type = "button"; button.className = `person-chip${selected ? " active" : ""}`; button.textContent = choice.label;
      button.addEventListener("click", () => { state.view = choice.id ? "person" : "group"; state.person = choice.id; renderSchedule(); }); people.appendChild(button);
    });
  }
  function showSlotDetails(date, minute, names) { const node = $("slot-details"); node.classList.remove("is-hidden"); node.textContent = `${formatDate(date)} · ${formatTime(minute)} — ${names.length ? names.join(", ") : tr("noOne")}`; }
  function renderCalendar() {
    const calendar = $("calendar"), slots = timeSlots(), count = state.responses.length; calendar.innerHTML = ""; calendar.style.setProperty("--days", state.event.dates.length);
    const corner = document.createElement("div"); corner.className = "corner"; calendar.appendChild(corner);
    state.event.dates.forEach((date) => { const header = document.createElement("div"); header.className = "day-label"; header.innerHTML = `<span>${formatWeekday(date)}</span><strong>${date.replaceAll("-", "/<wbr>")}</strong>`; calendar.appendChild(header); });
    const selected = currentSlots();
    slots.forEach((minute, index) => {
      const slotEnd = minute + Number(state.event.slot_minutes), divider = slotEnd % 60 === 0 ? "hour-end" : slotEnd % 30 === 0 ? "half-hour-end" : "minor-end";
      const label = document.createElement("div"); label.className = `time-label ${divider}`; if (index % Math.max(1, 60 / state.event.slot_minutes) === 0) label.textContent = formatTime(minute); calendar.appendChild(label);
      state.event.dates.forEach((date) => {
        const key = slotKey(date, minute), cell = document.createElement("button"); cell.type = "button"; cell.className = `slot ${divider}`; cell.dataset.key = key; cell.setAttribute("aria-label", `${formatDate(date)} ${fromMinutes(minute)}`);
        if (state.view === "mine") { if (selected.has(key)) cell.classList.add("selected"); bindCell(cell); }
        if (state.view === "person") { if (selected.has(key)) cell.classList.add("person"); cell.disabled = true; }
        if (state.view === "group") {
          const names = state.responses.filter((response) => response.availability.includes(key)).map((response) => response.display_name), ratio = count ? names.length / count : 0;
          cell.classList.add("group"); cell.style.backgroundColor = names.length ? `rgba(42, 73, 151, ${0.16 + ratio * 0.7})` : ""; cell.title = names.length ? names.join(", ") : tr("noOne");
          cell.addEventListener("click", () => showSlotDetails(date, minute, names)); cell.addEventListener("pointerenter", (event) => { if (event.pointerType === "mouse") showSlotDetails(date, minute, names); });
        }
        calendar.appendChild(cell);
      });
    });
  }
  function cellAtPointer(event) { return document.elementFromPoint(event.clientX, event.clientY)?.closest?.(".slot[data-key]"); }
  function paintCell(cell) { if (!cell || !state.dragging) return; const key = cell.dataset.key; if (state.paintValue) state.ownSlots.add(key); else state.ownSlots.delete(key); cell.classList.toggle("selected", state.paintValue); $("save-availability").disabled = false; }
  function beginPainting(event, cell) { if (!state.name) { setMessage("identity-status", tr("enterName"), true); return $("participant-name").focus(); } if (state.event.is_closed) return; event.preventDefault(); state.dragging = true; state.activePointer = event.pointerId; state.paintValue = !state.ownSlots.has(cell.dataset.key); paintCell(cell); cell.setPointerCapture?.(event.pointerId); }
  function bindCell(cell) { cell.addEventListener("pointerdown", (event) => beginPainting(event, cell)); }
  function onPointerMove(event) { if (!state.dragging || (state.activePointer !== null && event.pointerId !== state.activePointer)) return; event.preventDefault(); paintCell(cellAtPointer(event)); }
  function endPainting(event) { if (state.activePointer === null || event.pointerId === state.activePointer) { state.dragging = false; state.activePointer = null; } }
  function syncView() {
    const mine = state.view === "mine"; $("mode-mine").classList.toggle("active", mine); $("mode-group").classList.toggle("active", !mine); $("mode-mine").setAttribute("aria-selected", mine); $("mode-group").setAttribute("aria-selected", !mine); $("save-area").classList.toggle("is-hidden", !mine); $("group-summary").classList.toggle("is-hidden", mine); $("slot-details").classList.add("is-hidden");
    if (mine) $("grid-instruction").textContent = state.name ? tr("marking", { name:state.name }) : tr("enterName");
    else if (state.view === "person") $("grid-instruction").textContent = tr("personAvailability", { name:state.person });
    else $("grid-instruction").textContent = state.responses.length ? tr("groupHelp") : tr("noAvailability");
    if (!mine) $("group-summary").textContent = state.responses.length === 1 ? tr("person") : tr("people", { count:state.responses.length });
  }
  function renderConfirmed() {
    const banner = $("confirmed-banner"), event = state.event;
    if (!event.confirmed_date) return banner.classList.add("is-hidden");
    banner.classList.remove("is-hidden"); $("confirmed-text").textContent = `${formatDate(event.confirmed_date)} · ${formatClock(event.confirmed_start_time)}–${formatClock(event.confirmed_end_time)}`;
    const dates = `${event.confirmed_date.replaceAll("-", "")}T${formatClock(event.confirmed_start_time).replace(":", "")}00/${event.confirmed_date.replaceAll("-", "")}T${formatClock(event.confirmed_end_time).replace(":", "")}00`;
    $("google-calendar").href = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${dates}&ctz=${encodeURIComponent(event.timezone)}`;
  }
  function renderOrganizer() {
    const visible = Boolean(state.ownerToken); $("organizer-panel").classList.toggle("is-hidden", !visible); $("copy-organizer-link").classList.toggle("is-hidden", !visible); if (!visible) return;
    $("manage-title").value = state.event.title; $("toggle-closed").textContent = tr(state.event.is_closed ? "reopenResponses" : "closeResponses");
    const dateSelect = $("confirmed-date"), previous = state.event.confirmed_date || dateSelect.value; dateSelect.innerHTML = ""; state.event.dates.forEach((date) => { const option = document.createElement("option"); option.value = date; option.textContent = formatDate(date); dateSelect.appendChild(option); }); dateSelect.value = previous || state.event.dates[0];
    $("confirmed-start").value = formatClock(state.event.confirmed_start_time || state.event.start_time); $("confirmed-end").value = formatClock(state.event.confirmed_end_time || state.event.end_time);
    const people = $("organizer-people"); people.innerHTML = ""; if (!state.responses.length) people.textContent = tr("noParticipants");
    state.responses.forEach((response) => { const row = document.createElement("div"); row.className = "organizer-person"; const name = document.createElement("span"); name.textContent = response.display_name; const remove = document.createElement("button"); remove.type = "button"; remove.className = "button button-danger"; remove.textContent = tr("remove"); remove.addEventListener("click", () => removeParticipant(response)); row.append(name, remove); people.appendChild(row); });
  }
  function renderSchedule() {
    const existing = responseForName(state.name); $("event-name").textContent = state.event.title; $("event-meta").textContent = `${formatDate(state.event.dates[0])}${state.event.dates.length > 1 ? ` — ${formatDate(state.event.dates.at(-1))}` : ""} · ${formatClock(state.event.start_time)}–${formatClock(state.event.end_time)} · ${state.event.timezone}`;
    $("participant-name").value = state.name; $("save-availability").textContent = tr(existing ? "updateTimes" : "saveTimes"); $("closed-notice").classList.toggle("is-hidden", !state.event.is_closed); $("save-name").disabled = state.event.is_closed; $("participant-name").disabled = state.event.is_closed; $("participant-password").disabled = state.event.is_closed;
    syncView(); renderPeople(); renderCalendar(); renderConfirmed(); renderOrganizer(); $("save-availability").disabled = true;
  }
  async function refreshEvent() { const data = await loadOnline(state.event.slug); state.event = data.event; state.responses = data.responses || []; renderSchedule(); }
  async function openEvent(slug) {
    try {
      const data = await loadOnline(slug); state.event = data.event; state.responses = data.responses || [];
      const hashToken = new URLSearchParams(location.hash.slice(1)).get("manage"); state.ownerToken = hashToken || localStorage.getItem(`scheduler-owner-${state.event.id}`); if (state.ownerToken) localStorage.setItem(`scheduler-owner-${state.event.id}`, state.ownerToken);
      state.name = localStorage.getItem(`scheduler-name-${state.event.id}`) || localStorage.getItem(`moilsigan-name-${state.event.id}`) || ""; state.ownSlots = new Set(responseForName(state.name)?.availability || []); state.view = "mine"; show("schedule-view"); renderSchedule();
    } catch { show("create-view"); setMessage("create-error", tr("foundError"), true); }
  }
  async function createEvent() {
    setMessage("create-error"); try { const result = await createOnline(eventFromForm()); state.event = result.event; state.ownerToken = result.owner_token; localStorage.setItem(`scheduler-owner-${state.event.id}`, state.ownerToken); history.replaceState({}, "", organizerUrl()); state.responses = []; state.name = ""; state.ownSlots = new Set(); state.view = "mine"; show("schedule-view"); renderSchedule(); } catch (error) { setMessage("create-error", error.message || tr("createFailed"), true); }
  }
  async function beginName() {
    const name = $("participant-name").value.trim(), password = $("participant-password").value; if (!name) return setMessage("identity-status", tr("enterName"), true);
    const existing = responseForName(name), savedToken = savedEditToken(name);
    try {
      if (existing && !savedToken) { if (!existing.has_password) return setMessage("identity-status", tr("noRecovery"), true); if (!password) return setMessage("identity-status", tr("passwordNeeded"), true); const result = await authenticateOnline(name, password); localStorage.setItem(tokenKey(name), result.edit_token); }
      if (!existing && state.event.is_closed) return setMessage("identity-status", tr("closedNotice"), true);
      state.name = name; state.password = existing ? "" : password; state.ownSlots = new Set(existing?.availability || []); localStorage.setItem(`scheduler-name-${state.event.id}`, name); $("participant-password").value = ""; setMessage("identity-status", tr(existing ? "editing" : "starting", { name })); setMessage("save-status"); renderSchedule();
    } catch (error) { setMessage("identity-status", error.message, true); }
  }
  async function saveAvailability() {
    if (!state.name) return setMessage("identity-status", tr("enterName"), true);
    try { await saveOnline(); const usedPassword = Boolean(state.password); state.password = ""; await refreshEvent(); localStorage.setItem(`scheduler-name-${state.event.id}`, state.name); setMessage("save-status", tr(usedPassword ? "saved" : "savedBrowser")); } catch (error) { setMessage("save-status", error.message || tr("saveFailed"), true); }
  }
  async function manage(action, payload) { try { await manageOnline(action, payload); await refreshEvent(); setMessage("organizer-status", tr("managed")); } catch (error) { setMessage("organizer-status", error.message, true); } }
  async function removeParticipant(response) { if (!confirm(tr("removeConfirm", { name:response.display_name }))) return; await manage("delete_response", { response_id:response.id }); }
  function downloadCalendar() {
    const event = state.event, date = event.confirmed_date.replaceAll("-", ""), start = formatClock(event.confirmed_start_time).replace(":", ""), end = formatClock(event.confirmed_end_time).replace(":", "");
    const escape = (text) => text.replaceAll("\\", "\\\\").replaceAll(",", "\\,").replaceAll(";", "\\;").replaceAll("\n", "\\n");
    const ics = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Jaewon Lee//Scheduler//EN\r\nBEGIN:VEVENT\r\nUID:${event.id}@jwlee9.github.io\r\nDTSTART;TZID=${event.timezone}:${date}T${start}00\r\nDTEND;TZID=${event.timezone}:${date}T${end}00\r\nSUMMARY:${escape(event.title)}\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;
    const url = URL.createObjectURL(new Blob([ics], { type:"text/calendar;charset=utf-8" })), link = document.createElement("a"); link.href = url; link.download = `${event.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "schedule"}.ics`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function resetToCreate() { history.replaceState({}, "", location.pathname); $("create-form").reset(); $("start-time").value = "10:00"; $("end-time").value = "22:00"; updateDateSummary(); setMessage("create-error"); show("create-view"); }
  function setup() {
    applyLanguage(); $("language-toggle").addEventListener("click", () => { state.lang = state.lang === "en" ? "ko" : "en"; localStorage.setItem("scheduler-language", state.lang); applyLanguage(); });
    $("start-date").addEventListener("change", updateDateSummary); $("end-date").addEventListener("change", updateDateSummary); $("create-form").addEventListener("submit", (event) => { event.preventDefault(); createEvent(); }); $("new-schedule").addEventListener("click", resetToCreate); $("save-name").addEventListener("click", beginName); $("participant-name").addEventListener("keydown", (event) => { if (event.key === "Enter") beginName(); }); $("participant-password").addEventListener("keydown", (event) => { if (event.key === "Enter") beginName(); });
    $("mode-mine").addEventListener("click", () => { state.view = "mine"; state.person = null; renderSchedule(); }); $("mode-group").addEventListener("click", () => { state.view = "group"; state.person = null; renderSchedule(); }); $("save-availability").addEventListener("click", saveAvailability); $("copy-link").addEventListener("click", async () => { await navigator.clipboard.writeText(publicUrl(state.event.slug)); setMessage("save-status", tr("copied")); }); $("copy-organizer-link").addEventListener("click", async () => { await navigator.clipboard.writeText(organizerUrl()); setMessage("organizer-status", tr("organizerCopied")); });
    $("rename-event").addEventListener("click", () => manage("rename", { title:$("manage-title").value.trim() })); $("toggle-closed").addEventListener("click", () => manage("set_closed", { is_closed:!state.event.is_closed })); $("confirm-time").addEventListener("click", () => manage("confirm", { date:$("confirmed-date").value, start_time:$("confirmed-start").value, end_time:$("confirmed-end").value })); $("clear-confirmed").addEventListener("click", () => manage("clear_confirmation", {})); $("download-ics").addEventListener("click", downloadCalendar);
    document.addEventListener("pointermove", onPointerMove, { passive:false }); document.addEventListener("pointerup", endPainting); document.addEventListener("pointercancel", endPainting);
    const slug = getParam("event"); if (slug) openEvent(slug); else { updateDateSummary(); show("create-view"); }
  }
  setup();
})();
