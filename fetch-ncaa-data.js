const { MongoClient } = require('mongodb');
const axios = require('axios');

async function fetchNCAAData() {
  const uri = 'mongodb+srv://allsportsuser:mypassword123@allsports-cluster.alpmi.mongodb.net/'; // Your actual password
  const apiKey = '23pW9oZzIZIVYgM4BuOKNqig5PjuSb4RDldB6D4Bb4R7lLMetCDx3LjjV+h7jT8J'; // Your verified key
  const client = new MongoClient(uri);

  try {
    console.log('Connecting to MongoDB...');
    await client.connect();
    console.log('Connected to MongoDB');
    const db = client.db('allsports');
    const fixtures = db.collection('fixtures');

    console.log('Fetching NCAA data...');
    const response = await axios.get('https://api.collegefootballdata.com/games?year=2023&seasonType=regular', {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    const ncaaGames = response.data;
    console.log(`Fetched ${ncaaGames.length} games`);

    const formattedGames = ncaaGames.map(game => ({
      id: `ncaa-${game.id}`,
      sport: 'football',
      home: game.home_team,
      away: game.away_team,
      date: new Date(game.start_date).toISOString(),
      status: game.completed ? 'completed' : 'upcoming',
      result: game.home_points && game.away_points ? `${game.home_points}-${game.away_points}` : 'TBD'
    }));

    console.log('Importing games to MongoDB...');
    let importedCount = 0;
    for (const game of formattedGames) {
      await fixtures.updateOne(
        { id: game.id },
        { $set: game },
        { upsert: true }
      );
      importedCount++;
      if (importedCount % 100 === 0) console.log(`Imported ${importedCount} games so far...`);
    }

    console.log(`Imported/Updated ${formattedGames.length} NCAA games`);
  } catch (error) {
    console.error('Fetch or import failed:', error.message);
  } finally {
    await client.close();
    console.log('MongoDB connection closed');
  }
}

fetchNCAAData();
setInterval(fetchNCAAData, 24 * 60 * 60 * 1000);