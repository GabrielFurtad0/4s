# 🌾 TotalTrigo - Plataforma Integrada de Gestão e Automação

Bem-vindo ao ecossistema do **TotalTrigo**. Este repositório reúne a plataforma web de gestão e força de vendas (ERP / Backoffice) e a automação de estoque via planilha Excel.

---

## 📁 Estrutura Organizada do Projeto

O repositório está estruturado em módulos independentes e bem delimitados:

```text
TotalTrigo/
├── backend/                  # ☕ API RESTful Spring Boot (Java 21, H2, Flyway)
├── frontend/                 # ⚡ Interface Web React + Vite + Tailwind CSS
├── planilha_automatica/      # 📊 Módulo isolado da Automação da Planilha de Estoque
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
├── docs/                     # 📚 Documentação arquitetural, PRDs e identidade visual
│   ├── backups/             # Backups históricos do sistema web
│   ├── PRD_E_ARQUITETURA_EXPANSAO.md
│   └── logo-4s.jpg
├── iniciar_sistema.bat       # 🚀 Script para iniciar Backend (8085) e Frontend (5173) juntos
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
- **Frontend Web**: `http://localhost:5173`

### 2. Automação da Planilha de Estoque (NF-e)
Acesse a pasta `planilha_automatica/` e dê dois cliques em:
```text
planilha_automatica/executar.bat
```
*(O script detecta o ambiente virtual `.venv` automaticamente e atualiza a planilha com os XMLs de `notas/`)*

Consulte [`planilha_automatica/README.md`](planilha_automatica/README.md) para detalhes sobre as regras contábeis, mapeamento de produtos e backups.
