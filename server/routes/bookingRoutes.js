const router = require('express').Router();
const { createBooking } = require('../controllers/bookingController');

// Definimos la ruta para crear una reserva (POST /bookSlot)
router.post('/bookSlot', createBooking);

module.exports = router;


