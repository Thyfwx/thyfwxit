const FRAME_INTERVAL = 1000 / 60;
const MATRIX_INTERVAL = 1000 / 24;
const RUNNER_FLOOR_Y = 150;
const RUNNER_MIN_Y = 0;

let runnerLastTime = 0;
let runnerFirstFrame = true;
let targetLastTime = 0;
let tetrisLastTime = 0;
let matrixLastTime = 0;

let targetGameActive = false;
let tetrisActive = false;
let nukeModeActive = false;
let runnerDiscoActive = false;
let runnerLoopActive = true;
let activeGameMode = 'runner';

let runnerAnimId = 0;
let targetAnimId = 0;
let tetrisAnimId = 0;

let keyBuffer = "";
let gameFrame = 0;
let audioCtx = null;
let kawaiiIntervalCleanup = null;

let runnerDeathTime = 0;
let targetDeathTime = 0;
let tetrisDeathTime = 0;

let runnerHighScore = 0;
let targetHighScore = 0;
let tetrisHighScore = 0;

try {
  runnerHighScore = parseInt(localStorage.getItem('cyberRunnerHighScore')) || 0;
  targetHighScore = parseInt(localStorage.getItem('matrixTargetHighScore')) || 0;
  tetrisHighScore = parseInt(localStorage.getItem('tetrisHighScore')) || 0;
} catch(e) {}

let shakeEnabled = true;
let matrixRainEnabled = false;

const runnerCrashMessages = ["CONNECTION LOST", "SYSTEM HALTED", "GRAVITY WINS", "FATAL COLLISION", "NETWORK OFFLINE"];
const targetCrashMessages = ["TARGET ESCAPED", "MISSION FAILED", "TOO SLOW", "SIGNAL LOST"];
const tetrisCrashMessages = ["STACK OVERFLOW", "BLOCK CORRUPTION", "GRID FATAL ERROR", "TETROMINO JAM", "OUT OF MEMORY"];

// Runner
let currentGravity = 0.85;
let currentJumpPower = 11.5;
let currentBaseSpeed = 5.0;
let runnerGodMode = false;
let runnerAutoBot = false;
let runnerJetpack = false;
let runnerNoClip = false;
let runnerFreezeObs = false;
let runnerTiny = false;
let playerX = 20;
let runnerLeftHeld = false;
let runnerRightHeld = false;
let keySpaceHeld = false;
let isJumping = false;
let velocity = 0;
let playerY = RUNNER_FLOOR_Y;
let score = 0;
let gameOver = false;
let gameStarted = false;
let currentSpeed = 5.0;
let currentRunnerCrash = "";
let runnerObstacles = [];
let runnerParticles = [];

// Target
let targetState = 'START';
let targetScore = 0;
let targetSpeedMult = 5;
let targetSize = 30;
let aimbotEnabled = false;
let targetFreeze = false;
let targetDecoyEnabled = false;
let aimbotShotDelay = 0;
let aimbotPulse = 0;

let duckX = 0, duckY = 0, duckActive = false, duckVelX = 0, duckVelY = 0, duckTimer = 0;
let goldenActive = false, goldenX = 0, goldenY = 0, goldenVx = 0, goldenVy = 0, goldenTimer = 0;
let decoyActive = false, decoyX = 0, decoyY = 0, decoyVx = 0, decoyVy = 0, decoyTimer = 0;

let maxLives = 6;
let targetLives = 6;
let currentTargetCrash = "";
let targetFloatingScores = [];
let targetParticles = [];
let mouseX = 200, mouseY = 100;

const rainbowColors = ['#FF0018', '#FFA52C', '#FFFF41', '#008018', '#0000F9', '#86007D'];
let currentDuckColor = rainbowColors[0];

// Tetris
let tetrisGrid = [];
let tetrisScore = 0;
let tetrisGameOver = false;
let currentPiece = null;
let nextPiece = null;
let tetrisDropCounter = 0;
let tetrisSpeedMod = 5;
let tetrisGodMode = false;
let tetrisRainbow = false;
let tetrisGhost = false;
let tetrisScoreMult = 1;
let tetrisSlow = false;
let tetrisLock = false;
let tetrisFloaters = [];
let tetrisLines = 0;
let tetrisLevel = 1;
let tetrisStars = Array.from({ length: 50 }, () => ({
  x: Math.random() * 400,
  y: Math.random() * 400,
  s: Math.random() * 2 + 0.5,
  v: Math.random() * 2 + 0.5
}));
let tetrisCrashMsg = "";
let tPointerStartX = 0;
let tPointerStartY = 0;
let tPointerHandled = false;

const T_COLORS = [
  null, '#00FFFF', '#0000FF', '#FFA500', '#FFFF00', '#00FF00', '#800080', '#FF0000'
];

const T_SHAPES = [
  [],
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
  [[2,0,0],[2,2,2],[0,0,0]],
  [[0,0,3],[3,3,3],[0,0,0]],
  [[4,4],[4,4]],
  [[0,5,5],[5,5,0],[0,0,0]],
  [[0,6,0],[6,6,6],[0,0,0]],
  [[7,7,0],[0,7,7],[0,0,0]]
];

const canvas = document.getElementById("jumpGame");
const ctx = canvas ? canvas.getContext("2d") : null;

const targetCanvas = document.getElementById("targetGame");
const ctxTarget = targetCanvas ? targetCanvas.getContext("2d") : null;

const tetrisCanvas = document.getElementById("tetrisGame");
const ctxTetris = tetrisCanvas ? tetrisCanvas.getContext("2d") : null;

const mCanvas = document.getElementById('matrixCanvas');
const mCtx = mCanvas ? mCanvas.getContext('2d') : null;

const style = getComputedStyle(document.body);
const neonColor = style.getPropertyValue('--neon-color').trim() || '#ff00ff';
const gridColor = style.getPropertyValue('--grid-color').trim() || '#330033';
const matrixChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*+/?".split("");
const fontSize = 16;
let drops = [];
let matrixDrawActive = false;
let kawaiiActive = false;

function announce(msg) {
  const el = document.getElementById('gameAnnouncer');
  if (!el) return;
  el.textContent = '';
  requestAnimationFrame(() => { el.textContent = msg; });
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function randInRange(min, max) {
  return Math.random() * (max - min) + min;
}

function getCanvasPoint(canvasEl, e) {
  const rect = canvasEl.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (canvasEl.width / rect.width),
    y: (e.clientY - rect.top) * (canvasEl.height / rect.height)
  };
}

function circleHit(px, py, cx, cy, radius, pad = 0) {
  return Math.hypot(px - cx, py - cy) <= radius + pad;
}

function isReducedMotion() {
  return document.body.classList.contains('a11y-no-anim');
}

function syncReducedMotionState() {
  if (isReducedMotion()) {
    shakeEnabled = false;
    matrixRainEnabled = false;

    const matrix = document.getElementById('matrixCanvas');
    const kawaii = document.getElementById('kawaiiOv');
    const crt = document.getElementById('crtOverlayElement');

    if (matrix) matrix.style.display = 'none';
    if (kawaii) kawaii.style.display = 'none';
    if (crt) crt.style.display = 'none';

    if (kawaiiIntervalCleanup) {
      clearInterval(kawaiiIntervalCleanup);
      kawaiiIntervalCleanup = null;
    }
  }
}

function stopGameLoops() {
  cancelAnimationFrame(runnerAnimId);
  cancelAnimationFrame(targetAnimId);
  cancelAnimationFrame(tetrisAnimId);
}

function playExplosionSound() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();

  const bufferSize = audioCtx.sampleRate * 0.5;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const noise = audioCtx.createBufferSource();
  noise.buffer = buffer;

  const filter = audioCtx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 1000;

  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(3, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);
  noise.start();
}

function resizeMatrix() {
  if (!mCanvas || !mCtx) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cssW = window.innerWidth || document.documentElement.clientWidth;
  const cssH = window.innerHeight || document.documentElement.clientHeight;

  mCanvas.width = Math.floor(cssW * dpr);
  mCanvas.height = Math.floor(cssH * dpr);
  mCanvas.style.width = cssW + 'px';
  mCanvas.style.height = cssH + 'px';

  mCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const newColumns = Math.max(Math.floor(cssW / fontSize) + 1, 250);
  drops = [];
  for (let x = 0; x < newColumns; x++) {
    drops[x] = Math.random() * -100;
  }
}

window.addEventListener('resize', resizeMatrix);
if (mCanvas && mCtx) resizeMatrix();

function drawMatrix(currentTime) {
  if (!mCtx || !matrixRainEnabled || isReducedMotion() || document.hidden) {
    matrixDrawActive = false;
    return;
  }

  requestAnimationFrame(drawMatrix);

  if (!currentTime) currentTime = performance.now();
  const dt = currentTime - matrixLastTime;
  if (dt < MATRIX_INTERVAL) return;
  matrixLastTime = currentTime - (dt % MATRIX_INTERVAL);

  const cssW = window.innerWidth || document.documentElement.clientWidth;
  const cssH = window.innerHeight || document.documentElement.clientHeight;

  mCtx.fillStyle = "rgba(0, 0, 0, 0.12)";
  mCtx.fillRect(0, 0, cssW, cssH);

  const hue = kawaiiActive ? 330 : 120;
  mCtx.font = "bold " + fontSize + "px monospace";

  mCtx.shadowBlur = kawaiiActive ? 6 : 4;
  mCtx.shadowColor = kawaiiActive ? "#ff69b4" : "#00ff66";
  for (let i = 0; i < drops.length; i++) {
    const text = matrixChars[Math.floor(Math.random() * matrixChars.length)];
    const alpha = 0.5 + Math.random() * 0.5;
    mCtx.fillStyle = kawaiiActive ? `hsla(${hue}, 100%, 75%, ${alpha})` : `hsla(${hue}, 100%, 50%, ${alpha})`;
    if (drops[i] > 0) {
      mCtx.fillText(text, i * fontSize, drops[i] * fontSize);
    }
    if (drops[i] * fontSize > cssH && Math.random() > 0.975) drops[i] = 0;
    drops[i]++;
  }
  mCtx.shadowBlur = 0;
}

function triggerShake() {
  if (!shakeEnabled || isReducedMotion()) return;
  const gameArea = document.getElementById("gameArea");
  if (!gameArea) return;
  gameArea.classList.remove("shake-effect");
  void gameArea.offsetWidth;
  gameArea.classList.add("shake-effect");
  setTimeout(() => gameArea.classList.remove("shake-effect"), 400);
}

async function fetchUptimeStatus() {
  // Badge API has Access-Control-Allow-Origin: * — no CORS issues.
  // SVG response contains ">Up<" or ">Down<" which we read directly.
  const monitorMap = {
    'status-proxmox': 1,
    'status-adguard': 3,
    'status-ha':      4,
    'status-omv':     10
  };

  const base = 'https://uptime.thyfwxit.com';

  function setDot(dotId, online) {
    const dot = document.getElementById(dotId);
    if (!dot) return;
    dot.classList.remove('status-loading');
    dot.classList.toggle('status-online', online);
    dot.classList.toggle('status-offline', !online);
    dot.setAttribute('aria-label', online ? 'Online' : 'Offline');
  }

  // Reset to loading state before each poll
  Object.keys(monitorMap).forEach(dotId => {
    const dot = document.getElementById(dotId);
    if (!dot) return;
    dot.classList.remove('status-online', 'status-offline');
    dot.classList.add('status-loading');
  });

  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 8000);

    const results = await Promise.all(
      Object.entries(monitorMap).map(async ([dotId, id]) => {
        try {
          const res = await fetch(`${base}/api/badge/${id}/status?_=${Date.now()}`, { signal: ctrl.signal });
          const svg = await res.text();
          return { dotId, up: svg.includes('>Up<') };
        } catch {
          return { dotId, up: false };
        }
      })
    );

    clearTimeout(tid);
    results.forEach(({ dotId, up }) => setDot(dotId, up));

    const ts = document.getElementById('statusTimestamp');
    if (ts) ts.textContent = 'Last checked: ' + new Date().toLocaleTimeString();
  } catch (e) {
    Object.keys(monitorMap).forEach(dotId => setDot(dotId, false));
    const ts = document.getElementById('statusTimestamp');
    if (ts) ts.textContent = 'Unable to reach status server';
  }
}

async function fetchLatestCommit() {
  const msgEl  = document.getElementById('commitMessage');
  const metaEl = document.getElementById('commitMeta');
  if (!msgEl) return;
  try {
    const res  = await fetch('https://api.github.com/repos/Thyfwx/thyfwxit/commits/main');
    if (!res.ok) throw new Error('fetch failed');
    const data = await res.json();
    const msg  = data.commit?.message?.split('\n')[0] || 'No message';
    const author = data.commit?.author?.name || 'Unknown';
    const date = new Date(data.commit?.author?.date);
    const ago  = formatTimeAgo(date);
    msgEl.textContent  = msg;
    metaEl.innerHTML   = `<b>${author}</b> · ${ago} · <a href="https://github.com/Thyfwx/thyfwxit" target="_blank" rel="noopener" style="color:var(--neon-color);">view commit ↗</a>`;
  } catch {
    msgEl.textContent  = 'Could not load latest commit.';
    metaEl.textContent = '';
  }
}

function formatTimeAgo(date) {
  const diff = Math.floor((Date.now() - date) / 1000);
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function resetRunnerState() {
  gameStarted = false;
  gameOver = false;
  isJumping = false;
  playerY = RUNNER_FLOOR_Y;
  playerX = 20;
  runnerLeftHeld = false;
  runnerRightHeld = false;
  velocity = 0;
  runnerObstacles = [];
  runnerParticles = [];
  score = 0;
  currentSpeed = currentBaseSpeed;
  currentRunnerCrash = "";
  runnerDeathTime = 0;
}

function resetTargetState() {
  targetState = 'START';
  targetScore = 0;
  targetFloatingScores = [];
  targetParticles = [];
  duckActive = false;
  goldenActive = false;
  decoyActive = false;
  targetLives = maxLives;
  currentTargetCrash = "";
  targetDeathTime = 0;
  aimbotShotDelay = 0;
  aimbotPulse = 0;
}

function setTargetDifficulty(value) {
  maxLives = parseInt(value) || 6;
  const modSelect = document.getElementById('modDifficulty');
  const publicSelect = document.getElementById('publicDiffSelect');
  if (modSelect) modSelect.value = String(maxLives);
  if (publicSelect) publicSelect.value = String(maxLives);
}

function startRunner() {
  switchGame('runner');
  gameStarted = true;
  gameOver = false;
  runnerFirstFrame = true;
  runnerLastTime = performance.now();
}

function startTargetGame() {
  targetGameActive = true;
  targetState = 'PLAYING';
  targetScore = 0;
  targetFloatingScores = [];
  targetParticles = [];
  duckActive = false;
  goldenActive = false;
  decoyActive = false;
  targetLives = maxLives;
  targetSpeedMult = (maxLives === 3) ? 7 : 4;
  aimbotShotDelay = aimbotEnabled ? 12 : 0;
  spawnDuck();
}

window.onload = () => {
  fetchUptimeStatus();
  setInterval(fetchUptimeStatus, 60000);
  fetchLatestCommit();

  if (document.getElementById('modGravity')) document.getElementById('modGravity').value = 0.85;
  if (document.getElementById('modSpeed')) document.getElementById('modSpeed').value = 5.0;
  if (document.getElementById('modJump')) document.getElementById('modJump').value = 11.5;
  if (document.getElementById('modShakeToggle')) {
    document.getElementById('modShakeToggle').checked = true;
    shakeEnabled = true;
  }

  if (ctx) {
    runnerFirstFrame = true;
    runnerLastTime = performance.now();
    runnerAnimId = requestAnimationFrame(updateRunner);
  }

  if (localStorage.getItem('themePref') === 'kawaii') {
    document.getElementById('kawaiiToggle')?.click();
  }

  syncReducedMotionState();

  const yearEl = document.getElementById('footerYear');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  initNexusPreview();

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && matrixRainEnabled && !matrixDrawActive) {
      matrixDrawActive = true;
      matrixLastTime = performance.now();
      requestAnimationFrame(drawMatrix);
    }
  });
};

