(function() {
    'use strict';

    window.WeeklyPlanService = {
        allPedidos: [],
        weeklyPedidos: [],
        checkedState: {}, // Local state for checked status of deliveries (by order ID)

        init: function() {
            this.setupModal();
            this.loadCheckedState();
        },

        setupModal: function() {
            const modal = document.getElementById('weekly-plan-modal');
            const openBtn = document.getElementById('weekly-plan-btn');
            const closeBtn = document.getElementById('weekly-plan-close-btn');

            if (openBtn && modal) {
                openBtn.addEventListener('click', () => {
                    modal.classList.remove('hidden');
                    this.renderPlan();
                });
            }

            if (closeBtn && modal) {
                closeBtn.addEventListener('click', () => {
                    modal.classList.add('hidden');
                });
            }

            if (modal) {
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) {
                        modal.classList.add('hidden');
                    }
                });
            }
        },

        loadCheckedState: function() {
            try {
                const saved = localStorage.getItem('weekly-checked-deliveries');
                if (saved) {
                    this.checkedState = JSON.parse(saved);
                }
            } catch (e) {
                console.error('Failed to load checked state:', e);
            }
        },

        saveCheckedState: function() {
            try {
                localStorage.setItem('weekly-checked-deliveries', JSON.stringify(this.checkedState));
            } catch (e) {
                console.error('Failed to save checked state:', e);
            }
        },

        getWeekRange: function() {
            // Get current date
            const today = new Date();
            const dayOfWeek = today.getDay(); // 0 is Sunday, 1 is Monday, etc.
            
            // Calculate Monday of current week
            const monday = new Date(today);
            const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
            monday.setDate(today.getDate() + diffToMonday);
            monday.setHours(0, 0, 0, 0);

            // Calculate Friday of current week
            const friday = new Date(monday);
            friday.setDate(monday.getDate() + 4);
            friday.setHours(23, 59, 59, 999);

            return { monday, friday };
        },

        formatDatePtBR: function(date) {
            const d = String(date.getDate()).padStart(2, '0');
            const m = String(date.getMonth() + 1).padStart(2, '0');
            return `${d}/${m}`;
        },

        update: function(pedidos) {
            this.allPedidos = pedidos || [];
            
            // Filter pedidos for current week (Monday to Friday)
            const { monday, friday } = this.getWeekRange();
            
            // Format dates header badge
            const rangeBadge = document.getElementById('weekly-plan-dates');
            if (rangeBadge) {
                rangeBadge.textContent = `${this.formatDatePtBR(monday)} a ${this.formatDatePtBR(friday)}`;
            }

            this.weeklyPedidos = this.allPedidos.filter(p => {
                if (!p.data_entrega) return false;
                const deliveryDate = new Date(p.data_entrega + 'T12:00:00'); // avoid timezone offsets
                return deliveryDate >= monday && deliveryDate <= friday;
            });

            // Sort weekly pedidos by date
            this.weeklyPedidos.sort((a, b) => new Date(a.data_entrega) - new Date(b.data_entrega));
        },

        getDayName: function(dateStr) {
            const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
            const date = new Date(dateStr + 'T12:00:00');
            return days[date.getDay()];
        },

        renderPlan: function() {
            const tbody = document.getElementById('weekly-plan-tbody');
            if (!tbody) return;

            tbody.innerHTML = '';

            if (this.weeklyPedidos.length === 0) {
                tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem; color: var(--text-secondary);">Nenhuma entrega prevista para a semana atual.</td></tr>';
                return;
            }

            const formatCurrency = (val) => {
                return (val === null || val === undefined) ? '-' : (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            };

            const formatDate = (val) => {
                if (!val) return '-';
                const parts = val.split('-');
                if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
                return val;
            };

            this.weeklyPedidos.forEach(p => {
                const tr = document.createElement('tr');
                const isChecked = !!this.checkedState[p.pedido];

                const dayName = this.getDayName(p.data_entrega);

                tr.innerHTML = `
                    <td style="font-weight: 600; color: var(--accent-secondary);">${dayName}</td>
                    <td>${formatDate(p.data_entrega)}</td>
                    <td>${p.cidade || '-'}</td>
                    <td>${p.pedido || '-'}</td>
                    <td>${p.programa || '-'}</td>
                    <td>${p.grupo || '-'}</td>
                    <td>${formatCurrency(p.total_pedido)}</td>
                    <td style="text-align: center;">
                        <label class="switch-container" style="display: inline-flex; align-items: center; cursor: pointer; gap: 8px;">
                            <input type="checkbox" class="weekly-delivery-checkbox" data-pedido="${p.pedido}" ${isChecked ? 'checked' : ''} style="cursor: pointer; width: 18px; height: 18px; accent-color: var(--accent-success);">
                            <span class="status-label" style="font-size: 0.85rem; font-weight: 500; color: ${isChecked ? 'var(--accent-success)' : 'var(--text-secondary)'};">
                                ${isChecked ? 'Realizada' : 'Pendente'}
                            </span>
                        </label>
                    </td>
                `;

                // Event listener for checkbox status changes
                const checkbox = tr.querySelector('.weekly-delivery-checkbox');
                const label = tr.querySelector('.status-label');
                checkbox.addEventListener('change', async (e) => {
                    const checked = e.target.checked;
                    this.checkedState[p.pedido] = checked;
                    this.saveCheckedState();

                    // Update UI text and color
                    if (checked) {
                        label.textContent = 'Realizada';
                        label.style.color = 'var(--accent-success)';
                        if (window.app && window.app.showNotification) {
                            window.app.showNotification(`Entrega do pedido ${p.pedido} marcada como Realizada!`, 'success');
                        }
                    } else {
                        label.textContent = 'Pendente';
                        label.style.color = 'var(--text-secondary)';
                        if (window.app && window.app.showNotification) {
                            window.app.showNotification(`Entrega do pedido ${p.pedido} marcada como Pendente.`, 'info');
                        }
                    }
                });

                tbody.appendChild(tr);
            });
        }
    };
})();
