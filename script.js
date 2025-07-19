const socket = io();

let hand = [];
let played = [];
let playerName = null;

function joinGame() {
  const input = document.getElementById('username');
  if (!input.value.trim()) {
    alert('이름을 입력해주세요!');
    return;
  }
  playerName = input.value.trim();
  socket.emit('join', playerName);

  document.getElementById('startBtn').disabled = false;
  document.getElementById('shurikenBtn').disabled = false;
  input.disabled = true;
  input.nextElementSibling.disabled = true; // 참가 버튼 비활성화
}

function startGame() {
  socket.emit('start');
  document.getElementById('status').innerText = '게임을 시작했습니다!';
}

function useShuriken() {
  socket.emit('use-shuriken');
}

socket.on('playerList', (players) => {
  const container = document.getElementById('playerList');
  container.innerHTML = '<b>플레이어들:</b> ' + players.map(p => p.name).join(', ');
});

socket.on('hand', (cards) => {
  hand = cards;
  renderCards();
});

function renderCards() {
  const container = document.getElementById('cards');
  container.innerHTML = '';
  hand.forEach((card, index) => {
    const div = document.createElement('div');
    div.className = 'card';
    div.innerText = card;
    div.onclick = () => {
      socket.emit('play', card);
      div.style.backgroundColor = 'gray';
      div.onclick = null;
    };
    container.appendChild(div);
  });
}

socket.on('played', (data) => {
  played.push(data.card);
  document.getElementById('status').innerText = `${data.by}님이 ${data.card} 카드를 냈습니다.`;

  // 깔린 카드 표시
  const playedContainer = document.getElementById('playedCards');
  const cardDiv = document.createElement('div');
  cardDiv.className = 'card';
  cardDiv.innerText = data.card;
  playedContainer.appendChild(cardDiv);
});

socket.on('update-resources', ({ lives, shuriken, level }) => {
  document.getElementById('resources').innerText = `❤️ 생명: ${lives}  |  🥷 수리검: ${shuriken}  |  🎯 레벨: ${level}`;
});

socket.on('shuriken-used', (minCard) => {
  alert(`🥷 수리검 사용됨! 가장 작은 카드 ${minCard}가 공개됩니다.`);
});

socket.on('life-lost', () => {
  alert('틀린 순서! 💔 생명이 1개 줄었습니다.');
});
