import { formatTry, money } from '@vaxtroy/domain';
import {
  addProduct,
  closeTicket,
  getFloor,
  getProducts,
  getTicket,
  openTableTicket,
  sendKitchen,
  setQuantity,
  type FloorResponse,
  type ProductDto,
  type TicketDto,
} from './api.ts';
import './styles.css';

type Screen =
  | { name: 'floor' }
  | { name: 'ticket'; confirmClose: boolean }
  | { name: 'done' };

const state: {
  screen: Screen;
  floor: FloorResponse | null;
  products: ProductDto[];
  category: string | null;
  ticket: TicketDto | null;
  error: string | null;
  notice: string | null;
  busy: boolean;
} = {
  screen: { name: 'floor' },
  floor: null,
  products: [],
  category: null,
  ticket: null,
  error: null,
  notice: null,
  busy: false,
};

const appEl = document.querySelector<HTMLElement>('#app');
if (!appEl) throw new Error('missing #app');

function esc(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function priceLabel(kurus: number): string {
  return formatTry(money(kurus));
}

function categories(): string[] {
  const seen: string[] = [];
  for (const product of state.products) {
    if (!seen.includes(product.category)) seen.push(product.category);
  }
  return seen;
}

function render(): void {
  const venue = state.floor?.venue.name ?? 'Vaxtroy';
  const banner = state.error ? `<div class="banner">${esc(state.error)}</div>` : '';
  const notice = state.notice ? `<div class="notice">${esc(state.notice)}</div>` : '';
  appEl!.innerHTML = `
    <header class="top">
      <h1 class="brand">${esc(venue)}<span>Adisyon</span></h1>
      <button class="ghost" data-action="refresh" ${state.busy ? 'disabled' : ''}>Yenile</button>
    </header>
    ${banner}
    ${notice}
    ${body()}
  `;
}

function body(): string {
  if (!state.floor) return `<p class="stub-note">Salon yükleniyor…</p>`;
  if (state.screen.name === 'floor') return floorView();
  if (state.screen.name === 'done' && state.ticket) return doneView(state.ticket);
  if (state.screen.name === 'ticket' && state.ticket) return ticketView(state.ticket);
  return floorView();
}

function floorView(): string {
  const cards = (state.floor?.tables ?? [])
    .map((table) => {
      const occupied = table.status === 'occupied';
      return `<button class="table-card${occupied ? ' occupied' : ''}" data-action="select-table" data-table-id="${esc(table.id)}" ${state.busy ? 'disabled' : ''}>
        <strong>${esc(table.label)}</strong>
        <span class="seats">${table.seats} kişilik</span>
        <em>${occupied ? 'Dolu' : 'Boş'}</em>
      </button>`;
    })
    .join('');
  return `<p class="stub-note">Masaya dokunun. Boş masa adisyon açar, dolu masa açık adisyona döner.</p><div class="tables">${cards}</div>`;
}

function ticketView(ticket: TicketDto): string {
  const lines =
    ticket.lines.length === 0
      ? `<p class="stub-note">Henüz ürün yok. Menüden ekleyin.</p>`
      : `<div class="lines">${ticket.lines
          .map(
            (line) => `<div class="line">
              <div class="name">${esc(line.productName)}</div>
              <div>${esc(line.lineTotalLabel)}</div>
              <div class="qty">
                <button data-action="dec" data-line-id="${esc(line.id)}" ${state.busy ? 'disabled' : ''}>−</button>
                <strong>${line.quantity}</strong>
                <button data-action="inc" data-line-id="${esc(line.id)}" ${state.busy ? 'disabled' : ''}>+</button>
              </div>
              <div class="seats">${esc(priceLabel(line.unitPriceKurus))}</div>
            </div>`,
          )
          .join('')}</div>`;
  const disabled = state.busy || ticket.lines.length === 0 ? 'disabled' : '';
  const kitchenLabel = ticket.kitchenSentAt ? 'Mutfağa tekrar gönder' : 'Mutfağa gönder';
  const confirm = state.screen.name === 'ticket' && state.screen.confirmClose;
  const closeBlock = confirm
    ? `<div class="pay-row">
         <button class="pay" data-action="pay" data-method="nakit" ${disabled}>Nakit</button>
         <button class="pay" data-action="pay" data-method="kart" ${disabled}>Kart</button>
       </div>
       <button class="ghost" data-action="cancel-close">Vazgeç</button>
       <p class="stub-note">STUB: seçilen yöntem kaydedilir, tahsilat entegrasyonu yok.</p>`
    : `<button class="action primary" data-action="ask-close" ${disabled}>Hesabı kapat</button>`;
  return `<div class="ticket-layout">
    <section class="panel">
      <button class="ghost" data-action="back">Salona dön</button>
      <h2>${esc(ticket.tableLabel)}</h2>
      ${lines}
      <div class="total"><span>Toplam</span><strong>${esc(ticket.totalLabel)}</strong></div>
      <div class="actions">
        <button class="action secondary" data-action="kitchen" ${disabled}>${kitchenLabel}</button>
        ${closeBlock}
      </div>
      <p class="stub-note">Mutfak bu sürümde STUB: kayıt tutulur, yazıcı bağlı değil. Fiyatlar KDV dahildir.</p>
    </section>
    <section class="panel">
      <h2>Menü</h2>
      <div class="chips">${categories()
        .map(
          (category) =>
            `<button class="chip${category === activeCategory() ? ' active' : ''}" data-action="category" data-category="${esc(category)}">${esc(category)}</button>`,
        )
        .join('')}</div>
      <div class="products">${state.products
        .filter((product) => product.category === activeCategory())
        .map(
          (product) =>
            `<button class="product-btn" data-action="add" data-product-id="${esc(product.id)}" ${state.busy ? 'disabled' : ''}>${esc(product.name)}<span>${esc(priceLabel(product.priceKurus))}</span></button>`,
        )
        .join('')}</div>
    </section>
  </div>`;
}

function doneView(ticket: TicketDto): string {
  const method = ticket.paymentMethod === 'kart' ? 'Kart' : 'Nakit';
  return `<section class="panel done">
    <h2>Adisyon kapandı</h2>
    <p>${esc(ticket.tableLabel)} · ${esc(method)}</p>
    <div class="total"><span>Toplam</span><strong>${esc(ticket.totalLabel)}</strong></div>
    <p class="stub-note">STUB: ödeme yöntemi veritabanına yazıldı. Banka veya yazar kasa yok.</p>
    <button class="action primary" data-action="back">Salona dön</button>
  </section>`;
}

function activeCategory(): string {
  const list = categories();
  if (state.category && list.includes(state.category)) return state.category;
  return list[0] ?? '';
}

async function run(action: () => Promise<void>): Promise<void> {
  state.busy = true;
  state.error = null;
  render();
  try {
    await action();
  } catch (error) {
    state.error = error instanceof Error ? error.message : 'İşlem başarısız';
  } finally {
    state.busy = false;
    render();
  }
}

async function refreshFloor(): Promise<void> {
  const [floor, products] = await Promise.all([getFloor(), getProducts()]);
  state.floor = floor;
  state.products = products.products;
}

appEl.addEventListener('click', (event) => {
  const target = (event.target as HTMLElement).closest<HTMLElement>('[data-action]');
  if (!target || state.busy) return;
  const action = target.dataset.action;
  if (action === 'category') {
    state.category = target.dataset.category ?? null;
    render();
    return;
  }
  if (action === 'ask-close' && state.screen.name === 'ticket') {
    state.screen = { name: 'ticket', confirmClose: true };
    state.notice = null;
    render();
    return;
  }
  if (action === 'cancel-close' && state.screen.name === 'ticket') {
    state.screen = { name: 'ticket', confirmClose: false };
    render();
    return;
  }
  if (action === 'refresh') {
    void run(async () => {
      await refreshFloor();
      if (state.ticket && state.screen.name !== 'floor') {
        state.ticket = (await getTicket(state.ticket.id)).ticket;
      }
    });
    return;
  }
  if (action === 'back') {
    void run(async () => {
      await refreshFloor();
      state.ticket = null;
      state.notice = null;
      state.screen = { name: 'floor' };
    });
    return;
  }
  if (action === 'select-table') {
    const tableId = target.dataset.tableId;
    const table = state.floor?.tables.find((item) => item.id === tableId);
    if (!table) return;
    void run(async () => {
      const opened = table.openTicketId
        ? await getTicket(table.openTicketId)
        : await openTableTicket(table.id);
      state.ticket = opened.ticket;
      state.notice = null;
      state.screen = { name: 'ticket', confirmClose: false };
      await refreshFloor();
    });
    return;
  }
  const ticket = state.ticket;
  if (!ticket) return;
  if (action === 'add') {
    const productId = target.dataset.productId;
    if (!productId) return;
    void run(async () => {
      state.ticket = (await addProduct(ticket.id, productId, 1)).ticket;
      state.notice = null;
    });
    return;
  }
  if (action === 'inc' || action === 'dec') {
    const lineId = target.dataset.lineId;
    const line = ticket.lines.find((item) => item.id === lineId);
    if (!lineId || !line) return;
    const quantity = action === 'inc' ? line.quantity + 1 : line.quantity - 1;
    void run(async () => {
      state.ticket = (await setQuantity(ticket.id, lineId, quantity)).ticket;
    });
    return;
  }
  if (action === 'kitchen') {
    void run(async () => {
      const result = await sendKitchen(ticket.id);
      state.ticket = result.ticket;
      state.notice = result.message;
    });
    return;
  }
  if (action === 'pay') {
    const method = target.dataset.method === 'kart' ? 'kart' : 'nakit';
    void run(async () => {
      const result = await closeTicket(ticket.id, method);
      state.ticket = result.ticket;
      state.notice = result.message;
      state.screen = { name: 'done' };
      await refreshFloor();
    });
  }
});

void run(async () => {
  await refreshFloor();
});
