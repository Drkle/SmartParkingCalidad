// server/server.js
require('dotenv').config();
const app = require('./app');
const { connectDB } = require('./db');   // ver Paso 2
const PORT = process.env.PORT || 5000;

(async () => {
  try {
    await connectDB(process.env.MONGO_URI);
    app.listen(PORT, () => console.log(`Server Running ${PORT}`));
  } catch (err) {
    console.error('DB connection failed', err);
    process.exit(1);
  }
})();
