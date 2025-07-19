// script.js
const socket = io();

let hand = [];
let played = [];
let playerName = null;
let shurikenVotes = new Set();
let allPlayers = [];

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
  input.nextElementSibling.disabled = true;
}

function startGame() {
  socket.emit('start');
  document.getElementById('status').innerText = '게임을 시작했습니다!';
  document.getElementById('nextLevelBtn').style.display = 'none';
}

function requestShuriken() {
  socket.emit('request-shuriken');
}

function nextLevel() {
  socket.emit('next-level');
  document.getElementById('nextLevelBtn').style.display = 'none';
  document.getElementById('status').innerText = '다음 레벨로 이동합니다...';
}

socket.on('playerList', (players) => {
  allPlayers = players;
  const container = document.getElementById('playerList');
  container.innerHTML = '<b>플레이어들:</b> ' + players.map(p => p.name).join(', ');
});

socket.on('hand', (cards) => {
  hand = cards;
  played = [];
  renderCards();
  document.getElementById('playedCards').innerHTML = '';
});

function renderCards() {
  const container = document.getElementById('cards');
  container.innerHTML = '';
  hand.sort((a, b) => a - b);
  hand.forEach((card) => {
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

function renderPlayedCards() {
  const playedContainer = document.getElementById('playedCards');
  playedContainer.innerHTML = '';
  played.sort((a, b) => a - b);
  played.forEach(card => {
    const cardDiv = document.createElement('div');
    cardDiv.className = 'card';
    cardDiv.innerText = card;
    playedContainer.appendChild(cardDiv);
  });
}

socket.on('played', (data) => {
  played.push(data.card);
  renderPlayedCards();
  document.getElementById('status').innerText = `${data.by}님이 ${data.card} 카드를 냈습니다.`;
});

socket.on('update-resources', ({ lives, shuriken, level }) => {
  document.getElementById('resources').innerText = `❤️ 생명: ${lives}  |  🥷 수리검: ${shuriken}  |  🎯 레벨: ${level}`;
});

socket.on('shuriken-used', (minCards) => {
  minCards.forEach(card => {
    played.push(card);
  });
  renderPlayedCards();
  hand = hand.filter(c => !minCards.includes(c));
  renderCards();
  document.getElementById('status').innerText = '🥷 수리검이 사용되어 가장 작은 카드들이 공개되었습니다!';
});

socket.on('life-lost', () => {
  alert('틀린 순서! 💔 생명이 1개 줄었습니다.');
});

socket.on('game-over', (msg) => {
  alert(msg);
  document.getElementById('status').innerText = msg;
  document.getElementById('nextLevelBtn').style.display = 'inline-block';
});

socket.on('shuriken-requested', (voters) => {
  document.getElementById('status').innerText = `🥷 수리검 요청 중... (${voters.length}/${allPlayers.length} 동의)`;
});

socket.on('game-won', () => {
  alert('🎉 모든 레벨을 통과했습니다! 당신은 신이 되었습니다!');
  document.getElementById('status').innerText = '🎉 모든 레벨을 통과했습니다! 당신은 신이 되었습니다!';
  document.getElementById('nextLevelBtn').style.display = 'inline-block';
});
