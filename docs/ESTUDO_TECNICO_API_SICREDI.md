# 🏦 Estudo Técnico: Integração do 4S ERP com a API de Cobrança do Sicredi

> **Status**: Validado para Implementação no 4S ERP  
> **Objetivo**: Automação da emissão de Boletos Bancários Híbridos (Boleto com Código de Barras + QR Code Pix Dinâmico) via API REST oficial do Sicredi, conciliação por Webhook e amarração com a regra de faturamento da Total Trigo.  
> **Data de Referência**: Outubro de 2026  
> **Instituição Financeira**: Cooperativa Sicredi (Sistema de Crédito Cooperativo)  
> **Empresa Beneficiária**: TOTAL TRIGO COMÉRCIO DE ALIMENTOS LTDA (`CNPJ: 09.265.201/0001-95`)

---

## 1. Visão Geral e Benefícios da Integração

Atualmente, muitas empresas distribuidoras realizam a emissão de cobranças bancárias através da digitação manual no Internet Banking empresarial ou por meio de troca diária de arquivos texto CNAB 240 / 400 (remessa e retorno).

```mermaid
flowchart LR
    subgraph LEGADO["Fluxo Legado (CNAB / Manual)"]
        direction TB
        A1["Faturamento ERP"] -->|"Gera Arquivo"| A2["Arquivo Remessa .REM"]
        A2 -->|"Upload Manual"| A3["Internet Banking Sicredi"]
        A3 -->|"Compensação D+1 e D+2"| A4["Arquivo Retorno .RET"]
        A4 -->|"Download Manual"| A5["Baixa no ERP"]
    end

    subgraph API_REST["Fluxo Moderno 4S ERP (API REST + Webhook)"]
        direction TB
        B1["Aprovação Mesa Pré-Nota"] -->|"Emissão Online (1s)"| B2["API Cobrança Sicredi"]
        B2 -->|"Gera Boleto Híbrido"| B3["Cliente Paga (Pix ou Boleto)"]
        B3 -->|"Notificação Instantânea"| B4["Webhook Sicredi"]
        B4 -->|"Baixa Automática"| B5["4S ERP (Crédito Liberado)"]
    end
```

### Vantagens do Boleto Híbrido via API REST:
1. **Emissão Instantânea**: O boleto com PDF oficial e linha digitável é gerado em menos de 1 segundo assim que a nota fiscal é autorizada.
2. **Recebimento Instantâneo via Pix**: O mesmo boleto impresso ou enviado por WhatsApp contém um **QR Code Pix Dinâmico**. Se o padeiro pagar com o app do seu banco via Pix, o dinheiro cai na conta corrente da Total Trigo na mesma hora (inclusive fins de semana).
3. **Liquidação Automática via Webhook**: A cooperativa avisa a API do 4S ERP no momento em que o pagamento é liquidado, baixando a conta a receber e restaurando o limite de crédito do cliente em tempo real.
4. **Custo Operacional Reduzido**: Elimina tarifas de manutenção de carteira ociosa e custos com impressão e envio postal.

---

## 2. Processo de Credenciamento e Obtenção de Credenciais

Para habilitar a API de Cobrança, a Total Trigo deve seguir o fluxo oficial de credenciamento junto à sua cooperativa Sicredi:

```mermaid
flowchart TD
    P1["1. Contato com Gerente PJ Sicredi"] -->|Solicitar habilitação da API de Cobrança Online| P2["2. Cadastro no Portal Developers"]
    P2 -->|Acessar developers.sicredi.com.br| P3["3. Criação da Aplicação 4S ERP"]
    P3 -->|Definir escopo: Cobrança / Boletos| P4["4. Geração de Credenciais"]
    P4 --> P5["Client ID + Client Secret + Chave Master"]
    P4 --> P6["Parâmetros da Conta: Cooperativa, Posto e Beneficiário"]
```

