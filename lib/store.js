let redis;
try {
  const { Redis } = require('@upstash/redis');
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    redis = new Redis({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    });
  }
} catch {}

const fs = require('fs');
const path = require('path');
const DATA_FILE = path.join(__dirname, '..', 'data', 'config.json');
const KV_KEY = 'app_config';

async function getAll() {
  if (redis) {
    const data = await redis.get(KV_KEY);
    return data || getDefaultConfig();
  }
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  } catch {
    return getDefaultConfig();
  }
}

async function saveAll(data) {
  if (redis) {
    await redis.set(KV_KEY, data);
    return;
  }
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function getDefaultConfig() {
  return {
    users: [],
    timer: {
      eventName: 'Conferencia',
      totalSeconds: 600,
      remainingSeconds: 600,
      isRunning: false,
      isPaused: false,
      startedAt: null
    }
  };
}

module.exports = { getAll, saveAll };
