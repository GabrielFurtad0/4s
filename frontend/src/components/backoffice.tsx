import { useState } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  Ban,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock3,
  FileCheck2,
  FileText,
  Layers,
  Loader2,
  Package,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  TriangleAlert,
  Truck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { SpotlightCard } from '@/components/ui/spotlight-card';
import { NumberTicker } from '@/components/ui/number-ticker';
import { SlidingTabs } from '@/components/ui/sliding-tabs';
import { PulseBadge } from '@/components/ui/pulse-badge';
import { CopyButton } from '@/components/ui/copy-button';
import { ShimmerButton } from '@/components/ui/shimmer-button';
import { BorderBeam } from '@/components/ui/border-beam';
import { ProfitGauge } from '@/components/ui/profit-gauge';
import { fireConfetti } from '@/components/ui/confetti';
import {
  available,
  baseBalance,
  cancelOrderApi,
  cancelOrderLocal,
  completeFiscalViaCnpjApi,
  deliverOrderApi,
  deliverOrderLocal,
  editOrder,
  financials,
  fiscalReady,
  generatePickingApi,
  invoiceOrder,
  issueNfeApi,
  itemBq,
  itemDq,
  marginLevel,
  money,
  orderBaseValue,
  orderTotalBq,
  orderTotalDq,
  productLabel,
  reviewOrderApi,
  type Item,
  type Order,
} from '@/lib/business';
import { Metric } from './management';
import type { SharedProps } from './seller';

