const express = require('express');
const { MongoClient } = require('mongodb');
const WebSocket = require('ws');
const rateLimit = require('express-rate-limit');
const tf = require('@tensorflow/tfjs'); // Fixed to pure JS version
const app = express();
app.set('trust proxy', 1);
const port = process.env.PORT || 3000;

// Rate limiting
app.use(rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: { error: 'Too many requests, retry after 60 seconds' },
  headers: true
}));

// MongoDB setup
const uri = 'mongodb+srv://allsportsuser:yourpassword123@allsports-cluster.alpmi.mongodb.net/'; // Replace with your Atlas URI
const client = new MongoClient(uri);
let db;

async function connectDB() {
  try {
    await client.connect();
    db = client.db('allsports');
    console.log('Connected to MongoDB');
  } catch (e) {
    console.error('MongoDB connection failed:', e);
  }
}
connectDB();

// WebSocket setup for /live
const server = app.listen(port, () => {
  console.log(`API running at http://localhost:${port}`);
});
const wss = new WebSocket.Server({ server });

// Mock live event generator
function generateLiveEvent() {
  const sports = ['football', 'basketball', 'baseball'];
  const events = ['touchdown', 'basket', 'home run'];
  return {
    sport: sports[Math.floor(Math.random() * sports.length)],
    event: events[Math.floor(Math.random() * events.length)],
    timestamp: new Date().toISOString(),
    details: `Player ${Math.floor(Math.random() * 100)} scores!`
  };
}

// Broadcast live events every 1 second
setInterval(() => {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(generateLiveEvent()));
    }
  });
}, 1000);

// Root route
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to the All Sports API! The ultimate sports data hub.',
    docs: '/docs'
  });
});

// Docs endpoint
app.get('/docs', (req, res) => {
  res.json({
    endpoints: {
      '/sports': { description: 'List all supported sports', parameters: { count: 'Number of sports (default: all)' }, example: '/sports?count=3' },
      '/leagues': { description: 'List leagues', parameters: { sport: 'Filter by sport', count: 'Number of leagues' }, example: '/leagues?sport=football&count=2' },
      '/fixtures': { description: 'List fixtures', parameters: { sport: 'Filter by sport', count: 'Number of fixtures (default: 5)' }, example: '/fixtures?sport=basketball&count=3' },
      '/teams': { description: 'List teams', parameters: { sport: 'Filter by sport', league: 'Filter by league', count: 'Number of teams' }, example: '/teams?sport=football&league=NFL' },
      '/players': { description: 'List players', parameters: { sport: 'Filter by sport', team: 'Filter by team', count: 'Number of players' }, example: '/players?sport=basketball&team=Los Angeles Lakers' },
      '/stats': { description: 'Get stats', parameters: { sport: 'Filter by sport', type: 'team or player', id: 'Team/player ID' }, example: '/stats?sport=football&type=player&id=Tom Brady' },
      '/live': { description: 'WebSocket for live updates (1s delay)', usage: 'Connect via ws://your-url/live', example: 'ws://localhost:3000/live' },
      '/analytics': { description: 'AI-driven insights', parameters: { sport: 'Sport type', player: 'Player name' }, example: '/analytics?sport=basketball&player=LeBron James' }
    },
    version: '1.0.0',
    baseUrl: 'http://localhost:3000' // Update to Render URL
  });
});

