(() => {
  const $ = id => document.getElementById(id), canvas = $('arena'), ctx = canvas.getContext('2d');
  let socket, myId, myTeam, snapshot, connected = false, keys = {}, mouse = {x:480,y:310,down:false}, interact = false, chatOpen = false, lastNotice = 0, ammo = 24, lastAmmoShot = 0, reloadUntil = 0;
  const walls = [[0,0,960,24],[0,596,960,24],[0,24,24,572],[936,24,24,572],[120,100,150,24],[120,100,24,120],[120,400,150,24],[120,304,24,120],[690,100,150,24],[816,100,24,120],[690,400,150,24],[816,304,24,120],[350,165,100,24],[510,165,100,24],[350,430,100,24],[510,430,100,24],[430,250,100,120],[245,250,70,24],[645,346,70,24]];
  const decor = [[59,75,62,20],[284,128,22,65],[74,278,80,15],[173,500,54,28],[286,350,24,63],[370,91,32,44],[470,116,26,38],[564,213,64,18],[750,273,21,58],[854,500,42,25],[620,520,92,17],[340,510,21,47],[557,370,38,21],[733,170,45,18]];
  function connect() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    socket = new WebSocket(`${proto}//${location.host}`);
    socket.onopen = () => { connected = true; $('serverLabel').textContent = 'SERVER ONLINE · READY TO DEPLOY'; $('serverLabel').style.color = '#83be98'; };
    socket.onclose = () => { connected = false; $('serverLabel').textContent = 'SERVER CONNECTION LOST'; $('serverLabel').style.color = '#e97962'; if(! $('gameView').classList.contains('hidden')) showLobby(); };
    socket.onerror = () => { $('serverLabel').textContent = 'SERVER CONNECTION ERROR'; $('serverLabel').style.color = '#e97962'; };
    socket.onmessage = e => { const m = JSON.parse(e.data); if(m.type==='joined'){myId=m.id;myTeam=m.team;$('roomLabel').textContent=`ROOM ${m.code}`;$('lobby').classList.add('hidden');$('gameView').classList.remove('hidden');$('hudName').textContent=$('playerName').value.toUpperCase()||'OPERATOR';$('profileName').textContent=($('playerName').value||'GUEST OPERATOR').toUpperCase();$('spectate').classList.add('hidden');}
      if(m.type==='state'){snapshot=m;renderHud();}
      if(m.type==='notice'){pushFeed(m.text);}
      if(m.type==='chat'){appendChat(m.name,m.text);}
      if(m.type==='error'){alert(m.text);}
    };
  }
  function join(){if(!connected){pushFeed('Waiting for game server…');return;}const name=$('playerName').value.trim()||'Operator',code=$('roomCode').value.trim()||'QUICK';socket.send(JSON.stringify({type:'join',name,code}));}
  function showLobby(){ $('gameView').classList.add('hidden');$('lobby').classList.remove('hidden'); }
  $('playBtn').addEventListener('click',join);$('playerName').addEventListener('keydown',e=>{if(e.key==='Enter')join()});$('roomCode').addEventListener('keydown',e=>{if(e.key==='Enter')join()});$('leaveBtn').addEventListener('click',()=>{if(socket)socket.close();myId=null;myTeam=null;setTimeout(()=>{connect()},250);showLobby();});
  function worldPos(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*960/r.width,y:(e.clientY-r.top)*620/r.height};}
  canvas.addEventListener('mousemove',e=>{mouse=worldPos(e)});canvas.addEventListener('mousedown',e=>{if(e.button===0)mouse.down=true;canvas.focus()});window.addEventListener('mouseup',()=>mouse.down=false);canvas.addEventListener('contextmenu',e=>e.preventDefault());
  window.addEventListener('keydown',e=>{if(chatOpen)return;const k=e.key.toLowerCase();keys[k]=true;if(['w','a','s','d',' '].includes(k))e.preventDefault();if(k==='e')interact=true;if(k==='enter'&&!$('gameView').classList.contains('hidden')){chatOpen=true;$('chatForm').classList.add('active');$('chatInput').focus();}});
  window.addEventListener('keyup',e=>{keys[e.key.toLowerCase()]=false;if(e.key.toLowerCase()==='e')interact=false;});
  $('chatForm').addEventListener('submit',e=>{e.preventDefault();const text=$('chatInput').value.trim();if(text&&connected)socket.send(JSON.stringify({type:'chat',text}));$('chatInput').value='';$('chatForm').classList.remove('active');chatOpen=false;canvas.focus();});$('chatInput').addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();$('chatForm').classList.remove('active');chatOpen=false;canvas.focus();}});
  function sendInput(){if(!connected||!myId||!snapshot)return;const me=snapshot.players.find(p=>p.id===myId);if(!me)return;const now=Date.now();if(mouse.down&&now>=reloadUntil&&ammo>0&&now-lastAmmoShot>=230){ammo--;lastAmmoShot=now;if(ammo===0)reloadUntil=now+1700;$('ammo').textContent=ammo===0?'R':ammo;}else if(ammo===0&&now>=reloadUntil){ammo=24;$('ammo').textContent=ammo;}socket.send(JSON.stringify({type:'input',up:!!keys.w,left:!!keys.a,down:!!keys.s,right:!!keys.d,shift:!!keys.shift,shoot:mouse.down&&ammo>0&&now>=reloadUntil,plant:interact,defuse:interact,angle:Math.atan2(mouse.y-me.y,mouse.x-me.x)}));}
  setInterval(sendInput,40);
  function renderHud(){if(!snapshot)return;$('blueScore').textContent=snapshot.score.blue;$('redScore').textContent=snapshot.score.red;$('roundNum').textContent=String(snapshot.round).padStart(2,'0');const sec=snapshot.time|0;$('clock').textContent=`${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`;const me=snapshot.players.find(p=>p.id===myId);if(me){$('hp').textContent=me.hp;if(!me.alive)$('spectate').classList.remove('hidden');else $('spectate').classList.add('hidden');}
    const alert=$('spikeAlert');if(snapshot.phase==='bomb'&&snapshot.planted){alert.classList.remove('hidden');const s=Math.ceil(snapshot.planted.left);$('spikeClock').textContent=`0:${String(s).padStart(2,'0')}`;}else alert.classList.add('hidden');draw();}
  function pushFeed(text){const box=$('killFeed'),el=document.createElement('div');el.className='feed-entry';el.textContent=text;box.prepend(el);while(box.children.length>4)box.lastChild.remove();setTimeout(()=>el.remove(),4500);if(/win —/.test(text)){const b=$('roundBanner');b.textContent=text.toUpperCase();b.classList.remove('hidden');setTimeout(()=>b.classList.add('hidden'),3800);}}
  function appendChat(name,text){const line=document.createElement('div');line.className='chat-line';const n=document.createElement('b');n.textContent=name+': ';line.append(n,document.createTextNode(text));$('chatLog').append(line);while($('chatLog').children.length>5)$('chatLog').firstChild.remove();setTimeout(()=>line.remove(),8000);}
  function draw(){if(!snapshot)return;ctx.clearRect(0,0,960,620);
    ctx.fillStyle='#182127';ctx.fillRect(0,0,960,620);
    ctx.fillStyle='#1c272c';for(let x=24;x<936;x+=48)for(let y=24;y<596;y+=48){ctx.fillRect(x,y,46,46);}
    ctx.strokeStyle='#a6b8b21c';ctx.lineWidth=1;for(let x=48;x<936;x+=48){ctx.beginPath();ctx.moveTo(x,24);ctx.lineTo(x,596);ctx.stroke();}for(let y=48;y<596;y+=48){ctx.beginPath();ctx.moveTo(24,y);ctx.lineTo(936,y);ctx.stroke();}
    ctx.fillStyle='#ab875626';ctx.beginPath();ctx.arc(730,310,58,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#f4bd7540';ctx.setLineDash([5,5]);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#d8ad6c55';ctx.font='bold 17px monospace';ctx.fillText('A',717,316);
    decor.forEach(([x,y,w,h],i)=>{ctx.fillStyle=i%2?'#30383a':'#343b3b';ctx.fillRect(x,y,w,h);ctx.strokeStyle='#62696555';ctx.strokeRect(x+.5,y+.5,w-1,h-1);ctx.fillStyle='#89918b18';ctx.fillRect(x+4,y+4,Math.max(4,w*.35),2);});
    (snapshot.map?.walls||walls).forEach(([x,y,w,h],i)=>{ctx.fillStyle='#4a5150';ctx.fillRect(x,y,w,h);ctx.fillStyle='#666d68';ctx.fillRect(x,y,w,Math.min(4,h));ctx.fillStyle='#303837';ctx.fillRect(x,y+h-3,w,3);for(let xx=x+12;xx<x+w;xx+=34){ctx.fillStyle='#79807838';ctx.fillRect(xx,y+5,2,Math.max(4,h-9));}});
    if(snapshot.planted){const t=performance.now()/180;ctx.save();ctx.translate(730,310);ctx.rotate(t);ctx.strokeStyle='#ff704e';ctx.lineWidth=2;ctx.strokeRect(-8,-8,16,16);ctx.fillStyle='#ff704e';ctx.fillRect(-2,-2,4,4);ctx.restore();}
    snapshot.bullets.forEach(b=>{ctx.fillStyle=b.team==='blue'?'#75c9ff':'#ff9b71';ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=10;ctx.beginPath();ctx.arc(b.x,b.y,3,0,7);ctx.fill();ctx.shadowBlur=0;});
    snapshot.players.forEach(p=>{if(!p.alive)return;const own=p.id===myId,blue=p.team==='blue',color=blue?'#63bdfa':'#f28163';ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.angle||0);ctx.fillStyle='#151b1f';ctx.beginPath();ctx.ellipse(1,2,16,12,0,0,Math.PI*2);ctx.fill();ctx.fillStyle=own?'#f5ca72':(blue?'#598da4':'#a65e52');ctx.beginPath();ctx.ellipse(0,0,14,10,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#2e3738';ctx.beginPath();ctx.arc(2,-1,7,0,Math.PI*2);ctx.fill();ctx.fillStyle='#d8d2b8';ctx.fillRect(2,-3,15,5);ctx.fillStyle='#22282a';ctx.fillRect(12,-2,6,3);ctx.restore();
      ctx.fillStyle='#111820';ctx.fillRect(p.x-16,p.y-25,32,4);ctx.fillStyle=p.hp>55?'#83c591':'#ec805f';ctx.fillRect(p.x-16,p.y-25,32*p.hp/100,4);ctx.textAlign='center';ctx.font='9px "DM Mono", monospace';ctx.fillStyle=own?'#ffe0a0':color;ctx.fillText(p.name,p.x,p.y-30);if(own){ctx.strokeStyle='#f5ca72';ctx.lineWidth=1;ctx.beginPath();ctx.arc(p.x,p.y,19,0,Math.PI*2);ctx.stroke();}});
    ctx.textAlign='left';
  }
  let noticeTimer=0;function renderIdle(){if(!snapshot&&$('gameView').classList.contains('hidden'))return;requestAnimationFrame(renderIdle);}requestAnimationFrame(renderIdle);connect();
})();
