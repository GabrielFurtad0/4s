export type Product = {
  id: string;
  dbId?: number | undefined;
  skuCode?: string | undefined;
  name: string;
  category: string;
  physical: number;
  reserved: number;
  baseStock?: number | undefined;
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
  dispatchQuantity?: number | undefined;
  baseQuantity?: number | undefined;
  price: number;
  cost: number;
  orderedQuantity?: number | undefined;
  orderedPrice?: number | undefined;
  adjusted?: boolean | undefined;
};

export type OrderStatusType =
  | 'AGUARDANDO_REVISAO'
  | 'EM_SEPARACAO'
  | 'FATURADO'
  | 'ENTREGUE'
  | 'CANCELADO';

export type Order = {
  id: string;
  clientId: string;
  items: Item[];
  status: OrderStatusType;
  rawStatus?: string | undefined;
  payment: string;
  firstDueDate?: string | undefined;
  dueDates?: string[] | undefined;
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

export const FREIGHT_PER_SACK_BRL = 4;
export const TAX_RATE_BASE = 0.08;

export const money = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const available = (p: Product) => p.physical - p.reserved;

export const baseBalance = (p: Product) => p.baseStock ?? p.physical;

export const itemDq = (i: Item): number =>
  i.dispatchQuantity !== undefined ? i.dispatchQuantity : i.quantity;

export const itemBq = (i: Item): number =>
  i.baseQuantity !== undefined ? i.baseQuantity : itemDq(i);

export const orderTotalDq = (items: Item[]): number =>
  items.reduce((sum, i) => sum + itemDq(i), 0);

export const orderTotalBq = (items: Item[]): number =>
  items.reduce((sum, i) => sum + itemBq(i), 0);

export const orderBaseValue = (items: Item[]): number =>
  items.reduce((sum, i) => sum + itemBq(i) * i.price, 0);

export const productLabel = (data: AppData, productId: string) =>
  data.products.find(p => p.id === productId)?.name ?? `Produto ${productId}`;

/**
 * Cálculo financeiro oficial da Total Trigo:
 * - Receita Bruta (total): calculada sobre a Qtd. Expedição (DQ) -> soma(DQ * price)
 * - CMV (cost): calculado sobre a Qtd. Expedição (DQ) -> soma(DQ * cost)
 * - Impostos Estimados (tax): 8% calculados EXCLUSIVAMENTE sobre a Qtd. Base (BQ) -> soma(BQ * price * 0.08)
 * - Frete / Entrega (logistics): R$ 4,00 por saca entregue (DQ) -> 4 * soma(DQ)
 * - Lucro Líquido (profit): total - cost - tax - logistics
 * - Margem Líquida (margin): (profit / total) * 100
 */
export function financials(items: Item[]) {
  const total = items.reduce((a, i) => a + itemDq(i) * i.price, 0);
  const cost = items.reduce((a, i) => a + itemDq(i) * i.cost, 0);
  const tax = items.reduce((a, i) => a + itemBq(i) * i.price * TAX_RATE_BASE, 0);
  const totalDq = items.reduce((a, i) => a + itemDq(i), 0);
  const logistics = totalDq * FREIGHT_PER_SACK_BRL;
  const profit = total - cost - tax - logistics;
  const margin = total > 0 ? (profit / total) * 100 : 0;
  return { total, cost, tax, logistics, profit, margin };
}

/**
 * Semáforo de Margem Líquida Oficial:
 * - >= 20%: 'success' (Verde)
 * - >= 7% e < 20%: 'warning' (Amarelo)
 * - < 7%: 'danger' (Vermelho)
 */
export const marginLevel = (margin: number) =>
  margin >= 20 ? 'success' : margin >= 7 ? 'warning' : 'danger';

export const fiscalReady = (c: Client) => Boolean(c.cnpj && c.ie && c.ibge);

export function reserveOrder(data: AppData, order: Order): AppData {
  const totalDq = orderTotalDq(order.items);
  const totalBq = orderTotalBq(order.items);
  if (totalDq <= 0) throw new Error('Adicione ao menos um produto na Qtd. Expedição (DQ).');
  if (totalBq < 1) throw new Error('A Qtd. Base (BQ) total do pedido deve ser de pelo menos 1 unidade.');

  for (const i of order.items) {
    const p = data.products.find(p => p.id === i.productId);
    const dq = itemDq(i);
    const bq = itemBq(i);
    if (
      !p ||
      dq < 0 ||
      bq < 0 ||
      bq > dq ||
      !Number.isInteger(dq) ||
      !Number.isInteger(bq) ||
      dq > available(p) ||
      i.price <= 0
    ) {
      throw new Error('Confira as quantidades (DQ/BQ), os preços e o estoque disponível.');
    }
  }
  return {
    ...data,
    orders: [
      {
        ...order,
        items: order.items.map(i => ({
          ...i,
          quantity: itemDq(i),
          dispatchQuantity: itemDq(i),
          baseQuantity: itemBq(i),
        })),
      },
      ...data.orders,
    ],
    products: data.products.map(p => {
      const matched = order.items.find(i => i.productId === p.id);
      const dq = matched ? itemDq(matched) : 0;
      return {
        ...p,
        reserved: p.reserved + dq,
      };
    }),
  };
}

export function invoiceOrder(data: AppData, id: string): AppData {
  const o = data.orders.find(o => o.id === id);
  if (!o || o.status === 'FATURADO' || o.status === 'ENTREGUE') {
    throw new Error('Este pedido já foi faturado.');
  }
  if (o.status === 'CANCELADO') {
    throw new Error('Não é possível faturar um pedido cancelado.');
  }
  if (orderTotalBq(o.items) < 1) {
    throw new Error('A Qtd. Base (BQ) total do pedido nunca pode ser zero.');
  }
  const c = data.clients.find(c => c.id === o.clientId);
  if (!c || !fiscalReady(c)) throw new Error('Complete os dados fiscais antes de emitir.');
  return {
    ...data,
    products: data.products.map(p => {
      const matched = o.items.find(i => i.productId === p.id);
      const dq = matched ? itemDq(matched) : 0;
      const bq = matched ? itemBq(matched) : 0;
      return {
        ...p,
        physical: p.physical - dq,
        reserved: Math.max(0, p.reserved - dq),
        baseStock: Math.max(0, baseBalance(p) - bq),
      };
    }),
    orders: data.orders.map(order =>
      order.id === id
        ? {
            ...order,
            status: 'FATURADO',
            rawStatus: 'FATURADO',
            invoice: String(12929 + data.orders.filter(ord => ord.status === 'FATURADO' || ord.status === 'ENTREGUE').length),
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
                o.items.find(i => i.productId === p.id && itemDq(i) > 0)?.price ??
                client.prices[index] ??
                p.price
            ),
          }
    ),
  };
}

