<div align="center">

  <img src="docs/logo-4s.jpg" alt="Logo 4S - Total Trigo" width="160" style="border-radius: 20px; box-shadow: 0 8px 30px rgba(0,0,0,0.3);" />

  # 🌾 4S ERP & Field Sales — Total Trigo

  **Plataforma Integrada B2B de Força de Vendas em Campo, Mesa de Pré-Nota Fiscal e Automação de Estoque**

  [![Java](https://img.shields.io/badge/Java-21%2B-orange.svg?logo=openjdk&logoColor=white)](https://openjdk.org/)
  [![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.4.0-6DB33F.svg?logo=springboot&logoColor=white)](https://spring.io/projects/spring-boot)
  [![React](https://img.shields.io/badge/React-19.0-61DAFB.svg?logo=react&logoColor=black)](https://react.dev/)
  [![TanStack Start](https://img.shields.io/badge/TanStack%20Start-Vite-FF4154.svg?logo=vite&logoColor=white)](https://tanstack.com/)
  [![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-3.4-38B2AC.svg?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
  [![Python](https://img.shields.io/badge/Python-3.11%2B-3776AB.svg?logo=python&logoColor=white)](https://www.python.org/)
  [![Database](https://img.shields.io/badge/H2%20Database-Local%20Persistent-003B57.svg?logo=h2&logoColor=white)](https://www.h2database.com/)
  [![License](https://img.shields.io/badge/License-Proprietary%20%2F%20Total%20Trigo-4F46E5.svg)]()

  <p align="center">
    <a href="#-visão-geral">Visão Geral</a> •
    <a href="#-módulos-do-sistema">Módulos</a> •
    <a href="#-tecnologias">Tecnologias</a> •
    <a href="#-como-iniciar">Como Iniciar</a> •
    <a href="#-produtos--regras-de-negócio">SKUs & Fiscal</a> •
    <a href="#-documentação-completa">Documentação</a>
  </p>

</div>

---

## 📌 Visão Geral

O ecossistema **4S (Total Trigo)** foi projetado especificamente para as operações da **TOTAL TRIGO COMÉRCIO DE ALIMENTOS LTDA**, distribuidora paulistana de farinhas de trigo e pré-misturas em sacos de 25kg.

O sistema substitui anotações manuais e planilhas desconectadas por uma cadeia digital contínua em três elos integrados:

1. **Força de Vendas de Rua (Mobile-First)**: Interface ultrarrápida adaptada para operação em campo pelo vendedor (**Sr. Sérgio**), com memória de preços por cliente, pré-cadastro com autocompletar via CNPJ (BrasilAPI/ReceitaWS), cálculo instantâneo de margens e condições flexíveis de parcelamento (boletos semanais).
2. **Backoffice & Mesa de Pré-Nota (Desktop)**: Gestão fiscal e conferência centralizada conduzida por **Gabriel**, separando o pedido comercial da nota fiscal faturada (NF-e) e gerando romaneios operacionais limpos para separação e entrega.
3. **Automação Contábil da Planilha de Estoque**: Pipeline em Python que processa pacotes ZIP com XMLs de notas fiscais da SEFAZ, executando o cálculo atômico de saídas e alimentando a planilha gerencial com backups automáticos.

---

## 🧩 Módulos do Sistema

### 📱 1. App de Vendas em Campo (*Field Sales* — Sr. Sérgio)
- **Fechamento de Pedido em 3 Toques**: Foco em agilidade, ergonomia e usabilidade em telas móveis e sob sol da rua.
- **Memória de Preço por Cliente**: Exibição imediata da última condição negociada para evitar vendas abaixo do histórico.
- **Pré-Cadastro com Consulta Automática de CNPJ**: Digite apenas os 14 dígitos do CNPJ para buscar Razão Social, Nome Fantasia, Bairro e Município via BrasilAPI.
- **Cálculo de Margem Inteligente**: Sinalização visual por cores dos limites operacionais de lucro:
  - 🟢 **Verde (Margem Excelente)**: $\ge 12\%$
  - 🟡 **Amarelo (Margem de Alerta)**: $8\%$ a $11.99\%$
  - 🔴 **Vermelho (Margem Crítica)**: $< 8\%$
- **Condições Flexíveis de Pagamento**: Suporte a múltiplos boletos com vencimento a cada 7 dias (ex.: 7, 14, 21, 28 dias).
- **Esclarecimento Logístico (FOB vs. CIF)**: Badges informativos com tooltips explicativos indicando responsabilidade do frete (*Retira no Galpão* vs. *Entrega Total Trigo*).

### 🖥️ 2. Backoffice & Mesa de Pré-Nota (Gabriel)
- **Fila de Pedidos `AGUARDANDO_REVISAO`**: Triagem e aprovação de pedidos lançados na rua antes de seguirem para o faturamento.
- **Ajuste Faturado vs. Físico**: Flexibilidade para ajustar a quantidade faturada na NF-e mantendo a quantidade física real entregue.
- **Emissão de Romaneios de Separação**: Documento operacional limpo (sem margens ou custos) para expedição, galpão e motorista.
- **Pronto para Integração SEFAZ**: Arquitetura desacoplada preparada para provedores fiscais (Focus NFe / Nuvem Fiscal).

### 📊 3. Automação da Planilha de Estoques (Python + NF-e)
- **Processamento de Lotes XML**: Descompactação e leitura de arquivos `.zip` emitidos pela SEFAZ / Sebrae.
- **De-Para Automático de Produtos**: Mapeamento por Código, NCM e descrição para a planilha matriz `Planilha de Estoques.xlsx`.
- **Rotina de Backup Atômico**: Cada sincronização cria uma cópia timestamped antes de gravar alterações.

---

## 🛠️ Stack Tecnológica

| Camada | Tecnologias Principais |
| :--- | :--- |
| **Frontend** | React 19, TanStack Start, Vite, Tailwind CSS, Radix UI, Lucide Icons |
| **Backend API** | Java 21/25, Spring Boot 3.4, Spring Data JPA, Flyway Migrations |
| **Banco de Dados** | H2 Database (modo arquivo persistente local com console web) |
| **Automação** | Python 3.11+, OpenPyXL, ElementTree (XML Parser) |
| **Arquitetura** | RESTful API, Proxy Reverso Vite (`/api` $\to$ `:8085`), Clean Code |

---

## 📂 Estrutura do Repositório

```text
4s/
├── backend/                  # ☕ API Spring Boot (Java, JPA, Flyway, H2)
│   ├── src/main/java/        # Código-fonte (Controllers, Services, Entities)
│   ├── src/main/resources/   # Migrações Flyway (V1..V3) e application.properties
│   ├── mvnw.cmd / mvnw       # Maven Wrapper portátil
│   └── pom.xml
├── frontend/                 # ⚡ Aplicação Web (TanStack Start + React + Tailwind)
│   ├── src/                  # Componentes, rotas, hooks e design system
│   ├── public/               # Favicon, logo-4s e assets estáticos
│   ├── vite.config.ts        # Configuração do Vite com proxy para o backend (8085)
│   └── package.json
├── automacao-planilha/       # 📊 Script Python de atualização da planilha de estoque
│   ├── Planilha de Estoques.xlsx
│   ├── atualizar_estoque.py
│   ├── nfe_parser.py
│   ├── config.json
│   └── executar.bat
├── prototipos/               # 🎨 Protótipos visuais e telas interativas de referência
├── docs/                     # 📚 Documentação completa, PRDs e manuais operacionais
│   ├── ARQUITETURA_DO_SISTEMA.md
│   ├── MANUAL_DE_USO_PLANILHA.md
│   ├── MANUAL_OPERACIONAL_ERP.md
│   ├── REGRAS_DE_NEGOCIO_E_FISCAL.md
│   ├── GUIA_DE_IMPLANTACAO_E_DESENVOLVIMENTO.md
│   └── PRD_E_ARQUITETURA_EXPANSAO.md
├── iniciar_sistema.bat       # 🚀 Script de inicialização em 1 clique (Backend 8085 + Frontend 8080)
├── .gitignore
└── README.md
```

---

## 🚀 Como Iniciar

### 1️⃣ Inicialização em 1 Clique (Recomendado)

Basta dar um duplo clique no arquivo raiz:
```cmd
iniciar_sistema.bat
```
O script iniciará automaticamente:
* **Backend API**: `http://localhost:8085` *(Console H2: `/h2-console`)*
* **Frontend Web**: `http://localhost:8080` *(Abre sozinho no seu navegador)*

---

### 2️⃣ Inicialização Manual (Desenvolvedor)

#### Backend (Spring Boot):
```bash
cd backend
./mvnw.cmd spring-boot:run
```

#### Frontend (React / Vite):
```bash
cd frontend
npm install
npm run dev
```

#### Automação da Planilha de Estoque:
```bash
cd automacao-planilha
./executar.bat
```

---

## 🌾 Produtos & Regras de Negócio

A Total Trigo opera com **3 SKUs exclusivos** embalados em sacos de 25 kg (`SA`):

| SKU | Código ERP | Descrição | NCM | Unidade |
| :---: | :---: | :--- | :---: | :---: |
| **SKU-05** | `0000200000001` | Farinha de Trigo Tipo 1 25Kg | `11010010` | 25 kg (`SA`) |
| **SKU-02** | `PA02980502603` | Farinha Pré-Mistura Tradicional 25Kg | `11010010` | 25 kg (`SA`) |
| **SKU-03** | `0002960502503` | Pré-Mistura Pão Doce 25Kg | `11010010` | 25 kg (`SA`) |

> [!NOTE]
> Para detalhes completos sobre regras de ICMS (CST 20 - Redução de Base de Cálculo), CFOPs de saída (5102 / 6102) e fórmulas de Landed Cost, consulte [`docs/REGRAS_DE_NEGOCIO_E_FISCAL.md`](docs/REGRAS_DE_NEGOCIO_E_FISCAL.md).

---

## 📖 Documentação Completa

Para aprofundamento técnico e operacional, confira os manuais disponíveis na pasta [`docs/`](docs/):

* 📚 [**Central de Documentação (Sumário)**](docs/README.md)
* 🏗️ [**Arquitetura do Sistema & Diagrama de Dados**](docs/ARQUITETURA_DO_SISTEMA.md)
* 📱 [**Manual Operacional do ERP & Força de Vendas**](docs/MANUAL_OPERACIONAL_ERP.md)
* 📊 [**Manual de Uso da Automação de Planilha**](docs/MANUAL_DE_USO_PLANILHA.md)
* ⚖️ [**Manual de Regras Fiscais, ICMS e SKUs**](docs/REGRAS_DE_NEGOCIO_E_FISCAL.md)
* 🛠️ [**Guia de Implantação e Setup de Desenvolvimento**](docs/GUIA_DE_IMPLANTACAO_E_DESENVOLVIMENTO.md)
* 📑 [**PRD e Arquitetura de Expansão (BPMN To-Be)**](docs/PRD_E_ARQUITETURA_EXPANSAO.md)

---

<div align="center">
  <sub>Desenvolvido com foco em velocidade de rua e robustez fiscal para a <strong>Total Trigo Comércio de Alimentos Ltda</strong>.</sub>
</div>
