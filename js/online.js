/* ===== online: Firebase (anonymous auth + Firestore) ===== */
var Online={ready:false,uid:null,reason:''};
(function(){
  var cfg=window.FIREBASE_CONFIG;
  if(!cfg||!cfg.apiKey){Online.reason='尚未設定 Firebase，目前為離線模式';return;}
  var V='10.12.2',base='https://www.gstatic.com/firebasejs/'+V+'/',fs,db,authM,auth;
  function refresh(){if(typeof curView!=='undefined'&&(curView==='home'||curView==='rank'||curView==='friend'))go(curView);}
  Promise.all([import(base+'firebase-app.js'),import(base+'firebase-auth.js'),import(base+'firebase-firestore.js')]).then(function(m){
    var app=m[0].initializeApp(cfg);authM=m[1];auth=authM.getAuth(app);fs=m[2];db=fs.getFirestore(app);
    authM.onAuthStateChanged(auth,function(u){
      if(!u){authM.signInAnonymously(auth).catch(function(e){Online.reason='登入失敗：'+e.message;refresh();});return;}
      Online.uid=u.uid;loadProfile().then(function(){Online.ready=true;Online.ping('idle');setInterval(function(){Online.ping();},60000);listenInvites();refresh();}).catch(function(e){Online.reason='讀取資料失敗：'+e.message;refresh();});
    });
  }).catch(function(e){Online.reason='無法載入線上功能（請使用 GitHub 網址開啟）';refresh();});

  function uref(){return fs.doc(db,'users',Online.uid);}
  function loadProfile(){
    return fs.getDoc(uref()).then(function(s){
      if(s.exists()){var d=s.data();['rating','games','wins','losses','draws'].forEach(function(k){if(typeof d[k]==='number')P[k]=d[k];});if(!P.name&&d.name)P.name=d.name;try{localStorage.setItem('xqdojo',JSON.stringify(P));}catch(e){}}
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
  Online.createRoom=function(side){
    var id=rid(),me={uid:Online.uid,name:P.name,rating:P.rating};
    var d={host:Online.uid,red:side===0?me.uid:null,black:side===1?me.uid:null,redName:side===0?me.name:null,blackName:side===1?me.name:null,
      redRating:side===0?me.rating:null,blackRating:side===1?me.rating:null,moves:[],status:'waiting',drawOffer:null,created:fs.serverTimestamp(),updated:fs.serverTimestamp()};
    return fs.setDoc(fs.doc(db,'rooms',id),d).then(function(){return id;});
  };
  Online.joinRoom=function(id){
    var ref=fs.doc(db,'rooms',id);
    return fs.runTransaction(db,function(tx){return tx.get(ref).then(function(s){
      if(!s.exists())throw new Error('對局不存在');var r=s.data();
      if(r.status!=='waiting')throw new Error('對局已開始');
      var up={status:'playing',updated:fs.serverTimestamp()};
      if(!r.red){up.red=Online.uid;up.redName=P.name;up.redRating=P.rating;}else if(!r.black){up.black=Online.uid;up.blackName=P.name;up.blackRating=P.rating;}else throw new Error('對局已滿');
      tx.update(ref,up);});});
  };
  Online.watchRoom=function(id,cb,err){return fs.onSnapshot(fs.doc(db,'rooms',id),function(s){cb(s.exists()?Object.assign({id:id},s.data()):null);},err);};
  Online.sendMove=function(id,m,len,end){
    var ref=fs.doc(db,'rooms',id);
    return fs.runTransaction(db,function(tx){return tx.get(ref).then(function(s){
      var r=s.data();if(r.status!=='playing')throw new Error('對局未進行');
      if(r.moves.length!==len)throw new Error('棋局不同步，請重新整理');
      if((len%2===0?r.red:r.black)!==Online.uid)throw new Error('還沒輪到你');
      var up={moves:r.moves.concat([m]),drawOffer:null,updated:fs.serverTimestamp()};
      if(end){up.status='done';up.result=end.result;up.reason=end.reason;}
      tx.update(ref,up);});});
  };
  Online.resign=function(id){var ref=fs.doc(db,'rooms',id);
    return fs.runTransaction(db,function(tx){return tx.get(ref).then(function(s){var r=s.data();if(r.status!=='playing')return;tx.update(ref,{status:'done',result:r.red===Online.uid?'black':'red',reason:'resign',updated:fs.serverTimestamp()});});});};
  Online.offerDraw=function(id){return fs.updateDoc(fs.doc(db,'rooms',id),{drawOffer:Online.uid});};
  Online.acceptDraw=function(id){return fs.updateDoc(fs.doc(db,'rooms',id),{status:'done',result:'draw',reason:'agreed',updated:fs.serverTimestamp()});};
  Online.myRooms=function(){
    var c=fs.collection(db,'rooms');
    return Promise.all([fs.getDocs(fs.query(c,fs.where('red','==',Online.uid))),fs.getDocs(fs.query(c,fs.where('black','==',Online.uid)))]).then(function(qs){
      var out=[],seen={};qs.forEach(function(q){q.forEach(function(d){if(seen[d.id])return;seen[d.id]=1;var x=d.data();x.id=d.id;if(x.status!=='done')out.push(x);});});return out;});
  };
})();
