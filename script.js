
const __debugOverlay = (function(){
  try{
    const d = document.createElement('div');
    d.id = 'debugOverlay';
    d.innerHTML = '<strong>Debug</strong><div id="debugMessages" style="margin-top:6px;max-height:160px;overflow:auto"></div>';
    document.body.appendChild(d);
    return d;
  }catch(e){ return null; }
})();
function showDebug(msg){
  try{
    if(__debugOverlay){
      __debugOverlay.style.display='block';
      const box=document.getElementById('debugMessages');
      const el=document.createElement('div'); el.textContent=`[${new Date().toLocaleTimeString()}] ${msg}`;
      box.appendChild(el);
      while(box.children.length>80) box.removeChild(box.firstChild);
    }
    console.warn(msg);
  }catch(e){ console.warn('Debug overlay failed', e); }
}
window.addEventListener('error', ev=>showDebug('Error: '+(ev?.message||ev)));
window.addEventListener('unhandledrejection', ev=>showDebug('UnhandledRejection: '+(ev?.reason||ev)));

// Success toast
function showSuccess(message, timeout=3500){
  try{
    const t=document.createElement('div'); t.className='success-toast'; t.textContent=message;
    document.body.appendChild(t);
    setTimeout(()=>{ t.style.transition='opacity 300ms'; t.style.opacity='0'; }, timeout-400);
    setTimeout(()=>{ t.remove(); }, timeout);
  }catch(e){ showDebug('showSuccess failed: '+e); }
}

// --- Elements ---
const calendarSelect=document.getElementById('calendarSelect');
const prevBtn=document.getElementById('prevBtn');
const nextBtn=document.getElementById('nextBtn');
const monthLabel=document.getElementById('monthLabel');
const calendarEl=document.getElementById('calendar');
const modal=document.getElementById('eventModal');
const closeModal=document.getElementById('closeModal');
const modalTitle=document.getElementById('modalTitle');
const modalBody=document.getElementById('modalBody');
const monthSelect=document.getElementById('monthSelect');
const yearSelect=document.getElementById('yearSelect');

// --- State ---
let state={ cal:'gregorian', viewDate:new Date() };

const G_WEEKDAYS=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const HIJRI_MONTHS=['Muharram','Safar',"Rabi' al-awwal","Rabi' al-thani","Jumada al-awwal","Jumada al-thani","Rajab","Sha'ban","Ramadan","Shawwal","Dhu al-Qi'dah","Dhu al-Hijjah"];
const ETH_MONTHS=['Meskerem','Tikimt','Hidar','Tahsas','Tir','Yekatit','Megabit','Miyazya','Ginbot','Sene','Hamle','Nehase','Pagume'];

// --- Events ---
const EVENTS={
  gregorian:{
    '1-1': {title:'New Year',desc:'Global New Year',icon:'⭐',class:'holiday'},
    '12-25': {title:'Christmas Day',desc:'Widely recognized holiday',icon:'🎄',class:'holiday'},
    '7-4': {title:'Independence Day',desc:'US Independence Day example',icon:'🎉',class:'holiday'}
  },
  hijri:{
    '9-1': {title:'Ramadan begins',desc:'Start of Ramadan',icon:'🌙',class:'hijri',msg:'May Allah bless your fasting month!'},
    '10-1': {title:'Eid al-Fitr',desc:'Festival at end of Ramadan',icon:'🎉',class:'hijri',msg:'Eid Mubarak!'},
    '12-10': {title:'Eid al-Adha',desc:'Festival of Sacrifice',icon:'🌙',class:'hijri',msg:'Blessings on this Eid al-Adha!'},
    '1-10': {title:"Ashura",desc:"10th of Muharram",icon:'⭐',class:'hijri',msg:'Reflect on the lessons of Ashura.'},
    '3-12': {title:"Mawlid",desc:"Prophet's birthday",icon:'🌙',class:'hijri',msg:'Celebrate the Prophet’s birthday with love.'}
  },
  ethiopian:{
    '1-1': {title:'Enkutatash',desc:'Ethiopian New Year',icon:'🎉',class:'eth'},
    '1-17': {title:'Adwa Victory Day',desc:'Commemoration of Battle of Adwa',icon:'⭐',class:'eth'},
    '2-11': {title:'Timket',desc:'Epiphany celebration',icon:'🌊',class:'eth'},
    '5-17': {title:'Meskel',desc:'Finding of the True Cross',icon:'🎉',class:'eth'},
    '4-29': {title:'Fasika (Easter)',desc:'Ethiopian Orthodox Easter (approx)',icon:'🎉',class:'eth'}
  }
};

