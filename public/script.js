const socket = io();

const loginDiv = document.getElementById('loginDiv');
const gameDiv = document.getElementById('gameDiv');
const joinBtn = document.getElementById('joinBtn');
const nameInput = document.getElementById('nameInput');
const playersList = document.getElementById('playersList');
const statusDiv = document.getElementById('status');
const startBtn = document.getElementById('startBtn');
const nextLevelBtn = document.getElementById('nextLevelBtn');
const shurikenBtn = document.getElementById('shurikenBtn');
const yourCardsDiv = document.getElementById('yourCards');
const playedCardsDiv = document.getElementById('playedCards');
const levelDisplay = document.getElementById('levelDisplay');
const livesDisplay = document.getElementById('livesDisplay');
const shurikenDisplay = document.getElementById('shurikenDisplay');
const shurikenVoteDiv = document.getElementById('shurikenVoteDiv');
const acceptShurikenBtn = document.getElementById('acceptShurikenBtn');
const rejectShurikenBtn = document.getElementById('rejectShurikenBtn');
const emotionsDiv = document.getElementById('emotionsDiv');

let playerId = null;
let gameData = null;
let hasVotedShuriken = false;

joinBtn.onclick = () => {
  const name = nameInput.value.trim();
  if (!name) {
    alert('닉네임을 입력하세요.');
    return;
  }
  socket.emit('joinGame', name);
  playerId = socket.id;
  loginDiv.style.display = 'none';
  gameDiv.style.display = 'block';
};

socket.on('playersUpdate', (players) => {
  playersList.textContent = '참가자: ' + players.map(p => p.name).join(', ');
});

socket.on('status', (msg) => {
  statusDiv.textContent = msg;
});

socket.on('gameStarted', (data) => {
  gameData = data;
  levelDisplay.textContent = gameData.level;
  livesDisplay.textContent = gameData.lives;
  shurikenDisplay.textContent = gameData.shuriken;
  nextLevelBtn.disabled = true;
  renderCards();
});

socket.on('cardPlayed', ({playerId: pId, card}) => {
  if (!gameData) return;
  gameData.playedCards.push({playerId: pId, card});
  if (gameData.playerCards[pId]) {
    gameData.playerCards[pId] = gameData.playerCards[pId].filter(c => c !== card);
  }
  renderCards();
});

socket.on('gameReset', () => {
  gameData = null;
  loginDiv.style.display = 'block';
  gameDiv.style.display = 'none';
  yourCardsDiv.innerHTML = '';
  playedCardsDiv.innerHTML = '';
  statusDiv.textContent = '';
  playerId = null;
  hasVotedShuriken = false;
});

socket.on('shurikenVoteStart', () => {
  shurikenVoteDiv.style.display = 'block';
  hasVotedShuriken = false;
});

socket.on('shurikenVotesUpdate', (votes) => {
  // 필요시 표시 가능
});

socket.on('shurikenUsed', ({shuriken, revealedCards}) => {
  gameData.shuriken = shuriken;
  // 플레이어 카드에서 공개된 카드 제거
  for (const c of revealedCards) {
    if (gameData.playerCards[c.playerId]) {
      gameData.playerCards[c.playerId] = gameData.playerCards[c.playerId].filter(x => x !== c.card);
    }
  }
  // 공개 카드 플레이드카드에 추가
  gameData.playedCards.push(...revealedCards);
  renderCards();
  shurikenVoteDiv.style.display = 'none';
  hasVotedShuriken = false;
});

joinBtn.disabled = false;
startBtn.onclick = () => {
  socket.emit('startGame');
  startBtn.disabled = true;
};

nextLevelBtn.onclick = () => {
  socket.emit('nextLevel');
  nextLevelBtn.disabled = true;
};

shurikenBtn.onclick = () => {
  socket.emit('useShuriken');
};

acceptShurikenBtn.onclick = () => {
  if (hasVotedShuriken) return;
  socket.emit('shurikenVote', 'accept');
  hasVotedShuriken = true;
};

rejectShurikenBtn.onclick = () => {
  if (hasVotedShuriken) return;
  socket.emit('shurikenVote', 'reject');
  hasVotedShuriken = true;
};

emotionsDiv.querySelectorAll('button').forEach(btn => {
  btn.onclick = () => {
    socket.emit('sendEmotion', btn.dataset.emotion);
  };
});

socket.on('playerEmotion', ({playerId: pId, emotion}) => {
  const player = gameData && gameData.playerCards && pId ? pId : null;
  if (!player) return;
  // 간단 알림으로 표시 (필요시 UI 개선 가능)
  statusDiv.textContent = `${playersList.textContent.split(', ')[players.findIndex(p => p.id === pId)] || '누군가'}님이 '${emotion === 'wow' ? '대박' : '아쉽다'}'를 보냈습니다.`;
  setTimeout(() => { statusDiv.textContent = ''; }, 3000);
});

function renderCards() {
  if (!gameData) return;

  // 내 카드 그리기
  yourCardsDiv.innerHTML = '';
  if (gameData.playerCards[playerId]) {
    for (const card of gameData.playerCards[playerId]) {
      const cardDiv = document.createElement('div');
      cardDiv.className = 'card';
      cardDiv.textContent = card;
      cardDiv.onclick = () => {
        socket.emit('playCard', card);
      };
      yourCardsDiv.appendChild(cardDiv);
    }
  }

  // 깔린 카드 그리기
  playedCardsDiv.innerHTML = '';
  for (const pc of gameData.playedCards) {
    const cardDiv = document.createElement('div');
    cardDiv.className = 'card played';
    cardDiv.textContent = pc.card;
    playedCardsDiv.appendChild(cardDiv);
  }

  // 레벨 완료 체크 (모든 플레이어가 카드 다 내면)
  const allCardsEmpty = players.every(p => !gameData.playerCards[p.id] || gameData.playerCards[p.id].length === 0);
  nextLevelBtn.disabled = !allCardsEmpty;
}
