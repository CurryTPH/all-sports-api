const { MongoClient } = require('mongodb');

async function seedData() {
  const uri = 'mongodb+srv://allsportsuser:mypassword123@allsports-cluster.alpmi.mongodb.net/';
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('allsports');
    await db.collection('fixtures').insertMany([
      { id: 'nfl2025wk1', sport: 'football', home: 'Kansas City Chiefs', away: 'Baltimore Ravens', date: '2025-09-05T20:20:00Z', status: 'upcoming' },
      { id: 'nba2025opener', sport: 'basketball', home: 'Boston Celtics', away: 'Miami Heat', date: '2025-10-22T19:30:00Z', status: 'upcoming' }
    ]);
    console.log('Seeded real fixtures');
  } catch (e) {
    console.error('Seed failed:', e);
  } finally {
    await client.close();
  }
}
seedData();