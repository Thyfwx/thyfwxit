let termWs;
const WS_URL = `wss://nexus-terminalnexus.onrender.com/ws/terminal`;
let messageHistory = [];

const cpuStat = document.getElementById('cpu-stat');
const memStat = document.getElementById('mem-stat');
const batStat = document.getElementById('bat-stat');
const output = document.getElementById('terminal-output');
const input = document.getElementById('terminal-input');
const guiContainer = document.getElementById('game-gui-container');
const guiContent = document.getElementById('gui-content');
const guiTitle = document.getElementById('gui-title');
const nexusCanvas = document.getElementById('nexus-canvas');

// --- WebSocket Connection with Reconnect ---
function connectWS() {
    termWs = new WebSocket(WS_URL);

    termWs.onopen = () => {
        printToTerminal("[CONN] Uplink established with Nexus Mainframe.", "sys-msg");
    };

    termWs.onmessage = (event) => {
        const text = event.data;
        
        // Remove 'thinking' indicator
        const thinking = document.getElementById('ai-thinking');
        if (thinking) thinking.remove();

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

        // Handle Wordle feedback in the GUI
        const grid = document.getElementById('wordle-grid');
        if (grid && !guiContainer.classList.contains('gui-hidden')) {
            updateWordleVisuals(text, grid);
        }
        
        if (!text.includes("[GUI_TRIGGER:") && !text.includes("root@nexus")) {
            messageHistory.push({role: 'assistant', content: text});
        }
        
        printToTerminal(text);
    };

    termWs.onclose = () => {
        printToTerminal("[WARN] Uplink lost. Re-establishing...", "sys-msg");
        setTimeout(connectWS, 3000);
    };

    termWs.onerror = (err) => {
        console.error("WS Error:", err);
    };
}

function updateWordleVisuals(text, grid) {
    const cells = grid.querySelectorAll('.wordle-cell');
    const rows = text.split('\n');
    rows.forEach(line => {
        if (line.includes('[WORDLE] Result:')) {
            const result = line.replace('[WORDLE] Result:', '').trim();
            const parts = result.split(' ');
            let rowToColor = 0;
            for (let r = 0; r < 6; r++) {
                if (cells[r * 5].textContent !== '' && (r === 5 || cells[(r + 1) * 5].textContent === '')) {
                    rowToColor = r;
                    break;
                }
            }
            parts.forEach((p, i) => {
                const cell = cells[rowToColor * 5 + i];
                if (!cell) return;
                if (p.startsWith('[')) cell.style.background = '#0f0';
                else if (p.startsWith('(')) cell.style.background = '#ff0';
                else cell.style.background = '#333';
                cell.style.color = '#000';
            });
        }
        if (line.includes('[WORDLE] Code cracked!') || line.includes('[WORDLE] FAILED.')) {
            const stats = JSON.parse(localStorage.getItem('nexus_wordle_stats') || '{"wins":0, "games":0, "streak":0}');
            stats.games++;
            if (line.includes('cracked')) { stats.wins++; stats.streak++; }
            else { stats.streak = 0; }
            localStorage.setItem('nexus_wordle_stats', JSON.stringify(stats));
        }
    });
}

// --- Stats & Geo ---
function updateClientStats() {
    cpuStat.textContent = (navigator.hardwareConcurrency || '--') + " Cores";
    memStat.textContent = (navigator.deviceMemory || '--') + " GB";
    if ('getBattery' in navigator) {
        navigator.getBattery().then(bat => {
            batStat.textContent = Math.round(bat.level * 100) + "%";
        });
    }
}

fetch('https://ipapi.co/json/').then(res => res.json()).then(data => {
    document.querySelector('.geo-stat').textContent = `LOC: ${data.city || 'Unknown'}, ${data.country_code || '??'}`;
}).catch(() => { document.querySelector('.geo-stat').textContent = 'LOC: Unknown'; });

