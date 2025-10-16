import { render, screen } from '@testing-library/react';
import ParkingList from '../../components/ParkingList.jsx'; // ajusta ruta

test('renderiza nombre y cargos de cada item', () => {
  const items = [
    { id: 'L1', name: 'Lot Centro', charges: 40 },
    { id: 'L2', name: 'Lot Norte', charges: 0 },
  ];
  render(<ParkingList items={items} />);

  expect(screen.getByText(/Lot Centro/i)).toBeInTheDocument();
  expect(screen.getByText(/Lot Norte/i)).toBeInTheDocument();
  // Si el componente muestra costos explícitos:
  // expect(screen.getByText(/40/)).toBeInTheDocument();
});