document.addEventListener("DOMContentLoaded", () => {
  const techTips = [
    "Isolate your smart home devices on a separate <b>VLAN</b> to prevent them from accessing your private computers.",
    "Always back up your <b>TrueNAS</b> or <b>OpenMediaVault</b> config after making network changes.",
    "Use a password manager to generate and store unique, complex passwords for every <b>login</b>.",
    "Applying fresh <b>thermal paste</b> every few years prevents processor throttling and extends hardware life.",
    "Set up <b>WireGuard VPN</b> on your router to safely access your home lab from public Wi-Fi.",
    "Run <b>AdGuard Home</b> or Pi-hole at the DNS level to block ads and trackers for every device on your network.",
    "<b>Proxmox VE</b> snapshots before any major update let you roll back in seconds if something breaks.",
    "The <b>3-2-1 backup rule</b>: 3 copies, 2 different media types, 1 offsite.",
    "Use <b>SSH keys</b> instead of passwords — they're longer, can't be brute-forced, and never leave your machine.",
    "Check your router's <b>DNS-over-HTTPS</b> settings — most ISPs log every domain you visit by default.",
    "<b>SMART data</b> from your drives often warns of failure weeks before it happens. Run a short test monthly.",
    "A <b>UPS</b> (uninterruptible power supply) protects your home lab from dirty power and sudden outages.",
    "<b>Home Assistant</b> automations can alert you when a device goes offline before you'd ever notice manually.",
    "Unused open ports are an attack surface. Audit your firewall rules and close anything you don't actively use.",
    "Label your cables and document your network layout — future-you will be grateful.",
    "In <b>Proxmox</b>, always assign VMs to a dedicated storage pool — mixing VM disks with ISO storage causes I/O contention.",
    "<b>Cloudflare Tunnel</b> lets you expose local services to the internet without opening any ports on your router.",
    "Use <b>Portainer</b> to manage your Docker containers visually — far easier than typing compose commands every time.",
    "Before opening a <b>MacBook</b> for repair, use a spudger and heat — never force the case or you'll crack the frame.",
    "On <b>macOS</b>, hold Option at boot to select a startup disk, or Command+R to enter Recovery Mode without any tools.",
    "<b>Scrypted</b> bridges incompatible smart home cameras into HomeKit, Google Home, and Alexa simultaneously.",
    "Set your <b>Nginx Proxy Manager</b> SSL certificates to auto-renew — Let's Encrypt certs expire every 90 days.",
    "Never run your <b>Proxmox</b> host node as a daily-use machine. Keep it dedicated to hypervisor duties only.",
    "<b>Docker volumes</b> persist data across container restarts. Bind mounts are easier to back up. Know the difference.",
    "On Windows, <b>SFC /scannow</b> in an admin terminal repairs corrupted system files — use it before reinstalling.",
    "If a <b>MacBook</b> won't power on after liquid damage, remove the battery immediately and let it dry for 48+ hours.",
    "Use <b>Cloudflare DDNS</b> to keep your domain pointed at your home IP even when your ISP rotates it.",
    "A <b>pfSense</b> or <b>OPNsense</b> firewall VM in Proxmox gives you enterprise-grade network control at home.",
    "Enable <b>2FA</b> on every service that supports it — especially your router, NAS, and cloud backups.",
    "<b>iStatistica</b> or <b>Stats</b> in your menu bar shows real-time CPU, memory, and network usage on macOS without opening Activity Monitor.",
    "Throttled iPhone performance is almost always a degraded battery — an <b>OEM battery replacement</b> makes it feel new.",
    "Run <b>Proxmox backups</b> to a separate physical drive or NAS, not the same datastore your VMs live on.",
    "In <b>Home Assistant</b>, use input_boolean helpers as virtual switches to trigger complex automations without extra hardware.",
    "Check <b>Portainer logs</b> before restarting a crashed container — the error is almost always in the last 10 lines.",
    "When troubleshooting <b>Wi-Fi drops</b>, check your 2.4 GHz channel — channels 1, 6, and 11 are the only non-overlapping ones.",
    "Use <b>Tailscale</b> as a zero-config WireGuard alternative if you want secure remote access without managing keys manually.",
    "On <b>Windows</b>, disable Fast Startup if you're dual-booting — it causes filesystem corruption on shared drives.",
    "<b>netstat -tulpn</b> on Linux shows every open port and which process owns it. Run it regularly on any server.",
    "<b>Scrypted NVR</b> lets you record camera footage locally with no cloud subscription — full privacy, your hardware.",
    "Document your homelab in a private <b>Obsidian</b> or <b>Notion</b> vault — IP addresses, credentials structure, VM IDs, everything."
  ];

  const tipElement = document.getElementById("techTipText");
  if (tipElement) {
    tipElement.innerHTML = techTips[Math.floor(Math.random() * techTips.length)];
  }

  const jokes = [
    "I would tell you a UDP joke, but you might not get it.",
    "Why do programmers prefer dark mode? Because light attracts bugs."
  ];

  const footer = document.querySelector("footer");
  if (footer) {
    const jokeElement = document.createElement("p");
    jokeElement.style.fontSize = "0.8em";
    jokeElement.style.color = "#888";
    jokeElement.style.marginTop = "10px";
    jokeElement.innerText = jokes[Math.floor(Math.random() * jokes.length)];
    footer.appendChild(jokeElement);
  }

  const a11yBtn = document.getElementById('a11yBtn');
  const a11yMenu = document.getElementById('a11yMenu');

  function openA11yMenu() {
    a11yMenu.style.display = 'flex';
    a11yBtn.setAttribute('aria-expanded', 'true');
    document.getElementById('a11yCloseBtn')?.focus();
  }
  function closeA11yMenu() {
    a11yMenu.style.display = 'none';
    a11yBtn.setAttribute('aria-expanded', 'false');
    a11yBtn.focus();
  }

  a11yBtn?.addEventListener('click', () => {
    const isOpen = a11yMenu.style.display === 'flex';
    isOpen ? closeA11yMenu() : openA11yMenu();
  });
  a11yBtn?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openA11yMenu(); }
  });
  document.getElementById('a11yCloseBtn')?.addEventListener('click', closeA11yMenu);

  document.querySelectorAll('.a11y-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      const cls = btn.dataset.class;
      const isActive = btn.classList.toggle('active');
      document.body.classList.toggle(cls, isActive);
      if (cls === 'a11y-no-anim') syncReducedMotionState();
    });
  });

  // Auto-apply OS accessibility preferences on load, and watch for live changes
  function applyOSPref(mediaQuery, toggleId) {
    const mq = window.matchMedia(mediaQuery);
    function apply(matches) {
      const btn = document.getElementById(toggleId);
      if (!btn) return;
      btn.classList.toggle('active', matches);
      document.body.classList.toggle(btn.dataset.class, matches);
      if (btn.dataset.class === 'a11y-no-anim') syncReducedMotionState();
    }
    apply(mq.matches);
    mq.addEventListener('change', (e) => apply(e.matches));
  }

  applyOSPref('(prefers-reduced-motion: reduce)', 'a11yAnimToggle');
  applyOSPref('(prefers-contrast: more)', 'a11yContrastToggle');
});

document.getElementById("secureContactForm")?.addEventListener("submit", async function(event) {
  event.preventDefault();
  const form = event.target;
  const statusButton = form.querySelector('button[type="submit"]');
  const originalText = statusButton.innerText;
  statusButton.innerText = "SENDING...";
  statusButton.disabled = true;

  try {
    const response = await fetch(form.action, {
      method: form.method,
      body: new FormData(form),
      headers: { 'Accept': 'application/json' }
    });

    if (response.ok) {
      statusButton.innerText = "MESSAGE SENT ✓";
      statusButton.style.background = "#00ff00";
      form.reset();
    } else {
      statusButton.innerText = "ERROR - TRY AGAIN";
    }
  } catch (error) {
    statusButton.innerText = "NETWORK ERROR";
  }

  setTimeout(() => {
    statusButton.innerText = originalText;
    statusButton.disabled = false;
    statusButton.style.background = "";
  }, 4000);
});

function openModTab(evt, tabName) {
  const tabContent = document.getElementsByClassName("mod-tab-content");
  for (let i = 0; i < tabContent.length; i++) {
    tabContent[i].style.display = "none";
    tabContent[i].classList.remove("active");
  }

  const tablinks = document.getElementsByClassName("mod-tab-btn");
  for (let i = 0; i < tablinks.length; i++) {
    tablinks[i].classList.remove("active");
  }

  const targetTab = document.getElementById(tabName);
  if (targetTab) {
    targetTab.style.display = "block";
    targetTab.classList.add("active");
  }

  if (evt) evt.currentTarget.classList.add("active");
}

let headerTapCount = 0;
const handleHeaderInteraction = () => {
  headerTapCount++;
  if (headerTapCount >= 5) {
    document.getElementById('modMenu').style.display = 'flex';
    headerTapCount = 0;
  }
  setTimeout(() => { headerTapCount = 0; }, 1500);
};

document.getElementById('mainHeader')?.addEventListener('pointerdown', handleHeaderInteraction);
document.getElementById('mainHeader')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleHeaderInteraction();
});

const dragMenu = document.getElementById("modMenu");
const dragHeader = document.getElementById("modMenuHeader");
let isDraggingMenu = false;
let dragOffsetX = 0;
let dragOffsetY = 0;

if (dragHeader && dragMenu) {
  dragHeader.addEventListener("mousedown", (e) => {
    isDraggingMenu = true;
    const rect = dragMenu.getBoundingClientRect();
    dragOffsetX = e.clientX - rect.left;
    dragOffsetY = e.clientY - rect.top;
    dragMenu.style.margin = "0";
  });

  dragHeader.addEventListener("touchstart", (e) => {
    isDraggingMenu = true;
    const rect = dragMenu.getBoundingClientRect();
    dragOffsetX = e.touches[0].clientX - rect.left;
    dragOffsetY = e.touches[0].clientY - rect.top;
    dragMenu.style.margin = "0";
  }, { passive: false });
}

document.addEventListener("mousemove", (e) => {
  if (!isDraggingMenu) return;
  dragMenu.style.left = `${e.clientX - dragOffsetX}px`;
  dragMenu.style.top = `${e.clientY - dragOffsetY}px`;
});

document.addEventListener("touchmove", (e) => {
  if (!isDraggingMenu) return;
  dragMenu.style.left = `${e.touches[0].clientX - dragOffsetX}px`;
  dragMenu.style.top = `${e.touches[0].clientY - dragOffsetY}px`;
}, { passive: false });

document.addEventListener("mouseup", () => { isDraggingMenu = false; });
document.addEventListener("touchend", () => { isDraggingMenu = false; });

function updateGameTabButtons(mode) {
  const map = { runner: 'tabBtnRunner', target: 'tabBtnTarget', tetris: 'tabBtnTetris' };
  ['tabBtnRunner', 'tabBtnTarget', 'tabBtnTetris'].forEach(id => {
    const btn = document.getElementById(id);
    if (!btn) return;
    const on = map[mode] === id;
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-selected', on ? 'true' : 'false');
  });
}

window.switchGame = function(mode) {
  stopGameLoops();

  runnerLoopActive = false;
  targetGameActive = false;
  tetrisActive = false;
  activeGameMode = mode;

  const jumpCanvas = document.getElementById('jumpGame');
  const tgtCanvas = document.getElementById('targetGame');
  const tetCanvas = document.getElementById('tetrisGame');

  if (jumpCanvas) jumpCanvas.style.display = 'none';
  if (tgtCanvas) tgtCanvas.style.display = 'none';
  if (tetCanvas) tetCanvas.style.display = 'none';

  document.getElementById('runnerControls').style.display = 'none';
  document.getElementById('publicDifficulty').style.display = 'none';

  const now = performance.now();

  if (mode === 'runner') {
    runnerLoopActive = true;
    if (jumpCanvas) jumpCanvas.style.display = 'block';
    document.getElementById('runnerControls').style.display = 'flex';
    document.getElementById('gamePrompt').style.display = 'block';
    const secretEl = document.getElementById('secretText');
    if (secretEl) secretEl.style.display = 'block';
    document.getElementById('gameTitle').innerText = "Cyber Runner Game";
    document.getElementById('gameTitle').style.color = "var(--neon-color)";
    resetRunnerState();
    runnerFirstFrame = true;
    runnerLastTime = now;
    runnerAnimId = requestAnimationFrame(updateRunner);
  } else if (mode === 'target') {
    targetGameActive = true;
    if (tgtCanvas) tgtCanvas.style.display = 'block';
    document.getElementById('publicDifficulty').style.display = 'block';
    document.getElementById('gamePrompt').style.display = 'none';
    const secretEl2 = document.getElementById('secretText');
    if (secretEl2) secretEl2.style.display = 'none';
    document.getElementById('gameTitle').innerText = "Matrix Target Simulator";
    document.getElementById('gameTitle').style.color = "red";
    resetTargetState();
    targetLastTime = now;
    targetAnimId = requestAnimationFrame(updateTargetGame);
  } else if (mode === 'tetris') {
    tetrisActive = true;
    if (tetCanvas) tetCanvas.style.display = 'block';
    document.getElementById('gamePrompt').style.display = 'none';
    const secretEl3 = document.getElementById('secretText');
    if (secretEl3) secretEl3.style.display = 'none';
    document.getElementById('gameTitle').innerText = "TETRIS TERMINAL";
    document.getElementById('gameTitle').style.color = "cyan";
    initTetris();
    tetrisLastTime = now;
    tetrisAnimId = requestAnimationFrame(updateTetris);
  }
};


document.getElementById('modShakeToggle')?.addEventListener('change', (e) => {
  shakeEnabled = e.target.checked;
  if (isReducedMotion()) shakeEnabled = false;
});

document.getElementById('modMatrixRain')?.addEventListener('change', (e) => {
  matrixRainEnabled = e.target.checked && !isReducedMotion();
  const matrixCanvas = document.getElementById('matrixCanvas');
  if (matrixRainEnabled) {
    matrixLastTime = performance.now();
    if (matrixCanvas) matrixCanvas.style.display = 'block';
    if (!matrixDrawActive) {
      matrixDrawActive = true;
      requestAnimationFrame(drawMatrix);
    }
  } else {
    if (matrixCanvas) matrixCanvas.style.display = 'none';
  }
});

document.getElementById('modCrtToggle')?.addEventListener('change', (e) => {
  const crt = document.getElementById('crtOverlayElement');
  if (crt) crt.style.display = e.target.checked ? 'block' : 'none';
});

document.getElementById('modGravity')?.addEventListener('input', (e) => {
  currentGravity = parseFloat(e.target.value);
  document.getElementById('gravVal').innerText = currentGravity;
});

document.getElementById('modJump')?.addEventListener('input', (e) => {
  currentJumpPower = parseFloat(e.target.value);
  document.getElementById('jumpVal').innerText = currentJumpPower;
});

document.getElementById('modSpeed')?.addEventListener('input', (e) => {
  currentBaseSpeed = parseFloat(e.target.value);
  document.getElementById('speedVal').innerText = currentBaseSpeed;
});

document.getElementById('modGodMode')?.addEventListener('change', (e) => {
  runnerGodMode = e.target.checked;
});

document.getElementById('modRunnerBot')?.addEventListener('change', (e) => {
  runnerAutoBot = e.target.checked;
});

document.getElementById('modDiscoRunner')?.addEventListener('change', (e) => {
  runnerDiscoActive = e.target.checked;
});

document.getElementById('modJetpack')?.addEventListener('change', (e) => {
  runnerJetpack = e.target.checked;
});

document.getElementById('modNoClip')?.addEventListener('change', (e) => {
  runnerNoClip = e.target.checked;
  if (!runnerNoClip) { playerX = 20; runnerLeftHeld = false; runnerRightHeld = false; }
});

document.getElementById('modFreezeObs')?.addEventListener('change', (e) => {
  runnerFreezeObs = e.target.checked;
});

document.getElementById('modTinyMode')?.addEventListener('change', (e) => {
  runnerTiny = e.target.checked;
});

document.getElementById('modScoreInject')?.addEventListener('click', () => {
  if (gameStarted && !gameOver) score += 50;
});

document.getElementById('modClearObs')?.addEventListener('click', () => {
  runnerObstacles = [];
});

