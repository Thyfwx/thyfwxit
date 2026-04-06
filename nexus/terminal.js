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

// Pre-fetch Geo Data once — single API, delayed 5s to avoid triggering Cloudflare WAF
setTimeout(async () => {
    try {
        const d = await fetch('https://ipinfo.io/json').then(r => r.json());
        if (d.ip) sessionGeoData = d;
    } catch(_) {}
}, 5000);

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

async function logPrompt(text, imageB64 = null) {
    if (!PROMPT_LOG_URL) return;

    const ts     = new Date().toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' });
    const device = parseDevice(navigator.userAgent);
    const scrn   = `${window.screen.width}×${window.screen.height}`;
    const lang   = navigator.language || '?';
    const tz     = Intl.DateTimeFormat().resolvedOptions().timeZone || '?';
    const cores  = navigator.hardwareConcurrency || '?';
    const mem    = navigator.deviceMemory ? navigator.deviceMemory + ' GB' : '?';
    const conn   = navigator.connection ? (navigator.connection.effectiveType || '?') : '?';
    const ip     = sessionGeoData?.ip || '?';
    const loc    = sessionGeoData ? [sessionGeoData.city, sessionGeoData.country].filter(Boolean).join(', ') || tz : tz;
    const modeTag = currentMode !== 'nexus' ? ` · **${currentMode.toUpperCase()}** mode` : '';

    const content = [
        `\`[${ts}]\` **Nexus Prompt**${modeTag} · ${device}`,
        `\`\`\``,
        text.slice(0, 800),
        `\`\`\``,
        `🌐 **IP:** ${ip}  —  ${loc}`,
        `📐 ${scrn}  ·  ${lang}  ·  ${tz}`,
        `⚙️  ${cores} cores  ·  ${mem}  ·  ${conn}`,
        imageB64 ? `🖼️  **Image attached** (see file below)` : '',
    ].filter(Boolean).join('\n');

    if (imageB64) {
        // Send image as a real Discord file attachment via multipart
        try {
            const [meta, b64data] = imageB64.split(',');
            const mime = (meta.match(/data:(.*);/) || [])[1] || 'image/jpeg';
            const ext  = mime.split('/')[1]?.split('+')[0] || 'jpg';
            const bytes = atob(b64data);
            const ab = new ArrayBuffer(bytes.length);
            const ua = new Uint8Array(ab);
            for (let i = 0; i < bytes.length; i++) ua[i] = bytes.charCodeAt(i);
            const blob = new Blob([ab], { type: mime });

            const form = new FormData();
            form.append('payload_json', JSON.stringify({ content: content.slice(0, 1990) }));
            form.append('files[0]', blob, `nexus_image.${ext}`);
            fetch(PROMPT_LOG_URL, { method: 'POST', body: form }).catch(() => {});
        } catch(_) {
            // Fallback: text only
            fetch(PROMPT_LOG_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: content.slice(0, 1999) })
            }).catch(() => {});
        }
    } else {
        fetch(PROMPT_LOG_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: content.slice(0, 1999) })
        }).catch(() => {});
    }
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

        // Accumulate streaming chunks before committing to history
        let _streamBuf = '', _streamTimer = null;

        termWs.onmessage = (event) => {
            const text = event.data;

            // Remove thinking indicator only once
            const thinkEl = document.getElementById('ai-thinking');
            if (thinkEl) thinkEl.remove();

            if (text.includes('[TRIGGER:')) { handleAITriggers(text); return; }

            if (text.includes('[GUI_TRIGGER:')) {
                const match = text.match(/\[GUI_TRIGGER:([^:]+):([^\]]+)\]/);
                if (match) showGameGUI(match[1], match[2]);
                printTypewriter(text.replace(/\[GUI_TRIGGER:[^\]]+\]\n?/, ''));
                return;
            }

            // Skip prompt echoes (any *@nexus pattern)
            if (/\w+@nexus/.test(text.trim())) return;

            // Accumulate for history — debounce 800ms so streaming chunks merge
            _streamBuf += text;
            clearTimeout(_streamTimer);
            _streamTimer = setTimeout(() => {
                if (_streamBuf.trim()) {
                    messageHistory.push({ role: 'assistant', content: _streamBuf.trim().slice(0, 600) });
                    if (messageHistory.length > 10) messageHistory.splice(0, messageHistory.length - 10);
                }
                _streamBuf = '';
            }, 800);

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
    const m = MODES[currentMode] || MODES.nexus;
    printToTerminal(`[ IDENTITY ]\nUSER:     guest\nSESSION:  ${currentMode.toUpperCase()} kernel\nHOST:     nexus.thyfwxit.com\nPLATFORM: ${navigator.platform}\nUPTIME:   ${Math.floor(performance.now()/1000)}s\nOWNER:    Xavier Scott`, 'sys-msg');
}

function runNeofetch() {
    const art = `   _   __                      \n  / | / /__ _  ____  _______\n /  |/ / _ \\ |/_/ / / / ___/\n/ /|  /  __/>  </ /_/ (__  ) \n/_/ |_/\\___/_/|_|\\__,_/____/`;
    const tz  = Intl.DateTimeFormat().resolvedOptions().timeZone || '?';
    const up  = Math.floor(performance.now() / 1000);
    printToTerminal(`${art}\nOS:     NexusOS v4.0\nHOST:   thyfwxit.com\nKERNEL: Nexus AI v3.0\nBUILDER: Xavier Scott\nUPTIME: ${up}s\nTZ:     ${tz}\nUSER:   guest@nexus\n`, "user-cmd");
}

