import { planLeg, TransitPoint } from './transit';

/**
 * These are the cases the old distance-threshold model got wrong. Each one was
 * observed in a real generated day before the side-aware model replaced it, so
 * they are regressions, not hypotheticals.
 */

const at = (
  name: string,
  lat: number,
  lng: number,
  side: TransitPoint['side'],
  island?: string,
): TransitPoint => ({ name, lat, lng, side, island });

// Real coordinates from the dataset.
const kucukAyasofya = at('Küçük Ayasofya', 41.0028, 28.9722, 'European');
const kadikoyCarsi = at('Kadıköy Çarşı', 40.9903, 29.0277, 'Asian');
const camlicaTepesi = at('Çamlıca Tepesi', 41.0289, 29.0693, 'Asian');
const fethiPasaKorusu = at('Fethi Paşa Korusu', 41.0219, 29.0333, 'Asian');
const hagiaSophia = at('Hagia Sophia', 41.0086, 28.9802, 'European');
const blueMosque = at('Blue Mosque', 41.0054, 28.9768, 'European');
const buyukadaIskele = at('Büyükada İskelesi', 40.8749, 29.1283, 'Islands', 'Büyükada');
const ayaYorgi = at('Aya Yorgi Kilisesi', 40.8503, 29.1196, 'Islands', 'Büyükada');
const heybeliadaSahil = at('Heybeliada Sahili', 40.8767, 29.0894, 'Islands', 'Heybeliada');

describe('planLeg', () => {
  it('walks a short hop on the same shore', () => {
    const leg = planLeg(hagiaSophia, blueMosque);
    expect(leg.mode).toBe('walk');
    expect(leg.durationMinutes).toBeLessThan(15);
  });

  it('does NOT put a ferry between two inland stops on the same shore', () => {
    // Çamlıca → Fethi Paşa Korusu is 4 km of Asian-side road. The old model saw
    // "over 3 km" and sold the traveller a boat ticket for it.
    const leg = planLeg(camlicaTepesi, fethiPasaKorusu);
    expect(leg.mode).not.toBe('ferry');
    expect(leg.mode).toBe('bus');
  });

  it('crosses the Bosphorus by ferry, and charges the day for the whole crossing', () => {
    const leg = planLeg(kucukAyasofya, kadikoyCarsi);
    expect(leg.mode).toBe('ferry');
    // The old model said 20 minutes — the crossing alone, with the walk to the
    // pier and the wait for the boat quietly free.
    expect(leg.durationMinutes).toBeGreaterThanOrEqual(45);
    expect(leg.label).toMatch(/wait/);
  });

  it('takes a ferry between two islands rather than walking onto the water', () => {
    // Heybeliada → Büyükada came out as "🚋 Tram / short ride (~10 min)".
    const leg = planLeg(heybeliadaSahil, buyukadaIskele);
    expect(leg.mode).toBe('ferry');
    expect(leg.durationMinutes).toBeGreaterThanOrEqual(45);
  });

  it('does not invent a walk between two stops at the same spot', () => {
    // The ferry ride, the carriage tour and the bike hire all start at the
    // Büyükada pier and share its coordinate. The engine used to bill that as
    // "🚶 2 min walk (0m)".
    const ferryRide = at('Adalar Vapur Yolculuğu', 40.8749412, 29.1283038, 'Islands', 'Büyükada');
    const leg = planLeg(buyukadaIskele, ferryRide);
    expect(leg.durationMinutes).toBe(0);
    expect(leg.label).not.toMatch(/walk/i);
  });

  it('does not offer a tram on an island that bans cars', () => {
    const prinkipo = at('Prinkipo', 40.8657, 29.1215, 'Islands', 'Büyükada');
    const leg = planLeg(ayaYorgi, prinkipo);
    expect(leg.label).not.toMatch(/tram|metro|bus/i);
    expect(leg.label).toMatch(/shuttle|bike|walk/i);
  });

  it('stays on foot within a single island', () => {
    // Same distance band as the inter-island hop above — only the island name
    // separates them, which is why the model needs it.
    const leg = planLeg(buyukadaIskele, ayaYorgi);
    expect(leg.mode).not.toBe('ferry');
  });

  it('treats an island-to-mainland run as the two-hour journey it is', () => {
    const leg = planLeg(kadikoyCarsi, ayaYorgi);
    expect(leg.mode).toBe('ferry');
    expect(leg.durationMinutes).toBeGreaterThanOrEqual(120);
  });

  it('is symmetric — direction never changes the mode', () => {
    for (const [a, b] of [
      [kucukAyasofya, kadikoyCarsi],
      [heybeliadaSahil, buyukadaIskele],
      [camlicaTepesi, fethiPasaKorusu],
    ] as const) {
      expect(planLeg(a, b).mode).toBe(planLeg(b, a).mode);
      expect(planLeg(a, b).durationMinutes).toBe(planLeg(b, a).durationMinutes);
    }
  });
});
