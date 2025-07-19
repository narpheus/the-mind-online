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

function resetShurikenVotes() {
  gameData.shurikenVotes = {};
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

    // 카드 제거
    gameData.playerCards[socket.id] = gameData.playerCards[socket.id].filter(c => c !== card);
    gameData.playedCards.push({playerId: socket.id, card});
    io.emit('cardPlayed', {playerId: socket.id, card});
    resetShurikenVotes();

    // 실패 조건 체크
    const playedNumbers = gameData.playedCards.map(p => p.card).sort((a,b)=>a-b);
    const minCard = playedNumbers[0];
    for (const p of players) {
      const playerCards = gameData.playerCards[p.id];
      if (playerCards.length > 0 && playerCards[0] < minCard) {
        // 실패! 내 카드보다 더 작은 카드가 아직 있음
        gameData.lives--;
        io.emit('status', `실패! 생명이 1 감소했습니다. 남은 생명: ${gameData.lives}`);
        if (gameData.lives <= 0) {
          io.emit('gameOver', '생명이 모두 소진되었습니다. 신이 되지 못했습니다...');
          gameData.started = false;
          resetGameData();
          io.emit('gameReset');
          return;
        } else {
          // 실패 시 깔린 카드도 초기화하고 다시 같은 레벨 카드 분배
          dealCards();
          io.emit('gameStarted', gameData);
          return;
        }
      }
    }

    // 성공 판단 - 모든 카드가 비었으면 성공
    let allEmpty = players.every(p => gameData.playerCards[p.id].length === 0);

    if (allEmpty) {
      io.emit('status', `레벨 ${gameData.level} 성공! 다음 레벨로 넘어갑니다.`);

      // 레벨 보너스 지급
      if ([2,5,8].includes(gameData.level)) gameData.shuriken++;
      if ([3,6,9].includes(gameData.level)) gameData.lives++;

      // 레벨 증가
      gameData.level++;

      // 클리어 체크
      if (checkGameClear()) {
        io.emit('gameClear', '축하합니다! 신이 되셨습니다! 🎉');
        gameData.started = false;
        resetGameData();
        io.emit('gameReset');
        return;
      }

      dealCards();
      io.emit('gameStarted', gameData);
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

    if (Object.keys(gameData.shurikenVotes).length === players.length) {
      const allAccept = Object.values(gameData.shurikenVotes).every(v => v === 'accept');
      if (allAccept) {
        gameData.shuriken--;

        // 가장 작은 카드 공개 및 제거
        let smallestCards = [];
        for (const p of players) {
          let cards = gameData.playerCards[p.id];
          if (cards.length > 0) {
            smallestCards.push({playerId: p.id, card: cards[0]});
            gameData.playerCards[p.id].shift();
          }
        }
        smallestCards.sort((a,b) => a.card - b.card);
        gameData.playedCards.push(...smallestCards);

        io.emit('shurikenUsed', {shuriken: gameData.shuriken, revealedCards: smallestCards});
        resetShurikenVotes();
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

    if (players.length < 2 && gameData.started) {
      io.emit('status', '플레이어가 부족하여 게임이 중단됩니다.');
      gameData.started = false;
      resetGameData();
      io.emit('gameReset');
    }
  });

  socket.on('gameResetRequest', () => {
    if (gameData.started) {
      io.emit('status', '게임이 이미 진행 중입니다.');
      return;
    }
    resetGameData();
    io.emit('gameReset');
    io.emit('status', '게임이 초기화되었습니다. 참가하세요!');
  });
});

http.listen(PORT, () => {
  console.log(`서버 실행중: http://localhost:${PORT}`);
});
