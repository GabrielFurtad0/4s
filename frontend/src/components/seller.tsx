import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  Building2,
  Calendar,
  CalendarDays,
  Check,
  CheckCheck,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Eye,
  EyeOff,
  FileText,
  Loader2,
  MapPin,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Send,
  Smartphone,
  Sparkles,
  Truck,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarUi } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { ProfitGauge } from '@/components/ui/profit-gauge';
import { fireConfetti } from '@/components/ui/confetti';
import { FourSIcon } from './logo';
import { ptBR } from 'date-fns/locale';
import { openPrintableOrderSlip } from '@/lib/documentPrint';
import {
  addClientNoteApi,
  available,
  financials,
  formatCnpj,
  getOfflineOrdersQueue,
  lookupCnpjData,
  marginLevel,
  money,
  orderBaseValue,
  orderTotalBq,
  orderTotalDq,
  productLabel,
  quickRegisterClientApi,
  scheduleVisitApi,
  syncOfflineOrders,
  type AppData,
  type Client,
  type CnpjData,
  type Item,
  type Order,
} from '@/lib/business';

export type SharedProps = {
  data: AppData;
  update: (next: AppData) => void;
  notify: (message: string) => void;
  submit: (order: Order) => boolean;
  userProfile?: string | undefined;
};

const paymentTermsList = [
  { label: 'Boleto 28 dias (1 parcela)', installments: 1, desc: 'Vencimento em 28 dias após a entrega', startDays: 28, intervalDays: 0 },
  { label: 'Boleto 7/14/21/28 dias (4 parcelas a cada 7 dias)', installments: 4, desc: '4x semanais (7, 14, 21 e 28 dias após entrega)', startDays: 7, intervalDays: 7 },
  { label: 'Boleto 14/21/28 dias (3 parcelas a cada 7 dias)', installments: 3, desc: '3x semanais (14, 21 e 28 dias após entrega)', startDays: 14, intervalDays: 7 },
  { label: 'Boleto 7/14/21 dias (3 parcelas a cada 7 dias)', installments: 3, desc: '3x semanais (7, 14 e 21 dias após entrega)', startDays: 7, intervalDays: 7 },
  { label: 'Boleto 7/14 dias (2 parcelas a cada 7 dias)', installments: 2, desc: '2x semanais (7 e 14 dias após entrega)', startDays: 7, intervalDays: 7 },
  { label: 'Boleto 14/28 dias (2 parcelas a cada 14 dias)', installments: 2, desc: '2x quinzenais (14 e 28 dias após entrega)', startDays: 14, intervalDays: 14 },
  { label: 'Boleto 21 dias (1 parcela)', installments: 1, desc: 'Vencimento em 21 dias após a entrega', startDays: 21, intervalDays: 0 },
  { label: 'Boleto 14 dias (1 parcela)', installments: 1, desc: 'Vencimento em 14 dias após a entrega', startDays: 14, intervalDays: 0 },
  { label: 'Boleto 7 dias (1 parcela)', installments: 1, desc: 'Vencimento em 7 dias após a entrega', startDays: 7, intervalDays: 0 },
  { label: 'Pix na Entrega (À vista)', installments: 1, desc: 'Pagamento imediato na entrega', startDays: 0, intervalDays: 0 },
  { label: 'Dinheiro na Entrega (À vista)', installments: 1, desc: 'Pagamento em espécie ao motorista', startDays: 0, intervalDays: 0 },
];

function getDefaultDeliveryDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function formatHeaderDate(date: Date): string {
  const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${weekdays[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]}`;
}

function getGreeting(date: Date = new Date()): string {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return 'Bom dia';
  if (hour >= 12 && hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

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
  const [bqMode, setBqMode] = useState<'100%' | '50%' | 'custom'>('100%');
  const [customBq, setCustomBq] = useState([0, 0, 0]);
  const [prices, setPrices] = useState([85, 78, 92]);
  const [privateProfit, setPrivateProfit] = useState(true);
  const [payment, setPayment] = useState('Boleto 28 dias (1 parcela)');
  const [deliveryDate, setDeliveryDate] = useState<string>(() => getDefaultDeliveryDate());
  const [orderNote, setOrderNote] = useState('');
  const [promotional, setPromotional] = useState(false);

  // Estado do Modal de Pré-cadastro rápido por CNPJ
  const [quickRegisterOpen, setQuickRegisterOpen] = useState(false);
  const [quickCnpj, setQuickCnpj] = useState('');
  const [quickName, setQuickName] = useState('');
  const [quickBuyer, setQuickBuyer] = useState('');
  const [lookupResult, setLookupResult] = useState<CnpjData | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [savingClient, setSavingClient] = useState(false);

  // Estado do Pop-up de confirmação do pedido
  const [successOrder, setSuccessOrder] = useState<{
    id: string;
    clientName: string;
    total: number;
    itemsCount: number;
  } | null>(null);

  // Fila Offline PWA do Sr. Sérgio
  const [offlineQueue, setOfflineQueue] = useState<Order[]>(() => getOfflineOrdersQueue());
  const [syncingOffline, setSyncingOffline] = useState(false);

  // Mostrador de data dinâmico e calendário interativo
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  useEffect(() => {
    setCurrentDate(new Date());
    const interval = setInterval(() => {
      setCurrentDate(prev => {
        const now = new Date();
        return prev.toDateString() === now.toDateString() ? now : prev;
      });
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setOfflineQueue(getOfflineOrdersQueue());
    const onOnline = () => {
      handleSyncOfflineQueue();
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, []);

  const handleSyncOfflineQueue = async () => {
    setSyncingOffline(true);
    try {
      const res = await syncOfflineOrders(data);
      update(res.nextData);
      setOfflineQueue(getOfflineOrdersQueue());
      if (res.syncedCount > 0) {
        notify(`${res.syncedCount} pedido(s) sincronizado(s) com o servidor!`);
      } else if (res.remainingCount > 0) {
        notify(`${res.remainingCount} pedido(s) aguardando conexão estável.`);
      } else {
        notify('Fila offline já está atualizada.');
      }
    } catch {
      notify('Falha ao sincronizar fila offline. Tentará novamente.');
    } finally {
      setSyncingOffline(false);
    }
  };

  useEffect(() => {
    if (!data.clients.some(c => c.id === clientId) && data.clients[0]) {
      setClientId(data.clients[0].id);
    }
  }, [data.clients, clientId]);

  const client = data.clients.find(c => c.id === clientId) ?? data.clients[0];

  const resolvedBaseQuantities = (() => {
    const raw = data.products.map((_, i) => {
      const dq = quantities[i] ?? 0;
      if (dq <= 0) return 0;
      if (bqMode === '100%') return dq;
      if (bqMode === '50%') return Math.floor(dq / 2);
      return Math.max(0, Math.min(dq, Math.floor(customBq[i] ?? dq)));
    });
    const totalDq = quantities.reduce((a, b) => a + b, 0);
    const sumBq = raw.reduce((a, b) => a + b, 0);
    if (totalDq > 0 && sumBq < 1) {
      const firstActiveIdx = quantities.findIndex(q => q > 0);
      if (firstActiveIdx >= 0) {
        raw[firstActiveIdx] = 1;
      }
    }
    return raw;
  })();

  const items: Item[] = data.products.map((p, i) => {
    const dq = quantities[i] ?? 0;
    const bq = resolvedBaseQuantities[i] ?? 0;
    return {
      productId: p.id,
      quantity: dq,
      dispatchQuantity: dq,
      baseQuantity: bq,
      price: prices[i] ?? p.price,
      cost: p.cost,
    };
  });
  const f = financials(items);
  const baseTotal = orderBaseValue(items);
  const totalDq = orderTotalDq(items);
  const totalBq = orderTotalBq(items);

  const selectedTerm = paymentTermsList.find(t => t.label === payment) ?? {
    label: payment,
    installments: 1,
    desc: 'Vencimento em 28 dias após a entrega',
    startDays: 28,
    intervalDays: 0,
  };
  const installmentValue =
    baseTotal > 0 && selectedTerm.installments > 1 ? baseTotal / selectedTerm.installments : baseTotal;

  // Cronograma dos boletos: calculados a partir da data de entrega
  const computedDueDates: string[] = Array.from(
    { length: Math.max(1, selectedTerm.installments) },
    (_, idx) => {
      if (!deliveryDate) return '';
      const [y, m, d] = deliveryDate.split('-').map(Number);
      const dateObj = new Date(y, (m || 1) - 1, d || 1);
      const offset = (selectedTerm.startDays ?? 7) + idx * (selectedTerm.intervalDays ?? 7);
      dateObj.setDate(dateObj.getDate() + offset);
      const yyyy = dateObj.getFullYear();
      const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
      const dd = String(dateObj.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
  );

  const openClient = (c: Client) => {
    setClientId(c.id);
    setView('client');
  };

  const startOrder = () => {
    if (!client) return;
    setPrices([...client.prices]);
    setQuantities([0, 0, 0]);
    setCustomBq([0, 0, 0]);
    setBqMode('100%');
    setView('order');
    setPrivateProfit(true);
    const initialPayment = client.defaultPaymentTerms || 'Boleto 28 dias (1 parcela)';
    setPayment(initialPayment);
    setDeliveryDate(getDefaultDeliveryDate());
  };

  const changeQuantity = (i: number, n: number) => {
    const product = data.products[i];
    if (!product) return;
    const nextDq = Math.max(0, Math.min(available(product), Math.floor(n || 0)));
    setQuantities(q => q.map((v, j) => (j === i ? nextDq : v)));
    setCustomBq(b => b.map((v, j) => (j === i ? Math.min(nextDq, bqMode === '100%' ? nextDq : v) : v)));
  };

  const changeBaseQuantity = (i: number, n: number) => {
    const maxDq = quantities[i] ?? 0;
    const nextBq = Math.max(0, Math.min(maxDq, Math.floor(n || 0)));
    setCustomBq(b => b.map((v, j) => (j === i ? nextBq : v)));
  };

  const resetQuickForm = () => {
    setQuickCnpj('');
    setQuickName('');
    setQuickBuyer('');
    setLookupResult(null);
    setLookingUp(false);
    setSavingClient(false);
  };

  const handleLookupCnpj = async (cnpjToSearch: string) => {
    const clean = cnpjToSearch.replace(/\D/g, '');
    if (clean.length !== 14) return;
    setLookingUp(true);
    try {
      const res = await lookupCnpjData(clean);
      setLookupResult(res);
      if (!quickName && res.name) {
        setQuickName(res.name);
      }
      notify(`Dados fiscais de ${res.name} encontrados.`);
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Não foi possível consultar o CNPJ.');
    } finally {
      setLookingUp(false);
    }
  };

  const handleSaveQuickClient = async () => {
    const clean = quickCnpj.replace(/\D/g, '');
    if (clean.length !== 14) {
      notify('Informe um CNPJ válido com 14 dígitos.');
      return;
    }
    setSavingClient(true);
    try {
      const { nextData, client: created } = await quickRegisterClientApi(data, {
        cnpj: quickCnpj,
        name: quickName || lookupResult?.name,
        corporateName: lookupResult?.corporateName,
        neighborhood: lookupResult?.neighborhood,
        buyer: quickBuyer || 'Comprador',
        ie: lookupResult?.ie,
        ibge: lookupResult?.ibge,
      });
      update(nextData);
      setQuickRegisterOpen(false);
      resetQuickForm();
      fireConfetti();
      notify(`Cliente ${created.name} cadastrado com sucesso!`);
      openClient(created);
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Erro ao cadastrar cliente.');
    } finally {
      setSavingClient(false);
    }
  };

  const radarClients = data.clients.filter(c => c.days >= c.cycle);

  return (
    <div className="seller-wrap">
      <div className="seller-phone">
        {/* Topbar Fixa com Estoque dos 3 SKUs */}
        <header className="seller-header">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FourSIcon size={22} />
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
          {/* Banner PWA da Fila de Pedidos Offline */}
          {offlineQueue.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-2.5 mb-3 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <WifiOff size={16} className="text-amber-500 shrink-0" />
                <div>
                  <p className="font-semibold text-amber-700 dark:text-amber-400">
                    {offlineQueue.length} {offlineQueue.length === 1 ? 'pedido gravado' : 'pedidos gravados'} offline
                  </p>
                  <p className="text-[10px] text-muted-foreground">Salvo no dispositivo · aguardando envio</p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={syncingOffline}
                className="h-7 text-xs font-semibold gap-1 bg-background"
                onClick={handleSyncOfflineQueue}
              >
                <RefreshCw size={12} className={syncingOffline ? 'animate-spin' : ''} />
                {syncingOffline ? 'Enviando...' : 'Sincronizar'}
              </Button>
            </div>
          )}

          {/* TELA 1: AGENDA & RADAR */}
          {/* TELA 1: AGENDA & RADAR */}
          {view === 'agenda' && (
            <>
              {/* Saudação Compacta e Mostrador de Data Dinâmico em Tempo Real */}
              <div className="flex items-baseline justify-between mt-1 mb-2.5">
                <h1 className="text-base font-bold text-foreground tracking-tight m-0">
                  {getGreeting(currentDate)}, Sérgio <span className="text-muted-foreground text-xs font-normal">↗</span>
                </h1>
                <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="text-[10px] text-muted-foreground hover:text-foreground font-semibold uppercase tracking-wider cursor-pointer transition-colors flex items-center gap-1.5 py-0.5 px-1.5 -mr-1.5 rounded hover:bg-muted/60 focus:outline-none focus:ring-1 focus:ring-ring"
                      title={`Data: ${currentDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}. Clique para abrir o calendário.`}
                      aria-label="Mostrador de data. Clique para abrir o calendário."
                    >
                      <CalendarDays size={13} className="text-muted-foreground shrink-0" />
                      <span suppressHydrationWarning>{formatHeaderDate(currentDate)}</span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-auto p-3 shadow-lg border border-border bg-popover z-50">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between border-b border-border/70 pb-2">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-foreground capitalize">
                            {currentDate.toLocaleDateString('pt-BR', { weekday: 'long' })}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {currentDate.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}
                          </span>
                        </div>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                          {new Date().toDateString() === currentDate.toDateString() ? 'Hoje' : 'Personalizado'}
                        </span>
                      </div>
                      <CalendarUi
                        mode="single"
                        selected={currentDate}
                        onSelect={d => {
                          if (d) {
                            setCurrentDate(d);
                            setDatePickerOpen(false);
                          }
                        }}
                        locale={ptBR}
                        initialFocus
                      />
                      <div className="flex items-center justify-between pt-2 border-t border-border/70">
                        <span className="text-[10px] text-muted-foreground">
                          {new Date().toDateString() === currentDate.toDateString() ? 'Visualizando hoje' : 'Data selecionada'}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-primary hover:text-primary hover:bg-primary/10"
                          onClick={() => {
                            setCurrentDate(new Date());
                            setDatePickerOpen(false);
                          }}
                        >
                          Voltar para hoje
                        </Button>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Barra de Busca + Botão Agendar Visita (Tamanho Original) */}
              <div className="flex gap-2 items-center mb-3">
                <div className="search-field flex-1">
                  <Search size={16} />
                  <input
                    aria-label="Buscar cliente ou bairro"
                    placeholder="Buscar cliente ou bairro..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 shrink-0"
                  aria-label="Agendar visita"
                  title="Agendar visita"
                  onClick={() => setSchedule(true)}
                >
                  <Plus size={16} />
                </Button>
              </div>

              <div className="segmented mb-3">
                <Button variant="ghost" className={!radar ? 'selected' : ''} onClick={() => setRadar(false)}>
                  Visitas de hoje <span>{data.clients.length}</span>
                </Button>
                <Button variant="ghost" className={radar ? 'selected' : ''} onClick={() => setRadar(true)}>
                  Radar de recompra <span>{radarClients.length}</span>
                </Button>
              </div>

              {/* Lista de Clientes - Scroll independente da lista */}
              <div className="client-scroll-area space-y-2.5 flex-1 min-h-0">
                {data.clients
                  .filter(
                    c =>
                      (!radar || c.days >= c.cycle) &&
                      `${c.name} ${c.neighborhood}`.toLowerCase().includes(search.toLowerCase()),
                  )
                  .map(c => (
                    <div
                      className="visit-card"
                      key={c.id}
                      onClick={() => openClient(c)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          openClient(c);
                        }
                      }}
                    >
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
                      <div className="flex items-center justify-between my-1.5">
                        <strong className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                          {c.name}
                        </strong>
                        <ArrowUpRight size={17} className="text-muted-foreground" />
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {c.days} dias sem comprar <span className="mx-1">·</span>{' '}
                        <span className="numeric">{money(c.lastTotal)}</span>
                        {radar && <p className="mt-1 text-warning font-medium">Ciclo habitual: {c.cycle} dias</p>}
                      </div>
                      {c.notes.at(-1) && (
                        <p className="visit-note">{c.notes.at(-1)?.split(' • ')[1]}</p>
                      )}
                    </div>
                  ))}
                {data.clients.filter(
                  c =>
                    (!radar || c.days >= c.cycle) &&
                    `${c.name} ${c.neighborhood}`.toLowerCase().includes(search.toLowerCase()),
                ).length === 0 && (
                  <div className="text-center py-8 text-xs text-muted-foreground border border-dashed border-border/60 rounded-xl">
                    Nenhum cliente encontrado para esta busca.
                  </div>
                )}
              </div>

              {/* Botão de Pré-Cadastro por CNPJ — Próximo às abas inferiores, sem duplicar o '+' */}
              <Button
                className="w-full h-11 text-xs font-bold gap-2 mt-2 mb-0.5 bg-primary text-primary-foreground shadow-sm rounded-xl hover:opacity-95 transition-all shrink-0"
                onClick={() => setQuickRegisterOpen(true)}
              >
                <Plus size={16} />
                <span>Pré-Cadastro de Cliente por CNPJ</span>
              </Button>
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
              <Button className="w-full h-11 mb-6 text-sm font-semibold" onClick={startOrder}>
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
                      <span className="text-muted-foreground">
                        Subtotal (DQ: {items[i]?.dispatchQuantity ?? 0} un.
                        {bqMode !== '100%' && (items[i]?.dispatchQuantity ?? 0) > 0
                          ? ` · BQ: ${items[i]?.baseQuantity ?? 0} un.`
                          : ''}
                        )
                      </span>
                      <b className="numeric">
                        {money((items[i]?.quantity ?? 0) * (items[i]?.price ?? 0))}
                      </b>
                    </div>
                    {bqMode === 'custom' && (quantities[i] ?? 0) > 0 && (
                      <div className="mt-3 pt-2.5 border-t border-border/50 flex items-center justify-between gap-2 text-xs">
                        <span className="text-muted-foreground font-medium">
                          Qtd. Base (BQ) <small className="opacity-75">(máx. {quantities[i]})</small>
                        </span>
                        <div className="flex items-center gap-1.5">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => changeBaseQuantity(i, (resolvedBaseQuantities[i] ?? 0) - 1)}
                          >
                            -1
                          </Button>
                          <input
                            type="number"
                            className="price-input numeric w-14 text-center"
                            min="0"
                            max={quantities[i] ?? 0}
                            aria-label={`Qtd. Base ${p.id}`}
                            value={resolvedBaseQuantities[i] ?? 0}
                            onChange={e => changeBaseQuantity(i, Number(e.target.value))}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => changeBaseQuantity(i, (resolvedBaseQuantities[i] ?? 0) + 1)}
                          >
                            +1
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Opção Discreta de Configuração de Base (BQ) vs Expedição (DQ) */}
              <label className="field-label mt-5">
                Base do Pedido (BQ vs. Expedição DQ)
                <select
                  className="form-input text-xs"
                  aria-label="Configuração de Qtd. Base (BQ)"
                  value={bqMode}
                  onChange={e => {
                    const nextMode = e.target.value as '100%' | '50%' | 'custom';
                    setBqMode(nextMode);
                    if (nextMode === 'custom') {
                      setCustomBq(
                        quantities.map(dq => (dq > 0 ? Math.max(1, Math.floor(dq / 2)) : 0))
                      );
                    }
                  }}
                >
                  <option value="100%">Base (BQ): Igual à expedição (100%)</option>
                  <option value="50%">Base (BQ): 50% da expedição</option>
                  <option value="custom">Base (BQ): Personalizar BQ por item</option>
                </select>
              </label>

              {totalDq > 0 && bqMode !== '100%' && (
                <div className="bg-muted/40 border border-border/60 rounded-lg px-3 py-2 mt-2 flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">
                    Expedição (DQ): <strong className="text-foreground numeric">{totalDq} un.</strong> · Base (BQ):{' '}
                    <strong className="text-foreground numeric">{totalBq} un.</strong>
                  </span>
                  <span className="numeric font-semibold text-primary">Base: {money(baseTotal)}</span>
                </div>
              )}

              {/* Condição de Pagamento Especializada para Farinhas (Boletos a cada 7 dias) */}
              <label className="field-label mt-4">
                Condição de Pagamento (Boletos / Prazos)
                <select
                  className="form-input text-xs"
                  value={payment}
                  onChange={e => setPayment(e.target.value)}
                >
                  {paymentTermsList.map(term => (
                    <option key={term.label} value={term.label}>
                      {term.label}
                    </option>
                  ))}
                </select>
              </label>

              {/* Seletor de Data de Entrega Programada */}
              <label className="field-label mt-3">
                <span className="flex items-center gap-1.5 font-medium text-foreground">
                  <Truck size={13} className="text-primary" />
                  Data de entrega
                </span>
                <input
                  type="date"
                  className="form-input text-xs h-9 bg-card font-mono numeric cursor-pointer"
                  value={deliveryDate}
                  onChange={e => setDeliveryDate(e.target.value)}
                />
                <span className="text-[10px] text-muted-foreground mt-0.5">
                  Os vencimentos dos boletos são calculados automaticamente a partir desta data.
                </span>
              </label>

              {/* Detalhe do Parcelamento em Tempo Real (Calculado sobre a Base BQ) */}
              {f.total > 0 && selectedTerm.installments >= 1 && (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 mt-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1.5 font-medium">
                      <CreditCard size={14} className="text-primary" />
                      {selectedTerm.installments > 1 ? 'Parcelas na Base (BQ):' : 'Valor em Boleto/Base (BQ):'}
                    </span>
                    <strong className="font-semibold text-primary font-mono text-sm">
                      {selectedTerm.installments}x de {money(installmentValue)}
                    </strong>
                  </div>

                  {/* Cronograma detalhado de parcelas calculadas a partir da entrega */}
                  {selectedTerm.installments > 1 && (
                    <div className="mt-2.5 pt-2 border-t border-primary/15 space-y-1">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                        Cronograma dos boletos (a partir da entrega em{' '}
                        {deliveryDate ? deliveryDate.split('-').reverse().join('/') : '—'}):
                      </span>
                      {computedDueDates.map((dStr, idx) => {
                        const [yyyy, mm, dd] = dStr.split('-');
                        const formatted = `${dd}/${mm}/${yyyy}`;
                        const offset = (selectedTerm.startDays ?? 7) + idx * (selectedTerm.intervalDays ?? 7);
                        return (
                          <div
                            key={idx}
                            className="flex items-center justify-between text-[11px] bg-background/60 px-2 py-1 rounded border border-border/40"
                          >
                            <span className="text-foreground">
                              <strong>{idx + 1}ª parcela:</strong>{' '}
                              <span className="font-mono text-primary font-medium">{formatted}</span>
                              <span className="text-muted-foreground text-[9.5px] ml-1">
                                (+{offset} dias da entrega)
                              </span>
                            </span>
                            <b className="numeric font-semibold text-foreground">{money(installmentValue)}</b>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {selectedTerm.installments === 1 && computedDueDates[0] && (
                    <div className="mt-2 pt-1.5 border-t border-primary/15 flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">
                        Vencimento ({selectedTerm.startDays === 0 ? 'na entrega' : `+${selectedTerm.startDays} dias da entrega`}):
                      </span>
                      <strong className="font-mono text-primary">
                        {computedDueDates[0].split('-').reverse().join('/')}
                      </strong>
                    </div>
                  )}

                  <p className="text-[10px] text-muted-foreground mt-2">
                    {selectedTerm.desc} · Total Base (BQ): {money(baseTotal)}
                  </p>
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
                <span className="text-xs opacity-70">VALOR TOTAL DO PEDIDO (EXPEDIÇÃO DQ)</span>
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
                      ['Faturamento bruto (DQ)', f.total],
                      ['CMV importado (DQ)', -f.cost],
                      [`Impostos estimados · 8% (BQ: ${totalBq} un.)`, -f.tax],
                      [`Frete estimado (R$ 4/saca · ${totalDq} un.)`, -f.logistics],
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
                        <ProfitGauge margin={f.margin} size={38} strokeWidth={3.5} />
                        <span className="text-xs">Margem líquida</span>
                      </div>
                      <span className={`status-badge ${marginLevel(f.margin)}`}>
                        {f.margin.toFixed(1)}% ({f.margin >= 20 ? 'Verde' : f.margin >= 7 ? 'Amarelo' : 'Vermelho'})
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Botão de Confirmação do Pedido */}
              <Button
                className="w-full h-12 mt-4 text-sm font-semibold"
                disabled={totalDq <= 0 || totalBq < 1}
                onClick={() => {
                  const newId = String(1049 + data.orders.length);
                  const totalItems = totalDq;
                  const formattedDelivery = deliveryDate
                    ? deliveryDate.split('-').reverse().join('/')
                    : 'Próxima rota';

                  const success = submit({
                    id: newId,
                    clientId: client.id,
                    items,
                    status: 'AGUARDANDO_REVISAO',
                    rawStatus: 'AGUARDANDO_REVISAO',
                    payment,
                    firstDueDate: computedDueDates[0] || deliveryDate,
                    dueDates: computedDueDates,
                    delivery: formattedDelivery,
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
                    setTimeout(() => {
                      setOfflineQueue(getOfflineOrdersQueue());
                    }, 500);
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
            <Truck />
            Pedido
          </Button>
        </nav>
      </div>

      {/* Painel lateral informativo para modo Desktop */}
      <div className="seller-side-note">
        <div className="seller-side-badge">
          <Smartphone size={13} />
          <span>Simulador Field Sales</span>
        </div>

        <div className="seller-side-hero">
          <h2>
            Seu negócio.
            <br />
            <span>Onde você estiver.</span>
          </h2>
          <p>
            Interface mobile simplificada para atendimento presencial, consulta de saldo em tempo real e emissão ágil de pedidos em campo.
          </p>
        </div>

        <div className="seller-side-card">
          <div className="flex items-center justify-between pb-3 border-b border-border/60">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center border border-primary/20">
                SF
              </div>
              <div>
                <strong className="text-xs font-semibold text-foreground block">Sérgio Furtado</strong>
                <span className="text-[11px] text-muted-foreground">Vendas externas · São Paulo</span>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              <span className="online-dot" /> Em rota
            </span>
          </div>

          <div className="space-y-2.5 pt-3">
            <div className="seller-side-stat">
              <MapPin size={14} className="text-primary shrink-0" />
              <span>
                <strong>{data.clients.length} visitas</strong> na rota de hoje
              </span>
            </div>
            <div className="seller-side-stat">
              <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
              <span>Estoque conectado à conferência</span>
            </div>
            <div className="seller-side-stat">
              <Calendar size={14} className="text-muted-foreground shrink-0" />
              <span>Sexta-feira, 16 de outubro</span>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL: Pré-cadastro rápido de novos clientes via CNPJ (BrasilAPI) */}
      <Dialog
        open={quickRegisterOpen}
        onOpenChange={open => {
          if (!open && !savingClient) {
            setQuickRegisterOpen(false);
            resetQuickForm();
          }
        }}
      >
        <DialogContent className="max-w-md p-6 space-y-4 rounded-2xl">
          <div>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Building2 className="text-primary" size={20} />
              Pré-cadastro por CNPJ
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Digite o CNPJ. O sistema busca automaticamente Razão Social, Bairro e Inscrição Estadual na Receita Federal / BrasilAPI.
            </DialogDescription>
          </div>

          <div className="space-y-3 pt-1">
            <label className="field-label">
              CNPJ da Padaria / Cliente
              <div className="flex gap-2">
                <input
                  className="form-input text-xs font-mono"
                  placeholder="00.000.000/0000-00"
                  value={quickCnpj}
                  onChange={e => {
                    const formatted = formatCnpj(e.target.value);
                    setQuickCnpj(formatted);
                    if (formatted.replace(/\D/g, '').length === 14) {
                      handleLookupCnpj(formatted);
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0 text-xs gap-1.5"
                  disabled={lookingUp || quickCnpj.replace(/\D/g, '').length !== 14}
                  onClick={() => handleLookupCnpj(quickCnpj)}
                >
                  {lookingUp ? <Loader2 className="animate-spin" size={14} /> : <Search size={14} />}
                  Buscar
                </Button>
              </div>
            </label>

            {/* Card com os dados encontrados da Receita Federal */}
            {lookupResult && (
              <div className="bg-muted/40 border border-emerald-500/30 rounded-xl p-3.5 space-y-2 animate-in fade-in-50">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5" />
                    Dados encontrados na Receita
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono">IBGE: {lookupResult.ibge}</span>
                </div>
                <p className="text-xs font-semibold text-foreground leading-tight">{lookupResult.corporateName}</p>
                <p className="text-[11px] text-muted-foreground">
                  {lookupResult.neighborhood}, {lookupResult.city} - {lookupResult.state} · IE: {lookupResult.ie}
                </p>
              </div>
            )}

            <label className="field-label">
              Nome Fantasia / Apelido no App (opcional)
              <input
                className="form-input text-xs"
                placeholder={lookupResult?.name || 'Ex: Padaria Estrela'}
                value={quickName}
                onChange={e => setQuickName(e.target.value)}
              />
            </label>

            <label className="field-label">
              Nome do Comprador / Contato (opcional)
              <input
                className="form-input text-xs"
                placeholder="Ex: Sr. Antônio / Marcos"
                value={quickBuyer}
                onChange={e => setQuickBuyer(e.target.value)}
              />
            </label>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1 text-xs"
              disabled={savingClient}
              onClick={() => {
                setQuickRegisterOpen(false);
                resetQuickForm();
              }}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1 font-semibold text-xs gap-1.5"
              disabled={savingClient || quickCnpj.replace(/\D/g, '').length !== 14}
              onClick={handleSaveQuickClient}
            >
              {savingClient ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />}
              Cadastrar e Abrir
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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

          <div className="flex flex-col gap-2 w-full">
            <Button
              variant="outline"
              className="w-full h-10 text-xs font-semibold gap-1.5 border-sky-500/30 text-sky-700 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/30"
              onClick={() => {
                const orderObj = data.orders.find(o => o.id === successOrder?.id);
                if (orderObj) {
                  const clientObj = data.clients.find(c => c.id === orderObj.clientId);
                  openPrintableOrderSlip(orderObj, clientObj, data.products, 'Sérgio Soares');
                }
              }}
            >
              <Printer size={13} />
              Imprimir Talão do Pedido
            </Button>

            <Button
              className="w-full h-11 text-xs font-bold"
              onClick={() => {
                setSuccessOrder(null);
                setView('agenda');
              }}
            >
              Voltar para a Agenda
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL: Agendar Visita */}
      <Dialog open={schedule} onOpenChange={setSchedule}>
        <DialogContent>
          <DialogTitle>Agendar visita</DialogTitle>
          <DialogDescription>Cliente existente ou agendamento rápido.</DialogDescription>
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