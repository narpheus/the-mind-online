const socket = io();

const loginDiv = document.getElementById('loginDiv');
const gameDiv = document.getElementById('gameDiv');
const joinBtn = document.getElementById('joinBtn');
const nameInput = document.getElementById('nameInput');
const playersList = document.getElementById('playersList');
const statusDiv = document.getElementById('status');
const startBtn = document.getElementById('startBtn');
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
  renderCards();
  shurikenVoteDiv.style.display = 'none';
  hasVotedShuriken = false;
  startBtn.disabled = true;
  shurikenBtn.disabled = false;
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
  startBtn.disabled = false;
  shurikenBtn.disabled = true;
});

socket.on('shurikenVoteStart', () => {
  shurikenVoteDiv.style.display = 'block';
  hasVotedShuriken = false;
});

socket.on('shurikenVotesUpdate', (votes) => {
  // 투표 현황 표시 가능 (필요시)
});

socket.on('shurikenUsed', ({shuriken, revealedCards}) => {
  if (!gameData) return;
  gameData.shuriken = shuriken;
  // 공개된 카드 플레이어 카드에서 제거
  for (const c of revealedCards) {
    if (gameData.playerCards[c.playerId]) {
      gameData.playerCards[c.playerId] = gameData.playerCards[c.playerId].filter(x => x !== c.card);
    }
  }
  gameData.playedCards.push(...revealedCards);
  renderCards();
  shurikenVoteDiv.style.display = 'none';
  hasVotedShuriken = false;
});

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

shurikenBtn.onclick = () => {
  socket.emit('useShuriken');
};

emotionsDiv.querySelectorAll('button').forEach(btn => {
  btn.onclick = () => {
    socket.emit('sendEmotion', btn.dataset.emotion);
  };
});

socket.on('playerEmotion', ({playerId: pId, emotion}) => {
  const playersArray = playersList.textContent.replace('참가자: ', '').split(', ');
  const idx = playersArray.findIndex(name => name === (pId || ''));
  const playerName = idx >= 0 ? playersArray[idx] : '누군가';
  statusDiv.textContent = `${playerName}님이 '${emotion === 'wow' ? '대박' : '아쉽다'}'를 보냈습니다.`;
  setTimeout(() => { statusDiv.textContent = ''; }, 3000);
});

function renderCards() {
  if (!gameData) return;

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

  playedCardsDiv.innerHTML = '';
  for (const pc of gameData.playedCards) {
    const cardDiv = document.createElement('div');
    cardDiv.className = 'card';
    cardDiv.textContent = pc.card;
    playedCardsDiv.appendChild(cardDiv);
  }
}
