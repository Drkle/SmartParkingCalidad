// __tests__/unit/validators/postParkingValidator.test.js
const { postParkingValidator } = require('/Calidad/SmartParking/Smart-Parking-Web-App-main/server/validators/joi-validator');

describe('postParkingValidator', () => {
  it('debería rechazar si falta el campo parkName', () => {
    const { error } = postParkingValidator.validate({
      noOfCarSlots: 10,
      noOfBikeSlots: 5,
      address: '123 Main St',
      parkingChargesCar: 20,
      parkingChargesBike: 10,
      lat: '40.712776',
      lng: '-74.005974',
      openTime: '08:00',
      closeTime: '22:00',
      imgFiles: ['image1.jpg'],
      currTimeStamp: 1617901234567,
      ownerName: 'Juan Pérez',
      emailID: 'juan@example.com',
      mobileNo: '1234567890',
      type: 'public'
    });
    expect(error).toBeTruthy();
    expect(error.details[0].message).toBe('"parkName" is required');
  });

  it('debería rechazar si noOfCarSlots no es un número', () => {
    const { error } = postParkingValidator.validate({
      parkName: 'Park ABC',
      noOfCarSlots: 'ten',  // Valor inválido
      noOfBikeSlots: 5,
      address: '123 Main St',
      parkingChargesCar: 20,
      parkingChargesBike: 10,
      lat: '40.712776',
      lng: '-74.005974',
      openTime: '08:00',
      closeTime: '22:00',
      imgFiles: ['image1.jpg'],
      currTimeStamp: 1617901234567,
      ownerName: 'Juan Pérez',
      emailID: 'juan@example.com',
      mobileNo: '1234567890',
      type: 'public'
    });
    expect(error).toBeTruthy();
    expect(error.details[0].message).toBe('"noOfCarSlots" must be a number');
  });

  it('debería aceptar un payload válido', () => {
    const { error } = postParkingValidator.validate({
      parkName: 'Park ABC',
      noOfCarSlots: 10,
      noOfBikeSlots: 5,
      address: '123 Main St',
      parkingChargesCar: 20,
      parkingChargesBike: 10,
      lat: '40.712776',
      lng: '-74.005974',
      openTime: '2025-10-10T08:00:00Z', // Corregido: Fecha válida en formato ISO
      closeTime: '2025-10-10T22:00:00Z', // Fecha válida en formato ISO
      imgFiles: ['image1.jpg'],
      currTimeStamp: 1617901234567,
      ownerName: 'Juan Pérez',
      emailID: 'juan@example.com',
      mobileNo: '1234567890',
      type: 'public'
    });
    expect(error).toBeFalsy(); // No debería haber error
  });
});