const express = require('express');
const { MongoClient } = require('mongodb');
const rateLimit = require('express-rate-limit');
const app = express();
app.set('trust proxy', 1); // Trust Render's proxy
const port = process.env.PORT || 3000;

// Rate limiting
app.use(rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30, // 30 requests per minute
    message: { error: 'Too many requests, retry after 60 seconds' },
    headers: true
}));

// MongoDB setup
const uri = 'mongodb+srv://allsportsuser:yourpassword123@allsports-cluster.alpmi.mongodb.net/'; // Local for now, Render later
const client = new MongoClient(uri);
let db;

async function connectDB() {
    try {
        await client.connect();
        db = client.db('allsports');
        console.log('Connected to MongoDB');

        // Seed initial data (runs only if collections are empty)
        const sportsCount = await db.collection('sports').countDocuments();
        if (sportsCount === 0) {
            await db.collection('sports').insertMany([
                { name: 'Football', category: 'Team', popularity: 95 },
                { name: 'Basketball', category: 'Team', popularity: 90 },
                { name: 'Baseball', category: 'Team', popularity: 85 },
                { name: 'Soccer', category: 'Team', popularity: 98 },
                { name: 'Tennis', category: 'Individual', popularity: 80 },
                { name: 'Cricket', category: 'Team', popularity: 75 },
                { name: 'Hockey', category: 'Team', popularity: 70 },
                { name: 'Golf', category: 'Individual', popularity: 65 },
                { name: 'Esports', category: 'Team', popularity: 60 },
                { name: 'Boxing', category: 'Individual', popularity: 55 }
            ]);
            await db.collection('leagues').insertMany([
                { name: 'NFL', sport: 'football', teams: 32 },
                { name: 'NCAA FBS', sport: 'football', teams: 133 },
                { name: 'NBA', sport: 'basketball', teams: 30 },
                { name: 'WNBA', sport: 'basketball', teams: 12 },
                { name: 'MLB', sport: 'baseball', teams: 30 },
                { name: 'Premier League', sport: 'soccer', teams: 20 },
                { name: 'ATP Tour', sport: 'tennis', players: 128 }
            ]);
            await db.collection('teams').insertMany([
                { name: 'Dallas Cowboys', sport: 'football', league: 'NFL', location: 'Dallas, TX' },
                { name: 'Alabama Crimson Tide', sport: 'football', league: 'NCAA FBS', location: 'Tuscaloosa, AL' },
                { name: 'Los Angeles Lakers', sport: 'basketball', league: 'NBA', location: 'Los Angeles, CA' }
            ]);
            await db.collection('players').insertMany([
                { name: 'Tom Brady', sport: 'football', team: 'Dallas Cowboys', stats: { passingYards: 50000, tds: 300 } },
                { name: 'LeBron James', sport: 'basketball', team: 'Los Angeles Lakers', stats: { points: 40000, assists: 10000 } }
            ]);
            console.log('Seeded initial mock data');
        }
    } catch (e) {
        console.error('MongoDB connection failed:', e);
    }
}
connectDB();

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
            '/stats': { description: 'Get stats', parameters: { sport: 'Filter by sport', type: 'team or player', id: 'Team/player ID' }, example: '/stats?sport=football&type=player&id=Tom Brady' }
        },
        version: '1.0.0',
        baseUrl: 'http://localhost:3000' // Update to Render URL later
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

// /fixtures endpoint (mock data for now)
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
        const type = req.query.type || null; // 'team' or 'player'
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

// Start the server
app.listen(port, () => {
    console.log(`API running at http://localhost:${port}`);
});