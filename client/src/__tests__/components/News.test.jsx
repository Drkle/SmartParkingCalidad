import { render, screen } from '@testing-library/react';
import News from '../../components/NewsComponents/News.jsx';

jest.mock('../../api', () => ({
  __esModule: true,
  getNews: jest.fn(),
}));
import { getNews } from '../../api';

describe('News', () => {
  beforeEach(() => jest.clearAllMocks());

  test('muestra loading y luego noticias', async () => {
    getNews.mockResolvedValueOnce({
      data: {
        msg: 'News fetched',
        news: [
          { title: 'Tech 1', description: 'A', url: '#1' },
          { title: 'Tech 2', description: 'B', url: '#2' },
        ],
      },
    });

    render(<News />);

    // Ajusta si tu componente usa otro texto/spinner
    expect(screen.getByText(/loading|cargando/i)).toBeInTheDocument();

    expect(await screen.findByText(/Tech 1/i)).toBeInTheDocument();
    expect(screen.getByText(/Tech 2/i)).toBeInTheDocument();
  });

  test('muestra error si falla la API', async () => {
    getNews.mockRejectedValueOnce(new Error('network'));

    render(<News />);

    expect(await screen.findByText(/something went wrong|error/i)).toBeInTheDocument();
  });
});
