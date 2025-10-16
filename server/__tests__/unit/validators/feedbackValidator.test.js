// __tests__/unit/validators/feedbackValidator.test.js

const { feedbackValidator } = require('/Calidad/SmartParking/Smart-Parking-Web-App-main/server/validators/joi-validator');

describe('feedbackValidator', () => {
  it('debería rechazar si falta el campo firstName', () => {
    const { error } = feedbackValidator.validate({
      lastName: 'Pérez',
      country: 'Colombia',
      feedback: 'Buen servicio'
    });
    expect(error).toBeTruthy();
    expect(error.details[0].message).toBe('"firstName" is required');
  });

  it('debería rechazar si falta el campo lastName', () => {
    const { error } = feedbackValidator.validate({
      firstName: 'Juan',
      country: 'Colombia',
      feedback: 'Buen servicio'
    });
    expect(error).toBeTruthy();
    expect(error.details[0].message).toBe('"lastName" is required');
  });

  it('debería rechazar si el campo firstName tiene menos de 2 caracteres', () => {
    const { error } = feedbackValidator.validate({
      firstName: 'J',
      lastName: 'Pérez',
      country: 'Colombia',
      feedback: 'Buen servicio'
    });
    expect(error).toBeTruthy();
    expect(error.details[0].message).toBe('"firstName" length must be at least 2 characters long');
  });

  it('debería rechazar si el campo lastName tiene más de 40 caracteres', () => {
    const { error } = feedbackValidator.validate({
      firstName: 'Juan',
      lastName: 'Pérez'.repeat(10),  // Más de 40 caracteres
      country: 'Colombia',
      feedback: 'Buen servicio'
    });
    expect(error).toBeTruthy();
    expect(error.details[0].message).toBe('"lastName" length must be less than or equal to 40 characters long');
  });

  it('debería aceptar un payload válido', () => {
    const { error } = feedbackValidator.validate({
      firstName: 'Juan',
      lastName: 'Pérez',
      country: 'Colombia',
      feedback: 'Buen servicio'
    });
    expect(error).toBeFalsy(); // No debería haber error
  });
});
