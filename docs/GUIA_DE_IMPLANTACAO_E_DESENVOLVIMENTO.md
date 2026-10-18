# 🚀 Guia de Implantação e Desenvolvimento — TotalTrigo

Este guia fornece as instruções técnicas para desenvolvedores, suporte e operadores instalarem, configurarem e executarem os módulos do ecossistema **TotalTrigo**.

---

## 💻 Pré-Requisitos de Ambiente

Para executar todo o ecossistema localmente no Windows, certifique-se de ter instalado:

| Tecnologia | Versão Mínima | Finalidade | Verificação no Terminal |
| :--- | :---: | :--- | :--- |
| **Java JDK** | 21 LTS | Backend Spring Boot 3 | `java -version` |
| **Apache Maven** | 3.9+ | Build e dependências do Backend | `mvn -v` |
| **Node.js & npm** | Node 18+ / npm 9+ | Frontend React + Vite + Tailwind | `node -v` e `npm -v` |
| **Python** | 3.10+ | Módulo de Automação de Planilha | `python --version` |

---

## ⚡ Inicialização Rápida (1 Clique)

O repositório inclui um script em lote para subir toda a aplicação com um duplo clique:

```text
iniciar_sistema.bat
```

### O que o script executa:
1. Abre uma janela de terminal e inicia a **API Spring Boot** na porta `8085`.
2. O **Flyway** executa automaticamente as migrações `V1__init_schema.sql` e `V2__seed_data.sql`, populando os 3 SKUs, clientes reais da Zona Sul de SP e lotes de importação.
3. Abre uma segunda janela de terminal e inicia o **Frontend Vite** na porta `5173`.
4. Aguarda 5 segundos para a subida dos servidores e abre o navegador automaticamente em:
   ```text
   http://localhost:5173
   ```

---

## 🔧 Execução Manual dos Componentes

Caso prefira rodar ou debugar os módulos individualmente:

### 1. Backend (Spring Boot 3)
```powershell
cd backend
mvn spring-boot:run
```
* **Porta HTTP**: `8085`
* **Console do Banco H2**: `http://localhost:8085/h2-console`
  * **Driver Class**: `org.h2.Driver`
  * **JDBC URL**: `jdbc:h2:file:./data/totaltrigo_db;DB_CLOSE_DELAY=-1;AUTO_SERVER=TRUE`
  * **User Name**: `sa`
  * **Password**: *(em branco)*
* **CORS**: Pré-configurado para aceitar requisições de `http://localhost:5173`.

### 2. Frontend (React 18 + Vite)
```powershell
cd frontend
npm install
npm run dev
```
* **Acesso Web**: `http://localhost:5173`
* **Executar Testes Unitários**:
  ```powershell
  npm run test
  ```
* **Compilar para Produção (Build)**:
  ```powershell
  npm run build
  ```

### 3. Módulo de Automação de Planilha (Python)
```powershell
cd automacao-planilha
.\executar.bat
```
Ou com o interpretador Python diretamente:
```powershell
# Ativando o ambiente virtual da raiz
..\.venv\Scripts\activate
python atualizar_estoque.py
```
* **Dependências Python**:
  * `openpyxl`: Manipulação de arquivos `.xlsx` mantendo fórmulas e formatações.
  * `rich`: Renderização visual com barras de progresso e tabelas coloridas no terminal.

---

## 📂 Estrutura de Diretórios do Projeto

```text
TotalTrigo/
│
├── backend/                       # API Spring Boot
│   ├── src/main/java/             # Classes de domínio, controladores e serviços
│   ├── src/main/resources/        # application.yml e migrações Flyway
│   └── pom.xml                    # Configuração Maven
│
├── frontend/                      # Interface Web React
│   ├── src/components/            # Componentes visuais (Seller, Backoffice, UI)
│   ├── src/lib/                   # Lógica de negócios (business.ts)
│   └── package.json               # Dependências npm
│
├── automacao-planilha/            # Automação de Estoque via XML
│   ├── Planilha de Estoques.xlsx  # Planilha Excel de trabalho
│   ├── atualizar_estoque.py       # Orquestrador
│   ├── config.json                # Configurações de diretórios
│   ├── notas/                     # XMLs a serem processados
│   └── backups/                   # Backups automáticos com carimbo de tempo
│
├── docs/                          # Documentação Oficial
│   ├── README.md                  # Central de documentação
│   ├── PRD_E_ARQUITETURA_EXPANSAO.md
│   ├── MANUAL_DE_USO_PLANILHA.md
│   ├── ARQUITETURA_DO_SISTEMA.md
│   ├── MANUAL_OPERACIONAL_ERP.md
│   ├── REGRAS_DE_NEGOCIO_E_FISCAL.md
│   └── GUIA_DE_IMPLANTACAO_E_DESENVOLVIMENTO.md
│
├── iniciar_sistema.bat            # Script de inicialização completa
├── .gitignore                     # Regras de exclusão Git
└── README.md                      # Apresentação do repositório
```

---

## 🛠️ Dicas e Troubleshooting

### Porta 8085 ou 5173 Ocupada
Se a porta já estiver em uso por outro processo:
* Para identificar o processo no Windows:
  ```powershell
  netstat -ano | findstr :8085
  ```
* Para encerrar o processo pelo PID:
  ```powershell
  taskkill /PID <PID> /F
  ```

### Resetar o Banco de Dados Local H2
Caso queira reiniciar o banco de dados do zero com os dados padrão do seed:
1. Encerre o Backend.
2. Exclua a pasta `backend/data/` (ou os arquivos `totaltrigo_db.mv.db`).
3. Inicie o backend novamente. O Flyway recriará as tabelas e dados automaticamente.
