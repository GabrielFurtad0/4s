<div align="center">

  <img src="docs/logo-4s.jpg" alt="Logo 4S ERP" width="160" style="border-radius: 20px; box-shadow: 0 8px 30px rgba(0,0,0,0.3);" />

  # 🌾 4S ERP & Field Sales

  **Plataforma B2B de Força de Vendas em Campo, Mesa de Pré-Nota Fiscal e Automação de Estoque**

  [![Java](https://img.shields.io/badge/Java-21%2B-orange.svg?logo=openjdk&logoColor=white)](https://openjdk.org/)
  [![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.4.0-6DB33F.svg?logo=springboot&logoColor=white)](https://spring.io/projects/spring-boot)
  [![React](https://img.shields.io/badge/React-19.0-61DAFB.svg?logo=react&logoColor=black)](https://react.dev/)
  [![TanStack Start](https://img.shields.io/badge/TanStack%20Start-Vite-FF4154.svg?logo=vite&logoColor=white)](https://tanstack.com/)
  [![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-3.4-38B2AC.svg?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
  [![Python](https://img.shields.io/badge/Python-3.11%2B-3776AB.svg?logo=python&logoColor=white)](https://www.python.org/)
  [![Database](https://img.shields.io/badge/H2%20Database-Local%20Persistent-003B57.svg?logo=h2&logoColor=white)](https://www.h2database.com/)
  [![License](https://img.shields.io/badge/License-Proprietary-4F46E5.svg)]()

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

O ecossistema **4S ERP** é uma plataforma corporativa desenvolvida sob medida para operações de distribuição e atacado B2B do setor alimentício (farinhas, grãos, pré-misturas e insumos em sacos de 25kg).

A solução digitaliza e sincroniza de ponta a ponta a operação comercial e fiscal em três módulos integrados:

1. **Força de Vendas Externa (Mobile-First)**: Interface ultrarrápida projetada para uso em campo pela equipe comercial, com memória de preços por cliente, pré-cadastro inteligente via consulta pública de CNPJ (BrasilAPI/ReceitaWS), cálculo instantâneo de margens de lucro e condições flexíveis de parcelamento (boletos semanais).
2. **Backoffice & Mesa de Pré-Nota (Desktop)**: Gestão fiscal e conferência centralizada conduzida pela controladoria, desacoplando o pedido comercial da nota fiscal faturada (NF-e) e gerando romaneios operacionais limpos para separação e entrega.
3. **Automação Contábil de Estoque**: Pipeline em Python que processa lotes de arquivos XML de notas fiscais da SEFAZ, realizando a apuração e baixa atômica de saídas na planilha de controle gerencial com rotina automática de backup.

---

## 🧩 Módulos do Sistema

### 📱 1. App de Força de Vendas em Campo (*Field Sales*)
- **Fechamento de Pedido em 3 Toques**: Foco em extrema velocidade, ergonomia e usabilidade para negociações em campo.
- **Memória de Preço por Cliente**: Exibição imediata da última condição comercial praticada para preservar margens e histórico.
- **Pré-Cadastro com Autocompletar de CNPJ**: Digitação dos 14 dígitos com preenchimento automático de Razão Social, Nome Fantasia, Bairro e Município.
- **Cálculo Visual de Margem Operacional**: Sinalização dinâmica por cores conforme os limiares de rentabilidade oficiais validados:
  - 🟢 **Verde (Excelente)**: $\ge 20\%$
  - 🟡 **Amarelo (Atenção / Negociação)**: $7\%$ a $19.99\%$
  - 🔴 **Vermelho (Crítica)**: $< 7\%$
- **Condições Flexíveis de Pagamento & Sicredi**: Parcelamento em múltiplos boletos faturados periodicamente (ex.: 7, 14, 21, 28 dias), calculados estritamente sobre a Quantidade Base (**`BQ`**).
- **Logística 100% Entregue (CIF Próprio)**: Todas as vendas de rua são entregues diretamente no cliente com custo de frete operacional rateado em **`R$ 4,00 por saca entregue (DQ)`** (o termo FOB aplica-se exclusivamente à compra internacional na Calculadora de Importação).

### 🖥️ 2. Backoffice & Mesa de Pré-Nota (*Fiscal & Operações*)
- **Fila de Pedidos `AGUARDANDO_REVISAO`**: Triagem e auditoria de pedidos recebidos da rua antes da autorização fiscal.
- **Ajuste Faturado vs. Físico**: Flexibilidade operacional para adequar a quantidade faturada na NF-e mantendo o controle da quantidade física entregue.
- **Emissão de Romaneios de Separação**: Documento operacional limpo (sem dados de custo ou margem) para galpão, expedição e conferência do motorista.
- **Arquitetura Pronta para SEFAZ**: Camada de serviços pronta para emissão e autorização via APIs fiscais parceiras.

### 📊 3. Automação de Estoques e Movimentações (Python + NF-e)
- **Processamento de Lotes XML**: Descompactação e leitura de arquivos `.zip` emitidos pela SEFAZ / emissores fiscais.
- **De-Para Automático de Produtos**: Mapeamento inteligente por Código interno, NCM e descrição para a planilha matriz de estoques.
- **Rotina de Backup Atômico**: Cada execução gera uma cópia segura com timestamp antes de gravar novas alterações.

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
│   ├── src/main/resources/   # Migrações Flyway e application.properties
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
├── prototipos/               # 🎨 Protótipos visuais e interfaces de referência
├── docs/                     # 📚 Documentação de arquitetura, processos e manuais
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
* **Frontend Web**: `http://localhost:8080` *(Abre automaticamente no navegador)*

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

O sistema opera com catálogo padronizado em embalagens industriais de 25 kg (`SA`):

| SKU | Código Interno | Descrição do Produto | NCM | Unidade |
| :---: | :---: | :--- | :---: | :---: |
| **SKU-05** | `0000200000001` | Farinha de Trigo Especial Tipo 1 25Kg | `11010010` | 25 kg (`SA`) |
| **SKU-02** | `PA02980502603` | Pré-Mistura Panificação Tradicional 25Kg | `11010010` | 25 kg (`SA`) |
| **SKU-03** | `0002960502503` | Pré-Mistura Panificação Doce 25Kg | `11010010` | 25 kg (`SA`) |

> [!NOTE]
> Para detalhes sobre tributação (CST 20 - Redução de Base de Cálculo de ICMS), CFOPs de saída (5102 / 6102) e fórmulas de Landed Cost, consulte a documentação técnica na pasta [`docs/`](docs/).

---

## 📖 Documentação Completa (Versões Markdown e HTML)

Guias técnicos e operacionais disponíveis na pasta [`docs/`](docs/) com versões interativas em HTML:

| Documento | Versão Markdown | Versão Web HTML (Interativa) |
| :--- | :---: | :---: |
| 📚 **Central de Documentação (Portal Hub)** | [`docs/README.md`](docs/README.md) | 🌐 [**index.html**](docs/index.html) |
| 📑 **Estudo Técnico: Emissão NF-e SEFAZ A1** | [`docs/ESTUDO_TECNICO_NFE_SEFAZ_A1.md`](docs/ESTUDO_TECNICO_NFE_SEFAZ_A1.md) | 🌐 *Markdown Técnico* |
| 🏦 **Estudo Técnico: Cobrança API Sicredi (BQ)** | [`docs/ESTUDO_TECNICO_API_SICREDI.md`](docs/ESTUDO_TECNICO_API_SICREDI.md) | 🌐 *Markdown Técnico* |
| 🏗️ **Arquitetura do Sistema & Diagramas** | [`docs/ARQUITETURA_DO_SISTEMA.md`](docs/ARQUITETURA_DO_SISTEMA.md) | 🌐 [**ARQUITETURA_DO_SISTEMA.html**](docs/ARQUITETURA_DO_SISTEMA.html) |
| 📱 **Manual Operacional do ERP & Vendas** | [`docs/MANUAL_OPERACIONAL_ERP.md`](docs/MANUAL_OPERACIONAL_ERP.md) | 🌐 [**MANUAL_OPERACIONAL_ERP.html**](docs/MANUAL_OPERACIONAL_ERP.html) |
| 📊 **Manual da Automação da Planilha** | [`docs/MANUAL_DE_USO_PLANILHA.md`](docs/MANUAL_DE_USO_PLANILHA.md) | 🌐 [**MANUAL_DE_USO_PLANILHA.html**](docs/MANUAL_DE_USO_PLANILHA.html) |
| ⚖️ **Regras Fiscais, ICMS e Landed Cost** | [`docs/REGRAS_DE_NEGOCIO_E_FISCAL.md`](docs/REGRAS_DE_NEGOCIO_E_FISCAL.md) | 🌐 [**REGRAS_DE_NEGOCIO_E_FISCAL.html**](docs/REGRAS_DE_NEGOCIO_E_FISCAL.html) |
| 🛠️ **Guia de Implantação e Setup** | [`docs/GUIA_DE_IMPLANTACAO_E_DESENVOLVIMENTO.md`](docs/GUIA_DE_IMPLANTACAO_E_DESENVOLVIMENTO.md) | 🌐 [**GUIA_DE_IMPLANTACAO_E_DESENVOLVIMENTO.html**](docs/GUIA_DE_IMPLANTACAO_E_DESENVOLVIMENTO.html) |
| 📑 **PRD e Arquitetura de Expansão (BPMN)** | [`docs/PRD_E_ARQUITETURA_EXPANSAO.md`](docs/PRD_E_ARQUITETURA_EXPANSAO.md) | 🌐 [**PRD_E_ARQUITETURA_EXPANSAO.html**](docs/PRD_E_ARQUITETURA_EXPANSAO.html) |

---

<div align="center">
  <sub>4S ERP — Plataforma de alta performance para vendas externas, mesa fiscal e gestão de estoques B2B.</sub>
</div>
