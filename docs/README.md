# 📚 Central de Documentação — TotalTrigo ERP & Automação

Seja bem-vindo à documentação oficial do ecossistema **TotalTrigo** (Total Trigo Comércio de Alimentos Ltda). Este repositório centraliza toda a arquitetura de software, engenharia de requisitos, manuais operacionais, regras fiscais e guias de desenvolvimento da plataforma.

---

## 🗺️ Mapa da Documentação

A pasta `docs/` está estruturada de forma modular para atender tanto os operadores do dia a dia quanto os desenvolvedores e gestores fiscais:

| Documento | Descrição / Objetivo | Público-Alvo |
| :--- | :--- | :--- |
| 📑 [**PRD e Arquitetura de Expansão**](PRD_E_ARQUITETURA_EXPANSAO.md) | Documento original de requisitos de produto, personas (JTBD), fluxo BPMN 2.0 To-Be e roadmap de expansão. | Gestão, Produto, Arquitetura |
| 📊 [**Manual da Automação de Planilha**](MANUAL_DE_USO_PLANILHA.md) | Guia operacional completo do módulo `automacao-planilha/`: processamento de NF-e, mapeamento de abas, prevenção de duplicidade e backups. | Operador da Planilha, Backoffice |
| 🏗️ [**Arquitetura do Sistema**](ARQUITETURA_DO_SISTEMA.md) | Visão técnica detalhada do Backend Spring Boot, Frontend React, Modelagem de Domínio, Banco de Dados e Integrações. | Desenvolvedores, Arquitetos |
| 🖥️ [**Manual Operacional do ERP**](MANUAL_OPERACIONAL_ERP.md) | Manual passo a passo para o App de Vendas de Rua (Sr. Sérgio), Mesa de Pré-Nota (Gabriel), Romaneio Cego e Calculadora de Importação. | Vendedores de Campo, Faturamento |
| ⚖️ [**Regras de Negócio e Fiscal**](REGRAS_DE_NEGOCIO_E_FISCAL.md) | Detalhamento tributário (CRT=3, ICMS CST 20 com Redução de BC, CFOPs, NCM), Catálogo dos 3 SKUs e Custos de Importação (Landed Cost). | Contabilidade, Fiscal, Controladoria |
| 🚀 [**Guia de Implantação e Setup**](GUIA_DE_IMPLANTACAO_E_DESENVOLVIMENTO.md) | Passo a passo de instalação de pré-requisitos, configuração de portas, Flyway migrations, scripts `.bat` e troubleshooting. | Desenvolvedores, DevOps, Suporte |

---

## 🏢 Dados Oficiais da Empresa

> **Razão Social**: TOTAL TRIGO COMERCIO DE ALIMENTOS LTDA  
> **CNPJ**: `09.265.201/0001-95` | **Inscrição Estadual**: `149.932.895.118`  
> **Regime Tributário**: Normal (`CRT = 3`) — ICMS CST 20 com Redução de Base de Cálculo de 41,67% (Carga Efetiva de 7% conf. Art. 3º do Anexo III do RICMS/SP)  
> **Endereço Sede**: Rua Marco Aurélio Marliani, 59 - Jardim Almeida Prado, São Paulo - SP (Código IBGE Município: `3550308`)

---

## 📦 Os 3 SKUs Principais

O negócio opera com 3 SKUs padronizados em sacas de 25 kg (`SA`), com controle de saídas via NF-e:

1. **SKU-05**: Farinha de Trigo Tipo 1 25Kg (`cProd: 0000200000001` / `05`)
2. **SKU-02**: Farinha de Trigo Pré-Mistura 25Kg (`cProd: PA02980502603` / `02`)
3. **SKU-03**: Pré-Mistura Pão Doce 25Kg (`cProd: 0002960502503` / `03`)

---

## ⚙️ Visão dos Módulos do Repositório

```text
TotalTrigo/
├── backend/             # API RESTful Spring Boot 3 (Java 21, H2, Flyway, BrasilAPI)
├── frontend/            # Interface React + Vite + Tailwind (Mobile Field Sales & Backoffice)
├── automacao-planilha/  # Script Python + Excel para atualização direta de saídas NF-e
├── prototipos/          # Protótipos de tela e estudos visuais 4S
└── docs/                # Documentação técnica e operacional completa
```
