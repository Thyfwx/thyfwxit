let termWs;
const WS_URL = `wss://nexus-terminalnexus.onrender.com/ws/terminal`;
let messageHistory = [];
let cmdHistory = JSON.parse(localStorage.getItem('nexus_cmd_history') || '[]');
let historyIndex = -1;

const cpuStat = document.getElementById('cpu-stat');
const memStat = document.getElementById('mem-stat');
const batStat = document.getElementById('bat-stat');
const output = document.getElementById('terminal-output');
const input = document.getElementById('terminal-input');
const guiContainer = document.getElementById('game-gui-container');
const guiContent = document.getElementById('gui-content');
const guiTitle = document.getElementById('gui-title');
const nexusCanvas = document.getElementById('nexus-canvas');

let monitorInterval, pongInterval, snakeInterval;
let cpuHistory = [], memHistory = [], netHistory = [];

// --- WebSocket Connection ---
function connectWS() {
    termWs = new WebSocket(WS_URL);
    termWs.onopen = () => printToTerminal("[CONN] Uplink established with Nexus Mainframe.", "sys-msg");
    termWs.onmessage = (event) => {
        const text = event.data;
        const thinking = document.getElementById('ai-thinking');
        if (thinking) thinking.remove();

        if (text.includes("[TRIGGER:")) { handleAITriggers(text); return; }
        if (text.includes("[GUI_TRIGGER:")) {
            const match = text.match(/\[GUI_TRIGGER:([^:]+):([^\]]+)\]/);
            if (match) showGameGUI(match[1], match[2]);
            printToTerminal(text.replace(/\[GUI_TRIGGER:[^\]]+\]\n?/, ""));
            return;
        }

        const grid = document.getElementById('wordle-grid');
        if (grid && !guiContainer.classList.contains('gui-hidden')) updateWordleVisuals(text, grid);
        if (!text.includes("[GUI_TRIGGER:") && !text.includes("root@nexus")) messageHistory.push({role: 'assistant', content: text});
        printToTerminal(text);
    };
    termWs.onclose = () => {
        printToTerminal("[WARN] Uplink lost. Re-establishing...", "sys-msg");
        setTimeout(connectWS, 3000);
    };
}

function handleAITriggers(text) {
    const triggerMatch = text.match(/\[TRIGGER:([^\]]+)\]/);
    if (triggerMatch) {
        const action = triggerMatch[1].toLowerCase();
        const cleanText = text.replace(/\[TRIGGER:[^\]]+\]/, '').trim();
        if (cleanText) printToTerminal(cleanText);
        if (action === 'pong') startPong();
        if (action === 'snake') startSnake();
        if (action === 'monitor') startMonitor();
        if (action === 'clear') { output.innerHTML = ''; messageHistory = []; }
    }
}

// --- Multi-Line System Monitor ---
function startMonitor() {
    stopAllGames();
    guiContainer.classList.remove('gui-hidden');
    guiTitle.textContent = "ADVANCED SYSTEM TELEMETRY";
    guiContent.innerHTML = `
        <div style="display:flex; justify-content:center; gap:20px; font-size:0.7rem; margin-bottom:10px;">
            <span style="color:#0ff">● CPU</span>
            <span style="color:#f0f">● RAM</span>
            <span style="color:#0f0">● NET</span>
        </div>`;
    nexusCanvas.style.display = 'block';
    const ctx = nexusCanvas.getContext('2d');
    
    monitorInterval = setInterval(() => {
        cpuHistory.push(20 + Math.random() * 30);
        memHistory.push(40 + Math.random() * 10);
        netHistory.push(10 + Math.random() * 60);
        [cpuHistory, memHistory, netHistory].forEach(h => { if(h.length > 50) h.shift(); });

        ctx.fillStyle = "#050510";
        ctx.fillRect(0, 0, 400, 400);
        ctx.strokeStyle = "rgba(0, 255, 255, 0.05)";
        ctx.beginPath();
        for(let i=0; i<400; i+=40) { ctx.moveTo(i,0); ctx.lineTo(i,400); ctx.moveTo(0,i); ctx.lineTo(400,i); }
        ctx.stroke();

        const drawLine = (data, color) => {
            ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath();
            data.forEach((d, i) => {
                const x = (i / 50) * 400;
                const y = 400 - (d * 3.5);
                if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            });
            ctx.stroke();
        };
        drawLine(cpuHistory, "#0ff"); drawLine(memHistory, "#f0f"); drawLine(netHistory, "#0f0");
        ctx.fillStyle = "#fff"; ctx.font = "10px monospace";
        ctx.fillText(`CPU: ${cpuHistory[cpuHistory.length-1]?.toFixed(1)}%`, 10, 20);
    }, 200);
}

