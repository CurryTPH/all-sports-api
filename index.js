const express = require('express');
const { MongoClient } = require('mongodb');
const WebSocket = require('ws');
const rateLimit = require('express-rate-limit');
const bodyParser = require('body-parser');
const tf = require('@tensorflow/tfjs');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

const app = express();
app.set('trust proxy', 1);
const port = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Too many requests, retry after 60 seconds' },
  headers: true
}));

// MongoDB setup
const uri = 'mongodb+srv://allsportsuser:MyNewPass2025@allsports-cluster.alpmi.mongodb.net/';
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

// WebSocket setup
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

// Swagger setup
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'All Sports API',
      version: '1.0.0',
      description: 'A free, scalable sports API with real NCAA data and more. Data sourced from CollegeFootballData.com under CC BY 4.0.'
    },
    servers: [
      { url: 'https://all-sports-api.onrender.com', description: 'Production server' },
      { url: 'http://localhost:3000', description: 'Local development' }
    ]
  },
  apis: ['./index.js']
};
const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

/**
 * @openapi
 * /:
 *   get:
 *     summary: Welcome message
 *     description: Returns a welcome message with links to documentation and status
 *     responses:
 *       200:
 *         description: Welcome JSON
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 docs:
 *                   type: string
 *                 status:
 *                   type: string
 */
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to the All Sports API! The ultimate sports data hub.',
    docs: '/api-docs',
    status: '/status'
  });
});

/**
 * @openapi
 * /status:
 *   get:
 *     summary: Check API health
 *     description: Returns the current status of the API, MongoDB, and WebSocket connections
 *     responses:
 *       200:
 *         description: API status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 api:
 *                   type: string
 *                 mongodb:
 *                   type: string
 *                 websocket:
 *                   type: string
 *                 uptime:
 *                   type: string
 *                 version:
 *                   type: string
 *       500:
 *         description: Status check failed
 */
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

/**
 * @openapi
 * /sports:
 *   get:
 *     summary: List all supported sports
 *     description: Returns a list of sports stored in the database with sorting options
 *     parameters:
 *       - in: query
 *         name: count
 *         schema:
 *           type: integer
 *           default: 10
 *         required: false
 *         description: Number of sports to return (max 100)
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [name, popularity]
 *           default: name
 *         required: false
 *         description: Field to sort by
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: asc
 *         required: false
 *         description: Sort order (ascending or descending)
 *     responses:
 *       200:
 *         description: List of sports
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 *                   category:
 *                     type: string
 *                   popularity:
 *                     type: integer
 *       400:
 *         description: Invalid parameters
 */
