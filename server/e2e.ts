// Test-only server: the real app with a stub air provider, so browser tests never depend on the network.
import { RuleBasedService } from './ai/ruleBasedService';
import { createApp } from './app';
import type { AirQualityProvider } from './data/airQuality';

const hours = Array.from({ length: 24 }, (_, i) => ({
  time: `2026-11-22T${String(i).padStart(2, '0')}:00`,
  usAqi: 120 + ((i * 13) % 90),
  pm25: 60 + i,
}));

const air: AirQualityProvider = {
  get: async (location, aqiOverride) => ({
    city: location.city,
    usAqi: aqiOverride ?? 180,
    pm25: 100,
    source: aqiOverride === undefined ? 'open-meteo' : 'user-provided',
    fetchedAt: new Date().toISOString(),
    forecast: hours,
  }),
};

createApp({ ai: new RuleBasedService(), air, corsOrigins: [], staticDir: 'dist/client' }).listen(4173, () =>
  console.log('e2e server on 4173'),
);
