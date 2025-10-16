const { resetPassValidator } = require('/Calidad/SmartParking/Smart-Parking-Web-App-main/server/validators/joi-validator');

describe("resetPassValidator", () => {
  it("rechaza si falta password", () => {
    const { error } = resetPassValidator.validate({
      confirmPassword: "abcdef",
      code: "ABC123",
      currTimeStamp: 1710000000000
    });
    expect(error).toBeTruthy();
    expect(error.details[0].message).toBe('"password" is required');
  });

  it("rechaza si falta confirmPassword", () => {
    const { error } = resetPassValidator.validate({
      password: "abcdef",
      code: "ABC123",
      currTimeStamp: 1710000000000
    });
    expect(error).toBeTruthy();
    expect(error.details[0].message).toBe('"confirmPassword" is required');
  });

  it("rechaza si falta code", () => {
    const { error } = resetPassValidator.validate({
      password: "abcdef",
      confirmPassword: "abcdef",
      currTimeStamp: 1710000000000
    });
    expect(error).toBeTruthy();
    expect(error.details[0].message).toBe('"code" is required');
  });

  it("rechaza si falta currTimeStamp", () => {
    const { error } = resetPassValidator.validate({
      password: "abcdef",
      confirmPassword: "abcdef",
      code: "ABC123"
    });
    expect(error).toBeTruthy();
    expect(error.details[0].message).toBe('"currTimeStamp" is required');
  });

  it("acepta payload válido (sin exigir match entre password y confirmPassword)", () => {
    const { error } = resetPassValidator.validate({
      password: "abcdef",
      confirmPassword: "abcdef",
      code: "ABC123",
      currTimeStamp: 1710000000000
    });
    expect(error).toBeFalsy();
  });
});
