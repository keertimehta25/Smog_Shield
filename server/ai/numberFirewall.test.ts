import { describe, expect, it } from 'vitest';
import { allowedNumbers, assertNoInventedNumbers, findInventedNumbers, InventedNumberError } from './numberFirewall';

const allowed = allowedNumbers('{"usAqi":180,"value":168,"fraction":0.6,"big":2657.6,"pm25":100}');

describe('allowedNumbers', () => {
  it('collects every number in the facts, with percent forms of fractions and the N95 standard', () => {
    expect(allowed).toEqual(expect.arrayContaining([180, 168, 0.6, 60, 2657.6, 100, 95]));
  });

  it('handles facts with no digits, and thousands separators', () => {
    expect(allowedNumbers('no digits here')).toEqual([95]);
    expect(allowedNumbers('about 12,000 people')).toContain(12_000);
  });
});

describe('findInventedNumbers', () => {
  it('accepts figures that come from the facts', () => {
    expect(findInventedNumbers('About 168 µg of PM2.5 and 2657.6 kg CO2e, a 60% cut, 95% filtration.', allowed)).toEqual([]);
  });

  it('allows a figure rounded to a whole number or one decimal, and thousands separators', () => {
    expect(findInventedNumbers('about 2,658 kg, 2657.6 kg, 168.04 µg', allowed)).toEqual([]);
  });

  it('does not let a made-up figure pass just because a nearby number is in the facts', () => {
    // 168 is allowed, 70 (from the 0.7 fraction) is allowed, 90 is allowed; 170, 73 and 88 are not.
    expect(findInventedNumbers('170 µg, 73%, 88%', allowedNumbers('{"a":168,"b":0.7,"c":90}'))).toEqual(['170 µg', '73%', '88%']);
  });

  it('flags a figure with a unit that is not in the facts', () => {
    expect(findInventedNumbers('This cuts exposure by 40% and saves 12 kg and 5 ug and 3 g.', allowed)).toEqual([
      '40%',
      '12 kg',
      '5 ug',
      '3 g',
    ]);
  });

  it('ignores numbers without those units: times, sizes, counts, standards', () => {
    expect(findInventedNumbers('Open windows for 10 minutes, leave 30 cm of space, wear an N95, 2 people, 5 gallons.', allowed)).toEqual(
      [],
    );
  });
});

describe('assertNoInventedNumbers', () => {
  it('passes clean text and throws a descriptive error for invented figures', () => {
    expect(() => assertNoInventedNumbers('About 168 µg.', allowed)).not.toThrow();
    try {
      assertNoInventedNumbers('A 40% drop and 7 kg saved.', allowed);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(InventedNumberError);
      expect((error as InventedNumberError).claims).toEqual(['40%', '7 kg']);
      expect((error as Error).message).toContain('40%, 7 kg');
    }
  });
});
