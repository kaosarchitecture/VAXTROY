export { DomainError } from './errors.ts';
export { formatTry, money, addMoney, multiplyMoney, type Currency, type Money } from './money.ts';
export { tableStatus, type DiningTable, type Product, type TableStatus } from './catalog.ts';
export {
  assertCanAddLine,
  assertCanClose,
  assertCanSendToKitchen,
  assertCanSetQuantity,
  lineTotal,
  mergedQuantity,
  ticketTotal,
  type PaymentMethod,
  type Ticket,
  type TicketLine,
  type TicketStatus,
} from './ticket.ts';
