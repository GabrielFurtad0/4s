# 🌾 TotalTrigo - Plataforma Integrada de Gestão e Automação

Bem-vindo ao ecossistema do **TotalTrigo**. Este repositório reúne a plataforma web de gestão e força de vendas (ERP / Backoffice) e a automação de estoque via planilha Excel.

---

## 📁 Estrutura Organizada do Projeto

O repositório está estruturado em módulos independentes e bem delimitados:

```text
TotalTrigo/
├── backend/                  # ☕ API RESTful Spring Boot (Java 21, H2, Flyway)
├── frontend/                 # ⚡ Interface Web React + Vite + Tailwind CSS
├── automacao-planilha/       # 📊 Módulo isolado da Automação da Planilha de Estoque
│   ├── Planilha de Estoques.xlsx
│   ├── atualizar_estoque.py
│   ├── excel_updater.py
│   ├── nfe_parser.py
│   ├── zip_manager.py
│   ├── config.json
│   ├── executar.bat
│   ├── notas/               # Arquivos XML de notas fiscais
│   ├── zips/                # Pacotes ZIP de notas fiscais
│   ├── backups/             # Backups automáticos gerados a cada execução
│   └── README.md            # Documentação específica da automação de estoque
├── prototipos/               # 🎨 Protótipos visuais e testes de interface (HTML interativos)
│   ├── estudio_designs_prototipo_pai.html
│   └── prototipo_app_vendas_pai.html
├── docs/                     # 📚 Documentação arquitetural, PRDs, manuais e identidade
│   ├── README.md             # Central e sumário de toda a documentação
│   ├── MANUAL_DE_USO_PLANILHA.md # Manual operacional da automacao-planilha
│   ├── ARQUITETURA_DO_SISTEMA.md # Arquitetura de software, ERD e integrações
│   ├── MANUAL_OPERACIONAL_ERP.md # Manual do usuário (Mobile Sr. Sérgio e Gabriel)
│   ├── REGRAS_DE_NEGOCIO_E_FISCAL.md # ICMS CST 20, CFOPs, Landed Cost e SKUs
│   ├── GUIA_DE_IMPLANTACAO_E_DESENVOLVIMENTO.md # Setup de desenvolvimento e build
│   ├── PRD_E_ARQUITETURA_EXPANSAO.md # PRD original, personas e BPMN To-Be
│   ├── logo-4s.jpg
│   └── backups/             # Backups históricos do sistema web
├── iniciar_sistema.bat       # 🚀 Script para iniciar Backend (8085) e Frontend (8080) juntos
├── .gitignore
└── README.md
```

---

## 🚀 Como Iniciar

### 1. Sistema Web (ERP & Força de Vendas)
Dê dois cliques em:
```text
iniciar_sistema.bat
```
- **Backend API**: `http://localhost:8085` (H2 Console: `/h2-console`)
- **Frontend Web**: `http://localhost:8080`

### 2. Automação da Planilha de Estoque (NF-e)
Acesse a pasta `automacao-planilha/` e dê dois cliques em:
```text
automacao-planilha/executar.bat
```
*(O script detecta o ambiente virtual `.venv` automaticamente e atualiza a planilha com os XMLs de `notas/`)*

Consulte [`automacao-planilha/README.md`](automacao-planilha/README.md) para detalhes sobre as regras contábeis, mapeamento de produtos e backups.

---

## 📚 Documentação Técnica e Operacional

Para detalhes completos de engenharia, arquitetura, manuais de operação e regras fiscais, acesse a pasta [`docs/`](docs/) ou navegue diretamente pelos documentos:
- 📖 [**Central de Documentação (Sumário Geral)**](docs/README.md)
- 📊 [**Manual de Operação da Planilha de Estoque**](docs/MANUAL_DE_USO_PLANILHA.md)
- 🏗️ [**Arquitetura do Sistema e Modelo de Dados**](docs/ARQUITETURA_DO_SISTEMA.md)
- 🖥️ [**Manual Operacional do ERP Web**](docs/MANUAL_OPERACIONAL_ERP.md)
- ⚖️ [**Manual Fiscal, ICMS e Regras de Negócio**](docs/REGRAS_DE_NEGOCIO_E_FISCAL.md)
- 🚀 [**Guia de Implantação e Setup de Desenvolvimento**](docs/GUIA_DE_IMPLANTACAO_E_DESENVOLVIMENTO.md)
- 📑 [**PRD e Arquitetura de Expansão**](docs/PRD_E_ARQUITETURA_EXPANSAO.md)

