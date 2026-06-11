(function() {
    'use strict';

    window.FiltersService = {
        callbacks: [],
        choicesInstances: {},
        activeQuickFilter: null,
        
        init: async function() {
            await this.populateDropdowns();
            this.attachEventListeners();
            this.updateBadge();
        },

        populateDropdowns: async function() {
            const filterConfigs = [
                { id: 'filter-cidade', col: 'cidade', label: 'Cidades' },
                { id: 'filter-grupo', col: 'grupo', label: 'Grupos' },
                { id: 'filter-programa', col: 'programa', label: 'Programas' },
                { id: 'filter-vendedor', col: 'vendedor', label: 'Vendedores' },
                { id: 'filter-status-compra', col: 'status_compra', label: 'Status Compra' },
                { id: 'filter-status-venda', col: 'status_venda', label: 'Status Venda' },
                { id: 'filter-tipo-pedido', col: 'tipo_pedido', label: 'Tipos' },
                { id: 'filter-entrega', col: 'data_entrega', label: 'Previsões de Entrega' }
            ];

            for (const config of filterConfigs) {
                const values = await window.SupabaseService.fetchDistinctValues(config.col);
                const select = document.getElementById(config.id);
                if (!select) continue;
                
                select.innerHTML = '';
                values.forEach(val => {
                    const option = document.createElement('option');
                    option.value = val;
                    if (config.col === 'data_entrega' && val) {
                        const parts = val.split('-');
                        if (parts.length === 3) {
                            option.textContent = `${parts[2]}/${parts[1]}/${parts[0]}`;
                        } else {
                            option.textContent = val;
                        }
                    } else {
                        option.textContent = val || '-';
                    }
                    select.appendChild(option);
                });

                if (window.Choices) {
                    this.choicesInstances[config.id] = new Choices(select, {
                        removeItemButton: true,
                        placeholderValue: `Selecione...`,
                        searchPlaceholderValue: 'Pesquisar...',
                        itemSelectText: '',
                        shouldSort: false,
                        noResultsText: 'Não encontrado'
                    });
                }
            }
        },

        attachEventListeners: function() {
            const filterIds = [
                'filter-cidade', 'filter-grupo', 'filter-programa', 'filter-vendedor',
                'filter-status-compra', 'filter-status-venda', 'filter-tipo-pedido',
                'filter-entrega'
            ];

            let timeout = null;
            const triggerChange = () => {
                this.updateBadge();
                clearTimeout(timeout);
                timeout = setTimeout(() => {
                    this.notifyChange();
                }, 400); // Debounce
            };

            filterIds.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.addEventListener('change', triggerChange);
            });

            const searchInput = document.getElementById('global-search');
            if (searchInput) {
                searchInput.addEventListener('input', triggerChange);
            }

            const clearBtn = document.getElementById('clear-filters-btn');
            if (clearBtn) {
                clearBtn.addEventListener('click', () => {
                    this.clearAll();
                });
            }

            // Quick Filters
            document.querySelectorAll('.btn-quick-filter').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    // Clicou num botão que já estava ativo -> desativa
                    if (e.target.classList.contains('active')) {
                        e.target.classList.remove('active');
                        this.activeQuickFilter = null;
                    } else {
                        // Ativa um novo botão
                        document.querySelectorAll('.btn-quick-filter').forEach(b => b.classList.remove('active'));
                        e.target.classList.add('active');
                        this.activeQuickFilter = e.target.dataset.filter;
                    }
                    triggerChange();
                });
            });
        },

        getActiveFilters: function() {
            const filters = {};
            const filterIds = [
                'filter-cidade', 'filter-grupo', 'filter-programa', 'filter-vendedor',
                'filter-status-compra', 'filter-status-venda', 'filter-tipo-pedido',
                'filter-entrega'
            ];

            filterIds.forEach(id => {
                if (this.choicesInstances[id]) {
                    const values = this.choicesInstances[id].getValue(true);
                    if (values && values.length > 0) {
                        const key = id.replace('filter-', '');
                        filters[key] = values;
                    }
                }
            });

            const searchInput = document.getElementById('global-search');
            if (searchInput && searchInput.value.trim() !== '') {
                filters.search = searchInput.value.trim();
            }

            if (this.activeQuickFilter) {
                filters.quick = this.activeQuickFilter;
            }

            return filters;
        },

        getFilterCount: function() {
            let count = 0;
            const filterIds = [
                'filter-cidade', 'filter-grupo', 'filter-programa', 'filter-vendedor',
                'filter-status-compra', 'filter-status-venda', 'filter-tipo-pedido',
                'filter-entrega'
            ];

            filterIds.forEach(id => {
                if (this.choicesInstances[id]) {
                    const values = this.choicesInstances[id].getValue(true);
                    if (values && values.length > 0) count += values.length;
                }
            });
            if (this.activeQuickFilter) count++;
            if (document.getElementById('global-search') && document.getElementById('global-search').value.trim() !== '') count++;
            
            return count;
        },

        updateBadge: function() {
            const badge = document.getElementById('active-filters-count');
            if (badge) {
                const count = this.getFilterCount();
                badge.textContent = `${count} ativo${count !== 1 ? 's' : ''}`;
                badge.style.display = count > 0 ? 'inline-block' : 'none';
            }
        },

        clearDropdowns: function() {
            Object.values(this.choicesInstances).forEach(instance => {
                instance.removeActiveItems();
            });
        },

        clearAll: function() {
            this.clearDropdowns();

            const searchInput = document.getElementById('global-search');
            if (searchInput) searchInput.value = '';

            this.activeQuickFilter = null;
            document.querySelectorAll('.btn-quick-filter').forEach(b => b.classList.remove('active'));

            this.updateBadge();
            this.notifyChange();
        },

        onChange: function(callback) {
            this.callbacks.push(callback);
        },

        notifyChange: function() {
            const filters = this.getActiveFilters();
            this.callbacks.forEach(cb => cb(filters));
        }
    };
})();
