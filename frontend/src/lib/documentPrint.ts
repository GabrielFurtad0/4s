import { Order, Client, Product, Item, itemBq, itemDq, money } from './business';

/**
 * Utilitário de Geração e Impressão de Documentos Fiscais & Operacionais:
 * - DANFE NF-e 4.00 Oficial Total Trigo (baseado estritamente na Qtd. Base / BQ)
 * - Romaneio Cego de Separação & Entrega (baseado exclusivamente na Qtd. Expedição / DQ, sem preços)
 * - Integração WhatsApp com motorista (romaneio cego) e cliente (resumo comercial + DANFE)
 * - Chamadas de API para sincronização com planilha legada, Carta de Correção (CC-e) e Devoluções (CFOP 1202)
 */

export interface SyncSpreadsheetResponse {
  xmlSavedPath: string;
  scriptExecuted: boolean;
  baseQuantityTotal: number;
  orderId?: number | string;
  accessKey?: string;
  message: string;
}

export interface CartaCorrecaoResponse {
  orderId: number | string;
  nfeNumber: string;
  nfeAccessKey: string;
  protocolNumber: string;
  eventSequence: number;
  correctionText: string;
  registeredAt: string;
  statusMessage: string;
}

export interface DevolucaoResponse {
  orderId: number | string;
  status: string;
  cfop: string;
  returnedPhysicalStock: number;
  returnedBaseStock: number;
  reason: string;
  protocolNumber: string;
  statusMessage: string;
}

/**
 * Abre janela de impressão/PDF do DANFE Padrão NF-e 4.00 da Total Trigo.
 * Se o backend estiver rodando, pode ser acessado também em /api/backoffice/fiscal-documents/${order.id}/danfe.html
 */
export function openPrintableDanfe(order: Order, client?: Client, products?: Product[]): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    window.location.href = `/api/backoffice/fiscal-documents/${order.id}/danfe.html`;
    return;
  }

  const html = generateDanfeHtml(order, client, products);
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

/**
 * Abre janela de impressão do Romaneio Cego de Separação & Entrega (DQ exclusivo, sem valores comerciais).
 * Se o backend estiver rodando, pode ser acessado também em /api/backoffice/fiscal-documents/${order.id}/romaneio.html
 */
export function openPrintableRomaneio(order: Order, client?: Client, products?: Product[]): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    window.location.href = `/api/backoffice/fiscal-documents/${order.id}/romaneio.html`;
    return;
  }

  const html = generateRomaneioHtml(order, client, products);
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

/**
 * Constrói link wa.me pronto para compartilhamento via WhatsApp:
 * - mode 'driver_romaneio': envia dados cegos de expedição (DQ, peso, rota) sem preços ao motorista.
 * - mode 'client_summary': envia resumo do pedido, dados da NF-e emitida e chave de acesso ao cliente.
 */
export function buildWhatsAppOrderShareUrl(
  order: Order,
  mode: 'driver_romaneio' | 'client_summary',
  client?: Client,
  products?: Product[]
): string {
  const resolveProductName = (productId: string): string => {
    const found = products?.find(p => p.id === productId);
    return found ? found.name : `Produto #${productId}`;
  };

  const clientName = client?.name ?? `Cliente #${order.clientId}`;
  const clientBairro = client?.neighborhood ?? 'São Paulo';
  const nfeBadge = order.invoice ? `NF-e #${order.invoice}` : `Pedido #${order.id}`;

  if (mode === 'driver_romaneio') {
    let itemsText = '';
    let totalSacks = 0;

    for (const item of order.items) {
      const dq = itemDq(item);
      if (dq <= 0) continue;
      totalSacks += dq;
      const weight = dq * 25;
      itemsText += `• *${dq} SACAS* — ${resolveProductName(item.productId)} (${weight} kg)\n`;
    }

    const totalWeight = totalSacks * 25;
    const notes = order.note ? `\n⚠️ *Obs Motorista:* ${order.note}` : '';

    const msg =
      `🚚 *ROMANEIO DE EXPEDIÇÃO & ENTREGA — TOTAL TRIGO*\n` +
      `📋 *${nfeBadge}* | Previsão: *${order.delivery || 'Imediata'}*\n\n` +
      `🏢 *Cliente:* ${clientName}\n` +
      `📍 *Bairro / Rota:* ${clientBairro}\n` +
      `👤 *Contato:* ${client?.buyer || 'Comprador'}\n\n` +
      `📦 *CARGA PARA CONFERÊNCIA E ENTREGA (DQ):*\n` +
      itemsText +
      `\n⚖️ *Total Volume:* ${totalSacks} sacas (${totalWeight} kg)` +
      notes;

    return `https://wa.me/?text=${encodeURIComponent(msg)}`;
  } else {
    // client_summary
    let itemsText = '';
    let commercialTotal = 0;

    for (const item of order.items) {
      const dq = itemDq(item);
      if (dq <= 0) continue;
      const subtotal = dq * item.price;
      commercialTotal += subtotal;
      itemsText += `• *${dq} sacas* ${resolveProductName(item.productId)} — ${money(item.price)}/sc = ${money(subtotal)}\n`;
    }

    const keyInfo = order.key
      ? `\n🔑 *Chave de Acesso NF-e:* \`${order.key}\``
      : '';

    const msg =
      `🌾 *TOTAL TRIGO — RESUMO DO SEU PEDIDO*\n` +
      `📋 *${nfeBadge}* | Data: *${order.date}*\n` +
      `🏢 *Cliente:* ${clientName}\n` +
      `💳 *Condições de Pagamento:* ${order.payment}\n` +
      `🚚 *Previsão de Entrega:* ${order.delivery || 'A combinar'}\n\n` +
      `📦 *Itens Solicitados:*\n` +
      itemsText +
      `\n💰 *Valor Total do Pedido:* *${money(commercialTotal)}*` +
      keyInfo +
      `\n\nAgradecemos a parceria! Qualquer dúvida estamos à disposição.`;

    return `https://wa.me/?text=${encodeURIComponent(msg)}`;
  }
}

