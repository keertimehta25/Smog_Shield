import { describe, expect, it, vi } from 'vitest';
import { getDeviceLocation, NO_GEOLOCATION } from './location';

const fake = (behaviour: (ok: PositionCallback, fail: PositionErrorCallback) => void) =>
  ({ getCurrentPosition: vi.fn(behaviour) }) as unknown as Geolocation;

describe('getDeviceLocation', () => {
  it('rounds the position to two decimals and asks for low accuracy', async () => {
    const geo = fake((ok) => ok({ coords: { latitude: 28.613939, longitude: 77.209021 } } as GeolocationPosition));
    expect(await getDeviceLocation(geo)).toEqual({ latitude: 28.61, longitude: 77.21 });
    expect((geo.getCurrentPosition as ReturnType<typeof vi.fn>).mock.calls[0]![2]).toMatchObject({ enableHighAccuracy: false });
  });

  it('explains a denied, unavailable, timed-out or unknown failure', async () => {
    const failing = (code: number) => getDeviceLocation(fake((_, fail) => fail({ code } as GeolocationPositionError)));
    await expect(failing(1)).rejects.toThrow(/denied/);
    await expect(failing(2)).rejects.toThrow(/could not be found/);
    await expect(failing(3)).rejects.toThrow(/too long/);
    await expect(failing(99)).rejects.toThrow(/could not be found/);
  });

  it('reports a browser without geolocation', async () => {
    await expect(getDeviceLocation(undefined)).rejects.toThrow(NO_GEOLOCATION);
  });
});
