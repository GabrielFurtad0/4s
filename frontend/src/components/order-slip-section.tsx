import { useState } from 'react';
import {
  FileText,
  Printer,
  Share2,
  Copy,
  Check,
  Truck,
  Calendar,
  User,
  Search,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  type AppData,
  type Order,
  type Client,
  type Product,
  itemDq,
  money,
} from '@/lib/business';
import {
  openPrintableOrderSlip,
  generateOrderSlipHtml,
  buildWhatsAppOrderShareUrl,
} from '@/lib/documentPrint';

interface OrderSlipSectionProps {
  data: AppData;
  userProfile?: string | undefined;
  initialOrderId?: string | undefined;
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
  const [vendorName, setVendorName] = useState<string>(() => {
    if (userProfile?.includes('Sérgio')) return 'Sérgio Soares';
    if (userProfile?.includes('Gabriel')) return 'Gabriel Furtado';
    return 'Sérgio Soares';
  });
  const [copied, setCopied] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const currentOrder: Order | undefined =
    data.orders.find(o => o.id === selectedOrderId) ?? data.orders[0];

  const currentClient: Client | undefined = currentOrder
    ? data.clients.find(c => c.id === currentOrder.clientId)
    : undefined;

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

  const grandTotal = currentOrder
    ? currentOrder.items.reduce((acc, item) => acc + itemDq(item) * item.price, 0)
    : 0;

  const totalSacks = currentOrder
    ? currentOrder.items.reduce((acc, item) => acc + itemDq(item), 0)
    : 0;

  const handlePrint = () => {
    if (!currentOrder) return;
    openPrintableOrderSlip(currentOrder, currentClient, data.products, vendorName);
  };

