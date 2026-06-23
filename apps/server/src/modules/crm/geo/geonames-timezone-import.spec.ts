import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildGeoCityNameRowsFromCityLine, normalizeGeoNameKey } from './geonames-timezone-import';

describe('geonames-timezone-import', () => {
  it('builds searchable city name rows from a GeoNames city line', () => {
    const rows = buildGeoCityNameRowsFromCityLine(
      [
        '108410',
        'Riyadh',
        'Riyadh',
        'Riyadh,Ar Riyad,الرياض,利雅得',
        '24.68773',
        '46.72185',
        'P',
        'PPLC',
        'SA',
        '',
        '10',
        '',
        '',
        '',
        '4205961',
        '',
        '612',
        'Asia/Riyadh',
        '2025-01-01'
      ].join('\t')
    );

    assert.equal(
      rows.some(row => row.name === 'الرياض' && row.normalizedName === 'الرياض'),
      true
    );
    assert.equal(
      rows.some(row => row.name === 'Riyadh' && row.timeZone === 'Asia/Riyadh'),
      true
    );
    assert.equal(
      rows.every(row => row.countryCode === 'SA'),
      true
    );
  });

  it('normalizes accents, case, and repeated spacing for lookup keys', () => {
    assert.equal(normalizeGeoNameKey('  São   Paulo '), 'sao paulo');
    assert.equal(normalizeGeoNameKey('İstanbul'), 'istanbul');
  });
});
