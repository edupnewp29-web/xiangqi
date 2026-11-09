/* ===== notation + move explanation (main thread; needs engine.js) ===== */
var PN_R=['','帥','仕','相','傌','俥','炮','兵'],PN_B=['','將','士','象','馬','車','砲','卒'];
var PN_PLAIN=['','將','士','象','馬','車','炮','兵'];
var CN_NUM=['','一','二','三','四','五','六','七','八','九'],FW_NUM=['','１','２','３','４','５','６','７','８','９'];
function pieceName(p){return ((p>>3)?PN_B:PN_R)[p&7];}
function fileOf(c,side){return side===0?9-c:c+1;}
function numStr(n,side){return side===0?CN_NUM[n]:FW_NUM[n];}

function moveToCN(b,m){
  var f=m>>7,t=m&127,p=b[f];if(!p)return '?';
  var side=p>>3,type=p&7,fr=(f/9)|0,fc=f%9,tr=(t/9)|0,tc=t%9,name=pieceName(p),head;
  var same=[];for(var r=0;r<10;r++)if(b[r*9+fc]===p)same.push(r);
  if(same.length>1&&type!==KING){
    same.sort(function(a,c){return side===0?a-c:c-a;});
    var idx=same.indexOf(fr);
    head=(same.length===2?['前','後']:same.length===3?['前','中','後']:['一','二','三','四','五'])[idx]+name;
  }else head=name+numStr(fileOf(fc,side),side);
  var fwd=side===0?fr-tr:tr-fr,act,num;
  if(tr===fr){act='平';num=fileOf(tc,side);}
  else{act=fwd>0?'進':'退';num=(type===HORSE||type===ADV||type===ELE)?fileOf(tc,side):Math.abs(tr-fr);}
  return head+act+numStr(num,side);
}
function normCN(s){
  var map={'帥':'K','將':'K','帅':'K','将':'K','仕':'A','士':'A','相':'B','象':'B','傌':'N','馬':'N','马':'N','俥':'R','車':'R','车':'R','炮':'C','砲':'C','兵':'P','卒':'P',
    '進':'+','进':'+','退':'-','平':'=','前':'F','後':'L','后':'L','中':'M'};
  var out='';s=String(s).replace(/\s/g,'');
  for(var i=0;i<s.length;i++){var ch=s[i],k;
    if(map[ch]){out+=map[ch];continue;}
    k=CN_NUM.indexOf(ch);if(k>0){out+=k;continue;}
    k=FW_NUM.indexOf(ch);if(k>0){out+=k;continue;}
    if(ch>='1'&&ch<='9'){out+=ch;continue;}
  }
  return out;
}
function cnToMove(b,side,s){
  var target=normCN(s),lm=legalMoves(b,side);
  for(var i=0;i<lm.length;i++)if(normCN(moveToCN(b,lm[i]))===target)return lm[i];
  return 0;
}
function applyMove(b,m){var q=b[m&127];b[m&127]=b[m>>7];b[m>>7]=0;return q;}
function pvToCN(b,side,pv,max){var bb=b.slice(),out=[];for(var i=0;i<pv.length&&i<(max||99);i++){out.push(moveToCN(bb,pv[i]));applyMove(bb,pv[i]);}return out;}

/* ----- attack maps ----- */
function attackersOf(b,sq,bySide){var ms=genMoves(b,bySide,false),out=[];for(var i=0;i<ms.length;i++)if((ms[i]&127)===sq)out.push(ms[i]>>7);return out;}
function defendersOf(b,sq){var p=b[sq],side=p>>3;b[sq]=(1-side)*8+PAWN;var d=attackersOf(b,sq,side);b[sq]=p;return d;}
function minVal(b,list){var v=99999;list.forEach(function(s){var x=(b[s]&7)===KING?2000:VALS[b[s]&7];if(x<v)v=x;});return v;}
/* pieces of `side` that are en prise: attacked and (undefended, or cheapest attacker worth less) */
function hangingPieces(b,side){
  var out=[],lm=legalMoves(b,1-side);
  for(var sq=0;sq<90;sq++){var p=b[sq];if(!p||(p>>3)!==side||(p&7)===KING)continue;
    var at=attackersOf(b,sq,1-side).filter(function(f){return lm.indexOf(f*128+sq)>=0;});
    if(!at.length)continue;
    var def=defendersOf(b,sq);
    if(!def.length||minVal(b,at)<VALS[p&7])out.push(sq);}
  return out;
}
function checkers(b,side){ /* enemy pieces giving check to `side` king */
  var k=findKing(b,side);if(k<0)return [];return attackersOf(b,k,1-side);
}

