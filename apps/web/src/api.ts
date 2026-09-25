export type FloorTable = {
  id: string;
  label: string;
  seats: number;
  status: 'empty' | 'occupied';
  openTicketId: string | null;
};

export type FloorResponse = {
  venue: { id: string; name: string };
  tables: FloorTable[];
};

export type ProductDto = {
  id: string;
  name: string;
  category: string;
  priceKurus: number;
  priceLabel: string;
  active: boolean;
};

export type TicketDto = {
  id: string;
  tableId: string;
  tableLabel: string;
  status: 'open' | 'closed';
  paymentMethod: 'nakit' | 'kart' | null;
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

type ErrorBody = { error?: string };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: {
        ...(init?.body ? { 'content-type': 'application/json' } : {}),
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new Error('API’ye ulaşılamadı. Önce API sunucusunu başlatın.');
  }
  const body = (await response.json().catch(() => ({}))) as T & ErrorBody;
  if (!response.ok) {
    throw new Error(body.error ?? `İstek başarısız (${response.status})`);
  }
  return body;
}

export function getFloor(): Promise<FloorResponse> {
  return request('/api/floor');
}

export function getProducts(): Promise<{ products: ProductDto[] }> {
  return request('/api/products');
}

export function openTableTicket(tableId: string): Promise<{ ticket: TicketDto }> {
  return request(`/api/tables/${tableId}/tickets`, { method: 'POST' });
}

export function getTicket(ticketId: string): Promise<{ ticket: TicketDto }> {
  return request(`/api/tickets/${ticketId}`);
}

export function addProduct(
  ticketId: string,
  productId: string,
  quantity = 1,
): Promise<{ ticket: TicketDto }> {
  return request(`/api/tickets/${ticketId}/lines`, {
    method: 'POST',
    body: JSON.stringify({ productId, quantity }),
  });
}

export function setQuantity(
  ticketId: string,
  lineId: string,
  quantity: number,
): Promise<{ ticket: TicketDto }> {
  return request(`/api/tickets/${ticketId}/lines/${lineId}`, {
    method: 'PATCH',
    body: JSON.stringify({ quantity }),
  });
}

export function sendKitchen(ticketId: string): Promise<{ stub: boolean; message: string; ticket: TicketDto }> {
  return request(`/api/tickets/${ticketId}/kitchen`, { method: 'POST' });
}

export function closeTicket(
  ticketId: string,
  paymentMethod: 'nakit' | 'kart',
): Promise<{ stub: boolean; message: string; ticket: TicketDto }> {
  return request(`/api/tickets/${ticketId}/close`, {
    method: 'POST',
    body: JSON.stringify({ paymentMethod }),
  });
}
