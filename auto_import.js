/**
 * SCRIPT DE IMPORTAÇÃO AUTOMÁTICA DE PLANILHAS (ERP -> DASHBOARD VENDAS)
 * 
 * Este script automatiza o processo de login, leitura, preservação de datas (blindagem) 
 * e sincronização da planilha com o banco de dados do seu painel na nuvem (Vercel).
 * 
 * Requisitos:
 * 1. Node.js instalado no servidor/computador (versão 18 ou superior recomendada).
 * 2. Manter este script na mesma pasta raiz do projeto onde está o arquivo "xlsx.js".
 * 
 * Como agendar no Windows:
 * 1. Abra o "Agendador de Tarefas" (Task Scheduler).
 * 2. Crie uma Tarefa Básica para iniciar um programa.
 * 3. Programa: "node"
 * 4. Argumentos: "auto_import.js"
 * 5. Iniciar em (Pasta Raiz): "C:\caminho\para\a\pasta\do\projeto"
 * 6. Configure o gatilho para repetir a cada 30 minutos por tempo indeterminado.
 */

const fs = require('fs');
const path = require('path');
const xlsx = require('./xlsx.js'); // Utiliza a biblioteca já existente na raiz

// ==========================================
// CONFIGURAÇÕES GERAIS (AJUSTE CONFORME NECESSÁRIO)
// ==========================================
const CONFIG = {
    // URL de produção do seu Dashboard na Vercel (sem barra no final)
    API_URL: 'https://projeto-breno-maia.vercel.app', 

    // Credenciais de administrador para autenticação
    ADMIN_EMAIL: 'contato.brenomaia@hotmail.com',
    ADMIN_PASSWORD: 'SUA_SENHA_AQUI', // COLOQUE A SENHA DA SUA CONTA DE ADMIN AQUI

    // Caminho da planilha gerada pelo ERP
    // Configurado com o seu arquivo do Google Drive
    EXCEL_FILE_PATH: 'H:\\Meu Drive\\01.LOGISTICA\\10. SCANNER - EXPEDIÇÃO\\01.PLANILHA DE PREENCHIMENTO - PEDIDO DE VENDAS.xlsx',

    // Nome exato da aba que o ERP gera na planilha (se houver)
    TARGET_SHEET_NAME: 'MAPA DE PEDIDOS'
};

// Mapeamento de colunas (idêntico ao do Dashboard)
const COLUMN_MAP = {
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
    'Status Compra': 'status_compra',
    'St. Compra': 'status_compra',
    'Status Venda': 'status_venda',
    'Status da Venda': 'status_venda',
    'Status de Venda': 'status_venda',
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
};

// Funções de tratamento e parsing de dados
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
            const day = parts[0].padStart(2, '0');
            const month = parts[1].padStart(2, '0');
            const year = parts[2];
            return `${year}-${month}-${day}`;
        }
    }
    if (str.includes('-')) {
        return str.split(' ')[0];
    }
    return null;
};

const normalizePedido = (val) => {
    if (val === null || val === undefined) return '';
    let str = String(val).trim().toLowerCase();
    if (str.endsWith('.0')) {
        str = str.substring(0, str.length - 2);
    }
    return str;
};

