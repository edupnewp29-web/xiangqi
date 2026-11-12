/* ===== game screen: all modes share one board ===== */
var Game=(function(){
  var bv=new BoardView($('board'),onTap);
  var G=null,feed=[],viewPly=null,unsub=null;

  function newG(mode,fen){A=null;var st=fen?parseFen(fen):{board:INIT.slice(),side:0};
    return {mode:mode,startFen:fen||null,start:st.board.slice(),startSide:st.side,b:st.board.slice(),side:st.side,moves:[],hashes:[hashBoard(st.board,st.side)[0]],
      player:st.side,over:false,winner:null,evals:{},notes:{},tok:Math.random(),sel:-1,targets:[],arrows:[],helped:false};}
  function posAt(ply,g){g=g||G;var b=g.start.slice(),s=g.startSide;for(var i=0;i<ply;i++){applyMove(b,g.moves[i]);s=1-s;}return {b:b,side:s};}
  function push(m){G.moves.push(m);applyMove(G.b,m);G.side=1-G.side;G.hashes.push(hashBoard(G.b,G.side)[0]);G.sel=-1;G.targets=[];G.arrows=[];checkEnd();}
  function checkEnd(){
    if(!legalMoves(G.b,G.side).length){G.over=true;G.winner=1-G.side;return;}
    var h=G.hashes[G.hashes.length-1],n=0;G.hashes.forEach(function(x){if(x===h)n++;});if(n>=3){G.over=true;G.winner=-1;G.drawWhy='同一局面重複三次';}
    if(G.moves.length>=300){G.over=true;G.winner=-1;G.drawWhy='步數過多';}
  }
  function stale(tok){return !G||G.tok!==tok;}
  function sideName(s){return s===0?'紅':'黑';}
  function moveNoLabel(ply,startSide){var n=Math.floor((ply+(startSide||0))/2)+1;return '第'+n+'回合';}

  /* ---------- rendering ---------- */
  function render(){
    if(!G)return;
    var gv=$('gameVer');if(gv)gv.textContent='象棋道場 '+APP_VERSION+'（'+APP_DATE+' 更新）';
    if(A){renderAnaBoard();return;}
    bv.flip=G.player===1;
    var ply=viewPly===null?G.moves.length:viewPly,pos=viewPly===null?{b:G.b,side:G.side}:posAt(viewPly);
    var arrows=G.arrows.slice();
    if(viewPly===null&&G.threat&&G.showThreat!==false)arrows.push({m:G.threat.m,color:'o'});
    bv.render({board:pos.b,side:pos.side,sel:viewPly===null||G.mode==='replay'?G.sel:-1,targets:viewPly===null||G.mode==='replay'?G.targets:[],last:ply>0?G.moves[ply-1]:0,arrows:arrows,check:inCheck(pos.b,pos.side)});
    renderStrip(ply);renderStatus();renderEval(ply);
  }
  function renderStrip(cur){
    var b=G.start.slice(),h='';
    for(var i=0;i<G.moves.length;i++){var cn=moveToCN(b,G.moves[i]);applyMove(b,G.moves[i]);var nt=G.notes[i],dot=nt&&nt.gr?'<i class="g" style="background:'+nt.gr.c+'"></i>':'';
      h+='<span data-p="'+(i+1)+'" class="'+(i+1===cur?'cur':'')+'">'+((i+G.startSide)%2===0?(Math.floor((i+G.startSide)/2)+1)+'.':'')+cn+dot+'</span>';}
    var el=$('movestrip');el.innerHTML=h;
    el.querySelectorAll('[data-p]').forEach(function(s){s.onclick=function(){var k=+s.getAttribute('data-p');
      if(G.mode==='ai'&&!G.over){openAnalysis(k-1,null,1);return;}
      if(G.mode==='review'||G.mode==='replay'||G.over){setView(k);}};});
    var c=el.querySelector('.cur');if(c)c.scrollIntoView({inline:'center',block:'nearest'});else el.scrollLeft=el.scrollWidth;
  }
  function renderEval(ply){
    var e=G.evals[ply],bar=$('evalbar');
    if(!e||!(G.coach||G.mode==='review')){bar.style.display='none';return;}
    bar.style.display='block';var red=e.side===0?e.score:-e.score;if(Math.abs(red)>MATE-300)red=red>0?2000:-2000;
    $('evalfill').style.width=(100/(1+Math.exp(-red/250)))+'%';
  }
  function setStatus(msg,info,cls){$('msg').textContent=msg;$('info').textContent=info||'';$('status').className=cls||'';}
  function renderStatus(){
    var m=G.mode;
    if(m==='ai'||m==='friend'){
      if(G.over){var me=G.winner===G.player;setStatus(G.closed?'對局取消（對方已離開）':G.winner===-1?'和棋（'+(G.drawWhy||'')+'）':me?(G.leftWin?'🎉 對手離開，你獲勝':'🎉 你贏了！'):(G.leftWin?'你離開了對局（判負）':G.resigned?'你認輸了':'你輸了'),G.endInfo||'','over');}
      else if(G.thinking)setStatus(m==='ai'?'電腦思考中…':'等待對手…',G.coach?'教練：'+(G.coachBusy?'分析中':'待命'):'');
      else if(G.side===G.player)setStatus(inCheck(G.b,G.side)?'將軍！快應將':'輪到你下（'+sideName(G.player)+'）',G.coach?(G.coachBusy?'教練分析中…':''):(m==='friend'&&G.lat?'延遲 '+G.lat.toFixed(1)+' 秒':(G.rated?'正式對局':'')),inCheck(G.b,G.side)?'check':'');
      else setStatus(m==='friend'?'等待對手走棋…':'輪到電腦',m==='friend'&&G.lat?'延遲 '+G.lat.toFixed(1)+' 秒':'');
    }else if(m==='puzzle'){setStatus(G.pzMsg||((sideName(G.player))+'先，'+G.pz.n+' 步殺'),G.pzInfo||'',G.pzCls||'');}
    else if(m==='replay'){var k=viewPly;setStatus(k===0?'開局':moveNoLabel(k-1,G.startSide)+' '+sideName((k-1+G.startSide)%2)+'方',G.guess?'猜中 '+G.guessOk+'/'+G.guessN:(k+'/'+G.moves.length));}
    else if(m==='review'){setStatus(G.reviewBusy?'復盤分析中…':'復盤',(viewPly||0)+'/'+G.moves.length);}
  }
  function tools(list){
    $('toolbar').innerHTML='';list.forEach(function(t){var b=document.createElement('button');b.className='btn'+(t.p?' primary':'');b.textContent=t.t;b.disabled=!!t.dis;b.onclick=t.f;$('toolbar').appendChild(b);});
  }
  function panel(h){$('panel').innerHTML=h;}

  /* ---------- tap handling ---------- */
  function onTap(sq){
    if(!G)return;
    if(A)return anaTap(sq);
    if(G.mode==='replay'){if(G.guess)return guessTap(sq);return;}
    if(viewPly!==null||G.over||G.thinking||G.busy)return;
    if(G.mode==='friend'&&(G.player<0||G.roomStatus!=='playing'))return;
    if(G.side!==G.player)return;
    var hit=G.targets.filter(function(m){return (m&127)===sq;});
    if(hit.length){var m=hit[0];G.sel=-1;G.targets=[];onMove(m);return;}
    var q=G.b[sq];
    if(q&&(q>>3)===G.player&&sq!==G.sel){G.sel=sq;G.targets=legalMoves(G.b,G.side).filter(function(m){return (m>>7)===sq;});}
    else{G.sel=-1;G.targets=[];}
    render();
  }
  function onMove(m){
    if(G.mode==='ai')aiPlayerMove(m);
    else if(G.mode==='puzzle')puzzleMove(m);
    else if(G.mode==='friend')friendMove(m);
  }

  /* ---------- coach analysis ---------- */
  function analyze(ply,time,g){
    g=g||G;if(g.evals[ply])return Promise.resolve(g.evals[ply]);
    var p=posAt(ply,g);
    if(!legalMoves(p.b,p.side).length){var r0={move:0,score:-MATE,pv:[],side:p.side,depth:0};g.evals[ply]=r0;return Promise.resolve(r0);}
    return coachEng.run({cmd:'think',board:p.b,side:p.side,opts:{time:time||COACH_T,analyze:true,history:g.hashes.slice(0,ply)}}).then(function(r){if(r){r.side=p.side;g.evals[ply]=r;}return r;});
  }
  function pvExplain(b,side,pv,n){var bb=b.slice(),out=[];for(var i=0;i<pv.length&&i<n;i++){var m=pv[i];if(legalMoves(bb,side).indexOf(m)<0)break;out.push('<b>'+moveToCN(bb,m)+'</b>（'+describeMove(bb,m).join('，')+'）');applyMove(bb,m);side=1-side;}return out;}
  function evalWords(s,who){var mi=mateIn(s);if(mi>0)return who+'有 '+mi+' 步殺';if(mi<0)return '對方有 '+(-mi)+' 步殺';if(s>300)return who+'大優';if(s>100)return who+'稍優';if(s>=-100)return '雙方均勢';if(s>=-300)return who+'稍落後';return who+'明顯落後';}
  function makeNote(g,ply,e0,e1,alt){
    var p=posAt(ply,g),m=g.moves[ply],mover=p.side,s0=e0.score,s1=-e1.score;
    var loss=Math.max(0,s0-s1);
    if(mateIn(s0)>0&&mateIn(s1)>0)loss=mateIn(s1)<=mateIn(s0)?0:Math.min(loss,30);
    var isBest=m===e0.move,gr=gradeLoss(loss,isBest),cn=moveToCN(p.b,m),desc=describeMove(p.b,m,ply),lines=[],tags=[];
    var b1=p.b.slice();applyMove(b1,m);
    var who=(g.mode==='review'||g.mode==='replay')&&mover!==g.player?sideName(mover)+'方':'你';
    if(loss<=40&&!(mateIn(e1.score)>0)){
      lines.push(isBest?'👍 這正是引擎認為<b>最好的一步</b>。':'👍 這步和最佳著差不多，是<b>好棋</b>。');
      var plan=pvExplain(b1,1-mover,e1.pv,4);
      if(plan.length)lines.push('預期變化：對方 '+plan[0]+(plan[1]?'，'+who+'接著 '+plan[1]:'')+(plan[2]?'，對方 '+plan[2]:'')+(plan[3]?'，'+who+' '+plan[3]:''));
      if(alt&&alt.move&&alt.move!==m){var dd=s0-alt.score;lines.push('其他可行的走法：<b>'+moveToCN(p.b,alt.move)+'</b>（'+describeMove(p.b,alt.move,ply).join('，')+'）'+(dd>5?'，比這步差 '+(dd/100).toFixed(1):'，和這步差不多'));}
    }
    if(!isBest&&loss>40&&e0.move){lines.push('較佳：<b>'+moveToCN(p.b,e0.move)+'</b>（'+describeMove(p.b,e0.move,ply).join('，')+'）');
      var bx=pvExplain(p.b,mover,e0.pv,4);if(bx.length>1)lines.push('為什麼較佳：'+bx.join(' → '));}
    lines.push('局勢：'+evalWords(s0,who)+' → '+evalWords(s1,who));
    if(mateIn(e1.score)>0&&e1.pv.length)lines.push('⚠ 這步之後對方有 <b>'+mateIn(e1.score)+' 步殺</b>：'+pvToCN(b1,1-mover,e1.pv,7).join(' '));
    else if(loss>100&&e1.pv.length)lines.push('後果：對方可以 <b>'+pvToCN(b1,1-mover,e1.pv,3).join(' ')+'</b>（'+describeMove(b1,e1.pv[0]).join('，')+'）');
    if(mateIn(s0)>0&&!(mateIn(s1)>0)&&e0.pv.length)lines.push('錯過了 <b>'+mateIn(s0)+' 步殺</b>：'+pvToCN(p.b,mover,e0.pv,7).join(' '));
    if(mateIn(s1)>0&&!g.over)lines.push('👍 已形成 '+mateIn(s1)+' 步殺，繼續！');
    if(loss>=100){
      if(mateIn(e1.score)>0)tags.push('allowed-mate');
      else if(mateIn(s0)>0)tags.push('missed-mate');
      else{var rp=e1.pv[0];if(rp&&b1[rp&127]&&VALS[b1[rp&127]&7]>=200)tags.push('hanging');else if(e0.move&&p.b[e0.move&127]&&VALS[p.b[e0.move&127]&7]>=200)tags.push('missed-win');}
      tags.push(ply<20?'opening':majorsCount(p.b)<=4?'endgame':'middlegame');
    }
    return {ply:ply,mover:mover,cn:cn,desc:desc,gr:gr,loss:loss,lines:lines,tags:tags,best:e0.move,reply:e1.pv[0]||0,bestPv:(e0.pv||[]).slice(0,12),youPv:[m].concat((e1.pv||[]).slice(0,11))};
  }
  function noteHtml(n,mine){
    if(n.ai)return '<div class="note ai"><div class="hd">🤖 '+(n.who||'電腦')+'：'+n.cn+'</div><div class="sub">'+n.desc.join('，')+'</div></div>';
    if(n.hint)return '<div class="note"><div class="hd">💡 提示：'+n.cn+'</div><div class="sub">'+n.desc.join('，')+'</div>'+(n.lines||[]).map(function(l){return '<div>'+l+'</div>';}).join('')+'</div>';
    return '<div class="note'+(n.loss>100?' warn':'')+'"><div class="hd"><span class="tag" style="background:'+n.gr.c+'">'+n.gr.t+'</span>'+(mine===false?sideName(n.mover)+'：':'你：')+n.cn+'</div><div class="sub">'+n.desc.join('，')+(n.loss>10?'（損失 '+(n.loss>=MATE-300?'致命':(n.loss/100).toFixed(1))+'）':'')+'</div>'+
      n.lines.map(function(l){return '<div>'+l+'</div>';}).join('')+(n.best?'<button data-show="'+n.ply+'">🔍 在棋盤上看所有變化</button>':'')+'</div>';
  }
  function bindShow(root){(root||$('panel')).querySelectorAll('[data-show]').forEach(function(b){b.onclick=function(){showNoteOnBoard(+b.getAttribute('data-show'));};});}
  function showNoteOnBoard(ply){openAnalysis(ply,null,0);}

  /* ---------- variation explorer (mid-game analysis) ---------- */
  var A=null;
  function openAnalysis(ply,lines,sel){
    if(!G)return;var n=G.notes[ply];
    if(!lines){lines=[];
      if(n&&n.bestPv&&n.bestPv.length&&n.best!==G.moves[ply])lines.push({name:'較佳變化',moves:n.bestPv});
      if(n&&n.youPv)lines.push({name:G.mode==='review'&&n.mover!==G.player?'實際走法＋後續':'你的走法＋後續',moves:n.youPv});
      lines.push({name:'實際對局',moves:G.moves.slice(ply)});
      if(sel===1)sel=lines.length-1;
    }
    var p=posAt(ply);
    A={ply:ply,b0:p.b,s0:p.side,lines:lines,li:Math.min(sel||0,lines.length-1),cur:0,ev:{},sel:-1,targets:[],busy:false};
    A.line=A.lines[A.li].moves.slice();
    /* reuse the coach's own analysis so explanations stay consistent */
    for(var j=ply;j<=G.moves.length;j++){var ej=G.evals[j];if(ej){var pj=posAt(j);A.ev[toFen(pj.b,pj.side)]=ej;}}
    if(sel===1||(lines.length===1))A.cur=Math.min(1,A.line.length);
    viewPly=null;tools(anaTools());render();renderAna();window.scrollTo({top:0,behavior:'smooth'});
  }
  function closeAnalysis(){
    A=null;G.arrows=[];
    if(G.mode==='review'){tools(navTools());render();renderReview();}
    else if(G.mode==='ai'){tools(aiTools());render();renderAIPanel();}
    else render();
  }
  function anaTools(){return [{t:'⏮',f:function(){anaGo(0);}},{t:'◀',f:function(){anaGo(A.cur-1);}},{t:'▶',f:function(){anaGo(A.cur+1);}},{t:'⏭',f:function(){anaGo(A.line.length);}},{t:'返回',p:1,f:closeAnalysis}];}
  function anaPos(k){var b=A.b0.slice(),s=A.s0;for(var i=0;i<k&&i<A.line.length;i++){applyMove(b,A.line[i]);s=1-s;}return {b:b,side:s};}
  function anaGo(k){
    if(!A)return;
    if(k>A.line.length){anaExtend();return;}
    A.cur=Math.max(0,k);A.sel=-1;A.targets=[];render();renderAna();
  }
  /* at the end of a line: let the engine play the next move */
  function anaExtend(){
    var a=A,pos=anaPos(a.line.length);if(!legalMoves(pos.b,pos.side).length){toast('棋局已結束');return;}
    a.busy=true;renderAna();
    anaEval(a.line.length).then(function(e){if(A!==a)return;a.busy=false;if(e&&e.move){a.line.push(e.move);a.cur=a.line.length;}render();renderAna();});
  }
  function anaKey(k){var p=anaPos(k);return toFen(p.b,p.side);}
  function anaEval(k){
    var a=A,key=anaKey(k);if(a.ev[key])return Promise.resolve(a.ev[key]);
    var p=anaPos(k);
    if(!legalMoves(p.b,p.side).length){var r0={move:0,score:-MATE,pv:[],side:p.side};a.ev[key]=r0;return Promise.resolve(r0);}
    return coachEng.run({cmd:'think',board:p.b,side:p.side,opts:{time:800,analyze:true}}).then(function(r){if(r){r.side=p.side;a.ev[key]=r;}return r;});
  }
  function anaTap(sq){
    var pos=anaPos(A.cur);
    var hit=A.targets.filter(function(m){return (m&127)===sq;});
    if(hit.length){var m=hit[0];A.sel=-1;A.targets=[];
      if(A.line[A.cur]===m){anaGo(A.cur+1);return;}
      /* new branch: user's own move, then engine predicts the continuation */
      var a=A;a.line=a.line.slice(0,a.cur).concat([m]);a.cur++;a.custom=true;a.busy=true;render();renderAna();
      anaEval(a.cur).then(function(e){if(A!==a)return;a.busy=false;
        if(e&&e.pv&&a.line.length===a.cur){var pb=anaPos(a.cur),bb=pb.b.slice(),sd=pb.side,ok=[];
          for(var i=0;i<e.pv.length&&i<8;i++){if(legalMoves(bb,sd).indexOf(e.pv[i])<0)break;ok.push(e.pv[i]);applyMove(bb,e.pv[i]);sd=1-sd;}
          a.line=a.line.concat(ok);}
        render();renderAna();});
      return;}
    var q=pos.b[sq];
    if(q&&(q>>3)===pos.side&&sq!==A.sel){A.sel=sq;A.targets=legalMoves(pos.b,pos.side).filter(function(m){return (m>>7)===sq;});}
    else{A.sel=-1;A.targets=[];}
    render();
  }
  function renderAnaBoard(){
    bv.flip=G.player===1;
    var pos=anaPos(A.cur),arrows=[];
    if(A.cur<A.line.length)arrows.push({m:A.line[A.cur],color:'g',label:'下'});
    bv.render({board:pos.b,side:pos.side,sel:A.sel,targets:A.targets,last:A.cur>0?A.line[A.cur-1]:0,arrows:arrows,check:inCheck(pos.b,pos.side)});
    /* strip shows the explored line */
    var b=A.b0.slice(),s=A.s0,h='<span data-a="0" class="'+(A.cur===0?'cur':'')+'">起點</span>';
    for(var i=0;i<A.line.length;i++){var cn=moveToCN(b,A.line[i]);applyMove(b,A.line[i]);
      h+='<span data-a="'+(i+1)+'" class="'+(i+1===A.cur?'cur':'')+'">'+(s===G.player?'你 ':'')+cn+'</span>';s=1-s;}
    var el=$('movestrip');el.innerHTML=h;
    el.querySelectorAll('[data-a]').forEach(function(x){x.onclick=function(){anaGo(+x.getAttribute('data-a'));};});
    var c=el.querySelector('.cur');if(c)c.scrollIntoView({inline:'center',block:'nearest'});
    var live=G.mode==='ai'&&!G.over?(G.thinking?'對局：電腦思考中':G.side===G.player?'對局：輪到你':''):'';
    setStatus('🔍 變化探索（'+(A.cur?'第 '+A.cur+' 步':'起點')+'）',live);
    var e=A.ev[anaKey(A.cur)],bar=$('evalbar');
    if(e){bar.style.display='block';var red=e.side===0?e.score:-e.score;if(Math.abs(red)>MATE-300)red=red>0?2000:-2000;$('evalfill').style.width=(100/(1+Math.exp(-red/250)))+'%';}
  }
  function renderAna(){
    if(!A)return;var a=A,k=a.cur,pos=anaPos(k),h='';
    h+='<div class="note"><div class="hd">🔍 變化探索</div><div class="chips" style="margin-top:6px">'+a.lines.map(function(l,i){return '<button class="chip'+(i===a.li&&!a.custom?' on':'')+'" data-li="'+i+'">'+l.name+'</button>';}).join('')+(a.custom?'<button class="chip on">自己走的變化</button>':'')+'</div>'+
      '<div class="sub" style="margin-top:8px">用 ◀ ▶ 一步步看，或點下方棋譜跳到某一步。<b>也可以直接點棋子自己走</b>（紅黑都可以），電腦會接著預測後續。</div></div>';
    if(k>0){var pb=anaPos(k-1),m=a.line[k-1];
      h+='<div class="note"><div class="hd">第 '+k+' 步　'+sideName(pb.side)+(pb.side===G.player?'（你）':'')+'：'+moveToCN(pb.b,m)+'</div><div>'+describeMove(pb.b,m).join('，')+'</div></div>';}
    else h+='<div class="note"><div class="hd">起點局面</div><div class="sub">輪到'+sideName(pos.side)+'方走。</div></div>';
    var e=a.ev[anaKey(k)];
    if(e){var ps=e.side===G.player?e.score:-e.score;
      h+='<div class="note"><div><b>局勢：</b>'+evalWords(ps,'你')+'</div>'+(e.move?'<div><b>這裡最好的走法：</b>'+pvExplain(pos.b,pos.side,[e.move],1)[0]+'</div>':'')+
        (e.pv&&e.pv.length>1?'<div class="sub">引擎預期：'+pvToCN(pos.b,pos.side,e.pv,6).join(' ')+'</div>':'')+'</div>';}
    else if(legalMoves(pos.b,pos.side).length)h+='<div class="note sub">分析這個局面中…</div>';
    else h+='<div class="note"><div class="hd">'+(inCheck(pos.b,pos.side)?'將死！':'困斃！')+sideName(1-pos.side)+'方勝</div></div>';
    if(k===a.line.length&&legalMoves(pos.b,pos.side).length)h+='<div class="note sub">已到這條變化的最後一步。按 ▶ 讓電腦再走一步，或自己點棋子走走看。</div>';
    if(a.busy)h+='<div class="note sub">電腦思考中…</div>';
    panel(h);
    $('panel').querySelectorAll('[data-li]').forEach(function(b){b.onclick=function(){var i=+b.getAttribute('data-li');a.li=i;a.custom=false;a.line=a.lines[i].moves.slice();a.cur=Math.min(1,a.line.length);a.sel=-1;a.targets=[];render();renderAna();};});
    if(!e&&legalMoves(pos.b,pos.side).length){anaEval(k).then(function(){if(A===a&&a.cur===k){render();renderAna();}});}
  }

  /* ---------- vs AI ---------- */
  function startAI(o){
    aiEng.reset();coachEng.reset();stopFriend();
    G=newG('ai',o.fen);G.player=o.player;G.level=o.level;G.coach=!!o.coach;G.rated=!o.coach&&!o.fen;G.showThreat=true;G.label=o.label;G.lessonId=o.lessonId;
    feed=[];viewPly=null;
    go('game',o.label||(LEVELS[o.level].n+(o.coach?'・教練模式':'・正式對局')));
    tools(aiTools());if(o.replay)o.replay.forEach(function(m){push(m);});
    afterAIMove();
  }
  function aiTools(viewing){
    if(viewing)return [{t:'回到現在',p:1,f:function(){viewPly=null;G.arrows=[];tools(aiTools());render();}}];
    var t=[];
    if(G.coach){t.push({t:'悔棋',f:undo});t.push({t:'提示',f:hint});t.push({t:G.showThreat?'隱藏威脅':'顯示威脅',f:function(){G.showThreat=!G.showThreat;tools(aiTools());render();}});}
    t.push({t:'認輸',f:resign});
    return t;
  }
  function saveLive(){if(G.mode!=='ai'||G.lessonId)return;try{localStorage.setItem('xq-live',JSON.stringify({level:G.level,player:G.player,coach:G.coach,fen:G.startFen,moves:G.moves,helped:G.helped}));}catch(e){}}
  function resume(s){startAI({level:s.level,player:s.player,coach:s.coach,fen:s.fen,replay:s.moves});if(s.helped)G.helped=true;}
  function afterAIMove(){
    saveLive();render();renderAIPanel();
    if(G.over){endAI();return;}
    if(G.side!==G.player)aiTurn();else playerTurn();
  }
  function renderAIPanel(){
    if(A)return;
    var h='';
    if(G.threat&&G.showThreat&&!G.over)h+='<div class="note warn"><div class="hd">⚠ 對方威脅</div><div>'+G.threat.text+'</div></div>';
    if(G.mateHint&&!G.over)h+='<div class="note"><div class="hd">🎯 這個局面你有 '+G.mateHint+' 步殺，找找看！</div></div>';
    if(G.over)h+=endPanelHtml();
    h+='<div class="feed">'+feed.slice(0,40).map(function(n){return noteHtml(n);}).join('')+'</div>';
    if(!G.coach&&!G.over)h+='<div class="note sub">正式對局：不提供教練提示。下完後可以「復盤」看每一步的評分。</div>';
    panel(h);bindShow();bindEnd();
  }
  function playerTurn(){
    G.threat=null;G.mateHint=0;render();
    if(!G.coach)return;
    var tok=G.tok,ply=G.moves.length;G.coachBusy=true;renderStatus();
    analyze(ply).then(function(e0){
      if(stale(tok)||G.moves.length!==ply||!e0)return;
      if(mateIn(e0.score)>0&&mateIn(e0.score)<=5)G.mateHint=mateIn(e0.score);
      var b=G.b.slice();
      return coachEng.run({cmd:'think',board:b,side:1-G.side,opts:{time:700,history:G.hashes.slice(0,-1)}}).then(function(t){
        if(stale(tok)||G.moves.length!==ply||!t||!t.move)return;
        var base=-e0.score,mi=mateIn(t.score);
        if(mi>0||(t.score-base>=150&&b[t.move&127])){
          var txt=mi>0?'對方威脅 <b>'+mi+' 步殺</b>：'+pvToCN(b,1-G.side,t.pv,Math.min(7,2*mi-1)).join(' '):'<b>'+moveToCN(b,t.move)+'</b>（'+describeMove(b,t.move).join('，')+'）';
          G.threat={m:t.move,text:txt};
        }
      });
    }).then(function(){if(stale(tok))return;G.coachBusy=false;render();renderAIPanel();});
  }
  function aiPlayerMove(m){
    var ply=G.moves.length,g=G,tok=G.tok;
    G.threat=null;G.mateHint=0;viewPly=null;
    push(m);
    if(G.coach){
      var ph={ply:ply,pending:true,cn:moveToCN(posAt(ply).b,m),desc:['教練分析中…'],gr:{t:'…',c:'#999'},lines:[],loss:0};feed.unshift(ph);
      G.coachBusy=true;
      analyze(ply).then(function(e0){if(!e0||stale(tok))return null;
        var pb=posAt(ply,g),altP=e0.move===m?coachEng.run({cmd:'think',board:pb.b,side:pb.side,opts:{time:600,analyze:true,exclude:[m],history:g.hashes.slice(0,ply)}}):Promise.resolve(null);
        return altP.then(function(alt){if(stale(tok))return;return analyze(ply+1).then(function(e1){
        if(!e1||stale(tok))return;var n=makeNote(g,ply,e0,e1,alt);g.notes[ply]=n;var i=feed.indexOf(ph);if(i>=0)feed[i]=n;G.coachBusy=false;render();renderAIPanel();});});});
    }
    afterAIMove();
  }
  function aiTurn(){
    G.thinking=true;render();
    var lv=LEVELS[G.level],tok=G.tok;
    var b0=G.b.slice(),sd=G.side,hist=G.hashes.slice(0,-1),plyNow=G.moves.length;
    var pick,book=null;
    if(lv.noise===0&&plyNow<=1&&!G.startFen){
      var redB=['炮二平五','炮二平五','炮二平五','炮八平五','兵七進一','兵七進一','兵三進一','馬二進三','馬八進七','相三進五','相七進五'];
      var cen=plyNow===1&&(G.b.slice(63,72).indexOf(CANNON)===4);
      var blkB=cen?['馬8進7','馬8進7','馬2進3','炮8平5','炮2平5','卒7進1','卒3進1']:['卒7進1','卒3進1','馬8進7','馬2進3','炮8平5','炮2平5','象3進5','象7進5'];
      var list=plyNow===0?redB:blkB;for(var tries=0;tries<6&&!book;tries++){book=cnToMove(G.b,G.side,list[Math.floor(Math.random()*list.length)])||null;}
    }
    if(book)pick=new Promise(function(res){setTimeout(function(){res({move:book,score:0});},500);});
    else if(lv.noise>0)pick=aiEng.run({cmd:'think',board:b0,side:sd,opts:{maxDepth:lv.maxDepth,time:lv.time,noise:lv.noise,history:hist}});
    else{
      /* variety: also find the 2nd-best move; if it is nearly as good, sometimes play it */
      var margin=[0,0,40,30,25,20,15][G.level]*(plyNow<20?2:1);
      pick=aiEng.run({cmd:'think',board:b0,side:sd,opts:{maxDepth:lv.maxDepth,time:Math.round(lv.time*0.65),history:hist}}).then(function(r1){
        if(!r1||stale(tok)||!r1.move||Math.abs(r1.score)>MATE-300)return r1;
        return aiEng.run({cmd:'think',board:b0,side:sd,opts:{maxDepth:lv.maxDepth,time:Math.round(lv.time*0.35),history:hist,exclude:[r1.move]}}).then(function(r2){
          if(r2&&r2.move&&r1.score-r2.score<=margin&&Math.random()<0.45)return r2;return r1;});
      });
    }
    pick.then(function(r){
      if(!r||stale(tok))return;G.thinking=false;
      var ply=G.moves.length;feed.unshift({ai:true,cn:moveToCN(G.b,r.move),desc:describeMove(G.b,r.move,ply),ply:ply});
      push(r.move);afterAIMove();
    });
  }
  function undo(){
    if(!G.moves.length)return;aiEng.reset();coachEng.reset();G.tok=Math.random();G.thinking=false;G.coachBusy=false;G.helped=true;
    var mv=G.moves.slice();do{mv.pop();}while(mv.length&&((mv.length+G.startSide)%2)!==G.player);
    var keepE=G.evals,keepN=G.notes,o=G;G=newG('ai',o.startFen);['player','level','coach','rated','showThreat','label','lessonId'].forEach(function(k){G[k]=o[k];});G.helped=true;
    mv.forEach(function(m){push(m);});
    Object.keys(keepE).forEach(function(k){if(+k<=mv.length)G.evals[k]=keepE[k];});Object.keys(keepN).forEach(function(k){if(+k<mv.length)G.notes[k]=keepN[k];});
    feed=feed.filter(function(n){return n.ply<mv.length;});viewPly=null;afterAIMove();
  }
  function hint(){
    if(G.side!==G.player||G.over)return;G.helped=true;var tok=G.tok,ply=G.moves.length;toast('教練思考中…');
    analyze(ply).then(function(e){if(!e||stale(tok)||G.moves.length!==ply)return;G.arrows=[{m:e.move,color:'g'}];var px=pvExplain(G.b,G.side,e.pv,4);feed.unshift({hint:true,cn:moveToCN(G.b,e.move),desc:describeMove(G.b,e.move,ply),lines:px.length>1?['後續計畫：'+px.join(' → '),'局勢：'+evalWords(e.score,'你')]:[],ply:ply});render();renderAIPanel();});
  }
  function resign(){
    if(G.over)return;
    sheet('<h2>確定認輸？</h2><div class="row"><button class="btn" onclick="closeSheet()">取消</button><button class="btn primary" id="rsY">認輸</button></div>');
    $('rsY').onclick=function(){closeSheet();if(G.mode==='friend'){Online.resign(G.room);return;}aiEng.reset();G.tok=Math.random();G.thinking=false;G.over=true;G.resigned=true;G.winner=1-G.player;afterAIMove();};
  }
  function endAI(){
    if(G.ended)return;G.ended=true;aiEng.reset();
    try{localStorage.removeItem('xq-live');}catch(e){}
    var score=G.winner===-1?0.5:G.winner===G.player?1:0,lv=LEVELS[G.level],delta=0,rated=G.rated&&!G.helped;
    if(rated){delta=elo(P.rating,lv.r,score,P.games<10?40:24);P.rating+=delta;G.endInfo='Rating '+(delta>=0?'+':'')+delta+' → '+P.rating;}
    else G.endInfo=G.coach?'教練模式不計分':'';
    G.record={mode:'ai',opp:lv.n+'電腦',oppRating:lv.r,player:G.player,moves:G.moves.slice(),score:score,rated:rated,delta:delta,fen:G.startFen,level:G.level};
    if(!G.lessonId)addRecord(G.record);
    if(G.lessonId&&score===1){P.lessons[G.lessonId]=Date.now();saveP();}
    render();renderAIPanel();
  }
  function endPanelHtml(){return '<div class="note"><div class="hd">'+(G.winner===-1?'和棋':G.winner===G.player?'🎉 勝利':'對局結束')+'</div><div class="sub">'+(G.endInfo||'')+'</div><div class="row"><button class="btn primary" id="eReview">復盤分析</button><button class="btn" id="eAgain">再來一局</button></div></div>';}
  function bindEnd(){
    var r=$('eReview'),a=$('eAgain');
    if(r)r.onclick=function(){startReview(G.record||{moves:G.moves,player:G.player,fen:G.startFen,opp:'對手'},G);};
    if(a)a.onclick=function(){if(G.mode==='friend')go('friend');else if(G.lessonId||G.startFen)startAI({level:G.level,player:G.player,coach:G.coach,fen:G.startFen,label:G.label,lessonId:G.lessonId});else go('setup');};
  }

  /* ---------- review ---------- */
  function startReview(rec,fromG){
    aiEng.reset();stopFriend();
    var o=fromG;G=newG('review',rec.fen);G.player=rec.player||0;G.rec=rec;rec.moves.forEach(function(m){push(m);});G.over=true;
    if(o)Object.keys(o.evals).forEach(function(k){G.evals[k]=o.evals[k];});
    viewPly=G.moves.length;feed=[];G.coach=true;
    go('game','復盤');tools(navTools());render();
    G.reviewBusy=true;var tok=G.tok,n=G.moves.length,done=0;
    panel('<div class="note"><div class="hd">引擎逐步分析中…</div><div class="progress"><div id="rvp"></div></div><div class="sub" style="margin-top:6px">每一步約半秒，分析完成會列出你的關鍵失誤。</div></div>');
    var chain=Promise.resolve();
    for(var i=0;i<=n;i++)(function(i){chain=chain.then(function(){if(stale(tok))return;return analyze(i,500).then(function(){done++;var el=$('rvp');if(el)el.style.width=(done/(n+1)*100)+'%';});});})(i);
    chain.then(function(){if(stale(tok))return;
      for(var i=0;i<n;i++)if(G.evals[i]&&G.evals[i+1])G.notes[i]=makeNote(G,i,G.evals[i],G.evals[i+1]);
      G.reviewBusy=false;
      if(!rec.reviewed){var tags={};for(var j=0;j<n;j++){var nt=G.notes[j];if(nt&&nt.mover===G.player)nt.tags.forEach(function(t){tags[t]=1;P.weak[t]=(P.weak[t]||0)+1;});}
        rec.reviewed=true;P.reviewed=(P.reviewed||0)+1;saveP();}
      render();renderReview();});
  }
  function navTools(){return [{t:'⏮',f:function(){setView(0);}},{t:'◀',f:function(){setView(Math.max(0,(viewPly||0)-1));}},{t:'▶',f:function(){setView(Math.min(G.moves.length,(viewPly||0)+1));}},{t:'⏭',f:function(){setView(G.moves.length);}}];}
  function setView(k){viewPly=k;G.arrows=[];
    if(G.mode==='review')renderReview();
    if(G.mode==='replay'){G.sel=-1;G.targets=[];renderReplay();}
    render();}
  function renderReview(){
    if(G.reviewBusy||A)return;
    var n=G.moves.length,me=G.player,pts=[],cnt={best:0,good:0,dubious:0,mistake:0,blunder:0};
    for(var i=0;i<=n;i++){var e=G.evals[i];if(!e)continue;var red=e.side===0?e.score:-e.score;if(Math.abs(red)>MATE-300)red=red>0?1000:-1000;red=Math.max(-1000,Math.min(1000,red));pts.push((i/n*300).toFixed(1)+','+(45-red/1000*42).toFixed(1));}
    var mist=[];for(i=0;i<n;i++){var nt=G.notes[i];if(nt&&nt.mover===me){cnt[nt.gr.g]++;if(nt.loss>=100)mist.push(nt);}}
    mist.sort(function(a,b){return b.loss-a.loss;});
    var cur=G.notes[(viewPly||0)-1];
    var h='<svg class="graph" viewBox="0 0 300 90" preserveAspectRatio="none"><line x1="0" y1="45" x2="300" y2="45" stroke="#ccc"/><polyline fill="none" stroke="#b3261e" stroke-width="2" points="'+pts.join(' ')+'"/>'+(viewPly!==null?'<line x1="'+(viewPly/n*300)+'" y1="0" x2="'+(viewPly/n*300)+'" y2="90" stroke="#1565c0" stroke-width="1.5"/>':'')+'</svg>';
    h+='<div class="sub" style="font-size:12px;color:#8a7458;margin:4px 2px">曲線往上＝紅方優勢，往下＝黑方優勢</div>';
    if(cur)h+=noteHtml(cur,cur.mover===me?undefined:false);
    h+='<div class="note"><div class="hd">你的表現</div><div class="sub">最佳 '+cnt.best+'・好棋 '+cnt.good+'・疑問手 '+cnt.dubious+'・錯著 '+cnt.mistake+'・大漏著 '+cnt.blunder+'</div></div>';
    h+='<h3>關鍵失誤（點選查看）</h3>';
    if(!mist.length)h+='<div class="note sub">沒有明顯失誤，下得很好！</div>';
    mist.slice(0,3).forEach(function(nt){h+='<div class="note warn"><div class="hd"><span class="tag" style="background:'+nt.gr.c+'">'+nt.gr.t+'</span>'+moveNoLabel(nt.ply,G.startSide)+'：'+nt.cn+'</div>'+nt.lines.map(function(l){return '<div>'+l+'</div>';}).join('')+'<div class="row"><button class="btn" data-jump="'+nt.ply+'">看這步</button><button class="btn primary" data-redo="'+nt.ply+'">從這裡重下</button></div></div>';});
    var tg={};mist.forEach(function(m){m.tags.forEach(function(t){if(WEAK_LABEL[t])tg[t]=(tg[t]||0)+1;});});
    if(Object.keys(tg).length)h+='<div class="note"><div class="hd">這盤的弱點</div><div class="sub">'+Object.keys(tg).map(function(t){return WEAK_LABEL[t]+' ×'+tg[t];}).join('、')+'</div><button id="goLessons">看推薦課程</button></div>';
    panel(h);
    $('panel').querySelectorAll('[data-jump]').forEach(function(b){b.onclick=function(){openAnalysis(+b.getAttribute('data-jump'),null,0);};});
    $('panel').querySelectorAll('[data-redo]').forEach(function(b){b.onclick=function(){var p=+b.getAttribute('data-redo'),pos=posAt(p);startAI({level:G.rec.level!=null?G.rec.level:3,player:G.player,coach:true,fen:toFen(pos.b,pos.side),label:'從失誤處重下'});};});
    var gl=$('goLessons');if(gl)gl.onclick=function(){go('lessons');};
    bindShow();
  }
  function reviewRecord(rec){startReview(rec,null);}

  /* ---------- puzzles & placement ---------- */
  var PZ={list:[],i:0,title:''};
  function startPuzzleSet(ids,title,placement){PZ={list:ids,i:0,title:title,placement:placement||null,score:0};loadPuzzle();}
  function loadPuzzle(){
    aiEng.reset();coachEng.reset();stopFriend();
    var id=PZ.list[PZ.i],pz=PUZZLES[id];
    G=newG('puzzle',pz.fen);G.pz=pz;G.pzId=id;G.step=0;G.tries=0;G.player=G.side;G.pzMsg=pz.type==='win'?sideName(G.side)+'先，找出得子的一步':'';G.pzCls='';G.pzInfo=PZ.placement?'測驗 '+(PZ.i+1)+'/'+PZ.list.length:'第 '+(PZ.i+1)+'/'+PZ.list.length+' 題';
    viewPly=null;go('game',PZ.title);
    tools([{t:'提示',f:pzHint,dis:!!PZ.placement},{t:'看答案',f:pzShow},{t:'下一題',f:pzNext}]);
    if(pz.type==='win')panel('<div class="note"><div class="hd">'+sideName(G.player)+'先，找出得子（或取得大優勢）的一步</div><div class="sub">提示：先找對方沒有保護的棋子，再想想捉雙、抽將、將軍。</div></div>');
    else panel('<div class="note"><div class="hd">'+sideName(G.player)+'先，'+pz.n+' 步殺</div><div class="sub">每一步都要將軍或製造無法解的威脅。對方會用最頑強的方式防守。</div></div>');
    render();
  }
  function puzzleMove(m){
    var pz=G.pz,tok=G.tok;
    if(pz.type==='win'){
      if(m===pz.best){tacSolved(m,true);return;}
      var bw=G.b.slice();applyMove(bw,m);G.busy=true;G.pzMsg='檢查中…';render();
      coachEng.run({cmd:'think',board:bw,side:1-G.side,opts:{time:1500,analyze:true}}).then(function(r){if(stale(tok))return;G.busy=false;
        if(r&&-r.score>=pz.gain-70)tacSolved(m,false);else pzWrong(m);});
      return;}
    var exp=pz.sol[G.step*2];
    if(m===exp){pzAccept(m,true);return;}
    var b2=G.b.slice();applyMove(b2,m);
    if(!legalMoves(b2,1-G.side).length&&inCheck(b2,1-G.side)){pzAccept(m,false);return;}
    G.busy=true;G.pzMsg='檢查中…';render();
    var remain=pz.n-G.step-1;
    coachEng.run({cmd:'think',board:b2,side:1-G.side,opts:{time:1500,exact:true,analyze:true}}).then(function(r){
      if(stale(tok))return;G.busy=false;
      if(r&&mateIn(r.score)<0&&-mateIn(r.score)<=remain)pzAccept(m,false);
      else pzWrong(m);
    });
  }
  function pzWrong(m){
    G.tries++;G.pzMsg='不對喔，再想想';G.pzCls='check';G.arrows=[{m:m,color:'r'}];render();
    if(PZ.placement){setTimeout(function(){pzShow(true);},700);return;}
    setTimeout(function(){if(G.mode!=='puzzle')return;G.arrows=[];G.pzMsg='';G.pzCls='';render();},1100);
  }
  function pzAccept(m,onLine){
    var tok=G.tok;G.onLine=G.onLine!==false&&onLine;push(m);G.pzMsg='好棋！';G.pzCls='';render();
    if(G.over){pzSolved();return;}
    G.busy=true;
    var rep=G.onLine?G.pz.sol[G.step*2+1]:0;
    var p=rep&&legalMoves(G.b,G.side).indexOf(rep)>=0?Promise.resolve({move:rep}):coachEng.run({cmd:'think',board:G.b.slice(),side:G.side,opts:{time:900,exact:true}});
    p.then(function(r){if(stale(tok)||!r)return;setTimeout(function(){if(stale(tok))return;push(r.move);G.step++;G.busy=false;G.pzMsg='';render();if(G.over)pzSolved();},450);});
  }
  function tacSolved(m,main,shown){
    var pz=G.pz,first=G.tries===0&&!G.helped,b0=G.b.slice();
    if(!G.solved){G.solved=true;if(!PZ.placement&&!shown){P.puzzles[G.pzId]={t:Date.now(),first:first};saveP();}}
    push(m);G.arrows=[{m:m,color:'g'}];G.pzMsg=shown?'答案':'✓ 正確！';G.pzCls='over';render();
    panel('<div class="note"><div class="hd">'+(shown?'答案':'✓ '+(main?'正確':'這步也可以')+(first?'，一次答對！':''))+'</div><div>標準答案：<b>'+pz.cn+'</b>（'+pz.tags.join('，')+'）</div><div class="sub">後續變化：'+pz.line.join(' ')+'</div></div>');
    tools([{t:PZ.i+1<PZ.list.length?'下一題 ▶':'完成',p:1,f:pzNext}]);
  }
  function pzSolved(){
    var first=G.tries===0&&!G.helped;
    if(!G.solved){G.solved=true;if(PZ.placement){if(first)PZ.score++;}else{P.puzzles[G.pzId]={t:Date.now(),first:first};saveP();}}
    G.pzMsg='✓ 正確！'+(G.pz.name?'（'+G.pz.name+'）':'');G.pzCls='over';render();
    panel('<div class="note"><div class="hd">✓ 解開了'+(first?'，一次答對！':'')+'</div><div class="sub">完整解法：'+G.pz.cn.join(' ')+'</div>'+(G.pz.name?'<div>殺法：<b>'+G.pz.name+'</b></div>':'')+'</div>');
    tools([{t:PZ.i+1<PZ.list.length?'下一題 ▶':'完成',p:1,f:pzNext}]);
    if(PZ.placement)setTimeout(pzNext,1200);
  }
  function pzHint(){G.helped=true;var exp=G.pz.type==='win'?G.pz.best:G.pz.sol[G.step*2];G.sel=exp>>7;G.targets=[];render();toast('動這顆棋子');}
  function pzShow(auto){
    if(G.pz.type==='win'){G.helped=true;G.tries++;tacSolved(G.pz.best,true,true);return;}
    G.helped=true;var tok=G.tok,b=posAt(0).b,s=G.startSide;
    G.tok=Math.random();tok=G.tok;var o=G;G=newG('puzzle',o.pz.fen);['pz','pzId','player','pzInfo'].forEach(function(k){G[k]=o[k];});G.tok=tok;G.helped=true;G.tries=o.tries+1;G.solved=true;
    var i=0;(function step(){if(stale(tok))return;if(i>=G.pz.sol.length){G.pzMsg='答案：'+G.pz.cn.join(' ');render();
      panel('<div class="note"><div class="hd">答案</div><div>'+G.pz.cn.join(' ')+'</div>'+(G.pz.name?'<div class="sub">殺法：'+G.pz.name+'</div>':'')+'</div>');
      tools([{t:PZ.i+1<PZ.list.length?'下一題 ▶':'完成',p:1,f:pzNext}]);if(PZ.placement&&auto)setTimeout(pzNext,1500);return;}
      push(G.pz.sol[i]);i++;render();setTimeout(step,650);})();
  }
  function pzNext(){
    if(PZ.i+1<PZ.list.length){PZ.i++;loadPuzzle();return;}
    if(PZ.placement){var sc=PZ.score,tot=PZ.list.length,lv=sc<=3?1:sc<=6?2:sc<=9?3:sc<=12?4:5;P.placement={score:sc,total:tot,level:lv,date:Date.now()};saveP();
      go('lessons');toast('測驗完成：'+sc+'/'+tot);return;}
    go('puzzles');
  }
  function startPlacement(){
    var by={2:[],3:[],4:[]};PUZZLES.forEach(function(p,i){if(by[p.n])by[p.n].push(i);});
    var pick=function(a,k){var c=a.slice(),o=[];while(c.length&&o.length<k){o.push(c.splice(Math.floor(Math.random()*c.length),1)[0]);}return o;};
    var list=pick(by[2],5).concat(pick(by[3],5)).concat(pick(by[4],5));
    sheet('<h2>程度測驗</h2><p>共 '+list.length+' 題殺棋題，由易到難。每題只有一次機會，答錯會自動顯示答案。不能使用提示。</p><button class="big primary" id="plGo">開始</button>');
    $('plGo').onclick=function(){closeSheet();startPuzzleSet(list,'程度測驗',true);};
  }

  /* ---------- replay (classics, openings, imported) ---------- */
  function startReplay(game){
    aiEng.reset();coachEng.reset();stopFriend();
    G=newG('replay',game.fen);G.game=game;
    var b=G.b.slice(),s=G.side;
    game.moves.forEach(function(cn){var m=cnToMove(b,s,cn);if(!m)return;G.moves.push(m);applyMove(b,m);s=1-s;G.hashes.push(hashBoard(b,s)[0]);});
    G.end={b:b,side:s};G.player=game.flip?1:0;G.guess=false;G.guessOk=0;G.guessN=0;
    viewPly=0;go('game',game.title);
    tools(navTools().concat([{t:'猜下一步',f:toggleGuess}]));
    render();renderReplay();
  }
  function toggleGuess(){G.guess=!G.guess;G.sel=-1;G.targets=[];toast(G.guess?'猜猜看：輪到哪方就幫哪方走一步':'已關閉猜棋');tools(navTools().concat([{t:G.guess?'停止猜棋':'猜下一步',p:G.guess,f:toggleGuess}]));render();renderReplay();}
  function guessTap(sq){
    var k=viewPly;if(k>=G.moves.length)return;var pos=posAt(k);
    var hit=G.targets.filter(function(m){return (m&127)===sq;});
    if(hit.length){var m=hit[0],real=G.moves[k];G.guessN++;
      if(m===real){G.guessOk++;toast('✓ 猜中了！');}
      else toast('實戰走的是 '+moveToCN(pos.b,real));
      G.sel=-1;G.targets=[];setView(k+1);return;}
    var q=pos.b[sq];
    if(q&&(q>>3)===pos.side&&sq!==G.sel){G.sel=sq;G.targets=legalMoves(pos.b,pos.side).filter(function(m){return (m>>7)===sq;});}else{G.sel=-1;G.targets=[];}
    viewPly=k;render();
  }
  function renderReplay(){
    var k=viewPly,g=G.game,h='';
    if(k===0){h+='<div class="note"><div class="hd">'+esc(g.title)+'</div><div class="sub">'+esc([g.event,g.opening,g.result].filter(Boolean).join('・'))+'</div>'+(g.intro?'<div style="margin-top:6px">'+g.intro+'</div>':'')+'<div class="sub" style="margin-top:6px">按 ▶ 一步步看，或開啟「猜下一步」測試自己。</div></div>';panel(h);return;}
    var i=k-1,pos=posAt(i),cn=moveToCN(pos.b,G.moves[i]),note=g.notes&&g.notes[i];
    if(G.guess&&k<G.moves.length){h+='<div class="note"><div class="hd">輪到'+sideName(posAt(k).side)+'方，你猜下一步？</div><div class="sub">點棋子再點目的地；猜完會顯示實戰走法。</div></div>';}
    h+='<div class="note"><div class="hd">'+moveNoLabel(i,G.startSide)+' '+sideName(pos.side)+'：'+cn+'</div>'+(note?'<div style="margin:4px 0">'+note+'</div>':'')+'<div class="sub" id="engNote">'+describeMove(pos.b,G.moves[i],i).join('，')+'</div></div>';
    if(k===G.moves.length&&g.result)h+='<div class="note"><div class="hd">終局：'+esc(g.result)+'</div>'+(g.outro?'<div>'+g.outro+'</div>':'')+'</div>';
    panel(h);
    /* engine verdict (precomputed or live) */
    var a=g.ana&&g.ana[i];
    if(a){showVerdict(a.loss,a.best,a.bestPV);}
    else{var tok=G.tok;Promise.all([analyze(i,700),analyze(i+1,700)]).then(function(r){if(stale(tok)||viewPly!==k||!r[0]||!r[1])return;var n=makeNote(G,i,r[0],r[1]);G.notes[i]=n;showVerdict(n.loss,n.best?moveToCN(pos.b,n.best):'',pvToCN(pos.b,pos.side,r[0].pv,4).join(' '));renderStrip(k);});}
  }
  function showVerdict(loss,best,pv){
    var el=$('engNote');if(!el)return;var gr=gradeLoss(loss,loss<=10);
    el.innerHTML+='<br>引擎評價：<span class="tag" style="background:'+gr.c+';color:#fff;border-radius:6px;padding:0 6px">'+gr.t+'</span>'+(loss>60&&best?'　引擎建議：'+best+(pv?'（'+pv+'）':''):'');
  }

  /* ---------- lessons ---------- */
  function runLessonStep(l,s){
    if(s.type==='puzzles'){var ids=PUZZLES.map(function(p,i){return (s.names?s.names.indexOf(p.name)>=0:true)&&(!s.n||p.n===s.n)?i:-1;}).filter(function(i){return i>=0;}).slice(0,s.count||5);
      if(!ids.length){toast('題庫中暫無此類題目');return;}startPuzzleSet(ids,l.title);}
    else if(s.type==='play')startAI({level:s.level||4,player:s.player||0,coach:true,fen:s.fen,label:s.label||l.title,lessonId:s.complete?l.id:null});
    else if(s.type==='replay'){var gm=s.classic?CLASSICS.filter(function(x){return x.id===s.classic;})[0]:OPENINGS.filter(function(x){return x.id===s.opening;})[0];if(gm)startReplay(gm);}
    else if(s.type==='tactics'){var tids=PUZZLES.map(function(p,i){return p.type==='win'&&(!s.tag||p.tags.join('').indexOf(s.tag)>=0)?i:-1;}).filter(function(i){return i>=0;});
      if(tids.length<3)tids=PUZZLES.map(function(p,i){return p.type==='win'?i:-1;}).filter(function(i){return i>=0;});
      tids.sort(function(){return Math.random()-0.5;});tids=tids.slice(0,s.count||6);if(!tids.length){toast('題庫中暫無此類題目');return;}startPuzzleSet(tids,l.title);}
  }

  /* ---------- friend (online) ---------- */
  function stopFriend(){if(unsub){unsub();unsub=null;}if(G&&G.mode==='friend'){if(G.awayT){clearInterval(G.awayT);G.awayT=null;}if(G.entered)Online.leaveRoom(G.room);}}
  function startFriend(id){
    aiEng.reset();coachEng.reset();stopFriend();
    G=newG('friend');G.room=id;G.roomStatus='loading';viewPly=null;feed=[];
    go('game','好友對戰');tools([{t:'認輸',f:resign},{t:'提和',f:function(){Online.offerDraw(G.room);toast('已提出和棋');}}]);
    panel('<div class="note sub">連線中…</div>');render();
    unsub=Online.watchRoom(id,onRoom,function(e){panel('<div class="note">無法讀取對局：'+esc(e.message)+'</div>');});
  }
  function onRoom(r,meta){
    if(!G||G.mode!=='friend')return;
    if(r&&r.id&&r.id!==G.room)return;
    if(r&&meta&&!meta.pending&&G.sentAt&&r.moves&&r.moves.length===G.sentLen){G.lat=(performance.now()-G.sentAt)/1000;G.sentAt=0;}
    if(r&&meta&&meta.pending&&r.moves&&r.moves.length===G.moves.length&&r.status===G.roomStatus)return;
    if(!r){panel('<div class="note">找不到這個對局。</div>');return;}
    var uid=Online.uid;
    if(r.status==='waiting'&&r.red!==uid&&r.black!==uid){Online.joinRoom(G.room).catch(function(e){toast('加入失敗：'+e.message);});return;}
    var player=r.red===uid?0:r.black===uid?1:-1;
    if(G.moves.length!==r.moves.length||G.player!==player){
      var o=G;G=newG('friend');['room','tok','entered','startedNote','awayT','awaySince','awayLeft','lat','closed'].forEach(function(k){G[k]=o[k];});r.moves.forEach(function(m){push(m);});G.over=false;G.winner=null;
      if(r.moves.length>o.moves.length&&o.moves.length){var lb=posAt(r.moves.length-1),lm=r.moves[r.moves.length-1];if(((r.moves.length-1)%2)!==player)feed.unshift({ai:true,who:'對手',cn:moveToCN(lb.b,lm),desc:describeMove(lb.b,lm,r.moves.length-1),ply:r.moves.length-1});}
    }
    G.player=player<0?0:player;G.spectator=player<0;G.roomStatus=r.status;G.roomData=r;
    if(!G.spectator&&!G.entered&&(r.status==='waiting'||r.status==='playing')){G.entered=true;Online.enterRoom(G.room);}
    if(r.status==='playing'&&r.host===uid&&!G.startedNote){G.startedNote=true;Online.roomStarted(G.room);}
    /* opponent presence (Realtime Database rooms) */
    if(r.presence&&r.status==='playing'&&!G.spectator){
      var opp=G.player===0?r.black:r.red,here=!!r.presence[opp];
      if(!here&&!G.awayT){G.awaySince=Date.now();G.awayT=setInterval(checkAway,1000);}
      if(here&&G.awayT){clearInterval(G.awayT);G.awayT=null;G.awayLeft=0;}
    }else if(G.awayT){clearInterval(G.awayT);G.awayT=null;G.awayLeft=0;}
    if(r.status==='closed'){G.over=true;G.winner=-1;G.drawWhy='對方已離開，對局取消';G.closed=true;}
    if(r.status==='done'){G.over=true;G.winner=r.result==='red'?0:r.result==='black'?1:-1;G.resigned=r.reason==='resign'&&G.winner!==G.player;G.leftWin=r.reason==='left';G.drawWhy=r.reason==='agreed'?'雙方同意':r.reason==='repeat'?'同一局面重複三次':'';if(G.awayT){clearInterval(G.awayT);G.awayT=null;}friendEnd(r);}
    render();renderFriendPanel();
  }
  function renderFriendPanel(){
    var r=G.roomData,h='',link=location.origin+location.pathname+'?room='+G.room+'&openExternalBrowser=1';
    h+='<div class="note"><div class="hd">🔴 '+esc(r.redName||'等待加入')+' '+(r.redRating||'')+'　vs　⚫ '+esc(r.blackName||'等待加入')+' '+(r.blackRating||'')+'</div>'+(G.spectator?'<div class="sub">你正在觀戰</div>':'')+'</div>';
    if(r.status==='waiting')h+='<div class="note warn"><div class="hd">把連結傳給朋友</div><div style="word-break:break-all;font-size:13px">'+esc(link)+'</div><div class="row"><button class="btn primary" id="cpLink">複製連結</button></div><div class="sub">朋友從 LINE 點連結，會自動用手機瀏覽器打開並加入對局。</div></div>';
    if(G.awayT&&G.awayLeft>0)h+='<div class="note warn"><div class="hd">⚠ 對手已離線</div><div>'+G.awayLeft+' 秒內沒回來，判定你獲勝。</div></div>';
    if(G.closed)h+='<div class="note"><div class="hd">對方已離開，對局取消</div></div>';
    if(r.drawOffer&&r.drawOffer!==Online.uid&&r.status==='playing')h+='<div class="note"><div class="hd">對手提議和棋</div><div class="row"><button class="btn primary" id="accDraw">接受</button></div></div>';
    if(G.over)h+=endPanelHtml();
    h+='<div class="feed">'+feed.slice(0,30).map(function(n){return noteHtml(n);}).join('')+'</div>';
    panel(h);bindEnd();
    var cp=$('cpLink');if(cp)cp.onclick=function(){try{navigator.clipboard.writeText(link).then(function(){toast('已複製，貼到 LINE 給朋友');},function(){toast('請長按上方連結複製');});}catch(e){toast('請長按上方連結複製');}};
    var ad=$('accDraw');if(ad)ad.onclick=function(){Online.acceptDraw(G.room);};
  }
  function friendMove(m){
    var len=G.moves.length,tok=G.tok;push(m);
    var end=null;if(G.over)end={result:G.winner===0?'red':G.winner===1?'black':'draw',reason:G.winner===-1?'repeat':'mate'};
    G.over=false;G.sentAt=performance.now();G.sentLen=len+1;render();
    var t0=performance.now(),gg=G;Online.sendMove(G.room,m,len,end,G.moves.slice()).then(function(){gg.lat=(performance.now()-t0)/1000;if(G===gg)renderStatus();}).catch(function(e){toast('送出失敗，重新同步：'+e.message);var id=G.room;startFriend(id);});
  }
  function checkAway(){
    if(!G||G.mode!=='friend'||!G.awayT)return;
    var left=60-Math.floor((Date.now()-G.awaySince)/1000);G.awayLeft=left;
    if(left<=0){clearInterval(G.awayT);G.awayT=null;Online.claimWin(G.room,G.player);return;}
    renderFriendPanel();
  }
  function friendEnd(r){
    if(G.spectator||G.closed||r.status==='closed'||P.friendDone&&P.friendDone[G.room])return;
    P.friendDone=P.friendDone||{};P.friendDone[G.room]=1;
    var score=G.winner===-1?0.5:G.winner===G.player?1:0,oppR=G.player===0?(r.blackRating||1200):(r.redRating||1200),delta=elo(P.rating,oppR,score,24);
    P.rating+=delta;G.endInfo='Rating '+(delta>=0?'+':'')+delta+' → '+P.rating;
    G.record={mode:'friend',opp:(G.player===0?r.blackName:r.redName)||'好友',oppRating:oppR,player:G.player,moves:r.moves.slice(),score:score,rated:true,delta:delta,fen:null,level:4};
    addRecord(G.record);
  }

  function leave(force){
    if(!force&&G&&G.mode==='friend'&&!G.spectator&&!G.over&&G.room){
      if(G.roomStatus==='playing'){
        sheet('<h2>離開對局？</h2><p style="font-size:18px">對局還在進行，離開會判定你<b>認輸</b>。</p><div class="row"><button class="btn" onclick="closeSheet()">繼續下棋</button><button class="btn primary" id="lvY">認輸並離開</button></div>');
        $('lvY').onclick=function(){closeSheet();var id=G.room;Online.resign(id).then(function(){leave(true);},function(){leave(true);});};return;}
      else if(!G.roomData||G.roomData.host===Online.uid)Online.closeRoom(G.room);
    }
    A=null;var m=G&&G.mode;aiEng.reset();coachEng.reset();stopFriend();if(G)G.tok=Math.random();
    if(m==='puzzle')go(PZ.placement?'lessons':'puzzles');else if(m==='replay')go('classics');else if(m==='review')go('records');else if(m==='friend')go('friend');
    else if(G&&G.lessonId)go('lessons');else go('home');
  }

  return {startAI:startAI,resume:resume,startReview:startReview,reviewRecord:reviewRecord,startPuzzleSet:startPuzzleSet,startPlacement:startPlacement,
    startReplay:startReplay,runLessonStep:runLessonStep,startFriend:startFriend,leave:leave,get G(){return G;}};
})();
