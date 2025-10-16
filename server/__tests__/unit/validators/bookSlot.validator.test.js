// __tests__/unit/validators/bookSlotValidator.test.js
const { bookSlotValidator } = require('/Calidad/SmartParking/Smart-Parking-Web-App-main/server/validators/joi-validator'); // Asegúrate de que la ruta sea correcta

describe('bookSlotValidator', () => {
  it('debería rechazar si falta slotId', () => {
    const { error } = bookSlotValidator.validate({
      lotId: 'lot_123',
      startTime: '2025-10-10T10:00:00Z',
      endTime: '2025-10-10T12:00:00Z',
      vehicleType: 'car',
      vehicleNo: 'AB12CD3456',
      carImg: 'http://example.com/image.jpg',
      cancellable: true,
      charges: 20,
      currTime: '2025-10-10T09:45:00Z',
      type: 'reservation'
    });

    expect(error).toBeTruthy();
    expect(error.details[0].message).toBe('"slotId" is required');
  });

  it('debería aceptar un payload válido', () => {
    const { error } = bookSlotValidator.validate({
      slotId: 'slot_123',
      lotId: 'lot_123',
      startTime: '2025-10-10T10:00:00Z',
      endTime: '2025-10-10T12:00:00Z',
      vehicleType: 'car',
      vehicleNo: 'AB12CD3456',
      carImg: 'http://example.com/image.jpg',
      cancellable: true,
      charges: 20,
      currTime: '2025-10-10T09:45:00Z',
      type: 'reservation'
    });

    expect(error).toBeFalsy(); // No debería haber error
  });
});