async function executeImport() {
    console.log(`[${new Date().toLocaleString()}] 🔄 Iniciando importação automática...`);
    
    // 1. Verificar existência do arquivo Excel
    if (!fs.existsSync(CONFIG.EXCEL_FILE_PATH)) {
        console.error(`❌ Erro: Arquivo Excel não encontrado em: "${CONFIG.EXCEL_FILE_PATH}"`);
        return;
    }

    try {
        // 2. Fazer Login na API para obter Token JWT
        console.log(`🔑 Fazendo login de administrador na nuvem (${CONFIG.API_URL})...`);
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

        // 3. Carregar pedidos atuais do banco para blindagem de datas
        console.log('📥 Baixando pedidos ativos para blindar datas de previsão...');
        const fetchRes = await fetch(`${CONFIG.API_URL}/api/pedidos`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!fetchRes.ok) {
            const err = await fetchRes.json();
            throw new Error(`Erro ao baixar pedidos atuais: ${err.error}`);
        }

        const existingPedidos = await fetchRes.json();
        console.log(`✅ Recebidos ${existingPedidos.length} pedidos atuais.`);

        // Criar o mapa de blindagem de datas
        const preservedDatesMap = {};
        existingPedidos.forEach(p => {
            const normPedido = normalizePedido(p.pedido);
            if (normPedido) {
                preservedDatesMap[normPedido] = p.data_entrega;
            }
        });

        // 4. Ler e processar o arquivo Excel localmente
        console.log('📖 Lendo e processando planilha local...');
        const fileBuffer = fs.readFileSync(CONFIG.EXCEL_FILE_PATH);
        const workbook = xlsx.read(fileBuffer, { type: 'buffer', cellDates: true });
        
        let sheetName = workbook.SheetNames.find(name => name.trim().toUpperCase() === CONFIG.TARGET_SHEET_NAME.toUpperCase());
        if (!sheetName) {
            console.warn(`⚠️ Aba "${CONFIG.TARGET_SHEET_NAME}" não encontrada. Utilizando primeira aba.`);
            sheetName = workbook.SheetNames[0];
        }

        const sheet = workbook.Sheets[sheetName];
        const jsonRows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: null });

        // Identificar linha do cabeçalho
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

        if (headerIndex === -1) headerIndex = 0;

        const rawHeaders = jsonRows[headerIndex].map(h => h ? String(h).trim() : '');
        const validRows = [];

        // Parsing de cada linha da planilha
        for (let i = headerIndex + 1; i < jsonRows.length; i++) {
            const values = jsonRows[i];
            if (!values || values.length === 0) continue;
            
            // Ignorar rodapés
            const firstVal = String(values[0] || '').toLowerCase();
            if (firstVal.includes('total') || firstVal.includes('resumo') || firstVal.includes('follow-up')) {
                continue;
            }

            const row = {};
            rawHeaders.forEach((header, index) => {
                const dbCol = COLUMN_MAP[header];
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
                } else if (dbCol === 'pedido') {
                    row[dbCol] = val !== null && val !== undefined ? normalizePedido(val) : null;
                } else {
                    row[dbCol] = val !== null && val !== undefined ? String(val).trim() : null;
                }
            });
            
            if (row.perc_disponivel !== undefined && row.perc_disponivel < 0) row.perc_disponivel = 0;
            if (row.total_disponivel !== undefined && row.total_disponivel < 0) row.total_disponivel = 0;

            if (row.nome || row.pedido) {
                validRows.push(row);
            }
        }

        console.log(`✅ Lidas ${validRows.length} linhas válidas da planilha.`);

        // 5. Mesclar e restaurar as datas de previsão modificadas no painel
        let matchedCount = 0;
        validRows.forEach(row => {
            const normPedido = normalizePedido(row.pedido);
            if (normPedido && preservedDatesMap.hasOwnProperty(normPedido)) {
                row.data_entrega = preservedDatesMap[normPedido];
                matchedCount++;
            }
        });
        console.log(`🛡️ Blindagem de datas: ${matchedCount} datas de previsão restauradas.`);

        // 6. Limpar dados antigos na nuvem
        console.log('🗑️ Excluindo registros ativos antigos no banco central...');
        const deleteRes = await fetch(`${CONFIG.API_URL}/api/pedidos`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!deleteRes.ok) {
            const err = await deleteRes.json();
            throw new Error(`Erro ao limpar banco: ${err.error}`);
        }
        console.log('🗑️ Limpeza concluída.');

        // 7. Enviar novos registros
        console.log(`📤 Enviando ${validRows.length} linhas para o banco central...`);
        const insertRes = await fetch(`${CONFIG.API_URL}/api/pedidos`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(validRows)
        });

        if (!insertRes.ok) {
            const err = await insertRes.json();
            throw new Error(`Erro ao enviar novos registros: ${err.error}`);
        }

        const insertData = await insertRes.json();
        console.log(`🎉 SUCESSO! Importação concluída com êxito. ${insertData.message || ''}`);
        
    } catch (error) {
        console.error('❌ ERRO CRÍTICO NA IMPORTAÇÃO AUTOMÁTICA:', error.message);
    }
}

// Executa a importação
executeImport();
