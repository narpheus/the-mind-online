const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

const PORT = process.env.PORT || 3000;

let players = [];
let gameData = {
  started: false,
  level: 1,
  lives: 0,
  shuriken: 0,
  playerCards: {},  // { socketId: [cards] }
  playedCards: [],  // { playerId, card }
  readyForNextLevel: [],
  shurikenVotes: {}, // { socketId: 'accept'/'reject' }
};

const maxLevelByPlayers = {2:12,3:10,4:8};

function resetGameData() {
  gameData = {
    started: false,
    level: 1,
    lives: 0,
    shuriken: 0,
    playerCards: {},
    playedCards: [],
    readyForNextLevel: [],
    shurikenVotes: {},
  };
}

function getLivesShurikenByPlayerCount(count) {
  let lives = count;
  let shuriken = 1;
  return { lives, shuriken };
}

function updateLivesShurikenByLevel() {
  const n = players.length;
  const level = gameData.level;
  let { lives, shuriken } = getLivesShurikenByPlayerCount(n);
  for (let lv=2; lv<=level; lv++) {
    if ([2,5,8].includes(lv)) shuriken++;
    if ([3,6,9].includes(lv)) lives++;
  }
  gameData.lives = lives;
  gameData.shuriken = shuriken;
}

function dealCards() {
  const n = players.length;
  if (n < 2 || n > 4) return false;
  let deck = [];
  for (let i=1; i<=100; i++) deck.push(i);
  deck = shuffle(deck);

  gameData.playerCards = {};
  for (const p of players) {
    gameData.playerCards[p.id] = [];
  }

  let cardsPerPlayer = gameData.level;
  if (cardsPerPlayer > 12) cardsPerPlayer = 12;

  for (let i=0; i<cardsPerPlayer; i++) {
    for (const p of players) {
      gameData.playerCards[p.id].push(deck.pop());
    }
  }

  for (const p of players) {
    gameData.playerCards[p.id].sort((a,b) => a-b);
  }
  gameData.playedCards = [];
  gameData.readyForNextLevel = [];
  gameData.shurikenVotes = {};
}

function shuffle(array) {
  let currentIndex = array.length, randomIndex;
  while(currentIndex != 0){
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
  }
  return array;
}

function checkGameClear() {
  const n = players.length;
  if (gameData.level > maxLevelByPlayers[n]) {
    return true;
  }
  return false;
}

function resetPlayerReady() {
  gameData.readyForNextLevel = [];
}

function resetShurikenVotes() {
  gameData.shurikenVotes = {};
}

function allPlayersReady() {
  return gameData.readyForNextLevel.length === players.length;
}

function allShurikenVoteAccepted() {
  if (Object.keys(gameData.shurikenVotes).length !== players.length) return false;
  return Object.values(gameData.shurikenVotes).every(v => v === 'accept');
}

function allShurikenVoteDecided() {
  return Object.keys(gameData.shurikenVotes).length === players.length;
}

