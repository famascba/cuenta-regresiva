let pollInterval = null;

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function getTimerClass(remaining) {
  if (remaining <= 0) return 'finished';
  if (remaining <= 60) return 'danger';
  if (remaining <= 300) return 'warning';
  return 'normal';
}

function computeState(raw) {
  const s = { ...raw, remainingSeconds: raw.remainingSeconds };
  if (s.isRunning && s.startedAt) {
    const elapsed = (Date.now() - new Date(s.startedAt).getTime()) / 1000;
    s.remainingSeconds = Math.max(0, s.totalSeconds - Math.floor(elapsed));
    s.progress = s.totalSeconds > 0 ? (s.totalSeconds - s.remainingSeconds) / s.totalSeconds : 0;
    if (s.remainingSeconds <= 0) {
      s.isRunning = false;
      s.isFinished = true;
    }
  }
  return s;
}

function updateDisplay(state) {
  const eventName = document.getElementById('cdEventName');
  const timer = document.getElementById('cdTimer');
  const progress = document.getElementById('cdProgress');
  const notStarted = document.getElementById('cdNotStarted');
  const timeUp = document.getElementById('cdTimeUp');
  const timerContainer = document.getElementById('cdTimerContainer');

  eventName.textContent = state.eventName || 'Conferencia';

  if (state.isFinished && state.totalSeconds > 0) {
    notStarted.style.display = 'none';
    timerContainer.style.display = 'none';
    timeUp.classList.add('active');
    return;
  }

  if (state.totalSeconds <= 0) {
    notStarted.style.display = 'flex';
    timerContainer.style.display = 'none';
    timeUp.classList.remove('active');
    return;
  }

  if (!state.isRunning && !state.isPaused && state.remainingSeconds === state.totalSeconds) {
    notStarted.style.display = 'none';
    timerContainer.style.display = 'block';
    timeUp.classList.remove('active');
    timer.textContent = formatTime(state.remainingSeconds);
    timer.className = `cd-timer ${getTimerClass(state.remainingSeconds)}`;
    const pct = state.totalSeconds > 0
      ? ((state.totalSeconds - state.remainingSeconds) / state.totalSeconds) * 100
      : 0;
    progress.style.width = `${Math.min(100, pct)}%`;
    progress.className = `cd-progress-fill ${getTimerClass(state.remainingSeconds)}`;
    return;
  }

  if (state.isPaused) {
    notStarted.style.display = 'none';
    timerContainer.style.display = 'block';
    timeUp.classList.remove('active');
    timer.textContent = formatTime(state.remainingSeconds);
    timer.className = `cd-timer ${getTimerClass(state.remainingSeconds)}`;
    const pct = state.totalSeconds > 0
      ? ((state.totalSeconds - state.remainingSeconds) / state.totalSeconds) * 100
      : 0;
    progress.style.width = `${Math.min(100, pct)}%`;
    progress.className = `cd-progress-fill ${getTimerClass(state.remainingSeconds)}`;
    return;
  }

  notStarted.style.display = 'none';
  timerContainer.style.display = 'block';
  timeUp.classList.remove('active');

  timer.textContent = formatTime(state.remainingSeconds);
  timer.className = `cd-timer ${getTimerClass(state.remainingSeconds)}`;

  const pct = state.totalSeconds > 0
    ? ((state.totalSeconds - state.remainingSeconds) / state.totalSeconds) * 100
    : 0;
  progress.style.width = `${Math.min(100, pct)}%`;
  progress.className = `cd-progress-fill ${getTimerClass(state.remainingSeconds)}`;
}

async function pollState() {
  try {
    const res = await fetch('/api/state');
    if (!res.ok) return;
    const raw = await res.json();
    const state = computeState(raw);
    updateDisplay(state);
  } catch {
    document.getElementById('cdTimerContainer').style.display = 'block';
    document.getElementById('cdTimer').textContent = '--:--';
    document.getElementById('cdTimer').className = 'cd-timer normal';
    document.getElementById('cdNotStarted').style.display = 'none';
  }
}

async function loadInitialState() {
  try {
    const res = await fetch('/api/state');
    const raw = await res.json();
    const state = computeState(raw);
    updateDisplay(state);
  } catch {
    setTimeout(loadInitialState, 1000);
  }
}

loadInitialState();
pollInterval = setInterval(pollState, 1000);
