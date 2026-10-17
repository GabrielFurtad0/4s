import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronRight,
  CreditCard,
  Eye,
  EyeOff,
  FileText,
  MapPin,
  Plus,
  Search,
  Send,
  ShoppingBag,
  Sparkles,
  Truck,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { ProfitGauge } from '@/components/ui/profit-gauge';
import { fireConfetti } from '@/components/ui/confetti';
import { FourSIcon } from './logo';
import {
  addClientNoteApi,
  available,
  financials,
  marginLevel,
  money,
  productLabel,
  scheduleVisitApi,
  type AppData,
  type Client,
  type Item,
  type Order,
} from '@/lib/business';

export type SharedProps = {
  data: AppData;
  update: (next: AppData) => void;
  notify: (message: string) => void;
  submit: (order: Order) => boolean;
};

const paymentTermsList = [
  { label: 'Boleto 28 dias (1 parcela)', installments: 1, desc: 'Vencimento em 28 dias' },
  { label: 'Boleto 7/14/21/28 dias (4 parcelas a cada 7 dias)', installments: 4, desc: '4x semanais (7, 14, 21 e 28 dias)' },
  { label: 'Boleto 14/21/28 dias (3 parcelas a cada 7 dias)', installments: 3, desc: '3x semanais (14, 21 e 28 dias)' },
  { label: 'Boleto 7/14/21 dias (3 parcelas a cada 7 dias)', installments: 3, desc: '3x semanais (7, 14 e 21 dias)' },
  { label: 'Boleto 7/14 dias (2 parcelas a cada 7 dias)', installments: 2, desc: '2x semanais (7 e 14 dias)' },
  { label: 'Boleto 14/28 dias (2 parcelas a cada 14 dias)', installments: 2, desc: '2x quinzenais (14 e 28 dias)' },
  { label: 'Boleto 21 dias (1 parcela)', installments: 1, desc: 'Vencimento em 21 dias' },
  { label: 'Boleto 14 dias (1 parcela)', installments: 1, desc: 'Vencimento em 14 dias' },
  { label: 'Boleto 7 dias (1 parcela)', installments: 1, desc: 'Vencimento em 7 dias' },
  { label: 'Pix na Entrega (À vista)', installments: 1, desc: 'Pagamento imediato na entrega' },
  { label: 'Dinheiro na Entrega (À vista)', installments: 1, desc: 'Pagamento em espécie ao motorista' },
];

