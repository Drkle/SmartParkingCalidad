// __tests__/unit/controllers/payments.controller.test.js
const httpMocks = require('node-mocks-http');

/* ============== MOCKS ============== */
const mockOrdersCreate = jest.fn();
const mockPaymentsFetch = jest.fn();
jest.mock('../../../Utils/razorPayInstance', () => ({
  instance: {
    orders: { create: (...a) => mockOrdersCreate(...a) },
    payments: { fetch: (...a) => mockPaymentsFetch(...a) },
  },
}));

const mockBookValidate = jest.fn(() => ({ error: null }));
jest.mock('../../../validators/joi-validator', () => ({
  bookSlotValidator: { validate: (...a) => mockBookValidate(...a) },
}));

jest.mock('../../../models/User', () => ({ findById: jest.fn() }));
jest.mock('../../../models/BookedTimeSlot', () => ({
  find: jest.fn(),
  create: jest.fn(),
  findOneAndUpdate: jest.fn(),
  findByIdAndUpdate: jest.fn(),
}));
jest.mock('../../../models/Payment', () => ({ create: jest.fn() }));
jest.mock('../../../models/ParkingLot', () => ({ findById: jest.fn() }));
jest.mock('../../../Utils/sendEmail2', () => jest.fn());

const ctrl = require('../../../controllers/payments');
const User = require('../../../models/User');
const BookedTimeSlot = require('../../../models/BookedTimeSlot');
const Payment = require('../../../models/Payment');
const ParkingLot = require('../../../models/ParkingLot');
const sendEmail2 = require('../../../Utils/sendEmail2');