### 2.1. Parâmetros Obrigatórios da Conta Cooperativa
A agência Sicredi fornecerá os seguintes parâmetros exclusivos da Total Trigo:
* **Código da Cooperativa**: 4 dígitos numéricos (exemplo: `0725`).
* **Código do Posto de Atendimento**: 2 dígitos numéricos (exemplo: `01`).
* **Código do Beneficiário (Cedente)**: 5 dígitos numéricos associados à conta jurídica da Total Trigo.
* **Código da Carteira**: `1` (Cobrança Simples com Registro).
* **Espécie do Documento**: `DM` (Duplicata Mercantil).

### 2.2. Chaves de Acesso (API Keys)
No Portal do Desenvolvedor Sicredi (`developers.sicredi.com.br`):
* `client_id`: Identificador público da aplicação do 4S ERP.
* `client_secret`: Chave secreta de autenticação OAuth2.
* `chave_master` (Token de Acesso / API Key): Token fixo para autenticação em endpoints administrativos e validação de Webhooks.

---

## 3. Arquitetura de Autenticação OAuth2

A API do Sicredi utiliza o padrão aberto **OAuth 2.0** com fluxo de credenciais de cliente (`grant_type=client_credentials`):

```mermaid
sequenceDiagram
    autonumber
    participant ERP as 4S ERP (Spring Boot)
    participant Auth as Sicredi Auth Server (/oauth/token)
    participant API as Sicredi Cobrança API

    ERP->>Auth: POST /oauth/token (Basic Auth client_id:client_secret, scope=cobranca)
    Auth-->>ERP: HTTP 200 OK (access_token JWT, expires_in: 3600s)
    Note over ERP: Token armazenado em cache de memória por ~55 minutos
    ERP->>API: POST /cobranca/boleto/v1/boletos (Header: Authorization: Bearer {token})
    API-->>ERP: HTTP 201 Created (Boleto gerado com Linha Digitável e Pix)
```

### 3.1. Endpoints de Autenticação:
* **Ambiente de Sandbox**: `https://api-parceiro.sicredi.com.br/sb/oauth/token`
* **Ambiente de Produção**: `https://api-parceiro.sicredi.com.br/oauth/token`

### 3.2. Exemplo de Requisição de Autenticação:
```http
POST /oauth/token HTTP/1.1
Host: api-parceiro.sicredi.com.br
Content-Type: application/x-www-form-urlencoded
Authorization: Basic MGkyOTM4NDkwMjM5ODQ6c2VjcmV0OTM4NDkwMjM4NDAyOTM4NA==

grant_type=client_credentials&scope=cobranca
```

### 3.3. Resposta com Token JWT:
```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3MjkzODQ5MDB9...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "cobranca"
}
```

---

## 4. Endpoints REST da API de Cobrança

### 4.1. Emissão de Boleto Híbrido (`POST /cobranca/boleto/v1/boletos`)

Permite registrar o boleto na CIP (Câmara Interbancária de Pagamentos) e no SPI (Sistema de Pagamentos Instantâneos do Banco Central).

#### Payload de Exemplo (Envio pelo 4S ERP):
```json
{
  "beneficiario": {
    "cooperativa": "0725",
    "posto": "01",
    "codigoBeneficiario": "54321"
  },
  "dadosBoleto": {
    "nossoNumero": "26100001",
    "numeroDocumento": "PED-1025",
    "especieDocumento": "DM",
    "dataVencimento": "2026-11-15",
    "valor": 1220.10,
    "tipoDesconto": "VALOR_FIXO",
    "valorDesconto": 0.00,
    "juros": {
      "tipoJuros": "PERCENTUAL_MENSAL",
      "valorOuPercentual": 2.00
    },
    "multa": {
      "tipoMulta": "PERCENTUAL",
      "valorOuPercentual": 2.00
    },
    "mensagensInstrucao": [
      "Referente ao faturamento de farinhas Total Trigo",
      "Nao receber apos 30 dias do vencimento"
    ],
    "gerarQrCodePix": true
  },
  "pagador": {
    "tipoPessoa": "JURIDICA",
    "documento": "00009629000100",
    "nome": "PAES E DOCES REZENDE LTDA",
    "endereco": {
      "logradouro": "RUA SADAMU INOUE, 176",
      "bairro": "JARDIM CASA GRANDE",
      "cidade": "SAO PAULO",
      "uf": "SP",
      "cep": "04865005"
    }
  }
}
```

