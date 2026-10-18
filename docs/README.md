# 📚 Central de Documentação — TotalTrigo ERP & Automação

Seja bem-vindo à documentação oficial do ecossistema **TotalTrigo** (Total Trigo Comércio de Alimentos Ltda). Este repositório centraliza toda a arquitetura de software, engenharia de requisitos, manuais operacionais, regras fiscais e guias de desenvolvimento da plataforma.

---

## 🗺️ Mapa da Documentação

A pasta `docs/` está estruturada de forma modular para atender tanto os operadores do dia a dia quanto os desenvolvedores e gestores fiscais:

| Documento Markdown | Versão HTML Interativa | Descrição / Objetivo | Público-Alvo |
| :--- | :--- | :--- | :--- |
| 🏠 [**Central de Documentação**](README.md) | 🌐 [**index.html**](index.html) | Portal unificado com estatísticas, navegação rápida, dados cadastrais e catálogo dos 3 SKUs. | Todos |
| 🗄️ *Documento Exclusivo HTML* | 🌐 [**DICIONARIO_E_ELICITACAO_DE_DADOS.html**](DICIONARIO_E_ELICITACAO_DE_DADOS.html) | Inventário e linhagem de todos os dados: proveniência, finalidade (regras/cálculos) e uso sistêmico. | Todos, Arquitetos, Devs |
| 📑 [**Estudo Técnico NF-e SEFAZ A1**](ESTUDO_TECNICO_NFE_SEFAZ_A1.md) | 🌐 [**ESTUDO_TECNICO_NFE_SEFAZ_A1.html**](ESTUDO_TECNICO_NFE_SEFAZ_A1.html) | Aposentadoria do Sebrae, emissão direta gratuita no Spring Boot via `java-nfe` e Certificado A1. | Arquitetos, Fiscal |
| 🏦 [**Estudo Técnico API Sicredi**](ESTUDO_TECNICO_API_SICREDI.md) | 🌐 [**ESTUDO_TECNICO_API_SICREDI.html**](ESTUDO_TECNICO_API_SICREDI.html) | Emissão de boletos híbridos (Código de Barras + Pix) calculados estritamente sobre a `BQ`. | Financeiro, Desenvolvedores |
| 📊 [**Manual da Automação de Planilha**](MANUAL_DE_USO_PLANILHA.md) | 🌐 [**MANUAL_DE_USO_PLANILHA.html**](MANUAL_DE_USO_PLANILHA.html) | Guia operacional do robô `automacao-planilha/`: processamento de NF-e, abas e prevenção de duplicidade. | Operador, Backoffice |
| 🏗️ [**Arquitetura do Sistema**](ARQUITETURA_DO_SISTEMA.md) | 🌐 [**ARQUITETURA_DO_SISTEMA.html**](ARQUITETURA_DO_SISTEMA.html) | Arquitetura Spring Boot 3, React Vite, ERD interativo Mermaid, máquina de estados e estoque triplo. | Desenvolvedores, Arquitetos |
| 🖥️ [**Manual Operacional do ERP**](MANUAL_OPERACIONAL_ERP.md) | 🌐 [**MANUAL_OPERACIONAL_ERP.html**](MANUAL_OPERACIONAL_ERP.html) | Manual do App Mobile (Sr. Sérgio), Ficha 360º, Mesa Pré-Nota (Gabriel) e Romaneio Cego. | Vendas Rua, Faturamento |
| ⚖️ [**Regras de Negócio e Fiscal**](REGRAS_DE_NEGOCIO_E_FISCAL.md) | 🌐 [**REGRAS_DE_NEGOCIO_E_FISCAL.html**](REGRAS_DE_NEGOCIO_E_FISCAL.html) | Legislação ICMS CST 20 (7% efetivo SP), Custo Médio Ponderado, frete R$ 4/saca (DQ) e semáforo. | Fiscal, Contabilidade |
| 🚀 [**Guia de Implantação e Setup**](GUIA_DE_IMPLANTACAO_E_DESENVOLVIMENTO.md) | 🌐 [**GUIA_DE_IMPLANTACAO_E_DESENVOLVIMENTO.html**](GUIA_DE_IMPLANTACAO_E_DESENVOLVIMENTO.html) | Instalação de pré-requisitos, inicialização em 1 clique, banco H2 e troubleshooting. | Desenvolvedores, DevOps |
| 📑 [**PRD e Arquitetura de Expansão**](PRD_E_ARQUITETURA_EXPANSAO.md) | 🌐 [**PRD_E_ARQUITETURA_EXPANSAO.html**](PRD_E_ARQUITETURA_EXPANSAO.html) | Documento original de produto, personas (Jobs-to-be-Done) e fluxo BPMN 2.0 To-Be. | Gestão, Produto |

> [!TIP]
> **Versões HTML Prontas para Navegador**: As versões `.html` contam com renderização de diagramas Mermaid ao vivo, fórmulas matemáticas formatadas, blocos de código com botão de cópia rápida e layout responsivo com suporte a impressão/PDF (`window.print()`).

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
