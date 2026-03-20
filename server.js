const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const rooms = {};

io.on('connection', (socket) => {
    socket.on('createRoom', ({ playerName, settings }) => {
        const roomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
        rooms[roomCode] = {
            id: roomCode,
            host: socket.id,
            state: 'lobby',
            settings: {
                wordsPerPlayer: settings.wordsPerPlayer || 5,
                baseTime: settings.baseTime || 60,
                numTeams: settings.numTeams || 2
            },
            players: { [socket.id]: { name: playerName, team: 0, wordsSubmitted: false } },
            teams: Array.from({ length: settings.numTeams }, () => ({ score: 0, members: [socket.id] })),
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
        if (room && room.state === 'lobby') {
            let teamIndex = 0;
            let minMembers = room.teams[0].members.length;
            room.teams.forEach((team, idx) => {
                if (team.members.length < minMembers) {
                    minMembers = team.members.length;
                    teamIndex = idx;
                }
            });

            room.players[socket.id] = { name: playerName, team: teamIndex, wordsSubmitted: false };
            room.teams[teamIndex].members.push(socket.id);
            socket.join(roomCode);
            
            socket.emit('roomJoined', { roomCode, isHost: false, roomData: room });
            io.to(roomCode).emit('updateRoom', room);
        }
    });

    socket.on('startGamePhase', (roomCode) => {
        const room = rooms[roomCode];
        if (room && room.host === socket.id) {
            room.state = 'submitting';
            io.to(roomCode).emit('updateRoom', room);
        }
    });

    socket.on('submitWords', ({ roomCode, words }) => {
        const room = rooms[roomCode];
        if (room) {
            room.bucket.push(...words);
            room.players[socket.id].wordsSubmitted = true;
            
            const allSubmitted = Object.values(room.players).every(p => p.wordsSubmitted);
            if (allSubmitted) {
                room.state = 'playing';
                room.activeBucket = [...room.bucket].sort(() => Math.random() - 0.5);
                io.to(roomCode).emit('startRound', room);
            } else {
                io.to(roomCode).emit('updateRoom', room);
            }
        }
    });

    socket.on('startTurn', (roomCode) => {
        const room = rooms[roomCode];
        if (!room) return;

        const currentTeamSize = room.teams[room.turn.teamIndex].members.length;
        const maxTeamSize = Math.max(...room.teams.map(t => t.members.length));
        
        let allocatedTime = room.settings.baseTime;
        if (currentTeamSize > 0 && currentTeamSize < maxTeamSize) {
            allocatedTime = Math.round(room.settings.baseTime * (maxTeamSize / currentTeamSize));
        }

        io.to(roomCode).emit('turnStarted', {
            time: allocatedTime,
            activeTeam: room.turn.teamIndex,
            activePlayer: room.teams[room.turn.teamIndex].members[room.turn.playerIndex],
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
            room.turn.playerIndex = (room.turn.playerIndex + 1) % room.teams[0].members.length; 
        }

        io.to(roomCode).emit('updateRoom', room);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
