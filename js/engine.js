/* ===== Xiangqi engine v2 — shared by page (main thread) and worker ===== */
var KING=1,ADV=2,ELE=3,HORSE=4,ROOK=5,CANNON=6,PAWN=7;
var MATE=30000,INF=32000;
var VALS=[0,0,200,200,400,900,450,100];
var PST=[];
PST[PAWN]=[
 0, 3, 6, 9,12, 9, 6, 3, 0,
18,36,56,80,120,80,56,36,18,
14,26,42,60,80,60,42,26,14,
10,20,30,34,40,34,30,20,10,
 6,12,18,18,20,18,18,12, 6,
 2, 0, 8, 0, 8, 0, 8, 0, 2,
 0, 0,-2, 0, 4, 0,-2, 0, 0,
 0, 0, 0, 0, 0, 0, 0, 0, 0,
 0, 0, 0, 0, 0, 0, 0, 0, 0,
 0, 0, 0, 0, 0, 0, 0, 0, 0];
PST[HORSE]=[
 4, 8,16,12, 4,12,16, 8, 4,
 4,10,28,16, 8,16,28,10, 4,
12,14,16,20,18,20,16,14,12,
 8,24,18,24,20,24,18,24, 8,
 6,16,14,18,16,18,14,16, 6,
 4,12,16,14,12,14,16,12, 4,
 2, 6, 8, 6,10, 6, 8, 6, 2,
 4, 2, 8, 8, 4, 8, 8, 2, 4,
 0, 2, 4, 4,-2, 4, 4, 2, 0,
 0,-4, 0, 0, 0, 0, 0,-4, 0];
PST[ROOK]=[
14,14,12,18,16,18,12,14,14,
16,20,18,24,26,24,18,20,16,
12,12,12,18,18,18,12,12,12,
12,18,16,22,22,22,16,18,12,
12,14,12,18,18,18,12,14,12,
12,16,14,20,20,20,14,16,12,
 6,10, 8,14,14,14, 8,10, 6,
 4, 8, 6,14,12,14, 6, 8, 4,
 8, 4, 8,16, 8,16, 8, 4, 8,
-2,10, 6,14,12,14, 6,10,-2];
PST[CANNON]=[
 6, 4, 0,-10,-12,-10, 0, 4, 6,
 2, 2, 0,-4,-14,-4, 0, 2, 2,
 2, 2, 0,-10,-8,-10, 0, 2, 2,
 0, 0,-2, 4,10, 4,-2, 0, 0,
 0, 0, 0, 2, 8, 2, 0, 0, 0,
-2, 0, 4, 2, 6, 2, 4, 0,-2,
 0, 0, 0, 2, 4, 2, 0, 0, 0,
 4, 0, 8, 6,10, 6, 8, 0, 4,
 0, 2, 4, 6, 6, 6, 4, 2, 0,
 0, 0, 2, 6, 6, 6, 2, 0, 0];
PST[KING]=[0,0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0,0,
 0,0,0,-12,-14,-12,0,0,0, 0,0,0,-6,-8,-6,0,0,0, 0,0,0,2,6,2,0,0,0];

var INIT=[
13,12,11,10, 9,10,11,12,13,
 0, 0, 0, 0, 0, 0, 0, 0, 0,
 0,14, 0, 0, 0, 0, 0,14, 0,
15, 0,15, 0,15, 0,15, 0,15,
 0, 0, 0, 0, 0, 0, 0, 0, 0,
 0, 0, 0, 0, 0, 0, 0, 0, 0,
 7, 0, 7, 0, 7, 0, 7, 0, 7,
 0, 6, 0, 0, 0, 0, 0, 6, 0,
 0, 0, 0, 0, 0, 0, 0, 0, 0,
 5, 4, 3, 2, 1, 2, 3, 4, 5];

function pstVal(p,sq){var t=p&7,s=p>>3,r=(sq/9)|0,c=sq-r*9;if(s===1)r=9-r;var tb=PST[t];var v=VALS[t]+(tb?tb[r*9+c]:0);return s===0?v:-v;}
function evalBoard(b){var s=0;for(var i=0;i<90;i++)if(b[i])s+=pstVal(b[i],i);return s;}

