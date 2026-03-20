const socket = io();

let myRoom = '';
let myName = '';
let isHost = false;
let myWordsReq = 5;
let numTeams = 2;

// Timer State Management
let turnInterval;
let currentTimeLeft = 0;
let isTurnActive = false;
let activePlayerNameGlobal = '';

window.onload = () => {
    const savedName = localStorage.getItem('niab_playerName');
    const savedRoom = localStorage.getItem('niab_roomCode');
    if (savedName && savedRoom) {
        document.getElementById('playerName').value = savedName;
        document.getElementById('btn-rejoin').classList.remove('hidden');
        document.getElementById('btn-rejoin').onclick = () => {
            myName = savedName;
            socket.emit('joinRoom', { roomCode: savedRoom, playerName: myName });
        };
    }
};

const screens = { 
    landing: document.getElementById('landing-screen'), 
    lobby: document.getElementById('lobby-screen'), 
    submit: document.getElementById('submit-screen'), 
    review: document.getElementById('team-review-screen'), 
    game: document.getElementById('game-screen'),
    winner: document.getElementById('winner-screen')
};

function showScreen(screenName) {
    Object.values(screens).forEach(s => s.classList.add('hidden'));
    screens[screenName].classList.remove('hidden');
    if (screenName !== 'landing') {
        document.getElementById('game-banner').classList.remove('hidden');
    }
}

function updateBanner(roomData) {
    document.getElementById('bannerRoomCode').innerText = myRoom;
    document.getElementById('bannerPlayer').innerText = myName;
    
    if (roomData && roomData.players[myName] && roomData.players[myName].team !== -1) {
        document.getElementById('bannerTeamContainer').classList.remove('hidden');
        document.getElementById('bannerTeam').innerText = roomData.teams[roomData.players[myName].team].name;
    } else {
        document.getElementById('bannerTeamContainer').classList.add('hidden');
    }
}

function playBeep(frequency = 800, duration = 0.1, type = 'sine') {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type; osc.frequency.setValueAtTime(frequency, ctx.currentTime);
        gain.gain.setValueAtTime(0.5, ctx.currentTime);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime + duration);
    } catch (e) { console.log("Audio not supported"); }
}

function launchConfetti() {
    const container = document.getElementById('confetti-container');
    container.classList.remove('hidden');
    const colors = ['#fde047', '#a3e635', '#38bdf8', '#c084fc', '#f472b6', '#ef4444'];
    
    for(let i=0; i<80; i++) {
        let conf = document.createElement('div');
        conf.classList.add('confetti-piece');
        conf.style.left = Math.random() * 100 + 'vw';
        conf.style.animationDuration = (Math.random() * 3 + 2) + 's';
        conf.style.animationDelay = Math.random() * 2 + 's';
        conf.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        container.appendChild(conf);
    }
}

document.getElementById('btn-create').addEventListener('click', () => {
    myName = document.getElementById('playerName').value || 'Host';
    const settings = { numTeams: parseInt(document.getElementById('numTeams').value), wordsPerPlayer: parseInt(document.getElementById('wordsReq').value), baseTime: parseInt(document.getElementById('baseTime').value) };
    myWordsReq = settings.wordsPerPlayer; numTeams = settings.numTeams;
    socket.emit('createRoom', { playerName: myName, settings });
});

document.getElementById('btn-join').addEventListener('click', () => {
    myName = document.getElementById('playerName').value || 'Player';
    const roomCode = document.getElementById('joinCode').value.toUpperCase();
    socket.emit('joinRoom', { roomCode, playerName: myName });
});

socket.on('errorMsg', (msg) => alert(msg));

socket.on('roomJoined', ({ roomCode, isHost: hostStatus, roomData }) => {
    myRoom = roomCode; isHost = hostStatus; myWordsReq = roomData.settings.wordsPerPlayer; numTeams = roomData.settings.numTeams;
    localStorage.setItem('niab_playerName', myName); localStorage.setItem('niab_roomCode', myRoom);
    document.getElementById('displayRoomCode').innerText = roomCode;
    renderLobbyOrGame(roomData);
});

socket.on('updateRoom', (roomData) => {
    isHost = (roomData.host === myName);
    if (isHost && roomData.state === 'lobby') document.getElementById('btn-start-submit').classList.remove('hidden');
    else document.getElementById('btn-start-submit').classList.add('hidden');
    renderLobbyOrGame(roomData);
});

