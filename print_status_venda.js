const fs = require('fs');
try {
    const xlsx = require('./xlsx.js');
    const fd = fs.openSync('./temp_inspect.xlsx', 'r');
    const fileBuffer = fs.readFileSync(fd);
    fs.closeSync(fd);
    
    const workbook = xlsx.read(fileBuffer, { type: 'buffer', cellDates: true });
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

    const getColIdx = (name) => headerRow.findIndex(h => h && String(h).trim().toLowerCase() === name.toLowerCase());
    const statusVendaIdx = getColIdx('Status Venda');
    const statusDaVendaIdx = getColIdx('Status da Venda');
    const statusDeVendaIdx = getColIdx('Status de Venda');

    console.log('Status Venda Column Indices:', { statusVendaIdx, statusDaVendaIdx, statusDeVendaIdx });

    const values = new Set();
    const columnIdx = statusVendaIdx !== -1 ? statusVendaIdx : (statusDaVendaIdx !== -1 ? statusDaVendaIdx : statusDeVendaIdx);

    if (columnIdx !== -1) {
        for (let i = headerIndex + 1; i < jsonRows.length; i++) {
            const row = jsonRows[i];
            if (row && row[columnIdx]) {
                values.add(String(row[columnIdx]).trim());
            }
        }
    }

    console.log('Distinct Excel values for Status Venda:', Array.from(values));
} catch (e) {
    console.error('Error:', e.message);
}