/* deterministic zobrist keys (page and worker must agree) */
function mkRng(seed){return function(){seed=(seed+0x6D2B79F5)|0;var t=Math.imul(seed^(seed>>>15),1|seed);t=(t+Math.imul(t^(t>>>7),61|t))^t;return (t^(t>>>14))|0;};}
var Z1=[],Z2=[],R1=mkRng(12345),R2=mkRng(67890);
for(var zp=0;zp<16;zp++){Z1[zp]=new Int32Array(90);Z2[zp]=new Int32Array(90);for(var zs=0;zs<90;zs++){Z1[zp][zs]=R1();Z2[zp][zs]=R2();}}
var ZS1=R1(),ZS2=R2();
function hashBoard(b,side){var h1=0,h2=0;for(var i=0;i<90;i++)if(b[i]){h1^=Z1[b[i]][i];h2^=Z2[b[i]][i];}if(side){h1^=ZS1;h2^=ZS2;}return [h1,h2];}

var KD=[[-1,0],[1,0],[0,-1],[0,1]];
var AD=[[-1,-1],[-1,1],[1,-1],[1,1]];
var HD=[[-2,-1,-1,0],[-2,1,-1,0],[2,-1,1,0],[2,1,1,0],[-1,-2,0,-1],[1,-2,0,-1],[-1,2,0,1],[1,2,0,1]];

function pushMv(mv,b,side,capsOnly,f,to){var q=b[to];if(q===0){if(!capsOnly)mv.push(f*128+to);}else if((q>>3)!==side)mv.push(f*128+to);}
function genMoves(b,side,capsOnly){
  var mv=[];
  for(var sq=0;sq<90;sq++){
    var p=b[sq];if(!p||(p>>3)!==side)continue;
    var t=p&7,r=(sq/9)|0,c=sq-r*9,i,d,nr,nc,to,q;
    if(t===KING||t===ADV){
      var DD=t===KING?KD:AD;
      for(i=0;i<4;i++){d=DD[i];nr=r+d[0];nc=c+d[1];if(nc<3||nc>5)continue;if(side===0?(nr<7||nr>9):(nr<0||nr>2))continue;pushMv(mv,b,side,capsOnly,sq,nr*9+nc);}
    }else if(t===ELE){
      for(i=0;i<4;i++){d=AD[i];nr=r+2*d[0];nc=c+2*d[1];if(nr<0||nr>9||nc<0||nc>8)continue;if(side===0?nr<5:nr>4)continue;if(b[(r+d[0])*9+c+d[1]])continue;pushMv(mv,b,side,capsOnly,sq,nr*9+nc);}
    }else if(t===HORSE){
      for(i=0;i<8;i++){d=HD[i];nr=r+d[0];nc=c+d[1];if(nr<0||nr>9||nc<0||nc>8)continue;if(b[(r+d[2])*9+c+d[3]])continue;pushMv(mv,b,side,capsOnly,sq,nr*9+nc);}
    }else if(t===ROOK){
      for(i=0;i<4;i++){d=KD[i];nr=r+d[0];nc=c+d[1];
        while(nr>=0&&nr<=9&&nc>=0&&nc<=8){to=nr*9+nc;q=b[to];if(q===0){if(!capsOnly)mv.push(sq*128+to);}else{if((q>>3)!==side)mv.push(sq*128+to);break;}nr+=d[0];nc+=d[1];}
      }
    }else if(t===CANNON){
      for(i=0;i<4;i++){d=KD[i];nr=r+d[0];nc=c+d[1];
        while(nr>=0&&nr<=9&&nc>=0&&nc<=8){to=nr*9+nc;if(b[to]===0){if(!capsOnly)mv.push(sq*128+to);nr+=d[0];nc+=d[1];continue;}
          nr+=d[0];nc+=d[1];
          while(nr>=0&&nr<=9&&nc>=0&&nc<=8){to=nr*9+nc;q=b[to];if(q){if((q>>3)!==side)mv.push(sq*128+to);break;}nr+=d[0];nc+=d[1];}
          break;}
      }
    }else{
      var fw=side===0?-1:1;nr=r+fw;if(nr>=0&&nr<=9)pushMv(mv,b,side,capsOnly,sq,nr*9+c);
      if(side===0?r<=4:r>=5){if(c>0)pushMv(mv,b,side,capsOnly,sq,sq-1);if(c<8)pushMv(mv,b,side,capsOnly,sq,sq+1);}
    }
  }
  return mv;
}