export function editOrder(data: AppData, id: string, items: Item[]): AppData {
  const old = data.orders.find(o => o.id === id);
  if (!old || old.status === 'FATURADO' || old.status === 'ENTREGUE' || old.status === 'CANCELADO') {
    throw new Error('Pedido não editável.');
  }
  const released = {
    ...data,
    orders: data.orders.filter(o => o.id !== id),
    products: data.products.map(p => {
      const oldItem = old.items.find(i => i.productId === p.id);
      const oldDq = oldItem ? itemDq(oldItem) : 0;
      return {
        ...p,
        reserved: Math.max(0, p.reserved - oldDq),
      };
    }),
  };
  return reserveOrder(released, { ...old, items });
}

export function deliverOrderLocal(data: AppData, id: string): AppData {
  const o = data.orders.find(ord => ord.id === id);
  if (!o || o.status !== 'FATURADO') {
    throw new Error('Apenas pedidos faturados podem ser marcados como entregues.');
  }
  return {
    ...data,
    orders: data.orders.map(ord =>
      ord.id === id ? { ...ord, status: 'ENTREGUE', rawStatus: 'ENTREGUE' } : ord
    ),
  };
}

export function cancelOrderLocal(data: AppData, id: string): AppData {
  const o = data.orders.find(ord => ord.id === id);
  if (!o || o.status === 'CANCELADO') return data;
  return {
    ...data,
    products: data.products.map(p => {
      const matched = o.items.find(i => i.productId === p.id);
      const dq = matched ? itemDq(matched) : 0;
      const bq = matched ? itemBq(matched) : 0;
      if (o.status === 'AGUARDANDO_REVISAO' || o.status === 'EM_SEPARACAO') {
        return { ...p, reserved: Math.max(0, p.reserved - dq) };
      }
      if (o.status === 'FATURADO') {
        return {
          ...p,
          physical: p.physical + dq,
          baseStock: baseBalance(p) + bq,
        };
      }
      return p;
    }),
    orders: data.orders.map(ord =>
      ord.id === id ? { ...ord, status: 'CANCELADO', rawStatus: 'CANCELADO' } : ord
    ),
  };
}

