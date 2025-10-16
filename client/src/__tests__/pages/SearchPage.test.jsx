import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import SearchPage from '../../pages/SearchPage.jsx';

jest.mock('../../api', () => ({
  __esModule: true,
  getFreeParkingLots: jest.fn(),
}));

import { getFreeParkingLots } from '../../api';

const setup = () => {
  render(
    <MemoryRouter>
      <SearchPage />
    </MemoryRouter>
  );
};

describe('SearchPage', () => {
  beforeEach(() => jest.clearAllMocks());

  test('muestra error si el backend responde 400 (time frame inválido)', async () => {
    getFreeParkingLots.mockRejectedValueOnce({ response: { data: { msg: 'Please Enter a Valid time frame' } } });

    setup();

    const start = screen.queryByLabelText(/inicio|start/i) || screen.getByPlaceholderText(/inicio|start/i);
    const end = screen.queryByLabelText(/fin|end/i) || screen.getByPlaceholderText(/fin|end/i);
    const buscar = screen.getByRole('button', { name: /buscar|search/i });

    await userEvent.type(start, '2025-10-10T10:00');
    await userEvent.type(end, '2025-10-10T10:00');
    await userEvent.click(buscar);

    expect(await screen.findByText(/valid time frame/i)).toBeInTheDocument();
  });

  test('renderiza resultados cuando la API responde OK', async () => {
    getFreeParkingLots.mockResolvedValueOnce({
      data: {
        msg: 'Free parking lots returned',
        freeParkingLots: [
          { id: 'L1', name: 'Lot Centro', charges: 40, address: 'Calle 123' },
          { id: 'L2', name: 'Lot Norte', charges: 0, address: 'Av 45' },
        ],
      },
    });

    setup();

    const start = screen.queryByLabelText(/inicio|start/i) || screen.getByPlaceholderText(/inicio|start/i);
    const end = screen.queryByLabelText(/fin|end/i) || screen.getByPlaceholderText(/fin|end/i);
    const buscar = screen.getByRole('button', { name: /buscar|search/i });

    await userEvent.type(start, '2025-10-10T10:00');
    await userEvent.type(end, '2025-10-10T12:00');
    await userEvent.click(buscar);

    expect(await screen.findByText(/Lot Centro/i)).toBeInTheDocument();
    expect(screen.getByText(/Lot Norte/i)).toBeInTheDocument();
  });
});
