// Treat database records as untrusted input, including records made by older clients.
(() => {
  const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(`${value}T12:00:00Z`))
    && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
  const minutes = value => {
    if (typeof value !== 'string' || !/^\d{2}:\d{2}(:00)?$/.test(value)) return NaN;
    const [h,m] = value.split(':').map(Number);
    return h < 24 && m < 60 ? h * 60 + m : value === '24:00:00' || value === '24:00' ? 1440 : NaN;
  };
  function validateSchedule(data) {
    const event = data?.event;
    if (!event || typeof event.id !== 'string' || typeof event.slug !== 'string'
      || typeof event.title !== 'string' || event.title.length > 100
      // Allow legacy multi-month events; creation is limited to 31 days by the API.
      || !Array.isArray(event.dates) || !event.dates.length || event.dates.length > 93
      || !event.dates.every((date,index) => validDate(date) && (!index || date > event.dates[index-1]))
      || ![15,30,60].includes(event.slot_minutes)
      || !Number.isFinite(minutes(event.start_time)) || !Number.isFinite(minutes(event.end_time))
      || minutes(event.start_time) >= minutes(event.end_time)
      || typeof event.timezone !== 'string' || !/^[A-Za-z0-9_+/-]+$/.test(event.timezone)) throw new Error('Invalid schedule data. Please contact the organizer.');
    try { new Intl.DateTimeFormat('en', {timeZone:event.timezone}); } catch { throw new Error('Invalid time zone.'); }
    if (event.confirmed_date && (!event.dates.includes(event.confirmed_date)
      || !Number.isFinite(minutes(event.confirmed_start_time)) || !Number.isFinite(minutes(event.confirmed_end_time))
      || minutes(event.confirmed_start_time) >= minutes(event.confirmed_end_time))) throw new Error('Invalid confirmed time.');
    const allowed = new Set();
    for (const date of event.dates) for (let m=minutes(event.start_time);m<minutes(event.end_time);m+=event.slot_minutes)
      allowed.add(`${date}T${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`);
    if (!Array.isArray(data.responses) || data.responses.length > 200) throw new Error('Invalid responses.');
    for (const response of data.responses) {
      if (typeof response.display_name !== 'string' || response.display_name.length > 60
        || !Array.isArray(response.availability) || response.availability.length > allowed.size
        || !response.availability.every(slot => allowed.has(slot))) throw new Error('Invalid response data. Please contact the organizer.');
    }
    return data;
  }
  window.schedulerValidation = {validDate, minutes, validateSchedule};
})();
