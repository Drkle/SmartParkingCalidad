const { resetMailValidator } = require('/Calidad/SmartParking/Smart-Parking-Web-App-main/server/validators/joi-validator');

describe("resetMailValidator", () => {
  it("rechaza si falta email", () => {
    const { error } = resetMailValidator.validate({});
    expect(error).toBeTruthy();
    expect(error.details[0].message).toBe('"email" is required');
  });

  it("rechaza si el email es inválido", () => {
    const { error } = resetMailValidator.validate({ email: "bad" });
    expect(error).toBeTruthy();
    expect(error.details[0].message).toBe('"email" must be a valid email');
  });

  it("acepta email válido", () => {
    const { error } = resetMailValidator.validate({ email: "user@example.com" });
    expect(error).toBeFalsy();
  });
});
