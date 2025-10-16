const { instance } = require('../Utils/razorPayInstance');
const crypto = require('crypto');
const { bookSlotValidator } = require('../validators/joi-validator');
const User = require('../models/User');
const dayjs = require('dayjs');
const BookedTimeSlot = require('../models/BookedTimeSlot');
const mongoose = require('mongoose');
const Payment = require('../models/Payment');
const ParkingLot = require('../models/ParkingLot');
const sendEmail2 = require('../Utils/sendEmail2');

/* Create the order of payment for booking a slot */
exports.checkoutBookSlot = async (req, res) => {
  const { error } = bookSlotValidator.validate(req.body);

  if (error) {
    // Verificamos que error.details exista antes de acceder a él
    if (error.details && error.details.length > 0) {
      const errorPath = error.details[0].path[0];
      const errorType = error.details[0].type;
      
      // Verificar si el error es relacionado con el vehículo
      if (errorPath === 'vehicleNo' && errorType === "string.pattern.base") {
        return res.status(400).json({ msg: "Please enter a valid Vehicle Number" });
      }
    }
    return res.status(400).json({ msg: "Validation error" });
  }

  try {
    const { lotId, slotId, startTime, endTime, vehicleType, carImg, vehicleNo, cancellable, charges, type, currTime } = req.body;

    // Cálculo del monto
    let amount = charges * 100; // Default calculation for car
    if (vehicleType === 'bike') {
      amount = charges * 75; // Ajustamos el monto para bike
    }

    // Get the user profile pic
    const user = await User.findById(req.userId, { profilePic: 1 });

    // If no profilePic, it is not allowed to book slot
    if (!user.profilePic) {
      return res.status(400).json({ msg: "Please Upload a profile photo first for verification" });
    }

    // Get timestamp
    const storebookingStart = new Date(startTime).getTime();
    const storebookingEnd = new Date(endTime).getTime();
    const currTimeStamp = new Date(currTime).getTime();

    // Get active bookings by the user for the vehicleType
    const futureBookedParkingSlots = await BookedTimeSlot.find({
      endTime: { $gte: currTimeStamp },
      vehicleType: vehicleType,
      booker: req.userId,
      cancelled: false,
      paid: true
    });

    // If any active bookings found
    // Dentro de controllers/payments.js
    if (futureBookedParkingSlots.length > 0) {
        return res.status(400).json({ msg: "You have already booked a slot for this vehicle" });

    }


    // Get all active booked slots for this vehicleNo
    const vehicleBookedSlots = await BookedTimeSlot.find({
      vehicleNo: vehicleNo,
      cancelled: false,
      paid: true,
      vehicleType: vehicleType,
      endTime: { $gte: currTimeStamp }
    });

    // If this vehicleNo has an active slot, booking is not allowed
    if (vehicleBookedSlots.length > 0) {
      return res.status(400).json({ msg: `This vehicle Number ${vehicleNo} already has an active slot booked` });
    }

    // For private bookings, create a payment order
    if (type === "private") {
      const options = {
        amount: amount * 100, // Amount in smallest currency unit
        currency: "INR",
        receipt: "order_receip_11"
      };

      const order = await instance.orders.create(options);

      // Save the booked slot in DB
      const bookedSlot = await BookedTimeSlot.create({
        startTime: storebookingStart,
        endTime: storebookingEnd,
        parkingSlot: mongoose.Types.ObjectId(slotId),
        parkingLot: mongoose.Types.ObjectId(lotId),
        booker: req.userId,
        vehicleType: vehicleType,
        carImage: carImg,
        vehicleNo: vehicleNo,
        cancellable: cancellable,
        orderID: order.id,
        paid: false
      });

      return res.status(200).json({ msg: "Payment order created", order });
    } else {
      const bookedSlot = await BookedTimeSlot.create({
        startTime: storebookingStart,
        endTime: storebookingEnd,
        parkingSlot: mongoose.Types.ObjectId(slotId),
        parkingLot: mongoose.Types.ObjectId(lotId),
        booker: req.userId,
        vehicleType: vehicleType,
        carImage: carImg,
        vehicleNo: vehicleNo,
        cancellable: cancellable,
        paid: true
      });
      return res.status(200).json({ msg: "Slot Booking Successful" });
    }

  } catch (err) {
    console.error(err);
    return res.status(500).json({ msg: "Something went wrong" });
  }
};


