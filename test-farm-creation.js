/**
 * Test script to verify farm creation works with fixed database initialization
 * Run this with: node test-farm-creation.js
 */

// Simulate the farm creation flow
async function testFarmCreation() {
  console.log('🧪 Testing Farm Creation Flow...\n');

  try {
    // Step 1: Import fastDatabase
    console.log('Step 1: Importing fastDatabase...');
    const fastDatabase = require('./src/services/fastDatabase').default;
    console.log('✅ fastDatabase imported successfully\n');

    // Step 2: Initialize database
    console.log('Step 2: Initializing database...');
    const initResult = fastDatabase.init();
    if (!initResult || !fastDatabase.db) {
      throw new Error('Database initialization failed');
    }
    console.log('✅ Database initialized successfully');
    console.log(`   - isReady: ${fastDatabase.isReady}`);
    console.log(`   - db connection: ${fastDatabase.db ? 'Valid' : 'NULL'}\n`);

    // Step 3: Create a test farm
    console.log('Step 3: Creating test farm...');
    const testFarmData = {
      name: 'Farm C',
      location: 'South',
      farmType: 'broiler',
      description: 'Test farm created by automated test'
    };

    console.log('   Farm data:', JSON.stringify(testFarmData, null, 2));

    const result = fastDatabase.createFarm(testFarmData);
    console.log('✅ Farm created successfully!');
    console.log(`   - Farm ID: ${result.id}`);
    console.log(`   - Farm Name: ${result.name}`);
    console.log(`   - Location: ${result.location}\n`);

    // Step 4: Verify farm was saved
    console.log('Step 4: Verifying farm was saved to database...');
    const savedFarm = fastDatabase.getFarmById(result.id);
    if (!savedFarm) {
      throw new Error('Farm not found in database after creation');
    }
    console.log('✅ Farm verified in database');
    console.log(`   - Database farm_name: ${savedFarm.farm_name}`);
    console.log(`   - Database location: ${savedFarm.location}`);
    console.log(`   - Database farm_type: ${savedFarm.farm_type}\n`);

    // Step 5: List all farms
    console.log('Step 5: Listing all farms...');
    const allFarms = fastDatabase.getFarms();
    console.log(`✅ Found ${allFarms.length} farm(s) in database:`);
    allFarms.forEach((farm, index) => {
      console.log(`   ${index + 1}. ${farm.farm_name} (${farm.location}) - Type: ${farm.farm_type}`);
    });

    console.log('\n🎉 All tests passed! Farm creation is working correctly.');
    return true;

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Error stack:', error.stack);
    return false;
  }
}

// Run the test
testFarmCreation().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
