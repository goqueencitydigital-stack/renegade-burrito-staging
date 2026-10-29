/* Renegade Burrito runtime — single online-ordering provider, location memory, GA4 events.
   Every ordering URL comes from RB_CONFIG (data/locations.json). Change a store's ordering
   URL there (or via /admin/) and every button on the site follows. */
(function(){
"use strict";
var CFG=window.RB_CONFIG, ITEMS=window.RB_ITEMS||{}, BASE=window.RB_BASE||"";
var PREVIEW_KEY="rb_admin_preview", LOC_KEY="rb_loc", UTM_KEY="rb_utm";
// Admin preview override (local to this browser only)
try{var pv=localStorage.getItem(PREVIEW_KEY); if(pv){var o=JSON.parse(pv); if(o&&o.locations){CFG=o; document.documentElement.classList.add("rb-preview");}}}catch(e){}
window.RB_ACTIVE_CONFIG=CFG;
var LOCS=CFG.locations, byId={}; LOCS.forEach(function(l){byId[l.id]=l});
var ALLOWED=CFG.brand.allowedOrderDomains||["toasttab.com","toast.site"];

/* ---------- analytics ---------- */
window.dataLayer=window.dataLayer||[];
function track(ev,params){params=params||{};params.page_path=location.pathname;window.dataLayer.push(Object.assign({event:ev},params));if(window.RB_DEBUG)console.log("[GA4]",ev,params)}
window.RBtrack=track;

/* ---------- UTM capture & passthrough ---------- */
(function(){var q=new URLSearchParams(location.search),u={},has=false;["utm_source","utm_medium","utm_campaign","utm_content","utm_term","gclid","fbclid"].forEach(function(k){if(q.get(k)){u[k]=q.get(k);has=true}});if(has)try{sessionStorage.setItem(UTM_KEY,JSON.stringify(u))}catch(e){}})();
function withUtm(url,placement){
  try{var x=new URL(url),saved={};try{saved=JSON.parse(sessionStorage.getItem(UTM_KEY)||"{}")}catch(e){}
    var src=Object.keys(saved).length?saved:{utm_source:"renegadeburrito.com",utm_medium:"website",utm_campaign:"order_button"};
    Object.keys(src).forEach(function(k){if(!x.searchParams.has(k))x.searchParams.set(k,src[k])});
    if(placement&&!x.searchParams.has("utm_content"))x.searchParams.set("utm_content",placement);
    return x.toString()}catch(e){return url}
}
/* ---------- URL resolution ---------- */
function allowed(url){try{var h=new URL(url).hostname;return url.indexOf("https://")===0&&ALLOWED.some(function(d){return h===d||h.slice(-d.length-1)==="."+d})}catch(e){return false}}
function itemUrl(key,loc){
  var it=ITEMS[key];if(!it||!it.l[loc.id])return null;
  var href=it.l[loc.id][0];
  // follow admin slug changes automatically
  var m=href.match(/\/order\/([^/]+)\//);if(m&&loc.toast.slug&&m[1]!==loc.toast.slug)href=href.replace("/order/"+m[1]+"/","/order/"+loc.toast.slug+"/");
  if(loc.toast.orderUrl&&loc.toast.orderUrl.indexOf("/order/"+loc.toast.slug)<0){return loc.toast.orderUrl} // custom URL without slug pattern: fall back to store menu
  return href;
}
function resolve(kind,loc,item){
  if(!loc||!loc.orderingEnabled)return null;var t=loc.toast,u=null;
  switch(kind){
    case "pickup":u=t.pickupUrl||t.orderUrl;break;
    case "delivery":u=loc.deliveryEnabled?(t.deliveryUrl||t.orderUrl):null;break;
    case "catering":u=null;break; // catering is phone/quote only
    case "item":u=itemUrl(item,loc);break;
    case "gift":u=t.giftCardUrl||null;break;
    case "rewards":u=t.rewardsUrl||null;break;
    default:u=t.orderUrl;
  }
  return u&&allowed(u)?u:null;
}
window.RBresolve=resolve;
/* ---------- location state ---------- */
function getLoc(){try{return byId[sessionStorage.getItem(LOC_KEY)]||null}catch(e){return null}}
function setLoc(id,how){if(!byId[id])return;try{sessionStorage.setItem(LOC_KEY,id)}catch(e){}track("location_selected",{location_id:id,location_name:byId[id].name,method:how||"selector"});paint();document.dispatchEvent(new CustomEvent("rb:loc",{detail:byId[id]}))}
window.RBsetLoc=setLoc;window.RBgetLoc=getLoc;

/* ---------- hours / open now (only when verified) ---------- */
var DAYS=["sun","mon","tue","wed","thu","fri","sat"];
function denverNow(){var p=new Intl.DateTimeFormat("en-US",{timeZone:"America/Denver",weekday:"short",hour:"numeric",minute:"numeric",hour12:false}).formatToParts(new Date()),o={};p.forEach(function(x){o[x.type]=x.value});return{d:o.weekday.slice(0,3).toLowerCase(),m:(parseInt(o.hour,10)%24)*60+parseInt(o.minute,10)}}
function openState(loc){
  if(!loc.hoursVerified)return null;var n=denverNow(),today=new Date().toISOString().slice(0,10);
  var ex=(loc.hoursExceptions||[]).filter(function(e){return e.date===today})[0];
  var h=ex?(ex.closed?null:[ex.open,ex.close]):loc.hours[n.d];
  if(!h)return{open:false,label:"Closed today"};
  var open=n.m>=h[0]&&n.m<h[1];return{open:open,label:open?"Open now · until "+fmtT(h[1]):(n.m<h[0]?"Opens "+fmtT(h[0]):"Closed now")};
}
function fmtT(m){var h=Math.floor(m/60),mm=m%60,ap=h>=12?"pm":"am";h=h%12||12;return h+(mm?":"+(mm<10?"0":"")+mm:"")+" "+ap}
window.RBopen=openState;

/* ---------- paint: rewrite every button from config ---------- */
function paint(){
  var cur=getLoc();
  document.querySelectorAll("[data-loc-label]").forEach(function(el){el.textContent=cur?cur.name:(el.getAttribute("data-empty")||"Choose location")});
  document.querySelectorAll("[data-order]").forEach(function(a){
    var kind=a.getAttribute("data-order"),lid=a.getAttribute("data-loc"),loc=lid?byId[lid]:cur,item=a.getAttribute("data-item");
    if(!loc){a.setAttribute("href",BASE+(window.RB_ORDER_PATH||"/order/"));a.removeAttribute("aria-disabled");return}
    var u=resolve(kind,loc,item);
    if(u){a.setAttribute("href",withUtm(u,a.getAttribute("data-placement")||kind));a.removeAttribute("aria-disabled");a.setAttribute("rel","noopener");
      if(a.hasAttribute("data-unavail-label")&&a.dataset.origLabel){a.textContent=a.dataset.origLabel}}
    else{a.setAttribute("href",BASE+(window.RB_ORDER_PATH||"/order/"));
      if(kind==="item"||kind==="delivery"||kind==="gift"||kind==="rewards"){a.setAttribute("aria-disabled","true");if(a.hasAttribute("data-unavail-label")){a.dataset.origLabel=a.dataset.origLabel||a.textContent;a.textContent=a.getAttribute("data-unavail-label")}}}
  });
  // menu availability + prices
  document.querySelectorAll("[data-menu-item]").forEach(function(c){
    var it=ITEMS[c.getAttribute("data-menu-item")],pr=c.querySelector("[data-price]"),av=c.querySelector("[data-avail]");if(!it)return;
    if(!cur){c.classList.remove("unavail");if(pr)pr.textContent=pr.getAttribute("data-default");if(av)av.textContent="";return}
    var x=it.l[cur.id];c.classList.toggle("unavail",!x);
    if(pr)pr.textContent=x?(x[1]||""):"";
    if(av)av.textContent=x?"":"Not on the "+cur.name+" menu";
  });
  // catering call buttons: use the chosen store's catering line (Westminster has its own); default is the main catering line
  document.querySelectorAll("a[data-cater-call]").forEach(function(a){var lid=a.getAttribute("data-loc"),l=lid?byId[lid]:cur;var ph=(l&&(l.cateringPhone||l.phone))||CFG.brand.cateringPhone;if(!a.dataset.origLabel)a.dataset.origLabel=a.textContent;a.setAttribute("href","tel:+1"+ph.replace(/\D/g,""));if(/^Call to order/.test(a.dataset.origLabel))a.textContent="Call to order "+ph});
  document.querySelectorAll("[data-open-status]").forEach(function(el){var l=byId[el.getAttribute("data-open-status")];var s=l&&openState(l);if(s){el.textContent=s.label;el.className="status "+(s.open?"open":"closed");el.hidden=false}else{el.hidden=true}});
  document.querySelectorAll("[data-loc-only]").forEach(function(el){var ids=el.getAttribute("data-loc-only").split(" ");el.hidden=!!cur&&ids.indexOf(cur.id)<0});
}
window.RBpaint=paint;

/* ---------- selector modal ---------- */
var modal,pending=null;
function buildModal(){
  modal=document.createElement("div");modal.className="modal";modal.setAttribute("role","dialog");modal.setAttribute("aria-modal","true");modal.setAttribute("aria-labelledby","locm-t");
  modal.innerHTML='<div class="modal-box"><div class="modal-head"><h2 id="locm-t">Choose your Renegade</h2><button class="xbtn" type="button" aria-label="Close">&times;</button></div>'+
  '<p class="small muted mb0" id="locm-why">Pick a restaurant and we will send you to its online ordering page. We remember your choice for this visit.</p>'+
  '<div class="menu-tools" style="margin:14px 0 0"><label class="sr" for="locm-q">Search by city, ZIP or neighborhood</label><input id="locm-q" type="search" placeholder="Search city, ZIP or neighborhood" autocomplete="off" style="flex:1 1 200px;min-height:46px;border-radius:999px;border:2px solid var(--line-l);padding:0 16px;font:inherit">'+
  '<button class="btn btn-sm btn-ghost" type="button" data-geo>Use my location</button></div><p class="xs muted" data-geo-msg aria-live="polite"></p><div class="loclist" role="list"></div></div>';
  document.body.appendChild(modal);
  modal.addEventListener("click",function(e){if(e.target===modal||e.target.closest(".xbtn"))closeModal()});
  modal.addEventListener("keydown",function(e){if(e.key==="Escape")closeModal()});
  modal.querySelector("#locm-q").addEventListener("input",function(){renderList(this.value)});
  modal.querySelector("[data-geo]").addEventListener("click",function(){geoSort(modal.querySelector("[data-geo-msg]"),function(){renderList(modal.querySelector("#locm-q").value)})});
  renderList("");
}
var dist={};
function renderList(q){
  q=(q||"").toLowerCase().trim();var box=modal.querySelector(".loclist"),cur=getLoc();box.innerHTML="";
  LOCS.slice().sort(function(a,b){return (dist[a.id]||0)-(dist[b.id]||0)}).forEach(function(l){
    var hay=(l.name+" "+l.city+" "+l.zip+" "+l.address+" "+(l.searchTerms||"")).toLowerCase();if(q&&hay.indexOf(q)<0)return;
    var b=document.createElement("button");b.type="button";b.className="locopt";b.setAttribute("role","listitem");b.setAttribute("aria-pressed",cur&&cur.id===l.id?"true":"false");
    b.innerHTML="<b>"+l.name+"</b>"+(dist[l.id]?'<span class="dist">'+dist[l.id].toFixed(1)+" mi</span>":'<span class="dist"></span>')+"<small>"+l.address+", "+l.city+" · "+l.format+(l.orderingEnabled?"":" · Online ordering unavailable")+"</small>";
    b.addEventListener("click",function(){var p=pending;pending=null;setLoc(l.id,p?"order_prompt":"selector");closeModal();if(p){go(p.kind,l,p.item,p.placement,p.el)}});
    box.appendChild(b)});
  if(!box.children.length)box.innerHTML='<p class="small">No match. Try a city such as Arvada, Thornton, Westminster, Denver or Lakewood.</p>';
}
function geoSort(msg,cb){
  if(!navigator.geolocation){msg.textContent="Location is not available in this browser.";return}
  msg.textContent="Finding the closest Renegade…";
  navigator.geolocation.getCurrentPosition(function(p){LOCS.forEach(function(l){dist[l.id]=hav(p.coords.latitude,p.coords.longitude,l.lat,l.lng)});msg.textContent="Sorted by distance (straight-line).";cb&&cb()},function(){msg.textContent="We couldn't get your location. Search by city instead."},{timeout:8000,maximumAge:600000});
}
window.RBgeoSort=geoSort;window.RBdist=dist;
function hav(a,b,c,d){var R=3958.8,r=Math.PI/180,x=Math.sin((c-a)*r/2),y=Math.sin((d-b)*r/2);var h=x*x+Math.cos(a*r)*Math.cos(c*r)*y*y;return 2*R*Math.asin(Math.sqrt(h))}
var lastFocus=null;
function openModal(why){if(!modal)buildModal();lastFocus=document.activeElement;modal.querySelector("#locm-why").textContent=why||"Pick a restaurant and we will send you to its online ordering page. We remember your choice for this visit.";renderList("");modal.classList.add("on");setTimeout(function(){modal.querySelector("#locm-q").focus()},30)}
function closeModal(){if(modal){modal.classList.remove("on");pending=null;lastFocus&&lastFocus.focus&&lastFocus.focus()}}
window.RBopenSelector=openModal;

/* ---------- go to online ordering ---------- */
var EV={order:"order_online_click",pickup:"order_pickup_click",delivery:"order_delivery_click",item:"order_item_click",gift:"gift_card_click",rewards:"rewards_click"};
function go(kind,loc,item,placement,el){
  var u=resolve(kind,loc,item);
  if(!u){notAvail(kind,loc);return}
  u=withUtm(u,placement||kind);
  var p={location_id:loc.id,location_name:loc.name,placement:placement||"",link_url:u,ordering_provider:"toast"};if(item)p.item_id=item;
  track(EV[kind]||"order_online_click",p);
  if(kind!=="order"&&kind!=="gift"&&kind!=="rewards")track("order_online_click",Object.assign({order_type:kind},p));
  window.location.href=u;
}
function notAvail(kind,loc){
  if(!modal)buildModal();
  var msg=kind==="item"?"This item isn't on the "+loc.name+" online menu. Browse the full "+loc.name+" menu instead, or choose another location.":
   kind==="delivery"?"Delivery isn't currently enabled for "+loc.name+" online. Choose pickup or call "+loc.phone+".":
   kind==="gift"?"Digital gift cards aren't available online for "+loc.name+" yet. Choose another location's gift card page or ask in store.":
   kind==="rewards"?"Online rewards sign-up isn't active for "+loc.name+" yet.":
   "Online ordering isn't available for "+loc.name+" right now. Please call "+loc.phone+".";
  openModal(msg);
}
document.addEventListener("click",function(e){
  var a=e.target.closest("[data-order]");
  if(a){if(e.metaKey||e.ctrlKey||e.shiftKey||e.button===1){var l0=a.getAttribute("data-loc")?byId[a.getAttribute("data-loc")]:getLoc();if(l0)return;}
    e.preventDefault();var kind=a.getAttribute("data-order"),lid=a.getAttribute("data-loc"),loc=lid?byId[lid]:getLoc(),item=a.getAttribute("data-item"),pl=a.getAttribute("data-placement");
    if(lid&&!getLoc())try{sessionStorage.setItem(LOC_KEY,lid)}catch(x){}
    if(!loc){pending={kind:kind,item:item,placement:pl,el:a};openModal(null);return}
    go(kind,loc,item,pl,a);return}
  var c=e.target.closest("[data-choose-loc]");if(c){e.preventDefault();openModal();return}
  var t=e.target.closest('a[href^="tel:"]');if(t){var cc=t.hasAttribute("data-cater-call");track(cc?"catering_call_click":"phone_click",{location_id:t.getAttribute("data-loc")||(cc&&getLoc()?getLoc().id:""),placement:t.getAttribute("data-placement")||"",link_url:t.href})}
  var d=e.target.closest("a[data-directions]");if(d){track("directions_click",{location_id:d.getAttribute("data-directions"),link_url:d.href})}
  var ev=e.target.closest("[data-ev]");if(ev){track(ev.getAttribute("data-ev"),{link_url:ev.href||"",location_id:ev.getAttribute("data-loc")||"",placement:ev.getAttribute("data-placement")||""})}
  // nav dropdowns
  var dd=e.target.closest(".dd>button");document.querySelectorAll(".dd.open").forEach(function(x){if(!dd||x!==dd.parentNode){x.classList.remove("open");x.querySelector("button").setAttribute("aria-expanded","false")}});
  if(dd){var open=dd.parentNode.classList.toggle("open");dd.setAttribute("aria-expanded",open?"true":"false")}
  var bg=e.target.closest(".burger");if(bg){var m=document.querySelector(".mnav"),o=m.classList.toggle("open");bg.setAttribute("aria-expanded",o?"true":"false");document.body.style.overflow=o?"hidden":"";document.body.classList.toggle("nav-open",o);if(o){var hd=document.querySelector(".hdr");m.style.top=hd.offsetHeight+"px";m.style.height=(window.innerHeight-hd.getBoundingClientRect().bottom)+"px"}}
});
document.addEventListener("keydown",function(e){if(e.key==="Escape"){document.querySelectorAll(".dd.open").forEach(function(x){x.classList.remove("open")})}});
// hero / page choosers: <form data-chooser><select>…</select></form>
document.querySelectorAll("form[data-chooser]").forEach(function(f){
  var s=f.querySelector("select"),cur=getLoc();if(cur)s.value=cur.id;
  s.addEventListener("change",function(){if(s.value)setLoc(s.value,"chooser")});
  f.addEventListener("submit",function(e){e.preventDefault();if(!s.value){s.focus();s.setAttribute("aria-invalid","true");return}
    setLoc(s.value,"chooser");go(f.getAttribute("data-kind")||"order",byId[s.value],null,f.getAttribute("data-placement")||"chooser")})
});
// location finder page
var finder=document.querySelector("[data-finder]");
if(finder){var fq=finder.querySelector("input[type=search]"),cards=document.querySelectorAll("[data-loc-card]"),fm=finder.querySelector("[data-geo-msg]");
  function filt(){var q=(fq.value||"").toLowerCase().trim(),n=0;cards.forEach(function(c){var ok=!q||c.getAttribute("data-search").indexOf(q)>=0;c.hidden=!ok;if(ok)n++});finder.querySelector("[data-count]").textContent=n+" of "+cards.length+" locations"}
  fq.addEventListener("input",filt);
  finder.querySelector("[data-geo]").addEventListener("click",function(){geoSort(fm,function(){var g=document.querySelector("[data-loc-grid]");Array.prototype.slice.call(cards).sort(function(a,b){return dist[a.getAttribute("data-loc-card")]-dist[b.getAttribute("data-loc-card")]}).forEach(function(c){g.appendChild(c);var s=c.querySelector("[data-dist]");if(s)s.textContent=dist[c.getAttribute("data-loc-card")].toFixed(1)+" mi away"})})});
}
// menu search
var ms=document.querySelector("[data-menu-search]");
if(ms){ms.addEventListener("input",function(){var q=ms.value.toLowerCase().trim(),n=0;document.querySelectorAll("[data-menu-item]").forEach(function(c){var ok=!q||c.getAttribute("data-s").indexOf(q)>=0;c.hidden=!ok;if(ok)n++});document.querySelectorAll("[data-menu-sec]").forEach(function(s){s.hidden=!s.querySelector("[data-menu-item]:not([hidden])")});var o=document.querySelector("[data-menu-count]");if(o)o.textContent=q?n+" items match":""})}
(function(){var m=location.hash.match(/loc=([a-z]+)/);if(m&&byId[m[1]])setLoc(m[1],"url_hash")})();
var hu=document.querySelector("[data-hide-unavail]");if(hu){hu.addEventListener("change",function(){document.body.classList.toggle("hide-unavail",hu.checked)})}
// promotions: hide expired / not-yet-started (Denver date)
(function(){var today=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Denver"}).format(new Date());
  document.querySelectorAll("[data-promo]").forEach(function(p){var s=p.getAttribute("data-start"),e=p.getAttribute("data-end");if((s&&today<s)||(e&&today>e))p.remove()});
  document.querySelectorAll("[data-promo-wrap]").forEach(function(w){if(!w.querySelector("[data-promo]")){var em=w.querySelector("[data-promo-empty]");if(em)em.hidden=false}});
})();
if(document.documentElement.classList.contains("rb-preview")){var pb=document.querySelector(".previewbar");if(pb)pb.classList.add("on")}

// sticky mobile order bar: only after the hero (and its order box) scrolls away
(function(){var bar=document.querySelector("[data-sticky-order]"),h=document.querySelector(".hero");if(!bar)return;
  if(!h||!("IntersectionObserver" in window)){bar.classList.add("show");return}
  new IntersectionObserver(function(es){es.forEach(function(x){bar.classList.toggle("show",!x.isIntersecting)})},{rootMargin:"0px 0px -40px 0px"}).observe(h)})();
// menu hub: highlight the category in view, collapse long categories on phones
(function(){var tabs=document.querySelectorAll(".mtabs a[data-spy]");if(tabs.length&&"IntersectionObserver" in window){
  var map={};tabs.forEach(function(a){map[a.getAttribute("data-spy")]=a});
  var io=new IntersectionObserver(function(es){es.forEach(function(x){if(!x.isIntersecting)return;tabs.forEach(function(a){a.removeAttribute("aria-current")});var a=map[x.target.id];if(a){a.setAttribute("aria-current","true");var w=a.parentNode;w.scrollTo({left:a.offsetLeft-w.clientWidth/2+a.offsetWidth/2,behavior:"smooth"})}})},{rootMargin:"-40% 0px -55% 0px"});
  document.querySelectorAll("[data-menu-sec][id]").forEach(function(sct){io.observe(sct)})}
  document.querySelectorAll("[data-menu-sec][data-collapse]").forEach(function(sct){var n=sct.querySelectorAll("[data-menu-item]").length;if(n<=6)return;
    sct.classList.add("collapsed");var b=document.createElement("button");b.type="button";b.className="btn btn-dark btn-sm more-btn";b.textContent="Show all "+n+" items";
    b.addEventListener("click",function(){sct.classList.remove("collapsed");b.remove()});sct.querySelector(".grid").after(b)});
  var q=document.querySelector("[data-menu-search]");if(q)q.addEventListener("input",function(){document.querySelectorAll(".collapsed").forEach(function(x){x.classList.remove("collapsed");var b=x.querySelector(".more-btn");if(b)b.remove()})});
})();
// review carousel arrows
document.querySelectorAll("[data-rail]").forEach(function(w){var r=w.querySelector(".rail");w.querySelectorAll("[data-rail-dir]").forEach(function(b){b.addEventListener("click",function(){r.scrollBy({left:(+b.getAttribute("data-rail-dir"))*r.clientWidth*0.85,behavior:"smooth"})})})});
paint();
})();
