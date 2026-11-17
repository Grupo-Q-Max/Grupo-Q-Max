/**
 * ContaAzul Flow - Controlador Principal da Aplicação
 */

class ContaAzulApp {
    constructor() {
        this.files = []; // { id, name, size, metadata, transactions }
        this.activeFileId = 'ALL'; // 'ALL' or fileId
        this.filterType = 'ALL';
        this.searchQuery = '';
        this.categorizer = new SmartCategorizer();

        this.initElements();
        this.initEventListeners();
        this.initTheme();
    }

    initElements() {
        // Dropzone & Inputs
        this.dropzone = document.getElementById('dropzone');
        this.fileInput = document.getElementById('fileInput');
        this.addMoreInput = document.getElementById('addMoreInput');
        this.btnSelectFiles = document.getElementById('btnSelectFiles');
        this.btnAddMore = document.getElementById('btnAddMore');

        // Progress
        this.progressContainer = document.getElementById('progressContainer');
        this.progressBar = document.getElementById('progressBar');
        this.progressStatus = document.getElementById('progressStatus');
        this.progressPercent = document.getElementById('progressPercent');

        // File Queue Section
        this.filesQueueSection = document.getElementById('filesQueueSection');
        this.fileCardsGrid = document.getElementById('fileCardsGrid');
        this.btnClearAll = document.getElementById('btnClearAll');

        // Stats Cards
        this.statCredits = document.getElementById('statCredits');
        this.statDebits = document.getElementById('statDebits');
        this.statBalance = document.getElementById('statBalance');
        this.statCount = document.getElementById('statCount');
        this.statPeriod = document.getElementById('statPeriod');

        // Table & Empty State
        this.tableSection = document.getElementById('tableSection');
        this.tableBody = document.getElementById('financialTableBody');
        this.emptyState = document.getElementById('emptyState');
        this.checkAllRows = document.getElementById('checkAllRows');
        this.txtSelectedCount = document.getElementById('txtSelectedCount');

        // Controls
        this.searchInput = document.getElementById('searchInput');
        this.filterPills = document.querySelectorAll('.filter-pill');
        this.btnAutoCategorize = document.getElementById('btnAutoCategorize');
        this.btnExportExcel = document.getElementById('btnExportExcel');
        this.btnExportXls = document.getElementById('btnExportXls');
        this.btnExportCsv = document.getElementById('btnExportCsv');
        this.btnExportOfx = document.getElementById('btnExportOfx');
        this.btnCopyTable = document.getElementById('btnCopyTable');
        this.exportDropdownContainer = document.getElementById('exportDropdownContainer');
        this.btnExportDropdown = document.getElementById('btnExportDropdown');

        // Theme toggle & Modals
        this.btnThemeToggle = document.getElementById('btnThemeToggle');
        this.btnHelp = document.getElementById('btnHelp');
        this.helpModal = document.getElementById('helpModal');
        this.btnCloseHelp = document.getElementById('btnCloseHelp');
        this.toastContainer = document.getElementById('toastContainer');
    }

    initEventListeners() {
        // Drag & Drop
        if (this.dropzone) {
            ['dragenter', 'dragover'].forEach(eventName => {
                this.dropzone.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.dropzone.classList.add('drag-over');
                });
            });

