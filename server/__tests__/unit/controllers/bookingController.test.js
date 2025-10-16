// __tests__/unit/controllers/bookingController.test.js
const httpMocks = require('node-mocks-http');

// 🔧 Mocks locales
const mockSave = jest.fn();
// 👇 IMPORTANTE: el nombre empieza por "mock" para que Jest lo permita en la factory
const mockBookedTimeSlot = jest.fn(() => ({ save: mockSave }));

// Sustituimos el modelo real por el mock
jest.mock('../../../models/BookedTimeSlot', () => mockBookedTimeSlot);

// Usamos el controlador real
const { createBooking } = require('../../../controllers/bookingController');

describe('controllers/bookingController.createBooking', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const validBody = {
    slotId: '65f0f0f0f0f0f0f0f0f0f0f0',
    lotId: '65f0f0f0f0f0f0f0f0f0f0f1',
    startTime: '2025-10-10T10:00:00Z',
    endTime: '2025-10-10T12:00:00Z',
    vehicleType: 'car',
    vehicleNo: 'AB12CD3456',
    carImg: 'http://example.com/car.jpg',
    cancellable: true,
    charges: 20,
    currTime: '2025-10-10T09:45:00Z',
    type: 'reservation'
  };

  it('✅ responde 201 y guarda la reserva con campos mapeados', async () => {
    const fakeSaved = { _id: 'doc1', vehicleType: 'car', startTime: 1, endTime: 2 };
    mockSave.mockResolvedValueOnce(fakeSaved);

    const req = httpMocks.createRequest({ method: 'POST', body: validBody });
    const res = httpMocks.createResponse();

    await createBooking(req, res);

    expect(res.statusCode).toBe(201);
    const data = res._getJSONData();
    expect(data.message).toBe('Reserva creada correctamente');
    expect(data.booking).toEqual(fakeSaved);

    expect(mockBookedTimeSlot).toHaveBeenCalledTimes(1);
    const arg = mockBookedTimeSlot.mock.calls[0][0];

    expect(arg).toHaveProperty('vehicleType', 'car');
    expect(arg).toHaveProperty('carImage', validBody.carImg);
    expect(arg).toHaveProperty('cancellable', true);
    expect(typeof arg.startTime).toBe('number');
    expect(typeof arg.endTime).toBe('number');
    expect(arg).toHaveProperty('parkingSlot');
    expect(arg).toHaveProperty('parkingLot');
  });

  it('❌ responde 400 cuando falta lotId', async () => {
    const badBody = { ...validBody };
    delete badBody.lotId;

    const req = httpMocks.createRequest({ method: 'POST', body: badBody });
    const res = httpMocks.createResponse();

    await createBooking(req, res);

    expect(res.statusCode).toBe(400);
    expect(mockBookedTimeSlot).not.toHaveBeenCalled();

    const { message } = res._getJSONData();
    expect(message).toMatch(/"lotId" is required/);
  });

  it('💥 responde 500 si save() lanza error', async () => {
    mockSave.mockRejectedValueOnce(new Error('DB down'));

    const req = httpMocks.createRequest({ method: 'POST', body: validBody });
    const res = httpMocks.createResponse();

    await createBooking(req, res);

    expect(res.statusCode).toBe(500);
    const { message, error } = res._getJSONData();
    expect(message).toMatch(/Error al crear la reserva/);
    expect(error).toMatch(/DB down/);
  });
});
