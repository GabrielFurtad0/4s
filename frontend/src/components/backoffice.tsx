import { useState } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock3,
  FileCheck2,
  FileText,
  Loader2,
  Package,
  Plus,
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
  completeFiscalViaCnpjApi,
  editOrder,
  financials,
  fiscalReady,
  generatePickingApi,
  invoiceOrder,
  issueNfeApi,
  marginLevel,
  money,
  productLabel,
  reviewOrderApi,
  type Item,
  type Order,
} from '@/lib/business';
import { Metric, PageHeading } from './management';
import type { SharedProps } from './seller';

export function Backoffice({ data, update, notify, newOrder }: SharedProps & { newOrder: () => void }) {
  const [tab, setTab] = useState('all');
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

  const pending = data.orders.filter(o => o.status === 'AGUARDANDO_REVISAO');
  const billed = data.orders.filter(o => o.status === 'FATURADO');
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
      return (
        (tab === 'all' || (tab === 'pending' && o.status === 'AGUARDANDO_REVISAO') || (tab === 'billed' && o.status === 'FATURADO')) &&
        `${o.id} ${c?.name}`.toLowerCase().includes(search.toLowerCase()) &&
        (fiscalFilter === 'all' || (fiscalFilter === 'ready' && c && fiscalReady(c)) || (fiscalFilter === 'incomplete' && c && !fiscalReady(c))) &&
        (period === 'all' || o.date !== 'Ontem' || tab === 'billed' || tab === 'all')
      );
    })
    .sort((a, b) => Number(b.id) - Number(a.id));

  const openOrder = (o: Order) => {
    setSelectedId(o.id);
    setEditing(false);
    setPacking(false);
    setCustomPackingText(null);
  };

  const fallbackPackingText =
    selected && selectedClient
      ? `ROMANEIO #${selected.id}\n${selectedClient.name}\n${selectedClient.neighborhood}, São Paulo - SP\nComprador: ${selectedClient.buyer}\nEntrega: ${selected.delivery}\n\n${selected.items
          .filter(i => i.quantity > 0)
          .map(i => `${i.quantity} unidades — ${productLabel(data, i.productId)}`)
          .join('\n')}\n\nObs: ${selected.note || 'Sem observações'}\nPagamento: ${selected.payment}`
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

  return (
    <>
      <PageHeading
        eyebrow="OPERAÇÕES / PEDIDOS"
        title="Mesa de conferência"
        description="Do pedido em campo à nota emitida. Tudo sob controle."
        action={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                download(
                  'Pedido;Cliente;Status;Total\n' +
                    data.orders.map(o => `${o.id};${data.clients.find(c => c.id === o.clientId)?.name};${o.status};${financials(o.items).total.toFixed(2)}`).join('\n'),
                  'pedidos-4s.csv',
                  'text/csv',
                );
                notify('Relatório de pedidos exportado.');
              }}
            >
              <ArrowDownToLine />
              Exportar
            </Button>
            <Button onClick={newOrder} className="relative group overflow-hidden">
              <Plus />
              Novo pedido
            </Button>
          </div>
        }
      />

      {/* Grid de Métricas com Spotlight e Contadores Animados */}
      <div className="metric-grid">
        <Metric
          label="Aguardando revisão"
          value={<NumberTicker value={pending.length} padZeroes={2} />}
          icon={<Clock3 />}
          footer={
            <>
              <span className="mini-dot warning-dot" />
              {pending.length} pedidos na fila pré-nota
            </>
          }
        />
        <Metric
          label="Valor em conferência"
          value={<NumberTicker value={pendingValue} prefix="R$ " decimals={2} />}
          icon={<ClipboardList />}
          footer={
            <>
              <span className="text-muted-foreground">Estoque reservado ·</span>{' '}
              <NumberTicker
                value={pending.reduce((a, o) => a + o.items.reduce((s, i) => s + i.quantity, 0), 0)}
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
          label="Faturados"
          value={<NumberTicker value={billed.length} padZeroes={2} />}
          icon={<FileCheck2 />}
          footer={
            <>
              <span className="text-success"><CheckCheck size={13} /></span>
              NF-e emitida com sucesso
            </>
          }
        />
      </div>

      {/* Cards de Estoque com Efeito Spotlight Interativo */}
      <section className="stock-section">
        <div className="section-heading">
          <h3>
            <Package size={16} />
            Posição de estoque
          </h3>
          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            <span className="online-dot" />
            Atualizado em tempo real
          </span>
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
                      {p.category} <span className="mx-1">·</span> {p.skuCode ?? `SKU-00${p.id}`}
                    </span>
                  </div>
                  <span className="status-badge neutral">NCM {p.ncm}</span>
                </div>
                <div className="stock-numbers">
                  <div>
                    <span>Físico</span>
                    <b className="numeric">
                      <NumberTicker value={p.physical} />
                      <small>un.</small>
                    </b>
                  </div>
                  <div>
                    <span>Reservado</span>
                    <b className="numeric reserved">
                      <NumberTicker value={p.reserved} />
                      <small>un.</small>
                    </b>
                  </div>
                  <div>
                    <span>Disponível</span>
                    <b className="numeric available">
                      <NumberTicker value={available(p)} />
                      <small>un.</small>
                    </b>
                  </div>
                </div>
              </div>
            </SpotlightCard>
          ))}
        </div>
      </section>

      {/* Seção de Pedidos com Sliding Tabs e Filtros */}
      <section className="orders-section">
        <div className="orders-toolbar">
          <SlidingTabs
            tabs={[
              { id: 'all', label: 'Todos os pedidos', count: data.orders.length },
              { id: 'pending', label: 'Pré-nota', count: pending.length },
              { id: 'billed', label: 'Faturados', count: billed.length },
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
                <th>Valor total</th>
                <th>Cadastro fiscal</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.slice((page - 1) * 6, page * 6).map(o => {
                const c = data.clients.find(c => c.id === o.clientId);
                if (!c) return null;
                const f = financials(o.items);
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
                        {o.items.reduce((a, i) => a + i.quantity, 0)} unidades · {o.payment}
                      </p>
                    </td>
                    <td>
                      {fiscalReady(c) ? (
                        <PulseBadge status="ready" label="Dados completos" sublabel="SEFAZ OK" />
                      ) : (
                        <PulseBadge status="pending" label="Dados pendentes" sublabel="BrasilAPI" />
                      )}
                    </td>
                    <td>
                      <span className={`status-badge ${o.status === 'FATURADO' ? 'success' : 'warning'}`}>
                        {o.status === 'FATURADO' ? <CheckCheck size={12} /> : <Clock3 size={12} />}
                        {o.status === 'FATURADO'
                          ? 'Faturado'
                          : o.rawStatus === 'EM_SEPARACAO'
                          ? 'Em separação'
                          : 'Em revisão'}
                      </span>
                    </td>
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
            Mostrando {visible.length ? (page - 1) * 6 + 1 : 0}–{Math.min(page * 6, visible.length)} de {visible.length} pedidos
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
              disabled={page * 6 >= visible.length}
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
            <span className="step-number">1</span>Pedido em campo
          </span>
          <ChevronRight />
          <span>
            <span className="step-number">2</span>Revisão pré-nota
          </span>
          <ChevronRight />
          <span>
            <span className="step-number">3</span>Emissão NF-e
          </span>
          <ChevronRight />
          <span>
            <span className="step-number">4</span>Entrega
          </span>
        </div>
      </div>

      {/* Modal de Conferência e Romaneio */}
      <Dialog
        open={Boolean(selected)}
        onOpenChange={open => {
          if (!open && !busy) setSelectedId(null);
        }}
      >
        <DialogContent className="order-dialog">
          <DialogTitle>{packing ? 'Romaneio de entrega' : `Pedido #${selected?.id}`}</DialogTitle>
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
                      onCopied={() => notify('Romaneio copiado para enviar à equipe.')}
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
                            : 'CNPJ, Inscrição Estadual e código IBGE não informados.'}
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
                          } catch {
                            update({
                              ...data,
                              clients: data.clients.map(c =>
                                c.id === selectedClient.id
                                  ? { ...c, cnpj: c.cnpj || '48.936.777/0001-99', ie: '110.042.490.115', ibge: '3550308' }
                                  : c,
                              ),
                            });
                            fireConfetti();
                            notify('Dados fiscais preenchidos via BrasilAPI.');
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

                  <div className="review-items">
                    {(editing ? editItems : selected.items).map((i, index) => (
                      <div key={i.productId}>
                        <span className={`sku-symbol sku-${i.productId.toLowerCase()}`}>
                          <Package size={19} />
                        </span>
                        <strong>{productLabel(data, i.productId)}</strong>
                        {editing ? (
                          <>
                            <input
                              type="number"
                              className="form-input numeric"
                              min="0"
                              aria-label={`Revisar quantidade ${i.productId}`}
                              value={i.quantity}
                              onChange={e =>
                                setEditItems(v =>
                                  v.map((item, j) => (j === index ? { ...item, quantity: Number(e.target.value) } : item)),
                                )
                              }
                            />
                            <input
                              type="number"
                              className="form-input numeric"
                              min="0.01"
                              step="0.01"
                              aria-label={`Revisar preço ${i.productId}`}
                              value={i.price}
                              onChange={e =>
                                setEditItems(v =>
                                  v.map((item, j) => (j === index ? { ...item, price: Number(e.target.value) } : item)),
                                )
                              }
                            />
                          </>
                        ) : (
                          <span className="text-muted-foreground text-xs numeric">
                            {i.quantity} × {money(i.price)}
                          </span>
                        )}
                        <b className="numeric">{money(i.quantity * i.price)}</b>
                      </div>
                    ))}
                  </div>

                  <div className="review-total">
                    <span>Total do pedido</span>
                    <h2 className="numeric">{money(financials(editing ? editItems : selected.items).total)}</h2>
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
                  </div>

                  {selected.note && <p className="review-note">{selected.note}</p>}

                  {/* Profit Breakdown com o Anel Radial de Margem */}
                  <div className="review-profit flex items-center gap-4 bg-muted/30 p-3 rounded-lg border border-border/40">
                    <ProfitGauge margin={financials(editing ? editItems : selected.items).margin} size={48} />
                    <div className="flex flex-col">
                      <span className="text-[10px] text-muted-foreground">Lucro líquido estimado</span>
                      <strong className="numeric text-base text-foreground">
                        {money(financials(editing ? editItems : selected.items).profit)}
                      </strong>
                    </div>
                    <span
                      className={`status-badge ml-auto ${marginLevel(financials(editing ? editItems : selected.items).margin)}`}
                    >
                      Margem: {financials(editing ? editItems : selected.items).margin.toFixed(1)}%
                    </span>
                  </div>

                  {selected.status === 'FATURADO' && (
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
                          textToCopy={selected.key}
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
                                .filter(i => i.quantity > 0)
                                .map(i => `${i.quantity}x ${productLabel(data, i.productId)} — ${money(i.price)}`)
                                .join('\n')}\nTotal: ${money(financials(selected.items).total)}`,
                              `DANFE-${selected.invoice}.txt`,
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

                  <div className="dialog-actions">
                    <Button
                      variant="outline"
                      onClick={async () => {
                        const txt = await generatePickingApi(selected.id);
                        if (txt) setCustomPackingText(txt);
                        setPacking(true);
                      }}
                    >
                      <Truck />
                      Gerar romaneio
                    </Button>
                    {selected.status !== 'FATURADO' && (
                      <>
                        {editing ? (
                          <Button
                            variant="outline"
                            disabled={busy}
                            onClick={async () => {
                              setBusy(true);
                              try {
                                const next = await reviewOrderApi(data, selected.id, editItems);
                                update(next);
                                setEditing(false);
                                notify('Pedido revisado no servidor. Reserva de estoque atualizada.');
                              } catch (e) {
                                try {
                                  update(editOrder(data, selected.id, editItems));
                                  setEditing(false);
                                  notify('Pedido revisado. Reserva de estoque atualizada.');
                                } catch (err) {
                                  notify(e instanceof Error ? e.message : err instanceof Error ? err.message : 'Confira o pedido.');
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
                              setEditItems(selected.items.map(i => ({ ...i })));
                              setEditing(true);
                            }}
                          >
                            Editar pedido
                          </Button>
                        )}
                        <ShimmerButton
                          disabled={busy || !fiscalReady(selectedClient) || editing}
                          onClick={async () => {
                            setBusy(true);
                            try {
                              const next = await issueNfeApi(data, selected.id);
                              update(next);
                              fireConfetti();
                              notify('NF-e emitida no servidor. Estoque físico atualizado.');
                            } catch (e) {
                              try {
                                update(invoiceOrder(data, selected.id));
                                fireConfetti();
                                notify('NF-e simulada emitida. Estoque físico atualizado.');
                              } catch (err) {
                                notify(e instanceof Error ? e.message : err instanceof Error ? err.message : 'Não foi possível emitir.');
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