            ['dragleave', 'drop'].forEach(eventName => {
                this.dropzone.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.dropzone.classList.remove('drag-over');
                });
            });

            this.dropzone.addEventListener('drop', (e) => {
                const files = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'));
                if (files.length) this.handleFiles(files);
                else this.showToast('Por favor, envie arquivos no formato PDF de extratos.', 'warning');
            });

            this.dropzone.addEventListener('click', () => this.fileInput.click());
        }

        if (this.fileInput) {
            this.fileInput.addEventListener('change', (e) => {
                const files = Array.from(e.target.files);
                if (files.length) this.handleFiles(files);
                this.fileInput.value = '';
            });
        }

        if (this.btnSelectFiles) {
            this.btnSelectFiles.addEventListener('click', (e) => {
                e.stopPropagation();
                this.fileInput.click();
            });
        }

        if (this.btnAddMore) {
            this.btnAddMore.addEventListener('click', () => this.addMoreInput.click());
        }

        if (this.addMoreInput) {
            this.addMoreInput.addEventListener('change', (e) => {
                const files = Array.from(e.target.files);
                if (files.length) this.handleFiles(files);
                this.addMoreInput.value = '';
            });
        }

        if (this.btnClearAll) {
            this.btnClearAll.addEventListener('click', () => this.clearAll());
        }

        // Search & Filters
        if (this.searchInput) {
            this.searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value.toLowerCase().trim();
                this.renderTable();
            });
        }

        this.filterPills.forEach(pill => {
            pill.addEventListener('click', () => {
                this.filterPills.forEach(p => p.classList.remove('active'));
                pill.classList.add('active');
                this.filterType = pill.dataset.filter;
                this.renderTable();
            });
        });

        // Select / Deselect all
        if (this.checkAllRows) {
            this.checkAllRows.addEventListener('change', (e) => {
                const checked = e.target.checked;
                const visibleTxs = this.getVisibleTransactions();
                visibleTxs.forEach(tx => tx.selected = checked);
                this.renderTable();
                this.updateStats();
            });
        }

        // Auto categorize
        if (this.btnAutoCategorize) {
            this.btnAutoCategorize.addEventListener('click', () => {
                const txs = this.getAllTransactions();
                let count = 0;
                txs.forEach(tx => {
                    const res = this.categorizer.processTransaction(tx);
                    if (res.category !== tx.category || res.clientSupplier !== tx.clientSupplier) {
                        tx.category = res.category;
                        tx.costCenter = res.costCenter;
                        tx.clientSupplier = res.clientSupplier;
                        count++;
                    }
                });
                this.renderTable();
                this.showToast(`Auto-categorização aplicada a ${count} lançamentos!`, 'success');
            });
        }

        // Export Dropdown Trigger
        if (this.btnExportDropdown) {
            this.btnExportDropdown.addEventListener('click', (e) => {
                e.stopPropagation();
                this.exportDropdownContainer.classList.toggle('active');
            });
        }

        document.addEventListener('click', () => {
            if (this.exportDropdownContainer) this.exportDropdownContainer.classList.remove('active');
        });

        // Export Buttons
        if (this.btnExportExcel) {
            this.btnExportExcel.addEventListener('click', () => this.exportCurrent('xlsx'));
        }
        if (this.btnExportXls) {
            this.btnExportXls.addEventListener('click', () => this.exportCurrent('xls'));
        }
        if (this.btnExportCsv) {
            this.btnExportCsv.addEventListener('click', () => this.exportCurrent('csv'));
        }
        if (this.btnExportOfx) {
            this.btnExportOfx.addEventListener('click', () => this.exportCurrent('ofx'));
        }
        if (this.btnCopyTable) {
            this.btnCopyTable.addEventListener('click', () => this.copyToClipboard());
        }

        // Theme Toggle
        if (this.btnThemeToggle) {
            this.btnThemeToggle.addEventListener('click', () => this.toggleTheme());
        }

        // Help Modal
        if (this.btnHelp) {
            this.btnHelp.addEventListener('click', () => this.helpModal.classList.add('active'));
        }
        if (this.btnCloseHelp) {
            this.btnCloseHelp.addEventListener('click', () => this.helpModal.classList.remove('active'));
        }
        if (this.helpModal) {
            this.helpModal.addEventListener('click', (e) => {
                if (e.target === this.helpModal) this.helpModal.classList.remove('active');
            });
        }
    }

    initTheme() {
        const saved = localStorage.getItem('app_theme') || 'dark';
        document.documentElement.setAttribute('data-theme', saved);
        this.updateThemeIcon(saved);
    }

    toggleTheme() {
        const current = document.documentElement.getAttribute('data-theme') || 'dark';
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('app_theme', next);
        this.updateThemeIcon(next);
    }

    updateThemeIcon(theme) {
        if (!this.btnThemeToggle) return;
        this.btnThemeToggle.innerHTML = theme === 'dark' ? '☀️' : '🌙';
    }

    showProgress(show, text = '', percent = 0) {
        if (!this.progressContainer) return;
        this.progressContainer.style.display = show ? 'block' : 'none';
        if (show) {
            this.progressStatus.textContent = text;
            this.progressPercent.textContent = `${Math.round(percent)}%`;
            this.progressBar.style.width = `${percent}%`;
        }
    }

    async handleFiles(fileList) {
        this.showProgress(true, 'Iniciando leitura dos extratos...', 5);
        let totalFiles = fileList.length;

        for (let i = 0; i < totalFiles; i++) {
            const file = fileList[i];
            const fileId = 'file_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);

            try {
                this.showProgress(true, `Lendo arquivo (${i + 1}/${totalFiles}): ${file.name}...`, ((i) / totalFiles) * 100);
                const arrayBuffer = await file.arrayBuffer();

                const parsed = await parseConsolidatedPdf(arrayBuffer, (page, totalPages, msg) => {
                    const stepPercent = ((i + (page / totalPages)) / totalFiles) * 100;
                    this.showProgress(true, `Arquivo ${i + 1}/${totalFiles} (${file.name}) - Pág ${page}/${totalPages}`, stepPercent);
                });

                // Parse transactions directly without setting categories (keeps blank for Conta Azul)
                this.files.push({
                    id: fileId,
                    name: file.name,
                    size: file.size,
                    metadata: parsed.metadata,
                    transactions: parsed.transactions
                });

            } catch (err) {
                console.error('Erro ao processar arquivo:', file.name, err);
                this.showToast(`Erro ao processar ${file.name}: ${err.message}`, 'error');
            }
        }

        this.showProgress(false);
        this.activeFileId = 'ALL';
        this.renderFileQueue();
        this.renderTable();
        this.updateStats();
        this.showToast(`Processamento concluído! ${this.getAllTransactions().length} lançamentos extraídos.`, 'success');
    }

    renderFileQueue() {
        if (this.files.length === 0) {
            this.filesQueueSection.classList.remove('has-files');
            this.fileCardsGrid.innerHTML = '';
            return;
        }

        this.filesQueueSection.classList.add('has-files');
        this.fileCardsGrid.innerHTML = '';

        // Master Tab: All Consolidated
        const allCard = document.createElement('div');
        allCard.className = `file-chip ${this.activeFileId === 'ALL' ? 'active' : ''}`;
        const totalTxs = this.files.reduce((acc, f) => acc + f.transactions.length, 0);
        allCard.innerHTML = `
            <div class="file-chip-info">
                <div class="file-chip-icon" style="color: var(--accent-primary);">📑</div>
                <div class="file-chip-text">
                    <div class="file-chip-name">Todos os Arquivos Consolidado</div>
                    <div class="file-chip-meta">${this.files.length} arquivo(s) • ${totalTxs} lançamentos</div>
                </div>
            </div>
        `;
        allCard.addEventListener('click', () => {
            this.activeFileId = 'ALL';
            this.renderFileQueue();
            this.renderTable();
            this.updateStats();
        });
        this.fileCardsGrid.appendChild(allCard);

        // Individual File Cards
        this.files.forEach(file => {
            const card = document.createElement('div');
            card.className = `file-chip ${this.activeFileId === file.id ? 'active' : ''}`;
            const sizeKb = (file.size / 1024).toFixed(0);
            card.innerHTML = `
                <div class="file-chip-info">
                    <div class="file-chip-icon">📄</div>
                    <div class="file-chip-text">
                        <div class="file-chip-name" title="${file.name}">${file.name}</div>
                        <div class="file-chip-meta">${file.metadata.period} • ${file.transactions.length} itens • ${sizeKb} KB</div>
                    </div>
                </div>
                <div class="file-chip-actions">
                    <button class="btn-chip-remove" title="Remover este arquivo">✕</button>
                </div>
            `;

            card.addEventListener('click', (e) => {
                if (e.target.closest('.btn-chip-remove')) return;
                this.activeFileId = file.id;
                this.renderFileQueue();
                this.renderTable();
                this.updateStats();
            });

            card.querySelector('.btn-chip-remove').addEventListener('click', (e) => {
                e.stopPropagation();
                this.removeFile(file.id);
            });

            this.fileCardsGrid.appendChild(card);
        });
    }

    removeFile(fileId) {
        this.files = this.files.filter(f => f.id !== fileId);
        if (this.activeFileId === fileId) {
            this.activeFileId = 'ALL';
        }
        this.renderFileQueue();
        this.renderTable();
        this.updateStats();
        this.showToast('Arquivo removido da lista.', 'info');
    }

    clearAll() {
        if (!confirm('Deseja limpar todos os extratos carregados?')) return;
        this.files = [];
        this.activeFileId = 'ALL';
        this.renderFileQueue();
        this.renderTable();
        this.updateStats();
        this.showToast('Todos os dados foram limpos.', 'info');
    }

    getAllTransactions() {
        if (this.activeFileId === 'ALL') {
            return this.files.flatMap(f => f.transactions);
        }
        const found = this.files.find(f => f.id === this.activeFileId);
        return found ? found.transactions : [];
    }

    getVisibleTransactions() {
        let list = this.getAllTransactions();

        // Search query
        if (this.searchQuery) {
            list = list.filter(tx => {
                return (
                    (tx.description && tx.description.toLowerCase().includes(this.searchQuery)) ||
                    (tx.category && tx.category.toLowerCase().includes(this.searchQuery)) ||
                    (tx.clientSupplier && tx.clientSupplier.toLowerCase().includes(this.searchQuery)) ||
                    (tx.date && tx.date.includes(this.searchQuery)) ||
                    (tx.amount && tx.amount.toString().includes(this.searchQuery))
                );
            });
        }

        // Filter type
        if (this.filterType === 'CREDITS') {
            list = list.filter(tx => tx.amount > 0);
        } else if (this.filterType === 'DEBITS') {
            list = list.filter(tx => tx.amount < 0);
        } else if (this.filterType === 'CATEGORIZED') {
            list = list.filter(tx => tx.category && tx.category.trim().length > 0);
        } else if (this.filterType === 'UNCATEGORIZED') {
            list = list.filter(tx => !tx.category || tx.category.trim().length === 0);
        }

        return list;
    }

    renderTable() {
        const visibleTxs = this.getVisibleTransactions();
        const allTxs = this.getAllTransactions();

        if (allTxs.length === 0) {
            this.tableSection.style.display = 'none';
            this.emptyState.style.display = 'flex';
            return;
        }

        this.tableSection.style.display = 'flex';
        this.emptyState.style.display = 'none';
        this.tableBody.innerHTML = '';

        visibleTxs.forEach((tx, idx) => {
            const tr = document.createElement('tr');
            if (!tx.selected) tr.classList.add('unselected');

            const isCredit = tx.amount > 0;
            const valFormatted = (isCredit ? 'R$ ' : '-R$ ') + Math.abs(tx.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            const valClass = isCredit ? 'val-credit' : 'val-debit';

            tr.innerHTML = `
                <td class="col-check">
                    <input type="checkbox" ${tx.selected ? 'checked' : ''} data-id="${tx.id}" class="row-check">
                </td>
                <td class="col-date">
                    <span class="badge-date editable-cell" data-field="date" data-id="${tx.id}" title="Clique para editar">${tx.date}</span>
                </td>
                <td class="col-date">
                    <span class="badge-date">${tx.date}</span>
                </td>
                <td class="col-date">
                    <span class="badge-date">${tx.date}</span>
                </td>
                <td class="col-val ${valClass} editable-cell" data-field="amount" data-id="${tx.id}" title="Clique para editar valor">
                    ${valFormatted}
                </td>
                <td class="col-desc editable-cell" data-field="description" data-id="${tx.id}" title="Clique para editar descrição">
                    ${this.escapeHtml(tx.description)}
                </td>
                <td class="col-action">
                    <button class="btn-chip-remove btn-delete-row" data-id="${tx.id}" title="Excluir lançamento">🗑️</button>
                </td>
            `;

            // Inline checkbox listener
            tr.querySelector('.row-check').addEventListener('change', (e) => {
                tx.selected = e.target.checked;
                if (!tx.selected) tr.classList.add('unselected');
                else tr.classList.remove('unselected');
                this.updateStats();
            });

            // Inline delete row
            tr.querySelector('.btn-delete-row').addEventListener('click', () => {
                this.deleteTransaction(tx.id);
            });

            // Inline cell editor listeners
            tr.querySelectorAll('.editable-cell').forEach(cell => {
                cell.addEventListener('click', (e) => {
                    if (cell.querySelector('input')) return;
                    this.makeCellEditable(cell, tx);
                });
            });

            this.tableBody.appendChild(tr);
        });

        // Update checkAll header state
        const selectedCount = visibleTxs.filter(t => t.selected).length;
        if (this.checkAllRows) {
            this.checkAllRows.checked = visibleTxs.length > 0 && selectedCount === visibleTxs.length;
            this.checkAllRows.indeterminate = selectedCount > 0 && selectedCount < visibleTxs.length;
        }

        if (this.txtSelectedCount) {
            this.txtSelectedCount.textContent = `${selectedCount} de ${visibleTxs.length} selecionados (Total: ${allTxs.length})`;
        }
    }

    makeCellEditable(cell, tx) {
        const field = cell.dataset.field;
        let originalValue = tx[field];
        if (field === 'amount') originalValue = tx.amount;

        const input = document.createElement('input');
        input.type = field === 'amount' ? 'number' : 'text';
        if (field === 'amount') input.step = '0.01';
        input.value = originalValue !== undefined ? originalValue : '';

        cell.innerHTML = '';
        cell.appendChild(input);
        input.focus();
        input.select();

        const saveAndClose = () => {
            let newVal = input.value.trim();
            if (field === 'amount') {
                const parsedNum = parseFloat(newVal);
                if (!isNaN(parsedNum)) tx.amount = parsedNum;
            } else {
                tx[field] = newVal;
                // If date was updated, update for all 3 columns
                if (field === 'date') {
                    // tx.date is updated
                }
            }
            this.renderTable();
            this.updateStats();
        };

        input.addEventListener('blur', saveAndClose);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') saveAndClose();
            if (e.key === 'Escape') this.renderTable();
        });
    }

    deleteTransaction(txId) {
        for (const file of this.files) {
            const idx = file.transactions.findIndex(t => t.id === txId);
            if (idx !== -1) {
                file.transactions.splice(idx, 1);
                break;
            }
        }
        this.renderTable();
        this.updateStats();
    }

    updateStats() {
        const txs = this.getAllTransactions().filter(t => t.selected !== false);
        let sumCredits = 0;
        let sumDebits = 0;

        txs.forEach(t => {
            if (t.amount > 0) sumCredits += t.amount;
            else sumDebits += Math.abs(t.amount);
        });

        const netBalance = sumCredits - sumDebits;

        if (this.statCredits) {
            this.statCredits.textContent = 'R$ ' + sumCredits.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
        if (this.statDebits) {
            this.statDebits.textContent = 'R$ ' + sumDebits.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
        if (this.statBalance) {
            this.statBalance.textContent = (netBalance >= 0 ? 'R$ ' : '-R$ ') + Math.abs(netBalance).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            this.statBalance.className = `stat-value ${netBalance >= 0 ? 'positive' : 'negative'}`;
        }
        if (this.statCount) {
            this.statCount.textContent = txs.length;
        }

        // Period Hint
        if (this.statPeriod) {
            if (this.activeFileId === 'ALL') {
                const periods = [...new Set(this.files.map(f => f.metadata.period))].filter(Boolean);
                this.statPeriod.textContent = periods.length ? periods.join(', ') : 'Todos os Períodos';
            } else {
                const active = this.files.find(f => f.id === this.activeFileId);
                this.statPeriod.textContent = active ? active.metadata.period : '—';
            }
        }
    }

    exportCurrent(format = 'xlsx') {
        const txs = this.getAllTransactions().filter(t => t.selected !== false);
        if (txs.length === 0) {
            this.showToast('Nenhum lançamento selecionado para exportar.', 'warning');
            return;
        }

        let baseName = 'extrato_contaazul';
        if (this.activeFileId !== 'ALL') {
            const active = this.files.find(f => f.id === this.activeFileId);
            if (active) {
                baseName = active.name
                    .replace(/\.pdf$/i, '')
                    .replace(/[^a-zA-Z0-9_\-]/g, '_') + '_contaazul';
            }
        } else if (this.files.length > 0) {
            baseName = `extrato_consolidado_${this.files.length}_arquivos_contaazul`;
        }

        const extension = format === 'csv' ? '.csv' : (format === 'ofx' ? '.ofx' : (format === 'xls' ? '.xls' : '.xlsx'));
        const filename = `${baseName}${extension}`;

        if (format === 'csv') {
            downloadContaAzulCsv(txs, filename);
            this.showToast(`Arquivo CSV exportado com sucesso (${txs.length} itens)!`, 'success');
        } else if (format === 'ofx') {
            downloadContaAzulOfx(txs, filename);
            this.showToast(`Arquivo OFX gerado com sucesso (${txs.length} itens)!`, 'success');
        } else {
            downloadContaAzulExcel(txs, filename, format);
            this.showToast(`Planilha ${format.toUpperCase()} gerada com sucesso (${txs.length} itens)!`, 'success');
        }
    }

    async copyToClipboard() {
        const txs = this.getAllTransactions().filter(t => t.selected !== false);
        if (txs.length === 0) {
            this.showToast('Nenhum lançamento selecionado para copiar.', 'warning');
            return;
        }

        try {
            const count = await copyContaAzulToClipboard(txs);
            this.showToast(`${count} linhas copiadas para a área de transferência! Pronto para colar no Excel.`, 'success');
        } catch (err) {
            this.showToast('Erro ao copiar: ' + err.message, 'error');
        }
    }

    showToast(message, type = 'info') {
        if (!this.toastContainer) return;
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        let icon = 'ℹ️';
        if (type === 'success') icon = '✅';
        if (type === 'warning') icon = '⚠️';
        if (type === 'error') icon = '❌';

        toast.innerHTML = `<span>${icon}</span> <span>${this.escapeHtml(message)}</span>`;
        this.toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            setTimeout(() => toast.remove(), 250);
        }, 4000);
    }

    escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
    window.app = new ContaAzulApp();
});
