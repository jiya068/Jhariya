const mongoose = require('mongoose');

let mongoServer = null;

const connectDB = async () => {
  try {
    let uri = process.env.MONGODB_URI;

    // Check if configuration points to a local instance
    if (uri && (uri.includes('127.0.0.1') || uri.includes('localhost'))) {
      try {
        // Test connection with a short timeout
        const conn = await mongoose.connect(uri, { serverSelectionTimeoutMS: 2000 });
        console.log(`MongoDB Connected (Local Service): ${conn.connection.host}`);
        return;
      } catch (err) {
        console.log('Local MongoDB service is not running on port 27017.');
        console.log('Starting an In-Memory MongoDB Server for sandbox testing...');
        
        const { MongoMemoryServer } = require('mongodb-memory-server');
        mongoServer = await MongoMemoryServer.create();
        uri = mongoServer.getUri();
      }
    }

    const conn = await mongoose.connect(uri);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

// Graceful cleanup of memory server on exit
process.on('SIGINT', async () => {
  try {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
      console.log('In-Memory MongoDB Server stopped successfully.');
    }
  } catch (err) {
    console.error('Error during database cleanup:', err.message);
  }
  process.exit(0);
});

module.exports = connectDB;
