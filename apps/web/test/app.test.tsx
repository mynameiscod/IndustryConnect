// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../src/App.js';
const expert = {
  id: 'expert1',
  slug: 'demo-expert',
  name: 'Demo Expert',
  headline: 'Thoughtful career conversations',
  city: 'Hyderabad',
  experienceYears: 10,
  languages: ['English'],
  reviewCount: 0,
  rating: null,
  services: [{ id: 's1', mode: 'online', pricePaise: 150000 }],
};
beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: RequestInfo | URL) => {
      const path = String(url);
      let status = 200,
        data: any = {};
      if (path === '/api/me') {
        status = 401;
        data = { error: { message: 'Please sign in' } };
      } else if (path.startsWith('/api/categories')) data = { items: [], total: 0 };
      else if (path.startsWith('/api/experts?')) data = { items: [expert], total: 1 };
      else if (path === '/api/config')
        data = { betaAccess: 'invite', googleClientId: '', checkoutEnabled: false };
      return { ok: status < 400, status, json: async () => data } as Response;
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe('customer UI', () => {
  it('shows stored verified stories without inventing customer identities', async () => {
    const fallback = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation(async (url, init) => {
      const path = String(url);
      if (path.startsWith('/api/experts?'))
        return {
          ok: true,
          json: async () => ({ items: [{ ...expert, reviewCount: 1, rating: 5 }], total: 1 }),
        } as Response;
      if (path === '/api/experts/demo-expert')
        return {
          ok: true,
          json: async () => ({
            name: expert.name,
            reviews: [
              { _id: 'r1', rating: 5, text: 'Practical feedback from my completed session.' },
            ],
          }),
        } as Response;
      return fallback(url, init);
    });
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );
    expect(await screen.findByText(/Practical feedback from my completed session/)).toBeTruthy();
    expect(screen.getByText('Verified customer')).toBeTruthy();
    expect(screen.queryByText('Karthik N.')).toBeNull();
  });
  it('takes the footer email to sign-in without claiming a newsletter subscription', async () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );
    await screen.findByText('Demo Expert');
    fireEvent.change(screen.getByLabelText('Your email address'), {
      target: { value: 'local@example.invalid' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue with email' }));
    await screen.findByRole('heading', { name: 'Welcome back' });
    expect((screen.getByLabelText('Email address') as HTMLInputElement).value).toBe(
      'local@example.invalid',
    );
  });
  it('opens mobile navigation and closes it after following a link', async () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );
    await screen.findByText('Demo Expert');
    const toggle = screen.getByRole('button', { name: 'Toggle navigation' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(screen.getByRole('link', { name: 'Explore experts' }));
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });
  it('shows API-backed experts without fabricated ratings', async () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );
    expect(await screen.findByText('Demo Expert')).toBeTruthy();
    expect(screen.getByText('New expert')).toBeTruthy();
    expect(screen.getByText(/₹1,500(?:\.00)?/)).toBeTruthy();
    expect(screen.queryByText('4.9')).toBeNull();
  });
  it('submits search and price filters to the API', async () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );
    await screen.findByText('Demo Expert');
    fireEvent.change(screen.getByLabelText('Search experts'), { target: { value: 'design' } });
    fireEvent.click(screen.getByRole('button', { name: 'Find an expert' }));
    await waitFor(() =>
      expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('q=design'))).toBe(
        true,
      ),
    );
    fireEvent.change(screen.getByLabelText('Maximum price'), { target: { value: '2500' } });
    await waitFor(() =>
      expect(
        vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('maxPrice=250000')),
      ).toBe(true),
    );
  });
  it('routes unauthenticated dashboards to sign-in', async () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <App />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeTruthy();
    expect(await screen.findByText('Our controlled beta is invitation-only.')).toBeTruthy();
  });
  it('surfaces API errors without showing fake sample profiles', async () => {
    vi.mocked(fetch).mockImplementation(
      async () =>
        ({
          ok: false,
          status: 503,
          json: async () => ({ error: { message: 'Marketplace is temporarily unavailable' } }),
        }) as Response,
    );
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );
    const alerts = await screen.findAllByRole('alert');
    expect(alerts.length).toBeGreaterThan(0);
    for (const alert of alerts)
      expect(alert.textContent).toContain('Marketplace is temporarily unavailable');
    expect(screen.queryByText('Demo Expert')).toBeNull();
  });
});