function renderLobbyOrGame(roomData) {
    updateBanner(roomData);
    
    if (roomData.state === 'lobby') { updateLobbyRoster(roomData); showScreen('lobby'); } 
    else if (roomData.state === 'submitting') {
        if (!roomData.players[myName].wordsSubmitted && document.getElementById('word-inputs').innerHTML === '') setupWordInputs();
        updateStatusRoster(roomData); showScreen('submit');
    } 
    else if (roomData.state === 'team_review') { renderTeamReview(roomData); showScreen('review'); } 
    else if (roomData.state === 'playing') { updateGameUI(roomData); showScreen('game'); }
}

function updateLobbyRoster(roomData) {
    const rosterDiv = document.getElementById('player-roster'); rosterDiv.innerHTML = '';
    Object.keys(roomData.players).forEach(pName => {
        const pInfo = roomData.players[pName];
        const isOnline = pInfo.online ? '' : '<span class="text-red-500 text-xs">(Offline)</span>';
        const hostCrown = pName === roomData.host ? '👑' : '';
        rosterDiv.innerHTML += `<div class="flex justify-between items-center py-2 border-b last:border-0"><span class="font-medium">${pName} ${hostCrown} ${isOnline}</span><span class="text-sm text-gray-500">Unassigned</span></div>`;
    });
}

function updateStatusRoster(roomData) {
    const statusDiv = document.getElementById('status-roster'); statusDiv.innerHTML = '';
    Object.keys(roomData.players).forEach(pName => {
        const pInfo = roomData.players[pName];
        const statusIcon = pInfo.wordsSubmitted ? '✅' : '✍️';
        statusDiv.innerHTML += `<div class="flex justify-between py-1"><span>${pName}</span><span>${pInfo.wordCount} / ${myWordsReq} ${statusIcon}</span></div>`;
    });
}

document.getElementById('btn-start-submit').addEventListener('click', () => socket.emit('startGamePhase', myRoom));

function setupWordInputs() {
    const container = document.getElementById('word-inputs'); container.innerHTML = ''; 
    for (let i = 0; i < myWordsReq; i++) container.innerHTML += `<input type="text" class="word-entry w-full p-3 border rounded-lg" placeholder="Noun ${i+1}">`;
    document.querySelectorAll('.word-entry').forEach(input => {
        input.addEventListener('input', () => {
            const currentCount = Array.from(document.querySelectorAll('.word-entry')).filter(inp => inp.value.trim() !== '').length;
            socket.emit('updateWordCount', { roomCode: myRoom, playerName: myName, count: currentCount });
        });
    });
}

document.getElementById('btn-submit-words').addEventListener('click', () => {
    const inputs = document.querySelectorAll('.word-entry');
    const words = Array.from(inputs).map(input => input.value.trim()).filter(w => w !== '');
    if (words.length < myWordsReq) return alert('Please fill out all your words!');
    socket.emit('submitWords', { roomCode: myRoom, playerName: myName, words });
    document.getElementById('submission-area').classList.add('hidden');
    document.getElementById('waiting-area').classList.remove('hidden');
});

document.getElementById('btn-hurry-up').addEventListener('click', () => {
    socket.emit('sendHurryUp', myRoom);
    document.getElementById('btn-hurry-up').innerText = "Nudge Sent!";
    document.getElementById('btn-hurry-up').classList.add('bg-gray-400'); document.getElementById('btn-hurry-up').disabled = true;
    setTimeout(() => { document.getElementById('btn-hurry-up').innerText = '📣 Send "Hurry Up" Nudge'; document.getElementById('btn-hurry-up').classList.remove('bg-gray-400'); document.getElementById('btn-hurry-up').disabled = false; }, 5000);
});

socket.on('receiveHurryUp', () => {
    const toast = document.getElementById('toast-container'); toast.classList.remove('hidden');
    playBeep(300, 0.2, 'square'); setTimeout(() => playBeep(300, 0.2, 'square'), 250);
    setTimeout(() => toast.classList.add('hidden'), 3000);
});