app.get('/sports', async (req, res) => {
  try {
    const count = Math.min(parseInt(req.query.count) || 10, 100);
    const sortBy = req.query.sortBy || 'name';
    const sortOrder = req.query.sortOrder === 'desc' ? -1 : 1;
    if (isNaN(count) || count < 1) throw new Error('Invalid count');
    if (!['name', 'popularity'].includes(sortBy)) throw new Error('Invalid sortBy parameter');
    const sports = await db.collection('sports')
      .find()
      .sort({ [sortBy]: sortOrder })
      .limit(count)
      .toArray();
    res.json(sports);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @openapi
 * /leagues:
 *   get:
 *     summary: List leagues
 *     description: Returns a list of leagues, optionally filtered by sport with sorting options
 *     parameters:
 *       - in: query
 *         name: sport
 *         schema:
 *           type: string
 *         required: false
 *         description: Filter by sport (e.g., football)
 *       - in: query
 *         name: count
 *         schema:
 *           type: integer
 *           default: 10
 *         required: false
 *         description: Number of leagues to return (max 100)
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [name, teams]
 *           default: name
 *         required: false
 *         description: Field to sort by
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: asc
 *         required: false
 *         description: Sort order (ascending or descending)
 *     responses:
 *       200:
 *         description: List of leagues
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 *                   sport:
 *                     type: string
 *                   teams:
 *                     type: integer
 *       400:
 *         description: Invalid parameters
 */
app.get('/leagues', async (req, res) => {
  try {
    const sportFilter = req.query.sport ? req.query.sport.toLowerCase() : null;
    const count = Math.min(parseInt(req.query.count) || 10, 100);
    const sortBy = req.query.sortBy || 'name';
    const sortOrder = req.query.sortOrder === 'desc' ? -1 : 1;
    if (isNaN(count) || count < 1) throw new Error('Invalid count');
    if (!['name', 'teams'].includes(sortBy)) throw new Error('Invalid sortBy parameter');
    const query = sportFilter ? { sport: sportFilter } : {};
    const leagues = await db.collection('leagues')
      .find(query)
      .sort({ [sortBy]: sortOrder })
      .limit(count)
      .toArray();
    res.json(leagues);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @openapi
 * /fixtures:
 *   get:
 *     summary: List sports fixtures
 *     description: Retrieve a list of sports fixtures with extensive filtering and sorting options
 *     parameters:
 *       - in: query
 *         name: sport
 *         schema:
 *           type: string
 *         required: false
 *         description: Filter by sport (e.g., football)
 *       - in: query
 *         name: count
 *         schema:
 *           type: integer
 *           default: 5
 *         required: false
 *         description: Number of fixtures to return (max 100)
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [upcoming, completed]
 *         required: false
 *         description: Filter by fixture status
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         required: false
 *         description: Filter fixtures after this date (ISO format, e.g., 2023-08-01T00:00:00Z)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         required: false
 *         description: Filter fixtures before this date (ISO format, e.g., 2023-12-31T23:59:59Z)
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [date, home, away]
 *           default: date
 *         required: false
 *         description: Field to sort by
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: asc
 *         required: false
 *         description: Sort order (ascending or descending)
 *     responses:
 *       200:
 *         description: List of fixtures
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   sport:
 *                     type: string
 *                   home:
 *                     type: string
 *                   away:
 *                     type: string
 *                   date:
 *                     type: string
 *                   status:
 *                     type: string
 *                   result:
 *                     type: string
 *       400:
 *         description: Invalid parameters
 */
app.get('/fixtures', async (req, res) => {
  try {
    const sportFilter = req.query.sport ? req.query.sport.toLowerCase() : null;
    const count = Math.min(parseInt(req.query.count) || 5, 100);
    const statusFilter = req.query.status || null;
    const startDate = req.query.startDate ? new Date(req.query.startDate) : null;
    const endDate = req.query.endDate ? new Date(req.query.endDate) : null;
    const sortBy = req.query.sortBy || 'date';
    const sortOrder = req.query.sortOrder === 'desc' ? -1 : 1;

    if (isNaN(count) || count < 1) throw new Error('Invalid count');
    if (statusFilter && !['upcoming', 'completed'].includes(statusFilter)) throw new Error('Invalid status');
    if (!['date', 'home', 'away'].includes(sortBy)) throw new Error('Invalid sortBy parameter');
    if ((startDate && isNaN(startDate)) || (endDate && isNaN(endDate))) throw new Error('Invalid date format');

    const query = {};
    if (sportFilter) query.sport = sportFilter;
    if (statusFilter) query.status = statusFilter;
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = startDate.toISOString();
      if (endDate) query.date.$lte = endDate.toISOString();
    }

    const realFixtures = await db.collection('fixtures')
      .find(query)
      .sort({ [sortBy]: sortOrder })
      .limit(count)
      .toArray();

    if (realFixtures.length === 0) {
      const mockFixtures = [
        { id: 'f1', sport: 'football', home: 'Alabama', away: 'Georgia', date: '2025-03-01T18:00:00Z', status: 'upcoming', result: 'TBD' },
        { id: 'f2', sport: 'basketball', home: 'Lakers', away: 'Celtics', date: '2025-03-02T20:00:00Z', status: 'upcoming', result: 'TBD' },
        { id: 'f3', sport: 'baseball', home: 'Yankees', away: 'Red Sox', date: '2025-03-03T19:00:00Z', status: 'upcoming', result: 'TBD' }
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

/**
 * @openapi
 * /teams:
 *   get:
 *     summary: List teams
 *     description: Returns a list of teams with extensive filtering and sorting options
 *     parameters:
 *       - in: query
 *         name: sport
 *         schema:
 *           type: string
 *         required: false
 *         description: Filter by sport (e.g., football)
 *       - in: query
 *         name: league
 *         schema:
 *           type: string
 *         required: false
 *         description: Filter by league (e.g., NFL)
 *       - in: query
 *         name: count
 *         schema:
 *           type: integer
 *           default: 10
 *         required: false
 *         description: Number of teams to return (max 100)
 *       - in: query
 *         name: location
 *         schema:
 *           type: string
 *         required: false
 *         description: Filter by team location (e.g., Dallas)
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [name, location]
 *           default: name
 *         required: false
 *         description: Field to sort by
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: asc
 *         required: false
 *         description: Sort order (ascending or descending)
 *     responses:
 *       200:
 *         description: List of teams
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 *                   sport:
 *                     type: string
 *                   league:
 *                     type: string
 *                   location:
 *                     type: string
 *       400:
 *         description: Invalid parameters
 */
app.get('/teams', async (req, res) => {
  try {
    const sportFilter = req.query.sport ? req.query.sport.toLowerCase() : null;
    const leagueFilter = req.query.league || null;
    const locationFilter = req.query.location || null;
    const count = Math.min(parseInt(req.query.count) || 10, 100);
    const sortBy = req.query.sortBy || 'name';
    const sortOrder = req.query.sortOrder === 'desc' ? -1 : 1;

    if (isNaN(count) || count < 1) throw new Error('Invalid count');
    if (!['name', 'location'].includes(sortBy)) throw new Error('Invalid sortBy parameter');

    const query = {};
    if (sportFilter) query.sport = sportFilter;
    if (leagueFilter) query.league = leagueFilter;
    if (locationFilter) query.location = { $regex: locationFilter, $options: 'i' }; // Case-insensitive search

    const teams = await db.collection('teams')
      .find(query)
      .sort({ [sortBy]: sortOrder })
      .limit(count)
      .toArray();
    res.json(teams);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @openapi
 * /players:
 *   get:
 *     summary: List players
 *     description: Returns a list of players with extensive filtering and sorting options
 *     parameters:
 *       - in: query
 *         name: sport
 *         schema:
 *           type: string
 *         required: false
 *         description: Filter by sport (e.g., basketball)
 *       - in: query
 *         name: team
 *         schema:
 *           type: string
 *         required: false
 *         description: Filter by team (e.g., Los Angeles Lakers)
 *       - in: query
 *         name: count
 *         schema:
 *           type: integer
 *           default: 10
 *         required: false
 *         description: Number of players to return (max 100)
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [name, team]
 *           default: name
 *         required: false
 *         description: Field to sort by
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: asc
 *         required: false
 *         description: Sort order (ascending or descending)
 *     responses:
 *       200:
 *         description: List of players
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 *                   sport:
 *                     type: string
 *                   team:
 *                     type: string
 *                   stats:
 *                     type: object
 *       400:
 *         description: Invalid parameters
 */
app.get('/players', async (req, res) => {
  try {
    const sportFilter = req.query.sport ? req.query.sport.toLowerCase() : null;
    const teamFilter = req.query.team || null;
    const count = Math.min(parseInt(req.query.count) || 10, 100);
    const sortBy = req.query.sortBy || 'name';
    const sortOrder = req.query.sortOrder === 'desc' ? -1 : 1;

    if (isNaN(count) || count < 1) throw new Error('Invalid count');
    if (!['name', 'team'].includes(sortBy)) throw new Error('Invalid sortBy parameter');

    const query = {};
    if (sportFilter) query.sport = sportFilter;
    if (teamFilter) query.team = teamFilter;

    const players = await db.collection('players')
      .find(query)
      .sort({ [sortBy]: sortOrder })
      .limit(count)
      .toArray();
    res.json(players);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @openapi
 * /stats:
 *   get:
 *     summary: Get team or player stats
 *     description: Returns statistics for a specific team or player with filtering options
 *     parameters:
 *       - in: query
 *         name: sport
 *         schema:
 *           type: string
 *         required: true
 *         description: Sport of the team or player (e.g., football)
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [team, player]
 *         required: true
 *         description: Type of entity (team or player)
 *       - in: query
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: Name of the team or player (e.g., Tom Brady)
 *     responses:
 *       200:
 *         description: Statistics for the entity
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 points:
 *                   type: integer
 *                 passingYards:
 *                   type: integer
 *                 tds:
 *                   type: integer
 *       400:
 *         description: Invalid parameters
 *       404:
 *         description: Entity not found
 */
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

/**
 * @openapi
 * /live:
 *   get:
 *     summary: WebSocket connection info
 *     description: Provides instructions for connecting to the live WebSocket feed
 *     responses:
 *       200:
 *         description: WebSocket connection details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 url:
 *                   type: string
 *                 info:
 *                   type: string
 */
app.get('/live', (req, res) => {
  const protocol = req.headers.host.includes('render') ? 'wss' : 'ws';
  res.json({
    message: 'Connect to WebSocket for live updates',
    url: `${protocol}://${req.headers.host}/live`,
    info: 'Updates every 1 second with mock events'
  });
});

/**
 * @openapi
 * /analytics:
 *   get:
 *     summary: AI-driven player insights
 *     description: Returns a performance score for a player based on their stats
 *     parameters:
 *       - in: query
 *         name: sport
 *         schema:
 *           type: string
 *         required: true
 *         description: Sport of the player (e.g., basketball)
 *       - in: query
 *         name: player
 *         schema:
 *           type: string
 *         required: true
 *         description: Name of the player (e.g., LeBron James)
 *     responses:
 *       200:
 *         description: Player performance score
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 player:
 *                   type: string
 *                 sport:
 *                   type: string
 *                 performanceScore:
 *                   type: string
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid parameters
 *       404:
 *         description: Player not found
 */
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

/**
 * @openapi
 * /custom:
 *   post:
 *     summary: Generate custom data
 *     description: Creates custom data based on a user-defined schema
 *     parameters:
 *       - in: query
 *         name: count
 *         schema:
 *           type: integer
 *           default: 5
 *         required: false
 *         description: Number of items to generate (1-100)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               schema:
 *                 type: object
 *                 description: Key-value pairs defining field names and types (player, team, number, event)
 *                 example: {"name": "player", "score": "number"}
 *     responses:
 *       200:
 *         description: List of custom data
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *       400:
 *         description: Invalid parameters or schema
 */
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

/**
 * @openapi
 * /odds:
 *   get:
 *     summary: Get betting odds
 *     description: Returns mock betting odds for a specific fixture
 *     parameters:
 *       - in: query
 *         name: sport
 *         schema:
 *           type: string
 *         required: true
 *         description: Sport of the fixture (e.g., football)
 *       - in: query
 *         name: fixture
 *         schema:
 *           type: string
 *         required: true
 *         description: Fixture ID (e.g., f1)
 *     responses:
 *       200:
 *         description: Betting odds
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 fixtureId:
 *                   type: string
 *                 sport:
 *                   type: string
 *                 bookmaker:
 *                   type: string
 *                 homeWin:
 *                   type: number
 *                 awayWin:
 *                   type: number
 *                 draw:
 *                   type: number
 *       400:
 *         description: Invalid parameters
 *       404:
 *         description: Odds not found
 */
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

/**
 * @openapi
 * /media:
 *   get:
 *     summary: Get game media
 *     description: Returns mock media highlights for a specific fixture
 *     parameters:
 *       - in: query
 *         name: sport
 *         schema:
 *           type: string
 *         required: true
 *         description: Sport of the fixture (e.g., football)
 *       - in: query
 *         name: fixture
 *         schema:
 *           type: string
 *         required: true
 *         description: Fixture ID (e.g., f1)
 *     responses:
 *       200:
 *         description: Media highlight
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 fixtureId:
 *                   type: string
 *                 sport:
 *                   type: string
 *                 highlight:
 *                   type: string
 *                 link:
 *                   type: string
 *       400:
 *         description: Invalid parameters
 *       404:
 *         description: Media not found
 */
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

/**
 * @openapi
 * /fanstats:
 *   post:
 *     summary: Submit fan stats
 *     description: Allows fans to submit game statistics for review
 *     parameters:
 *       - in: query
 *         name: sport
 *         schema:
 *           type: string
 *         required: true
 *         description: Sport for the stats (e.g., football)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               data:
 *                 type: object
 *                 description: Stats data (e.g., event, player)
 *                 example: {"event": "TD", "player": "Tom Brady"}
 *     responses:
 *       200:
 *         description: Submission confirmation
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *       400:
 *         description: Invalid parameters or data
 */
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