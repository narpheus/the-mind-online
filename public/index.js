const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let players = [];
let hands = {};
let lives = 0;
let shuriken = 1;
let level = 1;
let maxLevel = 12;
let deck = [];
let shurikenVote = {};

const SHURIKEN_REWARD_LEVELS = [2, 5, 8];
const LIFE_REWARD_LEVELS = [3, 6, 9];

function createDeck(max) {
  const cards = [];
  for (let i = 1; i <= max; i++) cards.push(i);
  return cards.sort(() => Math.random() - 0.5);
}

function dealCards() {
  deck = createDeck(100);
  hands = {};
  players.forEach(p => {
    hands[p.id] = deck.splice(0, level).sort((a, b) => a - b);
  });
}

function broadcastGameState() {
  io.emit('update-resources', { lives, shuriken, level });
  io.emit('playerList', players);
}

io.on('connection', (socket) => {
  socket.on('join', (name) => {
    if (players.find(p => p.id === socket.id)) return;
    players.push({ id: socket.id, name });
    broadcastGameState();
  });

  socket.on('start', () => {
    if (players.length < 2 || players.length > 4) return;
    lives = players.length;
    shuriken = 1;
    level = 1;
    maxLevel = players.length === 2 ? 12 : players.length === 3 ? 10 : 8;
    dealCards();
    players.forEach(p => io.to(p.id).emit('hand', hands[p.id]));
    broadcastGameState();
  });

  socket.on('play', (card) => {
    if (!hands[socket.id]) return;
    const playerHand = hands[socket.id];
    const smallestRemaining = Math.min(...Object.values(hands).flat());

    if (card !== smallestRemaining) {
      lives--;
      io.emit('life-lost');
      if (lives <= 0) {
        io.emit('game-over', '💀 신이 되지 못했다!');
        return;
      }
    }
    hands[socket.id] = playerHand.filter(c => c !== card);
    io.emit('played', { card, by: players.find(p => p.id === socket.id).name });

    if (Object.values(hands).every(h => h.length === 0)) {
      level++;
      if (SHURIKEN_REWARD_LEVELS.includes(level - 1)) shuriken++;
      if (LIFE_REWARD_LEVELS.includes(level - 1)) lives++;

      if (level > maxLevel) {
        io.emit('game-over', '✨ 모든 레벨 클리어! 신이 되었다! ✨');
        return;
      }
      io.emit('status', `🎉 레벨 ${level - 1} 클리어! 다음 레벨로...`);
      io.emit('next-level-ready');
    }
  });

  socket.on('next-level', () => {
    dealCards();
    players.forEach(p => io.to(p.id).emit('hand', hands[p.id]));
    broadcastGameState();
  });

  socket.on('use-shuriken', () => {
    if (shuriken <= 0) return;
    shurikenVote = {};
    io.emit('shuriken-vote-request');
  });

  socket.on('shuriken-vote', (agree) => {
    shurikenVote[socket.id] = agree;
    if (Object.keys(shurikenVote).length === players.length) {
      if (Object.values(shurikenVote).every(v => v)) {
        shuriken--;
        let revealed = [];
        players.forEach(p => {
          const min = Math.min(...hands[p.id]);
          revealed.push(min);
          hands[p.id] = hands[p.id].filter(c => c !== min);
        });
        io.emit('shuriken-used', revealed);
        broadcastGameState();
        io.emit('status', '🥷 수리검이 사용되었습니다!');
      } else {
        io.emit('status', '❌ 수리검 사용이 거절되었습니다.');
      }
      shurikenVote = {};
    }
  });

  socket.on('emoji', (emoji) => {
    io.emit('emoji', { from: players.find(p => p.id === socket.id).name, emoji });
  });

  socket.on('disconnect', () => {
    players = players.filter(p => p.id !== socket.id);
    delete hands[socket.id];
    broadcastGameState();
  });
});

server.listen(3000, () => console.log('Server running on http://localhost:3000'));