export function Backoffice({ data, update, notify }: SharedProps & { newOrder: () => void }) {
  const [tab, setTab] = useState('all');
  const [stockMode, setStockMode] = useState<'dual' | 'physical' | 'base'>('dual');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editItems, setEditItems] = useState<Item[]>([]);
  const [packing, setPacking] = useState(false);
  const [customPackingText, setCustomPackingText] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [filters, setFilters] = useState(false);
  const [fiscalFilter, setFiscalFilter] = useState('all');
  const [period, setPeriod] = useState('today');
  const [page, setPage] = useState(1);

  const effectiveStatus = (o: Order) => o.rawStatus || o.status;

  const pending = data.orders.filter(
    o => effectiveStatus(o) === 'AGUARDANDO_REVISAO' || effectiveStatus(o) === 'EM_SEPARACAO'
  );
  const pickingOrders = data.orders.filter(o => effectiveStatus(o) === 'EM_SEPARACAO');
  const billed = data.orders.filter(o => effectiveStatus(o) === 'FATURADO');
  const delivered = data.orders.filter(o => effectiveStatus(o) === 'ENTREGUE');
  const cancelled = data.orders.filter(o => effectiveStatus(o) === 'CANCELADO');

  const pendingValue = pending.reduce((a, o) => a + financials(o.items).total, 0);
  const ready = pending.filter(o => {
    const c = data.clients.find(c => c.id === o.clientId);
    return c && fiscalReady(c);
  });
  const selected = data.orders.find(o => o.id === selectedId);
  const selectedClient = data.clients.find(c => c.id === selected?.clientId);

  const visible = data.orders
    .filter(o => {
      const c = data.clients.find(c => c.id === o.clientId);
      const st = effectiveStatus(o);
      const matchesTab =
        tab === 'all' ||
        (tab === 'pending' && st === 'AGUARDANDO_REVISAO') ||
        (tab === 'picking' && st === 'EM_SEPARACAO') ||
        (tab === 'billed' && st === 'FATURADO') ||
        (tab === 'delivered' && st === 'ENTREGUE') ||
        (tab === 'cancelled' && st === 'CANCELADO');
      return (
        matchesTab &&
        `${o.id} ${c?.name}`.toLowerCase().includes(search.toLowerCase()) &&
        (fiscalFilter === 'all' ||
          (fiscalFilter === 'ready' && c && fiscalReady(c)) ||
          (fiscalFilter === 'incomplete' && c && !fiscalReady(c))) &&
        (period === 'all' || o.date !== 'Ontem' || tab !== 'pending')
      );
    })
    .sort((a, b) => Number(b.id) - Number(a.id));

  const openOrder = (o: Order) => {
    setSelectedId(o.id);
    setEditing(false);
    setPacking(false);
    setCustomPackingText(null);
  };

  // Romaneio Cego exibe exclusivamente a Qtd. Expedição (DQ)
  const fallbackPackingText =
    selected && selectedClient
      ? `ROMANEIO DE SEPARAÇÃO & ENTREGA #${selected.id}\n${selectedClient.name}\n${selectedClient.neighborhood}, São Paulo - SP\nComprador: ${selectedClient.buyer}\nEntrega: ${selected.delivery}\n\nCARGA PARA SEPARAR NO GALPÃO (DQ):\n${selected.items
          .filter(i => itemDq(i) > 0)
          .map(i => `• ${itemDq(i)} sacas (${itemDq(i) * 25} kg) — ${productLabel(data, i.productId)}`)
          .join('\n')}\n\nVolume Total (DQ): ${orderTotalDq(selected.items)} sacas (${orderTotalDq(selected.items) * 25} kg)\nObs: ${selected.note || 'Sem observações'}`
      : '';
  const packingText = customPackingText || fallbackPackingText;

  const download = (text: string, name: string, type = 'text/plain') => {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderStatusBadge = (o: Order) => {
    const st = effectiveStatus(o);
    if (st === 'ENTREGUE') {
      return (
        <span className="status-badge success">
          <CheckCheck size={12} />
          Entregue
        </span>
      );
    }
    if (st === 'FATURADO') {
      return (
        <span className="status-badge success">
          <CheckCheck size={12} />
          Faturado
        </span>
      );
    }
    if (st === 'CANCELADO') {
      return (
        <span className="status-badge danger">
          <Ban size={12} />
          Cancelado
        </span>
      );
    }
    if (st === 'EM_SEPARACAO') {
      return (
        <span className="status-badge warning">
          <Truck size={12} />
          Em separação
        </span>
      );
    }
    return (
      <span className="status-badge warning">
        <Clock3 size={12} />
        Em revisão
      </span>
    );
  };

  const activeModalItems = editing ? editItems : selected?.items ?? [];
  const modalFin = financials(activeModalItems);
  const modalTotalDq = orderTotalDq(activeModalItems);
  const modalTotalBq = orderTotalBq(activeModalItems);
  const modalBaseValue = orderBaseValue(activeModalItems);
  const selectedEffectiveStatus = selected ? effectiveStatus(selected) : '';
  const isLockedOrder =
    selectedEffectiveStatus === 'FATURADO' ||
    selectedEffectiveStatus === 'ENTREGUE' ||
    selectedEffectiveStatus === 'CANCELADO';

  return (
    <>
      {/* Grid de Métricas com Spotlight e Contadores Animados */}
      <div className="metric-grid">
        <Metric
          label="Fila pré-nota & separação"
          value={<NumberTicker value={pending.length} padZeroes={2} />}
          icon={<Clock3 />}
          footer={
            <>
              <span className="mini-dot warning-dot" />
              {pending.length} pedidos ativos na conferência
            </>
          }
        />
        <Metric
          label="Valor em conferência (DQ)"
          value={<NumberTicker value={pendingValue} prefix="R$ " decimals={2} />}
          icon={<ClipboardList />}
          footer={
            <>
              <span className="text-muted-foreground">Estoque reservado (DQ) ·</span>{' '}
              <NumberTicker
                value={pending.reduce((a, o) => a + orderTotalDq(o.items), 0)}
                suffix=" un."
              />
            </>
          }
        />
        <Metric
          label="Prontos para faturar"
          value={<NumberTicker value={ready.length} padZeroes={2} />}
          icon={<ShieldCheck />}
          footer={
            <>
              <span className="mini-dot success-dot" />
              Cadastro fiscal completo
            </>
          }
        />
        <Metric
          label="Faturados / Entregues"
          value={<NumberTicker value={billed.length + delivered.length} padZeroes={2} />}
          icon={<FileCheck2 />}
          footer={
            <>
              <span className="text-success">
                <CheckCheck size={13} />
              </span>
              {billed.length} faturados · {delivered.length} entregues
            </>
          }
        />
      </div>

      {/* Cards de Estoque Dual (Saldo Físico DQ vs Saldo Base BQ) */}
      <section className="stock-section">
        <div className="section-heading">
          <h3>
            <Package size={16} />
            Posição de estoque
          </h3>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1.5"
              onClick={() =>
                setStockMode(m => (m === 'dual' ? 'physical' : m === 'physical' ? 'base' : 'dual'))
              }
            >
              <Layers size={13} />
              {stockMode === 'dual'
                ? 'Visão Dual (Físico DQ + Base BQ)'
                : stockMode === 'physical'
                ? 'Apenas Saldo Físico (DQ)'
                : 'Apenas Saldo Base (BQ)'}
            </Button>
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <span className="online-dot" />
              Atualizado em tempo real
            </span>
          </div>
        </div>
        <div className="stock-grid">
          {data.products.map(p => (
            <SpotlightCard
              className="stock-card"
              key={p.id}
              spotlightColor="rgba(67, 97, 238, 0.14)"
            >
              <div className={`sku-symbol sku-${p.id.toLowerCase()}`}>
                <Package size={22} />
              </div>
              <div className="stock-card-content">
                <div className="flex justify-between items-start">
                  <div>
                    <strong>{p.name}</strong>
                    <span className="stock-category">
                      {p.category} <span className="mx-1">·</span> {p.skuCode ?? `SKU-00${p.id}`} · Custo Médio: {money(p.cost)}
                    </span>
                  </div>
                  <span className="status-badge neutral">NCM {p.ncm}</span>
                </div>
                <div className="stock-numbers">
                  {stockMode !== 'base' && (
                    <>
                      <div>
                        <span>Físico (DQ)</span>
                        <b className="numeric">
                          <NumberTicker value={p.physical} />
                          <small>un.</small>
                        </b>
                      </div>
                      <div>
                        <span>Reservado (DQ)</span>
                        <b className="numeric reserved">
                          <NumberTicker value={p.reserved} />
                          <small>un.</small>
                        </b>
                      </div>
                      <div>
                        <span>Disponível (DQ)</span>
                        <b className="numeric available">
                          <NumberTicker value={available(p)} />
                          <small>un.</small>
                        </b>
                      </div>
                    </>
                  )}
                  {stockMode !== 'physical' && (
                    <div>
                      <span>Saldo Base (BQ)</span>
                      <b className="numeric text-primary">
                        <NumberTicker value={baseBalance(p)} />
                        <small>un.</small>
                      </b>
                    </div>
                  )}
                </div>
              </div>
            </SpotlightCard>
          ))}
        </div>
      </section>

      {/* Seção de Pedidos com Sliding Tabs (Todos os Status) e Filtros */}
      <section className="orders-section">
        <div className="orders-toolbar">
          <SlidingTabs
            tabs={[
              { id: 'all', label: 'Todos', count: data.orders.length },
              {
                id: 'pending',
                label: 'Pré-nota',
                count: data.orders.filter(o => effectiveStatus(o) === 'AGUARDANDO_REVISAO').length,
              },
              { id: 'picking', label: 'Em separação', count: pickingOrders.length },
              { id: 'billed', label: 'Faturados', count: billed.length },
              { id: 'delivered', label: 'Entregues', count: delivered.length },
              { id: 'cancelled', label: 'Cancelados', count: cancelled.length },
            ]}
            activeTab={tab}
            onChange={t => {
              setTab(t);
              setPage(1);
            }}
          />
          <div className="flex gap-2 items-center">
            <Button variant="outline" className="filter-button" onClick={() => setFilters(v => !v)}>
              <SlidersHorizontal />
              Filtros
              {fiscalFilter !== 'all' && <span className="online-dot" />}
            </Button>
            <select
              className="date-filter"
              aria-label="Período dos pedidos"
              value={period}
              onChange={e => setPeriod(e.target.value)}
            >
              <option value="today">16 out, 2026</option>
              <option value="all">Todo o período</option>
            </select>
          </div>
        </div>

        {filters && (
          <div className="filter-row">
            <label className="field-label">
              Cadastro fiscal
              <select className="form-input" value={fiscalFilter} onChange={e => setFiscalFilter(e.target.value)}>
                <option value="all">Todos os clientes</option>
                <option value="ready">Dados completos</option>
                <option value="incomplete">Dados pendentes</option>
              </select>
            </label>
            <Button
              variant="ghost"
              onClick={() => {
                setFiscalFilter('all');
                setFilters(false);
              }}
            >
              Limpar
            </Button>
          </div>
        )}

        <div className="table-search">
          <Search size={16} />
          <input
            value={search}
            onChange={e => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Buscar por pedido ou cliente..."
            aria-label="Buscar pedido ou cliente"
          />
          <span className="search-hint">⌘ K</span>
        </div>

        <div className="table-scroll">
          <table className="data-table orders-table">
            <thead>
              <tr>
                <th>
                  Pedido <ChevronDown size={12} />
                </th>
                <th>Cliente</th>
                <th>Valor total (DQ / BQ)</th>
                <th>Cadastro fiscal</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.slice((page - 1) * 10, page * 10).map(o => {
                const c = data.clients.find(c => c.id === o.clientId);
                if (!c) return null;
                const f = financials(o.items);
                const dq = orderTotalDq(o.items);
                const bq = orderTotalBq(o.items);
                return (
                  <tr key={o.id} onClick={() => openOrder(o)}>
                    <td>
                      <strong className="numeric">#{o.id}</strong>
                      <p>{o.date === 'Ontem' ? '15 out' : `Hoje, ${o.date}`}</p>
                    </td>
                    <td>
                      <div className="client-cell">
                        <span className={`client-initial client-${c.colorKey ?? c.id}`}>
                          {c.name
                            .split(' ')
                            .map(s => s[0])
                            .slice(0, 2)
                            .join('')}
                        </span>
                        <div>
                          <strong>{c.name}</strong>
                          <p>{c.neighborhood}, SP</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <strong className="numeric">{money(f.total)}</strong>
                      <p>
                        DQ: {dq} un.
                        {bq !== dq ? ` · BQ: ${bq} un.` : ''} · {o.payment}
                      </p>
                    </td>
                    <td>
                      {fiscalReady(c) ? (
                        <PulseBadge status="ready" label="Dados completos" sublabel="SEFAZ OK" />
                      ) : (
                        <PulseBadge status="pending" label="Dados pendentes" sublabel="BrasilAPI" />
                      )}
                    </td>
                    <td>{renderStatusBadge(o)}</td>
                    <td>
                      <Button variant="ghost" size="icon" aria-label={`Revisar pedido ${o.id}`}>
                        <ChevronRight />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {visible.length === 0 && (
            <div className="empty-state">
              <Search size={22} />
              <strong>Nenhum pedido encontrado</strong>
              <p>Os pedidos enviados aparecerão aqui.</p>
            </div>
          )}
        </div>

        <div className="table-footer">
          <span>
            Mostrando {visible.length ? (page - 1) * 10 + 1 : 0}–{Math.min(page * 10, visible.length)} de {visible.length} pedidos
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              aria-label="Página anterior"
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
            >
              <ChevronLeft />
            </Button>
            <span className="page-number">{page}</span>
            <Button
              variant="outline"
              size="icon"
              aria-label="Próxima página"
              disabled={page * 10 >= visible.length}
              onClick={() => setPage(p => p + 1)}
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
      </section>

      {/* Workflow Strip */}
      <div className="workflow-strip">
        <div className="workflow-label">
          <span className="workflow-icon">
            <ArrowRight />
          </span>
          <div>
            <strong>Cada pedido, no caminho certo.</strong>
            <p>Da visita ao cliente até a entrega.</p>
          </div>
        </div>
        <div className="workflow-steps">
          <span>
            <span className="step-number">1</span>Pedido em campo (DQ/BQ)
          </span>
          <ChevronRight />
          <span>
            <span className="step-number">2</span>Revisão pré-nota
          </span>
          <ChevronRight />
          <span>
            <span className="step-number">3</span>Emissão NF-e (BQ)
          </span>
          <ChevronRight />
          <span>
            <span className="step-number">4</span>Romaneio & Entrega (DQ)
          </span>
        </div>
      </div>

      {/* Modal de Conferência Pré-Nota e Romaneio */}
      <Dialog
        open={Boolean(selected)}
        onOpenChange={open => {
          if (!open && !busy) setSelectedId(null);
        }}
      >
        <DialogContent className="order-dialog">
          <DialogTitle>{packing ? 'Romaneio Cego de Separação (DQ)' : `Pedido #${selected?.id}`}</DialogTitle>
          <DialogDescription>
            {selectedClient?.name} · {selectedClient?.neighborhood}
          </DialogDescription>
          {selected && selectedClient && (
            <>
              {packing ? (
                <>
                  <pre className="packing-sheet">{packingText}</pre>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setPacking(false)}>
                      <ChevronLeft />
                      Voltar
                    </Button>
                    <CopyButton
                      textToCopy={packingText}
                      label="Copiar para WhatsApp"
                      copiedLabel="Romaneio Copiado!"
                      withConfetti={true}
                      onCopied={() => notify('Romaneio cego (DQ) copiado para enviar à equipe do galpão.')}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className={`fiscal-notice ${fiscalReady(selectedClient) ? 'complete' : ''}`}>
                    <div className="flex items-center gap-2">
                      {fiscalReady(selectedClient) ? <ShieldCheck size={18} /> : <TriangleAlert size={18} />}
                      <div>
                        <strong>{fiscalReady(selectedClient) ? 'Pronto para SEFAZ' : 'Dados fiscais pendentes'}</strong>
                        <p>
                          {fiscalReady(selectedClient)
                            ? `${selectedClient.cnpj} · IE ${selectedClient.ie} · IBGE ${selectedClient.ibge}`
                            : 'CNPJ, Inscrição Estadual ou código IBGE pendentes.'}
                        </p>
                      </div>
                    </div>
                    {!fiscalReady(selectedClient) && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        className="relative overflow-hidden group shadow-xs border-amber-500/30 text-amber-700 dark:text-amber-300"
                        onClick={async () => {
                          setBusy(true);
                          try {
                            const { nextData, message } = await completeFiscalViaCnpjApi(data, selected.id, selectedClient);
                            update(nextData);
                            fireConfetti();
                            notify(message);
                          } catch (e) {
                            notify(
                              e instanceof Error
                                ? e.message
                                : 'Não foi possível consultar o CNPJ: verifique se o servidor está conectado.'
                            );
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        <BorderBeam size={80} duration={6} colorFrom="#4361EE" colorTo="#F59E0B" />
                        {busy ? <Loader2 className="animate-spin" /> : <Search />}
                        Completar via CNPJ
                      </Button>
                    )}
                  </div>

                  {/* Itens do Pedido com Qtd. Expedição (DQ), Qtd. Base (BQ) e Preço Unitário */}
                  <div className="review-items">
                    {activeModalItems.map((i, index) => {
                      const dq = itemDq(i);
                      const bq = itemBq(i);
                      return (
                        <div key={i.productId}>
                          <span className={`sku-symbol sku-${i.productId.toLowerCase()}`}>
                            <Package size={19} />
                          </span>
                          <div>
                            <strong>{productLabel(data, i.productId)}</strong>
                            {!editing && (
                              <p className="text-[11px] text-muted-foreground numeric">
                                Expedição (DQ): <b>{dq} un.</b> · Base (BQ): <b>{bq} un.</b>
                              </p>
                            )}
                          </div>
                          {editing ? (
                            <div className="flex items-center gap-2 flex-wrap">
                              <label className="text-[10px] text-muted-foreground flex flex-col">
                                Qtd. Expedição (DQ)
                                <input
                                  type="number"
                                  className="form-input numeric w-20"
                                  min="0"
                                  aria-label={`Revisar quantidade ${i.productId}`}
                                  value={dq}
                                  onChange={e => {
                                    const nextDq = Math.max(0, Math.floor(Number(e.target.value) || 0));
                                    setEditItems(v =>
                                      v.map((item, j) =>
                                        j === index
                                          ? {
                                              ...item,
                                              quantity: nextDq,
                                              dispatchQuantity: nextDq,
                                              baseQuantity: Math.min(nextDq, itemBq(item)),
                                            }
                                          : item
                                      )
                                    );
                                  }}
                                />
                              </label>
                              <label className="text-[10px] text-muted-foreground flex flex-col">
                                Qtd. Base (BQ)
                                <input
                                  type="number"
                                  className="form-input numeric w-20"
                                  min="0"
                                  max={dq}
                                  aria-label={`Revisar base ${i.productId}`}
                                  value={bq}
                                  onChange={e => {
                                    const nextBq = Math.max(0, Math.min(dq, Math.floor(Number(e.target.value) || 0)));
                                    setEditItems(v =>
                                      v.map((item, j) =>
                                        j === index
                                          ? {
                                              ...item,
                                              baseQuantity: nextBq,
                                            }
                                          : item
                                      )
                                    );
                                  }}
                                />
                              </label>
                              <label className="text-[10px] text-muted-foreground flex flex-col">
                                Preço Unit. (R$)
                                <input
                                  type="number"
                                  className="form-input numeric w-24"
                                  min="0.01"
                                  step="0.01"
                                  aria-label={`Revisar preço ${i.productId}`}
                                  value={i.price}
                                  onChange={e =>
                                    setEditItems(v =>
                                      v.map((item, j) =>
                                        j === index ? { ...item, price: Number(e.target.value) } : item
                                      )
                                    )
                                  }
                                />
                              </label>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs numeric">
                              {dq} × {money(i.price)}
                            </span>
                          )}
                          <b className="numeric">{money(dq * i.price)}</b>
                        </div>
                      );
                    })}
                  </div>

                  <div className="review-total">
                    <div>
                      <span>Total Expedição (DQ: {modalTotalDq} sacas)</span>
                      <p className="text-xs text-muted-foreground numeric">
                        Total Base (BQ: {modalTotalBq} sacas): {money(modalBaseValue)} · Imposto 8% (BQ): {money(modalFin.tax)} · Frete (R$ 4/saca): {money(modalFin.logistics)}
                      </p>
                    </div>
                    <h2 className="numeric">{money(modalFin.total)}</h2>
                  </div>

                  <div className="review-meta">
                    <div>
                      <span>Pagamento</span>
                      <strong>{selected.payment}</strong>
                    </div>
                    <div>
                      <span>Entrega prevista</span>
                      <strong>{selected.delivery}</strong>
                    </div>
                    <div>
                      <span>Status Atual</span>
                      {renderStatusBadge(selected)}
                    </div>
                  </div>

                  {selected.note && <p className="review-note">{selected.note}</p>}

                  {/* Profit Breakdown com o Anel Radial de Margem */}
                  <div className="review-profit flex items-center gap-4 bg-muted/30 p-3 rounded-lg border border-border/40">
                    <ProfitGauge margin={modalFin.margin} size={48} />
                    <div className="flex flex-col">
                      <span className="text-[10px] text-muted-foreground">Lucro líquido estimado</span>
                      <strong className="numeric text-base text-foreground">
                        {money(modalFin.profit)}
                      </strong>
                    </div>
                    <span className={`status-badge ml-auto ${marginLevel(modalFin.margin)}`}>
                      Margem: {modalFin.margin.toFixed(1)}%
                    </span>
                  </div>

                  {(selectedEffectiveStatus === 'FATURADO' || selectedEffectiveStatus === 'ENTREGUE') && (
                    <div className="invoice-issued">
                      <div className="flex items-center gap-2">
                        <CheckCheck />
                        <strong>NF-e {selected.invoice} emitida · SEFAZ Autorizada</strong>
                      </div>
                      <div className="flex items-center gap-2 my-2 bg-card/60 p-2 rounded border border-emerald-500/20">
                        <p className="numeric text-[11px] font-mono break-all select-all flex-1 m-0">
                          {selected.key}
                        </p>
                        <CopyButton
                          textToCopy={selected.key || ''}
                          iconOnly={true}
                          withConfetti={true}
                          title="Copiar Chave da NF-e"
                          aria-label="Copiar Chave da NF-e"
                          className="h-7 w-7 shrink-0"
                          onCopied={() => notify('Chave da NF-e copiada.')}
                        />
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            download(
                              `DANFE DEMONSTRATIVO — TOTAL TRIGO\nNF-e ${selected.invoice}\nChave: ${selected.key}\n${selectedClient.name}\n${selected.items
                                .filter(i => itemBq(i) > 0)
                                .map(i => `${itemBq(i)}x ${productLabel(data, i.productId)} — ${money(i.price)}`)
                                .join('\n')}\nTotal Base (BQ): ${money(orderBaseValue(selected.items))}`,
                              `DANFE-${selected.invoice}.txt`
                            );
                            notify('DANFE baixado.');
                          }}
                        >
                          <DownloadIcon />
                          Baixar DANFE demonstrativo
                        </Button>
                        {selected.xmlUrl && (
                          <Button variant="outline" size="sm" onClick={() => window.open(selected.xmlUrl, '_blank')}>
                            <FileText size={14} />
                            Ver XML NF-e
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="dialog-actions flex-wrap">
                    <Button
                      variant="outline"
                      onClick={async () => {
                        const txt = await generatePickingApi(selected.id);
                        if (txt) setCustomPackingText(txt);
                        setPacking(true);
                      }}
                    >
                      <Truck />
                      Gerar romaneio (DQ)
                    </Button>

                    {!isLockedOrder && (
                      <>
                        {editing ? (
                          <Button
                            variant="outline"
                            disabled={busy}
                            onClick={async () => {
                              if (modalTotalDq < 1 || modalTotalBq < 1) {
                                notify('A Qtd. Expedição (DQ) e a Qtd. Base (BQ) devem ser de pelo menos 1 saca.');
                                return;
                              }
                              setBusy(true);
                              try {
                                const next = await reviewOrderApi(data, selected.id, editItems);
                                update(next);
                                setEditing(false);
                                notify('Pré-nota revisada (DQ e BQ). Reserva de estoque atualizada.');
                              } catch (e) {
                                try {
                                  update(editOrder(data, selected.id, editItems));
                                  setEditing(false);
                                  notify('Pedido revisado. Reserva de estoque atualizada.');
                                } catch (err) {
                                  notify(
                                    e instanceof Error
                                      ? e.message
                                      : err instanceof Error
                                      ? err.message
                                      : 'Confira o pedido.'
                                  );
                                }
                              } finally {
                                setBusy(false);
                              }
                            }}
                          >
                            <Check />
                            Salvar revisão
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            onClick={() => {
                              setEditItems(
                                selected.items.map(i => ({
                                  ...i,
                                  dispatchQuantity: itemDq(i),
                                  baseQuantity: itemBq(i),
                                }))
                              );
                              setEditing(true);
                            }}
                          >
                            Editar pré-nota (DQ/BQ)
                          </Button>
                        )}
                        <ShimmerButton
                          disabled={busy || !fiscalReady(selectedClient) || editing || modalTotalBq < 1}
                          onClick={async () => {
                            setBusy(true);
                            try {
                              const next = await issueNfeApi(data, selected.id);
                              update(next);
                              fireConfetti();
                              notify('NF-e emitida no servidor. Estoque físico (DQ) e Saldo Base (BQ) atualizados.');
                            } catch (e) {
                              try {
                                update(invoiceOrder(data, selected.id));
                                fireConfetti();
                                notify('NF-e simulada emitida. Estoque físico (DQ) e Saldo Base (BQ) atualizados.');
                              } catch (err) {
                                notify(
                                  e instanceof Error
                                    ? e.message
                                    : err instanceof Error
                                    ? err.message
                                    : 'Não foi possível emitir.'
                                );
                              }
                            } finally {
                              setBusy(false);
                            }
                          }}
                        >
                          {busy ? <Loader2 className="animate-spin" /> : <FileCheck2 />}
                          Emitir NF-e
                        </ShimmerButton>
                      </>
                    )}

                    {/* Botão Confirmar Entrega (quando FATURADO) */}
                    {selectedEffectiveStatus === 'FATURADO' && (
                      <Button
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          try {
                            const next = await deliverOrderApi(data, selected.id);
                            update(next);
                            fireConfetti();
                            notify(`Entrega do Pedido #${selected.id} confirmada com sucesso!`);
                          } catch {
                            update(deliverOrderLocal(data, selected.id));
                            fireConfetti();
                            notify(`Pedido #${selected.id} marcado como ENTREGUE.`);
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        <CheckCheck size={15} />
                        Confirmar Entrega
                      </Button>
                    )}

                    {/* Botão Cancelar Pedido */}
                    {selectedEffectiveStatus !== 'CANCELADO' && selectedEffectiveStatus !== 'ENTREGUE' && (
                      <Button
                        variant="outline"
                        disabled={busy}
                        className="text-destructive border-destructive/30 hover:bg-destructive/10"
                        onClick={async () => {
                          setBusy(true);
                          try {
                            const next = await cancelOrderApi(data, selected.id);
                            update(next);
                            setEditing(false);
                            notify(`Pedido #${selected.id} cancelado e saldos estornados.`);
                          } catch {
                            update(cancelOrderLocal(data, selected.id));
                            setEditing(false);
                            notify(`Pedido #${selected.id} cancelado e saldos estornados.`);
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        <Ban size={14} />
                        Cancelar Pedido
                      </Button>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {data.backendConnected
                      ? 'Conectado ao servidor · alterações salvas em banco de dados.'
                      : 'Ambiente de demonstração · emissão sem validade fiscal.'}
                  </span>
                </>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function DownloadIcon() {
  return <ArrowDownToLine size={14} />;
}