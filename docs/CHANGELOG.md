# 📜 Histórico de Alterações (CHANGELOG) — TotalTrigo 4S ERP

Registro automatizado e sincronizado pelo **Doc Sentinel** a cada commit relevante no repositório.

---

### [dfad5d2] — 19/10/2026 às 23:05 (🔴 Estrutural / Crítico)

- **Escopo**: feat(order-slip): make order slip directly editable inline and fix full vertical scrolling
- **Componentes afetados**: `order-slip-section.tsx`, `documentPrint.ts`, `index.tsx`.
- **Camada**: Interface do Usuário / Frontend TanStack Start.

### [33c16e5] — 19/10/2026 às 22:53 (🔴 Estrutural / Crítico)

no Command Palette (`order-slip`) e botões de ação no Backoffice para emissão e visualização do

### [ce1edc9] — 18/10/2026 às 22:57 (🟡 Médio / Feature)

- **Escopo**: fix(ui): remove redundant expand button in stock header and redundant route buttons in bottom strip
- **Componentes afetados**: `backoffice.tsx`.
- **Camada**: Interface do Usuário / Frontend TanStack Start.

### [d17296b] — 18/10/2026 às 22:48 (🔴 Estrutural / Crítico)

- Implementação de integração entre a busca global (Command Palette) e a seção de Cadast

### [ae57329] — 18/10/2026 às 22:39 (🔴 Estrutural / Crítico)

- Implementação de seção de estoque retrátil no Backoffice, otimizando o espaço em tela com

### [902bf43] — 18/10/2026 às 22:35 (🟡 Médio / Feature)

- **Escopo**: feat(mobile): make header date display dynamic and interactive with calendar picker
- **Componentes afetados**: `seller.tsx`.
- **Camada**: Interface do Usuário / Frontend TanStack Start.

### [3784444] — 18/10/2026 às 22:22 (🟡 Médio / Feature)

with automatic reset to the first page.
        - Otimização da interface para visualização de grandes

### [3261f18] — 18/10/2026 às 22:19 (🔴 Estrutural / Crítico)

- Refatoração do layout da Calculadora de Importação para preenchimento integral do *viewport*,

### [5e39772] — 18/10/2026 às 22:14 (🔴 Estrutural / Crítico)

- Implementação de seletor de data para a primeira parcela no módulo de vendas, com geração automática de

### [3f061cc] — 18/10/2026 às 22:04 (🔴 Estrutural / Crítico)

- **Escopo**: fix(import): revamp import calculator layout to fit without scrolling and rename button to Adicionar Lote
- **Componentes afetados**: `management.tsx`, `styles.css`.
- **Camada**: Interface do Usuário / Frontend TanStack Start.

### [5d34a9a] — 18/10/2026 às 21:57 (🟡 Médio / Feature)

- **Interface:** Atualização do ícone da "Memória de Preços por Cliente" para o padrão `Notebook

### [62153c8] — 18/10/2026 às 21:51 (🔴 Estrutural / Crítico)

- **Escopo**: fix: remover prefixo + do botao Novo Cliente e adicionar paginacao e scroll na listagem de clientes
- **Componentes afetados**: `backoffice.tsx`.
- **Camada**: Interface do Usuário / Frontend TanStack Start.

### [9cac798] — 18/10/2026 às 21:46 (🟡 Médio / Feature)

- **Escopo**: fix: atualizar favicon e icones do site com o logotipo oficial 4S
- **Componentes afetados**: `favicon.ico`, `manifest.json`, `sw.js` e mais 1 arquivo(s).
- **Camada**: Interface do Usuário / Frontend TanStack Start.

### [cbaf97b] — 18/10/2026 (🟡 Médio / Feature)
- **Escopo**: Implementação da barra de Carga do Caminhão do Dia (`Expedição DQ`) no rodapé da Mesa de Conferência.
- **Componentes afetados**: `backoffice.tsx`.
- **Camada**: Interface do Usuário / Frontend TanStack Start.
- **Destaque**: Totalizador em tempo real de sacas liberadas, peso bruto (`kg` e `toneladas`), frete estimado (`R$ 4,00 × DQ`) e atalho de impressão de Romaneio Cego.

### [5ba9e9d] — 18/10/2026 (🟡 Médio / Feature)
- **Escopo**: Persistência do tamanho de fonte (`A / A+ / A++`) no SSR, modal personalizado de perfil operacional e centralização da barra de busca.
- **Componentes afetados**: `index.tsx`, `__root.tsx`.
- **Camada**: Shell & Interface do Usuário.

### [664bd07] — 18/10/2026 (🟡 Médio / Feature)
- **Escopo**: Correção dos botões de ação (`DANFE`, `Romaneio`) na tabela de pedidos e estilos da Navbar.
- **Componentes afetados**: `backoffice.tsx`, `styles.css`.
- **Camada**: Interface do Usuário / CSS.

### [b3f41a0] — 18/10/2026 (Nível 0 / Visual)
- **Escopo**: Atualização do ícone da aba de Pedidos no app móvel do vendedor para o caminhão (`Truck`).
- **Componentes afetados**: `seller.tsx`.

### [ff1b68b] — 18/10/2026 (🔴 Estrutural / Crítico)
- **Escopo**: Contas a Receber e Boletos sobre `BQ`, baixa manual, CRUD completo de clientes/produtos/preços, Visão Executiva real, auditoria e fila PWA offline.
- **Componentes afetados**: `V4__crud_receivables_audit_auth.sql`, `ReceivableTitle.java`, `AuditLog.java`, `ManagementExtensionService.java`, `ManagementExtensionController.java`.
- **Camada**: Integração Full-Stack (Backend API Spring Boot + Frontend React/TanStack).

### [7b297ee] — 18/10/2026 (🔴 Estrutural / Crítico)
- **Escopo**: DANFE imprimível/PDF sobre `BQ`, Romaneio Cego impresso sobre `DQ`, eventos fiscais (CC-e e Devolução) e sincronização com a `Planilha de Estoques.xlsx`.
- **Componentes afetados**: `SpreadsheetSyncService.java`, `FiscalDocumentService.java`, `FiscalDocumentController.java`, `documentPrint.ts`.
- **Camada**: Backend Fiscal e Automação de Documentos.

### [fe6bfd4] — 18/10/2026 (🟡 Médio / Qualidade)
- **Escopo**: Suíte completa de testes automatizados unitários JUnit 5 + Mockito cobrindo regras fiscais, invariantes de estoque e cálculo de frete.
- **Componentes afetados**: `FieldSalesServiceTest.java`, `BackofficeServiceTest.java`, `FocusNfeSimulatorAdapterTest.java`.
- **Camada**: Backend Testes Unitários.

### [fc1bd2e] — 18/10/2026 (🔴 Estrutural / Crítico)
- **Escopo**: Núcleo do Domínio 4S: segregação `dispatchQuantity` (DQ) vs `baseQuantity` (BQ), Estoque Dual, Custo Médio Ponderado, frete de `R$ 4,00/saca`, semáforo `7%–20%` e carga real dos XMLs de Janeiro/2026.
- **Componentes afetados**: `V3__dq_bq_and_dual_stock.sql`, `Product.java`, `OrderItem.java`, `Order.java`, `Client.java`, `FieldSalesService.java`, `BackofficeService.java`, `XmlClientHistoryLoader.java`, `business.ts`.
- **Camada**: Núcleo de Domínio e Banco de Dados.
