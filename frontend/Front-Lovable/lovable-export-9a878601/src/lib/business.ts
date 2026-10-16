export type Product = { id: string; name: string; category: string; physical: number; reserved: number; cost: number; price: number; ncm: string };
export type Client = { id: string; name: string; neighborhood: string; buyer: string; cnpj: string; ie: string; ibge: string; days: number; cycle: number; lastTotal: number; overdue: boolean; time: string; notes: string[]; prices: number[] };
export type Item = { productId: string; quantity: number; price: number; cost: number };
export type Order = { id: string; clientId: string; items: Item[]; status: 'AGUARDANDO_REVISAO' | 'FATURADO'; payment: string; delivery: string; note: string; promotional: boolean; date: string; invoice?: string; key?: string };
export type AppData = { products: Product[]; clients: Client[]; orders: Order[]; reconciled: string[] };
export const money = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const available = (p: Product) => p.physical - p.reserved;
export function financials(items: Item[]) {
  const total = items.reduce((a, i) => a + i.quantity * i.price, 0);
  const cost = items.reduce((a, i) => a + i.quantity * i.cost, 0);
  const tax = total * .12;
  const profit = total - cost - tax - 45;
  const margin = total > 0 ? profit / total * 100 : 0;
  return { total, cost, tax, logistics: 45, profit, margin };
}
export const marginLevel = (margin: number) => margin >= 25 ? 'success' : margin >= 12 ? 'warning' : 'danger';
export const fiscalReady = (c: Client) => Boolean(c.cnpj && c.ie && c.ibge);
export function reserveOrder(data: AppData, order: Order): AppData {
  if (!order.items.some(i => i.quantity > 0)) throw new Error('Adicione ao menos um produto.');
  for (const i of order.items) {
    const p = data.products.find(p => p.id === i.productId);
    if (!p || i.quantity < 0 || !Number.isInteger(i.quantity) || i.quantity > available(p) || i.price <= 0) throw new Error('Confira as quantidades, os preços e o estoque disponível.');
  }
  return { ...data, orders: [order, ...data.orders], products: data.products.map(p => ({ ...p, reserved: p.reserved + (order.items.find(i => i.productId === p.id)?.quantity ?? 0) })) };
}
export function invoiceOrder(data: AppData, id: string): AppData {
  const o = data.orders.find(o => o.id === id);
  if (!o || o.status === 'FATURADO') throw new Error('Este pedido já foi faturado.');
  const c = data.clients.find(c => c.id === o.clientId);
  if (!c || !fiscalReady(c)) throw new Error('Complete os dados fiscais antes de emitir.');
  return { ...data, products: data.products.map(p => { const q = o.items.find(i => i.productId === p.id)?.quantity ?? 0; return { ...p, physical: p.physical - q, reserved: p.reserved - q }; }), orders: data.orders.map(order => order.id === id ? { ...order, status: 'FATURADO', invoice: String(1048 + data.orders.filter(o => o.status === 'FATURADO').length), key: '352610123456780001905500100000' + String(Date.now()).padStart(14, '0') } : order), clients: data.clients.map(client => client.id !== o.clientId || o.promotional ? client : { ...client, prices: data.products.map((p, index) => o.items.find(i => i.productId === p.id && i.quantity > 0)?.price ?? client.prices[index] ?? p.price) }) };
}
export function editOrder(data: AppData, id: string, items: Item[]): AppData {
  const old = data.orders.find(o => o.id === id);
  if (!old || old.status === 'FATURADO') throw new Error('Pedido não editável.');
  const released = { ...data, orders: data.orders.filter(o => o.id !== id), products: data.products.map(p => ({ ...p, reserved: p.reserved - (old.items.find(i => i.productId === p.id)?.quantity ?? 0) })) };
  return reserveOrder(released, { ...old, items });
}
export const initialData: AppData = {
  products: [
    { id: 'A', name: 'Produto A', category: 'Importado', physical: 140, reserved: 0, cost: 62, price: 120, ncm: '8471.30.12' },
    { id: 'B', name: 'Produto B', category: 'Premium', physical: 85, reserved: 0, cost: 135, price: 250, ncm: '8517.62.55' },
    { id: 'C', name: 'Produto C', category: 'Standard', physical: 310, reserved: 0, cost: 38, price: 70, ncm: '3926.90.90' },
  ],
  clients: [
    { id: 'rocha', name: 'Distribuidora Rocha', neighborhood: 'Mooca', buyer: 'Marcos Rocha', cnpj: '12.345.678/0001-90', ie: '110.042.490.114', ibge: '3550308', days: 12, cycle: 20, lastTotal: 4850, overdue: false, time: '09:00', notes: ['16/10 • Marcos pediu para priorizar a entrega na parte da manhã.'], prices: [115, 245, 68] },
    { id: 'silva', name: 'Comercial Silva', neighborhood: 'Tatuapé', buyer: 'Ana Silva', cnpj: '', ie: '', ibge: '', days: 24, cycle: 30, lastTotal: 3200, overdue: true, time: '10:30', notes: ['15/10 • Interesse no Produto B. Confirmar limite antes do próximo pedido.'], prices: [120, 250, 70] },
    { id: 'paulista', name: 'Atacado Paulista', neighborhood: 'Santo André', buyer: 'Ricardo Souza', cnpj: '45.678.901/0001-23', ie: '110.042.490.116', ibge: '3547809', days: 35, cycle: 20, lastTotal: 7600, overdue: false, time: '14:00', notes: ['12/09 • Reposição de A e C a cada 20 dias. Ligar antes da visita.'], prices: [112, 240, 65] },
    { id: 'mega', name: 'Mega Suprimentos', neighborhood: 'Ipiranga', buyer: 'Paulo Lima', cnpj: '56.789.012/0001-34', ie: '110.042.490.117', ibge: '3550308', days: 42, cycle: 30, lastTotal: 2150, overdue: false, time: '15:30', notes: ['04/09 • Paulo prefere pagamento por Pix na entrega.'], prices: [118, 248, 69] },
  ],
  orders: [], reconciled: [],
};
export function demoData(): AppData {
  let data = structuredClone(initialData);
  const seed: [string, number[], string, string][] = [['rocha', [20, 8, 30], 'AGUARDANDO_REVISAO', '09:42'], ['silva', [10, 5, 20], 'AGUARDANDO_REVISAO', '09:18'], ['paulista', [30, 10, 50], 'AGUARDANDO_REVISAO', '08:56']];
  seed.forEach(([clientId, quantities, , date], n) => {
    const client = data.clients.find(c => c.id === clientId);
    if (!client) return;
    data = reserveOrder(data, { id: String(1048 - n), clientId, items: data.products.map((p, i) => ({ productId: p.id, quantity: quantities[i] ?? 0, price: client.prices[i] ?? p.price, cost: p.cost })), status: 'AGUARDANDO_REVISAO', payment: 'Boleto 28 dias', delivery: 'Amanhã Manhã', note: 'Entregar diretamente no estoque. Confirmar com o comprador.', promotional: false, date });
  });
  data.orders.push({ id: '1045', clientId: 'mega', items: [{ productId: 'A', quantity: 15, price: 118, cost: 62 }, { productId: 'C', quantity: 25, price: 69, cost: 38 }], status: 'FATURADO', payment: 'Pix na Entrega', delivery: 'Próxima Rota', note: '', promotional: false, date: 'Ontem', invoice: '1045', key: '35261012345678000190550010000010451000000001' });
  return data;
}