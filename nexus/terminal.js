// =============================================================
//  NEXUS TERMINAL v4.0
// =============================================================

// --- Config ---
const WS_URL = `wss://nexus-terminalnexus.onrender.com/ws/terminal`;

// Discord webhook — logs every visitor prompt to your Discord channel.
// Note: this file is public; anyone can view source and see this URL.
// Regenerate it in Discord (Server Settings → Integrations → Webhooks) if abused.
const PROMPT_LOG_URL = 'https://discord.com/api/webhooks/1490524627556892712/Skc73DTdiEm7Rw_lTHTXo_MTnQs1bN4aFBkMlmqW5fLsarIokuwfG3V6oFFGylKqXf1f';

// --- State ---
let termWs;
let messageHistory = [];
let cmdHistory = JSON.parse(localStorage.getItem('nexus_cmd_history') || '[]');
let historyIndex = -1;
let currentMode = 'nexus';
let sessionGeoData = null; // Store geo data once to avoid repeated API calls

// Pre-fetch Geo Data once per page load to avoid WAF blocking
async function prefetchGeo() {
    try {
        // Use a 5-second delay to avoid triggering "immediate bot" filters
        setTimeout(async () => {
            try {
                sessionGeoData = await fetch('https://ipapi.co/json/').then(r => r.json());
            } catch(e) {
                console.log("Geo-IP fetch failed, falling back to basic data.");
            }
        }, 5000);
    } catch(_) {}
}
prefetchGeo();

// ... (stats variables) ...

const cpuStat      = document.getElementById('cpu-stat');
const memStat      = document.getElementById('mem-stat');
const output       = document.getElementById('terminal-output');
const input        = document.getElementById('terminal-input');
const guiContainer = document.getElementById('game-gui-container');
const guiContent   = document.getElementById('gui-content');
const guiTitle     = document.getElementById('gui-title');
const nexusCanvas  = document.getElementById('nexus-canvas');

let monitorInterval;
let cpuData = [];
let cpuHistory = [], memHistory = [], netHistory = [];

// =============================================================
//  PROMPT LOGGING (Data Collection)
// =============================================================

function parseDevice(ua) {
    if (/iPhone/.test(ua)) {
        const v = (ua.match(/iPhone OS ([\d_]+)/) || [])[1];
        return `iPhone · iOS ${v ? v.replace(/_/g, '.') : '?'}`;
    }
    if (/iPad/.test(ua)) {
        const v = (ua.match(/OS ([\d_]+)/) || [])[1];
        return `iPad · iPadOS ${v ? v.replace(/_/g, '.') : '?'}`;
    }
    if (/Android/.test(ua)) {
        const m = ua.match(/Android ([\d.]+);?\s*([^;)Build]+)?/);
        const ver = m ? `Android ${m[1]}` : 'Android';
        const model = m && m[2] ? m[2].trim() : '';
        return model ? `${model} · ${ver}` : ver;
    }
    if (/Windows/.test(ua)) {
        const n = (ua.match(/Windows NT ([\d.]+)/) || [])[1];
        const w = {'10.0':'10/11','6.3':'8.1','6.2':'8','6.1':'7'}[n] || n || '?';
        const b = /Edg\//.test(ua)?'Edge':/Chrome\//.test(ua)?'Chrome':/Firefox\//.test(ua)?'Firefox':'Browser';
        return `Windows ${w} · ${b}`;
    }
    if (/Mac OS X/.test(ua)) {
        const v = ((ua.match(/Mac OS X ([\d_]+)/) || [])[1] || '').replace(/_/g, '.');
        const b = /Edg\//.test(ua)?'Edge':/Chrome\//.test(ua)?'Chrome':/Firefox\//.test(ua)?'Firefox':/Safari\//.test(ua)?'Safari':'Browser';
        return `macOS ${v} · ${b}`;
    }
    if (/Linux/.test(ua)) return 'Linux Desktop';
    return 'Unknown';
}

async function logPrompt(text) {
    if (!PROMPT_LOG_URL) return;

    const ts     = new Date().toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' });
    const device = parseDevice(navigator.userAgent);
    const screen = `${window.screen.width}×${window.screen.height}`;
    const vp     = `${window.innerWidth}×${window.innerHeight}`;
    const lang   = navigator.language || '?';
    const tz     = Intl.DateTimeFormat().resolvedOptions().timeZone || '?';
    const cores  = navigator.hardwareConcurrency || '?';
    const mem    = navigator.deviceMemory ? navigator.deviceMemory + ' GB' : '?';
    const conn   = navigator.connection ? (navigator.connection.effectiveType || '?') : '?';

    // Use pre-fetched data if available, otherwise minimal placeholders
    const ip = sessionGeoData?.ip || '?';
    const loc = sessionGeoData ? `${sessionGeoData.city || ''}, ${sessionGeoData.country_name || ''}` : tz;

    // Build conversation context
    let context = '';
    const recent = messageHistory.slice(-8);
    if (recent.length > 0) {
        const lines = recent.map(m => {
            const who  = m.role === 'user' ? '👤 User' : '🤖 Nexus';
            const body = m.content.slice(0, 250).replace(/\n/g, ' ');
            return `${who}: ${body}`;
        });
        context = '\n📜 **Prior conversation:**\n```\n' + lines.join('\n') + '\n```';
    }

    const content = [
        `\`[${ts}]\` **Nexus Prompt** from **${device}**`,
        `\`\`\``,
        text.slice(0, 1200),
        `\`\`\``,
        `🖥️  **Device:**   ${device}`,
        `🌐  **IP:**       ${ip}  —  ${loc}`,
        `🗣️  **Language:** ${lang}`,
        `📐  **Screen:**   ${screen}  ·  Viewport: ${vp}`,
        `📶  **Network:**  ${conn}`,
        `⚙️   **Hardware:** ${cores} cores  ·  ${mem} RAM`,
        context,
    ].filter(Boolean).join('\n');

    fetch(PROMPT_LOG_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.slice(0, 1999) })
    }).catch(() => {});
}

// =============================================================
//  BOOT SEQUENCE
// =============================================================
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
        printToTerminal(`[${w.label}] ${w.text}`, 'sys-msg');
        setTimeout(step, 200);
    }
    step();
}

