const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const WebSocket = require('ws');

const PORT = process.env.PORT || 3000;
const ROOT = path.join(__dirname, 'public');
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  let file = path.join(ROOT, decodeURIComponent(url.pathname === '/' ? 'index.html' : url.pathname));
  if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404).end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(data);
  });
});
const wss = new WebSocket.Server({ server });
const rooms = new Map();
const MAP = { w: 960, h: 620, walls: [
  [0,0,960,24],[0,596,960,24],[0,24,24,572],[936,24,24,572],
  [120,100,150,24],[120,100,24,120],[120,400,150,24],[120,304,24,120],
  [690,100,150,24],[816,100,24,120],[690,400,150,24],[816,304,24,120],
  [350,165,100,24],[510,165,100,24],[350,430,100,24],[510,430,100,24],
  [430,250,100,120],[245,250,70,24],[645,346,70,24]
] };
function freshRoom(code) { return { code, players: new Map(), round: 1, phase: 'live', time: 105, score: { blue: 0, red: 0 }, bombs: [], bullets: [], last: Date.now(), planted: null }; }
function send(ws, data) { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data)); }
function state(room) { return { type:'state', code:room.code, round:room.round, phase:room.phase, time:Math.ceil(room.time), score:room.score, planted:room.planted, players:[...room.players.values()].map(({id,name,team,x,y,hp,alive,angle,kills})=>({id,name,team,x,y,hp,alive,angle,kills})), bullets:room.bullets, map:MAP }; }
function broadcast(room) { const msg = JSON.stringify(state(room)); room.players.forEach(p => { if(p.ws.readyState===WebSocket.OPEN) p.ws.send(msg); }); }
function notice(room, text) { room.players.forEach(p=>send(p.ws,{type:'notice',text})); }
function startRound(room) { room.round++; room.phase='live'; room.time=105; room.planted=null; room.bullets=[]; room.players.forEach(p=>{p.hp=100;p.alive=true;p.x=p.team==='blue'?100:860;p.y=310+(Math.random()-.5)*180;p.kills=0;p.cash=(p.cash||800)+1400;}); notice(room,`Round ${room.round} — move out.`); }
function endRound(room, winner, reason) { if(room.phase!=='live'&&room.phase!=='bomb') return; room.phase='freeze'; room.score[winner]++; notice(room,`${winner==='blue'?'COUNTER-TERRORISTS':'TERRORISTS'} win — ${reason}`); if(room.score[winner]>=13){room.phase='matchover';notice(room,`${winner==='blue'?'COUNTER-TERRORISTS':'TERRORISTS'} take the match, 13 rounds to ${room.score[winner=== 'blue'?'red':'blue']}.`);return;} setTimeout(()=>startRound(room),5000); }
function collides(x,y,r,walls) { return walls.some(([a,b,c,d])=>x+r>a&&x-r<a+c&&y+r>b&&y-r<b+d); }
function roomTick(room, now) {
  const dt=Math.min(.05,(now-room.last)/1000); room.last=now;
  if(room.phase==='live'||room.phase==='bomb') {
    room.time-=dt;
    if(room.phase==='bomb'&&room.planted){room.planted.left-=dt;if(room.planted.left<=0){endRound(room,'red','bomb detonated');}}
    if(room.phase==='live'&&room.time<=0) endRound(room,'blue','time expired');
    for(const b of room.bullets){b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt; if(b.life<=0||collides(b.x,b.y,2,MAP.walls)){b.dead=true;continue;}
      for(const p of room.players.values()) if(p.team!==b.team&&p.alive&&Math.hypot(p.x-b.x,p.y-b.y)<17){p.hp-=b.damage;b.dead=true;if(p.hp<=0){p.hp=0;p.alive=false;const shooter=room.players.get(b.owner);if(shooter)shooter.kills++;notice(room,`${p.name} was eliminated`);const alive=[...room.players.values()].filter(x=>x.alive);if(!alive.some(x=>x.team==='red'))endRound(room,'blue','team eliminated');if(!alive.some(x=>x.team==='blue'))endRound(room,'red','team eliminated');}break;}
    }
    room.bullets=room.bullets.filter(b=>!b.dead);
    if(room.phase==='live'&&room.planted===null){const t=[...room.players.values()].find(p=>p.team==='red'&&p.alive&&p.input?.plant&&Math.hypot(p.x-730,p.y-310)<58);if(t){room.phase='bomb';room.planted={left:40,by:t.name};notice(room,`Spike planted by ${t.name}!`);}}
    if(room.phase==='bomb'&&room.planted){const d=[...room.players.values()].find(p=>p.team==='blue'&&p.alive&&p.input?.defuse&&Math.hypot(p.x-730,p.y-310)<58);if(d){room.planted.defuse=(room.planted.defuse||0)+dt;if(room.planted.defuse>=4)endRound(room,'blue','spike defused');}else room.planted.defuse=0;}
    room.players.forEach(p=>{const i=p.input||{};if(!p.alive)return;let dx=(i.right?1:0)-(i.left?1:0),dy=(i.down?1:0)-(i.up?1:0);const mag=Math.hypot(dx,dy)||1;dx/=mag;dy/=mag;const speed=i.shift?125:190;const nx=Math.max(44,Math.min(916,p.x+dx*speed*dt)),ny=Math.max(44,Math.min(576,p.y+dy*speed*dt));if(!collides(nx,p.y,14,MAP.walls))p.x=nx;if(!collides(p.x,ny,14,MAP.walls))p.y=ny;p.angle=i.angle||p.angle;
      if(i.shoot&&now-(p.lastShot||0)>230){p.lastShot=now;room.bullets.push({id:crypto.randomUUID(),owner:p.id,team:p.team,x:p.x+Math.cos(p.angle)*20,y:p.y+Math.sin(p.angle)*20,vx:Math.cos(p.angle)*720,vy:Math.sin(p.angle)*720,life:1.15,damage:34});}
    });
  }
  if(now-(room.lastBroadcast||0)>50){room.lastBroadcast=now;broadcast(room);}
}
setInterval(()=>{const now=Date.now();rooms.forEach(r=>roomTick(r,now));},25);
wss.on('connection', ws=>{
  ws.on('message', raw=>{let m;try{m=JSON.parse(raw)}catch{return}
    if(m.type==='join'){const code=(String(m.code||'QUICK').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,10)||'QUICK');let room=rooms.get(code);if(!room){room=freshRoom(code);rooms.set(code,room);}if(room.players.size>=10){send(ws,{type:'error',text:'Room is full. Try another room code.'});return;}
      const blue=[...room.players.values()].filter(p=>p.team==='blue').length,red=[...room.players.values()].filter(p=>p.team==='red').length,team=blue<=red?'blue':'red',id=crypto.randomUUID();const p={id,ws,name:String(m.name||'Operator').slice(0,16),team,x:team==='blue'?100:860,y:310+(Math.random()-.5)*180,hp:100,alive:true,angle:0,kills:0,cash:800,input:{}};room.players.set(id,p);ws.room=room;ws.player=p;send(ws,{type:'joined',id,team,code});notice(room,`${p.name} joined ${team==='blue'?'Counter-Terrorists':'Terrorists'}`);broadcast(room);
    } else if(m.type==='input'&&ws.room&&ws.player){ws.player.input=m;}
    else if(m.type==='chat'&&ws.room&&ws.player){const text=String(m.text||'').slice(0,120);if(text)ws.room.players.forEach(p=>send(p.ws,{type:'chat',name:ws.player.name,team:ws.player.team,text}));}
  });
  ws.on('close',()=>{const r=ws.room;if(r&&ws.player){r.players.delete(ws.player.id);notice(r,`${ws.player.name} disconnected`);if(!r.players.size)rooms.delete(r.code);}});
});
server.listen(PORT,'0.0.0.0',()=>console.log(`Strikepoint running on port ${PORT}`));
