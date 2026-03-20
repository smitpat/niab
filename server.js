const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const rooms = {};

io.on('connection', (socket) => {
    
    // Helper to sync room state
    const emitRoomUpdate = (roomCode) => {
        io.to(roomCode).emit('updateRoom', rooms[roomCode]);
    };

    socket.on('createRoom', ({ playerName, settings }) => {
        const roomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
        rooms[roomCode] = {
            id: roomCode,
            host: playerName,
            state: 'lobby',
            settings: {
                wordsPerPlayer: settings.wordsPerPlayer || 5,
                baseTime: settings.baseTime || 60,
                numTeams: settings.numTeams || 2
            },
            players: { 
                [playerName]: { 
                    socketId: socket.id, 
                    team: 0, 
                    wordsSubmitted: false, 
                    wordCount: 0 
                } 
            },
            teams: Array.from({ length: settings.numTeams }, () => ({ score: 0, members: [playerName] })),
            bucket: [],
            activeBucket: [],
            round: 1,
            turn: { teamIndex: 0, playerIndex: 0 }
        };
        socket.join(roomCode);
        socket.emit('roomJoined', { roomCode, isHost: true, roomData: rooms[roomCode] });
    });

    socket.on('joinRoom', ({ roomCode, playerName }) => {
        const room = rooms[roomCode];
        if (!room) return socket.emit('errorMsg', 'Room not found.');

        socket.join(roomCode);

        // Reconnection Logic
        if (room.players[playerName]) {
            room.players[playerName].socketId = socket.id;
            socket.emit('roomJoined', { roomCode, isHost: room.host === playerName, roomData: room });
            emitRoomUpdate(roomCode);
            return;
        }

        // Only allow new joins if game hasn't fully started rounds
        if (room.state === 'playing' || room.state === 'gameover') {
            return socket.emit('errorMsg', 'Game already in progress.');
        }

        // Auto-assign new player to smallest team
        let teamIndex = 0;
        let minMembers = room.teams[0].members.length;
        room.teams.forEach((team, idx) => {
            if (team.members.length < minMembers) {
                minMembers = team.members.length;
                teamIndex = idx;
            }
        });

        room.players[playerName] = { socketId: socket.id, team: teamIndex, wordsSubmitted: false, wordCount: 0 };
        room.teams[teamIndex].members.push(playerName);
        
        socket.emit('roomJoined', { roomCode, isHost: false, roomData: room });
        emitRoomUpdate(roomCode);
    });

    // Team Assignment (Player or Host)
    socket.on('assignTeam', ({ roomCode, targetPlayer, newTeamIndex }) => {
        const room = rooms[roomCode];
        if (!room) return;

        const oldTeamIndex = room.players[targetPlayer].team;
        if (oldTeamIndex === newTeamIndex) return;

        // Move player
        room.teams[oldTeamIndex].members = room.teams[oldTeamIndex].members.filter(p => p !== targetPlayer);
        room.teams[newTeamIndex].members.push(targetPlayer);
        room.players[targetPlayer].team = newTeamIndex;

        emitRoomUpdate(roomCode);
    });

    socket.on('startGamePhase', (roomCode) => {
        const room = rooms[roomCode];
        if (room && room.players[room.host].socketId === socket.id) {
            room.state = 'submitting';
            emitRoomUpdate(roomCode);
        }
    });

    // Real-time typing status (e.g., 2/5 words)
    socket.on('updateWordCount', ({ roomCode, playerName, count }) => {
        const room = rooms[roomCode];
        if (room && room.players[playerName]) {
            room.players[playerName].wordCount = count;
            emitRoomUpdate(roomCode);
        }
    });

    socket.on('submitWords', ({ roomCode, playerName, words }) => {
        const room = rooms[roomCode];
        if (room) {
            room.bucket.push(...words);
            room.players[playerName].wordsSubmitted = true;
            room.players[playerName].wordCount = words.length;
            
            const allSubmitted = Object.values(room.players).every(p => p.wordsSubmitted);
            if (allSubmitted) {
                room.state = 'playing';
                room.activeBucket = [...room.bucket].sort(() => Math.random() - 0.5);
                io.to(roomCode).emit('startRound', room);
            } else {
                emitRoomUpdate(roomCode);
            }
        }
    });

    // Gameplay Logic (Updated to use playerName instead of socket.id)
    socket.on('startTurn', (roomCode) => {
        const room = rooms[roomCode];
        if (!room) return;

        const currentTeam = room.teams[room.turn.teamIndex];
        if (currentTeam.members.length === 0) {
            // Skip empty teams
            room.turn.teamIndex = (room.turn.teamIndex + 1) % room.settings.numTeams;
            return emitRoomUpdate(roomCode);
        }

        const maxTeamSize = Math.max(...room.teams.map(t => t.members.length));
        let allocatedTime = room.settings.baseTime;
        if (currentTeam.members.length > 0 && currentTeam.members.length < maxTeamSize) {
            allocatedTime = Math.round(room.settings.baseTime * (maxTeamSize / currentTeam.members.length));
        }

        const activePlayerName = currentTeam.members[room.turn.playerIndex];

        io.to(roomCode).emit('turnStarted', {
            time: allocatedTime,
            activeTeam: room.turn.teamIndex,
            activePlayerName: activePlayerName,
            word: room.activeBucket[0]
        });
    });

    socket.on('wordGuessed', (roomCode) => {
        const room = rooms[roomCode];
        if (!room) return;

        room.teams[room.turn.teamIndex].score += 1;
        room.activeBucket.shift();

        if (room.activeBucket.length === 0) {
            room.round += 1;
            if (room.round > 3) {
                room.state = 'gameover';
                io.to(roomCode).emit('gameOver', room);
            } else {
                room.activeBucket = [...room.bucket].sort(() => Math.random() - 0.5);
                io.to(roomCode).emit('roundOver', room);
            }
        } else {
            io.to(roomCode).emit('nextWord', room.activeBucket[0]);
        }
    });

    socket.on('endTurn', (roomCode) => {
        const room = rooms[roomCode];
        if (!room) return;

        room.turn.teamIndex = (room.turn.teamIndex + 1) % room.settings.numTeams;
        if (room.turn.teamIndex === 0) {
            // Cycle player for team 1
            room.turn.playerIndex = (room.turn.playerIndex + 1) % room.teams[0].members.length; 
        }

        emitRoomUpdate(roomCode);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
