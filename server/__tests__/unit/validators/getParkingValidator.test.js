// __tests__/unit/validators/getParkingValidator.test.js
const { getParkingValidator } = require('/Calidad/SmartParking/Smart-Parking-Web-App-main/server/validators/joi-validator');

describe('getParkingValidator', () => {
  it('debería rechazar si falta latitud o longitud', () => {
    const { error } = getParkingValidator.validate({
      startTime: '2025-10-10T10:00:00Z',
      endTime: '2025-10-10T12:00:00Z',
      vehicleType: 'car',
      currTime: '2025-10-10T09:45:00Z'
    });
    expect(error).toBeTruthy();
    expect(error.details[0].message).toBe('"lat" is required');

    const { error: errorLng } = getParkingValidator.validate({
      lat: '40.712776',
      startTime: '2025-10-10T10:00:00Z',
      endTime: '2025-10-10T12:00:00Z',
      vehicleType: 'car',
      currTime: '2025-10-10T09:45:00Z'
    });
    expect(errorLng).toBeTruthy();
    expect(errorLng.details[0].message).toBe('"lng" is required');
  });

  it('debería rechazar si falta startTime o endTime', () => {
    const { error } = getParkingValidator.validate({
      lat: '40.712776',
      lng: '-74.005974',
      vehicleType: 'car',
      currTime: '2025-10-10T09:45:00Z'
    });
    expect(error).toBeTruthy();
    expect(error.details[0].message).toBe('"startTime" is required');
  });

  it('debería rechazar si el vehicleType no es válido', () => {
    const { error } = getParkingValidator.validate({
      lat: '40.712776',
      lng: '-74.005974',
      startTime: '2025-10-10T10:00:00Z',
      endTime: '2025-10-10T12:00:00Z',
      vehicleType: 'bus',  // Valor inválido
      currTime: '2025-10-10T09:45:00Z'
    });
    expect(error).toBeTruthy();
    expect(error.details[0].message).toBe('"vehicleType" must be one of [car, bike]');
  });

  it('debería aceptar un payload válido', () => {
    const { error } = getParkingValidator.validate({
      lat: '40.712776',
      lng: '-74.005974',
      startTime: '2025-10-10T10:00:00Z',
      endTime: '2025-10-10T12:00:00Z',
      vehicleType: 'car',
      currTime: '2025-10-10T09:45:00Z'
    });
    expect(error).toBeFalsy(); // No debería haber error
  });
});
