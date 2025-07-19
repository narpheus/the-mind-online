const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('.'));

let players = []; // {id, name}
let hands = {};
let lives = 3;
let shuriken = 1;
let level = 1;
let lastPlayed = 0;

io.on('connection', (socket) => {
  console.log('접속됨:', socket.id);

  socket.on('join', (name) => {
    players.push({ id: socket.id, name });
    io.emit('playerList', players);
    console.log('플레이어 참가:', name);
  });

  socket.on('disconnect', () => {
    players = players.filter(p => p.id !== socket.id);
    delete hands[socket.id];
    io.emit('playerList', players);
    console.log('퇴장:', socket.id);
  });

  socket.on('start', () => {
    const deck = Array.from({ length: 100 }, (_, i) => i + 1);
    shuffle(deck);

    lives = 3;
    shuriken = 1;
    level = 1;
    lastPlayed = 0;

    hands = {};
    players.forEach(p => {
      hands[p.id] = [deck.pop()];
      io.to(p.id).emit('hand', hands[p.id]);
    });

    io.emit('update-resources', { lives, shuriken, level });
  });

  socket.on('play', (card) => {
    if (card < lastPlayed) {
      lives -= 1;
      io.emit('life-lost');
    } else {
      lastPlayed = card;
    }

    const player = players.find(p => p.id === socket.id);
    io.emit('played', { by: player ? player.name : socket.id.slice(0,5), card });
    io.emit('update-resources', { lives, shuriken, level });
  });

  socket.on('use-shuriken', () => {
    if (shuriken <= 0) return;
    shuriken -= 1;

    let minCards = [];
    players.forEach(p => {
      if (hands[p.id] && hands[p.id].length > 0) {
        minCards.push({ id: p.id, card: Math.min(...hands[p.id]) });
      }
    });

    const globalMin = Math.min(...minCards.map(x => x.card));

    // 공개하고 손에서 제거
    for (let obj of minCards) {
      if (obj.card === globalMin) {
        hands[obj.id] = hands[obj.id].filter(c => c !== obj.card);
      }
    }

    io.emit('shuriken-used', globalMin);
    io.emit('update-resources', { lives, shuriken, level });
  });
});

function shuffle(arr) {
  for (let i = arr.length -1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i+1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

http.listen(3000, () => {
  console.log('서버 실행 중: http://localhost:3000');
});
