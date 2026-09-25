import { DomainError } from './errors.ts';

export type Currency = 'TRY';

/** Integer minor units. 1 TRY = 100 kuruş. */
export type Money = {
  currency: Currency;
  kurus: number;
};

export function money(kurus: number): Money {
  if (!Number.isSafeInteger(kurus) || kurus < 0) {
    throw new DomainError('Geçersiz tutar', 400);
  }
  return { currency: 'TRY', kurus };
}

export function addMoney(left: Money, right: Money): Money {
  if (left.currency !== right.currency) {
    throw new DomainError('Para birimleri aynı olmalı', 400);
  }
  return money(left.kurus + right.kurus);
}

export function multiplyMoney(value: Money, quantity: number): Money {
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new DomainError('Adet geçersiz', 400);
  }
  const product = value.kurus * quantity;
  if (!Number.isSafeInteger(product)) {
    throw new DomainError('Tutar çok büyük', 400);
  }
  return money(product);
}

/** Turkish POS display: 125000 kuruş -> "1.250,00 TL". */
export function formatTry(value: Money): string {
  const lira = Math.floor(value.kurus / 100);
  const fraction = String(value.kurus % 100).padStart(2, '0');
  const grouped = String(lira).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${grouped},${fraction} TL`;
}
