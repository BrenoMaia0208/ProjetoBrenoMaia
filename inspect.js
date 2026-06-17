const fs = require('fs');
const xlsx = require('./xlsx.js');

const localExcelPath = './05.FOLLOW-UP PEDIDOS DE VENDA - 03.06 (1).xlsx';
const workbook = xlsx.readFile(localExcelPath);
let sheetName = workbook.SheetNames.find(name => name.trim().toUpperCase() === 'MAPA DE PEDIDOS') || workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const jsonRows = xlsx.utils.sheet_to_json(sheet, { header: 1 });

let headerRow = [];
let headerIndex = -1;
for (let i = 0; i < Math.min(20, jsonRows.length); i++) {
    const row = jsonRows[i];
    if (!row) continue;
    const rowStr = row.map(cell => cell ? String(cell).toLowerCase().trim() : '');
    if (rowStr.some(c => c.includes('nome')) && rowStr.some(c => c.includes('pedido')) && rowStr.some(c => c.includes('cidade'))) {
        headerRow = row;
        headerIndex = i;
        break;
    }
}

console.log('Headers: ' + JSON.stringify(headerRow.filter(Boolean)));

const getColIdx = (name) => headerRow.findIndex(h => h && String(h).trim().toLowerCase() === name.toLowerCase());

const pedidoIdx = getColIdx('Pedido');
const totalPedidoIdx = getColIdx('Total do Pedido');
const saldoPedidoIdx = getColIdx('Saldo Pedido');
const totalDisponivelIdx = getColIdx('Total Disponível');
const totalRomaneioIdx = getColIdx('Total em Romaneio');

console.log(`Indices: Pedido=${pedidoIdx}, TotalPedido=${totalPedidoIdx}, SaldoPedido=${saldoPedidoIdx}, TotalDisponivel=${totalDisponivelIdx}, TotalRomaneio=${totalRomaneioIdx}`);

let count = 0;
for (let i = headerIndex + 1; i < jsonRows.length; i++) {
    const row = jsonRows[i];
    if (!row || !row[pedidoIdx]) continue;
    
    const pedido = row[pedidoIdx];
    const totalPedido = parseFloat(String(row[totalPedidoIdx] || '0').replace(/R\$\s?/g, '').replace(/\./g, '').replace(',', '.')) || 0;
    const saldoPedido = parseFloat(String(row[saldoPedidoIdx] || '0').replace(/R\$\s?/g, '').replace(/\./g, '').replace(',', '.')) || 0;
    const totalDisponivel = parseFloat(String(row[totalDisponivelIdx] || '0').replace(/R\$\s?/g, '').replace(/\./g, '').replace(',', '.')) || 0;
    const totalRomaneio = parseFloat(String(row[totalRomaneioIdx] || '0').replace(/R\$\s?/g, '').replace(/\./g, '').replace(',', '.')) || 0;

    console.log(`Pedido: ${pedido} | TotalPedido: ${totalPedido} | SaldoPedido: ${saldoPedido} | TotalDisponivel: ${totalDisponivel} | TotalRomaneio: ${totalRomaneio}`);
    count++;
    if (count >= 10) break;
}