// --- Conversion helpers ---
function isGregorianLeap(y){ return (y%4===0 && y%100!==0) || (y%400===0); }
function daysInGregorianMonth(y,m){ return new Date(y,m+1,0).getDate(); }

// Gregorian ↔ JD ↔ Hijri (tabular approx)
function gregorianToJd(y,m,d){ let a=Math.floor((14-m)/12); let y2=y+4800-a; let m2=m+12*a-3; return d+Math.floor((153*m2+2)/5)+365*y2+Math.floor(y2/4)-Math.floor(y2/100)+Math.floor(y2/400)-32045; }
function jdToGregorian(jd){ let a=jd+32044; let b=Math.floor((4*a+3)/146097); let c=a-Math.floor((146097*b)/4); let d=Math.floor((4*c+3)/1461); let e=c-Math.floor((1461*d)/4); let m=Math.floor((5*e+2)/153); let day=e-Math.floor((153*m+2)/5)+1; let month=m+3-12*Math.floor(m/10); let year=100*b+d-4800+Math.floor(m/10); return {year,month,day}; }
function jdToHijri(jd){ jd=Math.floor(jd)+0.5; let days=jd-1948439+10632; let n=Math.floor((days-1)/10631); days=days-10631*n+354; let j=(Math.floor((10985-days)/5316))*(Math.floor((50*days)/17719))+Math.floor(days/5670)*Math.floor((43*days)/15238); days=days-(Math.floor((30-j)/15))*Math.floor((17719*j)/50)-Math.floor(j/16); let month=Math.floor((24*days)/709); let day=days-Math.floor((709*month)/24); let year=30*n+j-30; return {year,month,day}; }
function hijriToJd(y,m,d){ return Math.floor((11*y+3)/30)+354*y+30*(m-1)-Math.floor((m-1)/2)+d+1948440-385; }
function gregorianToHijri(date){ return jdToHijri(gregorianToJd(date.getFullYear(),date.getMonth()+1,date.getDate())); }
function hijriMonthLength(y,m){ return jdToGregorian(hijriToJd(y,m===12?1:m+1,1)).day-jdToGregorian(hijriToJd(y,m,1)).day+30; } // approx

// Ethiopian ↔ Gregorian
function gregorianToEthiopian(date){
  let y=date.getFullYear();
  let enkutYear=new Date(y,8,11); if(isGregorianLeap(y+1)) enkutYear=new Date(y,8,12);
  let ethYear=date>=enkutYear?y-7:y-8;
  let ref=date>=enkutYear?enkutYear:(isGregorianLeap(y)?new Date(y-1,8,12):new Date(y-1,8,11));
  let diffDays=Math.floor((date-ref)/(24*60*60*1000)); if(diffDays<0) diffDays+=365+ (isGregorianLeap(ref.getFullYear())?1:0);
  let month=Math.floor(diffDays/30)+1; let day=(diffDays%30)+1;
  if(month>13){ month=13; day=diffDays-30*12+1; }
  return {year:ethYear,month,day};
}
function ethiopianToGregorian(ethYear,ethMonth,ethDay){
  let guessG=ethYear+7;
  let enkut=new Date(guessG,8,11); if(isGregorianLeap(guessG+1)) enkut=new Date(guessG,8,12);
  let offset=(ethMonth-1)*30+(ethDay-1);
  return new Date(enkut.getTime()+offset*24*60*60*1000);
}

