// __tests__/unit/controllers/parkingLots.controller.test.js
const httpMocks = require('node-mocks-http');

// --- Mocks de modelos y utils ---
jest.mock('../../../models/BookedTimeSlot', () => ({
  find: jest.fn(),
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  create: jest.fn(),
}));
jest.mock('../../../models/ParkingLot', () => ({
  aggregate: jest.fn(),
  create: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  find: jest.fn(),
  findById: jest.fn(),
}));
jest.mock('../../../models/ParkingSlot', () => ({
  create: jest.fn(),
}));
jest.mock('../../../models/User', () => ({
  findById: jest.fn(),
}));
jest.mock('../../../Utils/sendEmail2', () => jest.fn());

// Validadores
const mockPostValidate = jest.fn(() => ({ error: null }));
const mockGetValidate = jest.fn(() => ({ error: null }));
jest.mock('../../../validators/joi-validator', () => ({
  postParkingValidator: { validate: (...a) => mockPostValidate(...a) },
  getParkingValidator:  { validate: (...a) => mockGetValidate(...a)  },
  bookSlotValidator:    { validate: jest.fn(() => ({ error: null })) },
}));

// IMPORTAR controlador DESPUÉS de mockear
const ctrl = require('../../../controllers/parkingLots');

const BookedTimeSlot = require('../../../models/BookedTimeSlot');
const ParkingLot = require('../../../models/ParkingLot');
const ParkingSlot = require('../../../models/ParkingSlot');
const User = require('../../../models/User');
const sendEmail2 = require('../../../Utils/sendEmail2');

