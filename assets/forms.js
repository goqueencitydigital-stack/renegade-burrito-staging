/* Forms: catering quote, fundraising, contact, careers + catering estimate calculator.
   No payments are collected. Catering is ordered by phone or with this quote request; it is not sold online.
   Delivery: every form posts to brand.formEndpoint (FormSubmit) addressed to brand.formTo with brand.formCc copied.
   If the post fails, the guest gets a pre-filled email to the same addresses plus the store phone. */
(function(){
"use strict";
var CFG=window.RB_ACTIVE_CONFIG||window.RB_CONFIG,byId={};CFG.locations.forEach(function(l){byId[l.id]=l});
function val(f,n){var el=f.elements[n];return el?(el.value||"").trim():""}
function bad(field,on,msg){var w=field.closest(".field");if(!w)return;w.classList.toggle("bad",on);var e=w.querySelector(".err");if(e&&msg)e.textContent=msg;field.setAttribute("aria-invalid",on?"true":"false")}
function validate(f){var ok=true,first=null;
  f.querySelectorAll("[required]").forEach(function(el){var v=(el.value||"").trim(),b=!v;
    if(!b&&el.type==="email")b=!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
    if(!b&&el.type==="tel")b=v.replace(/\D/g,"").length<10;
    if(!b&&el.type==="number"){var n=+v;b=isNaN(n)||(el.min&&n<+el.min)||(el.max&&n>+el.max)}
    if(!b&&el.type==="date"){var today=new Date().toISOString().slice(0,10);b=v<today}
    bad(el,b);if(b){ok=false;first=first||el}});
  if(first)first.focus();return ok}
document.querySelectorAll("form[data-lead]").forEach(function(f){
  f.setAttribute("novalidate","");
  f.querySelectorAll("input,select,textarea").forEach(function(el){el.addEventListener("blur",function(){if(el.hasAttribute("required")&&el.getAttribute("aria-invalid")==="true")validate(f)})});
  var lsel=f.elements["location"];
  var qp=new URLSearchParams(location.search),ql=qp.get("loc");
  if(lsel){if(ql&&byId[ql]&&!lsel.value)lsel.value=ql;var cur=window.RBgetLoc&&window.RBgetLoc();if(cur&&!lsel.value)lsel.value=cur.id}
  f.addEventListener("submit",function(e){e.preventDefault();
    if(f.elements["company_website"]&&f.elements["company_website"].value)return; // honeypot
    if(!validate(f))return;
    var type=f.getAttribute("data-lead"),loc=lsel&&byId[lsel.value],data={};
    Array.prototype.forEach.call(f.elements,function(el){if(el.name&&el.name!=="company_website")data[el.name]=el.value});
    data.lead_type=type;data.page=location.pathname;data.submitted_at=new Date().toISOString();
    var to=CFG.brand.formTo||"bharris@renegadeburrito.com",cc=(CFG.brand.formCc||[]).join(",");
    var ev={catering:"catering_form_submit",fundraising:"fundraising_form_submit",contact:"contact_form_submit",careers:"job_application_submit",private_event:"private_event_form_submit"}[type]||"form_submit";
    window.RBtrack&&window.RBtrack(ev,{location_id:loc?loc.id:"",lead_type:type,guests:data.guests||""});
    var box=document.getElementById(f.getAttribute("data-confirm")),lines=Object.keys(data).filter(function(k){return data[k]&&["page","submitted_at","lead_type"].indexOf(k)<0}).map(function(k){return k.replace(/_/g," ")+": "+(k==="location"&&byId[data[k]]?byId[data[k]].name:data[k])});
    var subj=(type==="catering"?"Catering quote request":type==="fundraising"?"Fundraiser request":type==="private_event"?"Private event inquiry":"Website message")+(loc?" — "+loc.name:"")+(data.event_date?" — "+data.event_date:"");
    function done(sent){f.hidden=true;box.classList.add("on");box.querySelector("[data-summary]").textContent=lines.join("\n");
      var mail=box.querySelector("[data-mailto]"),ph=box.querySelector("[data-phone]");
      if(mail){if(!sent&&to){mail.href="mailto:"+to+"?cc="+encodeURIComponent(cc)+"&subject="+encodeURIComponent(subj)+"&body="+encodeURIComponent(lines.join("\n")+"\n\nSent from "+location.href);mail.hidden=false;mail.textContent="Email this request to Renegade Burrito"}else mail.hidden=true}
      var phone=loc&&(loc.cateringPhone||loc.phone);if(ph&&phone){ph.href="tel:"+phone.replace(/\D/g,"");ph.textContent="Call "+(loc.name)+" "+phone;ph.hidden=false}
      var st=box.querySelector("[data-status]");if(st)st.textContent=sent?"Your request was sent to the Renegade Burrito team.":"Almost done: tap “Email this request” below to send it (your email app opens with everything filled in), or call the restaurant.";
      box.focus()}
    var ep=CFG.brand.formEndpoint;
    if(ep){var payload=Object.assign({},data);if(loc)payload.location=loc.name;
      payload._subject=subj;payload._cc=cc;payload._template="table";payload._captcha="false";if(data.email)payload._replyto=data.email;
      var btn=f.querySelector("[type=submit]"),lbl=btn?btn.textContent:"",fin=false;
      if(btn){btn.disabled=true;btn.setAttribute("aria-busy","true");btn.textContent="Sending…"}
      var live=f.querySelector("[data-sending]");if(!live){live=document.createElement("p");live.setAttribute("data-sending","");live.setAttribute("role","status");live.className="sending-note";btn&&btn.insertAdjacentElement("afterend",live)}
      live.textContent="Sending your request…";
      function finish(ok){if(fin)return;fin=true;clearTimeout(tm);if(btn){btn.disabled=false;btn.removeAttribute("aria-busy");btn.textContent=lbl}live.textContent="";done(ok)}
      var ac=window.AbortController?new AbortController():null,tm=setTimeout(function(){ac&&ac.abort();finish(false)},10000);
      payload._site="restaurant";var gas=/script\.google\.com/.test(ep);
      fetch(ep,{method:"POST",headers:gas?{"Content-Type":"text/plain;charset=utf-8"}:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify(payload),redirect:"follow",signal:ac?ac.signal:undefined})
        .then(function(r){return r.json().catch(function(){return {}}).then(function(j){return r.ok&&String(j.success)==="true"})})
        .then(finish).catch(function(){finish(false)})}else done(false);
  });
});
/* ---------- catering estimate calculator ---------- */
var calc=document.querySelector("[data-calc]");
if(calc){var P=window.RB_CATER||{},f=calc;
  function money(n){return "$"+n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,",")}
  function run(ev){var loc=f.elements["calc_location"].value,pk=f.elements["calc_package"].value,g=parseInt(f.elements["calc_guests"].value,10)||0;
    var out=f.querySelector("[data-calc-out]"),note=f.querySelector("[data-calc-note]"),order=f.querySelector("[data-calc-order]");
    order.setAttribute("data-loc",loc||"");if(window.RBpaint)window.RBpaint();
    if(!loc||!pk){out.textContent="—";note.textContent="Choose a location and a package to see an estimate.";return}
    var p=(P[loc]||{})[pk];
    if(!p){out.textContent="Quote";note.textContent="This package isn't listed with per-person pricing on the "+byId[loc].name+" menu. Request a quote and the team will price it for you.";return}
    if(p.perPerson===null){out.textContent="Quote";note.textContent=p.note;return}
    var min=p.min||0,warn="";if(g<min){warn=" Minimum is "+min+" guests for this package."}
    var sub=p.perPerson*Math.max(g,0),add=0;
    f.querySelectorAll("[data-addon]:checked").forEach(function(a){var ap=(P[loc]||{})[a.value];if(ap&&ap.perPack){add+=ap.perPack*Math.ceil(g/(ap.serves||10))}});
    out.textContent=money(sub+add);
    note.textContent="Estimate only: "+g+" guests × "+money(p.perPerson)+" ("+p.label+", "+byId[loc].name+" listed price as of "+(P._asOf||"")+")"+(add?" + add-ons "+money(add):"")+". Excludes tax, delivery and setup fees, which the restaurant quotes. Final price and availability are confirmed by Renegade Burrito."+warn;
    if(ev&&ev.type==="change")window.RBtrack&&window.RBtrack("catering_estimate",{location_id:loc,package:pk,guests:g});
  }
  f.addEventListener("input",function(){run()});f.addEventListener("change",run);
  var cur=window.RBgetLoc&&window.RBgetLoc();if(cur)f.elements["calc_location"].value=cur.id;run();
}
})();
