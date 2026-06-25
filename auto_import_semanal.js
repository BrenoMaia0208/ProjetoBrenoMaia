/**
 * SCRIPT DE IMPORTAÇÃO AUTOMÁTICA DA PLANILHA DE PLANEJAMENTO SEMANAL
 * (Planejamento Semanal -> Dashboard Vendas)
 */

const fs = require('fs');
const path = require('path');
const xlsx = require('./xlsx.js');

const CONFIG = {
    API_URL: 'https://projeto-pedidos-de-venda-provix.vercel.app', 
    ADMIN_EMAIL: 'contato.brenomaia@hotmail.com',
    ADMIN_PASSWORD: 'Doocjp@0172',
    EXCEL_BASE_PATH: 'H:\\Meu Drive\\01.LOGISTICA\\03.PLANEJAMENTO DE ENTREGA - SEMANAL'
};

const parseNumber = (val) => {
    if (val === undefined || val === null) return 0;
    if (typeof val === 'number') return val;
    val = String(val).trim();
    if (val === '') return 0;
    val = val.replace(/R\$\s?/g, '').trim();
    val = val.replace(/\./g, '').replace(',', '.');
    const num = parseFloat(val);
    return isNaN(num) ? 0 : num;
};

// Resolução dinâmica do arquivo do mês atual
const resolveExcelPath = () => {
    const basePath = CONFIG.EXCEL_BASE_PATH;
    const now = new Date();
    const year = now.getFullYear();
    const monthNum = String(now.getMonth() + 1).padStart(2, '0');
    
    const monthAbbrs = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
    const monthName = monthAbbrs[now.getMonth()];
    const monthFolder = `${monthNum}.${monthName}`;
    const fileName = `${monthFolder}_ENTREGAS_SEMANA.xlsx`;
    
    const targetPath = path.join(basePath, String(year), monthFolder, fileName);
    if (fs.existsSync(targetPath)) {
        return targetPath;
    }
    
    console.log(`⚠️ Planilha de planejamento deste mês não encontrada em: "${targetPath}". Procurando mais recente...`);
    
    try {
        const yearPath = path.join(basePath, String(year));
        if (!fs.existsSync(yearPath)) return null;
        
        const months = fs.readdirSync(yearPath)
            .filter(m => fs.statSync(path.join(yearPath, m)).isDirectory() && /^\d{2}\.[A-Z]{3}$/.test(m))
            .sort((a, b) => b.localeCompare(a));
            
        for (const mFolder of months) {
            const mPath = path.join(yearPath, mFolder);
            const files = fs.readdirSync(mPath)
                .filter(f => f.endsWith('_ENTREGAS_SEMANA.xlsx'));
            if (files.length > 0) {
                return path.join(mPath, files[0]);
            }
        }
    } catch (err) {
        console.error('Erro ao buscar planilha mais recente:', err.message);
    }
    
    return null;
};

// Retorna os limites de data da semana atual (segunda e sexta)
const getWeekRange = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const monday = new Date(today);
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    monday.setDate(today.getDate() + diffToMonday);
    monday.setHours(0, 0, 0, 0);

    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);
    friday.setHours(23, 59, 59, 999);
    
    return { monday, friday };
};

// Converte data de dd/mm/aaaa para aaaa-mm-dd
const parseDateString = (str) => {
    if (!str) return null;
    const match = str.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (match) {
        return `${match[3]}-${match[2]}-${match[1]}`;
    }
    return null;
};

