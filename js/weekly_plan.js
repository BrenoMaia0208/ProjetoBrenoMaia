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
            const resetBtn = document.getElementById('weekly-plan-reset-btn');

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

            if (resetBtn) {
                resetBtn.addEventListener('click', async () => {
                    if (confirm('Tem certeza de que deseja resetar todas as datas de reagendamento para os valores originais da planilha?')) {
                        localStorage.removeItem('weekly-rescheduled-dates');
                        if (window.app && window.app.showNotification) {
                            window.app.showNotification('Todas as datas de reagendamento foram resetadas para o original.', 'success');
                        }
                        if (window.app && window.app.loadData) {
                            await window.app.loadData();
                            this.renderPlan();
                        }
                    }
                });
            }

            const exportImgBtn = document.getElementById('weekly-plan-export-img-btn');
            if (exportImgBtn) {
                exportImgBtn.addEventListener('click', async () => {
                    const grid = document.getElementById('weekly-plan-grid');
                    if (!grid) return;

                    try {
                        exportImgBtn.disabled = true;
                        exportImgBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Copiando...';

                        // Run html2canvas with onclone to perform clean layout alterations and animation bypass on the clone
                        const canvas = await html2canvas(grid, {
                            backgroundColor: '#f8fafc', // Clean, clear background
                            scale: 2.5, // Even higher resolution and crispness
                            useCORS: true,
                            logging: false,
                            onclone: (clonedDoc) => {
                                const clonedGrid = clonedDoc.getElementById('weekly-plan-grid');
                                if (clonedGrid) {
                                    // 1. Force the critical structural styles inline on the clone
                                    clonedGrid.style.display = 'flex';
                                    clonedGrid.style.flexDirection = 'row';
                                    clonedGrid.style.flexWrap = 'nowrap';
                                    clonedGrid.style.width = '1750px';
                                    clonedGrid.style.gap = '20px';
                                    clonedGrid.style.padding = '24px';
                                    clonedGrid.style.backgroundColor = '#f8fafc';

                                    // Expand scrollable lists and card containers inline
                                    clonedGrid.querySelectorAll('.weekly-deliveries-list').forEach(list => {
                                        list.style.maxHeight = 'none';
                                        list.style.overflow = 'visible';
                                        list.style.overflowY = 'visible';
                                    });

                                    clonedGrid.querySelectorAll('.weekly-day-card').forEach(card => {
                                        card.style.height = 'auto';
                                        card.style.maxHeight = 'none';
                                        card.style.overflow = 'visible';
                                        card.style.minHeight = '480px';
                                        card.style.flex = '1';
                                    });

                                    // Hide administrative action buttons inline
                                    clonedGrid.querySelectorAll('.weekly-reschedule-actions').forEach(el => {
                                        el.style.display = 'none';
                                    });

                                    // Force full opacity and stop animations inline
                                    clonedGrid.querySelectorAll('*').forEach(el => {
                                        el.style.animation = 'none';
                                        el.style.transition = 'none';
                                        el.style.transform = 'none';
                                        el.style.opacity = '1';
                                    });

                                    // 2. Also inject the stylesheet to handle all class-level overrides (borders, fonts, etc.)
                                    const style = clonedDoc.createElement('style');
                                    style.innerHTML = `
                                        #weekly-plan-grid {
                                            display: flex !important;
                                            flex-direction: row !important;
                                            flex-wrap: nowrap !important;
                                            width: 1750px !important;
                                            gap: 20px !important;
                                            padding: 24px !important;
                                            background-color: #f8fafc !important;
                                        }
                                        .weekly-day-card {
                                            flex: 1 !important;
                                            background: #ffffff !important;
                                            border: 2px solid #cbd5e1 !important;
                                            border-radius: 16px !important;
                                            padding: 20px !important;
                                            height: auto !important;
                                            max-height: none !important;
                                            min-height: 480px !important;
                                            box-shadow: 0 4px 12px rgba(15, 23, 42, 0.04) !important;
                                            display: flex !important;
                                            flex-direction: column !important;
                                            gap: 16px !important;
                                        }
                                        .weekly-day-header {
                                            font-size: 1.15rem !important;
                                            font-weight: 800 !important;
                                            color: #0f172a !important;
                                            padding-bottom: 14px !important;
                                            border-bottom: 2px dashed #cbd5e1 !important;
                                        }
                                        .weekly-day-header .day-total {
                                            font-size: 0.9rem !important;
                                            padding: 6px 12px !important;
                                            background: #e2e8f0 !important;
                                            color: #0f172a !important;
                                            border-radius: 20px !important;
                                            font-weight: 700 !important;
                                        }
                                        .weekly-deliveries-list {
                                            max-height: none !important;
                                            overflow: visible !important;
                                            overflow-y: visible !important;
                                            gap: 14px !important;
                                            display: flex !important;
                                            flex-direction: column !important;
                                        }
                                        .weekly-delivery-item {
                                            border: 1.5px solid #cbd5e1 !important;
                                            border-radius: 12px !important;
                                            padding: 16px !important;
                                            gap: 12px !important;
                                            background: #ffffff !important;
                                            box-shadow: none !important;
                                        }
                                        .delivery-cidade {
                                            font-size: 1rem !important;
                                            font-weight: 800 !important;
                                            color: #0f172a !important;
                                        }
                                        .weekly-delivery-details {
                                            background: #f1f5f9 !important;
                                            padding: 12px !important;
                                            border-radius: 10px !important;
                                            border: 1px solid #e2e8f0 !important;
                                            display: flex !important;
                                            flex-direction: column !important;
                                            gap: 6px !important;
                                        }
                                        .detail-line {
                                            font-size: 0.85rem !important;
                                            color: #475569 !important;
                                        }
                                        .detail-line strong {
                                            color: #0f172a !important;
                                            font-weight: 700 !important;
                                        }
                                        .weekly-delivery-footer {
                                            padding-top: 12px !important;
                                            border-top: 1.5px dashed #cbd5e1 !important;
                                        }
                                        .delivery-value {
                                            font-size: 1rem !important;
                                            color: #0f172a !important;
                                            font-weight: 800 !important;
                                        }
                                        .weekly-delivery-checkbox-container {
                                            cursor: default !important;
                                        }
                                        .weekly-delivery-checkbox-container .status-label {
                                            font-size: 0.8rem !important;
                                            padding: 4px 10px !important;
                                            font-weight: 700 !important;
                                        }
                                        .weekly-delivery-checkbox-container .status-label.status-ok {
                                            color: #047857 !important;
                                            background: rgba(16, 185, 129, 0.12) !important;
                                            border-color: rgba(16, 185, 129, 0.2) !important;
                                        }
                                        .weekly-reschedule-actions {
                                            display: none !important;
                                        }
                                        * {
                                            animation: none !important;
                                            transition: none !important;
                                            transform: none !important;
                                            opacity: 1 !important;
                                        }
                                    `;
                                    clonedGrid.appendChild(style);
                                }
                            }
                        });

                        // 5. Copy to Clipboard
                        canvas.toBlob(async (blob) => {
                            try {
                                await navigator.clipboard.write([
                                    new ClipboardItem({
                                        [blob.type]: blob
                                    })
                                ]);
                                if (window.app && window.app.showNotification) {
                                    window.app.showNotification('Imagem copiada para a área de transferência! Cole no WhatsApp (Ctrl+V).', 'success');
                                }
                            } catch (clipErr) {
                                console.error('Clipboard copy failed, falling back to download:', clipErr);
                                // Fallback to download
                                const image = canvas.toDataURL('image/png');
                                const link = document.createElement('a');
                                const datesBadge = document.getElementById('weekly-plan-dates');
                                const weekStr = datesBadge ? datesBadge.textContent.replace(/\s+/g, '_').replace(/\//g, '-') : 'semana';
                                link.download = `Planejamento_Semanal_${weekStr}.png`;
                                link.href = image;
                                link.click();
                                if (window.app && window.app.showNotification) {
                                    window.app.showNotification('Clipboard bloqueado. Baixando arquivo da imagem...', 'info');
                                }
                            }
                        }, 'image/png');

                    } catch (err) {
                        console.error('Error exporting image:', err);
                        if (window.app && window.app.showNotification) {
                            window.app.showNotification('Erro ao exportar imagem.', 'error');
                        }
                    } finally {
                        exportImgBtn.disabled = false;
                        exportImgBtn.innerHTML = '<i class="fa-solid fa-copy"></i> Copiar Imagem (WhatsApp)';
                    }
                });
            }

            const copyTextBtn = document.getElementById('weekly-plan-copy-txt-btn');
            if (copyTextBtn) {
                copyTextBtn.addEventListener('click', () => {
                    try {
                        const datesBadge = document.getElementById('weekly-plan-dates');
                        const weekTotalEl = document.getElementById('weekly-plan-total-value');
                        const weekRange = datesBadge ? datesBadge.textContent : '';
                        const weekTotal = weekTotalEl ? weekTotalEl.textContent : '';
                        
                        let text = `📅 *PLANEJAMENTO DE ENTREGA SEMANAL (${weekRange})*\n`;
                        text += `💰 *Soma das Entregas na Semana:* ${weekTotal}\n\n`;

                        const weekdays = [
                            { key: 'Segunda', name: 'SEGUNDA-FEIRA' },
                            { key: 'Terça', name: 'TERÇA-FEIRA' },
                            { key: 'Quarta', name: 'QUARTA-FEIRA' },
                            { key: 'Quinta', name: 'QUINTA-FEIRA' },
                            { key: 'Sexta', name: 'SEXTA-FEIRA' }
                        ];

                        const grouped = {
                            'Segunda': [],
                            'Terça': [],
                            'Quarta': [],
                            'Quinta': [],
                            'Sexta': []
                        };

                        this.weeklyPedidos.forEach(p => {
                            const dayName = this.getDayName(p.data_entrega);
                            if (grouped[dayName]) {
                                grouped[dayName].push(p);
                            }
                        });

                        weekdays.forEach(day => {
                            const dayPedidos = grouped[day.key] || [];
                            const dayTotal = dayPedidos.reduce((sum, p) => sum + (p.total_pedido || 0), 0);
                            const dayTotalFormatted = dayTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

                            text += `*${day.name}* (Total: ${dayTotalFormatted})\n`;

                            if (dayPedidos.length === 0) {
                                text += `_Nenhuma entrega planejada_\n`;
                            } else {
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
                                            total_pedido: 0,
                                            pedidos: []
                                        };
                                    }
                                    subGrouped[groupKey].total_pedido += (p.total_pedido || 0);
                                    subGrouped[groupKey].pedidos.push(p.pedido);
                                });

                                Object.values(subGrouped).forEach(g => {
                                    const isChecked = g.pedidos.every(ped => !!this.checkedState[ped]);
                                    const statusIcon = isChecked ? '✅' : '⏳';
                                    const statusText = isChecked ? 'Realizada' : 'Pendente';
                                    const valFormatted = g.total_pedido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                                    text += `${statusIcon} *${g.cidade}* | Prog: ${g.programa} | Grupo: ${g.grupo} | ${valFormatted} (${statusText})\n`;
                                });
                            }
                            text += `\n`;
                        });

                        navigator.clipboard.writeText(text.trim());
                        if (window.app && window.app.showNotification) {
                            window.app.showNotification('Texto formatado copiado! Cole no WhatsApp (Ctrl+V).', 'success');
                        }
                    } catch (err) {
                        console.error('Failed to copy text:', err);
                        if (window.app && window.app.showNotification) {
                            window.app.showNotification('Erro ao copiar texto.', 'error');
                        }
                    }
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
                            <div class="weekly-reschedule-actions" style="display: flex; align-items: center; gap: 6px; position: relative;">
                                <button class="btn-reschedule-trigger" data-pedido="${pedidosString}" style="background: rgba(108, 99, 255, 0.08); color: var(--accent-primary); border: none; cursor: pointer; padding: 4px 8px; font-size: 0.75rem; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px; font-weight: 600; transition: all 0.2s;" title="Alterar Data de Entrega">
                                    <i class="fa-regular fa-calendar-days"></i> Reagendar
                                </button>
                                <input type="date" class="reschedule-date-input-hidden" data-pedido="${pedidosString}" value="${g.data_entrega || ''}" style="position: absolute; opacity: 0; width: 0; height: 0; pointer-events: none; left: 0;">
                                
                                <button class="btn-remove-planning" data-pedido="${pedidosString}" style="background: rgba(239, 68, 68, 0.08); color: var(--accent-danger); border: none; cursor: pointer; padding: 4px 6px; font-size: 0.75rem; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; transition: all 0.2s;" title="Remover do Planejamento Semanal">
                                    <i class="fa-solid fa-trash-can"></i>
                                </button>
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
                    // Reagendar Button Trigger
                    card.querySelectorAll('.btn-reschedule-trigger').forEach(btn => {
                        btn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            const dateInput = btn.nextElementSibling;
                            if (dateInput) {
                                if (typeof dateInput.showPicker === 'function') {
                                    dateInput.showPicker();
                                } else {
                                    dateInput.focus();
                                    dateInput.click();
                                }
                            }
                        });
                    });

                    // Date Input Change Event (Auto-save)
                    card.querySelectorAll('.reschedule-date-input-hidden').forEach(input => {
                        input.addEventListener('change', async (e) => {
                            const pedidoId = input.getAttribute('data-pedido');
                            const newDate = input.value;
                            const finalDate = newDate ? newDate : null;

                            if (!finalDate) return;

                            try {
                                const triggerBtn = input.previousElementSibling;
                                if (triggerBtn) {
                                    triggerBtn.disabled = true;
                                    triggerBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
                                }

                                await window.SupabaseService.updateDeliveryDateByPedido(pedidoId, finalDate);

                                if (window.app && window.app.showNotification) {
                                    window.app.showNotification(`Pedido ${pedidoId} reagendado com sucesso para ${newDate.split('-').reverse().join('/')}!`, 'success');
                                }

                                if (window.app && window.app.loadData) {
                                    await window.app.loadData();
                                    this.renderPlan();
                                }
                            } catch (err) {
                                console.error(err);
                                if (window.app && window.app.showNotification) {
                                    window.app.showNotification(err.message || 'Erro ao reagendar pedido.', 'error');
                                }
                                this.renderPlan();
                            }
                        });
                    });

                    // Remove from Planning Button Trigger
                    card.querySelectorAll('.btn-remove-planning').forEach(btn => {
                        btn.addEventListener('click', async (e) => {
                            e.stopPropagation();
                            const pedidoId = btn.getAttribute('data-pedido');
                            
                            if (confirm(`Deseja remover o pedido ${pedidoId} do planejamento semanal?`)) {
                                try {
                                    btn.disabled = true;
                                    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

                                    await window.SupabaseService.updateDeliveryDateByPedido(pedidoId, null);

                                    if (window.app && window.app.showNotification) {
                                        window.app.showNotification(`Pedido ${pedidoId} removido do planejamento semanal!`, 'success');
                                    }

                                    if (window.app && window.app.loadData) {
                                        await window.app.loadData();
                                        this.renderPlan();
                                    }
                                } catch (err) {
                                    console.error(err);
                                    if (window.app && window.app.showNotification) {
                                        window.app.showNotification(err.message || 'Erro ao remover pedido.', 'error');
                                    }
                                    this.renderPlan();
                                }
                            }
                        });
                    });


                }

                grid.appendChild(card);
            });
        }
    };
})();