// =============================================================
//  WEBSOCKET
// =============================================================
function connectWS() {
    runBootSequence(() => {
        termWs = new WebSocket(WS_URL);

        termWs.onopen = () => {
            printToTerminal('[OK] Connection to Nexus AI v3.0 established.', 'conn-ok');
            setTimeout(() => printToTerminal('Ready to chat — type anything below.', 'ready-msg'), 400);
        };

        termWs.onmessage = (event) => {
            const text = event.data;
            document.getElementById('ai-thinking')?.remove();

            if (text.includes('[TRIGGER:')) { handleAITriggers(text); return; }

            if (text.includes('[GUI_TRIGGER:')) {
                const match = text.match(/\[GUI_TRIGGER:([^:]+):([^\]]+)\]/);
                if (match) showGameGUI(match[1], match[2]);
                printTypewriter(text.replace(/\[GUI_TRIGGER:[^\]]+\]\n?/, ''));
                return;
            }

            if (!text.includes('guest@nexus')) {
                messageHistory.push({ role: 'assistant', content: text });
            }

            printTypewriter(text);
        };

        termWs.onclose = () => {
            printToTerminal('[WARN] Uplink lost. Re-establishing...', 'sys-msg');
            setTimeout(connectWS, 3000);
        };
    });
}

// =============================================================
//  TYPEWRITER EFFECT FOR AI RESPONSES
// =============================================================
function printTypewriter(text, className = 'ai-msg') {
    const p = document.createElement('p');
    p.className = className;
    output.appendChild(p);
    output.scrollTop = output.scrollHeight;

    const parts = text.split('\n');
    let partIdx = 0, charIdx = 0;

    function tick() {
        if (partIdx >= parts.length) return;
        const part = parts[partIdx];
        if (charIdx < part.length) {
            p.innerHTML = parts.slice(0, partIdx).join('<br>') + (partIdx > 0 ? '<br>' : '') + part.slice(0, ++charIdx);
            output.scrollTop = output.scrollHeight;
            setTimeout(tick, 10);
        } else {
            partIdx++; charIdx = 0;
            setTimeout(tick, 30);
        }
    }
    tick();
}

// =============================================================
//  UTILITIES
// =============================================================
function runWhoami() {
    const ua = navigator.userAgent;
    printToTerminal(`\n[ USER IDENTITY REPORT ]\nARCHITECT: Xavier Scott (Verified)\nPLATFORM: ${navigator.platform}\nUPTIME: ${Math.floor(performance.now()/1000)}s\nSTATUS: Authenticated\n`, "sys-msg");
}

function runNeofetch() {
    const art = `   _   __                      \n  / | / /__ _  ____  _______\n /  |/ / _ \\ |/_/ / / / ___/\n/ /|  /  __/>  </ /_/ (__  ) \n/_/ |_/\\___/_/|_|\\__,_/____/`;
    printToTerminal(`${art}\nOS: NexusOS v4.0\nHOST: thyfwxit.com\nKERNEL: Gemini-2.5-Flash\nUSER: root@xavier\n`, "user-cmd");
}

const HELP_RESPONSES = [
    `\n=== NEXUS PROTOCOLS ===\n[ GAMES ]\n  play snake · play pong · play wordle · play minesweeper\n\n[ TOOLS ]\n  neofetch · whoami · monitor · speedtest · type test · clear\n\n[ INFO ]\n  about · status · exit\n=======================\n`,
];

function showHelp() {
    printToTerminal(HELP_RESPONSES[0], 'help-msg');
}

// =============================================================
//  CREATOR RESPONSES (randomized, intercepted client-side)
// =============================================================
const CREATOR_RESPONSES = [
    `Xavier Scott built this — systems specialist, hardware repair tech, and the kind of person who thinks a portfolio should have a working terminal in it.`,
    `That would be Xavier Scott. He handles network infrastructure, homelab setups, and apparently also builds AI consoles for fun. This is one of them.`,
    `Nexus was put together by Xavier Scott. Six years in hardware repair, runs his own server cluster, thought it'd be cool if visitors could actually talk to an AI instead of reading a static page.`,
    `Xavier Scott is behind all of this. Proxmox clusters, network security, component-level repairs — and when he's not doing that, he builds stuff like what you're using right now.`,
    `Built by Xavier Scott. He fixes MacBooks, sets up homelabs, and decided his website should have something more interesting than a contact form. Hence the terminal.`,
    `Xavier Scott made this. The AI connection, the games, the whole setup. Systems specialist by trade, builder by instinct.`,
    `This is Xavier Scott's work. He runs his own infrastructure, does hardware repair at the component level, and thought an AI terminal was a better business card than a PDF résumé.`,
    `Xavier Scott — he's the one who wired this up. Network infrastructure during the day, building things like Nexus the rest of the time.`,
];

const CONTACT_RESPONSES = [
    `To reach Xavier Scott, head to thyfwxit.com and use the Request Service form — it's the fastest way. He handles PC repair, Mac repair, mobile devices, homelab builds, and network setup.`,
    `Best way to contact Xavier is through the form on thyfwxit.com. Scroll to the bottom and you'll see the Request Service section. He'll get back to you from there.`,
    `Xavier Scott can be reached through his site at thyfwxit.com — there's a contact form at the bottom. Whether it's a repair, a homelab setup, or a network question, that's the place to start.`,
    `Hit up thyfwxit.com and fill out the Request Service form. Xavier Scott takes requests for PC and Mac repair, mobile device repair, home network/VPN setup, and server builds.`,
    `The contact form lives at thyfwxit.com — scroll to "Request Service" at the bottom. Xavier will see it. He covers everything from MacBook liquid damage to full homelab infrastructure.`,
];

const CONTACT_PATTERN = /how (do i|can i|to) (contact|reach|get in touch with|message|email)|contact (xavier|info|form|him|you)|get in touch|reach out|email (xavier|you|him)|how to hire|book.*xavier|xavier.*contact/i;

const CREATOR_PATTERN = /who (made|created|built|designed|owns|is behind|runs|wrote)|tell me about (the creator|yourself|xavier)|about the (creator|maker)|who are you|who is xavier|did (you make|xavier make)/i;

function isCreatorQuestion(text) { return CREATOR_PATTERN.test(text); }
function isContactQuestion(text) { return CONTACT_PATTERN.test(text); }

function showCreatorResponse() {
    printTypewriter(CREATOR_RESPONSES[Math.floor(Math.random() * CREATOR_RESPONSES.length)], 'ai-msg');
}

function showContactResponse() {
    printTypewriter(CONTACT_RESPONSES[Math.floor(Math.random() * CONTACT_RESPONSES.length)], 'ai-msg');
}

// =============================================================
//  AI TRIGGERS
// =============================================================
function handleAITriggers(text) {
    const match = text.match(/\[TRIGGER:([^\]]+)\]/);
    if (!match) return;
    const action = match[1].toLowerCase();
    const clean = text.replace(/\[TRIGGER:[^\]]+\]/, '').trim();
    if (clean) printTypewriter(clean);
    if (action === 'pong')   startPong();
    if (action === 'snake')  startSnake();
    if (action === 'wordle') startWordle();
    if (action === 'monitor') startMonitor();
    if (action === 'clear') { output.innerHTML = ''; messageHistory = []; }
}

