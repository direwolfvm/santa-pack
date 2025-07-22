function initSnow() {
  const container = document.createElement('div');
  container.id = 'snow-container';
  document.body.appendChild(container);

  const flakes = 50;
  for (let i = 0; i < flakes; i++) {
    const flake = document.createElement('div');
    flake.className = 'snowflake';
    flake.textContent = '❄';
    flake.style.left = Math.random() * 100 + 'vw';
    flake.style.animationDuration = 5 + Math.random() * 5 + 's';
    flake.style.fontSize = 10 + Math.random() * 20 + 'px';
    flake.style.animationDelay = -Math.random() * 10 + 's';
    container.appendChild(flake);
  }
}

document.addEventListener('DOMContentLoaded', initSnow);