#### Resposta de Sucesso da API Sicredi:
```json
{
  "nossoNumero": "26100001",
  "codigoBarras": "74891987600001220101107250154321126100001000",
  "linhaDigitavel": "74891.10724 50154.321126 10000.100045 1 98760000122010",
  "qrCodePix": {
    "emv": "00020126580014br.gov.bcb.pix0136123e4567-e89b-12d3-a456-42661417400052040000530398654071220.105802BR5910TOTALTRIGO6009SAOPAULO62070503***6304ABCD",
    "imagemBase64": "iVBORw0KGgoAAAANSUhEUgAAAOIAAADiCAYAAAD...",
    "txid": "PED1025PARC01SICREDI20261018"
  },
  "urlPdfBoleto": "https://api-parceiro.sicredi.com.br/cobranca/boleto/v1/boletos/26100001/pdf"
}
```

### 4.2. Consulta de Status do Boleto (`GET /cobranca/boleto/v1/boletos/{nossoNumero}`)
Utilizado em rotinas de conciliação ativa para sincronizar o status:
* **Status Possíveis**:
  * `EM_ABERTO`: Registrado e aguardando liquidação.
  * `LIQUIDADO`: Pago pelo sacado (via Pix ou compensação).
  * `BAIXADO`: Cancelado ou baixado por instrução do cedente.
  * `VENCIDO`: Vencido e ainda não liquidado.

### 4.3. Instrução de Baixa / Cancelamento (`PATCH /cobranca/boleto/v1/boletos/{nossoNumero}/baixa`)
Permite cancelar um boleto quando um pedido for cancelado ou renegociado, evitando protesto indevido ou negativação comercial do cliente.

---

## 5. Webhook e Liquidação em Tempo Real

Para que o 4S ERP não precise consultar a API do banco repetidamente em loop (*polling*), o Sicredi disponibiliza o serviço de **Webhooks**:

```mermaid
sequenceDiagram
    autonumber
    actor Cliente as Padaria / Padeiro
    participant AppBanco as App Bancário (Qualquer Banco)
    participant SPI as SPI / Pix (Banco Central)
    participant Sicredi as Sicredi Cobrança
    participant Webhook as Endpoint 4S ERP (/api/webhooks/sicredi)
    participant ERP as Banco 4S ERP

    Cliente->>AppBanco: Lê QR Code Pix do Boleto e Paga
    AppBanco->>SPI: Transfere valor instantaneamente
    SPI->>Sicredi: Liquidação financeira na conta Total Trigo
    Sicredi->>Webhook: POST https://api.totaltrigo.com.br/api/webhooks/sicredi
    Note over Sicredi,Webhook: Header: X-Sicredi-Signature (HMAC-SHA256)
    Webhook->>Webhook: Valida assinatura de segurança com Chave Master
    Webhook->>ERP: Baixa atômica do título e atualiza pedido para LIQUIDADO
    Webhook-->>Sicredi: HTTP 200 OK
```

### 5.1. Payload do Webhook Sicredi:
```json
{
  "evento": "LIQUIDACAO_BOLETO",
  "dataHoraEvento": "2026-10-18T16:45:12-03:00",
  "cooperativa": "0725",
  "posto": "01",
  "codigoBeneficiario": "54321",
  "nossoNumero": "26100001",
  "numeroDocumento": "PED-1025",
  "valorOriginal": 1220.10,
  "valorLiquidado": 1220.10,
  "canalPagamento": "PIX",
  "dataLiquidacao": "2026-10-18"
}
```

### 5.2. Tratamento de Idempotência e Segurança
1. **Validação de Assinatura**: O webhook rejeita qualquer requisição cujo header `X-Sicredi-Signature` não coincida com o hash HMAC gerado com a Chave Master da Total Trigo.
2. **Idempotência**: Caso o Sicredi reenvie a notificação por falha temporária de rede, o 4S ERP verifica se o `nossoNumero` já possui registro de liquidação; se sim, apenas responde `HTTP 200 OK` sem duplicar lançamentos contábeis.

