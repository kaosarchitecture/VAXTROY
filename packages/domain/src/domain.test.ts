import { describe, expect, it } from 'vitest';
import { DomainError } from './errors.ts';
import { addMoney, formatTry, money, multiplyMoney } from './money.ts';
import { tableStatus } from './catalog.ts';
import {
  assertCanAddLine,
  assertCanClose,
  assertCanSendToKitchen,
  lineTotal,
  mergedQuantity,
  ticketTotal,
} from './ticket.ts';

describe('money', () => {
  it('stores TRY as integer kuruş and formats Turkish lira', () => {
    expect(money(32_000)).toEqual({ currency: 'TRY', kurus: 32_000 });
    expect(formatTry(money(9_000))).toBe('90,00 TL');
    expect(formatTry(money(2_500))).toBe('25,00 TL');
    expect(formatTry(money(125_000))).toBe('1.250,00 TL');
  });

  it('adds and multiplies without floating point', () => {
    const line = multiplyMoney(money(32_000), 2);
    expect(line.kurus).toBe(64_000);
    expect(addMoney(line, money(5_000)).kurus).toBe(69_000);
  });

  it('rejects invalid amounts', () => {
    expect(() => money(-1)).toThrow(DomainError);
    expect(() => money(1.5)).toThrow(DomainError);
    expect(() => multiplyMoney(money(100), 1.5)).toThrow(DomainError);
  });
});

describe('ticket totals', () => {
  const adana = { unitPrice: money(32_000), quantity: 2 };
  const ayran = { unitPrice: money(5_000), quantity: 1 };

  it('sums line totals', () => {
    expect(lineTotal(adana).kurus).toBe(64_000);
    expect(ticketTotal([]).kurus).toBe(0);
    expect(ticketTotal([adana, ayran]).kurus).toBe(69_000);
    expect(formatTry(ticketTotal([adana, ayran]))).toBe('690,00 TL');
  });

  it('merges quantity up to 99 and blocks closed tickets', () => {
    expect(mergedQuantity(1, 2)).toBe(3);
    expect(() => mergedQuantity(98, 2)).toThrow(DomainError);
    expect(() => assertCanAddLine('closed', 1)).toThrow(/Kapalı adisyon/);
  });

  it('allows close only for an open ticket with lines and a known method', () => {
    expect(() => assertCanClose('open', 1, 'nakit')).not.toThrow();
    expect(() => assertCanClose('open', 0, 'nakit')).toThrow(/Boş adisyon/);
    expect(() => assertCanClose('closed', 1, 'kart')).toThrow(/zaten kapalı/);
    expect(() => assertCanClose('open', 1, 'havale')).toThrow(DomainError);
    expect(() => assertCanSendToKitchen('open', 0)).toThrow(/Boş adisyon/);
  });
});

describe('tables', () => {
  it('derives occupancy from an open ticket id', () => {
    expect(tableStatus(null)).toBe('empty');
    expect(tableStatus('ticket_1')).toBe('occupied');
  });
});
