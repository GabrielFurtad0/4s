export type Product = {
  id: string;
  dbId?: number | undefined;
  skuCode?: string | undefined;
  name: string;
  category: string;
  physical: number;
  reserved: number;
  cost: number;
  price: number;
  ncm: string;
};

export type Client = {
  id: string;
  dbId?: number | undefined;
  colorKey?: string | undefined;
  name: string;
  neighborhood: string;
  buyer: string;
  cnpj: string;
  ie: string;
  ibge: string;
  days: number;
  cycle: number;
  lastTotal: number;
  overdue: boolean;
  time: string;
  notes: string[];
  prices: number[];
};

export type Item = {
  productId: string;
  quantity: number;
  price: number;
  cost: number;
  orderedQuantity?: number | undefined;
  orderedPrice?: number | undefined;
  adjusted?: boolean | undefined;
};

export type Order = {
  id: string;
  clientId: string;
  items: Item[];
  status: 'AGUARDANDO_REVISAO' | 'FATURADO';
  rawStatus?: string | undefined;
  payment: string;
  delivery: string;
  note: string;
  promotional: boolean;
  date: string;
  invoice?: string | undefined;
  key?: string | undefined;
  xmlUrl?: string | undefined;
  hasDiff?: boolean | undefined;
  originalTotal?: number | undefined;
};

export type AppData = {
  products: Product[];
  clients: Client[];
  orders: Order[];
  reconciled: string[];
  backendConnected?: boolean | undefined;
};

export const money = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const available = (p: Product) => p.physical - p.reserved;

export const productLabel = (data: AppData, productId: string) =>
  data.products.find(p => p.id === productId)?.name ?? `Produto ${productId}`;

export function financials(items: Item[]) {
  const total = items.reduce((a, i) => a + i.quantity * i.price, 0);
  const cost = items.reduce((a, i) => a + i.quantity * i.cost, 0);
  const tax = total * 0.08;
  const logistics = total > 0 ? 45 : 0;
  const profit = total - cost - tax - logistics;
  const margin = total > 0 ? (profit / total) * 100 : 0;
  return { total, cost, tax, logistics: 45, profit, margin };
}

export const marginLevel = (margin: number) =>
  margin >= 22 ? 'success' : margin >= 12 ? 'warning' : 'danger';

export const fiscalReady = (c: Client) => Boolean(c.cnpj && c.ie && c.ibge);

export function reserveOrder(data: AppData, order: Order): AppData {
  if (!order.items.some(i => i.quantity > 0)) throw new Error('Adicione ao menos um produto.');
  for (const i of order.items) {
    const p = data.products.find(p => p.id === i.productId);
    if (!p || i.quantity < 0 || !Number.isInteger(i.quantity) || i.quantity > available(p) || i.price <= 0)
      throw new Error('Confira as quantidades, os preços e o estoque disponível.');
  }
  return {
    ...data,
    orders: [order, ...data.orders],
    products: data.products.map(p => ({
      ...p,
      reserved: p.reserved + (order.items.find(i => i.productId === p.id)?.quantity ?? 0),
    })),
  };
}

export function invoiceOrder(data: AppData, id: string): AppData {
  const o = data.orders.find(o => o.id === id);
  if (!o || o.status === 'FATURADO') throw new Error('Este pedido já foi faturado.');
  const c = data.clients.find(c => c.id === o.clientId);
  if (!c || !fiscalReady(c)) throw new Error('Complete os dados fiscais antes de emitir.');
  return {
    ...data,
    products: data.products.map(p => {
      const q = o.items.find(i => i.productId === p.id)?.quantity ?? 0;
      return { ...p, physical: p.physical - q, reserved: p.reserved - q };
    }),
    orders: data.orders.map(order =>
      order.id === id
        ? {
            ...order,
            status: 'FATURADO',
            invoice: String(12929 + data.orders.filter(o => o.status === 'FATURADO').length),
            key: '352610092652010001955500100001' + String(Date.now()).padStart(14, '0'),
          }
        : order
    ),
    clients: data.clients.map(client =>
      client.id !== o.clientId || o.promotional
        ? client
        : {
            ...client,
            prices: data.products.map(
              (p, index) =>
                o.items.find(i => i.productId === p.id && i.quantity > 0)?.price ??
                client.prices[index] ??
                p.price
            ),
          }
    ),
  };
}

