const socket = io();

const loginDiv = document.getElementById('login');
const gameDiv = document.getElementById('game');
const nameInput = document.getElementById('nameInput');
const joinBtn = document.getElementById('joinBtn');
const startBtn = document.getElementById('startBtn');
const nextLevelBtn = document.getElementById('nextLevelBtn');
const useShurikenBtn = document.getElementById('useShurikenBtn');
const voteYesBtn = document.getElementById('voteYes');
const voteNoBtn = document.getElementById('voteNo');
const shurikenVoteDiv = document.getElementById('shurikenVote');
const playersDiv = document.getElementById('players');
const livesSpan = document.getElementById('lives');
const shurikenSpan = document.getElementById('shuriken');
const levelSpan = document.getElementById('level');
const playedCardsDiv = document.getElementById('playedCards');
const handContainerDiv = document.getElementById('handContainer');
const shurikenRevealDiv = document.getElementById('shurikenReveal');
const statusP = document.getElementById('status');
const resultMessageH1 = document.getElementById('resultMessage');
const emojiBtns = document.querySelectorAll('#emojiBtns .emoji');

let playerName = null;
let gameStarted = false;

joinBtn.onclick = () => {
  const name = nameInput.value.trim();
  if (!name) return alert('닉네임을 입력해주세요.');
  playerName = name;
  socket.emit('joinGame', name);
};

startBtn.onclick = () => {
  socket.emit('startGame');
};

nextLevelBtn.onclick = () => {
  socket.emit('requestNextLevel');
  nextLevelBtn.style.display = 'none';
};

useShurikenBtn.onclick = () => {
  socket.emit('requestShurikenUse');
};

voteYesBtn.onclick = () => {
  socket.emit('shurikenVote', true);
};

voteNoBtn.onclick = () => {
  socket.emit('shurikenVote', false);
};

emojiBtns.forEach(btn => {
  btn.onclick = () => {
    socket.emit('emoji', btn.textContent);
  };
});

socket.on('joined', (players) => {
  loginDiv.style.display = 'none';
  gameDiv.style.display = 'block';
  updatePlayers(players);
  setStatus('게임에 입장했습니다. 준비되면 게임 시작 버튼을 눌러주세요.');
});

socket.on('playerListUpdate', updatePlayers);

socket.on('gameStarted', (gameData) => {
  gameStarted = true;
  updateGameData(gameData);
  setStatus('게임 시작!');
  resultMessageH1.textContent = '';
  nextLevelBtn.style.display = 'none';
  shurikenVoteDiv.style.display = 'none';
});

socket.on('updateGame', (gameData) => {
  updateGameData(gameData);
  setStatus('');
  resultMessageH1.textContent = '';
});

socket.on('showShurikenVote', () => {
  shurikenVoteDiv.style.display = 'block';
  setStatus('수리검 사용 여부를 투표해주세요!');
});

socket.on('hideShurikenVote', () => {
  shurikenVoteDiv.style.display = 'none';
  setStatus('');
});

socket.on('shurikenReveal', (cards) => {
  renderShurikenReveal(cards);
  setStatus('수리검 공개 카드입니다.');
});

socket.on('levelCleared', () => {
  nextLevelBtn.style.display = 'inline-block';
  setStatus('레벨 클리어! 다음 레벨로 넘어가세요.');
});

socket.on('gameOver', (won) => {
  if (won) {
    resultMessageH1.textContent = '🎉 신이 되셨습니다! 축하합니다! 🎉';
  } else {
    resultMessageH1.textContent = '😞 신이 되지 못했습니다... 다시 도전하세요.';
  }
  nextLevelBtn.style.display = 'none';
  shurikenVoteDiv.style.display = 'none';
  setStatus('');
});

socket.on('emoji', (data) => {
  setStatus(`${data.player} 님이 ${data.emoji} 감정을 표현했습니다.`);
});

function updatePlayers(players) {
  playersDiv.textContent = '참가자: ' + players.map(p => p.name).join(', ');
}

function updateGameData(data) {
  livesSpan.textContent = data.lives;
  shurikenSpan.textContent = data.shuriken;
  levelSpan.textContent = data.level;

  renderCards(playedCardsDiv, data.playedCards);
  renderCards(handContainerDiv, data.playerHands[playerName] || []);
  renderCards(shurikenRevealDiv, []); // 초기화
}

function renderCards(container, cards) {
  container.innerHTML = '';
  cards.sort((a,b) => a-b).forEach(cardNum => {
    const card = document.createElement('div');
    card.className = 'card';
    card.textContent = cardNum;
    container.appendChild(card);
  });
}

function renderShurikenReveal(cards) {
  shurikenRevealDiv.innerHTML = '';
  cards.sort((a,b) => a-b).forEach(cardNum => {
    const card = document.createElement('div');
    card.className = 'card';
    card.textContent = cardNum;
    shurikenRevealDiv.appendChild(card);
  });
}

function setStatus(text) {
  statusP.textContent = text;
}
