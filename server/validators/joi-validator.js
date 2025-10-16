const joi = require('joi')


/* All of these are validators to validate if incoming request has all the parameters inside body which
are required to process request*/


const sendOTPValidator = joi.object({
  firstName: joi.string().min(2).max(30).required(),
  lastName: joi.string().min(2).max(40).required(),
  userName: joi.string().min(5).max(30).required(),
  mobileNo: joi.string().length(10).pattern(/^[0-9]+$/).required(),
  email: joi.string().required().email(),
  password: joi.string().min(6).required(),
  confirmPassword: joi.string().min(6).required(),
  otp: joi.string().optional(),
  selectedImg: joi.string().optional(),
  currTimeStamp: joi.number().required()
})

const loginValidator = joi.object({
  email: joi.string().required().email(),
  password: joi.string().min(6).required()
})

const verifyEmailValidator = joi.object({
    email:joi.string().required().email(),
    otp:joi.string().optional()
})

const postParkingValidator = joi.object({
  parkName: joi.string().required(),
  noOfCarSlots: joi.number().required(),
  noOfBikeSlots: joi.number().required(),
  address: joi.string().required(),
  parkingChargesCar: joi.number().required(),
  parkingChargesBike: joi.number().required(),
  lat: joi.string().required(),
  lng: joi.string().required(),
  openTime: joi.date().required(),  // Debería ser joi.date() para aceptar fechas válidas
  closeTime: joi.date().required(), // Debería ser joi.date() para aceptar fechas válidas
  imgFiles: joi.array().required(),
  currTimeStamp: joi.number().required(),
  ownerName: joi.string().required(),
  emailID: joi.string().required().email(),
  mobileNo: joi.string().required(),
  type: joi.string().required()
})

const getParkingValidator = joi.object({
  lat: joi.string().required(),
  lng: joi.string().required(),
  startTime: joi.date().required(),  // Cambiado a joi.date()
  endTime: joi.date().greater(joi.ref('startTime')).required(),  // Cambiado a joi.date()
  vehicleType: joi.string().valid('car', 'bike').required(),
  currTime: joi.date().required()   // Cambiado a joi.date()
})

const bookSlotValidator = joi.object({
  slotId: joi.string().required(),
  lotId: joi.string().required(),
  startTime: joi.date().required(),  // Cambiado a joi.date()
  endTime: joi.date().greater(joi.ref('startTime')).required(),  // Cambiado a joi.date()
  vehicleType: joi.string().valid('car', 'bike').required(),
  vehicleNo: joi.string().pattern(/[A-Z]{2}[0-9]{2}[A-Z]{2}[0-9]{4}/).required(),
  carImg: joi.string().uri().required(),
  cancellable: joi.boolean().required(),
  charges: joi.number().min(0).required(),
  currTime: joi.date().required(),  // Cambiado a joi.date()
  type: joi.string().valid('reservation', 'pre-reservation').required()
})

const feedbackValidator = joi.object({
  firstName: joi.string().min(2).max(30).required(),
  lastName: joi.string().min(2).max(40).required(),
  country: joi.string().min(2).max(40).required(),
  feedback: joi.string().required()
})

const latLonValidator = joi.object({
    lat:joi.string().required(),
    lng:joi.string().required()
})

const resetMailValidator = joi.object({
    email:joi.string().required().email()
})

const resetPassValidator = joi.object({
    password:joi.string().min(6).required(),
    confirmPassword:joi.string().min(6).required(),
    code:joi.string().required(),
    currTimeStamp:joi.number().required()
})

module.exports = {sendOTPValidator,loginValidator,verifyEmailValidator,postParkingValidator,getParkingValidator,bookSlotValidator,feedbackValidator,latLonValidator,resetMailValidator,resetPassValidator}