/* ===== app core: storage, router, engine client, list screens ===== */
var APP_VERSION='v1.2';
var $=function(id){return document.getElementById(id);};
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
function toast(t){var el=$('toast');el.textContent=t;el.classList.add('on');clearTimeout(toast.t);toast.t=setTimeout(function(){el.classList.remove('on');},2200);}
function sheet(html){$('sheetBox').innerHTML=html;$('sheet').classList.add('on');}
function closeSheet(){$('sheet').classList.remove('on');}
$('sheet').addEventListener('click',function(e){if(e.target.id==='sheet')closeSheet();});

var LEVELS=[
 {n:'入門',r:800,maxDepth:1,time:300,noise:90},
 {n:'簡單',r:1000,maxDepth:2,time:500,noise:30},
 {n:'普通',r:1200,maxDepth:4,time:800,noise:0},
 {n:'困難',r:1400,maxDepth:30,time:1500,noise:0},
 {n:'大師',r:1600,maxDepth:30,time:3000,noise:0},
 {n:'特級',r:1800,maxDepth:30,time:6000,noise:0},
 {n:'宗師',r:2000,maxDepth:30,time:12000,noise:0}];
var COACH_T=1200;

/* ----- profile (local; mirrored online when available) ----- */
var P;
function defaultProfile(){return {name:'',rating:1200,games:0,wins:0,losses:0,draws:0,weak:{},placement:null,lessons:{},puzzles:{},records:[],setup:{level:3,side:0,coach:1},reviewed:0};}
function loadP(){try{P=JSON.parse(localStorage.getItem('xqdojo')||'null');}catch(e){P=null;}P=Object.assign(defaultProfile(),P||{});}
function saveP(){try{localStorage.setItem('xqdojo',JSON.stringify(P));}catch(e){}if(window.Online&&Online.ready)Online.syncProfile();}
loadP();

function elo(ra,rb,score,k){var ea=1/(1+Math.pow(10,(rb-ra)/400));return Math.round((k||32)*(score-ea));}
function addRecord(rec){
  rec.date=Date.now();P.records.unshift(rec);if(P.records.length>150)P.records.length=150;
  if(rec.rated){P.games++;if(rec.score===1)P.wins++;else if(rec.score===0)P.losses++;else P.draws++;}
  saveP();if(window.Online&&Online.ready)Online.saveGame(rec);
}

/* ----- engine client (web worker, with main-thread fallback) ----- */
function Eng(){this.w=null;this.cb={};this.id=0;this.fail=false;}
Eng.prototype.get=function(){
  if(this.w||this.fail)return this.w;var s=this;
  try{this.w=new Worker('js/worker.js?v='+APP_VERSION);this.w.onmessage=function(e){var c=s.cb[e.data.id];delete s.cb[e.data.id];if(c)c(e.data);};this.w.onerror=function(){s.fail=true;s.w=null;};}
  catch(e){this.fail=true;this.w=null;}
  return this.w;
};
Eng.prototype.run=function(msg){var s=this;return new Promise(function(res){var id=++s.id;msg.id=id;var w=s.get();
  if(w){s.cb[id]=res;w.postMessage(msg);}
  else setTimeout(function(){var r=msg.cmd==='mate'?{moves:mateMoves(msg.board,msg.side,msg.n,msg.time)}:think(msg.board,msg.side,msg.opts);res(r);},20);});};
Eng.prototype.reset=function(){if(this.w){this.w.terminate();this.w=null;}var cb=this.cb;this.cb={};Object.keys(cb).forEach(function(k){cb[k](null);});};
var aiEng=new Eng(),coachEng=new Eng();

