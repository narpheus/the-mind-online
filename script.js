socket.on('played', (data) => {
  played.push(data.card);

  // 오름차순 정렬
  played.sort((a, b) => a - b);

  // 깔린 카드들 다시 렌더링
  const playedContainer = document.getElementById('playedCards');
  playedContainer.innerHTML = '';  // 기존 카드들 지우기

  played.forEach(card => {
    const cardDiv = document.createElement('div');
    cardDiv.className = 'card';
    cardDiv.innerText = card;
    playedContainer.appendChild(cardDiv);
  });

  document.getElementById('status').innerText = `${data.by}님이 ${data.card} 카드를 냈습니다.`;
});