// --- GUI & Games ---
document.getElementById('gui-close').addEventListener('click', () => {
    guiContainer.classList.add('gui-hidden');
    nexusCanvas.style.display = 'none';
    stopPong();
    if (termWs.readyState === WebSocket.OPEN) termWs.send('exit');
    input.focus();
});

function showGameGUI(game, param) {
    guiContainer.classList.remove('gui-hidden');
    guiContent.innerHTML = '';
    nexusCanvas.style.display = 'none';

    if (game === 'breach') {
        guiTitle.textContent = "BREACH PROTOCOL";
        guiContent.innerHTML = `
            <div style="text-align:center;">
                <p style="color:#88f; font-size:0.8rem; margin-bottom:15px;">BYPASS FIREWALL: TYPE SEQUENCE</p>
                <div style="background:#111; padding:15px; border:1px solid #0ff; margin-bottom:15px; font-size:1.2rem; letter-spacing:2px; font-weight:bold; color:#0ff;">${param}</div>
                <input type="text" id="gui-breach-input" class="gui-input" placeholder="Sequence..." autocomplete="off">
                <button class="gui-btn" id="gui-breach-submit" style="width:100%;">EXECUTE</button>
            </div>`;
        const bIn = document.getElementById('gui-breach-input');
        bIn.focus();
        const sub = () => { if(bIn.value) { termWs.send(bIn.value); printToTerminal(`root@nexus:~# ${bIn.value}`, 'user-cmd'); bIn.value=''; } };
        document.getElementById('gui-breach-submit').onclick = sub;
        bIn.onkeydown = (e) => { if(e.key==='Enter') sub(); };

    } else if (game === 'wordle') {
        const stats = JSON.parse(localStorage.getItem('nexus_wordle_stats') || '{"wins":0, "games":0, "streak":0}');
        guiTitle.textContent = "TERMINAL WORDLE";
        guiContent.innerHTML = `
            <div id="wordle-grid" style="display:grid; grid-template-columns: repeat(5, 40px); gap: 5px; justify-content:center; margin-bottom:15px;"></div>
            <div style="display:flex; gap:10px; margin-bottom:10px;">
                <input type="text" id="gui-wordle-input" class="gui-input" placeholder="5-letter word" maxlength="5" autocomplete="off" style="flex:1;">
                <button class="gui-btn" id="gui-wordle-submit" style="margin:0;">TRY</button>
            </div>
            <div style="font-size:0.7rem; color:#888; display:flex; justify-content:space-around; border-top:1px solid #333; padding-top:10px;">
                <span>GAMES: ${stats.games}</span> <span>WINS: ${stats.wins}</span> <span>STREAK: ${stats.streak}</span>
            </div>`;
        const grid = document.getElementById('wordle-grid');
        for (let i = 0; i < 30; i++) {
            const cell = document.createElement('div');
            cell.className = 'wordle-cell';
            cell.style.cssText = "width:40px; height:40px; border:2px solid #333; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:1.2rem; background:#000;";
            grid.appendChild(cell);
        }
        const wIn = document.getElementById('gui-wordle-input');
        wIn.focus();
        let curRow = 0;
        const sub = () => {
            const val = wIn.value.trim().toLowerCase();
            if (val.length === 5) {
                termWs.send(val);
                printToTerminal(`root@nexus:~# ${val}`, 'user-cmd');
                const cells = grid.querySelectorAll('.wordle-cell');
                for (let i = 0; i < 5; i++) { cells[curRow * 5 + i].textContent = val[i].toUpperCase(); }
                curRow++; wIn.value = '';
            }
        };
        document.getElementById('gui-wordle-submit').onclick = sub;
        wIn.onkeydown = (e) => { if(e.key==='Enter') sub(); };
    }
}