export function editOrder(data: AppData, id: string, items: Item[]): AppData {
  const old = data.orders.find(o => o.id === id);
  if (!old || old.status === 'FATURADO') throw new Error('Pedido não editável.');
  const released = {
    ...data,
    orders: data.orders.filter(o => o.id !== id),
    products: data.products.map(p => ({
      ...p,
      reserved: Math.max(0, p.reserved - (old.items.find(i => i.productId === p.id)?.quantity ?? 0)),
    })),
  };
  return reserveOrder(released, { ...old, items });
}

export const initialData: AppData = {
  products: [
    { id: 'A', dbId: 1, skuCode: 'SKU-05', name: 'Farinha Tipo 1 (25kg)', category: 'Saco 25kg', physical: 2259, reserved: 0, cost: 54, price: 85, ncm: '1101.00.10' },
    { id: 'B', dbId: 2, skuCode: 'SKU-02', name: 'Pré-Mistura Francês (25kg)', category: 'Saco 25kg', physical: 1739, reserved: 0, cost: 49.5, price: 78, ncm: '1101.00.10' },
    { id: 'C', dbId: 3, skuCode: 'SKU-03', name: 'PM Pão Doce (25kg)', category: 'Saco 25kg', physical: 180, reserved: 0, cost: 61, price: 92, ncm: '1101.00.10' },
  ],
  clients: [
    { id: '1', dbId: 1, colorKey: 'rocha', name: 'Padaria Jardim Eliana', neighborhood: 'Parque Brasil / Grajaú', buyer: 'Sr. Carlos', cnpj: '68.457.477/0001-34', ie: '161327701113', ibge: '3550308', days: 22, cycle: 20, lastTotal: 4700, overdue: false, time: '09:30', notes: ['22 dias atrás • Prefere entrega no período da manhã antes das 10h.', 'Hoje • Pediu amostra da Pré-Mistura Pão Doce 25Kg.'], prices: [79, 75, 88] },
    { id: '2', dbId: 2, colorKey: 'paulista', name: 'Panificadora Jardim Mirian', neighborhood: 'Cidade Ademar', buyer: 'Marcos', cnpj: '62.136.817/0001-49', ie: '105973105110', ibge: '3550308', days: 11, cycle: 15, lastTotal: 4100, overdue: false, time: '11:00', notes: ['11 dias atrás • Comprador Marcos só atende fornecedores até às 11h30.'], prices: [82, 76, 90] },
    { id: '3', dbId: 3, colorKey: 'silva', name: 'Atacado & Padaria Nova Belfort', neighborhood: 'Vila São Pedro / Sabará', buyer: 'Fernanda', cnpj: '12.049.732/0001-55', ie: '147247208119', ibge: '3550308', days: 35, cycle: 20, lastTotal: 12300, overdue: true, time: '14:30', notes: ['35 dias atrás • Compra em volume alto. Verificar baixa do boleto antes de liberar.'], prices: [80, 74, 86] },
    { id: '5', dbId: 5, colorKey: 'mega', name: 'Padaria Sol Maior Jabaquara', neighborhood: 'Jabaquara', buyer: 'Sr. Joaquim', cnpj: '48.936.777/0001-99', ie: '', ibge: '', days: 5, cycle: 15, lastTotal: 1680, overdue: false, time: '16:15', notes: ['Ontem • Cliente novo prospectado no Jabaquara. Completar CNPJ na BrasilAPI antes da NF-e.'], prices: [84, 77, 90] },
  ],
  orders: [],
  reconciled: [],
  backendConnected: false,
};

