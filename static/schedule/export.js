((root) => {
  function scheduleExport(event, responses) {
    return {
      title: event.title,
      timezone: event.timezone,
      dates: [...event.dates],
      start_time: event.start_time,
      end_time: event.end_time,
      interval_minutes: event.slot_minutes,
      confirmed_time: event.confirmed_date ? {
        date: event.confirmed_date,
        start_time: event.confirmed_start_time,
        end_time: event.confirmed_end_time
      } : null,
      responses: responses.map((response) => ({
        name: response.display_name,
        available_times: [...response.availability].sort()
      })).sort((a, b) => a.name.localeCompare(b.name))
    };
  }
  if (typeof module !== "undefined" && module.exports) module.exports = scheduleExport;
  else root.schedulerExport = scheduleExport;
})(typeof window !== "undefined" ? window : globalThis);
