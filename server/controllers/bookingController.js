const mongoose = require('mongoose');
const BookedTimeSlot = require('../models/BookedTimeSlot');
const { bookSlotValidator } = require('../validators/joi-validator');

exports.createBooking = async (req, res) => {
  // Validamos los datos de la solicitud usando el validador `bookSlotValidator`
  const { error } = bookSlotValidator.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    // Extraemos los datos de la solicitud (req.body)
    const {
      slotId, lotId, startTime, endTime,
      vehicleType, vehicleNo, carImg, cancellable
    } = req.body;

    // Creamos una nueva reserva con los datos validados
    const doc = new BookedTimeSlot({
      parkingSlot: new mongoose.Types.ObjectId(slotId),  // Convertimos slotId a ObjectId
      parkingLot:  new mongoose.Types.ObjectId(lotId),   // Convertimos lotId a ObjectId
      startTime:   new Date(startTime).getTime(),         // Convertimos startTime a timestamp
      endTime:     new Date(endTime).getTime(),           // Convertimos endTime a timestamp
      vehicleType,
      vehicleNo,
      carImage: carImg,
      cancellable: Boolean(cancellable),
      // Los demás campos del schema quedan con defaults si no son proporcionados
    });

    // Guardamos la nueva reserva en la base de datos
    const saved = await doc.save();
    return res.status(201).json({ message: 'Reserva creada correctamente', booking: saved });
  } catch (err) {
    return res.status(500).json({ message: 'Error al crear la reserva', error: err.message });
  }
};
