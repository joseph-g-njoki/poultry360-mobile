const SQLite = require('expo-sqlite');

async function checkRecord() {
  const db = await SQLite.openDatabaseAsync('poultry360.db');
  
  console.log('Checking mortality record 4...');
  const record = await db.getFirstAsync('SELECT * FROM mortality_records WHERE id = 4');
  
  console.log('Record 4 data:');
  console.log(JSON.stringify(record, null, 2));
  
  await db.closeAsync();
}

checkRecord().catch(console.error);