// --- Snake Game ---
function startSnake() {
    stopAllGames();
    guiContainer.classList.remove('gui-hidden');
    guiTitle.textContent = "NEXUS SNAKE v1.1";
    guiContent.innerHTML = '<p style="font-size:0.75rem; color:#88f;">Use Arrow Keys or WASD to navigate</p>';
    nexusCanvas.style.display = 'block';
    const ctx = nexusCanvas.getContext('2d');
    
    let snake = [{x: 10, y: 10}], food = {x: 15, y: 15}, dx = 1, dy = 0, score = 0;
    const size = 20, grid = 20;

    const handleInput = (e) => {
        if((e.key==='w'||e.key==='ArrowUp') && dy===0) { dx=0; dy=-1; }
        if((e.key==='s'||e.key==='ArrowDown') && dy===0) { dx=0; dy=1; }
        if((e.key==='a'||e.key==='ArrowLeft') && dx===0) { dx=-1; dy=0; }
        if((e.key==='d'||e.key==='ArrowRight') && dx===0) { dx=1; dy=0; }
    };
    window.addEventListener('keydown', handleInput);

    snakeInterval = setInterval(() => {
        const head = {x: snake[0].x + dx, y: snake[0].y + dy};
        if(head.x<0||head.x>=grid||head.y<0||head.y>=grid||snake.some(s=>s.x===head.x&&s.y===head.y)) {
            printToTerminal(`[GAME OVER] Snake crashed. Score: ${score}`, "sys-msg");
            stopSnake(); return;
        }
        snake.unshift(head);
        if(head.x===food.x && head.y===food.y) {
            score++; food = {x: Math.floor(Math.random()*grid), y: Math.floor(Math.random()*grid)};
        } else { snake.pop(); }

        ctx.fillStyle = "#050510"; ctx.fillRect(0,0,400,400);
        ctx.fillStyle = "#0f0"; snake.forEach(s=>ctx.fillRect(s.x*size, s.y*size, size-2, size-2));
        ctx.fillStyle = "#f00"; ctx.fillRect(food.x*size, food.y*size, size-2, size-2);
        ctx.fillStyle = "#fff"; ctx.fillText(`SCORE: ${score}`, 10, 20);
    }, 100);
}
function stopSnake() { clearInterval(snakeInterval); }

// --- Utilities ---
function runWhoami() {
    const ua = navigator.userAgent;
    const platform = navigator.platform;
    printToTerminal(`\n[ USER IDENTITY REPORT ]\nARCHITECT: Xavier Scott (Verified)\nPLATFORM: ${platform}\nOS: ${ua.split('(')[1].split(')')[0]}\nUPTIME: ${Math.floor(performance.now()/1000)}s\nSTATUS: Authenticated\n`, "sys-msg");
}

function runNeofetch() {
    const art = `
   _   __                      
  / | / /__ _  ____  _______
 /  |/ / _ \\ |/_/ / / / ___/
/ /|  /  __/>  </ /_/ (__  ) 
/_/ |_/\\___/_/|_|\\__,_/____/  
    `;
    printToTerminal(`${art}\nOS: NexusOS v3.0\nHOST: thyfwxit.com\nKERNEL: Gemini-2.5-Flash\nUPTIME: 1d 4h 22m\nSHELL: nsh 1.0\nUSER: root@xavier\n`, "user-cmd");
}

function runHelp() {
    const helpText = `
\n=== NEXUS PROTOCOLS ===
[ GAMES ]
  play snake  - Neural pathing test
  play pong   - Kinetic deflection test
  play breach - Hacking memory grid
  play wordle - Access code decryptor

[ UTILITIES ]
  neofetch    - System visual summary
  whoami      - Identity & Environment info
  monitor     - Real-time telemetry graph
  speedtest   - Network diagnostics

[ SYSTEM ]
  about       - Project core info
  status      - Quick vital signs
  clear       - Wipe terminal
  exit        - Terminate GUI session
=======================\n`;
    printToTerminal(helpText, "sys-msg");
}

// --- Core Utils ---
function stopAllGames() { stopPong(); stopSnake(); clearInterval(monitorInterval); nexusCanvas.style.display='none'; }

function printToTerminal(text, className="sys-msg") {
    const p = document.createElement('p');
    p.className = className;
    p.innerHTML = text.replace(/\n/g, '<br>').replace(/ /g, '&nbsp;');
    output.appendChild(p);
    output.scrollTop = output.scrollHeight;
}

