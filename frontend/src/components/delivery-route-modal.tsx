import React, { useState, useMemo } from 'react';
import {
  Truck,
  Calendar,
  MapPin,
  Package,
  Printer,
  Share2,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Search,
  Users,
  Layers,
  ArrowRight,
  Sparkles,
  Phone,
  FileCheck2,
  DollarSign,
  AlertCircle,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Order,
  Client,
  Product,
  AppData,
  itemDq,
  orderTotalDq,
  money,
  FREIGHT_PER_SACK_BRL,
} from '@/lib/business';
import { openPrintableRomaneio, buildWhatsAppOrderShareUrl } from '@/lib/documentPrint';

interface DeliveryRouteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: AppData;
  onSelectOrder?: (order: Order) => void;
  isExpedicao?: boolean;
}

export function DeliveryRouteModal({
  open,
  onOpenChange,
  data,
  onSelectOrder,
  isExpedicao = false,
}: DeliveryRouteModalProps) {
  const [activeTab, setActiveTab] = useState<'next' | 'other' | 'all'>('next');
  const [searchTerm, setSearchTerm] = useState('');

  // Identificação de status efetivo
  const getStatus = (o: Order) => o.rawStatus || o.status;

  // Pedidos que fazem parte da expedição física (Em separação, Faturados ou Aguardando conferência)
  const activeOrders = useMemo(() => {
    return data.orders.filter(o => {
      const st = getStatus(o);
      return st === 'EM_SEPARACAO' || st === 'FATURADO' || st === 'AGUARDANDO_REVISAO';
    });
  }, [data.orders]);

  // Identifica as janelas de entrega presentes
  const deliveryWindows = useMemo(() => {
    const counts: Record<string, number> = {};
    activeOrders.forEach(o => {
      const d = (o.delivery || 'Próxima Entrega').trim();
      counts[d] = (counts[d] || 0) + 1;
    });
    return counts;
  }, [activeOrders]);

  // Define a janela "principal / próxima entrega" (geralmente Amanhã / Manhã ou a mais frequente)
  const primaryDeliveryWindow = useMemo(() => {
    const keys = Object.keys(deliveryWindows);
    if (keys.length === 0) return 'Amanhã (Manhã)';
    const nextKey = keys.find(k => k.toLowerCase().includes('amanhã') || k.toLowerCase().includes('manhã'));
    return nextKey || keys[0];
  }, [deliveryWindows]);

  // Separação em Próxima Entrega vs Outras Entregas
  const { nextDeliveryOrders, otherDeliveryOrders } = useMemo(() => {
    const next: Order[] = [];
    const other: Order[] = [];

    activeOrders.forEach(o => {
      const d = (o.delivery || 'Próxima Entrega').trim();
      if (d === primaryDeliveryWindow || d.toLowerCase().includes('manhã') || d.toLowerCase().includes('amanhã')) {
        next.push(o);
      } else {
        other.push(o);
      }
    });

    // Se a próxima não tiver nada mas tiver outras, balancear
    if (next.length === 0 && other.length > 0) {
      return { nextDeliveryOrders: other, otherDeliveryOrders: [] };
    }

    return { nextDeliveryOrders: next, otherDeliveryOrders: other };
  }, [activeOrders, primaryDeliveryWindow]);

  // Pedidos da aba ativa
  const currentTabOrders = useMemo(() => {
    let list: Order[] = [];
    if (activeTab === 'next') list = nextDeliveryOrders;
    else if (activeTab === 'other') list = otherDeliveryOrders;
    else list = activeOrders;

    if (!searchTerm.trim()) return list;

    const query = searchTerm.toLowerCase();
    return list.filter(o => {
      const client = data.clients.find(c => c.id === o.clientId);
      return (
        o.id.toLowerCase().includes(query) ||
        (client?.name.toLowerCase().includes(query) ?? false) ||
        (client?.neighborhood.toLowerCase().includes(query) ?? false) ||
        (client?.buyer.toLowerCase().includes(query) ?? false) ||
        (o.delivery && o.delivery.toLowerCase().includes(query))
      );
    });
  }, [activeTab, nextDeliveryOrders, otherDeliveryOrders, activeOrders, searchTerm, data.clients]);

  // Estatísticas consolidadas para a lista exibida
  const stats = useMemo(() => {
    const list = currentTabOrders;
    const totalSacks = list.reduce((acc, o) => acc + orderTotalDq(o.items), 0);
    const totalWeightKg = totalSacks * 25;
    const estimatedFreight = totalSacks * FREIGHT_PER_SACK_BRL;
    const clientIds = new Set(list.map(o => o.clientId));

    // Quebra por SKU (DQ)
    const skuMap: Record<string, { name: string; sacks: number; weight: number }> = {};
    data.products.forEach(p => {
      skuMap[p.id] = { name: p.name, sacks: 0, weight: 0 };
    });

    list.forEach(o => {
      o.items.forEach(item => {
        const dq = itemDq(item);
        if (skuMap[item.productId]) {
          skuMap[item.productId].sacks += dq;
          skuMap[item.productId].weight += dq * 25;
        }
      });
    });

    const readyOrders = list.filter(o => {
      const st = getStatus(o);
      return st === 'EM_SEPARACAO' || st === 'FATURADO';
    });
    const readySacks = readyOrders.reduce((acc, o) => acc + orderTotalDq(o.items), 0);

    return {
      totalSacks,
      totalWeightKg,
      estimatedFreight,
      stopsCount: clientIds.size,
      ordersCount: list.length,
      skuBreakdown: Object.entries(skuMap).map(([id, val]) => ({ id, ...val })),
      readySacks,
    };
  }, [currentTabOrders, data.products]);

  // Impressão consolidada da rota inteira (Manifesto Geral)
  const handlePrintRouteManifest = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const dateStr = new Date().toLocaleDateString('pt-BR');
    const tabLabel =
      activeTab === 'next'
        ? `Próxima Entrega (${primaryDeliveryWindow})`
        : activeTab === 'other'
        ? 'Outras Entregas Programadas'
        : 'Todas as Entregas da Rota';

    const skuLines = stats.skuBreakdown
      .map(
        sku => `
        <tr style="height: 32px;">
          <td style="font-weight: 600;">${sku.name}</td>
          <td class="center">SACAS (25kg)</td>
          <td class="right font-bold" style="font-size: 13pt; color: #0f172a;">${sku.sacks}</td>
          <td class="right">${sku.weight.toLocaleString('pt-BR')} kg</td>
          <td class="center"><div style="width: 20px; height: 20px; border: 1.5px solid #334155; margin: auto; border-radius: 4px;"></div></td>
        </tr>
      `
      )
      .join('');

    const stopRows = currentTabOrders
      .map((order, idx) => {
        const client = data.clients.find(c => c.id === order.clientId);
        const orderSacks = orderTotalDq(order.items);
        const itemsDetail = order.items
          .filter(i => itemDq(i) > 0)
          .map(i => {
            const p = data.products.find(prod => prod.id === i.productId);
            const shortName = p?.name.includes('Pão Doce')
              ? 'Pão Doce'
              : p?.name.includes('Pré-Mistura')
              ? 'Pré-Mistura'
              : 'Tipo 1';
            return `<b>${itemDq(i)}sc</b> ${shortName}`;
          })
          .join(' · ');

        return `
          <tr style="height: 40px; page-break-inside: avoid;">
            <td class="center" style="font-weight: bold; font-size: 11pt;">${idx + 1}</td>
            <td class="center font-bold">#${order.id}</td>
            <td>
              <div style="font-weight: bold; font-size: 10pt;">${client?.name || 'Cliente'}</div>
              <div style="font-size: 8.5pt; color: #475569;">${client?.neighborhood || 'São Paulo'} · Contato: ${client?.buyer || '-'}</div>
              ${order.note ? `<div style="font-size: 8pt; color: #b45309; font-weight: 600;">Obs: ${order.note}</div>` : ''}
            </td>
            <td class="center" style="font-size: 9pt;">${order.delivery || 'Manhã'}</td>
            <td style="font-size: 9pt;">${itemsDetail}</td>
            <td class="right font-bold" style="font-size: 12pt;">${orderSacks} sc</td>
            <td class="center" style="font-size: 9pt;">${orderSacks * 25} kg</td>
            <td class="center"><div style="width: 22px; height: 22px; border: 1.5px solid #334155; margin: auto; border-radius: 4px;"></div></td>
          </tr>
        `;
      })
      .join('');

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Manifesto de Carga e Rota de Entrega — Total Trigo</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 9.5pt; color: #0f172a; background: #fff; padding: 15px; }
    .no-print { background: #0284c7; color: #fff; padding: 12px 20px; border-radius: 8px; margin-bottom: 15px; display: flex; align-items: center; justify-content: space-between; }
    .no-print button { background: #0369a1; color: #fff; border: 1px solid #bae6fd; padding: 8px 20px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 11pt; }
    .header-box { border: 2px solid #0f172a; padding: 12px; margin-bottom: 12px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; }
    .company-title { font-size: 15pt; font-weight: 800; color: #0f172a; }
    .badge { display: inline-block; background: #e0f2fe; color: #0369a1; padding: 4px 10px; border-radius: 6px; font-weight: 700; font-size: 10pt; }
    .stats-strip { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 12px; }
    .stat-card { border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 12px; background: #f8fafc; }
    .stat-lbl { font-size: 7.5pt; text-transform: uppercase; color: #64748b; font-weight: bold; }
    .stat-val { font-size: 13pt; font-weight: bold; color: #0f172a; margin-top: 2px; }
    table.data-table { width: 100%; border-collapse: collapse; margin-top: 8px; margin-bottom: 12px; }
    table.data-table th, table.data-table td { border: 1px solid #64748b; padding: 5px 8px; }
    table.data-table th { background: #f1f5f9; text-transform: uppercase; font-size: 8pt; font-weight: bold; }
    .center { text-align: center; }
    .right { text-align: right; }
    .font-bold { font-weight: bold; }
    .section-title { font-size: 11pt; font-weight: bold; margin-top: 14px; margin-bottom: 6px; color: #1e293b; display: flex; align-items: center; gap: 6px; }
    .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px; page-break-inside: avoid; }
    .sig-box { border: 1px solid #94a3b8; border-radius: 6px; padding: 10px; height: 95px; display: flex; flex-direction: column; justify-content: space-between; }
    .sig-line { border-top: 1px solid #000; margin-top: 15px; text-align: center; font-size: 8pt; padding-top: 2px; }
    @media print {
      .no-print { display: none !important; }
      body { padding: 0; font-size: 9pt; }
      @page { size: A4 portrait; margin: 8mm; }
    }
  </style>
</head>
<body>

  <div class="no-print">
    <div>
      <strong style="font-size: 13pt;">Manifesto de Carga & Rota de Entrega</strong>
      <div style="font-size: 9pt; color: #e0f2fe;">Total Trigo Comércio de Alimentos LTDA · Expedição DQ</div>
    </div>
    <div>
      <button onclick="window.print()">Imprimir Manifesto da Rota</button>
    </div>
  </div>

  <div class="header-box">
    <div>
      <div class="company-title">TOTAL TRIGO — MANIFESTO CONSOLIDADO DE EXPEDIÇÃO</div>
      <div style="font-size: 9pt; color: #475569;">Distribuição Atacadista de Farinhas e Pré-Misturas em Sacos de 25kg</div>
    </div>
    <div class="right">
      <div class="badge">${tabLabel}</div>
      <div style="font-size: 8.5pt; margin-top: 4px; color: #64748b;">Emissão: ${dateStr}</div>
    </div>
  </div>

  <div class="stats-strip">
    <div class="stat-card">
      <div class="stat-lbl">Volume Total (DQ)</div>
      <div class="stat-val">${stats.totalSacks} sacas</div>
    </div>
    <div class="stat-card">
      <div class="stat-lbl">Peso Bruto</div>
      <div class="stat-val">${stats.totalWeightKg.toLocaleString('pt-BR')} kg (${(stats.totalWeightKg / 1000).toFixed(2)} t)</div>
    </div>
    <div class="stat-card">
      <div class="stat-lbl">Paradas / Clientes</div>
      <div class="stat-val">${stats.stopsCount} locais (${stats.ordersCount} pedidos)</div>
    </div>
    <div class="stat-card">
      <div class="stat-lbl">Frete Estimado (R$ 4/sc)</div>
      <div class="stat-val">${money(stats.estimatedFreight)}</div>
    </div>
  </div>

  <div class="section-title">Consolidação da Carga do Caminhão (Por Produto / SKU)</div>
  <table class="data-table">
    <thead>
      <tr>
        <th style="width: 50%; text-align: left;">Descrição do Produto</th>
        <th style="width: 15%;">Embalagem</th>
        <th style="width: 12%; text-align: right;">Sacas</th>
        <th style="width: 13%; text-align: right;">Peso Total</th>
        <th style="width: 10%;">Carregado</th>
      </tr>
    </thead>
    <tbody>
      ${skuLines}
    </tbody>
  </table>

  <div class="section-title">Roteiro de Paradas e Pedidos Programados (${currentTabOrders.length} Entregas)</div>
  <table class="data-table">
    <thead>
      <tr>
        <th style="width: 4%;">#</th>
        <th style="width: 9%;">Pedido</th>
        <th style="width: 33%; text-align: left;">Cliente & Local</th>
        <th style="width: 11%;">Janela</th>
        <th style="width: 23%; text-align: left;">Produtos / Sacas</th>
        <th style="width: 8%; text-align: right;">Total</th>
        <th style="width: 7%; text-align: right;">Peso</th>
        <th style="width: 5%;">Entregue</th>
      </tr>
    </thead>
    <tbody>
      ${stopRows}
    </tbody>
  </table>

  <div class="signatures">
    <div class="sig-box">
      <div class="stat-lbl">Conferência e Liberação de Carga (Galpão)</div>
      <div style="font-size: 8pt; color: #475569;">Carga conferida no galpão Total Trigo e carregada no caminhão conforme as sacas acima.</div>
      <div class="sig-line">Conferente de Expedição (Data: ___/___/______)</div>
    </div>
    <div class="sig-box">
      <div class="stat-lbl">Aceite do Transportador / Motorista</div>
      <div style="font-size: 8pt; color: #475569;">Assumo a responsabilidade pelo transporte e integridade das sacas para o roteiro indicado.</div>
      <div class="sig-line">Motorista / Transportador (Placa: _______________)</div>
    </div>
  </div>

</body>
</html>`;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  // Enviar resumo de toda a rota via WhatsApp para o motorista
  const handleShareRouteWhatsApp = () => {
    let text = `*TOTAL TRIGO — ROTA DE ENTREGA & EXPEDIÇÃO*\n`;
    text += `*Janela:* ${activeTab === 'next' ? primaryDeliveryWindow : 'Entregas Programadas'}\n`;
    text += `*Carga Total:* ${stats.totalSacks} sacas (${(stats.totalWeightKg / 1000).toFixed(2)} t)\n`;
    text += `*Paradas:* ${stats.stopsCount} clientes (${currentTabOrders.length} pedidos)\n\n`;

    text += `*CARGA GERAL DO CAMINHÃO:*\n`;
    stats.skuBreakdown.forEach(s => {
      if (s.sacks > 0) {
        text += `• ${s.sacks} sacas — ${s.name}\n`;
      }
    });

    text += `\n*ROTEIRO DE PARADAS:*\n`;
    currentTabOrders.forEach((o, i) => {
      const c = data.clients.find(cl => cl.id === o.clientId);
      const totalSacks = orderTotalDq(o.items);
      text += `${i + 1}. *#${o.id} - ${c?.name || 'Cliente'}*\n`;
      text += `   • ${c?.neighborhood || 'São Paulo'} (Prev: ${o.delivery || 'Manhã'})\n`;
      text += `   • ${totalSacks} sacas | Contato: ${c?.buyer || '-'}\n`;
      if (o.note) text += `   • Obs: ${o.note}\n`;
    });

    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0 border-border bg-card shadow-2xl">
        {/* Cabeçalho do Modal */}
        <div className="p-5 pb-4 border-b border-border bg-muted/20">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center size-10 rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
                <Truck size={20} />
              </div>
              <div>
                <DialogTitle className="text-base md:text-lg font-bold flex items-center gap-2">
                  <span>Planejamento e Romaneio de Cargas</span>
                  <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-primary/10 text-primary border border-primary/20">
                    Expedição DQ
                  </span>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Consolidação logística de entrega, paradas por cliente e distribuição das sacas no caminhão.
                </DialogDescription>
              </div>
            </div>

            {/* Ações Rápidas no Header */}
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5 border-border hover:bg-muted"
                onClick={handleShareRouteWhatsApp}
                title="Compartilhar resumo da rota com o motorista"
              >
                <Share2 size={13} className="text-emerald-600 dark:text-emerald-400" />
                <span className="hidden sm:inline">WhatsApp Rota</span>
              </Button>
              <Button
                size="sm"
                className="h-8 text-xs gap-1.5 bg-primary text-primary-foreground font-semibold shadow-xs hover:opacity-95"
                onClick={handlePrintRouteManifest}
                disabled={currentTabOrders.length === 0}
              >
                <Printer size={13} />
                <span>Imprimir Manifesto ({stats.totalSacks} sc)</span>
              </Button>
            </div>
          </div>

          {/* Abas de Navegação das Entregas */}
          <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-3 border-t border-border/70">
            <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-lg border border-border/70 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('next')}
                className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                  activeTab === 'next'
                    ? 'bg-card text-foreground shadow-2xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Próxima Entrega ({nextDeliveryOrders.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('other')}
                className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                  activeTab === 'other'
                    ? 'bg-card text-foreground shadow-2xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Outras Programadas ({otherDeliveryOrders.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                  activeTab === 'all'
                    ? 'bg-card text-foreground shadow-2xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Todas as Cargas ({activeOrders.length})
              </button>
            </div>

            {/* Campo de Busca Rápida de Paradas */}
            <div className="relative w-full sm:w-64">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Filtrar por cliente, bairro..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full h-8 pl-8 pr-3 text-xs bg-card border border-border rounded-lg placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary"
              />
            </div>
          </div>
        </div>

        {/* Resumo de KPIs do Lote / Caminhão */}
        <div className="p-4 bg-muted/10 border-b border-border grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
          <div className="p-2.5 rounded-lg border border-border/70 bg-card">
            <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] font-medium">
              <Package size={13} className="text-primary" />
              <span>Volume Total</span>
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-xl font-bold tracking-tight text-foreground">{stats.totalSacks}</span>
              <span className="text-xs text-muted-foreground font-medium">sacas</span>
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              {stats.readySacks} sacas liberadas em separação
            </div>
          </div>

          <div className="p-2.5 rounded-lg border border-border/70 bg-card">
            <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] font-medium">
              <Layers size={13} className="text-primary" />
              <span>Peso Total</span>
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-xl font-bold tracking-tight text-foreground">
                {(stats.totalWeightKg / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-xs text-muted-foreground font-medium">toneladas</span>
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              {stats.totalWeightKg.toLocaleString('pt-BR')} kg no caminhão
            </div>
          </div>

          <div className="p-2.5 rounded-lg border border-border/70 bg-card">
            <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] font-medium">
              <MapPin size={13} className="text-primary" />
              <span>Paradas / Clientes</span>
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-xl font-bold tracking-tight text-foreground">{stats.stopsCount}</span>
              <span className="text-xs text-muted-foreground font-medium">locais</span>
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              Distribuídos em {stats.ordersCount} pedidos
            </div>
          </div>

          <div className="p-2.5 rounded-lg border border-border/70 bg-card">
            <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] font-medium">
              <DollarSign size={13} className="text-primary" />
              <span>Frete Estimado</span>
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-xl font-bold tracking-tight text-foreground">
                {money(stats.estimatedFreight)}
              </span>
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              Custo base R$ 4,00 por saca
            </div>
          </div>
        </div>

        {/* Quebra por SKU (Farinha Tipo 1, Pré-Mistura, Pão Doce) */}
        <div className="px-5 py-2.5 bg-card border-b border-border flex flex-wrap items-center gap-3 text-xs shrink-0">
          <span className="text-muted-foreground font-semibold text-[11px] uppercase tracking-wider flex items-center gap-1">
            <Sparkles size={12} className="text-amber-500" />
            Carga por Farinha:
          </span>
          {stats.skuBreakdown.map(sku => (
            <div
              key={sku.id}
              className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-muted/40 border border-border/80"
            >
              <span className="font-medium text-foreground text-[11px]">{sku.name}:</span>
              <strong className="text-primary font-bold text-xs">{sku.sacks} sc</strong>
              <span className="text-[10px] text-muted-foreground">({sku.weight} kg)</span>
            </div>
          ))}
        </div>

        {/* Lista de Pedidos e Paradas da Rota */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {currentTabOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
              <Truck size={32} className="opacity-40 mb-2" />
              <strong className="text-foreground text-sm font-semibold">Nenhuma entrega encontrada nesta visão</strong>
              <p className="text-xs mt-1 max-w-sm">
                Não há pedidos ativos programados com os filtros atuais. Selecione outra aba acima ou verifique os pedidos faturados.
              </p>
            </div>
          ) : (
            currentTabOrders.map((order, idx) => {
              const client = data.clients.find(c => c.id === order.clientId);
              const orderSacks = orderTotalDq(order.items);
              const st = getStatus(order);

              let badgeColor = 'bg-muted text-muted-foreground border-border';
              let badgeLabel = st;
              if (st === 'EM_SEPARACAO') {
                badgeColor = 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30';
                badgeLabel = 'Em Separação';
              } else if (st === 'FATURADO') {
                badgeColor = 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30';
                badgeLabel = 'Faturado';
              } else if (st === 'AGUARDANDO_REVISAO') {
                badgeColor = 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30';
                badgeLabel = 'Pré-Nota';
              }

              return (
                <div
                  key={order.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-muted/15 transition-all shadow-2xs group"
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="flex items-center justify-center size-8 rounded-lg bg-muted text-foreground font-bold text-xs shrink-0 border border-border">
                      {idx + 1}º
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <strong className="text-sm font-semibold text-foreground truncate">
                          {client?.name || `Cliente #${order.clientId}`}
                        </strong>
                        <span className="font-mono text-xs text-muted-foreground">#{order.id}</span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badgeColor}`}>
                          {badgeLabel}
                        </span>
                        {order.invoice && (
                          <span className="text-[10px] font-mono font-medium px-1.5 py-0.2 rounded bg-muted text-muted-foreground border border-border">
                            NF-e #{order.invoice}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                          <MapPin size={11} className="text-primary/70" />
                          <span>{client?.neighborhood || 'São Paulo - SP'}</span>
                        </span>
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          <Clock3 size={11} />
                          <span>Previsão: <strong className="text-foreground">{order.delivery || 'Manhã'}</strong></span>
                        </span>
                        {client?.buyer && (
                          <>
                            <span>·</span>
                            <span>Contato: <strong>{client.buyer}</strong></span>
                          </>
                        )}
                      </div>

                      {/* Itens do Pedido */}
                      <div className="flex flex-wrap items-center gap-2 mt-2 pt-1.5 border-t border-border/50 text-xs">
                        {order.items
                          .filter(i => itemDq(i) > 0)
                          .map(i => {
                            const p = data.products.find(prod => prod.id === i.productId);
                            const name = p?.name.includes('Pão Doce')
                              ? 'Pão Doce'
                              : p?.name.includes('Pré-Mistura')
                              ? 'Pré-Mistura'
                              : 'Tipo 1';
                            return (
                              <span
                                key={i.productId}
                                className="px-2 py-0.5 rounded bg-muted/50 border border-border/60 text-[11px] font-medium text-foreground"
                              >
                                <strong>{itemDq(i)}</strong> sacas {name}
                              </span>
                            );
                          })}
                        <span className="text-muted-foreground text-[11px]">
                          (Total: <strong className="text-foreground">{orderSacks} sc</strong> · {orderSacks * 25} kg)
                        </span>
                      </div>

                      {order.note && (
                        <div className="text-[11px] text-amber-700 dark:text-amber-400 mt-1 font-medium bg-amber-500/5 px-2 py-0.5 rounded border border-amber-500/20 flex items-center gap-1.5">
                          <AlertCircle size={12} className="shrink-0 text-amber-600 dark:text-amber-400" />
                          <span>Obs: {order.note}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Ações da Parada */}
                  <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs gap-1 border-border hover:bg-muted"
                      onClick={() => openPrintableRomaneio(order, client, data.products)}
                      title="Imprimir Romaneio Cego individual deste pedido"
                    >
                      <Printer size={12} />
                      <span className="hidden sm:inline">Romaneio</span>
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs gap-1 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
                      onClick={() => {
                        const url = buildWhatsAppOrderShareUrl(order, 'driver_romaneio', client, data.products);
                        window.open(url, '_blank');
                      }}
                      title="Enviar dados deste pedido para o motorista no WhatsApp"
                    >
                      <Phone size={12} />
                      <span className="hidden sm:inline">Zap Motorista</span>
                    </Button>

                    {onSelectOrder && (
                      <Button
                        variant="default"
                        size="sm"
                        className="h-8 text-xs gap-1 bg-primary text-primary-foreground font-semibold"
                        onClick={() => {
                          onOpenChange(false);
                          onSelectOrder(order);
                        }}
                        title="Conferir e editar este pedido na Mesa de Conferência"
                      >
                        <span>Conferir</span>
                        <ArrowRight size={12} />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Rodapé do Modal */}
        <div className="p-4 border-t border-border bg-muted/20 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-emerald-500" />
            <span>
              Mostrando <strong>{currentTabOrders.length}</strong> entregas ativas · <strong>{stats.totalSacks}</strong> sacas ({stats.totalWeightKg.toLocaleString('pt-BR')} kg)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs border-border"
              onClick={() => onOpenChange(false)}
            >
              Fechar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
