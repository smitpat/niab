const socket = io();

let myRoom = '';
let myName = '';
let isHost = false;
let myWordsReq = 5;
let numTeams = 2;
let turnInterval;

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
    game: document.getElementById('game-screen')
};

function showScreen(screenName) {
    Object.values(screens).forEach(s => s.classList.add('hidden'));
    screens[screenName].classList.remove('hidden');
    
    if (screenName !== 'landing') {
        document.getElementById('game-banner').classList.remove('hidden');
        document.getElementById('bannerRoomCode').innerText = myRoom;
        document.getElementById('bannerPlayer').innerText = myName;
    }
}

function playBeep(frequency = 800, duration = 0.1, type = 'sine') {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(frequency, ctx.currentTime);
        gain.gain.setValueAtTime(0.5, ctx.currentTime);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + duration);
    } catch (e) { console.log("Audio not supported"); }
}

document.getElementById('btn-create').addEventListener('click', () => {
    myName = document.getElementById('playerName').value || 'Host';
    const settings = {
        numTeams: parseInt(document.getElementById('numTeams').value),
        wordsPerPlayer: parseInt(document.getElementById('wordsReq').value),
        baseTime: parseInt(document.getElementById('baseTime').value)
    };
    myWordsReq = settings.wordsPerPlayer;
    numTeams = settings.numTeams;
    socket.emit('createRoom', { playerName: myName, settings });
});

document.getElementById('btn-join').addEventListener('click', () => {
    myName = document.getElementById('playerName').value || 'Player';
    const roomCode = document.getElementById('joinCode').value.toUpperCase();
    socket.emit('joinRoom', { roomCode, playerName: myName });
});

socket.on('errorMsg', (msg) => alert(msg));

socket.on('roomJoined', ({ roomCode, isHost: hostStatus, roomData }) => {
    myRoom = roomCode;
    isHost = hostStatus;
    myWordsReq = roomData.settings.wordsPerPlayer;
    numTeams = roomData.settings.numTeams;
    
    localStorage.setItem('niab_playerName', myName);
    localStorage.setItem('niab_roomCode', myRoom);

    document.getElementById('displayRoomCode').innerText = roomCode;
    renderLobbyOrGame(roomData);
});

socket.on('updateRoom', (roomData) => {
    // Dynamically update host status (In case Sharky joins or host disconnects)
    isHost = (roomData.host === myName);
    
    if (isHost && roomData.state === 'lobby') {
        document.getElementById('btn-start-submit').classList.remove('hidden');
    } else {
        document.getElementById('btn-start-submit').classList.add('hidden');
    }

    renderLobbyOrGame(roomData);
});

function renderLobbyOrGame(roomData) {
    if (roomData.state === 'lobby') {
        updateRoster(roomData);
        showScreen('lobby');
    } else if (roomData.state === 'submitting') {
        if (!roomData.players[myName].wordsSubmitted && document.getElementById('word-inputs').innerHTML === '') {
            setupWordInputs();
        }
        updateStatusRoster(roomData);
        showScreen('submit');
    } else if (roomData.state === 'playing') {
        updateGameUI(roomData);
        showScreen('game');
    }
}

function updateRoster(roomData) {
    const rosterDiv = document.getElementById('player-roster');
    rosterDiv.innerHTML = '';
    
    Object.keys(roomData.players).forEach(pName => {
        const pInfo = roomData.players[pName];
        const isOnline = pInfo.online ? '' : '<span class="text-red-500 text-xs">(Offline)</span>';
        const hostCrown = pName === roomData.host ? '👑' : '';
        
        let teamText = pInfo.team === -1 ? 'Unassigned' : `Team ${pInfo.team + 1}`;
        let teamSelectHtml = `<span class="text-sm text-gray-500">${teamText}</span>`;
        
        // Only host can assign teams manually in the lobby
        if (isHost) {
            let options = `<option value="-1" ${pInfo.team === -1 ? 'selected' : ''}>Unassigned</option>`;
            for(let i = 0; i < roomData.settings.numTeams; i++) {
                options += `<option value="${i}" ${pInfo.team === i ? 'selected' : ''}>Team ${i + 1}</option>`;
            }
            teamSelectHtml = `<select class="team-selector bg-gray-100 border rounded px-1 text-sm" data-player="${pName}">${options}</select>`;
        }

        rosterDiv.innerHTML += `
            <div class="flex justify-between items-center py-2 border-b last:border-0">
                <span class="font-medium">${pName} ${hostCrown} ${isOnline}</span>
                ${teamSelectHtml}
            </div>
        `;
    });

    if (isHost) {
        document.querySelectorAll('.team-selector').forEach(sel => {
            sel.addEventListener('change', (e) => {
                const targetPlayer = e.target.getAttribute('data-player');
                const newTeamIndex = parseInt(e.target.value);
                socket.emit('assignTeam', { roomCode: myRoom, targetPlayer, newTeamIndex });
            });
        });
    }
}

function updateStatusRoster(roomData) {
    const statusDiv = document.getElementById('status-roster');
    statusDiv.innerHTML = '';
    Object.keys(roomData.players).forEach(pName => {
        const pInfo = roomData.players[pName];
        const statusIcon = pInfo.wordsSubmitted ? '✅' : '✍️';
        statusDiv.innerHTML += `
            <div class="flex justify-between py-1">
                <span>${pName}</span>
                <span>${pInfo.wordCount} / ${myWordsReq} ${statusIcon}</span>
            </div>
        `;
    });
}

document.getElementById('btn-start-submit').addEventListener('click', () => {
    socket.emit('startGamePhase', myRoom);
});

