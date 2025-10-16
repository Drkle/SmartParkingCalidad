// __tests__/unit/utils/sendEmail2.test.js

// 1) Mockear nodemailer ANTES de requerirlo
const sendMailMock = jest.fn();
const createTransportMock = jest.fn(() => ({ sendMail: sendMailMock }));

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(), // lo configuramos en beforeEach
}));

describe('Utils/sendEmail2', () => {
  const OLD_ENV = process.env;
  let nodemailer;

  beforeEach(() => {
    jest.resetModules();                      // limpia el require cache
    process.env = { ...OLD_ENV };            // clona entorno
    sendMailMock.mockReset().mockResolvedValue({ messageId: 'mocked-id-123' });
    createTransportMock.mockClear();

    // Ahora sí, requerimos el mock de nodemailer y le inyectamos nuestra impl
    nodemailer = require('nodemailer');
    nodemailer.createTransport.mockImplementation(createTransportMock);
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('✅ envía un correo correctamente con parámetros válidos', async () => {
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_PORT = '465';
    process.env.SMTP_SECURE = 'true';
    process.env.SMTP_USER = 'test@example.com';
    process.env.SMTP_PASS = '123456';

    const sendEmail2 = require('../../../Utils/sendEmail2');

    const id = await sendEmail2({
      subject: 'Test email',
      receiverMail: 'user@example.com',
      html: '<b>Hello</b>',
    });

    expect(nodemailer.createTransport).toHaveBeenCalledWith({
      host: 'smtp.example.com',
      port: 465,
      secure: true,
      auth: { user: 'test@example.com', pass: '123456' },
    });
    expect(sendMailMock).toHaveBeenCalledTimes(1);
    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        subject: 'Test email',
        html: '<b>Hello</b>',
        from: expect.stringMatching(/Smart Parking/),
      })
    );
    expect(id).toBe('mocked-id-123');
  });

  it('✅ usa "from" personalizado cuando se proporciona', async () => {
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_SECURE = 'false';
    process.env.SMTP_USER = 'test@example.com';
    process.env.SMTP_PASS = '123456';

    const sendEmail2 = require('../../../Utils/sendEmail2');

    await sendEmail2({
      subject: 'Custom From',
      receiverMail: 'custom@example.com',
      html: '<p>Custom</p>',
      from: 'Admin <admin@example.com>',
    });

    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'Admin <admin@example.com>' })
    );
  });

  it('💥 lanza error si faltan variables SMTP obligatorias', () => {
    delete process.env.SMTP_HOST;
    process.env.SMTP_PORT = '465';
    process.env.SMTP_SECURE = 'true';
    process.env.SMTP_USER = 'test@example.com';
    process.env.SMTP_PASS = '123456';

    expect(() => require('../../../Utils/sendEmail2')).toThrow(/Faltan variables SMTP/);
  });

  it('💥 propaga errores del transporte (por ejemplo, conexión fallida)', async () => {
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_PORT = '465';
    process.env.SMTP_SECURE = 'true';
    process.env.SMTP_USER = 'test@example.com';
    process.env.SMTP_PASS = '123456';

    // Forzar fallo en sendMail
    sendMailMock.mockRejectedValueOnce(new Error('Connection refused'));

    const sendEmail2 = require('../../../Utils/sendEmail2');

    await expect(
      sendEmail2({
        subject: 'Error Test',
        receiverMail: 'fail@example.com',
        html: '<p>fail</p>',
      })
    ).rejects.toThrow('Connection refused');
  });
});
