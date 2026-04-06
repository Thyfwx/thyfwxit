// =============================================================
//  NEXUS TERMINAL v4.0
// =============================================================

// --- Config ---
const WS_URL = `wss://nexus-terminalnexus.onrender.com/ws/terminal`;

// Paste your Discord webhook URL here to log visitor prompts.
// Leave empty to disable. Create one: Server Settings → Integrations → Webhooks
const PROMPT_LOG_URL = '';

// --- State ---
let termWs;
let messageHistory = [];
let cmdHistory = JSON.parse(localStorage.getItem('nexus_cmd_history') || '[]');
let historyIndex = -1;

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

// =============================================================
//  PROMPT LOGGING (Data Collection)
// =============================================================
function logPrompt(text) {
    if (!PROMPT_LOG_URL) return;
    const ts = new Date().toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' });
    fetch(PROMPT_LOG_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            content: `\`[${ts}]\` **Nexus Prompt:**\n\`\`\`\n${text.slice(0, 1800)}\n\`\`\``
        })
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
//  HELP RESPONSES (randomized)
// =============================================================
const HELP_RESPONSES = [
    `Nexus AI online.\n\nAsk me anything — code questions, random thoughts, ideas you can't explain. No search bar. Just conversation.\n\nGames: play wordle · play snake · play pong\nTools: monitor · speedtest · clear`,
    `You found the terminal. Good instinct.\n\nI'm here to think with you — debug, explain, brainstorm, or just chat.\n\nGames: play wordle · play snake · play pong\nTools: monitor · speedtest · clear`,
    `Ghost in the machine, at your service.\n\nAsk something technical, creative, or completely left field — I'll meet you there.\n\nGames: play wordle · play snake · play pong\nTools: monitor · speedtest · clear`,
    `Systems nominal. Neural pathways hot.\n\nDrop a question, a problem, or a half-formed idea. I'll take it from there.\n\nGames: play wordle · play snake · play pong\nTools: monitor · speedtest · clear`,
    `I run on inference, not caffeine — but the output's similar.\n\nCode help, explanations, brainstorming, or something weird at 2am — all valid.\n\nGames: play wordle · play snake · play pong\nTools: monitor · speedtest · clear`,
    `No search engine. No ads. Just raw conversation with an AI that actually responds.\n\nGames: play wordle · play snake · play pong\nTools: monitor · speedtest · clear`,
    `Nexus AI v3.0 — open to everyone, no login required.\n\nFeed me a question and I'll feed you something useful. Or at least interesting.\n\nGames: play wordle · play snake · play pong\nTools: monitor · speedtest · clear`,
];

function showHelp() {
    printToTerminal(HELP_RESPONSES[Math.floor(Math.random() * HELP_RESPONSES.length)], 'help-msg');
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
    guiTitle.textContent = 'SYSTEM MONITOR';
    guiContent.innerHTML = `
        <div style="display:flex;gap:20px;justify-content:center;margin-bottom:8px;font-size:0.75rem;color:#0ff;">
            <span>● LIVE CPU TELEMETRY</span>
            <span id="mon-val">0%</span>
        </div>`;
    nexusCanvas.style.display = 'block';
    nexusCanvas.width = 400; nexusCanvas.height = 220;
    const ctx = nexusCanvas.getContext('2d');

    clearInterval(monitorInterval);
    monitorInterval = setInterval(() => {
        const val = 20 + Math.random() * 40;
        cpuData.push(val);
        if (cpuData.length > 40) cpuData.shift();
        document.getElementById('mon-val').textContent = val.toFixed(1) + '%';

        ctx.fillStyle = '#050510';
        ctx.fillRect(0, 0, 400, 220);

        ctx.strokeStyle = 'rgba(0,255,255,0.08)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i < 400; i += 40) { ctx.moveTo(i, 0); ctx.lineTo(i, 220); }
        for (let i = 0; i < 220; i += 40) { ctx.moveTo(0, i); ctx.lineTo(400, i); }
        ctx.stroke();

        ctx.strokeStyle = '#0ff';
        ctx.lineWidth = 2;
        ctx.shadowBlur = 8; ctx.shadowColor = '#0ff';
        ctx.beginPath();
        cpuData.forEach((d, i) => {
            const x = (i / 40) * 400;
            const y = 200 - (d * 3.5);
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        ctx.stroke();
        ctx.shadowBlur = 0;
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
//  STOP ALL GAMES HELPER
// =============================================================
function stopAllGames() {
    stopPong();
    stopSnake();
    stopWordle();
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

    const lc = cmd.toLowerCase();
    if (lc === 'clear')        { output.innerHTML = ''; messageHistory = []; return; }
    if (lc === 'help')         { printToTerminal(`guest@nexus:~$ ${cmd}`, 'user-cmd'); showHelp(); return; }
    if (lc === 'play pong')    { startPong(); return; }
    if (lc === 'play snake')   { startSnake(); return; }
    if (lc === 'play wordle')  { startWordle(); return; }
    if (lc === 'monitor')      { startMonitor(); return; }

    printToTerminal(`guest@nexus:~$ ${cmd}`, 'user-cmd');
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
        if (cmd === 'clear')       { output.innerHTML = ''; messageHistory = []; return; }
        if (cmd === 'help')        { printToTerminal(`guest@nexus:~$ help`, 'user-cmd'); showHelp(); input.focus(); return; }
        if (cmd === 'play pong')   { startPong(); return; }
        if (cmd === 'play snake')  { startSnake(); return; }
        if (cmd === 'play wordle') { startWordle(); return; }
        if (cmd === 'monitor')     { startMonitor(); return; }

        printToTerminal(`guest@nexus:~$ ${cmd}`, 'user-cmd');
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
    return JSON.stringify({ command: cmd, history: messageHistory.slice(-5) });
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
