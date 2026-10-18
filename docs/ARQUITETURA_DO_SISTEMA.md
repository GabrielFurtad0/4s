# 🏗️ Arquitetura do Sistema e Engenharia de Software — TotalTrigo ERP

Este documento descreve a arquitetura técnica, o modelo de domínio, os fluxos de integração e a infraestrutura de dados da plataforma integrada **TotalTrigo ERP**.

---

## 🏛️ Visão Geral da Arquitetura

O ecossistema TotalTrigo é composto por três camadas complementares:

1. **Backend REST API**: Construído em **Java 21** e **Spring Boot 3.4**, aplicando padrões de Arquitetura Limpa / Hexagonal (Ports & Adapters), controle transacional rígido e migrações versionadas com **Flyway**.
2. **Frontend SPA / PWA Ready**: Desenvolvido em **React 18**, **TypeScript**, **Vite** e **Tailwind CSS**, oferecendo duas interfaces responsivas: o *App de Vendas de Campo (Mobile)* para o Sr. Sérgio e a *Mesa de Conferência Pré-Nota (Desktop)* para o Gabriel.
3. **Módulo Autônomo de Automação de Planilha**: Módulo em **Python 3** desacoplado que opera de forma local e offline para processamento batch de NF-e e atualização da `Planilha de Estoques.xlsx`.

```mermaid
graph TD
    subgraph CLIENT_LAYER["Camada de Interface (Frontend)"]
        UI_MOBILE["App Mobile Field Sales (Sr. Sérgio)<br/>• Radar Recompra<br/>• Ficha 360º<br/>• Lançamento Pedidos"]
        UI_DESKTOP["Backoffice Web (Gabriel)<br/>• Mesa Pré-Nota<br/>• Prontidão Fiscal<br/>• Landed Cost"]
    end

    subgraph API_GATEWAY["Camada de Serviços (Spring Boot 3 - Porta 8085)"]
        CTRL_SALES["FieldSalesController"]
        CTRL_BACKOFFICE["BackofficeController"]
        SRV_SALES["FieldSalesService"]
        SRV_BACKOFFICE["BackofficeService"]
        SRV_BRASILAPI["BrasilApiService (CNPJ/IBGE)"]
        PORT_NFE["NfeGatewayPort"]
        ADAPT_NFE["FocusNfeSimulatorAdapter<br/>(Chave 44 dígitos + XML 4.00)"]
    end

    subgraph PERSISTENCE["Camada de Dados & Persistência"]
        FLYWAY["Flyway Migrations (V1, V2)"]
        DB_LOCAL[("H2 Database Local<br/>(Arquivo / Em Memória)<br/>Compatível PostgreSQL")]
    end

    subgraph SPREADSHEET_MODULE["Módulo Satélite (Python)"]
        AUTOMATION["automacao-planilha/<br/>atualizar_estoque.py"]
        EXCEL[("Planilha de Estoques.xlsx")]
    end

    subgraph EXTERNAL_APIS["Serviços Externos"]
        EXT_BRASILAPI["BrasilAPI (Receita Federal / IBGE)"]
        EXT_SEFAZ["SEFAZ SP / Nuvem Fiscal / Focus NFe"]
    end

    UI_MOBILE -->|HTTP/REST| CTRL_SALES
    UI_DESKTOP -->|HTTP/REST| CTRL_BACKOFFICE
    CTRL_SALES --> SRV_SALES
    CTRL_BACKOFFICE --> SRV_BACKOFFICE
    SRV_BACKOFFICE --> SRV_BRASILAPI
    SRV_BACKOFFICE --> PORT_NFE
    PORT_NFE --> ADAPT_NFE
    SRV_BRASILAPI --> EXT_BRASILAPI
    ADAPT_NFE -.->|Fase 2: Conector Real| EXT_SEFAZ
    SRV_SALES --> DB_LOCAL
    SRV_BACKOFFICE --> DB_LOCAL
    FLYWAY --> DB_LOCAL
    ADAPT_NFE -.->|Exporta XML| AUTOMATION
    AUTOMATION --> EXCEL
```

---

## 💾 Modelo de Dados e Entidades (ERD)

A base de dados é estruturada para garantir a rastreabilidade total desde o lote de importação até a emissão da NF-e e entrega na padaria:

```mermaid
erDiagram
    products ||--o{ import_batch_items : "compoe"
    products ||--o{ order_items : "contem"
    products ||--o{ client_sku_prices : "possui tabela"

    import_batches ||--|{ import_batch_items : "possui"

    clients ||--o{ orders : "solicita"
    clients ||--o{ client_sku_prices : "tem preco ajustado"
    clients ||--o{ client_notes : "registra notas"
    clients ||--o{ visit_schedules : "possui agenda"

    orders ||--|{ order_items : "contem itens"

    products {
        bigint id PK
        varchar sku_code UK "SKU-05, SKU-02, SKU-03"
        varchar erp_code "Código SEFAZ cProd"
        varchar name "Farinha Tipo 1 25Kg..."
        int physical_stock "Estoque Físico Galpão"
        int reserved_stock "Estoque Comprometido"
        decimal current_landed_cost "Custo Médio Unitário"
        decimal base_list_price "Preço Tabela Balcão"
        varchar ncm "11010010"
        varchar cest "1704400"
        varchar c_benef "SP020390"
    }

    clients {
        bigint id PK
        varchar corporate_name "Razão Social"
        varchar trade_name "Nome Fantasia"
        varchar cnpj "14 dígitos limpos"
        varchar state_registration "IE SP"
        varchar ie_indicator "CONTRIBUINTE / ISENTO"
        varchar zip_code "CEP"
        varchar ibge_city_code "3550308 (São Paulo)"
        varchar financial_status "EM_DIA / EM_ATRASO"
        boolean is_registration_complete "Prontidão Fiscal"
    }

    orders {
        bigint id PK
        bigint client_id FK
        varchar status "AGUARDANDO_REVISAO..."
        decimal shipping_cost_estimate "Frete Estimado"
        decimal original_commercial_total "Total Pedido Rua"
        decimal gross_total "Total Faturado NF"
        decimal net_profit_snapshot "Lucro Líquido Real"
        decimal net_margin_percentage "Margem Líquida %"
        varchar nfe_status "PENDENTE / AUTORIZADA"
        varchar nfe_access_key "Chave 44 dígitos"
    }

    order_items {
        bigint id PK
        bigint order_id FK
        bigint product_id FK
        int ordered_quantity "Sacas Pedidas Rua"
        int quantity "Sacas Faturadas NF"
        decimal ordered_unit_price "Preço Rua"
        decimal unit_sale_price "Preço NF"
        decimal unit_cost_snapshot "Custo Landed no Momento"
    }

    import_batches {
        bigint id PK
        varchar batch_code UK "IMP-2026-09-ARG"
        date arrival_date "Data Chegada"
        decimal exchange_rate_usd "PTAX USD"
        decimal fob_total_usd "FOB USD"
        decimal international_freight_brl "Frete Int."
        decimal total_landed_cost_brl "Custo Total BRL"
    }
```

---

## 🔄 Máquina de Estados do Pedido e Estoque Triplo

Um dos diferenciais de engenharia do sistema é o **Controle Triplo de Estoque**, que impede vendas descobertas e garante que nenhum saco de trigo saia do galpão sem reserva prévia:

### Variáveis de Estoque por SKU
$$\text{availableStock} = \text{physicalStock} - \text{reservedStock}$$

### Transições de Estado

```mermaid
stateDiagram-v2
    [*] --> AGUARDANDO_REVISAO: Sr. Sérgio lança pedido na Rua
    note right of AGUARDANDO_REVISAO
        • physicalStock: Inalterado
        • reservedStock: +Qtd
        • availableStock: -Qtd
    end note

    AGUARDANDO_REVISAO --> EM_SEPARACAO: Gabriel aprova na Mesa Pré-Nota
    note right of EM_SEPARACAO
        • Ajuste comercial vs fiscal aplicado
        • Romaneio Cego gerado p/ Galpão
    end note

    EM_SEPARACAO --> FATURADO: NF-e emitida com sucesso
    note right of FATURADO
        • physicalStock: -Qtd definitiva
        • reservedStock: -Qtd (baixa da reserva)
        • XML 4.00 e Chave 44 gerados
    end note

    FATURADO --> ENTREGUE: Motorista conclui rota
    
    AGUARDANDO_REVISAO --> CANCELADO: Cancelado pelo Backoffice
    EM_SEPARACAO --> CANCELADO: Cancelado antes do faturamento
    note right of CANCELADO
        • reservedStock: -Qtd (estorno da reserva)
        • availableStock: +Qtd liberado
    end note
```

---

## ⚡ Integrações Externas

### 1. BrasilAPI (Autocompletar de CNPJ e Resolução IBGE)
* **Endpoint de CNPJ**: `https://brasilapi.com.br/api/cnpj/v1/{cnpj}`
  * Extrai Razão Social, Nome Fantasia, Logradouro, Número, Bairro, CEP e Município.
* **Endpoint de Municípios IBGE**: `https://brasilapi.com.br/api/ibge/municipios/v1/{uf}`
  * Obtém o código IBGE oficial de 7 dígitos (ex: `3550308` para São Paulo), campo obrigatório para transmissão de NF-e na SEFAZ.

### 2. Gerador Fiscal NF-e 4.00 (`FocusNfeSimulatorAdapter`)
O adapter gera a chave de acesso oficial de 44 dígitos calculada com o dígito verificador módulo 11 conforme o Manual de Orientação do Contribuinte (MOC):
$$\text{Chave} = \text{UF}(35) + \text{AAMM}(2610) + \text{CNPJ}(09265201000195) + \text{Mod}(55) + \text{Série}(001) + \text{nNF}(9) + \text{tpEmis}(1) + \text{cNF}(8) + \text{cDV}(1)$$
O XML emitido é 100% compatível com a estrutura de validação da SEFAZ e com o leitor Python `nfe_parser.py`.