function populateMonthYear(){
  let months=[];
  if(state.cal==='gregorian') months=Array.from({length:12},(_,i)=>new Date(0,i).toLocaleString('default',{month:'long'}));
  else if(state.cal==='ethiopian') months=ETH_MONTHS;
  else if(state.cal==='hijri') months=HIJRI_MONTHS;
  monthSelect.innerHTML=''; months.forEach((m,i)=>{ const opt=document.createElement('option'); opt.value=i; opt.textContent=m; monthSelect.appendChild(opt); });
  let curMonth=0; 
  if(state.cal==='gregorian') curMonth=state.viewDate.getMonth();
  else if(state.cal==='ethiopian') curMonth=gregorianToEthiopian(state.viewDate).month-1;
  else if(state.cal==='hijri') curMonth=gregorianToHijri(state.viewDate).month-1;
  monthSelect.value=curMonth;

  let startY,endY; 
  if(state.cal==='gregorian'){startY=1900; endY=2100;}
  else if(state.cal==='ethiopian'){startY=2000; endY=2100;}
  else if(state.cal==='hijri'){startY=1400; endY=1500;}
  yearSelect.innerHTML='';
  for(let y=startY;y<=endY;y++){ const opt=document.createElement('option'); opt.value=y; opt.textContent=y; yearSelect.appendChild(opt); }
  let curYear=state.viewDate.getFullYear(); if(state.cal==='ethiopian') curYear=gregorianToEthiopian(state.viewDate).year; else if(state.cal==='hijri') curYear=gregorianToHijri(state.viewDate).year;
  yearSelect.value=curYear;
}


function render(){
  if(!calendarEl){ showDebug('No calendar container'); return; }
  calendarEl.innerHTML='';
  let cal=state.cal;
  let view=new Date(state.viewDate.getTime());


  if(cal==='gregorian') monthLabel.textContent=view.toLocaleString(undefined,{month:'long',year:'numeric'});
  else if(cal==='ethiopian'){ let e=gregorianToEthiopian(new Date(view.getFullYear(),view.getMonth(),1)); monthLabel.textContent=`${ETH_MONTHS[e.month-1]} ${e.year}`; }
  else if(cal==='hijri'){ let h=gregorianToHijri(new Date(view.getFullYear(),view.getMonth(),1)); monthLabel.textContent=`${HIJRI_MONTHS[h.month-1]} ${h.year}`; }


  const weekdays=document.createElement('div'); weekdays.className='weekday-row';
  G_WEEKDAYS.forEach(w=>{let el=document.createElement('div'); el.textContent=w; weekdays.appendChild(el);});
  calendarEl.appendChild(weekdays);

  const grid=document.createElement('div'); grid.className='days-grid';

  if(cal==='gregorian'){
    let year=view.getFullYear(); let month=view.getMonth();
    let firstDay=new Date(year,month,1).getDay(); let total=daysInGregorianMonth(year,month);
    for(let i=0;i<firstDay;i++){ let blank=document.createElement('div'); blank.className='day muted'; grid.appendChild(blank); }
    for(let d=1;d<=total;d++){
      let cell=document.createElement('div'); cell.className='day';
      let num=document.createElement('div'); num.className='num'; num.textContent=d; cell.appendChild(num);
      let key=`${month+1}-${d}`; if(EVENTS.gregorian[key]){ let ev=EVENTS.gregorian[key]; let badge=document.createElement('div'); badge.className=`event ${ev.class}`; badge.textContent=`${ev.icon} ${ev.title}`; badge.onclick=()=>showEvent(ev.title,ev.desc); cell.appendChild(badge); }
      grid.appendChild(cell);
    }
  } else if(cal==='ethiopian'){
    let first=new Date(view.getFullYear(),view.getMonth(),1); let e=gregorianToEthiopian(first);
    let start=new Date(ethiopianToGregorian(e.year,e.month,1)); let startWeekday=start.getDay();
    let length=(e.month<=12?30:(isGregorianLeap(e.year+7)?6:5));
    for(let i=0;i<startWeekday;i++){ let blank=document.createElement('div'); blank.className='day muted'; grid.appendChild(blank); }
    for(let d=1;d<=length;d++){
      let cell=document.createElement('div'); cell.className='day';
      let num=document.createElement('div'); num.className='num'; num.textContent=d; cell.appendChild(num);
      let key=`${e.month}-${d}`; if(EVENTS.ethiopian[key]){ let ev=EVENTS.ethiopian[key]; let badge=document.createElement('div'); badge.className=`event ${ev.class}`; badge.textContent=`${ev.icon} ${ev.title}`; badge.onclick=()=>showEvent(ev.title,ev.desc); cell.appendChild(badge); }
      grid.appendChild(cell);
    }
  } else if(cal==='hijri'){
    let first=new Date(view.getFullYear(),view.getMonth(),1); let h=gregorianToHijri(first);
    let startJD=hijriToJd(h.year,h.month,1); let gStart=jdToGregorian(startJD); let gDate=new Date(gStart.year,gStart.month-1,gStart.day); let startWeekday=gDate.getDay();
    let length=hijriMonthLength(h.year,h.month);
    for(let i=0;i<startWeekday;i++){ let blank=document.createElement('div'); blank.className='day muted'; grid.appendChild(blank); }
    for(let d=1;d<=length;d++){
      let cell=document.createElement('div'); cell.className='day';
      let num=document.createElement('div'); num.className='num'; num.textContent=d; cell.appendChild(num);
      let key=`${h.month}-${d}`; if(EVENTS.hijri[key]){ let ev=EVENTS.hijri[key]; let badge=document.createElement('div'); badge.className=`event ${ev.class}`; badge.textContent=`${ev.icon} ${ev.title}`; badge.onclick=()=>showEvent(ev.title,ev.desc+'\n'+(ev.msg||'')); cell.appendChild(badge); }
      grid.appendChild(cell);
    }
  }

  calendarEl.appendChild(grid);
  showDebug('Rendered calendar: '+state.cal+' ('+monthLabel.textContent+')');
  showSuccess('Calendar rendered — '+monthLabel.textContent);
}

