import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  Eye,
  EyeOff,
  MapPin,
  Package,
  Plus,
  Search,
  Tag,
  Wifi
} from 'lucide-react';
import { api, formatBRL } from '../api';
import { DesignTheme } from '../themes';
import {
  AgendaCard,
  Client360,
  ProductStock,
  TopbarSummary
} from '../types';

interface MobileFieldAppProps {
  theme: DesignTheme;
  topbarData: TopbarSummary | null;
  onDataMutated: () => Promise<void>;
}

interface LocalOrderDraft {
  clientId: number;
  quantities: Record<number, number>;
  prices: Record<number, string>;
  promotional: Record<number, boolean>;
  paymentTerms: string;
  deliveryForecast: string;
  notes: string;
}

const DRAFT_STORAGE_KEY = 'totaltrigo_order_draft_v1';

export const MobileFieldApp: React.FC<MobileFieldAppProps> = ({
  theme,
  topbarData,
  onDataMutated
}) => {
  const [activeScreen, setActiveScreen] = useState<1 | 2 | 3>(1);
  const [agendaTab, setAgendaTab] = useState<'hoje' | 'radar' | 'todos'>('hoje');
  const [searchQuery, setSearchQuery] = useState('');
  const [agendaCards, setAgendaCards] = useState<AgendaCard[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client360 | null>(null);
  const [newNoteText, setNewNoteText] = useState('');

  // Order Express state (Tela 3)
  const [quantities, setQuantities] = useState<Record<number, number>>({ 1: 10, 2: 5, 3: 0 });
  const [prices, setPrices] = useState<Record<number, string>>({ 1: '79.00', 2: '75.00', 3: '88.00' });
  const [promotionalFlags, setPromotionalFlags] = useState<Record<number, boolean>>({
    1: false,
    2: false,
    3: false
  });
  const [paymentTerms, setPaymentTerms] = useState('Boleto 28 dias');
  const [deliveryForecast, setDeliveryForecast] = useState('Amanhã (Manhã)');
  const [orderObs, setOrderObs] = useState('');
  const [showProfitBreakdown, setShowProfitBreakdown] = useState(false);
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [lastSubmittedSummary, setLastSubmittedSummary] = useState<{
    clientName: string;
    totalText: string;
    orderId: number;
  } | null>(null);

  // Visit / Quick Client modal state
  const visitDialogRef = useRef<HTMLDialogElement | null>(null);
  const successDialogRef = useRef<HTMLDialogElement | null>(null);
  const [visitClientName, setVisitClientName] = useState('');
  const [visitCnpj, setVisitCnpj] = useState('');
  const [visitTime, setVisitTime] = useState('15:30');
  const [visitRegion, setVisitRegion] = useState('');
  const [visitNote, setVisitNote] = useState('');

  const loadAgenda = async () => {
    try {
      const list = await api.getAgenda();
      setAgendaCards(list);
      if (!selectedClient && list.length > 0) {
        await handleSelectClient(list[0].clientId, false);
      }
    } catch (err: any) {
      setErrorBanner(err.message || 'Erro ao carregar agenda');
    }
  };

  useEffect(() => {
    loadAgenda();
  }, []);

  // Salva rascunho local (RASCUNHO_LOCAL em localStorage contra queda de 4G)
  useEffect(() => {
    if (!selectedClient) return;
    const draft: LocalOrderDraft = {
      clientId: selectedClient.id,
      quantities,
      prices,
      promotional: promotionalFlags,
      paymentTerms,
      deliveryForecast,
      notes: orderObs
    };
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
  }, [selectedClient, quantities, prices, promotionalFlags, paymentTerms, deliveryForecast, orderObs]);

  const handleSelectClient = async (clientId: number, navigateToClientScreen = true) => {
    try {
      setErrorBanner(null);
      const detail = await api.getClient360(clientId);
      setSelectedClient(detail);
      setPaymentTerms(detail.defaultPaymentTerms || 'Boleto 28 dias');

      // Verifica se existe rascunho local salvo para este cliente
      const savedDraftRaw = localStorage.getItem(DRAFT_STORAGE_KEY);
      let restoredFromDraft = false;
      if (savedDraftRaw) {
        try {
          const parsed: LocalOrderDraft = JSON.parse(savedDraftRaw);
          if (parsed.clientId === detail.id) {
            setQuantities(parsed.quantities);
            setPrices(parsed.prices);
            setPromotionalFlags(parsed.promotional || { 1: false, 2: false, 3: false });
            restoredFromDraft = true;
          }
        } catch {
          // ignore
        }
      }

      if (!restoredFromDraft) {
        const nextPrices: Record<number, string> = {};
        detail.skuPrices.forEach((sp) => {
          nextPrices[sp.productId] = sp.agreedStandardPrice.toFixed(2);
        });
        setPrices(nextPrices);
        setQuantities({ 1: 15, 2: 10, 3: 0 });
        setPromotionalFlags({ 1: false, 2: false, 3: false });
        setOrderObs('');
      }

      if (navigateToClientScreen) {
        setActiveScreen(2);
      }
    } catch (err: any) {
      setErrorBanner(err.message || 'Erro ao abrir ficha do cliente');
    }
  };

  const handleAddNote = async () => {
    if (!selectedClient || !newNoteText.trim()) return;
    try {
      await api.addClientNote(selectedClient.id, newNoteText.trim());
      setNewNoteText('');
      const refreshed = await api.getClient360(selectedClient.id);
      setSelectedClient(refreshed);
      await loadAgenda();
    } catch (err: any) {
      setErrorBanner(err.message);
    }
  };

  const openVisitModal = () => {
    visitDialogRef.current?.showModal();
  };

  const closeVisitModal = () => {
    visitDialogRef.current?.close();
  };

  const handleSaveNewVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!visitClientName.trim()) return;
    try {
      const created = await api.createVisitOrQuickClient({
        quickClientName: visitClientName.trim(),
        quickCnpj: visitCnpj.trim() || undefined,
        quickNeighborhood: visitRegion.trim() || 'Zona Sul SP',
        scheduledTime: visitTime || '16:00',
        reminderNote: visitNote.trim() || 'Visita agendada pelo app na rua'
      });
      setVisitClientName('');
      setVisitCnpj('');
      setVisitRegion('');
      setVisitNote('');
      closeVisitModal();
      await loadAgenda();
      await onDataMutated();
      await handleSelectClient(created.clientId, false);
      setAgendaTab('hoje');
    } catch (err: any) {
      setErrorBanner(err.message);
    }
  };

  const changeQty = (productId: number, delta: number) => {
    setQuantities((prev) => {
      const curr = prev[productId] || 0;
      return { ...prev, [productId]: Math.max(0, curr + delta) };
    });
  };

  const products: ProductStock[] = topbarData?.products || [];

  // Cálculo em tempo real do Breakdown de Lucro na Tela 3
  let grossTotal = 0;
  let cmvTotal = 0;
  let taxTotal = 0;
  let hasStockWarning = false;

  products.forEach((p) => {
    const q = Math.max(0, quantities[p.id] || 0);
    const unitPrice = Math.max(0, parseFloat(prices[p.id] || '0') || 0);
    const sub = q * unitPrice;
    grossTotal += sub;
    cmvTotal += q * p.currentLandedCost;
    taxTotal += sub * ((p.estimatedTaxRate || 8) / 100);
    if (q > p.availableStock) {
      hasStockWarning = true;
    }
  });

  const shippingCost = grossTotal > 0 ? 45.0 : 0.0;
  const netProfit = grossTotal - cmvTotal - taxTotal - shippingCost;
  const netMargin = grossTotal > 0 ? Math.round((netProfit / grossTotal) * 100) : 0;

  const handleSubmitOrder = async () => {
    if (!selectedClient) return;
    const totalQty = Object.values(quantities).reduce((acc, v) => acc + (v || 0), 0);
    if (totalQty <= 0) {
      setErrorBanner('Adicione pelo menos 1 saco nos produtos para fechar o pedido.');
      return;
    }

    try {
      setSubmittingOrder(true);
      setErrorBanner(null);
      const itemsPayload = products
        .map((p) => ({
          productId: p.id,
          quantity: Math.max(0, quantities[p.id] || 0),
          unitSalePrice: Math.max(0, parseFloat(prices[p.id] || '0') || 0),
          isPromotionalPrice: !!promotionalFlags[p.id]
        }))
        .filter((i) => i.quantity > 0);

      const createdOrder = await api.submitStreetOrder({
        clientId: selectedClient.id,
        paymentTerms,
        deliveryForecast,
        notesForInvoiceOrDriver: orderObs,
        shippingCostEstimate: 45.0,
        items: itemsPayload
      });

      localStorage.removeItem(DRAFT_STORAGE_KEY);
      await onDataMutated();
      await loadAgenda();
      const updatedClient = await api.getClient360(selectedClient.id);
      setSelectedClient(updatedClient);

      setLastSubmittedSummary({
        clientName: selectedClient.tradeName,
        totalText: formatBRL(createdOrder.grossTotal),
        orderId: createdOrder.id
      });
      successDialogRef.current?.showModal();
    } catch (err: any) {
      setErrorBanner(err.message || 'Falha ao enviar pedido');
    } finally {
      setSubmittingOrder(false);
    }
  };

  const hojeCards = agendaCards.filter((c) => c.scheduledTime !== null);
  const radarCards = agendaCards.filter((c) => c.needsRestockAlert);

  const visibleAgenda = agendaCards.filter((c) => {
    const matchesTab =
      agendaTab === 'hoje'
        ? c.scheduledTime !== null
        : agendaTab === 'radar'
        ? c.needsRestockAlert
        : true;
    const q = searchQuery.toLowerCase().trim();
    const matchesQuery =
      !q ||
      c.corporateName.toLowerCase().includes(q) ||
      c.tradeName.toLowerCase().includes(q) ||
      c.neighborhood.toLowerCase().includes(q);
    return matchesTab && matchesQuery;
  });

  return (
    <div
      className={`w-full max-w-md ${theme.phoneShellBg} sm:rounded-3xl sm:shadow-2xl sm:border ${theme.phoneBorder} overflow-hidden flex flex-col h-[840px] relative transition-colors duration-300`}
    >
      {/* TOP BAR FIXA: Estoque Disponível dos 3 SKUs em Tempo Real */}
      <header className={`${theme.topbarBg} px-4 py-3 shrink-0 transition-colors duration-300`}>
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className={`text-[11px] font-bold uppercase tracking-wider ${theme.topbarLabel}`}>
              Estoque Disponível (Sacos 25kg)
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <span className="inline-flex items-center gap-1 opacity-80">
              <Wifi className="w-3 h-3 text-emerald-400" aria-hidden="true" /> 4G Sync
            </span>
            <span className="font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-400/30">
              Fila NF-e: {topbarData?.pendingNfeQueueCount ?? 0}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          {products.map((p) => (
            <div
              key={p.id}
              className={`${theme.topbarSkuCard} rounded-xl py-1.5 px-2 transition-colors duration-300`}
            >
              <div className={`text-[10px] font-medium truncate ${theme.topbarSkuName}`}>
                {p.shortName.replace(' (25kg)', '')}
              </div>
              <div className={`text-sm font-extrabold ${theme.topbarSkuValue}`}>
                {p.availableStock} <span className="text-[10px] font-normal opacity-80">{p.unitOfMeasure}</span>
              </div>
              {p.reservedStock > 0 && (
                <div className="text-[9px] opacity-65">
                  ({p.reservedStock} reserv.)
                </div>
              )}
            </div>
          ))}
        </div>
      </header>

      {/* BANNER DE ERRO OU ALERTA */}
      {errorBanner && (
        <div className="bg-red-600 text-white px-4 py-2 text-xs font-medium flex justify-between items-center">
          <span>⚠️ {errorBanner}</span>
          <button
            type="button"
            onClick={() => setErrorBanner(null)}
            className="text-white/80 hover:text-white font-bold ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* ÁREA DE CONTEÚDO PRINCIPAL */}
      <main className="flex-1 overflow-y-auto no-scrollbar pb-24">
        {/* ====================================================
            TELA 1: AGENDA DO DIA & RADAR DE RECOMPRA
            ==================================================== */}
        {activeScreen === 1 && (
          <section className="p-4 space-y-3.5">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-lg font-extrabold text-stone-900">Agenda &amp; Radar</h1>
                <p className="text-xs text-stone-500">
                  Toque no cliente para abrir a ficha 360º ou tirar pedido
                </p>
              </div>
              <button
                type="button"
                onClick={openVisitModal}
                className={`${theme.primaryBtn} text-xs font-semibold px-3 py-2 rounded-xl flex items-center gap-1 transition cursor-pointer`}
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" /> Agendar / Novo
              </button>
            </div>

            {/* Busca Rápida Semântica (<search>) */}
            <search>
              <div className="relative">
                <Search
                  className="w-3.5 h-3.5 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar padaria por nome ou bairro (ex: Grajaú, Jabaquara)..."
                  className="w-full bg-white border border-stone-200 rounded-xl pl-9 pr-3.5 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                />
              </div>
            </search>

            {/* Seletor Interno: Visitas do Dia vs Alerta de Recompra vs Todos */}
            <div className={`grid grid-cols-3 ${theme.tabContainer} p-1 rounded-xl text-xs font-semibold`}>
              <button
                type="button"
                onClick={() => setAgendaTab('hoje')}
                className={`py-2 rounded-lg transition cursor-pointer ${
                  agendaTab === 'hoje' ? theme.tabActive : theme.tabInactive
                }`}
              >
                Hoje ({hojeCards.length})
              </button>
              <button
                type="button"
                onClick={() => setAgendaTab('radar')}
                className={`py-2 rounded-lg transition cursor-pointer ${
                  agendaTab === 'radar' ? theme.tabActive : theme.tabInactive
                }`}
              >
                🔥 Recompra ({radarCards.length})
              </button>
              <button
                type="button"
                onClick={() => setAgendaTab('todos')}
                className={`py-2 rounded-lg transition cursor-pointer ${
                  agendaTab === 'todos' ? theme.tabActive : theme.tabInactive
                }`}
              >
                Todos ({agendaCards.length})
              </button>
            </div>

            {/* Lista de Clientes */}
            <div className="space-y-3">
              {visibleAgenda.map((c) => {
                const isEmDia = c.financialStatus === 'EM_DIA';
                return (
                  <article
                    key={c.clientId}
                    onClick={() => handleSelectClient(c.clientId, true)}
                    className={`${theme.cardBg} ${theme.cardHover} p-4 rounded-2xl border shadow-xs transition cursor-pointer`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {agendaTab === 'hoje' && c.scheduledTime ? (
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${theme.accentBadge}`}>
                              ⏰ {c.scheduledTime} • {c.neighborhood}
                            </span>
                          ) : (
                            <span className="text-[11px] font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md border border-amber-300">
                              ⏳ {c.daysSinceLastOrder}d sem comprar (Ciclo {c.averagePurchaseCycleDays}d) • {c.neighborhood}
                            </span>
                          )}
                          {!c.isRegistrationComplete && (
                            <span className="text-[10px] font-bold bg-orange-100 text-orange-800 px-1.5 py-0.5 rounded border border-orange-300">
                              Cadastro Rua
                            </span>
                          )}
                        </div>
                        <h2 className="font-bold text-stone-900 text-sm mt-1.5">{c.tradeName}</h2>
                        <p className="text-[11px] text-stone-500 mt-0.5">
                          Último pedido: há {c.daysSinceLastOrder} dias ({formatBRL(c.lastOrderTotal)})
                        </p>
                      </div>

                      <span
                        className={`text-[11px] font-semibold px-2 py-1 rounded-lg border shrink-0 ${
                          isEmDia
                            ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                            : 'text-red-700 bg-red-50 border-red-200'
                        }`}
                      >
                        {isEmDia ? 'Em dia' : 'Boleto Vencido'}
                      </span>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-stone-100 flex justify-between items-center text-xs">
                      <span className="text-stone-500 truncate max-w-[240px]">
                        📌 &ldquo;{c.latestNote}&rdquo;
                      </span>
                      <span className="font-bold text-stone-900 shrink-0">Abrir →</span>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {/* ====================================================
            TELA 2: FICHA 360º DO CLIENTE & ANOTAÇÕES
            ==================================================== */}
        {activeScreen === 2 && selectedClient && (
          <section className="p-4 space-y-4">
            <div className={`${theme.cardBg} p-4 rounded-2xl border shadow-xs`}>
              <div className="flex justify-between items-start gap-2">
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${
                        selectedClient.financialStatus === 'EM_DIA'
                          ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                          : 'text-red-700 bg-red-50 border-red-200'
                      }`}
                    >
                      {selectedClient.financialStatus === 'EM_DIA' ? '✓ Em dia' : '⚠️ Boleto Vencido'}
                    </span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                        selectedClient.isRegistrationComplete
                          ? 'bg-sky-50 text-sky-700 border-sky-200'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}
                    >
                      {selectedClient.isRegistrationComplete
                        ? 'Fiscal NF-e OK'
                        : 'Completar CNPJ no Escritório'}
                    </span>
                  </div>

                  <h1 className="text-base font-extrabold text-stone-900 mt-1.5">
                    {selectedClient.tradeName}
                  </h1>
                  <p className="text-[11px] text-stone-500">
                    CNPJ: {selectedClient.cnpj || 'A confirmar'} • Comprador:{' '}
                    <strong>{selectedClient.contactName}</strong>
                  </p>
                  <p className="text-[11px] text-stone-500 mt-0.5 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-stone-400 shrink-0" aria-hidden="true" />
                    {selectedClient.fullAddress}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveScreen(3)}
                  className={`${theme.primaryBtn} text-xs font-bold px-3.5 py-2.5 rounded-xl shrink-0 cursor-pointer transition`}
                >
                  + Tirar Pedido
                </button>
              </div>

              <div className="mt-3 pt-3 border-t border-stone-100 flex flex-wrap gap-2 text-xs">
                <span className="bg-stone-100 text-stone-700 px-2.5 py-1 rounded-lg">
                  Pagto habitual: <strong>{selectedClient.defaultPaymentTerms}</strong>
                </span>
                <span className="bg-stone-100 text-stone-700 px-2.5 py-1 rounded-lg">
                  Ciclo: <strong>A cada {selectedClient.averagePurchaseCycleDays} dias</strong>
                </span>
              </div>
            </div>

            {/* Últimos Preços Praticados nos 3 SKUs */}
            <div className={`${theme.cardBg} p-4 rounded-2xl border shadow-xs`}>
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-stone-500">
                  Memória de Preço deste Cliente
                </h2>
                <span className="text-[10px] text-stone-400">Carrega automático na Tela 3</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                {selectedClient.skuPrices.map((sp) => (
                  <div
                    key={sp.productId}
                    className={`p-2.5 rounded-xl border ${theme.priceCardBg}`}
                  >
                    <div className="text-[11px] font-medium text-stone-600 truncate">
                      {sp.shortName.replace(' (25kg)', '')}
                    </div>
                    <div className={`text-sm font-extrabold mt-0.5 ${theme.priceValueText}`}>
                      {formatBRL(sp.agreedStandardPrice)}
                    </div>
                    <div className="text-[10px] text-stone-400">
                      Tab: {formatBRL(sp.baseListPrice)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Caderno de Anotações da Visita */}
            <div className={`${theme.cardBg} p-4 rounded-2xl border shadow-xs`}>
              <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-stone-500 mb-2.5">
                Caderno de Anotações do Cliente
              </h2>
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
                  placeholder="Anote detalhes da visita, preferência de entrega ou amostra..."
                  className="flex-1 text-xs border border-stone-300 rounded-xl px-3 py-2 focus:outline-none focus:border-stone-900"
                />
                <button
                  type="button"
                  onClick={handleAddNote}
                  className={`${theme.primaryBtn} text-xs font-bold px-3.5 py-2 rounded-xl cursor-pointer`}
                >
                  Salvar
                </button>
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {selectedClient.notes.map((n) => (
                  <div
                    key={n.id}
                    className="bg-stone-50 p-2.5 rounded-xl border border-stone-200/80 text-xs"
                  >
                    <span className="font-bold text-stone-800">{n.formattedDate}:</span>{' '}
                    <span className="text-stone-600">{n.content}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Histórico de Pedidos Recentes */}
            <div className={`${theme.cardBg} p-4 rounded-2xl border shadow-xs`}>
              <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-stone-500 mb-2">
                Últimos Pedidos do Cliente
              </h2>
              <div className="divide-y divide-stone-100 text-xs">
                {selectedClient.recentOrders.length === 0 ? (
                  <p className="text-stone-400 py-2">Nenhum pedido faturado anteriormente.</p>
                ) : (
                  selectedClient.recentOrders.map((h) => (
                    <div key={h.orderId} className="py-2.5 flex justify-between items-center">
                      <div>
                        <span className="font-bold text-stone-800">{h.itemsSummary}</span>
                        <p className="text-[11px] text-stone-400">{h.metaInfo}</p>
                      </div>
                      <span className="font-extrabold text-stone-900">
                        {formatBRL(h.grossTotal)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        )}

        {/* ====================================================
            TELA 3: LANÇADOR DE PEDIDO EXPRESS & BREAKDOWN DE LUCRO
            ==================================================== */}
        {activeScreen === 3 && selectedClient && (
          <section className="p-4 space-y-3.5">
            {/* Cabeçalho do Cliente Selecionado + Status Rascunho Local */}
            <div className={`${theme.cardBg} flex justify-between items-center p-3.5 rounded-2xl border shadow-xs`}>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-wider text-stone-400 font-bold">
                    Cliente Selecionado
                  </span>
                  <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-semibold border border-emerald-200">
                    💾 Rascunho Salvo
                  </span>
                </div>
                <h1 className="text-sm font-extrabold text-stone-900 mt-0.5">
                  {selectedClient.tradeName}
                </h1>
              </div>
              <button
                type="button"
                onClick={() => setActiveScreen(1)}
                className="text-xs text-stone-500 underline font-medium cursor-pointer"
              >
                Trocar Cliente
              </button>
            </div>

            {/* Os 3 SKUs Fixos */}
            <div className="space-y-2.5">
              {products.map((p) => {
                const qty = quantities[p.id] || 0;
                const priceVal = parseFloat(prices[p.id] || '0') || 0;
                const subtotal = qty * priceVal;
                const exceedsAvailable = qty > p.availableStock;

                return (
                  <div
                    key={p.id}
                    className={`${theme.cardBg} p-3.5 rounded-2xl border shadow-xs transition ${
                      exceedsAvailable ? 'border-red-500 ring-2 ring-red-500/20' : ''
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                          {p.skuCode} • NCM {p.ncm}
                        </span>
                        <h2 className="font-extrabold text-sm text-stone-900">{p.name}</h2>
                        <span className="text-[11px] text-stone-500">
                          Disponível:{' '}
                          <strong className={exceedsAvailable ? 'text-red-600' : 'text-stone-800'}>
                            {p.availableStock} {p.unitOfMeasure}
                          </strong>{' '}
                          • Custo Lote: {formatBRL(p.currentLandedCost)}
                        </span>
                      </div>
                      <div className="text-right">
                        <label className="text-[10px] text-stone-400 block font-semibold">
                          Preço Unit. (R$)
                        </label>
                        <input
                          type="number"
                          step="0.50"
                          value={prices[p.id] ?? ''}
                          onChange={(e) =>
                            setPrices((prev) => ({ ...prev, [p.id]: e.target.value }))
                          }
                          className="w-20 text-right font-extrabold text-sm border-b-2 border-stone-300 focus:border-amber-600 focus:outline-none py-0.5"
                        />
                      </div>
                    </div>

                    {exceedsAvailable && (
                      <div className="mb-2 bg-red-50 border border-red-200 text-red-700 text-[11px] px-2.5 py-1 rounded-lg flex items-center gap-1 font-medium">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        Quantidade ({qty}) ultrapassa o estoque disponível ({p.availableStock} {p.unitOfMeasure})!
                      </div>
                    )}

                    <div className="flex justify-between items-center pt-2 border-t border-stone-100">
                      <div>
                        <span className="text-xs text-stone-500">
                          Subtotal: <strong className="text-stone-900">{formatBRL(subtotal)}</strong>
                        </span>
                        <label className="flex items-center gap-1.5 text-[10px] text-stone-500 mt-1 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={!!promotionalFlags[p.id]}
                            onChange={(e) =>
                              setPromotionalFlags((prev) => ({
                                ...prev,
                                [p.id]: e.target.checked
                              }))
                            }
                            className="rounded border-stone-300"
                          />
                          <Tag className="w-3 h-3 text-amber-600" aria-hidden="true" />
                          Preço promocional único
                        </label>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => changeQty(p.id, -5)}
                          className={`w-8 h-8 rounded-lg ${theme.secondaryBtn} font-bold text-xs cursor-pointer`}
                        >
                          -5
                        </button>
                        <button
                          type="button"
                          onClick={() => changeQty(p.id, -1)}
                          className="w-8 h-8 rounded-lg bg-stone-200 text-stone-900 font-bold text-sm cursor-pointer"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          value={qty}
                          onChange={(e) =>
                            setQuantities((prev) => ({
                              ...prev,
                              [p.id]: Math.max(0, parseInt(e.target.value, 10) || 0)
                            }))
                          }
                          className="w-11 text-center font-extrabold text-sm bg-transparent"
                        />
                        <button
                          type="button"
                          onClick={() => changeQty(p.id, 1)}
                          className={`w-8 h-8 rounded-lg ${theme.primaryBtn} font-bold text-sm cursor-pointer`}
                        >
                          +
                        </button>
                        <button
                          type="button"
                          onClick={() => changeQty(p.id, 5)}
                          className={`w-8 h-8 rounded-lg ${theme.secondaryBtn} font-bold text-xs cursor-pointer`}
                        >
                          +5
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Condição de Pagamento, Entrega e Observações */}
            <div className={`${theme.cardBg} p-3.5 rounded-2xl border space-y-3 text-xs shadow-xs`}>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-stone-400 font-semibold block mb-1">
                    Forma de Pagamento
                  </label>
                  <select
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                    className="w-full border border-stone-300 rounded-xl p-2 font-semibold bg-white"
                  >
                    <option>Boleto 28 dias</option>
                    <option>Boleto 21 dias</option>
                    <option>Boleto 14/28 dias</option>
                    <option>Pix na Entrega</option>
                    <option>À Vista (Boleto 7d)</option>
                  </select>
                </div>
                <div>
                  <label className="text-stone-400 font-semibold block mb-1">
                    Entrega (Funcionários)
                  </label>
                  <select
                    value={deliveryForecast}
                    onChange={(e) => setDeliveryForecast(e.target.value)}
                    className="w-full border border-stone-300 rounded-xl p-2 font-semibold bg-white"
                  >
                    <option>Amanhã (Manhã)</option>
                    <option>Amanhã (Tarde)</option>
                    <option>Próxima Rota da Região</option>
                  </select>
                </div>
              </div>
              <div>
                <input
                  type="text"
                  value={orderObs}
                  onChange={(e) => setOrderObs(e.target.value)}
                  placeholder="Observação para a Pré-Nota (Gabriel) ou para o motorista..."
                  className="w-full border border-stone-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-stone-900"
                />
              </div>
            </div>

            {/* RAIO-X DE LUCRO E BREAKDOWN DE CUSTOS (Com Modo Privacidade) */}
            <div className={`${theme.profitBoxBg} p-4 rounded-2xl shadow-md transition-colors duration-300`}>
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-[11px] opacity-75 block">Valor Total do Pedido</span>
                  <span className="text-xl font-extrabold">{formatBRL(grossTotal)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowProfitBreakdown((prev) => !prev)}
                  className="text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-xl border border-white/15 flex items-center gap-1.5 transition cursor-pointer"
                >
                  {showProfitBreakdown ? (
                    <>
                      <EyeOff className="w-3.5 h-3.5" aria-hidden="true" /> Ocultar Lucro
                    </>
                  ) : (
                    <>
                      <Eye className="w-3.5 h-3.5" aria-hidden="true" /> Breakdown de Lucro
                    </>
                  )}
                </button>
              </div>

              {showProfitBreakdown && (
                <div className="mt-4 pt-3 border-t border-white/15 text-xs space-y-1.5">
                  <div className="flex justify-between opacity-80">
                    <span>(+) Faturamento Bruto:</span>
                    <span>{formatBRL(grossTotal)}</span>
                  </div>
                  <div className="flex justify-between opacity-80">
                    <span>(-) CMV Importação (Snapshot Lote):</span>
                    <span>- {formatBRL(cmvTotal)}</span>
                  </div>
                  <div className="flex justify-between opacity-80">
                    <span>(-) Impostos Estimados NF-e (ICMS Red. 7% + IBS/CBS):</span>
                    <span>- {formatBRL(taxTotal)}</span>
                  </div>
                  <div className="flex justify-between opacity-80">
                    <span>(-) Custo Entrega (Equipe/Caminhão):</span>
                    <span>- {formatBRL(shippingCost)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-white/20 font-extrabold text-sm">
                    <span>(=) Lucro Líquido Real:</span>
                    <div className="text-right">
                      <span
                        className={
                          netMargin >= 22
                            ? 'text-emerald-400'
                            : netMargin >= 12
                            ? 'text-amber-300'
                            : 'text-red-400'
                        }
                      >
                        {formatBRL(netProfit)}
                      </span>
                      <span
                        className={`text-[11px] px-1.5 py-0.5 rounded ml-1.5 ${
                          netMargin >= 22
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                            : netMargin >= 12
                            ? 'bg-amber-950 text-amber-300 border border-amber-700'
                            : 'bg-red-950 text-red-300 border border-red-700'
                        }`}
                      >
                        {netMargin}%
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Botão Principal: Enviar para Mesa de Conferência (AGUARDANDO_REVISAO) */}
            <button
              type="button"
              disabled={submittingOrder || hasStockWarning}
              onClick={handleSubmitOrder}
              className={`w-full ${theme.primaryBtn} disabled:opacity-50 font-extrabold py-3.5 rounded-2xl shadow-md text-sm transition cursor-pointer`}
            >
              {submittingOrder
                ? 'Enviando e Reservando Estoque...'
                : 'Confirmar Pedido → Enviar p/ Conferência NF-e'}
            </button>
          </section>
        )}
      </main>

      {/* BARRA DE NAVEGAÇÃO INFERIOR (3 Abas Essenciais) */}
      <nav
        className={`${theme.bottomNavBg} grid grid-cols-3 py-2 px-4 shrink-0 absolute bottom-0 w-full`}
      >
        <button
          type="button"
          onClick={() => setActiveScreen(1)}
          className={`flex flex-col items-center py-1 cursor-pointer ${
            activeScreen === 1 ? theme.bottomNavActive : theme.bottomNavInactive
          }`}
        >
          <Calendar className="w-4 h-4" aria-hidden="true" />
          <span className="text-[11px] mt-0.5">1. Agenda</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveScreen(2)}
          className={`flex flex-col items-center py-1 cursor-pointer ${
            activeScreen === 2 ? theme.bottomNavActive : theme.bottomNavInactive
          }`}
        >
          <Building2 className="w-4 h-4" aria-hidden="true" />
          <span className="text-[11px] mt-0.5">2. Cliente</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveScreen(3)}
          className={`flex flex-col items-center py-1 cursor-pointer ${
            activeScreen === 3 ? theme.bottomNavActive : theme.bottomNavInactive
          }`}
        >
          <Package className="w-4 h-4" aria-hidden="true" />
          <span className="text-[11px] mt-0.5">3. Pedido</span>
        </button>
      </nav>

      {/* MODAL NATIVO <dialog>: Agendar Visita ou Criar Cliente Rápido na Rua */}
      <dialog
        ref={visitDialogRef}
        className="rounded-2xl p-0 w-full max-w-xs shadow-2xl border border-stone-200 m-auto"
      >
        <form onSubmit={handleSaveNewVisit} className="p-5 space-y-3 bg-white">
          <h2 className="font-extrabold text-stone-900 text-sm">
            Agendar Visita / Novo Cliente na Rua
          </h2>
          <p className="text-[11px] text-stone-500">
            Cadastre rápido mesmo sem todos os dados fiscais; o Gabriel completa via BrasilAPI no escritório.
          </p>
          <div>
            <label className="text-[11px] text-stone-600 font-semibold block mb-1">
              Nome da Padaria / Cliente *
            </label>
            <input
              type="text"
              required
              value={visitClientName}
              onChange={(e) => setVisitClientName(e.target.value)}
              placeholder="Ex: Padaria Pão de Ouro Grajaú"
              className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs"
            />
          </div>
          <div>
            <label className="text-[11px] text-stone-600 font-semibold block mb-1">
              CNPJ (Opcional agora — ou informe p/ BrasilAPI)
            </label>
            <input
              type="text"
              value={visitCnpj}
              onChange={(e) => setVisitCnpj(e.target.value)}
              placeholder="Ex: 48.936.777/0001-99"
              className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-stone-600 font-semibold block mb-1">Horário</label>
              <input
                type="time"
                value={visitTime}
                onChange={(e) => setVisitTime(e.target.value)}
                className="w-full border border-stone-300 rounded-xl px-2 py-2 text-xs"
              />
            </div>
            <div>
              <label className="text-[11px] text-stone-600 font-semibold block mb-1">
                Bairro / Região
              </label>
              <input
                type="text"
                value={visitRegion}
                onChange={(e) => setVisitRegion(e.target.value)}
                placeholder="Ex: Interlagos"
                className="w-full border border-stone-300 rounded-xl px-2 py-2 text-xs"
              />
            </div>
          </div>
          <div>
            <label className="text-[11px] text-stone-600 font-semibold block mb-1">
              Lembrete para a Visita
            </label>
            <input
              type="text"
              value={visitNote}
              onChange={(e) => setVisitNote(e.target.value)}
              placeholder="Ex: Levar amostra Pré-Mistura Pão Doce"
              className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={closeVisitModal}
              className="flex-1 bg-stone-100 text-stone-700 text-xs font-bold py-2.5 rounded-xl cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={`flex-1 ${theme.primaryBtn} text-xs font-bold py-2.5 rounded-xl cursor-pointer`}
            >
              Salvar na Agenda
            </button>
          </div>
        </form>
      </dialog>

      {/* MODAL NATIVO <dialog>: Feedback de Pedido Enviado para AGUARDANDO_REVISAO */}
      <dialog
        ref={successDialogRef}
        className="rounded-2xl p-0 w-full max-w-xs shadow-2xl border border-stone-200 m-auto"
      >
        <div className="p-6 text-center space-y-3 bg-white">
          <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-7 h-7" aria-hidden="true" />
          </div>
          <h2 className="font-extrabold text-stone-900 text-base">
            Pedido #{lastSubmittedSummary?.orderId} Enviado!
          </h2>
          <p className="text-xs text-stone-600 font-medium">
            {lastSubmittedSummary?.clientName} • Total: {lastSubmittedSummary?.totalText}
          </p>
          <div className="bg-stone-50 p-3 rounded-xl border border-stone-200 text-left text-[11px] text-stone-600 space-y-1.5">
            <div>
              ✅ <strong>Estoque Reservado</strong> imediatamente
            </div>
            <div>
              ✅ Status: <strong>AGUARDANDO_REVISAO</strong> (Mesa do Gabriel)
            </div>
            <div>
              ✅ <strong>Snapshot de Lucro/CMV</strong> congelado com sucesso
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              successDialogRef.current?.close();
              setActiveScreen(1);
            }}
            className={`w-full ${theme.primaryBtn} text-xs font-bold py-2.5 rounded-xl mt-2 cursor-pointer`}
          >
            Voltar para a Agenda
          </button>
        </div>
      </dialog>
    </div>
  );
};
