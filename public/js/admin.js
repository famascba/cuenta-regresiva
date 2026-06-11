let pollInterval = null;

function getToken() {
  return localStorage.getItem('token');
}

function clearToken() {
  localStorage.removeItem('token');
}

async function apiFetch(url, options = {}) {
  const token = getToken();
  const headers = { ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (options.body && typeof options.body === 'string' && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  try {
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
      clearToken();
      window.location.href = '/login.html';
      return null;
    }
    return res;
  } catch {
    return null;
  }
}

function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.style.display = 'block';
  setTimeout(() => { toast.style.display = 'none'; }, 3000);
}

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function getTimerClass(remaining, total) {
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

function updatePreview(state) {
  const previewTimer = document.getElementById('previewTimer');
  const previewEventName = document.getElementById('previewEventName');
  const previewProgress = document.getElementById('previewProgress');
  const statusText = document.getElementById('previewStatusText');
  const statusDot = document.getElementById('previewStatusDot');
  const indicator = document.querySelector('.admin-timer-preview .status-indicator');

  previewEventName.textContent = state.eventName || 'Conferencia';
  previewTimer.textContent = formatTime(state.remainingSeconds);
  previewTimer.className = `admin-timer-display ${getTimerClass(state.remainingSeconds, state.totalSeconds)}`;

  const progress = state.totalSeconds > 0
    ? ((state.totalSeconds - state.remainingSeconds) / state.totalSeconds) * 100
    : 0;
  previewProgress.style.width = `${Math.min(100, progress)}%`;

  if (state.isFinished && state.totalSeconds > 0) {
    statusText.textContent = 'Finalizado';
    statusDot.className = 'status-dot dot-finished';
    indicator.className = 'status-indicator status-finished';
  } else if (state.isRunning) {
    statusText.textContent = 'En ejecución';
    statusDot.className = 'status-dot dot-running';
    indicator.className = 'status-indicator status-running';
  } else if (state.isPaused) {
    statusText.textContent = 'Pausado';
    statusDot.className = 'status-dot dot-paused';
    indicator.className = 'status-indicator status-paused';
  } else {
    statusText.textContent = 'Detenido';
    statusDot.className = 'status-dot dot-stopped';
    indicator.className = 'status-indicator status-stopped';
  }
}

function updateMainStatus(state) {
  const statusText = document.getElementById('statusText');
  const statusDot = document.getElementById('statusDot');
  const indicator = document.getElementById('statusIndicator');

  if (state.isFinished && state.totalSeconds > 0) {
    statusText.textContent = 'Finalizado';
    statusDot.className = 'status-dot dot-finished';
    indicator.className = 'status-indicator status-finished';
  } else if (state.isRunning) {
    statusText.textContent = 'En ejecución';
    statusDot.className = 'status-dot dot-running';
    indicator.className = 'status-indicator status-running';
  } else if (state.isPaused) {
    statusText.textContent = 'Pausado';
    statusDot.className = 'status-dot dot-paused';
    indicator.className = 'status-indicator status-paused';
  } else {
    statusText.textContent = 'Detenido';
    statusDot.className = 'status-dot dot-stopped';
    indicator.className = 'status-indicator status-stopped';
  }
}

function updateButtons(state) {
  document.getElementById('startBtn').disabled = state.isRunning || (state.isFinished && state.totalSeconds > 0);
  document.getElementById('pauseBtn').disabled = !state.isRunning;
}

async function loadConfig() {
  const res = await apiFetch('/api/admin/config');
  if (!res) return;
  try {
    const config = await res.json();
    const totalHours = Math.floor(config.totalSeconds / 3600);
    const totalMinutes = Math.floor((config.totalSeconds % 3600) / 60);
    const totalSecs = config.totalSeconds % 60;
    document.getElementById('hours').value = totalHours;
    document.getElementById('minutes').value = totalMinutes;
    document.getElementById('seconds').value = totalSecs;
    document.getElementById('eventName').value = config.eventName || '';
    document.getElementById('remainingOverride').value = config.remainingSeconds;

    const s = computeState(config);
    updatePreview(s);
    updateMainStatus(s);
    updateButtons(s);
  } catch {
    showToast('Error al cargar configuración', 'error');
  }
}

async function pollState() {
  try {
    const res = await fetch('/api/state');
    if (!res.ok) return;
    const raw = await res.json();
    const state = computeState(raw);
    updatePreview(state);
    updateMainStatus(state);
    updateButtons(state);
  } catch {}
}

document.addEventListener('DOMContentLoaded', async () => {
  const token = getToken();
  if (!token) {
    window.location.href = '/login.html';
    return;
  }

  const res = await apiFetch('/api/auth/me');
  if (!res) return;
  const meData = await res.json();
  if (!meData.authenticated) {
    clearToken();
    window.location.href = '/login.html';
    return;
  }
  document.getElementById('userDisplay').textContent = `👤 ${meData.username}`;

  await loadConfig();
  pollInterval = setInterval(pollState, 1000);
  pollState();

  document.getElementById('saveConfigBtn').addEventListener('click', async () => {
    const eventName = document.getElementById('eventName').value;
    const hours = parseInt(document.getElementById('hours').value) || 0;
    const minutes = parseInt(document.getElementById('minutes').value) || 0;
    const seconds = parseInt(document.getElementById('seconds').value) || 0;
    const totalSeconds = hours * 3600 + minutes * 60 + seconds;

    if (totalSeconds <= 0) {
      showToast('La duración debe ser mayor a 0', 'error');
      return;
    }

    const res = await apiFetch('/api/admin/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventName, totalSeconds })
    });
    if (res) showToast('Configuración guardada');
  });

  document.getElementById('startBtn').addEventListener('click', async () => {
    const res = await apiFetch('/api/admin/start', { method: 'POST' });
    if (!res) return;
    const data = await res.json();
    if (data.success) showToast('Temporizador iniciado');
    else showToast(data.error || 'Error al iniciar', 'error');
  });

  document.getElementById('pauseBtn').addEventListener('click', async () => {
    const res = await apiFetch('/api/admin/pause', { method: 'POST' });
    if (!res) return;
    const data = await res.json();
    if (data.success) showToast('Temporizador pausado');
    else showToast(data.error || 'Error al pausar', 'error');
  });

  document.getElementById('resetBtn').addEventListener('click', async () => {
    const res = await apiFetch('/api/admin/reset', { method: 'POST' });
    if (!res) return;
    const data = await res.json();
    if (data.success) showToast('Temporizador reiniciado');
    else showToast(data.error || 'Error al reiniciar', 'error');
  });

  document.getElementById('remainingOverride').addEventListener('change', async (e) => {
    const val = parseInt(e.target.value);
    if (val < 0 || isNaN(val)) return;
    const res = await apiFetch('/api/admin/set-remaining', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ remainingSeconds: val })
    });
    if (!res) return;
    const data = await res.json();
    if (data.success) showToast('Tiempo restante actualizado');
    else showToast(data.error || 'Error al ajustar tiempo', 'error');
  });

  document.getElementById('logoutBtn').addEventListener('click', () => {
    clearToken();
    window.location.href = '/login.html';
  });

  document.getElementById('togglePassword').addEventListener('click', () => {
    document.getElementById('passwordForm').classList.toggle('active');
  });

  document.getElementById('changePasswordBtn').addEventListener('click', async () => {
    const current = document.getElementById('currentPassword').value;
    const newPwd = document.getElementById('newPassword').value;
    if (!current || !newPwd) {
      showToast('Complete ambos campos', 'error');
      return;
    }
    if (newPwd.length < 4) {
      showToast('La nueva contraseña debe tener al menos 4 caracteres', 'error');
      return;
    }
    const res = await apiFetch('/api/admin/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: current, newPassword: newPwd })
    });
    if (!res) return;
    const data = await res.json();
    if (data.success) {
      showToast('Contraseña cambiada exitosamente');
      document.getElementById('currentPassword').value = '';
      document.getElementById('newPassword').value = '';
      document.getElementById('passwordForm').classList.remove('active');
    } else {
      showToast(data.error || 'Error al cambiar contraseña', 'error');
    }
  });
});
