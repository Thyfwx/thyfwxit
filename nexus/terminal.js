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
        printToTerminal(text.replace(/\[GUI_TRIGGER:[^\]]+\]\n?/, ""));
        return;
    }

    // Wordle Visual Feedback (e.g. "[G] (Y) _B_")
    const grid = document.getElementById('wordle-grid');
    if (grid && !grid.parentElement.parentElement.classList.contains('gui-hidden')) {
        const cells = grid.querySelectorAll('.wordle-cell');
        const rows = text.split('\n');
        rows.forEach(line => {
            if (line.includes('[WORDLE] Result:')) {
                const result = line.replace('[WORDLE] Result:', '').trim();
                const parts = result.split(' ');
                // Parts are like ["[G]", "(Y)", "_B_"]
                // We find the last filled row (the one just submitted)
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
                    if (p.startsWith('[')) cell.style.background = '#0f0'; // Correct
                    else if (p.startsWith('(')) cell.style.background = '#ff0'; // Present
                    else cell.style.background = '#333'; // Absent
                    cell.style.color = '#000';
                });
            }

            if (line.includes('[WORDLE] Code cracked!') || line.includes('[WORDLE] FAILED.')) {
                const stats = JSON.parse(localStorage.getItem('nexus_wordle_stats') || '{"wins":0, "games":0, "streak":0}');
                stats.games++;
                if (line.includes('cracked')) {
                    stats.wins++;
                    stats.streak++;
                } else {
                    stats.streak = 0;
                }
                localStorage.setItem('nexus_wordle_stats', JSON.stringify(stats));
            }
        });
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
            <div style="text-align:center;">
                <p style="color:#88f; font-size:0.8rem; margin-bottom:15px;">BYPASS FIREWALL: TYPE KEY SEQUENCE</p>
                <div style="background:#111; padding:15px; border:1px solid #0ff; margin-bottom:15px; font-size:1.2rem; letter-spacing:2px;">
                    <span style="color:#0ff; font-weight:bold;">${param}</span>
                </div>
                <input type="text" id="gui-breach-input" class="gui-input" placeholder="Handshake Key..." autocomplete="off" style="width:90%;">
                <br>
                <button class="gui-btn" id="gui-breach-submit" style="width:100%; margin-top:10px;">EXECUTE BYPASS</button>
            </div>
        `;
        
        const bInput = document.getElementById('gui-breach-input');
        bInput.focus();
        
        const submitBreach = () => {
            const val = bInput.value.trim();
            if (val) {
                termWs.send(val);
                printToTerminal(`root@nexus:~# ${val}`, 'user-cmd');
                bInput.value = '';
            }
        };
        
        document.getElementById('gui-breach-submit').addEventListener('click', submitBreach);
        bInput.addEventListener('keydown', (e) => { if(e.key==='Enter') submitBreach(); });

    } else if (game === 'wordle') {
        const stats = JSON.parse(localStorage.getItem('nexus_wordle_stats') || '{"wins":0, "games":0, "streak":0}');
        guiTitle.textContent = "TERMINAL WORDLE";
        guiContent.innerHTML = `
            <div id="wordle-grid" style="display:grid; grid-template-rows: repeat(6, 1fr); gap: 5px; margin-bottom: 15px;"></div>
            <div style="display:flex; gap:10px; margin-bottom:10px;">
                <input type="text" id="gui-wordle-input" class="gui-input" placeholder="5-letter word" maxlength="5" autocomplete="off" style="flex-grow:1;">
                <button class="gui-btn" id="gui-wordle-submit" style="margin:0;">CRACK</button>
            </div>
            <div style="font-size:0.7rem; color:#888; display:flex; justify-content:space-around; border-top:1px solid #333; padding-top:10px;">
                <span>GAMES: ${stats.games}</span>
                <span>WINS: ${stats.wins}</span>
                <span>STREAK: ${stats.streak}</span>
            </div>
        `;

        const grid = document.getElementById('wordle-grid');
        for (let i = 0; i < 30; i++) {
            const cell = document.createElement('div');
            cell.className = 'wordle-cell';
            cell.style.cssText = "width:40px; height:40px; border:2px solid #333; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:1.2rem; background:#000;";
            grid.appendChild(cell);
        }

        const wInput = document.getElementById('gui-wordle-input');
        wInput.focus();
        
        let currentRow = 0;
        const submitWordle = () => {
            const val = wInput.value.trim().toLowerCase();
            if (val.length === 5) {
                termWs.send(val);
                printToTerminal(`root@nexus:~# ${val}`, 'user-cmd');
                
                // Visual update for the grid
                const cells = grid.querySelectorAll('.wordle-cell');
                for (let i = 0; i < 5; i++) {
                    const cell = cells[currentRow * 5 + i];
                    cell.textContent = val[i].toUpperCase();
                    cell.style.borderColor = "#0ff";
                }
                currentRow++;
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
