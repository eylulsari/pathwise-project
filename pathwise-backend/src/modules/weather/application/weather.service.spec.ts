import { ConfigService } from '@nestjs/config';
import { MemoryStoreService } from '../../../infrastructure/cache/memory-store.service';
import { WeatherService } from './weather.service';

/** A real MemoryStoreService — the cache is in-process now, so no stub needed. */
function newStore(): MemoryStoreService {
  const store = new Map<string, string>();
  return {
    get: async (k: string) => store.get(k) ?? null,
    setWithTtl: async (k: string, v: string) => void store.set(k, v),
  } as unknown as MemoryStoreService;
}

function makeService(key: string | undefined, store = newStore()) {
  const config = { get: () => key } as unknown as ConfigService;
  return new WeatherService(config, store);
}

// The exact OpenWeatherMap payload shape (real values captured from Istanbul).
const OWM_PAYLOAD = {
  weather: [{ id: 804, main: 'Clouds', description: 'overcast clouds' }],
  main: { temp: 19.1, feels_like: 19.68, humidity: 100 },
};

describe('WeatherService', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
    jest.restoreAllMocks();
  });

  it('maps a live OpenWeather response to the WeatherCrowd shape', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => OWM_PAYLOAD,
    }) as unknown as typeof fetch;

    const w = await makeService('valid-key').getCurrent();

    expect(w.source).toBe('live');
    expect(w.tempC).toBe(19); // round(19.1)
    expect(w.feelsLikeC).toBe(20); // round(19.68)
    expect(w.humidityPct).toBe(100);
    expect(w.condition).toBe('Overcast clouds'); // capitalised description
    expect(w.conditionCode).toBe(804);
    expect(w.icon).toBe('⛅'); // clouds
    expect(['Low', 'Moderate', 'High']).toContain(w.crowdLevel); // heuristic
  });

  it('falls back to the mock when no API key is configured', async () => {
    global.fetch = jest.fn(); // must not even be called
    const w = await makeService(undefined).getCurrent();
    expect(w.source).toBe('fallback');
    expect(w.city).toBe('Istanbul');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('falls back to the mock when OpenWeather returns a non-OK status', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({}),
    }) as unknown as typeof fetch;

    const w = await makeService('bad-key').getCurrent();
    expect(w.source).toBe('fallback');
  });

  it('serves the cached payload on a second call (source: cache)', async () => {
    const store = newStore();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => OWM_PAYLOAD,
    }) as unknown as typeof fetch;

    const svc = makeService('valid-key', store);
    const first = await svc.getCurrent();
    const second = await svc.getCurrent();

    expect(first.source).toBe('live');
    expect(second.source).toBe('cache');
    expect(global.fetch).toHaveBeenCalledTimes(1); // second call hit the cache
  });
});