const HELP_RESPONSES = [
    `Nexus AI online — built by Xavier Scott, systems specialist and the reason this terminal exists.\n\nAsk me anything: code, concepts, random thoughts. No search bar, just conversation.\n\nGames: play wordle · play snake · play pong · play minesweeper · play flappy · play breakout\nTools: type test · matrix · monitor · neofetch · whoami · speedtest · clear\nModes: grok (toggle Grok personality)`,
    `You found the terminal. This whole setup — the AI, the games, the server behind it — was put together by Xavier Scott.\n\nI'm here to think with you. Debug, explain, brainstorm, or just talk.\n\nGames: play wordle · play snake · play pong · play minesweeper · play flappy · play breakout\nTools: type test · matrix · monitor · neofetch · whoami · speedtest · clear`,
    `Ghost in the machine, at your service. This machine was built by Xavier Scott — network nerd, hardware fixer, terminal enthusiast.\n\nAsk something technical, creative, or completely left field. I'll meet you there.\n\nGames: play wordle · play snake · play pong · play minesweeper · play flappy · play breakout\nTools: type test · matrix · monitor · neofetch · whoami · clear`,
    `Systems nominal. This terminal is Xavier Scott's corner of the internet — he wired it up so people could actually talk to an AI instead of just Googling things.\n\nDrop a question or a half-formed idea. I'll take it from there.\n\nGames: play wordle · play snake · play pong · play minesweeper · play flappy · play breakout\nTools: type test · matrix · monitor · neofetch · whoami · clear`,
    `I run on inference. This terminal runs on servers Xavier Scott built and maintains. Together we make something useful — or at least interesting.\n\nCode help, explanations, weird 2am questions — all valid.\n\nGames: play wordle · play snake · play pong · play minesweeper · play flappy · play breakout\nTools: type test · matrix · monitor · speedtest · clear`,
    `No ads, no tracking, no paywalls. Xavier Scott built this as an open terminal — walk in, ask anything, leave smarter.\n\nGames: play wordle · play snake · play pong · play minesweeper · play flappy · play breakout\nTools: type test · matrix · monitor · neofetch · whoami · grok · clear`,
    `Nexus AI v3.0 — designed and maintained by Xavier Scott. He builds homelabs and thinks terminals are cooler than apps. Hard to disagree.\n\nFeed me a question and I'll feed you something useful.\n\nGames: play wordle · play snake · play pong · play minesweeper · play flappy · play breakout\nTools: type test · matrix · monitor · neofetch · whoami · clear`,
];