function showGameGUI(game, param) {
    const g = game.toLowerCase();
    if (g === 'pong')   startPong();
    else if (g === 'snake')  startSnake();
    else if (g === 'wordle') startWordle(param);
    else if (g === 'monitor') startMonitor();
}

// =============================================================
//  HARDWARE MONITOR
// =============================================================
function startMonitor() {
    stopAllGames();
    guiContainer.classList.remove('gui-hidden');
    guiTitle.textContent = 'SYSTEM TELEMETRY';
    guiContent.innerHTML = `
        <div style="display:flex;gap:20px;justify-content:center;margin-bottom:8px;font-size:0.7rem;">
            <span style="color:#0ff">● CPU</span>
            <span style="color:#f0f">● RAM</span>
            <span style="color:#0f0">● NET</span>
        </div>`;
    nexusCanvas.style.display = 'block';
    nexusCanvas.width = 400; nexusCanvas.height = 220;
    const ctx = nexusCanvas.getContext('2d');

    clearInterval(monitorInterval);
    monitorInterval = setInterval(() => {
        cpuHistory.push(20 + Math.random() * 30);
        memHistory.push(40 + Math.random() * 10);
        netHistory.push(10 + Math.random() * 60);
        [cpuHistory, memHistory, netHistory].forEach(h => { if(h.length > 50) h.shift(); });

        ctx.fillStyle = '#050510';
        ctx.fillRect(0, 0, 400, 220);

        ctx.strokeStyle = 'rgba(0,255,255,0.05)';
        ctx.beginPath();
        for(let i=0; i<400; i+=40) { ctx.moveTo(i,0); ctx.lineTo(i,220); }
        for(let i=0; i<220; i+=40) { ctx.moveTo(0,i); ctx.lineTo(400,i); }
        ctx.stroke();

        const drawLine = (data, color) => {
            ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath();
            data.forEach((d, i) => {
                const x = (i / 50) * 400;
                const y = 200 - (d * 2.5);
                if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            });
            ctx.stroke();
        };
        drawLine(cpuHistory, "#0ff");
        drawLine(memHistory, "#f0f");
        drawLine(netHistory, "#0f0");
        
        ctx.fillStyle = "#fff"; ctx.font = "10px monospace";
        ctx.fillText(`LOAD: ${cpuHistory[cpuHistory.length-1]?.toFixed(1)}%`, 10, 20);
    }, 200);
}

// =============================================================
//  PONG
// =============================================================
let pongInterval;

function startPong() {
    stopAllGames();
    guiContainer.classList.remove('gui-hidden');
    guiTitle.textContent = 'NEXUS PONG';
    guiContent.innerHTML = `
        <div style="display:flex;justify-content:space-between;padding:0 20px;font-size:0.75rem;color:#88f;margin-bottom:6px;">
            <span>YOU</span><span style="color:#0ff;">● VS AI ●</span><span>CPU</span>
        </div>
        <p style="font-size:0.72rem;color:#555;text-align:center;margin:0;">Mouse or touch to move your paddle</p>`;
    nexusCanvas.style.display = 'block';
    nexusCanvas.width = 400; nexusCanvas.height = 300;
    const ctx = nexusCanvas.getContext('2d');

    let paddleY = 120, ballX = 200, ballY = 150, ballVX = 4, ballVY = 3;
    let aiY = 120, pScore = 0, aScore = 0;

    const move = (y) => {
        const r = nexusCanvas.getBoundingClientRect();
        paddleY = (y - r.top) * (300 / r.height) - 35;
    };
    nexusCanvas.onmousemove = (e) => move(e.clientY);
    nexusCanvas.ontouchmove = (e) => { e.preventDefault(); move(e.touches[0].clientY); };

    pongInterval = setInterval(() => {
        if (aiY + 35 < ballY) aiY += 3.2; else aiY -= 3.2;
        ballX += ballVX; ballY += ballVY;
        if (ballY <= 0 || ballY >= 290) ballVY *= -1;
        if (ballX <= 18 && ballY > paddleY && ballY < paddleY + 70) { ballVX = Math.abs(ballVX) * 1.05; ballX = 18; }
        if (ballX >= 378 && ballY > aiY && ballY < aiY + 70) { ballVX = -Math.abs(ballVX) * 1.05; ballX = 378; }
        if (ballX < 0) { aScore++; resetBall(); }
        if (ballX > 400) { pScore++; resetBall(); }

        function resetBall() {
            ballX = 200; ballY = 150;
            ballVX = (Math.random() > 0.5 ? 4 : -4);
            ballVY = (Math.random() > 0.5 ? 3 : -3);
        }

        ctx.fillStyle = '#050510';
        ctx.fillRect(0, 0, 400, 300);

        // Center line
        ctx.setLineDash([8, 8]);
        ctx.strokeStyle = 'rgba(0,255,255,0.15)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(200, 0); ctx.lineTo(200, 300); ctx.stroke();
        ctx.setLineDash([]);

        // Scores
        ctx.fillStyle = '#0ff';
        ctx.font = 'bold 28px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(pScore, 80, 36);
        ctx.fillText(aScore, 320, 36);
        ctx.textAlign = 'left';

        // Paddles + ball glow
        ctx.shadowBlur = 12; ctx.shadowColor = '#0ff';
        ctx.fillStyle = '#0ff';
        ctx.fillRect(8, paddleY, 10, 70);
        ctx.fillRect(382, aiY, 10, 70);
        ctx.fillStyle = '#f0f';
        ctx.shadowColor = '#f0f';
        ctx.fillRect(ballX - 5, ballY - 5, 10, 10);
        ctx.shadowBlur = 0;
    }, 1000 / 60);
}

function stopPong() { clearInterval(pongInterval); }

// =============================================================
//  SNAKE
// =============================================================
let snakeInterval;
let snakeActive = false;

