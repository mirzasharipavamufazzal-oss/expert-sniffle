(() => {
  const tg = window.Telegram ? window.Telegram.WebApp : null;
  if (tg) {
    tg.ready();
    tg.expand();
    tg.setHeaderColor && tg.setHeaderColor('#F4F6EF');
    tg.setBackgroundColor && tg.setBackgroundColor('#F4F6EF');
  }

  const LEVELS = [
    { code: 'A1', name: 'Beginner', sub: 'Simple everyday phrases' },
    { code: 'A2', name: 'Elementary', sub: 'Basic routine exchanges' },
    { code: 'B1', name: 'Intermediate', sub: 'Familiar matters & opinions' },
    { code: 'B2', name: 'Upper-Intermediate', sub: 'Fluent, spontaneous ideas' },
    { code: 'C1', name: 'Advanced', sub: 'Complex, nuanced language' }
  ];

  const state = {
    userId: null,
    coins: 0,
    progress: {},
    quiz: [],
    level: null,
    qIndex: 0,
    correctCount: 0,
    coinsThisRound: 0
  };

  // Fallback userId for testing outside Telegram (e.g. opening index.html directly)
  function getFallbackUserId() {
    let id = localStorage.getItem('le_dev_user_id');
    if (!id) {
      id = 'dev_' + Math.random().toString(36).slice(2, 10);
      localStorage.setItem('le_dev_user_id', id);
    }
    return id;
  }

  function apiHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (tg && tg.initData) headers['X-Telegram-Init-Data'] = tg.initData;
    return headers;
  }

  async function api(path, opts = {}) {
    const useFallback = !tg || !tg.initData;
    const body = opts.body ? JSON.parse(opts.body) : {};
    if (useFallback) body.userId = getFallbackUserId();
    const res = await fetch(path, {
      method: opts.method || 'GET',
      headers: apiHeaders(),
      body: opts.method && opts.method !== 'GET' ? JSON.stringify(body) : undefined
    });
    if (!res.ok) throw new Error('Request failed: ' + res.status);
    return res.json();
  }

  const screens = {
    home: document.getElementById('screen-home'),
    quiz: document.getElementById('screen-quiz'),
    complete: document.getElementById('screen-complete')
  };

  function showScreen(name) {
    Object.values(screens).forEach(s => s.classList.add('hidden'));
    screens[name].classList.remove('hidden');
  }

  function updateCoinDisplays() {
    document.getElementById('coin-count').textContent = state.coins;
    document.getElementById('coin-count-quiz').textContent = state.coins;
  }

  function bumpCoinPill() {
    ['coin-pill', 'coin-pill-quiz'].forEach(id => {
      const el = document.getElementById(id);
      el.classList.add('bump');
      setTimeout(() => el.classList.remove('bump'), 250);
    });
  }

  function renderPath() {
    const container = document.getElementById('level-path');
    container.innerHTML = '';
    LEVELS.forEach(lvl => {
      const prog = state.progress[lvl.code];
      const total = prog ? undefined : undefined; // total known only after fetching quiz; use answered length heuristic
      const isDone = prog && prog.answered && prog.answered.length >= 10;
      const isCurrent = !isDone && state.progress && Object.keys(state.progress).includes(lvl.code) && prog && prog.answered.length > 0;

      const btn = document.createElement('button');
      btn.className = 'level-node' + (isDone ? ' done' : isCurrent ? ' current' : '');
      btn.innerHTML = `
        <span class="stone">${lvl.code}</span>
        <span class="meta">
          <span class="name">${lvl.name}</span>
          <span class="sub">${lvl.sub}${prog ? ` — ${prog.correct}/10 correct` : ''}</span>
        </span>
      `;
      btn.addEventListener('click', () => selectLevel(lvl.code));
      container.appendChild(btn);
    });
  }

  async function loadMe() {
    try {
      const data = await api('/api/me');
      state.userId = data.userId;
      state.coins = data.coins;
      state.progress = data.progress || {};
    } catch (e) {
      console.error('Failed to load user', e);
    }
    updateCoinDisplays();
    renderPath();
  }

  async function selectLevel(level) {
    tg && tg.HapticFeedback && tg.HapticFeedback.impactOccurred('light');
    const data = await api('/api/select-level', { method: 'POST', body: JSON.stringify({ level }) });
    state.level = level;
    state.quiz = data.quiz;
    state.qIndex = 0;
    state.correctCount = 0;
    state.coinsThisRound = 0;
    document.getElementById('quiz-level-tag').textContent = level;
    renderProgressDots();
    showScreen('quiz');
    renderQuestion();
  }

  function renderProgressDots() {
    const el = document.getElementById('progress-dots');
    el.innerHTML = '';
    state.quiz.forEach((_, i) => {
      const dot = document.createElement('span');
      dot.className = 'dot' + (i === state.qIndex ? ' active' : i < state.qIndex ? ' answered' : '');
      el.appendChild(dot);
    });
  }

  function renderQuestion() {
    const q = state.quiz[state.qIndex];
    document.getElementById('question-index').textContent = `Question ${state.qIndex + 1} of ${state.quiz.length}`;
    document.getElementById('question-text').textContent = q.q;
    document.getElementById('feedback').textContent = '';
    document.getElementById('feedback').className = 'feedback';

    const list = document.getElementById('options-list');
    list.innerHTML = '';
    q.options.forEach((opt, idx) => {
      const btn = document.createElement('button');
      btn.className = 'option-btn';
      btn.textContent = opt;
      btn.addEventListener('click', () => onAnswer(q.id, idx, btn));
      list.appendChild(btn);
    });
    renderProgressDots();
  }

  async function onAnswer(questionId, selectedIndex, btnEl) {
    const optionButtons = Array.from(document.querySelectorAll('#options-list .option-btn'));
    optionButtons.forEach(b => b.disabled = true);

    let data;
    try {
      data = await api('/api/answer', {
        method: 'POST',
        body: JSON.stringify({ level: state.level, questionId, selectedIndex })
      });
    } catch (e) {
      console.error(e);
      return;
    }

    const feedback = document.getElementById('feedback');
    optionButtons[data.correctIndex].classList.add('correct');

    if (data.correct) {
      state.correctCount++;
      if (data.coinsAwarded > 0) {
        state.coins = data.totalCoins;
        state.coinsThisRound += data.coinsAwarded;
        updateCoinDisplays();
        bumpCoinPill();
        tg && tg.HapticFeedback && tg.HapticFeedback.notificationOccurred('success');
      }
      feedback.textContent = data.alreadyAnswered
        ? 'Correct! (already earned coins for this one)'
        : `Correct! +${data.coinsAwarded} coins`;
      feedback.classList.add('correct-text');
    } else {
      btnEl.classList.add('incorrect');
      feedback.textContent = 'Not quite — see the highlighted answer.';
      feedback.classList.add('incorrect-text');
      tg && tg.HapticFeedback && tg.HapticFeedback.notificationOccurred('error');
    }

    setTimeout(() => {
      if (state.qIndex < state.quiz.length - 1) {
        state.qIndex++;
        renderQuestion();
      } else {
        showComplete();
      }
    }, 1100);
  }

  function showComplete() {
    document.getElementById('complete-badge').textContent = state.level;
    document.getElementById('complete-stats').textContent =
      `You got ${state.correctCount} of ${state.quiz.length} correct.`;
    document.getElementById('complete-coins').textContent = `+${state.coinsThisRound} coins earned`;
    showScreen('complete');
    loadMe();
  }

  document.getElementById('quiz-back').addEventListener('click', () => {
    showScreen('home');
    loadMe();
  });
  document.getElementById('btn-back-home').addEventListener('click', () => {
    showScreen('home');
    loadMe();
  });
  document.getElementById('btn-retry').addEventListener('click', () => selectLevel(state.level));

  loadMe();
})();