function findKing(b,side){var k=side*8+KING,r0=side===0?7:0;for(var r=r0;r<r0+3;r++)for(var c=3;c<=5;c++)if(b[r*9+c]===k)return r*9+c;return -1;}

function inCheck(b,side){
  var k=findKing(b,side);if(k<0)return true;
  var kr=(k/9)|0,kc=k-kr*9,o=(1-side)*8,oR=o+ROOK,oC=o+CANNON,oH=o+HORSE,oP=o+PAWN,oK=o+KING,i,d,nr,nc,q,found;
  for(i=0;i<4;i++){d=KD[i];nr=kr+d[0];nc=kc+d[1];found=0;
    while(nr>=0&&nr<=9&&nc>=0&&nc<=8){q=b[nr*9+nc];
      if(q){if(!found){if(q===oR||(q===oK&&d[1]===0))return true;found=1;}else{if(q===oC)return true;break;}}
      nr+=d[0];nc+=d[1];}
  }
  for(i=0;i<8;i++){d=HD[i];nr=kr-d[0];nc=kc-d[1];if(nr<0||nr>9||nc<0||nc>8)continue;if(b[nr*9+nc]===oH&&b[(nr+d[2])*9+nc+d[3]]===0)return true;}
  var fw=side===0?1:-1;
  nr=kr-fw;if(nr>=0&&nr<=9&&b[nr*9+kc]===oP)return true;
  if(kc>0&&b[k-1]===oP)return true;if(kc<8&&b[k+1]===oP)return true;
  return false;
}

function legalMoves(b,side){var ms=genMoves(b,side,false),out=[];for(var i=0;i<ms.length;i++){var m=ms[i],f=m>>7,t=m&127,q=b[t];b[t]=b[f];b[f]=0;if(!inCheck(b,side))out.push(m);b[f]=b[t];b[t]=q;}return out;}

/* ===== FEN (WXF style: ranks from black's back rank, red uppercase) ===== */
var FEN_CH={K:1,A:2,B:3,E:3,N:4,H:4,R:5,C:6,P:7};
var FEN_OUT=['','K','A','B','N','R','C','P'];
function parseFen(fen){
  var parts=fen.trim().split(/\s+/),rows=parts[0].split('/'),b=new Array(90).fill(0);
  for(var r=0;r<10;r++){var c=0,row=rows[r]||'';for(var i=0;i<row.length;i++){var ch=row[i];if(ch>='1'&&ch<='9'){c+=+ch;continue;}var up=ch.toUpperCase(),t=FEN_CH[up];if(!t)continue;b[r*9+c]=(ch===up?0:8)+t;c++;}}
  var side=(parts[1]==='b')?1:0;return {board:b,side:side};
}
function toFen(b,side){var s=[];for(var r=0;r<10;r++){var row='',e=0;for(var c=0;c<9;c++){var p=b[r*9+c];if(!p){e++;continue;}if(e){row+=e;e=0;}var ch=FEN_OUT[p&7];row+=(p>>3)?ch.toLowerCase():ch;}if(e)row+=e;s.push(row);}return s.join('/')+' '+(side?'b':'w');}

