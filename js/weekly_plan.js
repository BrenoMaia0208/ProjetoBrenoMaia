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
            const hours = today.getHours();
            
            // Shift to next week if it's Friday after 17:00 or weekend (Saturday/Sunday)
            let shiftToNextWeek = false;
            if (dayOfWeek === 5 && hours >= 17) {
                shiftToNextWeek = true;
            } else if (dayOfWeek === 6 || dayOfWeek === 0) {
                shiftToNextWeek = true;
            }

            const baseDate = new Date(today);
            if (shiftToNextWeek) {
                // Shift base date forward to next week's Monday
                // Friday (5) -> add 3 days, Saturday (6) -> add 2 days, Sunday (0) -> add 1 day
                const daysToAdd = dayOfWeek === 5 ? 3 : (dayOfWeek === 6 ? 2 : 1);
                baseDate.setDate(today.getDate() + daysToAdd);
            }

            const baseDayOfWeek = baseDate.getDay();
            const monday = new Date(baseDate);
            const diffToMonday = baseDayOfWeek === 0 ? -6 : 1 - baseDayOfWeek;
            monday.setDate(baseDate.getDate() + diffToMonday);
            monday.setHours(0, 0, 0, 0);

            // Friday of that week
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
            const grid = document.getElementById('weekly-plan-grid');
            if (!grid) return;

            grid.innerHTML = '';

            const formatCurrency = (val) => {
                return (val === null || val === undefined) ? '-' : (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            };

            // Days setup (Monday to Friday)
            const weekdays = [
                { key: 'Segunda', name: 'Segunda-feira' },
                { key: 'Terça', name: 'Terça-feira' },
                { key: 'Quarta', name: 'Quarta-feira' },
                { key: 'Quinta', name: 'Quinta-feira' },
                { key: 'Sexta', name: 'Sexta-feira' }
            ];

            // Group weeklyPedidos by day name key
            const grouped = {
                'Segunda': [],
                'Terça': [],
                'Quarta': [],
                'Quinta': [],
                'Sexta': []
            };

            this.weeklyPedidos.forEach(p => {
                const dayName = this.getDayName(p.data_entrega); // e.g., 'Segunda', 'Terça', etc.
                if (grouped[dayName]) {
                    grouped[dayName].push(p);
                }
            });

            weekdays.forEach(day => {
                const dayPedidos = grouped[day.key] || [];
                const dayTotal = dayPedidos.reduce((sum, p) => sum + (p.total_pedido || 0), 0);

                const card = document.createElement('div');
                card.className = 'weekly-day-card';

                let deliveriesHtml = '';
                if (dayPedidos.length === 0) {
                    deliveriesHtml = `<div style="text-align: center; padding: 2rem 0; color: #64748b; font-size: 0.85rem; font-style: italic;">Nenhuma entrega</div>`;
                } else {
                    dayPedidos.forEach(p => {
                        const isChecked = !!this.checkedState[p.pedido];
                        deliveriesHtml += `
                            <div class="weekly-delivery-item" data-pedido="${p.pedido}">
                                <div class="weekly-delivery-header-row">
                                    <span class="delivery-cidade" title="${p.cidade || 'Não informada'}">
                                        <i class="fa-solid fa-location-dot" style="color: var(--accent-primary); margin-right: 6px;"></i>${p.cidade || 'Não informada'}
                                    </span>
                                    <button class="btn-delete-delivery" data-pedido="${p.pedido}" title="Remover do Planejamento" style="background: transparent; color: #ef4444; border: none; cursor: pointer; padding: 4px; font-size: 0.85rem; display: inline-flex; align-items: center; justify-content: center; border-radius: 4px; transition: background 0.2s;"><i class="fa-solid fa-trash-can"></i></button>
                                </div>
                                <div class="weekly-delivery-details">
                                    <div class="detail-line"><span>Programa:</span> <strong>${p.programa || '-'}</strong></div>
                                    <div class="detail-line"><span>Grupo:</span> <strong>${p.grupo || '-'}</strong></div>
                                </div>
                                <div class="weekly-delivery-footer">
                                    <span class="delivery-value">${formatCurrency(p.total_pedido)}</span>
                                    <label class="weekly-delivery-checkbox-container">
                                        <input type="checkbox" class="weekly-delivery-checkbox" data-pedido="${p.pedido}" ${isChecked ? 'checked' : ''}>
                                        <span class="status-label ${isChecked ? 'status-ok' : ''}">
                                            ${isChecked ? 'Realizada' : 'Pendente'}
                                        </span>
                                    </label>
                                </div>
                            </div>
                        `;
                    });
                }

                card.innerHTML = `
                    <div class="weekly-day-header">
                        <span>${day.name}</span>
                        <span class="day-total" title="Total das entregas do dia">${formatCurrency(dayTotal)}</span>
                    </div>
                    <div class="weekly-deliveries-list">
                        ${deliveriesHtml}
                    </div>
                `;

                // Add event listeners for checkboxes in this card
                card.querySelectorAll('.weekly-delivery-checkbox').forEach(checkbox => {
                    checkbox.addEventListener('change', (e) => {
                        const pedidoId = e.target.getAttribute('data-pedido');
                        const checked = e.target.checked;
                        this.checkedState[pedidoId] = checked;
                        this.saveCheckedState();

                        const label = e.target.nextElementSibling;
                        if (checked) {
                            label.textContent = 'Realizada';
                            label.classList.add('status-ok');
                            if (window.app && window.app.showNotification) {
                                window.app.showNotification(`Entrega para ${day.name} marcada como Realizada!`, 'success');
                            }
                        } else {
                            label.textContent = 'Pendente';
                            label.classList.remove('status-ok');
                            if (window.app && window.app.showNotification) {
                                window.app.showNotification(`Entrega para ${day.name} marcada como Pendente.`, 'info');
                            }
                        }
                    });
                });

                // Add event listeners for delete button
                card.querySelectorAll('.btn-delete-delivery').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        const pedidoId = btn.getAttribute('data-pedido');
                        
                        if (!confirm(`Deseja realmente remover o pedido ${pedidoId} do planejamento?`)) {
                            return;
                        }
                        
                        try {
                            btn.disabled = true;
                            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
                            
                            await window.SupabaseService.deletePedido(pedidoId);
                            
                            if (window.app && window.app.showNotification) {
                                window.app.showNotification(`Pedido ${pedidoId} removido do planejamento!`, 'success');
                            }
                            
                            // Reload data and update UI
                            if (window.app && window.app.loadData) {
                                await window.app.loadData();
                                // Re-render current plan since the service has updated weeklyPedidos
                                this.renderPlan();
                            }
                        } catch (err) {
                            console.error(err);
                            if (window.app && window.app.showNotification) {
                                window.app.showNotification(err.message || 'Erro ao remover pedido.', 'error');
                            }
                            btn.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
                            btn.disabled = false;
                        }
                    });
                });

                grid.appendChild(card);
            });
        }
    };
})();
