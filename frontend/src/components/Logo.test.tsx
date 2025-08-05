import React from 'react';
import { render, screen } from '@testing-library/react';
import { Logo } from './Logo';

describe('Logo Component', () => {
  it('renders without crashing', () => {
    render(<Logo />);
    const logoElement = screen.getByRole('img');
    expect(logoElement).toBeInTheDocument();
  });

  it('has correct alt text', () => {
    render(<Logo />);
    const logoElement = screen.getByAltText(/taskflow/i);
    expect(logoElement).toBeInTheDocument();
  });

  it('applies custom className when provided', () => {
    const customClass = 'custom-logo-class';
    render(<Logo className={customClass} />);
    const logoElement = screen.getByRole('img');
    expect(logoElement).toHaveClass(customClass);
  });

  it('has default className when not provided', () => {
    render(<Logo />);
    const logoElement = screen.getByRole('img');
    expect(logoElement).toHaveClass('h-8', 'w-auto');
  });

  it('renders with correct src', () => {
    render(<Logo />);
    const logoElement = screen.getByRole('img') as HTMLImageElement;
    expect(logoElement.src).toContain('Logo.png');
  });

  it('applies both default and custom classes', () => {
    const customClass = 'ml-4';
    render(<Logo className={customClass} />);
    const logoElement = screen.getByRole('img');
    expect(logoElement).toHaveClass('h-8', 'w-auto', customClass);
  });

  it('maintains aspect ratio', () => {
    render(<Logo />);
    const logoElement = screen.getByRole('img');
    expect(logoElement).toHaveClass('w-auto');
  });
});