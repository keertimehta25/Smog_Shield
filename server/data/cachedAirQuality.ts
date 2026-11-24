import type { AirQuality } from '../../shared/schemas';
import type { AirQualityProvider, LocationQuery } from './airQuality';

export interface CacheOptions {
  /** How long a reading is reused, in milliseconds. */
  ttlMs?: number;
  /** The most places remembered at once; the oldest is dropped first. */
  maxEntries?: number;
  now?: () => number;
}

const DEFAULT_TTL_MS = 10 * 60 * 1000;
const DEFAULT_MAX_ENTRIES = 200;

/** Same place, same cache key: by rounded coordinates when given, otherwise by lower-cased name. */
export function cacheKey(location: LocationQuery): string {
  if (location.latitude !== undefined && location.longitude !== undefined) {
    return `geo:${location.latitude.toFixed(2)},${location.longitude.toFixed(2)}`;
  }
  return `name:${location.city.trim().toLowerCase()}`;
}

/**
 * Decorator: wraps any provider so repeat visits to the same place within a few minutes reuse one
 * upstream call. Manual AQI values are never cached because they do not touch the network.
 */
export class CachedAirQualityProvider implements AirQualityProvider {
  private readonly entries = new Map<string, { at: number; value: AirQuality }>();
  private readonly ttlMs: number;
  private readonly maxEntries: number;
  private readonly now: () => number;

  constructor(
    private readonly inner: AirQualityProvider,
    options: CacheOptions = {},
  ) {
    this.ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
    this.maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
    this.now = options.now ?? Date.now;
  }

  async get(location: LocationQuery, aqiOverride?: number): Promise<AirQuality> {
    if (aqiOverride !== undefined) return this.inner.get(location, aqiOverride);

    const key = cacheKey(location);
    const hit = this.entries.get(key);
    if (hit && this.now() - hit.at < this.ttlMs) return hit.value;

    const value = await this.inner.get(location);
    this.entries.delete(key);
    this.entries.set(key, { at: this.now(), value });
    if (this.entries.size > this.maxEntries) {
      // Maps keep insertion order, so the first key is the oldest.
      this.entries.delete(this.entries.keys().next().value!);
    }
    return value;
  }
}