/* ----- router ----- */
var TITLES={home:'象棋道場',setup:'對弈電腦',game:'對局',lessons:'我的課程',lesson:'課程',puzzles:'殺法練習',classics:'名局欣賞',rank:'英雄榜',records:'我的戰績',friend:'好友對戰',profile:'設定',online:'線上玩家'};
var curView='home';
function go(v,title){
  curView=v;document.querySelectorAll('.view').forEach(function(el){el.classList.toggle('on',el.id==='v-'+v);});
  $('title').textContent=title||TITLES[v]||'象棋道場';$('backBtn').style.visibility=v==='home'?'hidden':'visible';
  window.scrollTo(0,0);
  if(v==='home')renderHome();else if(v==='setup')renderSetup();else if(v==='lessons')renderLessons();else if(v==='puzzles')renderPuzzles();
  else if(v==='classics')renderClassics();else if(v==='records')renderRecords();else if(v==='rank')renderRank();else if(v==='friend')renderFriend();else if(v==='profile')renderProfile();else if(v==='online')renderOnline();
  if(window.Online&&Online.ready&&Online.ping)Online.ping(v==='game'?'playing':'idle');
  try{if(v!=='game'&&v!=='lesson'&&location.hash!=='#'+v)history.replaceState(null,'','#'+v);}catch(e){}
}
$('backBtn').onclick=function(){if(curView==='game'&&window.Game)Game.leave();else if(curView==='lesson')go('lessons');else go('home');};
document.querySelectorAll('[data-go]').forEach(function(b){b.onclick=function(){go(b.getAttribute('data-go'));};});

function renderHome(){
  var rt=P.rating;
  $('profileCard').innerHTML='<div class="name">'+(esc(P.name)||'訪客')+'</div><div class="rt">'+rt+'</div><div class="sub">Rating・正式對局 '+P.games+' 盤（'+P.wins+' 勝 '+P.losses+' 負 '+P.draws+' 和）</div>';
  $('meChip').textContent=P.name?P.name+' '+rt:'';
  var rec=recommend();$('lessonHint').textContent=rec.length?'推薦：'+rec[0].title:'程度測驗・個人化推薦';
  $('onlineState').innerHTML=esc(window.Online&&Online.ready?'已連線：英雄榜與好友對戰可用':(window.Online&&Online.reason?Online.reason:'離線模式'))+'<div class="ver">象棋道場 '+APP_VERSION+'</div>';
  var oc=$('onlineChip');if(window.Online&&Online.ready&&Online.onlineUsers){oc.style.display='flex';oc.innerHTML='<span class="dot"></span>目前在線…';
    Online.onlineUsers().then(function(l){oc.innerHTML='<span class="dot"></span>目前在線 '+l.length+' 人　<span style="font-weight:400;font-size:15px">點我看名單 ›</span>';}).catch(function(){oc.style.display='none';});}else oc.style.display='none';
  if(!P.name)askName();
}
function askName(cb){
  sheet('<h2>你的暱稱</h2><p class="sub" style="color:#8a7458;font-size:13px">會顯示在英雄榜和好友對戰中（最多 12 字）</p><input type="text" id="nameIn" maxlength="12" value="'+esc(P.name)+'" placeholder="例如：善化棋王"><button class="big primary" id="nameOk">確定</button>');
  $('nameOk').onclick=function(){var v=$('nameIn').value.trim().slice(0,12);if(!v){toast('請輸入暱稱');return;}P.name=v;saveP();closeSheet();renderHome();if(cb)cb();};
}

/* ----- setup vs AI ----- */
function renderSetup(){
  var st=P.setup;
  $('levelList').innerHTML=LEVELS.map(function(l,i){return '<button class="chip'+(i===st.level?' on':'')+'" data-lv="'+i+'">'+l.n+'<small>'+l.r+'</small></button>';}).join('');
  $('levelList').querySelectorAll('[data-lv]').forEach(function(b){b.onclick=function(){st.level=+b.getAttribute('data-lv');saveP();renderSetup();};});
  $('sideChips').querySelectorAll('[data-side]').forEach(function(b){b.classList.toggle('on',+b.getAttribute('data-side')===st.side);b.onclick=function(){st.side=+b.getAttribute('data-side');saveP();renderSetup();};});
  $('modeChips').querySelectorAll('[data-coach]').forEach(function(b){b.classList.toggle('on',+b.getAttribute('data-coach')===st.coach);b.onclick=function(){st.coach=+b.getAttribute('data-coach');saveP();renderSetup();};});
  var saved=null;try{saved=JSON.parse(localStorage.getItem('xq-live')||'null');}catch(e){}
  $('resumeAI').style.display=saved&&saved.moves&&saved.moves.length?'block':'none';
  $('resumeAI').onclick=function(){Game.resume(saved);};
  $('startAI').onclick=function(){Game.startAI({level:st.level,player:st.side,coach:!!st.coach});};
}