describe('controllers/payments', () => {
  const ORIG_ENV = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...ORIG_ENV };
    process.env.RAZORPAY_API_SECRET = 'shhh';
    process.env.RAZORPAY_API_KEY = 'rzp_test_key';
    process.env.REACT_APP_URL = 'http://localhost:3000';
  });

  afterAll(() => {
    process.env = ORIG_ENV;
  });

  /* -------------------------------------------------
   * checkoutBookSlot
   * ------------------------------------------------- */
  describe('checkoutBookSlot', () => {
    // ⚠️ ObjectIds válidos
    const VALID_LOT = '507f1f77bcf86cd799439011';
    const VALID_SLOT = '507f1f77bcf86cd799439012';

    const baseBody = (over = {}) => ({
      lotId: VALID_LOT,
      slotId: VALID_SLOT,
      startTime: '2025-10-10T10:00:00Z',
      endTime: '2025-10-10T12:00:00Z',
      vehicleType: 'car',
      carImg: 'img',
      vehicleNo: 'AAA111',
      cancellable: true,
      charges: 100,
      type: 'private',
      currTime: '2025-10-10T09:00:00Z',
      ...over,
    });

    it('❌ 400 validación específica vehicleNo pattern', async () => {
      mockBookValidate.mockReturnValueOnce({
        error: { details: [{ path: ['vehicleNo'], type: 'string.pattern.base', message: 'bad plate' }] },
      });

      const req = httpMocks.createRequest({ method: 'POST', body: baseBody() });
      const res = httpMocks.createResponse();

      await ctrl.checkoutBookSlot(req, res);
      expect(res.statusCode).toBe(400);
      expect(res._getJSONData().msg).toMatch(/valid Vehicle Number/i);
    });

    it('❌ 400 validación genérica', async () => {
      mockBookValidate.mockReturnValueOnce({
        error: { details: [{ path: ['other'], type: 'any.required', message: 'missing' }] },
      });

      const req = httpMocks.createRequest({ method: 'POST', body: baseBody() });
      const res = httpMocks.createResponse();

      await ctrl.checkoutBookSlot(req, res);
      expect(res.statusCode).toBe(400);
      expect(res._getJSONData().msg).toMatch(/Validation error/i);
    });

    it('❌ 400 si usuario no tiene profilePic', async () => {
      User.findById.mockResolvedValueOnce({ _id: 'u1', profilePic: '' });

      const req = httpMocks.createRequest({ method: 'POST', userId: 'u1', body: baseBody() });
      const res = httpMocks.createResponse();

      await ctrl.checkoutBookSlot(req, res);
      expect(User.findById).toHaveBeenCalled();
      expect(res.statusCode).toBe(400);
      expect(res._getJSONData().msg).toMatch(/Upload a profile photo/i);
    });

    it('❌ 400 si ya tiene una reserva activa del mismo tipo de vehículo', async () => {
      User.findById.mockResolvedValueOnce({ _id: 'u1', profilePic: 'ok.png' });
      BookedTimeSlot.find
        .mockResolvedValueOnce([ { _id: 't1' } ]) // futureBookedParkingSlots
        .mockResolvedValueOnce([]);               // vehicleBookedSlots (no llega)

      const req = httpMocks.createRequest({ method: 'POST', userId: 'u1', body: baseBody() });
      const res = httpMocks.createResponse();

      await ctrl.checkoutBookSlot(req, res);
      expect(res.statusCode).toBe(400);
      expect(res._getJSONData().msg).toMatch(/already booked a slot/i);
    });

    it('❌ 400 si el vehicleNo ya tiene una reserva activa', async () => {
    // Estado limpio + default
    BookedTimeSlot.find.mockReset();
    BookedTimeSlot.find.mockResolvedValue([]); // default si hubiera una 3ª llamada

    User.findById.mockResolvedValueOnce({ _id: 'u1', profilePic: 'ok.png' });

    // 1ª llamada (futureBookedParkingSlots) -> []
    // 2ª llamada (vehicleBookedSlots) -> [algo]
    BookedTimeSlot.find
      .mockResolvedValueOnce([])                // <- primera
      .mockResolvedValueOnce([{ _id: 't2' }]); // <- segunda

    const req = httpMocks.createRequest({
      method: 'POST',
      userId: 'u1',
      body: baseBody({ vehicleNo: 'XYZ9' }),
    });
    const res = httpMocks.createResponse();

    await ctrl.checkoutBookSlot(req, res);
    expect(res.statusCode).toBe(400);
    expect(res._getJSONData().msg).toMatch(/already has an active slot/i);
  });

    it('✅ 200 (private): crea orden y guarda bookedSlot (paid:false)', async () => {
    // Estado limpio + defaults
    BookedTimeSlot.find.mockReset();
    BookedTimeSlot.find.mockResolvedValue([]); // default

    mockOrdersCreate.mockReset();

    User.findById.mockResolvedValueOnce({ _id: 'u1', profilePic: 'ok.png' });

    // En este caso ambas búsquedas deben ser vacías
    BookedTimeSlot.find
      .mockResolvedValueOnce([]) // futureBookedParkingSlots
      .mockResolvedValueOnce([]); // vehicleBookedSlots

    mockOrdersCreate.mockResolvedValueOnce({ id: 'order_abc', amount: 10000 });
    BookedTimeSlot.create.mockResolvedValueOnce({ _id: 'tBooked', paid: false });

    const req = httpMocks.createRequest({
      method: 'POST',
      userId: 'u1',
      body: baseBody({ type: 'private' }),
    });
    const res = httpMocks.createResponse();

    await ctrl.checkoutBookSlot(req, res);

    expect(mockOrdersCreate).toHaveBeenCalledTimes(1);
    expect(BookedTimeSlot.create).toHaveBeenCalledWith(
      expect.objectContaining({ orderID: 'order_abc', paid: false })
    );
    expect(res.statusCode).toBe(200);
    expect(res._getJSONData()).toHaveProperty('order');
    });

    it('✅ 200 (public): crea bookedSlot (paid:true) y responde OK', async () => {
      User.findById.mockResolvedValueOnce({ _id: 'u1', profilePic: 'ok.png' });
      BookedTimeSlot.find
        .mockResolvedValueOnce([]) // futureBookedParkingSlots
        .mockResolvedValueOnce([]); // vehicleBookedSlots
      BookedTimeSlot.create.mockResolvedValueOnce({ _id: 'tBooked', paid: true });

      const req = httpMocks.createRequest({ method: 'POST', userId: 'u1', body: baseBody({ type: 'public' }) });
      const res = httpMocks.createResponse();

      await ctrl.checkoutBookSlot(req, res);

      expect(mockOrdersCreate).not.toHaveBeenCalled();
      expect(BookedTimeSlot.create).toHaveBeenCalledWith(expect.objectContaining({ paid: true }));
      expect(res.statusCode).toBe(200);
      expect(res._getJSONData().msg).toMatch(/Slot Booking Successful/i);
    });

    it('💥 500 si algo explota', async () => {
      mockBookValidate.mockReturnValueOnce({ error: null });
      User.findById.mockRejectedValueOnce(new Error('db down'));

      const req = httpMocks.createRequest({ method: 'POST', userId: 'u1', body: baseBody() });
      const res = httpMocks.createResponse();

      await ctrl.checkoutBookSlot(req, res);
      expect(res.statusCode).toBe(500);
    });
  });

  /* -------------------------------------------------
   * bookPaymentVerification
   * ------------------------------------------------- */
  describe('bookPaymentVerification', () => {
    const baseBody = {
      razorpay_order_id: 'order_123',
      razorpay_payment_id: 'pay_456',
      razorpay_signature: '',
    };

    it('✅ firma válida: fetch, update, payment, email (private) y success', async () => {
      const crypto = require('crypto');
      const expected = crypto.createHmac('sha256', 'shhh')
        .update('order_123|pay_456').digest('hex');

      mockPaymentsFetch.mockResolvedValueOnce({ amount: 1000, status: 'captured' });
      BookedTimeSlot.findOneAndUpdate.mockResolvedValueOnce({
        _id: 't1',
        parkingLot: 'LOT1',
        vehicleType: 'car',
        vehicleNo: 'AAA111',
        startTime: Date.parse('2025-10-10T10:00:00Z'),
        endTime: Date.parse('2025-10-10T12:00:00Z'),
      });
      Payment.create.mockResolvedValueOnce({});
      ParkingLot.findById.mockResolvedValueOnce({
        _id: 'LOT1',
        type: 'private',
        ownerName: 'Owner',
        ownerEmail: 'own@example.com',
        name: 'Lot Priv',
      });

      const req = httpMocks.createRequest({
        method: 'POST',
        body: { ...baseBody, razorpay_signature: expected },
        query: { charges: 200 },
      });
      const res = httpMocks.createResponse();

      await ctrl.bookPaymentVerification(req, res);

      expect(mockPaymentsFetch).toHaveBeenCalledWith('pay_456');
      expect(BookedTimeSlot.findOneAndUpdate).toHaveBeenCalledWith(
        { orderID: 'order_123' },
        expect.objectContaining({ paid: true }),
        { new: true }
      );
      expect(Payment.create).toHaveBeenCalled();
      expect(sendEmail2).toHaveBeenCalledTimes(1);
      expect(res._getRedirectUrl()).toMatch(/paymentSuccess\?type=book$/);
    });

    it('❌ firma inválida: failure', async () => {
      const req = httpMocks.createRequest({
        method: 'POST',
        body: { ...baseBody, razorpay_signature: 'WRONG' },
      });
      const res = httpMocks.createResponse();

      await ctrl.bookPaymentVerification(req, res);
      expect(res._getRedirectUrl()).toMatch(/paymentFailure\?type=book$/);
    });

    it('💥 500 en excepción', async () => {
      const crypto = require('crypto');
      const expected = crypto.createHmac('sha256', 'shhh')
        .update('order_123|pay_456').digest('hex');

      mockPaymentsFetch.mockRejectedValueOnce(new Error('rzp down'));

      const req = httpMocks.createRequest({
        method: 'POST',
        body: { ...baseBody, razorpay_signature: expected },
      });
      const res = httpMocks.createResponse();

      await ctrl.bookPaymentVerification(req, res);
      expect(res.statusCode).toBe(500);
    });
  });

  it('✅ getRazorPayKey: 200 con key', async () => {
    const req = httpMocks.createRequest({ method: 'GET' });
    const res = httpMocks.createResponse();

    await ctrl.getRazorPayKey(req, res);
    expect(res.statusCode).toBe(200);
    expect(res._getJSONData().key).toBe('rzp_test_key');
  });

  /* -------------------------------------------------
   * checkoutRefund
   * ------------------------------------------------- */
  describe('checkoutRefund', () => {
    it('✅ 200 crea orden de refund', async () => {
      mockOrdersCreate.mockReset();
      mockOrdersCreate.mockResolvedValueOnce({ id: 'order_ref_1' });

      const req = httpMocks.createRequest({ method: 'POST', body: { amount: 50 } });
      const res = httpMocks.createResponse();

      await ctrl.checkoutRefund(req, res);
      expect(mockOrdersCreate).toHaveBeenCalled();
      expect(res.statusCode).toBe(200);
      expect(res._getJSONData()).toHaveProperty('order.id', 'order_ref_1');
    });

    it('💥 500 en error', async () => {
      mockOrdersCreate.mockReset();
      mockOrdersCreate.mockRejectedValueOnce(new Error('rzp down'));

      const req = httpMocks.createRequest({ method: 'POST', body: { amount: 10 } });
      const res = httpMocks.createResponse();

      await ctrl.checkoutRefund(req, res);
      expect(res.statusCode).toBe(500);
    });
  });

  /* -------------------------------------------------
   * refundPaymentVerification
   * ------------------------------------------------- */
  describe('refundPaymentVerification', () => {
    const baseBody = {
      razorpay_order_id: 'order_R',
      razorpay_payment_id: 'pay_R',
      razorpay_signature: '',
    };

    it('❌ 400 cuando la firma no coincide', async () => {
      const req = httpMocks.createRequest({ method: 'POST', body: { ...baseBody, razorpay_signature: 'nope' } });
      const res = httpMocks.createResponse();

      await ctrl.refundPaymentVerification(req, res);
      expect(res.statusCode).toBe(400);
      expect(res._getJSONData().msg).toMatch(/signature mismatch/i);
    });

    it('✅ firma válida (adminCancelled=true): 100% refund y success', async () => {
      const crypto = require('crypto');
      const expected = crypto.createHmac('sha256', 'shhh').update('order_R|pay_R').digest('hex');

      mockPaymentsFetch.mockResolvedValueOnce({ status: 'captured' });
      BookedTimeSlot.findByIdAndUpdate.mockResolvedValueOnce({
        _id: 'slot1',
        parkingLot: 'LOT1',
        vehicleType: 'car',
        vehicleNo: 'AAA123',
        startTime: Date.parse('2025-10-10T10:00:00Z'),
        endTime: Date.parse('2025-10-10T12:00:00Z'),
        adminCancelled: true,
      });
      Payment.create.mockResolvedValueOnce({});
      ParkingLot.findById.mockResolvedValueOnce({ _id: 'LOT1', name: 'Lot X' });

      const req = httpMocks.createRequest({
        method: 'POST',
        body: { ...baseBody, razorpay_signature: expected },
        query: { slotID: 'slot1', userName: 'John', emailID: 'j@x.com', charges: 300 },
      });
      const res = httpMocks.createResponse();

      await ctrl.refundPaymentVerification(req, res);

      expect(BookedTimeSlot.findByIdAndUpdate).toHaveBeenCalledWith(
        'slot1',
        expect.objectContaining({ refunded: true }),
        { new: true }
      );
      expect(Payment.create).toHaveBeenCalledWith(expect.objectContaining({ type: 'refund' }));
      expect(sendEmail2).toHaveBeenCalledTimes(1);
      const args = sendEmail2.mock.calls[0][0];
      expect(args.html).toMatch(/100% is refunded/);
      expect(res._getRedirectUrl()).toMatch(/paymentSuccess\?type=refund$/);
    });

    it('✅ firma válida (adminCancelled=false): 70% refund y success', async () => {
      const crypto = require('crypto');
      const expected = crypto.createHmac('sha256', 'shhh').update('order_R|pay_R').digest('hex');

      mockPaymentsFetch.mockResolvedValueOnce({ status: 'captured' });
      BookedTimeSlot.findByIdAndUpdate.mockResolvedValueOnce({
        _id: 'slot2',
        parkingLot: 'LOT1',
        vehicleType: 'bike',
        vehicleNo: 'BBB222',
        startTime: Date.parse('2025-10-10T10:00:00Z'),
        endTime: Date.parse('2025-10-10T11:00:00Z'),
        adminCancelled: false,
      });
      Payment.create.mockResolvedValueOnce({});
      ParkingLot.findById.mockResolvedValueOnce({ _id: 'LOT1', name: 'Lot X' });

      const req = httpMocks.createRequest({
        method: 'POST',
        body: { ...baseBody, razorpay_signature: expected },
        query: { slotID: 'slot2', userName: 'Ana', emailID: 'a@x.com', charges: 200 },
      });
      const res = httpMocks.createResponse();

      await ctrl.refundPaymentVerification(req, res);

      const args = sendEmail2.mock.calls[0][0];
      expect(args.html).toMatch(/70% i\.e\.140\.00 is refunded/);
      expect(res._getRedirectUrl()).toMatch(/paymentSuccess\?type=refund$/);
    });

    it('💥 500 en excepción', async () => {
      const crypto = require('crypto');
      const expected = crypto.createHmac('sha256', 'shhh').update('order_R|pay_R').digest('hex');

      mockPaymentsFetch.mockRejectedValueOnce(new Error('rzp down'));

      const req = httpMocks.createRequest({
        method: 'POST',
        body: { ...baseBody, razorpay_signature: expected },
        query: { slotID: 'slotX', userName: 'A', emailID: 'a@a.com', charges: 50 },
      });
      const res = httpMocks.createResponse();

      await ctrl.refundPaymentVerification(req, res);
      expect(res.statusCode).toBe(500);
    });
  });
});
