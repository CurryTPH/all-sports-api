const express = require('express');
const { MongoClient } = require('mongodb');
const WebSocket = require('ws');
const rateLimit = require('express-rate-limit');
const bodyParser = require('body-parser');
const tf = require('@tensorflow/tfjs');
const app = express();
app.set('trust proxy', 1);
const port = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Too many requests, retry after 60 seconds' },
  headers: true
}));

const uri = 'mongodb+srv://allsportsuser:mypassword123@allsports-cluster.alpmi.mongodb.net/';
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

const server = app.listen(port, () => {
  console.log(`API running on ${process.env.PORT ? 'Render' : 'http://localhost:' + port}`);
});
const wss = new WebSocket.Server({ server });

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

setInterval(() => {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(generateLiveEvent()));
    }
  });
}, 1000);

app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to the All Sports API! The ultimate sports data hub.',
    docs: '/docs',
    status: '/status'
  });
});

app.get('/status', async (req, res) => {
  try {
    const dbStatus = await client.db('allsports').command({ ping: 1 });
    res.json({
      api: 'online',
      mongodb: dbStatus.ok === 1 ? 'connected' : 'disconnected',
      websocket: wss.clients.size > 0 ? 'active' : 'idle',
      uptime: process.uptime().toFixed(2) + ' seconds',
      version: '1.0.0'
    });
  } catch (error) {
    res.status(500).json({ error: 'Status check failed', details: error.message });
  }
});

app.get('/docs', (req, res) => {
  const sampleCall = req.query.sample ? req.query.sample.toLowerCase() : null;
  const docs = {
    endpoints: {
      '/sports': { description: 'List all supported sports', parameters: { count: 'Number of sports (default: all)' }, example: '/sports?count=3' },
      '/leagues': { description: 'List leagues', parameters: { sport: 'Filter by sport', count: 'Number of leagues' }, example: '/leagues?sport=football&count=2' },
      '/fixtures': { description: 'List fixtures', parameters: { sport: 'Filter by sport', count: 'Number of fixtures (default: 5)' }, example: '/fixtures?sport=basketball&count=3' },
      '/teams': { description: 'List teams', parameters: { sport: 'Filter by sport', league: 'Filter by league', count: 'Number of teams' }, example: '/teams?sport=football&league=NFL' },
      '/players': { description: 'List players', parameters: { sport: 'Filter by sport', team: 'Filter by team', count: 'Number of players' }, example: '/players?sport=basketball&team=Los Angeles Lakers' },
      '/stats': { description: 'Get stats', parameters: { sport: 'Filter by sport', type: 'team or player', id: 'Team/player ID' }, example: '/stats?sport=football&type=player&id=Tom Brady' },
      '/live': { description: 'WebSocket for live updates (1s delay)', usage: 'Connect via wss://your-url/live', example: 'wss://all-sports-api.onrender.com/live' },
      '/analytics': { description: 'AI-driven insights', parameters: { sport: 'Sport type', player: 'Player name' }, example: '/analytics?sport=basketball&player=LeBron James' },
      '/custom': { description: 'Custom data via POST', parameters: { count: 'Number of items', schema: 'JSON body' }, example: 'POST /custom?count=2 with {"schema": {"name": "player"}}' },
      '/odds': { description: 'Betting odds', parameters: { sport: 'Filter by sport', fixture: 'Fixture ID' }, example: '/odds?sport=football&fixture=f1' },
      '/media': { description: 'Game media', parameters: { sport: 'Filter by sport', fixture: 'Fixture ID' }, example: '/media?sport=football&fixture=f1' },
      '/fanstats': { description: 'Submit fan stats via POST', parameters: { sport: 'Sport type', data: 'JSON body' }, example: 'POST /fanstats?sport=football with {"event": "TD", "player": "Tom Brady"}' },
      '/status': { description: 'API health status', parameters: {}, example: '/status' }
    },
    version: '1.0.0',
    baseUrl: 'https://all-sports-api.onrender.com',
    note: 'Use ?sample=endpoint to test directly (GET only)'
  };
  if (sampleCall && docs.endpoints['/' + sampleCall]) {
    res.redirect('/' + sampleCall);
  } else {
    res.json(docs);
  }
});

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

