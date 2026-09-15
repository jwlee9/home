// Shared, browser-independent range picker. Hidden inputs retain ISO dates for the API.
(() => {
  const $ = id => document.getElementById(id);
  const picker = $('date-picker');
  const today = new Date(); today.setHours(12, 0, 0, 0);
  const iso = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const parse = value => new Date(`${value}T12:00:00`);
  const korean = () => document.documentElement.lang === 'ko';
  let active = 'start', month = new Date(today.getFullYear(), today.getMonth(), 1, 12), focused = iso(today);

  function close(returnFocus = true) {
    picker.classList.add('is-hidden');
    ['start', 'end'].forEach(side => $(`${side}-date-button`).setAttribute('aria-expanded', 'false'));
    if (returnFocus) $(`${active}-date-button`).focus();
  }
  function focusDay() { picker.querySelector(`[data-date="${focused}"]`)?.focus(); }
  function render() {
    const ko = korean(), locale = ko ? 'ko-KR' : 'en-US';
    picker.setAttribute('aria-label', ko ? '날짜 선택' : 'Choose dates');
    $('date-picker-prompt').textContent = active === 'start' ? (ko ? '시작일 선택' : 'Choose the first day') : (ko ? '종료일 선택' : 'Choose the last day');
    $('date-picker-close').setAttribute('aria-label', ko ? '닫기' : 'Close');
    $('date-picker-prev').setAttribute('aria-label', ko ? '이전 달' : 'Previous month');
    $('date-picker-next').setAttribute('aria-label', ko ? '다음 달' : 'Next month');
    $('date-picker-month').textContent = new Intl.DateTimeFormat(locale, {year:'numeric', month:'long'}).format(month);
    $('date-picker-weekdays').replaceChildren();
    (ko ? ['일','월','화','수','목','금','토'] : ['S','M','T','W','T','F','S']).forEach(label => {
      const span = document.createElement('span'); span.textContent = label; $('date-picker-weekdays').append(span);
    });
    const days = $('date-picker-days'), start = $('start-date').value, end = $('end-date').value;
    days.replaceChildren();
    const last = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    for (let i = 0; i < month.getDay(); i++) { const blank = document.createElement('span'); blank.setAttribute('aria-hidden', 'true'); days.append(blank); }
    for (let day = 1; day <= last; day++) {
      const date = new Date(month.getFullYear(), month.getMonth(), day, 12), value = iso(date), button = document.createElement('button');
      button.type = 'button'; button.textContent = day; button.dataset.date = value; button.tabIndex = value === focused ? 0 : -1;
      button.setAttribute('aria-label', new Intl.DateTimeFormat(locale, {dateStyle:'full'}).format(date));
      button.setAttribute('aria-pressed', value === start || value === end);
      button.classList.toggle('range-day', Boolean(start && end && value > start && value < end));
      if (value === iso(today)) button.setAttribute('aria-current', 'date');
      button.disabled = active === 'end' && Boolean(start) && value < start;
      button.addEventListener('click', () => select(value));
      button.addEventListener('keydown', event => {
        const offset = {ArrowLeft:-1, ArrowRight:1, ArrowUp:-7, ArrowDown:7, Home:-date.getDay(), End:6-date.getDay()}[event.key];
        if (offset === undefined && event.key !== 'PageUp' && event.key !== 'PageDown') return;
        event.preventDefault();
        const next = new Date(date);
        if (offset !== undefined) next.setDate(next.getDate() + offset);
        else { next.setDate(1); next.setMonth(next.getMonth() + (event.key === 'PageUp' ? -1 : 1)); next.setDate(Math.min(day, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate())); }
        focused = iso(next);
        if (active === 'end' && start && focused < start) focused = start;
        const target = parse(focused); month = new Date(target.getFullYear(), target.getMonth(), 1, 12);
        render(); focusDay();
      });
      days.append(button);
    }
    ['start', 'end'].forEach(side => $(`${side}-date-button`).setAttribute('aria-expanded', side === active));
  }
  function select(value) {
    $(`${active}-date`).value = value;
    if (active === 'start' && $('end-date').value < value) $('end-date').value = '';
    $(`${active}-date`).dispatchEvent(new Event('change', {bubbles:true}));
    focused = value;
    if (active === 'start') { active = 'end'; render(); focusDay(); }
    else close();
  }
  function open(side) {
    if (!picker.classList.contains('is-hidden') && active === side) return close();
    active = side;
    focused = $(`${side}-date`).value || $('start-date').value || iso(today);
    const selected = parse(focused); month = new Date(selected.getFullYear(), selected.getMonth(), 1, 12);
    picker.classList.remove('is-hidden'); render(); focusDay();
  }
  function moveMonth(amount) {
    month.setMonth(month.getMonth() + amount);
    focused = iso(month);
    const start = $('start-date').value;
    if (active === 'end' && start && start.slice(0,7) === focused.slice(0,7)) focused = start;
    render();
  }
  ['start', 'end'].forEach(side => $(`${side}-date-button`).addEventListener('click', () => open(side)));
  $('date-picker-prev').addEventListener('click', () => moveMonth(-1));
  $('date-picker-next').addEventListener('click', () => moveMonth(1));
  $('date-picker-close').addEventListener('click', () => close());
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !picker.classList.contains('is-hidden')) { event.preventDefault(); close(); } });
  document.addEventListener('pointerdown', event => { if (!picker.contains(event.target) && !event.target.closest('.date-button')) close(false); });
  document.addEventListener('focusin', event => { if (!picker.contains(event.target) && !event.target.closest('.date-button')) close(false); });
  $('language-toggle').addEventListener('click', () => { if (!picker.classList.contains('is-hidden')) render(); });
  $('create-form').addEventListener('reset', () => { close(false); ['start', 'end'].forEach(side => { $(`${side}-date`).value = ''; }); });
})();
