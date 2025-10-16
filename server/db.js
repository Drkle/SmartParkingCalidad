// server/db.js
const mongoose = require('mongoose');
mongoose.set('strictQuery', false); // quita el warning de Mongoose 7

async function connectDB(uri) {
  await mongoose.connect(uri);
  console.log(`MongoDB connected ${mongoose.connection.host}`);
}

async function disconnectDB() {
  await mongoose.disconnect();
}

module.exports = { connectDB, disconnectDB };
