// Searchable picker with keyboard navigation; the hidden field holds a real IANA ID.
window.createZonePicker = (host, onChange=()=>{}) => {
  const field=host.querySelector('input[type="hidden"]'),button=host.querySelector('.zone-trigger'),panel=host.querySelector('.zone-popover');
  const search=panel.querySelector('input'),list=panel.querySelector('[role="listbox"]');
  let choices=[],active=0;
  const ko=()=>document.documentElement.lang==='ko';
  const aliases={'Asia/Seoul':'서울 한국 KST Korea','Asia/Tokyo':'도쿄 일본 Japan JST','America/New_York':'뉴욕 미국 Eastern ET','America/Los_Angeles':'로스앤젤레스 미국 Pacific PT','Europe/London':'런던 영국 UK','Asia/Kolkata':'India 인도','Asia/Kathmandu':'Nepal 네팔'};
  const label=zone=>zone.replaceAll('_',' ').replaceAll('/',' / ');
  const searchable=text=>text.toLowerCase().replace(/[_/]+/g,' ').replace(/\s+/g,' ').trim();
  function close(focus=false){panel.classList.add('is-hidden');button.setAttribute('aria-expanded','false');if(focus)button.focus();}
  function render(){
    const query=searchable(search.value);
    choices=window.schedulerZones.zones().filter(zone=>searchable(`${zone} ${aliases[zone]||''}`).includes(query));
    active=Math.max(0,Math.min(active,choices.length-1));list.replaceChildren();
    choices.forEach((zone,i)=>{
      const option=document.createElement('div');option.id=`${field.id}-option-${i}`;option.role='option';option.textContent=label(zone);option.setAttribute('aria-selected',zone===field.value);option.classList.toggle('is-active',i===active);
      option.addEventListener('mousedown',event=>event.preventDefault());option.addEventListener('click',()=>choose(zone));list.append(option);
    });
    if(!choices.length){const empty=document.createElement('p');empty.textContent=ko()?'검색 결과가 없습니다.':'No matching time zones.';list.append(empty);}
    if(choices.length)search.setAttribute('aria-activedescendant',`${field.id}-option-${active}`);else search.removeAttribute('aria-activedescendant');
  }
  function choose(zone){field.value=zone;refresh();close(true);onChange(zone);}
  function refresh(){button.textContent=label(host.dataset.compact?field.value.split('/').at(-1):field.value);button.title=label(field.value);search.placeholder=ko()?'도시 또는 시간대 검색':'Search city or time zone';search.setAttribute('aria-label',search.placeholder);if(!panel.classList.contains('is-hidden'))render();}
  button.addEventListener('click',()=>{if(!panel.classList.contains('is-hidden'))return close();search.value='';active=0;render();panel.classList.remove('is-hidden');button.setAttribute('aria-expanded','true');search.focus();});
  search.addEventListener('input',()=>{active=0;render();});
  search.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();close(true);}
    if(event.key==='Enter'){event.preventDefault();if(choices[active])choose(choices[active]);}
    if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
      event.preventDefault();active=event.key==='Home'?0:event.key==='End'?choices.length-1:active+(event.key==='ArrowDown'?1:-1);render();list.children[active]?.scrollIntoView({block:'nearest'});
    }
  });
  document.addEventListener('pointerdown',event=>{if(!host.contains(event.target))close();});
  host.addEventListener('focusout',event=>{if(!host.contains(event.relatedTarget))close();});
  refresh();return {refresh,setValue(zone){field.value=zone;refresh();},close};
};