/* Verify the payment done by the user for the order created */
exports.bookPaymentVerification = async (req, res) => {
  console.log(req.body);
  const { charges } = req.query;
  try {
    // Get the orderID, paymentID and sign
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const body = razorpay_order_id + "|" + razorpay_payment_id;

    // Check if after the hashing of orderID|paymentID with key as secret
    // The sign we get is the same as the sign we have
    const expectedSign = crypto.createHmac('sha256', process.env.RAZORPAY_API_SECRET)
      .update(body.toString())
      .digest('hex');

    console.log('sign received', razorpay_signature);
    console.log('sign generated', expectedSign);

    // If both signs are same, the payment done by the user is valid
    if (expectedSign === razorpay_signature) {
      // Fetch the details of payment using Razorpay API
      const paymentDetails = await instance.payments.fetch(razorpay_payment_id);
      console.log("got payment details");

      // Update the bookedSlot with orderID as this with paid as true and also save the paymentDetails
      const bookedTimeSlot = await BookedTimeSlot.findOneAndUpdate({ orderID: razorpay_order_id }, { paid: true, paymentDetails: paymentDetails }, { new: true });
      
      console.log("got booked time slot");
      // Save the payment details in the payment model
      await Payment.create({ orderID: razorpay_order_id, paymentID: razorpay_payment_id, sign: razorpay_signature });
      
      const parkingLot = await ParkingLot.findById(bookedTimeSlot.parkingLot, { lotImages: 0 });
      console.log("got lot");

      if (parkingLot.type === "private") {
        const subject = '[Smart Parker] New Booking At Parking Lot';
        const html = `
          Dear ${parkingLot.ownerName},
          New Booking At Your Parking Lot ${parkingLot.name}, for a ${bookedTimeSlot.vehicleType} with number ${bookedTimeSlot.vehicleNo} between ${dayjs(bookedTimeSlot.startTime).format('DD MMM hh:00 A')} and ${dayjs(bookedTimeSlot.endTime).format('DD MMM hh:00 A')}. 
          You have paid the charges for this parking you booked ${charges}.
          From,
          Smart Parking Team`;
        const receiverMail = parkingLot.ownerEmail;
        await sendEmail2({ html, subject, receiverMail });
      }
      
      // Redirect user to paymentSuccess page
      res.redirect(`${process.env.REACT_APP_URL || "http://localhost:3000"}/paymentSuccess?type=book`);
      return;
    }

    // If both signs are not the same, the payment done by user is invalid
    res.redirect(`${process.env.REACT_APP_URL || "http://localhost:3000"}/paymentFailure?type=book`);
  } catch (err) {
    return res.status(500).json({ msg: "Something went wrong" });
  }
};

/* Send the Razorpay key to frontend */
exports.getRazorPayKey = async (req, res) => {
  try {
    return res.status(200).json({ key: process.env.RAZORPAY_API_KEY });
  } catch (err) {
    return res.status(500).json({ msg: "Something went wrong" });
  }
};

/* Refund creation */
exports.checkoutRefund = async (req, res) => {
  try {
    console.log(req.body);
    const options = {
      amount: req.body.amount * 100, // Amount in smallest currency unit
      currency: "INR",
      receipt: "order_receip_11"
    };
    const order = await instance.orders.create(options);
    console.log(order, "123");
    return res.status(200).json({ msg: "Refund order created", order });
  } catch (err) {
    return res.status(500).json({ msg: "Something went wrong" });
  }
};

/* Verify refund payment */
exports.refundPaymentVerification = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const body = razorpay_order_id + "|" + razorpay_payment_id;

    // Calculamos la firma esperada usando Razorpay API secret
    const expectedSign = crypto.createHmac('sha256', process.env.RAZORPAY_API_SECRET)
      .update(body.toString())
      .digest('hex');

    // Comprobamos si la firma que recibimos es la misma que la generada
    if (expectedSign !== razorpay_signature) {
      // Si las firmas no coinciden, respondemos con un error 400
      return res.status(400).json({ msg: "signature mismatch" });
    }

    // Si la firma es válida, obtenemos los detalles del pago
    const paymentDetails = await instance.payments.fetch(razorpay_payment_id);

    // Actualizamos el tiempo reservado con el estado de reembolso y los detalles del pago
    const bookedTimeSlot = await BookedTimeSlot.findByIdAndUpdate(req.query.slotID, { refunded: true, refundDetails: paymentDetails }, { new: true });

    // Guardamos los detalles del pago en el modelo Payment
    await Payment.create({ orderID: razorpay_order_id, paymentID: razorpay_payment_id, sign: razorpay_signature, type: "refund" });

    // Enviamos un correo al usuario para informarle sobre el reembolso
    const parkingLot = await ParkingLot.findById(bookedTimeSlot.parkingLot, { ownerName: 1, name: 1 });
    const subject = '[Smart Parker] Your Refund For Booking Cancellation';
    const html = `
      Dear ${req.query.userName},
      Refund for Your Booking Cancellation, at Parking Lot ${parkingLot.name}, for a ${bookedTimeSlot.vehicleType} with number ${bookedTimeSlot.vehicleNo} between ${dayjs(bookedTimeSlot.startTime).format('DD MMM hh:00 A')} and ${dayjs(bookedTimeSlot.endTime).format('DD MMM hh:00 A')}. 
      The charges for this parking you booked ${req.query.charges}, ${bookedTimeSlot.adminCancelled ? `100% is refunded` : `70% i.e.${(req.query.charges * 0.7).toFixed(2)} is refunded`} to your account
      From,
      Smart Parking Team
    `;
    const receiverMail = req.query.emailID;
    await sendEmail2({ subject, html, receiverMail });

    // Redirigimos al usuario a la página de éxito del reembolso
    res.redirect(`${process.env.REACT_APP_URL || "http://localhost:3000"}/paymentSuccess?type=refund`);
    return;

  } catch (err) {
    console.error(err);
    return res.status(500).json({ msg: "Something went wrong" });
  }
};

