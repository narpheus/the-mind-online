const socket = io();

let hand = [];
let played = [];

function startGame() {
  socket.emit('start');
  document.getElementById('status').innerText = '게임을 시작했습니다!';
}

function useShuriken() {
  socket.emit('use-shuriken');
}

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
  document.getElementById('status').innerText = `${data.by}가 ${data.card}을(를) 냈습니다.`;
});

socket.on('update-resources', ({ lives, shuriken }) => {
  document.getElementById('resources').innerText = `❤️ 생명: ${lives}  |  🥷 수리검: ${shuriken}`;
});

socket.on('shuriken-used', (minCard) => {
  alert(`🥷 수리검 사용됨! 가장 작은 카드 ${minCard}가 공개됩니다.`);
});

socket.on('life-lost', () => {
  alert('틀린 순서! 💔 생명이 1개 줄었습니다.');
});