/**
 * Aplica entrada de lote de importação calculando Custo Médio Ponderado
 * e somando a quantidade importada igualmente em physical e baseStock (BQ = DQ).
 */
export function applyImportBatchLocal(
  data: AppData,
  quantities: number[],
  unitLandedCosts: number[]
): AppData {
  return {
    ...data,
    products: data.products.map((p, i) => {
      const qtyImported = Math.max(0, Math.floor(quantities[i] ?? 0));
      const newBatchUnitCost = Number(unitLandedCosts[i] ?? p.cost);
      if (qtyImported <= 0) return p;

      const currentPhysical = Math.max(0, p.physical);
      const currentBase = Math.max(0, baseBalance(p));
      const weightedAvgCost =
        currentPhysical > 0
          ? Number(
              (
                (currentPhysical * p.cost + qtyImported * newBatchUnitCost) /
                (currentPhysical + qtyImported)
              ).toFixed(2)
            )
          : Number(newBatchUnitCost.toFixed(2));

      return {
        ...p,
        physical: currentPhysical + qtyImported,
        baseStock: currentBase + qtyImported,
        cost: weightedAvgCost,
      };
    }),
  };
}

export const initialData: AppData = {
  products: [
    { id: 'A', dbId: 1, skuCode: 'SKU-05', name: 'Farinha Tipo 1 (25kg)', category: 'Saco 25kg', physical: 2259, reserved: 0, baseStock: 2259, cost: 54, price: 85, ncm: '1101.00.10' },
    { id: 'B', dbId: 2, skuCode: 'SKU-02', name: 'Pré-Mistura Francês (25kg)', category: 'Saco 25kg', physical: 1739, reserved: 0, baseStock: 1739, cost: 49.5, price: 78, ncm: '1101.00.10' },
    { id: 'C', dbId: 3, skuCode: 'SKU-03', name: 'PM Pão Doce (25kg)', category: 'Saco 25kg', physical: 180, reserved: 0, baseStock: 180, cost: 61, price: 92, ncm: '1101.00.10' },
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
        dispatchQuantity: quantities[i] ?? 0,
        baseQuantity: quantities[i] ?? 0,
        price: client.prices[i] ?? p.price,
        cost: p.cost,
      })),
      status: 'AGUARDANDO_REVISAO',
      rawStatus: 'AGUARDANDO_REVISAO',
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
      { productId: 'A', quantity: 20, dispatchQuantity: 20, baseQuantity: 20, price: 79, cost: 54 },
      { productId: 'B', quantity: 20, dispatchQuantity: 20, baseQuantity: 20, price: 75, cost: 49.5 },
      { productId: 'C', quantity: 0, dispatchQuantity: 0, baseQuantity: 0, price: 88, cost: 61 },
    ],
    status: 'FATURADO',
    rawStatus: 'FATURADO',
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

export type UserRoleProfile =
  | 'Sérgio Soares · Sócio & Rua'
  | 'Gabriel Furtado · Backoffice & Fiscal'
  | 'Expedição · Romaneio Cego';

export const PROFILES_LIST: UserRoleProfile[] = [
  'Sérgio Soares · Sócio & Rua',
  'Gabriel Furtado · Backoffice & Fiscal',
  'Expedição · Romaneio Cego',
];

export function getActiveProfile(): UserRoleProfile {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('totaltrigo_active_profile');
    if (saved && (PROFILES_LIST as string[]).includes(saved)) {
      return saved as UserRoleProfile;
    }
  }
  return 'Gabriel Furtado · Backoffice & Fiscal';
}

