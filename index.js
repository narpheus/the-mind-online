const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let players = [];
let gameData = {
  level: 1,
  lives: 0,
  shuriken: 0,
  playedCards: [],
  playerHands: {}, // { playerName: [cards] }
  started: false,
};

function resetGame() {
  players = [];
  gameData = {
    level: 1,
    lives: 0,
    shuriken: 0,
    playedCards: [],
    playerHands: {},
    started: false,
  };
}

io.on('connection', (socket) => {
  console.log('새 접속:', socket.id);

  socket.on('joinGame', (name) => {
    if (players.find(p => p.name === name)) {
      socket.emit('status', '중복된 닉네임입니다.');
      return;
    }
    players.push({ id: socket.id, name });
    gameData.playerHands[name] = [];
    updateLivesShurikenByPlayersCount();

    io.emit('playerListUpdate', players);
    socket.emit('joined', players);
    console.log('플레이어 목록:', players.map(p=>p.name));
  });

  socket.on('startGame', () => {
    if (gameData.started) return;
    if (players.length < 2 || players.length > 4) {
      io.to(socket.id).emit('status', '2명에서 4명만 게임을 시작할 수 있습니다.');
      return;
    }
    gameData.started = true;
    gameData.level = 1;
    updateLivesShurikenByPlayersCount();
    dealCards();
    io.emit('gameStarted', gameData);
  });

  socket.on('requestNextLevel', () => {
    if (!gameData.started) return;
    if (gameData.level >= maxLevelForPlayers(players.length)) {
      io.emit('gameOver', true);
      resetGame();
      return;
    }
    gameData.level++;
    // 레벨 통과에 따른 생명/수리검 증감
    if ([2,5,8].includes(gameData.level)) gameData.shuriken++;
    if ([3,6,9].includes(gameData.level)) gameData.lives++;

    dealCards();
    io.emit('nextLevel');
    io.emit('updateGame', gameData);
  });

  socket.on('requestShurikenUse', () => {
    if (gameData.shuriken < 1) return;
    io.emit('showShurikenVote');
  });

  let shurikenVotes = {};

  socket.on('shurikenVote', (agree) => {
    shurikenVotes[socket.id] = agree;
    // 모두 찬성인지 확인
    if (Object.keys(shurikenVotes).length === players.length) {
      const allAgree = Object.values(shurikenVotes).every(v => v);
      io.emit('hideShurikenVote');
      if (allAgree) {
        gameData.shuriken--;
        const revealCards = [];
        for (const p of players) {
          if (gameData.playerHands[p.name] && gameData.playerHands[p.name].length > 0) {
            revealCards.push(Math.min(...gameData.playerHands[p.name]));
          }
        }
        io.emit('shurikenReveal', revealCards);
      }
      shurikenVotes = {};
      io.emit('updateGame', gameData);
    }
  });

  socket.on('emoji', (emoji) => {
    const player = players.find(p => p.id === socket.id);
    if (!player) return;
    io.emit('emoji', { player: player.name, emoji });
  });

  socket.on('disconnect', () => {
    players = players.filter(p => p.id !== socket.id);
    delete gameData.playerHands[players.find(p => p.id === socket.id)?.name];
    io.emit('playerListUpdate', players);
  });

  // 유틸 함수
  function updateLivesShurikenByPlayersCount() {
    const count = players.length;
    gameData.lives = count; // 초기 생명 = 참가자 수
    gameData.shuriken = count - 1;
  }

  function maxLevelForPlayers(count) {
    if (count === 2) return 12;
    if (count === 3) return 10;
    if (count === 4) return 8;
    return 0;
  }

  function dealCards() {
    gameData.playedCards = [];
    gameData.playerHands = {};
    const maxCardNum = 100;
    const cardsPerPlayer = gameData.level;

    // 중복없이 플레이어마다 카드 나눠줌
    let deck = Array.from({ length: maxCardNum }, (_, i) => i + 1);
    shuffle(deck);

    for (const p of players) {
      gameData.playerHands[p.name] = deck.splice(0, cardsPerPlayer).sort((a,b) => a-b);
    }
  }

  function shuffle(array) {
    for(let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`서버가 http://localhost:${PORT} 에서 실행중입니다.`);
});
