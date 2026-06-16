(function() {
    'use strict';

    window.DashboardService = {
        init: function() {
            // Gráficos foram removidos do projeto
        },

        renderSkeletons: function() {
            const sumIds = ['kpi-total-pedidos', 'kpi-total-vendas', 'kpi-total-entregue', 'kpi-total-disponivel', 'kpi-total-falteiro'];
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
            const mappedData = (data || []).map(row => {
                const r = { ...row };
                if (r.total_disponivel === null || r.total_disponivel === undefined) {
                    r.total_disponivel = 0;
                }
                return r;
            });

            const sum = (arr, key) => arr.reduce((acc, curr) => acc + (Number(curr[key]) || 0), 0);
            const formatCurrency = (val) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            
            const totalPedidosCount = mappedData.length;
            const totalVendas = sum(mappedData, 'total_pedido');
            const totalEntregue = sum(mappedData, 'total_despachado');
            const totalDisponivel = sum(mappedData, 'total_disponivel');
            const totalFalteiro = sum(mappedData, 'saldo_pedido');

            this.animateValue('kpi-total-pedidos', 0, totalPedidosCount, 1000, null);
            this.animateValue('kpi-total-vendas', 0, totalVendas, 1000, formatCurrency);
            this.animateValue('kpi-total-entregue', 0, totalEntregue, 1000, formatCurrency);
            this.animateValue('kpi-total-disponivel', 0, totalDisponivel, 1000, formatCurrency);
            this.animateValue('kpi-total-falteiro', 0, totalFalteiro, 1000, formatCurrency);
        }
    };
})();