/* ----- weakness + recommendations ----- */
var WEAK_LABEL={'allowed-mate':'沒看到對方殺棋','missed-mate':'錯過自己的殺棋','hanging':'棋子被白吃','missed-win':'錯過得子機會','opening':'開局失誤','middlegame':'中局失誤','endgame':'殘局失誤'};
var WEAK_UNIT={'allowed-mate':'kill','missed-mate':'kill','hanging':'tactic','missed-win':'tactic','opening':'opening','endgame':'endgame','middlegame':'tactic'};
function recommend(){
  var out=[],done=P.lessons||{};
  if(!P.placement)return [{id:'placement',title:'程度測驗（15 題）'}];
  var weak=Object.keys(P.weak||{}).sort(function(a,b){return P.weak[b]-P.weak[a];});
  var units=[];weak.forEach(function(w){var u=WEAK_UNIT[w];if(u&&units.indexOf(u)<0)units.push(u);});
  var lvl=P.placement.level;
  if(!units.length)units=lvl<=2?['kill','tactic','opening','endgame']:['tactic','kill','endgame','opening'];
  units.forEach(function(u){LESSONS.filter(function(l){return l.unit===u&&!done[l.id];}).slice(0,2).forEach(function(l){out.push(l);});});
  return out;
}

/* ----- lessons list ----- */
function renderLessons(){
  var h='',rec=recommend(),done=P.lessons||{};
  if(P.placement)h+='<div class="note"><div class="hd">程度測驗：'+P.placement.score+' / '+P.placement.total+'</div><div class="sub">起點：'+['','入門','初級','中級','中高級','高級'][P.placement.level]+'　<a href="#" id="retest">重新測驗</a></div></div>';
  var weak=Object.keys(P.weak||{}).filter(function(k){return WEAK_LABEL[k];});
  if(weak.length){var mx=Math.max.apply(null,weak.map(function(k){return P.weak[k];}));
    h+='<h3>你的弱點（來自復盤）</h3><div class="panel">'+weak.sort(function(a,b){return P.weak[b]-P.weak[a];}).map(function(k){return '<div class="bar-row"><span class="lab">'+WEAK_LABEL[k]+'</span><span class="bar"><div style="width:'+(P.weak[k]/mx*100)+'%"></div></span><span>'+P.weak[k]+'</span></div>';}).join('')+'</div>';}
  if(rec.length){h+='<h3>推薦給你</h3><div class="list">'+rec.map(function(l){return '<button class="item" data-lesson="'+l.id+'"><span class="t"><b>'+esc(l.title)+'</b><small>'+(l.sub||'')+'</small></span><span class="badge">推薦</span></button>';}).join('')+'</div>';}
  UNITS.forEach(function(u){
    var ls=LESSONS.filter(function(l){return l.unit===u.id;}),n=ls.filter(function(l){return done[l.id];}).length;
    h+='<h3>'+u.title+'（'+n+'/'+ls.length+'）</h3><div class="list">'+ls.map(function(l){return '<button class="item" data-lesson="'+l.id+'"><span class="t"><b>'+esc(l.title)+'</b><small>'+esc(l.sub||'')+'</small></span><span class="badge'+(done[l.id]?' done':'')+'">'+(done[l.id]?'✓ 完成':'未完成')+'</span></button>';}).join('')+'</div>';
  });
  $('lessonsBox').innerHTML=h;
  $('lessonsBox').querySelectorAll('[data-lesson]').forEach(function(b){b.onclick=function(){openLesson(b.getAttribute('data-lesson'));};});
  var rt=$('retest');if(rt)rt.onclick=function(e){e.preventDefault();Game.startPlacement();};
}
function openLesson(id){
  if(id==='placement'){Game.startPlacement();return;}
  var l=LESSONS.filter(function(x){return x.id===id;})[0];if(!l)return;
  var h='<div class="panel lesson-text"><h2 style="margin-top:0">'+esc(l.title)+'</h2>'+l.text.map(function(p){return '<p>'+p+'</p>';}).join('')+'</div><div class="list" style="margin-top:12px">';
  (l.steps||[]).forEach(function(s,i){h+='<button class="item" data-step="'+i+'"><span class="t"><b>'+esc(s.label)+'</b><small>'+esc(s.sub||'')+'</small></span><span class="badge">開始</span></button>';});
  h+='</div><button class="big primary" id="lessonDone">'+(P.lessons[id]?'✓ 已完成（再標一次）':'標記為完成')+'</button>';
  $('lessonBox').innerHTML=h;go('lesson',l.title);
  $('lessonBox').querySelectorAll('[data-step]').forEach(function(b){b.onclick=function(){Game.runLessonStep(l,l.steps[+b.getAttribute('data-step')]);};});
  $('lessonDone').onclick=function(){P.lessons[id]=Date.now();saveP();toast('已完成：'+l.title);go('lessons');};
}