export function demoData(): AppData {
  let data = structuredClone(initialData);
  const seed: [string, number[], string, string][] = [
    ['2', [40, 15, 0], 'AGUARDANDO_REVISAO', '09:42'],
    ['5', [20, 10, 10], 'AGUARDANDO_REVISAO', '09:18'],
  ];
  seed.forEach(([clientId, quantities, , date], n) => {
    const client = data.clients.find(c => c.id === clientId);
    if (!client) return;
    data = reserveOrder(data, {
      id: String(4 - n),
      clientId,
      items: data.products.map((p, i) => ({
        productId: p.id,
        quantity: quantities[i] ?? 0,
        price: client.prices[i] ?? p.price,
        cost: p.cost,
      })),
      status: 'AGUARDANDO_REVISAO',
      payment: 'Boleto 28 dias',
      delivery: 'Amanhã (Manhã)',
      note: 'Entregar antes das 10h30. Confirmar com o comprador.',
      promotional: false,
      date,
    });
  });
  data.orders.push({
    id: '1',
    clientId: '1',
    items: [
      { productId: 'A', quantity: 20, price: 79, cost: 54 },
      { productId: 'B', quantity: 20, price: 75, cost: 49.5 },
      { productId: 'C', quantity: 0, price: 88, cost: 61 },
    ],
    status: 'FATURADO',
    payment: 'Boleto 28 dias',
    delivery: 'Manhã',
    note: 'REDUCAO DE 7% ANEXO III ARTIGO 3 DO RICMS',
    promotional: false,
    date: 'Ontem',
    invoice: '12926',
    key: '35261009265201000195550010000129261300056781',
  });
  return data;
}

// ============================================================================
// Integração Real com o Backend Spring Boot (/api/mobile/* e /api/backoffice/*)
// ============================================================================

const CLIENT_COLOR_KEYS = ['rocha', 'silva', 'paulista', 'mega'] as const;

export function toUiProductId(dbId: number, idx = 0): string {
  if (dbId === 1) return 'A';
  if (dbId === 2) return 'B';
  if (dbId === 3) return 'C';
  return ['A', 'B', 'C'][idx] ?? String(dbId);
}

export function toDbProductId(uiId: string, products?: Product[]): number {
  const found = products?.find(p => p.id === uiId);
  if (found?.dbId) return found.dbId;
  if (uiId === 'A') return 1;
  if (uiId === 'B') return 2;
  if (uiId === 'C') return 3;
  return Number(uiId) || 1;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((init?.headers as Record<string, string>) ?? {}),
  };
  const urls =
    typeof window !== 'undefined'
      ? [`/api${path}`, `http://localhost:8085/api${path}`]
      : [`http://localhost:8085/api${path}`];

  let lastError: Error | null = null;
  for (const url of urls) {
    try {
      const res = await fetch(url, { ...init, headers });
      if (!res.ok) {
        let msg = `Erro HTTP ${res.status}`;
        try {
          const errJson = await res.json();
          msg = errJson.message || errJson.error || msg;
        } catch {
          const txt = await res.text().catch(() => '');
          if (txt) msg = txt;
        }
        throw new Error(msg);
      }
      return (await res.json()) as T;
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      // Se for erro de regra de negócio (HTTP 4xx/5xx com mensagem), não tenta o fallback de rede
      if (lastError.message && !lastError.message.includes('Failed to fetch') && !lastError.message.includes('NetworkError') && !lastError.message.includes('HTTP 404')) {
        throw lastError;
      }
    }
  }
  throw lastError ?? new Error('Falha de comunicação com o servidor.');
}

function formatOrderTime(isoString?: string): string {
  if (!isoString) return '09:30';
  try {
    const dt = new Date(isoString);
    const now = new Date();
    const isToday =
      dt.getFullYear() === now.getFullYear() &&
      dt.getMonth() === now.getMonth() &&
      dt.getDate() === now.getDate();
    if (!isToday) return 'Ontem';
    return dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '09:30';
  }
}

