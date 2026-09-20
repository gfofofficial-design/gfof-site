"use strict";
(() => {
 const key="gf-journey-passport-v1";
 const missions=[
 ["repair-the-shuttle","Repair the Shuttle","Sera","Prepared explorer","Try a different spending plan. What would you keep in reserve?"],
 ["the-signal","The Signal That Looked Too Good","Oryn","Signal seeker","Compare a convincing promise with evidence you can check."],
 ["starport-market","The Starport Market","Kael","Market explorer","Count every cost before deciding what the sale earned."],
 ["observatory-journey","The Observatory Journey","Aela","Future planner","Try a different balance between today and your future goal."],
 ["docking-request","The Docking Request","Eno","Boundary keeper","Read each permission as if you were granting it yourself."],
 ["long-way-home","The Long Way Home","Sera","Resourceful voyager","Take another route and compare your final position."],
 ["borrowed-voice","The Borrowed Voice","Oryn","Independent thinker","Investigate a different clue before deciding whom to trust."],
 ["after-the-crowd","After the Crowd","Kael","Cost counter","Change your stock plan. Compare cash and unsold goods."],
 ["changing-course","Changing Course","Aela","Adaptable planner","Try another pace after the surprise expense."],
 ["keys-to-the-gate","Keys to the Gate","Eno","Access explorer","Compare disconnecting with revoking permission."],
 ["meridian-relay","The Meridian Relay","Crew","Crew companion","Replay the other market scenario and compare the ledger."]
 ];
 const ids=missions.map(m=>m[0]);
 function clean(value){return Array.isArray(value)?[...new Set(value.filter(x=>ids.includes(x)))]:[];}
 function read(){try{const v=JSON.parse(localStorage.getItem(key)||"null");return {enabled:v?.enabled===true,done:clean(v?.done),available:true};}catch{return {enabled:false,done:[],available:false};}}
 function session(){const done=[];try{const v=JSON.parse(sessionStorage.getItem("gf-journey-v1")||"[]");if(Array.isArray(v))for(const i of v)if(Number.isInteger(i)&&i>=0&&i<5)done.push(ids[i]);}catch{}
 for(const id of ids.slice(5))try{if(sessionStorage.getItem("gf-journey-"+id+"-v1")==="complete")done.push(id);}catch{}return clean(done);}
 function write(done){try{localStorage.setItem(key,JSON.stringify({enabled:true,done:clean(done)}));return true;}catch{return false;}}
 function enable(){const previous=read();return write([...previous.done,...session()]);}
 function mark(id){if(!ids.includes(id))return false;const previous=read();const saved=previous.enabled&&write([...previous.done,id]);if(saved&&typeof document!=="undefined"){let notice=document.getElementById("passport-earned");if(!notice){notice=document.createElement("p");notice.id="passport-earned";notice.className="passport-earned";notice.setAttribute("role","status");(document.getElementById("completed")||document.getElementById("completion")||document.getElementById("complete")||document.querySelector("main"))?.append(notice);}notice.textContent="✦ "+missions.find(m=>m[0]===id)[3]+" badge saved in your explorer passport. ";const link=document.createElement("a");link.href="./#passport-title";link.textContent="View your collection →";notice.append(link);}return saved;}
 function sync(){const previous=read();if(previous.enabled&&!write([...previous.done,...session()]))return {...previous,available:false};return read();}
 function forget(){try{localStorage.removeItem(key);return true;}catch{return false;}}
 globalThis.FederationPassport=Object.freeze({key,missions,read,session,enable,mark,sync,forget});
})();
