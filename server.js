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
app.use(express.static('.'));

const DB_FILE = path.join(__dirname, 'db.json');

function readDB() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ users: [], agents: [] }, null, 2));
  }
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function makeToken() {
  return crypto.randomBytes(24).toString('hex');
}

function getUserByToken(req) {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  const db = readDB();
  return db.users.find(u => u.token === token);
}

app.post('/api/signup', (req, res) => {
  const { businessName, email, password } = req.body;
  if (!businessName || !email || !password) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  const db = readDB();
  if (db.users.find(u => u.email === email)) {
    return res.status(400).json({ error: 'Email exists' });
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

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  const db = readDB();
  const user = db.users.find(u => u.email === email);
  if (!user || user.passwordHash !== hashPassword(password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  res.json({ token: user.token, businessName: user.businessName });
});

app.post('/api/agent', (req, res) => {
  const user = getUserByToken(req);
  if (!user) return res.status(401).json({ error: 'Not logged in' });

  const { agentName, script, language } = req.body;
  if (!agentName || !script) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  const db = readDB();
  const agent = {
    id: crypto.randomUUID(),
    ownerId: user.id,
    agentName,
    script,
    language: language || 'te-IN',
    createdAt: new Date().toISOString(),
  };
  db.agents.push(agent);
  writeDB(db);
  res.json({ success: true, agent });
});

app.get('/api/agents', (req, res) => {
  const user = getUserByToken(req);
  if (!user) return res.status(401).json({ error: 'Not logged in' });
  const db = readDB();
  const myAgents = db.agents.filter(a => a.ownerId === user.id);
  res.json({ agents: myAgents });
});

app.post('/api/agent/:agentId/chat', async (req, res) => {
  const user = getUserByToken(req);
  if (!user) return res.status(401).json({ error: 'Not logged in' });

  const { agentId } = req.params;
  const { userMessage } = req.body;
  if (!userMessage) return res.status(400).json({ error: 'No message' });

  const db = readDB();
  const agent = db.agents.find(a => a.id === agentId && a.ownerId === user.id);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });

  try {
    const llmRes = await fetch('https://api.sarvam.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-subscription-key': process.env.SARVAM_API_KEY,
      },
      body: JSON.stringify({
        model: 'Sarvam-30B',
        messages: [
          { role: 'system', content: agent.script },
          { role: 'user', content: userMessage },
        ],
        max_tokens: 200,
      }),
    });

    if (!llmRes.ok) {
      return res.status(502).json({ error: 'LLM failed' });
    }

    const llmData = await llmRes.json();
    const agentReply = llmData.choices?.[0]?.message?.content || 'I did not understand.';

    const ttsRes = await fetch('https://api.cartesia.ai/tts/stream', {
      method: 'POST',
      headers: {
        'X-API-Key': process.env.CARTESIA_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model_id: 'sonic-3.5',
        transcript: agentReply,
        voice: { mode: 'id', id: 'cartesia_voice_id_1' },
        language: agent.language,
      }),
    });

    if (!ttsRes.ok) {
      return res.status(502).json({ error: 'TTS failed' });
    }

    const audioBuffer = await ttsRes.arrayBuffer();
    const audioBase64 = Buffer.from(audioBuffer).toString('base64');

    res.json({
      success: true,
      agentReply,
      audioData: `data:audio/wav;base64,${audioBase64}`,
    });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Voice Agent Platform on port ${PORT}`));