export async function fetchWorkspaceData(reconciled: string[] = []): Promise<AppData> {
  const [topbar, agenda, backofficeOrders] = await Promise.all([
    apiFetch<{ products: any[]; pendingNfeQueueCount: number }>('/mobile/topbar'),
    apiFetch<any[]>('/mobile/agenda'),
    apiFetch<any[]>('/backoffice/orders?status=ALL'),
  ]);

  const products: Product[] = (topbar.products || []).map((p: any, idx: number) => ({
    id: toUiProductId(Number(p.id), idx),
    dbId: Number(p.id),
    skuCode: p.skuCode || `SKU-0${p.id}`,
    name: p.shortName || p.name,
    category: p.unitOfMeasure === 'SA' ? 'Saco 25kg' : p.unitOfMeasure || 'Importado',
    physical: Number(p.physicalStock ?? 0),
    reserved: Number(p.reservedStock ?? 0),
    cost: Number(p.currentLandedCost ?? 0),
    price: Number(p.baseListPrice ?? 0),
    ncm: p.ncm || '11010010',
  }));

  const clientDetails = await Promise.all(
    (agenda || []).map((card: any) =>
      apiFetch<any>(`/mobile/clients/${card.clientId}`).catch(() => null)
    )
  );

  const clients: Client[] = (agenda || []).map((card: any, idx: number) => {
    const detail = clientDetails[idx];
    const prices = products.map(p => {
      const mem = detail?.skuPrices?.find((sp: any) => Number(sp.productId) === p.dbId);
      return Number(mem?.lastPracticedPrice ?? p.price);
    });

    const rawNotes: string[] = detail?.notes?.length
      ? [...detail.notes]
          .reverse()
          .map((n: any) => `${n.formattedDate || 'Hoje'} • ${n.content}`)
      : card.latestNote
      ? [`Hoje • ${card.latestNote}`]
      : ['Hoje • Sem observações registradas.'];

    return {
      id: String(card.clientId),
      dbId: Number(card.clientId),
      colorKey: CLIENT_COLOR_KEYS[idx % CLIENT_COLOR_KEYS.length],
      name: card.tradeName || card.corporateName,
      neighborhood: card.neighborhood || 'São Paulo',
      buyer: detail?.contactName || 'Comprador',
      cnpj: detail?.cnpj || card.cnpj || '',
      ie: detail?.stateRegistration || '',
      ibge: detail?.ibgeCityCode || '',
      days: Number(card.daysSinceLastOrder ?? 0),
      cycle: Number(card.averagePurchaseCycleDays ?? 20),
      lastTotal: Number(card.lastOrderTotal ?? 0),
      overdue: card.financialStatus === 'BOLETO_VENCIDO',
      time: card.scheduledTime || '10:00',
      notes: rawNotes,
      prices,
    };
  });

  const orders: Order[] = (backofficeOrders || []).map((o: any) => {
    const isBilled = o.status === 'FATURADO' || o.status === 'ENTREGUE';
    const itemsMap = new Map<string, any>();
    for (const item of o.items || []) {
      const uiId = toUiProductId(Number(item.productId));
      itemsMap.set(uiId, item);
    }

    const allItems: Item[] = products.map(p => {
      const matched = itemsMap.get(p.id);
      if (matched) {
        return {
          productId: p.id,
          quantity: Number(matched.quantity ?? 0),
          price: Number(matched.unitSalePrice ?? p.price),
          cost: Number(matched.unitCostSnapshot ?? p.cost),
          orderedQuantity: Number(matched.orderedQuantity ?? matched.quantity ?? 0),
          orderedPrice: Number(matched.orderedUnitPrice ?? matched.unitSalePrice ?? p.price),
          adjusted: Boolean(matched.hasBackofficeAdjustment),
        };
      }
      return {
        productId: p.id,
        quantity: 0,
        price: p.price,
        cost: p.cost,
        orderedQuantity: 0,
        orderedPrice: p.price,
        adjusted: false,
      };
    });

    return {
      id: String(o.id),
      clientId: String(o.clientId),
      items: allItems,
      status: isBilled ? 'FATURADO' : 'AGUARDANDO_REVISAO',
      rawStatus: o.status,
      payment: o.paymentTerms || 'Boleto 28 dias',
      delivery: o.deliveryForecast || 'Amanhã Manhã',
      note: o.notesForInvoiceOrDriver || '',
      promotional: Boolean(o.items?.some((i: any) => i.isPromotionalPrice)),
      date: formatOrderTime(o.createdAt),
      invoice: o.nfeNumber || undefined,
      key: o.nfeAccessKey || undefined,
      xmlUrl: o.xmlUrl || undefined,
      hasDiff: Boolean(o.hasCommercialVsFiscalDifference),
      originalTotal: Number(o.originalCommercialTotal ?? o.grossTotal ?? 0),
    };
  });

  return {
    products,
    clients,
    orders,
    reconciled,
    backendConnected: true,
  };
}