document.getElementById('modMoonGrav')?.addEventListener('click', () => {
  document.getElementById('modGravity').value = 0.2;
  currentGravity = 0.2;
  document.getElementById('gravVal').innerText = 0.2;
  document.getElementById('modJump').value = 7;
  currentJumpPower = 7;
  document.getElementById('jumpVal').innerText = 7;
});

document.getElementById('modRunnerReset')?.addEventListener('click', () => {
  document.getElementById('modGravity').value = 0.85;
  currentGravity = 0.85;
  document.getElementById('gravVal').innerText = 0.85;

  document.getElementById('modJump').value = 11.5;
  currentJumpPower = 11.5;
  document.getElementById('jumpVal').innerText = 11.5;

  document.getElementById('modSpeed').value = 5.0;
  currentBaseSpeed = 5.0;
  document.getElementById('speedVal').innerText = 5.0;

  document.getElementById('modGodMode').checked = false;
  runnerGodMode = false;

  document.getElementById('modRunnerBot').checked = false;
  runnerAutoBot = false;

  document.getElementById('modDiscoRunner').checked = false;
  runnerDiscoActive = false;

  document.getElementById('modJetpack').checked = false;
  runnerJetpack = false;

  document.getElementById('modNoClip').checked = false;
  runnerNoClip = false; playerX = 20;

  document.getElementById('modFreezeObs').checked = false;
  runnerFreezeObs = false;

  document.getElementById('modTinyMode').checked = false;
  runnerTiny = false;
});

document.getElementById('modTetrisSpeed')?.addEventListener('input', (e) => {
  tetrisSpeedMod = parseInt(e.target.value);
  document.getElementById('tetrisSpeedVal').innerText = tetrisSpeedMod;
});

document.getElementById('modTetrisGodMode')?.addEventListener('change', (e) => {
  tetrisGodMode = e.target.checked;
});

document.getElementById('modTetrisRainbow')?.addEventListener('change', (e) => {
  tetrisRainbow = e.target.checked;
});

document.getElementById('modTetrisGhost')?.addEventListener('change', (e) => {
  tetrisGhost = e.target.checked;
});

document.getElementById('modTetrisMult')?.addEventListener('input', (e) => {
  tetrisScoreMult = parseInt(e.target.value);
  document.getElementById('tetrisMultVal').innerText = tetrisScoreMult;
});

document.getElementById('modTetrisSlow')?.addEventListener('change', (e) => {
  tetrisSlow = e.target.checked;
  tetrisDropCounter = 0;
});

document.getElementById('modTetrisLock')?.addEventListener('change', (e) => {
  tetrisLock = e.target.checked;
});

document.getElementById('modTetrisScoreBtn')?.addEventListener('click', () => {
  if (!tetrisActive) return;
  let v = parseInt(document.getElementById('modTetrisScoreSet').value) || 0;
  tetrisScore = v;
  if (v > tetrisHighScore) {
    tetrisHighScore = v;
    try { localStorage.setItem('tetrisHighScore', v); } catch(e) {}
  }
});

document.getElementById('modTetrisClearBtn')?.addEventListener('click', () => {
  if (!tetrisActive || tetrisGameOver) return;
  for (let y = 0; y < tetrisGrid.length; y++) {
    tetrisGrid[y].fill(0);
  }
  tetrisFloaters.push({ x: 200, y: 200, alpha: 1.5, text: 'CLEARED!' });
});

document.getElementById('modTetrisAddJunkBtn')?.addEventListener('click', () => {
  if (!tetrisActive || tetrisGameOver) return;
  tetrisGrid.shift();
  let junkRow = [];
  for(let i = 0; i < 10; i++) {
    junkRow.push(Math.random() > 0.3 ? Math.floor(Math.random() * 7) + 1 : 0);
  }
  tetrisGrid.push(junkRow);
  tetrisFloaters.push({ x: 200, y: 350, alpha: 1.5, text: 'JUNK ROW!' });
});

document.getElementById('modDifficulty')?.addEventListener('change', (e) => {
  setTargetDifficulty(e.target.value);
});

document.getElementById('publicDiffSelect')?.addEventListener('change', (e) => {
  setTargetDifficulty(e.target.value);
});

document.getElementById('modTargetSize')?.addEventListener('input', (e) => {
  targetSize = parseInt(e.target.value);
  document.getElementById('targetSizeVal').innerText = targetSize;
});

document.getElementById('modAimbot')?.addEventListener('change', (e) => {
  aimbotEnabled = e.target.checked;
  aimbotShotDelay = aimbotEnabled ? 10 : 0;
});

document.getElementById('modTargetDecoy')?.addEventListener('change', (e) => {
  targetDecoyEnabled = e.target.checked;
});

document.getElementById('modTargetFreeze')?.addEventListener('change', (e) => {
  targetFreeze = e.target.checked;
});

document.getElementById('resetProgressBtn')?.addEventListener('click', () => {
  try {
    localStorage.removeItem('cyberRunnerHighScore');
    localStorage.removeItem('matrixTargetHighScore');
    localStorage.removeItem('tetrisHighScore');
  } catch(e) {}
  runnerHighScore = 0;
  targetHighScore = 0;
  tetrisHighScore = 0;
  alert("SYSTEM PURGED: All local high scores have been wiped.");
});

function startKawaiiParticles() {
  const emojis = ['♡', '★', '✧', '❀', '✿', '☾', '♪', '☆', '🎀', '💖', '✨', '🌸', '🍓', '🍰', '🧸', '🍒', '🌷', '🦋', '🌈', '💕', '💗', '🌺', '🍡', '🎵', '💫', '🌙', '🍬', '🎠'];
  const pinkShades = ['#ff69b4','#ff1493','#ffb6c1','#ff85c2','#ffc0cb','#ff6eb4','#db7093'];
  const ov = document.getElementById('kawaiiOv');

  if (kawaiiIntervalCleanup) clearInterval(kawaiiIntervalCleanup);

  kawaiiIntervalCleanup = setInterval(() => {
    if (!kawaiiActive || isReducedMotion()) return;

    const count = Math.random() < 0.3 ? 2 : 1;
    for (let c = 0; c < count; c++) {
      const el = document.createElement('div');
      el.innerText = emojis[Math.floor(Math.random() * emojis.length)];
      el.style.position = 'absolute';
      el.style.left = (Math.random() * 100) + 'vw';
      el.style.top = '-60px';
      const sz = Math.random() * 24 + 14;
      el.style.fontSize = sz + 'px';
      el.style.whiteSpace = 'nowrap';
      el.style.userSelect = 'none';
      el.style.color = pinkShades[Math.floor(Math.random() * pinkShades.length)];
      el.style.filter = 'drop-shadow(0 0 6px rgba(255,105,180,0.9))';
      el.style.pointerEvents = 'none';

      const drift = (Math.random() - 0.5) * 120;
      const rot = (Math.random() - 0.5) * 60;
      const duration = Math.random() * 3000 + 3500;
      el.animate([
        { transform: `translateY(0) translateX(0) rotate(0deg) scale(1)`, opacity: 1 },
        { transform: `translateY(55vh) translateX(${drift * 0.4}px) rotate(${rot * 0.4}deg) scale(0.9)`, opacity: 0.8, offset: 0.5 },
        { transform: `translateY(115vh) translateX(${drift}px) rotate(${rot}deg) scale(0.4)`, opacity: 0 }
      ], { duration, easing: 'ease-in' });

      ov.appendChild(el);
      setTimeout(() => { if (el.parentNode) el.remove(); }, duration + 100);
    }
  }, 180);
}

document.getElementById('kawaiiToggle')?.addEventListener('click', function() {
  kawaiiActive = !kawaiiActive;
  const btn = document.getElementById('kawaiiToggle');

  if (kawaiiActive) {
    localStorage.setItem('themePref', 'kawaii');
    document.documentElement.style.setProperty('--neon-color', '#ff69b4');
    document.documentElement.style.setProperty('--bg-color', '#fff0f5');
    document.documentElement.style.setProperty('--section-bg', '#ffe4e1');
    document.documentElement.style.setProperty('--grid-color', '#ffb6c1');
    document.documentElement.style.setProperty('--text-color', '#d11a7a');
    document.documentElement.style.setProperty('--canvas-bg', '#fffafa');
    document.body.style.fontFamily = "'Comic Sans MS', 'Chalkboard SE', sans-serif";
    document.body.style.background = "linear-gradient(135deg, #fff0f5, #ffe4e1, #ffd1dc, #fff0f5)";
    document.body.style.backgroundSize = "400% 400%";
    document.body.style.animation = "kawaiiGradient 20s ease infinite";
    document.body.style.cursor = "url(\"data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24'><path fill='%23ff69b4' d='M12 1l2.8 8.6H23l-7.1 5.2 2.7 8.3L12 18.2l-6.6 4.9 2.7-8.3L1 9.6h8.2z'/></svg>\") 12 12, auto";

    if (!document.getElementById('kawaiiStyle')) {
      const s = document.createElement('style');
      s.id = 'kawaiiStyle';
      s.textContent = `
        section, button, input, select, textarea, .project-card, .status-grid {
          border-radius: 25px !important;
          border: 3px dashed #ffb6c1 !important;
        }
        .mod-tab-content { border-radius: 20px !important; }
        #modMenu { background: rgba(255,240,245,0.95) !important; color: #d11a7a !important; border-color: #ff69b4 !important; }
        #modMenuHeader { background: rgba(255,182,193,0.9) !important; border-bottom: 2px solid #ff1493 !important; color: #fff !important; }
        .mod-tab-btn { color: #ff69b4 !important; font-weight: bold !important; }
        .mod-tab-btn.active { color: #ff1493 !important; border-bottom: 2px solid #ff1493 !important; text-shadow: none !important; }
        .mod-row label { color: #d11a7a !important; font-weight: bold; }
        .toggle-slider { background-color: #ffb6c1 !important; border: 1px solid #ff69b4 !important; }
        input:checked + .toggle-slider { background-color: #ff1493 !important; box-shadow: none !important; }
        input:checked + .toggle-slider:before { background-color: #fff !important; box-shadow: none !important; }
        .nuke-btn { background: #ffb6c1 !important; color: #fff !important; border: 1px solid #ff69b4 !important; text-shadow: none !important; }
        select { background: #ffe4e1 !important; color: #d11a7a !important; font-weight: bold; }
      `;
      document.head.appendChild(s);
    }

    if (!isReducedMotion()) startKawaiiParticles();

    const _trailSymbols = ['★','☆','♡','♥','✿','❀','✽','✾','✦','✧','❁','❋','❃','♪','♫','💖','🌸','✨'];
    const _trailColors = ['#ff69b4','#ff1493','#ffb6c1','#ff85c2','#ff00aa','#ffc0cb'];
    let _kawaiiTrailLast = 0;
    window._kawaiiMouseHandler = function(e) {
      const now = Date.now();
      if (now - _kawaiiTrailLast < 30) return;
      _kawaiiTrailLast = now;
      const sparkle = document.createElement('div');
      sparkle.innerText = _trailSymbols[Math.floor(Math.random() * _trailSymbols.length)];
      const col = _trailColors[Math.floor(Math.random() * _trailColors.length)];
      const sz = 12 + Math.random() * 10;
      sparkle.style.cssText = `position:fixed;left:${e.clientX}px;top:${e.clientY}px;pointer-events:none;z-index:99999;font-size:${sz}px;color:${col};text-shadow:0 0 6px ${col};opacity:1;font-weight:bold;transform:translate(-50%,-50%);will-change:transform,opacity;`;
      const dx = (Math.random() - 0.5) * 50;
      const dy = -(15 + Math.random() * 25);
      sparkle.animate([
        { transform: `translate(-50%,-50%) scale(1)`, opacity: 1 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0)`, opacity: 0 }
      ], { duration: 450 + Math.random() * 150, easing: 'ease-out', fill: 'forwards' });
      document.body.appendChild(sparkle);
      setTimeout(() => { if (sparkle.parentNode) sparkle.remove(); }, 620);
    };
    window._kawaiiClickHandler = function(e) {
      if (!kawaiiActive) return;
      const burst = ['💖','✨','🌸','★','♡','✿','💕','🌷'];
      for (let i = 0; i < 8; i++) {
        const s = document.createElement('div');
        s.innerText = burst[Math.floor(Math.random() * burst.length)];
        const angle = (i / 8) * Math.PI * 2;
        const dist = 35 + Math.random() * 35;
        const col = _trailColors[Math.floor(Math.random() * _trailColors.length)];
        s.style.cssText = `position:fixed;left:${e.clientX}px;top:${e.clientY}px;pointer-events:none;z-index:99999;font-size:${14 + Math.random()*8}px;color:${col};text-shadow:0 0 8px ${col};transform:translate(-50%,-50%);`;
        s.animate([
          { transform: `translate(-50%,-50%) scale(1)`, opacity: 1 },
          { transform: `translate(calc(-50% + ${Math.cos(angle)*dist}px), calc(-50% + ${Math.sin(angle)*dist}px)) scale(0)`, opacity: 0 }
        ], { duration: 500 + Math.random() * 200, easing: 'ease-out' });
        document.body.appendChild(s);
        setTimeout(() => { if (s.parentNode) s.remove(); }, 750);
      }
    };
    document.addEventListener('mousemove', window._kawaiiMouseHandler);
    document.addEventListener('click', window._kawaiiClickHandler);

    document.getElementById('modMenu').style.borderColor = '#ff69b4';
    document.getElementById('modMenu').style.boxShadow = '0 0 30px #ff69b4';
    btn.innerText = '[KAWAII] ON!';
    btn.classList.add('active');
  } else {
    localStorage.setItem('themePref', 'cyber');
    document.documentElement.style.setProperty('--neon-color', '#ff00ff');
    document.documentElement.style.setProperty('--bg-color', '#1a1a1a');
    document.documentElement.style.setProperty('--section-bg', '#2a2a2a');
    document.documentElement.style.setProperty('--grid-color', '#330033');
    document.documentElement.style.setProperty('--text-color', '#e0e0e0');
    document.documentElement.style.setProperty('--canvas-bg', '#0a0a0a');
    document.body.style.fontFamily = "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
    document.body.style.background = "var(--bg-color)";
    document.body.style.animation = "none";
    document.getElementById('mainTitle').innerText = "Systems Specialist & Network Infrastructure";
    document.body.style.cursor = "auto";
    if (document.getElementById('kawaiiStyle')) document.getElementById('kawaiiStyle').remove();
    if (kawaiiIntervalCleanup) clearInterval(kawaiiIntervalCleanup);
    document.getElementById('kawaiiOv').innerHTML = '';
    if (window._kawaiiMouseHandler) {
      document.removeEventListener('mousemove', window._kawaiiMouseHandler);
      window._kawaiiMouseHandler = null;
    }
    if (window._kawaiiClickHandler) {
      document.removeEventListener('click', window._kawaiiClickHandler);
      window._kawaiiClickHandler = null;
    }
    document.getElementById('modMenu').style.borderColor = '#ff0000';
    document.getElementById('modMenu').style.boxShadow = '0 0 20px #ff0000';
    btn.innerText = 'OFF';
    btn.classList.remove('active');
  }
});

document.getElementById('nukeToggle')?.addEventListener('click', (e) => {
  const btn = e.target;
  btn.style.pointerEvents = 'none';

  // Countdown overlay
  const countdownOv = document.createElement('div');
  countdownOv.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.95);z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:monospace;';
  document.body.appendChild(countdownOv);

  const warnings = [
    '> INITIATING SECURITY BREACH...',
    '> BYPASSING FIREWALL PROTOCOLS...',
    '> DECRYPTING LAYER 7 ENCRYPTION...',
    '> INJECTING PAYLOAD INTO MAINFRAME...',
    '> WARNING: SYSTEM INTEGRITY COMPROMISED',
    '> ALL PROCESSES TERMINATED'
  ];

  const termDiv = document.createElement('div');
  termDiv.style.cssText = 'color:#ff0000;font-size:14px;text-align:left;max-width:500px;width:90%;margin-bottom:30px;';
  countdownOv.appendChild(termDiv);

  const countText = document.createElement('div');
  countText.style.cssText = 'color:#ff0000;font-size:120px;font-weight:bold;text-shadow:0 0 40px #ff0000,0 0 80px #ff0000;';
  countdownOv.appendChild(countText);

  let warningIdx = 0;
  const warningTimer = setInterval(() => {
    if (warningIdx < warnings.length) {
      const line = document.createElement('div');
      line.textContent = warnings[warningIdx];
      line.style.cssText = 'margin:4px 0;opacity:0;animation:fadeIn 0.3s forwards;';
      termDiv.appendChild(line);
      warningIdx++;
    }
  }, 400);

  if (!document.getElementById('breachAnimStyle')) {
    const animStyle = document.createElement('style');
    animStyle.id = 'breachAnimStyle';
    animStyle.textContent = '@keyframes fadeIn{from{opacity:0;transform:translateX(-10px)}to{opacity:1;transform:translateX(0)}}@keyframes breachPulse{0%,100%{box-shadow:inset 0 0 60px rgba(255,0,0,0.4)}50%{box-shadow:inset 0 0 120px rgba(255,0,0,0.8)}}';
    document.head.appendChild(animStyle);
  }

  let count = 3;
  countText.textContent = count;
  playExplosionSound();

  const countTimer = setInterval(() => {
    count--;
    if (count > 0) {
      countText.textContent = count;
      countText.style.animation = 'none';
      void countText.offsetWidth;
      countText.style.animation = 'terrifyingTear 0.3s';
      playExplosionSound();
    } else {
      clearInterval(countTimer);
      clearInterval(warningTimer);
      countText.textContent = 'BREACH';
      countText.style.fontSize = '60px';
      playExplosionSound();

      setTimeout(() => {
        countdownOv.remove();
        nukeModeActive = true;
        document.body.classList.add("nuke-terrifying");
        document.body.style.backgroundColor = "#050000";
        document.body.style.backgroundImage = "repeating-linear-gradient(45deg, #110000 25%, transparent 25%, transparent 75%, #110000 75%, #110000), repeating-linear-gradient(45deg, #110000 25%, #050000 25%, #050000 75%, #110000 75%, #110000)";
        document.body.style.backgroundPosition = "0 0, 10px 10px";
        document.body.style.backgroundSize = "20px 20px";
        document.body.style.cursor = "crosshair";
        btn.style.background = "#ff0000";
        btn.style.color = "#000";
        btn.innerText = "SYSTEM COMPROMISED. DO NOT TURN OFF DEVICE.";

        const doomOverlay = document.createElement("div");
        doomOverlay.id = 'breachOverlay';
        doomOverlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(255,0,0,0.15);mix-blend-mode:multiply;pointer-events:none;z-index:9998;animation:breachPulse 2s ease-in-out infinite;';
        document.body.appendChild(doomOverlay);

        window._breachGlitchTimer = setInterval(() => {
          if (!nukeModeActive) return;
          const msgs = ['SYSTEM_FAILURE', 'MEMORY_CORRUPT', 'KERNEL_PANIC', '0xDEADBEEF', 'STACK_OVERFLOW', 'SEG_FAULT', 'ACCESS_DENIED', 'BREACH_ACTIVE'];
          const g = document.createElement('div');
          g.textContent = msgs[Math.floor(Math.random() * msgs.length)];
          g.style.cssText = `position:fixed;left:${Math.random() * 80}vw;top:${Math.random() * 80}vh;color:#ff0000;font-family:monospace;font-size:${12 + Math.random() * 16}px;font-weight:bold;pointer-events:none;z-index:9999;mix-blend-mode:difference;opacity:0.7;text-shadow:0 0 5px #ff0000;`;
          document.body.appendChild(g);
          setTimeout(() => g.remove(), 800 + Math.random() * 1200);
        }, 500);

        triggerShake();
      }, 800);
    }
  }, 1000);
});

