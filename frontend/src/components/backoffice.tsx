import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowRight,
  Ban,
  Barcode,
  Building2,
  Calendar,
  Check,
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ClipboardList,
  Clock3,
  CreditCard,
  DollarSign,
  Edit,
  ExternalLink,
  Eye,
  FileCheck2,
  FileCode2,
  FileText,
  FileUp,
  History,
  Info,
  Landmark,
  Layers,
  Loader2,
  MapPin,
  NotebookPen,
  Package,
  Plus,
  Printer,
  RefreshCw,
  Search,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Tag,
  TrendingUp,
  TriangleAlert,
  Truck,
  UploadCloud,
  User,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { DeliveryRouteModal } from './delivery-route-modal';
import { OrderDetailsModal, renderOrderStatusBadge } from './order-details-modal';
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
  fetchAuditLogsApi,
  fetchClientPricesApi,
  fetchManagementClientsApi,
  fetchReceivablesApi,
  fetchWorkspaceData,
  financials,
  fiscalReady,
  formatCnpj,
  generatePickingApi,
  importClientsXmlApi,
  invoiceOrder,
  issueNfeApi,
  itemBq,
  itemDq,
  lookupCnpjData,
  marginLevel,
  money,
  orderBaseValue,
  orderTotalBq,
  orderTotalDq,
  payReceivableApi,
  productLabel,
  reviewOrderApi,
  saveManagementClientApi,
  updateClientPriceApi,
  updateProductStockApi,
  type AppData,
  type AuditLog,
  type Client,
  type Item,
  type Order,
  type Product,
  type ReceivableTitle,
  type XmlClientImportResult,
} from '@/lib/business';
import { Metric } from './management';
import type { SharedProps } from './seller';
import { openPrintableDanfe, openPrintableRomaneio, openPrintableOrderSlip, openPrintableBoleto } from '@/lib/documentPrint';

export function Backoffice({
  data,
  update,
  notify,
  activeModule = 'orders',
  userProfile = 'Gabriel Furtado · Backoffice & Fiscal',
  newOrder,
  initialClientSearch,
  targetOrderId,
  onClearTargetOrderId,
}: SharedProps & {
  newOrder: () => void;
  activeModule?: string;
  userProfile?: string;
  initialClientSearch?: string;
  targetOrderId?: string | null;
  onClearTargetOrderId?: () => void;
}) {
  if (activeModule === 'receivables') {
    return <ReceivablesSection data={data} update={update} notify={notify} userProfile={userProfile} />;
  }
  if (activeModule === 'registrations') {
    return (
      <RegistrationsSection
        data={data}
        update={update}
        notify={notify}
        userProfile={userProfile}
        initialClientSearch={initialClientSearch}
      />
    );
  }
  if (activeModule === 'audit') {
    return <AuditSection notify={notify} userProfile={userProfile} />;
  }

  const isExpedicao = userProfile === 'Expedição · Romaneio Cego';
  const [tab, setTab] = useState(isExpedicao ? 'picking' : 'all');
  const [stockMode, setStockMode] = useState<'dual' | 'physical' | 'base'>('dual');
  const [stockCollapsed, setStockCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('totaltrigo_stock_collapsed') === 'true';
    }
    return false;
  });

  const toggleStockCollapsed = () => {
    setStockCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('totaltrigo_stock_collapsed', String(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (targetOrderId) {
      setSelectedId(targetOrderId);
      setEditing(false);
      onClearTargetOrderId?.();
    }
  }, [targetOrderId, onClearTargetOrderId]);
  const [editing, setEditing] = useState(false);
  const [editItems, setEditItems] = useState<Item[]>([]);
  const [packing, setPacking] = useState(false);
  const [customPackingText, setCustomPackingText] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [filters, setFilters] = useState(false);
  const [fiscalFilter, setFiscalFilter] = useState('all');
  const [period, setPeriod] = useState('today');
  const [page, setPage] = useState(1);
  const [routeModalOpen, setRouteModalOpen] = useState(false);

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

  const renderStatusBadge = (o: Order) => renderOrderStatusBadge(o);

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
        {isExpedicao ? (
          <Metric
            label="Volume a separar (DQ)"
            value={<NumberTicker value={pending.reduce((a, o) => a + orderTotalDq(o.items), 0)} suffix=" sacas" />}
            icon={<Truck />}
            footer={
              <>
                <span className="text-muted-foreground">Peso total ·</span>{' '}
                <NumberTicker
                  value={pending.reduce((a, o) => a + orderTotalDq(o.items) * 25, 0)}
                  suffix=" kg"
                />
              </>
            }
          />
        ) : (
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
        )}
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
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {!stockCollapsed && (
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
            )}
            {!stockCollapsed && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1.5 font-medium cursor-pointer"
                onClick={toggleStockCollapsed}
                aria-expanded={true}
                aria-label="Recolher estoque"
              >
                <ChevronUp size={13} />
                <span>Recolher estoque</span>
              </Button>
            )}
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <span className="online-dot" />
              Atualizado em tempo real
            </span>
          </div>
        </div>

        {stockCollapsed ? (
          <div
            className="stock-ticker-bar bg-card hover:bg-muted/30 transition-colors border border-border/80 rounded-xl px-4 py-2.5 flex items-center justify-between gap-3 text-xs shadow-2xs cursor-pointer select-none"
            onClick={toggleStockCollapsed}
            role="button"
            tabIndex={0}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleStockCollapsed();
              }
            }}
          >
            <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap min-w-0">
              <span className="inline-flex items-center gap-1.5 font-semibold text-foreground shrink-0">
                <Package size={14} className="text-primary shrink-0" />
                <span>Estoque Disponível:</span>
              </span>
              {data.products.map((p, idx) => {
                const avail = available(p);
                const base = baseBalance(p);
                const shortName = p.name
                  .replace(' (25kg)', '')
                  .replace('Farinha Tipo 1', 'Farinha T1')
                  .replace('Pré-Mistura Francês', 'Pré-Mistura')
                  .replace('PM Pão Doce', 'Pão Doce');
                const hasDivergence = avail !== base;

                return (
                  <span
                    key={p.id}
                    className="inline-flex items-center gap-1 text-muted-foreground whitespace-nowrap"
                    title={`SKU: ${p.name} | Físico Disp. (DQ): ${avail} un. | Saldo Base (BQ): ${base} un.`}
                  >
                    {idx > 0 && <span className="text-border mx-1 select-none">·</span>}
                    <span className="text-foreground font-medium">{shortName}:</span>
                    <strong className="numeric font-bold text-emerald-600 dark:text-emerald-400">
                      <NumberTicker value={avail} /> <small className="text-[10px] font-normal">un.</small>
                    </strong>
                    {hasDivergence && (
                      <span className="text-[11px] text-muted-foreground/90 font-mono ml-0.5">
                        (Base:{' '}
                        <strong className="text-primary font-semibold">
                          <NumberTicker value={base} /> un.
                        </strong>
                        )
                      </span>
                    )}
                  </span>
                );
              })}
            </div>
            <button
              type="button"
              className="text-xs text-primary hover:text-primary/80 font-medium inline-flex items-center gap-1 shrink-0 ml-auto cursor-pointer underline-offset-2 hover:underline"
              onClick={e => {
                e.stopPropagation();
                toggleStockCollapsed();
              }}
              aria-label="Expandir detalhes"
            >
              <span>Expandir detalhes</span>
              <ChevronDown size={13} />
            </button>
          </div>
        ) : (
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
        )}
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
                <th>{isExpedicao ? 'Carga / Volume (DQ)' : 'Valor total (DQ / BQ)'}</th>
                <th>{isExpedicao ? 'Destino / Rota' : 'Cadastro fiscal'}</th>
                <th>Status</th>
                <th className="text-right pr-4">Ações</th>
              </tr>
            </thead>
            <tbody>
              {visible.slice((page - 1) * 10, page * 10).map(o => {
                const c = data.clients.find(c => c.id === o.clientId);
                if (!c) return null;
                const f = financials(o.items);
                const dq = orderTotalDq(o.items);
                const bq = orderTotalBq(o.items);
                const isBilled = effectiveStatus(o) === 'FATURADO' || effectiveStatus(o) === 'ENTREGUE';
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
                      {isExpedicao ? (
                        <>
                          <strong className="numeric text-foreground">{dq} sacas ({dq * 25} kg)</strong>
                          <p className="text-[11px] text-muted-foreground">{o.delivery || 'Rota programada'}</p>
                        </>
                      ) : (
                        <>
                          <strong className="numeric">{money(f.total)}</strong>
                          <p>
                            DQ: {dq} un.
                            {bq !== dq ? ` · BQ: ${bq} un.` : ''} · {o.payment}
                          </p>
                        </>
                      )}
                    </td>
                    <td>
                      {isExpedicao ? (
                        <span className="text-xs text-muted-foreground font-medium">{c.neighborhood}, {c.city || 'SP'}</span>
                      ) : fiscalReady(c) ? (
                        <PulseBadge status="ready" label="Dados completos" sublabel="SEFAZ OK" />
                      ) : (
                        <PulseBadge status="pending" label="Dados pendentes" sublabel="BrasilAPI" />
                      )}
                    </td>
                    <td>{renderStatusBadge(o)}</td>
                    <td>
                      <div className="flex items-center justify-end gap-1.5 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        {isBilled && (
                          <>
                            {!isExpedicao && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="order-action-pill shadow-xs"
                                title="Imprimir DANFE (BQ)"
                                onClick={() => openPrintableDanfe(o, c, data.products)}
                              >
                                <Printer size={12} />
                                DANFE
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              className="order-action-pill shadow-xs"
                              title="Imprimir Romaneio Cego (DQ)"
                              onClick={() => openPrintableRomaneio(o, c, data.products)}
                            >
                              <Truck size={12} />
                              Romaneio
                            </Button>
                          </>
                        )}
                        {!isExpedicao && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="order-action-pill shadow-xs"
                            title="Imprimir Talão de Pedido Comercial"
                            onClick={() => openPrintableOrderSlip(o, c, data.products)}
                          >
                            <FileText size={12} />
                            Talão
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="order-row-chevron"
                          aria-label={`Revisar pedido ${o.id}`}
                          onClick={() => openOrder(o)}
                        >
                          <ChevronRight />
                        </Button>
                      </div>
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

      {/* Barra Inferior: Resumo de Carga do Caminhão do Dia (Expedição DQ) */}
      {(() => {
        const routeOrders = data.orders.filter(o => {
          const st = effectiveStatus(o);
          return st === 'EM_SEPARACAO' || st === 'FATURADO' || st === 'AGUARDANDO_REVISAO';
        });
        const readyForTruckOrders = data.orders.filter(o => {
          const st = effectiveStatus(o);
          return st === 'EM_SEPARACAO' || st === 'FATURADO';
        });
        const totalRouteSacks = routeOrders.reduce((acc, o) => acc + orderTotalDq(o.items), 0);
        const readySacks = readyForTruckOrders.reduce((acc, o) => acc + orderTotalDq(o.items), 0);
        const totalWeightKg = totalRouteSacks * 25;
        const estimatedFreight = totalRouteSacks * 4;
        const uniqueClientsCount = new Set(routeOrders.map(o => o.clientId)).size;

        return (
          <>
            <div
              className="workflow-strip workflow-strip-clickable"
              onClick={() => setRouteModalOpen(true)}
              role="button"
              tabIndex={0}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setRouteModalOpen(true);
                }
              }}
              title="Clique para ver o planejamento da rota e detalhes das entregas"
            >
              <div className="workflow-label">
                <span className="workflow-icon bg-primary/10 text-primary border-primary/20">
                  <Truck size={15} />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <strong>Carga do Caminhão do Dia (Expedição DQ)</strong>
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                      {readySacks} / {totalRouteSacks} sacas liberadas
                    </span>
                  </div>
                  <p>
                    Consolidação física da rota ativa ({uniqueClientsCount}{' '}
                    {uniqueClientsCount === 1 ? 'parada programada' : 'paradas programadas'}) · Clique para expandir planejamento
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/60 border border-border/70">
                  <Package size={13} className="text-primary" />
                  <span className="text-muted-foreground">Volume (DQ):</span>
                  <strong className="numeric font-bold text-foreground">{totalRouteSacks} sacas</strong>
                </div>

                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/60 border border-border/70">
                  <span className="text-muted-foreground">Peso total:</span>
                  <strong className="numeric font-bold text-foreground">
                    {totalWeightKg.toLocaleString('pt-BR')} kg ({(totalWeightKg / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} t)
                  </strong>
                </div>

                {!isExpedicao && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/60 border border-border/70">
                    <span className="text-muted-foreground">Frete estimado (R$ 4/un.):</span>
                    <strong className="numeric font-bold text-foreground">{money(estimatedFreight)}</strong>
                  </div>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2.5 text-[11px] font-semibold gap-1.5 border-border hover:bg-muted"
                  disabled={routeOrders.length === 0}
                  onClick={e => {
                    e.stopPropagation();
                    const targetOrder = readyForTruckOrders[0] ?? routeOrders[0];
                    if (!targetOrder) return;
                    const targetClient = data.clients.find(c => c.id === targetOrder.clientId);
                    openPrintableRomaneio(targetOrder, targetClient, data.products);
                  }}
                  title="Imprimir romaneio cego da primeira entrega pronta"
                >
                  <Printer size={12} />
                  Imprimir Romaneio (DQ)
                </Button>
              </div>
            </div>

            <DeliveryRouteModal
              open={routeModalOpen}
              onOpenChange={setRouteModalOpen}
              data={data}
              onSelectOrder={openOrder}
              isExpedicao={isExpedicao}
            />
          </>
        );
      })()}

      {/* Modal de Conferência Pré-Nota e Romaneio */}
      <OrderDetailsModal
        order={selected ?? null}
        onClose={() => setSelectedId(null)}
        data={data}
        update={update}
        notify={notify}
        isExpedicao={isExpedicao}
      />
    </>
  );
}