---

## 6. A Regra de Negócio Total Trigo: Boletos Gerados sobre a `BQ`

Durante as entrevistas de alinhamento com o **Sr. Sérgio (Sócio-Fundador e Diretor Comercial)**, foi estabelecida e validada a regra pétrea de separação de volumes da Total Trigo:

> [!IMPORTANT]
> **REGRA DE OURO DO FATURAMENTO E COBRANÇA**:
> No 4S ERP, os boletos bancários do Sicredi são gerados **estritamente sobre o valor financeiro da `BQ` (`baseQuantity` — Quantidade Base Faturada)**.

### 6.1. A Distinção Essencial: `DQ` vs. `BQ`

| Conceito | Sigla | Nome Técnico no ERP | Função Operacional e Financeira |
| :--- | :---: | :--- | :--- |
| **Quantidade Física Entregue** | **`DQ`** | `deliveredQuantity` (`orderedQuantity`) | Quantidade física real de sacas descarregadas no galpão/depósito do cliente. Movimenta o estoque físico e **determina o custo do frete operacional (`DQ × R$ 4,00`)**. |
| **Quantidade Base Faturada** | **`BQ`** | `baseQuantity` (`quantity`) | Quantidade formalmente faturada na NF-e e **utilizada com exclusividade para emissão dos boletos bancários no Sicredi**. |

```mermaid
flowchart TD
    PED["Pedido Comercial Fechado pelo Sr. Sérgio"] --> SEPARACAO{"Desdobramento de Quantidades"}
    
    SEPARACAO -->|Volume Físico Real| DQ["DQ (Delivered Quantity)<br/>Exemplo: 20 Sacas Entregues"]
    SEPARACAO -->|Volume Faturado Oficial| BQ["BQ (Base Quantity)<br/>Exemplo: 15 Sacas Faturadas"]

    DQ --> ESTOQUE["Baixa no Estoque Físico: 20 Sacas"]
    DQ --> FRETE["Custo Frete: 20 × R$ 4,00 = R$ 80,00"]

    BQ --> NFE["Emissão NF-e SEFAZ: 15 Sacas"]
    BQ --> BOLETO["Boletos Sicredi: 15 × Preço Unitário"]

    style BQ fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px
    style BOLETO fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px
```

### 6.2. Demonstração Numérica Prática

Considere a seguinte negociação de campo:
* **Cliente**: Padaria Alvorada do Grajaú Ltda
* **SKU**: Farinha Tipo 1 25 kg (`SKU-05`)
* **Preço Negociado**: R$ 80,00 por saca
* **Condição Comercial**: 20 sacas físicas descarregadas (`DQ = 20`), com faturamento ajustado para 15 sacas base (`BQ = 15`)
* **Prazo de Pagamento**: 2 parcelas quinzenais (14 / 28 dias)

#### Cálculos Executados pelo Sistema:
1. **Valor Total da Cobrança Financeira**:
   $$\text{Total Cobrança} = \text{BQ} \times \text{Preço Unitário} = 15 \times \text{R\$} 80,00 = \text{R\$} 1.200,00$$
2. **Emissão das Parcelas no Sicredi**:
   * Parcela 1 (14 dias): Boleto Sicredi no valor de **R$ 600,00**
   * Parcela 2 (28 dias): Boleto Sicredi no valor de **R$ 600,00**
   * $\Sigma \text{ Boletos} = \text{R\$} 1.200,00$ (Bate perfeitamente com a NF-e emitida de 15 sacas)
3. **Apuração Operacional Interna**:
   * Baixa de Estoque: **20 sacas**
   * Custo de Frete de Entrega: $20 \times \text{R\$} 4,00 = \text{R\$} 80,00$

> [!NOTE]
> Essa regra preserva a conformidade fiscal da Total Trigo: o valor total dos boletos registrados na cooperativa Sicredi é rigorosamente idêntico ao valor total da NF-e autorizada na SEFAZ, garantindo 100% de conciliação contábil entre extrato bancário e Sped Fiscal.

