// Removed statsWs to use client-side stats
const termWs = new WebSocket(`wss://nexus-terminalnexus.onrender.com/ws/terminal`);

const cpuStat = document.getElementById('cpu-stat');
const memStat = document.getElementById('mem-stat');
const batStat = document.getElementById('bat-stat');
const output = document.getElementById('terminal-output');
const input = document.getElementById('terminal-input');

function updateClientStats() {
    const cores = navigator.hardwareConcurrency || '--';
    cpuStat.textContent = cores + " Cores";
    
    const mem = navigator.deviceMemory || '--';
    memStat.textContent = mem + " GB";
    
    if ('getBattery' in navigator) {
        navigator.getBattery().then(function(battery) {
            batStat.textContent = Math.round(battery.level * 100) + "%";
            battery.addEventListener('levelchange', function() {
                batStat.textContent = Math.round(battery.level * 100) + "%";
            });
        });
    } else {
        batStat.textContent = "N/A";
    }
}
updateClientStats();

termWs.onmessage = (event) => {
    const text = event.data;
    
    // Check for GUI trigger
    if (text.includes("[GUI_TRIGGER:")) {
        const match = text.match(/\[GUI_TRIGGER:([^:]+):([^\]]+)\]/);
        if (match) {
            const game = match[1];
            const param = match[2];
            showGameGUI(game, param);
        }
        // Still print the rest of the text, but remove the tag
        printToTerminal(text.replace(/\[GUI_TRIGGER:[^\]]+\]\n?/, ""));
        return;
    }
    
    printToTerminal(text);
};

// --- Web GUI Logic ---
const guiContainer = document.getElementById('game-gui-container');
const guiContent = document.getElementById('gui-content');
const guiTitle = document.getElementById('gui-title');

document.getElementById('gui-close').addEventListener('click', () => {
    guiContainer.classList.add('gui-hidden');
    termWs.send('exit'); // Tell backend we left
    input.focus();
});

function showGameGUI(game, param) {
    guiContainer.classList.remove('gui-hidden');
    guiContent.innerHTML = ''; // clear

    if (game === 'breach') {
        guiTitle.textContent = "BREACH PROTOCOL";
        guiContent.innerHTML = `
            <p>Target Key: <span style="color:#0ff">${param}</span></p>
            <input type="text" id="gui-breach-input" class="gui-input" placeholder="Type key exactly..." autocomplete="off">
            <br>
            <button class="gui-btn" id="gui-breach-submit">Bypass</button>
        `;
        
        const bInput = document.getElementById('gui-breach-input');
        bInput.focus();
        
        const submitBreach = () => {
            const val = bInput.value.trim();
            if (val) {
                termWs.send(val);
                printToTerminal(`root@nexus:~# ${val}`, 'user-cmd');
                bInput.value = '';
                // Wait for backend response to decide if we keep modal open
                // In a perfect world, backend would send a success/fail GUI trigger too
                // For now, let user keep typing or exit
            }
        };
        
        document.getElementById('gui-breach-submit').addEventListener('click', submitBreach);
        bInput.addEventListener('keydown', (e) => { if(e.key==='Enter') submitBreach(); });

    } else if (game === 'wordle') {
        guiTitle.textContent = "TERMINAL WORDLE";
        guiContent.innerHTML = `
            <p>Cracking Access Code... Attempts: ${param}</p>
            <input type="text" id="gui-wordle-input" class="gui-input" placeholder="5-letter code" maxlength="5" autocomplete="off">
            <br>
            <button class="gui-btn" id="gui-wordle-submit">Crack</button>
        `;
        
        const wInput = document.getElementById('gui-wordle-input');
        wInput.focus();
        
        const submitWordle = () => {
            const val = wInput.value.trim();
            if (val.length === 5) {
                termWs.send(val);
                printToTerminal(`root@nexus:~# ${val}`, 'user-cmd');
                wInput.value = '';
            }
        };
        
        document.getElementById('gui-wordle-submit').addEventListener('click', submitWordle);
        wInput.addEventListener('keydown', (e) => { if(e.key==='Enter') submitWordle(); });
    }
}


function printToTerminal(text, className="sys-msg") {
    const p = document.createElement('p');
    p.className = className;
    // Replace newlines with <br> and spaces with &nbsp; for ascii art preservation if needed
    p.innerHTML = text.replace(/\n/g, '<br>');
    output.appendChild(p);
    output.scrollTop = output.scrollHeight;
}

input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        const cmd = input.value.trim();
        if (cmd) {
            if (cmd.toLowerCase() === 'clear') {
                output.innerHTML = '';
            } else {
                printToTerminal(`root@nexus:~# ${cmd}`, 'user-cmd');
                termWs.send(cmd);
            }
            input.value = '';
        }
    }
});

// Setup quick action buttons
document.querySelectorAll('.action-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const cmd = btn.getAttribute('data-cmd');
        if (cmd === 'clear') {
            output.innerHTML = '';
        } else {
            printToTerminal(`root@nexus:~# ${cmd}`, 'user-cmd');
            termWs.send(cmd);
            input.focus();
        }
    });
});

// Geo-IP Fetch (Client-Side)
fetch('https://ipapi.co/json/')
    .then(res => res.json())
    .then(data => {
        document.querySelector('.geo-stat').textContent = `LOC: ${data.city || 'Unknown'}, ${data.country || 'World'}`;
    }).catch(e => {
        document.querySelector('.geo-stat').textContent = 'LOC: Unknown';
    });

// Always focus the terminal input when clicking inside the window
document.querySelector('.terminal-container').addEventListener('click', () => {
    input.focus();
});
