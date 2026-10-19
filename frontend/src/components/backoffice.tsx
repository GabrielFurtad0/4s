import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowRight,
  Ban,
  Barcode,
  Calendar,
  Check,
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
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
  Landmark,
  Layers,
  Loader2,
  Package,
  Plus,
  Printer,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  TriangleAlert,
  Truck,
  UploadCloud,
  Users,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { DeliveryRouteModal } from './delivery-route-modal';
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
import { openPrintableDanfe, openPrintableRomaneio } from '@/lib/documentPrint';

export function Backoffice({
  data,
  update,
  notify,
  activeModule = 'orders',
  userProfile = 'Gabriel Furtado · Backoffice & Fiscal',
  newOrder,
}: SharedProps & { newOrder: () => void; activeModule?: string; userProfile?: string }) {
  if (activeModule === 'receivables') {
    return <ReceivablesSection data={data} update={update} notify={notify} userProfile={userProfile} />;
  }
  if (activeModule === 'registrations') {
    return <RegistrationsSection data={data} update={update} notify={notify} userProfile={userProfile} />;
  }
  if (activeModule === 'audit') {
    return <AuditSection notify={notify} userProfile={userProfile} />;
  }

  const isExpedicao = userProfile === 'Expedição · Romaneio Cego';
  const [tab, setTab] = useState(isExpedicao ? 'picking' : 'all');
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
                <th>{isExpedicao ? 'Carga / Volume (DQ)' : 'Valor total (DQ / BQ)'}</th>
                <th>{isExpedicao ? 'Destino / Rota' : 'Cadastro fiscal'}</th>
                <th>Status</th>
                <th>Ações</th>
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
                    <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors">
                      <Eye size={10} />
                      Ver Detalhes da Rota
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
                  className="h-7 px-2.5 text-[11px] font-semibold gap-1.5 border-primary/30 text-primary hover:bg-primary/5"
                  onClick={e => {
                    e.stopPropagation();
                    setRouteModalOpen(true);
                  }}
                >
                  <Eye size={12} />
                  Ver Entregas
                </Button>

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

                  {/* Profit Breakdown com o Anel Radial de Margem (Oculto para Perfil de Expedição) */}
                  {!isExpedicao && (
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
                  )}

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
                        {!isExpedicao && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            onClick={() => openPrintableDanfe(selected, selectedClient, data.products)}
                          >
                            <Printer size={14} />
                            Imprimir DANFE (BQ)
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => openPrintableRomaneio(selected, selectedClient, data.products)}
                        >
                          <Truck size={14} />
                          Imprimir Romaneio (DQ)
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

  const loadTitles = async () => {
    setLoading(true);
    try {
      const res = await fetchReceivablesApi(filter);
      setTitles(res);
    } catch {
      notify('Não foi possível carregar os títulos a receber do servidor.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTitles();
  }, [filter]);

  const handlePay = async (title: ReceivableTitle) => {
    setPayingId(title.id);
    try {
      await payReceivableApi(title.id);
      fireConfetti();
      notify(`Baixa manual confirmada no boleto ${title.documentNumber}! Status do cliente recalculado.`);
      await loadTitles();
      // Atualiza também os dados gerais para sincronizar o status de crédito do cliente
      const fresh = await fetchWorkspaceData(data.reconciled);
      update(fresh);
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Erro ao processar baixa do boleto.');
    } finally {
      setPayingId(null);
    }
  };

  const totalBq = titles.reduce((a, t) => a + Number(t.amountBq || 0), 0);
  const totalAberto = titles.filter(t => t.status === 'ABERTO').reduce((a, t) => a + Number(t.amountBq || 0), 0);
  const totalVencido = titles.filter(t => t.status === 'VENCIDO').reduce((a, t) => a + Number(t.amountBq || 0), 0);
  const totalPago = titles.filter(t => t.status === 'PAGO').reduce((a, t) => a + Number(t.amountBq || 0), 0);

  const visibleTitles = titles.filter(t => {
    const q = search.toLowerCase();
    return (
      t.clientName.toLowerCase().includes(q) ||
      t.documentNumber.toLowerCase().includes(q) ||
      (t.notes && t.notes.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Cards de Métricas de Boletos */}
      <div className="metric-grid">
        <Metric
          label="Total em Boletos"
          value={<NumberTicker value={totalBq} prefix="R$ " decimals={2} />}
          icon={<Barcode />}
          footer={<span className="text-muted-foreground">{titles.length} boletos gerados</span>}
        />
        <Metric
          label="A Receber (Em Aberto)"
          value={<NumberTicker value={totalAberto} prefix="R$ " decimals={2} />}
          icon={<Clock3 />}
          footer={
            <>
              <span className="mini-dot warning-dot" />
              {titles.filter(t => t.status === 'ABERTO').length} boletos a vencer
            </>
          }
        />
        <Metric
          label="Boletos Vencidos"
          value={<NumberTicker value={totalVencido} prefix="R$ " decimals={2} />}
          icon={<AlertTriangle />}
          footer={
            <span className={totalVencido > 0 ? 'text-destructive font-semibold' : 'text-muted-foreground'}>
              {titles.filter(t => t.status === 'VENCIDO').length} vencidos sem pagamento
            </span>
          }
        />
        <Metric
          label="Total Liquidado / Pago"
          value={<NumberTicker value={totalPago} prefix="R$ " decimals={2} />}
          icon={<CheckCheck />}
          footer={
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
              {titles.filter(t => t.status === 'PAGO').length} boletos compensados
            </span>
          }
        />
      </div>

      {/* Tabela de Boletos com Filtros e Ação de Baixa Manual */}
      <section className="orders-section">
        <div className="orders-toolbar flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <SlidingTabs
            tabs={[
              { id: 'ALL', label: 'Todos os Boletos', count: titles.length },
              { id: 'ABERTO', label: 'Em Aberto', count: titles.filter(t => t.status === 'ABERTO').length },
              { id: 'VENCIDO', label: 'Vencidos', count: titles.filter(t => t.status === 'VENCIDO').length },
              { id: 'PAGO', label: 'Pagos / Baixados', count: titles.filter(t => t.status === 'PAGO').length },
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
                placeholder="Buscar por cliente, documento ou NF-e..."
                aria-label="Buscar boletos"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 shrink-0 text-xs h-9"
              onClick={loadTitles}
              disabled={loading}
              title="Recarregar títulos do servidor"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              <span>Atualizar Títulos</span>
            </Button>
          </div>
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Documento / Boleto</th>
                <th>Cliente</th>
                <th>Parcela</th>
                <th>Valor Base (BQ)</th>
                <th>Vencimento</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {visibleTitles.map(t => {
                const isPaid = t.status === 'PAGO';
                const isOverdue = t.status === 'VENCIDO';
                const clientMatch = data.clients.find(c => c.id === String(t.clientId));
                return (
                  <tr key={t.id}>
                    <td>
                      <strong className="numeric font-mono text-xs">{t.documentNumber}</strong>
                      <p className="text-[11px] text-muted-foreground">
                        {t.orderId ? `Ref. Pedido #${t.orderId}` : 'Ref. Faturamento anterior'}
                      </p>
                    </td>
                    <td>
                      <div>
                        <strong>{t.clientName}</strong>
                        <p className="text-[11px] text-muted-foreground">
                          Crédito: {clientMatch?.overdue || isOverdue ? (
                            <span className="text-destructive font-semibold">Boleto Vencido</span>
                          ) : (
                            <span className="text-emerald-600 font-semibold">Em dia</span>
                          )}
                        </p>
                      </div>
                    </td>
                    <td>
                      <span className="status-badge neutral text-[11px]">
                        {t.installmentNumber} de {t.totalInstallments}
                      </span>
                    </td>
                    <td>
                      <strong className="numeric text-sm font-semibold text-foreground">
                        {money(Number(t.amountBq))}
                      </strong>
                    </td>
                    <td>
                      <span className="numeric text-xs font-medium">
                        {t.dueDate ? t.dueDate.split('-').reverse().join('/') : '-'}
                      </span>
                    </td>
                    <td>
                      {isPaid ? (
                        <span className="status-badge success">
                          <CheckCheck size={12} /> Pago
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
                    <td>
                      {!isPaid ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs font-semibold gap-1.5 border-emerald-500/40 hover:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                          disabled={payingId === t.id}
                          onClick={() => handlePay(t)}
                        >
                          {payingId === t.id ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <CheckCircle2 size={13} />
                          )}
                          Confirmar Pagamento
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Check size={12} className="text-emerald-500" /> Baixado
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {visibleTitles.length === 0 && (
            <div className="empty-state">
              <CreditCard size={24} />
              <strong>Nenhum boleto encontrado nesta visualização</strong>
              <p>Os boletos são gerados automaticamente sobre o total BQ sempre que uma NF-e é emitida.</p>
            </div>
          )}
        </div>
      </section>
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
}: {
  data: AppData;
  update: (next: AppData) => void;
  notify: (message: string) => void;
  userProfile?: string | undefined;
}) {
  const [subTab, setSubTab] = useState<'clients' | 'products' | 'prices'>('clients');
  const [clientSearch, setClientSearch] = useState('');
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

  // Memória de Preços
  const [selectedPriceClient, setSelectedPriceClient] = useState<string>(data.clients[0]?.id ?? '1');
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
    if (subTab === 'prices' && selectedPriceClient) {
      loadClientSkuPrices(selectedPriceClient);
    }
  }, [subTab, selectedPriceClient]);

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
      await updateClientPriceApi(Number(selectedPriceClient), productId, price);
      await loadClientSkuPrices(selectedPriceClient);
      const fresh = await fetchWorkspaceData(data.reconciled);
      update(fresh);
      setEditingSkuPrice(null);
      notify('Preço acordado atualizado na memória do cliente!');
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
          <Button
            variant={subTab === 'prices' ? 'default' : 'outline'}
            size="sm"
            className="text-xs gap-1.5"
            onClick={() => setSubTab('prices')}
          >
            <CreditCard size={14} />
            Memória de Preços por Cliente
          </Button>
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
                    <tr key={c.id}>
                      <td>
                        <strong>{c.name}</strong>
                        <p className="text-[11px] text-muted-foreground">{c.buyer}</p>
                      </td>
                      <td>
                        <span className="font-mono text-xs">{c.cnpj || 'Sem CNPJ'}</span>
                        <p className="text-[10px] text-muted-foreground">{c.ie ? `IE: ${c.ie}` : 'IE Pendente'}</p>
                      </td>
                      <td>
                        <span className="text-xs">{c.neighborhood}, SP</span>
                        <p className="text-[10px] text-muted-foreground">Ciclo: a cada {c.cycle} dias</p>
                      </td>
                      <td>
                        <span className="text-xs">{c.buyer}</span>
                        <p className="text-[10px] text-muted-foreground">{c.time || '10:00'}</p>
                      </td>
                      <td>
                        <span className="status-badge neutral text-xs">Boleto 28 dias</span>
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
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs gap-1"
                          onClick={() => {
                            setEditingClient({
                              id: c.dbId ?? Number(c.id),
                              corporateName: c.name,
                              tradeName: c.name,
                              cnpj: c.cnpj,
                              stateRegistration: c.ie,
                              ieIndicator: 'CONTRIBUINTE',
                              purchaseProfile: 'INDUSTRIALIZACAO',
                              neighborhood: c.neighborhood,
                              city: 'São Paulo',
                              state: 'SP',
                              ibgeCityCode: c.ibge || '3550308',
                              contactName: c.buyer,
                              defaultPaymentTerms: 'Boleto 28 dias',
                              averagePurchaseCycleDays: c.cycle,
                              financialStatus: c.overdue ? 'BOLETO_VENCIDO' : 'EM_DIA',
                            });
                            setClientModalOpen(true);
                          }}
                        >
                          <Edit size={12} />
                          Editar
                        </Button>
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

      {/* SUB-ABA 3: MEMÓRIA DE PREÇOS POR CLIENTE */}
      {subTab === 'prices' && (
        <section className="orders-section">
          <div className="p-4 border-b border-border bg-muted/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <label className="text-xs font-semibold text-foreground">
                Selecione o Cliente:
              </label>
              <select
                className="form-input text-xs font-semibold max-w-xs"
                value={selectedPriceClient}
                onChange={e => setSelectedPriceClient(e.target.value)}
              >
                {data.clients.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.neighborhood})
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs text-muted-foreground">
              Preços praticados pelo Sr. Sérgio no campo com histórico salvo por cliente.
            </p>
          </div>

          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>SKU / Produto</th>
                  <th>Preço Tabela Base</th>
                  <th>Preço Acordado do Cliente</th>
                  <th>Margem Acordada</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {data.products.map(p => {
                  const clientObj = data.clients.find(c => c.id === selectedPriceClient);
                  const pIdx = data.products.findIndex(pr => pr.id === p.id);
                  const practicedPrice = clientObj?.prices[pIdx] ?? p.price;
                  const isEditingThis = editingSkuPrice?.productId === (p.dbId ?? Number(p.id));
                  const currentPrice = isEditingThis ? editingSkuPrice.price : practicedPrice;
                  const margin = currentPrice > 0 ? ((currentPrice - p.cost) / currentPrice) * 100 : 0;

                  return (
                    <tr key={p.id}>
                      <td>
                        <strong>{p.name}</strong>
                        <p className="text-[11px] text-muted-foreground">{p.skuCode}</p>
                      </td>
                      <td>
                        <span className="numeric text-xs text-muted-foreground">{money(p.price)}</span>
                      </td>
                      <td>
                        {isEditingThis ? (
                          <input
                            type="number"
                            step="0.50"
                            className="form-input numeric w-28 text-sm font-bold"
                            value={editingSkuPrice.price}
                            onChange={e =>
                              setEditingSkuPrice({
                                productId: p.dbId ?? Number(p.id),
                                price: Number(e.target.value),
                              })
                            }
                          />
                        ) : (
                          <strong className="numeric text-sm text-foreground">{money(practicedPrice)}</strong>
                        )}
                      </td>
                      <td>
                        <span className={`status-badge ${marginLevel(margin)}`}>
                          {margin.toFixed(1)}%
                        </span>
                      </td>
                      <td>
                        {isEditingThis ? (
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              className="h-7 text-xs bg-primary text-primary-foreground"
                              onClick={() => handleSavePriceAgreed(p.dbId ?? Number(p.id), editingSkuPrice.price)}
                            >
                              Salvar
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => setEditingSkuPrice(null)}
                            >
                              Cancelar
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1"
                            onClick={() =>
                              setEditingSkuPrice({
                                productId: p.dbId ?? Number(p.id),
                                price: practicedPrice,
                              })
                            }
                          >
                            <Edit size={12} />
                            Ajustar Preço
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

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
                Bairro / Rota
                <input
                  className="form-input"
                  value={editingClient?.neighborhood || ''}
                  onChange={e => setEditingClient((prev: any) => ({ ...prev, neighborhood: e.target.value }))}
                />
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
                          ✕
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

  const loadLogs = async () => {
    setLoading(true);
    try {
      const res = await fetchAuditLogsApi();
      setLogs(res);
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
      l.actionType.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
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
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por ator, ação ou resumo..."
              aria-label="Buscar auditoria"
            />
          </div>
          <span className="text-xs text-muted-foreground">
            {filteredLogs.length} eventos registrados
          </span>
        </div>

        <div className="table-scroll">
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
              {filteredLogs.map(l => (
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
      </section>
    </div>
  );
}