app.get('/fixtures', async (req, res) => {
  try {
    const sportFilter = req.query.sport ? req.query.sport.toLowerCase() : null;
    const count = parseInt(req.query.count) || 5;
    if (isNaN(count) || count < 1) throw new Error('Invalid count');
    const query = sportFilter ? { sport: sportFilter } : {};
    const realFixtures = await db.collection('fixtures').find(query).limit(count).toArray();
    if (realFixtures.length === 0) {
      const mockFixtures = [
        { id: 'f1', sport: 'football', home: 'Alabama', away: 'Georgia', date: '2025-03-01T18:00:00Z', status: 'upcoming' },
        { id: 'f2', sport: 'basketball', home: 'Lakers', away: 'Celtics', date: '2025-03-02T20:00:00Z', status: 'upcoming' },
        { id: 'f3', sport: 'baseball', home: 'Yankees', away: 'Red Sox', date: '2025-03-03T19:00:00Z', status: 'upcoming' }
      ];
      const filteredFixtures = sportFilter
        ? mockFixtures.filter(f => f.sport === sportFilter)
        : mockFixtures;
      res.json(filteredFixtures.slice(0, Math.min(count, filteredFixtures.length)));
    } else {
      res.json(realFixtures);
    }
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

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

app.get('/live', (req, res) => {
  const protocol = req.headers.host.includes('render') ? 'wss' : 'ws';
  res.json({
    message: 'Connect to WebSocket for live updates',
    url: `${protocol}://${req.headers.host}/live`,
    info: 'Updates every 1 second with mock events'
  });
});

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

app.post('/custom', async (req, res) => {
  try {
    const count = parseInt(req.query.count) || 5;
    if (isNaN(count) || count < 1 || count > 100) throw new Error('Invalid count (1-100)');
    const schema = req.body.schema || {};
    if (Object.keys(schema).length === 0) throw new Error('Schema required');
    const results = [];
    for (let i = 0; i < count; i++) {
      const item = {};
      for (let [key, type] of Object.entries(schema)) {
        if (type === 'player') item[key] = `Player ${i + 1}`;
        if (type === 'team') item[key] = `Team ${i + 1}`;
        if (type === 'number') item[key] = Math.floor(Math.random() * 1000);
        if (type === 'event') item[key] = ['goal', 'score', 'foul'][Math.floor(Math.random() * 3)];
      }
      results.push(item);
    }
    res.json(results);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/odds', (req, res) => {
  try {
    const sport = req.query.sport ? req.query.sport.toLowerCase() : null;
    const fixture = req.query.fixture || null;
    if (!sport || !fixture) throw new Error('Missing sport or fixture');
    const mockOdds = [
      { fixtureId: 'f1', sport: 'football', bookmaker: 'DraftKings', homeWin: 1.8, awayWin: 2.2, draw: 3.0 },
      { fixtureId: 'f2', sport: 'basketball', bookmaker: 'FanDuel', homeWin: 1.5, awayWin: 2.5 },
      { fixtureId: 'f3', sport: 'baseball', bookmaker: 'Bet365', homeWin: 1.9, awayWin: 1.9 }
    ];
    const odds = mockOdds.find(o => o.sport === sport && o.fixtureId === fixture);
    if (!odds) throw new Error('Odds not found for this fixture');
    res.json(odds);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/media', (req, res) => {
  try {
    const sport = req.query.sport ? req.query.sport.toLowerCase() : null;
    const fixture = req.query.fixture || null;
    if (!sport || !fixture) throw new Error('Missing sport or fixture');
    const mockMedia = [
      { fixtureId: 'f1', sport: 'football', highlight: 'TD at 23:45 - 50-yard run!', link: 'http://example.com/video1' },
      { fixtureId: 'f2', sport: 'basketball', highlight: 'Buzzer-beater 3-pointer!', link: 'http://example.com/video2' },
      { fixtureId: 'f3', sport: 'baseball', highlight: 'Grand slam in 9th inning!', link: 'http://example.com/video3' }
    ];
    const media = mockMedia.find(m => m.sport === sport && m.fixtureId === fixture);
    if (!media) throw new Error('Media not found for this fixture');
    res.json(media);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/fanstats', async (req, res) => {
  try {
    const sport = req.query.sport ? req.query.sport.toLowerCase() : null;
    const data = req.body.data || {};
    if (!sport || Object.keys(data).length === 0) throw new Error('Missing sport or data');
    const fanStat = { sport, ...data, submittedAt: new Date().toISOString(), status: 'pending' };
    await db.collection('fanstats').insertOne(fanStat);
    res.json({ message: 'Fan stat submitted for review', data: fanStat });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});