// ==========================================
// FUNÇÕES DE API REST COM O BACKOFFICE
// ==========================================

export async function syncOrderWithSpreadsheetApi(orderId: string): Promise<SyncSpreadsheetResponse> {
  const res = await fetch(`/api/backoffice/fiscal-documents/${orderId}/sync-spreadsheet`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(errText || `Falha ao sincronizar com a planilha de estoques (HTTP ${res.status})`);
  }
  return res.json();
}

export async function issueCartaCorrecaoApi(
  orderId: string,
  correctionText: string
): Promise<CartaCorrecaoResponse> {
  const res = await fetch(`/api/backoffice/fiscal-documents/${orderId}/carta-correcao`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correctionText }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(errText || `Falha ao emitir Carta de Correção (HTTP ${res.status})`);
  }
  return res.json();
}

export async function issueDevolucaoApi(
  orderId: string,
  reason: string
): Promise<DevolucaoResponse> {
  const res = await fetch(`/api/backoffice/fiscal-documents/${orderId}/devolucao`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(errText || `Falha ao emitir NF-e de Devolução (HTTP ${res.status})`);
  }
  return res.json();
}

// ==========================================
// GERADORES HTML CLIENT-SIDE PARA IMPRESSÃO
// ==========================================

export function generateDanfeHtml(order: Order, client?: Client, products?: Product[]): string {
  const nfeNumber = order.invoice ?? String(12930 + Number(order.id.replace(/\D/g, '') || '1'));
  const rawKey =
    order.key ??
    ('3526100926520100019555001' + nfeNumber.padStart(9, '0') + '1300000001');

  const keyFormatted = rawKey.replace(/(.{4})/g, '$1 ').trim();
  const protocol = `1352642000012936 - ${order.date || '18/10/2026'} 18:30:00`;

  let totalVProd = 0;
  let totalBqSacks = 0;
  let itemsRows = '';

  for (const item of order.items) {
    const bq = itemBq(item);
    if (bq <= 0) continue;

    const prod = products?.find(p => p.id === item.productId);
    const prodName = prod?.name ?? `Produto #${item.productId}`;
    const erpCode = prod?.skuCode ?? `FAR-${item.productId}`;
    const ncm = prod?.ncm ?? '11010010';

    const itemTotal = bq * item.price;
    // Redução de Base de Cálculo 58.33% (ICMS 12% -> Carga efetiva 7%)
    const itemBc = itemTotal * 0.5833;
    const itemIcms = itemBc * 0.12;

    totalVProd += itemTotal;
    totalBqSacks += bq;

    itemsRows += `
      <tr>
        <td>${erpCode}</td>
        <td>${prodName}</td>
        <td class="center">${ncm}</td>
        <td class="center">020</td>
        <td class="center">5102</td>
        <td class="center">SACAS</td>
        <td class="right font-bold">${bq}</td>
        <td class="right">${money(item.price)}</td>
        <td class="right font-bold">${money(itemTotal)}</td>
        <td class="right">${money(itemBc)}</td>
        <td class="right">${money(itemIcms)}</td>
        <td class="center">12,00%</td>
      </tr>
    `;
  }

  const totalVBC = totalVProd * 0.5833;
  const totalVICMS = totalVBC * 0.12;
  const totalWeight = totalBqSacks * 25;

  const clientName = client?.name ?? `Cliente #${order.clientId}`;
  const clientCnpj = client?.cnpj ?? '00.000.000/0001-00';
  const clientIe = client?.ie ?? 'ISENTO';
  const clientAddress = client ? `${client.neighborhood}, São Paulo - SP` : 'São Paulo - SP';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>DANFE NF-e #${nfeNumber} - Total Trigo</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 8pt; color: #000; background: #fff; padding: 10px; line-height: 1.2; }
    .no-print { background: #0f172a; color: #fff; padding: 12px 20px; border-radius: 8px; margin-bottom: 15px; display: flex; align-items: center; justify-content: space-between; }
    .no-print button { background: #2563eb; color: #fff; border: none; padding: 8px 18px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 10pt; }
    .canhoto { border: 1px solid #000; margin-bottom: 4px; padding: 4px; border-bottom-style: dashed; }
    .border-box { border: 1px solid #000; margin-bottom: 3px; }
    .row { display: flex; flex-direction: row; width: 100%; }
    .col { border-right: 1px solid #000; padding: 2px 4px; }
    .col:last-child { border-right: none; }
    .lbl { font-size: 6.5pt; text-transform: uppercase; color: #333; margin-bottom: 1px; }
    .val { font-size: 8pt; font-weight: bold; }
    .val-sm { font-size: 7pt; }
    .center { text-align: center; }
    .right { text-align: right; }
    .font-bold { font-weight: bold; }
    table.danfe-items { width: 100%; border-collapse: collapse; margin-top: 2px; }
    table.danfe-items th, table.danfe-items td { border: 1px solid #000; padding: 2px 4px; font-size: 7pt; }
    table.danfe-items th { background: #f1f5f9; text-transform: uppercase; font-size: 6.5pt; text-align: center; }
    .barcode-container { height: 32px; background: repeating-linear-gradient(90deg, #000, #000 2px, #fff 2px, #fff 4px, #000 4px, #000 7px, #fff 7px, #fff 9px); border: 1px solid #999; margin: 3px 0; }
    .title-box { background: #e2e8f0; font-size: 6.5pt; font-weight: bold; text-transform: uppercase; padding: 1px 4px; border-bottom: 1px solid #000; }
    @media print {
      .no-print { display: none !important; }
      body { padding: 0; }
      @page { size: A4 portrait; margin: 6mm; }
    }
  </style>
</head>
<body>

  <div class="no-print">
    <div>
      <strong style="font-size: 12pt;">DANFE NF-e #${nfeNumber}</strong>
      <span style="margin-left: 12px; color: #94a3b8;">Emissão Total Trigo (Qtd. Base / BQ)</span>
    </div>
    <div>
      <button onclick="window.print()">🖨️ Imprimir / Salvar PDF</button>
    </div>
  </div>

  <div class="canhoto">
    <div class="row">
      <div class="col" style="flex: 4;">
        <div class="val-sm">RECEBEMOS DE <b>SERGIO SOARES DE SOUSA / TOTAL TRIGO</b> OS PRODUTOS CONSTANTES DA NOTA FISCAL INDICADA AO LADO.</div>
        <div class="row" style="margin-top: 8px;">
          <div style="flex: 1; border-top: 1px solid #000; margin-right: 15px; padding-top: 2px;">
            <div class="lbl">DATA DE RECEBIMENTO</div>
          </div>
          <div style="flex: 2; border-top: 1px solid #000; padding-top: 2px;">
            <div class="lbl">IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR</div>
          </div>
        </div>
      </div>
      <div class="col center" style="flex: 1;">
        <div class="val" style="font-size: 11pt;">NF-e</div>
        <div class="val" style="font-size: 10pt;">Nº ${nfeNumber}</div>
        <div class="val-sm">SÉRIE 1</div>
      </div>
    </div>
  </div>

  <div class="border-box">
    <div class="row">
      <div class="col" style="flex: 3.2;">
        <div class="val" style="font-size: 9.5pt;">SERGIO SOARES DE SOUSA</div>
        <div class="val" style="font-size: 8pt; color: #1e3a8a;">TOTAL TRIGO COMERCIO DE ALIMENTOS LTDA</div>
        <div class="val-sm">Rua Marco Aurelio Marliani, 59 - SUBSL</div>
        <div class="val-sm">Jardim Almeida Prado - São Paulo / SP - CEP: 04854-170</div>
        <div class="val-sm">Fone: (11) 99887-2233</div>
      </div>
      <div class="col center" style="flex: 1.8;">
        <div class="val" style="font-size: 10pt;">DANFE</div>
        <div class="val-sm">Documento Auxiliar da<br/>Nota Fiscal Eletrônica</div>
        <div class="row" style="margin-top: 3px; justify-content: center;">
          <div style="border: 1px solid #000; padding: 1px 6px; font-weight: bold;">1</div>
          <div class="val-sm" style="margin-left: 5px; text-align: left;">0 - Entrada<br/>1 - Saída</div>
        </div>
        <div class="val" style="margin-top: 3px;">Nº ${nfeNumber}</div>
        <div class="val-sm">SÉRIE 1 - FOLHA 1/1</div>
      </div>
      <div class="col" style="flex: 4;">
        <div class="barcode-container"></div>
        <div class="lbl center">CHAVE DE ACESSO</div>
        <div class="center font-bold" style="font-size: 7.5pt; font-family: monospace;">${keyFormatted}</div>
        <div class="val-sm center" style="font-size: 6.5pt; margin-top: 3px;">Consulta de autenticidade no portal nacional da NF-e www.nfe.fazenda.gov.br/portal</div>
      </div>
    </div>
  </div>

  <div class="border-box">
    <div class="row">
      <div class="col" style="flex: 4;">
        <div class="lbl">NATUREZA DA OPERAÇÃO</div>
        <div class="val">VENDA DE MERCADORIA</div>
      </div>
      <div class="col" style="flex: 4;">
        <div class="lbl">PROTOCOLO DE AUTORIZAÇÃO DE USO</div>
        <div class="val">${protocol}</div>
      </div>
    </div>
    <div class="row" style="border-top: 1px solid #000;">
      <div class="col" style="flex: 3;">
        <div class="lbl">INSCRIÇÃO ESTADUAL</div>
        <div class="val">148.037.168.118</div>
      </div>
      <div class="col" style="flex: 3;">
        <div class="lbl">INSC. ESTADUAL DO SUBST. TRIBUT.</div>
        <div class="val">-</div>
      </div>
      <div class="col" style="flex: 3;">
        <div class="lbl">CNPJ</div>
        <div class="val">09.265.201/0001-95</div>
      </div>
    </div>
  </div>

  <div class="border-box">
    <div class="title-box">DESTINATÁRIO / REMETENTE</div>
    <div class="row">
      <div class="col" style="flex: 6;">
        <div class="lbl">NOME / RAZÃO SOCIAL</div>
        <div class="val">${clientName}</div>
      </div>
      <div class="col" style="flex: 3;">
        <div class="lbl">CNPJ / CPF</div>
        <div class="val">${clientCnpj}</div>
      </div>
      <div class="col" style="flex: 2;">
        <div class="lbl">DATA DE EMISSÃO</div>
        <div class="val center">${order.date || '18/10/2026'}</div>
      </div>
    </div>
    <div class="row" style="border-top: 1px solid #000;">
      <div class="col" style="flex: 6;">
        <div class="lbl">ENDEREÇO</div>
        <div class="val">${clientAddress}</div>
      </div>
      <div class="col" style="flex: 3;">
        <div class="lbl">INSCRIÇÃO ESTADUAL</div>
        <div class="val">${clientIe}</div>
      </div>
      <div class="col" style="flex: 2;">
        <div class="lbl">UF</div>
        <div class="val center">SP</div>
      </div>
    </div>
  </div>

  <div class="border-box">
    <div class="title-box">CÁLCULO DO IMPOSTO (ESTRITAMENTE SOBRE QUANTIDADE BASE / BQ)</div>
    <div class="row">
      <div class="col right" style="flex: 2;">
        <div class="lbl">BASE DE CÁLCULO DO ICMS</div>
        <div class="val">${money(totalVBC)}</div>
      </div>
      <div class="col right" style="flex: 2;">
        <div class="lbl">VALOR DO ICMS (12%)</div>
        <div class="val">${money(totalVICMS)}</div>
      </div>
      <div class="col right" style="flex: 2;">
        <div class="lbl">BASE CÁLC. ICMS S.T.</div>
        <div class="val">R$ 0,00</div>
      </div>
      <div class="col right" style="flex: 2;">
        <div class="lbl">VALOR DO ICMS S.T.</div>
        <div class="val">R$ 0,00</div>
      </div>
      <div class="col right" style="flex: 2.5;">
        <div class="lbl">VLR TOTAL DOS PRODUTOS (BQ)</div>
        <div class="val">${money(totalVProd)}</div>
      </div>
    </div>
    <div class="row" style="border-top: 1px solid #000;">
      <div class="col right" style="flex: 2;">
        <div class="lbl">VALOR DO FRETE</div>
        <div class="val">R$ 0,00</div>
      </div>
      <div class="col right" style="flex: 2;">
        <div class="lbl">VALOR DO SEGURO</div>
        <div class="val">R$ 0,00</div>
      </div>
      <div class="col right" style="flex: 2;">
        <div class="lbl">DESCONTO</div>
        <div class="val">R$ 0,00</div>
      </div>
      <div class="col right" style="flex: 2;">
        <div class="lbl">OUTRAS DESPESAS</div>
        <div class="val">R$ 0,00</div>
      </div>
      <div class="col right" style="flex: 2.5;">
        <div class="lbl">VALOR TOTAL DA NOTA</div>
        <div class="val" style="font-size: 9pt; color: #1e3a8a;">${money(totalVProd)}</div>
      </div>
    </div>
  </div>

  <div class="border-box">
    <div class="title-box">TRANSPORTADOR / VOLUMES TRANSPORTADOS</div>
    <div class="row">
      <div class="col" style="flex: 4;">
        <div class="lbl">RAZÃO SOCIAL</div>
        <div class="val">O MESMO / TOTAL TRIGO</div>
      </div>
      <div class="col" style="flex: 2;">
        <div class="lbl">FRETE POR CONTA</div>
        <div class="val">0 - Remetente (CIF)</div>
      </div>
      <div class="col right" style="flex: 2;">
        <div class="lbl">QUANTIDADE (BQ)</div>
        <div class="val">${totalBqSacks} SACAS</div>
      </div>
      <div class="col right" style="flex: 2;">
        <div class="lbl">PESO BRUTO (KG)</div>
        <div class="val">${totalWeight},000</div>
      </div>
    </div>
  </div>

  <div class="border-box">
    <div class="title-box">DADOS DOS PRODUTOS / SERVIÇOS (ITENS COM QUANTIDADE BASE / BQ)</div>
    <table class="danfe-items">
      <thead>
        <tr>
          <th>Cód</th>
          <th>Descrição do Produto</th>
          <th>NCM</th>
          <th>CST</th>
          <th>CFOP</th>
          <th>UN</th>
          <th>Qtd (BQ)</th>
          <th>V. Unitário</th>
          <th>V. Total</th>
          <th>BC ICMS</th>
          <th>V. ICMS</th>
          <th>Alíq</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows}
      </tbody>
    </table>
  </div>

  <div class="border-box" style="margin-top: 3px;">
    <div class="title-box">DADOS ADICIONAIS</div>
    <div class="row">
      <div class="col" style="flex: 7; min-height: 50px;">
        <div class="lbl">INFORMAÇÕES COMPLEMENTARES</div>
        <div class="val-sm">REDUCAO DE 7% ANEXO III ARTIGO 3 DO RICMS. ${order.note ? 'Obs: ' + order.note : ''}</div>
        <div class="val-sm" style="margin-top: 3px; color: #555;">Condições de Pagamento: ${order.payment}</div>
      </div>
      <div class="col" style="flex: 3;">
        <div class="lbl">RESERVADO AO FISCO</div>
        <div class="val-sm">-</div>
      </div>
    </div>
  </div>

</body>
</html>`;
}

export function generateRomaneioHtml(order: Order, client?: Client, products?: Product[]): string {
  const nfeBadge = order.invoice ? `NF-e #${order.invoice}` : `Pedido #${order.id}`;
  const clientName = client?.name ?? `Cliente #${order.clientId}`;
  const clientAddress = client ? `${client.neighborhood}, São Paulo - SP` : 'São Paulo - SP';
  const buyer = client?.buyer ?? 'Comprador';
  const delivery = order.delivery || 'Imediata';

  let totalDq = 0;
  let rowsHtml = '';

  for (const item of order.items) {
    const dq = itemDq(item);
    if (dq <= 0) continue;

    const prod = products?.find(p => p.id === item.productId);
    const prodName = prod?.name ?? `Produto #${item.productId}`;
    const skuCode = prod?.skuCode ?? `SKU-${item.productId}`;
    const weight = dq * 25;
    totalDq += dq;

    rowsHtml += `
      <tr style="height: 38px;">
        <td style="font-weight: bold; font-size: 11pt;">${skuCode}</td>
        <td style="font-size: 11pt; font-weight: 600;">${prodName}</td>
        <td class="center" style="font-size: 11pt;">SACAS (25kg)</td>
        <td class="right font-bold" style="font-size: 14pt; color: #0f172a;">${dq}</td>
        <td class="right" style="font-size: 11pt;">${weight} kg</td>
        <td class="center"><div style="width: 22px; height: 22px; border: 2px solid #334155; margin: auto; border-radius: 4px;"></div></td>
        <td class="center"><div style="width: 22px; height: 22px; border: 2px solid #334155; margin: auto; border-radius: 4px;"></div></td>
      </tr>
    `;
  }

  const totalWeight = totalDq * 25;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Romaneio Cego de Separação & Entrega - ${nfeBadge}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10pt; color: #0f172a; background: #fff; padding: 15px; }
    .no-print { background: #0284c7; color: #fff; padding: 12px 20px; border-radius: 8px; margin-bottom: 15px; display: flex; align-items: center; justify-content: space-between; }
    .no-print button { background: #0369a1; color: #fff; border: 1px solid #bae6fd; padding: 8px 20px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 11pt; }
    .header-box { border: 2px solid #0f172a; padding: 12px; margin-bottom: 12px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; }
    .company-title { font-size: 16pt; font-weight: 800; color: #0f172a; }
    .badge { display: inline-block; background: #e0f2fe; color: #0369a1; padding: 4px 10px; border-radius: 6px; font-weight: 700; font-size: 11pt; }
    .info-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 10px; margin-bottom: 12px; }
    .card { border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px; background: #f8fafc; }
    .card-title { font-size: 8pt; text-transform: uppercase; color: #64748b; font-weight: bold; margin-bottom: 4px; }
    .card-val { font-size: 11pt; font-weight: 600; }
    table.romaneio-table { width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 15px; }
    table.romaneio-table th, table.romaneio-table td { border: 1px solid #64748b; padding: 6px 8px; }
    table.romaneio-table th { background: #f1f5f9; text-transform: uppercase; font-size: 8.5pt; }
    .center { text-align: center; }
    .right { text-align: right; }
    .font-bold { font-weight: bold; }
    .totals-banner { background: #f0fdf4; border: 2px solid #22c55e; border-radius: 6px; padding: 10px 15px; display: flex; justify-content: space-around; font-size: 13pt; font-weight: bold; color: #15803d; margin-bottom: 15px; }
    .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 25px; }
    .sig-box { border: 1px solid #94a3b8; border-radius: 6px; padding: 12px; height: 110px; display: flex; flex-direction: column; justify-content: space-between; }
    .sig-line { border-top: 1px solid #000; margin-top: 20px; text-align: center; font-size: 8.5pt; padding-top: 3px; }
    .canhoto-cliente { border: 2px dashed #475569; border-radius: 6px; padding: 12px; margin-top: 20px; background: #fafafa; }
    @media print {
      .no-print { display: none !important; }
      body { padding: 0; font-size: 9.5pt; }
      @page { size: A4 portrait; margin: 8mm; }
    }
  </style>
</head>
<body>

  <div class="no-print">
    <div>
      <strong style="font-size: 13pt;">📦 Romaneio Cego de Expedição (Carga DQ)</strong>
      <div style="font-size: 9pt; color: #e0f2fe;">Sem preços comerciais — Exclusivo para galpão e canhoto do motorista</div>
    </div>
    <div>
      <button onclick="window.print()">🖨️ Imprimir Romaneio</button>
    </div>
  </div>

  <div class="header-box">
    <div>
      <div class="company-title">TOTAL TRIGO — ROMANEIO DE EXPEDIÇÃO & ENTREGA</div>
      <div style="font-size: 9pt; color: #475569;">Distribuição Atacadista de Farinhas e Pré-Misturas</div>
    </div>
    <div class="right">
      <div class="badge">${nfeBadge}</div>
      <div style="font-size: 8.5pt; margin-top: 4px; color: #64748b;">Emissão: ${order.date || 'Hoje'}</div>
    </div>
  </div>

  <div class="info-grid">
    <div class="card">
      <div class="card-title">Destinatário & Local de Descarrego</div>
      <div class="card-val">${clientName}</div>
      <div style="font-size: 9.5pt; margin-top: 3px;">📍 <b>Endereço:</b> ${clientAddress}</div>
    </div>
    <div class="card">
      <div class="card-title">Dados Operacionais</div>
      <div style="font-size: 9.5pt;">👤 <b>Contato:</b> ${buyer}</div>
      <div style="font-size: 9.5pt; margin-top: 3px;">🚚 <b>Previsão:</b> <span style="font-weight: 700; color: #0284c7;">${delivery}</span></div>
    </div>
  </div>

  ${
    order.note
      ? `<div class="card" style="margin-bottom: 12px; background: #fffbeb; border-color: #fde68a;">
           <div class="card-title" style="color: #b45309;">⚠️ Instruções para Entrega / Motorista</div>
           <div style="font-size: 10pt; font-weight: 600; color: #78350f;">${order.note}</div>
         </div>`
      : ''
  }

  <table class="romaneio-table">
    <thead>
      <tr>
        <th style="width: 15%;">SKU</th>
        <th style="width: 45%; text-align: left;">Descrição da Mercadoria</th>
        <th style="width: 14%;">Unidade</th>
        <th style="width: 10%; text-align: right;">Qtd. Expedir (DQ)</th>
        <th style="width: 10%; text-align: right;">Peso</th>
        <th style="width: 3%;">Galpão</th>
        <th style="width: 3%;">Entrega</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>

  <div class="totals-banner">
    <div>📦 Volume Total: <span>${totalDq} sacos</span></div>
    <div>⚖️ Peso Total da Carga: <span>${totalWeight} kg (${(totalWeight / 1000).toFixed(2)} ton)</span></div>
  </div>

  <div class="signatures">
    <div class="sig-box">
      <div class="card-title">Conferência de Galpão</div>
      <div style="font-size: 8.5pt; color: #475569;">Carga conferida e liberada de acordo com as quantidades (DQ) acima.</div>
      <div class="sig-line">Separador / Conferente (Data: ___/___/______)</div>
    </div>
    <div class="sig-box">
      <div class="card-title">Saída do Motorista</div>
      <div style="font-size: 8.5pt; color: #475569;">Recebi a carga completa em perfeitas condições para entrega.</div>
      <div class="sig-line">Motorista / Transportador (Placa: _______________)</div>
    </div>
  </div>

  <div class="canhoto-cliente">
    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
      <strong style="font-size: 9.5pt;">COMPROVANTE DE ENTREGA E RECEBIMENTO DE MERCADORIAS</strong>
      <span style="font-size: 9pt; color: #64748b;">${nfeBadge} — Total Trigo</span>
    </div>
    <div style="font-size: 8.5pt; color: #334155; margin-bottom: 12px;">
      Declaramos ter recebido da <b>TOTAL TRIGO COMÉRCIO DE ALIMENTOS LTDA</b> as mercadorias constantes neste romaneio cego de expedição, conferidas em perfeito estado físico e conformidade.
    </div>
    <div style="display: flex; gap: 20px;">
      <div style="flex: 1; border-top: 1px solid #000; padding-top: 3px;">
        <div style="font-size: 7.5pt; color: #64748b;">DATA DA ENTREGA: ______/______/2026 &nbsp;&nbsp; HORA: _____:_____</div>
      </div>
      <div style="flex: 2; border-top: 1px solid #000; padding-top: 3px;">
        <div style="font-size: 7.5pt; color: #64748b;">NOME LEGÍVEL DO RECEBEDOR &nbsp;&nbsp;|&nbsp;&nbsp; RG / CPF: ____________________</div>
      </div>
      <div style="flex: 2; border-top: 1px solid #000; padding-top: 3px;">
        <div style="font-size: 7.5pt; color: #64748b;">ASSINATURA / CARIMBO DO CLIENTE</div>
      </div>
    </div>
  </div>

</body>
</html>`;
}

/**
 * Abre janela de impressão/PDF do Talão de Pedido Comercial (Bloco de Notas Físico de Campo).
 * Segue com fidelidade milimétrica o modelo impresso tradicional com cabeçalho azul "Pedido Nº",
 * dados completos do cliente, grade pautada com produtos e vencimentos de boletos embutidos na descrição,
 * totalizador e termo legal de frete por conta e risco do comprador.
 */

export function formatDocumentSlipDate(rawDate?: string): string {
  if (!rawDate) return new Date().toLocaleDateString('pt-BR');
  const trimmed = rawDate.trim();
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

export interface OrderSlipCustomData {
  orderId?: string;
  vendorName?: string;
  orderDate?: string;
  clientName?: string;
  clientRef?: string;
  clientAddress?: string;
  clientCep?: string;
  clientCity?: string;
  clientState?: string;
  clientPhone?: string;
  clientCnpj?: string;
  clientIe?: string;
  clientEmail?: string;
  rows?: Array<{
    qty: string;
    desc: string;
    unid: string;
    total: string;
    isInstallment?: boolean;
    isNote?: boolean;
  }>;
  buyer?: string;
  visto?: string;
  totalValue?: string;
}

/**
 * Abre janela de impressão/PDF do Talão de Pedido Comercial (Bloco de Notas Físico de Campo).
 * Segue com fidelidade milimétrica o modelo impresso tradicional com cabeçalho azul "Pedido Nº",
 * dados completos do cliente, grade pautada com produtos e vencimentos de boletos embutidos na descrição,
 * totalizador e termo legal de frete por conta e risco do comprador.
 */
export function openPrintableOrderSlip(
  order: Order,
  client?: Client,
  products?: Product[],
  vendorName: string = 'Sérgio Soares',
  customData?: Partial<OrderSlipCustomData>
): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Por favor, permita pop-ups para abrir a impressão do talão de pedido.');
    return;
  }

  const html = generateOrderSlipHtml(order, client, products, vendorName, customData);
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

export function generateOrderSlipHtml(
  order: Order,
  client?: Client,
  products?: Product[],
  vendorName: string = 'Sérgio Soares',
  customData?: Partial<OrderSlipCustomData>
): string {
  const resolveProductName = (productId: string): string => {
    const found = products?.find(p => p.id === productId);
    return found ? found.name : `Produto #${productId}`;
  };

  const finalOrderId = customData?.orderId ?? order.id;
  const finalVendor = customData?.vendorName ?? vendorName;
  const clientName = customData?.clientName ?? (client?.name ?? `Cliente #${order.clientId}`);
  const clientRef = customData?.clientRef ?? (client?.id ?? order.clientId);
  const clientAddress = customData?.clientAddress ?? (client?.neighborhood
    ? `${client.neighborhood}, São Paulo - SP`
    : 'São Paulo - SP');
  const clientCep = customData?.clientCep ?? (client?.ibge ? '04' + client.ibge.slice(2) + '-000' : '04840-000');
  const clientCity = customData?.clientCity ?? 'São Paulo';
  const clientState = customData?.clientState ?? 'SP';
  const clientPhone = customData?.clientPhone ?? '(11) 98765-4321';
  const clientCnpj = customData?.clientCnpj ?? (client?.cnpj || '—');
  const clientIe = customData?.clientIe ?? (client?.ie || 'ISENTO');
  const clientEmail = customData?.clientEmail ?? `contato@${clientName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'padaria'}.com.br`;
  const buyer = customData?.buyer ?? (client?.buyer ?? 'Comprador');
  const visto = customData?.visto ?? '';
  const orderDate = formatDocumentSlipDate(customData?.orderDate || order.date);

  let grandTotal = 0;
  let totalSacks = 0;
  const renderedRows: Array<{
    qty: string;
    desc: string;
    unid: string;
    total: string;
    isInstallment?: boolean;
    isNote?: boolean;
  }> = [];

  if (customData?.rows && customData.rows.length > 0) {
    for (const r of customData.rows) {
      renderedRows.push({
        qty: r.qty ?? '',
        desc: r.desc ?? '',
        unid: r.unid ?? '',
        total: r.total ?? '',
        isInstallment: r.isInstallment,
        isNote: r.isNote,
      });
    }
  } else {

  // 1. Itens de produto
  for (const item of order.items) {
    const qty = itemDq(item);
    if (qty <= 0) continue;
    const subtotal = qty * item.price;
    grandTotal += subtotal;
    totalSacks += qty;

    const pName = resolveProductName(item.productId)
      .replace(' (25kg)', '')
      .replace('Farinha Tipo 1', 'Farinha Trigo Especial Tipo 1')
      .replace('Pré-Mistura Francês', 'Pré-Mistura Pão Francês')
      .replace('PM Pão Doce', 'Pré-Mistura Pão Doce');

    renderedRows.push({
      qty: String(qty),
      desc: `${pName}  ${item.price.toFixed(2).replace('.', ',')}`,
      unid: 'SA',
      total: subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    });
  }

  // 2. Cronograma de boletos/parcelas (exibidos na grade pautada exatamente como no talão físico)
  if (order.dueDates && order.dueDates.length > 0) {
    const installmentVal = grandTotal / order.dueDates.length;
    order.dueDates.forEach((dStr, idx) => {
      const parts = dStr.split('-');
      const formattedDate = parts.length === 3 ? `${parts[2]}/${parts[1]}` : dStr;
      renderedRows.push({
        qty: '',
        desc: `${formattedDate}  -  ${installmentVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        unid: '',
        total: '',
        isInstallment: true,
      });
    });
  } else if (order.firstDueDate) {
    const parts = order.firstDueDate.split('-');
    const formattedDate = parts.length === 3 ? `${parts[2]}/${parts[1]}` : order.firstDueDate;
    renderedRows.push({
      qty: '',
      desc: `${formattedDate}  -  ${grandTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      unid: '',
      total: '',
      isInstallment: true,
    });
  }

  // 3. Previsão de entrega e observações comerciais
  if (order.delivery && order.delivery !== 'Próxima rota') {
    renderedRows.push({
      qty: '',
      desc: `Entrega programada: ${order.delivery}`,
      unid: '',
      total: '',
      isNote: true,
    });
  }
  if (order.note) {
    renderedRows.push({
      qty: '',
      desc: `Obs: ${order.note}`,
      unid: '',
      total: '',
      isNote: true,
    });
  }
  }

  // Preenche linhas pautadas em branco até atingir 13 linhas mínimas (para fidelidade ao bloco impresso)
  const totalTargetRows = Math.max(13, renderedRows.length + 3);
  const rowsHtml = Array.from({ length: totalTargetRows }, (_, i) => {
    const row = renderedRows[i];
    if (row) {
      const descStyle = row.isInstallment
        ? 'font-family: Consolas, monospace; font-size: 11.5pt; font-weight: 700; color: #1e293b; padding-left: 28px;'
        : row.isNote
        ? 'font-size: 9.5pt; font-style: italic; color: #475569;'
        : 'font-weight: 600; font-size: 11pt; color: #0f172a;';

      return `
        <tr style="height: 32px; border-bottom: 1px solid #94a3b8;">
          <td style="text-align: center; font-weight: 700; font-size: 12pt; border-right: 1px solid #94a3b8; color: #0f172a;">${row.qty}</td>
          <td style="${descStyle} border-right: 1px solid #94a3b8; padding-left: 8px;">${row.desc}</td>
          <td style="text-align: center; font-size: 10pt; color: #475569; border-right: 1px solid #94a3b8;">${row.unid}</td>
          <td style="text-align: right; font-weight: 700; font-size: 12pt; padding-right: 8px; color: #0f172a;">${row.total}</td>
        </tr>
      `;
    }

    return `
      <tr style="height: 32px; border-bottom: 1px solid #94a3b8;">
        <td style="border-right: 1px solid #94a3b8;">&nbsp;</td>
        <td style="border-right: 1px solid #94a3b8;">&nbsp;</td>
        <td style="border-right: 1px solid #94a3b8;">&nbsp;</td>
        <td>&nbsp;</td>
      </tr>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Talão de Pedido Nº ${order.id} - ${clientName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 10pt;
      color: #0f172a;
      background: #f1f5f9;
      padding: 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .no-print {
      width: 100%;
      max-width: 740px;
      background: #0284c7;
      color: #fff;
      padding: 12px 18px;
      border-radius: 8px;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }
    .no-print button {
      background: #ffffff;
      color: #0284c7;
      border: 0;
      padding: 8px 18px;
      border-radius: 6px;
      font-weight: 800;
      cursor: pointer;
      font-size: 11pt;
      transition: background 0.15s;
    }
    .no-print button:hover {
      background: #f0f9ff;
    }
    .page-sheet {
      width: 100%;
      max-width: 740px;
      background: #ffffff;
      border: 1.5px solid #0f172a;
      border-radius: 4px;
      padding: 18px 22px 14px 22px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.08);
      position: relative;
    }
    .header-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 14px;
    }
    .badge-pedido {
      display: inline-flex;
      align-items: center;
      gap: 10px;
    }
    .badge-pedido .pill {
      background-color: #0284c7;
      color: #ffffff;
      font-size: 24pt;
      font-weight: 800;
      padding: 2px 18px;
      border-radius: 4px;
      letter-spacing: -0.5px;
      line-height: 1.1;
    }
    .badge-pedido .num-label {
      font-size: 24pt;
      font-weight: 800;
      color: #0284c7;
      margin-left: 2px;
    }
    .badge-pedido .num-val {
      font-size: 20pt;
      font-weight: 700;
      color: #0f172a;
      border-bottom: 2px solid #0f172a;
      min-width: 110px;
      padding: 0 8px;
      display: inline-block;
      text-align: center;
    }
    .vendor-date-box {
      font-size: 11pt;
      color: #0f172a;
    }
    .vendor-date-row {
      display: flex;
      align-items: baseline;
      justify-content: flex-end;
      margin-bottom: 6px;
    }
    .vendor-date-row span.label {
      font-weight: 600;
      margin-right: 6px;
    }
    .vendor-date-row span.line {
      border-bottom: 1.5px solid #0f172a;
      min-width: 175px;
      display: inline-block;
      font-weight: 700;
      padding-left: 6px;
      color: #1e293b;
    }

    /* Tabela de Dados do Cliente */
    .client-table {
      width: 100%;
      border-collapse: collapse;
      border: 1.5px solid #0f172a;
      margin-bottom: 12px;
      font-size: 9.5pt;
    }
    .client-table td {
      border: 1px solid #64748b;
      padding: 4px 8px;
      vertical-align: middle;
    }
    .client-table .field-title {
      font-weight: 600;
      color: #475569;
      font-size: 9pt;
      margin-right: 4px;
    }
    .client-table .field-content {
      font-weight: 700;
      color: #0f172a;
      font-size: 10.5pt;
    }

    /* Tabela Pautada de Itens */
    .items-table {
      width: 100%;
      border-collapse: collapse;
      border: 1.5px solid #0f172a;
      margin-bottom: 14px;
    }
    .items-table th {
      background-color: #dbeafe;
      color: #0369a1;
      font-weight: 800;
      font-size: 10.5pt;
      text-align: center;
      padding: 6px 8px;
      border: 1px solid #64748b;
      border-bottom: 1.5px solid #0f172a;
    }
    .items-table th.col-desc {
      text-align: center;
    }
    .items-table td {
      padding: 4px 8px;
      vertical-align: middle;
    }

    /* Rodapé e Assinaturas */
    .footer-table {
      width: 100%;
      border-collapse: collapse;
      border: 1.5px solid #0f172a;
      margin-bottom: 0px;
    }
    .footer-table td {
      border: 1px solid #64748b;
      padding: 6px 10px;
      vertical-align: top;
    }
    .sig-caption {
      font-size: 9pt;
      color: #475569;
      font-weight: 600;
      margin-bottom: 24px;
    }
    .sig-underline {
      border-bottom: 1px solid #0f172a;
      width: 90%;
      margin: 0 auto;
    }
    .total-box-inner {
      text-align: right;
    }
    .total-box-inner .lbl {
      font-size: 8.5pt;
      color: #475569;
      font-weight: 700;
      text-transform: uppercase;
      margin-bottom: 2px;
    }
    .total-box-inner .val {
      font-size: 16pt;
      font-weight: 900;
      color: #0284c7;
      letter-spacing: -0.5px;
    }

    /* Tarja Azul Inferior de Responsabilidade */
    .bottom-disclaimer {
      background-color: #0284c7;
      color: #ffffff;
      text-align: center;
      padding: 5px 8px;
      font-size: 8.5pt;
      font-weight: 700;
      letter-spacing: 0.3px;
      border: 1.5px solid #0f172a;
      border-top: 0;
    }

    @media print {
      body {
        background: #ffffff;
        padding: 0;
        margin: 0;
      }
      .no-print {
        display: none !important;
      }
      .page-sheet {
        border: 1.5px solid #000;
        box-shadow: none;
        max-width: 100%;
        width: 100%;
        padding: 12px 16px;
      }
      @page {
        size: A4 portrait;
        margin: 10mm;
      }
    }
  </style>
</head>
<body>

  <div class="no-print">
    <div>
      <strong style="font-size: 13pt;">📋 Talão de Pedido Comercial (Bloco Físico de Campo)</strong>
      <div style="font-size: 9pt; color: #e0f2fe;">Fiel ao bloco impresso para assinatura do comprador e comprovação de frete</div>
    </div>
    <div style="display: flex; gap: 8px;">
      <button onclick="window.print()">🖨️ Imprimir Talão / PDF</button>
    </div>
  </div>

  <div class="page-sheet">
    <!-- Cabeçalho -->
    <div class="header-row">
      <div class="badge-pedido">
        <span class="pill">Pedido</span>
        <span class="num-label">Nº</span>
        <span class="num-val">${finalOrderId}</span>
      </div>

      <div class="vendor-date-box">
        <div class="vendor-date-row">
          <span class="label">Vendedor:</span>
          <span class="line">${finalVendor}</span>
        </div>
        <div class="vendor-date-row">
          <span class="label">Data:</span>
          <span class="line">${orderDate}</span>
        </div>
      </div>
    </div>

    <!-- Tabela com Dados do Cliente -->
    <table class="client-table">
      <tr>
        <td colspan="4">
          <span class="field-title">Cliente:</span>
          <span class="field-content">${clientName}</span>
          <span style="float: right; font-size: 9pt; color: #64748b; font-weight: 700;">Cód. / Ref: ${clientRef}</span>
        </td>
      </tr>
      <tr>
        <td colspan="4">
          <span class="field-title">Endereço:</span>
          <span class="field-content">${clientAddress}</span>
        </td>
      </tr>
      <tr>
        <td style="width: 25%;">
          <span class="field-title">CEP:</span>
          <span class="field-content">${clientCep}</span>
        </td>
        <td style="width: 35%;">
          <span class="field-title">Cidade:</span>
          <span class="field-content">${clientCity}</span>
        </td>
        <td style="width: 15%;">
          <span class="field-title">Estado:</span>
          <span class="field-content">${clientState}</span>
        </td>
        <td style="width: 25%;">
          <span class="field-title">Tel:</span>
          <span class="field-content">${clientPhone}</span>
        </td>
      </tr>
      <tr>
        <td colspan="2">
          <span class="field-title">C.N.P.J:</span>
          <span class="field-content">${clientCnpj}</span>
        </td>
        <td colspan="2">
          <span class="field-title">Inscr. Est.:</span>
          <span class="field-content">${clientIe}</span>
        </td>
      </tr>
      <tr>
        <td colspan="4">
          <span class="field-title">E-mail:</span>
          <span class="field-content">${clientEmail}</span>
        </td>
      </tr>
    </table>

    <!-- Tabela Pautada de Produtos & Vencimentos -->
    <table class="items-table">
      <thead>
        <tr>
          <th style="width: 10%;">Qtde.</th>
          <th class="col-desc" style="width: 58%;">Descrição</th>
          <th style="width: 10%;">Unid.</th>
          <th style="width: 22%;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>

    <!-- Rodapé: Assinatura e Total -->
    <table class="footer-table">
      <tr>
        <td style="width: 42%;">
          <div class="sig-caption">Comprador: <span style="font-weight: 700; color: #0f172a;">${buyer}</span></div>
          <div class="sig-underline"></div>
        </td>
        <td style="width: 23%;">
          <div class="sig-caption">Visto: <span style="font-weight: 700; color: #0f172a;">${visto}</span></div>
          <div class="sig-underline" style="width: 80%;"></div>
        </td>
        <td style="width: 35%;">
          <div class="total-box-inner">
            <div class="lbl">Valor total do pedido</div>
            <div class="val">${customData?.totalValue ?? ('R$ ' + grandTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))}</div>
          </div>
        </td>
      </tr>
    </table>

    <!-- Tarja Inferior Legal Obrigatória -->
    <div class="bottom-disclaimer">
      As mercadorias viajam por conta e risco do(s) comprador(es).
    </div>
  </div>

</body>
</html>`;
}

