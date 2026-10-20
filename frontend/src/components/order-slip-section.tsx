import { useState, useEffect } from 'react';
import {
  FileText,
  Printer,
  Share2,
  Copy,
  Check,
  RotateCcw,
  Plus,
  Trash2,
  Search,
  PenLine,
  Calculator,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  type AppData,
  type Order,
  type Client,
  itemDq,
  money,
} from '@/lib/business';
import {
  openPrintableOrderSlip,
  buildWhatsAppOrderShareUrl,
  type OrderSlipCustomData,
} from '@/lib/documentPrint';

interface OrderSlipSectionProps {
  data: AppData;
  userProfile?: string | undefined;
  initialOrderId?: string | undefined;
}

interface SlipRow {
  id: string;
  qty: string;
  desc: string;
  unid: string;
  total: string;
  isInstallment?: boolean;
  isNote?: boolean;
}

export function OrderSlipSection({
  data,
  userProfile,
  initialOrderId,
}: OrderSlipSectionProps) {
  const defaultOrderId =
    initialOrderId ||
    data.orders[0]?.id ||
    '1054';

  const [selectedOrderId, setSelectedOrderId] = useState<string>(defaultOrderId);
  const [copied, setCopied] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const currentOrder: Order | undefined =
    data.orders.find(o => o.id === selectedOrderId) ?? data.orders[0];

  const currentClient: Client | undefined = currentOrder
    ? data.clients.find(c => c.id === currentOrder.clientId)
    : undefined;

  // Estado editável do talão diretamente na tela
  const [slipData, setSlipData] = useState<OrderSlipCustomData>(() =>
    buildInitialSlipData(currentOrder, currentClient, data, userProfile)
  );

  // Recarrega os dados quando o pedido selecionado mudar
  useEffect(() => {
    if (currentOrder) {
      setSlipData(buildInitialSlipData(currentOrder, currentClient, data, userProfile));
    }
  }, [selectedOrderId]);

  function buildInitialSlipData(
    order?: Order,
    client?: Client,
    appData?: AppData,
    profile?: string
  ): OrderSlipCustomData {
    if (!order) {
      return {
        orderId: '—',
        vendorName: 'Sérgio Soares',
        orderDate: new Date().toLocaleDateString('pt-BR'),
        clientName: '',
        clientRef: '',
        clientAddress: '',
        clientCep: '',
        clientCity: 'São Paulo',
        clientState: 'SP',
        clientPhone: '',
        clientCnpj: '',
        clientIe: '',
        clientEmail: '',
        rows: [],
        buyer: '',
        visto: '',
        totalValue: 'R$ 0,00',
      };
    }

    const initialVendor =
      profile?.includes('Sérgio') ? 'Sérgio Soares' :
      profile?.includes('Gabriel') ? 'Gabriel Furtado' : 'Sérgio Soares';

    const clientName = client?.name ?? `Cliente #${order.clientId}`;
    const clientAddress = client?.neighborhood
      ? `${client.neighborhood}, São Paulo - SP`
      : 'São Paulo - SP';
    const clientRef = client?.id ?? order.clientId;
    const clientCep = client?.ibge ? `04${client.ibge.slice(2)}-000` : '04840-000';
    const clientPhone = '(11) 98765-4321';
    const clientCnpj = client?.cnpj || '—';
    const clientIe = client?.ie || 'ISENTO';
    const clientEmail = client?.name
      ? `contato@${client.name.toLowerCase().replace(/[^a-z0-9]/g, '') || 'padaria'}.com.br`
      : 'contato@padaria.com.br';
    const orderDate = order.date || new Date().toLocaleDateString('pt-BR');
    const buyer = client?.buyer ?? 'Comprador';

    let grandTotal = 0;
    const rows: SlipRow[] = [];

    // 1. Produtos
    order.items.forEach((item, idx) => {
      const dq = itemDq(item);
      if (dq <= 0) return;
      const subtotal = dq * item.price;
      grandTotal += subtotal;

      const prod = appData?.products.find(p => p.id === item.productId);
      const pName = (prod?.name ?? `Produto #${item.productId}`)
        .replace(' (25kg)', '')
        .replace('Farinha Tipo 1', 'Farinha Trigo Tipo 1')
        .replace('Pré-Mistura Francês', 'Pré-Mistura')
        .replace('PM Pão Doce', 'Pão Doce');

      rows.push({
        id: `prod-${idx}-${Date.now()}`,
        qty: String(dq),
        desc: `${pName}  ${item.price.toFixed(2).replace('.', ',')}`,
        unid: 'SA',
        total: subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      });
    });

    // 2. Boletos / Parcelas
    if (order.dueDates && order.dueDates.length > 0) {
      const installmentVal = grandTotal / order.dueDates.length;
      order.dueDates.forEach((dStr, idx) => {
        const parts = dStr.split('-');
        const formatted = parts.length === 3 ? `${parts[2]}/${parts[1]}` : dStr;
        rows.push({
          id: `due-${idx}-${Date.now()}`,
          qty: '',
          desc: `${formatted}  -  ${installmentVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          unid: '',
          total: '',
          isInstallment: true,
        });
      });
    } else if (order.firstDueDate) {
      const parts = order.firstDueDate.split('-');
      const formatted = parts.length === 3 ? `${parts[2]}/${parts[1]}` : order.firstDueDate;
      rows.push({
        id: `due-0-${Date.now()}`,
        qty: '',
        desc: `${formatted}  -  ${grandTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        unid: '',
        total: '',
        isInstallment: true,
      });
    }

    // 3. Entrega e observações
    if (order.delivery && order.delivery !== 'Próxima rota') {
      rows.push({
        id: `del-${Date.now()}`,
        qty: '',
        desc: `Previsão de entrega: ${order.delivery}`,
        unid: '',
        total: '',
        isNote: true,
      });
    }
    if (order.note) {
      rows.push({
        id: `note-${Date.now()}`,
        qty: '',
        desc: `Obs: ${order.note}`,
        unid: '',
        total: '',
        isNote: true,
      });
    }

    // Preenche com linhas em branco para manter a proporção física
    const minRows = Math.max(13, rows.length + 3);
    while (rows.length < minRows) {
      rows.push({
        id: `blank-${rows.length}-${Date.now()}`,
        qty: '',
        desc: '',
        unid: '',
        total: '',
      });
    }

    return {
      orderId: order.id,
      vendorName: initialVendor,
      orderDate,
      clientName,
      clientRef,
      clientAddress,
      clientCep,
      clientCity: 'São Paulo',
      clientState: 'SP',
      clientPhone,
      clientCnpj,
      clientIe,
      clientEmail,
      rows,
      buyer,
      visto: '',
      totalValue: `R$ ${grandTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    };
  }

  const handleResetToOriginal = () => {
    if (currentOrder) {
      setSlipData(buildInitialSlipData(currentOrder, currentClient, data, userProfile));
    }
  };

  const handlePrint = () => {
    if (!currentOrder) return;
    openPrintableOrderSlip(
      currentOrder,
      currentClient,
      data.products,
      slipData.vendorName || 'Sérgio Soares',
      slipData
    );
  };

  const handleRecalculateTotal = () => {
    let sum = 0;
    slipData.rows?.forEach(r => {
      if (r.total) {
        const cleaned = r.total.replace(/[^\d,-]/g, '').replace(',', '.');
        const num = parseFloat(cleaned);
        if (!isNaN(num)) sum += num;
      }
    });
    setSlipData(prev => ({
      ...prev,
      totalValue: `R$ ${sum.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    }));
  };

  const handleAddRow = (isInstallment: boolean = false) => {
    const newRow: SlipRow = {
      id: `custom-${Date.now()}-${Math.random()}`,
      qty: isInstallment ? '' : '10',
      desc: isInstallment ? '00/00  -  0,00' : 'Nova mercadoria / anotação',
      unid: isInstallment ? '' : 'SA',
      total: isInstallment ? '' : '0,00',
      isInstallment,
    };
    setSlipData(prev => ({
      ...prev,
      rows: [...(prev.rows ?? []), newRow],
    }));
  };

  const handleDeleteRow = (id: string) => {
    setSlipData(prev => ({
      ...prev,
      rows: (prev.rows ?? []).filter(r => (r as SlipRow).id !== id),
    }));
  };

  const handleUpdateRow = (id: string, field: keyof SlipRow, value: string) => {
    setSlipData(prev => ({
      ...prev,
      rows: (prev.rows ?? []).map(r => {
        if ((r as SlipRow).id === id) {
          return { ...r, [field]: value };
        }
        return r;
      }),
    }));
  };

  const handleCopySummary = () => {
    if (!currentOrder) return;
    let text = `📋 TALÃO DE PEDIDO #${slipData.orderId} - TOTAL TRIGO\n`;
    text += `Vendedor: ${slipData.vendorName} | Data: ${slipData.orderDate}\n`;
    text += `Cliente: ${slipData.clientName} (${slipData.clientAddress})\n`;
    text += `CNPJ: ${slipData.clientCnpj} | Tel: ${slipData.clientPhone}\n\n`;
    text += `ITENS DO TALÃO:\n`;

    slipData.rows?.forEach(r => {
      if (r.qty || r.desc || r.total) {
        text += `• ${r.qty ? `${r.qty} un ` : ''}${r.desc} ${r.total ? `— ${r.total}` : ''}\n`;
      }
    });

    text += `\nVALOR TOTAL: ${slipData.totalValue}\n`;
    text += `Comprador: ${slipData.buyer}\n`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredOrders = data.orders.filter(o => {
    if (!searchTerm) return true;
    const c = data.clients.find(cli => cli.id === o.clientId);
    const searchLower = searchTerm.toLowerCase();
    return (
      o.id.toLowerCase().includes(searchLower) ||
      (c?.name && c.name.toLowerCase().includes(searchLower)) ||
      (c?.neighborhood && c.neighborhood.toLowerCase().includes(searchLower))
    );
  });

  return (
    <div className="h-full flex-1 min-h-0 flex flex-col space-y-4 overflow-y-auto pr-1 pb-24">
      {/* Cabeçalho da Seção com Ações */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/70 pb-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <span className="p-2 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 shrink-0">
            <FileText size={20} />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                Talão de Pedido (Bloco Comercial)
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <PenLine size={11} />
                Edição Direta Ativa
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Clique diretamente sobre qualquer campo do documento para editar textos, quantidades, datas e valores antes de imprimir.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            className="text-xs gap-1.5 cursor-pointer"
            onClick={handleResetToOriginal}
            title="Reverter alterações e recarregar dados originais do pedido"
          >
            <RotateCcw size={13} />
            Restaurar Original
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="text-xs gap-1.5 cursor-pointer"
            onClick={handleCopySummary}
          >
            {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
            {copied ? 'Copiado!' : 'Copiar Resumo'}
          </Button>

          {currentOrder && (
            <a
              href={buildWhatsAppOrderShareUrl(currentOrder, 'client_summary', currentClient, data.products)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors"
            >
              <Share2 size={13} />
              WhatsApp
            </a>
          )}

          <Button
            size="sm"
            className="text-xs font-semibold gap-1.5 bg-sky-600 hover:bg-sky-700 text-white shadow-xs cursor-pointer"
            onClick={handlePrint}
          >
            <Printer size={14} />
            Imprimir Talão / PDF
          </Button>
        </div>
      </div>

      {/* Barra de Seleção e Busca de Pedidos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-card border border-border/80 rounded-xl p-3 shadow-2xs shrink-0">
        <div>
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
            Selecione o Pedido para Gerar o Talão
          </label>
          <select
            className="form-input text-xs h-9 bg-background cursor-pointer pr-8 w-full"
            value={selectedOrderId}
            onChange={e => setSelectedOrderId(e.target.value)}
          >
            {filteredOrders.map(o => {
              const c = data.clients.find(cli => cli.id === o.clientId);
              const total = o.items.reduce((acc, i) => acc + itemDq(i) * i.price, 0);
              return (
                <option key={o.id} value={o.id}>
                  Pedido #{o.id} — {c?.name ?? `Cliente #${o.clientId}`} ({money(total)})
                </option>
              );
            })}
          </select>
        </div>

        <div>
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
            Filtrar por Cliente ou Nº
          </label>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-2.5 text-muted-foreground" />
            <input
              type="text"
              className="form-input text-xs h-9 bg-background pl-8 w-full"
              placeholder="Buscar por nome, bairro ou número do pedido..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Dica de Edição Direta */}
      <div className="bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/50 rounded-lg px-3.5 py-2 text-xs flex items-center justify-between gap-3 text-sky-800 dark:text-sky-300 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm">✍️</span>
          <span>
            <strong>Dica de uso:</strong> Clique em qualquer texto ou linha da folha abaixo para digitar. Os valores editados serão impressos exatamente como você configurar.
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs font-semibold gap-1 text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-900/40"
            onClick={() => handleAddRow(false)}
          >
            <Plus size={12} />
            + Linha
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs font-semibold gap-1 text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-900/40"
            onClick={() => handleAddRow(true)}
          >
            <Plus size={12} />
            + Boleto
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs font-semibold gap-1 text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-900/40"
            onClick={handleRecalculateTotal}
            title="Soma automaticamente a coluna Total das linhas preenchidas"
          >
            <Calculator size={12} />
            Recalcular Total
          </Button>
        </div>
      </div>

      {/* ÁREA DO DOCUMENTO: Com scroll vertical e horizontal livres para visualizar toda a folha */}
      <div className="w-full flex justify-center py-4 px-2 sm:px-6 bg-slate-800/5 dark:bg-black/40 rounded-2xl border border-border/80 overflow-x-auto">
        <div className="w-full max-w-[760px] bg-white text-slate-900 border-2 border-slate-900 rounded-sm p-5 sm:p-7 shadow-2xl transition-all">
          {/* Cabeçalho do Bloco */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <span className="bg-[#0284c7] text-white font-extrabold text-2xl sm:text-3xl px-4 py-1 rounded tracking-tight select-none">
                Pedido
              </span>
              <div className="flex items-baseline gap-1 text-[#0284c7] font-extrabold text-2xl sm:text-3xl">
                <span>Nº</span>
                <input
                  type="text"
                  className="text-slate-900 border-b-2 border-slate-900 font-bold text-xl sm:text-2xl w-28 px-1 text-center bg-transparent focus:bg-sky-50 focus:outline-none transition-colors"
                  value={slipData.orderId ?? ''}
                  onChange={e => setSlipData(prev => ({ ...prev, orderId: e.target.value }))}
                  title="Clique para editar o número do pedido"
                />
              </div>
            </div>

            <div className="text-xs sm:text-sm text-slate-900 space-y-1.5 self-end sm:self-auto min-w-[240px]">
              <div className="flex items-baseline justify-end gap-1.5">
                <span className="font-semibold text-slate-700 select-none">Vendedor:</span>
                <input
                  type="text"
                  className="border-b border-slate-900 min-w-[150px] font-bold text-slate-900 px-1 text-left bg-transparent focus:bg-sky-50 focus:outline-none transition-colors"
                  value={slipData.vendorName ?? ''}
                  onChange={e => setSlipData(prev => ({ ...prev, vendorName: e.target.value }))}
                  title="Clique para editar o nome do vendedor"
                />
              </div>
              <div className="flex items-baseline justify-end gap-1.5">
                <span className="font-semibold text-slate-700 select-none">Data:</span>
                <input
                  type="text"
                  className="border-b border-slate-900 min-w-[150px] font-bold text-slate-900 px-1 text-left bg-transparent focus:bg-sky-50 focus:outline-none transition-colors"
                  value={slipData.orderDate ?? ''}
                  onChange={e => setSlipData(prev => ({ ...prev, orderDate: e.target.value }))}
                  title="Clique para editar a data do pedido"
                />
              </div>
            </div>
          </div>

          {/* Tabela de Dados Cadastrais do Cliente (Editável Inline) */}
          <table className="w-full border-collapse border border-slate-800 text-xs mb-3">
            <tbody>
              <tr className="border-b border-slate-700">
                <td colSpan={4} className="p-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <span className="text-slate-600 font-medium select-none shrink-0">Cliente:</span>
                      <input
                        type="text"
                        className="text-sm text-slate-900 font-bold w-full bg-transparent focus:bg-sky-50 focus:outline-none px-1 rounded transition-colors"
                        value={slipData.clientName ?? ''}
                        onChange={e => setSlipData(prev => ({ ...prev, clientName: e.target.value }))}
                        title="Clique para editar a razão social / nome da padaria"
                      />
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[11px] text-slate-600 font-bold select-none">Cód:</span>
                      <input
                        type="text"
                        className="w-14 text-[11px] text-slate-700 font-bold text-right bg-transparent focus:bg-sky-50 focus:outline-none px-1 rounded transition-colors"
                        value={slipData.clientRef ?? ''}
                        onChange={e => setSlipData(prev => ({ ...prev, clientRef: e.target.value }))}
                        title="Código ou referência"
                      />
                    </div>
                  </div>
                </td>
              </tr>
              <tr className="border-b border-slate-700">
                <td colSpan={4} className="p-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-600 font-medium select-none shrink-0">Endereço:</span>
                    <input
                      type="text"
                      className="font-semibold text-slate-900 w-full bg-transparent focus:bg-sky-50 focus:outline-none px-1 rounded transition-colors"
                      value={slipData.clientAddress ?? ''}
                      onChange={e => setSlipData(prev => ({ ...prev, clientAddress: e.target.value }))}
                      title="Endereço de entrega"
                    />
                  </div>
                </td>
              </tr>
              <tr className="border-b border-slate-700">
                <td className="p-1.5 border-r border-slate-700 w-1/4">
                  <div className="flex items-center gap-1">
                    <span className="text-slate-600 font-medium select-none shrink-0">CEP:</span>
                    <input
                      type="text"
                      className="font-semibold text-slate-900 w-full bg-transparent focus:bg-sky-50 focus:outline-none px-1 rounded transition-colors"
                      value={slipData.clientCep ?? ''}
                      onChange={e => setSlipData(prev => ({ ...prev, clientCep: e.target.value }))}
                    />
                  </div>
                </td>
                <td className="p-1.5 border-r border-slate-700 w-1/3">
                  <div className="flex items-center gap-1">
                    <span className="text-slate-600 font-medium select-none shrink-0">Cidade:</span>
                    <input
                      type="text"
                      className="font-semibold text-slate-900 w-full bg-transparent focus:bg-sky-50 focus:outline-none px-1 rounded transition-colors"
                      value={slipData.clientCity ?? ''}
                      onChange={e => setSlipData(prev => ({ ...prev, clientCity: e.target.value }))}
                    />
                  </div>
                </td>
                <td className="p-1.5 border-r border-slate-700 w-1/6">
                  <div className="flex items-center gap-1">
                    <span className="text-slate-600 font-medium select-none shrink-0">UF:</span>
                    <input
                      type="text"
                      className="font-semibold text-slate-900 w-full bg-transparent focus:bg-sky-50 focus:outline-none px-1 rounded transition-colors"
                      value={slipData.clientState ?? ''}
                      onChange={e => setSlipData(prev => ({ ...prev, clientState: e.target.value }))}
                    />
                  </div>
                </td>
                <td className="p-1.5 w-1/4">
                  <div className="flex items-center gap-1">
                    <span className="text-slate-600 font-medium select-none shrink-0">Tel:</span>
                    <input
                      type="text"
                      className="font-semibold text-slate-900 w-full bg-transparent focus:bg-sky-50 focus:outline-none px-1 rounded transition-colors"
                      value={slipData.clientPhone ?? ''}
                      onChange={e => setSlipData(prev => ({ ...prev, clientPhone: e.target.value }))}
                    />
                  </div>
                </td>
              </tr>
              <tr className="border-b border-slate-700">
                <td colSpan={2} className="p-1.5 border-r border-slate-700">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-600 font-medium select-none shrink-0">C.N.P.J:</span>
                    <input
                      type="text"
                      className="font-semibold font-mono text-slate-900 w-full bg-transparent focus:bg-sky-50 focus:outline-none px-1 rounded transition-colors"
                      value={slipData.clientCnpj ?? ''}
                      onChange={e => setSlipData(prev => ({ ...prev, clientCnpj: e.target.value }))}
                    />
                  </div>
                </td>
                <td colSpan={2} className="p-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-600 font-medium select-none shrink-0">Inscr. Est.:</span>
                    <input
                      type="text"
                      className="font-semibold font-mono text-slate-900 w-full bg-transparent focus:bg-sky-50 focus:outline-none px-1 rounded transition-colors"
                      value={slipData.clientIe ?? ''}
                      onChange={e => setSlipData(prev => ({ ...prev, clientIe: e.target.value }))}
                    />
                  </div>
                </td>
              </tr>
              <tr>
                <td colSpan={4} className="p-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-600 font-medium select-none shrink-0">E-mail:</span>
                    <input
                      type="text"
                      className="font-semibold text-slate-900 w-full bg-transparent focus:bg-sky-50 focus:outline-none px-1 rounded transition-colors"
                      value={slipData.clientEmail ?? ''}
                      onChange={e => setSlipData(prev => ({ ...prev, clientEmail: e.target.value }))}
                    />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Tabela Pautada de Produtos & Vencimentos (Linhas Editáveis Diretamente) */}
          <table className="w-full border-collapse border border-slate-800 text-xs mb-3">
            <thead>
              <tr className="bg-[#dbeafe] text-[#0369a1] border-b border-slate-800 select-none">
                <th className="py-1.5 px-2 border-r border-slate-800 w-[12%] text-center font-bold">Qtde.</th>
                <th className="py-1.5 px-2 border-r border-slate-800 w-[56%] text-center font-bold">Descrição</th>
                <th className="py-1.5 px-2 border-r border-slate-800 w-[12%] text-center font-bold">Unid.</th>
                <th className="py-1.5 px-2 w-[20%] text-center font-bold">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-400">
              {(slipData.rows as SlipRow[] ?? []).map((row, idx) => {
                const descStyle = row.isInstallment
                  ? 'font-mono font-bold text-slate-800 pl-6'
                  : row.isNote
                  ? 'italic text-slate-600'
                  : 'font-semibold text-slate-900';

                return (
                  <tr key={row.id} className="h-8 hover:bg-sky-50/40 group transition-colors">
                    <td className="p-0 border-r border-slate-400 relative">
                      <input
                        type="text"
                        className="w-full h-8 text-center font-bold text-sm bg-transparent focus:bg-white focus:outline-none"
                        value={row.qty}
                        onChange={e => handleUpdateRow(row.id, 'qty', e.target.value)}
                        placeholder=""
                      />
                    </td>
                    <td className="p-0 border-r border-slate-400 relative">
                      <input
                        type="text"
                        className={`w-full h-8 px-2 text-sm bg-transparent focus:bg-white focus:outline-none ${descStyle}`}
                        value={row.desc}
                        onChange={e => handleUpdateRow(row.id, 'desc', e.target.value)}
                        placeholder="Clique para digitar a descrição..."
                      />
                    </td>
                    <td className="p-0 border-r border-slate-400 relative">
                      <input
                        type="text"
                        className="w-full h-8 text-center text-xs text-slate-700 bg-transparent focus:bg-white focus:outline-none"
                        value={row.unid}
                        onChange={e => handleUpdateRow(row.id, 'unid', e.target.value)}
                        placeholder=""
                      />
                    </td>
                    <td className="p-0 relative">
                      <div className="flex items-center">
                        <input
                          type="text"
                          className="w-full h-8 text-right font-bold text-sm px-2 text-slate-900 bg-transparent focus:bg-white focus:outline-none"
                          value={row.total}
                          onChange={e => handleUpdateRow(row.id, 'total', e.target.value)}
                          placeholder=""
                        />
                        <button
                          type="button"
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 transition-opacity absolute right-1 cursor-pointer"
                          onClick={() => handleDeleteRow(row.id)}
                          title="Remover linha"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Botões rápidos abaixo da tabela */}
          <div className="flex items-center justify-between gap-2 mb-3 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[11px] gap-1 cursor-pointer"
                onClick={() => handleAddRow(false)}
              >
                <Plus size={11} /> Adicionar Linha
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[11px] gap-1 cursor-pointer"
                onClick={() => handleAddRow(true)}
              >
                <Plus size={11} /> Adicionar Boleto
              </Button>
            </div>
            <span className="text-[11px] italic">
              {(slipData.rows?.length ?? 0)} linhas no talão
            </span>
          </div>

          {/* Rodapé: Assinaturas e Totalizador */}
          <table className="w-full border-collapse border border-slate-800 text-xs">
            <tbody>
              <tr>
                <td className="w-2/5 p-2 border-r border-slate-800 align-top">
                  <div className="flex items-center gap-1 text-[10px] text-slate-600 font-semibold mb-6">
                    <span className="shrink-0 select-none">Comprador:</span>
                    <input
                      type="text"
                      className="font-bold text-slate-900 w-full bg-transparent focus:bg-sky-50 focus:outline-none px-1 rounded transition-colors"
                      value={slipData.buyer ?? ''}
                      onChange={e => setSlipData(prev => ({ ...prev, buyer: e.target.value }))}
                      placeholder="Nome do Comprador"
                      title="Clique para editar o comprador"
                    />
                  </div>
                  <div className="border-b border-slate-900 w-11/12 mx-auto"></div>
                </td>

                <td className="w-1/4 p-2 border-r border-slate-800 align-top">
                  <div className="flex items-center gap-1 text-[10px] text-slate-600 font-semibold mb-6">
                    <span className="shrink-0 select-none">Visto:</span>
                    <input
                      type="text"
                      className="font-bold text-slate-900 w-full bg-transparent focus:bg-sky-50 focus:outline-none px-1 rounded transition-colors"
                      value={slipData.visto ?? ''}
                      onChange={e => setSlipData(prev => ({ ...prev, visto: e.target.value }))}
                      placeholder="Rubrica / Visto"
                      title="Clique para assinar ou digitar o visto"
                    />
                  </div>
                  <div className="border-b border-slate-900 w-4/5 mx-auto"></div>
                </td>

                <td className="w-1/3 p-2 text-right align-top bg-sky-50/40">
                  <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1 select-none">
                    Valor total do pedido
                  </div>
                  <input
                    type="text"
                    className="text-xl sm:text-2xl font-black text-[#0284c7] text-right w-full bg-transparent focus:bg-white focus:outline-none rounded px-1 transition-colors"
                    value={slipData.totalValue ?? ''}
                    onChange={e => setSlipData(prev => ({ ...prev, totalValue: e.target.value }))}
                    title="Clique para editar o valor total do pedido"
                  />
                </td>
              </tr>
            </tbody>
          </table>

          {/* Tarja Inferior Legal Obrigatória */}
          <div className="bg-[#0284c7] text-white text-center py-1.5 px-3 font-bold text-[10px] uppercase tracking-wider border-x border-b border-slate-800 select-none">
            As mercadorias viajam por conta e risco do(s) comprador(es).
          </div>
        </div>
      </div>
    </div>
  );
}