---

## 7. Estrutura de Código no Spring Boot

### 7.1. Serviço de Integração Sicredi (`SicrediCobrancaService`)
```java
package br.com.totaltrigo.erp.infrastructure.banking.sicredi;

import br.com.totaltrigo.erp.domain.model.Order;
import br.com.totaltrigo.erp.domain.model.OrderItem;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Service
public class SicrediCobrancaService {

    private final RestClient restClient;
    private final SicrediTokenManager tokenManager;

    @Value("${totaltrigo.sicredi.cooperativa}")
    private String cooperativa;

    @Value("${totaltrigo.sicredi.posto}")
    private String posto;

    @Value("${totaltrigo.sicredi.beneficiario}")
    private String beneficiario;

    public SicrediCobrancaService(RestClient restClient, SicrediTokenManager tokenManager) {
        this.restClient = restClient;
        this.tokenManager = tokenManager;
    }

    /**
     * Emite boletos no Sicredi estritamente sobre a Quantidade Base (BQ)
     */
    public List<BoletoEmitidoDto> emitirBoletosParaPedido(Order order, int numeroParcelas, int diasEntreParcelas) {
        // REGRA OFICIAL: Valor total calculado sobre a BQ (quantity) de cada item
        BigDecimal totalFinanceiroBoleto = order.getItems().stream()
                .map(item -> item.getUnitSalePrice().multiply(BigDecimal.valueOf(item.getQuantity()))) // BQ
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal valorParcela = totalFinanceiroBoleto.divide(BigDecimal.valueOf(numeroParcelas), 2, RoundingMode.HALF_UP);
        List<BoletoEmitidoDto> boletosCriados = new ArrayList<>();

        for (int i = 1; i <= numeroParcelas; i++) {
            LocalDate vencimento = LocalDate.now().plusDays((long) i * diasEntreParcelas);
            String nossoNumero = gerarNossoNumeroSequencial(order.getId(), i);

            SicrediBoletoRequest request = SicrediBoletoRequest.builder()
                    .cooperativa(cooperativa)
                    .posto(posto)
                    .codigoBeneficiario(beneficiario)
                    .nossoNumero(nossoNumero)
                    .numeroDocumento(order.getId() + "/" + i)
                    .valor(valorParcela)
                    .dataVencimento(vencimento)
                    .gerarQrCodePix(true)
                    .pagador(converterPagador(order.getClient()))
                    .build();

            BoletoEmitidoDto retorno = restClient.post()
                    .uri("/cobranca/boleto/v1/boletos")
                    .header("Authorization", "Bearer " + tokenManager.obterTokenValido())
                    .body(request)
                    .retrieve()
                    .body(BoletoEmitidoDto.class);

            boletosCriados.add(retorno);
        }

        return boletosCriados;
    }

    private String gerarNossoNumeroSequencial(Long orderId, int parcela) {
        // Padrão de 8 dígitos para o nosso número da cooperativa
        return String.format("%06d%02d", orderId, parcela);
    }
}
```

---

## 8. Cronograma de Implantação e Homologação Bancária

```mermaid
gantt
    title Cronograma de Implantação da API Sicredi
    dateFormat  YYYY-MM-DD
    section Credenciamento
    Solicitação e Liberação na Cooperativa :2026-10-20, 5d
    Geração de Client ID e Chave Master    :2026-10-25, 2d
    section Homologação Técnica
    Configuração Sandbox & OAuth2         :2026-10-27, 3d
    Testes de Emissão Boleto Híbrido      :2026-10-30, 4d
    Testes de Webhook e Baixa Pix         :2026-11-03, 3d
    section Produção
    Validação de Registro na CIP (Bancos) :2026-11-06, 2d
    Entrada em Produção Oficial           :2026-11-08, 1d
```

Com este estudo e os modelos técnicos definidos, o 4S ERP fica totalmente instruído para aposentar rotinas manuais de faturamento bancário, assegurando agilidade comercial para o Sr. Sérgio na rua e controle financeiro absoluto para o Gabriel na retaguarda.