/* ----- puzzles list ----- */
function puzzleThemes(){var th={};PUZZLES.forEach(function(p,i){if(p.type==='win')return;var k=p.name||'綜合殺法';(th[k]=th[k]||[]).push(i);});return th;}
function tacticThemes(){var th={'全部戰術題':[]};PUZZLES.forEach(function(p,i){if(p.type!=='win')return;th['全部戰術題'].push(i);['捉雙','抽將','將軍','吃'].some(function(t){if(p.tags.join('').indexOf(t)>=0){var k=t==='吃'?'吃子得利':t==='將軍'?'將軍得子':t;(th[k]=th[k]||[]).push(i);return true;}});});return th;}
function renderPuzzles(){
  var th=puzzleThemes(),tt=tacticThemes(),solved=P.puzzles||{},h='<div class="note"><div class="hd">共 '+PUZZLES.length+' 題・已解 '+Object.keys(solved).length+' 題</div><div class="sub">殺法題：引擎驗證為唯一解的強制殺棋。戰術題：引擎驗證只有一步能得子。</div></div>';
  h+='<h3>依步數</h3><div class="list">';
  [2,3,4].forEach(function(n){var ids=PUZZLES.map(function(p,i){return p.type!=='win'&&p.n===n?i:-1;}).filter(function(i){return i>=0;});var s=ids.filter(function(i){return solved[i];}).length;
    h+='<button class="item" data-set="n'+n+'"><span class="t"><b>'+n+' 步殺</b><small>'+ids.length+' 題</small></span><span class="badge'+(s===ids.length&&ids.length?' done':'')+'">'+s+'/'+ids.length+'</span></button>';});
  h+='</div><h3>依殺法</h3><div class="list">';
  Object.keys(th).sort(function(a,b){return th[b].length-th[a].length;}).forEach(function(k){var s=th[k].filter(function(i){return solved[i];}).length;
    h+='<button class="item" data-set="t'+k+'"><span class="t"><b>'+k+'</b><small>'+th[k].length+' 題</small></span><span class="badge'+(s===th[k].length?' done':'')+'">'+s+'/'+th[k].length+'</span></button>';});
  h+='</div><h3>戰術題（找出得子的一步）</h3><div class="list">';
  Object.keys(tt).forEach(function(k){if(!tt[k].length)return;var s=tt[k].filter(function(i){return solved[i];}).length;
    h+='<button class="item" data-set="x'+k+'"><span class="t"><b>'+k+'</b><small>'+tt[k].length+' 題</small></span><span class="badge'+(s===tt[k].length?' done':'')+'">'+s+'/'+tt[k].length+'</span></button>';});
  h+='</div>';$('puzzlesBox').innerHTML=h;
  $('puzzlesBox').querySelectorAll('[data-set]').forEach(function(b){b.onclick=function(){var k=b.getAttribute('data-set'),ids;
    if(k[0]==='n'){var n=+k.slice(1);ids=PUZZLES.map(function(p,i){return p.type!=='win'&&p.n===n?i:-1;}).filter(function(i){return i>=0;});}else if(k[0]==='x')ids=tt[k.slice(1)];else ids=th[k.slice(1)];
    var unsolved=ids.filter(function(i){return !solved[i];});Game.startPuzzleSet(unsolved.length?unsolved.concat(ids.filter(function(i){return solved[i];})):ids,k[0]==='n'?k.slice(1)+' 步殺':k.slice(1));};});
}

