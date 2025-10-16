// __tests__/unit/controllers/admin.controller.test.js
const httpMocks = require('node-mocks-http');

/* ===== Mocks de modelos y utils ===== */
jest.mock('../../../models/User', () => ({
  create: jest.fn(),
  findById: jest.fn(),
  find: jest.fn(),
}));
jest.mock('../../../models/ParkingLot', () => ({
  find: jest.fn(),
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  aggregate: jest.fn(),
}));
jest.mock('../../../models/BookedTimeSlot', () => ({
  find: jest.fn(),
  findByIdAndUpdate: jest.fn(),
}));
jest.mock('../../../Utils/sendEmail2', () => jest.fn());

// Validador usado en getParkingLotsNear
const mockLatLonValidate = jest.fn(() => ({ error: null }));
jest.mock('../../../validators/joi-validator', () => ({
  latLonValidator: { validate: (...a) => mockLatLonValidate(...a) },
}));

// Importar controlador DESPUÉS de mockear
const adminCtrl = require('../../../controllers/admin');

// Refs a mocks
const User = require('../../../models/User');
const ParkingLot = require('../../../models/ParkingLot');
const BookedTimeSlot = require('../../../models/BookedTimeSlot');
const sendEmail2 = require('../../../Utils/sendEmail2');

describe('controllers/admin', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLatLonValidate.mockReturnValue({ error: null });
  });

  /* ---------------- createAdmin ---------------- */
  it('✅ createAdmin: crea admin y responde 200', async () => {
    User.create.mockResolvedValueOnce({ _id: 'adm1' });

    const req = httpMocks.createRequest({ method: 'POST' });
    const res = httpMocks.createResponse();

    await adminCtrl.createAdmin(req, res);

    expect(User.create).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200);
    expect(res._getJSONData().msg).toMatch(/Admin created/i);
  });

  /* ---------------- getUsersName ---------------- */
  it('❌ getUsersName: 401 sin userId', async () => {
    const req = httpMocks.createRequest({ method: 'GET' });
    const res = httpMocks.createResponse();
    await adminCtrl.getUsersName(req, res);
    expect(res.statusCode).toBe(401);
  });

  it('❌ getUsersName: 401 si no es admin', async () => {
    User.findById.mockResolvedValueOnce({ _id: 'u1', role: 'user' });
    const req = httpMocks.createRequest({ method: 'GET', userId: 'u1' });
    const res = httpMocks.createResponse();

    await adminCtrl.getUsersName(req, res);
    expect(res.statusCode).toBe(401);
  });

  it('✅ getUsersName: 200 devuelve nombres', async () => {
    User.findById.mockResolvedValueOnce({ _id: 'admin', role: 'admin' });
    User.find.mockResolvedValueOnce([
      { _id: 'u1', firstName: 'Ana', lastName: 'García' },
      { _id: 'u2', firstName: 'Luis', lastName: 'Pérez' },
    ]);

    const req = httpMocks.createRequest({ method: 'GET', userId: 'admin' });
    const res = httpMocks.createResponse();

    await adminCtrl.getUsersName(req, res);

    expect(res.statusCode).toBe(200);
    const data = res._getJSONData();
    expect(data.usersName).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ _id: 'u1', name: 'Ana García' }),
        expect.objectContaining({ _id: 'u2', name: 'Luis Pérez' }),
      ])
    );
  });

  /* ---------------- getUserHistory ---------------- */
  it('❌ getUserHistory: 401 sin userId', async () => {
    const req = httpMocks.createRequest({ method: 'GET' });
    const res = httpMocks.createResponse();
    await adminCtrl.getUserHistory(req, res);
    expect(res.statusCode).toBe(401);
  });

  it('❌ getUserHistory: 401 no admin', async () => {
    User.findById.mockResolvedValueOnce({ _id: 'u1', role: 'user' });
    const req = httpMocks.createRequest({ method: 'GET', userId: 'u1', query: { _id: 'target' } });
    const res = httpMocks.createResponse();
    await adminCtrl.getUserHistory(req, res);
    expect(res.statusCode).toBe(401);
  });

  it('✅ getUserHistory: 200 sin reservas', async () => {
    User.findById.mockResolvedValueOnce({ _id: 'admin', role: 'admin' });
    BookedTimeSlot.find.mockResolvedValueOnce([]);

    const req = httpMocks.createRequest({ method: 'GET', userId: 'admin', query: { _id: 'uX' } });
    const res = httpMocks.createResponse();

    await adminCtrl.getUserHistory(req, res);
    expect(res.statusCode).toBe(200);
    expect(res._getJSONData().bookedTimeSlots).toEqual([]);
  });

  it('✅ getUserHistory: 200 con reservas y cargos', async () => {
    User.findById.mockResolvedValueOnce({ _id: 'admin', role: 'admin' });

    const start1 = Date.parse('2025-10-10T10:00:00Z');
    const end1 = Date.parse('2025-10-10T12:00:00Z');
    const start2 = Date.parse('2025-10-11T08:00:00Z');
    const end2 = Date.parse('2025-10-11T09:00:00Z');

    BookedTimeSlot.find.mockResolvedValueOnce([
      { _id: 't1', parkingLot: 'L1', vehicleType: 'Bike', startTime: start1, endTime: end1, _doc: { foo: 1 } },
      { _id: 't2', parkingLot: 'L2', vehicleType: 'Car',  startTime: start2, endTime: end2, _doc: { foo: 2 } },
    ]);

    ParkingLot.find.mockResolvedValueOnce([
      { _id: 'L1', name: 'Lot1', address: 'A1', location: { coordinates: [1, 2] }, parkingChargesBike: 10, parkingChargesCar: 20, type: 'private' },
      { _id: 'L2', name: 'Lot2', address: 'A2', location: { coordinates: [3, 4] }, parkingChargesBike: 5,  parkingChargesCar: 15, type: 'public'  },
    ]);

    const req = httpMocks.createRequest({ method: 'GET', userId: 'admin', query: { _id: 'uX' } });
    const res = httpMocks.createResponse();

    await adminCtrl.getUserHistory(req, res);

    expect(res.statusCode).toBe(200);
    const out = res._getJSONData().bookedTimeSlots;
    expect(out).toHaveLength(2);
    // El controlador devuelve {..._doc, ...}; usamos el orden para validar cargos:
    // Bike en L1 privado: 2h * 10 = 20
    expect(out[0].charges).toBe(20);
    // Car en L2 público: 0
    expect(out[1].charges).toBe(0);
  });

  /* ---------------- getParkingLotsNear ---------------- */
  it('❌ getParkingLotsNear: 401 sin userId', async () => {
    const req = httpMocks.createRequest({ method: 'GET', query: {} });
    const res = httpMocks.createResponse();
    await adminCtrl.getParkingLotsNear(req, res);
    expect(res.statusCode).toBe(401);
  });

  it('❌ getParkingLotsNear: 401 no admin', async () => {
    User.findById.mockResolvedValueOnce({ _id: 'u1', role: 'user' });
    const req = httpMocks.createRequest({ method: 'GET', userId: 'u1', query: {} });
    const res = httpMocks.createResponse();
    await adminCtrl.getParkingLotsNear(req, res);
    expect(res.statusCode).toBe(401);
  });

  it('❌ getParkingLotsNear: 400 validación', async () => {
    User.findById.mockResolvedValueOnce({ _id: 'admin', role: 'admin' });
    mockLatLonValidate.mockReturnValueOnce({ error: { details: [{ message: 'lat required' }] } });

    const req = httpMocks.createRequest({ method: 'GET', userId: 'admin', query: {} });
    const res = httpMocks.createResponse();

    await adminCtrl.getParkingLotsNear(req, res);
    expect(res.statusCode).toBe(400);
    expect(res._getJSONData().msg).toMatch(/lat required/i);
  });

  it('✅ getParkingLotsNear: 200 lista nombres', async () => {
    User.findById.mockResolvedValueOnce({ _id: 'admin', role: 'admin' });
    ParkingLot.aggregate.mockResolvedValueOnce([
      { name: 'Lote A' }, { name: 'Lote B' }
    ]);

    const req = httpMocks.createRequest({ method: 'GET', userId: 'admin', query: { lat: 1, lng: 2 } });
    const res = httpMocks.createResponse();

    await adminCtrl.getParkingLotsNear(req, res);
    expect(res.statusCode).toBe(200);
    expect(res._getJSONData().parkingLots).toEqual([{ name: 'Lote A' }, { name: 'Lote B' }]);
  });

  /* ---------------- getParkingLots ---------------- */
  it('❌ getParkingLots: 401 sin userId', async () => {
    const req = httpMocks.createRequest({ method: 'GET' });
    const res = httpMocks.createResponse();
    await adminCtrl.getParkingLots(req, res);
    expect(res.statusCode).toBe(401);
  });

  it('❌ getParkingLots: 401 no admin', async () => {
    User.findById.mockResolvedValueOnce({ _id: 'u1', role: 'user' });
    const req = httpMocks.createRequest({ method: 'GET', userId: 'u1' });
    const res = httpMocks.createResponse();
    await adminCtrl.getParkingLots(req, res);
    expect(res.statusCode).toBe(401);
  });

  it('✅ getParkingLots: 200 devuelve _doc', async () => {
    User.findById.mockResolvedValueOnce({ _id: 'admin', role: 'admin' });
    ParkingLot.find.mockResolvedValueOnce([
      { _doc: { name: 'Lot1', isActive: true } },
      { _doc: { name: 'Lot2', isActive: false } },
    ]);

    const req = httpMocks.createRequest({ method: 'GET', userId: 'admin' });
    const res = httpMocks.createResponse();

    await adminCtrl.getParkingLots(req, res);
    expect(res.statusCode).toBe(200);
    expect(res._getJSONData().parkingLots).toEqual([
      { name: 'Lot1', isActive: true },
      { name: 'Lot2', isActive: false },
    ]);
  });

  /* ---------------- getParkingLotHistory ---------------- */
  it('❌ getParkingLotHistory: 401 sin userId', async () => {
    const req = httpMocks.createRequest({ method: 'GET', query: { _id: 'L1' } });
    const res = httpMocks.createResponse();
    await adminCtrl.getParkingLotHistory(req, res);
    expect(res.statusCode).toBe(401);
  });

  it('❌ getParkingLotHistory: 401 no admin', async () => {
    User.findById.mockResolvedValueOnce({ _id: 'u1', role: 'user' });
    const req = httpMocks.createRequest({ method: 'GET', userId: 'u1', query: { _id: 'L1' } });
    const res = httpMocks.createResponse();
    await adminCtrl.getParkingLotHistory(req, res);
    expect(res.statusCode).toBe(401);
  });

  it('✅ getParkingLotHistory: 200 sin reservas', async () => {
    User.findById.mockResolvedValueOnce({ _id: 'admin', role: 'admin' });
    BookedTimeSlot.find.mockResolvedValueOnce([]);
    ParkingLot.findById.mockResolvedValueOnce({ _id: 'L1', name: 'Lot1' });

    const req = httpMocks.createRequest({ method: 'GET', userId: 'admin', query: { _id: 'L1' } });
    const res = httpMocks.createResponse();

    await adminCtrl.getParkingLotHistory(req, res);

    expect(res.statusCode).toBe(200);
    const out = res._getJSONData();
    expect(out.bookedTimeSlots).toEqual([]);
    expect(out.parkingLotDetails).toEqual(expect.objectContaining({ _id: 'L1' }));
  });

  it('✅ getParkingLotHistory: 200 con reservas y usuarios', async () => {
    User.findById.mockResolvedValueOnce({ _id: 'admin', role: 'admin' });

    const start1 = Date.parse('2025-10-10T10:00:00Z');
    const end1 = Date.parse('2025-10-10T11:00:00Z');
    const start2 = Date.parse('2025-10-10T12:00:00Z');
    const end2 = Date.parse('2025-10-10T14:00:00Z');

    BookedTimeSlot.find.mockResolvedValueOnce([
      { _id: 't1', booker: 'u1', vehicleType: 'Bike', startTime: start1, endTime: end1, _doc: { id: 't1' }, parkingLot: 'L1' },
      { _id: 't2', booker: 'u2', vehicleType: 'Car',  startTime: start2, endTime: end2, _doc: { id: 't2' }, parkingLot: 'L1' },
    ]);
    ParkingLot.findById.mockResolvedValueOnce({ _id: 'L1', name: 'Lot1', type: 'private', parkingChargesBike: 10, parkingChargesCar: 20 });
    User.find.mockResolvedValueOnce([
      { _id: 'u1', firstName: 'Ana', lastName: 'García' },
      { _id: 'u2', firstName: 'Luis', lastName: 'Pérez' },
    ]);

    const req = httpMocks.createRequest({ method: 'GET', userId: 'admin', query: { _id: 'L1' } });
    const res = httpMocks.createResponse();

    await adminCtrl.getParkingLotHistory(req, res);

    expect(res.statusCode).toBe(200);
    const out = res._getJSONData().bookedTimeSlots;
    const t1 = out.find(x => x.id === 't1');
    const t2 = out.find(x => x.id === 't2');
    // Bike: 1h * 10 = 10
    expect(t1.charges).toBe(10);
    // Car: 2h * 20 = 40
    expect(t2.charges).toBe(40);
    expect(t1.booker.name).toBe('Ana García');
  });

  /* ---------------- deleteParkingLot ---------------- */
  it('❌ deleteParkingLot: 401 sin userId', async () => {
    const req = httpMocks.createRequest({ method: 'POST', body: {} });
    const res = httpMocks.createResponse();
    await adminCtrl.deleteParkingLot(req, res);
    expect(res.statusCode).toBe(401);
  });

  it('❌ deleteParkingLot: 401 no admin', async () => {
    User.findById.mockResolvedValueOnce({ _id: 'u1', role: 'user' });
    const req = httpMocks.createRequest({ method: 'POST', userId: 'u1', body: {} });
    const res = httpMocks.createResponse();
    await adminCtrl.deleteParkingLot(req, res);
    expect(res.statusCode).toBe(401);
  });

  it('❌ deleteParkingLot: 400 sin id', async () => {
    User.findById.mockResolvedValueOnce({ _id: 'admin', role: 'admin' });
    const req = httpMocks.createRequest({ method: 'POST', userId: 'admin', body: {} });
    const res = httpMocks.createResponse();
    await adminCtrl.deleteParkingLot(req, res);
    expect(res.statusCode).toBe(400);
    expect(res._getJSONData().msg).toMatch(/Please pass Parking Lot ID/i);
  });

  it('✅ deleteParkingLot (public): marca refunded=true y envía mails', async () => {
    User.findById.mockResolvedValueOnce({ _id: 'admin', role: 'admin' });
    ParkingLot.findByIdAndUpdate.mockResolvedValueOnce({
      _id: 'Lpub', name: 'Pub', type: 'public', parkingChargesBike: 0, parkingChargesCar: 0,
    });
    // 2 reservas activas
    BookedTimeSlot.find.mockResolvedValueOnce([
      { _id: 't1', booker: 'u1', startTime: Date.now(), endTime: Date.now()+3600000, vehicleType: 'Bike' },
      { _id: 't2', booker: 'u2', startTime: Date.now(), endTime: Date.now()+7200000, vehicleType: 'Car'  },
    ]);
    User.find.mockResolvedValueOnce([
      { _id: 'u1', firstName: 'Ana', lastName: 'García', email: 'a@a.com' },
      { _id: 'u2', firstName: 'Luis', lastName: 'Pérez',  email: 'b@b.com' },
    ]);
    BookedTimeSlot.findByIdAndUpdate.mockResolvedValue({});

    const req = httpMocks.createRequest({ method: 'POST', userId: 'admin', body: { id: 'Lpub' } });
    const res = httpMocks.createResponse();

    await adminCtrl.deleteParkingLot(req, res);

    expect(sendEmail2).toHaveBeenCalledTimes(2);
    // ambas con refunded: true
    expect(
      BookedTimeSlot.findByIdAndUpdate.mock.calls.some(
        ([id, update]) => update.refunded === true
      )
    ).toBe(true);
    expect(res.statusCode).toBe(200);
  });

  it('✅ deleteParkingLot (private): refunded=false', async () => {
    User.findById.mockResolvedValueOnce({ _id: 'admin', role: 'admin' });
    ParkingLot.findByIdAndUpdate.mockResolvedValueOnce({
      _id: 'Lpriv', name: 'Priv', type: 'private', parkingChargesBike: 10, parkingChargesCar: 20,
    });
    BookedTimeSlot.find.mockResolvedValueOnce([
      { _id: 't1', booker: 'u1', startTime: Date.now(), endTime: Date.now()+3600000, vehicleType: 'Bike' },
    ]);
    User.find.mockResolvedValueOnce([
      { _id: 'u1', firstName: 'Ana', lastName: 'García', email: 'a@a.com' },
    ]);
    BookedTimeSlot.findByIdAndUpdate.mockResolvedValue({});

    const req = httpMocks.createRequest({ method: 'POST', userId: 'admin', body: { id: 'Lpriv' } });
    const res = httpMocks.createResponse();

    await adminCtrl.deleteParkingLot(req, res);

    expect(sendEmail2).toHaveBeenCalledTimes(1);
    expect(
      BookedTimeSlot.findByIdAndUpdate.mock.calls[0][1].refunded
    ).toBe(false);
    expect(res.statusCode).toBe(200);
  });

  /* ---------------- makeActiveParkingLot ---------------- */
  it('❌ makeActiveParkingLot: 401 sin userId', async () => {
    const req = httpMocks.createRequest({ method: 'POST', body: { id: 'L1' } });
    const res = httpMocks.createResponse();
    await adminCtrl.makeActiveParkingLot(req, res);
    expect(res.statusCode).toBe(401);
  });

  it('❌ makeActiveParkingLot: 401 no admin', async () => {
    User.findById.mockResolvedValueOnce({ _id: 'u1', role: 'user' });
    const req = httpMocks.createRequest({ method: 'POST', userId: 'u1', body: { id: 'L1' } });
    const res = httpMocks.createResponse();
    await adminCtrl.makeActiveParkingLot(req, res);
    expect(res.statusCode).toBe(401);
  });

  it('✅ makeActiveParkingLot: 200 marca activo', async () => {
    User.findById.mockResolvedValueOnce({ _id: 'admin', role: 'admin' });
    ParkingLot.findByIdAndUpdate.mockResolvedValueOnce({});

    const req = httpMocks.createRequest({ method: 'POST', userId: 'admin', body: { id: 'L1' } });
    const res = httpMocks.createResponse();

    await adminCtrl.makeActiveParkingLot(req, res);

    expect(ParkingLot.findByIdAndUpdate).toHaveBeenCalledWith('L1', { isActive: true });
    expect(res.statusCode).toBe(200);
  });

  /* ---------------- getCancelledSlots ---------------- */
  it('❌ getCancelledSlots: 401 sin userId', async () => {
    const req = httpMocks.createRequest({ method: 'GET' });
    const res = httpMocks.createResponse();
    await adminCtrl.getCancelledSlots(req, res);
    expect(res.statusCode).toBe(401);
  });

  it('❌ getCancelledSlots: 401 no admin', async () => {
    User.findById.mockResolvedValueOnce({ _id: 'u1', role: 'user' });
    const req = httpMocks.createRequest({ method: 'GET', userId: 'u1' });
    const res = httpMocks.createResponse();
    await adminCtrl.getCancelledSlots(req, res);
    expect(res.statusCode).toBe(401);
  });

  it('✅ getCancelledSlots: 200 filtra solo privados y calcula cargos', async () => {
    User.findById.mockResolvedValueOnce({ _id: 'admin', role: 'admin' });

    const start = Date.parse('2025-10-10T10:00:00Z');
    const end = Date.parse('2025-10-10T12:00:00Z');

    BookedTimeSlot.find.mockResolvedValueOnce([
      { _id: 't1', parkingLot: 'Lpriv', vehicleType: 'Bike', booker: 'u1', startTime: start, endTime: end, cancelled: true, paid: true, _doc: { id: 't1' } },
      { _id: 't2', parkingLot: 'Lpub',  vehicleType: 'Car',  booker: 'u2', startTime: start, endTime: end, cancelled: true, paid: true, _doc: { id: 't2' } },
    ]);
    User.find.mockResolvedValueOnce([
      { _id: 'u1', firstName: 'Ana', lastName: 'García', email: 'a@a.com' },
      { _id: 'u2', firstName: 'Luis', lastName: 'Pérez',  email: 'b@b.com' },
    ]);
    ParkingLot.find.mockResolvedValueOnce([
      { _id: 'Lpriv', name: 'Priv', type: 'private', parkingChargesBike: 10, parkingChargesCar: 20 },
      { _id: 'Lpub',  name: 'Pub',  type: 'public',  parkingChargesBike: 0,  parkingChargesCar: 0  },
    ]);

    const req = httpMocks.createRequest({ method: 'GET', userId: 'admin' });
    const res = httpMocks.createResponse();

    await adminCtrl.getCancelledSlots(req, res);

    expect(res.statusCode).toBe(200);
    const out = res._getJSONData().cancelledSlots;
    // Solo debe quedar Lpriv (privado)
    expect(out).toHaveLength(1);
    expect(out[0].parkingLot._id).toBe('Lpriv');
    // Bike 2h * 10 = 20
    expect(out[0].charges).toBe(20);
  });
});
