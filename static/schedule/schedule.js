(() => {
  const config = window.SCHEDULER_CONFIG || {};
  const online = Boolean(config.supabaseUrl && config.supabaseAnonKey);
  const state = { event:null, responses:[], name:"", ownSlots:new Set(), view:"mine", person:null, dragging:false, paintValue:true, activePointer:null };
  const $ = (id) => document.getElementById(id);
  const dateFormatter = new Intl.DateTimeFormat("en-US", { month:"short", day:"numeric", weekday:"short" });
  const shortDateFormatter = new Intl.DateTimeFormat("en-US", { month:"short", day:"numeric" });
  const getParam = (name) => new URLSearchParams(location.search).get(name);
  const pad = (n) => String(n).padStart(2, "0");
  const toMinutes = (time) => { const [hours, minutes] = time.split(":").map(Number); return hours * 60 + minutes; };
  const fromMinutes = (value) => `${pad(Math.floor(value / 60))}:${pad(value % 60)}`;
  const slotKey = (date, minute) => `${date}T${fromMinutes(minute)}`;
  const publicUrl = (slug) => `${location.origin}${location.pathname}?event=${encodeURIComponent(slug)}`;
  const formatDate = (date) => dateFormatter.format(new Date(`${date}T12:00:00`));
  const formatClock = (time) => time.slice(0, 5);
  const formatTime = (minute) => new Intl.DateTimeFormat("en-US", { hour:"numeric", minute:"2-digit" }).format(new Date(`2000-01-01T${fromMinutes(minute)}:00`));

  function datesInRange(start, end) {
    const dates = [], cursor = new Date(`${start}T12:00:00Z`), final = new Date(`${end}T12:00:00Z`);
    while (cursor <= final) { dates.push(cursor.toISOString().slice(0, 10)); cursor.setUTCDate(cursor.getUTCDate() + 1); }
    return dates;
  }
  function show(view) { ["create-view", "schedule-view"].forEach((id) => $(id).classList.toggle("is-hidden", id !== view)); }
  function setCreateMessage(message = "", error = false) { const node = $("create-error"); node.textContent = message; node.classList.toggle("is-error", error); }
  function updateDateSummary() {
    const start = $("start-date").value, end = $("end-date").value;
    if (!start || !end) { $("date-summary").textContent = "Choose the first and last day."; return; }
    if (end < start) { $("date-summary").textContent = "The end date must be after the start date."; return; }
    const days = datesInRange(start, end).length;
    $("date-summary").textContent = days === 1 ? formatDate(start) : `${formatDate(start)} — ${formatDate(end)} · ${days} days`;
  }
  function eventFromForm() {
    const title = $("event-title").value.trim(), startDate = $("start-date").value, endDate = $("end-date").value;
    const start = $("start-time").value, end = $("end-time").value;
    if (!title) throw new Error("Enter a schedule name.");
    if (!startDate || !endDate) throw new Error("Choose a date range.");
    if (endDate < startDate) throw new Error("The end date must be after the start date.");
    if (toMinutes(end) <= toMinutes(start)) throw new Error("End time must be later than start time.");
    return { title, dates:datesInRange(startDate, endDate), start_time:start, end_time:end, slot_minutes:Number($("slot-length").value), timezone:$("time-zone").value };
  }
  async function api(method, path, body) {
    const response = await fetch(`${config.supabaseUrl}/rest/v1/${path}`, { method, headers:{ apikey:config.supabaseAnonKey, Authorization:`Bearer ${config.supabaseAnonKey}`, "Content-Type":"application/json", Prefer:"return=representation" }, body:body ? JSON.stringify(body) : undefined });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  }
  async function createOnline(event) { return api("POST", "rpc/create_schedule_event", { p_title:event.title, p_dates:event.dates, p_start_time:event.start_time, p_end_time:event.end_time, p_slot_minutes:event.slot_minutes, p_timezone:event.timezone }); }
  async function loadOnline(slug) { const events = await api("GET", `schedule_events?slug=eq.${encodeURIComponent(slug)}&select=*`); if (!events[0]) throw new Error("not found"); const responses = await api("GET", `schedule_responses?event_id=eq.${events[0].id}&select=id,display_name,availability,updated_at&order=updated_at.asc`); return { event:events[0], responses }; }
  async function saveOnline() { const tokenKey = `moilsigan-edit-${state.event.id}-${state.name}`; const result = await api("POST", "rpc/save_schedule_response", { p_event_id:state.event.id, p_display_name:state.name, p_availability:[...state.ownSlots], p_edit_token:localStorage.getItem(tokenKey) || null }); localStorage.setItem(tokenKey, result.edit_token); }
  const demoSlug = () => `demo-${Math.random().toString(36).slice(2, 8)}`;
  function loadDemo(slug) { const raw = localStorage.getItem(`moilsigan-event-${slug}`); if (!raw) throw new Error("not found"); return JSON.parse(raw); }
  function saveDemo() { const raw = localStorage.getItem(`moilsigan-event-${state.event.slug}`); const data = raw ? JSON.parse(raw) : { event:state.event, responses:[] }; const index = data.responses.findIndex((response) => response.display_name === state.name); const response = { id:crypto.randomUUID(), display_name:state.name, availability:[...state.ownSlots], updated_at:new Date().toISOString() }; if (index >= 0) data.responses[index] = response; else data.responses.push(response); localStorage.setItem(`moilsigan-event-${state.event.slug}`, JSON.stringify(data)); state.responses = data.responses; }
  function timeSlots() { const slots = []; for (let minute = toMinutes(state.event.start_time); minute < toMinutes(state.event.end_time); minute += Number(state.event.slot_minutes)) slots.push(minute); return slots; }
  const responseForName = (name) => state.responses.find((response) => response.display_name === name);
  function currentSlots() { if (state.view === "mine") return state.ownSlots; if (state.view === "person") return new Set(responseForName(state.person)?.availability || []); return new Set(); }
  function setSaveStatus(text, error = false) { const node = $("save-status"); node.textContent = text; node.classList.toggle("is-error", error); }
  function setIdentityStatus(text, error = false) { const node = $("identity-status"); node.textContent = text; node.classList.toggle("is-error", error); }
  function showSlotDetails(date, minute, names) {
    const node = $("slot-details");
    node.classList.remove("is-hidden");
    const when = `${formatDate(date)} · ${formatTime(minute)}`;
    node.textContent = names.length ? `${when} — ${names.join(", ")}` : `${when} — no one has marked this time.`;
  }

  function renderPeople() {
    const people = $("people-filter"); people.innerHTML = "";
    if (state.view === "mine") { people.classList.add("is-hidden"); return; }
    people.classList.remove("is-hidden");
    [{ id:null, label:"Everyone" }, ...state.responses.map((response) => ({ id:response.display_name, label:response.display_name }))].forEach((choice) => {
      const button = document.createElement("button"), selected = (state.view === "group" && !choice.id) || (state.view === "person" && choice.id === state.person);
      button.type = "button"; button.className = `person-chip${selected ? " active" : ""}`; button.textContent = choice.label;
      button.addEventListener("click", () => { state.view = choice.id ? "person" : "group"; state.person = choice.id; renderSchedule(); }); people.appendChild(button);
    });
  }
  function renderCalendar() {
    const calendar = $("calendar"), slots = timeSlots(), count = state.responses.length;
    calendar.innerHTML = ""; calendar.style.setProperty("--days", state.event.dates.length);
    const corner = document.createElement("div"); corner.className = "corner"; calendar.appendChild(corner);
    state.event.dates.forEach((date) => { const header = document.createElement("div"), parsed = new Date(`${date}T12:00:00`); header.className = "day-label"; header.innerHTML = `<span>${new Intl.DateTimeFormat("en-US", { weekday:"short" }).format(parsed)}</span><strong><span class="month">${new Intl.DateTimeFormat("en-US", { month:"short" }).format(parsed)} </span>${parsed.getDate()}</strong>`; calendar.appendChild(header); });
    const selected = currentSlots();
    slots.forEach((minute, index) => {
      const label = document.createElement("div"); label.className = "time-label";
      if (index % Math.max(1, 60 / state.event.slot_minutes) === 0) label.textContent = formatTime(minute);
      calendar.appendChild(label);
      state.event.dates.forEach((date) => {
        const key = slotKey(date, minute), cell = document.createElement("button"); cell.type = "button"; cell.className = "slot"; cell.dataset.key = key; cell.setAttribute("aria-label", `${formatDate(date)} ${fromMinutes(minute)}`);
        if (state.view === "mine") { if (selected.has(key)) cell.classList.add("selected"); bindCell(cell); }
        if (state.view === "person") { if (selected.has(key)) cell.classList.add("person"); cell.disabled = true; }
        if (state.view === "group") { const names = state.responses.filter((response) => response.availability.includes(key)).map((response) => response.display_name); const ratio = count ? names.length / count : 0; cell.classList.add("group"); cell.style.backgroundColor = names.length ? `rgba(42, 73, 151, ${0.16 + ratio * 0.7})` : ""; cell.title = names.length ? names.join(", ") : "No one has marked this time"; cell.setAttribute("aria-label", `${formatDate(date)} ${fromMinutes(minute)}: ${names.length ? names.join(", ") : "no one available"}`); cell.addEventListener("click", () => showSlotDetails(date, minute, names)); cell.addEventListener("pointerenter", (event) => { if (event.pointerType === "mouse") showSlotDetails(date, minute, names); }); }
        calendar.appendChild(cell);
      });
    });
  }
  function cellAtPointer(event) { const element = document.elementFromPoint(event.clientX, event.clientY); return element?.closest?.(".slot[data-key]"); }
  function paintCell(cell) { if (!cell || !state.dragging) return; const key = cell.dataset.key; if (!key) return; if (state.paintValue) state.ownSlots.add(key); else state.ownSlots.delete(key); cell.classList.toggle("selected", state.paintValue); $("save-availability").disabled = false; }
  function beginPainting(event, cell) { if (!state.name) { setIdentityStatus("Enter your name and press “Start marking times” first.", true); $("participant-name").focus(); return; } event.preventDefault(); state.dragging = true; state.activePointer = event.pointerId; state.paintValue = !state.ownSlots.has(cell.dataset.key); paintCell(cell); cell.setPointerCapture?.(event.pointerId); }
  function bindCell(cell) { cell.addEventListener("pointerdown", (event) => beginPainting(event, cell)); }
  function onPointerMove(event) { if (!state.dragging || (state.activePointer !== null && event.pointerId !== state.activePointer)) return; event.preventDefault(); paintCell(cellAtPointer(event)); }
  function endPainting(event) { if (state.activePointer === null || event.pointerId === state.activePointer) { state.dragging = false; state.activePointer = null; } }
  function syncView() {
    const mine = state.view === "mine";
    $("mode-mine").classList.toggle("active", mine); $("mode-group").classList.toggle("active", !mine); $("mode-mine").setAttribute("aria-selected", mine); $("mode-group").setAttribute("aria-selected", !mine); $("save-area").classList.toggle("is-hidden", !mine); $("group-summary").classList.toggle("is-hidden", mine); $("slot-details").classList.add("is-hidden");
    if (mine) $("grid-instruction").textContent = state.name ? `Marking availability as ${state.name}. Drag to add or remove times.` : "Enter your name, then drag across the times you are available.";
    else if (state.view === "person") $("grid-instruction").textContent = `${state.person}'s availability.`;
    else $("grid-instruction").textContent = state.responses.length ? "Darker cells have more people available. Choose a name to compare." : "No availability has been saved yet.";
    if (!mine) $("group-summary").textContent = `${state.responses.length} ${state.responses.length === 1 ? "person" : "people"}`;
  }
  function renderSchedule() { const existing = responseForName(state.name); $("event-name").textContent = state.event.title; $("event-meta").textContent = `${formatDate(state.event.dates[0])}${state.event.dates.length > 1 ? ` — ${formatDate(state.event.dates.at(-1))}` : ""} · ${formatClock(state.event.start_time)}–${formatClock(state.event.end_time)} · ${state.event.timezone}`; $("participant-name").value = state.name; $("save-availability").textContent = existing ? "Update available times" : "Save available times"; syncView(); renderPeople(); renderCalendar(); $("save-availability").disabled = true; }
  async function openEvent(slug) { try { const data = online ? await loadOnline(slug) : loadDemo(slug); state.event = data.event; state.responses = data.responses || []; state.name = localStorage.getItem(`moilsigan-name-${state.event.id}`) || ""; state.ownSlots = new Set(responseForName(state.name)?.availability || []); state.view = "mine"; show("schedule-view"); renderSchedule(); } catch { show("create-view"); setCreateMessage("This schedule could not be found.", true); } }
  async function createEvent() { setCreateMessage(); try { const base = eventFromForm(); if (online) state.event = (await createOnline(base)).event; else { state.event = { ...base, id:`demo-${crypto.randomUUID()}`, slug:demoSlug(), created_at:new Date().toISOString() }; localStorage.setItem(`moilsigan-event-${state.event.slug}`, JSON.stringify({ event:state.event, responses:[] })); } history.replaceState({}, "", `${location.pathname}?event=${encodeURIComponent(state.event.slug)}`); state.responses = []; state.name = ""; state.ownSlots = new Set(); state.view = "mine"; show("schedule-view"); renderSchedule(); } catch (error) { setCreateMessage(error.message || "Could not create the schedule.", true); } }
  async function saveAvailability() { if (!state.name) return setIdentityStatus("Enter your name first.", true); try { if (online) await saveOnline(); else saveDemo(); state.responses = online ? (await loadOnline(state.event.slug)).responses : state.responses; localStorage.setItem(`moilsigan-name-${state.event.id}`, state.name); setSaveStatus("Saved. You can return here and edit these times anytime from this browser."); renderSchedule(); } catch { setSaveStatus("Could not save. Check your connection and try again.", true); } }
  function beginName() { const name = $("participant-name").value.trim(); if (!name) { setIdentityStatus("Enter your name first.", true); $("participant-name").focus(); return; } const existing = responseForName(name); const token = localStorage.getItem(`moilsigan-edit-${state.event.id}-${name}`); if (online && existing && !token) { setIdentityStatus("That name is already in use. Choose a different name.", true); return; } state.name = name; state.ownSlots = new Set(existing?.availability || []); localStorage.setItem(`moilsigan-name-${state.event.id}`, name); setIdentityStatus(existing ? `Editing saved times for ${name}.` : `Now marking availability as ${name}.`); setSaveStatus(""); renderSchedule(); }
  function resetToCreate() { history.replaceState({}, "", location.pathname); $("create-form").reset(); $("start-time").value = "10:00"; $("end-time").value = "22:00"; updateDateSummary(); setCreateMessage(); show("create-view"); }
  function setup() {
    $("start-date").addEventListener("change", updateDateSummary); $("end-date").addEventListener("change", updateDateSummary); $("create-form").addEventListener("submit", (event) => { event.preventDefault(); createEvent(); }); $("new-schedule").addEventListener("click", resetToCreate); $("save-name").addEventListener("click", beginName); $("participant-name").addEventListener("keydown", (event) => { if (event.key === "Enter") beginName(); }); $("mode-mine").addEventListener("click", () => { state.view = "mine"; state.person = null; renderSchedule(); }); $("mode-group").addEventListener("click", () => { state.view = "group"; state.person = null; renderSchedule(); }); $("save-availability").addEventListener("click", saveAvailability); $("copy-link").addEventListener("click", async () => { if (!online) return setSaveStatus("Connect Supabase to create a shareable live link.", true); await navigator.clipboard.writeText(publicUrl(state.event.slug)); setSaveStatus("Link copied."); }); document.addEventListener("pointermove", onPointerMove, { passive:false }); document.addEventListener("pointerup", endPainting); document.addEventListener("pointercancel", endPainting); const slug = getParam("event"); if (slug) openEvent(slug); else { updateDateSummary(); show("create-view"); }
  }
  setup();
})();