/* ===== search ===== */
var TT_BITS=20,TT_SIZE=1<<TT_BITS,TT_MASK=TT_SIZE-1;
var ttK1=new Int32Array(TT_SIZE),ttK2=new Int32Array(TT_SIZE),ttMv=new Int32Array(TT_SIZE),ttSc=new Int16Array(TT_SIZE),ttD=new Int8Array(TT_SIZE),ttF=new Int8Array(TT_SIZE);
var B,evalS,H1,H2,nodes,stopTime,stopped,killers,histT,rep,cnt=new Int32Array(16),exact=false,maxNodes=0;
function ttClear(){ttK1.fill(0);ttK2.fill(0);ttMv.fill(0);ttD.fill(0);}

function make(m){var f=m>>7,t=m&127,p=B[f],q=B[t];evalS+=pstVal(p,t)-pstVal(p,f);H1^=Z1[p][f]^Z1[p][t]^ZS1;H2^=Z2[p][f]^Z2[p][t]^ZS2;if(q){evalS-=pstVal(q,t);H1^=Z1[q][t];H2^=Z2[q][t];cnt[q]--;}B[t]=p;B[f]=0;return q;}
function unmake(m,q){var f=m>>7,t=m&127,p=B[t];evalS-=pstVal(p,t)-pstVal(p,f);H1^=Z1[p][f]^Z1[p][t]^ZS1;H2^=Z2[p][f]^Z2[p][t]^ZS2;if(q){evalS+=pstVal(q,t);H1^=Z1[q][t];H2^=Z2[q][t];cnt[q]++;}B[f]=p;B[t]=q;}

/* king safety + piece-phase terms from piece counts (cheap, no board scan) */
function evalSide(side){
  var s=evalS;
  var majors=cnt[ROOK]+cnt[HORSE]+cnt[CANNON]+cnt[8+ROOK]+cnt[8+HORSE]+cnt[8+CANNON];
  var ph=(majors-8)*3;
  s+=(cnt[CANNON]-cnt[8+CANNON])*ph-(cnt[HORSE]-cnt[8+HORSE])*ph;
  var dR=2*cnt[8+ROOK]+cnt[8+HORSE]+cnt[8+CANNON],dB=2*cnt[ROOK]+cnt[HORSE]+cnt[CANNON];
  s-=(2-cnt[ADV])*dR*7+(2-cnt[ELE])*dR*4;
  s+=(2-cnt[8+ADV])*dB*7+(2-cnt[8+ELE])*dB*4;
  /* endgame: pawns become more valuable when few majors remain */
  if(majors<=4){s+=(cnt[PAWN]-cnt[8+PAWN])*30;}
  return side===0?s:-s;
}
function capScore(m){var q=B[m&127];return q?100000+VALS[q&7]*10-VALS[B[m>>7]&7]/10:0;}

function quiesce(alpha,beta,ply,side,qd){
  if((++nodes&1023)===0&&(Date.now()>stopTime||(maxNodes&&nodes>maxNodes)))stopped=true;if(stopped)return 0;
  var stand=evalSide(side);
  if(stand>=beta)return stand;if(stand>alpha)alpha=stand;if(qd>=10)return stand;
  var ms=genMoves(B,side,true),sc=[],i,j;
  for(i=0;i<ms.length;i++)sc.push(capScore(ms[i]));
  for(i=0;i<ms.length;i++){
    var bi=i;for(j=i+1;j<ms.length;j++)if(sc[j]>sc[bi])bi=j;
    var tm=ms[i];ms[i]=ms[bi];ms[bi]=tm;var ts=sc[i];sc[i]=sc[bi];sc[bi]=ts;
    var m=ms[i],q=make(m);
    if(inCheck(B,side)){unmake(m,q);continue;}
    var s=-quiesce(-beta,-alpha,ply+1,1-side,qd+1);unmake(m,q);
    if(stopped)return 0;
    if(s>=beta)return s;if(s>alpha)alpha=s;
  }
  return alpha;
}

