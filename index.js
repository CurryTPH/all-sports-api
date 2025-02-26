const express = require('express');
const rateLimit = require('express-rate-limit');
const app = express();
app.set('trust proxy', 1); // Trust Render's proxy to fix X-Forwarded-For issue
const port = process.env.PORT || 3000;

// Rate limiting (500 requests/day free tier equivalent, adjusted for per minute)
app.use(rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30, // 30 requests per minute (scales to ~500/day with bursts)
    message: { error: 'Too many requests, retry after 60 seconds' },
    headers: true
}));

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
            '/sports': {
                description: 'List all supported sports',
                parameters: { count: 'Number of sports to return (default: all)' },
                example: '/sports?count=3'
            },
            '/leagues': {
                description: 'List leagues across sports',
                parameters: { sport: 'Filter by sport (e.g., football)', count: 'Number of leagues (default: all)' },
                example: '/leagues?sport=football&count=2'
            },
            '/fixtures': {
                description: 'List upcoming or past fixtures',
                parameters: { sport: 'Filter by sport', count: 'Number of fixtures (default: 5)' },
                example: '/fixtures?sport=basketball&count=3'
            }
        },
        version: '1.0.0',
        baseUrl: 'http://localhost:3000' // Update to Render URL after deployment
    });
});

// Mock sports data
const sportsData = [
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
];

// /sports endpoint
app.get('/sports', (req, res) => {
    try {
        const count = parseInt(req.query.count) || sportsData.length;
        if (isNaN(count) || count < 1) throw new Error('Invalid count');
        const result = sportsData.slice(0, Math.min(count, sportsData.length));
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// /leagues endpoint (mock data)
app.get('/leagues', (req, res) => {
    try {
        const sportFilter = req.query.sport ? req.query.sport.toLowerCase() : null;
        const count = parseInt(req.query.count) || Infinity;
        if (isNaN(count) || count < 1) throw new Error('Invalid count');
        const mockLeagues = [
            { name: 'NFL', sport: 'football', teams: 32 },
            { name: 'NCAA FBS', sport: 'football', teams: 133 },
            { name: 'NBA', sport: 'basketball', teams: 30 },
            { name: 'WNBA', sport: 'basketball', teams: 12 },
            { name: 'MLB', sport: 'baseball', teams: 30 },
            { name: 'Premier League', sport: 'soccer', teams: 20 },
            { name: 'ATP Tour', sport: 'tennis', players: 128 }
        ];
        const filteredLeagues = sportFilter
            ? mockLeagues.filter(l => l.sport === sportFilter)
            : mockLeagues;
        const result = filteredLeagues.slice(0, Math.min(count, filteredLeagues.length));
        res.json(result);
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
            { id: 'f3', sport: 'baseball', home: 'Yankees', away: 'Red Sox', date: '2025-03-03T19:00:00Z', status: 'upcoming' },
            { id: 'f4', sport: 'soccer', home: 'Man City', away: 'Liverpool', date: '2025-03-04T15:00:00Z', status: 'upcoming' },
            { id: 'f5', sport: 'tennis', home: 'Djokovic', away: 'Nadal', date: '2025-03-05T14:00:00Z', status: 'upcoming' }
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

// Start the server
app.listen(port, () => {
    console.log(`API running at http://localhost:${port}`);
});