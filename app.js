(() => {
 'use strict';
 const D=window.TRAVEL_DATA,$=id=>document.getElementById(id);
 const colors={'景点':'#1769ba','机位':'#8c4acd','美食':'#e36b2c','交通':'#008577'},glyphs={'景点':'景','机位':'拍','美食':'食','交通':'行'};
 const frameById=new Map(D.frames.map(f=>[f.id,f])),pointById=new Map(D.points.map(p=>[p.id,p]));
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const safeUrl=url=>/^https?:\/\//.test(url||'')?escape(url):'#';
 let planner=null,libraryView='list',previousView='map',activeDayRoute=null;
 let status='all',scope='city',selected=null,lightboxFrames=[],lightboxIndex=0,lightboxPlace='',returnFocus=null;
 const markerModeKey='cq-map-marker-label-mode';
 let markerMode='category';
 try{if(localStorage.getItem(markerModeKey)==='name')markerMode='name';}catch{}
 const compactMedia=matchMedia('(max-width:1000px), (max-width:1024px) and (max-height:520px) and (orientation:landscape)');
 let mobileView='map',hasDetail=false,compactActive=null,layoutFrame=0,lastMapSize={x:0,y:0};
 $('report-date').textContent=D.reportDate;
 [...new Set(D.points.map(p=>p.region))].forEach(region=>$('region').insertAdjacentHTML('beforeend',`<option>${escape(region)}</option>`));
 const map=L.map('map',{zoomControl:false,preferCanvas:true,zoomAnimation:false,fadeAnimation:false,markerZoomAnimation:false}).setView([29.563,106.556],13);
 L.control.zoom({position:'topright'}).addTo(map);L.control.scale({position:'bottomleft',imperial:false}).addTo(map);
 const tiles=L.tileLayer(D.tileUrl,{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'}).addTo(map);
 const cluster=L.markerClusterGroup({maxClusterRadius:45,showCoverageOnHover:false,spiderfyOnMaxZoom:true,animate:false}).addTo(map);
 let clusteredPointsKey='';
 const markers=new Map();
 function pointIcon(p){
  const kind=p.categories[0],color=colors[kind];
  return markerMode==='name'
   ?L.divIcon({className:'name-pin-wrapper',html:`<div class="map-name-pin" style="--point-color:${color}"><span class="name-pin-dot" aria-hidden="true"></span><span>${escape(p.name)}</span></div>`,iconSize:[44,44],iconAnchor:[22,44]})
   :L.divIcon({className:'pin-wrapper',html:`<div class="map-pin" style="--point-color:${color}"><span>${glyphs[kind]}</span></div>`,iconSize:[30,30],iconAnchor:[15,30]});
 }
 function syncMarkerElement(marker,p){
  const el=marker.getElement();
  if(el){el.setAttribute('aria-label',p.name);el.classList.toggle('selected-marker',selected===p.id);}
 }
 function syncMarkerTooltip(marker,p){
  marker.unbindTooltip();
  if(markerMode==='category')marker.bindTooltip(escape(p.name),{direction:'top',offset:[0,-25]});
 }
 D.points.filter(p=>p.coordinates).forEach(p=>{
  const marker=L.marker([p.coordinates.lat,p.coordinates.lng],{title:p.name,alt:p.name,icon:pointIcon(p)});
  syncMarkerTooltip(marker,p);marker.on('click',()=>selectPoint(p.id,false));marker.on('add',()=>syncMarkerElement(marker,p));markers.set(p.id,marker);
 });
 function syncMarkerModeButtons(){
  document.querySelectorAll('[data-marker-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.markerMode===markerMode)));
 }
 document.querySelectorAll('[data-marker-mode]').forEach(b=>b.onclick=()=>{
  const next=b.dataset.markerMode;if(!['category','name'].includes(next)||next===markerMode)return;
  markerMode=next;
  markers.forEach((marker,id)=>{const p=pointById.get(id);marker.setIcon(pointIcon(p));syncMarkerTooltip(marker,p);syncMarkerElement(marker,p);});
  syncMarkerModeButtons();
  try{localStorage.setItem(markerModeKey,markerMode);}catch{}
 });
 syncMarkerModeButtons();
 let tileSuccess=0,tileErrors=0;
 const showMapMessage=text=>{$('map-status-text').textContent=text;$('map-status').hidden=false;};
 tiles.on('tileload',()=>{tileSuccess++;if(navigator.onLine)$('map-status').hidden=true;});
 tiles.on('tileerror',()=>{tileErrors++;if(tileErrors>=3)showMapMessage('底图暂时加载失败。地点列表和关键帧仍可查看。');});
 window.addEventListener('offline',()=>showMapMessage('当前网络已断开。已保存的地点资料和关键帧仍可查看。'));
 window.addEventListener('online',()=>{tileErrors=0;tiles.redraw();});
 $('retry-map').onclick=()=>{tileSuccess=0;tileErrors=0;$('map-status').hidden=true;tiles.redraw();setTimeout(()=>{if(!tileSuccess)showMapMessage('底图仍未加载，请检查网络连接。');},10000);};
 setTimeout(()=>{if(!tileSuccess)showMapMessage('底图加载较慢。你可以先从列表查看地点和截图。');},12000);
 const userLocation=window.createUserLocationControl({map,L,button:$('locate-me'),panel:$('location-panel'),message:$('location-message'),clearButton:$('clear-location'),canCenter:()=>!compactMedia.matches||mobileView==='map'});
 function filtered(ignoreStatus=false){
  const q=$('search').value.trim().toLocaleLowerCase(),region=$('region').value,category=$('category').value;
  return D.points.filter(p=>(!region||p.region===region)&&(!category||p.categories.includes(category))&&(ignoreStatus||status==='all'||p.locationStatus===status)&&(!q||[p.name,p.area,p.id,...p.entityIds].join(' ').toLocaleLowerCase().includes(q)));
 }
 function render(){
  const base=filtered(true),points=filtered();
  $('toggle-filters').classList.toggle('has-filters',Boolean($('region').value||$('category').value));
  document.querySelectorAll('[data-status]').forEach(b=>{b.classList.toggle('active',b.dataset.status===status);b.querySelector('span').textContent=b.dataset.status==='all'?base.length:base.filter(p=>p.locationStatus===b.dataset.status).length;});
  $('result-count').textContent=`${points.length} 个地点 · ${points.filter(p=>p.coordinates).length} 个地图标记 · 原报告 ${D.originalRecords} 条记录`;
  $('point-list').innerHTML=points.length?points.map(p=>`<button class="point-card${p.id===selected?' selected':''}" data-point="${p.id}" aria-pressed="${p.id===selected}"><div class="point-title"><span class="type-icon" style="--point-color:${colors[p.categories[0]]}">${glyphs[p.categories[0]]}</span><span>${escape(p.name)}</span></div><div class="point-meta"><span>${escape(p.region)}</span><span class="${p.coordinates?'':'pending'}">${p.coordinates?'已定位':'待定位'}</span><span>${p.frameIds.length} 帧</span></div></button>`).join(''):'<div class="empty-results">没有找到匹配地点。可以换一个关键词，或清除片区、类型筛选。</div>';
  const visiblePoints=points.filter(p=>p.coordinates),nextClusterKey=visiblePoints.map(p=>p.id).join(',');
  if(nextClusterKey!==clusteredPointsKey){cluster.clearLayers();cluster.addLayers(visiblePoints.map(p=>markers.get(p.id)));clusteredPointsKey=nextClusterKey;}
  markers.forEach((marker,id)=>marker.getElement()?.classList.toggle('selected-marker',id===selected));
  $('map-caption').textContent=activeDayRoute?`${activeDayRoute.label} · ${activeDayRoute.markers.length}个地图位置`:`${points.filter(p=>p.coordinates).length} 个已定位点 · ${points.filter(p=>!p.coordinates).length} 个待定位记录`;
  planner?.decorateCatalogue();
 }
 function showMobileView(view){
  if(view==='detail'&&mobileView!=='detail')previousView=mobileView;
  mobileView=view==='detail'&&!hasDetail?'map':view;
  planner?.onView(mobileView);
  if(view==='list'||view==='favorites')libraryView=view;
  document.body.dataset.libraryView=libraryView;
  document.querySelectorAll('[data-library-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.libraryView===libraryView)));
  if(!compactMedia.matches){$('detail').classList.toggle('open',mobileView==='detail');return;}
  if(!compactMedia.matches)return;
  document.body.dataset.mobileView=mobileView;
  [['sidebar','list'],['favorites-panel','favorites'],['planner-panel','plan'],['detail','detail']].forEach(([id,activeView])=>{
   const panel=$(id),active=mobileView===activeView;
   panel.classList.toggle('open',active);panel.inert=!active;panel.setAttribute('aria-hidden',String(!active));
  });
  document.querySelectorAll('[data-mobile-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mobileView===mobileView)));
  if(mobileView!=='list')$('search').blur();
 }
 function setDetailExpanded(expanded){
  $('detail').classList.toggle('expanded',expanded);
  $('expand-detail').setAttribute('aria-expanded',String(expanded));
  $('expand-detail').innerHTML=expanded?'收起详情 <span aria-hidden="true">⌄</span>':'展开详情 <span aria-hidden="true">⌃</span>';
 }
 function closeDetail(){
  $('detail').classList.remove('open');showMobileView(previousView==='detail'?'map':previousView);
 }
 function centerPoint(p,zoom){
  if(!p?.coordinates)return;
  map.setView([p.coordinates.lat,p.coordinates.lng],zoom,{animate:false});
  if(compactMedia.matches&&mobileView==='detail'){
   const size=map.getSize(),landscape=innerWidth>innerHeight&&innerHeight<=520;
   map.panBy(landscape?[Math.round(size.x*.25),0]:[0,Math.round(size.y*.28)],{animate:false});
  }
 }
 function syncLayout(){
  cancelAnimationFrame(layoutFrame);layoutFrame=requestAnimationFrame(()=>{
   const height=window.visualViewport?.scale===1?window.visualViewport.height:innerHeight;
   document.documentElement.style.setProperty('--app-height',`${Math.round(height)}px`);
   document.documentElement.style.setProperty('--topbar-height',`${Math.ceil(document.querySelector('.topbar').getBoundingClientRect().height)}px`);
   if(compactActive!==compactMedia.matches){
    compactActive=compactMedia.matches;
    if(compactActive)showMobileView(mobileView);
    else{
     ['sidebar','detail','favorites-panel','planner-panel'].forEach(id=>{$(id).inert=false;$(id).removeAttribute('aria-hidden');});
     $('sidebar').classList.remove('open');$('detail').classList.toggle('open',hasDetail&&mobileView==='detail');setDetailExpanded(false);
    }
   }
   map.invalidateSize({pan:false});const size=map.getSize();
   if(compactActive&&mobileView==='detail'&&selected&&(size.x!==lastMapSize.x||size.y!==lastMapSize.y))centerPoint(pointById.get(selected),map.getZoom());
   lastMapSize={x:size.x,y:size.y};
  });
 }
 function fitScope(next){
  userLocation.cancelCentering();planner?.clearDayMap();
  if(compactMedia.matches)showMobileView('map');
  scope=next;document.querySelectorAll('[data-scope]').forEach(b=>b.classList.toggle('active',b.dataset.scope===scope));
  $('region').value=['大足','武隆'].includes(scope)?scope:'';render();
  if(scope==='city'){map.setView([29.563,106.556],13,{animate:false});return;}
  const points=filtered().filter(p=>p.coordinates&&(scope!=='city'||!['大足','武隆'].includes(p.region)));
  if(points.length)map.fitBounds(L.latLngBounds(points.map(p=>[p.coordinates.lat,p.coordinates.lng])),{padding:[35,55],maxZoom:14,animate:false});
 }
 $('point-list').onclick=e=>{const button=e.target.closest('[data-point]');if(button)selectPoint(button.dataset.point,true);};
 $('search').addEventListener('input',render);$('region').onchange=render;$('category').onchange=render;
 document.querySelectorAll('[data-status]').forEach(b=>b.onclick=()=>{status=b.dataset.status;render();});
 document.querySelectorAll('[data-scope]').forEach(b=>b.onclick=()=>fitScope(b.dataset.scope));
 const field=(title,content)=>`<div class="field"><b>${escape(title)}</b><p>${escape(content)}</p></div>`;
 function selectPoint(id,move=true){
  userLocation.cancelCentering();
  const p=pointById.get(id);if(!p)return;selected=id;render();
  if(!move)$('point-list').querySelector(`[data-point="${id}"]`)?.scrollIntoView({block:'nearest'});
  $('sidebar').classList.remove('open');$('detail').classList.add('open');
  hasDetail=true;$('mobile-detail').disabled=false;setDetailExpanded(false);showMobileView('detail');
  const coords=p.coordinates;
  const frames=p.frameIds.map(fid=>frameById.get(fid));
  const sourceLinks=p.sourceIds.map(sid=>D.sources.find(s=>s.id===sid)).filter(Boolean);
  const review=p.locationReview;
  const reviewSources=review?.sources.filter(s=>s.url!==coords?.sourceUrl)||[];
  const reviewHtml=review?`<p class="frame-conclusion">机位补查：${escape(review.checkedOn)} · ${review.status==='located'?'具名设施或场所已定位，拍摄站位与进入条件另核':'已保留具体线索，仍待定位'}</p>${reviewSources.length?`<ul class="sources">${reviewSources.map(s=>`<li><a target="_blank" rel="noopener" href="${safeUrl(s.url)}">${escape(s.title)}</a> · ${escape(s.kind)}</li>`).join('')}</ul>`:''}`:'';
  $('detail-content').innerHTML=`<div class="detail-header"><button class="detail-close" id="close-detail" aria-label="关闭地点详情">×</button><div class="detail-kicker">${escape(p.region)} · ${escape(p.categories.join(' / '))} <span>${escape(p.id)}</span></div><h2>${escape(p.name)}</h2><div class="detail-location"><span class="badge ${coords?'':'warn'}">${coords?'位置已定位':'位置待定位'}</span><span class="badge warn">营业 / 入口仍待核实</span></div><p class="detail-note">${escape(p.note)}</p></div><section class="detail-section"><h3>视频关键帧 <span>${frames.length} 张 · 点击看原图</span></h3>${frames.map((f,i)=>`<button class="frame-card" data-frame-index="${i}" aria-label="放大 ${escape(f.topic)} ${f.timestamp}"><img src="${escape(f.image)}" alt="${escape(f.topic)}，视频 ${f.timestamp}" loading="lazy"><div class="frame-caption"><span>${escape(f.id)} · ${f.timestamp}</span><span>${f.width} × ${f.height}</span></div><p class="frame-topic">${escape(f.topic)}</p><p class="frame-conclusion">${escape(f.conclusion)}</p></button>`).join('')}<p class="frame-conclusion">视频画面可能包含地图、照片插图和历史页面，共用截图不代表每个地点都有独立实景。原署名保留在原图中。</p></section><section class="detail-section"><h3>位置依据</h3>${field('定位说明',coords?coords.basis:p.locationReason)}${coords?`<div class="field"><b>${escape(coords.precision)} · WGS84</b><p>${coords.lat.toFixed(7)}, ${coords.lng.toFixed(7)}</p><a href="${safeUrl(coords.sourceUrl)}" target="_blank" rel="noopener">${escape(coords.sourceName)}</a><p>坐标核对：${escape(coords.checkedOn)}</p></div>`:''}${reviewHtml}</section><section class="detail-section"><h3>出行核验 <span>${D.reportDate}</span></h3>${field('入口与准入',p.entry)}${field('开放与预约',p.openingBooking)}${field('步行与台阶',p.walking)}${p.externalFacts.map(f=>field('报告所记录的外部信息',f.statement)).join('')}${p.nameConflict?field('名称采用边界',p.nameConflict.decision):''}${p.nationalDay?field('国庆安排',p.nationalDay):''}${sourceLinks.length?`<ul class="sources">${sourceLinks.map(s=>`<li><a target="_blank" rel="noopener" href="${safeUrl(s.url)}">${escape(s.title)}</a> · ${escape(s.kind)}<br>报告核验：${escape(s.checked_on)}</li>`).join('')}</ul>`:''}</section><section class="detail-section"><h3>资料追溯</h3>${field('记录来源',p.origin+(p.entityIds.length?' · '+p.entityIds.join('、'):''))}<p class="frame-conclusion">视频证据与报告核验日期均保留；地图位置不证明当前开放、营业或允许拍摄。</p><details class="details-toggle"><summary>查看画面摘录与原字幕</summary>${frames.map(f=>`<div class="subtitles"><b>${escape(f.id)} · ${f.timestamp}</b><p>画面摘录：${escape(f.visibleText)}</p>${f.subtitleContext.map(s=>`<p>[${s.start.toFixed(2)}–${s.end.toFixed(2)}] ${escape(s.text)}</p>`).join('')}</div>`).join('')}<p class="subtitles">原字幕可能含听写错字；章节上下文不表示每句话都指向该地点。</p></details></section>`;
  $('detail').scrollTop=0;$('detail-content').scrollTop=0;
  $('close-detail').onclick=closeDetail;
  if(selected&&pointById.has(selected))$('detail-content').querySelector('.detail-header')?.insertAdjacentHTML('beforeend',planner?.detailActions({kind:'catalogue',id:selected})||'');
  $('detail').querySelectorAll('img').forEach(img=>img.addEventListener('error',()=>{const fallback=document.createElement('div');fallback.className='image-failure';fallback.textContent='图片文件暂时无法打开，点击重试';img.replaceWith(fallback);},{once:true}));
  $('detail').querySelectorAll('[data-frame-index]').forEach(b=>b.onclick=()=>{lightboxFrames=frames;lightboxPlace=p.name;openLightbox(Number(b.dataset.frameIndex));});
  if(coords&&(move||compactMedia.matches)){const marker=markers.get(id);centerPoint(p,move?Math.max(map.getZoom(),17):map.getZoom());const parent=cluster.getVisibleParent(marker);if(parent&&parent!==marker)parent.spiderfy();marker.openTooltip();}
 }
 function openLightbox(index){
  lightboxIndex=index;const f=lightboxFrames[index];if(!$('lightbox').open){returnFocus=document.activeElement;$('lightbox').showModal();}
  $('lightbox-title').textContent=`${lightboxPlace} · ${f.timestamp} · ${f.topic}`;$('lightbox-image').alt=f.topic;
  $('lightbox-image').hidden=false;$('lightbox-error').hidden=true;$('lightbox-image').src=f.image;
  $('lightbox-index').textContent=`${index+1} / ${lightboxFrames.length}`;$('prev-frame').disabled=index===0;$('next-frame').disabled=index===lightboxFrames.length-1;
  $('lightbox').querySelector('.lightbox-canvas').classList.remove('actual');$('actual-size').textContent='原尺寸';
  $('lightbox').querySelector('.lightbox-touch-hint').textContent='左右滑动切换图片';
 }
 $('lightbox-image').onerror=()=>{$('lightbox-image').hidden=true;$('lightbox-error').hidden=false;};
 $('close-lightbox').onclick=()=>$('lightbox').close();$('lightbox').addEventListener('close',()=>returnFocus?.focus());
 $('prev-frame').onclick=()=>{if(lightboxIndex>0)openLightbox(lightboxIndex-1);};$('next-frame').onclick=()=>{if(lightboxIndex<lightboxFrames.length-1)openLightbox(lightboxIndex+1);};
 $('actual-size').onclick=()=>{const actual=$('lightbox').querySelector('.lightbox-canvas').classList.toggle('actual');$('actual-size').textContent=actual?'适应窗口':'原尺寸';$('lightbox').querySelector('.lightbox-touch-hint').textContent=actual?'拖动查看原图':'左右滑动切换图片';};
 $('lightbox').addEventListener('keydown',e=>{if(e.key==='ArrowLeft'){$('prev-frame').click();e.preventDefault();}if(e.key==='ArrowRight'){$('next-frame').click();e.preventDefault();}});
 $('show-list').onclick=()=>showMobileView('list');$('hide-list').onclick=()=>showMobileView('map');
 document.querySelectorAll('[data-mobile-view]').forEach(b=>b.onclick=()=>{showMobileView(b.dataset.mobileView);if(mobileView==='detail'&&selected)centerPoint(pointById.get(selected),map.getZoom());});
 $('mobile-close-detail').onclick=closeDetail;$('expand-detail').onclick=()=>setDetailExpanded(!$('detail').classList.contains('expanded'));
 $('toggle-filters').onclick=()=>{const expanded=$('sidebar').querySelector('.sidebar-head').classList.toggle('filters-expanded');$('toggle-filters').setAttribute('aria-expanded',String(expanded));};
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('lightbox').open&&!$('planner-dialog').open&&compactMedia.matches&&mobileView!=='map')showMobileView('map');});
 let swipeStart=null;const canvas=$('lightbox').querySelector('.lightbox-canvas');$('lightbox-image').draggable=false;
 canvas.addEventListener('pointerdown',e=>{if(e.pointerType!=='touch')return;if(!e.isPrimary){swipeStart=null;return;}if(compactMedia.matches&&!canvas.classList.contains('actual'))swipeStart={id:e.pointerId,x:e.clientX,y:e.clientY};});
 canvas.addEventListener('pointerup',e=>{if(!swipeStart||e.pointerId!==swipeStart.id)return;const dx=e.clientX-swipeStart.x,dy=e.clientY-swipeStart.y;swipeStart=null;if(Math.abs(dx)>=60&&Math.abs(dx)>Math.abs(dy)*2)(dx<0?$('next-frame'):$('prev-frame')).click();});
 canvas.addEventListener('pointercancel',()=>{swipeStart=null;});
 $('all-frames').onclick=()=>{
  selected=null;render();$('sidebar').classList.remove('open');$('detail').classList.add('open');
  hasDetail=true;$('mobile-detail').disabled=false;setDetailExpanded(false);showMobileView('detail');
  $('detail-content').innerHTML=`<div class="detail-header"><button class="detail-close" id="close-detail" aria-label="关闭地点详情">×</button><div class="detail-kicker">原视频资料 · 84 张完整原图</div><h2>全部关键帧</h2><p class="detail-note">按视频时间排列。地图总览、照片插图和历史页面均保留，各帧的检查结论标注在图片下方。</p><p class="detail-note"><a href="${safeUrl(D.videoUrl)}" target="_blank" rel="noopener">查看原视频来源（哔哩哔哩）</a> · 报告核验 ${D.reportDate}</p></div><section class="detail-section">${D.frames.map((f,i)=>`<button class="frame-card" data-gallery-index="${i}" aria-label="放大 ${escape(f.topic)} ${f.timestamp}"><img src="${escape(f.image)}" alt="${escape(f.topic)}" loading="lazy"><div class="frame-caption"><span>${escape(f.id)} · ${f.timestamp}</span><span>${f.width} × ${f.height}</span></div><p class="frame-topic">${escape(f.topic)}</p><p class="frame-conclusion">${escape(f.conclusion)}</p></button>`).join('')}</section>`;
  $('detail').scrollTop=0;$('detail-content').scrollTop=0;$('close-detail').onclick=closeDetail;
  $('detail').querySelectorAll('img').forEach(img=>img.addEventListener('error',()=>{const fallback=document.createElement('div');fallback.className='image-failure';fallback.textContent='图片文件暂时无法打开，点击重试';img.replaceWith(fallback);},{once:true}));
  $('detail').querySelectorAll('[data-gallery-index]').forEach(b=>b.onclick=()=>{lightboxFrames=D.frames;lightboxPlace='全部关键帧';openLightbox(Number(b.dataset.galleryIndex));});
 };
 window.addEventListener('resize',syncLayout);window.visualViewport?.addEventListener('resize',syncLayout);compactMedia.addEventListener('change',syncLayout);
 const layoutObserver=new ResizeObserver(syncLayout);layoutObserver.observe(document.querySelector('.topbar'));layoutObserver.observe($('map'));
 render();syncLayout();
 const customLayers=L.layerGroup().addTo(map),dayLayers=L.layerGroup().addTo(map),pickLayers=L.layerGroup().addTo(map);let picking=false,pickCallback=null;
 map.on('click',e=>{if(!picking)return;const c={lat:e.latlng.lat,lng:e.latlng.lng};pickLayers.clearLayers();L.marker([c.lat,c.lng]).addTo(pickLayers);pickCallback(c);});
 planner=window.createTripPlanner({
  refreshCatalogue:render,showView:showMobileView,getView:()=>mobileView,cancelCentering:()=>userLocation.cancelCentering(),
  openCatalogue:id=>selectPoint(id,true),closeDetail,
  openCustom(p,actions){userLocation.cancelCentering();selected=null;render();hasDetail=true;setDetailExpanded(false);showMobileView('detail');$('detail-content').innerHTML=`<div class="detail-header"><button class="detail-close" id="close-detail" aria-label="关闭地点详情">×</button><div class="detail-kicker">${p._missing?'地点资料暂不可用':'手动添加 · '+escape(p.category||'其他')}</div><h2>${escape(p.name)}</h2><span class="badge ${p.coordinates?'':'warn'}">${p.coordinates?'手动标位置':'未标位置'}</span><p class="detail-note">${escape(p.address||'尚未填写地址')}</p><p class="detail-note">${escape(p.note||'')}</p>${actions()}</div><section class="detail-section"><p>${p._missing?'原地点编号与安排已保留，可导出备份；当前地点库中没有对应资料。':'此地点由你手动添加，不附加视频截图或报告核验结论。'}</p></section>`;$('close-detail').onclick=closeDetail;if(p.coordinates)centerPoint(p,16);},
  setCustomPlaces(places,onSelect){customLayers.clearLayers();places.filter(p=>p.coordinates).forEach(p=>L.marker([p.coordinates.lat,p.coordinates.lng],{title:p.name,alt:p.name,icon:L.divIcon({className:'custom-marker',html:'<span>自</span>',iconSize:[32,32],iconAnchor:[16,16]})}).addTo(customLayers).bindTooltip(escape(p.name)+' · 手动添加').on('click',()=>onSelect(p)));},
  setDayMap(route,onSelect){activeDayRoute=route;$('route-note').hidden=!route;$('map-caption').textContent=route?`${route.label} · ${route.markers.length}个地图位置`:`${filtered().filter(p=>p.coordinates).length} 个已定位点 · ${filtered().filter(p=>!p.coordinates).length} 个待定位记录`;dayLayers.clearLayers();if(!route){if(!map.hasLayer(customLayers))customLayers.addTo(map);if(!map.hasLayer(cluster))cluster.addTo(map);$('map').classList.remove('day-map');return;}map.removeLayer(cluster);map.removeLayer(customLayers);$('map').classList.add('day-map');route.segments.forEach(line=>L.polyline(line,{color:route.color,dashArray:'7 8',weight:3,opacity:.6,interactive:false}).addTo(dayLayers));route.markers.forEach(m=>{const marker=L.marker([m.coordinates.lat,m.coordinates.lng],{title:m.name,alt:m.name,zIndexOffset:500,icon:L.divIcon({className:'day-marker',html:`<span style="--day-color:${route.color}">${m.numbers.join('、')}</span>`,iconSize:[44,44],iconAnchor:[22,22]})}).addTo(dayLayers).bindTooltip(escape(m.name));marker.getElement()?.setAttribute('aria-label',m.numbers.join('、')+' '+m.name);marker.on('click',()=>onSelect(m.place));});},
  fitCoordinates(coords){map.fitBounds(L.latLngBounds(coords.map(c=>[c.lat,c.lng])),{padding:[45,60],maxZoom:16,animate:false});},
  startPick(callback){userLocation.cancelCentering();picking=true;pickCallback=callback;map.getContainer().classList.add('picking-position');},
  endPick(){picking=false;pickCallback=null;pickLayers.clearLayers();map.getContainer().classList.remove('picking-position');}
 });
 document.querySelectorAll('[data-library-view]').forEach(b=>b.onclick=()=>showMobileView(b.dataset.libraryView));
 showMobileView('map');
 function openLinkedPlace(){try{const requested=decodeURIComponent(location.hash.slice(1));if(pointById.has(requested))selectPoint(requested);}catch{}}
 window.addEventListener('hashchange',openLinkedPlace);openLinkedPlace();
})();