/* ----- classics list ----- */
function renderClassics(){
  var h='<div class="list">'+CLASSICS.map(function(g,i){return '<button class="item" data-cl="'+i+'"><span class="t"><b>'+esc(g.title)+'</b><small>'+esc(g.event)+'・'+esc(g.opening)+'・'+esc(g.result)+'</small></span><span class="badge">'+(g.moves.length)+' 步</span></button>';}).join('')+'</div>';
  h+='<h3>開局講解</h3><div class="list">'+OPENINGS.map(function(g,i){return '<button class="item" data-op="'+i+'"><span class="t"><b>'+esc(g.title)+'</b><small>'+esc(g.sub)+'</small></span><span class="badge">'+g.moves.length+' 步</span></button>';}).join('')+'</div>';
  h+='<h3>匯入棋譜</h3><button class="big" id="importBtn">📋 貼上任何棋譜，自動逐步解說</button>';
  $('classicsBox').innerHTML=h;
  $('classicsBox').querySelectorAll('[data-cl]').forEach(function(b){b.onclick=function(){Game.startReplay(CLASSICS[+b.getAttribute('data-cl')]);};});
  $('classicsBox').querySelectorAll('[data-op]').forEach(function(b){b.onclick=function(){Game.startReplay(OPENINGS[+b.getAttribute('data-op')]);};});
  $('importBtn').onclick=function(){
    sheet('<h2>匯入棋譜</h2><p style="font-size:13px;color:#8a7458">支援中文記譜（繁簡皆可），例如：<br>1. 炮二平五 馬8進7 2. 馬二進三 車9平8</p><textarea id="pgnIn" placeholder="把棋譜貼在這裡"></textarea><button class="big primary" id="pgnOk">開始解說</button>');
    $('pgnOk').onclick=function(){var r=parseRecord($('pgnIn').value);if(r.error){toast(r.error);return;}closeSheet();Game.startReplay({title:'匯入的棋譜',event:'',opening:'',result:'',moves:r.moves,notes:{},live:true});};
  };
}
function parseRecord(txt){
  var toks=String(txt).replace(/\d+\s*[\.、．]/g,' ').replace(/[\(\)（）—\-–,，;；]/g,' ').split(/\s+/).filter(function(t){return /[車车俥馬马傌炮砲兵卒帥帅將将仕士相象]/.test(t);});
  var b=INIT.slice(),s=0,out=[];
  for(var i=0;i<toks.length;i++){var t=toks[i].replace(/[^車车俥馬马傌炮砲兵卒帥帅將将仕士相象進进退平前後后中一二三四五六七八九１２３４５６７８９1-9]/g,'');if(t.length<4)continue;
    var m=cnToMove(b,s,t);if(!m)return {error:'第 '+(out.length+1)+' 步「'+t+'」無法辨識或不合法'};
    out.push(moveToCN(b,m));applyMove(b,m);s=1-s;}
  if(!out.length)return {error:'找不到棋步'};
  return {moves:out};
}

