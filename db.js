// Minimal file-based persistence layer.
// Good enough for an MVP / small user base. Swap for SQLite/Postgres later if you scale up.
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'users.json');

function readAll() {
  if (!fs.existsSync(DB_PATH)) return {};
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.error('DB read error, starting fresh:', e.message);
    return {};
  }
}

function writeAll(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function getUser(userId) {
  const all = readAll();
  if (!all[userId]) {
    all[userId] = {
      coins: 0,
      currentLevel: null,
      progress: {}, // level -> { answered: [], correct: 0 }
      firstSeen: new Date().toISOString()
    };
    writeAll(all);
  }
  return all[userId];
}

function saveUser(userId, userData) {
  const all = readAll();
  all[userId] = userData;
  writeAll(all);
  return userData;
}

function addCoins(userId, amount) {
  const all = readAll();
  const user = all[userId] || getUser(userId);
  user.coins = (user.coins || 0) + amount;
  all[userId] = user;
  writeAll(all);
  return user.coins;
}

module.exports = { getUser, saveUser, addCoins, readAll };
