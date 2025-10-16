// __tests__/unit/utils/sendEmail.test.js

// ---- Mock nodemailer (usar nombres "mock*") ----
const mockSendMail = jest.fn();
const mockCreateTransport = jest.fn(() => ({ sendMail: mockSendMail }));

jest.mock('nodemailer', () => ({
  createTransport: (...args) => mockCreateTransport(...args),
}));

// Importar DESPUÉS de mockear
const sendEmail = require('../../../Utils/sendEmail');

describe('Utils/sendEmail', () => {
  const OLD_ENV = process.env;
  const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...OLD_ENV,
      ADMIN1_EMAIL: 'noreply@test.com',
      APP_PASS: 'app-pass',
    };
  });

  afterAll(() => {
    process.env = OLD_ENV;
    logSpy.mockRestore();
  });

  it('✅ envía HTML (camino feliz)', async () => {
    mockSendMail.mockResolvedValueOnce({ response: '250 OK' });

    const mailData = {
      subject: 'Asunto HTML',
      receiverMail: 'user@example.com',
      html: '<b>Hola</b>',
    };

    await expect(sendEmail(mailData)).resolves.toBeUndefined();

    expect(mockCreateTransport).toHaveBeenCalledTimes(1);
    expect(mockCreateTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'smtp.gmail.com',
        port: 25,
        secure: false,
        auth: expect.objectContaining({
          user: process.env.ADMIN1_EMAIL,
          pass: process.env.APP_PASS,
        }),
      })
    );

    expect(mockSendMail).toHaveBeenCalledTimes(1);
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: process.env.ADMIN1_EMAIL,
        to: mailData.receiverMail,
        subject: mailData.subject,
        html: mailData.html,
      })
    );
  });

  it('✅ usa text cuando no hay html', async () => {
    mockSendMail.mockResolvedValueOnce({ response: '250 OK' });

    const mailData = {
      subject: 'Asunto Texto',
      receiverMail: 'user2@example.com',
      body: 'Mensaje plano',
    };

    await expect(sendEmail(mailData)).resolves.toBeUndefined();

    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: process.env.ADMIN1_EMAIL,
        to: mailData.receiverMail,
        subject: mailData.subject,
        text: mailData.body,
      })
    );
  });

  it('💥 error de sendMail: NO lanza (queda capturado)', async () => {
    mockSendMail.mockRejectedValueOnce(new Error('smtp down'));

    await expect(
      sendEmail({ subject: 'X', receiverMail: 'y@z.com', html: 'h' })
    ).resolves.toBeUndefined();

    expect(mockSendMail).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalled(); // se loguea el error
  });
});
    