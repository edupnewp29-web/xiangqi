/* ===== online: Firebase (anonymous auth + Firestore) ===== */
var Online={ready:false,uid:null,reason:'',anon:true};
Online.whenReady=new Promise(function(res){Online._ready=res;});
(function(){
  var cfg=window.FIREBASE_CONFIG;
  if(!cfg||!cfg.apiKey){Online.reason='尚未設定 Firebase，目前為離線模式';return;}
  var V='10.12.2',base='https://www.gstatic.com/firebasejs/'+V+'/',fs,db,authM,auth,dbm=null,rdb=null;
  function refresh(){if(typeof curView!=='undefined'&&(curView==='home'||curView==='rank'||curView==='friend'))go(curView);}
  var mods=[import(base+'firebase-app.js'),import(base+'firebase-auth.js'),import(base+'firebase-firestore.js')];
  if(cfg.databaseURL)mods.push(import(base+'firebase-database.js'));
  Promise.all(mods).then(function(m){
    var app=m[0].initializeApp(cfg);authM=m[1];auth=authM.getAuth(app);fs=m[2];db=fs.getFirestore(app);
    if(m[3]){try{dbm=m[3];rdb=dbm.getDatabase(app);
      /* use Realtime Database for rooms only if it really connects */
      var probe=dbm.onValue(dbm.ref(rdb,'.info/connected'),function(s){if(s.val()===true){Online.rtdb=true;}});
      setTimeout(function(){if(!Online.rtdb)console.warn('RTDB not reachable, rooms use Firestore');},6000);}catch(e){console.warn('rtdb',e.message);}}
    var started=false;
    authM.onAuthStateChanged(auth,function(u){
      if(!u){Online.ready=false;authM.signInAnonymously(auth).catch(function(e){Online.reason='登入失敗：'+e.message;refresh();});return;}
      if(Online.ready&&Online.uid===u.uid){Online.anon=u.isAnonymous;return;}
      /* a different account on this browser: start from a clean local profile */
      P.uid=u.uid;Online.uid=u.uid;Online.anon=u.isAnonymous;
      loadProfile().then(function(){Online.ready=true;Online.reason='';Online.ping('idle');
        if(!started){started=true;setInterval(function(){Online.ping();},60000);}
        listenInvites();Online._ready();refresh();}).catch(function(e){Online.reason='讀取資料失敗：'+e.message;refresh();});
    });
  }).catch(function(e){Online.reason='無法載入線上功能（請使用 GitHub 網址開啟）';refresh();});

  function uref(){return fs.doc(db,'users',Online.uid);}
  /* ----- accounts: nickname + password (Firebase email/password under the hood) ----- */
  function nameEmail(name){var b=new TextEncoder().encode(name),h='';b.forEach(function(x){h+=('0'+x.toString(16)).slice(-2);});return 'n'+h+'@xiangqi-dojo.app';}
  function authErr(e){var c=(e&&e.code)||'';
    if(c.indexOf('email-already-in-use')>=0||c.indexOf('credential-already-in-use')>=0)return '這個暱稱已經有人用了，請換一個';
    if(c.indexOf('weak-password')>=0)return '密碼至少要 6 碼';
    if(c.indexOf('invalid-credential')>=0||c.indexOf('wrong-password')>=0||c.indexOf('user-not-found')>=0||c.indexOf('invalid-login')>=0)return '暱稱或密碼不對';
    if(c.indexOf('operation-not-allowed')>=0)return 'Firebase 尚未啟用「電子郵件/密碼」登入';
    if(c.indexOf('too-many-requests')>=0)return '嘗試太多次，請稍後再試';
    if(c.indexOf('network')>=0)return '網路連線失敗';
    return (e&&e.message)||'發生錯誤';}
  Online.nameBytesOk=function(name){return new TextEncoder().encode(name).length<=31;};
  Online.register=function(name,pw){
    var cred=authM.EmailAuthProvider.credential(nameEmail(name),pw);
    return authM.linkWithCredential(auth.currentUser,cred).then(function(){Online.anon=false;P.name=name;saveP();Online.ping('idle');})
      .catch(function(e){throw new Error(authErr(e));});
  };
  Online.login=function(name,pw){return authM.signInWithEmailAndPassword(auth,nameEmail(name),pw).catch(function(e){throw new Error(authErr(e));});};
  Online.logout=function(){var keep=P.setup;P=defaultProfile();P.setup=keep;try{localStorage.setItem('xqdojo',JSON.stringify(P));}catch(e){}return authM.signOut(auth);};
  function loadProfile(){
    return fs.getDoc(uref()).then(function(s){
      if(s.exists()){var d=s.data();['rating','games','wins','losses','draws'].forEach(function(k){if(typeof d[k]==='number')P[k]=d[k];});if(d.name)P.name=d.name;try{localStorage.setItem('xqdojo',JSON.stringify(P));}catch(e){}}
      else if(P.name)return fs.setDoc(uref(),pubProfile());
    });
  }
  function pubProfile(){return {name:P.name||'訪客',rating:P.rating,games:P.games,wins:P.wins,losses:P.losses,draws:P.draws,updated:fs.serverTimestamp()};}
  var syncT=null;
  Online.syncProfile=function(){if(!P.name)return;clearTimeout(syncT);syncT=setTimeout(function(){fs.setDoc(uref(),pubProfile(),{merge:true}).catch(function(e){console.warn('sync',e.message);});},400);};
  Online.saveGame=function(rec){
    fs.addDoc(fs.collection(db,'games'),{uid:Online.uid,name:P.name||'訪客',mode:rec.mode,opp:rec.opp,oppRating:rec.oppRating||0,player:rec.player,score:rec.score,rated:!!rec.rated,delta:rec.delta||0,moves:rec.moves,fen:rec.fen||null,ts:fs.serverTimestamp()}).catch(function(e){console.warn('saveGame',e.message);});
  };
  Online.leaderboard=function(){
    return fs.getDocs(fs.query(fs.collection(db,'users'),fs.orderBy('rating','desc'),fs.limit(100))).then(function(q){
      var out=[];q.forEach(function(d){var x=d.data();if((x.games||0)>0||d.id===Online.uid){x.id=d.id;out.push(x);}});return out;});
  };
  Online.myGames=function(){return fs.getDocs(fs.query(fs.collection(db,'games'),fs.where('uid','==',Online.uid),fs.limit(100))).then(function(q){var o=[];q.forEach(function(d){o.push(d.data());});return o;});};

  /* ----- presence & invites ----- */
  var lastStatus='idle';
  Online.ping=function(st){if(st)lastStatus=st;if(!P.name)return;fs.setDoc(uref(),{name:P.name,rating:P.rating,lastSeen:fs.serverTimestamp(),status:lastStatus},{merge:true}).catch(function(e){console.warn('ping',e.message);});};
  document.addEventListener('visibilitychange',function(){if(!document.hidden&&Online.ready)Online.ping();});
  Online.onlineUsers=function(){
    var since=fs.Timestamp.fromMillis(Date.now()-3*60*1000);
    return fs.getDocs(fs.query(fs.collection(db,'users'),fs.where('lastSeen','>=',since))).then(function(q){var o=[];q.forEach(function(d){var x=d.data();x.id=d.id;o.push(x);});
      o.sort(function(a,b){return (a.id===Online.uid?-1:b.id===Online.uid?1:0)||(b.rating-a.rating);});return o;});
  };
  Online.invite=function(target){
    return Online.createRoom(0).then(function(room){return fs.setDoc(fs.doc(db,'invites',target),{from:Online.uid,fromName:P.name,room:room,ts:fs.serverTimestamp()}).then(function(){return room;});});
  };
  Online.clearInvite=function(){return fs.deleteDoc(fs.doc(db,'invites',Online.uid)).catch(function(){});};
  var seenInv={};
  function listenInvites(){
    fs.onSnapshot(fs.doc(db,'invites',Online.uid),function(s){
      if(!s.exists())return;var d=s.data();if(!d.room||seenInv[d.room])return;
      var t=d.ts&&d.ts.toMillis?d.ts.toMillis():Date.now();if(Date.now()-t>10*60*1000)return;
      seenInv[d.room]=1;if(typeof showInvite==='function')showInvite(d);
    },function(e){console.warn('invites',e.message);});
  }

  /* ----- rooms ----- */
  function rid(){var c='abcdefghjkmnpqrstuvwxyz23456789',s='';for(var i=0;i<8;i++)s+=c[Math.floor(Math.random()*c.length)];return s;}
  var fCreate=function(side){
    var id=rid(),me={uid:Online.uid,name:P.name,rating:P.rating};
    var d={host:Online.uid,red:side===0?me.uid:null,black:side===1?me.uid:null,redName:side===0?me.name:null,blackName:side===1?me.name:null,
      redRating:side===0?me.rating:null,blackRating:side===1?me.rating:null,moves:[],status:'waiting',drawOffer:null,created:fs.serverTimestamp(),updated:fs.serverTimestamp()};
    return fs.setDoc(fs.doc(db,'rooms',id),d).then(function(){return id;});
  };
  var fJoin=function(id){
    var ref=fs.doc(db,'rooms',id);
    return fs.runTransaction(db,function(tx){return tx.get(ref).then(function(s){
      if(!s.exists())throw new Error('對局不存在');var r=s.data();
      if(r.status!=='waiting')throw new Error('對局已開始');
      var up={status:'playing',updated:fs.serverTimestamp()};
      if(!r.red){up.red=Online.uid;up.redName=P.name;up.redRating=P.rating;}else if(!r.black){up.black=Online.uid;up.blackName=P.name;up.blackRating=P.rating;}else throw new Error('對局已滿');
      tx.update(ref,up);});});
  };
  var fWatch=function(id,cb,err){return fs.onSnapshot(fs.doc(db,'rooms',id),{includeMetadataChanges:true},function(s){cb(s.exists()?Object.assign({id:id},s.data()):null,{pending:s.metadata.hasPendingWrites,cache:s.metadata.fromCache});},err);};
  /* single direct write (no transaction): one network round trip */
  var fSend=function(id,m,len,end,all){
    var up={moves:all,drawOffer:null,updated:fs.serverTimestamp()};
    if(end){up.status='done';up.result=end.result;up.reason=end.reason;}
    return fs.updateDoc(fs.doc(db,'rooms',id),up);
  };
  var fResign=function(id){var ref=fs.doc(db,'rooms',id);
    return fs.runTransaction(db,function(tx){return tx.get(ref).then(function(s){var r=s.data();if(r.status!=='playing')return;tx.update(ref,{status:'done',result:r.red===Online.uid?'black':'red',reason:'resign',updated:fs.serverTimestamp()});});});};
  var fOffer=function(id){return fs.updateDoc(fs.doc(db,'rooms',id),{drawOffer:Online.uid});};
  var fAccept=function(id){return fs.updateDoc(fs.doc(db,'rooms',id),{status:'done',result:'draw',reason:'agreed',updated:fs.serverTimestamp()});};
  var fMine=function(){
    var c=fs.collection(db,'rooms');
    return Promise.all([fs.getDocs(fs.query(c,fs.where('red','==',Online.uid))),fs.getDocs(fs.query(c,fs.where('black','==',Online.uid)))]).then(function(qs){
      var out=[],seen={};qs.forEach(function(q){q.forEach(function(d){if(seen[d.id])return;seen[d.id]=1;var x=d.data();x.id=d.id;if(x.status!=='done')out.push(x);});});return out;});
  };

  /* ----- Realtime Database rooms (low latency + presence) ----- */
  function rr(p){return dbm.ref(rdb,p);}
  function isR(id){return id&&id.charAt(0)==='R';}
  function normMoves(mv){if(!mv)return [];if(Array.isArray(mv))return mv.filter(function(x){return x!=null;});return Object.keys(mv).map(Number).sort(function(a,b){return a-b;}).map(function(k){return mv[k];});}
  function rCreate(side){
    var id='R'+rid(),d={host:Online.uid,status:'waiting',created:dbm.serverTimestamp(),updated:dbm.serverTimestamp()};
    if(side===0){d.red=Online.uid;d.redName=P.name;d.redRating=P.rating;}else{d.black=Online.uid;d.blackName=P.name;d.blackRating=P.rating;}
    return dbm.set(rr('rooms/'+id),d).then(function(){dbm.onDisconnect(rr('rooms/'+id+'/status')).set('closed');return id;});
  }
  function rJoin(id){
    var err='';
    return dbm.runTransaction(rr('rooms/'+id),function(r){
      if(!r)return r;
      if(r.status!=='waiting'){err=r.status==='closed'?'對方已經離開了':'對局已開始';return;}
      if(r.presence&&r.host&&!r.presence[r.host]){err='對方已經離開了';return;}
      if(!r.red){r.red=Online.uid;r.redName=P.name;r.redRating=P.rating;}else if(!r.black){r.black=Online.uid;r.blackName=P.name;r.blackRating=P.rating;}else{err='對局已滿';return;}
      r.status='playing';r.updated=Date.now();return r;
    }).then(function(res){if(err)throw new Error(err);if(!res.snapshot.exists())throw new Error('對局不存在');});
  }
  function rWatch(id,cb,errf){
    return dbm.onValue(rr('rooms/'+id),function(s){var v=s.val();if(!v){cb(null,{});return;}v.id=id;v.moves=normMoves(v.moves);v.presence=v.presence||{};cb(v,{rt:true});},errf);
  }
  function rSend(id,m,len,end){
    var up={};up['moves/'+len]=m;up.drawOffer=null;up.updated=dbm.serverTimestamp();
    if(end){up.status='done';up.result=end.result;up.reason=end.reason;}
    return dbm.update(rr('rooms/'+id),up);
  }
  function rEnd(id,result,reason){return dbm.update(rr('rooms/'+id),{status:'done',result:result,reason:reason,updated:dbm.serverTimestamp()});}
  function rMine(){
    var q=function(f){return dbm.get(dbm.query(rr('rooms'),dbm.orderByChild(f),dbm.equalTo(Online.uid)));};
    return Promise.all([q('red'),q('black')]).then(function(ss){var out=[],seen={},now=Date.now();
      ss.forEach(function(s){s.forEach(function(c){var x=c.val();if(seen[c.key])return;seen[c.key]=1;x.id=c.key;x.moves=normMoves(x.moves);
        var alive=x.presence&&Object.keys(x.presence).length>0,fresh=now-(x.updated||0)<6*3600*1000;
        if((x.status==='waiting'||x.status==='playing')&&alive&&fresh)out.push(x);});});return out;});
  }
  var inRoom=null;
  Online.enterRoom=function(id){if(!isR(id)||!Online.rtdb)return;inRoom=id;var p=rr('rooms/'+id+'/presence/'+Online.uid);dbm.set(p,true);dbm.onDisconnect(p).remove();};
  Online.leaveRoom=function(id){if(!isR(id)||!dbm)return;var p=rr('rooms/'+id+'/presence/'+Online.uid);dbm.onDisconnect(p).cancel();dbm.remove(p);if(inRoom===id)inRoom=null;};
  Online.roomStarted=function(id){if(isR(id)&&dbm)dbm.onDisconnect(rr('rooms/'+id+'/status')).cancel();};
  Online.closeRoom=function(id){if(isR(id)&&dbm)return dbm.update(rr('rooms/'+id),{status:'closed'});return fs.updateDoc(fs.doc(db,'rooms',id),{status:'done',result:'draw',reason:'closed'}).catch(function(){});};
  Online.claimWin=function(id,myColor){return isR(id)?rEnd(id,myColor===0?'red':'black','left'):Promise.resolve();};

  /* ----- router: new rooms on RTDB when available; old Firestore rooms keep working ----- */
  Online.createRoom=function(side){return Online.rtdb?rCreate(side):fCreate(side);};
  Online.joinRoom=function(id){return isR(id)?rJoin(id):fJoin(id);};
  Online.watchRoom=function(id,cb,err){return isR(id)?rWatch(id,cb,err):fWatch(id,cb,err);};
  Online.sendMove=function(id,m,len,end,all){return isR(id)?rSend(id,m,len,end):fSend(id,m,len,end,all);};
  Online.resign=function(id){
    if(!isR(id))return fResign(id);
    return dbm.get(rr('rooms/'+id)).then(function(s){var r=s.val();if(!r||r.status!=='playing')return;return rEnd(id,r.red===Online.uid?'black':'red','resign');});};
  Online.offerDraw=function(id){return isR(id)?dbm.update(rr('rooms/'+id),{drawOffer:Online.uid}):fOffer(id);};
  Online.acceptDraw=function(id){return isR(id)?rEnd(id,'draw','agreed'):fAccept(id);};
  Online.myRooms=function(){
    var fsP=fMine().then(function(l){var now=Date.now();return l.filter(function(x){var t=x.updated&&x.updated.toMillis?x.updated.toMillis():0;return now-t<2*3600*1000;});}).catch(function(){return [];});
    var rP=Online.rtdb?rMine().catch(function(){return [];}):Promise.resolve([]);
    return Promise.all([rP,fsP]).then(function(a){return a[0].concat(a[1]);});
  };
})();
