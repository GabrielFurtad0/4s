# 📦 Atualizador Automático de Estoque (NF-e)

Automação desenvolvida sob medida para a sua **Planilha de Estoques.xlsx**, lendo diretamente os arquivos XML de NF-e e atualizando as saídas das três abas de produtos.

---

## 🚀 Como Usar no Dia a Dia

1. **Coloque os arquivos `.xml` do mês** dentro da pasta:
   ```text
   notas/
   ```
2. **Dê dois cliques no arquivo executável:**
   ```text
   executar.bat
   ```
3. O terminal abrirá exibindo:
   * Barra de progresso com o processamento dos arquivos.
   * Validação de compatibilidade do mês.
   * Criação automática de backup com data e hora na pasta `backups/`.
   * Tabela detalhada mostrando cada item lançado, linha da planilha, valor unitário e quantidade.
   * Alerta de notas duplicadas (caso uma NF já tenha sido lançada anteriormente, ela é ignorada para evitar lançamentos duplicados).

---

## 🔒 Segurança e Backups

* **Backup Original Preservado:** Uma cópia original e intacta da sua planilha foi arquivada em `backups/Planilha de Estoques - ORIGINAL 2026-10-12.xlsx`.
* **Backup Automático Pré-Execução:** Toda vez que você rodar o script e houver notas novas para lançar, uma cópia com carimbo de data e hora (ex: `Planilha de Estoques - BACKUP 2026-10-12_143000.xlsx`) é gerada automaticamente antes de qualquer gravação.

---

## 📑 Regras de Negócio e Estrutura da Planilha

### 1. Mapeamento de Produtos para as Abas
| Aba na Planilha | Código na NF-e | Palavras-Chave Identificadoras |
|---|---|---|
| **`FARINHA DE TRIGO`** | `05` / `5` | `tipo 1`, `tipo1`, `farinha de trigo tipo 1` |
| **`PRE MISTURA`** | `02` / `2` | `pre mistura`, `pré mistura` (exceto pão doce) |
| **`PM PAO DOCE`** | `03` / `3` | `pao doce`, `pão doce` |

* **Múltiplos Produtos por Nota:** Se uma mesma nota fiscal contiver itens de produtos diferentes (ex: Farinha Tipo 1 e Pré-Mistura), cada item é encaminhado automaticamente para a sua respectiva aba. Se uma nota contiver dois itens do mesmo produto (com valores ou lotes diferentes), ambos são lançados sequencialmente.

### 2. Formato das Colunas Preenchidas
Cada lançamento de saída preenche:
* **Coluna A (Data):** Data de emissão no formato de data real do Excel (`mm-dd-yy`).
* **Coluna B (N.F.):** Número da nota fiscal como número inteiro.
* **Coluna C (Preço Unitário):** Valor unitário do item da nota.
* **Coluna D / E:** Mantidas vazias.
* **Coluna F (Entrada):** Mantida vazia.
* **Coluna G (Saída):** Quantidade faturada na nota.
* **Coluna H (Saldo):** Fórmula automática de saldo: `=H{linha_anterior}-G{linha_atual}`.

### 3. Validação do Mês (Proteção do Saldo Inicial)
* O script detecta automaticamente o mês das notas fiscais e o último mês cadastrado na planilha.
* Se você colocar notas de um mês cujo cabeçalho ainda não foi criado (ex: notas de Outubro quando a planilha está em Setembro), o script **interrompe a execução com um aviso amigável**, solicitando que você abra a planilha e crie o cabeçalho do novo mês com o saldo inicial antes de rodar a automação. Isso evita qualquer erro contábil ou corrupção de saldo.

---

## ⚙️ Arquivos do Projeto

* 🚀 **[`executar.bat`](file:///c:/Users/PC-Gabriel/Documents/antigravity/epic-hawking/executar.bat)**: Executável de dois cliques no Windows.
* 🐍 **[`atualizar_estoque.py`](file:///c:/Users/PC-Gabriel/Documents/antigravity/epic-hawking/atualizar_estoque.py)**: Script principal com interface de terminal (Rich).
* ⚙️ **[`config.json`](file:///c:/Users/PC-Gabriel/Documents/antigravity/epic-hawking/config.json)**: Arquivo de configuração de caminhos e mapeamento.
* 📊 **[`Planilha de Estoques.xlsx`](file:///c:/Users/PC-Gabriel/Documents/antigravity/epic-hawking/Planilha%20de%20Estoques.xlsx)**: Sua planilha de trabalho.
* 📂 **`notas/`**: Pasta onde você coloca os arquivos XML do mês.
* 🔒 **`backups/`**: Pasta com backups automáticos gerados antes de cada gravação.