io.on('connection', (socket) => {
  console.log('접속:', socket.id);

  socket.on('joinGame', (name) => {
    if (!name) {
      socket.emit('status', '닉네임을 입력하세요.');
      return;
    }
    if (players.find(p => p.id === socket.id)) return;
    players.push({id: socket.id, name});
    console.log(`플레이어 입장: ${name} (${socket.id})`);
    io.emit('playersUpdate', players);

    if (players.length >= 2 && players.length <= 4) {
      io.emit('status', '게임 시작 가능! 시작 버튼을 누르세요.');
    } else {
      io.emit('status', '2명에서 4명만 게임 시작 가능.');
    }
  });

  socket.on('startGame', () => {
    if (gameData.started) {
      socket.emit('status', '이미 게임이 시작되었습니다.');
      return;
    }
    if (players.length < 2 || players.length > 4) {
      io.to(socket.id).emit('status', '플레이어 수가 2~4명이 아닙니다.');
      return;
    }
    gameData.started = true;
    gameData.level = 1;
    updateLivesShurikenByLevel();
    dealCards();
    io.emit('gameStarted', gameData);
    io.emit('status', `레벨 1 시작! 생명: ${gameData.lives}, 수리검: ${gameData.shuriken}`);
  });

  socket.on('playCard', (card) => {
    if (!gameData.started) {
      socket.emit('status', '게임이 시작되지 않았습니다.');
      return;
    }
    if (!gameData.playerCards[socket.id]?.includes(card)) {
      socket.emit('status', '내 카드에 없는 숫자입니다.');
      return;
    }
    gameData.playerCards[socket.id] = gameData.playerCards[socket.id].filter(c => c !== card);
    gameData.playedCards.push({playerId: socket.id, card});
    io.emit('cardPlayed', {playerId: socket.id, card});
    resetShurikenVotes();

    let allEmpty = players.every(p => gameData.playerCards[p.id].length === 0);
    if (allEmpty) {
      io.emit('status', '레벨 완료! 다음 레벨로 진행하세요.');
    }
  });

  socket.on('nextLevel', () => {
    if (!gameData.started) {
      socket.emit('status', '게임이 시작되지 않았습니다.');
      return;
    }
    if (!gameData.readyForNextLevel.includes(socket.id)) {
      gameData.readyForNextLevel.push(socket.id);
    }
    io.emit('status', `${players.find(p => p.id === socket.id)?.name} 님 다음 레벨 준비 완료`);
    if (allPlayersReady()) {
      gameData.level++;
      if (checkGameClear()) {
        io.emit('status', '축하합니다! 신이 되셨습니다! 🎉');
        gameData.started = false;
        resetGameData();
        io.emit('gameReset');
        return;
      }
      updateLivesShurikenByLevel();
      dealCards();
      resetPlayerReady();
      io.emit('gameStarted', gameData);
      io.emit('status', `레벨 ${gameData.level} 시작! 생명: ${gameData.lives}, 수리검: ${gameData.shuriken}`);
    }
  });

  socket.on('useShuriken', () => {
    if (!gameData.started) {
      socket.emit('status', '게임이 시작되지 않았습니다.');
      return;
    }
    if (gameData.shuriken < 1) {
      socket.emit('status', '수리검이 없습니다.');
      return;
    }
    if (Object.keys(gameData.shurikenVotes).length > 0) {
      socket.emit('status', '이미 수리검 요청 중입니다.');
      return;
    }
    io.emit('shurikenVoteStart');
  });

  socket.on('shurikenVote', (vote) => {
    if (!gameData.started) {
      socket.emit('status', '게임이 시작되지 않았습니다.');
      return;
    }
    if (!(vote === 'accept' || vote === 'reject')) {
      socket.emit('status', '잘못된 투표입니다.');
      return;
    }
    if (gameData.shurikenVotes[socket.id]) {
      socket.emit('status', '이미 투표하셨습니다.');
      return;
    }
    gameData.shurikenVotes[socket.id] = vote;
    io.emit('shurikenVotesUpdate', gameData.shurikenVotes);

    if (allShurikenVoteDecided()) {
      if (allShurikenVoteAccepted()) {
        gameData.shuriken--;
        // 각 플레이어가 가장 작은 카드 공개 (내림차순)
        let smallestCards = [];
        for (const p of players) {
          let cards = gameData.playerCards[p.id];
          if (cards.length > 0) {
            smallestCards.push({playerId: p.id, card: cards[0]});
            // 카드 제거
            gameData.playerCards[p.id].shift();
          }
        }
        smallestCards.sort((a,b) => a.card - b.card);
        for (const c of smallestCards) {
          gameData.playedCards.push({playerId: c.playerId, card: c.card});
        }
        io.emit('shurikenUsed', {shuriken: gameData.shuriken, revealedCards: smallestCards});
        // 수리검 투표 초기화
        resetShurikenVotes();

        // 생명 체크 안함(필요시 여기에 추가 가능)
      } else {
        io.emit('status', '수리검 요청이 거부되었습니다.');
        resetShurikenVotes();
      }
    }
  });

  socket.on('sendEmotion', (emotion) => {
    const player = players.find(p => p.id === socket.id);
    if (player && ['wow', 'sad'].includes(emotion)) {
      io.emit('playerEmotion', {playerId: socket.id, emotion});
    }
  });

  socket.on('disconnect', () => {
    console.log('접속 종료:', socket.id);
    players = players.filter(p => p.id !== socket.id);
    io.emit('playersUpdate', players);

    // 플레이어가 사라지면 게임 초기화
    if (players.length < 2 && gameData.started) {
      io.emit('status', '플레이어가 너무 적어 게임이 종료됩니다.');
      gameData.started = false;
      resetGameData();
      io.emit('gameReset');
    }
  });
});

http.listen(PORT, () => {
  console.log(`서버 실행 중: http://localhost:${PORT}`);
});
