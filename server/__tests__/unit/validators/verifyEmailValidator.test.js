const { verifyEmailValidator } = require('/Calidad/SmartParking/Smart-Parking-Web-App-main/server/validators/joi-validator');

describe("verifyEmailValidator", () => {
  it("rechaza si falta email", () => {
    const { error } = verifyEmailValidator.validate({ otp: "123456" });
    expect(error).toBeTruthy();
    expect(error.details[0].message).toBe('"email" is required');
  });

  it("rechaza si el email es inválido", () => {
    const { error } = verifyEmailValidator.validate({ email: "not-an-email" });
    expect(error).toBeTruthy();
    expect(error.details[0].message).toBe('"email" must be a valid email');
  });

  it("acepta con email válido y sin otp (otp es opcional)", () => {
    const { error } = verifyEmailValidator.validate({ email: "user@example.com" });
    expect(error).toBeFalsy();
  });

  it("acepta con email válido y otp presente", () => {
    const { error } = verifyEmailValidator.validate({ email: "user@example.com", otp: "123456" });
    expect(error).toBeFalsy();
  });
});