function negamax(depth,alpha,beta,ply,side,noNull){
  if((++nodes&1023)===0&&(Date.now()>stopTime||(maxNodes&&nodes>maxNodes)))stopped=true;if(stopped)return 0;
  if(rep.get(H1))return 0;
  /* mate distance pruning */
  if(alpha<-MATE+ply)alpha=-MATE+ply;if(beta>MATE-ply-1)beta=MATE-ply-1;if(alpha>=beta)return alpha;
  var chk=inCheck(B,side);if(chk)depth++;
  if(depth<=0)return quiesce(alpha,beta,ply,side,0);
  if(ply>=90)return evalSide(side);
  var pv=beta-alpha>1;
  var ti=H1&TT_MASK,ttMove=0;
  if(ttK1[ti]===H1&&ttK2[ti]===H2){ttMove=ttMv[ti];if(ttD[ti]>=depth&&!pv){var es=ttSc[ti];if(es>MATE-300)es-=ply;else if(es<-MATE+300)es+=ply;var f=ttF[ti];
    if(f===0)return es;if(f===1&&es>=beta)return es;if(f===2&&es<=alpha)return es;}}
  var mine=side*8;
  /* null-move pruning */
  if(!exact&&!noNull&&!pv&&!chk&&depth>=3&&beta<MATE-300&&(cnt[mine+ROOK]*2+cnt[mine+HORSE]+cnt[mine+CANNON])>=2&&evalSide(side)>=beta){
    var R=depth>=6?3:2;H1^=ZS1;H2^=ZS2;
    var ns=-negamax(depth-1-R,-beta,-beta+1,ply+1,1-side,true);
    H1^=ZS1;H2^=ZS2;
    if(stopped)return 0;
    if(ns>=beta)return beta;
  }
  var ms=genMoves(B,side,false),sc=[],i,j,kl=killers[ply];
  for(i=0;i<ms.length;i++){var m0=ms[i];sc.push(m0===ttMove?10000000:B[m0&127]?capScore(m0):m0===kl[0]?90000:m0===kl[1]?80000:histT[(m0>>7)*90+(m0&127)]);}
  var a0=alpha,best=-INF,bestM=0,legal=0,myH1=H1;
  rep.set(myH1,1);
  for(i=0;i<ms.length;i++){
    var bi=i;for(j=i+1;j<ms.length;j++)if(sc[j]>sc[bi])bi=j;
    var tm=ms[i];ms[i]=ms[bi];ms[bi]=tm;var ts=sc[i];sc[i]=sc[bi];sc[bi]=ts;
    var m=ms[i],q=make(m);
    if(inCheck(B,side)){unmake(m,q);continue;}
    legal++;
    var s;
    if(legal===1){s=-negamax(depth-1,-beta,-alpha,ply+1,1-side,false);}
    else{
      var red=0;
      if(!exact&&depth>=3&&legal>4&&!q&&!chk&&m!==kl[0]&&m!==kl[1]&&!inCheck(B,1-side))red=legal>12?2:1;
      s=-negamax(depth-1-red,-alpha-1,-alpha,ply+1,1-side,false);
      if(!stopped&&s>alpha&&red)s=-negamax(depth-1,-alpha-1,-alpha,ply+1,1-side,false);
      if(!stopped&&s>alpha&&s<beta)s=-negamax(depth-1,-beta,-alpha,ply+1,1-side,false);
    }
    unmake(m,q);
    if(stopped){rep.delete(myH1);return 0;}
    if(s>best){best=s;bestM=m;if(s>alpha){alpha=s;if(alpha>=beta){if(!q){if(kl[0]!==m){kl[1]=kl[0];kl[0]=m;}histT[(m>>7)*90+(m&127)]+=depth*depth;}break;}}}
  }
  rep.delete(myH1);
  if(legal===0)return -MATE+ply;
  var ss=best;if(ss>MATE-300)ss+=ply;else if(ss<-MATE+300)ss-=ply;
  if(ttD[ti]<=depth||ttK1[ti]!==H1){ttK1[ti]=H1;ttK2[ti]=H2;ttMv[ti]=bestM;ttSc[ti]=ss;ttD[ti]=depth;ttF[ti]=best<=a0?2:best>=beta?1:0;}
  return best;
}

