// server/app.js
require('dotenv').config();              // <--- carga variables de entorno

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const app = express();

// Middlewares
app.use(express.json());
app.use(cors());
app.use(helmet());

// Rutas (ajusta si los nombres difieren)
app.use('/api/v1', require('./routes/bookingRoutes'));
app.use('/api/v1', require('./routes/users'));
app.use('/api/v1', require('./routes/payments'));
app.use('/api/v1', require('./routes/parkinglots'));
app.use('/api/v1', require('./routes/admin'));
app.use('/api/v1', require('./routes/news'));

// (Opcional) cosas que no quieres en tests
if (process.env.NODE_ENV !== 'test') {
  // inicializaciones opcionales
}

module.exports = app; // exporta la app (sin listen)
