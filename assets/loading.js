(() => {
  const state = {active:0, value:0, timer:null};

  function ensure() {
    let root = document.querySelector('#solo-loading');
    if (root) return root;
    root = document.createElement('div');
    root.id = 'solo-loading';
    root.className = 'solo-loading';
    root.setAttribute('role', 'status');
    root.setAttribute('aria-live', 'polite');
    root.hidden = true;
    root.innerHTML = `
      <div class="solo-loading-card">
        <p class="solo-loading-kicker">SOLO</p>
        <h2>Carregando página</h2>
        <div class="solo-loading-percent">0%</div>
        <div class="solo-loading-track"><span></span></div>
        <p class="solo-loading-wait">Aguarde...</p>
      </div>`;
    document.body.append(root);
    return root;
  }

  function paint(value, title) {
    state.value = Math.max(state.value, Math.min(100, Math.round(value)));
    const root = ensure();
    root.querySelector('h2').textContent = title || 'Carregando página';
    root.querySelector('.solo-loading-percent').textContent = `${state.value}%`;
    root.querySelector('.solo-loading-track span').style.width = `${state.value}%`;
  }

  function start(title = 'Carregando página') {
    const root = ensure();
    state.active += 1;
    if (state.active === 1) {
      state.value = 0;
      root.hidden = false;
      paint(8, title);
      state.timer = setInterval(() => {
        if (state.value < 94) paint(state.value + Math.max(1, Math.round((94 - state.value) * .08)), title);
      }, 160);
    } else {
      paint(state.value, title);
    }
    let done = false;
    return async (success = true) => {
      if (done) return;
      done = true;
      if (success) {
        paint(100, title);
      }
      state.active = Math.max(0, state.active - 1);
      if (!state.active) {
        clearInterval(state.timer);
        state.timer = null;
        root.hidden = true;
        state.value = 0;
      }
    };
  }

  window.SoloLoading = {start};
})();