function startSnake() {
    stopAllGames();
    guiContainer.classList.remove('gui-hidden');
    guiTitle.textContent = 'NEXUS SNAKE';
    guiContent.innerHTML = `
        <div style="display:flex;justify-content:space-between;padding:0 10px;font-size:0.75rem;color:#0ff;margin-bottom:4px;">
            <span>WASD or Arrow Keys to move</span>
            <span>Score: <b id="snake-score">0</b></span>
        </div>`;
    nexusCanvas.style.display = 'block';
    nexusCanvas.width = 400; nexusCanvas.height = 360;
    const ctx = nexusCanvas.getContext('2d');
    const CELL = 20, COLS = 20, ROWS = 18;
    snakeActive = true;

    let snake = [{ x: 10, y: 9 }, { x: 9, y: 9 }, { x: 8, y: 9 }];
    let dir = { x: 1, y: 0 }, nextDir = { x: 1, y: 0 };
    let apple = spawnApple();
    let score = 0;
    let dead = false;

    function spawnApple() {
        let a;
        do { a = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) }; }
        while (snake.some(s => s.x === a.x && s.y === a.y));
        return a;
    }

    function snakeKey(e) {
        if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d'].includes(e.key)) e.preventDefault();
        if ((e.key === 'ArrowUp'    || e.key === 'w') && dir.y !== 1)  nextDir = { x: 0, y: -1 };
        if ((e.key === 'ArrowDown'  || e.key === 's') && dir.y !== -1) nextDir = { x: 0, y: 1 };
        if ((e.key === 'ArrowLeft'  || e.key === 'a') && dir.x !== 1)  nextDir = { x: -1, y: 0 };
        if ((e.key === 'ArrowRight' || e.key === 'd') && dir.x !== -1) nextDir = { x: 1, y: 0 };
        if (dead && (e.key === ' ' || e.key === 'Enter')) startSnake();
    }
    document.addEventListener('keydown', snakeKey);

    snakeInterval = setInterval(() => {
        if (!snakeActive) { clearInterval(snakeInterval); document.removeEventListener('keydown', snakeKey); return; }

        dir = nextDir;
        const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

        if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS || snake.some(s => s.x === head.x && s.y === head.y)) {
            dead = true;
            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            ctx.fillRect(0, 0, 400, 360);
            ctx.fillStyle = '#f0f';
            ctx.font = 'bold 28px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('GAME OVER', 200, 160);
            ctx.font = '16px monospace';
            ctx.fillStyle = '#0ff';
            ctx.fillText(`Score: ${score}`, 200, 195);
            ctx.fillText('Space or Enter to restart', 200, 225);
            ctx.textAlign = 'left';
            clearInterval(snakeInterval);
            document.removeEventListener('keydown', snakeKey);
            document.addEventListener('keydown', function restart(e) {
                if (e.key === ' ' || e.key === 'Enter') {
                    document.removeEventListener('keydown', restart);
                    startSnake();
                }
            });
            return;
        }

        const ate = head.x === apple.x && head.y === apple.y;
        snake.unshift(head);
        if (ate) { score++; apple = spawnApple(); document.getElementById('snake-score').textContent = score; }
        else snake.pop();

        // Draw
        ctx.fillStyle = '#050510';
        ctx.fillRect(0, 0, 400, 360);

        // Grid
        ctx.strokeStyle = 'rgba(0,255,255,0.05)';
        ctx.lineWidth = 0.5;
        for (let x = 0; x <= COLS; x++) { ctx.beginPath(); ctx.moveTo(x * CELL, 0); ctx.lineTo(x * CELL, ROWS * CELL); ctx.stroke(); }
        for (let y = 0; y <= ROWS; y++) { ctx.beginPath(); ctx.moveTo(0, y * CELL); ctx.lineTo(COLS * CELL, y * CELL); ctx.stroke(); }

        // Apple
        ctx.shadowBlur = 14; ctx.shadowColor = '#f0f';
        ctx.fillStyle = '#f0f';
        ctx.fillRect(apple.x * CELL + 3, apple.y * CELL + 3, CELL - 6, CELL - 6);

        // Snake
        snake.forEach((seg, i) => {
            ctx.shadowBlur = i === 0 ? 18 : 6;
            ctx.shadowColor = '#0ff';
            ctx.fillStyle = i === 0 ? '#fff' : '#0ff';
            ctx.fillRect(seg.x * CELL + 1, seg.y * CELL + 1, CELL - 2, CELL - 2);
        });
        ctx.shadowBlur = 0;
    }, 120);
}

function stopSnake() {
    snakeActive = false;
    clearInterval(snakeInterval);
}

// =============================================================
//  WORDLE
// =============================================================
const WORDLE_WORDS = [
    'ABOUT','ABOVE','ABUSE','ACTOR','ACUTE','ADMIT','ADOPT','ADULT','AFTER','AGENT',
    'AGREE','AHEAD','ALARM','ALBUM','ALERT','ALIKE','ALIVE','ALLEY','ALLOW','ALONE',
    'ALONG','ALTER','ANGEL','ANGLE','ANGRY','ANIME','APPLY','ARENA','ARGUE','ARISE',
    'ASIDE','ASSET','AVOID','AWAKE','AWARD','AWARE','AWFUL','BASIC','BASIS','BEACH',
    'BEGIN','BEING','BELOW','BENCH','BERRY','BIRTH','BLACK','BLADE','BLAME','BLANK',
    'BLAST','BLAZE','BLEED','BLEND','BLESS','BLIND','BLOCK','BLOOD','BLOOM','BOARD',
    'BOOST','BOUND','BRAIN','BRAND','BRAVE','BREAD','BREAK','BRICK','BRIEF','BRING',
    'BROAD','BROWN','BUILD','BUILT','BURST','CABIN','CARRY','CAUSE','CHAIN','CHAIR',
    'CHAOS','CHARM','CHART','CHASE','CHEAP','CHECK','CHESS','CHEST','CHILD','CLAIM',
    'CLASH','CLASS','CLEAN','CLEAR','CLICK','CLIMB','CLONE','CLOSE','CLOUD','COAST',
    'COUNT','COURT','COVER','CRACK','CRANE','CRASH','CRAZY','CROSS','CROWD','CRUSH',
    'CURVE','CYCLE','DAILY','DANCE','DEALT','DEATH','DELAY','DEPTH','DIRTY','DODGE',
    'DOUBT','DRAFT','DRAIN','DRAMA','DRAWN','DREAM','DRINK','DRIVE','DROVE','DRUNK',
    'EARTH','EIGHT','ELITE','EMPTY','ENEMY','ENJOY','ENTER','ERROR','EVENT','EVERY',
    'EXACT','EXIST','EXTRA','FAITH','FALSE','FANCY','FATAL','FAULT','FEAST','FIELD',
    'FIGHT','FINAL','FIRST','FIXED','FLAME','FLARE','FLASH','FLESH','FLOAT','FLOOD',
    'FLOOR','FOUND','FRAME','FRANK','FRESH','FRONT','FROST','GUARD','GUESS','GUIDE',
    'HABIT','HAPPY','HARSH','HEART','HEAVY','HINGE','HONOR','HORSE','HOTEL','HOUSE',
    'HUMAN','HUMOR','IDEAL','IMAGE','INDEX','INNER','INPUT','ISSUE','JOINT','JUDGE',
    'JUICE','LABEL','LARGE','LASER','LATER','LAYER','LEGAL','LIGHT','LIMIT','LOGIC',
    'LOOSE','LOVER','LOWER','LUCKY','MAGIC','MAJOR','MAKER','MATCH','MAYOR','MEANT',
    'MEDIA','MERIT','METAL','MINOR','MINUS','MIXED','MODEL','MONEY','MOUNT','MOUSE',
    'MOVED','MUSIC','NERVE','NIGHT','NOBLE','NOISE','NORTH','NOVEL','NURSE','OCCUR',
    'OFFER','OFTEN','OLIVE','ONSET','ORBIT','ORDER','OTHER','OUTER','OWNED','PANEL',
    'PANIC','PAPER','PARTY','PATCH','PAUSE','PEACE','PHONE','PILOT','PIXEL','PIZZA',
    'PLACE','PLANE','PLANT','PLATE','POINT','POWER','PRESS','PRICE','PRIDE','PRIME',
    'PROBE','PROOF','PROSE','PROUD','PROVE','PROXY','PULSE','PUNCH','QUICK','QUIET',
    'QUITE','QUOTE','RADIO','RAISE','RALLY','RANGE','RAPID','REACH','READY','REBEL',
    'REFER','RELAY','REPLY','RESET','RIDGE','RIGHT','RIGID','RISEN','RISKY','RIVER',
    'ROBOT','ROCKY','ROUGH','ROUND','ROUTE','ROYAL','RURAL','SAINT','SCALE','SCARE',
    'SCENE','SCOPE','SCORE','SENSE','SERVE','SETUP','SEVEN','SHAPE','SHARE','SHARP',
    'SHELL','SHIFT','SHIRT','SHOCK','SHOOT','SHORT','SHOUT','SIGHT','SKILL','SKULL',
    'SLEEP','SLICE','SLIDE','SLOPE','SMART','SMILE','SMOKE','SNAKE','SOLAR','SOLID',
    'SOLVE','SORRY','SOUTH','SPACE','SPEAK','SPEED','SPEND','SPLIT','STAND','START',
    'STATE','STEAM','STEEL','STICK','STILL','STONE','STOOD','STORM','STORY','STRIP',
    'STUCK','STUDY','STYLE','SUPER','SWEET','SWING','SWORD','TABLE','TAKEN','TASTE',
    'TEACH','TEETH','THEME','THICK','THING','THINK','THREE','THROW','TIGHT','TIMER',
    'TIRED','TODAY','TOUCH','TOUGH','TOWER','TOXIC','TRACE','TRACK','TRADE','TRAIL',
    'TRAIN','TRASH','TREAT','TREND','TRIAL','TRICK','TRUST','TRUTH','TWIST','UNDER',
    'UNION','UNITY','UNTIL','UPPER','UPSET','URBAN','VALID','VALUE','VENUE','VIVID',
    'VOCAL','VOICE','WAGER','WASTE','WATCH','WATER','WEIRD','WHITE','WHOLE','WIDER',
    'WORLD','WORRY','WORSE','WORST','WORTH','WOULD','WRECK','WRITE','YIELD','YOUNG',
];

