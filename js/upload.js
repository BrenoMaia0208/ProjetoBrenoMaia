(function() {
    'use strict';

    window.UploadService = {
        validatedRows: [],

        columnMap: {
            'Nome': 'nome',
            'Pedido': 'pedido',
            'Nº Empenho': 'num_empenho',
            'Cidade': 'cidade',
            'Grupo': 'grupo',
            'Programa': 'programa',
            '%Disp.': 'perc_disponivel',
            'Total Disponível': 'total_disponivel',
            'Total do Pedido': 'total_pedido',
            'Data Entrega': 'data_entrega',
            'Contato': 'contato',
            '%Falteiro': 'perc_falteiro',
            '%Desp.': 'perc_despacho',
            'Data': 'data_pedido',
            'Data Liberação': 'data_liberacao',
            'Data Entrega Anterior': 'data_entrega_anterior',
            'Dt. Últ. Fornecedor': 'dt_ult_fornecedor',
            'Dt. Previsão Fornecedor': 'dt_previsao_fornecedor',
            'Vendedor': 'vendedor',
            'Operador': 'operador',
            'Op. Fiscal': 'op_fiscal',
            'Tipo de Pedido': 'tipo_pedido',
            'Entrega Pedido': 'entrega_pedido',
            'Status da Compra': 'status_compra',
            'Status Venda': 'status_venda',
            'Total Solicitado': 'total_solicitado',
            'Saldo Pedido': 'saldo_pedido',
            'Solic. Compra': 'solic_compra',
            'Comprado': 'comprado',
            'Saldo Solic. Compra': 'saldo_solic_compra',
            'Total em Romaneio': 'total_romaneio',
            'Total Faturado': 'total_faturado',
            'Saldo a Faturar': 'saldo_faturar',
            'Total Despachado': 'total_despachado',
            'Saldo Despacho': 'saldo_despacho'
        },

        init: function() {
            this.setupModal();
            this.setupDropzone();
        },

        setupModal: function() {
            const modal = document.getElementById('upload-modal');
            const openBtn = document.getElementById('upload-btn');
            const closeBtn = document.getElementById('upload-close-btn');

            if (openBtn && modal) {
                openBtn.addEventListener('click', () => {
                    modal.classList.remove('hidden');
                    this.resetModal();
                });
            }

            if (closeBtn && modal) {
                closeBtn.addEventListener('click', () => {
                    modal.classList.add('hidden');
                });
            }
        },

        resetModal: function() {
            document.getElementById('upload-filename').textContent = '';
            document.getElementById('upload-file-input').value = '';
            document.getElementById('upload-submit-btn').disabled = true;
            document.getElementById('upload-progress').classList.add('hidden');
            document.getElementById('upload-progress-fill').style.width = '0%';
            document.getElementById('upload-progress-text').textContent = '0%';
            
            const report = document.getElementById('upload-validation-report');
            if (report) report.classList.add('hidden');
            this.validatedRows = [];
        },

        setupDropzone: function() {
            const dropzone = document.getElementById('upload-dropzone');
            const fileInput = document.getElementById('upload-file-input');
            const submitBtn = document.getElementById('upload-submit-btn');
            const filenameDisplay = document.getElementById('upload-filename');
            
            if (!dropzone || !fileInput) return;

            dropzone.addEventListener('click', () => {
                fileInput.click();
            });

            fileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    this.handleFileSelected(e.target.files[0], filenameDisplay, submitBtn);
                }
            });

            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                dropzone.addEventListener(eventName, preventDefaults, false);
            });

            function preventDefaults(e) {
                e.preventDefault();
                e.stopPropagation();
            }

            ['dragenter', 'dragover'].forEach(eventName => {
                dropzone.addEventListener(eventName, () => {
                    dropzone.classList.add('dragover');
                }, false);
            });

            ['dragleave', 'drop'].forEach(eventName => {
                dropzone.addEventListener(eventName, () => {
                    dropzone.classList.remove('dragover');
                }, false);
            });

            dropzone.addEventListener('drop', (e) => {
                const dt = e.dataTransfer;
                const files = dt.files;
                if (files.length > 0) {
                    fileInput.files = files;
                    this.handleFileSelected(files[0], filenameDisplay, submitBtn);
                }
            }, false);

            if (submitBtn) {
                submitBtn.addEventListener('click', () => {
                    if (this.validatedRows && this.validatedRows.length > 0) {
                        this.uploadValidatedData();
                    }
                });
            }
        },

        handleFileSelected: function(file, displayElement, submitBtn) {
            const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
            if (['.csv', '.xlsx', '.xls'].includes(ext)) {
                displayElement.textContent = file.name;
                submitBtn.disabled = true; // Mantém desabilitado até validar
                
                const report = document.getElementById('upload-validation-report');
                if (report) report.classList.add('hidden');
                
                this.readAndValidateFile(file);
            } else {
                displayElement.textContent = 'Por favor, selecione um arquivo .csv, .xlsx ou .xls';
                submitBtn.disabled = true;
                
                const report = document.getElementById('upload-validation-report');
                if (report) report.classList.add('hidden');
            }
        },

        readAndValidateFile: async function(file) {
            const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
            const report = document.getElementById('upload-validation-report');
            const statusBadge = document.getElementById('validation-status-badge');
            const summaryDiv = document.getElementById('validation-summary');
            const detailsList = document.getElementById('validation-details-list');
            const submitBtn = document.getElementById('upload-submit-btn');

            if (report) {
                report.classList.remove('hidden');
                statusBadge.textContent = 'Validando...';
                statusBadge.className = 'badge';
                statusBadge.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                statusBadge.style.color = 'var(--text-secondary)';
                summaryDiv.innerHTML = 'Processando planilha, por favor aguarde...';
                detailsList.innerHTML = '';
            }

            // Validar admin de imediato!
            try {
                await window.SupabaseService.checkAdminSession();
            } catch (err) {
                if (report) {
                    statusBadge.textContent = 'Acesso Negado';
                    statusBadge.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
                    statusBadge.style.color = 'var(--accent-danger)';
                    summaryDiv.innerHTML = `<span style="color: var(--accent-danger); font-weight: 600;">Falha de Segurança:</span><br>${err.message}`;
                    detailsList.innerHTML = '<div style="color: var(--accent-danger);"><i class="fa-solid fa-triangle-exclamation"></i> Você não possui as permissões necessárias para ler ou importar planilhas.</div>';
                }
                submitBtn.disabled = true;
                this.validatedRows = [];
                return;
            }

            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    let rawRows = [];
                    let foundHeaders = [];

                    if (ext === '.csv') {
                        const text = e.target.result;
                        const parsed = this.parseCSVRaw(text);
                        rawRows = parsed.rows;
                        foundHeaders = parsed.headers;
                    } else {
                        // Excel
                        const data = new Uint8Array(e.target.result);
                        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
                        const sheet = workbook.Sheets[workbook.SheetNames[0]];
                        const jsonRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
                        
                        const parsed = this.parseExcelRaw(jsonRows);
                        rawRows = parsed.rows;
                        foundHeaders = parsed.headers;
                    }

                    const validation = this.validateRows(rawRows, foundHeaders);

                    if (validation.criticalError) {
                        statusBadge.textContent = 'Erro Crítico';
                        statusBadge.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
                        statusBadge.style.color = 'var(--accent-danger)';
                        summaryDiv.innerHTML = `<span style="color: var(--accent-danger); font-weight: 600;">Falha na Importação:</span><br>${validation.criticalError}`;
                        detailsList.innerHTML = '<div style="color: var(--accent-danger);"><i class="fa-solid fa-triangle-exclamation"></i> O arquivo não pôde ser validado e não poderá ser importado.</div>';
                        submitBtn.disabled = true;
                        this.validatedRows = [];
                    } else {
                        this.validatedRows = validation.validRows;
                        
                        const hasErrors = validation.invalidRowsCount > 0;
                        const hasWarnings = validation.warnings.length > 0;

                        if (this.validatedRows.length === 0) {
                            statusBadge.textContent = 'Sem dados';
                            statusBadge.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
                            statusBadge.style.color = 'var(--accent-danger)';
                            summaryDiv.innerHTML = 'Nenhum pedido válido encontrado para importação.';
                            detailsList.innerHTML = '<div style="color: var(--accent-danger);">Todos os registros foram ignorados ou estão vazios.</div>';
                            submitBtn.disabled = true;
                        } else {
                            if (hasErrors || hasWarnings) {
                                statusBadge.textContent = 'Atenção';
                                statusBadge.style.backgroundColor = 'rgba(245, 158, 11, 0.2)';
                                statusBadge.style.color = 'var(--accent-warning)';
                            } else {
                                statusBadge.textContent = 'Válido';
                                statusBadge.style.backgroundColor = 'rgba(16, 185, 129, 0.2)';
                                statusBadge.style.color = 'var(--accent-success)';
                            }

                            summaryDiv.innerHTML = `
                                <strong>Linhas válidas:</strong> ${validation.validRows.length}<br>
                                <strong>Linhas inválidas (ignoradas):</strong> ${validation.invalidRowsCount}<br>
                                <strong>Alertas encontrados:</strong> ${validation.warnings.length}
                            `;

                            if (validation.warnings.length > 0) {
                                detailsList.innerHTML = validation.warnings.map(w => `<div><i class="fa-solid fa-circle-info" style="color: var(--accent-warning); margin-right: 4px;"></i>${w}</div>`).join('');
                            } else {
                                detailsList.innerHTML = '<div style="color: var(--accent-success);"><i class="fa-solid fa-circle-check"></i> Nenhum problema de integridade encontrado nos dados!</div>';
                            }
                            
                            submitBtn.disabled = false;
                        }
                    }
                } catch (err) {
                    console.error(err);
                    statusBadge.textContent = 'Erro';
                    statusBadge.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
                    statusBadge.style.color = 'var(--accent-danger)';
                    summaryDiv.textContent = 'Erro interno ao processar o arquivo.';
                    detailsList.innerHTML = `<div style="color: var(--accent-danger);">${err.message}</div>`;
                    submitBtn.disabled = true;
                    this.validatedRows = [];
                }
            };

            reader.onerror = () => {
                statusBadge.textContent = 'Erro Leitura';
                summaryDiv.textContent = 'Falha ao ler o arquivo físico do disco.';
                submitBtn.disabled = true;
                this.validatedRows = [];
            };

            if (ext === '.csv') {
                reader.readAsText(file, 'UTF-8');
            } else {
                reader.readAsArrayBuffer(file);
            }
        },

        parseExcelRaw: function(jsonRows) {
            let headerIndex = -1;
            for (let i = 0; i < Math.min(15, jsonRows.length); i++) {
                const row = jsonRows[i];
                if (!row) continue;
                const rowStr = row.map(cell => cell ? String(cell).toLowerCase().trim() : '');
                if (rowStr.some(c => c.includes('nome')) && rowStr.some(c => c.includes('pedido')) && rowStr.some(c => c.includes('cidade'))) {
                    headerIndex = i;
                    break;
                }
            }

            if (headerIndex === -1) {
                headerIndex = 0; // fallback
            }

            const rawHeaders = jsonRows[headerIndex].map(h => h ? String(h).trim() : '');
            
            const parseNumber = (val) => {
                if (val === undefined || val === null) return null;
                if (typeof val === 'number') return val;
                val = String(val).trim();
                if (val === '') return null;
                val = val.replace(/R\$\s?/g, '').trim();
                val = val.replace(/\./g, '').replace(',', '.');
                const num = parseFloat(val);
                return isNaN(num) ? null : num;
            };

            const formatDateObj = (val) => {
                if (!val) return null;
                if (val instanceof Date) {
                    const y = val.getFullYear();
                    const m = String(val.getMonth() + 1).padStart(2, '0');
                    const d = String(val.getDate()).padStart(2, '0');
                    return `${y}-${m}-${d}`;
                }
                if (typeof val === 'number') {
                    const date = new Date((val - 25569) * 86400 * 1000);
                    if (!isNaN(date.getTime())) {
                        const y = date.getFullYear();
                        const m = String(date.getMonth() + 1).padStart(2, '0');
                        const d = String(date.getDate()).padStart(2, '0');
                        return `${y}-${m}-${d}`;
                    }
                }
                let str = String(val).trim();
                if (str.includes('/')) {
                    const parts = str.split(' ')[0].split('/');
                    if (parts.length === 3) {
                        const month = parts[0].padStart(2, '0');
                        const day = parts[1].padStart(2, '0');
                        const year = parts[2];
                        return `${year}-${month}-${day}`;
                    }
                }
                if (str.includes('-')) {
                    return str.split(' ')[0];
                }
                return null;
            };

            const rows = [];
            for (let i = headerIndex + 1; i < jsonRows.length; i++) {
                const values = jsonRows[i];
                if (!values || values.length === 0) continue;
                
                // Ignora linhas de rodapé ou resumo do excel
                const firstVal = String(values[0] || '').toLowerCase();
                if (firstVal.includes('total') || firstVal.includes('resumo') || firstVal.includes('follow-up')) {
                    continue;
                }

                const row = {};
                rawHeaders.forEach((header, index) => {
                    const dbCol = this.columnMap[header];
                    if (!dbCol) return;
                    
                    let val = values[index];
                    
                    if (['perc_disponivel', 'total_disponivel', 'total_pedido', 'perc_falteiro', 'perc_despacho', 
                         'total_solicitado', 'saldo_pedido', 'solic_compra', 'comprado', 'saldo_solic_compra', 
                         'total_romaneio', 'total_faturado', 'saldo_faturar', 'total_despachado', 'saldo_despacho']
                         .includes(dbCol)) {
                        row[dbCol] = parseNumber(val);
                    } else if (['data_entrega', 'data_pedido', 'data_liberacao', 'data_entrega_anterior', 
                              'dt_ult_fornecedor', 'dt_previsao_fornecedor'].includes(dbCol)) {
                        row[dbCol] = formatDateObj(val);
                    } else {
                        row[dbCol] = val !== null && val !== undefined ? String(val).trim() : null;
                    }
                });
                
                if (row.nome || row.pedido) {
                    rows.push(row);
                }
            }

            return { rows, headers: rawHeaders };
        },

        parseCSVRaw: function(text) {
            const lines = text.split(/\r\n|\n/).filter(line => line.trim().length > 0);
            if (lines.length < 2) return { rows: [], headers: [] };

            let headerIndex = 0;
            for (let i = 0; i < Math.min(10, lines.length); i++) {
                const lowerLine = lines[i].toLowerCase();
                if (lowerLine.includes('nome') && lowerLine.includes('pedido') && lowerLine.includes('cidade')) {
                    headerIndex = i;
                    break;
                }
            }

            const separator = lines[headerIndex].includes(';') ? ';' : ',';
            const parseLine = (line) => {
                const result = [];
                let cell = '';
                let inQuotes = false;
                for (let i = 0; i < line.length; i++) {
                    const char = line[i];
                    if (char === '"' && line[i+1] === '"') {
                        cell += '"';
                        i++;
                    } else if (char === '"') {
                        inQuotes = !inQuotes;
                    } else if (char === separator && !inQuotes) {
                        result.push(cell);
                        cell = '';
                    } else {
                        cell += char;
                    }
                }
                result.push(cell);
                return result;
            };

            const rawHeaders = parseLine(lines[headerIndex]).map(h => h.trim());
            
            const parseNumber = (val) => {
                if (!val) return null;
                if (typeof val === 'number') return val;
                val = val.trim();
                if (val === '') return null;
                val = val.replace(/R\$\s?/g, '').trim();
                val = val.replace(/\./g, '').replace(',', '.');
                const num = parseFloat(val);
                return isNaN(num) ? null : num;
            };

            const parseDate = (val) => {
                if (!val) return null;
                val = val.trim();
                if (val === '') return null;
                if (val.includes('/')) {
                    const parts = val.split(' ')[0].split('/');
                    if (parts.length === 3) {
                        const month = parts[0].padStart(2, '0');
                        const day = parts[1].padStart(2, '0');
                        const year = parts[2];
                        return `${year}-${month}-${day}`;
                    }
                }
                if (val.includes('-')) {
                    return val.split(' ')[0];
                }
                return null;
            };

            const rows = [];
            for (let i = headerIndex + 1; i < lines.length; i++) {
                const values = parseLine(lines[i]);
                const row = {};
                
                rawHeaders.forEach((header, index) => {
                    const dbCol = this.columnMap[header];
                    if (!dbCol) return;
                    
                    let val = values[index] ? values[index].trim() : null;
                    
                    if (['perc_disponivel', 'total_disponivel', 'total_pedido', 'perc_falteiro', 'perc_despacho', 
                         'total_solicitado', 'saldo_pedido', 'solic_compra', 'comprado', 'saldo_solic_compra', 
                         'total_romaneio', 'total_faturado', 'saldo_faturar', 'total_despachado', 'saldo_despacho']
                         .includes(dbCol)) {
                        row[dbCol] = parseNumber(val);
                    } else if (['data_entrega', 'data_pedido', 'data_liberacao', 'data_entrega_anterior', 
                              'dt_ult_fornecedor', 'dt_previsao_fornecedor'].includes(dbCol)) {
                        row[dbCol] = parseDate(val);
                    } else {
                        row[dbCol] = val;
                    }
                });
                
                if (row.nome || row.pedido) {
                    rows.push(row);
                }
            }

            return { rows, headers: rawHeaders };
        },

        validateRows: function(rows, foundHeaders) {
            const result = {
                validRows: [],
                invalidRowsCount: 0,
                warnings: [],
                criticalError: null
            };

            // 1. Validar cabeçalhos críticos
            const mappedCols = foundHeaders.map(h => this.columnMap[h]).filter(Boolean);
            const requiredDbCols = ['nome', 'pedido', 'cidade'];
            const hasRequired = requiredDbCols.some(col => mappedCols.includes(col));
            
            if (!hasRequired) {
                result.criticalError = 'As colunas obrigatórias não foram encontradas. A planilha deve conter pelo menos as colunas "Nome", "Pedido" ou "Cidade".';
                return result;
            }

            if (rows.length === 0) {
                result.criticalError = 'A planilha não contém nenhum registro de dados válido.';
                return result;
            }

            // 2. Validar cada linha
            rows.forEach((row, index) => {
                const lineNum = index + 2; // +2 porque o excel/csv começa em 1 e tem o cabeçalho
                let isRowValid = true;
                let rowWarnings = [];

                // Validar dados estruturais mínimos
                if (!row.nome && !row.pedido) {
                    result.invalidRowsCount++;
                    isRowValid = false;
                    return; // ignora silenciosamente linha vazia
                }

                // Verificar números
                const numericChecks = [
                    { key: 'total_pedido', label: 'Total do Pedido' },
                    { key: 'total_faturado', label: 'Total Faturado' },
                    { key: 'total_despachado', label: 'Total Despachado' },
                    { key: 'saldo_faturar', label: 'Saldo a Faturar' },
                    { key: 'saldo_despacho', label: 'Saldo Despacho' },
                    { key: 'total_solicitado', label: 'Total Solicitado' }
                ];

                numericChecks.forEach(col => {
                    const val = row[col.key];
                    if (val !== undefined && val !== null) {
                        if (isNaN(val)) {
                            rowWarnings.push(`Campo '${col.label}' possui texto inválido e foi zerado.`);
                            row[col.key] = 0;
                        } else if (val < 0) {
                            rowWarnings.push(`Campo '${col.label}' possui valor negativo (${val}).`);
                        }
                    }
                });

                // Verificar datas
                const dateChecks = [
                    { key: 'data_entrega', label: 'Data Entrega' },
                    { key: 'data_pedido', label: 'Data Pedido' },
                    { key: 'data_liberacao', label: 'Data Liberação' }
                ];

                dateChecks.forEach(col => {
                    const val = row[col.key];
                    if (val) {
                        // verificar se data está no formato YYYY-MM-DD
                        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
                        if (!dateRegex.test(val)) {
                            rowWarnings.push(`Campo '${col.label}' possui formato de data inválido e foi desconsiderado.`);
                            row[col.key] = null;
                        }
                    }
                });

                if (isRowValid) {
                    result.validRows.push(row);
                    if (rowWarnings.length > 0) {
                        const rowDesc = row.nome ? `Cliente: ${row.nome}` : `Pedido: ${row.pedido}`;
                        result.warnings.push(`Linha ${lineNum} (${rowDesc}): ${rowWarnings.join(' | ')}`);
                    }
                }
            });

            // Limita a exibição de alertas a 50 itens para não quebrar a UI
            if (result.warnings.length > 50) {
                const totalAlerts = result.warnings.length;
                result.warnings = result.warnings.slice(0, 50);
                result.warnings.push(`...e mais ${totalAlerts - 50} alertas ocultados para simplificação.`);
            }

            return result;
        },

        uploadValidatedData: async function() {
            const submitBtn = document.getElementById('upload-submit-btn');
            const progressContainer = document.getElementById('upload-progress');
            const progressFill = document.getElementById('upload-progress-fill');
            const progressText = document.getElementById('upload-progress-text');
            
            submitBtn.disabled = true;
            
            try {
                // Dupla checagem de segurança
                await window.SupabaseService.checkAdminSession();
                
                progressContainer.classList.remove('hidden');
                progressText.textContent = 'Limpando banco de dados...';
                progressFill.style.width = '10%';
                
                await window.SupabaseService.deleteAllPedidos();
                
                progressText.textContent = 'Enviando novos registros...';
                progressFill.style.width = '30%';

                const onProgress = (percent) => {
                    const mappedPercent = 30 + (percent * 0.7); // escala de 30% a 100%
                    progressFill.style.width = `${mappedPercent}%`;
                    progressText.textContent = `${Math.round(percent)}% concluído`;
                };

                await window.SupabaseService.insertPedidos(this.validatedRows, onProgress);

                document.getElementById('upload-modal').classList.add('hidden');
                
                if (window.app && window.app.showNotification) {
                    window.app.showNotification('Dados importados e blindados com sucesso!', 'success');
                    window.app.loadData();
                }
            } catch (error) {
                console.error('Error importing validated data:', error);
                progressText.textContent = 'Erro na importação';
                if (window.app && window.app.showNotification) {
                    window.app.showNotification(error.message, 'error');
                }
                submitBtn.disabled = false;
            }
        }
    };
})();
