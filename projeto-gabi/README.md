# ⚡ ContaAzul Flow - Conversor Automático de Extratos para Conta Azul

Sistema completo para transformar extratos bancários consolidados (Santander / PJ) diretamente na planilha oficial de importação do **Conta Azul**, eliminando 100% do trabalho manual do financeiro.

---

## 🎯 Principais Funcionalidades

1. **Estrutura 100% Fiel ao Modelo Conta Azul**:
   - **Regra das 3 Datas**: Preenche automaticamente as colunas `Data de Competência`, `Data de Vencimento` e `Data de Pagamento` com a data idêntica de cada movimentação (`DD/MM/AAAA`).
   - **Colunas em Branco**: Mantém Categoria, Centro de Custo, Cliente/Fornecedor em branco para não duplicar no Conta Azul e permitir alteração em lote no sistema.
   - Mantém as abas oficiais `Dados` e `Orientações`.
   - Gera tanto `.xlsx` (Excel Moderno) quanto `.xls` (BIFF8 padrão original do modelo Conta Azul) e `.csv`.

2. **Upload de Múltiplos Arquivos Simultâneos**:
   - Arraste e solte múltiplos PDFs de extrato de uma vez só.
   - Alternância entre extratos individuais ou visão unificada *"Todos os Arquivos Consolidado"*.

3. **KPIs e Edição em Tempo Real**:
   - Total de Entradas (Créditos), Total de Saídas (Débitos), Saldo Líquido e quantidade de lançamentos.
   - Clique em qualquer célula da tabela para ajustar valores, datas ou descrições antes de exportar.

4. **Execução 100% Offline e Privada**:
   - Todos os cálculos e extrações ocorrem localmente no navegador ou via Node.js. Nenhum dado financeiro sai da sua máquina.

---

## 🚀 Como Usar

### Opção 1: Via Navegador Web (Interface Visual)

Você pode iniciar o servidor local com o comando:
```bash
npm start
```
E acessar no navegador: **`http://localhost:5173`** (ou abrir o arquivo `index.html` diretamente em qualquer navegador).

1. Arraste e solte os PDFs de extrato na tela.
2. O sistema extrai instantaneamente todas as movimentações.
3. Clique em **"Baixar Planilha Conta Azul (.xlsx / .xls)"** ou no botão **"Copiar"** para colar diretamente no Excel.

---

### Opção 2: Conversão Direta via Terminal (Linha de Comando)

Para converter instantaneamente todos os PDFs da pasta sem abrir o navegador:
```bash
npm run convert
```
Ou para um arquivo específico:
```bash
node convert.js "extrato-consolidado-pj-18_08_2026_09h00m21s.pdf"
```
Ele gerará os arquivos `_contaazul.xlsx` e `_contaazul.xls` prontos na pasta!

---

## 📘 Como Importar no Conta Azul

1. Acesse o **Conta Azul** no menu **Financeiro** > **Extratos e Contas** (ou **Movimentações**).
2. Selecione a sua conta corrente bancária.
3. Clique em **Importar Extrato / Planilha**.
4. Selecione o arquivo `.xlsx` ou `.xls` gerado pelo sistema.
5. Pronto! Todas as movimentações entrarão perfeitamente conciliadas com suas respectivas datas e valores.
