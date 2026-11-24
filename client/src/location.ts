export interface Coordinates {
  latitude: number;
  longitude: number;
}

/** Two decimals is about 1 km: enough for city-level air quality, too coarse to point at a home. */
const round2 = (value: number) => Math.round(value * 100) / 100;

const MESSAGES: Record<number, string> = {
  1: 'Location permission was denied. Type your city or PIN code instead.',
  2: 'Your location could not be found. Type your city or PIN code instead.',
  3: 'Finding your location took too long. Type your city or PIN code instead.',
};

export const NO_GEOLOCATION = 'This browser cannot share its location. Type your city or PIN code instead.';

/** Asks the browser for the device location, once, and rounds it before it is used. */
export function getDeviceLocation(geolocation: Geolocation | undefined): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (!geolocation) {
      reject(new Error(NO_GEOLOCATION));
      return;
    }
    geolocation.getCurrentPosition(
      (position) => resolve({ latitude: round2(position.coords.latitude), longitude: round2(position.coords.longitude) }),
      (error) => reject(new Error(MESSAGES[error.code] ?? MESSAGES[2])),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 600_000 },
    );
  });
}