function DownloadIcon() {
  return <ArrowDownToLine size={14} />;
}

// ============================================================================
// 1. SEÇÃO: CONTAS A RECEBER E BOLETOS SOBRE BQ (Sr. Sérgio)
// ============================================================================

function ReceivablesSection({
  data,
  update,
  notify,
  userProfile,
}: {
  data: AppData;
  update: (next: AppData) => void;
  notify: (message: string) => void;
  userProfile?: string | undefined;
}) {
  const [titles, setTitles] = useState<ReceivableTitle[]>([]);
  const [filter, setFilter] = useState<'ALL' | 'ABERTO' | 'VENCIDO' | 'PAGO'>('ALL');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [payingId, setPayingId] = useState<number | null>(null);
  const [selectedBoletoKey, setSelectedBoletoKey] = useState<string | null>(null);

  const loadTitles = async () => {
    setLoading(true);
    try {
      const res = await fetchReceivablesApi('ALL');
      setTitles(res);
    } catch {
      notify('Não foi possível carregar os títulos a receber do servidor.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTitles();
  }, []);

  const todayIso = new Date().toISOString().slice(0, 10);

  const findClientForBoleto = (clientId?: number, clientName?: string) => {
    return data.clients.find(c =>
      (clientId != null && (c.id === String(clientId) || c.dbId === clientId)) ||
      (clientName && c.name.toLowerCase() === clientName.toLowerCase())
    );
  };

  const handlePay = async (title: ReceivableTitle) => {
    setPayingId(title.id);
    try {
      await payReceivableApi(title.id);
      fireConfetti();
      notify(`Baixa manual confirmada na parcela ${title.installmentNumber}/${title.totalInstallments} (${title.documentNumber})!`);

      // Atualização otimista imediata no estado local
      const nextTitles = titles.map(t =>
        t.id === title.id ? { ...t, status: 'PAGO' as const, paidAt: new Date().toISOString() } : t
      );
      setTitles(nextTitles);

      // Se não houver mais nenhum boleto vencido para este cliente, sincroniza crédito local para 'Em dia'
      const remainingOverdueForClient = nextTitles.some(t =>
        t.id !== title.id &&
        t.clientId === title.clientId &&
        (t.status === 'VENCIDO' || (t.status === 'ABERTO' && t.dueDate && t.dueDate < todayIso))
      );
      if (!remainingOverdueForClient) {
        const nextClients = data.clients.map(c =>
          (c.id === String(title.clientId) || c.dbId === title.clientId || c.name === title.clientName)
            ? { ...c, overdue: false }
            : c
        );
        update({ ...data, clients: nextClients });
      }

      // Tenta sincronizar com o backend
      try {
        const freshTitles = await fetchReceivablesApi('ALL');
        setTitles(freshTitles);
      } catch {}

      // Atualiza também os dados gerais para sincronizar o status de crédito do cliente
      try {
        const fresh = await fetchWorkspaceData(data.reconciled);
        update(fresh);
      } catch {}
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Erro ao processar baixa do boleto.');
    } finally {
      setPayingId(null);
    }
  };

  const handlePayAllInGroup = async (group: GroupedBoleto) => {
    const unpaid = group.titles.filter(t => t.status !== 'PAGO');
    if (unpaid.length === 0) return;
    setLoading(true);
    try {
      for (const t of unpaid) {
        await payReceivableApi(t.id);
      }
      fireConfetti();
      notify(`Todas as ${unpaid.length} parcelas do boleto ${group.baseDocumentNumber} foram quitadas com sucesso!`);
      const nextTitles = titles.map(t =>
        unpaid.some(u => u.id === t.id)
          ? { ...t, status: 'PAGO' as const, paidAt: new Date().toISOString() }
          : t
      );
      setTitles(nextTitles);

      // Sincroniza crédito se o cliente não tiver mais boletos vencidos
      const remainingOverdueForClient = nextTitles.some(t =>
        t.clientId === group.clientId &&
        (t.status === 'VENCIDO' || (t.status === 'ABERTO' && t.dueDate && t.dueDate < todayIso))
      );
      if (!remainingOverdueForClient) {
        const nextClients = data.clients.map(c =>
          (c.id === String(group.clientId) || c.dbId === group.clientId || c.name === group.clientName)
            ? { ...c, overdue: false }
            : c
        );
        update({ ...data, clients: nextClients });
      }

      try {
        const freshTitles = await fetchReceivablesApi('ALL');
        setTitles(freshTitles);
      } catch {}
      try {
        const fresh = await fetchWorkspaceData(data.reconciled);
        update(fresh);
      } catch {}
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Erro ao processar baixa das parcelas.');
    } finally {
      setLoading(false);
    }
  };

  interface GroupedBoleto {
    key: string;
    baseDocumentNumber: string;
    orderId?: number;
    clientId: number;
    clientName: string;
    titles: ReceivableTitle[];
    totalAmountBq: number;
    paidAmountBq: number;
    remainingAmountBq: number;
    totalInstallments: number;
    paidInstallments: number;
    status: 'ABERTO' | 'VENCIDO' | 'PAGO';
    nextDueDate?: string;
    notes?: string;
  }

  const groupedBoletos = useMemo<GroupedBoleto[]>(() => {
    const map = new Map<string, GroupedBoleto>();
    const sorted = [...titles].sort((a, b) => a.installmentNumber - b.installmentNumber);

    for (const t of sorted) {
      const baseDoc = t.documentNumber.replace(/-\d+$/, '');
      const key = t.orderId ? `order-${t.orderId}` : `doc-${baseDoc}-${t.clientId}`;

      let group = map.get(key);
      if (!group) {
        group = {
          key,
          baseDocumentNumber: baseDoc,
          orderId: t.orderId,
          clientId: t.clientId,
          clientName: t.clientName,
          titles: [],
          totalAmountBq: 0,
          paidAmountBq: 0,
          remainingAmountBq: 0,
          totalInstallments: t.totalInstallments || 1,
          paidInstallments: 0,
          status: 'ABERTO',
          notes: t.notes,
        };
        map.set(key, group);
      }

      group.titles.push(t);
      const amt = Number(t.amountBq || 0);
      group.totalAmountBq += amt;
      if (t.status === 'PAGO') {
        group.paidAmountBq += amt;
        group.paidInstallments += 1;
      } else {
        group.remainingAmountBq += amt;
      }
      if (t.totalInstallments && t.totalInstallments > group.totalInstallments) {
        group.totalInstallments = t.totalInstallments;
      }
    }

    return Array.from(map.values()).map(g => {
      const allPaid = g.titles.length > 0 && g.titles.every(t => t.status === 'PAGO');
      const hasOverdue = g.titles.some(t => t.status === 'VENCIDO');
      let status: 'ABERTO' | 'VENCIDO' | 'PAGO' = 'ABERTO';
      if (allPaid) {
        status = 'PAGO';
      } else if (hasOverdue) {
        status = 'VENCIDO';
      } else {
        status = 'ABERTO';
      }

      const unpaid = g.titles.filter(t => t.status !== 'PAGO');
      const nextDue = unpaid[0]?.dueDate || g.titles[g.titles.length - 1]?.dueDate;

      return {
        ...g,
        status,
        nextDueDate: nextDue,
      };
    });
  }, [titles]);

  // Métricas calculadas sobre os títulos/parcelas individuais para precisão matemática total:
  const totalBq = titles.reduce((a, t) => a + Number(t.amountBq || 0), 0);
  const totalVencido = titles
    .filter(t => t.status === 'VENCIDO' || (t.status === 'ABERTO' && t.dueDate && t.dueDate < todayIso))
    .reduce((a, t) => a + Number(t.amountBq || 0), 0);
  const totalAberto = titles
    .filter(t => t.status === 'ABERTO' && (!t.dueDate || t.dueDate >= todayIso))
    .reduce((a, t) => a + Number(t.amountBq || 0), 0);
  const totalPago = titles
    .filter(t => t.status === 'PAGO')
    .reduce((a, t) => a + Number(t.amountBq || 0), 0);

  const visibleBoletos = groupedBoletos.filter(g => {
    if (filter !== 'ALL' && g.status !== filter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      g.clientName.toLowerCase().includes(q) ||
      g.baseDocumentNumber.toLowerCase().includes(q) ||
      (g.orderId && String(g.orderId).includes(q)) ||
      (g.notes && g.notes.toLowerCase().includes(q))
    );
  });

  const selectedBoleto = groupedBoletos.find(g => g.key === selectedBoletoKey);

  const formatDueDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
  };

  return (
    <div className="space-y-6">
      {/* Cards de Métricas de Boletos */}
      <div className="metric-grid">
        <Metric
          label="Total em Boletos"
          value={<NumberTicker value={totalBq} prefix="R$ " decimals={2} />}
          icon={<Barcode />}
          footer={
            <span className="text-muted-foreground">
              {groupedBoletos.length} {groupedBoletos.length === 1 ? 'boleto gerado' : 'boletos gerados'} ({titles.length} parcelas)
            </span>
          }
        />
        <Metric
          label="A Receber (Em Aberto)"
          value={<NumberTicker value={totalAberto} prefix="R$ " decimals={2} />}
          icon={<Clock3 />}
          footer={
            <>
              <span className="mini-dot warning-dot" />
              {titles.filter(t => t.status === 'ABERTO' && (!t.dueDate || t.dueDate >= todayIso)).length} parcelas a vencer
            </>
          }
        />
        <Metric
          label="Boletos Vencidos"
          value={<NumberTicker value={totalVencido} prefix="R$ " decimals={2} />}
          icon={<AlertTriangle />}
          footer={
            <span className={totalVencido > 0 ? 'text-destructive font-semibold' : 'text-muted-foreground'}>
              {titles.filter(t => t.status === 'VENCIDO' || (t.status === 'ABERTO' && t.dueDate && t.dueDate < todayIso)).length} parcelas vencidas
            </span>
          }
        />
        <Metric
          label="Total Liquidado / Pago"
          value={<NumberTicker value={totalPago} prefix="R$ " decimals={2} />}
          icon={<CheckCheck />}
          footer={
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
              {titles.filter(t => t.status === 'PAGO').length} parcelas quitadas ({groupedBoletos.filter(g => g.status === 'PAGO').length} boletos)
            </span>
          }
        />
      </div>

      {/* Tabela de Boletos com Filtros e Ação de Baixa Manual */}
      <section className="orders-section">
        <div className="orders-toolbar flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <SlidingTabs
            tabs={[
              { id: 'ALL', label: 'Todos os Boletos', count: groupedBoletos.length },
              { id: 'ABERTO', label: 'Em Aberto', count: groupedBoletos.filter(g => g.status === 'ABERTO').length },
              { id: 'VENCIDO', label: 'Vencidos', count: groupedBoletos.filter(g => g.status === 'VENCIDO').length },
              { id: 'PAGO', label: 'Quitados', count: groupedBoletos.filter(g => g.status === 'PAGO').length },
            ]}
            activeTab={filter}
            onChange={t => setFilter(t as any)}
          />

          <div className="flex items-center gap-2 flex-1 justify-end">
            <div className="table-search flex-1 max-w-sm">
              <Search size={16} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por cliente, boleto ou NF-e..."
                aria-label="Buscar boletos"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 shrink-0 text-xs h-9 cursor-pointer"
              onClick={loadTitles}
              disabled={loading}
              title="Recarregar títulos do servidor"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              <span>Atualizar Boletos</span>
            </Button>
          </div>
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Documento / Boleto</th>
                <th>Cliente</th>
                <th>Parcelas</th>
                <th>Valor Base (BQ)</th>
                <th>Vencimento</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {visibleBoletos.map(g => {
                const isPaid = g.status === 'PAGO';
                const isOverdue = g.status === 'VENCIDO';
                const clientMatch = findClientForBoleto(g.clientId, g.clientName);
                return (
                  <tr
                    key={g.key}
                    onClick={() => setSelectedBoletoKey(g.key)}
                    className="cursor-pointer hover:bg-muted/50 transition-colors group"
                    title="Clique para ver os detalhes das parcelas"
                  >
                    <td>
                      <strong className="numeric font-mono text-xs text-foreground">{g.baseDocumentNumber}</strong>
                      <p className="text-[11px] text-muted-foreground">
                        {g.orderId ? `Ref. Pedido #${g.orderId}` : 'Ref. Faturamento anterior'}
                      </p>
                    </td>
                    <td>
                      <div>
                        <strong className="text-foreground">{g.clientName}</strong>
                        <p className="text-[11px] text-muted-foreground">
                          Crédito:{' '}
                          {clientMatch?.overdue || isOverdue ? (
                            <span className="text-destructive font-semibold">Boleto Vencido</span>
                          ) : (
                            <span className="text-emerald-600 font-semibold">Em dia</span>
                          )}
                        </p>
                      </div>
                    </td>
                    <td>
                      <div className="flex flex-col gap-1">
                        <span className="status-badge neutral text-[11px] inline-flex items-center gap-1">
                          <CreditCard size={11} />
                          {g.paidInstallments} de {g.totalInstallments} {g.totalInstallments === 1 ? 'parcela' : 'parcelas'}
                        </span>
                        {g.totalInstallments > 1 && (
                          <div className="w-24 bg-muted h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all ${isPaid ? 'bg-emerald-500' : 'bg-primary'}`}
                              style={{ width: `${(g.paidInstallments / g.totalInstallments) * 100}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <strong className="numeric text-sm font-semibold text-foreground">
                        {money(g.totalAmountBq)}
                      </strong>
                      {!isPaid && (
                        <p className="text-[11px] text-muted-foreground">
                          {money(g.remainingAmountBq)} restante
                        </p>
                      )}
                    </td>
                    <td>
                      <span className="numeric text-xs font-medium">
                        {formatDueDate(g.nextDueDate)}
                      </span>
                      <p className="text-[10px] text-muted-foreground">
                        {isPaid ? 'Quitado' : 'Próx. vencimento'}
                      </p>
                    </td>
                    <td>
                      {isPaid ? (
                        <span className="status-badge success">
                          <CheckCheck size={12} /> Quitado
                        </span>
                      ) : isOverdue ? (
                        <span className="status-badge danger">
                          <AlertTriangle size={12} /> Vencido
                        </span>
                      ) : (
                        <span className="status-badge warning">
                          <Clock3 size={12} /> Em aberto
                        </span>
                      )}
                    </td>
                    <td className="text-right pr-4">
                      <div className="flex items-center justify-end gap-1.5 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs font-semibold gap-1.5 cursor-pointer hover:bg-muted"
                          onClick={() => setSelectedBoletoKey(g.key)}
                          title="Ver parcelas deste boleto"
                        >
                          <Eye size={13} />
                          Ver Detalhes ({g.titles.length})
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs font-semibold gap-1.5 cursor-pointer hover:bg-muted"
                          onClick={() => {
                            const clientMatch = findClientForBoleto(g.clientId, g.clientName);
                            openPrintableBoleto(g, undefined, clientMatch);
                          }}
                          title="Visualizar PDF do boleto bancário Sicredi"
                        >
                          <FileText size={13} />
                          <span>PDF</span>
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {visibleBoletos.length === 0 && (
            <div className="empty-state">
              <CreditCard size={24} />
              <strong>Nenhum boleto encontrado nesta visualização</strong>
              <p>Os boletos são gerados automaticamente sobre o total BQ sempre que uma NF-e é emitida.</p>
            </div>
          )}
        </div>
      </section>

      {/* Modal de Detalhes do Boleto com Todas as Parcelas */}
      <Dialog open={!!selectedBoleto} onOpenChange={open => !open && setSelectedBoletoKey(null)}>
        <DialogContent className="max-w-2xl">
          <DialogTitle className="flex items-center gap-3 pr-10 flex-wrap">
            <span className="flex items-center gap-2">
              <Barcode size={18} className="text-primary" />
              Boleto {selectedBoleto?.baseDocumentNumber}
            </span>
            {selectedBoleto && (
              selectedBoleto.status === 'PAGO' ? (
                <span className="status-badge success text-xs">
                  <CheckCheck size={12} /> Totalmente Quitado
                </span>
              ) : selectedBoleto.status === 'VENCIDO' ? (
                <span className="status-badge danger text-xs">
                  <AlertTriangle size={12} /> Parcela Vencida
                </span>
              ) : (
                <span className="status-badge warning text-xs">
                  <Clock3 size={12} /> Em Aberto
                </span>
              )
            )}
          </DialogTitle>
          <DialogDescription>
            {selectedBoleto?.clientName} {selectedBoleto?.orderId ? `· Pedido associado: #${selectedBoleto.orderId}` : ''}
          </DialogDescription>

          {selectedBoleto && (
            <div className="space-y-4 pt-2">
              {/* Mini resumo financeiro do boleto */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-muted/40 p-3 rounded-lg border border-border/60 text-xs">
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Valor Total BQ</span>
                  <strong className="text-sm font-bold text-foreground">{money(selectedBoleto.totalAmountBq)}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Total Quitado</span>
                  <strong className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{money(selectedBoleto.paidAmountBq)}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Saldo Restante</span>
                  <strong className="text-sm font-bold text-amber-600 dark:text-amber-400">{money(selectedBoleto.remainingAmountBq)}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Parcelas</span>
                  <strong className="text-sm font-bold text-foreground">
                    {selectedBoleto.paidInstallments}/{selectedBoleto.totalInstallments} pagas
                  </strong>
                </div>
              </div>

              {selectedBoleto.notes && (
                <p className="text-xs text-muted-foreground bg-sky-500/10 border border-sky-500/20 p-2.5 rounded-md flex items-start gap-1.5">
                  <Info size={14} className="text-sky-600 shrink-0 mt-0.5" />
                  <span>{selectedBoleto.notes}</span>
                </p>
              )}

              {/* Tabela com a discriminação de cada parcela individual */}
              <div className="border border-border/80 rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted/70 text-muted-foreground border-b border-border/80 text-[11px] font-semibold">
                    <tr>
                      <th className="p-2.5 text-left">Parcela</th>
                      <th className="p-2.5 text-left">Documento</th>
                      <th className="p-2.5 text-left">Vencimento</th>
                      <th className="p-2.5 text-right">Valor BQ</th>
                      <th className="p-2.5 text-center">Status</th>
                      <th className="p-2.5 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {selectedBoleto.titles.map(t => {
                      const isPaid = t.status === 'PAGO';
                      const isOverdue = t.status === 'VENCIDO';
                      const isPaying = payingId === t.id;

                      return (
                        <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                          <td className="p-2.5 font-semibold text-foreground">
                            Parcela {t.installmentNumber} de {t.totalInstallments}
                          </td>
                          <td className="p-2.5 font-mono text-[11px] text-muted-foreground">
                            {t.documentNumber}
                          </td>
                          <td className="p-2.5 font-medium">
                            {formatDueDate(t.dueDate)}
                          </td>
                          <td className="p-2.5 text-right font-bold text-foreground">
                            {money(Number(t.amountBq))}
                          </td>
                          <td className="p-2.5 text-center">
                            {isPaid ? (
                              <span className="status-badge success text-[10px]">
                                <CheckCheck size={11} /> Pago
                              </span>
                            ) : isOverdue ? (
                              <span className="status-badge danger text-[10px]">
                                <AlertTriangle size={11} /> Vencido
                              </span>
                            ) : (
                              <span className="status-badge warning text-[10px]">
                                <Clock3 size={11} /> Em aberto
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs font-semibold gap-1 cursor-pointer hover:bg-muted"
                                onClick={() => {
                                  const clientMatch = findClientForBoleto(selectedBoleto.clientId, selectedBoleto.clientName);
                                  openPrintableBoleto(selectedBoleto, t, clientMatch);
                                }}
                                title={`Visualizar PDF da parcela ${t.installmentNumber}`}
                              >
                                <FileText size={12} />
                                <span>PDF</span>
                              </Button>
                              <div className="min-w-[155px] flex justify-end">
                                {!isPaid ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs font-semibold gap-1 border-emerald-500/40 hover:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 cursor-pointer w-full justify-center"
                                    disabled={isPaying}
                                    onClick={() => handlePay(t)}
                                  >
                                    {isPaying ? (
                                      <Loader2 size={12} className="animate-spin" />
                                    ) : (
                                      <CheckCircle2 size={12} />
                                    )}
                                    Confirmar Pagamento
                                  </Button>
                                ) : (
                                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium inline-flex items-center gap-1 justify-center px-1.5 py-1 w-full border border-emerald-500/20 bg-emerald-500/10 rounded">
                                    <Check size={12} /> Liquidado
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {selectedBoleto.paidInstallments < selectedBoleto.totalInstallments && selectedBoleto.totalInstallments > 1 && (
                    <Button
                      size="sm"
                      className="h-8 text-xs font-semibold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                      disabled={loading}
                      onClick={() => handlePayAllInGroup(selectedBoleto)}
                    >
                      <CheckCheck size={13} />
                      Quitar Todas as Parcelas ({money(selectedBoleto.remainingAmountBq)})
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs font-semibold gap-1.5 cursor-pointer hover:bg-muted"
                    onClick={() => {
                      const clientMatch = findClientForBoleto(selectedBoleto.clientId, selectedBoleto.clientName);
                      openPrintableBoleto(selectedBoleto, undefined, clientMatch);
                    }}
                    title="Visualizar PDF do boleto bancário completo"
                  >
                    <FileText size={13} />
                    <span>Visualizar PDF do Boleto</span>
                  </Button>
                </div>
                <div className="flex justify-end">
                  <Button variant="outline" size="sm" onClick={() => setSelectedBoletoKey(null)}>
                    Fechar
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
// ============================================================================
// 2. SEÇÃO: CADASTROS COMPLETOS, ESTOQUE DUAL E PREÇOS ACORDADOS
// ============================================================================

function RegistrationsSection({
  data,
  update,
  notify,
  userProfile,
  initialClientSearch,
}: {
  data: AppData;
  update: (next: AppData) => void;
  notify: (message: string) => void;
  userProfile?: string | undefined;
  initialClientSearch?: string;
}) {
  const [subTab, setSubTab] = useState<'clients' | 'products' | 'client-details'>('clients');
  const [clientSearch, setClientSearch] = useState(initialClientSearch ?? '');

  useEffect(() => {
    if (initialClientSearch !== undefined && initialClientSearch !== '') {
      setClientSearch(initialClientSearch);
      setSubTab('clients');
      setClientPage(1);
    }
  }, [initialClientSearch]);
  const [clientPage, setClientPage] = useState(1);
  const [clientPageSize, setClientPageSize] = useState(10);
  const [editingClient, setEditingClient] = useState<any | null>(null);
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [lookingUpCnpj, setLookingUpCnpj] = useState(false);
  const [savingClient, setSavingClient] = useState(false);

  // Importação em Lote via XML
  const [xmlImportModalOpen, setXmlImportModalOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [importingXml, setImportingXml] = useState(false);
  const [xmlImportResult, setXmlImportResult] = useState<XmlClientImportResult | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleImportXmlBatch = async () => {
    if (selectedFiles.length === 0) {
      notify('Selecione ao menos um arquivo XML ou ZIP para importar.');
      return;
    }
    setImportingXml(true);
    try {
      const result = await importClientsXmlApi(selectedFiles);
      setXmlImportResult(result);
      const fresh = await fetchWorkspaceData(data.reconciled);
      update(fresh);
      fireConfetti();
      notify(`Importação concluída: ${result.clientsCreated} novos clientes, ${result.clientsUpdated} atualizados!`);
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Falha ao importar arquivos XML.');
    } finally {
      setImportingXml(false);
    }
  };

  // Edição de Produto / Estoque
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);

  // Detalhes do Cliente Selecionado & Preços Praticados
  const [selectedClientId, setSelectedClientId] = useState<string>(data.clients[0]?.id ?? '1');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [clientOrdersPage, setClientOrdersPage] = useState(1);
  const [clientOrdersPageSize, setClientOrdersPageSize] = useState(5);
  const [clientOrdersSearch, setClientOrdersSearch] = useState('');
  const [clientDetailsExpanded, setClientDetailsExpanded] = useState(true);
  const [clientSkuPrices, setClientSkuPrices] = useState<any[]>([]);
  const [editingSkuPrice, setEditingSkuPrice] = useState<{ productId: number; price: number } | null>(null);

  const loadClientSkuPrices = async (cId: string) => {
    try {
      const prices = await fetchClientPricesApi(Number(cId));
      setClientSkuPrices(prices);
    } catch {
      // Fallback local caso backend esteja offline
      setClientSkuPrices([]);
    }
  };

  useEffect(() => {
    if (subTab === 'client-details' && selectedClientId) {
      loadClientSkuPrices(selectedClientId);
    }
  }, [subTab, selectedClientId]);

  const handleLookupCnpj = async () => {
    if (!editingClient?.cnpj) return;
    const clean = editingClient.cnpj.replace(/\D/g, '');
    if (clean.length !== 14) {
      notify('Informe um CNPJ válido com 14 dígitos.');
      return;
    }
    setLookingUpCnpj(true);
    try {
      const res = await lookupCnpjData(clean);
      setEditingClient((prev: any) => ({
        ...prev,
        corporateName: res.corporateName || prev.corporateName,
        tradeName: res.name || prev.tradeName,
        street: res.street || prev.street,
        neighborhood: res.neighborhood || prev.neighborhood,
        city: res.city || prev.city,
        state: res.state || prev.state,
        stateRegistration: res.ie !== 'ISENTO' ? res.ie : prev.stateRegistration,
        ibgeCityCode: res.ibge || prev.ibgeCityCode,
      }));
      notify(`Dados fiscais de ${res.name} encontrados na BrasilAPI.`);
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Falha na consulta do CNPJ.');
    } finally {
      setLookingUpCnpj(false);
    }
  };

  const handleSaveClient = async () => {
    if (!editingClient) return;
    setSavingClient(true);
    try {
      await saveManagementClientApi(editingClient);
      const fresh = await fetchWorkspaceData(data.reconciled);
      update(fresh);
      setClientModalOpen(false);
      fireConfetti();
      notify('Cliente salvo com sucesso no banco de dados!');
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Erro ao salvar cliente.');
    } finally {
      setSavingClient(false);
    }
  };

  const handleSaveProduct = async () => {
    if (!editingProduct) return;
    setSavingProduct(true);
    try {
      const dbId = editingProduct.dbId ?? Number(editingProduct.id);
      await updateProductStockApi(dbId, {
        name: editingProduct.name,
        baseListPrice: Number(editingProduct.price),
        currentLandedCost: Number(editingProduct.cost),
        physicalStock: Number(editingProduct.physical),
        baseStock: Number(editingProduct.baseStock ?? editingProduct.physical),
      });
      const fresh = await fetchWorkspaceData(data.reconciled);
      update(fresh);
      setProductModalOpen(false);
      fireConfetti();
      notify(`Produto ${editingProduct.name} e estoque dual atualizados!`);
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Erro ao atualizar produto.');
    } finally {
      setSavingProduct(false);
    }
  };

  const handleSavePriceAgreed = async (productId: number, price: number) => {
    try {
      await updateClientPriceApi(Number(selectedClientId), productId, price);
      await loadClientSkuPrices(selectedClientId);
      const fresh = await fetchWorkspaceData(data.reconciled);
      update(fresh);
      setEditingSkuPrice(null);
      notify('Preço acordado do cliente atualizado com sucesso!');
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Erro ao salvar preço acordado.');
    }
  };

  const filteredClients = data.clients.filter(c => {
    const q = clientSearch.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.cnpj.includes(q) || c.neighborhood.toLowerCase().includes(q);
  });

  const totalClientPages = Math.max(1, Math.ceil(filteredClients.length / clientPageSize));
  const safeClientPage = Math.min(clientPage, totalClientPages);
  const paginatedClients = filteredClients.slice(
    (safeClientPage - 1) * clientPageSize,
    safeClientPage * clientPageSize
  );

  return (
    <div className="space-y-6">
      {/* Abas Superiores de Cadastros */}
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <Button
            variant={subTab === 'clients' ? 'default' : 'outline'}
            size="sm"
            className="text-xs gap-1.5"
            onClick={() => setSubTab('clients')}
          >
            <Users size={14} />
            Clientes ({data.clients.length})
          </Button>
          <Button
            variant={subTab === 'products' ? 'default' : 'outline'}
            size="sm"
            className="text-xs gap-1.5"
            onClick={() => setSubTab('products')}
          >
            <Package size={14} />
            Produtos & Estoque Dual ({data.products.length})
          </Button>
          {subTab === 'client-details' && (
            <Button
              variant="default"
              size="sm"
              className="text-xs gap-1.5 bg-primary text-primary-foreground font-semibold"
              onClick={() => setSubTab('client-details')}
            >
              <Building2 size={14} />
              Detalhes do Cliente: {data.clients.find(c => c.id === selectedClientId)?.name ?? 'Cliente'}
            </Button>
          )}
        </div>

        {subTab === 'clients' && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs font-medium border-border hover:bg-muted/60"
              onClick={() => {
                setXmlImportModalOpen(true);
                setXmlImportResult(null);
                setSelectedFiles([]);
              }}
            >
              <FileUp size={14} className="text-primary" />
              Importar XML (Lote)
            </Button>
            <Button
              size="sm"
              className="gap-1.5 text-xs bg-primary text-primary-foreground font-semibold"
              onClick={() => {
                setEditingClient({
                  corporateName: '',
                  tradeName: '',
                  cnpj: '',
                  stateRegistration: '',
                  ieIndicator: 'CONTRIBUINTE',
                  purchaseProfile: 'INDUSTRIALIZACAO',
                  street: '',
                  number: '',
                  neighborhood: '',
                  city: 'São Paulo',
                  state: 'SP',
                  ibgeCityCode: '3550308',
                  contactName: '',
                  phone: '',
                  defaultPaymentTerms: 'Boleto 28 dias',
                  averagePurchaseCycleDays: 20,
                  financialStatus: 'EM_DIA',
                });
                setClientModalOpen(true);
              }}
            >
              <Plus size={14} />
              Novo Cliente
            </Button>
          </div>
        )}
      </div>

      {/* SUB-ABA 1: CLIENTES */}
      {subTab === 'clients' && (
        <section className="orders-section">
          <div className="orders-toolbar">
            <div className="table-search flex-1 max-w-sm">
              <Search size={16} />
              <input
                value={clientSearch}
                onChange={e => {
                  setClientSearch(e.target.value);
                  setClientPage(1);
                }}
                placeholder="Buscar cliente por nome, CNPJ ou bairro..."
                aria-label="Buscar cliente"
              />
              {clientSearch && (
                <button
                  type="button"
                  onClick={() => {
                    setClientSearch('');
                    setClientPage(1);
                  }}
                  className="text-muted-foreground hover:text-foreground p-0.5 rounded cursor-pointer"
                  title="Limpar busca"
                  aria-label="Limpar busca"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          <div className="table-scroll max-h-[calc(100vh-320px)] min-h-[380px] overflow-y-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Cliente / Razão Social</th>
                  <th>CNPJ / IE</th>
                  <th>Localização / Rota</th>
                  <th>Contato / Telefone</th>
                  <th>Condição de Pagamento</th>
                  <th>Status de Crédito</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {paginatedClients.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Search size={22} className="text-muted-foreground/60" />
                        <strong className="text-sm text-foreground">Nenhum cliente encontrado</strong>
                        <p className="text-xs">Tente buscar por outro termo ou cadastre um novo cliente.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedClients.map(c => (
                    <tr
                      key={c.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors group"
                      onClick={() => {
                        setSelectedClientId(c.id);
                        setClientOrdersPage(1);
                        setSubTab('client-details');
                      }}
                      title={`Clique para ver os dados cadastrais e histórico de pedidos de ${c.name}`}
                    >
                      <td>
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <strong className="group-hover:text-primary transition-colors">{c.name}</strong>
                            <p className="text-[11px] text-muted-foreground">{c.buyer}</p>
                          </div>
                          <ChevronRight
                            size={14}
                            className="text-primary opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mr-1"
                            title="Ver detalhes do cliente"
                          />
                        </div>
                      </td>
                      <td>
                        <span className="font-mono text-xs">{formatCnpj(c.cnpj) || 'Sem CNPJ'}</span>
                        <p className="text-[10px] text-muted-foreground">{c.ie ? `IE: ${c.ie}` : 'IE Pendente'}</p>
                      </td>
                      <td>
                        <span className="text-xs">{c.neighborhood}, {c.city || 'SP'}</span>
                        <p className="text-[10px] text-muted-foreground">Ciclo: a cada {c.cycle} dias</p>
                      </td>
                      <td>
                        <span className="text-xs">{c.buyer}</span>
                        <p className="text-[10px] text-muted-foreground">{c.time || '10:00'}</p>
                      </td>
                      <td>
                        <span className="status-badge neutral text-xs">{c.defaultPaymentTerms || 'Boleto 28 dias'}</span>
                      </td>
                      <td>
                        {c.overdue ? (
                          <span className="status-badge danger">
                            <AlertTriangle size={12} /> Boleto Vencido
                          </span>
                        ) : (
                          <span className="status-badge success">
                            <CheckCheck size={12} /> Em dia
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs gap-1 text-primary hover:text-primary hover:bg-primary/10"
                            onClick={() => {
                              setSelectedClientId(c.id);
                              setClientOrdersPage(1);
                              setSubTab('client-details');
                            }}
                          >
                            <FileText size={12} />
                            Detalhes
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1"
                            onClick={() => {
                              setEditingClient({
                                id: c.dbId ?? Number(c.id),
                                corporateName: c.corporateName || c.name,
                                tradeName: c.tradeName || c.name,
                                cnpj: c.cnpj,
                                stateRegistration: c.ie,
                                ieIndicator: c.ieIndicator || 'CONTRIBUINTE',
                                purchaseProfile: c.purchaseProfile || 'INDUSTRIALIZACAO',
                                street: c.street || '',
                                number: c.number || '',
                                complement: c.complement || '',
                                neighborhood: c.neighborhood,
                                city: c.city || 'São Paulo',
                                state: c.state || 'SP',
                                zipCode: c.zipCode || '',
                                ibgeCityCode: c.ibge || '3550308',
                                contactName: c.buyer,
                                phone: c.phone || '',
                                defaultPaymentTerms: c.defaultPaymentTerms || 'Boleto 28 dias',
                                averagePurchaseCycleDays: c.cycle,
                                financialStatus: c.overdue ? 'BOLETO_VENCIDO' : 'EM_DIA',
                              });
                              setClientModalOpen(true);
                            }}
                          >
                            <Edit size={12} />
                            Editar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="table-footer">
            <div className="flex items-center gap-3">
              <span>
                Mostrando {filteredClients.length ? (safeClientPage - 1) * clientPageSize + 1 : 0}–{Math.min(safeClientPage * clientPageSize, filteredClients.length)} de {filteredClients.length} clientes
              </span>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="text-[11px]">Por pág:</span>
                <select
                  value={clientPageSize}
                  onChange={e => {
                    setClientPageSize(Number(e.target.value));
                    setClientPage(1);
                  }}
                  className="bg-transparent border border-border rounded px-1.5 py-0.5 text-xs text-foreground cursor-pointer"
                  aria-label="Clientes por página"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                aria-label="Página anterior"
                disabled={safeClientPage <= 1}
                onClick={() => setClientPage(p => Math.max(1, p - 1))}
              >
                <ChevronLeft />
              </Button>
              <span className="page-number">
                {safeClientPage} / {totalClientPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                aria-label="Próxima página"
                disabled={safeClientPage >= totalClientPages}
                onClick={() => setClientPage(p => Math.min(totalClientPages, p + 1))}
              >
                <ChevronRight />
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* SUB-ABA 2: PRODUTOS & ESTOQUE DUAL */}
      {subTab === 'products' && (
        <section className="orders-section">
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>SKU / Produto</th>
                  <th>Preço Tabela Base (R$)</th>
                  <th>Custo Landed (R$)</th>
                  <th>Saldo Físico (DQ)</th>
                  <th>Saldo Base (BQ)</th>
                  <th>Margem Base</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {data.products.map(p => {
                  const margin = p.price > 0 ? ((p.price - p.cost) / p.price) * 100 : 0;
                  return (
                    <tr key={p.id}>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <span className={`sku-symbol sku-${p.id.toLowerCase()}`}>
                            <Package size={18} />
                          </span>
                          <div>
                            <strong>{p.name}</strong>
                            <p className="text-[11px] text-muted-foreground">{p.skuCode} · NCM {p.ncm}</p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <strong className="numeric text-sm">{money(p.price)}</strong>
                      </td>
                      <td>
                        <span className="numeric text-xs font-mono text-muted-foreground">{money(p.cost)}</span>
                      </td>
                      <td>
                        <strong className="numeric text-sm text-foreground">{p.physical} sacas</strong>
                        <p className="text-[10px] text-muted-foreground">Reservado: {p.reserved} un.</p>
                      </td>
                      <td>
                        <strong className="numeric text-sm text-primary font-bold">
                          {baseBalance(p)} sacas
                        </strong>
                        <p className="text-[10px] text-muted-foreground">Base oficial faturamento</p>
                      </td>
                      <td>
                        <span className={`status-badge ${marginLevel(margin)}`}>
                          {margin.toFixed(1)}%
                        </span>
                      </td>
                      <td>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs gap-1"
                          onClick={() => {
                            setEditingProduct({ ...p });
                            setProductModalOpen(true);
                          }}
                        >
                          <Edit size={12} />
                          Ajustar Estoque / Preço
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* SUB-ABA 3: DETALHES DO CLIENTE & HISTÓRICO COMPLETO */}
      {(subTab === 'client-details' || (subTab as string) === 'prices') && (() => {
        const selectedClient = data.clients.find(c => c.id === selectedClientId) ?? data.clients[0];
        if (!selectedClient) {
          return (
            <div className="empty-state py-12">
              <Search size={24} />
              <strong>Nenhum cliente selecionado</strong>
              <Button onClick={() => setSubTab('clients')} variant="outline" size="sm">
                Voltar para lista de clientes
              </Button>
            </div>
          );
        }

        const clientOrders = data.orders
          .filter(o => o.clientId === selectedClient.id)
          .sort((a, b) => Number(b.id) - Number(a.id));

        const filteredClientOrders = clientOrders.filter(o => {
          if (!clientOrdersSearch) return true;
          const q = clientOrdersSearch.toLowerCase();
          return o.id.toLowerCase().includes(q) || String(financials(o.items).total).includes(q);
        });

        const totalClientOrderPages = Math.max(1, Math.ceil(filteredClientOrders.length / clientOrdersPageSize));
        const safeClientOrderPage = Math.min(clientOrdersPage, totalClientOrderPages);
        const paginatedClientOrders = filteredClientOrders.slice(
          (safeClientOrderPage - 1) * clientOrdersPageSize,
          safeClientOrderPage * clientOrdersPageSize
        );

        const lastOrder = clientOrders[0];
        const lastOrderFin = lastOrder ? financials(lastOrder.items) : null;
        const lastOrderDq = lastOrder
          ? orderTotalDq(lastOrder.items)
          : (selectedClient.lastTotal > 0 ? Math.round(selectedClient.lastTotal / 80) : 0);
        const lastOrderBq = lastOrder ? orderTotalBq(lastOrder.items) : lastOrderDq;
        const lastOrderTotal = lastOrderFin ? lastOrderFin.total : (selectedClient.lastTotal || 0);
        const lastOrderMargin = lastOrderFin ? lastOrderFin.margin : 22.5;
        const lastOrderProfit = lastOrderFin ? lastOrderFin.profit : (lastOrderTotal * 0.225);
        const lastOrderPayment = lastOrder?.payment || selectedClient.defaultPaymentTerms || 'Boleto 28 dias';
        const lastOrderDate = lastOrder
          ? (lastOrder.date === 'Ontem' ? '15 out' : lastOrder.date)
          : (selectedClient.days === 0 ? 'Hoje' : `${selectedClient.days}d atrás`);

        return (
          <div className="space-y-6">
            {/* 1. QUADRADO AZUL: DADOS CADASTRAIS DO CLIENTE */}
            <div className="bg-card border border-border rounded-xl p-5 shadow-2xs space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-border">
                <div className="flex items-start sm:items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs font-semibold shrink-0 cursor-pointer"
                    onClick={() => setSubTab('clients')}
                  >
                    <ChevronLeft size={14} />
                    Voltar para Clientes
                  </Button>

                  <div className="flex items-center gap-2.5">
                    <span className={`client-initial client-${selectedClient.colorKey ?? selectedClient.id}`}>
                      {selectedClient.name.split(' ').map(s => s[0]).slice(0, 2).join('')}
                    </span>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-base sm:text-lg font-bold text-foreground leading-tight">
                          {selectedClient.name}
                        </h2>
                        {selectedClient.overdue ? (
                          <span className="status-badge danger">
                            <AlertTriangle size={12} /> Boleto Vencido
                          </span>
                        ) : (
                          <span className="status-badge success">
                            <CheckCheck size={12} /> Em dia
                          </span>
                        )}
                        {fiscalReady(selectedClient) ? (
                          <PulseBadge status="ready" label="SEFAZ OK" sublabel="Dados completos" />
                        ) : (
                          <PulseBadge status="pending" label="Dados pendentes" sublabel="SEFAZ Incompleto" />
                        )}
                      </div>
                      {selectedClient.corporateName && selectedClient.corporateName !== selectedClient.name && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Razão Social: <b>{selectedClient.corporateName}</b>
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1.5 font-semibold cursor-pointer"
                    onClick={() => setClientDetailsExpanded(prev => !prev)}
                    title={clientDetailsExpanded ? 'Recolher dados cadastrais' : 'Expandir dados cadastrais'}
                  >
                    <span>{clientDetailsExpanded ? 'Recolher detalhes' : 'Expandir detalhes'}</span>
                    {clientDetailsExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1.5 font-semibold"
                    onClick={() => {
                      setEditingClient({
                        id: selectedClient.dbId ?? Number(selectedClient.id),
                        corporateName: selectedClient.corporateName || selectedClient.name,
                        tradeName: selectedClient.tradeName || selectedClient.name,
                        cnpj: selectedClient.cnpj,
                        stateRegistration: selectedClient.ie,
                        ieIndicator: selectedClient.ieIndicator || 'CONTRIBUINTE',
                        purchaseProfile: selectedClient.purchaseProfile || 'INDUSTRIALIZACAO',
                        street: selectedClient.street || '',
                        number: selectedClient.number || '',
                        complement: selectedClient.complement || '',
                        neighborhood: selectedClient.neighborhood,
                        city: selectedClient.city || 'São Paulo',
                        state: selectedClient.state || 'SP',
                        zipCode: selectedClient.zipCode || '',
                        ibgeCityCode: selectedClient.ibge || '3550308',
                        contactName: selectedClient.buyer,
                        phone: selectedClient.phone || '',
                        defaultPaymentTerms: selectedClient.defaultPaymentTerms || 'Boleto 28 dias',
                        averagePurchaseCycleDays: selectedClient.cycle,
                        financialStatus: selectedClient.overdue ? 'BOLETO_VENCIDO' : 'EM_DIA',
                      });
                      setClientModalOpen(true);
                    }}
                  >
                    <Edit size={13} />
                    Editar Cadastro
                  </Button>
                </div>
              </div>

              {/* Grid de Dados Cadastrais: 4 colunas (Expandível) */}
              {clientDetailsExpanded ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs pt-1">
                  {/* Coluna 1: Documentos & Fiscal */}
                  <div className="bg-muted/30 p-3 rounded-lg border border-border/50 space-y-2">
                    <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <ShieldCheck size={14} className="text-primary" />
                      Documentos Fiscais
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px]">CNPJ</span>
                      <strong className="font-mono text-xs text-foreground">
                        {formatCnpj(selectedClient.cnpj) || 'Sem CNPJ'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px]">Inscrição Estadual (IE)</span>
                      <span className="font-mono text-xs">
                        {selectedClient.ie ? selectedClient.ie : <span className="text-amber-500 font-medium">Pendente</span>}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                      <div>
                        <span className="text-muted-foreground block text-[10px]">Perfil / Indicador</span>
                        <span>{selectedClient.purchaseProfile || 'Industrialização'}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-muted-foreground block text-[10px]">Cód. IBGE</span>
                        <span className="font-mono">{selectedClient.ibge || '3550308'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Coluna 2: Endereço & Localização */}
                  <div className="bg-muted/30 p-3 rounded-lg border border-border/50 space-y-2">
                    <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <MapPin size={14} className="text-primary" />
                      Endereço de Entrega
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px]">Logradouro / Número</span>
                      <strong className="text-xs text-foreground">
                        {selectedClient.street
                          ? `${selectedClient.street}${selectedClient.number ? `, ${selectedClient.number}` : ''}${selectedClient.complement ? ` (${selectedClient.complement})` : ''}`
                          : `${selectedClient.neighborhood}`}
                      </strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px]">Bairro / Região</span>
                      <span>{selectedClient.neighborhood}</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                      <div>
                        <span className="text-muted-foreground block text-[10px]">Cidade / UF</span>
                        <span>{selectedClient.city || 'São Paulo'} - {selectedClient.state || 'SP'}</span>
                      </div>
                      {selectedClient.zipCode && (
                        <div className="text-right">
                          <span className="text-muted-foreground block text-[10px]">CEP</span>
                          <span className="font-mono">{selectedClient.zipCode}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Coluna 3: Contato & Comprador */}
                  <div className="bg-muted/30 p-3 rounded-lg border border-border/50 space-y-2">
                    <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <User size={14} className="text-primary" />
                      Contato & Atendimento
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px]">Comprador / Contato</span>
                      <strong className="text-xs text-foreground">{selectedClient.buyer}</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px]">Telefone / Contato</span>
                      <span className="text-xs">{selectedClient.phone || 'Telefone não cadastrado'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px]">Horário Preferencial</span>
                      <span className="text-xs flex items-center gap-1 text-muted-foreground">
                        <Clock3 size={11} />
                        {selectedClient.time || '10:00'} (Manhã)
                      </span>
                    </div>
                  </div>

                  {/* Coluna 4: Condições Comerciais */}
                  <div className="bg-muted/30 p-3 rounded-lg border border-border/50 space-y-2">
                    <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <CreditCard size={14} className="text-primary" />
                      Condições Comerciais
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px]">Condição Padrão</span>
                      <span className="status-badge neutral text-[11px]">
                        {selectedClient.defaultPaymentTerms || 'Boleto 28 dias'}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px]">Ciclo Médio de Compra</span>
                      <strong className="text-xs text-foreground">A cada {selectedClient.cycle} dias</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px]">Última Compra</span>
                      <span className="text-xs text-muted-foreground">
                        {selectedClient.days === 0 ? 'Hoje' : `${selectedClient.days} dias atrás`}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground pt-1 bg-muted/20 px-3 py-2 rounded-lg border border-border/40">
                  <span><b>CNPJ:</b> {formatCnpj(selectedClient.cnpj) || 'Sem CNPJ'}</span>
                  <span><b>Localização:</b> {selectedClient.city || 'São Paulo'} - {selectedClient.neighborhood}</span>
                  <span><b>Comprador:</b> {selectedClient.buyer}</span>
                  <span><b>Condição:</b> {selectedClient.defaultPaymentTerms || 'Boleto 28 dias'}</span>
                </div>
              )}
            </div>

            {/* 2. KPI SIMILAR À MESA DE CONFERÊNCIA: VALORES UTILIZADOS NA ÚLTIMA VENDA */}
            <div className="metric-grid">
              <Metric
                label="Valor da última venda"
                value={<NumberTicker value={lastOrderTotal} prefix="R$ " decimals={2} />}
                icon={<DollarSign />}
                footer={
                  <>
                    <span className="mini-dot success-dot" />
                    {lastOrder ? `Pedido #${lastOrder.id}` : 'Última compra'} · {lastOrderDate}
                  </>
                }
              />
              <Metric
                label="Volume da última venda (DQ)"
                value={<NumberTicker value={lastOrderDq} suffix=" sacas" />}
                icon={<Truck />}
                footer={
                  <>
                    <span className="text-muted-foreground">Peso total ·</span>{' '}
                    <NumberTicker value={lastOrderDq * 25} suffix=" kg" />
                    {lastOrderBq !== lastOrderDq && (
                      <span className="ml-1 text-[11px] text-muted-foreground">· Base: {lastOrderBq} un.</span>
                    )}
                  </>
                }
              />
              <Metric
                label="Margem da última venda"
                value={<NumberTicker value={lastOrderMargin} decimals={1} suffix="%" />}
                icon={<TrendingUp />}
                footer={
                  <>
                    <span className="text-muted-foreground">Lucro estimado ·</span>{' '}
                    <strong className="text-foreground">{money(lastOrderProfit)}</strong>
                  </>
                }
              />
              <Metric
                label="Condição de pagamento"
                value={<span className="text-lg sm:text-xl font-bold truncate block tracking-tight text-foreground">{lastOrderPayment}</span>}
                icon={<Barcode />}
                footer={
                  <>
                    <span className="text-muted-foreground">Histórico ·</span>{' '}
                    {clientOrders.length} {clientOrders.length === 1 ? 'pedido emitido' : 'pedidos emitidos'}
                  </>
                }
              />
            </div>

            {/* 3. PREÇOS ACORDADOS DO CLIENTE (RESUMO COMPACTO EM CARDS) */}
            <section className="bg-card border border-border/80 rounded-lg p-2.5 sm:p-3 shadow-xs">
              <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-border/50">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Tag size={14} className="text-primary shrink-0" />
                  <h3 className="text-xs font-semibold text-foreground tracking-tight">
                    Preços Acordados do Cliente
                  </h3>
                  <span className="text-[11px] text-muted-foreground hidden sm:inline truncate">
                    · {selectedClient.name}
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground font-medium shrink-0 bg-muted/60 px-2 py-0.5 rounded">
                  {data.products.length} SKUs
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {data.products.map(p => {
                  const pIdx = data.products.findIndex(pr => pr.id === p.id);
                  const practicedPrice = selectedClient?.prices[pIdx] ?? p.price;
                  const isEditingThis = editingSkuPrice?.productId === (p.dbId ?? Number(p.id));
                  const currentPrice = isEditingThis ? editingSkuPrice.price : practicedPrice;
                  const margin = currentPrice > 0 ? ((currentPrice - p.cost) / currentPrice) * 100 : 0;

                  return (
                    <div
                      key={p.id}
                      className="p-2.5 rounded-md border border-border/60 bg-muted/20 hover:bg-muted/30 transition-colors flex flex-col justify-between"
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-foreground truncate" title={p.name}>
                            {p.name}
                          </p>
                          <p className="text-[10px] text-muted-foreground font-mono">
                            {p.skuCode}
                          </p>
                        </div>
                        <span className={`status-badge ${marginLevel(margin)} text-[10px] px-1.5 py-0.5 leading-none shrink-0 font-semibold`}>
                          {margin.toFixed(1)}%
                        </span>
                      </div>

                      <div className="mt-2 pt-1.5 border-t border-border/40 flex items-center justify-between gap-2">
                        {isEditingThis ? (
                          <div className="flex items-center gap-1 w-full">
                            <input
                              type="number"
                              step="0.50"
                              autoFocus
                              className="form-input numeric text-xs font-bold h-7 py-0 px-1.5 w-20"
                              value={editingSkuPrice.price}
                              onChange={e =>
                                setEditingSkuPrice({
                                  productId: p.dbId ?? Number(p.id),
                                  price: Number(e.target.value),
                                })
                              }
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  handleSavePriceAgreed(p.dbId ?? Number(p.id), editingSkuPrice.price);
                                } else if (e.key === 'Escape') {
                                  setEditingSkuPrice(null);
                                }
                              }}
                            />
                            <Button
                              size="sm"
                              className="h-7 px-2 text-[11px] bg-primary text-primary-foreground font-semibold cursor-pointer"
                              onClick={() => handleSavePriceAgreed(p.dbId ?? Number(p.id), editingSkuPrice.price)}
                            >
                              Salvar
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-1.5 text-[11px] cursor-pointer"
                              onClick={() => setEditingSkuPrice(null)}
                            >
                              <X size={12} />
                            </Button>
                          </div>
                        ) : (
                          <>
                            <div className="min-w-0">
                              <div className="flex items-baseline gap-1.5">
                                <strong className="text-xs sm:text-sm font-bold text-foreground">
                                  {money(practicedPrice)}
                                </strong>
                                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                  Base: {money(p.price)}
                                </span>
                              </div>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 px-2 text-[11px] font-medium gap-1 shrink-0 cursor-pointer hover:bg-muted"
                              onClick={() =>
                                setEditingSkuPrice({
                                  productId: p.dbId ?? Number(p.id),
                                  price: practicedPrice,
                                })
                              }
                              title="Ajustar preço praticado para este cliente"
                            >
                              <Edit size={11} />
                              Ajustar
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* 4. QUADRADO VERDE: LISTA DE PEDIDOS DO CLIENTE COM PAGINAÇÃO */}
            <section className="orders-section">
              <div className="orders-toolbar flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3">
                <div className="flex items-center gap-2">
                  <FileCheck2 size={16} className="text-primary" />
                  <span className="font-semibold text-xs text-foreground">
                    Pedidos do Cliente ({clientOrders.length})
                  </span>
                </div>

                <div className="table-search max-w-xs w-full">
                  <Search size={15} />
                  <input
                    value={clientOrdersSearch}
                    onChange={e => {
                      setClientOrdersSearch(e.target.value);
                      setClientOrdersPage(1);
                    }}
                    placeholder="Buscar por #ID ou valor..."
                    aria-label="Buscar pedido"
                  />
                  {clientOrdersSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setClientOrdersSearch('');
                        setClientOrdersPage(1);
                      }}
                      className="text-muted-foreground hover:text-foreground p-0.5 rounded cursor-pointer"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              </div>

              <div className="table-scroll">
                <table className="data-table orders-table">
                  <thead>
                    <tr>
                      <th>Pedido <ChevronDown size={12} /></th>
                      <th>Carga / Volume (DQ / BQ)</th>
                      <th>Valor Total (DQ / BQ)</th>
                      <th>Cadastro Fiscal / NF-e</th>
                      <th>Status</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedClientOrders.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-10 text-muted-foreground">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <Search size={22} className="text-muted-foreground/60" />
                            <strong className="text-sm text-foreground">Nenhum pedido encontrado</strong>
                            <p className="text-xs">
                              {clientOrdersSearch
                                ? 'Tente buscar por outro termo.'
                                : 'Os pedidos cadastrados para este cliente aparecerão aqui.'}
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      paginatedClientOrders.map(o => {
                        const f = financials(o.items);
                        const dq = orderTotalDq(o.items);
                        const bq = orderTotalBq(o.items);
                        const isBilled = (o.rawStatus || o.status) === 'FATURADO' || (o.rawStatus || o.status) === 'ENTREGUE';

                        return (
                          <tr key={o.id} onClick={() => setSelectedOrder(o)} className="cursor-pointer">
                            <td>
                              <strong className="numeric">#{o.id}</strong>
                              <p>{o.date === 'Ontem' ? '15 out' : o.date}</p>
                            </td>
                            <td>
                              <strong className="numeric text-foreground">{dq} sacas ({dq * 25} kg)</strong>
                              <p className="text-[11px] text-muted-foreground">{o.delivery || 'Rota programada'}</p>
                            </td>
                            <td>
                              <strong className="numeric">{money(f.total)}</strong>
                              <p>
                                DQ: {dq} un.
                                {bq !== dq ? ` · BQ: ${bq} un.` : ''} · {o.payment}
                              </p>
                            </td>
                            <td>
                              {isBilled && o.invoice ? (
                                <span className="text-xs font-mono font-medium text-emerald-600 dark:text-emerald-400">
                                  NF-e {o.invoice} · Autorizada
                                </span>
                              ) : fiscalReady(selectedClient) ? (
                                <PulseBadge status="ready" label="Dados completos" sublabel="SEFAZ OK" />
                              ) : (
                                <PulseBadge status="pending" label="Dados pendentes" sublabel="BrasilAPI" />
                              )}
                            </td>
                            <td>{renderOrderStatusBadge(o)}</td>
                            <td>
                              <div className="flex items-center justify-end gap-1.5 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                                {isBilled && (
                                  <>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="order-action-pill shadow-xs"
                                      title="Imprimir DANFE (BQ)"
                                      onClick={() => openPrintableDanfe(o, selectedClient, data.products)}
                                    >
                                      <Printer size={12} />
                                      DANFE
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="order-action-pill shadow-xs"
                                      title="Imprimir Romaneio Cego (DQ)"
                                      onClick={() => openPrintableRomaneio(o, selectedClient, data.products)}
                                    >
                                      <Truck size={12} />
                                      Romaneio
                                    </Button>
                                  </>
                                )}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="order-action-pill shadow-xs"
                                  title="Imprimir Talão de Pedido Comercial"
                                  onClick={() => openPrintableOrderSlip(o, selectedClient, data.products)}
                                >
                                  <FileText size={12} />
                                  Talão
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="order-row-chevron"
                                  aria-label={`Ver pedido #${o.id}`}
                                  onClick={() => setSelectedOrder(o)}
                                >
                                  <ChevronRight />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Paginação idêntica à Mesa de Conferência */}
              <div className="table-footer">
                <div className="flex items-center gap-3">
                  <span>
                    Mostrando {filteredClientOrders.length ? (safeClientOrderPage - 1) * clientOrdersPageSize + 1 : 0}–{Math.min(safeClientOrderPage * clientOrdersPageSize, filteredClientOrders.length)} de {filteredClientOrders.length} pedidos
                  </span>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="text-[11px]">Por pág:</span>
                    <select
                      value={clientOrdersPageSize}
                      onChange={e => {
                        setClientOrdersPageSize(Number(e.target.value));
                        setClientOrdersPage(1);
                      }}
                      className="bg-transparent border border-border rounded px-1.5 py-0.5 text-xs text-foreground cursor-pointer"
                    >
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Página anterior"
                    disabled={safeClientOrderPage <= 1}
                    onClick={() => setClientOrdersPage(p => Math.max(1, p - 1))}
                  >
                    <ChevronLeft />
                  </Button>
                  <span className="page-number">
                    {safeClientOrderPage} / {totalClientOrderPages}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Próxima página"
                    disabled={safeClientOrderPage >= totalClientOrderPages}
                    onClick={() => setClientOrdersPage(p => Math.min(totalClientOrderPages, p + 1))}
                  >
                    <ChevronRight />
                  </Button>
                </div>
              </div>
            </section>

            {/* 5. POP-UP DO PEDIDO AO CLICAR EM QUALQUER PEDIDO */}
            <OrderDetailsModal
              order={selectedOrder}
              onClose={() => setSelectedOrder(null)}
              data={data}
              update={update}
              notify={notify}
            />
          </div>
        );
      })()}

      {/* MODAL: CRIAR / EDITAR CLIENTE COM BRASILAPI */}
      <Dialog open={clientModalOpen} onOpenChange={setClientModalOpen}>
        <DialogContent className="max-w-xl">
          <DialogTitle>
            {editingClient?.id ? 'Editar Dados do Cliente' : 'Novo Cliente Total Trigo'}
          </DialogTitle>
          <DialogDescription>
            Enriquecimento automático via BrasilAPI (CNPJ, Razão Social, IE e Endereço).
          </DialogDescription>

          <div className="space-y-3.5 my-2 text-xs">
            {/* CNPJ com Busca BrasilAPI */}
            <div className="flex gap-2 items-end">
              <label className="flex-1 flex flex-col gap-1 font-semibold">
                CNPJ (14 dígitos)
                <input
                  className="form-input font-mono"
                  placeholder="00.000.000/0000-00"
                  value={editingClient?.cnpj || ''}
                  onChange={e =>
                    setEditingClient((prev: any) => ({ ...prev, cnpj: formatCnpj(e.target.value) }))
                  }
                />
              </label>
              <Button
                type="button"
                variant="outline"
                className="gap-1.5 h-9"
                disabled={lookingUpCnpj}
                onClick={handleLookupCnpj}
              >
                {lookingUpCnpj ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
                Buscar na BrasilAPI
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 font-semibold">
                Razão Social
                <input
                  className="form-input"
                  value={editingClient?.corporateName || ''}
                  onChange={e => setEditingClient((prev: any) => ({ ...prev, corporateName: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1 font-semibold">
                Nome Fantasia
                <input
                  className="form-input"
                  value={editingClient?.tradeName || ''}
                  onChange={e => setEditingClient((prev: any) => ({ ...prev, tradeName: e.target.value }))}
                />
              </label>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <label className="flex flex-col gap-1 font-semibold">
                Inscrição Estadual (IE)
                <input
                  className="form-input"
                  value={editingClient?.stateRegistration || ''}
                  onChange={e => setEditingClient((prev: any) => ({ ...prev, stateRegistration: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1 font-semibold">
                Perfil de Compra
                <select
                  className="form-input"
                  value={editingClient?.purchaseProfile || 'INDUSTRIALIZACAO'}
                  onChange={e => setEditingClient((prev: any) => ({ ...prev, purchaseProfile: e.target.value }))}
                >
                  <option value="INDUSTRIALIZACAO">Industrialização</option>
                  <option value="REVENDA">Revenda</option>
                  <option value="CONSUMO_FINAL">Consumo Final</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 font-semibold">
                Código IBGE Cidade
                <input
                  className="form-input font-mono"
                  value={editingClient?.ibgeCityCode || '3550308'}
                  onChange={e => setEditingClient((prev: any) => ({ ...prev, ibgeCityCode: e.target.value }))}
                />
              </label>
            </div>

            {/* Endereço Completo */}
            <div className="grid grid-cols-4 gap-3">
              <label className="col-span-2 flex flex-col gap-1 font-semibold">
                Logradouro / Rua
                <input
                  className="form-input"
                  placeholder="Ex: Av. Dona Belmira Marin"
                  value={editingClient?.street || ''}
                  onChange={e => setEditingClient((prev: any) => ({ ...prev, street: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1 font-semibold">
                Número
                <input
                  className="form-input"
                  placeholder="1420"
                  value={editingClient?.number || ''}
                  onChange={e => setEditingClient((prev: any) => ({ ...prev, number: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1 font-semibold">
                Complemento
                <input
                  className="form-input"
                  placeholder="Loja 1"
                  value={editingClient?.complement || ''}
                  onChange={e => setEditingClient((prev: any) => ({ ...prev, complement: e.target.value }))}
                />
              </label>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <label className="flex flex-col gap-1 font-semibold">
                Bairro / Região
                <input
                  className="form-input"
                  value={editingClient?.neighborhood || ''}
                  onChange={e => setEditingClient((prev: any) => ({ ...prev, neighborhood: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1 font-semibold">
                Cidade / UF
                <input
                  className="form-input"
                  value={`${editingClient?.city || 'São Paulo'} - ${editingClient?.state || 'SP'}`}
                  onChange={e => {
                    const parts = e.target.value.split('-');
                    setEditingClient((prev: any) => ({
                      ...prev,
                      city: parts[0]?.trim() || 'São Paulo',
                      state: parts[1]?.trim() || 'SP',
                    }));
                  }}
                />
              </label>
              <label className="flex flex-col gap-1 font-semibold">
                CEP
                <input
                  className="form-input font-mono"
                  placeholder="00000-000"
                  value={editingClient?.zipCode || ''}
                  onChange={e => setEditingClient((prev: any) => ({ ...prev, zipCode: e.target.value }))}
                />
              </label>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <label className="flex flex-col gap-1 font-semibold">
                Contato / Comprador
                <input
                  className="form-input"
                  value={editingClient?.contactName || ''}
                  onChange={e => setEditingClient((prev: any) => ({ ...prev, contactName: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1 font-semibold">
                Telefone / WhatsApp
                <input
                  className="form-input"
                  placeholder="(11) 98765-4321"
                  value={editingClient?.phone || ''}
                  onChange={e => setEditingClient((prev: any) => ({ ...prev, phone: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1 font-semibold">
                Condição Padrão
                <select
                  className="form-input"
                  value={editingClient?.defaultPaymentTerms || 'Boleto 28 dias'}
                  onChange={e => setEditingClient((prev: any) => ({ ...prev, defaultPaymentTerms: e.target.value }))}
                >
                  <option value="Boleto 28 dias">Boleto 28 dias</option>
                  <option value="Boleto 14/28 dias">Boleto 14/28 dias</option>
                  <option value="Boleto 7/14/21/28 dias">Boleto 7/14/21/28 dias</option>
                  <option value="Pix na Entrega">Pix na Entrega</option>
                </select>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 font-semibold">
                Ciclo Médio de Compra (dias)
                <input
                  type="number"
                  className="form-input numeric"
                  value={editingClient?.averagePurchaseCycleDays ?? 20}
                  onChange={e => setEditingClient((prev: any) => ({ ...prev, averagePurchaseCycleDays: Number(e.target.value) }))}
                />
              </label>
              <label className="flex flex-col gap-1 font-semibold">
                Status de Crédito
                <select
                  className="form-input"
                  value={editingClient?.financialStatus || 'EM_DIA'}
                  onChange={e => setEditingClient((prev: any) => ({ ...prev, financialStatus: e.target.value }))}
                >
                  <option value="EM_DIA">Em dia (Liberado)</option>
                  <option value="BOLETO_VENCIDO">Boleto Vencido (Bloqueio)</option>
                </select>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setClientModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={savingClient || !editingClient?.corporateName}
              onClick={handleSaveClient}
            >
              {savingClient ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Salvar Cadastro
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL: AJUSTE DE ESTOQUE DUAL E PREÇO DO PRODUTO */}
      <Dialog open={productModalOpen} onOpenChange={setProductModalOpen}>
        <DialogContent>
          <DialogTitle>Ajustar Produto & Estoque Dual</DialogTitle>
          <DialogDescription>
            Altere preço de venda, custo landed e os saldos físico (DQ) e base (BQ).
          </DialogDescription>

          {editingProduct && (
            <div className="space-y-3.5 my-2 text-xs">
              <label className="flex flex-col gap-1 font-semibold">
                Nome do Produto
                <input
                  className="form-input"
                  value={editingProduct.name}
                  onChange={e => setEditingProduct({ ...editingProduct, name: e.target.value })}
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 font-semibold">
                  Preço Base de Tabela (R$)
                  <input
                    type="number"
                    step="0.50"
                    className="form-input numeric font-bold"
                    value={editingProduct.price}
                    onChange={e => setEditingProduct({ ...editingProduct, price: Number(e.target.value) })}
                  />
                </label>
                <label className="flex flex-col gap-1 font-semibold">
                  Custo Landed Médio (R$)
                  <input
                    type="number"
                    step="0.10"
                    className="form-input numeric font-bold"
                    value={editingProduct.cost}
                    onChange={e => setEditingProduct({ ...editingProduct, cost: Number(e.target.value) })}
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 font-semibold">
                  Saldo Físico no Galpão (DQ)
                  <input
                    type="number"
                    className="form-input numeric font-bold text-foreground"
                    value={editingProduct.physical}
                    onChange={e => setEditingProduct({ ...editingProduct, physical: Number(e.target.value) })}
                  />
                </label>
                <label className="flex flex-col gap-1 font-semibold">
                  Saldo Base Fiscal (BQ)
                  <input
                    type="number"
                    className="form-input numeric font-bold text-primary"
                    value={editingProduct.baseStock ?? editingProduct.physical}
                    onChange={e => setEditingProduct({ ...editingProduct, baseStock: Number(e.target.value) })}
                  />
                </label>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setProductModalOpen(false)}>
              Cancelar
            </Button>
            <Button disabled={savingProduct} onClick={handleSaveProduct}>
              {savingProduct ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Salvar Alterações
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL: IMPORTAÇÃO EM LOTE DE CLIENTES VIA XML */}
      <Dialog open={xmlImportModalOpen} onOpenChange={setXmlImportModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogTitle className="flex items-center gap-2">
            <FileUp className="text-primary" size={20} />
            Cadastro em Lote de Clientes por XML
          </DialogTitle>
          <DialogDescription>
            Importe ou atualize clientes a partir de arquivos XML (NF-e padrão SEFAZ, exportações de ERP ou arquivos ZIP).
          </DialogDescription>

          {!xmlImportResult ? (
            <div className="space-y-4 my-2 text-xs">
              {/* Drag and Drop Zone */}
              <div
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                  isDragOver
                    ? 'border-primary bg-primary/10 scale-[1.01]'
                    : 'border-border hover:border-primary/50 hover:bg-muted/40'
                }`}
                onDragOver={e => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={e => {
                  e.preventDefault();
                  setIsDragOver(false);
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    const newFiles = Array.from(e.dataTransfer.files);
                    setSelectedFiles(prev => [...prev, ...newFiles]);
                  }
                }}
                onClick={() => {
                  document.getElementById('xml-file-input')?.click();
                }}
              >
                <input
                  id="xml-file-input"
                  type="file"
                  multiple
                  accept=".xml,.zip"
                  className="hidden"
                  onChange={e => {
                    if (e.target.files && e.target.files.length > 0) {
                      const newFiles = Array.from(e.target.files);
                      setSelectedFiles(prev => [...prev, ...newFiles]);
                    }
                  }}
                />
                <div className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-1">
                    <UploadCloud size={24} />
                  </div>
                  <strong className="text-sm font-semibold text-foreground">
                    Arraste seus arquivos XML ou ZIP aqui
                  </strong>
                  <p className="text-xs text-muted-foreground max-w-sm">
                    Ou clique para selecionar do seu computador. Suporta múltiplos arquivos de uma só vez.
                  </p>
                </div>
              </div>

              {/* Arquivos Selecionados */}
              {selectedFiles.length > 0 && (
                <div className="border border-border rounded-lg p-3 bg-muted/20 space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                    <span>Arquivos selecionados ({selectedFiles.length})</span>
                    <button
                      type="button"
                      className="text-[11px] text-destructive hover:underline"
                      onClick={() => setSelectedFiles([])}
                    >
                      Limpar todos
                    </button>
                  </div>
                  <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                    {selectedFiles.map((f, idx) => (
                      <div
                        key={`${f.name}-${idx}`}
                        className="flex items-center justify-between text-[11px] bg-background/60 border border-border/60 rounded px-2.5 py-1.5"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <FileCode2 size={13} className="text-primary shrink-0" />
                          <span className="truncate font-mono">{f.name}</span>
                          <span className="text-muted-foreground text-[10px]">
                            ({(f.size / 1024).toFixed(1)} KB)
                          </span>
                        </div>
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-destructive shrink-0 ml-2"
                          onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== idx))}
                          title="Remover arquivo"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Informações dos Formatos Suportados */}
              <div className="grid grid-cols-2 gap-3 text-[11px] text-muted-foreground">
                <div className="bg-muted/30 border border-border/50 rounded-lg p-2.5 space-y-1">
                  <strong className="text-foreground block font-medium">Formatos Suportados</strong>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li>XML de NF-e (SEFAZ: &lt;dest&gt;, &lt;enderDest&gt;)</li>
                    <li>Exportações de ERPs (&lt;clientes&gt;&lt;cliente&gt;)</li>
                    <li>Arquivo compactado .ZIP com múltiplos XMLs</li>
                  </ul>
                </div>
                <div className="bg-muted/30 border border-border/50 rounded-lg p-2.5 space-y-1">
                  <strong className="text-foreground block font-medium">Regras de Negócio</strong>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li>Upsert inteligente por CNPJ/CPF (sem duplicados)</li>
                    <li>Memória de preços praticados por SKU atualizada</li>
                    <li>Cadastro automático com endereço e código IBGE</li>
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            /* Resultados da Importação */
            <div className="space-y-4 my-2 text-xs">
              <div className="bg-success-soft/30 border border-success/40 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-success font-semibold text-sm">
                  <CheckCheck size={18} />
                  <span>Importação Concluída com Sucesso!</span>
                </div>
                <p className="text-muted-foreground">{xmlImportResult.message}</p>
                <div className="grid grid-cols-4 gap-2 pt-2 border-t border-success/20">
                  <div className="bg-background/80 rounded p-2 text-center">
                    <span className="text-[10px] text-muted-foreground block">Arquivos</span>
                    <strong className="text-base text-foreground font-mono">{xmlImportResult.totalFilesProcessed}</strong>
                  </div>
                  <div className="bg-background/80 rounded p-2 text-center">
                    <span className="text-[10px] text-muted-foreground block">Novos Clientes</span>
                    <strong className="text-base text-success font-mono">+{xmlImportResult.clientsCreated}</strong>
                  </div>
                  <div className="bg-background/80 rounded p-2 text-center">
                    <span className="text-[10px] text-muted-foreground block">Atualizados</span>
                    <strong className="text-base text-primary font-mono">{xmlImportResult.clientsUpdated}</strong>
                  </div>
                  <div className="bg-background/80 rounded p-2 text-center">
                    <span className="text-[10px] text-muted-foreground block">Preços SKU</span>
                    <strong className="text-base text-foreground font-mono">{xmlImportResult.pricesUpdated}</strong>
                  </div>
                </div>
              </div>

              {xmlImportResult.importedClientNames.length > 0 && (
                <div className="space-y-1.5">
                  <span className="font-semibold text-foreground text-xs">Clientes cadastrados nesta remessa:</span>
                  <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto p-1.5 bg-muted/20 border border-border rounded-lg">
                    {xmlImportResult.importedClientNames.map((name, i) => (
                      <span key={i} className="status-badge neutral text-[10px]">
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {xmlImportResult.warnings.length > 0 && (
                <div className="space-y-1">
                  <span className="font-semibold text-amber-500 text-xs flex items-center gap-1">
                    <AlertTriangle size={12} /> Avisos do processador:
                  </span>
                  <div className="max-h-24 overflow-y-auto space-y-0.5 text-[10px] text-muted-foreground font-mono bg-muted/20 p-2 rounded border border-border">
                    {xmlImportResult.warnings.map((w, i) => (
                      <div key={i}>• {w}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 mt-4">
            {!xmlImportResult ? (
              <>
                <Button variant="outline" onClick={() => setXmlImportModalOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  disabled={importingXml || selectedFiles.length === 0}
                  onClick={handleImportXmlBatch}
                  className="gap-1.5"
                >
                  {importingXml ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Processando XMLs...
                    </>
                  ) : (
                    <>
                      <FileUp size={14} />
                      Importar {selectedFiles.length > 0 ? `(${selectedFiles.length} arquivos)` : ''}
                    </>
                  )}
                </Button>
              </>
            ) : (
              <Button
                onClick={() => {
                  setXmlImportModalOpen(false);
                  setXmlImportResult(null);
                  setSelectedFiles([]);
                }}
              >
                Fechar e Atualizar Lista
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================================
// 3. SEÇÃO: TRILHA DE AUDITORIA E LOGS DE OPERAÇÃO
// ============================================================================

function AuditSection({ notify, userProfile }: { notify: (message: string) => void; userProfile?: string | undefined }) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const res = await fetchAuditLogsApi();
      setLogs(res);
      setPage(1);
    } catch {
      notify('Não foi possível carregar a trilha de auditoria.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const getActionBadge = (actionType: string) => {
    switch (actionType) {
      case 'EMISSAO_NFE':
        return <span className="status-badge success">NF-e Emitida</span>;
      case 'REVISAO_PRE_NOTA':
        return <span className="status-badge warning">Pré-Nota Revisada</span>;
      case 'BAIXA_BOLETO':
        return <span className="status-badge success">Baixa de Boleto</span>;
      case 'CANCELAMENTO_PEDIDO':
        return <span className="status-badge danger">Pedido Cancelado</span>;
      case 'ENTRADA_LOTE_IMPORTACAO':
        return <span className="status-badge neutral">Lote Nacionalizado</span>;
      case 'AJUSTE_ESTOQUE_PRODUTO':
        return <span className="status-badge warning">Ajuste de Estoque</span>;
      default:
        return <span className="status-badge neutral">{actionType}</span>;
    }
  };

  const filteredLogs = logs.filter(l => {
    const q = search.toLowerCase();
    return (
      l.actorName.toLowerCase().includes(q) ||
      l.summary.toLowerCase().includes(q) ||
      l.actionType.toLowerCase().includes(q) ||
      (l.targetEntity && l.targetEntity.toLowerCase().includes(q))
    );
  });

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedLogs = filteredLogs.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  );

  return (
    <div className="space-y-4">
      <div className="bg-muted/30 border border-border rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-lg text-primary shrink-0">
            <ShieldCheck size={24} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">
              Trilha de Auditoria & Conformidade Operacional
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Registro cronológico imutável de todas as ações de faturamento, emissão, revisão e baixa bancária para conferência do Sr. Sérgio e Gabriel.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 shrink-0 text-xs" onClick={loadLogs} disabled={loading}>
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Atualizar Logs
        </Button>
      </div>

      <section className="orders-section">
        <div className="orders-toolbar">
          <div className="table-search flex-1 max-w-sm">
            <Search size={16} />
            <input
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Buscar por ator, ação ou resumo..."
              aria-label="Buscar auditoria"
            />
          </div>
          <span className="text-xs text-muted-foreground">
            {filteredLogs.length} eventos registrados
          </span>
        </div>

        <div className="table-scroll max-h-[calc(100vh-310px)] overflow-y-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Data / Hora</th>
                <th>Responsável / Papel</th>
                <th>Tipo de Ação</th>
                <th>Alvo / ID</th>
                <th>Resumo da Operação</th>
              </tr>
            </thead>
            <tbody>
              {paginatedLogs.map(l => (
                <tr key={l.id}>
                  <td>
                    <span className="numeric text-xs font-mono text-muted-foreground">
                      {l.createdAt ? new Date(l.createdAt).toLocaleString('pt-BR') : 'Hoje'}
                    </span>
                  </td>
                  <td>
                    <strong>{l.actorName}</strong>
                    <p className="text-[11px] text-muted-foreground">{l.actorRole}</p>
                  </td>
                  <td>{getActionBadge(l.actionType)}</td>
                  <td>
                    <span className="font-mono text-xs font-semibold">
                      {l.targetEntity} #{l.targetId}
                    </span>
                  </td>
                  <td>
                    <p className="text-xs text-foreground font-medium">{l.summary}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredLogs.length === 0 && (
            <div className="empty-state">
              <History size={24} />
              <strong>Nenhum evento de auditoria encontrado</strong>
              <p>Os eventos operacionais registrados no servidor aparecerão aqui.</p>
            </div>
          )}
        </div>

        <div className="table-footer">
          <div className="flex items-center gap-3">
            <span>
              Mostrando {filteredLogs.length ? (safePage - 1) * pageSize + 1 : 0}–{Math.min(safePage * pageSize, filteredLogs.length)} de {filteredLogs.length} eventos
            </span>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="text-[11px]">Por pág:</span>
              <select
                value={pageSize}
                onChange={e => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="bg-transparent border border-border rounded px-1.5 py-0.5 text-xs text-foreground cursor-pointer"
                aria-label="Eventos por página"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              aria-label="Página anterior"
              disabled={safePage <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
            >
              <ChevronLeft size={14} />
            </Button>
            <span className="page-number">
              {safePage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              aria-label="Próxima página"
              disabled={safePage >= totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            >
              <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}