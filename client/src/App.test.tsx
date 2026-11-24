// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import * as api from './api';
import { groupResponse, planResponse } from './fixtures';

vi.mock('./api');

const setGeolocation = (geo: unknown) => Object.defineProperty(navigator, 'geolocation', { value: geo, configurable: true });
const audit = async () => (await axe.run(document.body)).violations.map((v) => `${v.id}: ${v.help}`);

beforeEach(() => {
  vi.mocked(api.fetchPlan).mockReset();
  vi.mocked(api.askQuestion).mockReset();
  setGeolocation(undefined);
});
afterEach(cleanup);

describe('household flow', () => {
  it('shows the air, forecast, plan and impact with its workings, and has no accessibility violations', async () => {
    const user = userEvent.setup();
    vi.mocked(api.fetchPlan).mockResolvedValue(await planResponse());
    render(<App />);
    expect(await audit()).toEqual([]);

    await user.click(screen.getByRole('button', { name: 'Get my smog plan' }));
    expect(await screen.findByRole('heading', { name: /Air today in Delhi/ })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Best time to go out' })).toBeTruthy();
    expect(screen.getByText(/Cleanest hour:/)).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Show the maths' })).toBeTruthy();
    expect(screen.getAllByText('Assumption').length).toBeGreaterThan(0);
    expect(screen.getByRole('progressbar')).toBeTruthy();
    expect(document.activeElement?.className).toContain('results');
    expect(await audit()).toEqual([]);
  });

  it('handles a response without a forecast or CO2 savings', async () => {
    const user = userEvent.setup();
    const base = await planResponse(undefined, false);
    vi.mocked(api.fetchPlan).mockResolvedValue({
      ...base,
      totals: { pm25UgPerDay: 0, co2eKgPerMonth: 0 },
      impacts: [],
      air: { ...base.air, source: 'user-provided' },
    });
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Get my smog plan' }));
    await screen.findByRole('heading', { name: /Air today/ });
    expect(screen.queryByText(/Cleanest hour/)).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Show the maths' })).toBeNull();
    expect(screen.getByText(/the AQI you entered/)).toBeTruthy();
  });

  it('credits Google Gemini when it wrote the advice', async () => {
    const user = userEvent.setup();
    vi.mocked(api.fetchPlan).mockResolvedValue({ ...(await planResponse()), aiSource: 'gemini' });
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Get my smog plan' }));
    expect(await screen.findByText(/written by Google Gemini/)).toBeTruthy();
  });

  it('lets the user edit every household field and sends them', async () => {
    const user = userEvent.setup();
    vi.mocked(api.fetchPlan).mockResolvedValue(await planResponse());
    render(<App />);
    await user.clear(screen.getByLabelText('City or PIN code'));
    await user.type(screen.getByLabelText('City or PIN code'), 'Pune');
    await user.type(screen.getByLabelText(/Today's AQI/), '210');
    await user.clear(screen.getByLabelText('Adults'));
    await user.type(screen.getByLabelText('Adults'), '3');
    await user.clear(screen.getByLabelText('Children'));
    await user.type(screen.getByLabelText('Children'), '2');
    await user.clear(screen.getByLabelText('Older adults (65+)'));
    await user.type(screen.getByLabelText('Older adults (65+)'), '1');
    await user.selectOptions(screen.getByLabelText(/Main way you travel/), 'metro');
    await user.selectOptions(screen.getByLabelText('Cooking fuel'), 'induction');
    await user.selectOptions(screen.getByLabelText('Winter heating'), 'electric');
    await user.click(screen.getByLabelText(/asthma/));
    await user.click(screen.getByLabelText(/already own an air purifier/));
    await user.clear(screen.getByLabelText('One-way distance (km)'));
    await user.type(screen.getByLabelText('One-way distance (km)'), '8');
    await user.click(screen.getByRole('button', { name: 'Get my smog plan' }));
    await screen.findByRole('heading', { name: /Air today/ });
    expect(vi.mocked(api.fetchPlan).mock.calls[0]![0]).toMatchObject({
      audience: 'household',
      city: 'Pune',
      aqiOverride: 210,
      adults: 3,
      children: 2,
      seniors: 1,
      commuteMode: 'metro',
      cooking: 'induction',
      heating: 'electric',
      respiratoryCondition: true,
      hasPurifier: true,
      commuteKm: 8,
    });
  });

  it('shows a validation message without calling the server', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.clear(screen.getByLabelText('Adults'));
    await user.type(screen.getByLabelText('Adults'), '0');
    await user.click(screen.getByRole('button', { name: 'Get my smog plan' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Adults');
    expect(api.fetchPlan).not.toHaveBeenCalled();
  });

  it('shows server errors, and ignores an aborted request', async () => {
    const user = userEvent.setup();
    vi.mocked(api.fetchPlan).mockRejectedValueOnce(new Error('City not found'));
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Get my smog plan' }));
    expect((await screen.findByRole('alert')).textContent).toContain('City not found');
    const aborted = Object.assign(new Error('aborted'), { name: 'AbortError' });
    vi.mocked(api.fetchPlan).mockRejectedValueOnce(aborted);
    await user.click(screen.getByRole('button', { name: 'Get my smog plan' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe(''));
  });

  it('aborts the pending request when a new one starts and when the page closes', async () => {
    const user = userEvent.setup();
    vi.mocked(api.fetchPlan).mockImplementation(() => new Promise(() => {}));
    const { unmount } = render(<App />);
    await user.click(screen.getByRole('button', { name: 'Get my smog plan' }));
    expect(screen.getByRole('button', { name: /Checking air/ }).hasAttribute('disabled')).toBe(true);
    const signal = vi.mocked(api.fetchPlan).mock.calls[0]![1]!;
    unmount();
    expect(signal.aborted).toBe(true);
  });
});

describe('community flow', () => {
  it('switches mode, edits group fields and shows group results without violations', async () => {
    const user = userEvent.setup();
    vi.mocked(api.fetchPlan).mockResolvedValue(await groupResponse());
    render(<App />);
    await user.click(screen.getByLabelText(/community group/));
    expect(screen.getByRole('heading', { name: 'About your community group' })).toBeTruthy();
    await user.selectOptions(screen.getByLabelText('Type of group'), 'school');
    await user.clear(screen.getByLabelText('Number of people'));
    await user.type(screen.getByLabelText('Number of people'), '500');
    await user.clear(screen.getByLabelText(/Share who drive/));
    await user.type(screen.getByLabelText(/Share who drive/), '30');
    await user.clear(screen.getByLabelText(/Typical one-way drive/));
    await user.type(screen.getByLabelText(/Typical one-way drive/), '9');
    await user.click(screen.getByLabelText(/clean-air room/));
    await user.click(screen.getByRole('button', { name: 'Get my smog plan' }));
    expect(await screen.findByText(/Group exposure risk/)).toBeTruthy();
    expect(screen.getAllByText(/across the whole group/)).toBeTruthy();
    expect(vi.mocked(api.fetchPlan).mock.calls[0]![0]).toMatchObject({
      audience: 'community',
      groupType: 'school',
      members: 500,
      drivingSharePercent: 30,
      commuteKm: 9,
      hasCleanAirRoom: true,
    });
    expect(await audit()).toEqual([]);
    await user.click(screen.getByLabelText(/My household/));
    expect(screen.getByRole('heading', { name: 'About your household' })).toBeTruthy();
  });
});

describe('device location', () => {
  const position = (lat: number, lon: number) => ({
    getCurrentPosition: (ok: PositionCallback) => ok({ coords: { latitude: lat, longitude: lon } } as GeolocationPosition),
  });

  it('uses the rounded device position, then switches back when a place is typed', async () => {
    const user = userEvent.setup();
    setGeolocation(position(28.6139, 77.209));
    vi.mocked(api.fetchPlan).mockResolvedValue(await planResponse());
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Use my device location' }));
    expect(await screen.findByText(/Using your device location/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Get my smog plan' }));
    await screen.findByRole('heading', { name: /Air today/ });
    expect(vi.mocked(api.fetchPlan).mock.calls[0]![0]).toMatchObject({ latitude: 28.61, longitude: 77.21 });
    await user.type(screen.getByLabelText('City or PIN code'), 'x');
    expect(screen.queryByText(/Using your device location/)).toBeNull();
  });

  it('explains a denied permission and an unsupported browser', async () => {
    const user = userEvent.setup();
    setGeolocation({
      getCurrentPosition: (_: PositionCallback, fail: PositionErrorCallback) => fail({ code: 1 } as GeolocationPositionError),
    });
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Use my device location' }));
    expect(await screen.findByText(/permission was denied/)).toBeTruthy();
    setGeolocation(undefined);
    await user.click(screen.getByRole('button', { name: 'Use my device location' }));
    expect(await screen.findByText(/cannot share its location/)).toBeTruthy();
  });
});

describe('follow-up chat', () => {
  it('shows the answer, ignores blank questions, and reports failures', async () => {
    const user = userEvent.setup();
    vi.mocked(api.fetchPlan).mockResolvedValue(await planResponse());
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Get my smog plan' }));
    await screen.findByRole('heading', { name: /Air today/ });
    const chat = within(screen.getByRole('region', { name: 'Ask a follow-up question' }));
    expect(chat.getByRole('button', { name: 'Ask' }).hasAttribute('disabled')).toBe(true);

    vi.mocked(api.askQuestion).mockResolvedValueOnce({ reply: 'Wear an N95 mask.', advisor: 'rules' });
    await user.type(chat.getByLabelText(/For example/), 'Which mask?');
    await user.click(chat.getByRole('button', { name: 'Ask' }));
    expect(await screen.findByText('Wear an N95 mask.')).toBeTruthy();

    vi.mocked(api.askQuestion).mockRejectedValueOnce(new Error('Chat is down'));
    await user.click(chat.getByRole('button', { name: 'Ask' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Chat is down');
  });

  it('blocks a question when the form has become invalid, and ignores a whitespace-only question', async () => {
    const user = userEvent.setup();
    vi.mocked(api.fetchPlan).mockResolvedValue(await planResponse());
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Get my smog plan' }));
    await screen.findByRole('heading', { name: /Air today/ });
    await user.clear(screen.getByLabelText('Adults'));
    await user.type(screen.getByLabelText('Adults'), '0');
    await user.type(screen.getByLabelText(/For example/), 'Which mask?');
    await user.click(screen.getByRole('button', { name: 'Ask' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Adults');
    expect(api.askQuestion).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText(/For example/));
    await user.type(screen.getByLabelText(/For example/), '   ');
    fireEvent.submit(screen.getByLabelText(/For example/));
    expect(api.askQuestion).not.toHaveBeenCalled();
  });
});
