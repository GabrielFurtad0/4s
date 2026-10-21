import { useEffect, useState } from 'react';
import {
  Ban,
  Check,
  CheckCheck,
  ChevronLeft,
  Clock3,
  FileCheck2,
  FileText,
  Loader2,
  Package,
  Printer,
  Search,
  ShieldCheck,
  TriangleAlert,
  Truck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { CopyButton } from '@/components/ui/copy-button';
import { BorderBeam } from '@/components/ui/border-beam';
import { ShimmerButton } from '@/components/ui/shimmer-button';
import { ProfitGauge } from '@/components/ui/profit-gauge';
import { fireConfetti } from '@/components/ui/confetti';
import {
  cancelOrderApi,
  cancelOrderLocal,
  completeFiscalViaCnpjApi,
  deliverOrderApi,
  deliverOrderLocal,
  editOrder,
  financials,
  fiscalReady,
  generatePickingApi,
  invoiceOrder,
  issueNfeApi,
  itemBq,
  itemDq,
  marginLevel,
  money,
  orderBaseValue,
  orderTotalBq,
  orderTotalDq,
  productLabel,
  reviewOrderApi,
  type AppData,
  type Item,
  type Order,
} from '@/lib/business';
import {
  openPrintableDanfe,
  openPrintableRomaneio,
  openPrintableOrderSlip,
} from '@/lib/documentPrint';

export function renderOrderStatusBadge(o: Order) {
  const st = o.rawStatus || o.status;
  if (st === 'ENTREGUE') {
    return (
      <span className="status-badge success">
        <CheckCheck size={12} />
        Entregue
      </span>
    );
  }
  if (st === 'FATURADO') {
    return (
      <span className="status-badge success">
        <CheckCheck size={12} />
        Faturado
      </span>
    );
  }
  if (st === 'CANCELADO') {
    return (
      <span className="status-badge danger">
        <Ban size={12} />
        Cancelado
      </span>
    );
  }
  if (st === 'EM_SEPARACAO') {
    return (
      <span className="status-badge warning">
        <Truck size={12} />
        Em separação
      </span>
    );
  }
  return (
    <span className="status-badge warning">
      <Clock3 size={12} />
      Em revisão
    </span>
  );
}

export interface OrderDetailsModalProps {
  order: Order | null;
  onClose: () => void;
  data: AppData;
  update: (next: AppData) => void;
  notify: (message: string) => void;
  isExpedicao?: boolean;
}

export function OrderDetailsModal({
  order,
  onClose,
  data,
  update,
  notify,
  isExpedicao = false,
}: OrderDetailsModalProps) {
  const [editing, setEditing] = useState(false);
  const [editItems, setEditItems] = useState<Item[]>([]);
  const [packing, setPacking] = useState(false);
  const [customPackingText, setCustomPackingText] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (order) {
      setEditing(false);
      setPacking(false);
      setCustomPackingText(null);
      setBusy(false);
      setEditItems(
        order.items.map(i => ({
          ...i,
          dispatchQuantity: itemDq(i),
          baseQuantity: itemBq(i),
        }))
      );
    }
  }, [order?.id]);

  if (!order) return null;

  const selectedClient = data.clients.find(c => c.id === order.clientId);
  const effectiveStatus = (o: Order) => o.rawStatus || o.status;
  const selectedEffectiveStatus = effectiveStatus(order);
  const isLockedOrder =
    selectedEffectiveStatus === 'FATURADO' ||
    selectedEffectiveStatus === 'ENTREGUE' ||
    selectedEffectiveStatus === 'CANCELADO';

  const activeModalItems = editing ? editItems : order.items;
  const modalFin = financials(activeModalItems);
  const modalTotalDq = orderTotalDq(activeModalItems);
  const modalTotalBq = orderTotalBq(activeModalItems);
  const modalBaseValue = orderBaseValue(activeModalItems);

  const fallbackPackingText =
    order && selectedClient
      ? `ROMANEIO DE SEPARAÇÃO & ENTREGA #${order.id}\n${selectedClient.name}\n${selectedClient.neighborhood}, São Paulo - SP\nComprador: ${selectedClient.buyer}\nEntrega: ${order.delivery}\n\nCARGA PARA SEPARAR NO GALPÃO (DQ):\n${order.items
          .filter(i => itemDq(i) > 0)
          .map(i => `• ${itemDq(i)} sacas (${itemDq(i) * 25} kg) — ${productLabel(data, i.productId)}`)
          .join('\n')}\n\nVolume Total (DQ): ${orderTotalDq(order.items)} sacas (${orderTotalDq(order.items) * 25} kg)\nObs: ${order.note || 'Sem observações'}`
      : '';
  const packingText = customPackingText || fallbackPackingText;

  return (
    <Dialog
      open={Boolean(order)}
      onOpenChange={open => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="order-dialog">
        <DialogTitle>{packing ? 'Romaneio Cego de Separação (DQ)' : `Pedido #${order.id}`}</DialogTitle>
        <DialogDescription>
          {selectedClient?.name} · {selectedClient?.neighborhood}
        </DialogDescription>
        {selectedClient && (
          <>
            {packing ? (
              <>
                <pre className="packing-sheet">{packingText}</pre>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setPacking(false)}>
                    <ChevronLeft />
                    Voltar
                  </Button>
                  <CopyButton
                    textToCopy={packingText}
                    label="Copiar para WhatsApp"
                    copiedLabel="Romaneio Copiado!"
                    withConfetti={true}
                    onCopied={() => notify('Romaneio cego (DQ) copiado para enviar à equipe do galpão.')}
                  />
                </div>
              </>
            ) : (
              <>
                <div className={`fiscal-notice ${fiscalReady(selectedClient) ? 'complete' : ''}`}>
                  <div className="flex items-center gap-2">
                    {fiscalReady(selectedClient) ? <ShieldCheck size={18} /> : <TriangleAlert size={18} />}
                    <div>
                      <strong>{fiscalReady(selectedClient) ? 'Pronto para SEFAZ' : 'Dados fiscais pendentes'}</strong>
                      <p>
                        {fiscalReady(selectedClient)
                          ? `${selectedClient.cnpj} · IE ${selectedClient.ie} · IBGE ${selectedClient.ibge}`
                          : 'CNPJ, Inscrição Estadual ou código IBGE pendentes.'}
                      </p>
                    </div>
                  </div>
                  {!fiscalReady(selectedClient) && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      className="relative overflow-hidden group shadow-xs border-amber-500/30 text-amber-700 dark:text-amber-300"
                      onClick={async () => {
                        setBusy(true);
                        try {
                          const { nextData, message } = await completeFiscalViaCnpjApi(data, order.id, selectedClient);
                          update(nextData);
                          fireConfetti();
                          notify(message);
                        } catch (e) {
                          notify(
                            e instanceof Error
                              ? e.message
                              : 'Não foi possível consultar o CNPJ: verifique se o servidor está conectado.'
                          );
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      <BorderBeam size={80} duration={6} colorFrom="#4361EE" colorTo="#F59E0B" />
                      {busy ? <Loader2 className="animate-spin" /> : <Search />}
                      Completar via CNPJ
                    </Button>
                  )}
                </div>

                {/* Itens do Pedido com Qtd. Expedição (DQ), Qtd. Base (BQ) e Preço Unitário */}
                <div className="review-items">
                  {activeModalItems.map((i, index) => {
                    const dq = itemDq(i);
                    const bq = itemBq(i);
                    return (
                      <div key={i.productId}>
                        <span className={`sku-symbol sku-${i.productId.toLowerCase()}`}>
                          <Package size={19} />
                        </span>
                        <div>
                          <strong>{productLabel(data, i.productId)}</strong>
                          {!editing && (
                            <p className="text-[11px] text-muted-foreground numeric">
                              Expedição (DQ): <b>{dq} un.</b> · Base (BQ): <b>{bq} un.</b>
                            </p>
                          )}
                        </div>
                        {editing ? (
                          <div className="flex items-center gap-2 flex-wrap">
                            <label className="text-[10px] text-muted-foreground flex flex-col">
                              Qtd. Expedição (DQ)
                              <input
                                type="number"
                                className="form-input numeric w-20"
                                min="0"
                                aria-label={`Revisar quantidade ${i.productId}`}
                                value={dq}
                                onChange={e => {
                                  const nextDq = Math.max(0, Math.floor(Number(e.target.value) || 0));
                                  setEditItems(v =>
                                    v.map((item, j) =>
                                      j === index
                                        ? {
                                            ...item,
                                            quantity: nextDq,
                                            dispatchQuantity: nextDq,
                                            baseQuantity: Math.min(nextDq, itemBq(item)),
                                          }
                                        : item
                                    )
                                  );
                                }}
                              />
                            </label>
                            <label className="text-[10px] text-muted-foreground flex flex-col">
                              Qtd. Base (BQ)
                              <input
                                type="number"
                                className="form-input numeric w-20"
                                min="0"
                                max={dq}
                                aria-label={`Revisar base ${i.productId}`}
                                value={bq}
                                onChange={e => {
                                  const nextBq = Math.max(0, Math.min(dq, Math.floor(Number(e.target.value) || 0)));
                                  setEditItems(v =>
                                    v.map((item, j) =>
                                      j === index
                                        ? {
                                            ...item,
                                            baseQuantity: nextBq,
                                          }
                                        : item
                                    )
                                  );
                                }}
                              />
                            </label>
                            <label className="text-[10px] text-muted-foreground flex flex-col">
                              Preço Unit. (R$)
                              <input
                                type="number"
                                className="form-input numeric w-24"
                                min="0.01"
                                step="0.01"
                                aria-label={`Revisar preço ${i.productId}`}
                                value={i.price}
                                onChange={e =>
                                  setEditItems(v =>
                                    v.map((item, j) =>
                                      j === index ? { ...item, price: Number(e.target.value) } : item
                                    )
                                  )
                                }
                              />
                            </label>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs numeric">
                            {dq} × {money(i.price)}
                          </span>
                        )}
                        <b className="numeric">{money(dq * i.price)}</b>
                      </div>
                    );
                  })}
                </div>

                <div className="review-total">
                  <div>
                    <span>Total Expedição (DQ: {modalTotalDq} sacas)</span>
                    <p className="text-xs text-muted-foreground numeric">
                      Total Base (BQ: {modalTotalBq} sacas): {money(modalBaseValue)} · Imposto 8% (BQ): {money(modalFin.tax)} · Frete (R$ 4/saca): {money(modalFin.logistics)}
                    </p>
                  </div>
                  <h2 className="numeric">{money(modalFin.total)}</h2>
                </div>

                <div className="review-meta">
                  <div>
                    <span>Pagamento</span>
                    <strong>{order.payment}</strong>
                    {order.firstDueDate && (
                      <span className="block text-[10.5px] text-primary font-mono mt-0.5">
                        1ª parc: {order.firstDueDate.split('-').reverse().join('/')}
                        {order.dueDates && order.dueDates.length > 1 && (
                          <span className="text-muted-foreground font-sans"> ({order.dueDates.length}x a cada 7d)</span>
                        )}
                      </span>
                    )}
                  </div>
                  <div>
                    <span>Entrega prevista</span>
                    <strong>{order.delivery}</strong>
                  </div>
                  <div>
                    <span>Status Atual</span>
                    {renderOrderStatusBadge(order)}
                  </div>
                </div>

                {order.note && <p className="review-note">{order.note}</p>}

                {/* Profit Breakdown com o Anel Radial de Margem (Oculto para Perfil de Expedição) */}
                {!isExpedicao && (
                  <div className="review-profit flex items-center gap-4 bg-muted/30 p-3 rounded-lg border border-border/40">
                    <ProfitGauge margin={modalFin.margin} size={48} />
                    <div className="flex flex-col">
                      <span className="text-[10px] text-muted-foreground">Lucro líquido estimado</span>
                      <strong className="numeric text-base text-foreground">
                        {money(modalFin.profit)}
                      </strong>
                    </div>
                    <span className={`status-badge ml-auto ${marginLevel(modalFin.margin)}`}>
                      Margem: {modalFin.margin.toFixed(1)}%
                    </span>
                  </div>
                )}

                {(selectedEffectiveStatus === 'FATURADO' || selectedEffectiveStatus === 'ENTREGUE') && (
                  <div className="invoice-issued">
                    <div className="flex items-center gap-2">
                      <CheckCheck />
                      <strong>NF-e {order.invoice} emitida · SEFAZ Autorizada</strong>
                    </div>
                    <div className="flex items-center gap-2 my-2 bg-card/60 p-2 rounded border border-emerald-500/20">
                      <p className="numeric text-[11px] font-mono break-all select-all flex-1 m-0">
                        {order.key}
                      </p>
                      <CopyButton
                        textToCopy={order.key || ''}
                        iconOnly={true}
                        withConfetti={true}
                        title="Copiar Chave da NF-e"
                        aria-label="Copiar Chave da NF-e"
                        className="h-7 w-7 shrink-0"
                        onCopied={() => notify('Chave da NF-e copiada.')}
                      />
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {!isExpedicao && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => openPrintableDanfe(order, selectedClient, data.products)}
                        >
                          <Printer size={14} />
                          Imprimir DANFE (BQ)
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => openPrintableRomaneio(order, selectedClient, data.products)}
                      >
                        <Truck size={14} />
                        Imprimir Romaneio (DQ)
                      </Button>
                      {!isExpedicao && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => openPrintableOrderSlip(order, selectedClient, data.products)}
                        >
                          <FileText size={14} />
                          Imprimir Talão
                        </Button>
                      )}
                      {order.xmlUrl && (
                        <Button variant="outline" size="sm" onClick={() => window.open(order.xmlUrl, '_blank')}>
                          <FileText size={14} />
                          Ver XML NF-e
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                <div className="dialog-actions flex-wrap">
                  <Button
                    variant="outline"
                    onClick={async () => {
                      const txt = await generatePickingApi(order.id);
                      if (txt) setCustomPackingText(txt);
                      setPacking(true);
                    }}
                  >
                    <Truck />
                    Gerar romaneio (DQ)
                  </Button>

                  {!isLockedOrder && (
                    <>
                      {editing ? (
                        <Button
                          variant="outline"
                          disabled={busy}
                          onClick={async () => {
                            if (modalTotalDq < 1 || modalTotalBq < 1) {
                              notify('A Qtd. Expedição (DQ) e a Qtd. Base (BQ) devem ser de pelo menos 1 saca.');
                              return;
                            }
                            setBusy(true);
                            try {
                              const next = await reviewOrderApi(data, order.id, editItems);
                              update(next);
                              setEditing(false);
                              notify('Pré-nota revisada (DQ e BQ). Reserva de estoque atualizada.');
                            } catch (e) {
                              try {
                                update(editOrder(data, order.id, editItems));
                                setEditing(false);
                                notify('Pedido revisado. Reserva de estoque atualizada.');
                              } catch (err) {
                                notify(
                                  e instanceof Error
                                    ? e.message
                                    : err instanceof Error
                                    ? err.message
                                    : 'Confira o pedido.'
                                );
                              }
                            } finally {
                              setBusy(false);
                            }
                          }}
                        >
                          <Check />
                          Salvar revisão
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          onClick={() => {
                            setEditItems(
                              order.items.map(i => ({
                                ...i,
                                dispatchQuantity: itemDq(i),
                                baseQuantity: itemBq(i),
                              }))
                            );
                            setEditing(true);
                          }}
                        >
                          Editar pré-nota (DQ/BQ)
                        </Button>
                      )}
                      <ShimmerButton
                        disabled={busy || !fiscalReady(selectedClient) || editing || modalTotalBq < 1}
                        onClick={async () => {
                          setBusy(true);
                          try {
                            const next = await issueNfeApi(data, order.id);
                            update(next);
                            fireConfetti();
                            notify('NF-e emitida no servidor. Estoque físico (DQ) e Saldo Base (BQ) atualizados.');
                          } catch (e) {
                            try {
                              update(invoiceOrder(data, order.id));
                              fireConfetti();
                              notify('NF-e simulada emitida. Estoque físico (DQ) e Saldo Base (BQ) atualizados.');
                            } catch (err) {
                              notify(
                                e instanceof Error
                                  ? e.message
                                  : err instanceof Error
                                  ? err.message
                                  : 'Não foi possível emitir.'
                              );
                            }
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        {busy ? <Loader2 className="animate-spin" /> : <FileCheck2 />}
                        Emitir NF-e
                      </ShimmerButton>
                    </>
                  )}

                  {/* Botão Confirmar Entrega (quando FATURADO) */}
                  {selectedEffectiveStatus === 'FATURADO' && (
                    <Button
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          const next = await deliverOrderApi(data, order.id);
                          update(next);
                          fireConfetti();
                          notify(`Entrega do Pedido #${order.id} confirmada com sucesso!`);
                        } catch {
                          update(deliverOrderLocal(data, order.id));
                          fireConfetti();
                          notify(`Pedido #${order.id} marcado como ENTREGUE.`);
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      <CheckCheck size={15} />
                      Confirmar Entrega
                    </Button>
                  )}

                  {/* Botão Cancelar Pedido */}
                  {selectedEffectiveStatus !== 'CANCELADO' && selectedEffectiveStatus !== 'ENTREGUE' && (
                    <Button
                      variant="outline"
                      disabled={busy}
                      className="text-destructive border-destructive/30 hover:bg-destructive/10"
                      onClick={async () => {
                        setBusy(true);
                        try {
                          const next = await cancelOrderApi(data, order.id);
                          update(next);
                          setEditing(false);
                          notify(`Pedido #${order.id} cancelado e saldos estornados.`);
                        } catch {
                          update(cancelOrderLocal(data, order.id));
                          setEditing(false);
                          notify(`Pedido #${order.id} cancelado e saldos estornados.`);
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      <Ban size={14} />
                      Cancelar Pedido
                    </Button>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {data.backendConnected
                    ? 'Conectado ao servidor · alterações salvas em banco de dados.'
                    : 'Ambiente de demonstração · emissão sem validade fiscal.'}
                </span>
              </>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