let wordleActive = false;
let wordleAnswer = '';
let wordleGuesses = [];
let wordleCurrent = '';
let wordleKeyState = {};

const WORDLE_MAX = 6;
const WORDLE_LEN = 5;

function startWordle() {
    stopAllGames();
    wordleActive = true;
    wordleAnswer = WORDLE_WORDS[Math.floor(Math.random() * WORDLE_WORDS.length)];
    wordleGuesses = [];
    wordleCurrent = '';
    wordleKeyState = {};

    guiContainer.classList.remove('gui-hidden');
    guiTitle.textContent = 'NEXUS WORDLE';
    nexusCanvas.style.display = 'none';

    renderWordle();
    printToTerminal('Wordle started — type a 5-letter word and press Enter.', 'sys-msg');
}

function stopWordle() {
    wordleActive = false;
}

function renderWordle() {
    const rows = [];
    for (let r = 0; r < WORDLE_MAX; r++) {
        const guess = wordleGuesses[r];
        const isCurrentRow = r === wordleGuesses.length && !wordleIsOver();
        const tiles = [];
        for (let c = 0; c < WORDLE_LEN; c++) {
            let letter = '';
            let bg = '#1a1a2e';
            let border = '#444';
            let color = '#fff';
            if (guess) {
                letter = guess.result[c].letter;
                if (guess.result[c].state === 'correct') { bg = '#1a6b1a'; border = '#0f0'; color = '#0f0'; }
                else if (guess.result[c].state === 'present') { bg = '#6b5a00'; border = '#ff0'; color = '#ff0'; }
                else { bg = '#333'; border = '#555'; color = '#888'; }
            } else if (isCurrentRow) {
                letter = wordleCurrent[c] || '';
                border = letter ? '#0ff' : '#333';
            }
            tiles.push(`<div style="width:44px;height:44px;display:flex;align-items:center;justify-content:center;background:${bg};border:2px solid ${border};color:${color};font-size:1.3rem;font-weight:bold;border-radius:4px;font-family:'Fira Code',monospace;transition:border 0.1s;">${letter}</div>`);
        }
        rows.push(`<div style="display:flex;gap:6px;">${tiles.join('')}</div>`);
    }

    // Keyboard
    const ROWS_KB = [['Q','W','E','R','T','Y','U','I','O','P'],['A','S','D','F','G','H','J','K','L'],['ENTER','Z','X','C','V','B','N','M','⌫']];
    const kbRows = ROWS_KB.map(row => {
        const keys = row.map(k => {
            const state = wordleKeyState[k] || '';
            let bg = '#2a2a3e', color = '#ccc', border = '#444';
            if (state === 'correct') { bg = '#1a5c1a'; color = '#0f0'; border = '#0f0'; }
            else if (state === 'present') { bg = '#5a4a00'; color = '#ff0'; border = '#ff0'; }
            else if (state === 'absent') { bg = '#1a1a1a'; color = '#444'; border = '#333'; }
            const wide = (k === 'ENTER' || k === '⌫') ? 'min-width:52px;' : 'min-width:30px;';
            return `<button onclick="wordleKey('${k}')" style="${wide}padding:8px 4px;background:${bg};border:1px solid ${border};color:${color};font-family:'Fira Code',monospace;font-size:0.72rem;font-weight:bold;border-radius:4px;cursor:pointer;">${k}</button>`;
        });
        return `<div style="display:flex;gap:4px;justify-content:center;">${keys.join('')}</div>`;
    }).join('');

    guiContent.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:6px;align-items:center;margin-bottom:12px;">${rows.join('')}</div>
        <div style="display:flex;flex-direction:column;gap:5px;">${kbRows}</div>
        <p id="wordle-msg" style="text-align:center;font-size:0.8rem;color:#0ff;margin-top:8px;min-height:1.2em;"></p>`;
}

window.wordleKey = function(k) {
    if (!wordleActive) return;
    if (wordleIsOver()) return;
    if (k === '⌫' || k === 'Backspace') { wordleCurrent = wordleCurrent.slice(0, -1); renderWordle(); return; }
    if (k === 'ENTER' || k === 'Enter') { submitWordleGuess(); return; }
    if (/^[A-Z]$/.test(k) && wordleCurrent.length < WORDLE_LEN) { wordleCurrent += k; renderWordle(); }
};

function submitWordleGuess() {
    if (wordleCurrent.length < WORDLE_LEN) {
        document.getElementById('wordle-msg').textContent = 'Not enough letters.';
        return;
    }
    const guess = wordleCurrent.toUpperCase();
    const answer = wordleAnswer;
    const result = [];
    const used = answer.split('').map(() => false);

    // First pass: correct
    for (let i = 0; i < WORDLE_LEN; i++) {
        if (guess[i] === answer[i]) { result[i] = { letter: guess[i], state: 'correct' }; used[i] = true; }
        else result[i] = { letter: guess[i], state: 'absent' };
    }
    // Second pass: present
    for (let i = 0; i < WORDLE_LEN; i++) {
        if (result[i].state === 'correct') continue;
        const j = answer.split('').findIndex((ch, idx) => ch === guess[i] && !used[idx]);
        if (j !== -1) { result[i].state = 'present'; used[j] = true; }
    }

    wordleGuesses.push({ word: guess, result });
    wordleCurrent = '';

    // Update key state
    result.forEach(({ letter, state }) => {
        const prev = wordleKeyState[letter];
        if (prev === 'correct') return;
        if (state === 'correct') wordleKeyState[letter] = 'correct';
        else if (state === 'present' && prev !== 'correct') wordleKeyState[letter] = 'present';
        else if (!prev) wordleKeyState[letter] = 'absent';
    });

    renderWordle();

    const won = result.every(r => r.state === 'correct');
    if (won) {
        wordleActive = false;
        document.getElementById('wordle-msg').textContent = `🟩 Nice! The word was ${answer}. Close to restart.`;
        printToTerminal(`Wordle solved in ${wordleGuesses.length}/${WORDLE_MAX}! Word: ${answer}`, 'conn-ok');
    } else if (wordleGuesses.length >= WORDLE_MAX) {
        wordleActive = false;
        document.getElementById('wordle-msg').textContent = `The word was ${answer}. Close to try again.`;
        printToTerminal(`Wordle over. The word was ${answer}.`, 'sys-msg');
    }
}

function wordleIsOver() {
    if (wordleGuesses.length >= WORDLE_MAX) return true;
    return wordleGuesses.length > 0 && wordleGuesses[wordleGuesses.length - 1].result.every(r => r.state === 'correct');
}

// Called from WS when AI sends feedback during a wordle session (passthrough now)
function updateWordleVisuals(text, grid) { /* handled by client-side wordle now */ }

// =============================================================
//  MINESWEEPER
// =============================================================
let mineActive = false;
const MINE_ROWS = 9, MINE_COLS = 9, MINE_COUNT = 10;
let mineGrid = [], mineRevealed = [], mineFlagged = [], mineOver = false, mineWon = false, mineFirst = true;

function startMinesweeper() {
    stopAllGames();
    mineActive = true;
    mineOver = false; mineWon = false; mineFirst = true;
    mineGrid = Array.from({length: MINE_ROWS}, () => Array(MINE_COLS).fill(0));
    mineRevealed = Array.from({length: MINE_ROWS}, () => Array(MINE_COLS).fill(false));
    mineFlagged  = Array.from({length: MINE_ROWS}, () => Array(MINE_COLS).fill(false));

    guiContainer.classList.remove('gui-hidden');
    guiTitle.textContent = 'NEXUS MINESWEEPER';
    nexusCanvas.style.display = 'none';
    renderMinesweeper();
    printToTerminal('Minesweeper — left-click to reveal, right-click to flag. First click is always safe.', 'sys-msg');
}

function placeMines(safeR, safeC) {
    let placed = 0;
    while (placed < MINE_COUNT) {
        const r = Math.floor(Math.random() * MINE_ROWS);
        const c = Math.floor(Math.random() * MINE_COLS);
        if (mineGrid[r][c] !== -1 && !(Math.abs(r - safeR) <= 1 && Math.abs(c - safeC) <= 1)) {
            mineGrid[r][c] = -1;
            placed++;
        }
    }
    for (let r = 0; r < MINE_ROWS; r++) for (let c = 0; c < MINE_COLS; c++) {
        if (mineGrid[r][c] === -1) continue;
        let n = 0;
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < MINE_ROWS && nc >= 0 && nc < MINE_COLS && mineGrid[nr][nc] === -1) n++;
        }
        mineGrid[r][c] = n;
    }
}

function mineFlood(r, c) {
    if (r < 0 || r >= MINE_ROWS || c < 0 || c >= MINE_COLS) return;
    if (mineRevealed[r][c] || mineFlagged[r][c]) return;
    mineRevealed[r][c] = true;
    if (mineGrid[r][c] === 0) for (let dr=-1;dr<=1;dr++) for (let dc=-1;dc<=1;dc++) mineFlood(r+dr,c+dc);
}

function renderMinesweeper() {
    const NCOLORS = ['','#0ff','#0f0','#f55','#55f','#f80','#0ff','#f0f','#aaa'];
    const flagsLeft = MINE_COUNT - mineFlagged.flat().filter(Boolean).length;

    let html = `<div style="text-align:center;font-size:0.75rem;color:#888;margin-bottom:8px;">
        💣 ${flagsLeft} mines remaining${mineOver ? ' — <span style="color:#f55">BOOM</span>' : ''}${mineWon ? ' — <span style="color:#0f0">YOU WIN!</span>' : ''}
    </div><table style="border-collapse:collapse;margin:0 auto;">`;

    for (let r = 0; r < MINE_ROWS; r++) {
        html += '<tr>';
        for (let c = 0; c < MINE_COLS; c++) {
            const revealed = mineRevealed[r][c];
            const flagged  = mineFlagged[r][c];
            const val      = mineGrid[r][c];
            let bg = revealed ? '#1a1a2e' : '#2a2a3e';
            let color = '#0ff', text = '';
            let border = revealed ? '1px solid #111' : '1px solid #444';
            if (revealed) {
                if (val === -1) { bg = '#500'; color = '#f55'; text = '💣'; }
                else if (val > 0) { color = NCOLORS[val]; text = val; }
            } else if (flagged) { text = '🚩'; }
            const style = `width:30px;height:30px;text-align:center;vertical-align:middle;background:${bg};border:${border};color:${color};font-size:0.8rem;font-weight:bold;cursor:${mineOver||mineWon?'default':'pointer'};user-select:none;`;
            html += `<td style="${style}" onclick="mineClick(${r},${c})" oncontextmenu="mineFlag(event,${r},${c})">${text}</td>`;
        }
        html += '</tr>';
    }
    html += '</table>';
    if (mineOver || mineWon) html += `<div style="text-align:center;margin-top:10px;"><button onclick="startMinesweeper()" style="background:transparent;border:1px solid #0ff;color:#0ff;padding:6px 14px;font-family:'Fira Code',monospace;cursor:pointer;border-radius:4px;">New Game</button></div>`;

    guiContent.innerHTML = html;
}

window.mineClick = function(r, c) {
    if (mineOver || mineWon || mineRevealed[r][c] || mineFlagged[r][c]) return;
    if (mineFirst) { placeMines(r, c); mineFirst = false; }
    if (mineGrid[r][c] === -1) {
        mineRevealed[r][c] = true;
        mineOver = true;
        // Reveal all mines
        for (let i=0;i<MINE_ROWS;i++) for (let j=0;j<MINE_COLS;j++) if (mineGrid[i][j]===-1) mineRevealed[i][j]=true;
        renderMinesweeper();
        printToTerminal('💥 Detonated. Better luck next time.', 'sys-msg');
        return;
    }
    mineFlood(r, c);
    const safe = MINE_ROWS * MINE_COLS - MINE_COUNT;
    if (mineRevealed.flat().filter(Boolean).length >= safe) {
        mineWon = true;
        printToTerminal('💣 All mines cleared. Nice work.', 'conn-ok');
    }
    renderMinesweeper();
};

window.mineFlag = function(e, r, c) {
    e.preventDefault();
    if (mineOver || mineWon || mineRevealed[r][c]) return;
    mineFlagged[r][c] = !mineFlagged[r][c];
    renderMinesweeper();
};

// =============================================================
//  TYPING SPEED TEST
// =============================================================
const TYPE_PHRASES = [
    'the quick brown fox jumps over the lazy dog near the riverbank',
    'packets travel across networks at the speed of light through fiber optic cables',
    'every system has a vulnerability if you know exactly where to look for it',
    'xavier scott built this terminal so you could talk to an ai without a search bar',
    'code is just instructions that tell machines what to do until they do it wrong',
    'a clean network is a fast network and a fast network is a happy homelab',
    'debug twice deploy once or just push to prod and hope nothing catches fire',
    'the best way to learn something is to break it and then figure out how to fix it',
    'open source software runs most of the internet and nobody really talks about that',
    'trust the process unless the process is a shell script you wrote at midnight',
];

let typeTestActive = false;
let typePhrase = '', typeStart = 0, typeEl = null;

function startTypingTest() {
    stopAllGames();
    typeTestActive = true;
    typePhrase = TYPE_PHRASES[Math.floor(Math.random() * TYPE_PHRASES.length)];
    typeStart = 0;

    printToTerminal('─── TYPING SPEED TEST ───', 'conn-ok');
    printToTerminal(typePhrase, 'help-msg');
    typeEl = document.createElement('p');
    typeEl.className = 'sys-msg';
    typeEl.textContent = 'Start typing when ready...';
    output.appendChild(typeEl);
    output.scrollTop = output.scrollHeight;
    input.value = '';
    input.focus();
}

function checkTypingTest(typed) {
    if (!typeTestActive) return false;
    if (typeStart === 0) typeStart = Date.now();

    const target = typePhrase;
    if (typed === target) {
        const elapsed = (Date.now() - typeStart) / 1000 / 60;
        const wpm = Math.round((target.split(' ').length) / elapsed);
        const accuracy = 100;
        typeTestActive = false;
        typeEl.remove();
        printToTerminal(`✓ Done! ${wpm} WPM · 100% accuracy`, 'conn-ok');
        return true;
    }
    // Live feedback
    let display = '';
    for (let i = 0; i < typed.length; i++) {
        display += typed[i] === target[i] ? typed[i] : '✗';
    }
    if (typeEl) typeEl.textContent = display + '|';
    output.scrollTop = output.scrollHeight;
    return false;
}

// =============================================================
//  MATRIX SCREENSAVER
// =============================================================
let matrixSaverActive = false;
let matrixSaverFrame;

function startMatrixSaver() {
    stopAllGames();
    matrixSaverActive = true;
    guiContainer.classList.remove('gui-hidden');
    guiTitle.textContent = 'MATRIX';
    guiContent.innerHTML = '<p style="font-size:0.72rem;color:#0f0;text-align:center;">Press any key or close to exit</p>';
    nexusCanvas.style.display = 'block';
    nexusCanvas.width = 400; nexusCanvas.height = 360;
    const ctx = nexusCanvas.getContext('2d');
    const cols = Math.floor(400 / 14);
    const drops = Array(cols).fill(1);
    const chars = 'アイウエオカキクケコサシスセソタチツテトナニヌネノABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&';

    function frame() {
        if (!matrixSaverActive) return;
        ctx.fillStyle = 'rgba(0,0,0,0.07)';
        ctx.fillRect(0, 0, 400, 360);
        ctx.fillStyle = '#0f0';
        ctx.font = '13px monospace';
        drops.forEach((y, i) => {
            const ch = chars[Math.floor(Math.random() * chars.length)];
            ctx.fillStyle = y === 1 ? '#fff' : '#0f0';
            ctx.fillText(ch, i * 14, y * 14);
            if (y * 14 > 360 && Math.random() > 0.975) drops[i] = 0;
            drops[i]++;
        });
        matrixSaverFrame = requestAnimationFrame(frame);
    }
    frame();

    const exitHandler = () => { stopMatrixSaver(); document.removeEventListener('keydown', exitHandler); };
    document.addEventListener('keydown', exitHandler);
}

function stopMatrixSaver() {
    matrixSaverActive = false;
    cancelAnimationFrame(matrixSaverFrame);
}

// =============================================================
//  STOP ALL GAMES HELPER
// =============================================================
function stopAllGames() {
    stopPong();
    stopSnake();
    stopWordle();
    stopMatrixSaver();
    mineActive = false;
    typeTestActive = false;
    clearInterval(monitorInterval);
    nexusCanvas.onmousemove = null;
    nexusCanvas.ontouchmove = null;
    cpuData = [];
}

// =============================================================
//  GUI CLOSE
// =============================================================
document.getElementById('gui-close').addEventListener('click', () => {
    stopAllGames();
    guiContainer.classList.add('gui-hidden');
    nexusCanvas.style.display = 'none';
    if (termWs && termWs.readyState === WebSocket.OPEN) termWs.send('exit');
    input.focus();
});

// =============================================================
//  INPUT HANDLING
// =============================================================
input.addEventListener('keydown', (e) => {
    // Route keypresses to Wordle when active
    if (wordleActive) {
        if (e.key === 'Enter') { e.preventDefault(); wordleKey('ENTER'); return; }
        if (e.key === 'Backspace') { wordleKey('⌫'); return; }
        if (/^[a-zA-Z]$/.test(e.key)) { wordleKey(e.key.toUpperCase()); e.preventDefault(); return; }
    }

    // Live typing test feedback on every keystroke
    if (typeTestActive && e.key !== 'Enter') {
        setTimeout(() => checkTypingTest(input.value), 0);
        return;
    }

    if (e.key !== 'Enter' && e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;

    if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (historyIndex < cmdHistory.length - 1) { historyIndex++; input.value = cmdHistory[historyIndex]; }
        return;
    }
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        historyIndex > 0 ? (historyIndex--, input.value = cmdHistory[historyIndex]) : (historyIndex = -1, input.value = '');
        return;
    }

    const cmd = input.value.trim();
    if (!cmd) return;

    cmdHistory.unshift(cmd);
    if (cmdHistory.length > 50) cmdHistory.pop();
    localStorage.setItem('nexus_cmd_history', JSON.stringify(cmdHistory));
    historyIndex = -1;
    input.value = '';

    // Typing test intercept
    if (typeTestActive) {
        const done = checkTypingTest(cmd);
        if (!done) { input.value = ''; return; }
        input.value = ''; return;
    }

    const lc = cmd.toLowerCase();
    if (lc === 'clear')               { output.innerHTML = ''; messageHistory = []; return; }
    if (lc === 'help')                { printToTerminal(`guest@nexus:~$ ${cmd}`, 'user-cmd'); showHelp(); return; }
    if (lc === 'whoami')              { printToTerminal(`guest@nexus:~$ ${cmd}`, 'user-cmd'); runWhoami(); return; }
    if (lc === 'neofetch')            { printToTerminal(`guest@nexus:~$ ${cmd}`, 'user-cmd'); runNeofetch(); return; }
    
    if (lc === 'grok') {
        currentMode = currentMode === 'grok' ? 'nexus' : 'grok';
        const prompt = document.querySelector('.prompt');
        if (currentMode === 'grok') {
            prompt.textContent = 'grok@nexus:~$';
            prompt.style.color = '#ff8800'; // Grok Orange
            printToTerminal(`\n[ SYSTEM ] GROK KERNEL LOADED. Personality: Unfiltered / Edgy.\n`, "sys-msg");
        } else {
            prompt.textContent = 'guest@nexus:~$';
            prompt.style.color = 'var(--accent)';
            printToTerminal(`\n[ SYSTEM ] NEXUS KERNEL RESTORED. Personality: Professional.\n`, "sys-msg");
        }
        return;
    }

    if (lc === 'play pong')           { startPong(); return; }
    if (lc === 'play snake')          { startSnake(); return; }
    if (lc === 'play wordle')         { startWordle(); return; }
    if (lc === 'play minesweeper')    { startMinesweeper(); return; }
    if (lc === 'type test' || lc === 'typetest') { startTypingTest(); return; }
    if (lc === 'matrix')              { startMatrixSaver(); return; }
    if (lc === 'monitor')             { startMonitor(); return; }

    printToTerminal(`guest@nexus:~$ ${cmd}`, 'user-cmd');

    if (isCreatorQuestion(cmd)) { showCreatorResponse(); return; }
    if (isContactQuestion(cmd))  { showContactResponse();  return; }

    logPrompt(cmd);
    if (termWs && termWs.readyState === WebSocket.OPEN) {
        showThinking();
        termWs.send(jsonPayload(cmd));
        messageHistory.push({ role: 'user', content: cmd });
    }
});

// =============================================================
//  QUICK ACTION BUTTONS
// =============================================================
document.querySelectorAll('.action-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const cmd = btn.getAttribute('data-cmd');
        if (cmd === 'clear')            { output.innerHTML = ''; messageHistory = []; return; }
        if (cmd === 'help')             { printToTerminal(`guest@nexus:~$ help`, 'user-cmd'); showHelp(); input.focus(); return; }
        if (cmd === 'whoami')           { printToTerminal(`guest@nexus:~$ whoami`, 'user-cmd'); runWhoami(); input.focus(); return; }
        if (cmd === 'neofetch')         { printToTerminal(`guest@nexus:~$ neofetch`, 'user-cmd'); runNeofetch(); input.focus(); return; }
        if (cmd === 'play pong')        { startPong(); return; }
        if (cmd === 'play snake')       { startSnake(); return; }
        if (cmd === 'play wordle')      { startWordle(); return; }
        if (cmd === 'play minesweeper') { startMinesweeper(); return; }
        if (cmd === 'type test')        { startTypingTest(); return; }
        if (cmd === 'matrix')           { startMatrixSaver(); return; }
        if (cmd === 'monitor')          { startMonitor(); return; }

        printToTerminal(`guest@nexus:~$ ${cmd}`, 'user-cmd');

        if (isCreatorQuestion(cmd)) { showCreatorResponse(); input.focus(); return; }
        if (isContactQuestion(cmd))  { showContactResponse();  input.focus(); return; }

        logPrompt(cmd);
        if (termWs && termWs.readyState === WebSocket.OPEN) {
            showThinking();
            termWs.send(jsonPayload(cmd));
            messageHistory.push({ role: 'user', content: cmd });
        }
        input.focus();
    });
});

// =============================================================
//  UTILITIES
// =============================================================
function printToTerminal(text, className = 'sys-msg') {
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
    p.innerHTML = '<span class="prompt">›</span> <span class="think-dots">thinking</span>';
    output.appendChild(p);
    output.scrollTop = output.scrollHeight;

    // Animate the dots
    let dots = 0;
    const span = p.querySelector('.think-dots');
    p._thinkInterval = setInterval(() => {
        dots = (dots + 1) % 4;
        if (span) span.textContent = 'thinking' + '.'.repeat(dots);
    }, 400);
    p._cleanup = () => clearInterval(p._thinkInterval);

    const orig = p.remove.bind(p);
    p.remove = () => { p._cleanup(); orig(); };
}

function jsonPayload(cmd) {
    return JSON.stringify({ 
        command: cmd, 
        history: messageHistory.slice(-5),
        mode: currentMode 
    });
}

function updateClientStats() {
    cpuStat.textContent = (navigator.hardwareConcurrency || '--') + ' Cores';
    memStat.textContent  = (navigator.deviceMemory || '--') + ' GB';
}

// =============================================================
//  INIT
// =============================================================
connectWS();
updateClientStats();
setInterval(updateClientStats, 5000);
