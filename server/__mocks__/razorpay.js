class Razorpay {
  constructor() {
    this.orders = {
      create: jest.fn(async (o) => ({ id: 'order_123', ...o }))
    };
    this.payments = {
      refund: jest.fn(async () => ({ status: 'processed' }))
    };
  }
}
module.exports = Razorpay;
