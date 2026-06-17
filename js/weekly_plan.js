(function() {
    'use strict';

    window.WeeklyPlanService = {
        allPedidos: [],
        weeklyPedidos: [],
        checkedState: {}, // Local state for checked status of deliveries (by order ID)

        init: function() {
            this.setupModal();
            this.loadCheckedState();
            
            // Global click handler to close dropdowns when clicking outside
            document.addEventListener('click', () => {
                document.querySelectorAll('.weekly-action-dropdown').forEach(d => {
                    d.classList.add('hidden');
                });
            });
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

            // Calculate total for the entire week
            const weekTotal = this.weeklyPedidos.reduce((sum, p) => sum + (p.total_pedido || 0), 0);
            const weekTotalEl = document.getElementById('weekly-plan-total-value');
            if (weekTotalEl) {
                weekTotalEl.textContent = weekTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            }

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

                const isAdmin = window.SupabaseService && window.SupabaseService.isAdmin();

                // Group dayPedidos by Cidade, Programa, Grupo
                const subGrouped = {};
                dayPedidos.forEach(p => {
                    const cidade = (p.cidade || 'Não informada').trim();
                    const programa = (p.programa || '-').trim();
                    const grupo = (p.grupo || '-').trim();
                    const groupKey = `${cidade}|${programa}|${grupo}`;

                    if (!subGrouped[groupKey]) {
                        subGrouped[groupKey] = {
                            cidade: cidade,
                            programa: programa,
                            grupo: grupo,
                            data_entrega: p.data_entrega,
                            total_pedido: 0,
                            ids: [],
                            pedidos: []
                        };
                    }
                    subGrouped[groupKey].total_pedido += (p.total_pedido || 0);
                    subGrouped[groupKey].ids.push(p.id);
                    subGrouped[groupKey].pedidos.push(p.pedido);
                });

                const uniqueGroups = Object.values(subGrouped);

                let deliveriesHtml = '';
                if (uniqueGroups.length === 0) {
                    deliveriesHtml = `<div style="text-align: center; padding: 2rem 0; color: #64748b; font-size: 0.85rem; font-style: italic;">Nenhuma entrega</div>`;
                } else {
                    uniqueGroups.forEach(g => {
                        const isChecked = g.pedidos.every(ped => !!this.checkedState[ped]);
                        const idsString = g.ids.join(',');
                        const pedidosString = g.pedidos.join(',');

                        const actionBtnHtml = isAdmin ? `
                            <div class="weekly-action-wrapper" style="position: relative; display: inline-block;">
                                <button class="btn-action-delivery" data-id="${idsString}" data-pedido="${pedidosString}" title="Gerenciar Entrega" style="background: transparent; color: #64748b; border: none; cursor: pointer; padding: 4px; font-size: 0.95rem; display: inline-flex; align-items: center; justify-content: center; border-radius: 4px; transition: background 0.2s;"><i class="fa-solid fa-ellipsis-vertical"></i></button>
                                <div class="weekly-action-dropdown hidden" data-id="${idsString}" data-pedido="${pedidosString}" style="position: absolute; right: 0; top: 100%; background: #ffffff; border: 1px solid rgba(15, 23, 42, 0.1); border-radius: var(--radius-md); box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15); z-index: 100; min-width: 190px; padding: 8px; display: flex; flex-direction: column; gap: 6px;">
                                    <div class="dropdown-main-menu" style="display: flex; flex-direction: column; gap: 4px;">
                                        <div style="font-size: 0.75rem; font-weight: 700; color: #64748b; padding: 4px 8px; border-bottom: 1px solid rgba(15, 23, 42, 0.05); margin-bottom: 4px; text-align: left;">Gerenciar Entrega</div>
                                        <button class="dropdown-item btn-postpone" data-id="${idsString}" data-pedido="${pedidosString}" style="background: transparent; border: none; text-align: left; padding: 6px 8px; font-size: 0.8rem; color: #0f172a; cursor: pointer; border-radius: 4px; display: flex; align-items: center; gap: 8px; width: 100%;"><i class="fa-solid fa-calendar-days" style="color: var(--accent-primary);"></i> Reagendar</button>
                                        <button class="dropdown-item btn-remove" data-id="${idsString}" data-pedido="${pedidosString}" style="background: transparent; border: none; text-align: left; padding: 6px 8px; font-size: 0.8rem; color: #ef4444; cursor: pointer; border-radius: 4px; display: flex; align-items: center; gap: 8px; width: 100%;"><i class="fa-solid fa-calendar-minus"></i> Remover da Semana</button>
                                    </div>
                                    <div class="dropdown-reschedule-section hidden" style="display: flex; flex-direction: column; gap: 6px; padding: 4px;">
                                        <div style="font-size: 0.75rem; font-weight: 700; color: #64748b; text-align: left;">Nova Data:</div>
                                        <input type="date" class="reschedule-date-input" value="${g.data_entrega || ''}" style="width: 100%; font-size: 0.8rem; padding: 6px; border: 1px solid rgba(15, 23, 42, 0.15); border-radius: 4px; background: #ffffff; color: #0f172a;">
                                        <div style="display: flex; gap: 4px; width: 100%;">
                                            <button class="btn-save-reschedule btn-primary" data-id="${idsString}" data-pedido="${pedidosString}" style="flex: 1; font-size: 0.75rem; padding: 6px; border-radius: 4px; cursor: pointer; border: none; background: var(--accent-primary); color: white; font-weight: 600;">Salvar</button>
                                            <button class="btn-cancel-reschedule" style="flex: 1; font-size: 0.75rem; background: #e2e8f0; color: #0f172a; border: none; padding: 6px; border-radius: 4px; cursor: pointer; font-weight: 600;">Voltar</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ` : '';

                        const checkboxHtml = isAdmin ? `
                            <label class="weekly-delivery-checkbox-container">
                                <input type="checkbox" class="weekly-delivery-checkbox" data-pedido="${pedidosString}" ${isChecked ? 'checked' : ''}>
                                <span class="status-label ${isChecked ? 'status-ok' : ''}">
                                    ${isChecked ? 'Realizada' : 'Pendente'}
                                </span>
                            </label>
                        ` : `
                            <div class="weekly-delivery-checkbox-container" style="cursor: default;">
                                <span class="status-label ${isChecked ? 'status-ok' : ''}">
                                    ${isChecked ? 'Realizada' : 'Pendente'}
                                </span>
                            </div>
                        `;

                        deliveriesHtml += `
                            <div class="weekly-delivery-item" data-pedido="${pedidosString}">
                                <div class="weekly-delivery-header-row">
                                    <span class="delivery-cidade" title="${g.cidade}">
                                        <i class="fa-solid fa-location-dot" style="color: var(--accent-primary); margin-right: 6px;"></i>${g.cidade}
                                    </span>
                                    ${actionBtnHtml}
                                </div>
                                <div class="weekly-delivery-details">
                                    <div class="detail-line"><span>Programa:</span> <strong>${g.programa}</strong></div>
                                    <div class="detail-line"><span>Grupo:</span> <strong>${g.grupo}</strong></div>
                                </div>
                                <div class="weekly-delivery-footer">
                                    <span class="delivery-value">${formatCurrency(g.total_pedido)}</span>
                                    ${checkboxHtml}
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

                // Add event listeners only if admin
                if (isAdmin) {
                    card.querySelectorAll('.weekly-delivery-checkbox').forEach(checkbox => {
                        checkbox.addEventListener('change', (e) => {
                            const pedidosString = e.target.getAttribute('data-pedido');
                            const checked = e.target.checked;
                            
                            if (pedidosString) {
                                pedidosString.split(',').forEach(pedidoId => {
                                    this.checkedState[pedidoId.trim()] = checked;
                                });
                                this.saveCheckedState();
                            }

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

                    // Ellipsis Menu Toggle
                    card.querySelectorAll('.btn-action-delivery').forEach(btn => {
                        btn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            document.querySelectorAll('.weekly-action-dropdown').forEach(d => {
                                if (d !== btn.nextElementSibling) d.classList.add('hidden');
                            });
                            const dropdown = btn.nextElementSibling;
                            if (dropdown) {
                                dropdown.classList.toggle('hidden');
                                const mainMenu = dropdown.querySelector('.dropdown-main-menu');
                                const rescheduleSec = dropdown.querySelector('.dropdown-reschedule-section');
                                if (mainMenu && rescheduleSec) {
                                    mainMenu.classList.remove('hidden');
                                    rescheduleSec.classList.add('hidden');
                                }
                            }
                        });
                    });

                    // Postpone button click (switch to date picker view)
                    card.querySelectorAll('.btn-postpone').forEach(btn => {
                        btn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            const dropdown = btn.closest('.weekly-action-dropdown');
                            if (dropdown) {
                                const mainMenu = dropdown.querySelector('.dropdown-main-menu');
                                const rescheduleSec = dropdown.querySelector('.dropdown-reschedule-section');
                                if (mainMenu && rescheduleSec) {
                                    mainMenu.classList.add('hidden');
                                    rescheduleSec.classList.remove('hidden');
                                }
                            }
                        });
                    });

                    // Cancel Reschedule button click
                    card.querySelectorAll('.btn-cancel-reschedule').forEach(btn => {
                        btn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            const dropdown = btn.closest('.weekly-action-dropdown');
                            if (dropdown) {
                                const mainMenu = dropdown.querySelector('.dropdown-main-menu');
                                const rescheduleSec = dropdown.querySelector('.dropdown-reschedule-section');
                                if (mainMenu && rescheduleSec) {
                                    mainMenu.classList.remove('hidden');
                                    rescheduleSec.classList.add('hidden');
                                }
                            }
                        });
                    });

                    // Save Reschedule Click handler
                    card.querySelectorAll('.btn-save-reschedule').forEach(btn => {
                        btn.addEventListener('click', async (e) => {
                            e.stopPropagation();
                            const dbId = btn.getAttribute('data-id');
                            const pedidoId = btn.getAttribute('data-pedido');
                            const dropdown = btn.closest('.weekly-action-dropdown');
                            const dateInput = dropdown ? dropdown.querySelector('.reschedule-date-input') : null;
                            if (!dateInput) return;

                            const newDate = dateInput.value;
                            if (!newDate) {
                                if (window.app && window.app.showNotification) {
                                    window.app.showNotification('Selecione uma data válida.', 'error');
                                }
                                return;
                            }

                            try {
                                btn.disabled = true;
                                btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
                                
                                await window.SupabaseService.updateDeliveryDate(dbId, newDate);
                                
                                if (window.app && window.app.showNotification) {
                                    window.app.showNotification(`Pedido ${pedidoId} reagendado com sucesso para ${newDate.split('-').reverse().join('/')}!`, 'success');
                                }
                                
                                if (dropdown) dropdown.classList.add('hidden');

                                // Reload and update UI
                                if (window.app && window.app.loadData) {
                                    await window.app.loadData();
                                    this.renderPlan();
                                }
                            } catch (err) {
                                console.error(err);
                                if (window.app && window.app.showNotification) {
                                    window.app.showNotification(err.message || 'Erro ao reagendar pedido.', 'error');
                                }
                                btn.innerHTML = 'Salvar';
                                btn.disabled = false;
                            }
                        });
                    });

                    // Remove from Planning (Delete) handler
                    card.querySelectorAll('.btn-remove').forEach(btn => {
                        btn.addEventListener('click', async (e) => {
                            e.stopPropagation();
                            const dbId = btn.getAttribute('data-id');
                            const pedidoId = btn.getAttribute('data-pedido');
                            const dropdown = btn.closest('.weekly-action-dropdown');
                            
                            if (!confirm(`Deseja realmente remover o pedido ${pedidoId} do cronograma desta semana?`)) {
                                return;
                            }
                            
                            try {
                                btn.disabled = true;
                                btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
                                
                                await window.SupabaseService.deletePedido(dbId);
                                
                                if (window.app && window.app.showNotification) {
                                    window.app.showNotification(`Pedido ${pedidoId} removido do planejamento!`, 'success');
                                }

                                if (dropdown) dropdown.classList.add('hidden');

                                // HIDE THE ITEM IMMEDIATELY IN THE DOM (OPTIMISTIC UI UPDATE)
                                const deliveryItem = btn.closest('.weekly-delivery-item');
                                if (deliveryItem) {
                                    deliveryItem.style.transition = 'all 0.3s ease';
                                    deliveryItem.style.opacity = '0';
                                    deliveryItem.style.transform = 'scale(0.8)';
                                    setTimeout(() => {
                                        deliveryItem.remove();
                                        // Recalculate day total
                                        const cardBody = btn.closest('.weekly-day-card');
                                        if (cardBody) {
                                            const remainingItems = cardBody.querySelectorAll('.weekly-delivery-item');
                                            let dayTotal = 0;
                                            remainingItems.forEach(item => {
                                                const valueSpan = item.querySelector('.delivery-value');
                                                if (valueSpan) {
                                                    const valueText = valueSpan.textContent.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
                                                    dayTotal += parseFloat(valueText) || 0;
                                                }
                                            });
                                            const totalEl = cardBody.querySelector('.day-total');
                                            if (totalEl) {
                                                totalEl.textContent = dayTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                                            }
                                            
                                            // Recalculate all day totals to update the week's total
                                            let newWeekTotal = 0;
                                            document.querySelectorAll('.weekly-day-card').forEach(dayCard => {
                                                dayCard.querySelectorAll('.delivery-value').forEach(valSpan => {
                                                    const valueText = valSpan.textContent.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
                                                    newWeekTotal += parseFloat(valueText) || 0;
                                                });
                                            });
                                            const weekTotalEl = document.getElementById('weekly-plan-total-value');
                                            if (weekTotalEl) {
                                                weekTotalEl.textContent = newWeekTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                                            }
                                            
                                            if (remainingItems.length === 0) {
                                                const listContainer = cardBody.querySelector('.weekly-deliveries-list');
                                                if (listContainer) {
                                                    listContainer.innerHTML = `<div style="text-align: center; padding: 2rem 0; color: #64748b; font-size: 0.85rem; font-style: italic;">Nenhuma entrega</div>`;
                                                }
                                            }
                                        }
                                    }, 300);
                                }
                                
                                if (window.app && window.app.loadData) {
                                    await window.app.loadData();
                                }
                            } catch (err) {
                                console.error(err);
                                if (window.app && window.app.showNotification) {
                                    window.app.showNotification(err.message || 'Erro ao remover pedido.', 'error');
                                }
                                btn.innerHTML = 'Remover da Semana';
                                btn.disabled = false;
                            }
                        });
                    });
                }

                grid.appendChild(card);
            });
        }
    };
})();
