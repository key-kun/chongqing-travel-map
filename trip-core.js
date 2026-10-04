/* Catalogue data is read-only. Trips contain references and user-owned places. */
(function(root){
 'use strict';
 const VERSION=1,KEY='cq-travel-plans-v1',MAX_BYTES=500000;
 const clone=x=>JSON.parse(JSON.stringify(x));
 const uid=()=>globalThis.crypto?.randomUUID?.()||'t'+Date.now().toString(36)+Math.random().toString(36).slice(2);
 const fail=()=>{throw new Error('行程格式不完整或内容超过限制，请使用本网页导出的文件。');};
 const string=(x,max,required=false)=>{if(typeof x!=='string'||x.length>max||(required&&!x.trim()))fail();return x;};
 const array=(x,max)=>{if(!Array.isArray(x)||x.length>max)fail();return x;};
 const identifier=x=>{string(x,100,true);if(!/^[A-Za-z0-9_-]+$/.test(x))fail();return x;};
 function date(x){string(x,10);if(x){const d=new Date(x+'T00:00:00Z');if(!/^\d{4}-\d{2}-\d{2}$/.test(x)||!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==x)fail();}return x;}
 function coordinates(c){if(c===null)return null;if(!c||!Number.isFinite(c.lat)||!Number.isFinite(c.lng)||Math.abs(c.lat)>90||Math.abs(c.lng)>180)fail();return {lat:c.lat,lng:c.lng};}
 function ref(r){if(!r||!['catalogue','custom'].includes(r.kind))fail();return {kind:r.kind,id:identifier(r.id)};}
 const refKey=r=>r.kind+':'+r.id;
 function stop(s){if(!s)fail();const time=string(s.time,5);if(time&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))fail();if(s.duration!==null&&(!Number.isInteger(s.duration)||s.duration<0||s.duration>1440))fail();return {id:identifier(s.id),place:ref(s.place),time,duration:s.duration,note:string(s.note,2000)};}
 function validateTrip(t){
  if(!t||t.schemaVersion!==VERSION)throw new Error('不支持这个行程版本，请使用第一版行程文件。');
  const places=array(t.customPlaces,300).map(p=>({id:identifier(p.id),name:string(p.name,100,true),category:string(p.category,20,true),address:string(p.address,500),note:string(p.note,2000),coordinates:coordinates(p.coordinates)}));
  const days=array(t.days,60).map(d=>({id:identifier(d.id),stops:array(d.stops,1000).map(stop)}));if(!days.length)fail();
  const favorites=array(t.favorites,1000).map(ref),unassigned=array(t.unassigned,1000).map(stop);
  const unique=list=>{if(new Set(list).size!==list.length)fail();};
  unique(places.map(p=>p.id));unique(days.map(d=>d.id));unique(favorites.map(refKey));
  const stops=[...unassigned,...days.flatMap(d=>d.stops)];if(stops.length>1000)fail();unique(stops.map(s=>s.id));
  const customIds=new Set(places.map(p=>p.id));for(const r of [...favorites,...stops.map(s=>s.place)])if(r.kind==='custom'&&!customIds.has(r.id))fail();
  const result={schemaVersion:VERSION,id:identifier(t.id),name:string(t.name,100,true),startDate:date(t.startDate),favorites,customPlaces:places,days,unassigned};
  if(new TextEncoder().encode(JSON.stringify(result)).length>250000)fail();return result;
 }
 function newTrip(name='我的重庆旅行'){return {schemaVersion:VERSION,id:uid(),name,startDate:'',favorites:[],customPlaces:[],days:[{id:uid(),stops:[]}],unassigned:[]};}
 const newStop=place=>({id:uid(),place:clone(place),time:'',duration:null,note:''});
 function duplicateTrip(t){const next=validateTrip(clone(t));next.id=uid();next.days.forEach(d=>{d.id=uid();d.stops.forEach(s=>s.id=uid());});next.unassigned.forEach(s=>s.id=uid());return next;}
 function parseFile(text){if(typeof text!=='string'||text.length>MAX_BYTES)throw new Error('文件过大，最多支持500KB的行程。');let value;try{value=JSON.parse(text);}catch{throw new Error('文件不是有效的JSON行程。');}if(!value||value.format!=='cq-trip'||value.version!==VERSION)throw new Error('请选择本网页导出的第一版行程文件。');return validateTrip(value.trip);}
 const fileText=t=>JSON.stringify({format:'cq-trip',version:VERSION,trip:validateTrip(t)});
 function createStore(storage){
  let state={version:VERSION,trips:[],activeId:null,activeDayId:null},blocked=false,message='尚未创建计划';
  try{const raw=storage.getItem(KEY);if(raw){if(raw.length>15000000)fail();const v=JSON.parse(raw);if(v.version!==VERSION)fail();const trips=array(v.trips,30).map(validateTrip);if(new Set(trips.map(t=>t.id)).size!==trips.length)fail();state={version:VERSION,trips,activeId:trips.some(t=>t.id===v.activeId)?v.activeId:trips[0]?.id||null,activeDayId:typeof v.activeDayId==='string'?v.activeDayId:null};message='已恢复本机计划';}}
  catch{blocked=true;message='本机保存不可用或旧数据损坏；当前可继续编辑，请导出备份。';}
  function save(){if(blocked)return false;try{storage.setItem(KEY,JSON.stringify(state));message='已保存到本机';return true;}catch{message='保存失败，内容仍在本页，请导出备份。';return false;}}
  return {get state(){return state;},get message(){return message;},get blocked(){return blocked;},save,
   active:()=>state.trips.find(t=>t.id===state.activeId)||null,
   add(t){if(state.trips.length>=30)throw new Error('最多保存30份计划，请先导出并删除不再使用的计划。');const next=validateTrip(t);state.trips.push(next);state.activeId=next.id;state.activeDayId=next.days[0].id;save();return next;},
   select(id){if(state.trips.some(t=>t.id===id)){state.activeId=id;state.activeDayId=state.trips.find(t=>t.id===id).days[0].id;save();}},
   remove(id){state.trips=state.trips.filter(t=>t.id!==id);if(state.activeId===id){state.activeId=state.trips[0]?.id||null;state.activeDayId=state.trips[0]?.days[0].id||null;}save();}
  };
 }
 function resolvePlace(trip,r,catalogue){return r.kind==='custom'?trip.customPlaces.find(p=>p.id===r.id):catalogue.find(p=>p.id===r.id);}
 function segments(stops,getPlace){const groups=[],markers=new Map();let segment=[];stops.forEach((s,i)=>{const p=getPlace(s.place),c=p?.coordinates;if(!c){if(segment.length>1)groups.push(segment);segment=[];return;}segment.push([c.lat,c.lng]);const key=c.lat+','+c.lng;if(!markers.has(key))markers.set(key,{coordinates:c,place:s.place,name:p.name,numbers:[]});markers.get(key).numbers.push(i+1);});if(segment.length>1)groups.push(segment);return {segments:groups,markers:[...markers.values()]};}
 function gcj(c){const {lat,lng}=c;if(lng<72.004||lng>137.8347||lat<.8293||lat>55.8271)return {lat,lng};const x=lng-105,y=lat-35,pi=Math.PI;let a=-100+2*x+3*y+.2*y*y+.1*x*y+.2*Math.sqrt(Math.abs(x)),b=300+x+2*y+.1*x*x+.1*x*y+.1*Math.sqrt(Math.abs(x));const common=(20*Math.sin(6*x*pi)+20*Math.sin(2*x*pi))*2/3;a+=common+(20*Math.sin(y*pi)+40*Math.sin(y/3*pi))*2/3+(160*Math.sin(y/12*pi)+320*Math.sin(y*pi/30))*2/3;b+=common+(20*Math.sin(x*pi)+40*Math.sin(x/3*pi))*2/3+(150*Math.sin(x/12*pi)+300*Math.sin(x/30*pi))*2/3;const rad=lat*pi/180,magic=1-.00669342162296594323*Math.sin(rad)**2;return {lat:lat+a*180/(6378245*(1-.00669342162296594323)/(magic*Math.sqrt(magic))*pi),lng:lng+b*180/(6378245/Math.sqrt(magic)*Math.cos(rad)*pi)};}
 function navigation(p,mode='car'){if(!p?.coordinates)return null;const c=gcj(p.coordinates),url=new URL('https://uri.amap.com/navigation');url.search=new URLSearchParams({to:`${c.lng.toFixed(7)},${c.lat.toFixed(7)},${p.name}`,mode:['car','walk','bus'].includes(mode)?mode:'car',src:'chongqing-travel-planner',callnative:'1'});return url.href;}
 const api={VERSION,KEY,MAX_BYTES,clone,uid,refKey,newTrip,newStop,validateTrip,duplicateTrip,parseFile,fileText,createStore,resolvePlace,segments,gcj,navigation};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.TripCore=api;
})(typeof window==='object'?window:globalThis);