// /sports endpoint
app.get('/sports', async (req, res) => {
  try {
    const count = parseInt(req.query.count) || Infinity;
    if (isNaN(count) || count < 1) throw new Error('Invalid count');
    const sports = await db.collection('sports').find().limit(count).toArray();
    res.json(sports);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// /leagues endpoint
app.get('/leagues', async (req, res) => {
  try {
    const sportFilter = req.query.sport ? req.query.sport.toLowerCase() : null;
    const count = parseInt(req.query.count) || Infinity;
    if (isNaN(count) || count < 1) throw new Error('Invalid count');
    const query = sportFilter ? { sport: sportFilter } : {};
    const leagues = await db.collection('leagues').find(query).limit(count).toArray();
    res.json(leagues);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// /fixtures endpoint (mock data)
app.get('/fixtures', (req, res) => {
  try {
    const sportFilter = req.query.sport ? req.query.sport.toLowerCase() : null;
    const count = parseInt(req.query.count) || 5;
    if (isNaN(count) || count < 1) throw new Error('Invalid count');
    const mockFixtures = [
      { id: 'f1', sport: 'football', home: 'Alabama', away: 'Georgia', date: '2025-03-01T18:00:00Z', status: 'upcoming' },
      { id: 'f2', sport: 'basketball', home: 'Lakers', away: 'Celtics', date: '2025-03-02T20:00:00Z', status: 'upcoming' },
      { id: 'f3', sport: 'baseball', home: 'Yankees', away: 'Red Sox', date: '2025-03-03T19:00:00Z', status: 'upcoming' }
    ];
    const filteredFixtures = sportFilter
      ? mockFixtures.filter(f => f.sport === sportFilter)
      : mockFixtures;
    const result = filteredFixtures.slice(0, Math.min(count, filteredFixtures.length));
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// /teams endpoint
app.get('/teams', async (req, res) => {
  try {
    const sportFilter = req.query.sport ? req.query.sport.toLowerCase() : null;
    const leagueFilter = req.query.league || null;
    const count = parseInt(req.query.count) || Infinity;
    if (isNaN(count) || count < 1) throw new Error('Invalid count');
    const query = {};
    if (sportFilter) query.sport = sportFilter;
    if (leagueFilter) query.league = leagueFilter;
    const teams = await db.collection('teams').find(query).limit(count).toArray();
    res.json(teams);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// /players endpoint
app.get('/players', async (req, res) => {
  try {
    const sportFilter = req.query.sport ? req.query.sport.toLowerCase() : null;
    const teamFilter = req.query.team || null;
    const count = parseInt(req.query.count) || Infinity;
    if (isNaN(count) || count < 1) throw new Error('Invalid count');
    const query = {};
    if (sportFilter) query.sport = sportFilter;
    if (teamFilter) query.team = teamFilter;
    const players = await db.collection('players').find(query).limit(count).toArray();
    res.json(players);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// /stats endpoint
app.get('/stats', async (req, res) => {
  try {
    const sportFilter = req.query.sport ? req.query.sport.toLowerCase() : null;
    const type = req.query.type || null;
    const id = req.query.id || null;
    if (!sportFilter || !type || !id) throw new Error('Missing sport, type, or id');
    if (!['team', 'player'].includes(type)) throw new Error('Type must be team or player');
    const collection = type === 'team' ? 'teams' : 'players';
    const item = await db.collection(collection).findOne({ sport: sportFilter, name: id });
    if (!item) throw new Error(`${type} not found`);
    res.json(item.stats || { message: 'No stats available yet' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// /live endpoint (REST placeholder)
app.get('/live', (req, res) => {
  res.json({
    message: 'Connect to WebSocket for live updates',
    url: `ws://${req.headers.host}/live`,
    info: 'Updates every 1 second with mock events'
  });
});

// /analytics endpoint
app.get('/analytics', async (req, res) => {
  try {
    const sport = req.query.sport ? req.query.sport.toLowerCase() : null;
    const player = req.query.player || null;
    if (!sport || !player) throw new Error('Missing sport or player');
    const playerData = await db.collection('players').findOne({ sport, name: player });
    if (!playerData) throw new Error('Player not found');

    const stats = playerData.stats || {};
    const inputTensor = tf.tensor2d([[stats.points || 0, stats.passingYards || 0, stats.tds || 0]]);
    const weights = tf.tensor2d([[0.3], [0.5], [0.2]]);
    const score = inputTensor.matMul(weights).dataSync()[0] / 1000;
    res.json({
      player,
      sport,
      performanceScore: Math.min(Math.max(score, 0), 10).toFixed(1),
      message: 'Score based on mock AI model'
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});