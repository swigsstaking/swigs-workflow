import PDFDocument from 'pdfkit';

/**
 * Export Service for accounting exports and reports
 */

/**
 * Format currency (CHF)
 */
const formatCurrency = (amount) => {
  return amount.toFixed(2);
};

/**
 * Format date for CSV
 */
const formatDate = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleDateString('fr-CH', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
};

/**
 * Format date for display
 */
const formatDateLong = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('fr-CH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

/**
 * Escape CSV field
 */
const escapeCSV = (field) => {
  if (field === null || field === undefined) return '';
  const str = String(field);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

/**
 * Generate journal CSV for accounting export
 * @param {Array} invoices - Array of paid invoices
 * @param {Object} dateRange - { from, to }
 * @returns {String} CSV string
 */
export const generateJournalCSV = (invoices, dateRange) => {
  const BOM = '\uFEFF'; // UTF-8 BOM for Excel compatibility

  const headers = [
    'Date',
    'N° Pièce',
    'Libellé',
    'Débit',
    'Crédit',
    'Compte',
    'Contrepartie',
    'TVA'
  ];

  const rows = invoices.map(invoice => {
    const clientName = invoice.project?.client?.name || 'Client inconnu';
    const projectName = invoice.project?.name || '';
    const label = `Facture ${invoice.number} - ${clientName}${projectName ? ' - ' + projectName : ''}`;

    return [
      formatDate(invoice.paidAt),
      invoice.number,
      label,
      formatCurrency(invoice.total), // Débit
      '', // Crédit (vide pour les encaissements)
      '1100', // Compte banque (encaissement)
      '3000', // Contrepartie revenus
      formatCurrency(invoice.vatAmount)
    ];
  });

  const csv = [
    headers.map(escapeCSV).join(','),
    ...rows.map(row => row.map(escapeCSV).join(','))
  ].join('\n');

  return BOM + csv;
};

/**
 * Generate client list CSV
 * @param {Array} clients - Array of unique clients from projects
 * @returns {String} CSV string
 */
export const generateClientListCSV = (clients) => {
  const BOM = '\uFEFF'; // UTF-8 BOM for Excel compatibility

  const headers = [
    'Nom',
    'Société',
    'Email',
    'Téléphone',
    'Adresse'
  ];

  const rows = clients.map(client => [
    client.name || '',
    client.company || '',
    client.email || '',
    client.phone || '',
    client.address || ''
  ]);

  const csv = [
    headers.map(escapeCSV).join(','),
    ...rows.map(row => row.map(escapeCSV).join(','))
  ].join('\n');

  return BOM + csv;
};

/**
 * Generate revenue report PDF
 * @param {Array} invoices - Array of invoices in period
 * @param {Object} dateRange - { from, to }
 * @param {Object} settings - User settings
 * @returns {Promise<Buffer>} PDF buffer
 */
export const generateRevenueReportPDF = async (invoices, dateRange, settings) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const chunks = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const company = settings.company || {};

      // Header with logo
      if (company.logo) {
        try {
          doc.image(company.logo, 50, 50, { width: 80 });
        } catch (error) {
          console.error('Error loading logo:', error);
        }
      }

      // Company info
      doc.fontSize(10)
        .text(company.name || 'SWIGS', 400, 50, { align: 'right' })
        .text(company.address || '', 400, 65, { align: 'right' });

      // Title
      doc.fontSize(20)
        .font('Helvetica-Bold')
        .text('Rapport de revenus', 50, 120);

      // Period
      doc.fontSize(12)
        .font('Helvetica')
        .text(
          `Période: ${formatDateLong(dateRange.from)} - ${formatDateLong(dateRange.to)}`,
          50,
          150
        );

      // Table
      const tableTop = 200;
      const col1X = 50;  // N°
      const col2X = 120; // Client
      const col3X = 280; // Date
      const col4X = 360; // HT
      const col5X = 430; // TVA
      const col6X = 500; // Total

      // Table header
      doc.fontSize(10)
        .font('Helvetica-Bold')
        .text('N° Facture', col1X, tableTop)
        .text('Client', col2X, tableTop)
        .text('Date', col3X, tableTop)
        .text('HT', col4X, tableTop)
        .text('TVA', col5X, tableTop)
        .text('Total', col6X, tableTop);

      // Header line
      doc.moveTo(col1X, tableTop + 15)
        .lineTo(550, tableTop + 15)
        .stroke();

      let yPos = tableTop + 25;
      doc.font('Helvetica').fontSize(9);

      // Totals
      let totalHT = 0;
      let totalVAT = 0;
      let totalTTC = 0;

      // Table rows
      for (const invoice of invoices) {
        // Check if we need a new page
        if (yPos > 700) {
          doc.addPage();
          yPos = 50;
        }

        const clientName = invoice.project?.client?.name || 'Client inconnu';
        const truncatedClient = clientName.length > 20
          ? clientName.substring(0, 17) + '...'
          : clientName;

        doc.text(invoice.number, col1X, yPos)
          .text(truncatedClient, col2X, yPos)
          .text(formatDate(invoice.issueDate), col3X, yPos)
          .text(formatCurrency(invoice.subtotal), col4X, yPos)
          .text(formatCurrency(invoice.vatAmount), col5X, yPos)
          .text(formatCurrency(invoice.total), col6X, yPos);

        totalHT += invoice.subtotal;
        totalVAT += invoice.vatAmount;
        totalTTC += invoice.total;

        yPos += 20;
      }

      // Totals section
      yPos += 20;
      doc.moveTo(col1X, yPos)
        .lineTo(550, yPos)
        .stroke();

      yPos += 10;
      doc.fontSize(10)
        .font('Helvetica-Bold')
        .text('TOTAUX', col2X, yPos)
        .text(formatCurrency(totalHT), col4X, yPos)
        .text(formatCurrency(totalVAT), col5X, yPos)
        .text(formatCurrency(totalTTC), col6X, yPos);

      // Summary box
      yPos += 40;
      if (yPos > 650) {
        doc.addPage();
        yPos = 50;
      }

      doc.fontSize(11)
        .font('Helvetica')
        .text('Résumé', 50, yPos);

      yPos += 20;
      doc.fontSize(10)
        .text(`Nombre de factures: ${invoices.length}`, 50, yPos)
        .text(`Total HT: ${formatCurrency(totalHT)} CHF`, 50, yPos + 20)
        .text(`Total TVA: ${formatCurrency(totalVAT)} CHF`, 50, yPos + 40)
        .text(`Total TTC: ${formatCurrency(totalTTC)} CHF`, 50, yPos + 60, {
          underline: true
        });

      // Footer
      doc.fontSize(8)
        .font('Helvetica')
        .text(
          `Généré le ${formatDateLong(new Date())} - ${company.name || 'SWIGS'}`,
          50,
          750,
          { align: 'center', width: 500 }
        );

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};
