// Wall-clock keys remain the storage contract. Projection never rewrites them.
((root) => {
  const formatters = new Map(), offsetCache = new Map();
  const pad = n => String(n).padStart(2,'0');
  const clock = m => `${pad(Math.floor(m/60))}:${pad(m%60)}`;
  const minutes = t => Number(t.slice(0,2))*60 + Number(t.slice(3,5));
  const localZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  function parts(epoch, zone) {
    if (!formatters.has(zone)) formatters.set(zone,new Intl.DateTimeFormat('en-CA-u-ca-gregory-nu-latn', {timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}));
    const p=Object.fromEntries(formatters.get(zone).formatToParts(new Date(epoch)).map(p=>[p.type,p.value]));
    const date=`${p.year}-${p.month}-${p.day}`, minute=Number(p.hour)*60+Number(p.minute);
    const wall=Date.parse(`${date}T${clock(minute)}:00Z`);
    return {date,minute,offset:(wall-Math.floor(epoch/60000)*60000)/60000};
  }
  function resolve(date, minute, zone) {
    const wall=Date.parse(`${date}T00:00:00Z`)+minute*60000;
    const cacheKey=`${zone}/${date}`;
    if (!offsetCache.has(cacheKey)) {
      const offsets=new Set();
      for(let h=-36;h<=36;h+=12) offsets.add(parts(wall+h*3600000,zone).offset);
      offsetCache.set(cacheKey,[...offsets]);
    }
    const matches=offsetCache.get(cacheKey).map(offset=>wall-offset*60000).filter(epoch=>{
      const p=parts(epoch,zone);return Date.parse(`${p.date}T00:00:00Z`)+p.minute*60000===wall;
    });
    if(matches.length!==1) throw new Error('DST_WALL_TIME');
    return matches[0];
  }
  function validateEvent(event) {
    const step=Number(event.slot_minutes),start=minutes(event.start_time),end=minutes(event.end_time);
    for(const date of event.dates) {
      let previous=resolve(date,start,event.timezone);
      for(let m=start+step;m<=end;m+=step) {
        const next=resolve(date,m,event.timezone);
        if(next-previous!==step*60000) throw new Error('DST_WALL_TIME');
        previous=next;
      }
    }
  }
  function project(event, zone) {
    const step=Number(event.slot_minutes),start=minutes(event.start_time),end=minutes(event.end_time);
    const groups=new Map();
    for(const date of event.dates) for(let m=start;m<end;m+=step) {
      const key=`${date}T${clock(m)}`, stop=Math.min(m+step,end);
      if(zone===event.timezone) {
        if(!groups.has(date)) groups.set(date,{id:date,date,offset:null,segments:[]});
        groups.get(date).segments.push({key,sourceDate:date,sourceMinute:m,start:m,end:stop});
        continue;
      }
      let epoch=resolve(date,m,event.timezone), finish=resolve(date,stop,event.timezone);
      if(finish-epoch!==(stop-m)*60000) throw new Error('DST_WALL_TIME');
      while(epoch<finish) {
        const p=parts(epoch,zone);
        let next=Math.min(finish,epoch+(1440-p.minute)*60000);
        // Split at a destination DST transition; repeated hours get separate columns.
        if(parts(next-1,zone).offset!==p.offset) {
          next=epoch+60000;
          while(next<finish && parts(next,zone).offset===p.offset) next+=60000;
        }
        const id=`${p.date}/${p.offset}`;
        if(!groups.has(id)) groups.set(id,{id,date:p.date,offset:p.offset,firstEpoch:epoch,segments:[]});
        groups.get(id).segments.push({key,sourceDate:date,sourceMinute:m,start:p.minute,end:p.minute+(next-epoch)/60000});
        epoch=next;
      }
    }
    const columns=[...groups.values()].sort((a,b)=>a.date.localeCompare(b.date)||(a.firstEpoch||0)-(b.firstEpoch||0));
    const boundaries=[...new Set(columns.flatMap(c=>c.segments.flatMap(s=>[s.start,s.end])))].sort((a,b)=>a-b);
    const rows=boundaries.slice(0,-1).map((start,i)=>({start,end:boundaries[i+1],cells:columns.map(c=>c.segments.find(s=>s.start<=start && s.end>=boundaries[i+1])||null)}));
    columns.forEach(c=>{c.split=columns.filter(other=>other.date===c.date).length>1;});
    return {columns,rows,end:boundaries.at(-1)};
  }
  function range(date,start,end,source,view) {
    if(source===view)return `${date.replaceAll('-','/')} · ${clock(start)}–${clock(end)} · ${view}`;
    const a=parts(resolve(date,start,source),view),b=parts(resolve(date,end,source),view);
    const offset=p=>a.offset===b.offset?'':` (UTC${p.offset>=0?'+':'−'}${clock(Math.abs(p.offset))})`;
    return `${a.date.replaceAll('-','/')} · ${clock(a.minute)}${offset(a)}–${a.date===b.date?'':`${b.date.replaceAll('-','/')} `}${clock(b.minute)}${offset(b)} · ${view}`;
  }
  const common=['Asia/Seoul','Asia/Tokyo','America/New_York','America/Los_Angeles','Europe/London','Europe/Paris','Asia/Shanghai','Asia/Kolkata','Asia/Kathmandu','Australia/Sydney','Pacific/Auckland','UTC'];
  const zones=()=>[...new Set([localZone(),...common,...(typeof Intl.supportedValuesOf==='function'?Intl.supportedValuesOf('timeZone'):[])])];
  const api={parts,resolve,project,range,validateEvent,localZone,zones,clock};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.schedulerZones=api;
})(typeof window!=='undefined'?window:globalThis);
