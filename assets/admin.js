/* Renegade Burrito website settings (staging admin).
   Edits per-location Toast links and store details plus promotions.
   "Preview" stores the edited config in this browser (localStorage rb_admin_preview);
   every page's app.js reads it, so all buttons for that store update at once.
   "Export" downloads JSON that replaces data/locations.json / data/promotions.json for publishing. */
(function(){
"use strict";
var KEY="rb_admin_preview";
var base=JSON.parse(JSON.stringify(window.RB_CONFIG));
var cfg=base;try{var pv=localStorage.getItem(KEY);if(pv){var o=JSON.parse(pv);if(o&&o.locations)cfg=o}}catch(e){}
cfg=JSON.parse(JSON.stringify(cfg));
var promos=JSON.parse(JSON.stringify(window.RB_PROMOS||{promotions:[]}));
var ALLOWED=cfg.brand.allowedOrderDomains||["toasttab.com","toast.site"];
var DAYS=["sun","mon","tue","wed","thu","fri","sat"];
var $=function(id){return document.getElementById(id)};
function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
function okUrl(u){if(!u)return true;try{var x=new URL(u),h=x.hostname;return x.protocol==="https:"&&ALLOWED.some(function(d){return h===d||h.slice(-d.length-1)==="."+d})}catch(e){return false}}
function hm(m){if(m==null||m==="")return"";var h=Math.floor(m/60),n=m%60;return(h<10?"0":"")+h+":"+(n<10?"0":"")+n}
function mh(s){if(!s)return null;var p=s.split(":");return +p[0]*60+ +p[1]}
function msg(t,bad){var m=$("ad-msg");m.textContent=t;m.style.color=bad?"#a3161b":"";}
var TF=[["orderUrl","Order online URL (main)"],["pickupUrl","Pickup URL"],["deliveryUrl","Delivery URL"],["giftCardUrl","Digital gift card URL"],["rewardsUrl","Rewards sign-up URL"]];
function field(id,label,val,type,extra){return '<div class="field'+(type==="url"?" full":"")+'"><label for="'+id+'">'+label+'</label><input id="'+id+'" type="'+(type||"text")+'" value="'+esc(val)+'"'+(extra||"")+'><div class="err">Must be an https link on '+ALLOWED.join(" or ")+'.</div></div>'}
function chk(id,label,val){return '<label class="small" style="display:block;margin:4px 0"><input type="checkbox" id="'+id+'"'+(val?" checked":"")+'> '+label+'</label>'}
function renderLocs(){
  $("ad-locs").innerHTML=cfg.locations.map(function(l,i){
    var p="l"+i+"-",t=l.toast||{};
    var hrs=DAYS.map(function(d){var v=(l.hours||{})[d]||[];return '<div class="field"><label for="'+p+d+'o">'+d.toUpperCase()+' open / close</label><div style="display:flex;gap:6px"><input id="'+p+d+'o" type="time" value="'+hm(v[0])+'"><input id="'+p+d+'c" type="time" aria-label="'+d+' close" value="'+hm(v[1])+'"></div></div>'}).join("");
    return '<details class="card" style="padding:16px"'+(i===0?" open":"")+'><summary style="cursor:pointer;font-weight:700">'+esc(l.name)+(t.orderUrl?"":' <span style="color:#a3161b">— NOT CONFIGURED</span>')+'</summary><div class="form" style="margin-top:12px">'+
      field(p+"name","Display name",l.name)+field(p+"phone","Phone",l.phone,"tel")+field(p+"address","Street address",l.address)+field(p+"zip","ZIP",l.zip)+
      field(p+"slug","Toast restaurant slug",t.slug)+
      TF.map(function(f){return field(p+f[0],f[1],t[f[0]],"url",' placeholder="https://renegadeburrito.toast.site/order/…"')}).join("")+
      field(p+"cemail","Catering email",l.cateringEmail||"","email")+field(p+"cphone","Catering phone",l.cateringPhone||"","tel")+
      '<div class="field full">'+chk(p+"oe","Online ordering enabled",l.orderingEnabled)+chk(p+"de","Delivery enabled",l.deliveryEnabled)+chk(p+"hv","Hours verified by owner (turns on “Open now”)",l.hoursVerified)+chk(p+"tv","Toast links verified in testing",t.verified)+chk(p+"to","Test order placed and confirmed",t.testOrderPlaced)+'</div>'+
      hrs+'</div></details>'}).join("");
  $("ad-locs").querySelectorAll('input[type=url]').forEach(function(inp){inp.addEventListener("input",function(){inp.closest(".field").classList.toggle("invalid",!okUrl(inp.value.trim()))})});
}
function readLocs(){
  var bad=[];
  cfg.locations.forEach(function(l,i){var p="l"+i+"-",t=l.toast=l.toast||{};
    l.name=$(p+"name").value.trim();l.phone=$(p+"phone").value.trim();l.address=$(p+"address").value.trim();l.zip=$(p+"zip").value.trim();
    t.slug=$(p+"slug").value.trim();
    TF.forEach(function(f){var v=$(p+f[0]).value.trim();if(!okUrl(v)){bad.push(l.name+" "+f[1]);$(p+f[0]).closest(".field").classList.add("invalid")}else t[f[0]]=v});
    l.cateringEmail=$(p+"cemail").value.trim();l.cateringPhone=$(p+"cphone").value.trim();
    l.orderingEnabled=$(p+"oe").checked&&!!t.orderUrl;l.deliveryEnabled=$(p+"de").checked;l.hoursVerified=$(p+"hv").checked;t.verified=$(p+"tv").checked;t.testOrderPlaced=$(p+"to").checked;
    var h={};DAYS.forEach(function(d){var o=mh($(p+d+"o").value),c=mh($(p+d+"c").value);if(o!=null&&c!=null)h[d]=[o,c]});l.hours=h;
  });
  return bad;
}
var PF=[["id","ID"],["title","Title"],["description","Description"],["type","Type"],["locations","Location IDs (comma separated)"],["start","Start (YYYY-MM-DD)"],["end","End (YYYY-MM-DD)"],["endLabel","End label"],["terms","Terms"],["ctaKind","Button type (order, item, rewards, gift)"],["item","Toast item key (for item buttons)"],["ctaLabel","Button label"],["code","Coupon code (only if honored in Toast)"]];
function renderPromos(){
  $("ad-promos").innerHTML=promos.promotions.map(function(pr,i){var p="p"+i+"-";
    return '<details class="card" style="padding:16px;margin-bottom:10px"><summary style="cursor:pointer;font-weight:700">'+esc(pr.title||"New promotion")+(pr.active&&pr.verified?"":' <span class="small muted">(hidden)</span>')+'</summary><div class="form" style="margin-top:12px">'+
      PF.map(function(f){var v=f[0]==="locations"?(pr.locations||[]).join(","):pr[f[0]];return '<div class="field'+(f[0]==="description"||f[0]==="terms"?" full":"")+'"><label for="'+p+f[0]+'">'+f[1]+'</label><input id="'+p+f[0]+'" value="'+esc(v)+'"></div>'}).join("")+
      '<div class="field full">'+chk(p+"active","Active",pr.active)+chk(p+"verified","Verified: Toast/POS can honor this offer",pr.verified)+chk(p+"cv","Coupon code verified in Toast",pr.codeVerifiedInToast)+'<button type="button" class="btn btn-sm btn-ghost" data-del="'+i+'">Delete</button></div></div></details>'}).join("");
  $("ad-promos").querySelectorAll("[data-del]").forEach(function(b){b.addEventListener("click",function(){readPromos();promos.promotions.splice(+b.getAttribute("data-del"),1);renderPromos()})});
}
function readPromos(){var bad=[];promos.promotions.forEach(function(pr,i){var p="p"+i+"-";PF.forEach(function(f){var v=$(p+f[0]).value.trim();pr[f[0]]=f[0]==="locations"?v.split(",").map(function(s){return s.trim()}).filter(Boolean):v});
  pr.active=$(p+"active").checked;pr.verified=$(p+"verified").checked;pr.codeVerifiedInToast=$(p+"cv").checked;
  if(pr.code&&!pr.codeVerifiedInToast){bad.push(pr.title+": coupon code not verified in Toast — it will not be shown")}
  if(pr.end&&!/^\d{4}-\d{2}-\d{2}$/.test(pr.end))bad.push(pr.title+": end date format");});return bad}
function download(name,obj){var b=new Blob([JSON.stringify(obj,null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=name;document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},500)}
renderLocs();renderPromos();
$("ad-preview").addEventListener("click",function(){var bad=readLocs().concat(readPromos());if(bad.filter(function(b){return b.indexOf("URL")>-1}).length){msg("Fix these before previewing: "+bad.join("; "),true);return}
  try{localStorage.setItem(KEY,JSON.stringify(cfg));localStorage.setItem(KEY+"_promos",JSON.stringify(promos))}catch(e){}
  msg("Preview saved in this browser. Open any page: every button for an edited store now uses the new Toast link. "+(bad.length?"Notes: "+bad.join("; "):""))});
$("ad-export").addEventListener("click",function(){var bad=readLocs();if(bad.length){msg("Fix invalid URLs first: "+bad.join("; "),true);return}download("locations.json",cfg);msg("locations.json downloaded. Send it to the developer or upload it to the CMS to publish.")});
$("ad-export-p").addEventListener("click",function(){var bad=readPromos();download("promotions.json",promos);msg("promotions.json downloaded."+(bad.length?" Notes: "+bad.join("; "):""))});
$("ad-clear").addEventListener("click",function(){try{localStorage.removeItem(KEY);localStorage.removeItem(KEY+"_promos")}catch(e){}cfg=JSON.parse(JSON.stringify(base));renderLocs();msg("Preview cleared. This browser now shows the published settings.")});
$("ad-addp").addEventListener("click",function(){readPromos();promos.promotions.push({id:"new-promo-"+Date.now(),title:"",description:"",locations:[],start:"",end:"",active:false,verified:false,code:"",codeVerifiedInToast:false,ctaKind:"order",ctaLabel:"Order now"});renderPromos()});
})();
