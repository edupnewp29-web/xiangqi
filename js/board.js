/* ===== SVG board view ===== */
function BoardView(svg,onTap){
  this.svg=svg;this.onTap=onTap;this.flip=false;
  var NS='http://www.w3.org/2000/svg';
  svg.setAttribute('viewBox','0 -40 920 1112');
  var s='<defs><radialGradient id="pg" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#fbe9c6"/><stop offset="1" stop-color="#e2bd7f"/></radialGradient>'+
    '<linearGradient id="wood" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f0d39b"/><stop offset="1" stop-color="#e2b874"/></linearGradient>'+
    ['g','r','o','b'].map(function(k){var col={g:'#2e7d32',r:'#c62828',o:'#ef6c00',b:'#1565c0'}[k];return '<marker id="ah'+k+'" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="'+col+'"/></marker>';}).join('')+
    '</defs><rect x="0" y="-40" width="920" height="1112" rx="18" fill="url(#wood)"/><rect x="44" y="44" width="832" height="932" fill="none" stroke="#6b4423" stroke-width="6"/>';
  var L=function(x1,y1,x2,y2){s+='<line x1="'+x1+'" y1="'+y1+'" x2="'+x2+'" y2="'+y2+'" stroke="#6b4423" stroke-width="2.5"/>';};
  for(var r=0;r<10;r++)L(60,60+r*100,860,60+r*100);
  for(var c=0;c<9;c++){var x=60+c*100;if(c===0||c===8)L(x,60,x,960);else{L(x,60,x,460);L(x,560,x,960);}}
  L(360,60,560,260);L(560,60,360,260);L(360,760,560,960);L(560,760,360,960);
  function mark(r,c){var x=60+c*100,y=60+r*100,g=8,l=20;[[-1,-1],[1,-1],[-1,1],[1,1]].forEach(function(d){var cx=x+d[0]*g,cy=y+d[1]*g;if((c===0&&d[0]<0)||(c===8&&d[0]>0))return;s+='<polyline points="'+(cx+d[0]*l)+','+cy+' '+cx+','+cy+' '+cx+','+(cy+d[1]*l)+'" fill="none" stroke="#6b4423" stroke-width="2.5"/>';});}
  [[2,1],[2,7],[7,1],[7,7]].forEach(function(p){mark(p[0],p[1]);});
  [3,6].forEach(function(r){[0,2,4,6,8].forEach(function(c){mark(r,c);});});
  s+='<text x="260" y="527" font-size="54" text-anchor="middle" fill="#6b4423" class="kai" letter-spacing="30">楚河</text><text x="660" y="527" font-size="54" text-anchor="middle" fill="#6b4423" class="kai" letter-spacing="30">漢界</text>';
  s+='<g class="files"></g><g class="dyn"></g>';
  svg.innerHTML=s;
  this.dyn=svg.querySelector('.dyn');this.files=svg.querySelector('.files');
  var self=this;
  svg.addEventListener('click',function(e){
    var pt=svg.createSVGPoint();pt.x=e.clientX;pt.y=e.clientY;var p=pt.matrixTransform(svg.getScreenCTM().inverse());
    var c=Math.round((p.x-60)/100),r=Math.round((p.y-60)/100);if(c<0||c>8||r<0||r>9)return;
    if(self.flip){r=9-r;c=8-c;}if(self.onTap)self.onTap(r*9+c);
  });
}
BoardView.prototype.xy=function(sq){var r=(sq/9)|0,c=sq%9;if(this.flip){r=9-r;c=8-c;}return [60+c*100,60+r*100];};
/* st: {board, sel, targets[], last, arrows:[{m,color:'g'|'r'|'o'|'b'}], check:true/false, side} */
BoardView.prototype.render=function(st){
  var self=this,s='',b=st.board,i;
  /* file numbers along the edges */
  var fs='';for(var c=0;c<9;c++){var x=60+c*100;
    fs+='<text x="'+x+'" y="-12" font-size="24" text-anchor="middle" fill="#8a6235">'+(this.flip?CN_NUM[c+1]:FW_NUM[c+1])+'</text><text x="'+x+'" y="1056" font-size="24" text-anchor="middle" fill="#8a6235">'+(this.flip?FW_NUM[9-c]:CN_NUM[9-c])+'</text>';}
  this.files.innerHTML=fs;
  if(st.last){var a=this.xy(st.last>>7);s+='<circle cx="'+a[0]+'" cy="'+a[1]+'" r="16" fill="rgba(21,101,192,.45)"/>';}
  var ck=st.check?findKing(b,st.side):-1;
  for(i=0;i<90;i++){var p=b[i];if(!p)continue;var xy=this.xy(i),red=(p>>3)===0,col=red?'#b3261e':'#1f1f1f';
    s+='<g transform="translate('+xy[0]+','+xy[1]+')">';
    if(i===ck)s+='<circle r="54" fill="rgba(211,47,47,.4)"/>';
    s+='<circle r="44" cy="4" fill="rgba(60,30,10,.35)"/><circle r="44" fill="url(#pg)" stroke="#8a5a2b" stroke-width="3"/><circle r="36" fill="none" stroke="'+col+'" stroke-width="2.5"/>';
    s+='<text y="18" font-size="50" text-anchor="middle" fill="'+col+'" class="kai" font-weight="700">'+pieceName(p)+'</text>';
    if(st.last&&i===(st.last&127))s+='<circle r="48" fill="none" stroke="#1565c0" stroke-width="5"/>';
    if(i===st.sel)s+='<circle r="49" fill="none" stroke="#2e7d32" stroke-width="7"/>';
    s+='</g>';}
  (st.targets||[]).forEach(function(m){var t=m&127,c=self.xy(t);if(b[t])s+='<circle cx="'+c[0]+'" cy="'+c[1]+'" r="49" fill="none" stroke="#2e7d32" stroke-width="6" stroke-dasharray="14 8"/>';else s+='<circle cx="'+c[0]+'" cy="'+c[1]+'" r="14" fill="rgba(46,125,50,.8)"/>';});
  (st.arrows||[]).forEach(function(a){var p1=self.xy(a.m>>7),p2=self.xy(a.m&127),dx=p2[0]-p1[0],dy=p2[1]-p1[1],L=Math.hypot(dx,dy)||1,sh=26;
    var x1=p1[0]+dx/L*sh,y1=p1[1]+dy/L*sh,x2=p2[0]-dx/L*sh,y2=p2[1]-dy/L*sh;
    var col={g:'rgba(46,125,50,.8)',r:'rgba(198,40,40,.8)',o:'rgba(239,108,0,.85)',b:'rgba(21,101,192,.8)'}[a.color||'g'];
    s+='<line x1="'+x1+'" y1="'+y1+'" x2="'+x2+'" y2="'+y2+'" stroke="'+col+'" stroke-width="'+(a.w||14)+'" stroke-linecap="round" marker-end="url(#ah'+(a.color||'g')+')"/>';
    if(a.label){s+='<circle cx="'+x1+'" cy="'+y1+'" r="18" fill="'+col+'"/><text x="'+x1+'" y="'+(y1+8)+'" font-size="24" fill="#fff" text-anchor="middle" font-weight="700">'+a.label+'</text>';}});
  this.dyn.innerHTML=s;
};