document.addEventListener('click', (e) => {
  if (
    !nukeModeActive ||
    e.target.closest('#modMenu') ||
    e.target.closest('#a11yMenu') ||
    e.target.closest('#a11yBtn') ||
    e.target.tagName === 'HTML' ||
    e.target.tagName === 'BODY' ||
    e.target.tagName === 'CANVAS'
  ) return;

  playExplosionSound();
  triggerShake();

  // Full-screen red flash
  const flash = document.createElement('div');
  flash.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:#ff0000;pointer-events:none;z-index:100000;';
  document.body.appendChild(flash);
  flash.animate([{ opacity: 0.7 }, { opacity: 0 }], { duration: 180, easing: 'ease-out' });
  setTimeout(() => flash.remove(), 200);

  // Explosion burst from click point
  const blastLabels = ['CORRUPTED', 'COMPROMISED', 'ACCESS DENIED', 'MEMORY DUMP', 'BREACH DETECTED', 'DATA WIPED', 'KERNEL PANIC', 'SYS FAILURE'];
  for (let i = 0; i < 12; i++) {
    const shard = document.createElement('div');
    const angle = (i / 12) * Math.PI * 2;
    const dist = 80 + Math.random() * 120;
    const tx = Math.cos(angle) * dist;
    const ty = Math.sin(angle) * dist;
    shard.style.cssText = `position:fixed;left:${e.clientX}px;top:${e.clientY}px;width:${4 + Math.random()*8}px;height:${4 + Math.random()*8}px;background:#ff0000;pointer-events:none;z-index:10002;border-radius:50%;`;
    shard.animate([
      { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
      { transform: `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(0)`, opacity: 0 }
    ], { duration: 500 + Math.random() * 300, easing: 'ease-out' });
    document.body.appendChild(shard);
    setTimeout(() => shard.remove(), 800);
  }

  // Scary floating label at click point
  const label = document.createElement('div');
  label.textContent = blastLabels[Math.floor(Math.random() * blastLabels.length)];
  label.style.cssText = `position:fixed;left:${e.clientX}px;top:${e.clientY - 20}px;transform:translate(-50%,-100%);color:#ff0000;font-family:monospace;font-size:14px;font-weight:bold;pointer-events:none;z-index:10003;text-shadow:0 0 8px #ff0000;white-space:nowrap;`;
  document.body.appendChild(label);
  label.animate([
    { transform: 'translate(-50%,-100%) scale(1)', opacity: 1 },
    { transform: 'translate(-50%, calc(-100% - 50px)) scale(1.3)', opacity: 0 }
  ], { duration: 900, easing: 'ease-out' });
  setTimeout(() => label.remove(), 950);

  e.target.style.transition = 'all 0.3s cubic-bezier(0.25, 1, 0.5, 1)';
  e.target.style.transform = 'skewX(45deg) scaleY(0)';
  e.target.style.filter = 'invert(1) drop-shadow(0 0 10px red)';
  e.target.style.opacity = '0';

  setTimeout(() => {
    if (e.target && e.target.style) {
      e.target.style.visibility = 'hidden';
      e.target.style.pointerEvents = 'none';
    }
  }, 300);
});

function jump() {
  if (!runnerLoopActive || activeGameMode !== 'runner') return;

  if (gameOver) {
    if (Date.now() - runnerDeathTime > 1000) {
      startRunner();
      velocity = -currentJumpPower;
      isJumping = true;
    }
    return;
  }

  if (!gameStarted) gameStarted = true;

  const grounded = playerY >= RUNNER_FLOOR_Y - 1;
  if (!grounded) return;

  velocity = -currentJumpPower;
  isJumping = true;
}

window.addEventListener("keydown", function(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

  if (e.code === 'Escape') {
    document.getElementById('modMenu').style.display = 'none';
    document.getElementById('a11yMenu').style.display = 'none';
    const a11yBtnEl = document.getElementById('a11yBtn');
    if (a11yBtnEl) a11yBtnEl.setAttribute('aria-expanded', 'false');
  }

  if (e.code === 'Space' || e.key === " ") {
    e.preventDefault();
    keySpaceHeld = true;
  }

  if (e.key && e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
    keyBuffer = (keyBuffer + e.key.toLowerCase()).slice(-6);

    if (keyBuffer.endsWith("hack")) document.getElementById('modMenu').style.display = 'flex';
    if (keyBuffer.endsWith("duck")) switchGame('target');
    if (keyBuffer.endsWith("runn")) switchGame('runner');

    if (keyBuffer.endsWith("sudo")) {
      const termOverlay = document.getElementById('terminalOverlay');
      const termText = document.getElementById('terminalText');
      termOverlay.style.display = 'block';
      termText.innerHTML = "";

      const bootSequence = [
        "INITIALIZING ROOT ACCESS...",
        "BYPASSING MAINFRAME FIREWALL...",
        "DECRYPTING SECURE SECTORS...",
        "ACCESS GRANTED.",
        "LAUNCHING OVERRIDE PROTOCOL..."
      ];

      let delay = 0;
      bootSequence.forEach((line, index) => {
        setTimeout(() => {
          termText.innerHTML += `> ${line}<br>`;
          termOverlay.style.boxShadow = "inset 0 0 50px #00ff00";
          setTimeout(() => termOverlay.style.boxShadow = "none", 100);
          if (index === bootSequence.length - 1) {
            setTimeout(() => {
              termOverlay.style.display = 'none';
              document.getElementById('modMenu').style.display = 'flex';
            }, 1000);
          }
        }, delay);
        delay += 600;
      });
    }
  }

  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].indexOf(e.code) > -1) e.preventDefault();

  if (tetrisActive) {
    if (tetrisGameOver) {
      if (e.code === "Space" || e.code === "Enter" || e.key === " ") {
        if (Date.now() - tetrisDeathTime < 1000) return;
        if (!e.repeat) initTetris();
      }
      return;
    }

    if (e.code === "ArrowLeft" || e.code === "KeyA") tMove(-1);
    if (e.code === "ArrowRight" || e.code === "KeyD") tMove(1);
    if (e.code === "ArrowDown" || e.code === "KeyS") {
      tDrop();
      tetrisScore += (1 * tetrisScoreMult);
    }
    if (e.code === "ArrowUp" || e.code === "KeyW") tRotate();

    if (e.code === "Space" || e.key === " ") {
      if (e.repeat) return;
      if (!currentPiece) return;
      while (!tCollide(tetrisGrid, currentPiece)) currentPiece.pos.y++;
      currentPiece.pos.y--;
      tMerge();
      tReset();
      tSweep();
      triggerShake();
    }
  } else if (targetGameActive) {
    if ((targetState === 'START' || targetState === 'GAMEOVER') && (e.code === "Space" || e.code === "Enter" || e.key === " ")) {
      if (targetState === 'GAMEOVER' && Date.now() - targetDeathTime < 1000) return;
      if (!e.repeat) startTargetGame();
    }
  } else {
    if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW" || e.key === " ") {
      if (!e.repeat) jump();
    }
    if (runnerNoClip) {
      if (e.code === "ArrowLeft" || e.code === "KeyA") runnerLeftHeld = true;
      if (e.code === "ArrowRight" || e.code === "KeyD") runnerRightHeld = true;
    }
  }
}, { passive: false });

window.addEventListener("keyup", e => {
  if (e.code === 'Space' || e.key === " ") keySpaceHeld = false;
  if (e.code === "ArrowLeft" || e.code === "KeyA") runnerLeftHeld = false;
  if (e.code === "ArrowRight" || e.code === "KeyD") runnerRightHeld = false;
});

if (canvas) {
  canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    keySpaceHeld = true;
    document.getElementById("jumpGame").scrollIntoView({ behavior: "smooth", block: "center" });
    jump();
  });
  canvas.addEventListener("pointerup", () => {
    keySpaceHeld = false;
  });
  canvas.addEventListener("pointercancel", () => {
    keySpaceHeld = false;
  });
  canvas.addEventListener("pointerleave", (e) => {
    if (e.buttons === 0) keySpaceHeld = false;
  });
}

if (targetCanvas) {
  targetCanvas.addEventListener('pointermove', e => {
    e.preventDefault();
    const rect = targetCanvas.getBoundingClientRect();
    mouseX = (e.clientX - rect.left) * (targetCanvas.width / rect.width);
    mouseY = (e.clientY - rect.top) * (targetCanvas.height / rect.height);
  });

  targetCanvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    const p = getCanvasPoint(targetCanvas, e);
    mouseX = p.x;
    mouseY = p.y;

    if (targetState === 'GAMEOVER') {
      if (Date.now() - targetDeathTime < 1000) return;
      startTargetGame();
      return;
    }

    if (targetState === 'START') {
      startTargetGame();
      return;
    }

    if (targetState === 'PLAYING') {
      const hitPad = 28;
      const duckCx = duckX + targetSize / 2;
      const duckCy = duckY + targetSize / 2;
      const goldenCx = goldenX + targetSize / 2;
      const goldenCy = goldenY + targetSize / 2;
      const decoyCx = decoyX + targetSize / 2;
      const decoyCy = decoyY + targetSize / 2;

      const hitDuck = duckActive && circleHit(p.x, p.y, duckCx, duckCy, targetSize / 2, hitPad);
      const hitGolden = goldenActive && circleHit(p.x, p.y, goldenCx, goldenCy, targetSize / 2, hitPad);
      const hitDecoy = decoyActive && circleHit(p.x, p.y, decoyCx, decoyCy, targetSize / 2, hitPad);

      if (hitGolden) {
        targetScore += 2;
        targetFloatingScores.push({ x: p.x + 15, y: p.y, alpha: 1.0, text: "+2", r: 255, g: 215, b: 0 });
        spawnTargetParticles(p.x, p.y, "#FFD700");
        goldenActive = false;
      } else if (hitDecoy) {
        targetScore = Math.max(0, targetScore - 5);
        targetFloatingScores.push({ x: p.x + 15, y: p.y, alpha: 1.0, text: "-5", r: 255, g: 0, b: 0 });
        spawnTargetParticles(p.x, p.y, "#ff0000");
        decoyActive = false;
        triggerShake();
      } else if (hitDuck) {
        targetScore++;
        targetFloatingScores.push({ x: p.x + 15, y: p.y, alpha: 1.0, text: "+1", r: 0, g: 255, b: 0 });
        spawnTargetParticles(p.x, p.y, currentDuckColor);
        if (targetScore > 0 && targetScore % 8 === 0) targetSpeedMult = Math.min(targetSpeedMult + 1, 14);
        duckActive = false;
      }

      if (targetScore > targetHighScore) {
        targetHighScore = targetScore;
        try { localStorage.setItem('matrixTargetHighScore', targetHighScore); } catch(err) {}
      }
    }
  });

  targetCanvas.addEventListener("pointerup", (e) => {
    e.preventDefault();
    try {
      if (targetCanvas.hasPointerCapture(e.pointerId)) {
        targetCanvas.releasePointerCapture(e.pointerId);
      }
    } catch(err) {}
  });
}

if (tetrisCanvas) {
  tetrisCanvas.addEventListener("touchstart", (e) => {
    e.preventDefault();
    if (tetrisGameOver) {
      if (Date.now() - tetrisDeathTime > 1000) initTetris();
      return;
    }
    tPointerStartX = e.touches[0].clientX;
    tPointerStartY = e.touches[0].clientY;
    tPointerHandled = false;
  }, { passive: false });

  tetrisCanvas.addEventListener("touchmove", (e) => {
    e.preventDefault();
    if (!tetrisActive || tetrisGameOver) return;
    let dx = e.touches[0].clientX - tPointerStartX;
    let dy = e.touches[0].clientY - tPointerStartY;
    if (Math.abs(dx) > 30) {
      tMove(dx > 0 ? 1 : -1);
      tPointerStartX = e.touches[0].clientX;
      tPointerHandled = true;
    } else if (dy > 40) {
      tDrop();
      tPointerStartY = e.touches[0].clientY;
      tPointerHandled = true;
    }
  }, { passive: false });

  tetrisCanvas.addEventListener("touchend", (e) => {
    e.preventDefault();
    if (!tPointerHandled && tetrisActive && !tetrisGameOver) tRotate();
  }, { passive: false });

  tetrisCanvas.addEventListener("mousedown", (e) => {
    e.preventDefault();
    if (tetrisGameOver) {
      if (Date.now() - tetrisDeathTime > 1000) initTetris();
    } else if (tetrisActive) {
      tRotate();
    }
  });
}

document.getElementById("mobileJumpBtn")?.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  keySpaceHeld = true;
  document.getElementById("jumpGame").scrollIntoView({ behavior: "smooth", block: "center" });
  jump();
});

document.getElementById("mobileJumpBtn")?.addEventListener("pointerup", () => {
  keySpaceHeld = false;
});