function showEvent(title,desc){ modalTitle.textContent=title; modalBody.textContent=desc; modal.classList.remove('hidden'); }
closeModal.onclick=()=>modal.classList.add('hidden');
modal.onclick=e=>{ if(e.target===modal) modal.classList.add('hidden'); }


prevBtn.onclick=()=>{
  let m=state.viewDate.getMonth()-1; let y=state.viewDate.getFullYear();
  if(state.cal==='gregorian'){state.viewDate=new Date(y,m,1);}
  else if(state.cal==='ethiopian'){ let eth=gregorianToEthiopian(state.viewDate); let newMonth=eth.month-1; let newYear=eth.year; if(newMonth<1){ newMonth=13; newYear--; } state.viewDate=ethiopianToGregorian(newYear,newMonth,1); }
  else if(state.cal==='hijri'){ let h=gregorianToHijri(state.viewDate); let newMonth=h.month-1; let newYear=h.year; if(newMonth<1){ newMonth=12; newYear--; } state.viewDate=new Date(jdToGregorian(hijriToJd(newYear,newMonth,1)).year,jdToGregorian(hijriToJd(newYear,newMonth,1)).month-1,jdToGregorian(hijriToJd(newYear,newMonth,1)).day); }
  populateMonthYear(); render();
};
nextBtn.onclick=()=>{
  let m=state.viewDate.getMonth()+1; let y=state.viewDate.getFullYear();
  if(state.cal==='gregorian'){state.viewDate=new Date(y,m,1);}
  else if(state.cal==='ethiopian'){ let eth=gregorianToEthiopian(state.viewDate); let newMonth=eth.month+1; let newYear=eth.year; if(newMonth>13){ newMonth=1; newYear++; } state.viewDate=ethiopianToGregorian(newYear,newMonth,1); }
  else if(state.cal==='hijri'){ let h=gregorianToHijri(state.viewDate); let newMonth=h.month+1; let newYear=h.year; if(newMonth>12){ newMonth=1; newYear++; } state.viewDate=new Date(jdToGregorian(hijriToJd(newYear,newMonth,1)).year,jdToGregorian(hijriToJd(newYear,newMonth,1)).month-1,jdToGregorian(hijriToJd(newYear,newMonth,1)).day); }
  populateMonthYear(); render();
};


calendarSelect.onchange=()=>{
  state.cal=calendarSelect.value; populateMonthYear(); render();
};
monthSelect.onchange=()=>{
  const m=parseInt(monthSelect.value); const y=parseInt(yearSelect.value);
  if(state.cal==='gregorian') state.viewDate=new Date(y,m,1);
  else if(state.cal==='ethiopian') state.viewDate=ethiopianToGregorian(y,m+1,1);
  else if(state.cal==='hijri') state.viewDate=new Date(jdToGregorian(hijriToJd(y,m+1,1)).year,jdToGregorian(hijriToJd(y,m+1,1)).month-1,jdToGregorian(hijriToJd(y,m+1,1)).day);
  render();
};
yearSelect.onchange=()=>{ monthSelect.onchange(); };

populateMonthYear();
render();



