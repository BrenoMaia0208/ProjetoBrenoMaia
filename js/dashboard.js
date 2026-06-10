(function() {
    'use strict';

    window.DashboardService = {
        init: function() {
            // Gráficos foram removidos do projeto
        },

        renderSkeletons: function() {
            const sumIds = ['kpi-total-pedidos', 'kpi-valor-total', 'kpi-total-faturado', 'kpi-total-despachado', 'kpi-saldo-faturar', 'kpi-saldo-despacho', 'kpi-total-solicitado'];
            sumIds.forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    el.innerHTML = '<span class="skeleton" style="width: 80px; height: 24px; vertical-align: middle;"></span>';
                }
            });
        },

        update: function(data) {
            this.updateKPIs(data);
        },

        animateValue: function(elementId, start, end, duration, formatFn) {
            const obj = document.getElementById(elementId);
            if (!obj) return;
            let startTimestamp = null;
            const step = (timestamp) => {
                if (!startTimestamp) startTimestamp = timestamp;
                const progress = Math.min((timestamp - startTimestamp) / duration, 1);
                const easeOut = 1 - Math.pow(1 - progress, 4);
                const current = start + (end - start) * easeOut;
                obj.textContent = formatFn ? formatFn(current) : Math.floor(current);
                if (progress < 1) {
                    window.requestAnimationFrame(step);
                } else {
                    obj.textContent = formatFn ? formatFn(end) : end;
                }
            };
            window.requestAnimationFrame(step);
        },

        updateKPIs: function(data) {
            const sum = (arr, key) => arr.reduce((acc, curr) => acc + (Number(curr[key]) || 0), 0);
            
            const formatCurrency = (val) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            
            // Alterar o título do card de valor total dinamicamente
            const titleEl = document.getElementById('kpi-valor-total-title');
            if (titleEl) {
                titleEl.textContent = data.length === 1 ? 'Valor Total da Venda' : 'Valor Total das Vendas';
            }

            this.animateValue('kpi-total-pedidos', 0, data.length, 1000, null);
            this.animateValue('kpi-valor-total', 0, sum(data, 'total_pedido'), 1000, formatCurrency);
            this.animateValue('kpi-total-faturado', 0, sum(data, 'total_faturado'), 1000, formatCurrency);
            this.animateValue('kpi-total-despachado', 0, sum(data, 'total_despachado'), 1000, formatCurrency);
        }
    };
})();
