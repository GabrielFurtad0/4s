# 🏗️ Arquitetura do Sistema e Engenharia de Software — TotalTrigo ERP

Este documento descreve a arquitetura técnica, o modelo de domínio com dupla quantidade e duplo estoque (DQ/BQ), os fluxos de integração fiscal e bancária, e a infraestrutura de dados da plataforma integrada **TotalTrigo ERP**.

---

## 🏛️ Visão Geral da Arquitetura

O ecossistema TotalTrigo é projetado segundo os padrões de **Arquitetura Limpa / Hexagonal (Ports & Adapters)**, estruturado em quatro camadas complementares:

1. **Backend REST API**: Construído em **Java 21 LTS** e **Spring Boot 3.4**, com separação estrita de domínios, controle transacional `@Transactional`, migrações imutáveis com **Flyway (V1 a V4)**, suíte de testes com JUnit 5 + Mockito e suporte duplo a **H2 Database** (desenvolvimento ágil) e **PostgreSQL 16** (produção via `application-prod.yml`).
2. **Frontend SPA / PWA**: Desenvolvido em **React 18**, **TypeScript**, **Vite** e **Tailwind CSS**, com sistema de design 4S ERP, sincronização em fila offline (`sw.js`), ampliação de fonte para acessibilidade em campo (`A / A+ / A++`) e suporte a 3 perfis de acesso (Gabriel, Sr. Sérgio e Expedição).
3. **Módulo de Documentos Fiscais e Sincronização**:
   - `FiscalDocumentService`: Emissão de DANFE de Retenção (Base BQ), Romaneio Cego (Base DQ para galpão/motorista), CC-e (Carta de Correção Eletrônica) e Devolução/Estorno.
   - `SpreadsheetSyncService`: Exportação automática e push do XML emitido para `automacao-planilha/notas/`, acionando `atualizar_estoque.py` em background.
4. **Módulo Satélite de Automação de Planilha**: Módulo em **Python 3** desacoplado que opera local e offline com `openpyxl` para alimentar a `Planilha de Estoques.xlsx` com backup rotativo em `automacao-planilha/backups/`.

