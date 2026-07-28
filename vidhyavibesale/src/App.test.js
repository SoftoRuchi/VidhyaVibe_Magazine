import { render, screen } from '@testing-library/react';
import App from './App';

test('renders sales landing hero', () => {
  render(<App />);
  const heading = screen.getByRole('heading', {
    name: /give your child skills schools don't teach/i,
  });
  expect(heading).toBeInTheDocument();
});
