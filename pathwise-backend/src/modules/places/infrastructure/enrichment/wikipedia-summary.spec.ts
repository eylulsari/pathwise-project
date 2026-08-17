import { trimToSentence } from './wikipedia.client';

/**
 * Where a long lead extract is cut.
 *
 * The endpoint we call returns whole sentences, so the job here is only to
 * stop a long one from filling the modal — and to stop in a place that reads
 * as an excerpt rather than as truncated data. This is what `exchars=500` on
 * the Action API would not have given us: it cuts to a character count, mid
 * word.
 */
describe('trimToSentence', () => {
  it('leaves a summary that already fits completely alone', () => {
    const short = 'Galata Kulesi, İstanbul’un Galata semtinde bulunan bir kuledir.';
    expect(trimToSentence(short, 400)).toBe(short);
  });

  it('cuts at the last sentence that fits, keeping its full stop', () => {
    const text = 'Bir cümle. İki numaralı cümle. Üçüncü cümle burada. Dördüncü.';
    const out = trimToSentence(text, 32);
    expect(out).toBe('Bir cümle. İki numaralı cümle.');
    expect(out.endsWith('.')).toBe(true);
  });

  it('never returns more than the budget, plus nothing', () => {
    const text = 'A'.repeat(50) + '. ' + 'B'.repeat(50) + '. ' + 'C'.repeat(50) + '.';
    expect(trimToSentence(text, 120).length).toBeLessThanOrEqual(120);
  });

  it('falls back to a word boundary when one sentence is longer than the budget', () => {
    const text =
      'Bu cümle bütçeden çok daha uzun olduğu için hiçbir cümle sonu bulunamayacak ve kelime sınırına düşülecek';
    const out = trimToSentence(text, 40);
    expect(out.endsWith('…')).toBe(true);
    // The point of the word boundary: no half-word before the ellipsis.
    expect(out.replace('…', '').trimEnd()).toMatch(/\S$/);
    expect(text.startsWith(out.replace('…', '').trimEnd())).toBe(true);
  });

  it('does not cut inside a word', () => {
    const text = 'Ayasofya İstanbul’un Fatih ilçesinde kiliseden çevrilmiş bir camidir';
    const out = trimToSentence(text, 30).replace('…', '').trimEnd();
    // Whatever survives must end exactly where a word ends in the original.
    const nextChar = text.charAt(out.length);
    expect(nextChar === '' || nextChar === ' ').toBe(true);
  });

  it('handles a real extract — the longest one measured', () => {
    const ayasofya =
      'Ayasofya, resmî adıyla Ayasofya-i Kebîr Câmi-i Şerîfi, İstanbul’un Fatih ilçesinde kiliseden çevrilmiş bir camidir. Bizans İmparatoru I. Justinianus tarafından, 532-537 yılları arasında inşa ettirilmiş bazilika planlı bir patrik katedrali olmuştur. 1453 yılında İstanbul’un Osmanlılar tarafından fethedilmesinden sonra II. Mehmed tarafından camiye dönüştürülmüştür. Mustafa Kemal Atatürk tarafından 1934 yılında yayımlanan kararname ile tadilat çalışmasına alınmıştır.';
    const out = trimToSentence(ayasofya, 400);
    expect(out.length).toBeLessThanOrEqual(400);
    expect(out.endsWith('.')).toBe(true);
    expect(ayasofya.startsWith(out)).toBe(true);
  });
});
