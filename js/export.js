(function() {
    'use strict';

    window.ExportService = {
        init: function() {
            const csvBtn = document.getElementById('export-csv-btn');
            const pdfBtn = document.getElementById('export-pdf-btn');

            if (csvBtn) {
                csvBtn.addEventListener('click', () => {
                    this.exportCSV();
                });
            }

            if (pdfBtn) {
                pdfBtn.addEventListener('click', () => {
                    this.exportPDF();
                });
            }
        },

        exportCSV: function() {
            const data = window.TableService.getCurrentData();
            if (!data || data.length === 0) {
                if (window.app) window.app.showNotification('Nenhum dado para exportar', 'warning');
                return;
            }

            const headers = Object.keys(data[0]).filter(k => k !== 'id' && k !== 'created_at' && k !== 'uploaded_at');
            
            const formatForCsv = (val) => {
                if (val === null || val === undefined) return '';
                if (typeof val === 'number') {
                    return val.toString().replace('.', ',');
                }
                const str = String(val).replace(/"/g, '""');
                return `"${str}"`;
            };

            const csvContent = [
                headers.join(';'),
                ...data.map(row => headers.map(h => formatForCsv(row[h])).join(';'))
            ].join('\n');

            const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            
            const link = document.createElement('a');
            link.setAttribute('href', url);
            
            const date = new Date().toISOString().split('T')[0];
            link.setAttribute('download', `pedidos_export_${date}.csv`);
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        },

        exportPDF: async function() {
            const btn = document.getElementById('export-pdf-btn');
            const originalText = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Gerando...';

            try {
                if (!window.jspdf || !window.html2canvas) {
                    throw new Error('Bibliotecas de PDF não carregadas');
                }

                const { jsPDF } = window.jspdf;
                const pdf = new jsPDF('l', 'mm', 'a4');
                
                pdf.setFont('helvetica', 'bold');
                pdf.setFontSize(16);
                pdf.text('Relatório de Pedidos de Venda', 15, 15);
                
                pdf.setFont('helvetica', 'normal');
                pdf.setFontSize(10);
                const date = new Date().toLocaleDateString('pt-BR');
                pdf.text(`Gerado em: ${date}`, 15, 22);

                const kpis = document.querySelector('.kpi-section');
                if (kpis) {
                    const canvas = await window.html2canvas(kpis, { scale: 1.5 });
                    const imgData = canvas.toDataURL('image/png');
                    
                    const pdfWidth = pdf.internal.pageSize.getWidth() - 30;
                    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
                    
                    pdf.addImage(imgData, 'PNG', 15, 30, pdfWidth, pdfHeight);
                }

                pdf.save(`relatorio_pedidos_${date.replace(/\//g, '-')}.pdf`);
                
                if (window.app) window.app.showNotification('PDF gerado com sucesso!', 'success');
            } catch (error) {
                console.error('Error generating PDF:', error);
                if (window.app) window.app.showNotification('Erro ao gerar PDF', 'error');
            } finally {
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        }
    };
})();
