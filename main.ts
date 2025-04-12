import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { Game } from "./game";
const app = express();
const server = createServer(app);
const io = new Server(server);
// boilerplate
io.use((socket, next) => {
  if (socket.handshake.query.token === "UNITY") {
    next();
  } else {
    next(new Error("Authentication error"));
  }
});

app.get("/", (req, res) => {
  res.send({ message: "Hello World!" });
});


// Main logic

const games: Game[] = [];

function joinGame(isAgainstAI: boolean): Game {
  if (isAgainstAI) {
    const game = new Game();
    games.push(game);
    return game;
  }
  const game = games.find((game) => !game.isFull() && !game.isEnded());
  if (game) {
    return game;
  }
  const newGame = new Game();
  games.push(newGame);
  return newGame;
}

io.on("connection", (socket) => {
  console.log("A user connected");

  // Initialize: handing them the player id and game state

  const game = joinGame(true);
  const playerId = game.addHumanPlayer();
  socket.emit("init", { playerId, game: JSON.parse(JSON.stringify(game)) });

  game.onUpdate(() => {
    socket.emit("update", { game: JSON.parse(JSON.stringify(game)) });
  })

  game.onEnd(() => {
    socket.emit("gameOver", { game: JSON.parse(JSON.stringify(game)) });
  })

  socket.on("move", (data) => {
    const { playerId, info } = data;
    game.move(playerId, info);
  })
  
  socket.on("disconnect", () => {
    console.log("user disconnected");
  });
});



// Serve
server.listen(3000, () => {
  console.log("server running at http://localhost:3000");
});
