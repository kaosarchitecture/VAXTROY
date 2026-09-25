import { DomainError } from './errors.ts';
import { addMoney, money, multiplyMoney, type Money } from './money.ts';

export type TicketStatus = 'open' | 'closed';
export type PaymentMethod = 'nakit' | 'kart';

export type TicketLine = {
  id: string;
  productId: string;
  productName: string;
  unitPrice: Money;
  quantity: number;
};

export type Ticket = {
  id: string;
  tableId: string;
  status: TicketStatus;
  lines: TicketLine[];
  paymentMethod: PaymentMethod | null;
  kitchenSentAt: string | null;
};

export function lineTotal(line: Pick<TicketLine, 'unitPrice' | 'quantity'>): Money {
  return multiplyMoney(line.unitPrice, line.quantity);
}

export function ticketTotal(lines: Pick<TicketLine, 'unitPrice' | 'quantity'>[]): Money {
  return lines.reduce((sum, line) => addMoney(sum, lineTotal(line)), money(0));
}

export function assertCanAddLine(status: TicketStatus, quantity: number): void {
  if (status !== 'open') {
    throw new DomainError('Kapalı adisyona ürün eklenemez');
  }
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
    throw new DomainError('Adet 1 ile 99 arasında olmalı', 400);
  }
}

export function mergedQuantity(current: number, add: number): number {
  assertCanAddLine('open', add);
  const next = current + add;
  if (!Number.isSafeInteger(next) || next > 99) {
    throw new DomainError('Bir üründen en fazla 99 adet olabilir', 400);
  }
  return next;
}

export function assertCanSetQuantity(status: TicketStatus, quantity: number): void {
  if (status !== 'open') {
    throw new DomainError('Kapalı adisyon değiştirilemez');
  }
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > 99) {
    throw new DomainError('Adet 0 ile 99 arasında olmalı', 400);
  }
}

export function assertCanSendToKitchen(status: TicketStatus, lineCount: number): void {
  if (status !== 'open') {
    throw new DomainError('Kapalı adisyon mutfağa gönderilemez');
  }
  if (lineCount < 1) {
    throw new DomainError('Boş adisyon mutfağa gönderilemez');
  }
}

export function assertCanClose(
  status: TicketStatus,
  lineCount: number,
  method: string,
): asserts method is PaymentMethod {
  if (status !== 'open') {
    throw new DomainError('Adisyon zaten kapalı');
  }
  if (lineCount < 1) {
    throw new DomainError('Boş adisyon kapatılamaz');
  }
  if (method !== 'nakit' && method !== 'kart') {
    throw new DomainError('Ödeme yöntemi nakit veya kart olmalı', 400);
  }
}
