// __tests__/unit/utils/sendEmail2.test.js

describe('Utils/sendEmail2', () => {
  const logSpy = jest.spyOn(global.console, 'log').mockImplementation(() => {});
  afterAll(() => logSpy.mockRestore());

  // Creamos helpers "mock*" para cumplir la regla de Jest
  let mockSend;
  let mockCourierClient;

  beforeEach(() => {
    jest.resetModules();     // <- limpia el require cache (evita que quede el mock previo de otros tests)
    jest.clearAllMocks();

    mockSend = jest.fn();
    mockCourierClient = jest.fn(() => ({ send: mockSend }));

    // mock de @trycourier/courier ANTES de requerir el módulo bajo prueba
    jest.mock('@trycourier/courier', () => ({
      CourierClient: (...args) => mockCourierClient(...args),
    }));
  });

  it('✅ camino feliz: llama CourierClient y send con estructura correcta', async () => {
    mockSend.mockResolvedValueOnce({ requestId: 'req-123' });

    // Requerimos dentro del test, luego del mock
    const sendEmail2 = require('../../../Utils/sendEmail2');

    const payload = {
      subject: 'Título',
      receiverMail: 'destino@example.com',
      html: '<p>Contenido</p>',
    };

    await expect(sendEmail2(payload)).resolves.toBeUndefined();

    expect(mockCourierClient).toHaveBeenCalledTimes(1);
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.objectContaining({
          to: expect.objectContaining({ email: payload.receiverMail }),
          content: expect.objectContaining({
            title: payload.subject,
            body: payload.html,
          }),
          routing: expect.objectContaining({
            method: 'single',
            channels: ['email'],
          }),
        }),
      })
    );
  });

  it('💥 error de courier.send: NO lanza y se registra', async () => {
    mockSend.mockRejectedValueOnce(new Error('courier down'));

    const sendEmail2 = require('../../../Utils/sendEmail2');

    await expect(
      sendEmail2({ subject: 'A', receiverMail: 'b@c.com', html: 'x' })
    ).resolves.toBeUndefined();

    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalled(); // tu módulo hace console.log del error
  });
});
