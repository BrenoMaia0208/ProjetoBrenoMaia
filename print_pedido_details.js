const fs = require('fs');
try {
    const xlsx = require('./xlsx.js');
    
    const fd = fs.openSync('C:/Users/Brenno/.gemini/antigravity/scratch/ProjetoBrenoMaia-main/05.FOLLOW-UP PEDIDOS DE VENDA - 03.06 (1).xlsx', 'r');
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

    const pedidoIdx = getColIdx('Pedido');
    
    let outStr = '';
    const log = (msg) => { outStr += msg + '\n'; };

    log(`Total rows read from Sheet: ${jsonRows.length}`);
    log(`Header Index: ${headerIndex}`);
    log(`Header Row: ${JSON.stringify(headerRow)}`);

    let found = false;
    for (let i = headerIndex + 1; i < jsonRows.length; i++) {
        const row = jsonRows[i];
        if (!row) continue;
        
        const currentPed = String(row[pedidoIdx] || '').trim();
        if (currentPed === '216906') {
            log('Pedido 216906 columns:');
            headerRow.forEach((h, idx) => {
                if (h) {
                    log(`${h}: ${row[idx]}`);
                }
            });
            found = true;
            break;
        }
    }

    if (!found) {
        log('Pedido 216906 not found. Listing first 10 orders:');
        let loggedCount = 0;
        for (let i = headerIndex + 1; i < jsonRows.length; i++) {
            const row = jsonRows[i];
            if (row && row[pedidoIdx]) {
                log(`Row ${i}: Pedido=${row[pedidoIdx]}`);
                loggedCount++;
                if (loggedCount >= 10) break;
            }
        }
    }

    fs.writeFileSync('C:/Users/Brenno/.gemini/antigravity/scratch/ProjetoBrenoMaia-main/test_order_out.txt', outStr);
    console.log(outStr);
} catch (e) {
    fs.writeFileSync('C:/Users/Brenno/.gemini/antigravity/scratch/ProjetoBrenoMaia-main/test_order_out.txt', 'Error occurred: ' + e.message);
    console.error(e);
}
