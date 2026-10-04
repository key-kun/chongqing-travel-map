/* One-shot browser location. Coordinates stay in this page's memory. */
(() => {
 'use strict';
 window.createUserLocationControl=({map,L,button,panel,message,clearButton,canCenter=()=>true})=>{
  let pending=false,requestId=0,focusWhenReady=false,marker=null,circle=null;
  const buttonText=button.querySelector('span');
  function removeLayers(){
   if(marker){map.removeLayer(marker);marker=null;}
   if(circle){map.removeLayer(circle);circle=null;}
  }
  function setState(state,text){
   panel.dataset.state=state;panel.hidden=state==='idle';message.textContent=text;
   button.disabled=state==='pending';button.setAttribute('aria-busy',String(state==='pending'));
   buttonText.textContent=state==='pending'?'定位中…':'我的位置';
   clearButton.textContent=state==='pending'?'取消等待':state==='success'?'清除位置':'关闭提示';
  }
  function clear(){
   requestId++;pending=false;focusWhenReady=false;removeLayers();setState('idle','');
  }
  function fail(text){
   pending=false;focusWhenReady=false;removeLayers();setState('error',text);
  }
  function distance(metres){
   return metres>=1000?`${(metres/1000).toFixed(1)}公里`:`${Math.max(1,Math.round(metres))}米`;
  }
  function request(){
   if(pending)return;
   const id=++requestId;
   removeLayers();
   if(!window.isSecureContext){fail('请通过在线地图的HTTPS网址，或本机启动入口使用定位。');return;}
   if(!navigator.geolocation){fail('这个浏览器不支持定位，请换用手机系统浏览器。');return;}
   pending=true;focusWhenReady=true;
   setState('pending','正在获取位置。首次使用请在浏览器提示中允许定位。');
   try{
    navigator.geolocation.getCurrentPosition(position=>{
     if(id!==requestId)return;
     const {latitude:lat,longitude:lng,accuracy}=position.coords||{};
     if(!Number.isFinite(lat)||!Number.isFinite(lng)||!Number.isFinite(accuracy)||Math.abs(lat)>90||Math.abs(lng)>180||accuracy<0){
      fail('浏览器返回的位置无效，请再次点击“我的位置”重试。');return;
     }
     pending=false;
     // Geolocation uses WGS84, the same datum as this map. Do not apply GCJ/BD offsets.
     const point=[lat,lng];
     if(accuracy>0)circle=L.circle(point,{radius:accuracy,color:'#2563eb',weight:1,fillColor:'#3b82f6',fillOpacity:.13,interactive:false}).addTo(map);
     marker=L.marker(point,{title:'我的位置',alt:'我的位置',zIndexOffset:1000,
      icon:L.divIcon({className:'user-location-marker',html:'<span class="user-location-dot" aria-hidden="true"></span>',iconSize:[44,44],iconAnchor:[22,22]})
     }).addTo(map).bindTooltip('我的位置',{permanent:true,direction:'top',offset:[0,-14],className:'user-location-tooltip'});
     marker.on('add',()=>marker.getElement()?.setAttribute('aria-label','我的位置'));
     marker.getElement()?.setAttribute('aria-label','我的位置');
     const acquiredAt=Number.isFinite(position.timestamp)?position.timestamp:Date.now();
     const time=new Date(acquiredAt).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'});
     const range=accuracy>0?`精度范围约${distance(accuracy)}`:'浏览器未提供精度范围';
     setState('success',`本次位置 · ${range} · ${time}。${accuracy>=300?'范围较大，可到室外再试。':'移动后再次点击按钮更新。'}`);
     if(focusWhenReady&&canCenter()){
      if(circle)map.fitBounds(circle.getBounds(),{padding:[45,45],maxZoom:16,animate:false});
      else map.setView(point,16,{animate:false});
     }
     focusWhenReady=false;
    },error=>{
     if(id!==requestId)return;
     const texts={
      1:'本次定位请求被拒绝。请检查手机设置中浏览器的位置信息权限，以及浏览器中这个网站的定位权限，再点击重试。',
      2:'暂时无法获取位置。请开启手机定位服务，检查网络，或到室外后重试。',
      3:'定位等待超时。请检查手机定位服务，或到室外后再次点击“我的位置”。'
     };
     fail(texts[error?.code]||'定位暂时失败，请再次点击“我的位置”重试。');
    },{enableHighAccuracy:true,timeout:15000,maximumAge:0});
   }catch{fail('浏览器暂时无法启动定位，请检查网站定位权限后重试。');}
  }
  function cancelCentering(){focusWhenReady=false;}
  map.on('movestart',()=>{if(pending)cancelCentering();});
  button.onclick=request;clearButton.onclick=clear;
  window.addEventListener('pagehide',clear);
  setState('idle','');
  return {clear,cancelCentering};
 };
})();