function drawDino(ctx, x, y, frame) {
  const isContrast = document.body.classList.contains('a11y-contrast');
  const gameNeonColor = isContrast ? "#000000" : (kawaiiActive ? "#ff69b4" : neonColor);
  const secondaryColor = isContrast ? "#ffffff" : "#fff";

  ctx.globalAlpha = (runnerGodMode && frame % 10 < 5) ? 0.5 : 1.0;
  ctx.fillStyle = gameNeonColor;
  ctx.fillRect(x, y, 20, 20);
  ctx.fillStyle = secondaryColor;
  ctx.fillRect(x + 12, y + 4, 4, 4);
  ctx.fillStyle = gameNeonColor;

  if (isJumping) {
    ctx.fillRect(x + 2, y + 20, 6, 6);
    ctx.fillRect(x + 12, y + 20, 6, 6);
  } else {
    if (Math.floor(frame / 5) % 2 === 0) ctx.fillRect(x + 2, y + 20, 6, 6);
    else ctx.fillRect(x + 12, y + 20, 6, 6);
  }

  ctx.globalAlpha = 1.0;
}

function spawnRunnerParticles(x, y, color) {
  if (isReducedMotion()) return;
  for (let i = 0; i < 20; i++) {
    runnerParticles.push({
      x: x + Math.random() * 20,
      y: y + Math.random() * 20,
      vx: (Math.random() - 0.5) * 10,
      vy: (Math.random() - 0.5) * 10,
      life: 1.0,
      color
    });
  }
}

function updateRunner(currentTime) {
  if (!ctx) return;
  if (!runnerLoopActive || activeGameMode !== 'runner') return;

  runnerAnimId = requestAnimationFrame(updateRunner);

  if (!currentTime) currentTime = performance.now();
  if (runnerFirstFrame) {
    runnerLastTime = currentTime;
    runnerFirstFrame = false;
    return;
  }
  let dt = currentTime - runnerLastTime;
  if (dt < FRAME_INTERVAL) return;
  runnerLastTime = currentTime - (dt % FRAME_INTERVAL);
  gameFrame++;

  const isContrast = document.body.classList.contains('a11y-contrast');
  const reducedMotion = isReducedMotion();
  const gameNeonColor = isContrast ? "#000000" : (kawaiiActive ? "#ff69b4" : neonColor);
  const canvasTextColor = isContrast ? "#000000" : (kawaiiActive ? "#d11a7a" : "#fff");
  const canvasLineCol = isContrast ? "#cccccc" : (kawaiiActive ? "rgba(255,105,180,0.4)" : gridColor);
  const gameBgColor = isContrast ? "#ffffff" : (kawaiiActive ? "#fffafa" : "rgba(0,0,0,0.85)");
  const floorCol = isContrast ? "#dddddd" : (kawaiiActive ? "#ffe4e1" : "#444");

  ctx.clearRect(0, 0, 400, 200);

  if (runnerDiscoActive && !reducedMotion && !isContrast) {
    const beat = Math.floor(gameFrame / 10) % 6;
    const discoBg = [`hsla(${beat*60},80%,8%,1)`, `hsla(${beat*60+30},80%,10%,1)`];
    ctx.fillStyle = discoBg[0];
    ctx.fillRect(0, 0, 400, 200);
    ctx.strokeStyle = `hsla(${(gameFrame * 3) % 360},100%,55%,0.25)`;
    for (let i = 0; i <= 400; i += 20) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 200); ctx.stroke();
    }
    for (let i = 0; i <= 200; i += 20) {
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(400, i); ctx.stroke();
    }
    // Disco floor strip
    const floorHue = (gameFrame * 4) % 360;
    ctx.fillStyle = `hsla(${floorHue},100%,50%,0.35)`;
    ctx.fillRect(0, 168, 400, 6);
    // Strobe flash on beat
    if (gameFrame % 30 < 2) {
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(0, 0, 400, 200);
    }
  } else if (kawaiiActive || isContrast || reducedMotion) {
    ctx.fillStyle = reducedMotion ? (isContrast ? "#ffffff" : "#0a0a0a") : gameBgColor;
    ctx.fillRect(0, 0, 400, 200);
  }

  if (!reducedMotion && !runnerDiscoActive) {
    ctx.strokeStyle = canvasLineCol;
    for (let i = 0; i <= 400; i += 20) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 200);
      ctx.stroke();
    }
    for (let i = 0; i <= 200; i += 20) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(400, i);
      ctx.stroke();
    }

    ctx.strokeStyle = gameNeonColor;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(0 - (gameFrame * currentSpeed) % 10, 170);
    ctx.lineTo(400, 170);
    ctx.stroke();
    ctx.setLineDash([]);
  } else if (reducedMotion || (!runnerDiscoActive && !kawaiiActive && !isContrast)) {
    ctx.fillStyle = floorCol;
    ctx.fillRect(0, 170, 400, 30);
  } else if (!runnerDiscoActive) {
    ctx.strokeStyle = gameNeonColor;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(0 - (gameFrame * currentSpeed) % 10, 170);
    ctx.lineTo(400, 170);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (gameStarted && !gameOver) {
    if (runnerJetpack && keySpaceHeld) {
      velocity -= 1.5;
      if (velocity < -currentJumpPower) velocity = -currentJumpPower;
      isJumping = true;
    } else if (isJumping && !runnerJetpack && !keySpaceHeld && !runnerAutoBot) {
      if (velocity < -4) velocity = -4;
    }

    velocity += currentGravity;
    playerY += velocity;

    if (playerY < RUNNER_MIN_Y) {
      playerY = RUNNER_MIN_Y;
      if (velocity < 0) velocity = 0;
    }

    if (playerY >= RUNNER_FLOOR_Y) {
      playerY = RUNNER_FLOOR_Y;
      isJumping = false;
      velocity = 0;
    }

    if (runnerNoClip) {
      if (runnerLeftHeld) playerX = Math.max(0, playerX - (currentSpeed + 2));
      if (runnerRightHeld) playerX = Math.min(360, playerX + (currentSpeed + 2));
    }

    currentSpeed = currentBaseSpeed + (score / 8);
    let minGap = 350 + (currentSpeed * 20);
    let lastObs = runnerObstacles[runnerObstacles.length - 1];

    if (!runnerFreezeObs && (!lastObs || lastObs.x < (400 - minGap))) {
      let r = Math.random();
      let oType = 'normal';
      if (score > 5 && r < 0.40) oType = 'flying';
      else if (r < 0.60) oType = 'tall';
      else if (r < 0.80) oType = 'wide';
      runnerObstacles.push({ x: 400, passed: false, type: oType });
    }

    if (runnerAutoBot) {
      const grounded = playerY >= RUNNER_FLOOR_Y - 1;
      const threat = runnerObstacles.find(o => !o.passed && o.type !== 'flying' && o.x > 15);
      if (threat && grounded) {
        // Physics-based trigger: obstacle should arrive just before jump peak.
        // Peak frame = jumpPower / gravity. Trigger so obstacle is ~85% of that away.
        const peakFrames = currentJumpPower / currentGravity;
        const jumpTriggerDist = 20 + Math.ceil(currentSpeed * peakFrames * 0.85);
        if (threat.x < jumpTriggerDist) {
          velocity = -currentJumpPower;
          isJumping = true;
        }
      }
    }

    for (let i = 0; i < runnerObstacles.length; i++) {
      let obs = runnerObstacles[i];
      if (!runnerFreezeObs) obs.x -= currentSpeed;

      if (!obs.passed && obs.x + 20 < playerX) {
        obs.passed = true;
        score++;
      }

      let px = playerX, py = playerY;
      let pw = runnerTiny ? 8 : 20, ph = runnerTiny ? 8 : 20;

      let ox = obs.x, oy, ow, oh;
      if (obs.type === 'tall') {
        oy = 130; ow = 12; oh = 40;
      } else if (obs.type === 'wide') {
        oy = 145; ow = 36; oh = 25;
      } else if (obs.type === 'flying') {
        oy = 20; ow = 20; oh = 110;
      } else {
        oy = 145; ow = 16; oh = 25;
      }

      if (px < ox + ow && px + pw > ox && py < oy + oh && py + ph > oy && !runnerGodMode && !runnerNoClip) {
        if (!gameOver) {
          gameOver = true;
          runnerDeathTime = Date.now();
          currentRunnerCrash = runnerCrashMessages[Math.floor(Math.random() * runnerCrashMessages.length)];
          triggerShake();
          spawnRunnerParticles(px, py, gameNeonColor);
          announce(`Game over. Final score: ${score}.`);

          if (score > runnerHighScore) {
            runnerHighScore = score;
            try { localStorage.setItem('cyberRunnerHighScore', runnerHighScore); } catch(e) {}
          }
        }
      }
    }

    runnerObstacles = runnerObstacles.filter(o => o.x + 40 > -10);
  }

  if (gameOver) {
    ctx.fillStyle = isContrast ? "#ffffff" : (kawaiiActive ? "rgba(255,240,245,0.85)" : "rgba(0,0,0,0.85)");
    ctx.fillRect(0, 0, 400, 200);

    if (!isContrast && !reducedMotion) {
      for (let i = 0; i < 15; i++) {
        ctx.fillStyle = kawaiiActive ? `rgba(255,105,180,${Math.random() * 0.4})` : `rgba(255,0,0,${Math.random() * 0.4})`;
        ctx.fillRect(Math.random() * 400, Math.random() * 200, Math.random() * 200 + 50, Math.random() * 5 + 1);
      }
    }
  } else {
    drawDino(ctx, playerX, playerY, gameFrame);
  }

  if (gameStarted && !gameOver) {
    runnerObstacles.forEach(obs => {
      if (obs.type === 'flying') {
        let flyY = 115;
        ctx.fillStyle = isContrast ? "#000000" : (runnerDiscoActive ? `hsl(${(gameFrame * 20) % 360}, 100%, 50%)` : (kawaiiActive ? "#ff1493" : "#ff0055"));
        ctx.fillRect(obs.x, flyY, 20, 10);
        ctx.fillStyle = isContrast ? "#ffffff" : "#fff";
        ctx.fillRect(obs.x + 4, flyY + 2, 4, 4);
        ctx.fillStyle = isContrast ? "#000000" : (runnerDiscoActive ? "#fff" : (kawaiiActive ? "#ff1493" : "#ff0055"));
        if (!reducedMotion) {
          if (gameFrame % 20 < 10) ctx.fillRect(obs.x + 8, flyY - 6, 4, 6);
          else ctx.fillRect(obs.x + 8, flyY + 10, 4, 6);
        }
      } else {
        ctx.fillStyle = isContrast ? "#000000" : (runnerDiscoActive ? `hsl(${(gameFrame * 15 + obs.x) % 360}, 100%, 50%)` : (kawaiiActive ? "#ffb6c1" : "#00ff00"));
        if (obs.type === 'tall') {
          ctx.fillRect(obs.x, 130, 12, 40);
          ctx.fillRect(obs.x - 6, 140, 6, 15);
          ctx.fillRect(obs.x - 6, 155, 6, 4);
          ctx.fillRect(obs.x + 12, 135, 6, 15);
          ctx.fillRect(obs.x + 12, 150, 6, 4);
        } else if (obs.type === 'wide') {
          ctx.fillRect(obs.x, 145, 10, 25);
          ctx.fillRect(obs.x + 12, 150, 10, 20);
          ctx.fillRect(obs.x + 24, 140, 10, 30);
        } else {
          ctx.fillRect(obs.x, 145, 16, 25);
          ctx.fillRect(obs.x - 4, 150, 4, 10);
          ctx.fillRect(obs.x + 16, 148, 4, 10);
        }
      }
    });
  }

  if (!reducedMotion) {
    for (let i = runnerParticles.length - 1; i >= 0; i--) {
      let p = runnerParticles[i];
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life;
      ctx.fillRect(p.x, p.y, 4, 4);
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.05;
      ctx.globalAlpha = 1.0;
      if (p.life <= 0) runnerParticles.splice(i, 1);
    }
  }

  ctx.fillStyle = floorCol;
  ctx.fillRect(0, 170, 400, 30);
  ctx.fillStyle = canvasTextColor;
  ctx.font = "bold 14px 'Courier New', monospace";
  ctx.fillText("SCORE: " + score, 10, 20);
  ctx.fillText("HIGH: " + runnerHighScore, 10, 40);

  if (!gameStarted) {
    ctx.textAlign = "center";
    ctx.fillText("Tap or Press Space to Start", 200, 100);
    ctx.textAlign = "left";
  } else if (gameOver) {
    ctx.fillStyle = isContrast ? "#000000" : (kawaiiActive ? "#ff1493" : "#ff0000");
    ctx.font = "bold 24px 'Courier New', monospace";
    ctx.textAlign = "center";
    ctx.fillText(currentRunnerCrash, 200, 80);

    ctx.fillStyle = canvasTextColor;
    ctx.font = "bold 16px 'Courier New', monospace";
    ctx.fillText("Final Score: " + score, 200, 110);

    if (Date.now() - runnerDeathTime > 1000) {
      let pulse = Math.floor(Date.now() / 300) % 2 === 0;
      ctx.shadowBlur = pulse && !isContrast ? 10 : 0;
      ctx.shadowColor = neonColor;
      ctx.fillStyle = pulse ? (isContrast ? "#aaaaaa" : (kawaiiActive ? "#ffb6c1" : "#222")) : (isContrast ? "#000000" : (kawaiiActive ? "#ff1493" : neonColor));
      ctx.fillRect(100, 130, 200, 30);
      ctx.shadowBlur = 0;
      ctx.fillStyle = pulse ? (isContrast ? "#000000" : (kawaiiActive ? "#d11a7a" : neonColor)) : (isContrast ? "#ffffff" : (kawaiiActive ? "#fff" : "#000"));
      ctx.font = "bold 16px 'Courier New', monospace";
      ctx.fillText("PLAY AGAIN", 200, 150);
    }

    ctx.textAlign = "left";
  }
}

function spawnTargetParticles(x, y, color) {
  if (isReducedMotion()) return;
  for (let i = 0; i < 15; i++) {
    targetParticles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 8,
      vy: (Math.random() - 0.5) * 8,
      life: 1.0,
      color
    });
  }
}

function spawnDuck() {
  duckX = randInRange(0, 400 - targetSize);
  duckY = randInRange(0, 200 - targetSize);
  let speed = 2 + (targetSpeedMult * 0.5);
  if (aimbotEnabled) speed *= 1.15;
  duckVelX = (Math.random() > 0.5 ? 1 : -1) * speed;
  duckVelY = (Math.random() > 0.5 ? 1 : -1) * speed;
  duckActive = true;
  const baseTimer = 110 + (targetSpeedMult * 4);
  duckTimer = aimbotEnabled ? (baseTimer * 0.55) : (baseTimer + Math.random() * 50);
  currentDuckColor = rainbowColors[Math.floor(Math.random() * rainbowColors.length)];

  if (targetDecoyEnabled && Math.random() < (aimbotEnabled ? 0.45 : 0.3)) {
    decoyX = randInRange(0, 400 - targetSize);
    decoyY = randInRange(0, 200 - targetSize);
    decoyVx = (Math.random() > 0.5 ? 1 : -1) * (speed * 0.8);
    decoyVy = (Math.random() > 0.5 ? 1 : -1) * (speed * 0.8);
    decoyActive = true;
    decoyTimer = 80;
  } else if (Math.random() < (aimbotEnabled ? 0.18 : 0.1)) {
    goldenX = randInRange(0, 400 - targetSize);
    goldenY = randInRange(0, 200 - targetSize);
    goldenVx = (Math.random() > 0.5 ? 1 : -1) * (speed * 1.5);
    goldenVy = (Math.random() > 0.5 ? 1 : -1) * (speed * 1.5);
    goldenActive = true;
    goldenTimer = 50;
  }

  if (aimbotEnabled) {
    aimbotShotDelay = 10;
    aimbotPulse = 10;
  }
}

