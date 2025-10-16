module.exports = {
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn(async () => ({ status: 201 })),
};
