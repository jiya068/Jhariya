const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

let mongoServer = null;

const connectDB = async () => {
  try {
    let uri = process.env.MONGODB_URI;

    // Check if configuration targets localhost loopback
    if (uri && (uri.includes('127.0.0.1') || uri.includes('localhost'))) {
      try {
        const conn = await mongoose.connect(uri, { serverSelectionTimeoutMS: 2000 });
        console.log(`MongoDB Connected (Local Service): ${conn.connection.host}`);
        return;
      } catch (err) {
        console.log('Local MongoDB service is offline on port 27017.');
        try {
          const { MongoMemoryServer } = require('mongodb-memory-server');
          const dbPath = path.join(__dirname, '../data/mongo_db');
          if (!fs.existsSync(dbPath)) {
            fs.mkdirSync(dbPath, { recursive: true });
          }

          mongoServer = await MongoMemoryServer.create({
            instance: {
              dbPath: dbPath,
              storageEngine: 'wiredTiger'
            }
          });
          uri = mongoServer.getUri();
        } catch (memErr) {
          console.error('MongoMemoryServer initialization failed:', memErr.message);
          console.log('Continuing server startup without database persistence...');
          return;
        }
      }
    }

    const conn = await mongoose.connect(uri);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
  }
};

// Graceful cleanup
process.on('SIGINT', async () => {
  try {
    const { saveProductsToFile, saveUsersToFile, saveSettingsToFile } = require('../services/persistenceService');
    await saveProductsToFile();
    await saveUsersToFile();
    await saveSettingsToFile();
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
      console.log('MongoDB Server closed cleanly.');
    }
  } catch (err) {
    console.error('Error during exit cleanup:', err.message);
  }
  process.exit(0);
});

module.exports = connectDB;