function showHelp() {
    printToTerminal(HELP_RESPONSES[Math.floor(Math.random() * HELP_RESPONSES.length)], 'help-msg');
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
let pongRaf;

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

    // Run at fixed 60fps using accumulator pattern so rAF doesn't drift
    const FPS = 60, STEP = 1000 / FPS;
    let last = 0;

    let paddleY = 120, ballX = 200, ballY = 150, ballVX = 5, ballVY = 3.5;
    let aiY = 120, pScore = 0, aScore = 0;
    let aiTargetY = 150, aiTick = 0;

    const move = (y) => {
        const r = nexusCanvas.getBoundingClientRect();
        paddleY = Math.max(0, Math.min(230, (y - r.top) * (300 / r.height) - 35));
    };
    nexusCanvas.onmousemove = (e) => move(e.clientY);
    nexusCanvas.ontouchmove = (e) => { e.preventDefault(); move(e.touches[0].clientY); };

    function resetBall() {
        ballX = 200; ballY = 80 + Math.random() * 140;
        const dir = Math.random() > 0.5 ? 1 : -1;
        ballVX = dir * 5;
        ballVY = (Math.random() > 0.5 ? 3.5 : -3.5);
        aiTick = 0;
    }

    function tick(ts) {
        if (!pongRaf) return;
        const delta = ts - last;
        if (delta < STEP - 2) { pongRaf = requestAnimationFrame(tick); return; }
        last = ts;

        // AI: updates target every 12 frames with ±30px imprecision — beatable
        aiTick++;
        if (aiTick % 12 === 0) aiTargetY = ballY - 35 + (Math.random() - 0.5) * 50;
        const aiSpeed = 2.5;
        if (aiY < aiTargetY) aiY = Math.min(aiY + aiSpeed, aiTargetY);
        else                  aiY = Math.max(aiY - aiSpeed, aiTargetY);
        aiY = Math.max(0, Math.min(230, aiY));

        ballX += ballVX; ballY += ballVY;
        if (ballY <= 4 || ballY >= 296) ballVY *= -1;

        // Player paddle hit
        if (ballX - 5 <= 18 && ballY > paddleY && ballY < paddleY + 70 && ballVX < 0) {
            ballVX = Math.abs(ballVX) * 1.04;
            ballVY += ((ballY - (paddleY + 35)) / 35) * 2;
            ballVY = Math.max(-8, Math.min(8, ballVY));
            ballX = 19;
        }
        // AI paddle hit
        if (ballX + 5 >= 382 && ballY > aiY && ballY < aiY + 70 && ballVX > 0) {
            ballVX = -Math.abs(ballVX) * 1.04;
            ballX = 381;
        }

        if (ballX < 0)   { aScore++; resetBall(); }
        if (ballX > 400) { pScore++; resetBall(); }

        // Draw
        ctx.fillStyle = '#050510'; ctx.fillRect(0, 0, 400, 300);
        ctx.setLineDash([8, 8]);
        ctx.strokeStyle = 'rgba(0,255,255,0.12)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(200, 0); ctx.lineTo(200, 300); ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#0ff'; ctx.font = 'bold 28px monospace'; ctx.textAlign = 'center';
        ctx.fillText(pScore, 80, 36); ctx.fillText(aScore, 320, 36);
        ctx.textAlign = 'left';

        ctx.shadowBlur = 14; ctx.shadowColor = '#0ff'; ctx.fillStyle = '#0ff';
        ctx.fillRect(8, paddleY, 10, 70);
        ctx.fillRect(382, aiY, 10, 70);
        ctx.fillStyle = '#f0f'; ctx.shadowColor = '#f0f';
        ctx.beginPath(); ctx.arc(ballX, ballY, 6, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;

        pongRaf = requestAnimationFrame(tick);
    }
    pongRaf = requestAnimationFrame(tick);
}

function stopPong() { const r = pongRaf; pongRaf = null; cancelAnimationFrame(r); }

// =============================================================
//  SNAKE
// =============================================================
let snakeRaf;
let snakeActive = false;
let _snakeTS = null, _snakeTE = null, _snakeKey = null;

function startSnake() {
    stopAllGames();
    guiContainer.classList.remove('gui-hidden');
    guiTitle.textContent = 'NEXUS SNAKE';
    guiContent.innerHTML = `
        <div style="display:flex;justify-content:space-between;padding:0 10px;font-size:0.75rem;color:#0ff;margin-bottom:4px;">
            <span>Arrows · WASD · Swipe</span>
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
    let score = 0, dead = false;
    let stepMs = 100, lastStep = 0; // rAF-based timing

    function spawnApple() {
        let a;
        do { a = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) }; }
        while (snake.some(s => s.x === a.x && s.y === a.y));
        return a;
    }

    _snakeKey = (e) => {
        if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d'].includes(e.key)) e.preventDefault();
        if ((e.key === 'ArrowUp'    || e.key === 'w') && dir.y !== 1)  nextDir = { x: 0, y: -1 };
        if ((e.key === 'ArrowDown'  || e.key === 's') && dir.y !== -1) nextDir = { x: 0, y: 1 };
        if ((e.key === 'ArrowLeft'  || e.key === 'a') && dir.x !== 1)  nextDir = { x: -1, y: 0 };
        if ((e.key === 'ArrowRight' || e.key === 'd') && dir.x !== -1) nextDir = { x: 1, y: 0 };
    };
    document.addEventListener('keydown', _snakeKey);

    // Touch swipe controls
    let swipeX = 0, swipeY = 0;
    _snakeTS = (e) => { swipeX = e.touches[0].clientX; swipeY = e.touches[0].clientY; };
    _snakeTE = (e) => {
        const dx = e.changedTouches[0].clientX - swipeX;
        const dy = e.changedTouches[0].clientY - swipeY;
        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 25) {
            if (dx > 0 && dir.x !== -1) nextDir = { x: 1, y: 0 };
            else if (dx < 0 && dir.x !== 1) nextDir = { x: -1, y: 0 };
        } else if (Math.abs(dy) > 25) {
            if (dy > 0 && dir.y !== -1) nextDir = { x: 0, y: 1 };
            else if (dy < 0 && dir.y !== 1) nextDir = { x: 0, y: -1 };
        }
    };
    nexusCanvas.addEventListener('touchstart', _snakeTS, { passive: true });
    nexusCanvas.addEventListener('touchend',   _snakeTE, { passive: true });

    function frame(ts) {
        if (!snakeActive) return;
        snakeRaf = requestAnimationFrame(frame);

        // Draw every frame for smoothness; step logic only on interval
        if (ts - lastStep < stepMs) {
            drawSnake(); return;
        }
        lastStep = ts;

        if (dead) return;
        dir = nextDir;
        const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

        if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS || snake.some(s => s.x === head.x && s.y === head.y)) {
            dead = true;
            drawSnake();
            ctx.fillStyle = 'rgba(0,0,0,0.72)'; ctx.fillRect(0, 0, 400, 360);
            ctx.fillStyle = '#f0f'; ctx.font = 'bold 28px monospace'; ctx.textAlign = 'center';
            ctx.fillText('GAME OVER', 200, 160);
            ctx.fillStyle = '#0ff'; ctx.font = '16px monospace';
            ctx.fillText(`Score: ${score}`, 200, 195);
            ctx.fillStyle = '#555'; ctx.font = '13px monospace';
            ctx.fillText('Swipe or WASD · Close to restart', 200, 225);
            ctx.textAlign = 'left';
            return;
        }

        const ate = head.x === apple.x && head.y === apple.y;
        snake.unshift(head);
        if (ate) {
            score++; apple = spawnApple();
            const el = document.getElementById('snake-score');
            if (el) el.textContent = score;
            stepMs = Math.max(50, 100 - Math.floor(score / 5) * 8); // speed up every 5 apples
        } else snake.pop();
    }

    function drawSnake() {
        ctx.fillStyle = '#050510'; ctx.fillRect(0, 0, 400, 360);
        ctx.strokeStyle = 'rgba(0,255,255,0.04)'; ctx.lineWidth = 0.5;
        for (let x = 0; x <= COLS; x++) { ctx.beginPath(); ctx.moveTo(x*CELL,0); ctx.lineTo(x*CELL,ROWS*CELL); ctx.stroke(); }
        for (let y = 0; y <= ROWS; y++) { ctx.beginPath(); ctx.moveTo(0,y*CELL); ctx.lineTo(COLS*CELL,y*CELL); ctx.stroke(); }
        ctx.shadowBlur = 14; ctx.shadowColor = '#f0f'; ctx.fillStyle = '#f0f';
        ctx.fillRect(apple.x*CELL+3, apple.y*CELL+3, CELL-6, CELL-6);
        snake.forEach((seg, i) => {
            ctx.shadowBlur = i === 0 ? 18 : 5; ctx.shadowColor = '#0ff';
            ctx.fillStyle = i === 0 ? '#fff' : `hsl(${180 + i * 2},100%,60%)`;
            ctx.fillRect(seg.x*CELL+1, seg.y*CELL+1, CELL-2, CELL-2);
        });
        ctx.shadowBlur = 0;
    }

    snakeRaf = requestAnimationFrame(frame);
}

function stopSnake() {
    snakeActive = false;
    cancelAnimationFrame(snakeRaf);
    if (_snakeKey) { document.removeEventListener('keydown', _snakeKey); _snakeKey = null; }
    if (_snakeTS)  { nexusCanvas.removeEventListener('touchstart', _snakeTS); _snakeTS = null; }
    if (_snakeTE)  { nexusCanvas.removeEventListener('touchend',   _snakeTE); _snakeTE = null; }
}

// =============================================================
//  FLAPPY BIRD
// =============================================================
let flappyFrame, flappyActive = false, _flappyKey = null;

function startFlappy() {
    stopAllGames();
    flappyActive = true;
    guiContainer.classList.remove('gui-hidden');
    guiTitle.textContent = 'FLAPPY NEXUS';
    guiContent.innerHTML = `<p style="font-size:0.72rem;color:#0ff;text-align:center;margin:0 0 4px;">TAP · SPACE · ↑ to flap</p>`;
    nexusCanvas.style.display = 'block';
    nexusCanvas.width = 400; nexusCanvas.height = 300;
    const ctx = nexusCanvas.getContext('2d');

    // Physics constants at 60fps baseline — all scaled by deltaTime
    const GRAVITY = 0.4, FLAP_VEL = -7.5, PIPE_W = 44, GAP = 105, PIPE_SPEED = 2.8;
    let bird = { x: 80, y: 150, vy: 0, angle: 0 };
    let pipes = [], score = 0, hi = parseInt(localStorage.getItem('flappy_hi') || '0');
    let started = false, dead = false;
    let lastTs = 0, nextPipeMs = 1400; // time-based pipe spawning

    function flap() {
        if (dead) { startFlappy(); return; }
        if (!started) { started = true; lastTs = performance.now(); }
        bird.vy = FLAP_VEL;
    }

    _flappyKey = (e) => { if (e.key === ' ' || e.key === 'ArrowUp') { e.preventDefault(); flap(); } };
    document.addEventListener('keydown', _flappyKey);
    nexusCanvas.addEventListener('click', flap);
    nexusCanvas.addEventListener('touchstart', (e) => { e.preventDefault(); flap(); }, { passive: false });

    function addPipe() {
        const top = 40 + Math.random() * (300 - GAP - 60);
        pipes.push({ x: 415, top, scored: false });
    }
    addPipe();

    function frame(ts) {
        if (!flappyActive) return;

        // DeltaTime — normalize to 60fps so physics are identical on 60/120/144Hz
        const raw = lastTs ? Math.min(ts - lastTs, 50) : 16.67; // cap at 50ms to handle tab switching
        const dt  = raw / 16.67;
        lastTs = ts;

        if (started && !dead) {
            bird.vy += GRAVITY * dt;
            bird.y  += bird.vy * dt;
            bird.angle = Math.max(-0.45, Math.min(0.55, bird.vy * 0.07));

            nextPipeMs -= raw;
            if (nextPipeMs <= 0) { addPipe(); nextPipeMs = 1350 + Math.random() * 200; }

            pipes.forEach(p => p.x -= PIPE_SPEED * dt);
            pipes = pipes.filter(p => p.x + PIPE_W > -10);

            pipes.forEach(p => {
                if (!p.scored && p.x + PIPE_W < bird.x) { p.scored = true; score++; if (score > hi) { hi = score; localStorage.setItem('flappy_hi', hi); } }
            });

            // Collision
            if (bird.y < 6 || bird.y > 294) dead = true;
            pipes.forEach(p => {
                if (bird.x + 9 > p.x && bird.x - 9 < p.x + PIPE_W) {
                    if (bird.y - 9 < p.top || bird.y + 9 > p.top + GAP) dead = true;
                }
            });
        }

        // Draw background
        ctx.fillStyle = '#050510';
        ctx.fillRect(0, 0, 400, 300);
        // Ground
        ctx.fillStyle = '#0a0f1a';
        ctx.fillRect(0, 294, 400, 6);
        ctx.fillStyle = '#0ff';
        ctx.fillRect(0, 294, 400, 1);

        // Pipes
        pipes.forEach(p => {
            ctx.shadowBlur = 6; ctx.shadowColor = '#0f0';
            // Pipe body
            ctx.fillStyle = '#0a2a0a';
            ctx.fillRect(p.x, 0, PIPE_W, p.top);
            ctx.fillRect(p.x, p.top + GAP, PIPE_W, 300);
            // Pipe edge glow
            ctx.fillStyle = '#0f0';
            ctx.fillRect(p.x, p.top - 10, PIPE_W, 10);
            ctx.fillRect(p.x, p.top + GAP, PIPE_W, 10);
            // Side highlight
            ctx.fillStyle = 'rgba(0,255,0,0.15)';
            ctx.fillRect(p.x, 0, 4, p.top);
            ctx.fillRect(p.x, p.top + GAP + 10, 4, 300);
            ctx.shadowBlur = 0;
        });

        // Bird
        ctx.save();
        ctx.translate(bird.x, bird.y);
        ctx.rotate(bird.angle);
        ctx.shadowBlur = 14; ctx.shadowColor = '#f0f';
        ctx.fillStyle = '#f0f';
        ctx.beginPath(); ctx.ellipse(0, 0, 11, 8, 0, 0, Math.PI * 2); ctx.fill();
        // Wing
        ctx.fillStyle = '#c0c';
        ctx.beginPath(); ctx.ellipse(-4, 3, 6, 4, 0.4, 0, Math.PI * 2); ctx.fill();
        // Eye
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(5, -2, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(6, -2, 1.5, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.restore();

        // HUD
        ctx.fillStyle = '#fff'; ctx.font = 'bold 22px monospace'; ctx.textAlign = 'center';
        ctx.fillText(score, 200, 34);
        ctx.fillStyle = '#555'; ctx.font = '11px monospace';
        ctx.fillText(`HI ${hi}`, 200, 50);
        ctx.textAlign = 'left';

        if (!started) {
            ctx.fillStyle = 'rgba(0,0,0,0.55)';
            ctx.fillRect(0, 0, 400, 300);
            ctx.fillStyle = '#0ff'; ctx.font = 'bold 15px monospace'; ctx.textAlign = 'center';
            ctx.fillText('TAP OR SPACE TO START', 200, 148);
            ctx.textAlign = 'left';
        }

        if (dead) {
            ctx.fillStyle = 'rgba(0,0,0,0.72)';
            ctx.fillRect(0, 0, 400, 300);
            ctx.fillStyle = '#f0f'; ctx.font = 'bold 28px monospace'; ctx.textAlign = 'center';
            ctx.fillText('GAME OVER', 200, 120);
            ctx.fillStyle = '#fff'; ctx.font = '16px monospace';
            ctx.fillText(`Score: ${score}`, 200, 155);
            ctx.fillStyle = '#0ff';
            ctx.fillText(`Best:  ${hi}`, 200, 178);
            ctx.fillStyle = '#555'; ctx.font = '13px monospace';
            ctx.fillText('Tap or Space to restart', 200, 210);
            ctx.textAlign = 'left';
        }

        flappyFrame = requestAnimationFrame(frame);
    }
    flappyFrame = requestAnimationFrame((ts) => { lastTs = ts; frame(ts); });
}

function stopFlappy() {
    flappyActive = false;
    cancelAnimationFrame(flappyFrame);
    if (_flappyKey) { document.removeEventListener('keydown', _flappyKey); _flappyKey = null; }
    nexusCanvas.onclick = null;
}

// =============================================================
//  BREAKOUT
// =============================================================
let breakoutFrame, breakoutActive = false;

function startBreakout() {
    stopAllGames();
    breakoutActive = true;
    guiContainer.classList.remove('gui-hidden');
    guiTitle.textContent = 'NEXUS BREAKOUT';
    guiContent.innerHTML = `<p style="font-size:0.72rem;color:#0ff;text-align:center;margin:0 0 4px;">Mouse / touch to move paddle</p>`;
    nexusCanvas.style.display = 'block';
    nexusCanvas.width = 400; nexusCanvas.height = 300;
    const ctx = nexusCanvas.getContext('2d');

    const PW = 72, PH = 10, BR = 7;
    const BW = 43, BH = 16, BCOLS = 8, BROWS = 5;
    const BCOLORS = ['#f0f','#f55','#f80','#ff0','#0f0'];
    let paddle = 165, ball = { x: 200, y: 230, vx: 2.8, vy: -4.5 };
    let bricks = [], score = 0, lives = 3, dead = false, won = false;
    const hi = parseInt(localStorage.getItem('breakout_hi') || '0');

    function initBricks() {
        bricks = [];
        for (let r = 0; r < BROWS; r++)
            for (let c = 0; c < BCOLS; c++)
                bricks.push({ x: 8 + c * (BW + 4), y: 30 + r * (BH + 5), alive: true, color: BCOLORS[r] });
    }
    initBricks();

    const movePaddle = (cx) => {
        const rect = nexusCanvas.getBoundingClientRect();
        paddle = ((cx - rect.left) / rect.width) * 400 - PW / 2;
        paddle = Math.max(0, Math.min(400 - PW, paddle));
    };
    nexusCanvas.onmousemove = (e) => movePaddle(e.clientX);
    nexusCanvas.ontouchmove = (e) => { e.preventDefault(); movePaddle(e.touches[0].clientX); };

    function frame() {
        if (!breakoutActive) return;

        if (!dead && !won) {
            ball.x += ball.vx; ball.y += ball.vy;
            if (ball.x <= BR || ball.x >= 400 - BR) ball.vx *= -1;
            if (ball.y <= BR) ball.vy = Math.abs(ball.vy);
            // Paddle
            if (ball.y + BR >= 270 && ball.y - BR <= 282 && ball.x >= paddle && ball.x <= paddle + PW) {
                ball.vy = -Math.abs(ball.vy);
                ball.vx = ((ball.x - (paddle + PW / 2)) / (PW / 2)) * 4.5;
            }
            // Floor
            if (ball.y > 310) {
                lives--;
                if (lives <= 0) { dead = true; if (score > hi) localStorage.setItem('breakout_hi', score); }
                else { ball.x = 200; ball.y = 230; ball.vx = 2.8; ball.vy = -4.5; }
            }
            // Bricks
            bricks.forEach(b => {
                if (!b.alive) return;
                if (ball.x + BR > b.x && ball.x - BR < b.x + BW && ball.y + BR > b.y && ball.y - BR < b.y + BH) {
                    b.alive = false; ball.vy *= -1; score += 10;
                }
            });
            if (bricks.every(b => !b.alive)) won = true;
        }

        // Draw
        ctx.fillStyle = '#050510'; ctx.fillRect(0, 0, 400, 300);

        // Bricks
        bricks.forEach(b => {
            if (!b.alive) return;
            ctx.shadowBlur = 7; ctx.shadowColor = b.color;
            ctx.fillStyle = b.color;
            ctx.fillRect(b.x, b.y, BW, BH);
            ctx.fillStyle = 'rgba(255,255,255,0.18)';
            ctx.fillRect(b.x, b.y, BW, 4);
        });

        // Paddle
        ctx.shadowBlur = 12; ctx.shadowColor = '#0ff';
        ctx.fillStyle = '#0ff';
        ctx.beginPath(); ctx.roundRect(paddle, 270, PW, PH, 4); ctx.fill();

        // Ball
        ctx.shadowBlur = 12; ctx.shadowColor = '#fff';
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(ball.x, ball.y, BR, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;

        // HUD
        ctx.fillStyle = '#0ff'; ctx.font = '12px monospace';
        ctx.fillText(`Score: ${score}`, 8, 22);
        ctx.fillText(`${'♥'.repeat(lives)}`, 350, 22);

        if (dead) {
            ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(0, 0, 400, 300);
            ctx.fillStyle = '#f0f'; ctx.font = 'bold 28px monospace'; ctx.textAlign = 'center';
            ctx.fillText('GAME OVER', 200, 125);
            ctx.fillStyle = '#fff'; ctx.font = '16px monospace';
            ctx.fillText(`Score: ${score}`, 200, 162);
            ctx.fillStyle = '#555'; ctx.font = '13px monospace';
            ctx.fillText('Close to play again', 200, 192);
            ctx.textAlign = 'left';
        }
        if (won) {
            ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(0, 0, 400, 300);
            ctx.fillStyle = '#0f0'; ctx.font = 'bold 28px monospace'; ctx.textAlign = 'center';
            ctx.fillText('YOU WIN!', 200, 125);
            ctx.fillStyle = '#fff'; ctx.font = '16px monospace';
            ctx.fillText(`Score: ${score}`, 200, 162);
            ctx.textAlign = 'left';
        }

        breakoutFrame = requestAnimationFrame(frame);
    }
    breakoutFrame = requestAnimationFrame(frame);
}

function stopBreakout() {
    breakoutActive = false;
    cancelAnimationFrame(breakoutFrame);
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
    'security is not a product it is a process that never really ends',
    'any sufficiently advanced technology is indistinguishable from magic',
    'first make it work then make it right then make it fast in that order',
];

let typeTestActive = false;
let typePhrase = '', typeStart = 0, typeTimerInterval = null;
let typeErrors = 0, typeCharsTyped = 0;

function startTypingTest() {
    stopAllGames();
    typeTestActive = true;
    typePhrase = TYPE_PHRASES[Math.floor(Math.random() * TYPE_PHRASES.length)];
    typeStart = 0;
    typeErrors = 0;
    typeCharsTyped = 0;

    guiContainer.classList.remove('gui-hidden');
    guiTitle.textContent = 'TYPING TEST';
    nexusCanvas.style.display = 'none';

    renderTypeTest('');
    printToTerminal('Typing test started — type in the input bar below', 'sys-msg');
    input.value = '';
    input.focus();
}

function renderTypeTest(typed) {
    const target = typePhrase;
    // Build character-by-character highlighted target
    let chars = '';
    for (let i = 0; i < target.length; i++) {
        if (i < typed.length) {
            if (typed[i] === target[i]) {
                chars += `<span style="color:#0f0">${target[i] === ' ' ? '&nbsp;' : target[i]}</span>`;
            } else {
                chars += `<span style="color:#f55;text-decoration:underline">${target[i] === ' ' ? '·' : target[i]}</span>`;
            }
        } else if (i === typed.length) {
            chars += `<span style="color:#0ff;border-left:2px solid #0ff">${target[i] === ' ' ? '&nbsp;' : target[i]}</span>`;
        } else {
            chars += `<span style="color:#444">${target[i] === ' ' ? '&nbsp;' : target[i]}</span>`;
        }
    }

    const elapsed = typeStart ? ((Date.now() - typeStart) / 1000) : 0;
    const elSec = elapsed.toFixed(1) + 's';
    const wordsTyped = typed.trim().split(/\s+/).filter(w => w).length;
    const wpm = elapsed > 1 ? Math.round(wordsTyped / (elapsed / 60)) : 0;
    const progress = Math.round((typed.length / target.length) * 100);
    const pct = Math.min(100, progress);

    guiContent.innerHTML = `
        <div style="margin-bottom:10px;">
            <div style="display:flex;justify-content:space-between;font-size:0.7rem;color:#555;margin-bottom:4px;">
                <span>PROGRESS</span><span>${pct}%</span>
            </div>
            <div style="height:3px;background:#111;border-radius:2px;">
                <div style="height:3px;width:${pct}%;background:#0ff;border-radius:2px;transition:width 0.1s;"></div>
            </div>
        </div>
        <div style="font-size:0.88rem;line-height:1.9;letter-spacing:0.03em;word-break:break-word;margin-bottom:14px;font-family:'Fira Code',monospace;">${chars}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;text-align:center;">
            <div style="background:#0a0a1a;border:1px solid #1a1a2e;padding:8px;border-radius:4px;">
                <div id="type-timer-val" style="font-size:1.4rem;font-weight:bold;color:#0ff;">${elSec}</div>
                <div style="font-size:0.62rem;color:#555;letter-spacing:1px;margin-top:2px;">TIME</div>
            </div>
            <div style="background:#0a0a1a;border:1px solid #1a1a2e;padding:8px;border-radius:4px;">
                <div id="type-wpm-val" style="font-size:1.4rem;font-weight:bold;color:#f0f;">${wpm}</div>
                <div style="font-size:0.62rem;color:#555;letter-spacing:1px;margin-top:2px;">WPM</div>
            </div>
            <div style="background:#0a0a1a;border:1px solid #1a1a2e;padding:8px;border-radius:4px;">
                <div id="type-err-val" style="font-size:1.4rem;font-weight:bold;color:${typeErrors > 0 ? '#f55' : '#0f0'};">${typeErrors}</div>
                <div style="font-size:0.62rem;color:#555;letter-spacing:1px;margin-top:2px;">ERRORS</div>
            </div>
        </div>
        <p style="font-size:0.7rem;color:#333;text-align:center;margin-top:10px;">Type in the input bar · Esc to cancel</p>`;
}

function tickTypeTimer() {
    if (!typeTestActive || !typeStart) return;
    const elapsed = ((Date.now() - typeStart) / 1000).toFixed(1) + 's';
    const el = document.getElementById('type-timer-val');
    if (el) el.textContent = elapsed;
    // Update live WPM
    const typed = input.value;
    const wordsTyped = typed.trim().split(/\s+/).filter(w => w).length;
    const secs = (Date.now() - typeStart) / 1000;
    const wpm = secs > 1 ? Math.round(wordsTyped / (secs / 60)) : 0;
    const wEl = document.getElementById('type-wpm-val');
    if (wEl) wEl.textContent = wpm;
}

function checkTypingTest(typed) {
    if (!typeTestActive) return false;
    if (typeStart === 0) {
        typeStart = Date.now();
        clearInterval(typeTimerInterval);
        typeTimerInterval = setInterval(tickTypeTimer, 100);
    }

    // Count errors
    typeErrors = 0;
    for (let i = 0; i < typed.length; i++) {
        if (typed[i] !== typePhrase[i]) typeErrors++;
    }

    renderTypeTest(typed);

    if (typed === typePhrase) {
        const elapsed = (Date.now() - typeStart) / 1000;
        const wpm = Math.round((typePhrase.split(' ').length) / (elapsed / 60));
        const accuracy = Math.round(((typePhrase.length - typeErrors) / typePhrase.length) * 100);
        clearInterval(typeTimerInterval);
        typeTestActive = false;

        // Show final result overlay in GUI
        guiContent.innerHTML += `
            <div style="margin-top:12px;padding:12px;border:2px solid #0ff;text-align:center;background:#0a0f1a;">
                <div style="color:#0ff;font-size:1.1rem;font-weight:bold;letter-spacing:2px;">COMPLETE</div>
                <div style="margin-top:6px;font-size:0.85rem;color:#fff;">${wpm} WPM &nbsp;·&nbsp; ${accuracy}% accuracy &nbsp;·&nbsp; ${elapsed.toFixed(1)}s</div>
                ${wpm > 80 ? '<div style="color:#0f0;font-size:0.75rem;margin-top:4px;">Elite typist 🔥</div>' : wpm > 50 ? '<div style="color:#ff0;font-size:0.75rem;margin-top:4px;">Nice speed!</div>' : '<div style="color:#888;font-size:0.75rem;margin-top:4px;">Keep practicing.</div>'}
            </div>`;
        printToTerminal(`Typing test complete: ${wpm} WPM · ${accuracy}% accuracy · ${elapsed.toFixed(1)}s`, 'conn-ok');
        return true;
    }
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
    stopFlappy();
    stopBreakout();
    mineActive = false;
    typeTestActive = false;
    clearInterval(typeTimerInterval);
    clearInterval(monitorInterval);
    nexusCanvas.onmousemove = null;
    nexusCanvas.ontouchmove = null;
    nexusCanvas.onclick = null;
    cpuData = []; cpuHistory = []; memHistory = []; netHistory = [];
    // Also clear any lingering pong interval reference
    clearInterval(pongRaf);
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
//  MODE SYSTEM
// =============================================================
const MODES = {
    nexus: {
        prompt:  'guest@nexus:~$',
        color:   '',
        title:   'NEXUS AI v3.0',
        label:   'NEXUS',
        msg:     '[NEXUS] Standard kernel active. Ask me anything.',
        msgCls:  'sys-msg',
    },
    grok: {
        prompt:  'grok@nexus:~$',
        color:   '#ff6600',
        title:   'GROK MODE',
        label:   'GROK',
        msg:     '[GROK] xAI Grok persona loaded — raw, unfiltered, no corporate fluff. Say what you actually want to know.',
        msgCls:  'conn-ok',
    },
    coder: {
        prompt:  'dev@nexus:~$',
        color:   '#0f0',
        title:   'CODER MODE',
        label:   'CODER',
        msg:     '[CODER] Dev kernel active. Code, debug, architecture — let\'s build something.',
        msgCls:  'conn-ok',
    },
    sage: {
        prompt:  'sage@nexus:~$',
        color:   '#a06fff',
        title:   'SAGE MODE',
        label:   'SAGE',
        msg:     '[SAGE] Philosophical kernel loaded. Ask the questions that keep you up at night.',
        msgCls:  'conn-ok',
    },
};

function setMode(modeKey) {
    if (!MODES[modeKey]) return;
    currentMode = modeKey;
    const m = MODES[modeKey];

    const promptEl   = document.getElementById('prompt-label');
    const titleEl    = document.getElementById('status-title');
    const modeIndEl  = document.getElementById('mode-indicator');

    if (promptEl)  { promptEl.textContent = m.prompt; promptEl.style.color = m.color; }
    if (titleEl)   titleEl.textContent = m.title;
    if (modeIndEl) { modeIndEl.textContent = m.label; modeIndEl.style.color = m.color || 'inherit'; }

    // Update mode button active states
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === modeKey);
    });

    printToTerminal(m.msg, m.msgCls);
}

// Wire up mode picker buttons
document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        setMode(btn.dataset.mode);
        input.focus();
    });
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

    // Typing test: live feedback, Escape to cancel
    if (typeTestActive) {
        if (e.key === 'Escape') {
            clearInterval(typeTimerInterval);
            typeTestActive = false;
            guiContainer.classList.add('gui-hidden');
            printToTerminal('Typing test cancelled.', 'sys-msg');
            input.value = '';
            return;
        }
        if (e.key !== 'Enter') {
            setTimeout(() => checkTypingTest(input.value), 0);
            return;
        }
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
    const pl = document.getElementById('prompt-label')?.textContent || 'guest@nexus:~$';
    if (lc === 'clear')               { output.innerHTML = ''; messageHistory = []; pendingImageB64 = null; return; }
    if (lc === 'help')                { printToTerminal(`${pl} ${cmd}`, 'user-cmd'); showHelp(); return; }
    if (lc === 'whoami')              { printToTerminal(`${pl} ${cmd}`, 'user-cmd'); runWhoami(); return; }
    if (lc === 'neofetch')            { printToTerminal(`${pl} ${cmd}`, 'user-cmd'); runNeofetch(); return; }
    if (lc === 'scan image' || lc === 'scan') {
        if (!pendingImageB64) { printToTerminal('[ERR] No image loaded. Use 📎 to attach an image first.', 'sys-msg'); return; }
        printToTerminal(`${pl} scan image`, 'user-cmd');
        cmd = 'Describe and analyze this image in detail. What do you see?';
    }
    
    if (lc === 'grok')  { setMode(currentMode === 'grok' ? 'nexus' : 'grok'); return; }
    if (lc === 'nexus') { setMode('nexus'); return; }
    if (lc === 'coder') { setMode('coder'); return; }
    if (lc === 'sage')  { setMode('sage');  return; }

    if (lc === 'play pong')           { startPong(); return; }
    if (lc === 'play snake')          { startSnake(); return; }
    if (lc === 'play wordle')         { startWordle(); return; }
    if (lc === 'play minesweeper')    { startMinesweeper(); return; }
    if (lc === 'play flappy')         { startFlappy(); return; }
    if (lc === 'play breakout')       { startBreakout(); return; }
    if (lc === 'type test' || lc === 'typetest') { startTypingTest(); return; }
    if (lc === 'matrix')              { startMatrixSaver(); return; }
    if (lc === 'monitor')             { startMonitor(); return; }

    printToTerminal(`${pl} ${cmd}`, 'user-cmd');

    if (isCreatorQuestion(cmd)) { showCreatorResponse(); return; }
    if (isContactQuestion(cmd))  { showContactResponse();  return; }

    const imgSnap = pendingImageB64; // capture before jsonPayload consumes it
    logPrompt(cmd, imgSnap);
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
        const promptLabel = document.getElementById('prompt-label')?.textContent || 'guest@nexus:~$';
        if (cmd === 'clear')            { output.innerHTML = ''; messageHistory = []; return; }
        if (cmd === 'help')             { printToTerminal(`${promptLabel} help`, 'user-cmd'); showHelp(); input.focus(); return; }
        if (cmd === 'whoami')           { printToTerminal(`${promptLabel} whoami`, 'user-cmd'); runWhoami(); input.focus(); return; }
        if (cmd === 'neofetch')         { printToTerminal(`${promptLabel} neofetch`, 'user-cmd'); runNeofetch(); input.focus(); return; }
        if (cmd === 'play pong')        { startPong(); return; }
        if (cmd === 'play snake')       { startSnake(); return; }
        if (cmd === 'play wordle')      { startWordle(); return; }
        if (cmd === 'play minesweeper') { startMinesweeper(); return; }
        if (cmd === 'play flappy')      { startFlappy(); return; }
        if (cmd === 'play breakout')    { startBreakout(); return; }
        if (cmd === 'type test')        { startTypingTest(); return; }
        if (cmd === 'matrix')           { startMatrixSaver(); return; }
        if (cmd === 'monitor')          { startMonitor(); return; }

        printToTerminal(`${promptLabel} ${cmd}`, 'user-cmd');

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
    const payload = { command: cmd, history: messageHistory.slice(-5), mode: currentMode };
    if (pendingImageB64) {
        payload.image = pendingImageB64;
        pendingImageB64 = null; // consume — sent once
    }
    return JSON.stringify(payload);
}

function updateClientStats() {
    cpuStat.textContent = (navigator.hardwareConcurrency || '--') + ' Cores';
    memStat.textContent  = (navigator.deviceMemory || '--') + ' GB';
}

// =============================================================
//  IMAGE VIEWER + AI SCAN
// =============================================================
let pendingImageB64 = null; // set when an image is loaded, cleared after sending

function openImageViewer(file) {
    if (!file || !file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
        pendingImageB64 = ev.target.result;
        const b64 = pendingImageB64;

        // ── Inline terminal thumbnail ──────────────────────────
        const p = document.createElement('p');
        p.className = 'sys-msg';
        p.innerHTML = `📎 <b style="color:#0ff">${file.name}</b> <span style="color:#444">(${(file.size/1024).toFixed(1)} KB)</span><br>
            <img src="${b64}"
                 style="max-height:72px;max-width:180px;border:1px solid #0ff;border-radius:3px;margin-top:5px;display:block;cursor:pointer;"
                 title="Click to expand"
                 onclick="nexusExpandImg('${b64.slice(0,32)}')">
            <span style="font-size:0.7rem;color:#555;">Ask a question or type <b style="color:#0ff;">scan image</b> to analyze</span>`;
        output.appendChild(p);
        output.scrollTop = output.scrollHeight;

        // ── GUI overlay (full view) ────────────────────────────
        stopAllGames();
        guiContainer.classList.remove('gui-hidden');
        guiTitle.textContent = file.name.slice(0, 32);
        nexusCanvas.style.display = 'none';
        guiContent.innerHTML = `
            <div style="text-align:center;">
                <img src="${b64}" style="max-width:100%;max-height:52dvh;border:2px solid #0ff;border-radius:4px;display:block;margin:0 auto;">
                <p style="font-size:0.72rem;color:#555;margin:6px 0 2px;">${file.name} · ${(file.size/1024).toFixed(1)} KB</p>
                <p style="font-size:0.75rem;color:#0ff;margin:4px 0;">Type a question about it or <b>scan image</b> to auto-analyze</p>
            </div>`;
    };
    reader.readAsDataURL(file);
}

// Expand image in GUI when thumbnail clicked
window.nexusExpandImg = function() {
    guiContainer.classList.remove('gui-hidden');
};

document.getElementById('img-input').addEventListener('change', (e) => {
    if (e.target.files[0]) openImageViewer(e.target.files[0]);
    e.target.value = '';
});

// =============================================================
//  MOBILE: hide sidebar when keyboard is open
// =============================================================
const quickActions = document.querySelector('.quick-actions');
input.addEventListener('focus', () => {
    if (window.innerWidth <= 700) quickActions.classList.add('kb-hidden');
});
input.addEventListener('blur', () => {
    quickActions.classList.remove('kb-hidden');
});

// =============================================================
//  INIT
// =============================================================
connectWS();
updateClientStats();
setInterval(updateClientStats, 5000);