function showThinking() {
    const p = document.createElement('p'); p.id = 'ai-thinking'; p.className = 'sys-msg';
    p.innerHTML = '<span class="prompt">></span> Nexus AI is analyzing...';
    output.appendChild(p); output.scrollTop = output.scrollHeight;
}

input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        const cmd = input.value.trim();
        if (cmd) {
            cmdHistory.unshift(cmd); if(cmdHistory.length>50) cmdHistory.pop();
            localStorage.setItem('nexus_cmd_history', JSON.stringify(cmdHistory));
            historyIndex = -1;
            
            const lowCmd = cmd.toLowerCase();
            if (lowCmd==='clear') { output.innerHTML=''; messageHistory=[]; }
            else if (lowCmd==='help') { runHelp(); }
            else if (lowCmd==='whoami') { runWhoami(); }
            else if (lowCmd==='neofetch') { runNeofetch(); }
            else if (lowCmd==='play snake') { startSnake(); }
            else if (lowCmd==='play pong') { startPong(); }
            else if (lowCmd==='monitor') { startMonitor(); }
            else {
                printToTerminal(`root@nexus:~# ${cmd}`, 'user-cmd');
                if (termWs.readyState === WebSocket.OPEN) {
                    showThinking();
                    termWs.send(JSON.stringify({command: cmd, history: messageHistory.slice(-5)}));
                    messageHistory.push({role: 'user', content: cmd});
                }
            }
            input.value = '';
        }
    } else if (e.key === 'ArrowUp') {
        e.preventDefault(); if(historyIndex < cmdHistory.length-1) { historyIndex++; input.value = cmdHistory[historyIndex]; }
    } else if (e.key === 'ArrowDown') {
        e.preventDefault(); if(historyIndex > 0) { historyIndex--; input.value = cmdHistory[historyIndex]; } else { historyIndex=-1; input.value=''; }
    }
});

document.getElementById('gui-close').addEventListener('click', () => {
    guiContainer.classList.add('gui-hidden'); stopAllGames();
    if (termWs.readyState === WebSocket.OPEN) termWs.send('exit');
    input.focus();
});

document.querySelectorAll('.action-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const cmd = btn.getAttribute('data-cmd');
        input.value = cmd;
        input.dispatchEvent(new KeyboardEvent('keydown', {'key': 'Enter'}));
    });
});

// --- Pong Logic (Shared) ---
function startPong() {
    stopAllGames();
    guiContainer.classList.remove('gui-hidden'); guiTitle.textContent = "NEXUS PONG v1.0";
    guiContent.innerHTML = '<p style="font-size:0.75rem; color:#88f;">Mouse/Touch to move paddle</p>';
    nexusCanvas.style.display = 'block'; const ctx = nexusCanvas.getContext('2d');
    let paddleY = 150, ballX = 200, ballY = 200, ballVX = 4, ballVY = 4, aiY = 150, pScore = 0, aScore = 0;
    const move = (y) => { const r = nexusCanvas.getBoundingClientRect(); paddleY = (y - r.top) * (400 / r.height) - 30; };
    nexusCanvas.onmousemove = (e) => move(e.clientY);
    nexusCanvas.ontouchmove = (e) => { e.preventDefault(); move(e.touches[0].clientY); };
    pongInterval = setInterval(() => {
        if (aiY+30 < ballY) aiY+=3.5; else aiY-=3.5;
        ballX+=ballVX; ballY+=ballVY;
        if (ballY<0||ballY>390) ballVY*=-1;
        if (ballX<20 && ballY>paddleY && ballY<paddleY+60) { ballVX*=-1.1; ballX=20; }
        if (ballX>370 && ballY>aiY && ballY<aiY+60) { ballVX*=-1.1; ballX=370; }
        if (ballX<0) { aScore++; ballX=200; ballY=200; ballVX=4; }
        if (ballX>400) { pScore++; ballX=200; ballY=200; ballVX=-4; }
        ctx.fillStyle = "#050510"; ctx.fillRect(0,0,400,400);
        ctx.fillStyle = "#0ff"; ctx.fillRect(10,paddleY,10,60); ctx.fillRect(380,aiY,10,60); ctx.fillRect(ballX,ballY,10,10);
        ctx.font = "20px monospace"; ctx.fillText(pScore, 100, 30); ctx.fillText(aScore, 300, 30);
    }, 1000/60);
}
function stopPong() { clearInterval(pongInterval); }

connectWS();
setInterval(() => {
    cpuStat.textContent = (navigator.hardwareConcurrency || '--') + " Cores";
    memStat.textContent = (navigator.deviceMemory || '--') + " GB";
}, 5000);
