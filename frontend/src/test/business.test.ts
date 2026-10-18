import { describe, expect, it } from 'vitest';
import {
  applyImportBatchLocal,
  available,
  baseBalance,
  editOrder,
  financials,
  fiscalReady,
  initialData,
  invoiceOrder,
  marginLevel,
  reserveOrder,
  type Order,
} from '../lib/business';

const baseItem = {
  productId: 'A',
  quantity: 10,
  dispatchQuantity: 10,
  baseQuantity: 10,
  price: 85,
  cost: 54,
};

const order: Order = {
  id: 'test',
  clientId: '1',
  items: [baseItem],
  status: 'AGUARDANDO_REVISAO',
  date: '10:00',
  payment: 'Boleto 28 dias',
  delivery: 'Amanhã Manhã',
  note: '',
  promotional: false,
};

describe('Commercial & Fiscal Domain Rules (DQ vs BQ, Dual Stock, R$ 4/saca, Margem 7-20%)', () => {
  it('has the 3 official Total Trigo SKUs with physical stock, baseStock, landed cost and list price', () => {
    expect(initialData.products.map(p => [p.physical, p.reserved, baseBalance(p), p.cost, p.price])).toEqual([
      [2259, 0, 2259, 54, 85],
      [1739, 0, 1739, 49.5, 78],
      [180, 0, 180, 61, 92],
    ]);
  });

  it('reserves immediately by DQ without reducing physicalStock or baseStock', () => {
    const splitOrder: Order = {
      ...order,
      items: [{ ...baseItem, quantity: 20, dispatchQuantity: 20, baseQuantity: 10 }],
    };
    const d = reserveOrder(structuredClone(initialData), splitOrder);
    expect(d.products[0]?.physical).toBe(2259);
    expect(d.products[0]?.reserved).toBe(20);
    expect(d.products[0] ? available(d.products[0]) : -1).toBe(2239);
    expect(d.products[0] ? baseBalance(d.products[0]) : -1).toBe(2259);
    expect(d.orders[0]?.status).toBe('AGUARDANDO_REVISAO');
  });

  it('invoicing deducts DQ from physicalStock/reserved and deducts BQ from baseStock', () => {
    const splitOrder: Order = {
      ...order,
      items: [{ ...baseItem, quantity: 20, dispatchQuantity: 20, baseQuantity: 10 }],
    };
    const d = invoiceOrder(reserveOrder(structuredClone(initialData), splitOrder), 'test');
    expect(d.products[0]?.physical).toBe(2239);
    expect(d.products[0]?.reserved).toBe(0);
    expect(d.products[0] ? baseBalance(d.products[0]) : -1).toBe(2249);
    expect(d.orders[0]?.status).toBe('FATURADO');
    expect(d.orders[0]?.key).toHaveLength(44);
    expect(() => invoiceOrder(d, 'test')).toThrow();
  });

  it('requires complete fiscal data before invoice and blocks total BQ < 1', () => {
    const d = reserveOrder(structuredClone(initialData), { ...order, clientId: '5' });
    const incompleteClient = d.clients.find(c => c.id === '5');
    expect(incompleteClient ? fiscalReady(incompleteClient) : true).toBe(false);
    expect(() => invoiceOrder(d, 'test')).toThrow();
    expect(() =>
      reserveOrder(structuredClone(initialData), {
        ...order,
        items: [{ ...baseItem, dispatchQuantity: 10, baseQuantity: 0 }],
      })
    ).toThrow();
  });

  it('calculates 8% tax exclusively over BQ and R$ 4.00/sack freight over DQ', () => {
    // DQ = 20, BQ = 10, price = 80, cost = 54
    // total (DQ) = 1600, cost (DQ) = 1080, tax (8% of BQ=800) = 64, logistics (20 * 4) = 80
    // profit = 1600 - 1080 - 64 - 80 = 376
    const res = financials([
      { productId: 'A', quantity: 20, dispatchQuantity: 20, baseQuantity: 10, price: 80, cost: 54 },
    ]);
    expect(res).toEqual({
      total: 1600,
      cost: 1080,
      tax: 64,
      logistics: 80,
      profit: 376,
      margin: (376 / 1600) * 100,
    });
  });

  it('uses official margin thresholds (>= 20% success, 7% to < 20% warning, < 7% danger)', () => {
    expect(marginLevel(20)).toBe('success');
    expect(marginLevel(19.99)).toBe('warning');
    expect(marginLevel(7)).toBe('warning');
    expect(marginLevel(6.99)).toBe('danger');
  });

  it('blocks DQ exceeding available stock', () => {
    expect(() =>
      reserveOrder(structuredClone(initialData), {
        ...order,
        items: [{ ...baseItem, quantity: 2260, dispatchQuantity: 2260, baseQuantity: 2260 }],
      })
    ).toThrow();
  });

  it('revising a pending order replaces its DQ reservation', () => {
    const d = editOrder(reserveOrder(structuredClone(initialData), order), 'test', [
      { ...baseItem, quantity: 25, dispatchQuantity: 25, baseQuantity: 15 },
    ]);
    expect(d.products[0]?.reserved).toBe(25);
    expect(d.products[0]?.physical).toBe(2259);
  });

  it('promotional price preserves the client standard price', () => {
    const d = invoiceOrder(
      reserveOrder(structuredClone(initialData), {
        ...order,
        promotional: true,
        items: [{ ...baseItem, price: 72 }],
      }),
      'test'
    );
    expect(d.clients[0]?.prices[0]).toBe(79);
  });

  it('calculates weighted average cost and increments both physical and baseStock (BQ = DQ) on import batch', () => {
    const d = applyImportBatchLocal(structuredClone(initialData), [741, 0, 0], [60, 49.5, 61]);
    // (2259 * 54 + 741 * 60) / 3000 = (121986 + 44460) / 3000 = 166446 / 3000 = 55.48
    expect(d.products[0]?.physical).toBe(3000);
    expect(d.products[0] ? baseBalance(d.products[0]) : 0).toBe(3000);
    expect(d.products[0]?.cost).toBe(55.48);
  });
});