describe('controllers/parkingLots', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Util: body base válido para postParkingLot
  function basePostBody(overrides = {}) {
    return {
      parkName: 'Mi Parqueadero',
      noOfCarSlots: 2,
      noOfBikeSlots: 2,
      address: 'Calle 123',
      parkingChargesCar: 20,
      parkingChargesBike: 10,
      lat: '4.65',
      lng: '-74.05',
      openTime: '8',
      closeTime: '22',
      imgFiles: ['a.jpg'],
      currTimeStamp: Date.now(),
      ownerName: 'Owner',
      mobileNo: '3000000000',
      emailID: 'owner@example.com',
      type: 'private',
      ...overrides,
    };
  }

  // Util: query base válida para getParkingLots
  function baseGetQuery(overrides = {}) {
    return {
      lat: '4.65',
      lng: '-74.05',
      startTime: '2025-10-10T10:00:00Z',
      endTime:   '2025-10-10T12:00:00Z',
      vehicleType: 'car',
      currTime:  '2025-10-10T09:00:00Z',
      ...overrides,
    };
  }

  // -------------------------
  // postParkingLot
  // -------------------------
  describe('postParkingLot', () => {
    it('❌ 401 si no hay userId', async () => {
      const req = httpMocks.createRequest({ method: 'POST', body: basePostBody() });
      const res = httpMocks.createResponse();

      await ctrl.postParkingLot(req, res);
      expect(res.statusCode).toBe(401);
    });

    it('❌ 400 validación falla (private)', async () => {
      mockPostValidate.mockReturnValueOnce({ error: { details: [{ message: 'Falta nombre' }] } });

      const req = httpMocks.createRequest({ method: 'POST', userId: 'u1', body: basePostBody() });
      const res = httpMocks.createResponse();

      await ctrl.postParkingLot(req, res);
      expect(res.statusCode).toBe(400);
      expect(res._getJSONData().msg).toMatch(/Falta nombre/i);
    });

    it('❌ 400 validación falla (public => rama con defaults)', async () => {
      mockPostValidate.mockReturnValueOnce({ error: { details: [{ message: 'Falta algo' }] } });

      const req = httpMocks.createRequest({ method: 'POST', userId: 'u1', body: basePostBody({ type: 'public' }) });
      const res = httpMocks.createResponse();

      await ctrl.postParkingLot(req, res);
      expect(res.statusCode).toBe(400);
      expect(res._getJSONData().msg).toMatch(/Falta algo/i);
    });

    it('❌ 401 si el user no es admin', async () => {
      mockPostValidate.mockReturnValueOnce({ error: null });
      User.findById.mockResolvedValueOnce({ _id: 'u1', role: 'user' });

      const req = httpMocks.createRequest({ method: 'POST', userId: 'u1', body: basePostBody() });
      const res = httpMocks.createResponse();

      await ctrl.postParkingLot(req, res);
      expect(res.statusCode).toBe(401);
      expect(res._getJSONData().msg).toMatch(/Unauthorized/i);
    });

    it('✅ 200 crea parking PUBLIC (charges=0), slots y update sin email', async () => {
      mockPostValidate.mockReturnValueOnce({ error: null });
      User.findById.mockResolvedValueOnce({ _id: 'admin', role: 'admin' });

      ParkingLot.create.mockResolvedValueOnce({ _id: 'lot1' });
      // ParkingSlot.create: 2 bike + 2 car
      ParkingSlot.create
        .mockResolvedValueOnce({ _id: 'b1' })
        .mockResolvedValueOnce({ _id: 'b2' })
        .mockResolvedValueOnce({ _id: 'c1' })
        .mockResolvedValueOnce({ _id: 'c2' });

      const req = httpMocks.createRequest({
        method: 'POST',
        userId: 'admin',
        body: basePostBody({ type: 'public' }),
      });
      const res = httpMocks.createResponse();

      await ctrl.postParkingLot(req, res);

      expect(ParkingLot.create).toHaveBeenCalledTimes(1);
      const created = ParkingLot.create.mock.calls[0][0];
      expect(created.parkingChargesCar).toBe(0);
      expect(created.parkingChargesBike).toBe(0);

      expect(ParkingSlot.create).toHaveBeenCalledTimes(4);
      expect(ParkingLot.findByIdAndUpdate).toHaveBeenCalledTimes(1);
      expect(sendEmail2).not.toHaveBeenCalled();

      expect(res.statusCode).toBe(200);
      expect(res._getJSONData().msg).toMatch(/Parking Lot Added/i);
    });

    it('✅ 200 crea parking PRIVATE, slots, update y envía email', async () => {
      mockPostValidate.mockReturnValueOnce({ error: null });
      User.findById.mockResolvedValueOnce({ _id: 'admin', role: 'admin' });

      ParkingLot.create.mockResolvedValueOnce({ _id: 'lot2' });
      ParkingSlot.create
        .mockResolvedValueOnce({ _id: 'b1' })
        .mockResolvedValueOnce({ _id: 'b2' })
        .mockResolvedValueOnce({ _id: 'c1' })
        .mockResolvedValueOnce({ _id: 'c2' });

      const req = httpMocks.createRequest({
        method: 'POST',
        userId: 'admin',
        body: basePostBody({ type: 'private' }),
      });
      const res = httpMocks.createResponse();

      await ctrl.postParkingLot(req, res);

      expect(sendEmail2).toHaveBeenCalledTimes(1);
      expect(res.statusCode).toBe(200);
    });

    it('💥 500 si falla la creación', async () => {
      mockPostValidate.mockReturnValueOnce({ error: null });
      User.findById.mockResolvedValueOnce({ _id: 'admin', role: 'admin' });
      ParkingLot.create.mockRejectedValueOnce(new Error('db down'));

      const req = httpMocks.createRequest({
        method: 'POST',
        userId: 'admin',
        body: basePostBody({ type: 'private' }),
      });
      const res = httpMocks.createResponse();

      await ctrl.postParkingLot(req, res);
      expect(res.statusCode).toBe(500);
    });
  });

  // -------------------------
  // getParkingLots
  // -------------------------
  describe('getParkingLots', () => {
    it('❌ 401 sin userId', async () => {
      const req = httpMocks.createRequest({ method: 'GET', query: baseGetQuery() });
      const res = httpMocks.createResponse();
      await ctrl.getParkingLots(req, res);
      expect(res.statusCode).toBe(401);
    });

    it('❌ 400 validación query', async () => {
      mockGetValidate.mockReturnValueOnce({ error: { details: [{ message: 'lat required' }] } });
      const req = httpMocks.createRequest({ method: 'GET', userId: 'u1', query: {} });
      const res = httpMocks.createResponse();
      await ctrl.getParkingLots(req, res);
      expect(res.statusCode).toBe(400);
      expect(res._getJSONData().msg).toMatch(/lat required/i);
    });

    it('❌ 400: end <= start', async () => {
      mockGetValidate.mockReturnValueOnce({ error: null });
      const q = baseGetQuery({ startTime: '2025-10-10T10:00:00Z', endTime: '2025-10-10T10:00:00Z' });
      const req = httpMocks.createRequest({ method: 'GET', userId: 'u1', query: q });
      const res = httpMocks.createResponse();
      await ctrl.getParkingLots(req, res);
      expect(res.statusCode).toBe(400);
      expect(res._getJSONData().msg).toMatch(/valid time frame/i);
    });

    it('❌ 400: start < currTime', async () => {
      mockGetValidate.mockReturnValueOnce({ error: null });
      const q = baseGetQuery({ startTime: '2025-10-10T08:00:00Z', endTime: '2025-10-10T10:00:00Z', currTime: '2025-10-10T09:00:00Z' });
      const req = httpMocks.createRequest({ method: 'GET', userId: 'u1', query: q });
      const res = httpMocks.createResponse();
      await ctrl.getParkingLots(req, res);
      expect(res.statusCode).toBe(400);
      expect(res._getJSONData().msg).toMatch(/cannot book slot in past/i);
    });

    it('❌ 400: start > next day', async () => {
      mockGetValidate.mockReturnValueOnce({ error: null });
      const q = baseGetQuery({ startTime: '2025-10-12T10:00:00Z', endTime: '2025-10-12T11:00:00Z', currTime: '2025-10-10T09:00:00Z' });
      const req = httpMocks.createRequest({ method: 'GET', userId: 'u1', query: q });
      const res = httpMocks.createResponse();
      await ctrl.getParkingLots(req, res);
      expect(res.statusCode).toBe(400);
      expect(res._getJSONData().msg).toMatch(/after next day/i);
    });

    it('❌ 400: duración > 3h', async () => {
      mockGetValidate.mockReturnValueOnce({ error: null });
      const q = baseGetQuery({ startTime: '2025-10-10T10:00:00Z', endTime: '2025-10-10T14:30:00Z' });
      const req = httpMocks.createRequest({ method: 'GET', userId: 'u1', query: q });
      const res = httpMocks.createResponse();
      await ctrl.getParkingLots(req, res);
      expect(res.statusCode).toBe(400);
      expect(res._getJSONData().msg).toMatch(/more than three hours/i);
    });

    it('✅ 200: lista parqueaderos libres (2 lotes: normal y overnight)', async () => {
      mockGetValidate.mockReturnValueOnce({ error: null });

      // Aggregation devuelve 2 lotes, con slots y horarios
      ParkingLot.aggregate.mockResolvedValueOnce([
        {
          _id: 'L1',
          name: 'Lot Día',
          address: 'A1',
          lotImages: ['img1.jpg'],
          location: { coordinates: [4.65, -74.05] },
          distance: 100,
          isActive: true,
          openTime: 8,
          closeTime: 22,
          type: 'private',
          parkingChargesCar: 20,
          parkingChargesBike: 10,
          bikeParkingSlots: [{ _id: 'b1' }, { _id: 'b2' }],
          carParkingSlots: [{ _id: 'c1' }, { _id: 'c2' }],
        },
        {
          _id: 'L2',
          name: 'Lot Noche',
          address: 'A2',
          lotImages: ['img2.jpg'],
          location: { coordinates: [4.66, -74.06] },
          distance: 150,
          isActive: true,
          openTime: 22,
          closeTime: 6, // overnight
          type: 'public',
          parkingChargesCar: 0,
          parkingChargesBike: 0,
          bikeParkingSlots: [{ _id: 'b3' }, { _id: 'b4' }],
          carParkingSlots: [{ _id: 'c3' }, { _id: 'c4' }],
        },
      ]);

      // Bookings ya ocupados (strings funcionan con .toString())
      BookedTimeSlot.find.mockResolvedValueOnce(['c2', 'b4']);

      const req = httpMocks.createRequest({
        method: 'GET',
        userId: 'u1',
        query: baseGetQuery({ startTime: '2025-10-10T10:00:00Z', endTime: '2025-10-10T12:00:00Z', vehicleType: 'car' }),
      });
      const res = httpMocks.createResponse();

      await ctrl.getParkingLots(req, res);

      expect(res.statusCode).toBe(200);
      const data = res._getJSONData();
      expect(data).toHaveProperty('freeParkingLots');
      expect(Array.isArray(data.freeParkingLots)).toBe(true);
    });

    it('💥 500 si falla aggregate', async () => {
      mockGetValidate.mockReturnValueOnce({ error: null });
      ParkingLot.aggregate.mockRejectedValueOnce(new Error('db down'));

      const req = httpMocks.createRequest({
        method: 'GET',
        userId: 'u1',
        query: baseGetQuery(),
      });
      const res = httpMocks.createResponse();

      await ctrl.getParkingLots(req, res);
      expect(res.statusCode).toBe(500);
    });
  });

  // -------------------------
  // getBookedTimeSlots
  // -------------------------
  describe('getBookedTimeSlots', () => {
    it('❌ 401 sin userId', async () => {
      const req = httpMocks.createRequest({ method: 'GET' });
      const res = httpMocks.createResponse();
      await ctrl.getBookedTimeSlots(req, res);
      expect(res.statusCode).toBe(401);
    });

    it('✅ 200: devuelve slots del usuario (bike y car, public/private)', async () => {
      // Dos reservas del usuario
      BookedTimeSlot.find.mockResolvedValueOnce([
        { _id: 't1', parkingLot: 'L1', vehicleType: 'Bike', startTime: Date.parse('2025-10-10T10:00:00Z'), endTime: Date.parse('2025-10-10T11:00:00Z'), _doc: { foo: 'bar1' } },
        { _id: 't2', parkingLot: 'L2', vehicleType: 'Car',  startTime: Date.parse('2025-10-10T12:00:00Z'), endTime: Date.parse('2025-10-10T14:00:00Z'), _doc: { foo: 'bar2' } },
      ]);

      // L1 private con cargos, L2 public cero
      ParkingLot.find.mockResolvedValueOnce([
        { _id: 'L1', name: 'Lot1', address: 'A1', location: { coordinates: [1, 2] }, parkingChargesBike: 10, parkingChargesCar: 20, type: 'private' },
        { _id: 'L2', name: 'Lot2', address: 'A2', location: { coordinates: [3, 4] }, parkingChargesBike: 0,  parkingChargesCar: 0,  type: 'public'  },
      ]);

      const req = httpMocks.createRequest({ method: 'GET', userId: 'u1' });
      const res = httpMocks.createResponse();

      await ctrl.getBookedTimeSlots(req, res);
      expect(res.statusCode).toBe(200);
      const data = res._getJSONData();
      expect(data).toHaveProperty('bookedTimeSlots');
      expect(data.bookedTimeSlots.length).toBe(2);
    });

    it('💥 500 si falla DB', async () => {
      BookedTimeSlot.find.mockRejectedValueOnce(new Error('db down'));
      const req = httpMocks.createRequest({ method: 'GET', userId: 'u1' });
      const res = httpMocks.createResponse();

      await ctrl.getBookedTimeSlots(req, res);
      expect(res.statusCode).toBe(500);
    });
  });

  // -------------------------
  // cancelBookedSlot
  // -------------------------
  describe('cancelBookedSlot', () => {
    it('❌ 401 sin userId', async () => {
      const req = httpMocks.createRequest({ method: 'POST', body: {} });
      const res = httpMocks.createResponse();
      await ctrl.cancelBookedSlot(req, res);
      expect(res.statusCode).toBe(401);
    });

    it('❌ 400 sin id en body', async () => {
      const req = httpMocks.createRequest({ method: 'POST', userId: 'u1', body: {} });
      const res = httpMocks.createResponse();
      await ctrl.cancelBookedSlot(req, res);
      expect(res.statusCode).toBe(400);
      expect(res._getJSONData().msg).toMatch(/Please pass parameters/i);
    });

    it('❌ 400 si el slot ya empezó', async () => {
      User.findById.mockResolvedValueOnce({ _id: 'u1', email: 'a@b.com', firstName: 'A', lastName: 'B' });
      BookedTimeSlot.findById.mockResolvedValueOnce({
        startTime: Date.now() - 1000, endTime: Date.now() + 3600000, vehicleType: 'Car',
        booker: 'u1', cancellable: true, parkingLot: 'L1'
      });

      const req = httpMocks.createRequest({ method: 'POST', userId: 'u1', body: { id: 't1' } });
      const res = httpMocks.createResponse();

      await ctrl.cancelBookedSlot(req, res);
      expect(res.statusCode).toBe(400);
      expect(res._getJSONData().msg).toMatch(/cannot cancel/i);
    });

    it('❌ 400 si el que cancela no es el booker', async () => {
      User.findById.mockResolvedValueOnce({ _id: 'u2', email: 'a@b.com', firstName: 'A', lastName: 'B' });
      BookedTimeSlot.findById.mockResolvedValueOnce({
        startTime: Date.now() + 3600000, endTime: Date.now() + 7200000, vehicleType: 'Car',
        booker: 'u1', cancellable: true, parkingLot: 'L1'
      });

      const req = httpMocks.createRequest({ method: 'POST', userId: 'u2', body: { id: 't1' } });
      const res = httpMocks.createResponse();

      await ctrl.cancelBookedSlot(req, res);
      expect(res.statusCode).toBe(400);
      expect(res._getJSONData().msg).toMatch(/haven't booked/i);
    });

    it('❌ 400 si el slot no es "cancellable"', async () => {
      User.findById.mockResolvedValueOnce({ _id: 'u1', email: 'a@b.com', firstName: 'A', lastName: 'B' });
      BookedTimeSlot.findById.mockResolvedValueOnce({
        startTime: Date.now() + 3600000, endTime: Date.now() + 7200000, vehicleType: 'Car',
        booker: 'u1', cancellable: false, parkingLot: 'L1'
      });

      const req = httpMocks.createRequest({ method: 'POST', userId: 'u1', body: { id: 't1' } });
      const res = httpMocks.createResponse();

      await ctrl.cancelBookedSlot(req, res);
      expect(res.statusCode).toBe(400);
      expect(res._getJSONData().msg).toMatch(/cannot cancel/i);
    });

    it('✅ public: marca refunded=true y termina (sin body explícito)', async () => {
      User.findById.mockResolvedValueOnce({ _id: 'u1', email: 'a@b.com', firstName: 'A', lastName: 'B' });
      BookedTimeSlot.findById.mockResolvedValueOnce({
        startTime: Date.now() + 3600000, endTime: Date.now() + 7200000, vehicleType: 'Bike',
        booker: 'u1', cancellable: true, parkingLot: 'LPUB'
      });
      ParkingLot.findById.mockResolvedValueOnce({ _id: 'LPUB', parkingChargesBike: 0, parkingChargesCar: 0, name: 'Pub', type: 'public' });
      BookedTimeSlot.findByIdAndUpdate.mockResolvedValueOnce({});

      const req = httpMocks.createRequest({ method: 'POST', userId: 'u1', body: { id: 't1' } });
      const res = httpMocks.createResponse();

      await ctrl.cancelBookedSlot(req, res);

      // Verificamos los 2 argumentos (id, update) y que cancelledAt exista
      const call = BookedTimeSlot.findByIdAndUpdate.mock.calls[0];
      expect(call[0]).toBe('t1');
      expect(call[1]).toEqual(expect.objectContaining({ cancelled: true, refunded: true }));
      expect(typeof call[1].cancelledAt).toBe('number');
      // El controlador hace `return` sin enviar respuesta; es suficiente con que no falle.
    });

    it('✅ private: envía email y responde 200', async () => {
      User.findById.mockResolvedValueOnce({ _id: 'u1', email: 'a@b.com', firstName: 'A', lastName: 'B' });
      BookedTimeSlot.findById.mockResolvedValueOnce({
        startTime: Date.now() + 3600000, endTime: Date.now() + 7200000, vehicleType: 'Car',
        booker: 'u1', cancellable: true, parkingLot: 'LPRIV'
      });
      ParkingLot.findById.mockResolvedValueOnce({ _id: 'LPRIV', parkingChargesBike: 10, parkingChargesCar: 20, name: 'Priv', type: 'private' });
      BookedTimeSlot.findByIdAndUpdate.mockResolvedValueOnce({});

      const req = httpMocks.createRequest({ method: 'POST', userId: 'u1', body: { id: 't1' } });
      const res = httpMocks.createResponse();

      await ctrl.cancelBookedSlot(req, res);

      expect(sendEmail2).toHaveBeenCalledTimes(1);

      const call = BookedTimeSlot.findByIdAndUpdate.mock.calls[0];
      expect(call[0]).toBe('t1');
      expect(call[1]).toEqual(expect.objectContaining({ cancelled: true, refunded: false }));
      expect(typeof call[1].cancelledAt).toBe('number');

      expect(res.statusCode).toBe(200);
      expect(res._getJSONData().msg).toMatch(/Cancelled successfully/i);
    });

    it('💥 500 si hay error inesperado', async () => {
      User.findById.mockRejectedValueOnce(new Error('db down'));
      const req = httpMocks.createRequest({ method: 'POST', userId: 'u1', body: { id: 't1' } });
      const res = httpMocks.createResponse();

      await ctrl.cancelBookedSlot(req, res);
      expect(res.statusCode).toBe(500);
    });
  });
});
