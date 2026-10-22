# ⚖️ Manual Fiscal, Tributário e Regras de Negócio — TotalTrigo

Este documento consolida a parametrização tributária da **Total Trigo Comércio de Alimentos Ltda**, as regras contábeis aplicáveis ao comércio atacadista de farinhas e derivados de trigo no Estado de São Paulo, o catálogo fiscal oficial dos 3 SKUs e as fórmulas de rentabilidade comercial.

---

## 🏛️ Dados Tributários da Empresa

* **Razão Social**: TOTAL TRIGO COMERCIO DE ALIMENTOS LTDA
* **CNPJ**: `09.265.201/0001-95`
* **Inscrição Estadual (SP)**: `149.932.895.118`
* **Código de Regime Tributário (CRT)**: `3` (Regime Normal — Lucro Presumido / Real)
* **Município / UF**: São Paulo - SP (Código IBGE: `3550308`)
* **Atividade Principal (CNAE)**: `46.32-0-01` — Comércio atacadista de cereais e leguminosas beneficiados, farinhas, amidos e féculas

---

## 📑 Regime de ICMS no Estado de São Paulo

A comercialização atacadista de farinha de trigo e pré-misturas em São Paulo possui benefício fiscal com base no Regulamento do ICMS de SP (RICMS/SP):

### 1. ICMS CST 20 — Redução de Base de Cálculo
* **CST ICMS**: `20` (Com redução de base de cálculo)
* **Percentual de Redução**: `41,67%`
* **Alíquota Padrão SP**: `12%`
* **Carga Tributária Efetiva**: `7,00%`
  $$\text{Carga Efetiva} = 12\% \times (1 - 0,4167) = 7,00\%$$
* **Fundamento Legal**: Artigo 3º, Inciso XVI do Anexo III do RICMS/SP (Decreto nº 45.490/2000).
* **Código de Benefício Fiscal (`cBenef`)**: `SP020390`

### 2. CFOPs Padrão da Operação
* **`5102`**: Venda de mercadoria adquirida ou recebida de terceiros (Operações Internas no Estado de SP).
* **`6102`**: Venda de mercadoria adquirida ou recebida de terceiros (Operações Interestaduais).

---

## 🌾 Catálogo Fiscal dos 3 SKUs Oficiais

Toda a cadeia de suprimentos, faturamento eletrônico (NF-e 4.00) e planilha de estoque opera exclusivamente sobre os seguintes 3 SKUs:

| SKU | Código NF-e (`cProd`) | Descrição Comercial e SEFAZ | NCM | CEST | cBenef | CFOP SP | Unid. | Embalagem |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **SKU-05** | `0000200000001` (`05`) | Farinha de Trigo Tipo 1 25Kg | `11010010` | `1704400` | `SP020390` | `5102` | `SA` | Saco 25 kg |
| **SKU-02** | `PA02980502603` (`02`) | Farinha de Trigo Pré-Mistura 25Kg | `11010010` | `1704600` | `SP020390` | `5102` | `SA` | Saco 25 kg |
| **SKU-03** | `0002960502503` (`03`) | Pré-Mistura Pão Doce 25Kg | `11010010` | `1704600` | `SP020390` | `5102` | `SA` | Saco 25 kg |

> [!NOTE]
> No XML da NF-e e na planilha de estoque, o código do produto pode aparecer resumido (ex: `05`, `02`, `03`) ou no formato longo do ERP emissor (`0000200000001`, `PA02980502603`, `0002960502503`). O parser do TotalTrigo está homologado para tratar ambas as notações com redundância semântica.

---

## 🧮 Custo Landed Cost de Importação e Custo Médio Ponderado (CMP)

Os trigos da Total Trigo são importados principalmente do Mercosul (Argentina e Uruguai). O custo internalizado de cada lote de importação no galpão é calculado pela seguinte composição:

$$\text{Total Landed (R\$)} = (\text{FOB USD} \times \text{PTAX}) + \text{Frete Internacional} + \text{Impostos Importação} + \text{Despesas Aduaneiras}$$

### 1. Rateio por SKU e Saco de 25 kg do Novo Lote
$$\text{Custo Unitário Landed (Saco)} = \frac{\text{Custo Landed Rateado do SKU (R\$)}}{\text{Quantidade de Sacas Importadas}}$$