function setupSearch(board,side,opts){
  B=board.slice();evalS=evalBoard(B);var hh=hashBoard(B,side);H1=hh[0];H2=hh[1];
  cnt.fill(0);for(var i=0;i<90;i++)if(B[i])cnt[B[i]]++;
  nodes=0;stopped=false;stopTime=Date.now()+(opts.time||1000);maxNodes=opts.nodes||0;exact=!!opts.exact;
  killers=[];for(i=0;i<130;i++)killers.push([0,0]);histT=new Int32Array(8100);
  rep=new Map();(opts.history||[]).forEach(function(h){rep.set(h,1);});
}

/* principal variation from TT */
function extractPV(board,side,first,maxLen){
  var b=board.slice(),s=side,pv=[],seen={},m=first;
  while(m&&pv.length<maxLen){
    var lm=legalMoves(b,s);if(lm.indexOf(m)<0)break;
    pv.push(m);b[m&127]=b[m>>7];b[m>>7]=0;s=1-s;
    var h=hashBoard(b,s);if(seen[h[0]])break;seen[h[0]]=1;
    var ti=h[0]&TT_MASK;m=(ttK1[ti]===h[0]&&ttK2[ti]===h[1])?ttMv[ti]:0;
  }
  return pv;
}

/* think: opts {maxDepth,time,noise,history,exact,nodes}; returns {move,score,depth,nodes,pv} */
function think(board,side,opts){
  setupSearch(board,side,opts);
  var start=Date.now();
  var root=legalMoves(B,side);if(opts.exclude)root=root.filter(function(m){return opts.exclude.indexOf(m)<0;});if(!root.length)return {move:0,score:-MATE,depth:0,nodes:0,pv:[]};
  if(root.length===1&&!opts.analyze)return {move:root[0],score:0,depth:0,nodes:0,pv:[root[0]]};
  root.sort(function(a,b){return capScore(b)-capScore(a);});
  var best=root[0],bestScore=-INF,done=0,maxD=opts.maxDepth||30;
  rep.set(H1,1);
  for(var d=1;d<=maxD;d++){
    var alpha=-INF,iterBest=0,iterScore=-INF,idx=root.indexOf(best);
    if(idx>0){root.splice(idx,1);root.unshift(best);}
    for(var i=0;i<root.length;i++){
      var m=root[i],q=make(m),s;
      if(opts.noise>0)s=-negamax(d-1,-INF,INF,1,1-side,false);
      else if(i===0)s=-negamax(d-1,-INF,-alpha,1,1-side,false);
      else{s=-negamax(d-1,-alpha-1,-alpha,1,1-side,false);if(!stopped&&s>alpha)s=-negamax(d-1,-INF,-alpha,1,1-side,false);}
      unmake(m,q);if(stopped)break;
      if(opts.noise>0)s+=Math.round((Math.random()*2-1)*opts.noise);
      if(s>iterScore){iterScore=s;iterBest=m;if(s>alpha)alpha=s;}
    }
    if(iterBest&&(!stopped||iterScore>-INF)){best=iterBest;bestScore=iterScore;}
    if(stopped)break;
    done=d;
    /* store root in TT so PV extraction starts right */
    if(Math.abs(bestScore)>MATE-300)break;
    if(!opts.analyze&&Date.now()-start>(opts.time||1000)*0.45)break;
  }
  var pv=extractPV(board,side,best,16);
  return {move:best,score:bestScore,depth:done,nodes:nodes,pv:pv};
}

/* list root moves that force mate within n moves (exact search, for puzzle verification) */
function mateMoves(board,side,n,time){
  ttClear();var res=[],root=legalMoves(board,side);
  for(var i=0;i<root.length;i++){
    setupSearch(board,side,{time:time||4000,exact:true});
    rep.set(H1,1);
    var m=root[i],q=make(m);
    var s=-negamax(2*n-2,-INF,INF,1,1-side,true);
    unmake(m,q);
    if(!stopped&&s>=MATE-(2*n-1))res.push(m);
  }
  return res;
}

/* score helpers */
function mateIn(score){if(score>MATE-300)return Math.ceil((MATE-score)/2);if(score<-MATE+300)return -Math.ceil((MATE+score)/2);return 0;}
