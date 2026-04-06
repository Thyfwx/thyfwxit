let termWs;
const WS_URL = `wss://nexus-terminalnexus.onrender.com/ws/terminal`;
let messageHistory = [];
let cmdHistory = JSON.parse(localStorage.getItem('nexus_cmd_history') || '[]');
let historyIndex = -1;

const cpuStat = document.getElementById('cpu-stat');
const memStat = document.getElementById('mem-stat');
const output = document.getElementById('terminal-output');
const input = document.getElementById('terminal-input');
const guiContainer = document.getElementById('game-gui-container');
const guiContent = document.getElementById('gui-content');
const guiTitle = document.getElementById('gui-title');
const nexusCanvas = document.getElementById('nexus-canvas');

let monitorInterval;
let cpuData = [];

// --- Boot Sequence Words ---
const BOOT_WORDS = [
  { label: 'BOOT',  text: 'Initializing quantum uplink...' },
  { label: 'SCAN',  text: 'Probing neural pathways...' },
  { label: 'SYNC',  text: 'Handshaking with mainframe...' },
  { label: 'CRYPT', text: 'Securing encrypted channel...' },
  { label: 'AUTH',  text: 'Verifying node credentials...' },
  { label: 'ALLOC', text: 'Allocating memory buffers...' },
  { label: 'EXEC',  text: 'Spawning AI core process...' },
];

function runBootSequence(callback) {
    let i = 0;
    function step() {
        if (i >= BOOT_WORDS.length) { callback(); return; }
        const w = BOOT_WORDS[i++];
        printToTerminal(`[${w.label}] ${w.text}`, "sys-msg");
        setTimeout(step, 200);
    }
    step();
}

// --- WebSocket Connection with Reconnect ---
function connectWS() {
    runBootSequence(() => {
    termWs = new WebSocket(WS_URL);

    termWs.onopen = () => {
        printToTerminal("[CONN] Uplink active — Nexus AI v3.0 online. Say anything to begin.", "sys-msg");
    };

    termWs.onmessage = (event) => {
        const text = event.data;
        const thinking = document.getElementById('ai-thinking');
        if (thinking) thinking.remove();

        // Handle Function Triggers from AI
        if (text.includes("[TRIGGER:")) {
            handleAITriggers(text);
            return;
        }

        // Handle GUI triggers
        if (text.includes("[GUI_TRIGGER:")) {
            const match = text.match(/\[GUI_TRIGGER:([^:]+):([^\]]+)\]/);
            if (match) {
                const game = match[1];
                const param = match[2];
                showGameGUI(game, param);
            }
            printToTerminal(text.replace(/\[GUI_TRIGGER:[^\]]+\]\n?/, ""));
            return;
        }

        const grid = document.getElementById('wordle-grid');
        if (grid && !guiContainer.classList.contains('gui-hidden')) {
            updateWordleVisuals(text, grid);
        }
        
        if (!text.includes("[GUI_TRIGGER:") && !text.includes("guest@nexus")) {
            messageHistory.push({role: 'assistant', content: text});
        }
        
        printToTerminal(text);
    };

    termWs.onclose = () => {
        printToTerminal("[WARN] Uplink lost. Re-establishing...", "sys-msg");
        setTimeout(connectWS, 3000);
    };
    }); // end runBootSequence
}

function handleAITriggers(text) {
    const triggerMatch = text.match(/\[TRIGGER:([^\]]+)\]/);
    if (triggerMatch) {
        const action = triggerMatch[1].toLowerCase();
        const cleanText = text.replace(/\[TRIGGER:[^\]]+\]/, '').trim();
        if (cleanText) printToTerminal(cleanText);

        if (action === 'pong') startPong();
        if (action === 'monitor') startMonitor();
        if (action === 'clear') { output.innerHTML = ''; messageHistory = []; }
        if (action === 'accessibility') document.body.classList.toggle('a11y-large-text');
    }
}

// --- Live Hardware Monitor ---
function startMonitor() {
    guiContainer.classList.remove('gui-hidden');
    guiTitle.textContent = "SYSTEM HARDWARE MONITOR";
    guiContent.innerHTML = '<p style="color:#0f0; font-size:0.8rem;">Live CPU Load Telemetry</p>';
    nexusCanvas.style.display = 'block';
    const ctx = nexusCanvas.getContext('2d');
    
    stopPong(); // Ensure other games are off
    clearInterval(monitorInterval);
    
    monitorInterval = setInterval(() => {
        // Simulate fluctuating CPU data
        const val = 20 + Math.random() * 40;
        cpuData.push(val);
        if (cpuData.length > 40) cpuData.shift();

        ctx.fillStyle = "#050510";
        ctx.fillRect(0, 0, 400, 400);
        
        // Draw Grid
        ctx.strokeStyle = "rgba(0, 255, 255, 0.1)";
        ctx.beginPath();
        for(let i=0; i<400; i+=40) { ctx.moveTo(i,0); ctx.lineTo(i,400); ctx.moveTo(0,i); ctx.lineTo(400,i); }
        ctx.stroke();

        // Draw Line
        ctx.strokeStyle = "#0ff";
        ctx.lineWidth = 3;
        ctx.shadowBlur = 10;
        ctx.shadowColor = "#0ff";
        ctx.beginPath();
        cpuData.forEach((d, i) => {
            const x = (i / 40) * 400;
            const y = 400 - (d * 4);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.fillStyle = "#0ff";
        ctx.font = "bold 14px monospace";
        ctx.fillText(`CURRENT LOAD: ${val.toFixed(1)}%`, 20, 30);
    }, 200);
}

// --- Input Handling with History ---
input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        const cmd = input.value.trim();
        if (cmd) {
            cmdHistory.unshift(cmd);
            if (cmdHistory.length > 50) cmdHistory.pop();
            localStorage.setItem('nexus_cmd_history', JSON.stringify(cmdHistory));
            historyIndex = -1;

            if (cmd.toLowerCase() === 'clear') {
                output.innerHTML = '';
                messageHistory = [];
            } else if (cmd.toLowerCase() === 'play pong') {
                startPong();
            } else if (cmd.toLowerCase() === 'monitor') {
                startMonitor();
            } else {
                printToTerminal(`guest@nexus:~$ ${cmd}`, 'user-cmd');
                if (termWs.readyState === WebSocket.OPEN) {
                    showThinking();
                    termWs.send(jsonPayload(cmd));
                    messageHistory.push({role: 'user', content: cmd});
                }
            }
            input.value = '';
        }
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (historyIndex < cmdHistory.length - 1) {
            historyIndex++;
            input.value = cmdHistory[historyIndex];
        }
    } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (historyIndex > 0) {
            historyIndex--;
            input.value = cmdHistory[historyIndex];
        } else {
            historyIndex = -1;
            input.value = '';
        }
    }
});