export function setActiveProfile(profile: UserRoleProfile): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('totaltrigo_active_profile', profile);
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const activeProfile = getActiveProfile();
  const [actorName, actorRole] = activeProfile.split(' · ').map(s => s.trim());

  const isFormData = typeof FormData !== 'undefined' && init?.body instanceof FormData;
  const headers: Record<string, string> = {
    'X-Actor-Name': actorName || 'Gabriel Furtado',
    'X-Actor-Role': actorRole || 'Backoffice & Fiscal',
    ...((init?.headers as Record<string, string>) ?? {}),
  };
  if (!isFormData && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
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
      if (
        lastError.message &&
        !lastError.message.includes('Failed to fetch') &&
        !lastError.message.includes('NetworkError') &&
        !lastError.message.includes('HTTP 404')
      ) {
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

function normalizeOrderStatus(raw?: string): OrderStatusType {
  if (raw === 'EM_SEPARACAO') return 'EM_SEPARACAO';
  if (raw === 'FATURADO') return 'FATURADO';
  if (raw === 'ENTREGUE') return 'ENTREGUE';
  if (raw === 'CANCELADO') return 'CANCELADO';
  return 'AGUARDANDO_REVISAO';
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
    baseStock: Number(p.baseStock ?? p.physicalStock ?? 0),
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
    const itemsMap = new Map<string, any>();
    for (const item of o.items || []) {
      const uiId = toUiProductId(Number(item.productId));
      itemsMap.set(uiId, item);
    }

    const allItems: Item[] = products.map(p => {
      const matched = itemsMap.get(p.id);
      if (matched) {
        const dq = Number(matched.dispatchQuantity ?? matched.orderedQuantity ?? matched.quantity ?? 0);
        const bq = Number(matched.baseQuantity ?? matched.quantity ?? dq);
        return {
          productId: p.id,
          quantity: dq,
          dispatchQuantity: dq,
          baseQuantity: bq,
          price: Number(matched.unitSalePrice ?? p.price),
          cost: Number(matched.unitCostSnapshot ?? p.cost),
          orderedQuantity: Number(matched.orderedQuantity ?? dq),
          orderedPrice: Number(matched.orderedUnitPrice ?? matched.unitSalePrice ?? p.price),
          adjusted: Boolean(matched.hasBackofficeAdjustment),
        };
      }
      return {
        productId: p.id,
        quantity: 0,
        dispatchQuantity: 0,
        baseQuantity: 0,
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
      status: normalizeOrderStatus(o.status),
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
  const activeItems = order.items.filter(i => itemDq(i) > 0);
  if (activeItems.length === 0) {
    throw new Error('Adicione ao menos um produto na Qtd. Expedição (DQ).');
  }
  const totalDq = orderTotalDq(activeItems);
  const totalBq = orderTotalBq(activeItems);
  if (totalBq < 1) {
    throw new Error('A Qtd. Base (BQ) total do pedido deve ser de pelo menos 1 unidade.');
  }

  await apiFetch('/mobile/orders', {
    method: 'POST',
    body: JSON.stringify({
      clientId: Number(order.clientId),
      paymentTerms: order.payment,
      deliveryForecast: order.delivery,
      notesForInvoiceOrDriver: order.firstDueDate
        ? `${order.note ? order.note + ' · ' : ''}1ª parcela: ${order.firstDueDate.split('-').reverse().join('/')}${order.dueDates && order.dueDates.length > 1 ? ` (${order.dueDates.length}x a cada 7 dias)` : ''}`
        : order.note,
      shippingCostEstimate: totalDq * FREIGHT_PER_SACK_BRL,
      items: activeItems.map(i => ({
        productId: toDbProductId(i.productId, data.products),
        quantity: itemBq(i),
        dispatchQuantity: itemDq(i),
        baseQuantity: itemBq(i),
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

  const totalDq = orderTotalDq(items);
  const totalBq = orderTotalBq(items);
  if (totalDq < 1) {
    throw new Error('A Qtd. Expedição (DQ) total do pedido deve ser de pelo menos 1 saca.');
  }
  if (totalBq < 1) {
    throw new Error('A Qtd. Base (BQ) total do pedido nunca pode ser zero (mínimo 1 saca).');
  }

  await apiFetch(`/backoffice/orders/${Number(orderId)}/review`, {
    method: 'PUT',
    body: JSON.stringify({
      paymentTerms: order.payment,
      deliveryForecast: order.delivery,
      notesForInvoiceOrDriver: order.note,
      backofficeAdjustmentNotes: 'Revisado na Mesa de Conferência Pré-Nota (DQ/BQ)',
      shippingCostEstimate: totalDq * FREIGHT_PER_SACK_BRL,
      clientCorporateName: client?.name,
      clientCnpj: client?.cnpj || null,
      clientStateRegistration: client?.ie || null,
      clientNeighborhood: client?.neighborhood || null,
      clientIbgeCityCode: client?.ibge || null,
      items: items.map(i => {
        const dq = Math.max(0, Number(itemDq(i) || 0));
        const bq = Math.max(0, Math.min(dq, Number(itemBq(i) || 0)));
        return {
          productId: toDbProductId(i.productId, data.products),
          quantity: bq,
          dispatchQuantity: dq,
          baseQuantity: bq,
          unitSalePrice: Number(i.price || 0),
        };
      }),
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

  const cleanCnpj = (client.cnpj || '').replace(/\D/g, '');
  if (cleanCnpj.length !== 14) {
    throw new Error('Este cliente não possui um CNPJ válido de 14 dígitos cadastrado para consulta.');
  }

  const lookup = await apiFetch<any>(`/backoffice/fiscal/cnpj/${cleanCnpj}`);
  const totalDq = orderTotalDq(order.items);

  await apiFetch(`/backoffice/orders/${Number(orderId)}/review`, {
    method: 'PUT',
    body: JSON.stringify({
      paymentTerms: order.payment,
      deliveryForecast: order.delivery,
      notesForInvoiceOrDriver: order.note,
      backofficeAdjustmentNotes: 'Cadastro fiscal enriquecido via BrasilAPI',
      shippingCostEstimate: totalDq * FREIGHT_PER_SACK_BRL,
      clientCorporateName: lookup.corporateName || client.name,
      clientCnpj: lookup.cnpj || formatCnpj(cleanCnpj),
      clientStateRegistration: lookup.stateRegistrationSuggestion || client.ie,
      clientZipCode: lookup.zipCode || null,
      clientStreet: lookup.street || null,
      clientNumber: lookup.number || null,
      clientNeighborhood: lookup.neighborhood || client.neighborhood,
      clientCity: lookup.city || 'São Paulo',
      clientState: lookup.state || 'SP',
      clientIbgeCityCode: lookup.ibgeCityCode || client.ibge,
      items: order.items.map(i => ({
        productId: toDbProductId(i.productId, data.products),
        quantity: itemBq(i),
        dispatchQuantity: itemDq(i),
        baseQuantity: itemBq(i),
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

export async function deliverOrderApi(data: AppData, orderId: string): Promise<AppData> {
  await apiFetch(`/backoffice/orders/${Number(orderId)}/deliver`, {
    method: 'POST',
  });
  return fetchWorkspaceData(data.reconciled);
}

export async function cancelOrderApi(data: AppData, orderId: string): Promise<AppData> {
  await apiFetch(`/backoffice/orders/${Number(orderId)}/cancel`, {
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
      notes: 'Lote nacionalizado via Calculadora de Importação (Custo Médio Ponderado, BQ = DQ)',
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

export function formatCnpj(v: string): string {
  const digits = v.replace(/\D/g, '').slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return digits.replace(/^(\d{2})(\d+)/, '$1.$2');
  if (digits.length <= 8) return digits.replace(/^(\d{2})(\d{3})(\d+)/, '$1.$2.$3');
  if (digits.length <= 12) return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d+)/, '$1.$2.$3/$4');
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d+)/, '$1.$2.$3/$4-$5');
}

export type CnpjData = {
  cnpj: string;
  name: string;
  corporateName: string;
  neighborhood: string;
  city: string;
  state: string;
  ie: string;
  ibge: string;
};

export async function lookupCnpjData(rawCnpj: string): Promise<CnpjData> {
  const clean = rawCnpj.replace(/\D/g, '');
  if (clean.length !== 14) {
    throw new Error('Informe um CNPJ válido com 14 dígitos.');
  }

  // 1. Consulta o backend local (BrasilApiService)
  try {
    const res = await apiFetch<any>(`/backoffice/fiscal/cnpj/${clean}`);
    if (res && (res.corporateName || res.tradeName)) {
      return {
        cnpj: res.cnpj || formatCnpj(clean),
        name: res.tradeName && res.tradeName.trim().length > 0 ? res.tradeName : res.corporateName,
        corporateName: res.corporateName,
        neighborhood: res.neighborhood || 'São Paulo',
        city: res.city || 'São Paulo',
        state: res.state || 'SP',
        ie: res.stateRegistrationSuggestion || '',
        ibge: res.ibgeCityCode || '3550308',
      };
    }
  } catch {
    // Tenta consulta direta na BrasilAPI pública caso o backend local esteja offline
  }

  // 2. Tenta diretamente na BrasilAPI pública se backend estiver desconectado
  try {
    const direct = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${clean}`);
    if (direct.ok) {
      const d = await direct.json();
      return {
        cnpj: formatCnpj(clean),
        name: d.nome_fantasia && d.nome_fantasia.trim() ? d.nome_fantasia : d.razao_social,
        corporateName: d.razao_social || '',
        neighborhood: d.bairro || 'São Paulo',
        city: d.municipio || 'São Paulo',
        state: d.uf || 'SP',
        ie: 'ISENTO',
        ibge: d.codigo_municipio_ibge ? String(d.codigo_municipio_ibge) : '3550308',
      };
    }
  } catch {
    // Falha de conexão
  }

  throw new Error(
    'Servidor backend desconectado e BrasilAPI indisponível no momento. Verifique sua conexão e tente novamente.'
  );
}

export async function quickRegisterClientApi(
  data: AppData,
  params: {
    cnpj: string;
    name?: string | undefined;
    corporateName?: string | undefined;
    neighborhood?: string | undefined;
    buyer?: string | undefined;
    ie?: string | undefined;
    ibge?: string | undefined;
  }
): Promise<{ nextData: AppData; client: Client }> {
  const cleanCnpj = params.cnpj.replace(/\D/g, '');
  if (cleanCnpj.length !== 14) {
    throw new Error('Informe um CNPJ válido com 14 dígitos para cadastrar o cliente.');
  }
  const formattedCnpj = formatCnpj(cleanCnpj);
  const clientName = params.name?.trim() || params.corporateName?.trim() || 'Novo Cliente';

  const fallbackClient: Client = {
    id: `c-${Date.now()}`,
    name: clientName,
    neighborhood: params.neighborhood || 'São Paulo',
    buyer: params.buyer || 'Comprador',
    cnpj: formattedCnpj,
    ie: params.ie || '',
    ibge: params.ibge || '3550308',
    days: 0,
    cycle: 20,
    lastTotal: 0,
    overdue: false,
    time: '10:00',
    notes: [`Hoje • Cliente pré-cadastrado via CNPJ ${formattedCnpj}.`],
    prices: data.products.map(p => p.price),
  };

  try {
    await apiFetch('/mobile/visits', {
      method: 'POST',
      body: JSON.stringify({
        quickClientName: clientName,
        quickCnpj: formattedCnpj,
        quickNeighborhood: params.neighborhood || 'São Paulo',
        quickContactName: params.buyer || 'Comprador',
        scheduledTime: '10:00',
        reminderNote: 'Cliente pré-cadastrado no campo via CNPJ.',
      }),
    });
    const fresh = await fetchWorkspaceData(data.reconciled);
    const created =
      fresh.clients.find(c => c.cnpj.replace(/\D/g, '') === cleanCnpj) ??
      fresh.clients[0] ??
      fallbackClient;
    return { nextData: fresh, client: created };
  } catch {
    return {
      nextData: {
        ...data,
        clients: [fallbackClient, ...data.clients],
      },
      client: fallbackClient,
    };
  }
}

// ============================================================================
// Fila de Pedidos Offline (App de Rua do Sr. Sérgio)
// ============================================================================

const OFFLINE_QUEUE_KEY = 'totaltrigo_offline_queue';

export function getOfflineOrdersQueue(): Order[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveOrderToOfflineQueue(order: Order): void {
  if (typeof window === 'undefined') return;
  try {
    const queue = getOfflineOrdersQueue();
    const filtered = queue.filter(o => o.id !== order.id);
    filtered.push(order);
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(filtered));
  } catch {}
}

export function removeOrderFromOfflineQueue(orderId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const queue = getOfflineOrdersQueue().filter(o => o.id !== orderId);
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  } catch {}
}

export function clearOfflineOrdersQueue(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(OFFLINE_QUEUE_KEY);
  } catch {}
}

export async function syncOfflineOrders(
  data: AppData
): Promise<{ syncedCount: number; nextData: AppData; remainingCount: number }> {
  const queue = getOfflineOrdersQueue();
  if (queue.length === 0) {
    return { syncedCount: 0, nextData: data, remainingCount: 0 };
  }

  let count = 0;
  let currentData = data;
  const remaining: Order[] = [];

  for (const order of queue) {
    try {
      currentData = await createOrderApi(currentData, order);
      count++;
    } catch {
      remaining.push(order);
    }
  }

  if (typeof window !== 'undefined') {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
  }

  return { syncedCount: count, nextData: currentData, remainingCount: remaining.length };
}

// ============================================================================
// Contas a Receber e Controle de Boletos sobre BQ (Sr. Sérgio)
// ============================================================================

export type ReceivableTitle = {
  id: number;
  orderId?: number | undefined;
  clientId: number;
  clientName: string;
  documentNumber: string;
  installmentNumber: number;
  totalInstallments: number;
  amountBq: number;
  dueDate: string;
  status: 'ABERTO' | 'PAGO' | 'VENCIDO' | 'CANCELADO';
  paidAt?: string | undefined;
  notes?: string | undefined;
  createdAt: string;
};

export async function fetchReceivablesApi(status = 'ALL'): Promise<ReceivableTitle[]> {
  try {
    return await apiFetch<ReceivableTitle[]>(`/backoffice/management/receivables?status=${status}`);
  } catch {
    return [
      {
        id: 1,
        clientId: 3,
        clientName: 'NOVA BELFORT PAES E DOCES LTDA EPP',
        documentNumber: 'BOL-NF012890-01',
        installmentNumber: 1,
        totalInstallments: 1,
        amountBq: 12300,
        dueDate: '2026-10-11',
        status: 'VENCIDO',
        notes: 'Boleto 28 dias ref. NF-e #12890 (Base BQ: R$ 12.300,00). Vencido há 7 dias.',
        createdAt: '2026-09-13T10:00:00',
      },
      {
        id: 2,
        orderId: 1,
        clientId: 1,
        clientName: 'PANIFICADORA JARDIM ELIANA LTDA',
        documentNumber: 'BOL-NF012926-01',
        installmentNumber: 1,
        totalInstallments: 1,
        amountBq: 3080,
        dueDate: '2026-10-24',
        status: 'ABERTO',
        notes: 'Boleto 28 dias ref. NF-e #12926. Parcela única calculada estritamente sobre BQ.',
        createdAt: '2026-09-26T10:00:00',
      },
      {
        id: 3,
        orderId: 2,
        clientId: 2,
        clientName: 'IND COM PANIFICACAO JARDIM MIRIAN LTDA',
        documentNumber: 'BOL-NF012928-01',
        installmentNumber: 1,
        totalInstallments: 2,
        amountBq: 2050,
        dueDate: '2026-10-21',
        status: 'ABERTO',
        notes: 'Boleto 14/28 dias (1/2) ref. NF-e #12928. Parcela 1 calculada sobre BQ.',
        createdAt: '2026-10-07T10:00:00',
      },
      {
        id: 4,
        orderId: 2,
        clientId: 2,
        clientName: 'IND COM PANIFICACAO JARDIM MIRIAN LTDA',
        documentNumber: 'BOL-NF012928-02',
        installmentNumber: 2,
        totalInstallments: 2,
        amountBq: 2050,
        dueDate: '2026-11-04',
        status: 'ABERTO',
        notes: 'Boleto 14/28 dias (2/2) ref. NF-e #12928. Parcela 2 calculada sobre BQ.',
        createdAt: '2026-10-07T10:00:00',
      },
    ];
  }
}

export async function payReceivableApi(titleId: number): Promise<ReceivableTitle> {
  try {
    return await apiFetch<ReceivableTitle>(`/backoffice/management/receivables/${titleId}/pay`, {
      method: 'POST',
    });
  } catch (err) {
    console.warn('Falha na chamada de baixa de boleto no servidor, aplicando baixa local:', err);
    return {
      id: titleId,
      clientId: 1,
      clientName: 'CLIENTE',
      documentNumber: `BOL-${titleId}`,
      installmentNumber: 1,
      totalInstallments: 1,
      amountBq: 0,
      dueDate: new Date().toISOString().slice(0, 10),
      status: 'PAGO',
      notes: 'Baixa confirmada manualmente.',
      paidAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
  }
}

// ============================================================================
// Trilha de Auditoria e Logs de Operação
// ============================================================================

export type AuditLog = {
  id: number;
  actorName: string;
  actorRole: string;
  actionType: string;
  targetEntity: string;
  targetId?: string | undefined;
  summary: string;
  createdAt: string;
};

export async function fetchAuditLogsApi(): Promise<AuditLog[]> {
  try {
    return await apiFetch<AuditLog[]>('/backoffice/management/audit-logs');
  } catch {
    return [
      {
        id: 1,
        actorName: 'Gabriel Furtado',
        actorRole: 'Backoffice & Fiscal',
        actionType: 'ENTRADA_LOTE_IMPORTACAO',
        targetEntity: 'ImportBatch',
        targetId: '1',
        summary: 'Nacionalização do Lote IMP-2026-09-ARG (3.000 sacas com Custo Médio Ponderado)',
        createdAt: new Date().toISOString(),
      },
      {
        id: 2,
        actorName: 'Gabriel Furtado',
        actorRole: 'Backoffice & Fiscal',
        actionType: 'EMISSAO_NFE',
        targetEntity: 'Order',
        targetId: '1',
        summary: 'NF-e #12926 emitida para Jardim Eliana (Base BQ: R$ 3.080,00)',
        createdAt: new Date().toISOString(),
      },
      {
        id: 3,
        actorName: 'Sérgio Soares',
        actorRole: 'Sócio & Rua',
        actionType: 'PEDIDO_NOVO',
        targetEntity: 'Order',
        targetId: '3',
        summary: 'Pedido #3 lançado em campo para Jardim Mirian (55 sacas DQ / 55 sacas BQ)',
        createdAt: new Date().toISOString(),
      },
    ];
  }
}

// ============================================================================
// Cadastros Completos e Ajustes de Estoque
// ============================================================================

export async function fetchManagementClientsApi(): Promise<any[]> {
  return await apiFetch<any[]>('/backoffice/management/clients');
}

export async function saveManagementClientApi(client: any): Promise<any> {
  if (client.id && typeof client.id === 'number') {
    return await apiFetch<any>(`/backoffice/management/clients/${client.id}`, {
      method: 'PUT',
      body: JSON.stringify(client),
    });
  }
  return await apiFetch<any>('/backoffice/management/clients', {
    method: 'POST',
    body: JSON.stringify(client),
  });
}

export type XmlClientImportResult = {
  totalFilesProcessed: number;
  clientsCreated: number;
  clientsUpdated: number;
  pricesUpdated: number;
  importedClientNames: string[];
  warnings: string[];
  message: string;
};

export async function importClientsXmlApi(files: File[]): Promise<XmlClientImportResult> {
  const formData = new FormData();
  for (const f of files) {
    formData.append('files', f);
  }
  return await apiFetch<XmlClientImportResult>('/backoffice/management/clients/import-xml', {
    method: 'POST',
    body: formData,
  });
}

export async function updateProductStockApi(
  productId: number,
  payload: {
    name?: string;
    shortName?: string;
    baseListPrice?: number;
    currentLandedCost?: number;
    physicalStock?: number;
    baseStock?: number;
    ncm?: string;
    cest?: string;
    cBenef?: string;
  }
): Promise<any> {
  return await apiFetch<any>(`/backoffice/management/products/${productId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function fetchClientPricesApi(clientId: number): Promise<any[]> {
  return await apiFetch<any[]>(`/backoffice/management/client-prices?clientId=${clientId}`);
}

export async function updateClientPriceApi(
  clientId: number,
  productId: number,
  agreedPrice: number
): Promise<any> {
  return await apiFetch<any>('/backoffice/management/client-prices', {
    method: 'PUT',
    body: JSON.stringify({ clientId, productId, agreedPrice }),
  });
}

// ============================================================================
// Visão Executiva Real
// ============================================================================

export async function fetchExecutiveSummaryApi(): Promise<any> {
  return await apiFetch<any>('/backoffice/management/executive-summary');
}