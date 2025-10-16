import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from '../../pages/LoginPage.jsx';

// MOCK API con exportaciones con nombre
jest.mock('../../api', () => ({
  __esModule: true,
  signIn: jest.fn(),
  // si el componente usa otras (e.g., getCurrentUser) añádelas aquí con jest.fn()
}));

import { signIn } from '../../api';

const setup = () => {
  render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>
  );
};

describe('LoginPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('muestra error si las credenciales son inválidas', async () => {
    signIn.mockRejectedValueOnce({ response: { data: { msg: 'Invalid credentials' } } });

    setup();

    const email = screen.queryByLabelText(/email/i) || screen.getByPlaceholderText(/email/i);
    const password = screen.queryByLabelText(/password|contraseña/i) || screen.getByPlaceholderText(/password|contraseña/i);
    const submit = screen.getByRole('button', { name: /ingresar|login|entrar/i });

    await userEvent.type(email, 'wrong@example.com');
    await userEvent.type(password, 'bad');
    await userEvent.click(submit);

    expect(await screen.findByText(/invalid credentials/i)).toBeInTheDocument();
  });

  test('login OK: llama a signIn y muestra señal de éxito/continúa flujo', async () => {
    signIn.mockResolvedValueOnce({ data: { token: 'fake-token' } });

    setup();

    const email = screen.queryByLabelText(/email/i) || screen.getByPlaceholderText(/email/i);
    const password = screen.queryByLabelText(/password|contraseña/i) || screen.getByPlaceholderText(/password|contraseña/i);
    const submit = screen.getByRole('button', { name: /ingresar|login|entrar/i });

    await userEvent.type(email, 'valid@example.com');
    await userEvent.type(password, 'secret');
    await userEvent.click(submit);

    expect(signIn).toHaveBeenCalledTimes(1);
    // si tu UI muestra “Bienvenido” o navega, puedes asertar eso:
    // expect(await screen.findByText(/bienvenido|logged/i)).toBeInTheDocument();
  });
});