function renderTeamReview(roomData) {
    const rosterDiv = document.getElementById('team-review-roster'); rosterDiv.innerHTML = '';
    roomData.teams.forEach((team, teamIndex) => {
        let membersHtml = team.members.map(pName => {
            const hostCrown = pName === roomData.host ? '👑' : '';
            let controlHtml = '';
            if (isHost) {
                let options = '';
                for(let i = 0; i < roomData.settings.numTeams; i++) options += `<option value="${i}" ${teamIndex === i ? 'selected' : ''}>Move to ${roomData.teams[i].name}</option>`;
                controlHtml = `<select class="review-team-selector bg-gray-100 border rounded px-1 text-xs py-1" data-player="${pName}">${options}</select>`;
            }
            return `<div class="flex justify-between items-center py-2 border-b last:border-0"><span class="font-medium text-gray-700">${pName} ${hostCrown}</span>${controlHtml}</div>`;
        }).join('');
        if (team.members.length === 0) membersHtml = `<div class="text-sm text-gray-400 italic py-2">No members</div>`;
        rosterDiv.innerHTML += `<div class="bg-white border-2 border-indigo-100 rounded-xl p-4 shadow-sm"><h3 class="font-black text-lg text-indigo-700 border-b-2 border-indigo-50 pb-2 mb-2">${team.name}</h3><div class="space-y-1">${membersHtml}</div></div>`;
    });

    if (isHost) {
        document.getElementById('host-start-controls').classList.remove('hidden'); document.getElementById('waiting-for-host-start').classList.add('hidden');
        document.querySelectorAll('.review-team-selector').forEach(sel => { sel.addEventListener('change', (e) => {
            const targetPlayer = e.target.getAttribute('data-player'); const newTeamIndex = parseInt(e.target.value);
            socket.emit('assignTeam', { roomCode: myRoom, targetPlayer, newTeamIndex });
        });});
    } else {
        document.getElementById('host-start-controls').classList.add('hidden'); document.getElementById('waiting-for-host-start').classList.remove('hidden');
    }
}

document.getElementById('btn-confirm-teams').addEventListener('click', () => socket.emit('confirmTeamsAndStart', myRoom));

// --- GAMEPLAY ---
socket.on('startRound', (roomData) => {
    updateGameUI(roomData); showScreen('game');
});

function updateGameUI(roomData) {
const roundNames = ['Round 1: Description', 'Round 2: One Word', 'Round 3: Act It Out'];
    document.getElementById('displayRound').innerText = roundNames[roomData.round - 1] || 'Bonus Round';
    
    const scoreboard = document.getElementById('scoreboard');
    scoreboard.innerHTML = roomData.teams.map(t => {
        return `
            <div class="bg-white p-2 rounded-lg shadow-sm border border-gray-200 flex flex-col justify-center leading-tight">
                <span class="text-gray-700 font-bold mb-1 truncate">${t.name}</span>
                <span class="text-indigo-600 font-black text-2xl">${t.score}</span>
            </div>
        `;
    }).join('');
    
    const currentTeamIdx = roomData.turn.teamIndex;
    const currentTeam = roomData.teams[currentTeamIdx];
    if(currentTeam.members.length === 0) return; 

    const activePlayerName = currentTeam.members[roomData.turn.playerIndices[currentTeamIdx]];
    const isMyTurn = activePlayerName === myName;
    
    activePlayerNameGlobal = activePlayerName;
    
    const myTeamIndex = roomData.players[myName].team;
    const isTeammate = (myTeamIndex === roomData.turn.teamIndex) && !isMyTurn;

    document.getElementById('turn-indicator').innerText = isMyTurn ? "It's your turn!" : `${activePlayerName}'s Turn (${currentTeam.name})`;

    // Check for Carry-Over time visually before turn starts
    const timerDisplay = document.getElementById('displayTimer');
    if (roomData.carryOver && roomData.carryOver.teamIndex === currentTeamIdx) {
        timerDisplay.innerText = `00:${roomData.carryOver.time.toString().padStart(2, '0')}`;
        timerDisplay.classList.replace('text-red-500', 'text-yellow-500'); // Visually indicate carry-over
    } else {
        timerDisplay.innerText = `00:${roomData.settings.baseTime.toString().padStart(2, '0')}`;
        timerDisplay.classList.remove('text-yellow-500', 'text-red-500');
    }

    document.getElementById('btn-pause').classList.add('hidden');

    if (isMyTurn) {
        document.getElementById('active-player-view').classList.add('hidden');
        document.getElementById('waiting-player-view').classList.remove('hidden');
        document.getElementById('btn-start-turn').classList.remove('hidden');
        document.getElementById('teammate-controls').classList.add('hidden');
    } else {
        document.getElementById('active-player-view').classList.add('hidden');
        document.getElementById('waiting-player-view').classList.remove('hidden');
        document.getElementById('btn-start-turn').classList.add('hidden');
        
        if (isTeammate) document.getElementById('teammate-controls').classList.remove('hidden');
        else document.getElementById('teammate-controls').classList.add('hidden');
    }
}

document.getElementById('btn-start-turn').addEventListener('click', () => {
    socket.emit('startTurn', myRoom);
    document.getElementById('btn-start-turn').classList.add('hidden');
});

