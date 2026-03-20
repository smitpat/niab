const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const rooms = {};

const cuteTeamNames = [
    "Tony Tony Chopper", "Bepo", "Karoo", 
    "Moo Deng", "Capybara", "Red Panda", 
    "Sakura", "Daisy", "Peony", 
    "Matcha Mochi", "Sonny Angel", "Smiski" 
];

io.on('connection', (socket) => {
    const emitRoomUpdate = (roomCode) => {
        if(rooms[roomCode]) io.to(roomCode).emit('updateRoom', rooms[roomCode]);
    };

    socket.on('createRoom', ({ playerName, settings }) => {
        const roomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
        const shuffledNames = [...cuteTeamNames].sort(() => 0.5 - Math.random());
        
        rooms[roomCode] = {
            id: roomCode, host: playerName, state: 'lobby',
            settings: { wordsPerPlayer: settings.wordsPerPlayer || 5, baseTime: settings.baseTime || 60, numTeams: settings.numTeams || 2 },
            players: { [playerName]: { socketId: socket.id, team: -1, wordsSubmitted: false, wordCount: 0, online: true } },
            teams: Array.from({ length: settings.numTeams }, (_, i) => ({ name: shuffledNames[i] || `Team ${i+1}`, score: 0, members: [] })),
            bucket: [], activeBucket: [], round: 1, turn: { teamIndex: 0, playerIndex: 0 }
        };
        socket.join(roomCode);
        socket.emit('roomJoined', { roomCode, isHost: true, roomData: rooms[roomCode] });
    });

    socket.on('joinRoom', ({ roomCode, playerName }) => {
        const room = rooms[roomCode];
        if (!room) return socket.emit('errorMsg', 'Room not found.');
        socket.join(roomCode);

        if (room.players[playerName]) {
            room.players[playerName].socketId = socket.id;
            room.players[playerName].online = true;
            if (playerName.toLowerCase() === 'sharky') room.host = playerName;
            socket.emit('roomJoined', { roomCode, isHost: room.host === playerName, roomData: room });
            emitRoomUpdate(roomCode);
            return;
        }

        if (room.state === 'playing' ||
