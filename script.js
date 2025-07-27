const socket = io();

let hand = [];
let played = [];
let playerName = null;
let isDark = false;

function joinGame() {
  const input = document.getElementById('username');
  if (!input.value.trim()) {
    alert('이름을 입력해주세요!');
    return;
  }
  playerName = input.value.trim();
  socket.emit('join', playerName);
  input.disabled = true;
  input.nextElementSibling.disabled = true;
  document.getElementById('startBtn').disabled = false;
  document.getElementById('shurikenBtn').disabled = false;
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
  document.getElementById('status').innerText = '다음 레벨로 이동 중...';
}

function confirmReset() {
  if (confirm('정말로 게임을 초기화하시겠습니까? 모든 레벨과 카드가 초기화됩니다.')) {
    socket.emit('force-reset');
  }
}

function toggleTheme() {
  isDark = !isDark;
  if (isDark) {
    document.documentElement.style.setProperty('--bg-color', '#121212');
    document.documentElement.style.setProperty('--text-color', '#ffffff');
    document.documentElement.style.setProperty('--card-bg', '#333');
    document.documentElement.style.setProperty('--card-hover', '#444');
    document.documentElement.style.setProperty('--border-color', '#aaa');
  } else {
    document.documentElement.style.setProperty('--bg-color', '#ffffff');
    document.documentElement.style.setProperty('--text-color', '#000000');
    document.documentElement.style.setProperty('--card-bg', '#eee');
    document.documentElement.style.setProperty('--card-hover', '#ddd');
    document.documentElement.style.setProperty('--border-color', '#333');
  }
}

function renderCards() {
  const container = document.getElementById('cards');
  container.innerHTML = '';

  hand.forEach(cardObj => {
    const div = document.createElement('div');
    div.className = 'card';
    div.innerText = cardObj.value;

    if (cardObj.used) {
      div.style.backgroundColor = 'gray';
      div.style.opacity = '0.6';
      div.onclick = null;
    } else {
      div.onclick = () => {
        socket.emit('play', cardObj.value);
        div.style.backgroundColor = 'gray';
        div.onclick = null;
      };
    }

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

socket.on('hand', (cards) => {
  // 숫자 배열을 객체 배열로 변환, used는 false로 초기화
  hand = cards.map(c => ({ value: c, used: false }));
  played = [];
  renderCards();
  document.getElementById('playedCards').innerHTML = '';
});

socket.on('played', (data) => {
  played.push(data.card);
  renderPlayedCards();
  document.getElementById('status').innerText = `${data.by}님이 ${data.card} 카드를 냈습니다.`;
});

socket.on('playerList', (players) => {
  document.getElementById('playerList').innerHTML = '<b>플레이어:</b> ' + players.map(p => p.name).join(', ');
});

socket.on('player-card-counts', (counts) => {
  document.getElementById('playerCardsCount').innerText =
    counts.map(c => `${c.name}: ${c.count}장`).join(' | ');
});

socket.on('update-resources', ({ lives, shuriken, level }) => {
  document.getElementById('resources').innerText = `❤️ 생명: ${lives}  |  🥷 수리검: ${shuriken}  |  🎯 레벨: ${level}`;
});

// ✅ 이 부분이 수정된 핵심!
socket.on('shuriken-used', (revealedCards) => {
  // 가진 카드에서 제거
  hand = hand.filter(c => !revealedCards.includes(c.value));

  // 깔린 카드에 추가
  played = [...played, ...revealedCards];
  played.sort((a, b) => a - b);

  renderCards();
  renderPlayedCards();
  document.getElementById('status').innerText = `🥷 수리검이 사용되어 ${revealedCards.join(', ')} 카드가 공개되었습니다.`;
});

socket.on('life-lost', () => {
  alert('틀린 순서! 💔 생명이 1개 줄었습니다.');
});

socket.on('game-over', (msg) => {
  alert(msg);
  document.getElementById('status').innerText = msg;
  document.getElementById('nextLevelBtn').style.display = 'inline-block';
});

socket.on('game-won', () => {
  document.getElementById('status').innerText = '🎉 신이 되었습니다! 게임 클리어!!';
  document.getElementById('nextLevelBtn').style.display = 'inline-block';
});

socket.on('shuriken-requested', (votes) => {
  document.getElementById('status').innerText = `🥷 수리검 요청 중... (${votes.length}명 동의)`;
});

socket.on('next-level-status', ({ count, total }) => {
  document.getElementById('status').innerText = `🎯 다음 레벨 투표 중... (${count}/${total})`;
});

socket.on('status', (msg) => {
  document.getElementById('status').innerText = msg;
});