/* ----- records ----- */
function renderRecords(){
  var h='<div class="panel"><b>正式對局</b>：'+P.games+' 盤，'+P.wins+' 勝 '+P.losses+' 負 '+P.draws+' 和　<b>Rating</b> '+P.rating+'</div>';
  var weak=Object.keys(P.weak||{});
  if(weak.length)h+='<h3>弱點統計（復盤 '+(P.reviewed||0)+' 盤）</h3><div class="panel">'+weak.sort(function(a,b){return P.weak[b]-P.weak[a];}).map(function(k){return '<div class="bar-row"><span class="lab">'+(WEAK_LABEL[k]||k)+'</span><span>'+P.weak[k]+' 次</span></div>';}).join('')+'</div>';
  h+='<h3>對局紀錄（點選可復盤）</h3><div class="list">';
  if(!P.records.length)h+='<div class="note sub">還沒有對局紀錄。</div>';
  P.records.forEach(function(r,i){var d=new Date(r.date),res=r.score===1?'勝':r.score===0?'負':'和';
    h+='<button class="item" data-rec="'+i+'"><span class="t"><b>'+res+'・'+esc(r.opp)+'</b><small>'+(d.getMonth()+1)+'/'+d.getDate()+' '+('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2)+'・'+(r.player?'執黑':'執紅')+'・'+r.moves.length+' 步'+(r.rated?'・'+(r.delta>=0?'+':'')+r.delta:'・不計分')+'</small></span><span class="badge'+(r.reviewed?' done':'')+'">'+(r.reviewed?'已復盤':'復盤')+'</span></button>';});
  h+='</div>';$('recordsBox').innerHTML=h;
  $('recordsBox').querySelectorAll('[data-rec]').forEach(function(b){b.onclick=function(){Game.reviewRecord(P.records[+b.getAttribute('data-rec')]);};});
}

/* ----- who is online ----- */
function renderOnline(){
  if(!window.Online||!Online.ready){$('onlineBox').innerHTML='<div class="note">需要連線才能看到線上玩家。</div>';return;}
  if(!P.name){askName(renderOnline);return;}
  $('onlineBox').innerHTML='<div class="note sub">載入中…</div>';
  Online.onlineUsers().then(function(list){
    var h='<div class="note sub">最近 3 分鐘內開著象棋道場的玩家。點「邀請對戰」，對方手機會跳出邀請。</div><div class="list">';
    list.forEach(function(u){var me=u.id===Online.uid,busy=u.status==='playing';
      h+='<div class="item"><span class="dot'+(busy?' busy':'')+'"></span><span class="t"><b>'+esc(u.name)+(me?'（你）':'')+'</b><small>Rating '+u.rating+'・'+(busy?'對局中':'閒置中')+'</small></span>'+(me?'':'<button class="btn primary" style="flex:none;padding:8px 12px" data-inv="'+u.id+'" data-n="'+esc(u.name)+'">邀請對戰</button>')+'</div>';});
    h+='</div><button class="big" id="olRefresh">重新整理</button>';
    $('onlineBox').innerHTML=h;
    $('olRefresh').onclick=renderOnline;
    $('onlineBox').querySelectorAll('[data-inv]').forEach(function(b){b.onclick=function(){
      b.disabled=true;b.textContent='邀請中…';
      Online.invite(b.getAttribute('data-inv')).then(function(room){toast('已邀請 '+b.getAttribute('data-n')+'，等待對方加入');Game.startFriend(room);}).catch(function(e){toast('邀請失敗：'+e.message);b.disabled=false;b.textContent='邀請對戰';});};});
  }).catch(function(e){$('onlineBox').innerHTML='<div class="note">讀取失敗：'+esc(e.message)+'</div>';});
}
function showInvite(inv){
  sheet('<h2>⚔️ 對戰邀請</h2><p style="font-size:18px"><b>'+esc(inv.fromName)+'</b> 邀請你下一盤象棋</p><div class="row"><button class="btn" id="invNo">婉拒</button><button class="btn primary" id="invYes">接受</button></div>');
  $('invNo').onclick=function(){closeSheet();Online.clearInvite();};
  $('invYes').onclick=function(){closeSheet();Online.clearInvite();if(!P.name)askName(function(){Game.startFriend(inv.room);});else Game.startFriend(inv.room);};
}

/* ----- rank / friend / profile (online parts in online.js) ----- */
function renderRank(){
  if(!window.Online||!Online.ready){$('rankBox').innerHTML='<div class="note">英雄榜需要連線。'+esc(window.Online&&Online.reason||'')+'</div><div class="note sub">你的本機 Rating：'+P.rating+'</div>';return;}
  $('rankBox').innerHTML='<div class="note sub">載入中…</div>';
  Online.leaderboard().then(function(list){
    var h='<div class="panel" style="padding:0">'+list.map(function(u,i){return '<div class="rank-row'+(u.id===Online.uid?' me':'')+'"><span class="n">'+(i<3?['🥇','🥈','🥉'][i]:i+1)+'</span><span>'+esc(u.name)+'</span><span><b>'+u.rating+'</b></span><span style="font-size:12px;color:#8a7458">'+(u.wins||0)+'勝'+(u.losses||0)+'負'+(u.draws||0)+'和</span></div>';}).join('')+'</div>';
    if(!list.length)h='<div class="note sub">還沒有人上榜，下一盤正式對局就是第一名！</div>';
    $('rankBox').innerHTML='<div class="note sub">正式對局（電腦或好友）才會計分；新玩家 1200 分。</div>'+h;
  }).catch(function(e){$('rankBox').innerHTML='<div class="note">讀取失敗：'+esc(e.message)+'</div>';});
}
function renderFriend(){
  if(!window.Online||!Online.ready){$('friendBox').innerHTML='<div class="note">好友對戰需要連線。'+esc(window.Online&&Online.reason||'')+'</div>';return;}
  if(!P.name){askName(renderFriend);return;}
  $('friendBox').innerHTML='<div class="panel"><h3 style="margin-top:0">建立對局</h3><div class="chips" id="fSide"><button class="chip on" data-s="0">我執紅</button><button class="chip" data-s="1">我執黑</button></div><button class="big primary" id="fCreate">產生邀請連結</button></div><h3>進行中的對局</h3><div id="myRooms" class="list"><div class="note sub">載入中…</div></div>';
  var side=0;$('fSide').querySelectorAll('[data-s]').forEach(function(b){b.onclick=function(){side=+b.getAttribute('data-s');$('fSide').querySelectorAll('[data-s]').forEach(function(x){x.classList.toggle('on',x===b);});};});
  $('fCreate').onclick=function(){Online.createRoom(side).then(function(id){Game.startFriend(id);}).catch(function(e){toast('建立失敗：'+e.message);});};
  Online.myRooms().then(function(rs){$('myRooms').innerHTML=rs.length?rs.map(function(r){return '<button class="item" data-room="'+r.id+'"><span class="t"><b>'+esc(r.redName||'?')+' vs '+esc(r.blackName||'（等待加入）')+'</b><small>'+(r.status==='waiting'?'等待對手':'進行中')+'・'+(r.moves||[]).length+' 步</small></span><span class="badge">進入</span></button>';}).join(''):'<div class="note sub">沒有進行中的對局。</div>';
    $('myRooms').querySelectorAll('[data-room]').forEach(function(b){b.onclick=function(){Game.startFriend(b.getAttribute('data-room'));};});}).catch(function(){$('myRooms').innerHTML='';});
}
function renderProfile(){
  $('profileBox').innerHTML='<div class="list"><button class="item" id="pName"><span class="t"><b>暱稱</b><small>'+(esc(P.name)||'未設定')+'</small></span><span class="badge">修改</span></button>'+
   '<button class="item" id="pExport"><span class="t"><b>複製最近一盤棋譜</b><small>貼給 Claude 可以深入講解</small></span><span class="badge">複製</span></button>'+
   '<button class="item" id="pReset"><span class="t"><b>清除本機資料</b><small>Rating、紀錄、課程進度</small></span><span class="badge">清除</span></button></div>'+
   '<p class="foot">版本 '+APP_VERSION+'<br>'+(window.Online&&Online.ready?'已連線（ID：'+Online.uid.slice(0,6)+'…）':esc(window.Online&&Online.reason||'離線模式'))+'</p>';
  $('pName').onclick=function(){askName(renderProfile);};
  $('pExport').onclick=function(){var r=P.records[0];if(!r){toast('還沒有對局');return;}var t=recordText(r);try{navigator.clipboard.writeText(t).then(function(){toast('已複製棋譜');},function(){sheet('<h2>棋譜</h2><textarea>'+esc(t)+'</textarea>');});}catch(e){sheet('<h2>棋譜</h2><textarea>'+esc(t)+'</textarea>');}};
  $('pReset').onclick=function(){sheet('<h2>確定清除？</h2><p>本機的 Rating、紀錄與進度都會刪除（線上英雄榜不受影響）。</p><div class="row"><button class="btn" onclick="closeSheet()">取消</button><button class="btn primary" id="rsOk">清除</button></div>');$('rsOk').onclick=function(){localStorage.removeItem('xqdojo');localStorage.removeItem('xq-live');loadP();closeSheet();go('home');};};
}
function recordText(r){var b=r.fen?parseFen(r.fen).board:INIT.slice(),s=r.fen?parseFen(r.fen).side:0,out=[];
  r.moves.forEach(function(m,i){var cn=moveToCN(b,m);if(s===0)out.push((Math.floor(i/2)+1)+'. '+cn);else out.push(cn);applyMove(b,m);s=1-s;});
  return (r.player?'黑方':'紅方')+'（我）vs '+r.opp+'，結果：'+(r.score===1?'我勝':r.score===0?'我負':'和')+'\n'+out.join(' ');}

window.addEventListener('load',function(){
  var h=(location.hash||'').slice(1),room=null;
  try{room=new URLSearchParams(location.search).get('room');}catch(e){}
  if(room){go('home');var tryJoin=function(n){if(window.Online&&Online.ready){if(!P.name)askName(function(){Game.startFriend(room);});else Game.startFriend(room);}else if(n<40)setTimeout(function(){tryJoin(n+1);},250);else toast('無法連線，請稍後再開啟連結');};tryJoin(0);return;}
  go(TITLES[h]&&h!=='game'&&h!=='lesson'?h:'home');
});