  const handleCopySummary = () => {
    if (!currentOrder) return;
    const clientName = currentClient?.name ?? `Cliente #${currentOrder.clientId}`;
    const date = currentOrder.date || 'Hoje';
    const delivery = currentOrder.delivery || 'Próxima rota';

    let text = `📋 TALÃO DE PEDIDO #${currentOrder.id} - TOTAL TRIGO\n`;
    text += `Vendedor: ${vendorName} | Data: ${date}\n`;
    text += `Cliente: ${clientName} (${currentClient?.neighborhood ?? 'SP'})\n`;
    text += `Previsão de Entrega: ${delivery}\n\n`;
    text += `ITENS SOLICITADOS:\n`;

    currentOrder.items.forEach(item => {
      const dq = itemDq(item);
      if (dq <= 0) return;
      const prod = data.products.find(p => p.id === item.productId);
      const pName = prod?.name ?? `Item #${item.productId}`;
      text += `• ${dq} sc x ${pName} - ${money(item.price)} = ${money(dq * item.price)}\n`;
    });

    text += `\nVALOR TOTAL: ${money(grandTotal)} (${totalSacks} sacas)\n`;
    if (currentOrder.dueDates && currentOrder.dueDates.length > 0) {
      text += `Vencimento das parcelas:\n`;
      const val = grandTotal / currentOrder.dueDates.length;
      currentOrder.dueDates.forEach((d, idx) => {
        text += `  ${idx + 1}ª parcela: ${d.split('-').reverse().join('/')} - ${money(val)}\n`;
      });
    }

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho da Seção */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/70 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
              <FileText size={20} />
            </span>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                Talão de Pedido (Bloco Comercial)
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Transformação fiel do pedido digital no formato físico do bloco de notas de rua para impressão, assinatura e canhoto de frete.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-xs gap-1.5"
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

      {/* Barra de Controle e Seleção */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-card border border-border/80 rounded-xl p-3.5 shadow-2xs">
        <div>
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
            Selecione o Pedido
          </label>
          <div className="relative">
            <select
              className="form-input text-xs h-9 bg-background cursor-pointer pr-8 w-full"
              value={selectedOrderId}
              onChange={e => setSelectedOrderId(e.target.value)}
            >
              {data.orders.map(o => {
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
        </div>

        <div>
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
            Vendedor Responsável
          </label>
          <div className="relative">
            <User size={14} className="absolute left-2.5 top-2.5 text-muted-foreground" />
            <input
              type="text"
              className="form-input text-xs h-9 bg-background pl-8 w-full"
              value={vendorName}
              onChange={e => setVendorName(e.target.value)}
              placeholder="Nome do vendedor"
            />
          </div>
        </div>

        <div>
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
            Filtrar Pedidos
          </label>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-2.5 text-muted-foreground" />
            <input
              type="text"
              className="form-input text-xs h-9 bg-background pl-8 w-full"
              placeholder="Buscar por cliente ou ID..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Visualizador Realista do Talão Impresso (Réplica do Modelo Físico) */}
      {currentOrder ? (
        <div className="flex justify-center p-2 sm:p-6 bg-slate-900/10 dark:bg-black/30 rounded-2xl border border-border/80 overflow-x-auto">
          <div className="w-full max-w-[760px] bg-white text-slate-900 border-2 border-slate-900 rounded-sm p-5 sm:p-7 shadow-2xl transition-all select-none">
            {/* Cabeçalho do Bloco */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
              <div className="flex items-center gap-3">
                <span className="bg-[#0284c7] text-white font-extrabold text-2xl sm:text-3xl px-4 py-1 rounded tracking-tight">
                  Pedido
                </span>
                <div className="flex items-baseline gap-1 text-[#0284c7] font-extrabold text-2xl sm:text-3xl">
                  <span>Nº</span>
                  <span className="text-slate-900 border-b-2 border-slate-900 font-bold text-xl sm:text-2xl min-w-[100px] px-2 text-center">
                    {currentOrder.id}
                  </span>
                </div>
              </div>

              <div className="text-xs sm:text-sm text-slate-900 space-y-1.5 self-end sm:self-auto min-w-[220px]">
                <div className="flex items-baseline justify-end gap-1.5">
                  <span className="font-semibold text-slate-700">Vendedor:</span>
                  <span className="border-b border-slate-900 min-w-[150px] font-bold text-slate-900 px-1 text-left">
                    {vendorName}
                  </span>
                </div>
                <div className="flex items-baseline justify-end gap-1.5">
                  <span className="font-semibold text-slate-700">Data:</span>
                  <span className="border-b border-slate-900 min-w-[150px] font-bold text-slate-900 px-1 text-left">
                    {currentOrder.date || new Date().toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </div>
            </div>

            {/* Tabela com Dados Cadastrais do Cliente */}
            <table className="w-full border-collapse border border-slate-800 text-xs mb-3">
              <tbody>
                <tr className="border-b border-slate-700">
                  <td colSpan={4} className="p-1.5 border-r border-slate-700">
                    <span className="text-slate-600 font-medium">Cliente:</span>{' '}
                    <strong className="text-sm text-slate-900 font-bold ml-1">
                      {currentClient?.name ?? `Cliente #${currentOrder.clientId}`}
                    </strong>
                    <span className="float-right text-[11px] text-slate-600 font-bold">
                      Cód: {currentClient?.id ?? currentOrder.clientId}
                    </span>
                  </td>
                </tr>
                <tr className="border-b border-slate-700">
                  <td colSpan={4} className="p-1.5">
                    <span className="text-slate-600 font-medium">Endereço:</span>{' '}
                    <span className="font-semibold text-slate-900 ml-1">
                      {currentClient?.neighborhood
                        ? `${currentClient.neighborhood}, São Paulo - SP`
                        : 'São Paulo - SP'}
                    </span>
                  </td>
                </tr>
                <tr className="border-b border-slate-700">
                  <td className="p-1.5 border-r border-slate-700 w-1/4">
                    <span className="text-slate-600 font-medium">CEP:</span>{' '}
                    <span className="font-semibold text-slate-900 ml-1">
                      {currentClient?.ibge ? `04${currentClient.ibge.slice(2)}-000` : '04840-000'}
                    </span>
                  </td>
                  <td className="p-1.5 border-r border-slate-700 w-1/3">
                    <span className="text-slate-600 font-medium">Cidade:</span>{' '}
                    <span className="font-semibold text-slate-900 ml-1">São Paulo</span>
                  </td>
                  <td className="p-1.5 border-r border-slate-700 w-1/6">
                    <span className="text-slate-600 font-medium">Estado:</span>{' '}
                    <span className="font-semibold text-slate-900 ml-1">SP</span>
                  </td>
                  <td className="p-1.5 w-1/4">
                    <span className="text-slate-600 font-medium">Tel:</span>{' '}
                    <span className="font-semibold text-slate-900 ml-1">(11) 98765-4321</span>
                  </td>
                </tr>
                <tr className="border-b border-slate-700">
                  <td colSpan={2} className="p-1.5 border-r border-slate-700">
                    <span className="text-slate-600 font-medium">C.N.P.J:</span>{' '}
                    <span className="font-semibold font-mono text-slate-900 ml-1">
                      {currentClient?.cnpj || '—'}
                    </span>
                  </td>
                  <td colSpan={2} className="p-1.5">
                    <span className="text-slate-600 font-medium">Inscr. Est.:</span>{' '}
                    <span className="font-semibold font-mono text-slate-900 ml-1">
                      {currentClient?.ie || 'ISENTO'}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td colSpan={4} className="p-1.5">
                    <span className="text-slate-600 font-medium">E-mail:</span>{' '}
                    <span className="font-semibold text-slate-900 ml-1">
                      contato@{currentClient?.name?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'padaria'}.com.br
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Tabela Pautada de Produtos & Cronograma de Boletos */}
            <table className="w-full border-collapse border border-slate-800 text-xs mb-3">
              <thead>
                <tr className="bg-[#dbeafe] text-[#0369a1] border-b border-slate-800">
                  <th className="py-1.5 px-2 border-r border-slate-800 w-[12%] text-center font-bold">Qtde.</th>
                  <th className="py-1.5 px-2 border-r border-slate-800 w-[56%] text-center font-bold">Descrição</th>
                  <th className="py-1.5 px-2 border-r border-slate-800 w-[12%] text-center font-bold">Unid.</th>
                  <th className="py-1.5 px-2 w-[20%] text-center font-bold">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-400">
                {currentOrder.items
                  .filter(item => itemDq(item) > 0)
                  .map((item, idx) => {
                    const dq = itemDq(item);
                    const prod = data.products.find(p => p.id === item.productId);
                    const subtotal = dq * item.price;
                    const pName = (prod?.name ?? `Produto #${item.productId}`)
                      .replace(' (25kg)', '')
                      .replace('Farinha Tipo 1', 'Farinha Trigo Tipo 1')
                      .replace('Pré-Mistura Francês', 'Pré-Mistura')
                      .replace('PM Pão Doce', 'Pão Doce');

                    return (
                      <tr key={idx} className="h-8">
                        <td className="text-center font-bold text-sm border-r border-slate-400 text-slate-900">
                          {dq}
                        </td>
                        <td className="px-2 font-semibold text-sm border-r border-slate-400 text-slate-900">
                          {pName} <span className="font-mono text-xs text-slate-700 ml-2">{item.price.toFixed(2).replace('.', ',')}</span>
                        </td>
                        <td className="text-center text-xs text-slate-700 border-r border-slate-400">
                          SA
                        </td>
                        <td className="text-right font-bold text-sm px-2 text-slate-900">
                          {subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })}

                {/* Linhas pautadas com o detalhamento dos boletos/vencimentos (conforme talão manuscrito) */}
                {currentOrder.dueDates && currentOrder.dueDates.length > 0 ? (
                  currentOrder.dueDates.map((dStr, idx) => {
                    const parts = dStr.split('-');
                    const formatted = parts.length === 3 ? `${parts[2]}/${parts[1]}` : dStr;
                    const installmentVal = grandTotal / currentOrder.dueDates!.length;
                    return (
                      <tr key={`due-${idx}`} className="h-8 bg-slate-50/50">
                        <td className="border-r border-slate-400">&nbsp;</td>
                        <td className="px-6 font-mono font-bold text-slate-800 border-r border-slate-400 text-sm">
                          {formatted} &nbsp; — &nbsp; {installmentVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="border-r border-slate-400">&nbsp;</td>
                        <td>&nbsp;</td>
                      </tr>
                    );
                  })
                ) : currentOrder.firstDueDate ? (
                  <tr className="h-8 bg-slate-50/50">
                    <td className="border-r border-slate-400">&nbsp;</td>
                    <td className="px-6 font-mono font-bold text-slate-800 border-r border-slate-400 text-sm">
                      {currentOrder.firstDueDate.split('-').reverse().slice(0, 2).join('/')} &nbsp; — &nbsp; {grandTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="border-r border-slate-400">&nbsp;</td>
                    <td>&nbsp;</td>
                  </tr>
                ) : null}

                {/* Previsão de entrega */}
                {currentOrder.delivery && (
                  <tr className="h-8">
                    <td className="border-r border-slate-400">&nbsp;</td>
                    <td className="px-2 font-medium text-xs text-slate-700 italic border-r border-slate-400">
                      🚚 Previsão de entrega: {currentOrder.delivery}
                      {currentOrder.note ? ` · Obs: ${currentOrder.note}` : ''}
                    </td>
                    <td className="border-r border-slate-400">&nbsp;</td>
                    <td>&nbsp;</td>
                  </tr>
                )}

                {/* Linhas pautadas em branco extras para manter a proporção do bloco físico */}
                {Array.from({ length: 4 }).map((_, i) => (
                  <tr key={`blank-${i}`} className="h-8">
                    <td className="border-r border-slate-400">&nbsp;</td>
                    <td className="border-r border-slate-400">&nbsp;</td>
                    <td className="border-r border-slate-400">&nbsp;</td>
                    <td>&nbsp;</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Rodapé: Assinatura, Visto e Totalizador */}
            <table className="w-full border-collapse border border-slate-800 text-xs">
              <tbody>
                <tr>
                  <td className="w-2/5 p-2 border-r border-slate-800 align-top">
                    <div className="text-[10px] text-slate-600 font-semibold mb-6">
                      Comprador: <span className="font-bold text-slate-900">{currentClient?.buyer || '—'}</span>
                    </div>
                    <div className="border-b border-slate-900 w-11/12 mx-auto"></div>
                  </td>
                  <td className="w-1/4 p-2 border-r border-slate-800 align-top">
                    <div className="text-[10px] text-slate-600 font-semibold mb-6">Visto:</div>
                    <div className="border-b border-slate-900 w-4/5 mx-auto"></div>
                  </td>
                  <td className="w-1/3 p-2 text-right align-top bg-sky-50/40">
                    <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                      Valor total do pedido
                    </div>
                    <div className="text-xl sm:text-2xl font-black text-[#0284c7]">
                      {money(grandTotal)}
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Tarja Inferior de Responsabilidade (Legal do Bloco) */}
            <div className="bg-[#0284c7] text-white text-center py-1.5 px-3 font-bold text-[10px] uppercase tracking-wider border-x border-b border-slate-800">
              As mercadorias viajam por conta e risco do(s) comprador(es).
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-12 bg-card border border-border/80 rounded-xl">
          <p className="text-muted-foreground text-sm">Nenhum pedido encontrado para exibição do talão.</p>
        </div>
      )}
    </div>
  );
}
