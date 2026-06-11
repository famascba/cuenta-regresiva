const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const store = require('./lib/store');
const auth = require('./lib/auth');

function getRemaining(timer) {
  if (!timer.startedAt || !timer.isRunning) return timer.remainingSeconds;
  const elapsed = (Date.now() - new Date(timer.startedAt).getTime()) / 1000;
  return Math.max(0, timer.totalSeconds - Math.floor(elapsed));
}

function createApp() {
  const app = express();

  app.use(express.json());
  app.use(express.static(path.join(__dirname, 'public')));

  app.get('/api/state', async (req, res) => {
    const config = await store.getAll();
    const timer = config.timer;
    let remaining = getRemaining(timer);

    if (remaining <= 0 && timer.isRunning) {
      timer.isRunning = false;
      timer.isPaused = false;
      timer.remainingSeconds = 0;
      timer.startedAt = null;
      await store.saveAll(config);
    }

    const progress = timer.totalSeconds > 0
      ? (timer.totalSeconds - remaining) / timer.totalSeconds
      : 0;

    res.json({
      eventName: timer.eventName,
      totalSeconds: timer.totalSeconds,
      remainingSeconds: remaining,
      isRunning: timer.isRunning,
      isPaused: timer.isPaused,
      isFinished: remaining <= 0 && timer.totalSeconds > 0,
      startedAt: timer.startedAt,
      progress: Math.min(1, Math.max(0, progress))
    });
  });

  app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
    }
    try {
      const config = await store.getAll();
      const user = config.users.find(u => u.username === username);
      if (!user) {
        return res.status(401).json({ error: 'Credenciales inválidas' });
      }
      const match = await bcrypt.compare(password, user.password);
      if (!match) {
        return res.status(401).json({ error: 'Credenciales inválidas' });
      }
      const token = auth.sign({ username: user.username });
      res.json({ success: true, username: user.username, token });
    } catch {
      res.status(500).json({ error: 'Error del servidor' });
    }
  });

  app.get('/api/auth/me', auth.requireAuth, (req, res) => {
    res.json({ authenticated: true, username: req.user.username });
  });

  app.post('/api/auth/logout', (req, res) => {
    res.json({ success: true });
  });

  app.get('/api/admin/config', auth.requireAuth, async (req, res) => {
    const config = await store.getAll();
    const remaining = getRemaining(config.timer);
    res.json({
      eventName: config.timer.eventName,
      totalSeconds: config.timer.totalSeconds,
      remainingSeconds: remaining,
      isRunning: config.timer.isRunning,
      isPaused: config.timer.isPaused
    });
  });

  app.put('/api/admin/config', auth.requireAuth, async (req, res) => {
    const config = await store.getAll();
    const { eventName, totalSeconds } = req.body;
    if (eventName !== undefined) config.timer.eventName = eventName;
    if (totalSeconds !== undefined && totalSeconds > 0) {
      config.timer.totalSeconds = totalSeconds;
      if (!config.timer.isRunning) config.timer.remainingSeconds = totalSeconds;
    }
    await store.saveAll(config);
    res.json({ success: true });
  });

  app.post('/api/admin/start', auth.requireAuth, async (req, res) => {
    const config = await store.getAll();
    if (config.timer.isRunning) {
      return res.status(400).json({ error: 'El temporizador ya está en ejecución' });
    }
    if (config.timer.remainingSeconds <= 0) {
      config.timer.remainingSeconds = config.timer.totalSeconds;
    }
    config.timer.isRunning = true;
    config.timer.isPaused = false;
    config.timer.startedAt = new Date().toISOString();
    await store.saveAll(config);
    res.json({ success: true, remainingSeconds: config.timer.remainingSeconds });
  });

  app.post('/api/admin/pause', auth.requireAuth, async (req, res) => {
    const config = await store.getAll();
    if (!config.timer.isRunning) {
      return res.status(400).json({ error: 'El temporizador no está en ejecución' });
    }
    config.timer.remainingSeconds = getRemaining(config.timer);
    config.timer.isRunning = false;
    config.timer.isPaused = true;
    config.timer.startedAt = null;
    await store.saveAll(config);
    res.json({ success: true, remainingSeconds: config.timer.remainingSeconds });
  });

  app.post('/api/admin/resume', auth.requireAuth, async (req, res) => {
    const config = await store.getAll();
    if (config.timer.isRunning) {
      return res.status(400).json({ error: 'El temporizador ya está en ejecución' });
    }
    if (config.timer.remainingSeconds <= 0) {
      return res.status(400).json({ error: 'El temporizador ha finalizado. Reinicie primero.' });
    }
    config.timer.isRunning = true;
    config.timer.isPaused = false;
    config.timer.startedAt = new Date().toISOString();
    await store.saveAll(config);
    res.json({ success: true, remainingSeconds: config.timer.remainingSeconds });
  });

  app.post('/api/admin/reset', auth.requireAuth, async (req, res) => {
    const config = await store.getAll();
    config.timer.remainingSeconds = config.timer.totalSeconds;
    config.timer.isRunning = false;
    config.timer.isPaused = false;
    config.timer.startedAt = null;
    await store.saveAll(config);
    res.json({ success: true, remainingSeconds: config.timer.remainingSeconds });
  });

  app.post('/api/admin/set-remaining', auth.requireAuth, async (req, res) => {
    const config = await store.getAll();
    const { remainingSeconds } = req.body;
    if (remainingSeconds === undefined || remainingSeconds < 0 || remainingSeconds > config.timer.totalSeconds) {
      return res.status(400).json({ error: 'Valor de tiempo restante inválido' });
    }
    if (config.timer.isRunning) {
      return res.status(400).json({ error: 'Detenga el temporizador antes de ajustar el tiempo' });
    }
    config.timer.remainingSeconds = remainingSeconds;
    await store.saveAll(config);
    res.json({ success: true, remainingSeconds: config.timer.remainingSeconds });
  });

  app.post('/api/admin/change-password', auth.requireAuth, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Contraseña actual y nueva requeridas' });
    }
    try {
      const config = await store.getAll();
      const user = config.users.find(u => u.username === req.user.username);
      const match = await bcrypt.compare(currentPassword, user.password);
      if (!match) {
        return res.status(401).json({ error: 'Contraseña actual incorrecta' });
      }
      user.password = await bcrypt.hash(newPassword, 10);
      await store.saveAll(config);
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: 'Error al cambiar la contraseña' });
    }
  });

  return app;
}

module.exports = createApp;