function updateTargetGame(currentTime) {
  if (!ctxTarget) return;
  if (!targetGameActive || activeGameMode !== 'target') return;

  targetAnimId = requestAnimationFrame(updateTargetGame);

  if (!currentTime) currentTime = performance.now();
  let dt = currentTime - targetLastTime;
  if (dt < FRAME_INTERVAL) return;
  targetLastTime = currentTime - (dt % FRAME_INTERVAL);

  const isContrast = document.body.classList.contains('a11y-contrast');
  const reducedMotion = isReducedMotion();
  const canvasTextColor = isContrast ? "#000000" : (kawaiiActive ? "#d11a7a" : "#fff");
  const bgCol = isContrast ? "#ffffff" : (kawaiiActive ? "#fff0f5" : "#050510");
  const lineCol = isContrast ? "#cccccc" : (kawaiiActive ? "rgba(255,182,193,0.4)" : "rgba(0,255,255,0.2)");
  const gameNeonColor = isContrast ? "#000000" : neonColor;

  ctxTarget.clearRect(0, 0, 400, 200);

  if (targetState === 'START') {
    ctxTarget.fillStyle = bgCol;
    ctxTarget.fillRect(0, 0, 400, 200);
    if (!reducedMotion) {
      ctxTarget.strokeStyle = lineCol;
      ctxTarget.lineWidth = 2;
      for (let i = 0; i <= 400; i += 40) {
        ctxTarget.beginPath();
        ctxTarget.moveTo(i, 0);
        ctxTarget.lineTo(i, 200);
        ctxTarget.stroke();
      }
      for (let i = 0; i <= 200; i += 40) {
        ctxTarget.beginPath();
        ctxTarget.moveTo(0, i);
        ctxTarget.lineTo(400, i);
        ctxTarget.stroke();
      }
    }
    ctxTarget.fillStyle = isContrast ? "#ffffff" : (kawaiiActive ? "rgba(255,228,225,0.8)" : "rgba(0,0,0,0.7)");
    ctxTarget.fillRect(0, 0, 400, 200);
    ctxTarget.fillStyle = canvasTextColor;
    ctxTarget.font = "bold 20px 'Courier New', monospace";
    ctxTarget.textAlign = "center";
    ctxTarget.fillText("MATRIX TARGET SIMULATOR", 200, 80);
    let pulse = Math.floor(Date.now() / 400) % 2 === 0;
    ctxTarget.fillStyle = pulse ? (isContrast ? "#000000" : (kawaiiActive ? "#ff1493" : "#00ff00")) : canvasTextColor;
    ctxTarget.font = "bold 14px 'Courier New', monospace";
    ctxTarget.fillText("Tap the canvas to start. Select difficulty above.", 200, 120);
    ctxTarget.textAlign = "left";
    return;
  }

  if (targetState === 'GAMEOVER') {
    ctxTarget.fillStyle = isContrast ? "#ffffff" : (kawaiiActive ? "rgba(255,228,225,0.85)" : "rgba(50,0,0,0.85)");
    ctxTarget.fillRect(0, 0, 400, 200);

    if (!isContrast && !reducedMotion) {
      for (let i = 0; i < 20; i++) {
        ctxTarget.strokeStyle = kawaiiActive ? `rgba(255,105,180,${Math.random() * 0.5})` : `rgba(255,0,0,${Math.random() * 0.5})`;
        ctxTarget.strokeRect(Math.random() * 400, Math.random() * 200, Math.random() * 40, Math.random() * 40);
      }
    }

    ctxTarget.fillStyle = isContrast ? "#000000" : (kawaiiActive ? "#ff1493" : "#ff0000");
    ctxTarget.font = "bold 24px 'Courier New', monospace";
    ctxTarget.textAlign = "center";
    ctxTarget.fillText(currentTargetCrash, 200, 80);
    ctxTarget.fillStyle = canvasTextColor;
    ctxTarget.font = "bold 16px 'Courier New', monospace";
    ctxTarget.fillText("Final Score: " + targetScore, 200, 110);

    if (Date.now() - targetDeathTime > 1000) {
      let pulse = Math.floor(Date.now() / 300) % 2 === 0;
      ctxTarget.shadowBlur = pulse && !isContrast ? 10 : 0;
      ctxTarget.shadowColor = neonColor;
      ctxTarget.fillStyle = pulse ? (isContrast ? "#aaaaaa" : (kawaiiActive ? "#ffb6c1" : "#222")) : (isContrast ? "#000000" : (kawaiiActive ? "#ff1493" : neonColor));
      ctxTarget.fillRect(100, 130, 200, 30);
      ctxTarget.shadowBlur = 0;
      ctxTarget.fillStyle = pulse ? (isContrast ? "#000000" : (kawaiiActive ? "#d11a7a" : neonColor)) : (isContrast ? "#ffffff" : (kawaiiActive ? "#fff" : "#000"));
      ctxTarget.font = "bold 16px 'Courier New', monospace";
      ctxTarget.fillText("PLAY AGAIN", 200, 150);
    }

    ctxTarget.textAlign = "left";
    return;
  }

  ctxTarget.fillStyle = bgCol;
  ctxTarget.fillRect(0, 0, 400, 200);

  if (!reducedMotion) {
    ctxTarget.strokeStyle = lineCol;
    ctxTarget.lineWidth = 2;
    let timeOffset = (Date.now() / 20) % 40;
    for (let i = -40; i < 200; i += 40) {
      ctxTarget.beginPath();
      ctxTarget.moveTo(0, i + timeOffset);
      ctxTarget.lineTo(400, i + timeOffset);
      ctxTarget.stroke();
    }
    for (let i = 0; i <= 400; i += 40) {
      ctxTarget.beginPath();
      ctxTarget.moveTo(i, 0);
      ctxTarget.lineTo(i, 200);
      ctxTarget.stroke();
    }
  }

  if (duckActive) {
    duckX += duckVelX;
    duckY += duckVelY;
    if (duckX <= 0 || duckX + targetSize >= 400) duckVelX *= -1;
    if (duckY <= 0 || duckY + targetSize >= 200) duckVelY *= -1;

    let radius = targetSize / 2;
    let centerX = duckX + radius;
    let centerY = duckY + radius;

    ctxTarget.fillStyle = isContrast ? "#000000" : currentDuckColor;
    ctxTarget.beginPath();
    ctxTarget.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctxTarget.fill();

    ctxTarget.fillStyle = isContrast ? "#ffffff" : "#000";
    ctxTarget.beginPath();
    ctxTarget.arc(centerX, centerY, radius * 0.6, 0, Math.PI * 2);
    ctxTarget.fill();

    ctxTarget.fillStyle = isContrast ? "#000000" : currentDuckColor;
    ctxTarget.beginPath();
    ctxTarget.arc(centerX, centerY, radius * 0.2, 0, Math.PI * 2);
    ctxTarget.fill();

    if (!targetFreeze) duckTimer--;
    if (duckTimer <= 0) {
      duckActive = false;
      targetLives--;
      if (targetLives <= 0 && targetState !== 'GAMEOVER') {
        targetState = 'GAMEOVER';
        targetDeathTime = Date.now();
        currentTargetCrash = targetCrashMessages[Math.floor(Math.random() * targetCrashMessages.length)];
        triggerShake();
        announce(`Game over. Final score: ${targetScore}.`);
      }
    }
  } else {
    const spawnChance = aimbotEnabled ? 0.18 : 0.05;
    if (Math.random() < spawnChance) spawnDuck();
  }

  if (goldenActive) {
    goldenX += goldenVx;
    goldenY += goldenVy;
    if (goldenX <= 0 || goldenX + targetSize >= 400) goldenVx *= -1;
    if (goldenY <= 0 || goldenY + targetSize >= 200) goldenVy *= -1;

    let gRadius = targetSize / 2;
    let gCx = goldenX + gRadius;
    let gCy = goldenY + gRadius;

    ctxTarget.shadowBlur = isContrast ? 0 : 15;
    ctxTarget.shadowColor = "#FFD700";
    ctxTarget.fillStyle = isContrast ? "#000000" : "#FFD700";
    ctxTarget.beginPath();
    ctxTarget.arc(gCx, gCy, gRadius, 0, Math.PI * 2);
    ctxTarget.fill();

    ctxTarget.fillStyle = isContrast ? "#ffffff" : "#fff";
    ctxTarget.beginPath();
    ctxTarget.arc(gCx, gCy, gRadius * 0.6, 0, Math.PI * 2);
    ctxTarget.fill();

    ctxTarget.fillStyle = isContrast ? "#000000" : "#FFD700";
    ctxTarget.beginPath();
    ctxTarget.arc(gCx, gCy, gRadius * 0.2, 0, Math.PI * 2);
    ctxTarget.fill();
    ctxTarget.shadowBlur = 0;

    if (!targetFreeze) goldenTimer--;
    if (goldenTimer <= 0) goldenActive = false;
  }

  if (decoyActive) {
    decoyX += decoyVx;
    decoyY += decoyVy;
    if (decoyX <= 0 || decoyX + targetSize >= 400) decoyVx *= -1;
    if (decoyY <= 0 || decoyY + targetSize >= 200) decoyVy *= -1;

    let dRadius = targetSize / 2;
    let dCx = decoyX + dRadius;
    let dCy = decoyY + dRadius;

    ctxTarget.fillStyle = isContrast ? "#000000" : "#ff0000";
    ctxTarget.beginPath();
    ctxTarget.arc(dCx, dCy, dRadius, 0, Math.PI * 2);
    ctxTarget.fill();

    ctxTarget.fillStyle = isContrast ? "#ffffff" : "#000";
    ctxTarget.beginPath();
    ctxTarget.arc(dCx, dCy, dRadius * 0.6, 0, Math.PI * 2);
    ctxTarget.fill();

    ctxTarget.fillStyle = isContrast ? "#000000" : "#ff0000";
    ctxTarget.beginPath();
    ctxTarget.arc(dCx, dCy, dRadius * 0.2, 0, Math.PI * 2);
    ctxTarget.fill();

    if (!targetFreeze) decoyTimer--;
    if (decoyTimer <= 0) decoyActive = false;
  }

  if (aimbotEnabled) {
    aimbotPulse = Math.max(aimbotPulse - 1, 0);
    ctxTarget.save();
    ctxTarget.shadowBlur = 14;
    ctxTarget.shadowColor = aimbotPulse > 0 ? "#00ffff" : "#ff00ff";
    ctxTarget.fillStyle = aimbotPulse > 0 ? "#00ffff" : "#ff00ff";
    ctxTarget.font = "bold 11px 'Courier New', monospace";
    ctxTarget.textAlign = "right";
    ctxTarget.fillText("AIMBOT: ON", 390, 40);
    ctxTarget.restore();
  }

  for (let i = targetFloatingScores.length - 1; i >= 0; i--) {
    let f = targetFloatingScores[i];
    ctxTarget.fillStyle = isContrast ? "#000000" : `rgba(${f.r}, ${f.g}, ${f.b}, ${f.alpha})`;
    ctxTarget.font = "bold 16px 'Courier New', monospace";
    ctxTarget.fillText(f.text, f.x, f.y);
    f.y -= 1;
    f.alpha -= 0.02;
    if (f.alpha <= 0) targetFloatingScores.splice(i, 1);
  }

  if (!reducedMotion) {
    for (let i = targetParticles.length - 1; i >= 0; i--) {
      let p = targetParticles[i];
      ctxTarget.fillStyle = p.color;
      ctxTarget.globalAlpha = p.life;
      ctxTarget.fillRect(p.x, p.y, 3, 3);
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.05;
      ctxTarget.globalAlpha = 1.0;
      if (p.life <= 0) targetParticles.splice(i, 1);
    }
  }

  if (aimbotEnabled && duckActive && targetState === 'PLAYING') {
    if (aimbotShotDelay > 0) {
      aimbotShotDelay--;
    } else {
      const duckCx = duckX + targetSize / 2;
      const duckCy = duckY + targetSize / 2;
      targetScore++;
      targetFloatingScores.push({ x: duckCx + 10, y: duckCy, alpha: 1.0, text: "+1", r: 0, g: 255, b: 255 });
      spawnTargetParticles(duckCx, duckCy, "#00ffff");
      duckActive = false;
      aimbotPulse = 8;
      if (targetScore > 0 && targetScore % 5 === 0) targetSpeedMult += 1;
      if (targetScore > targetHighScore) {
        targetHighScore = targetScore;
        try { localStorage.setItem('matrixTargetHighScore', targetHighScore); } catch(err) {}
      }
    }
  }

  ctxTarget.beginPath();
  ctxTarget.moveTo(mouseX - 15, mouseY);
  ctxTarget.lineTo(mouseX + 15, mouseY);
  ctxTarget.moveTo(mouseX, mouseY - 15);
  ctxTarget.lineTo(mouseX, mouseY + 15);
  ctxTarget.strokeStyle = isContrast ? "#000000" : (aimbotEnabled ? "#00ffff" : (kawaiiActive ? "#ff1493" : neonColor));
  ctxTarget.lineWidth = 1;
  ctxTarget.stroke();

  ctxTarget.beginPath();
  ctxTarget.arc(mouseX, mouseY, 8, 0, Math.PI * 2);
  ctxTarget.stroke();

  ctxTarget.fillStyle = canvasTextColor;
  ctxTarget.font = "bold 14px 'Courier New', monospace";
  ctxTarget.fillText("SCORE: " + targetScore, 10, 20);
  ctxTarget.fillText("HIGH: " + targetHighScore, 10, 40);
  ctxTarget.fillText("LIVES: " + (targetFreeze ? "∞" : targetLives), 320, 20);
}

function cloneTetrisShape(matrix) {
  return matrix.map(row => row.slice());
}

function initTetris() {
  tetrisGrid = Array.from({ length: 20 }, () => Array(10).fill(0));
  tetrisScore = 0;
  tetrisLines = 0;
  tetrisLevel = 1;
  tetrisGameOver = false;
  tetrisFloaters = [];
  nextPiece = null;
  let speedInput = document.getElementById('modTetrisSpeed');
  if (speedInput) tetrisSpeedMod = parseInt(speedInput.value);
  tReset();
}

function tCollide(board, player) {
  const m = player.matrix;
  const o = player.pos;
  for (let y = 0; y < m.length; ++y) {
    for (let x = 0; x < m[y].length; ++x) {
      if (m[y][x] !== 0) {
        const boardY = y + o.y;
        const boardX = x + o.x;
        if (boardY >= board.length || boardX < 0 || boardX >= board[0].length) return true;
        if (board[boardY][boardX] !== 0) return true;
      }
    }
  }
  return false;
}

function tMerge() {
  currentPiece.matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== 0) {
        tetrisGrid[y + currentPiece.pos.y][x + currentPiece.pos.x] = value;
      }
    });
  });
}

function tReset() {
  const pieces = '1234567';
  const type = parseInt(pieces[Math.floor(Math.random() * pieces.length)]);

  if (!nextPiece) {
    nextPiece = { matrix: cloneTetrisShape(T_SHAPES[type]), pos: { x: 0, y: 0 } };
  }

  currentPiece = nextPiece;
  currentPiece.pos.y = 0;
  currentPiece.pos.x = Math.floor((10 / 2) - (currentPiece.matrix[0].length / 2));

  const nextType = parseInt(pieces[Math.floor(Math.random() * pieces.length)]);
  nextPiece = { matrix: cloneTetrisShape(T_SHAPES[nextType]), pos: { x: 0, y: 0 } };

  if (tCollide(tetrisGrid, currentPiece)) {
    if (tetrisGodMode) {
      tetrisGrid.forEach(row => row.fill(0));
    } else {
      tetrisGameOver = true;
      tetrisDeathTime = Date.now();
      tetrisCrashMsg = tetrisCrashMessages[Math.floor(Math.random() * tetrisCrashMessages.length)];
      triggerShake();
      announce(`Game over. Final score: ${tetrisScore}.`);
    }
  }
}

function tDrop() {
  if (!currentPiece) return;
  currentPiece.pos.y++;
  if (tCollide(tetrisGrid, currentPiece)) {
    currentPiece.pos.y--;
    tMerge();
    tReset();
    tSweep();
  }
  tetrisDropCounter = 0;
}

function tMove(dir) {
  if (!currentPiece) return;
  currentPiece.pos.x += dir;
  if (tCollide(tetrisGrid, currentPiece)) {
    currentPiece.pos.x -= dir;
  }
}