// --- Pong Game Logic ---
let pongInterval;
function startPong() {
    guiContainer.classList.remove('gui-hidden');
    guiTitle.textContent = "NEXUS PONG v1.0";
    guiContent.innerHTML = '<p style="font-size:0.8rem; color:#88f;">Use Mouse or Touch to move paddle</p>';
    nexusCanvas.style.display = 'block';
    const ctx = nexusCanvas.getContext('2d');
    
    let paddleY = 150;
    let ballX = 200, ballY = 200;
    let ballVX = 4, ballVY = 4;
    let aiY = 150;
    let playerScore = 0, aiScore = 0;

    const movePaddle = (clientY) => {
        const rect = nexusCanvas.getBoundingClientRect();
        paddleY = (clientY - rect.top) * (nexusCanvas.height / rect.height) - 30;
    };

    nexusCanvas.onmousemove = (e) => movePaddle(e.clientY);
    nexusCanvas.ontouchmove = (e) => {
        e.preventDefault();
        movePaddle(e.touches[0].clientY);
    };

    pongInterval = setInterval(() => {
        if (aiY + 30 < ballY) aiY += 3.5;
        else aiY -= 3.5;

        ballX += ballVX;
        ballY += ballVY;

        if (ballY < 0 || ballY > 390) ballVY *= -1;

        if (ballX < 20 && ballY > paddleY && ballY < paddleY + 60) { ballVX *= -1.1; ballX = 20; }
        if (ballX > 370 && ballY > aiY && ballY < aiY + 60) { ballVX *= -1.1; ballX = 370; }

        if (ballX < 0) { aiScore++; resetBall(); }
        if (ballX > 400) { playerScore++; resetBall(); }

        function resetBall() { ballX = 200; ballY = 200; ballVX = (Math.random() > 0.5 ? 4 : -4); ballVY = 4; }

        ctx.fillStyle = "#050510";
        ctx.fillRect(0, 0, 400, 400);
        ctx.fillStyle = "#0ff";
        ctx.fillRect(10, paddleY, 10, 60);
        ctx.fillRect(380, aiY, 10, 60);
        ctx.fillRect(ballX, ballY, 10, 10);
        
        ctx.font = "20px monospace";
        ctx.fillText(playerScore, 100, 30);
        ctx.fillText(aiScore, 300, 30);
        ctx.strokeStyle = "rgba(0,255,255,0.2)";
        ctx.beginPath(); ctx.moveTo(200,0); ctx.lineTo(200,400); ctx.stroke();
    }, 1000/60);
}

function stopPong() { clearInterval(pongInterval); }

// --- Terminal Utils ---
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

input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        const cmd = input.value.trim();
        if (cmd) {
            if (cmd.toLowerCase() === 'clear') {
                output.innerHTML = '';
                messageHistory = [];
            } else if (cmd.toLowerCase() === 'play pong') {
                startPong();
            } else {
                printToTerminal(`root@nexus:~# ${cmd}`, 'user-cmd');
                if (termWs.readyState === WebSocket.OPEN) {
                    showThinking();
                    const payload = {
                        command: cmd,
                        history: messageHistory.slice(-5)
                    };
                    termWs.send(JSON.stringify(payload));
                    messageHistory.push({role: 'user', content: cmd});
                } else {
                    printToTerminal("[ERR] No connection to mainframe.", "sys-msg");
                }
            }
            input.value = '';
        }
    }
});

document.querySelectorAll('.action-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const cmd = btn.getAttribute('data-cmd');
        if (cmd === 'clear') {
            output.innerHTML = '';
            messageHistory = [];
        } else if (cmd === 'play pong') {
            startPong();
        } else {
            printToTerminal(`root@nexus:~# ${cmd}`, 'user-cmd');
            if (termWs.readyState === WebSocket.OPEN) {
                showThinking();
                termWs.send(JSON.stringify({command: cmd, history: messageHistory.slice(-5)}));
                messageHistory.push({role: 'user', content: cmd});
            }
            input.focus();
        }
    });
});

document.querySelector('.terminal-container').addEventListener('click', () => { input.focus(); });

// Init
updateClientStats();
connectWS();
setInterval(updateClientStats, 5000);