export async function createOrderApi(data: AppData, order: Order): Promise<AppData> {
  const activeItems = order.items.filter(i => i.quantity > 0);
  if (activeItems.length === 0) {
    throw new Error('Adicione ao menos um produto.');
  }

  await apiFetch('/mobile/orders', {
    method: 'POST',
    body: JSON.stringify({
      clientId: Number(order.clientId),
      paymentTerms: order.payment,
      deliveryForecast: order.delivery,
      notesForInvoiceOrDriver: order.note,
      shippingCostEstimate: 45,
      items: activeItems.map(i => ({
        productId: toDbProductId(i.productId, data.products),
        quantity: i.quantity,
        unitSalePrice: i.price,
        isPromotionalPrice: order.promotional,
      })),
    }),
  });

  return fetchWorkspaceData(data.reconciled);
}

export async function reviewOrderApi(
  data: AppData,
  orderId: string,
  items: Item[]
): Promise<AppData> {
  const order = data.orders.find(o => o.id === orderId);
  if (!order) throw new Error('Pedido não encontrado.');
  const client = data.clients.find(c => c.id === order.clientId);

  await apiFetch(`/backoffice/orders/${Number(orderId)}/review`, {
    method: 'PUT',
    body: JSON.stringify({
      paymentTerms: order.payment,
      deliveryForecast: order.delivery,
      notesForInvoiceOrDriver: order.note,
      backofficeAdjustmentNotes: 'Revisado na Mesa de Conferência Pré-Nota',
      shippingCostEstimate: 45,
      clientCorporateName: client?.name,
      clientCnpj: client?.cnpj || null,
      clientStateRegistration: client?.ie || null,
      clientNeighborhood: client?.neighborhood || null,
      clientIbgeCityCode: client?.ibge || null,
      items: items.map(i => ({
        productId: toDbProductId(i.productId, data.products),
        quantity: Math.max(0, Number(i.quantity || 0)),
        unitSalePrice: Number(i.price || 0),
      })),
    }),
  });

  return fetchWorkspaceData(data.reconciled);
}

export async function completeFiscalViaCnpjApi(
  data: AppData,
  orderId: string,
  client: Client
): Promise<{ nextData: AppData; message: string }> {
  const order = data.orders.find(o => o.id === orderId);
  if (!order) throw new Error('Pedido não encontrado.');

  const cleanCnpj = (client.cnpj || '48936777000199').replace(/\D/g, '') || '48936777000199';
  const lookup = await apiFetch<any>(`/backoffice/fiscal/cnpj/${cleanCnpj}`);

  await apiFetch(`/backoffice/orders/${Number(orderId)}/review`, {
    method: 'PUT',
    body: JSON.stringify({
      paymentTerms: order.payment,
      deliveryForecast: order.delivery,
      notesForInvoiceOrDriver: order.note,
      backofficeAdjustmentNotes: 'Cadastro fiscal enriquecido via BrasilAPI',
      shippingCostEstimate: 45,
      clientCorporateName: lookup.corporateName || client.name,
      clientCnpj: lookup.cnpj || '48.936.777/0001-99',
      clientStateRegistration: lookup.stateRegistrationSuggestion || '110042490115',
      clientZipCode: lookup.zipCode || '04346-000',
      clientStreet: lookup.street || 'Av. Rodrigues Montemor',
      clientNumber: lookup.number || '919',
      clientNeighborhood: lookup.neighborhood || client.neighborhood || 'Jabaquara',
      clientCity: lookup.city || 'São Paulo',
      clientState: lookup.state || 'SP',
      clientIbgeCityCode: lookup.ibgeCityCode || '3550308',
      items: order.items.map(i => ({
        productId: toDbProductId(i.productId, data.products),
        quantity: i.quantity,
        unitSalePrice: i.price,
      })),
    }),
  });

  const nextData = await fetchWorkspaceData(data.reconciled);
  return {
    nextData,
    message: lookup.statusMessage || 'Dados fiscais preenchidos via BrasilAPI.',
  };
}

