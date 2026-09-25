import {
  formatTry,
  lineTotal,
  ticketTotal,
  type DiningTable,
  type PaymentMethod,
  type Product,
  type Ticket,
  type TicketStatus,
} from '@vaxtroy/domain';

export type TicketJson = {
  id: string;
  tableId: string;
  tableLabel: string;
  status: TicketStatus;
  paymentMethod: PaymentMethod | null;
  kitchenSentAt: string | null;
  openedAt: string;
  closedAt: string | null;
  lines: {
    id: string;
    productId: string;
    productName: string;
    unitPriceKurus: number;
    quantity: number;
    lineTotalKurus: number;
    lineTotalLabel: string;
  }[];
  totalKurus: number;
  totalLabel: string;
};

export function toTicketJson(
  ticket: Ticket,
  meta: { tableLabel: string; openedAt: string; closedAt: string | null },
): TicketJson {
  const total = ticketTotal(ticket.lines);
  return {
    id: ticket.id,
    tableId: ticket.tableId,
    tableLabel: meta.tableLabel,
    status: ticket.status,
    paymentMethod: ticket.paymentMethod,
    kitchenSentAt: ticket.kitchenSentAt,
    openedAt: meta.openedAt,
    closedAt: meta.closedAt,
    lines: ticket.lines.map((line) => {
      const totalLine = lineTotal(line);
      return {
        id: line.id,
        productId: line.productId,
        productName: line.productName,
        unitPriceKurus: line.unitPrice.kurus,
        quantity: line.quantity,
        lineTotalKurus: totalLine.kurus,
        lineTotalLabel: formatTry(totalLine),
      };
    }),
    totalKurus: total.kurus,
    totalLabel: formatTry(total),
  };
}

export function toProductJson(product: Product) {
  return {
    id: product.id,
    name: product.name,
    category: product.category,
    priceKurus: product.price.kurus,
    priceLabel: formatTry(product.price),
    active: product.active,
  };
}

export function toTableJson(table: DiningTable) {
  return {
    id: table.id,
    label: table.label,
    seats: table.seats,
    status: table.status,
    openTicketId: table.openTicketId,
  };
}
