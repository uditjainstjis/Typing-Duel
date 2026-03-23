import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import { nanoid } from "nanoid";

const PORT = 3000;

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
    },
  });

  // Game state
  const rooms = new Map();

  const TEXT_SNIPPETS = [
    { id: 'easy', text: "The quick brown fox jumps over the lazy dog.", difficulty: 'Easy' },
    { id: 'medium', text: "Success is not final, failure is not fatal: it is the courage to continue that counts.", difficulty: 'Medium' },
    { id: 'hard', text: "In the end, it's not the years in your life that count. It's the life in your years.", difficulty: 'Hard' },
    { id: 'v4', text: "Programming is the art of telling another human what one wants the computer to do.", difficulty: 'Medium' },
    { id: 'v5', text: "The only way to do great work is to love what you do. If you haven't found it yet, keep looking.", difficulty: 'Hard' }
  ];

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("join-room", ({ roomId, nickname }) => {
      socket.join(roomId);
      
      if (!rooms.has(roomId)) {
        rooms.set(roomId, {
          id: roomId,
          players: [],
          status: 'waiting',
          gameMode: 'completion',
          duration: 60,
          snippet: TEXT_SNIPPETS[Math.floor(Math.random() * TEXT_SNIPPETS.length)],
          startTime: null,
          endTime: null,
        });
      }

      const room = rooms.get(roomId);
      const player = {
        id: socket.id,
        nickname: nickname || `Player ${room.players.length + 1}`,
        progress: 0,
        wpm: 0,
        accuracy: 100,
        isFinished: false,
        finishTime: null,
        rematchRequested: false,
      };

      room.players.push(player);
      io.to(roomId).emit("room-update", room);
    });

    socket.on("change-settings", ({ roomId, gameMode, duration }) => {
      const room = rooms.get(roomId);
      if (room && room.status === 'waiting') {
        room.gameMode = gameMode;
        room.duration = duration;
        io.to(roomId).emit("room-update", room);
      }
    });

    socket.on("start-game", (roomId) => {
      const room = rooms.get(roomId);
      if (room && room.status === 'waiting') {
        room.status = 'starting';
        room.players.forEach(p => {
          p.progress = 0;
          p.wpm = 0;
          p.accuracy = 100;
          p.isFinished = false;
          p.finishTime = null;
          p.rematchRequested = false;
        });
        io.to(roomId).emit("room-update", room);

        let countdown = 3;
        const interval = setInterval(() => {
          io.to(roomId).emit("countdown", countdown);
          if (countdown === 0) {
            clearInterval(interval);
            room.status = 'playing';
            room.startTime = Date.now();
            io.to(roomId).emit("room-update", room);

            if (room.gameMode === 'time') {
              setTimeout(() => {
                const currentRoom = rooms.get(roomId);
                if (currentRoom && currentRoom.status === 'playing') {
                  currentRoom.status = 'finished';
                  currentRoom.endTime = Date.now();
                  io.to(roomId).emit("room-update", currentRoom);
                }
              }, room.duration * 1000);
            }
          }
          countdown--;
        }, 1000);
      }
    });

    socket.on("update-progress", ({ roomId, progress, wpm, accuracy }) => {
      const room = rooms.get(roomId);
      if (room && room.status === 'playing') {
        const player = room.players.find(p => p.id === socket.id);
        if (player) {
          player.progress = progress;
          player.wpm = wpm;
          player.accuracy = accuracy;

          if (progress === 100 && !player.isFinished) {
            player.isFinished = true;
            player.finishTime = Date.now() - room.startTime;
            
            if (room.gameMode === 'completion') {
              room.status = 'finished';
              room.endTime = Date.now();
            } else {
              // In time mode, check if all finished early
              const allFinished = room.players.every(p => p.isFinished);
              if (allFinished) {
                room.status = 'finished';
                room.endTime = Date.now();
              }
            }
          }
          io.to(roomId).emit("room-update", room);
        }
      }
    });

    socket.on("request-rematch", (roomId) => {
      const room = rooms.get(roomId);
      if (room) {
        const player = room.players.find(p => p.id === socket.id);
        if (player) {
          player.rematchRequested = true;
          
          // Check if all players requested rematch
          const allRequested = room.players.every(p => p.rematchRequested);
          if (allRequested) {
            // Reset room for new game
            room.status = 'waiting';
            room.startTime = null;
            room.endTime = null;
            room.snippet = TEXT_SNIPPETS[Math.floor(Math.random() * TEXT_SNIPPETS.length)];
            room.players.forEach(p => {
              p.progress = 0;
              p.wpm = 0;
              p.accuracy = 100;
              p.isFinished = false;
              p.finishTime = null;
              p.rematchRequested = false;
            });
          }
          io.to(roomId).emit("room-update", room);
        }
      }
    });

    socket.on("new-text", (roomId) => {
      const room = rooms.get(roomId);
      if (room && room.status === 'waiting') {
        room.snippet = TEXT_SNIPPETS[Math.floor(Math.random() * TEXT_SNIPPETS.length)];
        io.to(roomId).emit("room-update", room);
      }
    });

    socket.on("disconnect", () => {
      rooms.forEach((room, roomId) => {
        const playerIndex = room.players.findIndex(p => p.id === socket.id);
        if (playerIndex !== -1) {
          room.players.splice(playerIndex, 1);
          if (room.players.length === 0) {
            rooms.delete(roomId);
          } else {
            io.to(roomId).emit("room-update", room);
          }
        }
      });
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
