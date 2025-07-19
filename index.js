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
let nextLevelVotes = new Set();
let levelClearPending = false; // 다음 레벨 준비 상태 플래그

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
  // 레벨 클리어 후 다음 레벨 시작할 때 주는 보상 맵 (다음 레벨 숫자 기준)
  const rewardMap = {
    3: 'shuriken', // 2레벨 통과 후 3레벨 시작 시 수리검 +1
    4: 'life',     // 3레벨 통과 후 4레벨 시작 시 생명 +1
    6: 'shuriken', // 5레벨 통과 후 6레벨 시작 시 수리검 +1
    7: 'life',     // 6레벨 통과 후 7레벨 시작 시 생명 +1
    9: 'shuriken', // 8레벨 통과 후 9레벨 시작 시 수리검 +1
    10: 'life',    // 9레벨 통과 후 10레벨 시작 시 생명 +1
  };

  const reward = rewardMap[level];
  if (reward === 'life') {
    lives++;
    io.emit('status', `🎉 레벨 ${level} 시작! 생명 +1 획득!`);
  }
  if (reward === 'shuriken') {
    shuriken++;
    io.emit('status', `🎉 레벨 ${level} 시작! 수리검 +1 획득!`);
  }
  updateResources();
}

function checkGameClear() {
  const playerCount = players.length;
  const levelClearMap = { 2: 12, 3: 10, 4: 8 };
  return level >= (levelClearMap[playerCount] || 8);
}

function resetNextLevelVotes() {
  nextLevelVotes.clear();
  io.emit('next-level-status', { count: 0, total: players.length });
}

io.on('connection', (socket) => {
  console.log('접속됨:', socket.id);

  socket.on('join', (name) => {
    if (!players.find(p => p.id === socket.id)) {
      players.push({ id: socket.id, name });
    }
    lives = players.length;
    io.emit('playerList', players);
    updateResources();
    console.log('플레이어 참가:', name);
  });

  socket.on('disconnect', () => {
    players = players.filter(p => p.id !== socket.id);
    delete hands[socket.id];
    shurikenVotes.delete(socket.id);
    nextLevelVotes.delete(socket.id);
    io.emit('playerList', players);
    updateResources();
    console.log('퇴장:', socket.id);
  });

  socket.on('start', () => {
    if(levelClearPending) {
      socket.emit('status', '레벨 클리어 대기 중입니다. 잠시만 기다려주세요.');
      return; // 레벨 클리어 대기중이면 시작 못함
    }

    const deck = createDeck();
    shuffle(deck);

    level = 1;
    lastPlayed = 0;
    shurikenVotes.clear();
    nextLevelVotes.clear();
    levelClearPending = false;

    hands = {};
    players.forEach(p => {
      hands[p.id] = [];
      for (let i = 0; i < level; i++) {
        hands[p.id].push(deck.pop());
      }
      io.to(p.id).emit('hand', hands[p.id]);
    });

    lives = players.length;
    shuriken = 1;
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

    const allCardsEmpty = Object.values(hands).every(cards => cards.length === 0);
    if (allCardsEmpty) {
      if (checkGameClear()) {
        io.emit('game-won');
        levelClearPending = true;
        resetNextLevelVotes();
      } else {
        io.emit('game-over', '🎉 모든 플레이어가 카드를 다 냈습니다! 다음 레벨로 넘어가세요!');
        levelClearPending = true;
        resetNextLevelVotes();
      }
    }
  });

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

      // 수리검으로 모든 카드가 깔렸으면 레벨 클리어 처리
      const allCardsEmpty = Object.values(hands).every(cards => cards.length === 0);
      if (allCardsEmpty) {
        if (checkGameClear()) {
          io.emit('game-won');
        } else {
          io.emit('game-over', '🎉 모든 플레이어가 카드를 다 냈습니다! 다음 레벨로 넘어가세요!');
        }
        levelClearPending = true;
        resetNextLevelVotes();
      }
    }
  });

  socket.on('next-level', () => {
    if (levelClearPending === false) {
      socket.emit('status', '아직 다음 레벨로 넘어갈 수 없습니다.');
      return;
    }

    if (!players.find(p => p.id === socket.id)) return;

    nextLevelVotes.add(socket.id);
    io.emit('next-level-status', { count: nextLevelVotes.size, total: players.length });

    if (nextLevelVotes.size === players.length) {
      level++;
      lastPlayed = 0;
      shurikenVotes.clear();
      nextLevelVotes.clear();
      levelClearPending = false;

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
    }
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`서버 실행 중: http://localhost:${PORT}`);
});
