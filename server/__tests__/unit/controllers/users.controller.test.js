const httpMocks = require('node-mocks-http');
const usersCtrl = require('../../../controllers/users');
const User = require('../../../models/User');
const sendEmail2 = require('../../../Utils/sendEmail2');
const jwt = require('jsonwebtoken');
const passwordHash = require('password-hash');

// Mocks
jest.mock('../../../models/User');          // auto-mock del modelo
jest.mock('../../../Utils/sendEmail2');
jest.mock('jsonwebtoken', () => ({
  decode: jest.fn(),
  sign: jest.fn(),
}));

describe('controllers/users', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Asegura que cualquier uso de jwt.sign devuelva un token de mentira
    jwt.sign.mockReturnValue('fake.jwt.token');
  });

  it('✅ 200: Crear un nuevo usuario y enviar OTP', async () => {
    const newUser = {
      email: 'test@example.com',
      password: 'password123',
      confirmPassword: 'password123',
      firstName: 'John',
      lastName: 'Doe',
      userName: 'john_doe',
      mobileNo: '1234567890',
      selectedImg: 'image.png',
      currTimeStamp: Date.now(),
    };

    User.findOne.mockResolvedValueOnce(null);  // No existe el usuario
    User.create.mockResolvedValueOnce({ _id: '1', ...newUser });

    const req = httpMocks.createRequest({ method: 'POST', body: newUser });
    const res = httpMocks.createResponse();

    await usersCtrl.sendOTP(req, res);

    expect(res.statusCode).toBe(200);
    const data = res._getJSONData();
    expect(data.msg).toMatch(/Account created/i);
    expect(data.devOTP).toBeDefined();
  });

  it('✅ 200: Reenviar OTP', async () => {
    const existingUser = {
      _id: '1',                      // añade _id para que el controlador pueda usarlo
      email: 'test@example.com',
      verified: false,
    };

    User.findOne.mockResolvedValueOnce(existingUser);
    User.findByIdAndUpdate.mockResolvedValueOnce({ _id: '1', otp: '123456' });

    const req = httpMocks.createRequest({
      method: 'POST',
      body: { email: 'test@example.com' },
    });
    const res = httpMocks.createResponse();

    await usersCtrl.resendOTP(req, res);

    expect(res.statusCode).toBe(200);
    const data = res._getJSONData();
    expect(data.msg).toMatch(/Vefiy OTP sent to your email/i);
  });

  it('✅ 200: Verificar correo electrónico con OTP', async () => {
    const reqBody = { email: 'test@example.com', otp: '123456' };
    const user = { _id: '1', email: 'test@example.com', otp: '123456', verified: false };

    User.findOne.mockResolvedValueOnce(user);
    User.findByIdAndUpdate.mockResolvedValueOnce({ ...user, verified: true });

    const req = httpMocks.createRequest({ method: 'POST', body: reqBody });
    const res = httpMocks.createResponse();

    await usersCtrl.verifyEmail(req, res);

    expect(res.statusCode).toBe(200);
    const data = res._getJSONData();
    expect(data.msg).toMatch(/You're Registered Successfully, Login Now/i);
  });

  it('✅ 200: Iniciar sesión con credenciales correctas', async () => {
    const validCredentials = { email: 'test@example.com', password: 'correctPassword' };

    User.findOne.mockResolvedValueOnce({
      _id: '1',
      email: 'test@example.com',
      password: passwordHash.generate('correctPassword'),
      verified: true,
      role: 'user',
    });

    const req = httpMocks.createRequest({ method: 'POST', body: validCredentials });
    const res = httpMocks.createResponse();

    await usersCtrl.signIn(req, res);

    expect(res.statusCode).toBe(200);
    const data = res._getJSONData();
    // ahora sí existe y no es eliminado por JSON.stringify
    expect(data).toHaveProperty('token', 'fake.jwt.token');
  });

  it('✅ 200: Obtener información del usuario actual', async () => {
    const user = {
      _id: '1',
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      userName: 'john_doe',
      mobileNo: '1234567890',
      role: 'user',
      profilePic: 'pic.png',
    };

    User.findById.mockResolvedValueOnce(user);

    const req = httpMocks.createRequest({ method: 'GET' });
    req.userId = '1'; // asegúrate de setearlo explícitamente
    const res = httpMocks.createResponse();

    await usersCtrl.getCurrentUser(req, res);

    expect(res.statusCode).toBe(200);
    const data = res._getJSONData();
    expect(data).toEqual(
      expect.objectContaining({
        firstName: user.firstName,
        lastName: user.lastName,
        userName: user.userName,
        _id: user._id,
        email: user.email,
        mobileNo: user.mobileNo,
        role: user.role,
        profilePic: user.profilePic,
      })
    );
  });

  it('✅ 200: Enviar feedback', async () => {
    const feedbackData = {
      firstName: 'John',
      lastName: 'Doe',
      country: 'Colombia',             // ← REQUERIDO por el Joi validator
      feedback: 'Great service!',
    };

    sendEmail2.mockResolvedValueOnce(true);

    const req = httpMocks.createRequest({ method: 'POST', body: feedbackData });
    const res = httpMocks.createResponse();

    await usersCtrl.sendFeedback(req, res);

    expect(res.statusCode).toBe(200);
    const data = res._getJSONData();
    expect(data.msg).toMatch(/Feedback submitted successfully/i);
  });

  it('✅ 200: Actualizar foto de perfil', async () => {
    const reqBody = { selectedImg: 'newProfilePic.png' };
    User.findByIdAndUpdate.mockResolvedValueOnce({ _id: '1', profilePic: reqBody.selectedImg });

    const req = httpMocks.createRequest({ method: 'PUT', body: reqBody });
    req.userId = '1';
    const res = httpMocks.createResponse();

    await usersCtrl.setProfilePic(req, res);

    expect(res.statusCode).toBe(200);
    const data = res._getJSONData();
    expect(data.msg).toMatch(/Profile image updated succesfully/i);
  });

  it('✅ 200: Restablecer la contraseña', async () => {
    const resetData = {
      code: 'someValidCode',
      password: 'newPassword123',
      confirmPassword: 'newPassword123',
      currTimeStamp: Date.now(),
    };

    jwt.decode.mockReturnValueOnce({
      id: '1',
      exp: Math.floor(Date.now() / 1000) + 60 * 30, // +30 min
    });

    User.findByIdAndUpdate.mockResolvedValueOnce({ _id: '1', password: resetData.password });

    const req = httpMocks.createRequest({ method: 'POST', body: resetData });
    const res = httpMocks.createResponse();

    await usersCtrl.resetPassword(req, res);

    expect(res.statusCode).toBe(200);
    const data = res._getJSONData();
    expect(data.msg).toMatch(/Password reset successfully/i);
  });
});
