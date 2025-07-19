const socket = io();

const loginDiv = document.getElementById('login');
const gameDiv = document.getElementById('game');
const nameInput = document.getElementById('nameInput');
const joinBtn = document.getElementById('joinBtn');
const startBtn = document.getElementById('startBtn');
const handContainer = document.getElementById('handContainer');
const playedCards = document.getElementById('playedCards');
const shurikenReveal = document.getElementById('shurikenReveal');
const nextLevelBtn = document.getElementById('nextLevelBtn');
const useShurikenBtn = document.getElementById('useShurikenBtn');
const voteYes = document.getElementById('voteYes');
const voteNo = document.getElementById('voteNo');
const shurikenVote = document.getElementById('shurikenVote');
const statusText = document.getElementById('status');
const resultMessage = document.getElementById('resultMessage');
const emojiBtns = document.querySelectorAll('.emoji');

let myHand = [];

joinBtn.onclick = () => {
  const name = nameInput.value.trim();
  if (!name) return;
  socket.emit('join', name);
  loginDiv.style.display = 'none';
  gameDiv.style.display = 'block';
};

startBtn.onclick = () => socket.emit('start');
nextLevelBtn.onclick = () => {
  nextLevelBtn.style.display = 'none';
  playedCards.innerHTML = '';
  shurikenReveal.innerHTML = '';
  socket.emit('next-level');
};

useShurikenBtn.onclick = () => socket.emit('use-shuriken');

voteYes.onclick = () => {
  shurikenVote.style.display = 'none';
  socket.emit('shuriken-vote', true);
};
voteNo.onclick = () => {
  shurikenVote.style.display = 'none';
  socket.emit('shuriken-vote', false);
};

emojiBtns.forEach(btn => {
  btn.onclick = () => socket.emit('emoji', btn.textContent);
});

function renderHand() {
  handContainer.innerHTML = '';
  myHand.sort((a, b) => a - b);
  myHand.forEach(card => {
    const div = document.createElement('div');
    div.className = 'card';
    div.textContent = card;
    div.onclick = () => {
      socket.emit('play', card);
      myHand = myHand.filter(c => c !== card);
      renderHand();
    };
    handContainer.appendChild(div);
  });
}

function renderPlayedCards() {
  const cards = Array.from(playedCards.children)
    .map(div => parseInt(div.textContent))
    .sort((a, b) => a - b);
  playedCards.innerHTML = '';
  cards.forEach(card => {
    const div = document.createElement('div');
    div.className = 'card';
    div.textContent = card;
    playedCards.appendChild(div);
  });
}

socket.on('hand', (hand) => {
  myHand = hand;
  renderHand();
});

socket.on('update-resources', ({ lives, shuriken, level }) => {
  document.getElementById('lives').textContent = lives;
  document.getElementById('shuriken').textContent = shuriken;
  document.getElementById('level').textContent = level;
});

socket.on('playerList', (players) => {
  const div = document.getElementById('players');
  div.innerHTML = '👥 참가자: ' + players.map(p => p.name).join(', ');
});

socket.on('played', ({ card, by }) => {
  const div = document.createElement('div');
  div.className = 'card';
  div.textContent = card;
  playedCards.appendChild(div);
  renderPlayedCards();
});

socket.on('life-lost', () => {
  statusText.textContent = '💔 목숨이 하나 줄었습니다!';
});

socket.on('next-level-ready', () => {
  nextLevelBtn.style.display = 'inline-block';
});

socket.on('game-over', (msg) => {
  resultMessage.textContent = msg;
  nextLevelBtn.style.display = 'inline-block';
});

socket.on('shuriken-vote-request', () => {
  shurikenVote.style.display = 'inline-block';
});

socket.on('shuriken-used', (cards) => {
  cards.forEach(card => {
    const div = document.createElement('div');
    div.className = 'card';
    div.textContent = card;
    playedCards.appendChild(div);
  });
  renderPlayedCards();
});

socket.on('status', msg => {
  statusText.textContent = msg;
});

socket.on('emoji', ({ from, emoji }) => {
  const e = document.createElement('div');
  e.textContent = `${from}: ${emoji}`;
  statusText.textContent = e.textContent;
  setTimeout(() => {
    if (statusText.textContent === e.textContent) statusText.textContent = '';
  }, 2000);
});