async function executeImport() {
    console.log(`[${new Date().toLocaleString()}] 🔄 Iniciando importação do Planejamento Semanal...`);
    
    const excelPath = resolveExcelPath();
    if (!excelPath) {
        console.error(`❌ Erro: Nenhuma planilha de planejamento semanal encontrada.`);
        return;
    }
    console.log(`📌 Planilha de planejamento selecionada: "${excelPath}"`);

    try {
        // 1. Fazer Login na API
        console.log(`🔑 Fazendo login na nuvem...`);
        const loginRes = await fetch(`${CONFIG.API_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: CONFIG.ADMIN_EMAIL, password: CONFIG.ADMIN_PASSWORD })
        });

        if (!loginRes.ok) {
            const err = await loginRes.json();
            throw new Error(`Falha no login: ${err.error || 'Credenciais inválidas'}`);
        }

        const authData = await loginRes.json();
        const token = authData.session.access_token;
        console.log('✅ Autenticado com sucesso.');

        // 2. Ler o arquivo Excel
        const fileBuffer = fs.readFileSync(excelPath);
        const workbook = xlsx.read(fileBuffer, { type: 'buffer' });

        // Identificar qual aba corresponde à semana atual
        const { monday, friday } = getWeekRange();
        console.log(`📅 Semana de Planejamento Atual: ${monday.toLocaleDateString('pt-BR')} a ${friday.toLocaleDateString('pt-BR')}`);
        
        let targetSheetName = null;
        let parsedRows = [];

        for (const sheetName of workbook.SheetNames) {
            if (!sheetName.startsWith('SEM')) continue;
            
            const sheet = workbook.Sheets[sheetName];
            const jsonRows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });
            if (jsonRows.length < 5) continue;

            // Inspecionar as datas da linha 4 (index 4)
            const dateRow = jsonRows[4];
            let sheetMatchesCurrentWeek = false;

            const colOffsets = [0, 6, 12, 18, 24];
            for (const colIdx of colOffsets) {
                const dateStr = parseDateString(dateRow[colIdx]);
                if (dateStr) {
                    const parsedDate = new Date(dateStr + 'T12:00:00');
                    if (parsedDate >= monday && parsedDate <= friday) {
                        sheetMatchesCurrentWeek = true;
                        break;
                    }
                }
            }

            if (sheetMatchesCurrentWeek) {
                targetSheetName = sheetName;
                console.log(`🎯 Aba identificada para a semana atual: "${sheetName}"`);
                
                // Processar as colunas dessa aba
                for (const colIdx of colOffsets) {
                    const headerCell = dateRow[colIdx];
                    const dateStr = parseDateString(headerCell);
                    if (!dateStr) continue;

                    // Iterar linhas a partir do índice 6
                    for (let r = 6; r < jsonRows.length; r++) {
                        const rowCells = jsonRows[r];
                        if (!rowCells || rowCells.length <= colIdx) continue;

                        const municipio = String(rowCells[colIdx] || '').trim();
                        if (!municipio || municipio === '' || municipio.toLowerCase().includes('total')) {
                            continue;
                        }

                        const programa = String(rowCells[colIdx + 1] || '').trim();
                        const grupo = String(rowCells[colIdx + 2] || '').trim();
                        const valor = parseNumber(rowCells[colIdx + 3]);
                        
                        let situacao = String(rowCells[colIdx + 4] || '').trim().toUpperCase();
                        let statusVenda = 'EM ANDAMENTO';
                        if (situacao === 'TRUE' || situacao === 'REALIZADA' || situacao === 'OK') {
                            statusVenda = 'ENTREGUE';
                        } else if (situacao === 'REMANEJADO') {
                            statusVenda = 'REMANEJADO';
                        }

                        const virtualId = `SEM-${dateStr}-${colIdx}-${r}`;

                        parsedRows.push({
                            nome: municipio,
                            pedido: virtualId,
                            cidade: municipio,
                            grupo: grupo || 'OUTROS',
                            programa: programa || 'OUTROS',
                            total_disponivel: valor,
                            total_pedido: valor,
                            data_entrega: dateStr,
                            status_venda: statusVenda,
                            tipo_pedido: 'PLANEJAMENTO_SEMANAL',
                            perc_disponivel: 1,
                            perc_falteiro: 0,
                            perc_despacho: statusVenda === 'ENTREGUE' ? 1 : 0
                        });
                    }
                }
                break; // Encontrou a semana atual, pode encerrar a busca
            }
        }

        if (parsedRows.length === 0) {
            console.log('⚠️ Nenhuma entrega planejada encontrada para a semana corrente.');
            return;
        }

        console.log(`✅ Lidas ${parsedRows.length} linhas de planejamento da planilha.`);

        // 3. Limpar planejamento anterior no banco central
        console.log('🗑️ Removendo planejamento semanal antigo do banco central...');
        const deleteRes = await fetch(`${CONFIG.API_URL}/api/pedidos?tipo_pedido=PLANEJAMENTO_SEMANAL`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!deleteRes.ok) {
            const err = await deleteRes.json();
            throw new Error(`Erro ao limpar banco: ${err.error}`);
        }
        console.log('🗑️ Limpeza concluída.');

        // 4. Enviar novos registros
        console.log(`📤 Enviando ${parsedRows.length} linhas de planejamento para a nuvem...`);
        const insertRes = await fetch(`${CONFIG.API_URL}/api/pedidos`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(parsedRows)
        });

        if (!insertRes.ok) {
            const err = await insertRes.json();
            throw new Error(`Erro ao enviar novos registros: ${err.error}`);
        }

        console.log(`🎉 SUCESSO! Importação do Planejamento Semanal concluída com êxito.`);

    } catch (error) {
        console.error('❌ ERRO CRÍTICO NA IMPORTAÇÃO SEMANAL:', error.message);
    }
}

executeImport();
