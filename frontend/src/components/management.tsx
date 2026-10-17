import { useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Building2, Calculator, Check, CheckCheck, ChevronDown, Download, Info, Package, Plus, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { SpotlightCard } from '@/components/ui/spotlight-card';
import { Tooltip as UiTooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { financials, money, registerImportBatchApi } from '@/lib/business';
import type { SharedProps } from './seller';

const propertyImage = 'https://images.unsplash.com/photo-1541888946425-d0fbb186156f?auto=format&fit=crop&w=1200&q=80';

const properties = [
  { id: 'p1', name: 'Apartamento · Vila Mariana', address: 'Rua Domingos de Morais, 2187', tenant: 'Fernanda Oliveira', rent: 4200, fee: 8, index: 'IPCA', renewal: 'Outubro', overdue: true },
  { id: 'p2', name: 'Sala comercial · Mooca', address: 'Rua da Mooca, 1540', tenant: 'Studio Arquitetura Ltda.', rent: 2800, fee: 8, index: 'IGP-M', renewal: 'Março', overdue: false },
  { id: 'p3', name: 'Apartamento · Ipiranga', address: 'Rua Silva Bueno, 880', tenant: 'Pedro Martins', rent: 3500, fee: 10, index: 'IPCA', renewal: 'Julho', overdue: false },
];
export function Management({ module, data, update, notify }: SharedProps & { module: string }) {
  const [fx, setFx] = useState(5.42);
  const [freight, setFreight] = useState(1800);
  const [broker, setBroker] = useState(2400);
  const [taxes, setTaxes] = useState([2400, 1200, 850, 3200]);
  const [quantities, setQuantities] = useState([100, 50, 200]);
  const [fob, setFob] = useState([800, 900, 700]);
  const fobTotal = fob.reduce((a, b) => a + b, 0);
  const shared = freight * fx + broker + taxes.reduce((a, b) => a + b, 0);
  const landed = fob.map((v, i) => (quantities[i] ?? 0) > 0 ? (v * fx + shared * (fobTotal > 0 ? v / fobTotal : 0)) / (quantities[i] ?? 1) : 0);
  const [period, setPeriod] = useState('Últimos 6 meses');
  const rentNet = properties.reduce((a, p) => a + p.rent * (1 - p.fee / 100), 0);
  const sales = data.orders.filter(o => o.status === 'FATURADO').reduce((a, o) => a + financials(o.items).profit, 0);
  const chartData = (period === 'Últimos 6 meses' ? ['Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out'] : ['Jul', 'Ago', 'Set', 'Out']).map((month, i, a) => ({ month, vendas: i === a.length - 1 ? sales : [6300, 9200, 7800, 12400, 15200][i], aluguéis: rentNet }));
  if (module === 'import')
    return (
      <>
        <PageHeading
          eyebrow="COMÉRCIO EXTERIOR"
          title="Calculadora de importação"
          description="Do valor de compra na origem (FOB) ao custo real nacionalizado de cada unidade."
        />
        <div className="import-layout">
          <section>
            <div className="section-heading">
              <h3>Dados do novo lote</h3>
              <span className="status-badge neutral">
                {data.backendConnected ? 'Integrado ao Estoque' : 'Simulação'}
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
            <h3 className="mt-8 mb-4">Mercadorias do lote</h3>
            <div className="import-items">
              {data.products.map((p, i) => (
                <div key={p.id}>
                  <div className={`sku-symbol sku-${p.id.toLowerCase()}`}>
                    <Package size={20} />
                  </div>
                  <strong>{p.name}</strong>
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
                              É o <strong>preço de compra da mercadoria no porto/país de origem</strong> (em dólares / US$), sem o frete internacional nem impostos. É o valor puro do lote antes dos custos de nacionalização.
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
                    Quantidade
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
            <h3 className="mt-3">Landed cost</h3>
            <span className="text-xs text-muted-foreground">Custo total nacionalizado</span>
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
                  <span>{p.name} · por unidade</span>
                  <b className="numeric">{money(landed[i] ?? 0)}</b>
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
                  notify('Lote registrado no servidor. Estoque físico e Landed Cost atualizados.');
                } catch {
                  update({
                    ...data,
                    products: data.products.map((p, i) => ({
                      ...p,
                      physical: p.physical + (quantities[i] ?? 0),
                      cost: landed[i] ?? p.cost,
                    })),
                  });
                  notify('Lote aplicado. Estoque e custos atualizados.');
                }
              }}
            >
              <Plus />
              Aplicar lote ao estoque
            </Button>
            <p className="text-xs text-muted-foreground mt-4 leading-relaxed">
              Rateio proporcional ao valor de compra na origem (FOB) de cada produto.
            </p>
          </aside>
        </div>
      </>
    );
  if (module === 'property') return <><PageHeading eyebrow="GESTÃO PATRIMONIAL" title="Seu patrimônio, em dia." description="Acompanhe aluguéis, reajustes e repasses da administradora." action={<span className="status-badge neutral">Outubro 2026<ChevronDown size={13} /></span>} /><div className="property-banner"><img src={propertyImage} width={1152} height={576} alt="Edifícios residenciais em São Paulo" /><div><span className="eyebrow">CARTEIRA DE IMÓVEIS</span><h2>Um olhar claro sobre<br />cada investimento.</h2><span>São Paulo · 3 imóveis alugados</span></div></div><div className="metric-grid three mt-6"><Metric label="Receita bruta mensal" value={money(10500)} icon={<Building2 />} /><Metric label="Repasse líquido" value={money(rentNet)} icon={<ArrowDownLeft />} /><Metric label="Conciliações realizadas" value={`${data.reconciled.length} / 3`} icon={<CheckCheck />} /></div><div className="section-heading mt-8"><h3>Auditoria de repasses</h3><span className="text-xs text-muted-foreground">Administradora · Outubro 2026</span></div><div className="table-scroll"><table className="data-table property-table"><thead><tr><th>Imóvel / locatário</th><th>Aluguel</th><th>Taxa</th><th>Repasse líquido</th><th>Reajuste</th><th>Conciliação</th></tr></thead><tbody>{properties.map(p => <tr key={p.id}><td><strong>{p.name}</strong><p>{p.tenant}</p></td><td className="numeric">{money(p.rent)}</td><td className="numeric">{p.fee}%</td><td className="numeric">{money(p.rent * (1 - p.fee / 100))}</td><td><span className={`status-badge ${p.overdue ? 'warning' : 'neutral'}`}>{p.index} · {p.renewal}</span></td><td><Button variant="outline" size="sm" onClick={() => update({ ...data, reconciled: data.reconciled.includes(p.id) ? data.reconciled.filter(id => id !== p.id) : [...data.reconciled, p.id] })}>{data.reconciled.includes(p.id) ? <><Check />Conciliado</> : 'Conciliar'}</Button></td></tr>)}</tbody></table></div><p className="text-xs text-muted-foreground mt-4">Valores e imóveis demonstrativos.</p></>;
  return <><PageHeading eyebrow="VISÃO EXECUTIVA" title="Tudo conectado. Uma visão." description="O resultado da importadora e do patrimônio, lado a lado." action={<select className="form-input period-select" value={period} onChange={e => setPeriod(e.target.value)}><option>Últimos 6 meses</option><option>Últimos 4 meses</option></select>} /><div className="metric-grid three"><Metric label="Caixa consolidado · outubro" value={money(sales + rentNet)} icon={<TrendingUp />} /><Metric label="Lucro líquido · importadora" value={money(sales)} icon={<Package />} /><Metric label="Receita líquida · aluguéis" value={money(rentNet)} icon={<Building2 />} /></div><section className="executive-chart mt-3"><div className="section-heading"><div><h3>Evolução de resultados</h3><p className="text-xs text-muted-foreground mt-0.5">Receita líquida por unidade de negócio</p></div><div className="chart-legend"><span><i className="sales-dot" />Importadora</span><span><i className="rent-dot" />Patrimônio</span></div></div><ResponsiveContainer width="100%" height={180}><AreaChart data={chartData} margin={{ top: 15, right: 15, left: 10, bottom: 5 }}><CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" /><XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} /><YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }} tickFormatter={v => `${v / 1000}k`} /><Tooltip formatter={(v: number) => money(v)} contentStyle={{ background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 6 }} /><Area type="monotone" dataKey="vendas" stroke="var(--primary)" fill="var(--accent)" strokeWidth={2} /><Area type="monotone" dataKey="aluguéis" stroke="var(--success)" fill="var(--success-soft)" strokeWidth={2} /></AreaChart></ResponsiveContainer></section><div className="executive-bottom"><section><div className="section-heading"><h3>Composição do caixa</h3><ArrowUpRight size={15} /></div><div className="composition-row"><span className="metric-icon"><Package /></span><div><strong>Importadora</strong><p>{data.orders.filter(o => o.status === 'FATURADO').length} pedidos faturados</p></div><b className="numeric">{money(sales)}</b></div><div className="composition-row"><span className="metric-icon green"><Building2 /></span><div><strong>Patrimônio</strong><p>3 imóveis · competência outubro</p></div><b className="numeric">{money(rentNet)}</b></div></section><section><div className="section-heading"><h3>Precisam da sua atenção</h3><span className="status-badge warning">2 itens</span></div><div className="attention-row"><span className="attention-dot" /><div><strong>Fila de conferência</strong><p>{data.orders.filter(o => o.status === 'AGUARDANDO_REVISAO').length} pedidos aguardando sua revisão</p></div></div><div className="attention-row"><span className="attention-dot" /><div><strong>Reajuste de aluguel</strong><p>Vila Mariana · IPCA em outubro</p></div></div></section></div></>;
}
export function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  if (!action) return null;
  return <div className="flex justify-end items-center mb-2">{action}</div>;
}
export function Metric({ label, value, icon, footer }: { label: string; value: React.ReactNode; icon: React.ReactNode; footer?: React.ReactNode }) { return <SpotlightCard className="metric-card" spotlightColor="rgba(67, 97, 238, 0.12)"><div className="flex items-center justify-between"><span>{label}</span><span className="metric-icon">{icon}</span></div><h2 className="numeric">{value}</h2><div className="metric-footer">{footer ?? <span className="text-muted-foreground">Competência de outubro</span>}</div></SpotlightCard>; }