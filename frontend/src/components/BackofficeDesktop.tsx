import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Boxes,
  Calculator,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Download,
  FileCheck2,
  FileText,
  Printer,
  RefreshCw,
  Save,
  Ship,
  Sparkles,
  Truck,
  XCircle
} from 'lucide-react';
import { api, formatBRL } from '../api';
import { DesignTheme } from '../themes';
import {
  BackofficeOrder,
  ImportBatch,
  ProductStock,
  Romaneio,
  TopbarSummary
} from '../types';

interface BackofficeDesktopProps {
  theme: DesignTheme;
  topbarData: TopbarSummary | null;
  refreshTrigger: number;
  onDataMutated: () => Promise<void>;
}

export const BackofficeDesktop: React.FC<BackofficeDesktopProps> = ({
  theme,
  topbarData,
  refreshTrigger,
  onDataMutated
}) => {
  const [activeDesktopTab, setActiveDesktopTab] = useState<'mesa-pre-nota' | 'estoque-importacao'>(
    'mesa-pre-nota'
  );
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [orders, setOrders] = useState<BackofficeOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<BackofficeOrder | null>(null);
  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [loadingAction, setLoadingAction] = useState(false);

  // Editable state for Selected Order in Mesa de Conferência (Tela 4)
  const [editPaymentTerms, setEditPaymentTerms] = useState('');
  const [editDeliveryForecast, setEditDeliveryForecast] = useState('');
  const [editInvoiceNotes, setEditInvoiceNotes] = useState('');
  const [editAdjustmentNotes, setEditAdjustmentNotes] = useState('');
  const [editShippingCost, setEditShippingCost] = useState('45.00');
  const [editCorporateName, setEditCorporateName] = useState('');
  const [editCnpj, setEditCnpj] = useState('');
  const [editIe, setEditIe] = useState('');
  const [editZipCode, setEditZipCode] = useState('');
  const [editStreet, setEditStreet] = useState('');
  const [editNumber, setEditNumber] = useState('');
  const [editNeighborhood, setEditNeighborhood] = useState('');
  const [editCity, setEditCity] = useState('São Paulo');
  const [editState, setEditState] = useState('SP');
  const [editIbge, setEditIbge] = useState('');
  const [editItemQuantities, setEditItemQuantities] = useState<Record<number, number>>({});
  const [editItemPrices, setEditItemPrices] = useState<Record<number, string>>({});

  // Romaneio modal
  const romaneioDialogRef = useRef<HTMLDialogElement | null>(null);
  const [currentRomaneio, setCurrentRomaneio] = useState<Romaneio | null>(null);
  const [copiedWhatsapp, setCopiedWhatsapp] = useState(false);

  // Import Batches state (Tela 5)
  const [importBatches, setImportBatches] = useState<ImportBatch[]>([]);
  const [batchCode, setBatchCode] = useState('IMP-2026-10-ARG2');
  const [supplierName, setSupplierName] = useState('Molinos Cañuelas (Argentina)');
  const [exchangeRateUsd, setExchangeRateUsd] = useState('5.22');
  const [internationalFreightBrl, setInternationalFreightBrl] = useState('15200.00');
  const [importTaxesBrl, setImportTaxesBrl] = useState('21400.00');
  const [customsExpensesBrl, setCustomsExpensesBrl] = useState('7100.00');
  const [batchNotes, setBatchNotes] = useState(
    'Novo lote Outubro — entrada física no galpão e atualização de Landed Cost'
  );
  const [batchItemQty, setBatchItemQty] = useState<Record<number, number>>({
    1: 1000,
    2: 800,
    3: 200
  });
  const [batchItemFobUsd, setBatchItemFobUsd] = useState<Record<number, string>>({
    1: '8.30',
    2: '7.60',
    3: '9.40'
  });

  const loadOrders = async (preserveSelectedId?: number) => {
    try {
      const list = await api.getBackofficeOrders(statusFilter);
      setOrders(list);
      const targetId = preserveSelectedId ?? selectedOrder?.id;
      const found = list.find((o) => o.id === targetId) || list[0] || null;
      selectOrderForReview(found);
    } catch (err: any) {
      setFeedbackBanner({ type: 'error', text: err.message });
    }
  };

  const loadImportBatches = async () => {
    try {
      const list = await api.getImportBatches();
      setImportBatches(list);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadOrders();
    loadImportBatches();
  }, [statusFilter, refreshTrigger]);

  const selectOrderForReview = (order: BackofficeOrder | null) => {
    setSelectedOrder(order);
    if (!order) return;
    setEditPaymentTerms(order.paymentTerms || 'Boleto 28 dias');
    setEditDeliveryForecast(order.deliveryForecast || 'Amanhã (Manhã)');
    setEditInvoiceNotes(order.notesForInvoiceOrDriver || '');
    setEditAdjustmentNotes(order.backofficeAdjustmentNotes || '');
    setEditShippingCost((order.shippingCostEstimate ?? 45).toFixed(2));
    setEditCorporateName(order.clientCorporateName || '');
    setEditCnpj(order.clientCnpj || '');
    setEditIe(order.clientStateRegistration || '');
    setEditZipCode(order.clientZipCode || '');
    setEditStreet(order.clientStreet || '');
    setEditNumber(order.clientNumber || '');
    setEditNeighborhood(order.clientNeighborhood || '');
    setEditCity(order.clientCity || 'São Paulo');
    setEditState(order.clientState || 'SP');
    setEditIbge(order.clientIbgeCityCode || '');

    const qMap: Record<number, number> = {};
    const pMap: Record<number, string> = {};
    order.items.forEach((i) => {
      qMap[i.productId] = i.quantity;
      pMap[i.productId] = i.unitSalePrice.toFixed(2);
    });
    setEditItemQuantities(qMap);
    setEditItemPrices(pMap);
  };

  const handleLookupBrasilApi = async () => {
    if (!editCnpj.trim()) {
      setFeedbackBanner({
        type: 'error',
        text: 'Digite o CNPJ do cliente no campo CNPJ para consultar na BrasilAPI.'
      });
      return;
    }
    try {
      setLoadingAction(true);
      setFeedbackBanner(null);
      const data = await api.lookupCnpjBrasilApi(editCnpj);
      setEditCnpj(data.cnpj);
      setEditCorporateName(data.corporateName);
      setEditZipCode(data.zipCode);
      setEditStreet(data.street);
      setEditNumber(data.number);
      setEditNeighborhood(data.neighborhood);
      setEditCity(data.city);
      setEditState(data.state);
      setEditIbge(data.ibgeCityCode);
      if (!editIe) {
        setEditIe(data.stateRegistrationSuggestion);
      }
      setFeedbackBanner({
        type: 'success',
        text: `BrasilAPI: ${data.statusMessage} — Código IBGE ${data.ibgeCityCode} preenchido! Clique em "Salvar Revisão Pré-Nota" para validar.`
      });
    } catch (err: any) {
      setFeedbackBanner({ type: 'error', text: err.message });
    } finally {
      setLoadingAction(false);
    }
  };

  const handleSaveReview = async () => {
    if (!selectedOrder) return;
    try {
      setLoadingAction(true);
      setFeedbackBanner(null);
      const itemsPayload = selectedOrder.items.map((item) => ({
        productId: item.productId,
        quantity: Math.max(0, editItemQuantities[item.productId] ?? item.quantity),
        unitSalePrice: Math.max(
          0,
          parseFloat(editItemPrices[item.productId] ?? String(item.unitSalePrice)) || 0
        )
      }));

      const updated = await api.reviewPreNota(selectedOrder.id, {
        paymentTerms: editPaymentTerms,
        deliveryForecast: editDeliveryForecast,
        notesForInvoiceOrDriver: editInvoiceNotes,
        backofficeAdjustmentNotes: editAdjustmentNotes,
        shippingCostEstimate: parseFloat(editShippingCost) || 45.0,
        clientCorporateName: editCorporateName,
        clientCnpj: editCnpj,
        clientStateRegistration: editIe,
        clientIeIndicator: selectedOrder.clientIeIndicator,
        clientZipCode: editZipCode,
        clientStreet: editStreet,
        clientNumber: editNumber,
        clientNeighborhood: editNeighborhood,
        clientCity: editCity,
        clientState: editState,
        clientIbgeCityCode: editIbge,
        items: itemsPayload
      });

      await onDataMutated();
      await loadOrders(updated.id);
      setFeedbackBanner({
        type: 'success',
        text: `Pré-Nota do Pedido #${updated.id} revisada! Estoque reservado e prontidão fiscal atualizados.`
      });
    } catch (err: any) {
      setFeedbackBanner({ type: 'error', text: err.message });
    } finally {
      setLoadingAction(false);
    }
  };

  const handleGenerateRomaneio = async () => {
    if (!selectedOrder) return;
    try {
      setLoadingAction(true);
      setFeedbackBanner(null);
      const rom = await api.generateRomaneio(selectedOrder.id);
      setCurrentRomaneio(rom);
      romaneioDialogRef.current?.showModal();
      await onDataMutated();
      await loadOrders(selectedOrder.id);
    } catch (err: any) {
      setFeedbackBanner({ type: 'error', text: err.message });
    } finally {
      setLoadingAction(false);
    }
  };

  const handleIssueNfe = async () => {
    if (!selectedOrder) return;
    try {
      setLoadingAction(true);
      setFeedbackBanner(null);
      const issued = await api.issueNfe(selectedOrder.id);
      await onDataMutated();
      await loadOrders(issued.id);
      setFeedbackBanner({
        type: 'success',
        text: `NF-e #${issued.nfeNumber} AUTORIZADA pela SEFAZ! Chave: ${issued.nfeAccessKey}. Baixa física realizada e reserva liberada.`
      });
    } catch (err: any) {
      setFeedbackBanner({ type: 'error', text: err.message });
    } finally {
      setLoadingAction(false);
    }
  };

  const handleDeliverOrder = async () => {
    if (!selectedOrder) return;
    try {
      setLoadingAction(true);
      const delivered = await api.deliverOrder(selectedOrder.id);
      await onDataMutated();
      await loadOrders(delivered.id);
      setFeedbackBanner({
        type: 'success',
        text: `Pedido #${delivered.id} marcado como ENTREGUE pelos funcionários.`
      });
    } catch (err: any) {
      setFeedbackBanner({ type: 'error', text: err.message });
    } finally {
      setLoadingAction(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!selectedOrder) return;
    try {
      setLoadingAction(true);
      const canceled = await api.cancelOrder(selectedOrder.id);
      await onDataMutated();
      await loadOrders(canceled.id);
      setFeedbackBanner({
        type: 'success',
        text: `Pedido #${canceled.id} CANCELADO e estoque estornado automaticamente.`
      });
    } catch (err: any) {
      setFeedbackBanner({ type: 'error', text: err.message });
    } finally {
      setLoadingAction(false);
    }
  };

  const handleRegisterImportBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoadingAction(true);
      setFeedbackBanner(null);
      const products = topbarData?.products || [];
      const items = products.map((p) => ({
        productId: p.id,
        quantityImported: Math.max(0, batchItemQty[p.id] || 0),
        fobUnitUsd: Math.max(0, parseFloat(batchItemFobUsd[p.id] || '0') || 0)
      }));

      const created = await api.createImportBatch({
        batchCode,
        supplierName,
        exchangeRateUsd: parseFloat(exchangeRateUsd) || 5.2,
        internationalFreightBrl: parseFloat(internationalFreightBrl) || 0,
        importTaxesBrl: parseFloat(importTaxesBrl) || 0,
        customsExpensesBrl: parseFloat(customsExpensesBrl) || 0,
        notes: batchNotes,
        items
      });

      await onDataMutated();
      await loadImportBatches();
      setBatchCode(`IMP-2026-10-L${created.id + 1}`);
      setFeedbackBanner({
        type: 'success',
        text: `Lote de Importação ${created.batchCode} registrado! Estoque Físico e Landed Cost dos 3 SKUs atualizados em tempo real.`
      });
    } catch (err: any) {
      setFeedbackBanner({ type: 'error', text: err.message });
    } finally {
      setLoadingAction(false);
    }
  };

  const products: ProductStock[] = topbarData?.products || [];
  const isOrderEditable =
    selectedOrder &&
    (selectedOrder.status === 'AGUARDANDO_REVISAO' || selectedOrder.status === 'EM_SEPARACAO');

  // Cálculo ao vivo da Pré-Nota editada vs Pedido Original da Rua
  let previewFiscalTotal = 0;
  let previewCmv = 0;
  if (selectedOrder) {
    selectedOrder.items.forEach((item) => {
      const q = editItemQuantities[item.productId] ?? item.quantity;
      const p = parseFloat(editItemPrices[item.productId] ?? String(item.unitSalePrice)) || 0;
      previewFiscalTotal += q * p;
      previewCmv += q * item.unitCostSnapshot;
    });
  }
  const previewTax = previewFiscalTotal * 0.08;
  const previewShipping = parseFloat(editShippingCost || '0') || 0;
  const previewNetProfit = previewFiscalTotal - previewCmv - previewTax - previewShipping;

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto bg-white rounded-3xl shadow-xl border border-stone-200 overflow-hidden flex flex-col">
      {/* CABEÇALHO DO BACKOFFICE DESKTOP (GABRIEL) */}
      <header className={`${theme.topbarBg} px-6 py-4 flex flex-wrap justify-between items-center gap-4`}>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded bg-white/10 text-amber-300">
              Backoffice Fiscal &amp; Operações • Gabriel
            </span>
            <span className="text-xs opacity-75">
              TOTAL TRIGO COMERCIO DE ALIMENTOS LTDA (CNPJ 09.265.201/0001-95)
            </span>
          </div>
          <h1 className="text-xl font-extrabold mt-1">
            Mesa de Conferência Pré-Nota (NF-e) &amp; Controle de Importação
          </h1>
        </div>

        {/* Navegação entre Tela 4 e Tela 5 */}
        <div className="flex bg-black/25 p-1 rounded-2xl border border-white/10 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveDesktopTab('mesa-pre-nota')}
            className={`px-4 py-2.5 rounded-xl flex items-center gap-2 transition cursor-pointer ${
              activeDesktopTab === 'mesa-pre-nota'
                ? 'bg-amber-500 text-stone-950 shadow-sm'
                : 'text-white/80 hover:text-white'
            }`}
          >
            <ClipboardCheck className="w-4 h-4" aria-hidden="true" />
            Tela 4: Mesa Pré-Nota ({topbarData?.pendingNfeQueueCount ?? 0} pendentes)
          </button>
          <button
            type="button"
            onClick={() => setActiveDesktopTab('estoque-importacao')}
            className={`px-4 py-2.5 rounded-xl flex items-center gap-2 transition cursor-pointer ${
              activeDesktopTab === 'estoque-importacao'
                ? 'bg-amber-500 text-stone-950 shadow-sm'
                : 'text-white/80 hover:text-white'
            }`}
          >
            <Ship className="w-4 h-4" aria-hidden="true" />
            Tela 5: Estoque Triplo &amp; Lote Importação
          </button>
        </div>
      </header>

      {/* BARRA DE RESUMO DO ESTOQUE TRIPLO (Físico / Reservado / Disponível) */}
      <div className="bg-stone-50 border-b border-stone-200 px-6 py-3 grid grid-cols-1 md:grid-cols-3 gap-3">
        {products.map((p) => (
          <div
            key={p.id}
            className="bg-white rounded-xl p-3 border border-stone-200/90 flex justify-between items-center shadow-2xs"
          >
            <div>
              <span className="text-[10px] font-bold uppercase text-stone-400">
                {p.skuCode} • Custo Lote: {formatBRL(p.currentLandedCost)}
              </span>
              <h2 className="text-xs font-extrabold text-stone-900">{p.name}</h2>
            </div>
            <div className="flex items-center gap-3 text-right">
              <div>
                <span className="text-[10px] text-stone-400 block">Físico</span>
                <span className="text-xs font-bold text-stone-700">{p.physicalStock}</span>
              </div>
              <div>
                <span className="text-[10px] text-amber-600 font-semibold block">Reservado</span>
                <span className="text-xs font-extrabold text-amber-700">{p.reservedStock}</span>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                <span className="text-[10px] text-emerald-700 font-semibold block">Disponível</span>
                <span className="text-sm font-extrabold text-emerald-800">
                  {p.availableStock} {p.unitOfMeasure}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* FEEDBACK BANNER */}
      {feedbackBanner && (
        <div
          className={`px-6 py-3 text-xs font-semibold flex justify-between items-center ${
            feedbackBanner.type === 'success'
              ? 'bg-emerald-600 text-white'
              : 'bg-red-600 text-white'
          }`}
        >
          <span>
            {feedbackBanner.type === 'success' ? '✅ ' : '⚠️ '}
            {feedbackBanner.text}
          </span>
          <button
            type="button"
            onClick={() => setFeedbackBanner(null)}
            className="text-white/80 hover:text-white font-bold ml-4 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* ====================================================================
          TELA 4: MESA DE CONFERÊNCIA / FILA PRÉ-NOTA
          ==================================================================== */}
      {activeDesktopTab === 'mesa-pre-nota' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 min-h-[620px]">
          {/* Coluna Esquerda: Lista de Pedidos e Filtros da Máquina de Estados */}
          <aside className="lg:col-span-5 border-r border-stone-200 bg-stone-50/60 p-4 flex flex-col">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-sm font-extrabold text-stone-900">
                Fila de Pedidos ({orders.length})
              </h2>
              <button
                type="button"
                onClick={() => loadOrders()}
                className="text-xs text-stone-600 hover:text-stone-900 flex items-center gap-1 font-semibold cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" /> Atualizar
              </button>
            </div>

            {/* Filtro por Estado */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {[
                { key: 'ALL', label: 'Todos' },
                { key: 'AGUARDANDO_REVISAO', label: '⏳ Aguardando Revisão' },
                { key: 'EM_SEPARACAO', label: '📦 Em Separação' },
                { key: 'FATURADO', label: '✅ Faturados (NF-e)' }
              ].map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setStatusFilter(f.key)}
                  className={`text-[11px] font-bold px-2.5 py-1.5 rounded-lg border transition cursor-pointer ${
                    statusFilter === f.key
                      ? 'bg-stone-900 text-white border-stone-900'
                      : 'bg-white text-stone-600 border-stone-200 hover:border-stone-400'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Cards da Fila */}
            <div className="space-y-2.5 overflow-y-auto max-h-[540px] pr-1">
              {orders.map((o) => {
                const isSelected = selectedOrder?.id === o.id;
                return (
                  <div
                    key={o.id}
                    onClick={() => selectOrderForReview(o)}
                    className={`p-3.5 rounded-2xl border transition cursor-pointer ${
                      isSelected
                        ? 'bg-amber-50/70 border-amber-500 ring-2 ring-amber-500/20 shadow-sm'
                        : 'bg-white border-stone-200 hover:border-stone-400'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <span className="text-[10px] font-bold text-stone-400">
                          PEDIDO #{o.id} • {o.clientNeighborhood || 'SP'}
                        </span>
                        <h3 className="font-extrabold text-xs text-stone-900 mt-0.5">
                          {o.clientCorporateName}
                        </h3>
                      </div>
                      <span
                        className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border shrink-0 ${
                          o.status === 'AGUARDANDO_REVISAO'
                            ? 'bg-amber-100 text-amber-900 border-amber-300'
                            : o.status === 'EM_SEPARACAO'
                            ? 'bg-sky-100 text-sky-900 border-sky-300'
                            : o.status === 'FATURADO'
                            ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                            : o.status === 'ENTREGUE'
                            ? 'bg-stone-200 text-stone-800 border-stone-300'
                            : 'bg-red-100 text-red-800 border-red-300'
                        }`}
                      >
                        {o.status}
                      </span>
                    </div>

                    {/* Semáforo de Prontidão Fiscal */}
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {o.clientRegistrationComplete ? (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                          ✅ Pronto para NF-e
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-md">
                          ⚠️ Completar CNPJ antes de faturar
                        </span>
                      )}

                      {o.hasCommercialVsFiscalDifference && (
                        <span className="text-[10px] font-bold text-purple-800 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-md">
                          ⚖️ Nota ≠ Pedido Rua
                        </span>
                      )}

                      {o.nfeNumber && (
                        <span className="text-[10px] font-bold text-stone-700 bg-stone-100 px-2 py-0.5 rounded-md">
                          NF-e #{o.nfeNumber}
                        </span>
                      )}
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-stone-100 flex justify-between items-center text-xs">
                      <span className="text-stone-500 text-[11px]">
                        {o.items
                          .filter((i) => i.quantity > 0)
                          .map((i) => `${i.quantity}x ${i.shortName.replace(' (25kg)', '')}`)
                          .join(', ')}
                      </span>
                      <span className="font-extrabold text-stone-900">
                        {formatBRL(o.grossTotal)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>

          {/* Coluna Direita: Mesa de Conferência Detalhada do Pedido Selecionado */}
          <section className="lg:col-span-7 p-6 space-y-5 overflow-y-auto">
            {!selectedOrder ? (
              <div className="text-center py-20 text-stone-400">
                Selecione um pedido na fila à esquerda para revisar e emitir a NF-e.
              </div>
            ) : (
              <>
                {/* Topo da Mesa de Conferência */}
                <div className="flex flex-wrap justify-between items-start gap-4 pb-4 border-b border-stone-200">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold text-stone-400">
                        CONFERÊNCIA PRÉ-NOTA • PEDIDO #{selectedOrder.id}
                      </span>
                      <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-stone-900 text-white">
                        {selectedOrder.status}
                      </span>
                    </div>
                    <h2 className="text-lg font-extrabold text-stone-900 mt-1">
                      {selectedOrder.clientCorporateName}
                    </h2>
                    {selectedOrder.notesForInvoiceOrDriver && (
                      <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl mt-2">
                        📌 <strong>Recado da Rua (Pai):</strong> &ldquo;
                        {selectedOrder.notesForInvoiceOrDriver}&rdquo;
                      </p>
                    )}
                  </div>

                  {/* Ações de Download de XML quando já faturado */}
                  {selectedOrder.status === 'FATURADO' || selectedOrder.status === 'ENTREGUE' ? (
                    <div className="flex flex-wrap gap-2">
                      <a
                        href={`/api/backoffice/orders/${selectedOrder.id}/xml`}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5" aria-hidden="true" /> Baixar XML NF-e #{selectedOrder.nfeNumber}
                      </a>
                      {selectedOrder.status === 'FATURADO' && (
                        <button
                          type="button"
                          onClick={handleDeliverOrder}
                          className="bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer"
                        >
                          <Truck className="w-3.5 h-3.5" aria-hidden="true" /> Confirmar Entrega
                        </button>
                      )}
                    </div>
                  ) : null}
                </div>

                {/* BLOCO 1: SEMÁFORO DE PRONTIDÃO FISCAL & CONSULTA BRASILAPI EM 1 CLIQUE */}
                <div
                  className={`p-4 rounded-2xl border ${
                    selectedOrder.clientRegistrationComplete
                      ? 'bg-emerald-50/50 border-emerald-200'
                      : 'bg-amber-50/80 border-amber-300'
                  }`}
                >
                  <div className="flex flex-wrap justify-between items-center gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      {selectedOrder.clientRegistrationComplete ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" aria-hidden="true" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-amber-600" aria-hidden="true" />
                      )}
                      <div>
                        <h3 className="text-xs font-extrabold uppercase tracking-wider text-stone-800">
                          1. Semáforo de Prontidão Fiscal (SEFAZ / Padrão NFe 4.00)
                        </h3>
                        <p className="text-[11px] text-stone-600">
                          {selectedOrder.clientRegistrationComplete
                            ? 'Cliente com CNPJ, IE, Endereço e Código IBGE (7 dígitos) validados para emissão.'
                            : 'Cadastro rápido feito na rua pelo pai! Puxe os dados na BrasilAPI antes de emitir a NF-e.'}
                        </p>
                      </div>
                    </div>

                    {isOrderEditable && (
                      <button
                        type="button"
                        onClick={handleLookupBrasilApi}
                        disabled={loadingAction}
                        className="bg-stone-900 hover:bg-stone-800 text-amber-300 text-xs font-extrabold px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer transition"
                      >
                        <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                        Buscar CNPJ na BrasilAPI (1 Clique)
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                    <div>
                      <label className="text-[10px] font-bold text-stone-500 block">
                        CNPJ / CPF Destinatário
                      </label>
                      <input
                        type="text"
                        disabled={!isOrderEditable}
                        value={editCnpj}
                        onChange={(e) => setEditCnpj(e.target.value)}
                        placeholder="Ex: 48.936.777/0001-99"
                        className="w-full bg-white border border-stone-300 rounded-lg px-2.5 py-1.5 font-semibold"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-stone-500 block">
                        Inscrição Estadual (IE)
                      </label>
                      <input
                        type="text"
                        disabled={!isOrderEditable}
                        value={editIe}
                        onChange={(e) => setEditIe(e.target.value)}
                        placeholder="Ex: 109950642118"
                        className="w-full bg-white border border-stone-300 rounded-lg px-2.5 py-1.5 font-semibold"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-stone-500 block">
                        Código Município IBGE (7 díg.)
                      </label>
                      <input
                        type="text"
                        disabled={!isOrderEditable}
                        value={editIbge}
                        onChange={(e) => setEditIbge(e.target.value)}
                        placeholder="3550308 (São Paulo)"
                        className="w-full bg-white border border-stone-300 rounded-lg px-2.5 py-1.5 font-semibold"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-[10px] font-bold text-stone-500 block">
                        Razão Social SEFAZ
                      </label>
                      <input
                        type="text"
                        disabled={!isOrderEditable}
                        value={editCorporateName}
                        onChange={(e) => setEditCorporateName(e.target.value)}
                        className="w-full bg-white border border-stone-300 rounded-lg px-2.5 py-1.5 font-semibold"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-stone-500 block">CEP</label>
                      <input
                        type="text"
                        disabled={!isOrderEditable}
                        value={editZipCode}
                        onChange={(e) => setEditZipCode(e.target.value)}
                        className="w-full bg-white border border-stone-300 rounded-lg px-2.5 py-1.5 font-semibold"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-[10px] font-bold text-stone-500 block">
                        Logradouro &amp; Número
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          disabled={!isOrderEditable}
                          value={editStreet}
                          onChange={(e) => setEditStreet(e.target.value)}
                          className="flex-1 bg-white border border-stone-300 rounded-lg px-2.5 py-1.5 font-semibold"
                        />
                        <input
                          type="text"
                          disabled={!isOrderEditable}
                          value={editNumber}
                          onChange={(e) => setEditNumber(e.target.value)}
                          className="w-20 bg-white border border-stone-300 rounded-lg px-2.5 py-1.5 font-semibold"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-stone-500 block">Bairro</label>
                      <input
                        type="text"
                        disabled={!isOrderEditable}
                        value={editNeighborhood}
                        onChange={(e) => setEditNeighborhood(e.target.value)}
                        className="w-full bg-white border border-stone-300 rounded-lg px-2.5 py-1.5 font-semibold"
                      />
                    </div>
                  </div>
                </div>

                {/* BLOCO 2: CONFERÊNCIA E AJUSTE DE QUANTIDADES/VALORES (PEDIDO RUA vs. NOTA FISCAL) */}
                <div className="bg-white rounded-2xl border border-stone-200 p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-xs font-extrabold uppercase tracking-wider text-stone-800">
                        2. Ajuste de Itens: Pedido Comercial (Rua) vs. Emissão NF-e
                      </h3>
                      <p className="text-[11px] text-stone-500">
                        Altere a Qtd NF-e ou Preço NF-e caso o valor/volume faturado na nota seja diferente do pedido fechado na rua.
                      </p>
                    </div>
                    <span className="text-xs font-bold text-stone-500">
                      Original Rua: <strong>{formatBRL(selectedOrder.originalCommercialTotal)}</strong>
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-stone-200 text-stone-400 text-[10px] uppercase text-left">
                          <th className="py-2">Produto / NCM / CFOP</th>
                          <th className="py-2 text-center">Vendido Rua</th>
                          <th className="py-2 text-center">Qtd p/ NF-e</th>
                          <th className="py-2 text-right">Preço p/ NF-e (R$)</th>
                          <th className="py-2 text-right">Subtotal NF-e</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {selectedOrder.items.map((item) => {
                          const editedQty = editItemQuantities[item.productId] ?? item.quantity;
                          const editedPriceStr =
                            editItemPrices[item.productId] ?? item.unitSalePrice.toFixed(2);
                          const editedPrice = parseFloat(editedPriceStr) || 0;
                          const sub = editedQty * editedPrice;
                          const isChanged =
                            editedQty !== item.orderedQuantity ||
                            Math.abs(editedPrice - item.orderedUnitPrice) > 0.009;

                          return (
                            <tr key={item.id} className={isChanged ? 'bg-purple-50/40' : ''}>
                              <td className="py-2.5 pr-2">
                                <div className="font-bold text-stone-900">{item.productName}</div>
                                <div className="text-[10px] text-stone-400">
                                  Cód: {item.erpCode} • NCM {item.ncm} • CFOP {item.cfop} • Custo Snapshot:{' '}
                                  {formatBRL(item.unitCostSnapshot)}
                                </div>
                              </td>
                              <td className="py-2.5 text-center text-stone-500">
                                <span className="font-semibold">{item.orderedQuantity} SA</span>
                                <span className="block text-[10px]">
                                  a {formatBRL(item.orderedUnitPrice)}
                                </span>
                              </td>
                              <td className="py-2.5 text-center">
                                <input
                                  type="number"
                                  min={0}
                                  disabled={!isOrderEditable}
                                  value={editedQty}
                                  onChange={(e) =>
                                    setEditItemQuantities((prev) => ({
                                      ...prev,
                                      [item.productId]: Math.max(
                                        0,
                                        parseInt(e.target.value, 10) || 0
                                      )
                                    }))
                                  }
                                  className="w-16 text-center font-extrabold border border-stone-300 rounded-lg py-1 bg-white"
                                />
                              </td>
                              <td className="py-2.5 text-right">
                                <input
                                  type="number"
                                  step="0.50"
                                  disabled={!isOrderEditable}
                                  value={editedPriceStr}
                                  onChange={(e) =>
                                    setEditItemPrices((prev) => ({
                                      ...prev,
                                      [item.productId]: e.target.value
                                    }))
                                  }
                                  className="w-24 text-right font-extrabold border border-stone-300 rounded-lg py-1 px-2 bg-white"
                                />
                              </td>
                              <td className="py-2.5 text-right font-extrabold text-stone-900">
                                {formatBRL(sub)}
                                {isChanged && (
                                  <span className="block text-[10px] text-purple-700 font-semibold">
                                    Ajustado p/ NF-e
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Condições Fiscais & Justificativa de Ajuste */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-stone-100 text-xs">
                    <div>
                      <label className="text-[10px] font-bold text-stone-500 block mb-1">
                        Condição de Pagamento NF-e
                      </label>
                      <input
                        type="text"
                        disabled={!isOrderEditable}
                        value={editPaymentTerms}
                        onChange={(e) => setEditPaymentTerms(e.target.value)}
                        className="w-full border border-stone-300 rounded-lg px-2.5 py-1.5 font-semibold"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-stone-500 block mb-1">
                        Previsão de Entrega (Romaneio)
                      </label>
                      <input
                        type="text"
                        disabled={!isOrderEditable}
                        value={editDeliveryForecast}
                        onChange={(e) => setEditDeliveryForecast(e.target.value)}
                        className="w-full border border-stone-300 rounded-lg px-2.5 py-1.5 font-semibold"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-stone-500 block mb-1">
                        Nota Interna Backoffice (Diferença Rua x NF)
                      </label>
                      <input
                        type="text"
                        disabled={!isOrderEditable}
                        value={editAdjustmentNotes}
                        onChange={(e) => setEditAdjustmentNotes(e.target.value)}
                        placeholder="Ex: Emitido 50% na NF conforme combinado..."
                        className="w-full border border-stone-300 rounded-lg px-2.5 py-1.5"
                      />
                    </div>
                  </div>
                </div>

                {/* RESUMO FINANCEIRO DA PRÉ-NOTA E BOTÕES DE AÇÃO DA MESA DE CONFERÊNCIA */}
                <div className="bg-stone-900 text-white p-4 rounded-2xl flex flex-wrap justify-between items-center gap-4">
                  <div className="flex flex-wrap gap-6 text-xs">
                    <div>
                      <span className="text-stone-400 block text-[10px]">Pedido Rua Original</span>
                      <span className="font-bold text-sm">
                        {formatBRL(selectedOrder.originalCommercialTotal)}
                      </span>
                    </div>
                    <div>
                      <span className="text-amber-400 block text-[10px] font-bold">
                        Total para Emissão NF-e
                      </span>
                      <span className="font-extrabold text-lg text-amber-300">
                        {formatBRL(previewFiscalTotal)}
                      </span>
                    </div>
                    <div>
                      <span className="text-stone-400 block text-[10px]">
                        CMV Snapshot / Imposto Est.
                      </span>
                      <span className="font-semibold">
                        {formatBRL(previewCmv)} / {formatBRL(previewTax)}
                      </span>
                    </div>
                    <div>
                      <span className="text-stone-400 block text-[10px]">Lucro Líquido Real</span>
                      <span className="font-extrabold text-sm text-emerald-400">
                        {formatBRL(previewNetProfit)}
                      </span>
                    </div>
                  </div>

                  {isOrderEditable && (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={loadingAction}
                        onClick={handleSaveReview}
                        className="bg-stone-700 hover:bg-stone-600 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 cursor-pointer transition"
                      >
                        <Save className="w-3.5 h-3.5" aria-hidden="true" />
                        Salvar Revisão
                      </button>

                      <button
                        type="button"
                        disabled={loadingAction}
                        onClick={handleGenerateRomaneio}
                        className="bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 cursor-pointer transition"
                      >
                        <FileText className="w-3.5 h-3.5" aria-hidden="true" />
                        Gerar Romaneio Separação
                      </button>

                      <button
                        type="button"
                        disabled={loadingAction}
                        onClick={handleIssueNfe}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold px-4 py-2.5 rounded-xl flex items-center gap-1.5 shadow-md cursor-pointer transition"
                      >
                        <FileCheck2 className="w-4 h-4" aria-hidden="true" />
                        Emitir NF-e (SEFAZ)
                      </button>

                      <button
                        type="button"
                        disabled={loadingAction}
                        onClick={handleCancelOrder}
                        className="bg-red-950/70 hover:bg-red-900 text-red-200 text-xs font-semibold px-3 py-2.5 rounded-xl flex items-center gap-1 cursor-pointer transition"
                      >
                        <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      )}

      {/* ====================================================================
          TELA 5: GESTÃO DE ESTOQUE & ENTRADA DE LOTE DE IMPORTAÇÃO (LANDED COST)
          ==================================================================== */}
      {activeDesktopTab === 'estoque-importacao' && (
        <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Calculadora de Landed Cost de Novo Lote */}
          <form
            onSubmit={handleRegisterImportBatch}
            className="lg:col-span-7 bg-stone-50 p-5 rounded-2xl border border-stone-200 space-y-4"
          >
            <div className="flex justify-between items-center">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                  Tela 5 • Calculadora de Landed Cost
                </span>
                <h2 className="text-base font-extrabold text-stone-900 mt-1">
                  Registrar Chegada de Lote de Importação (3 SKUs)
                </h2>
                <p className="text-xs text-stone-500">
                  Rateia automaticamente Câmbio USD, Frete Internacional, Impostos (II/IPI/PIS/COFINS/ICMS) e Despachante, somando ao Estoque Físico e atualizando o Custo Unitário Internalizado.
                </p>
              </div>
              <Calculator className="w-7 h-7 text-amber-600 shrink-0" aria-hidden="true" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="text-[11px] font-bold text-stone-600 block mb-1">
                  Código do Lote / DI
                </label>
                <input
                  type="text"
                  required
                  value={batchCode}
                  onChange={(e) => setBatchCode(e.target.value)}
                  className="w-full bg-white border border-stone-300 rounded-xl px-3 py-2 font-bold"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-stone-600 block mb-1">
                  Moinho / Exportador
                </label>
                <input
                  type="text"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  className="w-full bg-white border border-stone-300 rounded-xl px-3 py-2 font-semibold"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-stone-600 block mb-1">
                  Taxa Dólar Fechada (R$/USD)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={exchangeRateUsd}
                  onChange={(e) => setExchangeRateUsd(e.target.value)}
                  className="w-full bg-white border border-stone-300 rounded-xl px-3 py-2 font-extrabold text-amber-800"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-stone-600 block mb-1">
                  Frete Internacional (R$)
                </label>
                <input
                  type="number"
                  step="100"
                  required
                  value={internationalFreightBrl}
                  onChange={(e) => setInternationalFreightBrl(e.target.value)}
                  className="w-full bg-white border border-stone-300 rounded-xl px-3 py-2 font-semibold"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-stone-600 block mb-1">
                  Impostos Importação (R$)
                </label>
                <input
                  type="number"
                  step="100"
                  required
                  value={importTaxesBrl}
                  onChange={(e) => setImportTaxesBrl(e.target.value)}
                  className="w-full bg-white border border-stone-300 rounded-xl px-3 py-2 font-semibold"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-stone-600 block mb-1">
                  Despachante / Armazenagem (R$)
                </label>
                <input
                  type="number"
                  step="50"
                  required
                  value={customsExpensesBrl}
                  onChange={(e) => setCustomsExpensesBrl(e.target.value)}
                  className="w-full bg-white border border-stone-300 rounded-xl px-3 py-2 font-semibold"
                />
              </div>
            </div>

            {/* Tabela de Rateio dos 3 SKUs */}
            <div className="bg-white rounded-xl border border-stone-200 p-3">
              <h3 className="text-[11px] font-extrabold uppercase text-stone-500 mb-2">
                Quantidades Importadas e Custo FOB (USD) por Saco 25kg
              </h3>
              <div className="space-y-2">
                {products.map((p) => (
                  <div
                    key={p.id}
                    className="grid grid-cols-12 items-center gap-2 text-xs py-1.5 border-b last:border-b-0 border-stone-100"
                  >
                    <div className="col-span-5">
                      <span className="font-bold text-stone-900 block">{p.name}</span>
                      <span className="text-[10px] text-stone-400">
                        Estoque Físico Atual: {p.physicalStock} SA • Custo Atual:{' '}
                        {formatBRL(p.currentLandedCost)}
                      </span>
                    </div>
                    <div className="col-span-3">
                      <label className="text-[10px] text-stone-400 block">Qtd Importada (SA)</label>
                      <input
                        type="number"
                        min={0}
                        value={batchItemQty[p.id] ?? 0}
                        onChange={(e) =>
                          setBatchItemQty((prev) => ({
                            ...prev,
                            [p.id]: Math.max(0, parseInt(e.target.value, 10) || 0)
                          }))
                        }
                        className="w-full border border-stone-300 rounded-lg px-2 py-1 font-extrabold"
                      />
                    </div>
                    <div className="col-span-4">
                      <label className="text-[10px] text-stone-400 block">FOB Unitário (USD)</label>
                      <input
                        type="number"
                        step="0.10"
                        value={batchItemFobUsd[p.id] ?? '8.00'}
                        onChange={(e) =>
                          setBatchItemFobUsd((prev) => ({
                            ...prev,
                            [p.id]: e.target.value
                          }))
                        }
                        className="w-full border border-stone-300 rounded-lg px-2 py-1 font-extrabold"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={loadingAction}
              className={`w-full ${theme.primaryBtn} font-extrabold py-3 rounded-xl text-xs shadow-md cursor-pointer transition`}
            >
              Confirmar Entrada do Lote → Somar ao Estoque Físico e Atualizar Landed Cost
            </button>
          </form>

          {/* Histórico de Lotes de Importação */}
          <div className="lg:col-span-5 space-y-3">
            <h2 className="text-sm font-extrabold text-stone-900 flex items-center gap-2">
              <Boxes className="w-4 h-4 text-amber-600" aria-hidden="true" />
              Histórico de Lotes Internalizados ({importBatches.length})
            </h2>
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
              {importBatches.map((b) => (
                <div
                  key={b.id}
                  className="bg-white p-4 rounded-2xl border border-stone-200 shadow-2xs space-y-2 text-xs"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-extrabold text-stone-900 text-sm">{b.batchCode}</span>
                      <p className="text-[11px] text-stone-500">
                        {b.supplierName} • Chegada: {b.arrivalDate}
                      </p>
                    </div>
                    <span className="bg-amber-50 text-amber-900 border border-amber-200 font-bold px-2 py-0.5 rounded text-[11px]">
                      Câmbio: R$ {b.exchangeRateUsd}
                    </span>
                  </div>
                  <div className="text-[11px] text-stone-600 bg-stone-50 p-2.5 rounded-xl border border-stone-100 space-y-1">
                    {b.items.map((bi) => (
                      <div key={bi.id} className="flex justify-between">
                        <span>
                          +{bi.quantityImported} SA de <strong>{bi.product.shortName}</strong> (FOB USD{' '}
                          {bi.fobUnitUsd})
                        </span>
                        <span className="font-extrabold text-emerald-700">
                          Landed: {formatBRL(bi.calculatedUnitCostBrl)}/un
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between items-center pt-1 text-[11px] text-stone-500">
                    <span>
                      Frete+Imp+Desp:{' '}
                      {formatBRL(
                        b.internationalFreightBrl + b.importTaxesBrl + b.customsExpensesBrl
                      )}
                    </span>
                    <span className="font-extrabold text-stone-900">
                      Custo Total Lote: {formatBRL(b.totalLandedCostBrl)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL NATIVO <dialog>: Romaneio de Separação Cego (Sem Preços/Lucros) */}
      <dialog
        ref={romaneioDialogRef}
        className="rounded-2xl p-0 w-full max-w-lg shadow-2xl border border-stone-200 m-auto"
      >
        {currentRomaneio && (
          <div className="p-6 bg-white space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider bg-sky-100 text-sky-800 px-2 py-0.5 rounded">
                  Romaneio Cego • Galpão &amp; Motorista (Zero Preços/Margens)
                </span>
                <h2 className="text-base font-extrabold text-stone-900 mt-1">
                  Ordem de Separação — Pedido #{currentRomaneio.orderId}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => romaneioDialogRef.current?.close()}
                className="text-stone-400 hover:text-stone-700 font-bold"
              >
                ✕
              </button>
            </div>

            <pre
              tabIndex={0}
              className="bg-stone-900 text-stone-100 p-4 rounded-xl text-xs whitespace-pre-wrap font-mono leading-relaxed overflow-x-auto"
            >
              <code>{currentRomaneio.whatsappFormattedText}</code>
            </pre>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(currentRomaneio.whatsappFormattedText);
                  setCopiedWhatsapp(true);
                  setTimeout(() => setCopiedWhatsapp(false), 2500);
                }}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold py-2.5 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Copy className="w-4 h-4" aria-hidden="true" />
                {copiedWhatsapp
                  ? '✓ Copiado! Cole no WhatsApp dos Funcionários'
                  : 'Copiar Texto p/ WhatsApp dos Funcionários'}
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4" aria-hidden="true" /> Imprimir
              </button>
            </div>
          </div>
        )}
      </dialog>
    </div>
  );
};
