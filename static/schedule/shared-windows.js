// Pure calculation, shared by the browser and the small regression test.
((root) => {
  function findSharedWindows(event, responses, duration) {
    const minutes = time => { const [h, m] = time.split(':').map(Number); return h * 60 + m; };
    const clock = value => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
    const step = Number(event.slot_minutes), start = minutes(event.start_time), end = minutes(event.end_time);
    if (!responses.length || !Number.isInteger(duration) || duration <= 0 || step <= 0 || duration % step || duration > end - start) return [];
    const availability = responses.map(response => new Set(response.availability || []));
    const byDate = [...event.dates].sort().map(date => {
      const ranges = []; let runStart = null;
      const finish = boundary => {
        if (runStart !== null && boundary - runStart >= duration) ranges.push({date, start:runStart, end:boundary});
        runStart = null;
      };
      for (let minute = start; minute + step <= end; minute += step) {
        const shared = availability.every(slots => slots.has(`${date}T${clock(minute)}`));
        if (shared && runStart === null) runStart = minute;
        if (!shared) finish(minute);
      }
      finish(start + Math.floor((end - start) / step) * step);
      return ranges;
    });
    // Return every qualifying maximal block, never a capped list of start times.
    return byDate.flat();
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = findSharedWindows;
  else root.findSharedWindows = findSharedWindows;
})(typeof window !== 'undefined' ? window : globalThis);
