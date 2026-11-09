importScripts('engine.js'+(self.location.search||''));
self.onmessage=function(e){
  var d=e.data,r;
  if(d.cmd==='think')r=think(d.board,d.side,d.opts);
  else if(d.cmd==='mate')r={moves:mateMoves(d.board,d.side,d.n,d.time)};
  r.id=d.id;self.postMessage(r);
};