function startTimerClientSide(time) {
    currentTimeLeft = time;
    isTurnActive = true;
    
    document.getElementById('btn-pause').classList.remove('hidden');

    const timerDisplay = document.getElementById('displayTimer');
    timerDisplay.innerText = `00:${currentTimeLeft.toString().padStart(2, '0')}`;
    timerDisplay.classList.remove('text-red-500', 'text-yellow-500');
    timerDisplay.classList.add(currentTimeLeft <= 10 ? 'text-red-500' : 'text-green-500');

    turnInterval = setInterval(() => {
        currentTimeLeft--;
        timerDisplay.innerText = `00:${currentTimeLeft.toString().padStart(2, '0')}`;
        
        if (currentTimeLeft === 10) { timerDisplay.classList.remove('text-green-500'); timerDisplay.classList.add('text-red-500'); playBeep(800, 0.1); } 
        else if (currentTimeLeft < 10 && currentTimeLeft > 0) playBeep(800, 0.1);
        else if (currentTimeLeft === 0) playBeep(400, 0.5); 
        
        if (currentTimeLeft <= 0) {
            clearInterval(turnInterval);
            isTurnActive = false;
            document.getElementById('btn-pause').classList.add('hidden');
            if (myName === activePlayerNameGlobal) socket.emit('endTurn', myRoom);
        }
    }, 1000);
}

socket.on('turnStarted', ({ time, activePlayerName, word }) => {
    if (activePlayerName === myName) {
        document.getElementById('active-player-view').classList.remove('hidden');
        document.getElementById('waiting-player-view').classList.add('hidden');
        document.getElementById('current-word').innerText = word;
    }
    startTimerClientSide(time);
});

document.getElementById('btn-pause').addEventListener('click', () => {
    if (!isTurnActive) return;
    socket.emit('pauseGame', { roomCode: myRoom, timeLeft: currentTimeLeft, playerName: myName });
});

document.getElementById('btn-resume').addEventListener('click', () => socket.emit('resumeGame', myRoom));

socket.on('gamePaused', ({ timeLeft, playerName }) => {
    clearInterval(turnInterval);
    isTurnActive = false;
    currentTimeLeft = timeLeft; 
    document.getElementById('displayTimer').innerText = `00:${currentTimeLeft.toString().padStart(2, '0')}`;
    
    document.getElementById('pause-overlay').classList.remove('hidden');
    document.getElementById('pause-text').innerText = `Paused by ${playerName}`;
});

socket.on('gameResumed', () => {
    document.getElementById('pause-overlay').classList.add('hidden');
    startTimerClientSide(currentTimeLeft);
});

document.getElementById('btn-skip').addEventListener('click', () => {
    if (!isTurnActive) return; 
    socket.emit('skipWord', myRoom);
});

// NEW: Emits the time left when a word is guessed so the server knows how much carry-over to award
document.getElementById('btn-got-it').addEventListener('click', () => {
    socket.emit('wordGuessed', { roomCode: myRoom, timeLeft: currentTimeLeft });
});

socket.on('nextWord', (newWord) => {
    document.getElementById('current-word').innerText = newWord;
});

socket.on('roundOver', (roomData) => {
    clearInterval(turnInterval); isTurnActive = false;
    document.getElementById('btn-pause').classList.add('hidden');
    
    let msg = 'Round Over! Bucket is empty.';
    if (roomData.carryOver) {
        msg += `\n\n${activePlayerNameGlobal} keeps ${roomData.carryOver.time} seconds for the next round!`;
    }
    alert(msg);
    
    updateGameUI(roomData);
});

socket.on('gameOver', (roomData) => {
    clearInterval(turnInterval); isTurnActive = false;
    document.getElementById('btn-pause').classList.add('hidden');
    
    document.getElementById('game-banner').classList.add('hidden');
    
    let maxScore = -1;
    roomData.teams.forEach(t => { if(t.score > maxScore) maxScore = t.score; });
    
    const winningTeams = roomData.teams.filter(t => t.score === maxScore);
    const winnerNames = winningTeams.map(t => t.name).join(' & ');
    
    document.getElementById('winner-text').innerText = winnerNames;
    
    const finalScoresDiv = document.getElementById('final-scores');
    finalScoresDiv.innerHTML = roomData.teams.sort((a,b) => b.score - a.score).map((t, i) => {
        let medal = i === 0 ? '🥇' : (i === 1 ? '🥈' : (i === 2 ? '🥉' : ''));
        return `<div class="flex justify-between border-b pb-1 last:border-0"><span class="font-bold">${medal} ${t.name}</span><span class="text-indigo-600 font-black">${t.score}</span></div>`;
    }).join('');
    
    showScreen('winner');
    launchConfetti();
    playBeep(523.25, 0.1, 'square'); 
    setTimeout(() => playBeep(659.25, 0.1, 'square'), 150); 
    setTimeout(() => playBeep(783.99, 0.4, 'square'), 300); 
    
    localStorage.removeItem('niab_roomCode'); 
});
