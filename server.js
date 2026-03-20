const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const rooms = {};

io.on('connection', (socket) => {
    const emitRoomUpdate = (roomCode) => {
        if(rooms[roomCode]) io.to(roomCode).emit('updateRoom', rooms[roomCode]);
    };

    socket.on('createRoom', ({ playerName, settings }) => {
        const roomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
        const isSharky = playerName.toLowerCase() === 'sharky';
        
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
                    team: -1, // -1 means Unassigned
                    wordsSubmitted: false, 
                    wordCount: 0,
                    online: true
                } 
            },
            teams: Array.from({ length: settings.numTeams }, () => ({ score: 0, members: [] })),
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
            room.players[playerName].online = true;
            
            // The Sharky Rule (in case Sharky disconnects and rejoins)
            if (playerName.toLowerCase() === 'sharky') room.host = playerName;
            
            socket.emit('roomJoined', { roomCode, isHost: room.host === playerName, roomData: room });
            emitRoomUpdate(roomCode);
            return;
        }

        if (room.state === 'playing' || room.state === 'gameover') {
            return socket.emit('errorMsg', 'Game already in progress.');
        }

        // New player joins as Unassigned (-1)
        room.players[playerName] = { socketId: socket.id, team: -1, wordsSubmitted: false, wordCount: 0, online: true };
        
        // The Sharky Rule (New Join)
        if (playerName.toLowerCase() === 'sharky') {
            room.host = playerName;
        }

        socket.emit('roomJoined', { roomCode, isHost: room.host === playerName, roomData: room });
        emitRoomUpdate(roomCode);
    });

    socket.on('assignTeam', ({ roomCode, targetPlayer, newTeamIndex }) => {
        const room = rooms[roomCode];
        if (!room) return;

        const oldTeamIndex = room.players[targetPlayer].team;
        if (oldTeamIndex === newTeamIndex) return;

        // Remove from old team if they were assigned
        if (oldTeamIndex !== -1) {
            room.teams[oldTeamIndex].members = room.teams[oldTeamIndex].members.filter(p => p !== targetPlayer);
        }
        
        // Add to new team
        if (newTeamIndex !== -1) {
            room.teams[newTeamIndex].members.push(targetPlayer);
        }
        
        room.players[targetPlayer].team = newTeamIndex;
        emitRoomUpdate(roomCode);
    });

    socket.on('startGamePhase', (roomCode) => {
        const room = rooms[roomCode];
        if (room && room.host === Object.keys(room.players).find(p => room.players[p].socketId === socket.id)) {
            room.state = 'submitting';
            emitRoomUpdate(roomCode);
        }
    });

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
            
            // Auto-assign to a random balanced team IF they are still unassigned
            if (room.players[playerName].team === -1) {
                const minMembers = Math.min(...room.teams.map(t => t.members.length));
                const availableTeams = room.teams
                    .map((t, i) => ({ count: t.members.length, index: i }))
                    .filter(t => t.count === minMembers);
                
                const randomTeam = availableTeams[Math.floor(Math.random() * availableTeams.length)].index;
                room.players[playerName].team = randomTeam;
                room.teams[randomTeam].members.push(playerName);
            }
            
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

    // Hurry Up Feature
    socket.on('sendHurryUp', (roomCode) => {
        const room = rooms[roomCode];
        if(!room) return;
        
        Object.keys(room.players).forEach(pName => {
            const p = room.players[pName];
            if (!p.wordsSubmitted && p.online) {
                io.to(p.socketId).emit('receiveHurryUp');
            }
        });
    });

    // Host Transfer on Disconnect
    socket.on('disconnect', () => {
        for (const roomCode in rooms) {
            const room = rooms[roomCode];
            for (const pName in room.players) {
                if (room.players[pName].socketId === socket.id) {
                    room.players[pName].online = false;
                    
                    // If the host disconnected, pass it to the next online player (unless they are Sharky, Sharky never surrenders in spirit, but we need a working host)
                    if (room.host === pName) {
                        const nextHost = Object.keys(room.players).find(name => room.players[name].online && name !== pName);
                        if (nextHost) room.host = nextHost;
                    }
                    emitRoomUpdate(roomCode);
                }
            }
        }
    });

    // Gameplay logic remains the same
    socket.on('startTurn', (roomCode) => {
        const room = rooms[roomCode];
        if (!room) return;

        const currentTeam = room.teams[room.turn.teamIndex];
        if (currentTeam.members.length === 0) {
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
        if (room.turn
