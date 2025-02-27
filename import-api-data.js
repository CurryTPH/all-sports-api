const { MongoClient } = require('mongodb');
const fs = require('fs');

async function importAPIData() {
  const uri = 'mongodb+srv://allsportsuser:mypassword123@allsports-cluster.alpmi.mongodb.net/';
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('allsports');
    const fixtures = db.collection('fixtures');
    await fixtures.deleteMany({});
    const ncaaData = JSON.parse(fs.readFileSync('ncaa-2023-games.json', 'utf8'));
    const formattedData = ncaaData.map(game => ({
      id: `ncaa-${game.id}`,
      sport: 'football',
      home: game.home_team,
      away: game.away_team,
      date: new Date(game.start_date).toISOString(),
      status: game.completed ? 'completed' : 'upcoming',
      result: game.home_points && game.away_points ? `${game.home_points}-${game.away_points}` : 'TBD'
    }));
    await fixtures.insertMany(formattedData);
    console.log('Imported NCAA data');
    await client.close();
  } catch (e) {
    console.error('Import failed:', e);
  }
}
importAPIData();