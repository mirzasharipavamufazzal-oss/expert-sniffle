require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const questions = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'questions.json'), 'utf8'));
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'];
const COINS_PER_CORRECT = 10;
const BOT_TOKEN = process.env.BOT_TOKEN || '';

// --- Telegram WebApp initData verification ---
// Confirms a request really came from Telegram and wasn't spoofed by someone
// editing the request in devtools. See:
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
function verifyInitData(initData) {
  if (!BOT_TOKEN || !initData) return null;
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    params.delete('hash');
    const dataCheckString = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
    const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    if (computedHash !== hash) return null;
    const user = JSON.parse(params.get('user') || '{}');
    return user.id ? String(user.id) : null;
  } catch (e) {
    return null;
  }
}

// Every API call carries initData in the body/header so we know who's asking.
// Falls back to an explicit userId (handy for local testing outside Telegram).
function resolveUserId(req) {
  const verified = verifyInitData(req.headers['x-telegram-init-data']);
  if (verified) return verified;
  if (req.body && req.body.userId) return String(req.body.userId);
  if (req.query && req.query.userId) return String(req.query.userId);
  return null;
}

app.get('/api/levels', (req, res) => {
  res.json({ levels: LEVELS });
});

app.get('/api/me', (req, res) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: 'Could not identify user' });
  const user = db.getUser(userId);
  res.json({ userId, coins: user.coins, progress: user.progress, currentLevel: user.currentLevel });
});

app.post('/api/select-level', (req, res) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: 'Could not identify user' });
  const { level } = req.body;
  if (!LEVELS.includes(level)) return res.status(400).json({ error: 'Invalid level' });
  const user = db.getUser(userId);
  user.currentLevel = level;
  if (!user.progress[level]) user.progress[level] = { answered: [], correct: 0 };
  db.saveUser(userId, user);

  // Send back the quiz with correct answers stripped out
  const quiz = questions[level].map((q, i) => ({ id: i, q: q.q, options: q.options }));
  res.json({ level, quiz, coins: user.coins });
});

app.post('/api/answer', (req, res) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: 'Could not identify user' });
  const { level, questionId, selectedIndex } = req.body;
  if (!LEVELS.includes(level) || !questions[level]) {
    return res.status(400).json({ error: 'Invalid level' });
  }
  const question = questions[level][questionId];
  if (!question) return res.status(400).json({ error: 'Invalid question id' });

  const user = db.getUser(userId);
  if (!user.progress[level]) user.progress[level] = { answered: [], correct: 0 };
  const already = user.progress[level].answered.includes(questionId);
  const isCorrect = selectedIndex === question.answer;

  let coinsAwarded = 0;
  if (isCorrect && !already) {
    coinsAwarded = COINS_PER_CORRECT;
    user.coins += coinsAwarded;
    user.progress[level].correct += 1;
  }
  if (!already) user.progress[level].answered.push(questionId);
  db.saveUser(userId, user);

  res.json({
    correct: isCorrect,
    correctIndex: question.answer,
    coinsAwarded,
    totalCoins: user.coins,
    alreadyAnswered: already
  });
});

app.get('/api/leaderboard', (req, res) => {
  const all = db.readAll();
  const board = Object.entries(all)
    .map(([userId, u]) => ({ userId, coins: u.coins || 0 }))
    .sort((a, b) => b.coins - a.coins)
    .slice(0, 20);
  res.json({ leaderboard: board });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Learn & Earn server running on port ${PORT}`));