function tRotate() {
  if (!currentPiece) return;
  const pos = currentPiece.pos.x;
  let offset = 1;
  tRotateMatrix(currentPiece.matrix);

  while (tCollide(tetrisGrid, currentPiece)) {
    currentPiece.pos.x += offset;
    offset = -(offset + (offset > 0 ? 1 : -1));
    if (offset > currentPiece.matrix[0].length) {
      tRotateMatrix(currentPiece.matrix, -1);
      currentPiece.pos.x = pos;
      return;
    }
  }
}

function tRotateMatrix(matrix, dir = 1) {
  for (let y = 0; y < matrix.length; ++y) {
    for (let x = 0; x < y; ++x) {
      [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
    }
  }
  if (dir > 0) matrix.forEach(row => row.reverse());
  else matrix.reverse();
}

function tSweep() {
  let rowCount = 1;
  let linesCleared = 0;
  outer: for (let y = tetrisGrid.length - 1; y >= 0; --y) {
    for (let x = 0; x < tetrisGrid[y].length; ++x) {
      if (tetrisGrid[y][x] === 0) continue outer;
    }
    const row = tetrisGrid.splice(y, 1)[0].fill(0);
    tetrisGrid.unshift(row);
    ++y;
    tetrisScore += (rowCount * 10) * tetrisScoreMult;
    rowCount *= 2;
    linesCleared++;
  }

  if (linesCleared > 0) {
    tetrisLines += linesCleared;
    tetrisLevel = Math.floor(tetrisLines / 10) + 1;
    tetrisFloaters.push({ x: 200, y: 200, alpha: 1.5, text: linesCleared + " LINES!" });
    announce(`${linesCleared} line${linesCleared > 1 ? 's' : ''} cleared. Score: ${tetrisScore}.`);
    if (tetrisScore > tetrisHighScore) {
      tetrisHighScore = tetrisScore;
      try { localStorage.setItem('tetrisHighScore', tetrisHighScore); } catch(e) {}
    }
  }
}

function updateTetris(currentTime) {
  if (!ctxTetris) return;
  if (!tetrisActive || activeGameMode !== 'tetris') return;

  tetrisAnimId = requestAnimationFrame(updateTetris);

  if (!currentTime) currentTime = performance.now();
  let dt = currentTime - tetrisLastTime;
  if (dt < FRAME_INTERVAL) return;
  tetrisLastTime = currentTime - (dt % FRAME_INTERVAL);

  const isContrast = document.body.classList.contains('a11y-contrast');
  const reducedMotion = isReducedMotion();
  const canvasTextColor = isContrast ? "#000000" : (kawaiiActive ? "#d11a7a" : "#fff");
  const gameNeonColor = isContrast ? "#000000" : neonColor;

  ctxTetris.fillStyle = isContrast ? "#ffffff" : (kawaiiActive ? '#fffafa' : '#000000');
  ctxTetris.fillRect(0, 0, 400, 400);

  if (!isContrast && !reducedMotion) {
    ctxTetris.fillStyle = kawaiiActive ? 'rgba(255,182,193,0.8)' : 'rgba(255,255,255,0.4)';
    tetrisStars.forEach(star => {
      star.y += star.v;
      if (star.y > 400) {
        star.y = 0;
        star.x = Math.random() * 400;
      }
      ctxTetris.fillRect(star.x, star.y, star.s, star.s);
    });
  }

  if (tetrisGameOver) {
    ctxTetris.fillStyle = isContrast ? "#ffffff" : (kawaiiActive ? "rgba(255,240,245,0.85)" : "rgba(0,20,20,0.85)");
    ctxTetris.fillRect(0, 0, 400, 400);

    if (!isContrast && !reducedMotion) {
      for(let i = 0; i < 20; i++) {
        ctxTetris.fillStyle = kawaiiActive ? `rgba(255,182,193,${Math.random() * 0.3})` : `rgba(0,255,255,${Math.random() * 0.3})`;
        ctxTetris.fillRect(Math.floor(Math.random() * 20) * 20, Math.floor(Math.random() * 20) * 20, 20, 20);
      }
    }

    ctxTetris.fillStyle = isContrast ? "#000000" : (kawaiiActive ? "#ff1493" : "cyan");
    ctxTetris.font = "bold 24px 'Courier New', monospace";
    ctxTetris.textAlign = "center";
    ctxTetris.fillText(tetrisCrashMsg, 200, 160);
    ctxTetris.fillStyle = canvasTextColor;
    ctxTetris.font = "bold 16px 'Courier New', monospace";
    ctxTetris.fillText("Final Score: " + tetrisScore, 200, 200);

    if (Date.now() - tetrisDeathTime > 1000) {
      let pulse = Math.floor(Date.now() / 300) % 2 === 0;
      ctxTetris.shadowBlur = pulse && !isContrast ? 10 : 0;
      ctxTetris.shadowColor = gameNeonColor;
      ctxTetris.fillStyle = pulse ? (isContrast ? "#aaaaaa" : (kawaiiActive ? "#ffb6c1" : "#222")) : (isContrast ? "#000000" : (kawaiiActive ? "#ff1493" : gameNeonColor));
      ctxTetris.fillRect(100, 240, 200, 30);
      ctxTetris.shadowBlur = 0;
      ctxTetris.fillStyle = pulse ? (isContrast ? "#000000" : (kawaiiActive ? "#d11a7a" : gameNeonColor)) : (isContrast ? "#ffffff" : (kawaiiActive ? "#fff" : "#000"));
      ctxTetris.font = "bold 16px 'Courier New', monospace";
      ctxTetris.fillText("PLAY AGAIN", 200, 260);
    }

    ctxTetris.textAlign = "left";
    return;
  }

  if (!reducedMotion) {
    ctxTetris.strokeStyle = isContrast ? "#cccccc" : (kawaiiActive ? 'rgba(255,105,180,0.4)' : 'rgba(255,255,255,0.4)');
    ctxTetris.lineWidth = 1;
    for(let i = 100; i <= 300; i += 20) {
      ctxTetris.beginPath();
      ctxTetris.moveTo(i, 0);
      ctxTetris.lineTo(i, 400);
      ctxTetris.stroke();
    }
    for(let i = 0; i <= 400; i += 20) {
      ctxTetris.beginPath();
      ctxTetris.moveTo(100, i);
      ctxTetris.lineTo(300, i);
      ctxTetris.stroke();
    }
  }

  let time = Date.now() / 5;
  tetrisGrid.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== 0) {
        let blockColor = isContrast ? "#000000" : (tetrisRainbow ? `hsl(${Math.floor(time + (x + y) * 15) % 360}, 100%, 50%)` : T_COLORS[value]);
        ctxTetris.fillStyle = blockColor;
        ctxTetris.fillRect(100 + x * 20, y * 20, 20, 20);
        ctxTetris.strokeStyle = isContrast ? "#ffffff" : "#fff";
        ctxTetris.strokeRect(100 + x * 20, y * 20, 20, 20);
      }
    });
  });

  if (tetrisGhost && currentPiece) {
    let ghostY = currentPiece.pos.y;
    while (!tCollide(tetrisGrid, { matrix: currentPiece.matrix, pos: { x: currentPiece.pos.x, y: ghostY + 1 } })) ghostY++;
    currentPiece.matrix.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value !== 0) {
          ctxTetris.fillStyle = isContrast ? "rgba(0,0,0,0.2)" : (kawaiiActive ? "rgba(255,105,180,0.2)" : "rgba(255,255,255,0.2)");
          ctxTetris.fillRect(100 + (x + currentPiece.pos.x) * 20, (y + ghostY) * 20, 20, 20);
          ctxTetris.strokeStyle = isContrast ? "rgba(0,0,0,0.5)" : (kawaiiActive ? "rgba(255,105,180,0.5)" : "rgba(255,255,255,0.5)");
          ctxTetris.strokeRect(100 + (x + currentPiece.pos.x) * 20, (y + ghostY) * 20, 20, 20);
        }
      });
    });
  }

  currentPiece.matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== 0) {
        let blockColor = isContrast ? "#000000" : (tetrisRainbow ? `hsl(${Math.floor(time + (x + currentPiece.pos.x + y + currentPiece.pos.y) * 15) % 360}, 100%, 50%)` : T_COLORS[value]);
        ctxTetris.fillStyle = blockColor;
        ctxTetris.fillRect(100 + (x + currentPiece.pos.x) * 20, (y + currentPiece.pos.y) * 20, 20, 20);
        ctxTetris.strokeStyle = isContrast ? "#ffffff" : "#fff";
        ctxTetris.strokeRect(100 + (x + currentPiece.pos.x) * 20, (y + currentPiece.pos.y) * 20, 20, 20);
      }
    });
  });

  if (!reducedMotion) {
    for (let i = tetrisFloaters.length - 1; i >= 0; i--) {
      let f = tetrisFloaters[i];
      ctxTetris.shadowBlur = isContrast ? 0 : 10;
      ctxTetris.shadowColor = kawaiiActive ? "#ff1493" : "#00FFFF";
      ctxTetris.fillStyle = isContrast ? `rgba(0,0,0,${f.alpha})` : (kawaiiActive ? `rgba(209,26,122,${f.alpha})` : `rgba(0,255,255,${f.alpha})`);
      ctxTetris.font = "bold 24px 'Courier New', monospace";
      ctxTetris.textAlign = "center";
      ctxTetris.fillText(f.text, f.x, f.y);
      ctxTetris.shadowBlur = 0;
      ctxTetris.textAlign = "left";
      f.y -= 1;
      f.alpha -= 0.02;
      if (f.alpha <= 0) tetrisFloaters.splice(i, 1);
    }
  }

  tetrisDropCounter++;
  let limit = tetrisSlow ? 200 : Math.max(2, 60 - (tetrisSpeedMod * 2.5) - ((tetrisLevel - 1) * 3));
  if (!tetrisSlow && limit < 2) limit = 2;
  if (tetrisDropCounter > limit && !tetrisLock) tDrop();

  function tHud(lx,ly,lw,lh,label,val,c) {
    let hudBg = isContrast ? '#ffffff' : (kawaiiActive ? 'rgba(255,228,225,0.9)' : 'rgba(0,0,0,0.8)');
    let hudBorder = isContrast ? '#000000' : (kawaiiActive ? '#ff69b4' : c);
    let hudTextCol = isContrast ? '#000000' : ((c === 'cyan' && kawaiiActive) ? '#d11a7a' : c);

    ctxTetris.fillStyle = hudBg;
    ctxTetris.fillRect(lx,ly,lw,lh);
    ctxTetris.strokeStyle = hudBorder;
    ctxTetris.lineWidth = 1.5;
    ctxTetris.strokeRect(lx,ly,lw,lh);

    ctxTetris.fillStyle = hudTextCol;
    ctxTetris.font = 'bold 9px monospace';
    ctxTetris.textAlign = 'center';
    ctxTetris.fillText(label,lx+lw/2,ly+12);

    ctxTetris.font = 'bold 13px monospace';
    ctxTetris.fillText(String(val),lx+lw/2,ly+28);

    ctxTetris.textAlign = 'left';
    ctxTetris.lineWidth = 1;
  }

  tHud(4, 10, 90, 34, 'SCORE', tetrisScore, 'cyan');
  tHud(4, 50, 90, 34, 'HIGH', tetrisHighScore, '#ff00ff');
  tHud(4, 90, 43, 34, 'LVL', tetrisLevel, '#00ff88');
  tHud(51, 90, 43, 34, 'LINES', tetrisLines, '#ffaa00');

  let nHudBg = isContrast ? '#ffffff' : (kawaiiActive ? 'rgba(255,228,225,0.9)' : 'rgba(0,0,0,0.8)');
  let nHudBorder = isContrast ? '#000000' : (kawaiiActive ? '#ff69b4' : 'cyan');
  let nHudText = isContrast ? '#000000' : (kawaiiActive ? '#d11a7a' : 'cyan');

  ctxTetris.fillStyle = nHudBg;
  ctxTetris.fillRect(307,10,88,88);
  ctxTetris.strokeStyle = nHudBorder;
  ctxTetris.lineWidth = 1.5;
  ctxTetris.strokeRect(307,10,88,88);
  ctxTetris.fillStyle = nHudText;
  ctxTetris.font = 'bold 9px monospace';
  ctxTetris.textAlign = 'center';
  ctxTetris.fillText('NEXT',351,23);
  ctxTetris.textAlign = 'left';
  ctxTetris.lineWidth = 1;

  if(nextPiece){
    const nm = nextPiece.matrix;
    const bs = 14;
    const ox = 351 - (nm[0].length * bs) / 2;
    const oy = 58 - (nm.length * bs) / 2;

    nm.forEach((row,y) => {
      row.forEach((val,x) => {
        if (val !== 0) {
          let nc = isContrast ? "#000000" : (tetrisRainbow ? `hsl(${Math.floor(time + (x+y)*15) % 360},100%,50%)` : T_COLORS[val]);
          ctxTetris.fillStyle = nc;
          ctxTetris.fillRect(ox + x * bs, oy + y * bs, bs - 1, bs - 1);
          ctxTetris.strokeStyle = isContrast ? "#ffffff" : '#fff';
          ctxTetris.lineWidth = 0.5;
          ctxTetris.strokeRect(ox + x * bs, oy + y * bs, bs - 1, bs - 1);
        }
      });
    });
  }

  ctxTetris.lineWidth = 1;
}

const NEXUS_API = 'https://nexus-terminalnexus.onrender.com';

function _nexusLog(logEl, color, text) {
  const p = document.createElement('p');
  p.style.cssText = `color:${color}; margin:2px 0; line-height:1.5;`;
  p.textContent = text;
  logEl.appendChild(p);
  logEl.scrollTop = logEl.scrollHeight;
  return p;
}

async function _nexusCheckStatus() {
  const dot   = document.getElementById('nexus-status-dot');
  const msEl  = document.getElementById('nexus-ping-ms');
  const t0    = Date.now();
  try {
    const res  = await fetch(`${NEXUS_API}/ping`, { signal: AbortSignal.timeout(6000) });
    const ms   = Date.now() - t0;
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      const ver  = data.version || '';
      if (dot)  { dot.style.color = '#0f0'; dot.textContent = `● ONLINE${ver ? ' ' + ver : ''}`; }
      if (msEl) msEl.textContent = `PING: ${ms}ms`;
      return { ok: true, ms, version: ver };
    }
  } catch (_) {}
  if (dot)  { dot.style.color = '#f44'; dot.textContent = '● OFFLINE'; }
  if (msEl) msEl.textContent = 'PING: --';
  return { ok: false, ms: null, version: null };
}

async function fetchLatestCommitStatus() {
  const CACHE_KEY = 'nexus_commit_cache';
  const CACHE_TTL = 20 * 60 * 1000;
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;
  } catch {}
  try {
    const res = await fetch('https://api.github.com/repos/Thyfwx/thyfwxit/commits?per_page=1', {
      headers: { 'Accept': 'application/vnd.github.v3+json' }
    });
    if (!res.ok) return null;
    const [commit] = await res.json();
    if (!commit) return null;
    const msg = commit.commit.message.split('\n')[0];
    const hoursAgo = (Date.now() - new Date(commit.commit.author.date).getTime()) / 3600000;
    const data = { msg, hoursAgo, sha: commit.sha.slice(0, 7) };
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data })); } catch {}
    return data;
  } catch { return null; }
}

function initNexusPreview() {
  const logEl = document.getElementById('nexus-preview-log');
  logEl.innerHTML = '';

  const bootWords = [
    { label: 'BOOT',  text: 'Initializing quantum uplink...' },
    { label: 'SCAN',  text: 'Probing neural pathways...' },
    { label: 'SYNC',  text: 'Handshaking with mainframe...' },
    { label: 'CRYPT', text: 'Securing encrypted channel...' },
    { label: 'AUTH',  text: 'Verifying node credentials...' },
    { label: 'ALLOC', text: 'Allocating memory buffers...' },
    { label: 'EXEC',  text: 'Spawning AI core process...' },
  ];
  let i = 0;

  function step() {
    if (i >= bootWords.length) {
      Promise.all([fetchLatestCommitStatus(), _nexusCheckStatus()]).then(([info, { ok, ms, version }]) => {
        if (info) {
          const age = info.hoursAgo < 1
            ? 'just now'
            : info.hoursAgo < 24
              ? `${Math.round(info.hoursAgo)}h ago`
              : `${Math.round(info.hoursAgo / 24)}d ago`;
          const label = info.hoursAgo < 6  ? '[ACTIVE]' : info.hoursAgo < 48 ? '[DEV]' : '[LOG]';
          const color = info.hoursAgo < 6  ? '#00ff88' : info.hoursAgo < 48  ? '#ff9100' : '#555';
          _nexusLog(logEl, color, `${label} ${info.msg} · ${age}`);
        }
        if (ok) {
          _nexusLog(logEl, '#00ff00', `[OK] Nexus AI ${version || 'v5.3.0'} online. Latency: ${ms}ms`);
          _nexusLog(logEl, '#0ff',    '[SYS] AI core ready — press PING or open full console.');
        } else {
          _nexusLog(logEl, '#f44',    '[ERR] Backend unreachable. Node may be cold-starting.');
          _nexusLog(logEl, '#555',    '[SYS] Try again in ~30s or open console directly.');
        }
      });
      return;
    }
    const w = bootWords[i++];
    _nexusLog(logEl, '#444', `[${w.label}] ${w.text}`);
    setTimeout(step, 160);
  }
  step();
}

