// __tests__/unit/validators/sendOTPValidator.test.js
const { sendOTPValidator } = require('/Calidad/SmartParking/Smart-Parking-Web-App-main/server/validators/joi-validator'); // Asegúrate de que la ruta sea correcta

describe('sendOTPValidator', () => {
  it('debería rechazar si falta el campo email', () => {
    const { error } = sendOTPValidator.validate({
      firstName: 'Juan',
      lastName: 'Pérez',
      userName: 'juanperez',
      mobileNo: '1234567890',
      password: 'password123',
      confirmPassword: 'password123',
      currTimeStamp: 1617901234567
    });
    expect(error).toBeTruthy();
    expect(error.details[0].message).toBe('"email" is required');
  });

  it('debería aceptar datos válidos', () => {
    const { error } = sendOTPValidator.validate({
      firstName: 'Juan',
      lastName: 'Pérez',
      userName: 'juanperez',
      mobileNo: '1234567890',
      email: 'juan@example.com',
      password: 'password123',
      confirmPassword: 'password123',
      currTimeStamp: 1617901234567
    });
    expect(error).toBeFalsy();
  });
});
