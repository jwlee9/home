(() => {
  const config = window.SCHEDULER_CONFIG || {};
  const online = Boolean(config.supabaseUrl && config.supabaseAnonKey);
  // Private browsing/storage restrictions must not break the entire scheduler.
  const memoryStorage = new Map();
  const storage = {
    getItem(key) { if (memoryStorage.has(key)) return memoryStorage.get(key); try { return localStorage.getItem(key); } catch { return null; } },
    setItem(key, value) { memoryStorage.set(key, String(value)); try { localStorage.setItem(key, value); } catch { /* In-memory editing still works this visit. */ } }
  };
  const state = {
    lang: storage.getItem("scheduler-language") === "en" ? "en" : "ko",
    event: null, responses: [], name: "", password: "", ownSlots: new Set(),
    view: "mine", person: null, dragging: false, paintValue: true,
    activePointer: null, ownerToken: null, saving: false, creating: false, identifying: false,
    windowDuration: 0, windowCustom: false, sharedBlocks: [], windowEventId: null,
    viewZone: null, zoneEventId: null, projection: null, projectionKey: null
  };
  const $ = (id) => document.getElementById(id);
  let createZonePicker, viewZonePicker;
  const zones = window.schedulerZones;
  const copy = {
    en: {
      schedule:"Schedule", newEvent:"NEW EVENT", createSchedule:"Create a schedule", eventName:"Name", eventPlaceholder:"String quartet rehearsal", from:"From", to:"To", dateHint:"Choose the first and last day.", updateDates:"Update dates", dateEditHint:"Times on dates you keep remain saved. New dates start empty.", start:"Start", end:"End", interval:"Interval", timeZone:"Time zone", highlightColor:"Highlight", updateColor:"Update color", copyLink:"Copy link", copyOrganizerLink:"Copy organizer link", new:"New", confirmedTime:"CONFIRMED TIME", googleCalendar:"Google Calendar", downloadCalendar:"Download .ics", organizerControls:"Organizer controls", eventSettings:"Event settings", rename:"Rename", confirmTime:"Confirm a time", date:"Date", confirm:"Confirm", clear:"Clear", participants:"Participants", yourName:"Your name", namePlaceholder:"Enter your name", passwordOptional:"Password (optional)", passwordHint:"Set one if you want to edit from another device.", startMarking:"Start marking times", myAvailability:"My availability", group:"Group", saveTimes:"Save available times", updateTimes:"Update available times", closeResponses:"Close responses", reopenResponses:"Reopen responses", closedNotice:"This schedule is closed to responses.", noParticipants:"No responses yet.", remove:"Remove", dateRange:"Choose a date range.", invalidDate:"The end date must be after the start date.", invalidTime:"End time must be later than start time.", enterEventName:"Enter a schedule name.", enterName:"Enter your name first.", passwordShort:"Use at least 6 characters for a password.", passwordNeeded:"Enter the password for this name.", noRecovery:"This entry has no password and cannot be opened in this browser. Ask the organizer to remove it.", marking:"Marking availability as {name}. Drag to add or remove times.", editing:"Editing saved times for {name}.", starting:"Now marking availability as {name}.", groupHelp:"Darker cells have more people available. Tap or hover to see names.", personAvailability:"{name}'s availability.", noAvailability:"No availability has been saved yet.", people:"{count} people", person:"1 person", noOne:"no one has marked this time", saved:"Saved. You can return here and edit from any device with your password.", savedBrowser:"Saved. You can return here and edit from this browser.", copied:"Participant link copied.", organizerCopied:"Private organizer link copied.", createFailed:"Could not create the schedule.", saveFailed:"Could not save. Check your password or connection.", managed:"Changes saved.", removeConfirm:"Remove {name}'s response?", foundError:"This schedule could not be found.", confirmed:"Confirmed", calendarTitle:"Confirmed time"
    },
    ko: {
      schedule:"일정", newEvent:"새 일정", createSchedule:"일정 만들기", eventName:"일정 이름", eventPlaceholder:"현악 4중주 리허설", from:"시작일", to:"종료일", dateHint:"첫날과 마지막 날을 선택하세요.", updateDates:"날짜 변경", dateEditHint:"유지한 날짜의 응답은 그대로 남고, 새 날짜는 비어 있습니다.", start:"시작", end:"종료", interval:"시간 간격", timeZone:"시간대", highlightColor:"강조 색상", updateColor:"색상 변경", copyLink:"참여 링크 복사", copyOrganizerLink:"관리자 링크 복사", new:"새 일정", confirmedTime:"확정된 시간", googleCalendar:"Google 캘린더", downloadCalendar:"캘린더 파일 받기", organizerControls:"관리자 설정", eventSettings:"일정 설정", rename:"이름 변경", confirmTime:"시간 확정", date:"날짜", confirm:"확정", clear:"해제", participants:"참여자", yourName:"이름", namePlaceholder:"이름 입력", passwordOptional:"비밀번호 (선택)", passwordHint:"다른 기기에서도 수정하려면 설정하세요.", startMarking:"가능한 시간 표시하기", myAvailability:"내 시간", group:"전체", saveTimes:"가능한 시간 저장", updateTimes:"가능한 시간 수정", closeResponses:"응답 마감", reopenResponses:"응답 다시 받기", closedNotice:"응답이 마감된 일정입니다.", noParticipants:"아직 응답이 없습니다.", remove:"삭제", dateRange:"날짜 범위를 선택하세요.", invalidDate:"종료일은 시작일보다 빠를 수 없습니다.", invalidTime:"종료 시간은 시작 시간보다 늦어야 합니다.", enterEventName:"일정 이름을 입력하세요.", enterName:"이름을 먼저 입력하세요.", passwordShort:"비밀번호는 6자 이상 입력하세요.", passwordNeeded:"이 이름에 설정된 비밀번호를 입력하세요.", noRecovery:"비밀번호가 없는 응답이며 이 브라우저에서는 열 수 없습니다. 관리자에게 삭제를 요청하세요.", marking:"{name} · 드래그하여 시간을 추가하거나 지우세요.", editing:"{name}의 저장된 시간을 수정합니다.", starting:"{name} · 가능한 시간을 표시합니다.", groupHelp:"색이 진할수록 가능한 사람이 많습니다. 칸을 누르거나 마우스를 올리면 이름을 볼 수 있습니다.", personAvailability:"{name}의 가능한 시간입니다.", noAvailability:"아직 저장된 응답이 없습니다.", people:"{count}명", person:"1명", noOne:"가능한 사람이 없습니다", saved:"저장했습니다. 비밀번호로 다른 기기에서도 수정할 수 있습니다.", savedBrowser:"저장했습니다. 이 브라우저에서 다시 수정할 수 있습니다.", copied:"참여 링크를 복사했습니다.", organizerCopied:"비공개 관리자 링크를 복사했습니다.", createFailed:"일정을 만들지 못했습니다.", saveFailed:"저장하지 못했습니다. 비밀번호나 인터넷 연결을 확인하세요.", managed:"변경사항을 저장했습니다.", removeConfirm:"{name}의 응답을 삭제할까요?", foundError:"일정을 찾지 못했습니다.", confirmed:"확정", calendarTitle:"확정된 일정"
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
  const formatGridTime = (minute) => fromMinutes(minute);
  const validColor = (color) => /^#[0-9a-f]{6}$/i.test(color || "");
  const highlightColor = () => validColor(state.event?.highlight_color) ? state.event.highlight_color : "#2a4997";
  const highlightRgb = () => { const color = highlightColor().slice(1); return [0, 2, 4].map((index) => parseInt(color.slice(index, index + 2), 16)).join(", "); };
  function updateCreateColor() {
    const color = validColor($("highlight-color").value) ? $("highlight-color").value : "#2a4997";
    const button=$("create-schedule"), palette=window.schedulerTheme.palette(color);
    button.style.setProperty("--create-color",color);button.style.setProperty("--create-text",palette.text);
  }

  const slotKey = (date, minute) => `${date}T${fromMinutes(minute)}`;
  const publicUrl = (slug) => `${location.origin}${location.pathname}?event=${encodeURIComponent(slug)}`;
  const organizerUrl = () => `${publicUrl(state.event.slug)}#manage=${encodeURIComponent(state.ownerToken)}`;
  const tokenKey = (name = state.name) => `scheduler-edit-${state.event.id}-${name}`;
  const savedEditToken = (name = state.name) => storage.getItem(tokenKey(name)) || storage.getItem(`moilsigan-edit-${state.event.id}-${name}`);

  function datesInRange(start, end) {
    const dates = [], cursor = new Date(`${start}T12:00:00Z`), final = new Date(`${end}T12:00:00Z`);
    while (cursor <= final && dates.length <= 31) { dates.push(cursor.toISOString().slice(0, 10)); cursor.setUTCDate(cursor.getUTCDate() + 1); }
    return dates;
  }
  function applyLanguage() {
    document.documentElement.lang = state.lang;
    $("language-toggle").textContent = state.lang === "en" ? "한국어" : "EN";
    document.querySelectorAll("[data-i18n]").forEach((node) => { node.textContent = tr(node.dataset.i18n); });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => { node.placeholder = tr(node.dataset.i18nPlaceholder); });
    $("event-title").placeholder = state.lang === "ko" ? "리허설" : "Rehearsal";
    [15, 30, 60].forEach((minutes) => { $(`slot-length`).querySelector(`option[value="${minutes}"]`).textContent = state.lang === "ko" ? `${minutes}분` : `${minutes} min`; });
    createZonePicker?.refresh(); viewZonePicker?.refresh();
    if (state.event) renderSchedule(); else updateDateSummary();
  }
  function show(view) { ["create-view", "schedule-view"].forEach((id) => $(id).classList.toggle("is-hidden", id !== view)); }
  function setMessage(id, message = "", error = false) { const node = $(id); node.textContent = message; node.classList.toggle("is-error", error); if (id === "save-status") $("save-area").classList.remove("is-saved"); }
  function updateDateSummary() {
    const start = $("start-date").value, end = $("end-date").value;
    [["start-date-display", start], ["end-date-display", end]].forEach(([id, value]) => { $(id).textContent = value ? value.replaceAll("-", "/") : "YYYY/MM/DD"; $(id).classList.toggle("empty", !value); });
    if (!start || !end) return setMessage("date-summary", tr("dateHint"));
    if (end < start) return setMessage("date-summary", tr("invalidDate"), true);
    const days = datesInRange(start, end).length;
    if (days > 31) return setMessage("date-summary", state.lang === "ko" ? "최대 31일을 선택하세요." : "Choose at most 31 days.", true);
    setMessage("date-summary", days === 1 ? formatDate(start) : `${formatDate(start)} — ${formatDate(end)} · ${days}${state.lang === "ko" ? "일" : " days"}`);
  }
  function eventFromForm() {
    const title = $("event-title").value.trim(), startDate = $("start-date").value, endDate = $("end-date").value;
    const start = $("start-time").value, end = $("end-time").value;
    if (!title) throw new Error(tr("enterEventName"));
    if (!startDate || !endDate) throw new Error(tr("dateRange"));
    if (endDate < startDate) throw new Error(tr("invalidDate"));
    if (datesInRange(startDate, endDate).length > 31) throw new Error(state.lang === "ko" ? "최대 31일을 선택하세요." : "Choose at most 31 days.");
    if (toMinutes(end) <= toMinutes(start)) throw new Error(tr("invalidTime"));
    if ((toMinutes(end)-toMinutes(start)) % Number($("slot-length").value)) throw new Error(state.lang === "ko" ? "시간 범위가 시간 간격에 맞아야 합니다." : "The time range must contain complete intervals.");
    const event = { title, dates:datesInRange(startDate, endDate), start_time:start, end_time:end, slot_minutes:Number($("slot-length").value), timezone:$("time-zone").value, highlight_color:$("highlight-color").value };
    try { zones.validateEvent(event); } catch { throw new Error(state.lang === "ko" ? "이 범위에 서머타임으로 반복되거나 존재하지 않는 시간이 있습니다. 날짜 또는 시간을 조정하세요." : "This range includes a repeated or missing daylight-saving time. Adjust the dates or hours."); }
    return event;
  }
  async function api(method, path, body) {
    const response = await fetch(`${config.supabaseUrl}/rest/v1/${path}`, { method, headers:{ apikey:config.supabaseAnonKey, Authorization:`Bearer ${config.supabaseAnonKey}`, "Content-Type":"application/json", Prefer:"return=representation" }, body:body ? JSON.stringify(body) : undefined });
    if (!response.ok) { let message = response.statusText; try { message = (await response.json()).message || message; } catch {} throw new Error(message); }
    const data = await response.json();
    if (data?.error) throw new Error(data.error);
    return data;
  }
  const createOnline = (event) => api("POST", "rpc/create_schedule_event", { p_title:event.title, p_dates:event.dates, p_start_time:event.start_time, p_end_time:event.end_time, p_slot_minutes:event.slot_minutes, p_timezone:event.timezone, p_highlight_color:event.highlight_color });
  const loadOnline = async (slug) => window.schedulerValidation.validateSchedule(await api("POST", "rpc/get_schedule", { p_slug:slug }));
  const authenticateOnline = (name, password) => api("POST", "rpc/authenticate_schedule_response", { p_event_id:state.event.id, p_display_name:name, p_password:password });
  const manageOnline = (action, payload = {}) => api("POST", "rpc/manage_schedule_event", { p_event_id:state.event.id, p_owner_token:state.ownerToken, p_action:action, p_payload:payload });
  async function saveOnline() {
    const result = await api("POST", "rpc/save_schedule_response", { p_event_id:state.event.id, p_display_name:state.name, p_availability:[...state.ownSlots], p_edit_token:savedEditToken() || null, p_password:state.password || null });
    storage.setItem(tokenKey(), result.edit_token); return result;
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
  const everyoneAvailable = () => state.lang === "ko" ? "모두 가능" : "Everyone is available";
  function showSlotDetails(date, minute, names, unanimous = false, cell, interaction = "tap") {
    const node = $("slot-details"), rect = cell.getBoundingClientRect();
    node.dataset.interaction = interaction;
    const block = state.view === "group" && state.sharedBlocks.find(range => range.date === date && minute >= range.start && minute < range.end);
    const start = block ? block.start : minute, end = block ? block.end : Math.min(minute + Number(state.event.slot_minutes), toMinutes(state.event.end_time));
    $("slot-details-time").textContent = zones.range(date,start,end,state.event.timezone,state.viewZone);
    let duration = "";
    if (block) {
      const total = end - start, hours = Math.floor(total / 60), minutes = total % 60;
      if (state.lang === "ko") duration = `${hours ? `${hours}시간 ` : ""}${minutes ? `${minutes}분 ` : ""}가능`;
      else duration = minutes ? `${hours ? `${hours}h ` : ""}${minutes} min available` : `${hours} ${hours === 1 ? "hour" : "hours"} available`;
    }
    $("slot-details-names").textContent = `${duration ? `${duration}\n` : ""}${unanimous ? "⭐ " : ""}${names.length ? names.join(", ") : tr("noOne")}`;
    node.classList.remove("is-hidden");
    node.style.left = `${Math.max(16, Math.min(rect.right + 10, innerWidth - node.offsetWidth - 16))}px`;
    node.style.top = `${Math.max(16, Math.min(rect.top, innerHeight - node.offsetHeight - 16))}px`;
  }
  function labelHour(label, minute) {
    const text = document.createElement("span");
    text.textContent = minute % 60 === 0 ? String(Math.floor(minute / 60)).padStart(2, "0") : fromMinutes(minute);
    text.setAttribute("aria-label", fromMinutes(minute)); text.title = fromMinutes(minute);
    label.classList.add("has-time"); label.classList.toggle("partial-hour", minute % 60 !== 0); label.appendChild(text);
  }
  function projectionFor(zone) {
    const key=JSON.stringify([state.event.dates,state.event.start_time,state.event.end_time,state.event.slot_minutes,state.event.timezone,zone]);
    if(state.projectionKey!==key){state.projection=zones.project(state.event,zone);state.projectionKey=key;}
    return state.projection;
  }
  function changeViewZone(zone) {
    try { projectionFor(zone); state.viewZone=zone; setMessage("zone-notice"); renderSchedule(); }
    catch { viewZonePicker.setValue(state.viewZone); setMessage("zone-notice",state.lang==="ko"?"이 일정에는 반복되거나 존재하지 않는 시간이 있어 변환할 수 없습니다.":"This schedule includes ambiguous or missing daylight-saving times and cannot be converted.",true); }
  }
  function renderViewZone() {
    if(state.zoneEventId!==state.event.id){state.zoneEventId=state.event.id;state.viewZone=state.event.timezone;}
    viewZonePicker.setValue(state.viewZone);
    $("view-zone-label").textContent=state.lang==="ko"?"표시 시간대":"Viewing in";
    $("view-my-zone").textContent=state.viewZone===state.event.timezone?(state.lang==="ko"?"내 시간대로 보기":"View in my time zone"):(state.lang==="ko"?"일정 시간대로 보기":"View in event time zone");
    $("view-my-zone").disabled=state.viewZone===state.event.timezone && zones.localZone()===state.event.timezone;
    $("view-my-zone").classList.toggle("is-hidden",$("view-my-zone").disabled);
    // Organizer input remains in the source zone, never silently reinterpreted.
    $("confirmed-date").closest(".organizer-section").querySelector("h2").textContent=tr("confirmTime")+" · "+state.event.timezone;
  }
  function renderCalendar() {
    const calendar=$("calendar"), count=state.responses.length, projection=projectionFor(state.viewZone);
    const {columns,rows}=projection; calendar.replaceChildren(); calendar.style.setProperty("--days",columns.length);
    const years = [...new Set(columns.map(column => column.date.slice(0,4)))];
    $("calendar-years").textContent = years.length === 1 ? years[0] : years[0]+"–"+years.at(-1);
    $("calendar-prev").setAttribute("aria-label",state.lang === "ko" ? "이전 날짜" : "Earlier dates");
    $("calendar-next").setAttribute("aria-label",state.lang === "ko" ? "다음 날짜" : "Later dates");
    const corner=document.createElement("div");corner.className="corner";corner.setAttribute("aria-hidden","true");calendar.append(corner);
    columns.forEach((column,index)=>{
      const {date}=column, header=document.createElement("div"), weekday=document.createElement("span"), strong=document.createElement("strong");
      header.className="day-label"+(index===0?" day-first":"")+(index===columns.length-1?" day-last":"");
      weekday.textContent=formatWeekday(date);strong.textContent=date.slice(5).replace("-","/");header.append(weekday,strong);header.setAttribute("aria-label",formatDate(date));
      if(column.split){const offset=document.createElement("span");offset.className="day-offset";offset.textContent="UTC"+(column.offset>=0?"+":"−")+fromMinutes(Math.abs(column.offset));header.append(offset);}
      calendar.append(header);
    });
    const selected=currentSlots(),step=Number(state.event.slot_minutes);
    rows.forEach((row,rowIndex)=>{
      const blank=row.cells.every(cell=>!cell), height=blank?18:25*(row.end-row.start)/step;
      const label=document.createElement("div");label.className="time-label";label.style.height=height+"px";
      if(blank){label.textContent="⋮";label.setAttribute("aria-label","No scheduled times");}
      else if(rowIndex===0 || row.start%60===0 || (row.start-rows[0].start)%60===0 || rows[rowIndex-1]?.cells.every(cell=>!cell))labelHour(label,row.start);
      calendar.append(label);
      row.cells.forEach((segment,colIndex)=>{
        if(!segment){const empty=document.createElement("div");empty.className="slot-empty";empty.style.height=height+"px";empty.setAttribute("aria-hidden","true");calendar.append(empty);return;}
        const {key,sourceDate:date,sourceMinute:minute}=segment,cell=document.createElement("button");
        const divider=row.end%60===0?"hour-end":row.end%30===0?"half-hour-end":"minor-end";
        cell.type="button";cell.className="slot "+divider;cell.dataset.key=key;cell.dataset.row=rowIndex;cell.dataset.col=colIndex;cell.style.height=height+"px";
        cell.setAttribute("aria-label",formatDate(columns[colIndex].date)+" "+fromMinutes(row.start)+"–"+fromMinutes(row.end)+" "+state.viewZone+(columns[colIndex].split?" UTC"+(columns[colIndex].offset>=0?"+":"−")+fromMinutes(Math.abs(columns[colIndex].offset)):""));
        if(colIndex===0)cell.classList.add("day-first");
        if(state.view==="mine"){if(selected.has(key))cell.classList.add("selected");cell.setAttribute("aria-pressed",selected.has(key));bindCell(cell);}
        else{
          const names=state.view==="person"?(selected.has(key)?[state.person]:[]):state.responses.filter(response=>response.availability.includes(key)).map(response=>response.display_name);
          const unanimous=state.view==="group"&&count>1&&names.length===count;
          cell.classList.add("group");
          if(state.view==="person"){if(selected.has(key))cell.classList.add("person");}
          else {cell.classList.toggle("unanimous",unanimous);cell.style.backgroundColor=names.length?"rgba("+highlightRgb()+", "+(.16+names.length/count*.7)+")":"";}
          if(unanimous)cell.setAttribute("aria-label",cell.getAttribute("aria-label")+" — "+everyoneAvailable());
          cell.addEventListener("click",event=>showSlotDetails(date,minute,names,unanimous,cell,event.pointerType==="mouse"?"hover":event.detail===0?"focus":"tap"));
          cell.addEventListener("focus",()=>{if(cell.matches(":focus-visible"))showSlotDetails(date,minute,names,unanimous,cell,"focus");});
          cell.addEventListener("blur",()=>{if($("slot-details").dataset.interaction==="focus")$("slot-details").classList.add("is-hidden");});
          cell.addEventListener("pointerenter",event=>{if(event.pointerType==="mouse")showSlotDetails(date,minute,names,unanimous,cell,"hover");});
          cell.addEventListener("pointerleave",event=>{if(event.pointerType==="mouse"&&$("slot-details").dataset.interaction==="hover")$("slot-details").classList.add("is-hidden");});
        }
        calendar.append(cell);
      });
    });
    const endLabel=document.createElement("div");endLabel.className="time-label time-end";labelHour(endLabel,projection.end);calendar.append(endLabel);
    columns.forEach((column,index)=>{const foot=document.createElement("div");foot.className="calendar-foot"+(index===0?" day-first":"")+(index===columns.length-1?" day-last":"");calendar.append(foot);});
    requestAnimationFrame(syncCalendarNavigation);
  }
  function syncCalendarNavigation() {
    const wrap = $("calendar-scroll"), max = wrap.scrollWidth - wrap.clientWidth;
    $("calendar-scroll-controls").classList.toggle("is-hidden",max < 2);
    $("calendar-prev").disabled = wrap.scrollLeft < 2;
    $("calendar-next").disabled = wrap.scrollLeft >= max - 2;
  }
  function scrollCalendar(direction) {
    const wrap = $("calendar-scroll"), day = $("calendar").querySelector(".day-label");
    if (!day) return;
    const width = day.getBoundingClientRect().width;
    const rail = $("calendar").querySelector(".corner").getBoundingClientRect().width;
    const step = Math.max(1,Math.floor((wrap.clientWidth-rail)/width)-1)*width;
    wrap.scrollBy({left:direction*step,behavior:"auto"});
  }
  function renderSharedWindows() {
    const visible = state.view === "group";
    $("window-finder").classList.toggle("is-hidden", !visible);
    state.sharedBlocks = [];
    if (!visible) { highlightSharedBlocks(); return; }
    const ko = state.lang === "ko", step = Number(state.event.slot_minutes), max = toMinutes(state.event.end_time) - toMinutes(state.event.start_time);
    if (state.windowEventId !== state.event.id) {
      state.windowEventId = state.event.id; state.windowCustom = false; state.windowDuration = 0;
    }
    $("window-label").textContent = ko ? "필요한 시간" : "Meeting length";
    $("window-custom-text").textContent = ko ? "분" : "Minutes";
    const select = $("window-duration"), custom = $("window-custom"); select.replaceChildren();
    const any = document.createElement("option"); any.value = "0"; any.textContent = ko ? "제한 없음" : "Any length"; select.append(any);
    const presets = [...new Set([step, 30, 60, 90, 120, 180])].filter(value => value > 0 && value <= max && value % step === 0).sort((a,b) => a-b);
    presets.forEach(value => { const option = document.createElement("option"); option.value = value; option.textContent = ko ? `${value}분` : `${value} min`; select.append(option); });
    const option = document.createElement("option"); option.value = "custom"; option.textContent = ko ? "직접 입력" : "Custom…"; select.append(option);
    select.value = state.windowCustom ? "custom" : String(state.windowDuration);
    custom.min = step; custom.step = step; custom.max = Math.floor(max / step) * step;
    if (document.activeElement !== custom) custom.value = Number.isFinite(state.windowDuration) && state.windowDuration > 0 ? state.windowDuration : "";
    $("window-custom-label").classList.toggle("is-hidden", !state.windowCustom);
    const anyLength = !state.windowCustom && state.windowDuration === 0;
    const valid = Number.isInteger(state.windowDuration) && state.windowDuration >= step && state.windowDuration <= max && state.windowDuration % step === 0;
    if (!anyLength && valid) state.sharedBlocks = window.findSharedWindows(state.event, state.responses, state.windowDuration);
    let message = "";
    if (!anyLength) {
      if (max < step) message = ko ? `이 일정의 시간 범위가 ${step}분보다 짧습니다.` : `This schedule is shorter than one ${step}-minute slot.`;
      else if (!valid) message = ko ? `${step}분 단위로 ${step}–${Math.floor(max / step) * step}분을 입력하세요.` : `Use ${step}-minute steps, from ${step} to ${Math.floor(max / step) * step} min.`;
      else if (!state.responses.length) message = ko ? "아직 저장된 응답이 없습니다." : "No saved responses yet.";
      else if (!state.sharedBlocks.length) message = ko ? `모두 가능한 연속 ${state.windowDuration}분이 없습니다.` : `No shared ${state.windowDuration}-minute block.`;
    }
    setMessage("window-message", message, !anyLength && !valid);
    custom.setAttribute("aria-invalid", state.windowCustom && !valid);
    highlightSharedBlocks();
  }
  function highlightSharedBlocks() {
    const cells=[...$("calendar").querySelectorAll(".slot")],positions=new Map(cells.map(cell=>[cell.dataset.col+"/"+cell.dataset.row,cell]));
    cells.forEach(cell=>{
      const [date,time]=cell.dataset.key.split("T"),minute=toMinutes(time);
      const block=state.sharedBlocks.find(range=>range.date===date&&minute>=range.start&&minute<range.end);
      cell.classList.toggle("window-hit",Boolean(block));cell.dataset.windowBlock=block?block.date+"/"+block.start:"";
    });
    cells.forEach(cell=>{
      const block=cell.dataset.windowBlock,row=Number(cell.dataset.row),col=cell.dataset.col;
      cell.classList.toggle("window-start",Boolean(block&&positions.get(col+"/"+(row-1))?.dataset.windowBlock!==block));
      cell.classList.toggle("window-end",Boolean(block&&positions.get(col+"/"+(row+1))?.dataset.windowBlock!==block));
    });
    $("slot-details").classList.add("is-hidden");
  }
  function hasChanges() {
    if (!state.event || !state.name) return false;
    const existing = responseForName(state.name), saved = new Set(existing?.availability || []);
    return !existing || saved.size !== state.ownSlots.size || [...state.ownSlots].some((key) => !saved.has(key));
  }
  function syncSave() {
    const dirty = hasChanges(), button = $("save-availability");
    button.disabled = !dirty || state.saving || state.event.is_closed;
    button.textContent = state.saving ? (state.lang === "ko" ? "저장 중…" : "Saving…") : tr(responseForName(state.name) ? "updateTimes" : "saveTimes");
    button.setAttribute("aria-busy", state.saving);
    $("save-area").classList.toggle("has-changes", dirty);
    if (dirty) { $("save-area").classList.remove("is-saved"); setMessage("save-status", state.lang === "ko" ? "저장하지 않은 변경사항" : "Unsaved changes"); }
  }
  function cellAtPointer(event) { return document.elementFromPoint(event.clientX, event.clientY)?.closest?.(".slot[data-key]"); }
  function paintCell(cell) { if (!cell || !state.dragging || state.saving) return; const key = cell.dataset.key; if (state.paintValue) state.ownSlots.add(key); else state.ownSlots.delete(key); $("calendar").querySelectorAll('.slot[data-key="'+key+'"]').forEach(piece=>{piece.classList.toggle("selected", state.paintValue); piece.setAttribute("aria-pressed", state.paintValue);}); setMessage("save-status"); syncSave(); }
  function beginPainting(event, cell) { if (!state.name) { setMessage("identity-status", tr("enterName"), true); return $("participant-name").focus(); } if (state.event.is_closed || state.saving || event.button > 0) return; event.preventDefault(); state.dragging = true; state.activePointer = event.type === "pointerdown" ? event.pointerId : null; state.paintValue = !state.ownSlots.has(cell.dataset.key); paintCell(cell); if (event.type === "pointerdown") cell.setPointerCapture?.(event.pointerId); }
  function bindCell(cell) { cell.addEventListener("pointerdown", (event) => beginPainting(event, cell)); cell.addEventListener("click", (event) => { if (event.detail === 0) { beginPainting(event, cell); state.dragging = false; state.activePointer = null; } }); }
  function onPointerMove(event) { if (!state.dragging || (state.activePointer !== null && event.pointerId !== state.activePointer)) return; event.preventDefault(); paintCell(cellAtPointer(event)); }
  function endPainting(event) { if (state.activePointer === null || event.pointerId === state.activePointer) { state.dragging = false; state.activePointer = null; } }
  function syncModeIndicator() {
    const button = $(state.view === "mine" ? "mode-mine" : "mode-group"), tabs = button.parentElement;
    if (!button.offsetWidth) return;
    tabs.style.setProperty("--tab-left", `${button.offsetLeft}px`);
    tabs.style.setProperty("--tab-width", `${button.offsetWidth}px`);
  }
  function syncView() {
    const mine = state.view === "mine"; $("mode-mine").classList.toggle("active", mine); $("mode-group").classList.toggle("active", !mine); $("mode-mine").setAttribute("aria-selected", mine); $("mode-group").setAttribute("aria-selected", !mine); $("save-area").classList.toggle("is-hidden", !mine); $("group-summary").classList.toggle("is-hidden", mine); $("slot-details").classList.add("is-hidden");
    syncModeIndicator();
    $("grid-instruction").classList.toggle("is-hidden",!mine && state.responses.length>0);
    $("availability-options").classList.toggle("is-hidden",mine);
    if (mine) $("grid-instruction").textContent = state.name ? tr("marking", { name:state.name }) : tr("enterName");
    else if (state.view === "person") $("grid-instruction").textContent = tr("personAvailability", { name:state.person });
    else $("grid-instruction").textContent = state.responses.length ? (state.lang === "ko" ? "칸을 누르거나 마우스를 올리면 가능한 사람을 볼 수 있습니다." : "Tap or hover over a time to see who is available.") : tr("noAvailability");
    if (!mine) $("group-summary").textContent = state.responses.length === 1 ? tr("person") : tr("people", { count:state.responses.length });
  }
  function renderConfirmed() {
    const banner = $("confirmed-banner"), event = state.event;
    if (!event.confirmed_date) return banner.classList.add("is-hidden");
    banner.classList.remove("is-hidden"); $("confirmed-text").textContent = zones.range(event.confirmed_date,toMinutes(event.confirmed_start_time),toMinutes(event.confirmed_end_time),event.timezone,state.viewZone);
    const dates = `${event.confirmed_date.replaceAll("-", "")}T${formatClock(event.confirmed_start_time).replace(":", "")}00/${event.confirmed_date.replaceAll("-", "")}T${formatClock(event.confirmed_end_time).replace(":", "")}00`;
    $("google-calendar").href = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${dates}&ctz=${encodeURIComponent(event.timezone)}`;
  }
  function renderOrganizer() {
    const visible = Boolean(state.ownerToken); $("organizer-panel").classList.toggle("is-hidden", !visible); $("copy-organizer-link").classList.toggle("is-hidden", !visible); if (!visible) return;
    $("manage-title").value = state.event.title; $("manage-highlight-color").value = highlightColor(); $("toggle-closed").textContent = tr(state.event.is_closed ? "reopenResponses" : "closeResponses");
    $("manage-start-date").value = state.event.dates[0]; $("manage-end-date").value = state.event.dates.at(-1);
    previewOrganizerColor();
    const dateSelect = $("confirmed-date"), previous = state.event.confirmed_date || dateSelect.value; dateSelect.innerHTML = ""; state.event.dates.forEach((date) => { const option = document.createElement("option"); option.value = date; option.textContent = formatDate(date); dateSelect.appendChild(option); }); dateSelect.value = previous || state.event.dates[0];
    $("confirmed-start").value = formatClock(state.event.confirmed_start_time || state.event.start_time); $("confirmed-end").value = formatClock(state.event.confirmed_end_time || state.event.end_time);
    const people = $("organizer-people"); people.innerHTML = ""; if (!state.responses.length) people.textContent = tr("noParticipants");
    state.responses.forEach((response) => { const row = document.createElement("div"); row.className = "organizer-person"; const name = document.createElement("span"); name.textContent = response.display_name; const remove = document.createElement("button"); remove.type = "button"; remove.className = "button button-danger"; remove.textContent = tr("remove"); remove.addEventListener("click", () => removeParticipant(response)); row.append(name, remove); people.appendChild(row); });
  }
  function renderSchedule() {
    document.documentElement.style.setProperty("--highlight", highlightColor());
    const palette=window.schedulerTheme.palette(highlightColor());
    document.documentElement.style.setProperty("--highlight-text",palette.text);
    document.documentElement.style.setProperty("--window-outline",palette.outline);
    renderViewZone();
    const existing = responseForName(state.name); $("event-name").textContent = state.event.title; $("event-meta").textContent = `${formatDate(state.event.dates[0])}${state.event.dates.length > 1 ? ` — ${formatDate(state.event.dates.at(-1))}` : ""} · ${formatClock(state.event.start_time)}–${formatClock(state.event.end_time)} · ${state.event.timezone}`;
    $("participant-name").value = state.name; $("save-availability").textContent = tr(existing ? "updateTimes" : "saveTimes"); $("closed-notice").classList.toggle("is-hidden", !state.event.is_closed); $("save-name").disabled = state.event.is_closed; $("participant-name").disabled = state.event.is_closed; $("participant-password").disabled = state.event.is_closed;
    syncView(); renderPeople(); renderCalendar(); renderSharedWindows(); renderConfirmed(); renderOrganizer(); syncSave();
  }
  async function refreshEvent() { const data = await loadOnline(state.event.slug); state.event = data.event; state.responses = data.responses || []; renderSchedule(); }
  async function openEvent(slug) {
    try {
      const data = await loadOnline(slug); state.event = data.event; state.responses = data.responses || [];
      const hashToken = new URLSearchParams(location.hash.slice(1)).get("manage"); state.ownerToken = hashToken || storage.getItem(`scheduler-owner-${state.event.id}`); if (state.ownerToken) storage.setItem(`scheduler-owner-${state.event.id}`, state.ownerToken);
      state.name = storage.getItem(`scheduler-name-${state.event.id}`) || storage.getItem(`moilsigan-name-${state.event.id}`) || ""; state.ownSlots = new Set(responseForName(state.name)?.availability || []); state.view = "mine"; show("schedule-view"); renderSchedule();
    } catch { show("create-view"); setMessage("create-error", tr("foundError"), true); }
  }
  async function createEvent() {
    if (state.creating) return;
    const button = $("create-schedule"); state.creating = true; button.disabled = true; button.setAttribute("aria-busy", "true"); button.textContent = state.lang === "ko" ? "만드는 중…" : "Creating…";
    setMessage("create-error"); try { const result = await createOnline(eventFromForm()); state.event = result.event; state.ownerToken = result.owner_token; storage.setItem(`scheduler-owner-${state.event.id}`, state.ownerToken); history.replaceState({}, "", organizerUrl()); state.responses = []; state.name = ""; state.password = ""; state.ownSlots = new Set(); state.view = "mine"; show("schedule-view"); renderSchedule(); } catch (error) { setMessage("create-error", error.message || tr("createFailed"), true); }
    finally { state.creating = false; button.disabled = false; button.setAttribute("aria-busy", "false"); button.textContent = tr("createSchedule"); }
  }
  async function beginName() {
    if (state.saving || state.identifying) return;
    const name = $("participant-name").value.trim(), password = $("participant-password").value; if (!name) return setMessage("identity-status", tr("enterName"), true);
    if (name === state.name && hasChanges() && !password) { state.view = "mine"; renderSchedule(); return; }
    if (name !== state.name && !confirmDiscard()) return;
    if (new TextEncoder().encode(password).length > 72) return setMessage("identity-status", state.lang === "ko" ? "비밀번호는 UTF-8 기준 72바이트 이하여야 합니다." : "Password must be at most 72 UTF-8 bytes.", true);
    const existing = responseForName(name), savedToken = savedEditToken(name);
    const draft = name === state.name && hasChanges() ? new Set(state.ownSlots) : null;
    state.identifying = true; $("save-name").disabled = true;
    try {
      if (existing && (!savedToken || password)) { if (!existing.has_password) return setMessage("identity-status", tr("noRecovery"), true); if (!password) return setMessage("identity-status", tr("passwordNeeded"), true); const result = await authenticateOnline(name, password); storage.setItem(tokenKey(name), result.edit_token); existing.availability = result.availability; }
      if (!existing && state.event.is_closed) return setMessage("identity-status", tr("closedNotice"), true);
      state.name = name; state.password = existing ? "" : password; state.ownSlots = draft || new Set(existing?.availability || []); state.view = "mine"; state.person = null; storage.setItem(`scheduler-name-${state.event.id}`, name); $("participant-password").value = ""; setMessage("identity-status", tr(existing ? "editing" : "starting", { name })); setMessage("save-status"); renderSchedule();
    } catch (error) { setMessage("identity-status", error.message, true); }
    finally { state.identifying = false; $("save-name").disabled = state.event.is_closed; }
  }
  async function saveAvailability() {
    if (state.saving) return;
    if (!state.name) return setMessage("identity-status", tr("enterName"), true);
    state.saving = true; syncSave();
    try { await saveOnline(); state.password = ""; await refreshEvent(); storage.setItem(`scheduler-name-${state.event.id}`, state.name); state.saving = false; syncSave(); setMessage("save-status", state.lang === "ko" ? "저장됨" : "Saved"); $("save-area").classList.add("is-saved"); }
    catch (error) { state.saving = false; syncSave(); setMessage("save-status", error.message || tr("saveFailed"), true); }
  }
  function previewOrganizerColor() {
    const color = $("manage-highlight-color").value;
    if (!validColor(color)) return;
    const button = $("update-highlight-color");
    button.style.setProperty("--pending-color", color);
    button.style.setProperty("--pending-text", window.schedulerTheme.palette(color).text);
  }
  async function updateEventDates() {
    if (state.managing) return;
    const start = $("manage-start-date").value, end = $("manage-end-date").value;
    if (!window.schedulerValidation.validDate(start) || !window.schedulerValidation.validDate(end)) return setMessage("organizer-status", tr("dateRange"), true);
    if (end < start) return setMessage("organizer-status", tr("invalidDate"), true);
    const dates = datesInRange(start, end);
    if (dates.length > 31) return setMessage("organizer-status", state.lang === "ko" ? "최대 31일을 선택하세요." : "Choose at most 31 days.", true);
    try { zones.validateEvent({...state.event, dates}); }
    catch { return setMessage("organizer-status", state.lang === "ko" ? "이 날짜 범위에는 변환할 수 없는 서머타임 시간이 있습니다." : "This date range includes a daylight-saving time that cannot be converted.", true); }
    if (dates.join() === state.event.dates.join()) return setMessage("organizer-status", state.lang === "ko" ? "날짜가 변경되지 않았습니다." : "The dates have not changed.");
    const removed = state.event.dates.filter(date => !dates.includes(date));
    if (removed.length) {
      const warning = state.lang === "ko"
        ? `제외되는 ${removed.length}일의 응답은 삭제됩니다. 나머지 날짜의 응답은 유지합니다. 계속할까요?`
        : `Availability on ${removed.length} removed ${removed.length === 1 ? "date" : "dates"} will be deleted. Other dates stay intact. Continue?`;
      if (!confirm(warning)) return;
    }
    if (hasChanges() && !confirmDiscard()) return;
    const saved = await manage("set_dates", {dates});
    if (!saved) return;
    state.ownSlots = new Set(responseForName(state.name)?.availability || []);
    renderSchedule();
  }
  async function manage(action, payload) {
    if (state.managing) return;
    state.managing = true;
    const button = action === "set_highlight_color" ? $("update-highlight-color") : action === "set_dates" ? $("update-event-dates") : null;
    if (button) { button.disabled = true; button.setAttribute("aria-busy", "true"); button.textContent = state.lang === "ko" ? "저장 중…" : "Saving…"; }
    setMessage("organizer-status");
    try {
      await manageOnline(action, payload);
      await refreshEvent();
      if (action === "set_highlight_color" && highlightColor().toLowerCase() !== payload.highlight_color.toLowerCase()) throw new Error(state.lang === "ko" ? "색상이 저장되지 않았습니다. 다시 시도하세요." : "The color was not saved. Please try again.");
      setMessage("organizer-status", tr("managed"));
      return true;
    } catch (error) { setMessage("organizer-status", error.message, true); return false; }
    finally { state.managing = false; if (button) { button.disabled = false; button.removeAttribute("aria-busy"); button.textContent = tr(action === "set_dates" ? "updateDates" : "updateColor"); } }
  }
  async function removeParticipant(response) { if (!confirm(tr("removeConfirm", { name:response.display_name }))) return; await manage("delete_response", { response_id:response.id }); }
  function downloadCalendar() {
    const event = state.event, date = event.confirmed_date.replaceAll("-", ""), start = formatClock(event.confirmed_start_time).replace(":", ""), end = formatClock(event.confirmed_end_time).replace(":", "");
    const escape = (text) => text.replaceAll("\\", "\\\\").replaceAll(",", "\\,").replaceAll(";", "\\;").replace(/\r\n|\r|\n/g, "\\n");
    const ics = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Jaewon Lee//Scheduler//EN\r\nBEGIN:VEVENT\r\nUID:${event.id}@jwlee9.github.io\r\nDTSTART;TZID=${event.timezone}:${date}T${start}00\r\nDTEND;TZID=${event.timezone}:${date}T${end}00\r\nSUMMARY:${escape(event.title)}\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;
    const url = URL.createObjectURL(new Blob([ics], { type:"text/calendar;charset=utf-8" })), link = document.createElement("a"); link.href = url; link.download = `${event.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "schedule"}.ics`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function confirmDiscard() { return !hasChanges() || confirm(state.lang === "ko" ? "저장하지 않은 변경사항을 버릴까요?" : "Discard unsaved changes?"); }
  function resetToCreate() { if (state.saving || state.identifying || !confirmDiscard()) return; state.event = null; history.replaceState({}, "", location.pathname); $("create-form").reset(); createZonePicker.setValue(zones.localZone()); $("start-time").value = "10:00"; $("end-time").value = "22:00"; updateCreateColor(); updateDateSummary(); setMessage("create-error"); show("create-view"); }
  function setup() {
    $("calendar-prev").addEventListener("click",()=>scrollCalendar(-1));
    $("calendar-next").addEventListener("click",()=>scrollCalendar(1));
    $("calendar-scroll").addEventListener("scroll",()=>{syncCalendarNavigation();$("slot-details").classList.add("is-hidden");},{passive:true});
    if (typeof ResizeObserver !== "undefined") new ResizeObserver(syncCalendarNavigation).observe($("calendar-scroll"));
    else window.addEventListener("resize",syncCalendarNavigation);
    document.addEventListener("keydown", () => { document.documentElement.dataset.input = "keyboard"; }, true);
    document.addEventListener("pointerdown", () => { document.documentElement.dataset.input = "pointer"; }, true);
    $("manage-highlight-color").addEventListener("input", previewOrganizerColor);
    $("manage-highlight-color").addEventListener("change", previewOrganizerColor);
    $("update-event-dates").addEventListener("click", updateEventDates);
    createZonePicker=window.createZonePicker($("time-zone-picker"));
    createZonePicker.setValue(zones.localZone());
    viewZonePicker=window.createZonePicker($("view-zone-picker"),changeViewZone);
    $("view-my-zone").addEventListener("click",()=>{changeViewZone(state.viewZone===state.event.timezone?zones.localZone():state.event.timezone);viewZonePicker.close();$("view-zone-trigger").focus();});
    $("window-duration").addEventListener("change", () => {
      state.windowCustom = $("window-duration").value === "custom";
      if (!state.windowCustom) state.windowDuration = Number($("window-duration").value);
      else if (!state.windowDuration) state.windowDuration = Number(state.event.slot_minutes);
      renderSharedWindows();
      if (state.windowCustom) $("window-custom").focus();
    });
    $("window-custom").addEventListener("input", () => { state.windowDuration = $("window-custom").valueAsNumber; renderSharedWindows(); });
    if (typeof ResizeObserver !== "undefined") {
      const tabResize = new ResizeObserver(syncModeIndicator);
      ["mode-mine", "mode-group"].forEach(id => tabResize.observe($(id)));
    } else window.addEventListener("resize", syncModeIndicator);
    applyLanguage(); updateCreateColor(); $("language-toggle").addEventListener("click", () => { state.lang = state.lang === "en" ? "ko" : "en"; storage.setItem("scheduler-language", state.lang); applyLanguage(); });
    $("highlight-color").addEventListener("input", updateCreateColor);
    $("highlight-color").addEventListener("change", updateCreateColor);
    $("slot-details-close").addEventListener("click", () => $("slot-details").classList.add("is-hidden"));
    document.addEventListener("pointerdown",event=>{if(!event.target.closest('.slot,#slot-details'))$("slot-details").classList.add("is-hidden");});
    document.addEventListener("keydown", (event) => { if (event.key === "Escape") $("slot-details").classList.add("is-hidden"); });
    window.addEventListener("scroll", () => $("slot-details").classList.add("is-hidden"), { passive:true });
    window.addEventListener("resize", () => $("slot-details").classList.add("is-hidden"));
    window.addEventListener("beforeunload", (event) => { if (hasChanges()) { event.preventDefault(); event.returnValue = ""; } });
    $("start-date").addEventListener("change", updateDateSummary); $("end-date").addEventListener("change", updateDateSummary); $("create-form").addEventListener("submit", (event) => { event.preventDefault(); createEvent(); }); $("new-schedule").addEventListener("click", resetToCreate); $("save-name").addEventListener("click", beginName); $("participant-name").addEventListener("keydown", (event) => { if (event.key === "Enter") beginName(); }); $("participant-password").addEventListener("keydown", (event) => { if (event.key === "Enter") beginName(); });
    $("mode-mine").addEventListener("click", () => { state.view = "mine"; state.person = null; renderSchedule(); }); $("mode-group").addEventListener("click", () => { state.view = "group"; state.person = null; renderSchedule(); }); $("save-availability").addEventListener("click", saveAvailability); $("copy-link").addEventListener("click", async () => { await navigator.clipboard.writeText(publicUrl(state.event.slug)); setMessage("save-status", tr("copied")); }); $("copy-organizer-link").addEventListener("click", async () => { await navigator.clipboard.writeText(organizerUrl()); setMessage("organizer-status", tr("organizerCopied")); });
    $("rename-event").addEventListener("click", () => manage("rename", { title:$("manage-title").value.trim() })); $("update-highlight-color").addEventListener("click", () => manage("set_highlight_color", { highlight_color:$("manage-highlight-color").value })); $("toggle-closed").addEventListener("click", () => manage("set_closed", { is_closed:!state.event.is_closed })); $("confirm-time").addEventListener("click", () => manage("confirm", { date:$("confirmed-date").value, start_time:$("confirmed-start").value, end_time:$("confirmed-end").value })); $("clear-confirmed").addEventListener("click", () => manage("clear_confirmation", {})); $("download-ics").addEventListener("click", downloadCalendar);
    document.addEventListener("pointermove", onPointerMove, { passive:false }); document.addEventListener("pointerup", endPainting); document.addEventListener("pointercancel", endPainting);
    const slug = getParam("event"); if (slug) openEvent(slug); else { updateDateSummary(); show("create-view"); }
  }
  setup();
})();
