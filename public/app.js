const socket = io();

let myRoom = '';
let isHost = false;
let myWordsReq = 5;
let turnInterval;

const screens = {
    landing: document.getElementById('landing-screen'),
    lobby: document.getElementById('lobby-screen'),
    submit: document.getElementById('submit-screen'),
    game: document.getElementById('game-screen')
};

function showScreen(screenName) {
    Object.values(screens).forEach(s => s.classList.add('hidden'));
    screens[screenName].classList.remove('hidden');
}

document.getElementById('btn-create').addEventListener('click', () => {
    const playerName = document.getElementById('playerName').value || 'Host';
    const settings = {
        numTeams: parseInt(document.getElementById('numTeams').value),
        wordsPerPlayer: parseInt(document.getElementById('wordsReq').value),
        baseTime: parseInt(document.getElementById('baseTime').value)
    };
    myWordsReq = settings.wordsPerPlayer;
    socket.emit('createRoom', { playerName, settings });
});

document.getElementById('btn-join').addEventListener('click', () => {
    const playerName = document.getElementById('playerName').value || 'Player';
    const roomCode = document.getElementById('joinCode').value.toUpperCase();
    socket.emit('joinRoom', { roomCode, playerName });
});

socket.on('roomJoined', ({ roomCode, isHost: hostStatus, roomData }) => {
    myRoom = roomCode;
    isHost = hostStatus;
    myWordsReq = roomData.settings.wordsPerPlayer;
    
    document.getElementById('displayRoomCode').innerText = roomCode;
    if (isHost) document.getElementById('btn-start-submit').classList.remove('hidden');
    
    showScreen('lobby');
});

socket.on('updateRoom', (roomData) => {
    if (roomData.state === 'lobby') {
        const totalPlayers = Object.keys(roomData.players).length;
        document.getElementById('playerCount').innerText = `${totalPlayers} Players Joined`;
    } else if (roomData.state === 'submitting') {
        setupWordInputs();
        showScreen('submit');
    } else if (roomData.state === 'playing') {
        updateGameUI(roomData);
        showScreen('game');
    }
});

document.getElementById('btn-start-submit').addEventListener('click', () => {
    socket.emit('startGamePhase', myRoom);
});

function setupWordInputs() {
    const container = document.getElementById('word-inputs');
    container.innerHTML = ''; 
    for (let i = 0; i < myWordsReq; i++) {
        container.innerHTML += `<input type="text" class="word-entry w-full p-3 border rounded-lg" placeholder="Noun ${i+1}">`;
    }
}

document.getElementById('btn-submit-words').addEventListener('click', () => {
    const inputs = document.querySelectorAll('.word-entry');
    const words = Array.from(inputs).map(input => input.value.trim()).filter(w => w !== '');
    
    if (words.length < myWordsReq) {
        alert('Please fill out all your words!');
        return;
    }
    
    socket.emit('submitWords', { roomCode: myRoom, words });
    document.getElementById('btn-submit-words').classList.add('hidden');
    document.getElementById('waiting-msg').classList.remove('hidden');
});

socket.on('startRound', (roomData) => {
    updateGameUI(roomData);
    showScreen('game');
});

function updateGameUI(roomData) {
    const roundNames = ['Round 1: Describe', 'Round 2: Act It Out', 'Round 3: One Word'];
    document.getElementById('displayRound').innerText = roundNames[roomData.round - 1];
    
    const activePlayerId = roomData.teams[roomData.turn.teamIndex].members[roomData.turn.playerIndex];
    const isMyTurn = activePlayerId === socket.id;
    const playerName = roomData.players[activePlayerId].name;

    document.getElementById('turn-indicator').innerText = isMyTurn ? "It's your turn!" : `${playerName}'s Turn (Team ${roomData.turn.teamIndex + 1})`;

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

socket.on('turnStarted', ({ time, activePlayer, word }) => {
    const isMyTurn = activePlayer === socket.id;
    
    if (isMyTurn) {
        document.getElementById('active-player-view').classList.remove('hidden');
        document.getElementById('waiting-player-view').classList.add('hidden');
        document.getElementById('current-word').innerText = word;
    }

    let timeLeft = time;
    document.getElementById('displayTimer').innerText = `00:${timeLeft.toString().padStart(2, '0')}`;

    turnInterval = setInterval(() => {
        timeLeft--;
        document.getElementById('displayTimer').innerText = `00:${timeLeft.toString().padStart(2, '0')}`;
        
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
});