/* ----- mate pattern names ----- */
function mateName(b,loser){
  var k=findKing(b,loser),ch=checkers(b,loser),win=1-loser;if(k<0||!ch.length)return '';
  if(ch.length>=2)return '雙將';
  var c=ch[0],t=b[c]&7,kr=(k/9)|0,kc=k%9,cr=(c/9)|0,cc=c%9;
  if(t===CANNON){
    var dr=Math.sign(kr-cr),dc=Math.sign(kc-cc),r=cr+dr,cl=cc+dc,screen=-1;
    while(r*9+cl!==k){if(b[r*9+cl]){screen=r*9+cl;break;}r+=dr;cl+=dc;}
    if(screen>=0){var sp=b[screen];
      if(sp===win*8+CANNON)return '重炮';
      if(sp===win*8+HORSE)return '馬後炮';
      if((sp>>3)===loser&&(sp&7)===ADV){return '悶宮';}
    }
    var nb=[k-9,k+9,k-1,k+1].filter(function(s){return s>=0&&s<90&&b[s]===loser*8+ADV;});
    if(nb.length)return '悶宮';
  }
  if(t===HORSE){var rel=win===0?cr:9-cr;if(rel===2&&(cc===2||cc===6))return '臥槽馬';if(rel===2&&(cc===4))return '';return '掛角馬';}
  if(t===ROOK){
    var others=[];for(var s=0;s<90;s++)if(b[s]===win*8+ROOK&&s!==c)others.push(s);
    if(others.length){var o=others[0],or=(o/9)|0,oc=o%9;if(Math.abs(or-kr)===1||Math.abs(oc-kc)===1)return '雙車錯';}
    var wk=findKing(b,win);if(wk>=0&&wk%9===kc&&cr===kr)return '白臉將';
    if(cr===kr&&(kr===0||kr===9))return '底線車殺';
  }
  if(t===PAWN)return '兵（卒）殺';
  var wk2=findKing(b,win);if(wk2>=0&&wk2%9!==kc){}
  return '';
}

/* ----- describe a move: facts only, reliable ----- */
function describeMove(b,m,moveNo){
  var f=m>>7,t=m&127,p=b[f],side=p>>3,opp=1-side,type=p&7,q=b[t],out=[];
  var hangBefore=hangingPieces(b,side);
  var b2=b.slice();applyMove(b2,m);
  if(q)out.push('吃'+pieceName(q));
  var oppLegal=legalMoves(b2,opp);
  if(inCheck(b2,opp)){
    var ch=checkers(b2,opp);
    if(!oppLegal.length){var nm=mateName(b2,opp);out.push('絕殺'+(nm?'（'+nm+'）':''));}
    else if(ch.length>=2)out.push('雙將');
    else if(ch[0]!==t)out.push('抽將（閃擊將軍）');
    else out.push('將軍');
  }else if(!oppLegal.length)out.push('困斃');
  /* new attacks by the moved piece */
  var targ=genMoves(b2,side,true).filter(function(x){return (x>>7)===t;}).map(function(x){return x&127;});
  var prevT={};genMoves(b,side,true).forEach(function(x){if((x>>7)===f)prevT[x&127]=1;});
  var hits=targ.filter(function(s){var v=b2[s];if((v&7)===KING)return false;
    var def=defendersOf(b2,s);return !prevT[s]&&(!def.length||VALS[v&7]>VALS[type]);});
  if(hits.length>=2)out.push('捉雙（'+hits.map(function(s){return pieceName(b2[s]);}).join('、')+'）');
  else if(hits.length===1)out.push('捉'+pieceName(b2[hits[0]]));
  /* defence */
  var hangAfter=hangingPieces(b2,side);
  if(hangBefore.indexOf(f)>=0&&hangAfter.indexOf(t)<0&&!q)out.push('躲開攻擊');
  var saved=hangBefore.filter(function(s){return s!==f&&hangAfter.indexOf(s)<0&&b2[s]===b[s];});
  if(saved.length&&!q)out.push('保護'+pieceName(b[saved[0]]));
  if(hangAfter.indexOf(t)>=0&&!out.length)out.push('這步棋子會被吃');
  /* development / structure */
  var fr=(f/9)|0,tr=(t/9)|0,tc=t%9,rel=side===0?fr:9-fr,relT=side===0?tr:9-tr;
  if(!out.length&&moveNo!==undefined&&moveNo<24){
    if(type===ROOK&&rel===9)out.push('出車');
    else if(type===HORSE&&rel===9)out.push('跳馬出子');
    else if(type===CANNON&&tc===4)out.push('架中炮');
    else if(type===PAWN&&(tc===2||tc===6)&&relT===5)out.push(side?'挺卒活馬':'挺兵活馬');
    else if(type===ELE)out.push(side?'飛象鞏固':'飛相鞏固');
    else if(type===ADV)out.push(side?'補士鞏固':'補仕鞏固');
  }
  if(type===PAWN&&rel>=5&&relT<=4)out.push('過河');
  if(!out.length)out.push('調整陣形');
  return out;
}

/* grade a move by centipawn loss */
function gradeLoss(loss,isBest){
  if(isBest||loss<=10)return {g:'best',t:'最佳',c:'#2e7d32'};
  if(loss<=40)return {g:'good',t:'好棋',c:'#558b2f'};
  if(loss<=100)return {g:'dubious',t:'疑問手',c:'#f9a825'};
  if(loss<=250)return {g:'mistake',t:'錯著',c:'#ef6c00'};
  return {g:'blunder',t:'大漏著',c:'#c62828'};
}
function scoreText(s){var mi=mateIn(s);if(mi>0)return mi+' 步殺';if(mi<0)return '被 '+(-mi)+' 步殺';return (s>0?'+':'')+(s/100).toFixed(1);}
function majorsCount(b){var n=0;for(var i=0;i<90;i++){var t=b[i]&7;if(b[i]&&(t===ROOK||t===HORSE||t===CANNON))n++;}return n;}
