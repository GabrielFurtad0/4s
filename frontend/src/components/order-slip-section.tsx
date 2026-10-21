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
  User,
  ChevronsUpDown,
  Calendar,
  Maximize2,
  Minimize2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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


export function formatSlipOrderDate(order?: Order): string {
  if (!order) return new Date().toLocaleDateString('pt-BR');
  const raw = order.date;
  if (!raw) return new Date().toLocaleDateString('pt-BR');

  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase();

  if (lower === 'ontem') {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toLocaleDateString('pt-BR');
  }
  if (lower === 'hoje' || /^\d{1,2}:\d{2}$/.test(trimmed)) {
    return new Date().toLocaleDateString('pt-BR');
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const [y, m, d] = trimmed.slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
  }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
    return trimmed;
  }
  return new Date().toLocaleDateString('pt-BR');
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
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullscreen(false);
    };
    if (isFullscreen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

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

    const initialVendor = 'Sérgio Soares';

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
    const orderDate = formatSlipOrderDate(order);
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
    let text = `TALÃO DE PEDIDO #${slipData.orderId} - TOTAL TRIGO\n`;
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

  const currentOrderTotal = currentOrder
    ? currentOrder.items.reduce((acc, item) => acc + itemDq(item) * item.price, 0)
    : 0;

  const currentOrderSacks = currentOrder
    ? currentOrder.items.reduce((acc, item) => acc + itemDq(item), 0)
    : 0;

  const renderOrderSlipPaper = () => (
    <div className="w-full max-w-[760px] h-fit self-start bg-white text-slate-900 border-2 border-slate-900 rounded-sm p-5 sm:p-7 shadow-2xl transition-all">
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
          <div className="flex items-center justify-end gap-1.5">
            <span className="font-semibold text-slate-700 select-none">Data:</span>
            <div className="flex items-center border-b border-slate-900 bg-transparent focus-within:bg-sky-50 transition-colors">
              <input
                type="text"
                className="w-24 font-bold text-slate-900 px-1 text-left bg-transparent focus:outline-none text-xs"
                value={slipData.orderDate ?? ''}
                placeholder="DD/MM/AAAA"
                onChange={e => setSlipData(prev => ({ ...prev, orderDate: e.target.value }))}
                title="Data do pedido (DD/MM/AAAA)"
              />
              <label className="relative cursor-pointer p-1 text-slate-600 hover:text-sky-600 transition-colors shrink-0" title="Abrir seletor de data brasileiro">
                <Calendar size={14} />
                <input
                  type="date"
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  value={(() => {
                    const d = slipData.orderDate;
                    if (!d) return '';
                    const parts = d.split('/');
                    if (parts.length === 3) return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                    return '';
                  })()}
                  onChange={e => {
                    if (!e.target.value) return;
                    const [y, m, d] = e.target.value.split('-');
                    setSlipData(prev => ({ ...prev, orderDate: `${d}/${m}/${y}` }));
                  }}
                />
              </label>
            </div>
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
                  className="font-semibold text-slate-900 w-full bg-transparent focus:bg-sky-50 focus:outline-none px-1 rounded transition-colors text-center"
                  value={slipData.clientState ?? ''}
                  onChange={e => setSlipData(prev => ({ ...prev, clientState: e.target.value }))}
                />
              </div>
            </td>
            <td className="p-1.5 w-1/4">
              <div className="flex items-center gap-1">
                <span className="text-slate-600 font-medium select-none shrink-0">Fone:</span>
                <input
                  type="text"
                  className="font-semibold text-slate-900 w-full bg-transparent focus:bg-sky-50 focus:outline-none px-1 rounded transition-colors"
                  value={slipData.clientPhone ?? ''}
                  onChange={e => setSlipData(prev => ({ ...prev, clientPhone: e.target.value }))}
                />
              </div>
            </td>
          </tr>
          <tr>
            <td colSpan={2} className="p-1.5 border-r border-slate-700">
              <div className="flex items-center gap-1">
                <span className="text-slate-600 font-medium select-none shrink-0">CNPJ / CPF:</span>
                <input
                  type="text"
                  className="font-mono font-bold text-slate-900 w-full bg-transparent focus:bg-sky-50 focus:outline-none px-1 rounded transition-colors"
                  value={slipData.clientCnpj ?? ''}
                  onChange={e => setSlipData(prev => ({ ...prev, clientCnpj: e.target.value }))}
                />
              </div>
            </td>
            <td colSpan={2} className="p-1.5">
              <div className="flex items-center gap-1">
                <span className="text-slate-600 font-medium select-none shrink-0">Inscr. Estadual:</span>
                <input
                  type="text"
                  className="font-mono font-bold text-slate-900 w-full bg-transparent focus:bg-sky-50 focus:outline-none px-1 rounded transition-colors"
                  value={slipData.clientIe ?? ''}
                  onChange={e => setSlipData(prev => ({ ...prev, clientIe: e.target.value }))}
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
          {((slipData.rows as SlipRow[]) ?? []).map((row, idx) => {
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
                    placeholder=""
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
            <Plus size={11} /> Adicionar Parcela / Boleto
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
  );

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

          <Button
            variant="outline"
            size="sm"
            className="text-xs font-semibold gap-1.5 cursor-pointer border-border hover:bg-muted"
            onClick={() => setIsFullscreen(true)}
            title="Visualizar o talão de pedido em tela cheia"
          >
            <Maximize2 size={13} />
            Tela Cheia
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

      {/* Barra de Seleção e Controles (Filtrar primeiro, depois Selecionar) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-card border border-border/80 rounded-xl p-3.5 shadow-2xs shrink-0">
        {/* 1. FILTRAR PEDIDOS (Vem antes para filtrar a lista da carteira) */}
        <div>
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
            Filtrar Pedidos
          </label>
          <div className="relative flex items-center">
            <Search size={14} className="absolute left-3 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-8 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-colors shadow-2xs"
              placeholder="Buscar por cliente, bairro ou número..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 text-muted-foreground hover:text-foreground text-xs p-0.5 rounded cursor-pointer"
                title="Limpar busca"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* 2. SELECIONE O PEDIDO (Custom Dropdown similar ao Perfil) */}
        <div>
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
            Selecione o Pedido
          </label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="w-full flex items-center justify-between gap-2 bg-background hover:bg-accent/40 text-foreground border border-input rounded-md px-3 py-1.5 text-xs font-semibold transition-colors shadow-2xs cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring select-none h-9 text-left"
                aria-label="Selecione o Pedido"
                title="Clique para alternar o pedido do talão"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="flex items-center justify-center size-5 rounded bg-sky-500/15 text-sky-700 dark:text-sky-300 font-mono text-[10px] font-bold shrink-0">
                    #{currentOrder?.id ?? '—'}
                  </span>
                  <span className="font-semibold text-xs text-foreground truncate max-w-[150px] sm:max-w-[220px]">
                    {currentClient?.name ?? `Cliente #${currentOrder?.clientId ?? '—'}`}
                  </span>
                  <span className="text-muted-foreground text-[11px] font-medium shrink-0 hidden lg:inline">
                    ({money(currentOrderTotal)})
                  </span>
                </div>
                <ChevronsUpDown size={13} className="text-muted-foreground hover:text-foreground shrink-0 ml-1" />
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              align="start"
              sideOffset={6}
              className="w-[340px] sm:w-[420px] p-2 bg-card/95 backdrop-blur-md border border-border/80 shadow-2xl rounded-xl z-50 text-foreground"
            >
              <div className="px-2 py-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground">
                    Pedidos da Carteira
                  </span>
                  <span className="text-[10px] text-sky-600 dark:text-sky-400 font-bold bg-sky-500/10 px-1.5 py-0.5 rounded">
                    {filteredOrders.length} {filteredOrders.length === 1 ? 'disponível' : 'disponíveis'}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Selecione o pedido para carregar os dados no talão de notas.
                </p>
              </div>

              <DropdownMenuSeparator className="my-1.5 bg-border/70" />

              <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
                {filteredOrders.length === 0 ? (
                  <div className="p-4 text-center text-xs text-muted-foreground">
                    Nenhum pedido encontrado.
                  </div>
                ) : (
                  filteredOrders.map(o => {
                    const isSelected = o.id === selectedOrderId;
                    const cli = data.clients.find(c => c.id === o.clientId);
                    const total = o.items.reduce((acc, i) => acc + itemDq(i) * i.price, 0);
                    const totalSacks = o.items.reduce((acc, i) => acc + itemDq(i), 0);

                    return (
                      <DropdownMenuItem
                        key={o.id}
                        onSelect={() => {
                          setSelectedOrderId(o.id);
                          const c = data.clients.find(item => item.id === o.clientId);
                          setSlipData(buildInitialSlipData(o, c, data, userProfile));
                        }}
                        className={`flex items-start gap-2.5 p-2 rounded-lg cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-sky-500/10 border border-sky-500/30 text-foreground'
                            : 'hover:bg-muted/60 text-muted-foreground hover:text-foreground border border-transparent'
                        }`}
                      >
                        <div
                          className={`flex items-center justify-center size-8 rounded-lg shrink-0 mt-0.5 text-xs font-bold ${
                            isSelected
                              ? 'bg-sky-500 text-white shadow-xs'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          #{o.id}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="font-semibold text-xs text-foreground truncate">
                              {cli?.name ?? `Cliente #${o.clientId}`}
                            </span>
                            <span className="text-[11px] font-mono font-bold text-sky-600 dark:text-sky-400 shrink-0">
                              {money(total)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
                            <span className="truncate">{cli?.neighborhood || 'São Paulo'}</span>
                            <span>·</span>
                            <span className="shrink-0">{totalSacks} sc</span>
                            <span>·</span>
                            <span className="shrink-0">{formatSlipOrderDate(o)}</span>
                          </div>
                        </div>
                        {isSelected && (
                          <div className="flex items-center justify-center size-4 rounded-full bg-sky-600 text-white shrink-0 mt-1">
                            <Check size={11} strokeWidth={3} />
                          </div>
                        )}
                      </DropdownMenuItem>
                    );
                  })
                )}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Dica de Edição Direta */}
      <div className="bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/50 rounded-lg px-3.5 py-2 text-xs flex items-center justify-between gap-3 text-sky-800 dark:text-sky-300 shrink-0">
        <div className="flex items-center gap-2">
          <PenLine size={14} className="text-sky-600 shrink-0" />
          <span>
            <strong>Dica de uso:</strong> Clique em qualquer texto ou linha da folha abaixo para digitar. Os valores editados serão impressos exatamente como você configurar.
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs font-semibold gap-1 text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-900/40 cursor-pointer"
            onClick={handleRecalculateTotal}
            title="Soma automaticamente a coluna Total das linhas preenchidas"
          >
            <Calculator size={12} />
            Recalcular Total
          </Button>
        </div>
      </div>

      {/* ÁREA DO DOCUMENTO: Estende até o fim da página com scroll natural */}
      <div className="w-full flex justify-center items-start py-6 px-2 sm:px-6 bg-slate-800/5 dark:bg-black/40 rounded-2xl border border-border/80 overflow-x-auto min-h-fit">
        {renderOrderSlipPaper()}
      </div>

      {/* Visualização em Tela Cheia (Fullscreen Overlay) */}
      {isFullscreen && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col p-3 sm:p-6 overflow-hidden animate-in fade-in duration-150">
          <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-white/10 shrink-0 text-white max-w-4xl w-full mx-auto">
            <div className="flex items-center gap-2.5">
              <span className="p-2 bg-sky-500/20 text-sky-400 rounded-lg">
                <FileText size={18} />
              </span>
              <div>
                <h2 className="text-sm sm:text-base font-bold">
                  Talão de Pedido #{slipData.orderId || slipData.orderNumber} · Tela Cheia
                </h2>
                <p className="text-[11px] text-slate-400">
                  {slipData.clientName || 'Cliente'} · {slipData.orderDate}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5 bg-white/10 text-white border-white/20 hover:bg-white/20 cursor-pointer"
                onClick={handlePrint}
              >
                <Printer size={13} />
                <span className="hidden sm:inline">Imprimir</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5 bg-white/10 text-white border-white/20 hover:bg-white/20 cursor-pointer"
                onClick={handleCopySummary}
              >
                <Copy size={13} />
                <span className="hidden sm:inline">{copied ? 'Copiado!' : 'Copiar'}</span>
              </Button>
              <Button
                variant="default"
                size="sm"
                className="h-8 text-xs gap-1.5 bg-sky-600 hover:bg-sky-500 text-white font-semibold cursor-pointer"
                onClick={() => setIsFullscreen(false)}
                title="Sair da tela cheia (ESC)"
              >
                <Minimize2 size={13} />
                <span>Fechar Tela Cheia</span>
                <kbd className="hidden sm:inline-block ml-1 px-1 py-0.5 text-[9px] bg-sky-700 rounded text-sky-200">
                  ESC
                </kbd>
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto py-6 px-2 sm:px-6 flex justify-center items-start">
            {renderOrderSlipPaper()}
          </div>
        </div>
      )}
    </div>
  );
}