```mermaid
graph TD
    subgraph CLIENT_LAYER["Camada de Interface (Frontend React 18 + PWA)"]
        UI_MOBILE["App Mobile Field Sales (Sr. Sérgio)<br/>• Radar Recompra & PWA Offline<br/>• Ficha 360º & Escala de Fonte<br/>• Lançamento Pedidos"]
        UI_DESKTOP["Backoffice Web (Gabriel Furtado)<br/>• 6 Módulos de Gestão<br/>• Mesa Pré-Nota & Faturamento<br/>• Contas a Receber (Boletos BQ)"]
        UI_EXPEDITION["Terminal de Expedição (Galpão)<br/>• Impressão Romaneio Cego (DQ)<br/>• Separação sem Exposição de Margens"]
    end

    subgraph API_GATEWAY["Camada de Serviços (Spring Boot 3 - Porta 8085)"]
        CTRL_SALES["FieldSalesController"]
        CTRL_BACKOFFICE["BackofficeController"]
        CTRL_DOCS["FiscalDocumentController"]
        CTRL_MGMT["ManagementExtensionController"]
        
        SRV_SALES["FieldSalesService"]
        SRV_BACKOFFICE["BackofficeService"]
        SRV_DOCS["FiscalDocumentService<br/>(DANFE BQ / Romaneio DQ)"]
        SRV_MGMT["ManagementExtensionService<br/>(Recebíveis / Auditoria / Métricas)"]
        SRV_SYNC["SpreadsheetSyncService<br/>(Push XML -> Python Sync)"]
        SRV_BRASILAPI["BrasilApiService (CNPJ/IBGE)"]
        PORT_NFE["NfeGatewayPort"]
        ADAPT_NFE["FocusNfeSimulatorAdapter<br/>(Chave 44 dígitos + XML 4.00)"]
    end

    subgraph PERSISTENCE["Camada de Dados & Persistência"]
        FLYWAY["Flyway Migrations (V1, V2, V3, V4)"]
        DB_DEV[("H2 Database Local<br/>(Arquivo / Em Memória)")]
        DB_PROD[("PostgreSQL 16 (Docker Prod)<br/>application-prod.yml")]
        REPO_AUDIT["AuditLogRepository"]
        REPO_REC["ReceivableTitleRepository"]
    end

    subgraph SPREADSHEET_MODULE["Módulo Satélite (Python 3)"]
        AUTOMATION["automacao-planilha/<br/>atualizar_estoque.py"]
        EXCEL[("Planilha de Estoques.xlsx")]
        BACKUPS["automacao-planilha/backups/"]
    end

    subgraph EXTERNAL_APIS["Serviços Externos / Integrações"]
        EXT_BRASILAPI["BrasilAPI (Receita Federal / IBGE)"]
        EXT_SEFAZ["SEFAZ SP (NF-e 4.00 / Certificado A1)"]
        EXT_SICREDI["Sicredi Open Banking (Boletos BQ / Webhooks)"]
    end

    UI_MOBILE -->|HTTP/REST / PWA Offline| CTRL_SALES
    UI_DESKTOP -->|HTTP/REST| CTRL_BACKOFFICE
    UI_DESKTOP -->|HTTP/REST| CTRL_DOCS
    UI_DESKTOP -->|HTTP/REST| CTRL_MGMT
    UI_EXPEDITION -->|HTTP/REST| CTRL_DOCS

    CTRL_SALES --> SRV_SALES
    CTRL_BACKOFFICE --> SRV_BACKOFFICE
    CTRL_DOCS --> SRV_DOCS
    CTRL_MGMT --> SRV_MGMT

    SRV_BACKOFFICE --> SRV_BRASILAPI
    SRV_BACKOFFICE --> PORT_NFE
    SRV_BACKOFFICE --> SRV_SYNC
    PORT_NFE --> ADAPT_NFE
    SRV_BRASILAPI --> EXT_BRASILAPI

    ADAPT_NFE -.->|Fase 2: Conector Real| EXT_SEFAZ
    SRV_MGMT -.->|Fase 2: API Boletos| EXT_SICREDI

    SRV_SALES --> DB_DEV
    SRV_BACKOFFICE --> DB_DEV
    SRV_MGMT --> DB_DEV
    FLYWAY --> DB_DEV
    FLYWAY --> DB_PROD

    SRV_SYNC -->|Disparo em Background| AUTOMATION
    AUTOMATION --> EXCEL
    AUTOMATION --> BACKUPS
```

---

## 💾 Modelo de Dados e Entidades (ERD)

