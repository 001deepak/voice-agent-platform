// server.js
// This is the "brain" of your platform. It does 3 jobs:
// 1. Lets a business sign up and log in
// 2. Lets them configure their AI voice agent (business name, script, language, voice)
// 3. Sends that configuration to Sarvam AI to actually create the working voice agent

const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
app.use(express.json());
app.use(express.static('public')); // serves index.html, dashboard.html, etc.

const DB_FILE = path.join(__dirname, 'db.json');

// --- Very simple "database" using a JSON file ---
// This is fine for testing with a handful of clients. Once you have real
// paying customers, we'll swap this for a proper free database (Supabase).
function readDB() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ users: [], agents: [] }, null, 2));
  }
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
}
function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// --- Helper: hash passwords so we never store them in plain text ---
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// --- Helper: make a simple login token ---
function makeToken() {
  return crypto.randomBytes(24).toString('hex');
}

// ===================== SIGNUP =====================
app.post('/api/signup', (req, res) => {
  const { businessName, email, password } = req.body;
  if (!businessName || !email || !password) {
    return res.status(400).json({ error: 'Missing businessName, email, or password' });
  }
  const db = readDB();
  if (db.users.find(u => u.email === email)) {
    return res.status(400).json({ error: 'An account with this email already exists' });
  }
  const user = {
    id: crypto.randomUUID(),
    businessName,
    email,
    passwordHash: hashPassword(password),
    token: makeToken(),
  };
  db.users.push(user);
  writeDB(db);
  res.json({ token: user.token, businessName: user.businessName });
});

// ===================== LOGIN =====================
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  const db = readDB();
  const user = db.users.find(u => u.email === email);
  if (!user || user.passwordHash !== hashPassword(password)) {
    return res.status(401).json({ error: 'Wrong email or password' });
  }
  res.json({ token: user.token, businessName: user.businessName });
});

// --- Helper: find the logged-in user from their token ---
function getUserByToken(req) {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  const db = readDB();
  return db.users.find(u => u.token === token);
}

// ===================== CREATE / UPDATE AGENT =====================
// This is where the magic happens: it takes what the client typed into
// the dashboard and sends it to Sarvam AI to actually build the agent.
app.post('/api/agent', async (req, res) => {
  const user = getUserByToken(req);
  if (!user) return res.status(401).json({ error: 'Please log in first' });

  const { agentName, script, language, voice } = req.body;
  if (!agentName || !script) {
    return res.status(400).json({ error: 'agentName and script are required' });
  }

  // --- Call Sarvam AI's Voice Agents API to create the agent ---
  // NOTE: The exact request shape may need small adjustments once you
  // check Sarvam's current API docs (docs.sarvam.ai) — APIs evolve.
  // This is written to be easy to adjust: everything Sarvam-specific
  // lives in this one block.
  let sarvamAgentId = null;
  try {
    const sarvamRes = await fetch('https://api.sarvam.ai/v1/voice-agents', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-subscription-key': process.env.SARVAM_API_KEY,
      },
      body: JSON.stringify({
        name: agentName,
        instructions: script,
        language: language || 'te-IN', // Telugu by default
        speaker: voice || 'default',
      }),
    });
    const sarvamData = await sarvamRes.json();
    sarvamAgentId = sarvamData.id || null;
    if (!sarvamRes.ok) {
      console.error('Sarvam API error:', sarvamData);
      return res.status(502).json({ error: 'Sarvam AI rejected the agent config', details: sarvamData });
    }
  } catch (err) {
    console.error('Could not reach Sarvam AI:', err.message);
    return res.status(502).json({ error: 'Could not reach Sarvam AI. Check your SARVAM_API_KEY.' });
  }

  // --- Save the agent under this client's account ---
  const db = readDB();
  const agent = {
    id: crypto.randomUUID(),
    ownerId: user.id,
    agentName,
    script,
    language: language || 'te-IN',
    voice: voice || 'default',
    sarvamAgentId,
    createdAt: new Date().toISOString(),
  };
  db.agents.push(agent);
  writeDB(db);

  res.json({ success: true, agent });
});

// ===================== LIST MY AGENTS =====================
app.get('/api/agents', (req, res) => {
  const user = getUserByToken(req);
  if (!user) return res.status(401).json({ error: 'Please log in first' });
  const db = readDB();
  const myAgents = db.agents.filter(a => a.ownerId === user.id);
  res.json({ agents: myAgents });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
