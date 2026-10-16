import {
  AgendaCard,
  BackofficeOrder,
  Client360,
  ClientNote,
  CnpjLookupResponse,
  ImportBatch,
  Romaneio,
  TopbarSummary
} from './types';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {})
    },
    ...options
  });
  if (!res.ok) {
    let errMsg = `Erro HTTP ${res.status}`;
    try {
      const errBody = await res.json();
      if (errBody.message) errMsg = errBody.message;
    } catch {
      // ignore
    }
    throw new Error(errMsg);
  }
  return res.json();
}

export const api = {
  // Mobile / Field Sales
  getTopbar: () => request<TopbarSummary>('/api/mobile/topbar'),
  getAgenda: () => request<AgendaCard[]>('/api/mobile/agenda'),
  getClient360: (clientId: number) => request<Client360>(`/api/mobile/clients/${clientId}`),
  addClientNote: (clientId: number, content: string) =>
    request<ClientNote>(`/api/mobile/clients/${clientId}/notes`, {
      method: 'POST',
      body: JSON.stringify({ content })
    }),
  createVisitOrQuickClient: (payload: {
    clientId?: number;
    quickClientName?: string;
    quickCnpj?: string;
    quickNeighborhood?: string;
    quickContactName?: string;
    quickPhone?: string;
    scheduledTime: string;
    reminderNote?: string;
  }) =>
    request<AgendaCard>('/api/mobile/visits', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  submitStreetOrder: (payload: {
    clientId: number;
    paymentTerms: string;
    deliveryForecast: string;
    notesForInvoiceOrDriver: string;
    shippingCostEstimate: number;
    items: Array<{
      productId: number;
      quantity: number;
      unitSalePrice: number;
      isPromotionalPrice: boolean;
    }>;
  }) =>
    request<BackofficeOrder>('/api/mobile/orders', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  // Backoffice Desktop (Gabriel)
  getBackofficeOrders: (status = 'ALL') =>
    request<BackofficeOrder[]>(`/api/backoffice/orders?status=${encodeURIComponent(status)}`),
  reviewPreNota: (orderId: number, payload: unknown) =>
    request<BackofficeOrder>(`/api/backoffice/orders/${orderId}/review`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    }),
  generateRomaneio: (orderId: number) =>
    request<Romaneio>(`/api/backoffice/orders/${orderId}/picking`, {
      method: 'POST'
    }),
  issueNfe: (orderId: number) =>
    request<BackofficeOrder>(`/api/backoffice/orders/${orderId}/issue-nfe`, {
      method: 'POST'
    }),
  deliverOrder: (orderId: number) =>
    request<BackofficeOrder>(`/api/backoffice/orders/${orderId}/deliver`, {
      method: 'POST'
    }),
  cancelOrder: (orderId: number) =>
    request<BackofficeOrder>(`/api/backoffice/orders/${orderId}/cancel`, {
      method: 'POST'
    }),
  lookupCnpjBrasilApi: (cnpj: string) =>
    request<CnpjLookupResponse>(`/api/backoffice/fiscal/cnpj/${encodeURIComponent(cnpj)}`),
  getImportBatches: () => request<ImportBatch[]>('/api/backoffice/import-batches'),
  createImportBatch: (payload: unknown) =>
    request<ImportBatch>('/api/backoffice/import-batches', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
};

export function formatBRL(value: number | undefined | null): string {
  const num = typeof value === 'number' && !Number.isNaN(value) ? value : 0;
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
