(function() {
    'use strict';

    window.TableService = {
        allData: [],
        filteredData: [],
        currentPage: 1,
        itemsPerPage: 20,
        currentSort: { column: null, asc: true },

        init: function() {
            this.setupSearch();
            this.setupSorting();
            this.setupPagination();
        },

        renderSkeletons: function() {
            const tbody = document.getElementById('table-body');
            if (!tbody) return;

            let html = '';
            for (let i = 0; i < 6; i++) {
                html += `
                    <tr>
                        <td><span class="skeleton" style="width: 100px; height: 18px;"></span></td>
                        <td><span class="skeleton" style="width: 60px; height: 18px;"></span></td>
                        <td><span class="skeleton" style="width: 80px; height: 18px;"></span></td>
                        <td><span class="skeleton" style="width: 50px; height: 18px;"></span></td>
                        <td><span class="skeleton" style="width: 70px; height: 18px;"></span></td>
                        <td><span class="skeleton" style="width: 80px; height: 18px;"></span></td>
                        <td><span class="skeleton" style="width: 50px; height: 18px;"></span></td>
                        <td><span class="skeleton" style="width: 80px; height: 18px;"></span></td>
                        <td><span class="skeleton" style="width: 90px; height: 18px;"></span></td>
                        <td><span class="skeleton" style="width: 80px; height: 18px;"></span></td>
                        <td><span class="skeleton" style="width: 60px; height: 18px;"></span></td>
                    </tr>
                `;
            }
            tbody.innerHTML = html;
        },

        render: function(data) {
            this.allData = (data || []).map(row => {
                // Se o status for "EM ESTOQUE", a disponibilidade é 100%
                if (row.status_venda && row.status_venda.toUpperCase() === 'EM ESTOQUE') {
                    row.perc_disponivel = 100;
                    row.total_disponivel = row.total_pedido || 0;
                } else {
                    const totalRomaneio = row.total_romaneio || 0;
                    const saldoDespacho = row.saldo_despacho || 0;
                    const totalPedido = row.total_pedido || 0;

                    // Se houver romaneio ou saldo de despacho, calculamos a disponibilidade real
                    if (totalRomaneio > 0 || saldoDespacho > 0) {
                        row.total_disponivel = totalRomaneio + saldoDespacho;
                        row.perc_disponivel = totalPedido > 0 ? parseFloat(((row.total_disponivel / totalPedido) * 100).toFixed(2)) : 0;
                    } else {
                        // Caso contrário, mantemos os valores originais da planilha/ERP
                        if (row.total_disponivel === null || row.total_disponivel === undefined) {
                            row.total_disponivel = 0;
                        }
                        if (row.perc_disponivel !== null && row.perc_disponivel !== undefined) {
                            const p = parseFloat(row.perc_disponivel);
                            // Check if stored as fraction (e.g. 0.4114)
                            if (p > 0 && p <= 1) {
                                row.perc_disponivel = parseFloat((p * 100).toFixed(2));
                            } else {
                                row.perc_disponivel = parseFloat(p.toFixed(2));
                            }
                        } else {
                            row.perc_disponivel = 0;
                        }
                    }
                }
                
                // Garantir que a disponibilidade e o percentual nunca sejam negativos
                if (row.total_disponivel < 0) row.total_disponivel = 0;
                if (row.perc_disponivel < 0) row.perc_disponivel = 0;
                
                return row;
            });
            this.applyLocalFilters();
        },

        getCurrentData: function() {
            return this.filteredData;
        },

        setupSearch: function() {
            // Removido, a busca agora é global pelo backend via SupabaseService
        },

        setupSorting: function() {
            const headers = document.querySelectorAll('#table-head th[data-sort]');
            headers.forEach(th => {
                th.addEventListener('click', () => {
                    const column = th.dataset.sort;
                    
                    if (this.currentSort.column === column) {
                        this.currentSort.asc = !this.currentSort.asc;
                    } else {
                        this.currentSort.column = column;
                        this.currentSort.asc = true;
                    }

                    headers.forEach(h => {
                        h.classList.remove('sort-asc', 'sort-desc');
                    });
                    th.classList.add(this.currentSort.asc ? 'sort-asc' : 'sort-desc');

                    this.applyLocalFilters();
                });
            });
        },

        setupPagination: function() {
            const prevBtn = document.getElementById('prev-page-btn');
            const nextBtn = document.getElementById('next-page-btn');

            if (prevBtn) {
                prevBtn.addEventListener('click', () => {
                    if (this.currentPage > 1) {
                        this.currentPage--;
                        this.renderPage();
                    }
                });
            }

            if (nextBtn) {
                nextBtn.addEventListener('click', () => {
                    const maxPage = Math.ceil(this.filteredData.length / this.itemsPerPage);
                    if (this.currentPage < maxPage) {
                        this.currentPage++;
                        this.renderPage();
                    }
                });
            }
        },

        applyLocalFilters: function() {
            this.filteredData = [...this.allData];

            if (this.currentSort.column) {
                const col = this.currentSort.column;
                const asc = this.currentSort.asc ? 1 : -1;
                
                this.filteredData.sort((a, b) => {
                    let valA = a[col];
                    let valB = b[col];
                    
                    if (valA === null || valA === undefined) valA = '';
                    if (valB === null || valB === undefined) valB = '';
                    
                    if (typeof valA === 'number' && typeof valB === 'number') {
                        return (valA - valB) * asc;
                    }
                    
                    return String(valA).localeCompare(String(valB)) * asc;
                });
            }

            this.currentPage = 1;
            this.renderPage();
        },

        renderPage: function() {
            const tbody = document.getElementById('table-body');
            if (!tbody) return;

            const startIndex = (this.currentPage - 1) * this.itemsPerPage;
            const endIndex = startIndex + this.itemsPerPage;
            const pageData = this.filteredData.slice(startIndex, endIndex);

            tbody.innerHTML = '';

            if (pageData.length === 0) {
                tbody.innerHTML = '<tr><td colspan="11" style="text-align: center; padding: 2rem;">Nenhum resultado encontrado.</td></tr>';
            } else {
                pageData.forEach(row => {
                    const tr = document.createElement('tr');
                    
                    const formatCurrency = (val) => {
                        return (val === null || val === undefined) ? '-' : (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                    };
                    
                    const formatPercent = (val) => {
                        if (val === null || val === undefined) return '-';
                        // Se o valor estiver em formato decimal (ex: 0.4114 em vez de 41.14)
                        if (val > 0 && val <= 1) {
                            return `${(val * 100).toFixed(2)}%`;
                        }
                        return `${parseFloat(val).toFixed(2)}%`;
                    };
                    
                    const formatDate = (val) => {
                        if (!val) return '-';
                        const parts = val.split('-');
                        if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
                        return val;
                    };
                    
                    const getStatusClass = (status) => {
                        if (!status) return '';
                        const s = status.toUpperCase();
                        if (s.includes('ESTOQUE') || s.includes('RECEBIDO') || s === 'COMPRADO') return 'badge-success';
                        if (s.includes('ANDAMENTO') || s.includes('PARCIAL')) return 'badge-warning';
                        if (s.includes('ABERTO') || s.includes('SEM')) return 'badge-danger';
                        return 'badge-info';
                    };

                    const getProgressBar = (val) => {
                        if (val === null || val === undefined) return '-';
                        let colorClass = 'progress-danger';
                        if (val >= 75) {
                            colorClass = 'progress-success';
                        } else if (val >= 35) {
                            colorClass = 'progress-warning';
                        }
                        return `
                            <div class="table-progress-container" title="${val}% disponível">
                                <span class="progress-text-value">${val}%</span>
                                <div class="table-progress-bar">
                                    <div class="table-progress-fill ${colorClass}" style="width: ${Math.min(val, 100)}%"></div>
                                </div>
                            </div>
                        `;
                    };

                    let displayStatusVenda = row.status_venda || '-';
                    const percDisp = parseFloat(row.perc_disponivel || 0);
                    const percDesp = parseFloat(row.perc_despacho || 0);
                    if (percDisp === 0 && percDesp === 0 && displayStatusVenda.toUpperCase() !== 'EM ESTOQUE') {
                        displayStatusVenda = 'Pedido em Aberto';
                    }

                    tr.className = 'main-row';
                    tr.innerHTML = `
                        <td>${row.nome || '-'}</td>
                        <td>${row.pedido || '-'}</td>
                        <td>${row.cidade || '-'}</td>
                        <td>${row.grupo || '-'}</td>
                        <td>${row.vendedor || '-'}</td>
                        <td>${formatCurrency(row.total_pedido)}</td>
                        <td>${getProgressBar(row.perc_disponivel)}</td>
                        <td>${formatCurrency(row.total_disponivel)}</td>
                        <td><span class="status-badge ${getStatusClass(displayStatusVenda)}">${displayStatusVenda}</span></td>
                        <td><span class="status-badge ${getStatusClass(row.status_compra)}">${row.status_compra || '-'}</span></td>
                        <td>${formatDate(row.data_entrega)}</td>
                    `;
                    
                    const detailsTr = document.createElement('tr');
                    detailsTr.className = 'details-row hidden';
                    detailsTr.innerHTML = `
                        <td colspan="11">
                            <div class="row-details-wrapper">
                                <div class="details-grid">
                                    <div class="detail-item">
                                        <strong>Total Despachado:</strong>
                                        <span>${formatCurrency(row.total_despachado)}</span>
                                    </div>
                                    <div class="detail-item">
                                        <strong>Saldo Despacho:</strong>
                                        <span>${formatCurrency(row.saldo_despacho)}</span>
                                    </div>
                                    <div class="detail-item">
                                        <strong>Dt. Últ. Fornecedor:</strong>
                                        <span>${formatDate(row.dt_ult_fornecedor)}</span>
                                    </div>
                                    <div class="detail-item">
                                        <strong>Total Faturado:</strong>
                                        <span>${formatCurrency(row.total_faturado)}</span>
                                    </div>
                                    <div class="detail-item">
                                        <strong>Saldo a Faturar:</strong>
                                        <span>${formatCurrency(row.saldo_faturar)}</span>
                                    </div>
                                    <div class="detail-item">
                                        <strong>Nº Empenho:</strong>
                                        <span>${row.num_empenho || '-'}</span>
                                    </div>
                                    <div class="detail-item">
                                        <strong>% Despachado:</strong>
                                        <span>${formatPercent(row.perc_despacho)}</span>
                                    </div>
                                </div>
                            </div>
                        </td>
                    `;
                    
                    tr.addEventListener('click', () => {
                        const isHidden = detailsTr.classList.contains('hidden');
                        
                        // Fecha outros detalhes abertos apenas se formos abrir um novo
                        if (isHidden) {
                            document.querySelectorAll('.details-row').forEach(el => el.classList.add('hidden'));
                            document.querySelectorAll('.main-row').forEach(el => el.classList.remove('expanded'));
                            detailsTr.classList.remove('hidden');
                            tr.classList.add('expanded');
                        } else {
                            detailsTr.classList.add('hidden');
                            tr.classList.remove('expanded');
                        }
                    });
                    
                    tbody.appendChild(tr);
                    tbody.appendChild(detailsTr);
                });
            }

            this.updatePaginationUI();
        },

        updatePaginationUI: function() {
            const total = this.filteredData.length;
            const maxPage = Math.ceil(total / this.itemsPerPage) || 1;
            
            const tableInfo = document.getElementById('table-info');
            if (tableInfo) {
                const start = total === 0 ? 0 : ((this.currentPage - 1) * this.itemsPerPage) + 1;
                const end = Math.min(this.currentPage * this.itemsPerPage, total);
                tableInfo.textContent = `Mostrando ${start}-${end} de ${total} resultados`;
            }
            
            const pageInfo = document.getElementById('page-info');
            if (pageInfo) {
                pageInfo.textContent = `Página ${this.currentPage} de ${maxPage}`;
            }
            
            const prevBtn = document.getElementById('prev-page-btn');
            if (prevBtn) prevBtn.disabled = this.currentPage <= 1;
            
            const nextBtn = document.getElementById('next-page-btn');
            if (nextBtn) nextBtn.disabled = this.currentPage >= maxPage || maxPage === 0;
        }
    };
})();
