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
let shurikenVotes = new Set();

function createDeck() {
  return Array.from({ length: 100 }, (_, i) => i + 1);
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function updateResources() {
  io.emit('update-resources', { lives, shuriken, level });
}

function applyRewards() {
  // 레벨별 보상
  const rewardMap = {
    2: 'shuriken',
    3: 'life',
    5: 'shuriken',
    6: 'life',
    8: 'shuriken',
    9: 'life',
  };
  const reward = rewardMap[level];
  if (reward === 'life') {
    lives++;
    io.emit('status', `🎉 레벨 ${level} 통과! 생명 +1 획득!`);
  }
  if (reward === 'shuriken') {
    shuriken++;
    io.emit('status', `🎉 레벨 ${level} 통과! 수리검 +1 획득!`);
  }
  updateResources();
}

function checkGameClear() {
  const playerCount = players.length;
  const levelClearMap = { 2: 12, 3: 10, 4: 8 };
  return level >= (levelClearMap[playerCount] || 8);
}

io.on('connection', (socket) => {
  console.log('접속됨:', socket.id);

  socket.on('join', (name) => {
    if (!players.find(p => p.id === socket.id)) {
      players.push({ id: socket.id, name });
    }
    lives = players.length; // 참가자 수 = 생명
    io.emit('playerList', players);
    updateResources();
    console.log('플레이어 참가:', name);
  });

  socket.on('disconnect', () => {
    players = players.filter(p => p.id !== socket.id);
    delete hands[socket.id];
    shurikenVotes.delete(socket.id);
    io.emit('playerList', players);
    updateResources();
    console.log('퇴장:', socket.id);
  });

  socket.on('start', () => {
    const deck = createDeck();
    shuffle(deck);

    level = 1;
    lastPlayed = 0;
    shurikenVotes.clear();

    hands = {};
    players.forEach(p => {
      hands[p.id] = [];
      for (let i = 0; i < level; i++) {
        hands[p.id].push(deck.pop());
      }
      io.to(p.id).emit('hand', hands[p.id]);
    });

    lives = players.length; // 시작할 때 생명 초기화
    shuriken = 1; // 초기 수리검 1개
    updateResources();
    io.emit('status', `레벨 ${level} 시작!`);
  });

  socket.on('play', (card) => {
    if (card < lastPlayed) {
      lives--;
      io.emit('life-lost');
      if (lives <= 0) {
        io.emit('game-over', '💀 생명이 모두 소진되었습니다. 신이 되지 못했습니다!');
        return;
      }
    } else {
      lastPlayed = card;
    }

    const player = players.find(p => p.id === socket.id);
    io.emit('played', { by: player ? player.name : socket.id.slice(0, 5), card });

    if (hands[socket.id]) {
      hands[socket.id] = hands[socket.id].filter(c => c !== card);
    }
    updateResources();

    // 모든 플레이어가 카드를 다 냈으면 레벨 클리어 or 게임 클리어
    const allCardsEmpty = Object.values(hands).every(cards => cards.length === 0);
    if (allCardsEmpty) {
      if (checkGameClear()) {
        io.emit('game-won');
      } else {
        io.emit('game-over', '🎉 모든 플레이어가 카드를 다 냈습니다! 다음 레벨로 넘어가세요!');
      }
    }
  });

  // 수리검 요청 이벤트
  socket.on('request-shuriken', () => {
    if (!players.find(p => p.id === socket.id)) return;

    shurikenVotes.add(socket.id);
    io.emit('shuriken-requested', Array.from(shurikenVotes));

    if (shurikenVotes.size === players.length && shuriken > 0) {
      shuriken--;
      shurikenVotes.clear();

      let revealedCards = [];

      players.forEach(p => {
        if (hands[p.id] && hands[p.id].length > 0) {
          const minCard = Math.min(...hands[p.id]);
          hands[p.id] = hands[p.id].filter(c => c !== minCard);
          revealedCards.push(minCard);
        }
      });

      revealedCards.sort((a, b) => a - b);

      io.emit('shuriken-used', revealedCards);
      updateResources();
    }
  });

  socket.on('next-level', () => {
    level++;
    lastPlayed = 0;
    shurikenVotes.clear();

    applyRewards();

    const deck = createDeck();
    shuffle(deck);

    hands = {};
    players.forEach(p => {
      hands[p.id] = [];
      for (let i = 0; i < level; i++) {
        hands[p.id].push(deck.pop());
      }
      io.to(p.id).emit('hand', hands[p.id]);
    });

    io.emit('status', `레벨 ${level} 시작!`);
    updateResources();
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`서버 실행 중: http://localhost:${PORT}`);
});