export async function generatePickingApi(orderId: string): Promise<string | null> {
  try {
    const res = await apiFetch<{ whatsappFormattedText?: string }>(
      `/backoffice/orders/${Number(orderId)}/picking`,
      { method: 'POST' }
    );
    return res.whatsappFormattedText ?? null;
  } catch {
    return null;
  }
}

export async function issueNfeApi(data: AppData, orderId: string): Promise<AppData> {
  await apiFetch(`/backoffice/orders/${Number(orderId)}/issue-nfe`, {
    method: 'POST',
  });
  return fetchWorkspaceData(data.reconciled);
}

export async function addClientNoteApi(
  data: AppData,
  clientId: string,
  content: string
): Promise<AppData> {
  await apiFetch(`/mobile/clients/${Number(clientId)}/notes`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
  return fetchWorkspaceData(data.reconciled);
}

export async function scheduleVisitApi(
  data: AppData,
  params: { clientId?: string | undefined; name: string; neighborhood: string; time: string }
): Promise<AppData> {
  await apiFetch('/mobile/visits', {
    method: 'POST',
    body: JSON.stringify({
      clientId: params.clientId ? Number(params.clientId) : null,
      quickClientName: params.name,
      quickNeighborhood: params.neighborhood || 'São Paulo',
      scheduledTime: params.time || '11:00',
      reminderNote: 'Visita agendada pelo app em campo.',
    }),
  });
  return fetchWorkspaceData(data.reconciled);
}

export async function registerImportBatchApi(
  data: AppData,
  params: {
    fx: number;
    freightUsd: number;
    brokerBrl: number;
    taxesBrl: number[];
    quantities: number[];
    fobTotalUsdPerSku: number[];
  }
): Promise<AppData> {
  const totalTaxesBrl = params.taxesBrl.reduce((a, b) => a + b, 0);
  await apiFetch('/backoffice/import-batches', {
    method: 'POST',
    body: JSON.stringify({
      batchCode: `IMP-${new Date().toISOString().slice(0, 10)}-${String(Date.now()).slice(-3)}`,
      supplierName: 'Molinos Exportadora Mercosul',
      exchangeRateUsd: params.fx,
      internationalFreightBrl: Number((params.freightUsd * params.fx).toFixed(2)),
      importTaxesBrl: Number(totalTaxesBrl.toFixed(2)),
      customsExpensesBrl: Number(params.brokerBrl.toFixed(2)),
      notes: 'Lote nacionalizado via Calculadora de Importação',
      items: data.products.map((p, i) => {
        const qty = Math.max(1, Math.floor(params.quantities[i] ?? 1));
        const skuTotalFobUsd = Number(params.fobTotalUsdPerSku[i] ?? 0);
        const fobUnitUsd = qty > 0 ? Number((skuTotalFobUsd / qty).toFixed(4)) : 0;
        return {
          productId: p.dbId ?? i + 1,
          quantityImported: qty,
          fobUnitUsd,
        };
      }),
    }),
  });
  return fetchWorkspaceData(data.reconciled);
}