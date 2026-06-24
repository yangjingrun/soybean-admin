import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildChineseGeoCityNameRowFromAlternateLine,
  buildGeoCityImportBaseFromCityLine,
  buildGeoCityNameRowsFromCityLine,
  normalizeGeoNameKey
} from './geonames-timezone-import';

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

  it('builds trusted Chinese rows from GeoNames alternateNamesV2 lines', () => {
    const cityBase = buildGeoCityImportBaseFromCityLine(
      [
        '1795565',
        'Shenzhen',
        'Shenzhen',
        'Baoan,Shenzhen,宝安,深圳',
        '22.54554',
        '114.0683',
        'P',
        'PPLA2',
        'CN',
        '',
        '30',
        '',
        '',
        '',
        '17400000',
        '',
        '4',
        'Asia/Shanghai',
        '2025-01-01'
      ].join('\t')
    );
    assert.ok(cityBase);

    const row = buildChineseGeoCityNameRowFromAlternateLine(
      ['1001', '1795565', 'zh', '深圳', '1', '0', '0', '0'].join('\t'),
      new Map([[cityBase.geonameId, cityBase]])
    );

    assert.deepEqual(row, {
      geonameId: 1795565,
      countryCode: 'CN',
      name: '深圳',
      normalizedName: '深圳',
      asciiName: 'Shenzhen',
      timeZone: 'Asia/Shanghai',
      population: 17400000,
      latitude: 22.54554,
      longitude: 114.0683,
      nameSource: 'alternate',
      languageCode: 'zh',
      isPreferred: true,
      isShort: false
    });
    assert.equal(
      buildChineseGeoCityNameRowFromAlternateLine(
        ['1002', '1795565', 'en', 'Shenzhen', '1', '0', '0', '0'].join('\t'),
        new Map([[cityBase.geonameId, cityBase]])
      ),
      null
    );
    assert.equal(
      buildChineseGeoCityNameRowFromAlternateLine(
        ['1003', '1795565', 'yue', 'Sam Zan', '1', '0', '0', '0'].join('\t'),
        new Map([[cityBase.geonameId, cityBase]])
      ),
      null
    );
  });
});
