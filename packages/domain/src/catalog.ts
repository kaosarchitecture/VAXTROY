import type { Money } from './money.ts';

export type Product = {
  id: string;
  name: string;
  category: string;
  price: Money;
  active: boolean;
};

export type TableStatus = 'empty' | 'occupied';

export type DiningTable = {
  id: string;
  label: string;
  seats: number;
  status: TableStatus;
  openTicketId: string | null;
};

export function tableStatus(openTicketId: string | null): TableStatus {
  return openTicketId ? 'occupied' : 'empty';
}