### 2. Regra de Entrada de Lote: Custo Médio Ponderado e Equivalência BQ = DQ
* **Equivalência na Entrada**: No momento do recebimento físico e fiscal da importação no armazém, **`BQ = DQ`** (`baseQuantity` = `deliveredQuantity`). Todas as sacas desembarcadas entram integralmente no estoque físico e contábil.
* **Cálculo do Custo Médio Ponderado (CMP)**: O sistema recalcula atomicamente o custo unitário do produto (`current_landed_cost`) ponderando o saldo remanescente em estoque com a nova remessa:
  $$\text{CMP} = \frac{(\text{Estoque Físico Anterior} \times \text{Custo Unitário Anterior}) + (\text{Quantidade Nova} \times \text{Custo Unitário Landed Novo})}{\text{Estoque Físico Anterior} + \text{Quantidade Nova}}$$

Esse valor atualizado alimenta a coluna `current_landed_cost` na tabela `products`, servindo de piso para a calculadora de margem do vendedor na rua.

---

## 📈 Formação de Preço e Metodologia de Margem Líquida

Para cada pedido gerado pelo vendedor de campo, o sistema calcula a rentabilidade líquida em tempo real, considerando a distinção operacional validada pelo Sr. Sérgio entre **`DQ`** (`deliveredQuantity` — sacas físicas entregues) e **`BQ`** (`baseQuantity` — sacas base faturadas):

### 1. Composição de Custos por Pedido
* **Receita Bruta**: $\sum (\text{BQ} \times \text{Preço Unitário Negociado})$
* **CMV (Custo da Mercadoria Vendida)**: $\sum (\text{DQ} \times \text{currentLandedCost})$ *(baixa no estoque real entregue)*
* **Custo de Frete de Entrega**: **`R$ 4,00 por saca entregue (DQ)`**
  $$\text{Custo de Frete} = \text{DQ Total} \times \text{R\$} 4,00$$
* **Carga Tributária Efetiva Estimada**: `8,00%` da Receita Bruta (ICMS efetivo 7% + PIS/COFINS proporcional).

### 2. Lucro Líquido Real e Margem Líquida
$$\text{Lucro Líquido} = \text{Receita Bruta} - \text{CMV} - \text{Frete (DQ} \times 4,00) - \text{Impostos}$$
$$\text{Margem Líquida (\%)} = \left(\frac{\text{Lucro Líquido}}{\text{Receita Bruta}}\right) \times 100$$

### 3. Semáforo Oficial de Margem Líquida (Validado pelo Sr. Sérgio)
* 🟢 **Verde (Excelente — Margem ≥ 20%)**: Rentabilidade excelente. Venda aprovada automaticamente sem restrições comerciais.
* 🟡 **Amarelo (Atenção / Negociação — 7% ≤ Margem < 20%)**: Margem intermediária aceitável para clientes estratégicos ou grandes volumes; destaca alerta visual de negociação.
* 🔴 **Vermelho (Crítica — Margem < 7%)**: Rentabilidade perigosa abaixo do piso operacional; exige justificativa e confirmação expressa do sócio para evitar prejuízo.

---

## 🛡️ Validações Cadastrais Obrigatórias para Emissão NF-e

A SEFAZ rejeita notas fiscais que contenham divergências no destinatário. A plataforma valida:

1. **Indicador de Inscrição Estadual (`indIEDest`)**:
   * `1`: Contribuinte ICMS (IE obrigatória e validada no Sintegra/SEFAZ-SP).
   * `2`: Contribuinte Isento de Inscrição Estadual.
   * `9`: Não Contribuinte (Consumidor Final).
2. **Código de Município IBGE (`cMun`)**:
   * Exigência rigorosa de 7 dígitos numéricos (ex: `3550308` para São Paulo, `3547809` para Santo André). O preenchimento é automatizado via **BrasilAPI**.
3. **Chave de Acesso da NF-e (44 Dígitos)**:
   * Estruturada rigorosamente com o código da UF (`35`), data de emissão, CNPJ emitente (`09265201000195`), modelo (`55`), série (`001`), número sequencial e dígito verificador módulo 11.

---

## 📚 Estudos Técnicos Complementares
* 📑 [**Estudo Técnico NF-e SEFAZ A1**](ESTUDO_TECNICO_NFE_SEFAZ_A1.md): Aposentadoria do Emissor Sebrae, emissão direta gratuita no Spring Boot via `java-nfe` e Certificado A1.
* 🏦 [**Estudo Técnico API Sicredi**](ESTUDO_TECNICO_API_SICREDI.md): Emissão de boletos híbridos (Código de Barras + Pix) calculados estritamente sobre a `BQ`.


> [!NOTE] Atualização Automática (18/10/2026 · Commit `5e39772`):
> Modificações estruturais registradas no domínio/banco. Consulte o [CHANGELOG](file:///docs/CHANGELOG.md) para detalhes.

> [!NOTE] Atualização Automática (21/10/2026 · Commit `a88faf9`):
> Modificações estruturais registradas no domínio/banco. Consulte o [CHANGELOG](file:///docs/CHANGELOG.md) para detalhes.
