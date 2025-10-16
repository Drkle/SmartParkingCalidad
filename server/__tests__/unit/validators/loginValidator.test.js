// __tests__/unit/validators/loginValidator.test.js
const { loginValidator } = require('/Calidad/SmartParking/Smart-Parking-Web-App-main/server/validators/joi-validator');

describe('loginValidator', () => {
  it('debería rechazar si falta el campo email o es inválido', () => {
    // Sin email
    const { error } = loginValidator.validate({
      password: 'password123'
    });
    expect(error).toBeTruthy();
    expect(error.details[0].message).toBe('"email" is required');

    // Email inválido
    const { error: errorInvalidEmail } = loginValidator.validate({
      email: 'invalidEmail',
      password: 'password123'
    });
    expect(errorInvalidEmail).toBeTruthy();
    expect(errorInvalidEmail.details[0].message).toBe('"email" must be a valid email');
  });

  it('debería rechazar si el password es demasiado corto', () => {
    const { error } = loginValidator.validate({
      email: 'user@example.com',
      password: 'short'
    });
    expect(error).toBeTruthy();
    expect(error.details[0].message).toBe('"password" length must be at least 6 characters long');
  });

  it('debería aceptar datos válidos', () => {
    const { error } = loginValidator.validate({
      email: 'user@example.com',
      password: 'password123'
    });
    expect(error).toBeFalsy();
  });
});