A modelagem de dados foi expandida para contemplar a separação rigorosa entre **Expedição Física (DQ)**, **Base Faturada (BQ)**, títulos de **Contas a Receber (Boletos)** e **Trilha de Auditoria**:

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
    clients ||--o{ receivable_titles : "deve"

    orders ||--|{ order_items : "contem itens"
    orders ||--o{ receivable_titles : "gera titulos"

    products {
        bigint id PK
        varchar sku_code UK "SKU-05, SKU-02, SKU-03"
        varchar erp_code "Código SEFAZ cProd"
        varchar name "Farinha Tipo 1 25Kg..."
        int physical_stock "Estoque Físico Galpão (DQ)"
        int reserved_stock "Estoque Comprometido"
        int base_stock "Estoque Base Fiscal Acumulado (BQ)"
        decimal current_landed_cost "Custo Médio Ponderado (CMP)"
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
        varchar financial_status "EM_DIA / BOLETO_VENCIDO / BLOQUEADO"
        boolean is_registration_complete "Prontidão Fiscal"
    }

    orders {
        bigint id PK
        bigint client_id FK
        varchar status "AGUARDANDO_REVISAO, EM_SEPARACAO, FATURADO, ENTREGUE, CANCELADO"
        decimal shipping_cost_estimate "Frete Oficial: DQ x R$ 4,00"
        decimal original_commercial_total "Total Pedido Rua"
        decimal gross_total "Total Faturado NF-e (Base BQ)"
        decimal net_profit_snapshot "Lucro Líquido Real"
        decimal net_margin_percentage "Margem Líquida % (Verde >= 20, Amarelo 7-20, Vermelho < 7)"
        varchar nfe_status "PENDENTE / AUTORIZADA / CANCELADA"
        varchar nfe_access_key "Chave 44 dígitos oficial"
    }

    order_items {
        bigint id PK
        bigint order_id FK
        bigint product_id FK
        int ordered_quantity "Sacas Pedidas na Rua"
        int dispatch_quantity "Sacas Físicas Entregues (DQ)"
        int quantity "Sacas Faturadas NF-e (BQ)"
        decimal ordered_unit_price "Preço Rua"
        decimal unit_sale_price "Preço Faturado NF-e"
        decimal unit_cost_snapshot "Custo CMP no Momento"
    }

    receivable_titles {
        bigint id PK
        bigint order_id FK "Vínculo com Pedido Faturado"
        bigint client_id FK "Devedor"
        varchar client_name "Razão Social"
        varchar document_number "BOL-NF012926-01"
        int installment_number "Parcela Atual"
        int total_installments "Total Parcelas (14/28d)"
        decimal amount_bq "Valor Parcela (Calculado sobre BQ)"
        date due_date "Vencimento"
        varchar status "ABERTO, PAGO, VENCIDO, CANCELADO"
        timestamp paid_at "Data da Baixa Manual"
        varchar notes "Histórico e observações"
    }

    audit_logs {
        bigint id PK
        varchar actor_name "Gabriel Furtado / Sérgio Soares"
        varchar actor_role "Backoffice & Fiscal / Sócio & Rua"
        varchar action_type "ENTRADA_LOTE, EMISSAO_NFE, PEDIDO_NOVO, BAIXA_TITULO"
        varchar target_entity "Order, ImportBatch, ReceivableTitle, Client"
        varchar target_id "Identificador"
        varchar summary "Descrição detalhada do evento"
        timestamp created_at "Data e hora exatas"
    }

    import_batches {
        bigint id PK
        varchar batch_code UK "IMP-2026-09-ARG"
        date arrival_date "Data Chegada Galpão"
        decimal exchange_rate_usd "PTAX USD Oficial"
        decimal fob_total_usd "FOB USD"
        decimal international_freight_brl "Frete Marítimo/Rodoviário BRL"
        decimal total_landed_cost_brl "Custo Landed Nacionalizado BRL"
    }
```

---

## 📦 Engenharia de Dupla Quantidade (DQ vs BQ) e Duplo Estoque

A regra comercial introduzida pelo Sr. Sérgio exige o desacoplamento entre sacas físicas expedidas e sacas tributadas/faturadas:

### 1. Definições
* **Qtd. Expedição ($\text{DQ}$)**: Representa o volume físico efetivamente carregado no caminhão e entregue na padaria (`dispatch_quantity`).
* **Qtd. Base ($\text{BQ}$)**: Representa o volume fiscal faturado e consignado na NF-e e no boleto bancário (`quantity`).
* **Estoque Físico ($\text{physical\_stock}$)**: Quantidade real no galpão, decrementada por $\text{DQ}$.
* **Estoque Base ($\text{base\_stock}$)**: Saldo fiscal acumulado do produto faturado por $\text{BQ}$.

### 2. Equação do Estoque Disponível
$$\text{availableStock} = \text{physicalStock} - \text{reservedStock}$$

### 3. Impacto nas Fórmulas de Custos e Margem
* **Frete Oficial**: $\text{Custo Frete} = \text{DQ Total} \times \text{R\$}~4{,}00$ (pago diretamente por saca descarregada física).
* **Custo das Mercadorias Vendidas (CMV)**: $\text{CMV} = \sum (\text{DQ}_i \times \text{CMP}_i)$.
* **Faturamento Bruto**: $\text{Receita} = \sum (\text{BQ}_i \times \text{Preço NF}_i)$.
* **Boletos Bancários**: O valor dos títulos a receber é calculado **estritamente sobre a Base BQ**.

---

## 🔄 Máquina de Estados do Pedido

```mermaid
stateDiagram-v2
    [*] --> AGUARDANDO_REVISAO: Sr. Sérgio lança pedido na Rua (Mobile / PWA)
    note right of AGUARDANDO_REVISAO
        • physicalStock: Inalterado
        • reservedStock: +DQ (reserva física)
        • availableStock: -DQ
    end note

    AGUARDANDO_REVISAO --> EM_SEPARACAO: Gabriel aprova na Mesa Pré-Nota
    note right of EM_SEPARACAO
        • Ajuste comercial vs fiscal aplicado (DQ vs BQ)
        • Romaneio Cego impresso p/ Galpão (apenas DQ)
    end note

    EM_SEPARACAO --> FATURADO: NF-e emitida com sucesso (FiscalDocumentService)
    note right of FATURADO
        • physicalStock: -DQ definitiva
        • reservedStock: -DQ (baixa da reserva)
        • base_stock: -BQ
        • Boletos gerados sobre BQ (receivable_titles)
        • XML exportado p/ automacao-planilha (SpreadsheetSyncService)
    end note

    FATURADO --> ENTREGUE: Motorista conclui rota e colhe canhoto
    
    AGUARDANDO_REVISAO --> CANCELADO: Cancelado pelo Backoffice
    EM_SEPARACAO --> CANCELADO: Cancelado antes do faturamento
    note right of CANCELADO
        • reservedStock: -DQ (estorno da reserva)
        • availableStock: +DQ liberado
    end note
```

---

## 👥 Perfis de Acesso e Matriz de Autorização

O sistema opera com 3 personas operacionais bem delimitadas:

| Perfil | Ator | Acessos e Responsabilidades | Interfaces Utilizadas |
| :--- | :--- | :--- | :--- |
| **Backoffice & Fiscal** | Gabriel Furtado | Mesa Pré-Nota, Análise de Margem (farol 7%/20%), Emissão de NF-e (DANFE BQ), Geração de Boletos BQ, Baixa Manual de Títulos, Trilha de Auditoria, Entrada de Lotes de Importação (CMP). | Backoffice Desktop (6 abas completas) |
| **Comercial & Campo** | Sr. Sérgio | Radar de Recompra (dias sem comprar), Ficha 360° do Cliente, Lançamento de Pedidos Rua, Consulta de Tabela por Cliente, PWA Offline Queue, Zoom de Fonte (A/A+/A++). | App Mobile Vendas de Campo |
| **Expedição & Galpão** | Equipe de Carga | Visualização e impressão do **Romaneio Cego** (apenas sacas físicas DQ, códigos e endereço de entrega; sem faturamento ou margens). | Painel de Expedição / Impressão Fiscal |

---

## 🚢 Infraestrutura e Ambientes de Implantação

```mermaid
flowchart LR
    subgraph DEV_ENV["Ambiente de Desenvolvimento"]
        DEV_APP["Spring Boot 3.4<br/>application.yml<br/>H2 Database Local"]
        DEV_FRONT["Vite Dev Server<br/>Porta 5173 / Proxy 8085"]
    end

    subgraph PROD_ENV["Ambiente de Produção (Docker Compose)"]
        PROD_POSTGRES[("PostgreSQL 16 Alpine<br/>Porta 5432<br/>totaltrigo_prod")]
        PROD_BACKEND["totaltrigo-backend<br/>Java 21 Distroless<br/>application-prod.yml"]
        PROD_FRONTEND["totaltrigo-frontend<br/>Nginx 1.25 Alpine<br/>Single Page App"]
        BACKUP_CRON["Scripts de Backup Diário<br/>backup_db.bat / .sh"]
    end

    DEV_APP -->|Testes Unitários| JUNIT["JUnit 5 + Mockito<br/>Vitest Suite"]
    PROD_BACKEND --> PROD_POSTGRES
    PROD_FRONTEND --> PROD_BACKEND
    PROD_POSTGRES --> BACKUP_CRON
```

* **Desenvolvimento**: Execução rápida com `iniciar_sistema.bat` ou H2 local em arquivo para iterações imediatas.
* **Produção**: Orquestrado via `docker-compose.yml`, conectando o backend ao PostgreSQL 16 com migrações Flyway e Nginx servindo o frontend compilado.
* **Rotinas de Backup**:
  - `backup_db.bat` (Windows PowerShell): `pg_dump` com compressão e retenção rotativa de 30 dias em `backend/backups/`.
  - `backup_db.sh` (Linux/Bash): Compatível com cron jobs para servidores cloud.