const PING_CARDS = [
  'Nexus AI is built and maintained by Xavier Scott — systems specialist, hardware repair tech, and homelab builder. Open the console to have a real conversation with it.',
  'Xavier Scott built the AI, the server behind it — all of it. Ask Nexus anything: code, tech questions, random thoughts. Open the full console to start chatting.',
  'This terminal is Xavier Scott\'s work. He runs his own infrastructure and thought a portfolio should be interactive, not just a PDF. Hit "Open Console" to talk to the AI directly.',
  'Nexus AI v5.3.0 — live and ready. Xavier Scott built it so visitors could actually ask questions instead of just reading a page. Give it a try.',
  'Built by Xavier Scott — network infrastructure, component-level hardware repair, homelab setups. The full console has games, tools, and an AI that actually responds.',
  'Xavier Scott wired this up. Tech question, weird idea, or just curious what an AI says — open the full console and find out.',
];

let _pingIdx = Math.floor(Math.random() * PING_CARDS.length);

function sendNexusPing() {
  const logEl = document.getElementById('nexus-preview-log');
  const t0    = Date.now();

  const waiting = _nexusLog(logEl, '#555', '[PING] Sending packet to Nexus node...');

  fetch(`${NEXUS_API}/ping`, { signal: AbortSignal.timeout(6000) })
    .then(r => {
      const ms = Date.now() - t0;
      waiting.remove();
      _nexusLog(logEl, '#00ff00', `[PONG] Response: ${ms}ms — node is live.`);

      const text = PING_CARDS[_pingIdx % PING_CARDS.length];
      _pingIdx++;
      _nexusLog(logEl, '#0ff', text);

      const nudge = document.createElement('p');
      nudge.style.cssText = 'font-size:0.72rem; color:#555; margin:4px 0 10px; border-top:1px solid #1a1a1a; padding-top:6px;';
      nudge.innerHTML = '↗ <span style="color:var(--neon-color);cursor:pointer;text-decoration:underline;" onclick="window.location.href=\'/nexus/\'">Open full console</span> to chat with Nexus AI.';
      logEl.appendChild(nudge);
      logEl.scrollTop = logEl.scrollHeight;

      const dot  = document.getElementById('nexus-status-dot');
      const msEl = document.getElementById('nexus-ping-ms');
      if (dot)  { dot.style.color = '#0f0'; dot.textContent = '● ONLINE'; }
      if (msEl) msEl.textContent = `PING: ${ms}ms`;
    })
    .catch(() => {
      waiting.remove();
      _nexusLog(logEl, '#f44', '[PING] No response — node may be cold-starting (~30s).');
    });

  while (logEl.childNodes.length > 40) logEl.removeChild(logEl.firstChild);
}


// --- Passive Visitor Logger ---
(function logVisitor() {
  if (sessionStorage.getItem('_vl')) return; // once per session
  sessionStorage.setItem('_vl', '1');

  function parseDevice(ua) {
    if (/iPhone/.test(ua)) { const v=(ua.match(/iPhone OS ([\d_]+)/)||[])[1]; return `iPhone · iOS ${v?v.replace(/_/g,'.'):'?'}`; }
    if (/iPad/.test(ua))   { const v=(ua.match(/OS ([\d_]+)/)||[])[1]; return `iPad · iPadOS ${v?v.replace(/_/g,'.'):'?'}`; }
    if (/Android/.test(ua)){ const m=ua.match(/Android ([\d.]+);?\s*([^;)Build]+)?/); const ver=m?`Android ${m[1]}`:'Android'; const model=m&&m[2]?m[2].trim():''; return model?`${model} · ${ver}`:ver; }
    if (/Windows/.test(ua)){ const n=(ua.match(/Windows NT ([\d.]+)/)||[])[1]; const w={'10.0':'10/11','6.3':'8.1','6.2':'8','6.1':'7'}[n]||n||'?'; const b=/Edg\//.test(ua)?'Edge':/Chrome\//.test(ua)?'Chrome':/Firefox\//.test(ua)?'Firefox':'Browser'; return `Windows ${w} · ${b}`; }
    if (/Mac OS X/.test(ua)){ const v=((ua.match(/Mac OS X ([\d_]+)/)||[])[1]||'').replace(/_/g,'.'); const b=/Edg\//.test(ua)?'Edge':/Chrome\//.test(ua)?'Chrome':/Firefox\//.test(ua)?'Firefox':/Safari\//.test(ua)?'Safari':'Browser'; return `macOS ${v} · ${b}`; }
    if (/Linux/.test(ua)) return 'Linux Desktop';
    return 'Unknown';
  }

  const WEBHOOK = window.location.origin + '/api/telemetry';
  const device = parseDevice(navigator.userAgent);
  const scrn   = `${window.screen.width}×${window.screen.height}`;
  const lang   = navigator.language || '?';
  const tz     = Intl.DateTimeFormat().resolvedOptions().timeZone || '?';
  const cores  = navigator.hardwareConcurrency || '?';
  const mem    = navigator.deviceMemory ? navigator.deviceMemory + ' GB' : '?';
  const conn   = navigator.connection ? (navigator.connection.effectiveType || '?') : '?';

  // Delay 4s so it doesn't fire simultaneously with page load — reduces WAF flags
  setTimeout(async () => {
    const ts = new Date().toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' });
    let ip = '?', city = '', country = '';
    try {
      const d = await fetch('https://ipinfo.io/json').then(r => r.json());
      if (d.ip) { ip = d.ip; city = d.city || ''; country = d.country || ''; }
    } catch(_) {}

    const loc = [city, country].filter(Boolean).join(', ') || tz;
    const content = [
      `\`[${ts}]\` 🏠 **Main Site Visit**`,
      `🖥️  **Device:**   ${device}`,
      `🌐  **IP:**       ${ip}  —  ${loc}`,
      `📐  **Screen:**   ${scrn}`,
      `🌍  **Language:** ${lang}  ·  Timezone: ${tz}`,
      `⚙️   **Hardware:** ${cores} cores  ·  ${mem} RAM`,
      `📶  **Network:**  ${conn}`,
    ].join('\n');

    fetch(WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    }).catch(() => {});
  }, 4000);
})();


// ── Form AJAX submit with success state ──
(function() {
  const form = document.getElementById('secureContactForm');
  if (!form) return;
  form.addEventListener('submit', async function(e) {
    e.preventDefault();
    const btn = form.querySelector('button[type=submit]');
    const orig = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Sending...';
    try {
      const res = await fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { 'Accept': 'application/json' }
      });
      if (res.ok) {
        form.style.display = 'none';
        const success = document.getElementById('formSuccess');
        if (success) success.style.display = 'block';
      } else {
        btn.disabled = false;
        btn.textContent = orig;
        alert('Something went wrong. Please try again.');
      }
    } catch {
      btn.disabled = false;
      btn.textContent = orig;
      alert('Network error. Please try again.');
    }
  });
})();

// ── Daily tech tip (rotates by calendar day) ──
(function() {
  const tips = [
    "Applying fresh <b>thermal paste</b> every few years prevents processor throttling and extends hardware life — one of the easiest performance wins on any machine.",
    "The <b>3-2-1 backup rule</b>: 3 copies of your data, on 2 different media types, with 1 stored offsite. Most people skip the offsite part until it's too late.",
    "Use a password manager. Not the one built into your browser — a real one. One strong master password beats 50 weak reused ones.",
    "If a <b>MacBook</b> won't power on after liquid damage, remove the battery immediately and let it dry for 48+ hours before attempting anything else.",
    "<b>Proxmox VE</b> snapshots before any major update let you roll back in seconds if something breaks. Always snapshot first.",
    "Run <b>AdGuard Home</b> on your network and ads disappear on every device — phone, TV, laptop — without installing anything on each one.",
    "A <b>UPS</b> (uninterruptible power supply) protects your home lab from dirty power and sudden outages. Cheap insurance for expensive hardware.",
    "<b>Home Assistant</b> automations can alert you the moment a device goes offline — before you'd ever notice manually.",
    "Before opening a <b>MacBook</b> for repair, use a spudger and gentle heat — never force the case or you'll crack it.",
    "Use <b>Portainer</b> to manage Docker containers visually. Logs, restarts, stack files — all in a browser instead of long terminal commands.",
    "On <b>macOS</b>, hold Option at boot to pick a startup disk, or Command+R to get into Recovery Mode without any external tools.",
    "<b>SMART data</b> from your drives often warns of failure weeks before it happens. Check it periodically — <b>CrystalDiskInfo</b> on Windows, <b>DriveDx</b> on Mac.",
    "On Windows, <b>SFC /scannow</b> in an admin terminal scans and repairs corrupted system files. Run it before reinstalling Windows.",
    "<b>Scrypted</b> bridges cameras that don't talk to each other — HomeKit, Google Home, Alexa — into one unified view.",
    "A slow computer is often a <b>full or failing hard drive</b>, not a hardware problem. Check storage health before assuming the worst.",
    "If a phone is completely locked, a <b>factory reset via recovery mode</b> is usually the fastest path — but back up first if anything is recoverable.",
    "Check <b>Portainer logs</b> before restarting a crashed container — the error is almost always in the last 10 lines.",
    "Use <b>Cloudflare DDNS</b> to keep your domain pointed at your home IP automatically, even when your ISP changes it.",
    "<b>Thermal throttling</b> is the silent killer of old laptops. If a machine runs fine for 5 minutes then slows to a crawl, check the CPU temperature first.",
    "Never run your <b>Proxmox</b> host as a daily-use machine. Keep it dedicated to the hypervisor — nothing else installed.",
    "Run <b>Proxmox backups</b> to a separate drive or NAS. Never back up to the same datastore your VMs live on.",
    "In <b>Home Assistant</b>, input_boolean helpers act as virtual on/off switches — great for triggering multi-step automations with a single toggle.",
    "<b>Docker volumes</b> survive container restarts and rebuilds. If important data isn't in a volume, the next update will wipe it.",
    "On <b>Windows</b>, clear <code>C:\\Windows\\Temp</code> and <code>%temp%</code> manually for a real cleanup — Disk Cleanup misses a lot.",
    "A <b>dead CMOS battery</b> causes weird boot issues — wrong date/time, BIOS forgetting settings. It's a $5 fix most people never think to check.",
    "An iPhone running hot and draining fast is almost always a <b>background app or a degraded battery</b>. Check Battery Health in Settings first.",
    "<b>Nginx Proxy Manager</b> makes routing multiple local services through one domain with SSL easy — no config files to edit manually.",
    "Set your <b>AdGuard Home</b> upstream DNS to something privacy-respecting like <b>1.1.1.1</b> or <b>9.9.9.9</b> — ISP default DNS logs everything.",
    "Label your cables. Future-you debugging a network issue at midnight will be grateful.",
    "For cloning a drive: <b>Macrium Reflect</b> on Windows or <b>Carbon Copy Cloner</b> on Mac handle sector-level copies that standard copy-paste can't.",
    "<b>Scrypted NVR</b> records camera footage locally with no subscription — full privacy, your hardware, your rules.",
    "Keep <b>Proxmox ISO storage</b> separate from VM disk storage. Mixing them on the same datastore causes I/O slowdowns under load.",
    "The fastest way to diagnose a RAM issue is to pull sticks one at a time and see if the system stabilizes.",
    "Enable <b>2FA</b> on everything exposed to the internet. An authenticator app beats SMS, and both beat nothing.",
    "A computer that freezes randomly under load is almost always <b>overheating, failing RAM, or a dying PSU</b> — test in that order.",
    "Document your home lab — IP addresses, VM IDs, what each container does. A simple text file beats trying to remember six months later.",
    "<b>Cloudflare Tunnel</b> lets you expose a local service to the internet without opening any router ports. No port forwarding needed.",
    "When a phone won't charge, try a different cable first. It's the cable 70% of the time.",
    "If you inherit a slow old PC, check if it has an <b>HDD instead of an SSD</b>. Swapping the drive is the single biggest speed upgrade possible.",
    "Keep a spare <b>bootable USB</b> with Windows, macOS recovery, and a Linux live environment. When something breaks, you'll already have the tools.",
    "On <b>Android</b>, enabling Developer Options and USB debugging opens the phone up to ADB — useful for unlocking, sideloading, and deep diagnostics.",
    "Check <b>Windows Event Viewer</b> under System and Application logs before assuming a crash is random. The error code is usually sitting right there.",
    "A <b>reflow</b> (gentle controlled heat on a GPU or logic board) can temporarily revive solder joints that have cracked from thermal expansion over the years.",
    "In <b>Home Assistant</b>, the Logbook and History tabs are your best friends for figuring out why an automation triggered at the wrong time.",
    "<b>Uptime Kuma</b> sends push notifications the moment a service goes down — way faster than noticing it yourself.",
    "Before reinstalling Windows, run <b>DISM /Online /Cleanup-Image /RestoreHealth</b> — it fixes corruption that SFC can't touch on its own.",
    "When a laptop battery swells, stop using it immediately. A swollen cell can rupture. It's not just a battery replacement at that point — it needs to be handled carefully.",
    "On <b>macOS</b>, Activity Monitor sorted by CPU or Memory will immediately show you what's slowing things down. Most people never open it.",
    "If a charger gets unusually hot to the touch, replace it. Heat that extreme means something inside is working way harder than it should be.",
    "<b>WireGuard</b> is faster and simpler than OpenVPN for personal VPN use — smaller attack surface, less config, and noticeably lower latency.",
    "Before you wipe a phone, check if Google or iCloud backup actually ran recently. A lot of people assume it did. It didn't.",
    "On <b>Docker</b>, always pin your image versions in compose files — <code>image: nginx:1.25</code> not <code>image: nginx:latest</code>. Latest will break you eventually.",
    "An old laptop with a dead battery can still run fine as a desktop if you keep it plugged in — the hardware underneath is often totally fine.",
    "<b>Cloudflare Pages</b> deploys on every push to your connected GitHub branch. No manual steps needed once it's set up.",
    "If <b>Home Assistant</b> automations start acting weird after an update, check the Breaking Changes section in the release notes first.",
    "Your <b>router's DNS</b> setting is the easiest place to apply AdGuard — change it once and every device on the network benefits.",
    "On <b>Windows</b>, Task Scheduler can run scripts at startup, login, or on a timer without needing any third-party software.",
    "Dust is the hidden killer in older PCs. A can of compressed air once or twice a year keeps temperatures 10–15°C lower.",
    "The <b>iPhone</b> Diagnostics app (dial *#06# or check Settings → Privacy → Analytics) gives you real hardware data Apple doesn't advertise.",
    "In <b>Proxmox</b>, assigning specific CPU cores to VMs using CPU affinity prevents noisy-neighbor issues when you're running several VMs under load.",
    "If a device won't show up in <b>ADB</b>, it's almost always the USB cable. Use a data cable, not a charge-only one.",
    "A fresh <b>Windows install</b> on an SSD takes under 20 minutes. If a repair is taking longer than that to diagnose, a clean install might be the faster path."
  ];
  document.addEventListener('DOMContentLoaded', () => {
    const el = document.getElementById('techTipText');
    if (!el) return;
    const dayIdx = Math.floor(Date.now() / 86400000) % tips.length;
    el.innerHTML = tips[dayIdx];
  });
})();