function jsonPayload(cmd) {
    return JSON.stringify({
        command: cmd,
        history: messageHistory.slice(-5)
    });
}

// --- Existing Utils ---
function printToTerminal(text, className="sys-msg") {
    const p = document.createElement('p');
    p.className = className;
    p.innerHTML = text.replace(/\n/g, '<br>');
    output.appendChild(p);
    output.scrollTop = output.scrollHeight;
}

function showThinking() {
    const p = document.createElement('p');
    p.id = 'ai-thinking';
    p.className = 'sys-msg';
    p.innerHTML = '<span class="prompt">></span> Nexus AI is analyzing...';
    output.appendChild(p);
    output.scrollTop = output.scrollHeight;
}

// --- Pong (Existing) ---
let pongInterval;
function startPong() {
    guiContainer.classList.remove('gui-hidden');
    guiTitle.textContent = "NEXUS PONG v1.0";
    guiContent.innerHTML = '<p style="font-size:0.8rem; color:#88f;">Use Mouse or Touch to move paddle</p>';
    nexusCanvas.style.display = 'block';
    const ctx = nexusCanvas.getContext('2d');
    clearInterval(monitorInterval);
    
    let paddleY = 150, ballX = 200, ballY = 200, ballVX = 4, ballVY = 4, aiY = 150, pScore = 0, aScore = 0;
    const move = (y) => { const r = nexusCanvas.getBoundingClientRect(); paddleY = (y - r.top) * (400 / r.height) - 30; };
    nexusCanvas.onmousemove = (e) => move(e.clientY);
    nexusCanvas.ontouchmove = (e) => { e.preventDefault(); move(e.touches[0].clientY); };

    pongInterval = setInterval(() => {
        if (aiY + 30 < ballY) aiY += 3.5; else aiY -= 3.5;
        ballX += ballVX; ballY += ballVY;
        if (ballY < 0 || ballY > 390) ballVY *= -1;
        if (ballX < 20 && ballY > paddleY && ballY < paddleY + 60) { ballVX *= -1.1; ballX = 20; }
        if (ballX > 370 && ballY > aiY && ballY < aiY + 60) { ballVX *= -1.1; ballX = 370; }
        if (ballX < 0) { aScore++; reset(); }
        if (ballX > 400) { pScore++; reset(); }
        function reset() { ballX = 200; ballY = 200; ballVX = (Math.random() > 0.5 ? 4 : -4); ballVY = 4; }
        ctx.fillStyle = "#050510"; ctx.fillRect(0, 0, 400, 400);
        ctx.fillStyle = "#0ff"; ctx.fillRect(10, paddleY, 10, 60); ctx.fillRect(380, aiY, 10, 60); ctx.fillRect(ballX, ballY, 10, 10);
        ctx.font = "20px monospace"; ctx.fillText(pScore, 100, 30); ctx.fillText(aScore, 300, 30);
        ctx.strokeStyle = "rgba(0,255,255,0.2)"; ctx.beginPath(); ctx.moveTo(200,0); ctx.lineTo(200,400); ctx.stroke();
    }, 1000/60);
}
function stopPong() { clearInterval(pongInterval); }

document.getElementById('gui-close').addEventListener('click', () => {
    guiContainer.classList.add('gui-hidden');
    nexusCanvas.style.display = 'none';
    stopPong();
    clearInterval(monitorInterval);
    if (termWs.readyState === WebSocket.OPEN) termWs.send('exit');
    input.focus();
});

// Setup quick action buttons
document.querySelectorAll('.action-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const cmd = btn.getAttribute('data-cmd');
        if (cmd === 'clear') {
            output.innerHTML = '';
            messageHistory = [];
        } else {
            printToTerminal(`guest@nexus:~$ ${cmd}`, 'user-cmd');
            if (termWs.readyState === WebSocket.OPEN) {
                showThinking();
                termWs.send(jsonPayload(cmd));
                messageHistory.push({role: 'user', content: cmd});
            }
            input.focus();
        }
    });
});

function updateClientStats() {
    cpuStat.textContent = (navigator.hardwareConcurrency || '--') + " Cores";
    memStat.textContent = (navigator.deviceMemory || '--') + " GB";
}

connectWS();
updateClientStats();
setInterval(updateClientStats, 5000);
