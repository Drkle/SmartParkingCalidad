const { latLonValidator } = require('/Calidad/SmartParking/Smart-Parking-Web-App-main/server/validators/joi-validator');

describe("latLonValidator", () => {
  it("rechaza si falta lat", () => {
    const { error } = latLonValidator.validate({ lng: "-74.0" });
    expect(error).toBeTruthy();
    expect(error.details[0].message).toBe('"lat" is required');
  });

  it("rechaza si falta lng", () => {
    const { error } = latLonValidator.validate({ lat: "40.7" });
    expect(error).toBeTruthy();
    expect(error.details[0].message).toBe('"lng" is required');
  });

  it("acepta lat y lng válidos (como strings)", () => {
    const { error } = latLonValidator.validate({ lat: "40.7128", lng: "-74.0060" });
    expect(error).toBeFalsy();
  });
});
