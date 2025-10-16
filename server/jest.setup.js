// server/jest.setup.js

// Entorno de pruebas
process.env.NODE_ENV = 'test';

// Variables que tu código REAL usa (coinciden con Utils/razorPayInstance.js)
process.env.RAZORPAY_API_KEY = 'rk_test';
process.env.RAZORPAY_API_SECRET = 'rk_test_secret';

// VAPID / Web Push (aunque lo estamos mockeando, dejamos valores por si tu app los lee)
process.env.WEB_PUSH_CONTACT = 'mailto:test@example.com';
process.env.PUBLIC_VAPID_KEY = 'public';
process.env.PRIVATE_VAPID_KEY = 'private';

// Silenciar logs ruidosos
jest.spyOn(console, 'error').mockImplementation(() => {});
jest.spyOn(console, 'warn').mockImplementation(() => {});

// ACTIVAR mocks de dependencias externas
jest.mock('razorpay');   // usará server/__mocks__/razorpay.js
jest.mock('web-push');   // usará server/__mocks__/web-push.js