export function Seller({ data, update, notify, submit }: SharedProps) {
  const [view, setView] = useState<'agenda' | 'client' | 'order'>('agenda');
  const [clientId, setClientId] = useState(data.clients[0]?.id ?? '');
  const [radar, setRadar] = useState(false);
  const [search, setSearch] = useState('');
  const [note, setNote] = useState('');
  const [schedule, setSchedule] = useState(false);
  const [newName, setNewName] = useState('');
  const [newNeighborhood, setNewNeighborhood] = useState('');
  const [time, setTime] = useState('11:00');
  const [quantities, setQuantities] = useState([0, 0, 0]);
  const [prices, setPrices] = useState([85, 78, 92]);
  const [privateProfit, setPrivateProfit] = useState(true);
  const [payment, setPayment] = useState('Boleto 28 dias (1 parcela)');
  const [orderNote, setOrderNote] = useState('');
  const [promotional, setPromotional] = useState(false);
  const [successOrder, setSuccessOrder] = useState<{
    id: string;
    clientName: string;
    total: number;
    itemsCount: number;
  } | null>(null);

  useEffect(() => {
    if (!data.clients.some(c => c.id === clientId) && data.clients[0]) {
      setClientId(data.clients[0].id);
    }
  }, [data.clients, clientId]);

  const client = data.clients.find(c => c.id === clientId) ?? data.clients[0];
  const items: Item[] = data.products.map((p, i) => ({
    productId: p.id,
    quantity: quantities[i] ?? 0,
    price: prices[i] ?? p.price,
    cost: p.cost,
  }));
  const f = financials(items);

  const selectedTerm = paymentTermsList.find(t => t.label === payment) || paymentTermsList[0];
  const installmentValue = f.total > 0 && selectedTerm.installments > 1 ? f.total / selectedTerm.installments : f.total;

  const openClient = (c: Client) => {
    setClientId(c.id);
    setView('client');
  };

  const startOrder = () => {
    if (!client) return;
    setPrices([...client.prices]);
    setQuantities([0, 0, 0]);
    setView('order');
    setPrivateProfit(true);
  };

  const changeQuantity = (i: number, n: number) => {
    const product = data.products[i];
    if (!product) return;
    setQuantities(q =>
      q.map((v, j) => (j === i ? Math.max(0, Math.min(available(product), Math.floor(n || 0))) : v)),
    );
  };

  const radarClients = data.clients.filter(c => c.days >= c.cycle);

  return (
    <div className="seller-wrap">
      <div className="seller-phone">
        {/* Topbar Fixa com Estoque dos 3 SKUs */}
        <header className="seller-header">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FourSIcon size={20} />
              <strong>
                4S <span className="font-normal text-muted-foreground">em campo</span>
              </strong>
            </div>
            <span className="status-badge neutral">
              <FileText size={12} /> {data.orders.filter(o => o.status === 'AGUARDANDO_REVISAO').length} na fila
            </span>
          </div>
          <div className="seller-stock">
            {data.products.map(p => (
              <div key={p.id}>
                <span>{p.name}</span>
                <b className="numeric">
                  {available(p)} <small>un.</small>
                </b>
              </div>
            ))}
          </div>
        </header>

        <div className="seller-body">
          {/* TELA 1: AGENDA & RADAR */}
          {view === 'agenda' && (
            <>
              <div className="eyebrow">SEXTA-FEIRA, 16 DE OUTUBRO</div>
              <div className="mt-2 mb-5">
                <h1>
                  Bom dia, Sérgio <span className="text-muted-foreground">↗</span>
                </h1>
              </div>
              <div className="flex gap-2">
                <div className="search-field flex-1">
                  <Search size={16} />
                  <input
                    aria-label="Buscar cliente ou bairro"
                    placeholder="Cliente ou bairro"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Agendar visita"
                  title="Agendar visita"
                  onClick={() => setSchedule(true)}
                >
                  <Plus />
                </Button>
              </div>

              <div className="segmented mt-5 mb-5">
                <Button variant="ghost" className={!radar ? 'selected' : ''} onClick={() => setRadar(false)}>
                  Visitas de hoje <span>{data.clients.length}</span>
                </Button>
                <Button variant="ghost" className={radar ? 'selected' : ''} onClick={() => setRadar(true)}>
                  Radar de recompra <span>{radarClients.length}</span>
                </Button>
              </div>

              <div className="space-y-3">
                {data.clients
                  .filter(
                    c =>
                      (!radar || c.days >= c.cycle) &&
                      `${c.name} ${c.neighborhood}`.toLowerCase().includes(search.toLowerCase()),
                  )
                  .map(c => (
                    <div className="visit-card" key={c.id}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <CalendarDays size={13} />
                          <span className="numeric">{c.time}</span>
                          <span>·</span>
                          {c.neighborhood}
                        </span>
                        <span className={`status-badge ${c.overdue ? 'warning' : 'success'}`}>
                          {c.overdue ? '1 boleto vencido' : 'Em dia'}
                        </span>
                      </div>
                      <Button variant="ghost" className="visit-title" onClick={() => openClient(c)}>
                        {c.name}
                        <ArrowUpRight size={17} />
                      </Button>
                      <div className="text-xs text-muted-foreground">
                        {c.days} dias sem comprar <span className="mx-1">·</span>{' '}
                        <span className="numeric">{money(c.lastTotal)}</span>
                        {radar && <p className="mt-2 text-warning">Ciclo habitual: {c.cycle} dias</p>}
                      </div>
                      <p className="visit-note">{c.notes.at(-1)?.split(' • ')[1]}</p>
                      <Button variant="ghost" className="w-full justify-between text-xs" onClick={() => openClient(c)}>
                        Abrir ficha do cliente
                        <ChevronRight size={14} />
                      </Button>
                    </div>
                  ))}
              </div>
            </>
          )}

          {/* TELA 2: FICHA 360º DO CLIENTE */}
          {view === 'client' && client && (
            <>
              <Button variant="ghost" className="back-button" onClick={() => setView('agenda')}>
                <ArrowLeft />
                Agenda
              </Button>
              <div className="eyebrow mt-4">FICHA DO CLIENTE</div>
              <h1 className="mt-2">{client.name}</h1>
              <p className="numeric text-xs text-muted-foreground mt-2">{client.cnpj || 'Cadastro fiscal pendente'}</p>
              <div className="flex items-center gap-2 mt-4">
                <span className={`status-badge ${client.overdue ? 'warning' : 'success'}`}>
                  {client.overdue ? '1 boleto vencido' : 'Em dia'}
                </span>
                <span className="status-badge neutral">Boleto 28 dias</span>
              </div>
              <div className="client-details">
                <p>
                  <Users size={15} />
                  {client.buyer}
                </p>
                <p>
                  <MapPin size={15} />
                  {client.neighborhood}, São Paulo · SP
                </p>
              </div>
              <Button className="w-full h-11 mb-6" onClick={startOrder}>
                <Plus />
                Tirar pedido
              </Button>
              <h3>Último preço praticado</h3>
              <div className="last-prices">
                {data.products.map((p, i) => (
                  <div key={p.id}>
                    <span>{p.name}</span>
                    <b className="numeric">{money(client.prices[i] ?? p.price)}</b>
                    <small>Base: {money(p.price)}</small>
                  </div>
                ))}
              </div>
              <h3 className="mt-7">Caderno de visitas</h3>
              <div className="flex gap-2 mt-3">
                <input
                  className="form-input flex-1 min-w-0"
                  placeholder="Nova anotação..."
                  aria-label="Nova anotação"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                />
                <Button
                  aria-label="Salvar anotação"
                  size="icon"
                  disabled={!note.trim()}
                  onClick={async () => {
                    const text = note.trim();
                    setNote('');
                    update({
                      ...data,
                      clients: data.clients.map(c =>
                        c.id === client.id ? { ...c, notes: [...c.notes, `Agora • ${text}`] } : c,
                      ),
                    });
                    notify('Anotação salva na ficha do cliente.');
                    try {
                      const next = await addClientNoteApi(data, client.id, text);
                      update(next);
                    } catch {
                      /* Atualização otimista preservada */
                    }
                  }}
                >
                  <Send />
                </Button>
              </div>
              <div className="note-timeline">
                {[...client.notes].reverse().map((n, i) => (
                  <div key={i}>
                    <span>{n.split(' • ')[0]}</span>
                    <p>{n.split(' • ')[1]}</p>
                  </div>
                ))}
              </div>
              <h3 className="mt-6">Pedidos recentes</h3>
              {data.orders
                .filter(o => o.clientId === client.id)
                .map(o => (
                  <div className="history-row" key={o.id}>
                    <div>
                      <strong>Pedido #{o.id}</strong>
                      <p>
                        {o.invoice ? `NF-e ${o.invoice}` : 'Aguardando revisão'} ·{' '}
                        {o.items
                          .filter(i => i.quantity > 0)
                          .map(i => `${i.quantity}× ${productLabel(data, i.productId)}`)
                          .join(', ')}
                      </p>
                    </div>
                    <b className="numeric">{money(financials(o.items).total)}</b>
                  </div>
                ))}
              {!data.orders.some(o => o.clientId === client.id) && (
                <p className="text-sm text-muted-foreground mt-3">Nenhum pedido registrado.</p>
              )}
            </>
          )}

          {/* TELA 3: LANÇADOR DE PEDIDO EXPRESS */}
          {view === 'order' && client && (
            <>
              <Button variant="ghost" className="back-button" onClick={() => setView('client')}>
                <ArrowLeft />
                {client.name}
              </Button>
              <h1 className="my-5">Novo pedido</h1>

              <div className="space-y-3">
                {data.products.map((p, i) => (
                  <div className="product-order" key={p.id}>
                    <div className="flex justify-between">
                      <h3>
                        {p.name} <span className="text-muted-foreground font-normal">/ {p.category}</span>
                      </h3>
                      <span className="status-badge success">{available(p)} un.</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground my-4">
                      <span>
                        Custo <span className="numeric">{money(p.cost)}</span>
                      </span>
                      <label>
                        Preço R${' '}
                        <input
                          className="price-input numeric"
                          type="number"
                          min="0.01"
                          step="0.01"
                          aria-label={`Preço ${p.id}`}
                          value={prices[i]}
                          onChange={e =>
                            setPrices(v => v.map((n, j) => (i === j ? Number(e.target.value) : n)))
                          }
                        />
                      </label>
                    </div>
                    <div className="quantity-control">
                      {[-5, -1].map(d => (
                        <Button
                          key={d}
                          variant="outline"
                          onClick={() => changeQuantity(i, (quantities[i] ?? 0) + d)}
                        >
                          {d}
                        </Button>
                      ))}
                      <input
                        type="number"
                        className="numeric"
                        min="0"
                        aria-label={`Quantidade ${p.id}`}
                        value={quantities[i]}
                        onChange={e => changeQuantity(i, Number(e.target.value))}
                      />
                      {[1, 5].map(d => (
                        <Button
                          key={d}
                          variant="outline"
                          onClick={() => changeQuantity(i, (quantities[i] ?? 0) + d)}
                        >
                          +{d}
                        </Button>
                      ))}
                    </div>
                    <div className="flex justify-between text-xs mt-4">
                      <span className="text-muted-foreground">Subtotal</span>
                      <b className="numeric">
                        {money((items[i]?.quantity ?? 0) * (items[i]?.price ?? 0))}
                      </b>
                    </div>
                  </div>
                ))}
              </div>

              {/* Condição de Pagamento Especializada para Farinhas (Boletos a cada 7 dias) */}
              <label className="field-label mt-6">
                Condição de Pagamento (Boletos / Prazos)
                <select className="form-input text-xs" value={payment} onChange={e => setPayment(e.target.value)}>
                  {paymentTermsList.map(term => (
                    <option key={term.label} value={term.label}>
                      {term.label}
                    </option>
                  ))}
                </select>
              </label>

              {/* Detalhe do Parcelamento em Tempo Real */}
              {f.total > 0 && selectedTerm.installments > 1 && (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 mt-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1.5 font-medium">
                      <CreditCard size={14} className="text-primary" />
                      Divisão a cada 7 dias:
                    </span>
                    <strong className="font-semibold text-primary font-mono text-sm">
                      {selectedTerm.installments}x de {money(installmentValue)}
                    </strong>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">{selectedTerm.desc}</p>
                </div>
              )}

              {/* Observação para Entrega (Sem forçar previsão arbitrária) */}
              <label className="field-label mt-4">
                Observação para entrega ou motorista
                <textarea
                  className="form-input text-xs"
                  rows={2}
                  value={orderNote}
                  onChange={e => setOrderNote(e.target.value)}
                  placeholder="Instruções para o galpão ou motorista (opcional)..."
                />
              </label>

              <label className="flex gap-2 text-xs mt-4 items-start cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={promotional}
                  onChange={e => setPromotional(e.target.checked)}
                />
                Preço promocional pontual — manter tabela padrão do cliente
              </label>

              {/* Card de Valor Total e Breakdown de Lucro Oculto com ProfitGauge */}
              <div className="profit-box mt-5">
                <span className="text-xs opacity-70">VALOR TOTAL DO PEDIDO</span>
                <h2 className="numeric mt-2">{money(f.total)}</h2>
                <Button
                  variant="ghost"
                  className="profit-toggle"
                  onClick={() => setPrivateProfit(v => !v)}
                >
                  {privateProfit ? <Eye /> : <EyeOff />}
                  Breakdown de lucro
                </Button>
                {!privateProfit && (
                  <div className="profit-breakdown">
                    {[
                      ['Faturamento bruto', f.total],
                      ['CMV importado', -f.cost],
                      ['Impostos estimados · 8%', -f.tax],
                      ['Entrega estimada', -45],
                    ].map(([label, v]) => (
                      <div key={String(label)}>
                        <span>{label}</span>
                        <b className="numeric">{money(Number(v))}</b>
                      </div>
                    ))}
                    <div className="profit-final">
                      <strong>Lucro líquido</strong>
                      <b className="numeric text-emerald-400">{money(f.profit)}</b>
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-chrome-selected">
                      <div className="flex items-center gap-2">
                        <ProfitGauge margin={f.margin} size={36} strokeWidth={4} />
                        <span className="text-xs">Margem líquida</span>
                      </div>
                      <span className={`status-badge ${marginLevel(f.margin)}`}>
                        {f.margin.toFixed(1)}% ({f.margin >= 15 ? 'Verde' : f.margin >= 8 ? 'Amarelo' : 'Vermelho'})
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Botão de Confirmação do Pedido */}
              <Button
                className="w-full h-12 mt-4 text-sm font-semibold"
                disabled={!items.some(i => i.quantity > 0)}
                onClick={() => {
                  const newId = String(1049 + data.orders.length);
                  const totalItems = items.reduce((s, i) => s + i.quantity, 0);
                  const success = submit({
                    id: newId,
                    clientId: client.id,
                    items,
                    status: 'AGUARDANDO_REVISAO',
                    payment,
                    delivery: 'Próxima rota',
                    note: orderNote,
                    promotional,
                    date: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                  });

                  if (success) {
                    fireConfetti();
                    setSuccessOrder({
                      id: newId,
                      clientName: client.name,
                      total: f.total,
                      itemsCount: totalItems,
                    });
                  }
                }}
              >
                Confirmar pedido
                <ArrowUpRight />
              </Button>
              <p className="text-xs text-muted-foreground text-center mt-3">
                Enviar para conferência pré-nota de Gabriel
              </p>
            </>
          )}
        </div>

        {/* Barra de Navegação Inferior (3 Abas Essenciais) */}
        <nav className="seller-nav">
          <Button
            variant="ghost"
            className={view === 'agenda' ? 'active' : ''}
            onClick={() => setView('agenda')}
          >
            <CalendarDays />
            Agenda
          </Button>
          <Button
            variant="ghost"
            className={view === 'client' ? 'active' : ''}
            onClick={() => setView('client')}
          >
            <Users />
            Clientes
          </Button>
          <Button variant="ghost" className={view === 'order' ? 'active' : ''} onClick={startOrder}>
            <ShoppingBag />
            Pedido
          </Button>
        </nav>
      </div>

      {/* Painel lateral informativo para modo Desktop */}
      <div className="seller-side-note">
        <span className="eyebrow">4S EM CAMPO</span>
        <h2>
          Seu negócio.
          <br />
          Onde você estiver.
        </h2>
        <p className="text-muted-foreground">Sexta-feira, 16 de outubro</p>
        <div className="seller-session">
          <div className="flex-1">
            <strong>Sérgio Furtado</strong>
            <p>Vendas externas · São Paulo</p>
          </div>
          <span className="online-dot" />
        </div>
        <div className="seller-route-line">
          <MapPin />
          <span>{data.clients.length} visitas na rota de hoje</span>
        </div>
        <div className="seller-route-line">
          <Check />
          <span>Estoque conectado à mesa de conferência</span>
        </div>
      </div>

      {/* MODAL: Feedback de Pedido Fechado (Sucesso) */}
      <Dialog
        open={Boolean(successOrder)}
        onOpenChange={open => {
          if (!open) {
            setSuccessOrder(null);
            setView('agenda');
          }
        }}
      >
        <DialogContent className="max-w-xs text-center p-6 space-y-4 rounded-2xl">
          <div className="w-14 h-14 bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto text-2xl font-bold shadow-xs">
            <Check className="w-8 h-8 stroke-[3]" />
          </div>

          <div>
            <DialogTitle className="text-xl font-bold text-foreground">Pedido Fechado!</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Pedido #{successOrder?.id} · {successOrder?.clientName}
            </DialogDescription>
          </div>

          <div className="bg-muted/40 p-3.5 rounded-xl border border-border/50 text-left text-xs space-y-2.5">
            <div className="flex justify-between items-center pb-2 border-b border-border/40">
              <span className="text-muted-foreground">Valor Total:</span>
              <strong className="text-sm font-mono text-emerald-600 dark:text-emerald-400">
                {money(successOrder?.total ?? 0)}
              </strong>
            </div>
            <div className="text-[11px] text-muted-foreground space-y-1.5 pt-1">
              <div className="flex items-center gap-2 text-foreground">
                <span className="text-emerald-500 font-bold">✓</span>
                <span>
                  <strong>Estoque atualizado</strong> em tempo real
                </span>
              </div>
              <div className="flex items-center gap-2 text-foreground">
                <span className="text-indigo-500 font-bold">📋</span>
                <span>
                  <strong>Enviado p/ Gabriel</strong> emitir NF-e
                </span>
              </div>
              <div className="flex items-center gap-2 text-foreground">
                <span className="text-amber-500 font-bold">🚚</span>
                <span>
                  <strong>Romaneio pronto</strong> p/ separação
                </span>
              </div>
            </div>
          </div>

          <Button
            className="w-full h-11 text-xs font-bold"
            onClick={() => {
              setSuccessOrder(null);
              setView('agenda');
            }}
          >
            Voltar para a Agenda
          </Button>
        </DialogContent>
      </Dialog>

      {/* MODAL: Agendar Visita */}
      <Dialog open={schedule} onOpenChange={setSchedule}>
        <DialogContent>
          <DialogTitle>Agendar visita</DialogTitle>
          <DialogDescription>Cliente existente ou cadastro rápido sem dados fiscais.</DialogDescription>
          <label className="field-label">
            Cliente
            <select
              className="form-input"
              value={newName}
              onChange={e => setNewName(e.target.value)}
            >
              <option value="">Novo cliente</option>
              {data.clients.map(c => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            Nome
            <input className="form-input" value={newName} onChange={e => setNewName(e.target.value)} />
          </label>
          <label className="field-label">
            Bairro
            <input
              className="form-input"
              value={newNeighborhood}
              onChange={e => setNewNeighborhood(e.target.value)}
            />
          </label>
          <label className="field-label">
            Horário
            <input type="time" className="form-input" value={time} onChange={e => setTime(e.target.value)} />
          </label>
          <Button
            disabled={!newName.trim()}
            onClick={async () => {
              const existing = data.clients.find(c => c.name === newName);
              setSchedule(false);
              const targetName = newName;
              const targetNeigh = newNeighborhood;
              setNewName('');
              setNewNeighborhood('');
              try {
                const next = await scheduleVisitApi(data, {
                  clientId: existing?.id,
                  name: targetName,
                  neighborhood: targetNeigh,
                  time,
                });
                update(next);
                notify('Visita agendada no servidor.');
              } catch {
                update({
                  ...data,
                  clients: existing
                    ? data.clients.map(c => (c.id === existing.id ? { ...c, time } : c))
                    : [
                        ...data.clients,
                        {
                          id: `client-${Date.now()}`,
                          colorKey: 'mega',
                          name: targetName,
                          neighborhood: targetNeigh || 'São Paulo',
                          buyer: 'A confirmar',
                          cnpj: '',
                          ie: '',
                          ibge: '',
                          days: 0,
                          cycle: 30,
                          lastTotal: 0,
                          overdue: false,
                          time,
                          notes: ['Hoje • Primeira visita agendada.'],
                          prices: data.products.map(p => p.price),
                        },
                      ],
                });
                notify('Visita agendada.');
              }
            }}
          >
            <Plus />
            Agendar visita
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}