function setupWordInputs() {
    const container = document.getElementById('word-inputs');
    container.innerHTML = ''; 
    for (let i = 0; i < myWordsReq; i++) {
        container.innerHTML += `<input type="text" class="word-entry w-full p-3 border rounded-lg" placeholder="Noun ${i+1}">`;
    }

    document.querySelectorAll('.word-entry').forEach(input => {
        input.addEventListener('input', () => {
            const currentCount = Array.from(document.querySelectorAll('.word-entry'))
                                     .filter(inp => inp.value.trim() !== '').length;
            socket.emit('updateWordCount', { roomCode: myRoom, playerName: myName, count: currentCount });
        });
    });
}

document.getElementById('btn-submit-words').addEventListener('click', () => {
    const inputs = document.querySelectorAll('.word-entry');
    const words = Array.from(inputs).map(input => input.value.trim()).filter(w => w !== '');
    
    if (words.length < myWordsReq) {
        alert('Please fill out all your words!');
        return;
    }
    
    socket.emit('submitWords', { roomCode: myRoom, playerName: myName, words });
    document.getElementById('submission-area').classList.add('hidden');
    document.getElementById('waiting-area').classList.remove('hidden');
});

// Hurry Up Logic
document.getElementById('btn-hurry-up').addEventListener('click', () => {
    socket.emit('sendHurryUp', myRoom);
    document.getElementById('btn-hurry-up').innerText = "Nudge Sent!";
    document.getElementById('btn-hurry-up').classList.add('bg-gray-400');
    document.getElementById('btn-hurry-up').disabled = true;
    setTimeout(() => {
        document.getElementById('btn-hurry-up').innerText = '📣 Send "Hurry Up" Nudge';
        document.getElementById('btn-hurry-up').classList.remove('bg-gray-400');
        document.getElementById('btn-hurry-up').disabled = false;
    }, 5000); // Prevent spamming
});

socket.on('receiveHurryUp', () => {
    const toast = document.getElementById('toast-container');
    toast.classList.remove('hidden');
    playBeep(300, 0.2, 'square'); // Aggressive beep
    setTimeout(() => playBeep(300, 0.2, 'square'), 250);
    
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
});

// Gameplay
socket.on('startRound', (roomData) => {
    updateGameUI(roomData);
    showScreen('game');
});

function updateGameUI(roomData) {
    const roundNames = ['Round 1: Describe', 'Round 2: Act It Out', 'Round 3: One Word'];
    document.getElementById('displayRound').innerText = roundNames[roomData.round - 1];
    
    const scoreboard = document.getElementById('scoreboard');
    scoreboard.innerHTML = roomData.teams.map((t, i) => `<div>T${i+1}: <span class="text-indigo-600">${t.score}</span></div>`).join('');
    
    const currentTeam = roomData.teams[roomData.turn.teamIndex];
    if(currentTeam.members.length === 0) return; 

    const activePlayerName = currentTeam.members[roomData.turn.playerIndex];
    const isMyTurn = activePlayerName === myName;

    document.getElementById('turn-indicator').innerText = isMyTurn ? "It's your turn!" : `${activePlayerName}'s Turn (Team ${roomData.turn.teamIndex + 1})`;

    document.getElementById('active-player-view').classList.add('hidden');
    document.getElementById('waiting-player-view').classList.remove('hidden');

    const startBtn = document.getElementById('btn-start-turn');
    if (isMyTurn) {
        startBtn.classList.remove('hidden');
    } else {
        startBtn.classList.add('hidden');
    }
}

document.getElementById('btn-start-turn').addEventListener('click', () => {
    socket.emit('startTurn', myRoom);
    document.getElementById('btn-start-turn').classList.add('hidden');
});

socket.on('turnStarted', ({ time, activePlayerName, word }) => {
    const isMyTurn = activePlayerName === myName;
    
    if (isMyTurn) {
        document.getElementById('active-player-view').classList.remove('hidden');
        document.getElementById('waiting-player-view').classList.add('hidden');
        document.getElementById('current-word').innerText = word;
    }

    let timeLeft = time;
    const timerDisplay = document.getElementById('displayTimer');
    timerDisplay.innerText = `00:${timeLeft.toString().padStart(2, '0')}`;
    timerDisplay.classList.remove('text-red-500');
    timerDisplay.classList.add('text-green-500');

    turnInterval = setInterval(() => {
        timeLeft--;
        timerDisplay.innerText = `00:${timeLeft.toString().padStart(2, '0')}`;
        
        if (timeLeft === 10) {
            timerDisplay.classList.remove('text-green-500');
            timerDisplay.classList.add('text-red-500');
            playBeep(800, 0.1); 
        } else if (timeLeft < 10 && timeLeft > 0) {
            playBeep(800, 0.1);
        } else if (timeLeft === 0) {
            playBeep(400, 0.5); 
        }
        
        if (timeLeft <= 0) {
            clearInterval(turnInterval);
            if (isMyTurn) socket.emit('endTurn', myRoom);
        }
    }, 1000);
});

document.getElementById('btn-got-it').addEventListener('click', () => {
    socket.emit('wordGuessed', myRoom);
});

socket.on('nextWord', (newWord) => {
    document.getElementById('current-word').innerText = newWord;
});

socket.on('roundOver', (roomData) => {
    clearInterval(turnInterval);
    alert('Round Over! Bucket is empty.');
    updateGameUI(roomData);
});

socket.on('gameOver', (roomData) => {
    clearInterval(turnInterval);
    let scores = roomData.teams.map((t, i) => `Team ${i+1}: ${t.score}`).join('\n');
    alert(`Game Over!\n\n${scores}`);
    localStorage.removeItem('niab_roomCode'); 
});
