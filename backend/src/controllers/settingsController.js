import Settings from '../models/Settings.js';
import History from '../models/History.js';
import { encrypt, decrypt } from '../utils/crypto.js';
/**
 * Simple SSRF check: reject private/loopback URLs
 */
async function isUrlAllowed(url) {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname;
    // Block obvious private ranges
    if (['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(hostname)) return false;
    if (hostname.startsWith('10.') || hostname.startsWith('192.168.') || hostname.match(/^172\.(1[6-9]|2\d|3[01])\./)) return false;
    return true;
  } catch {
    return false;
  }
}

function isValidIBAN(iban) {
  if (!iban) return true; // Optional field
  const cleaned = iban.replace(/\s/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{5,30}$/.test(cleaned)) return false;
  const rearranged = cleaned.slice(4) + cleaned.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, c => String(c.charCodeAt(0) - 55));
  let remainder = '';
  for (const digit of numeric) {
    remainder = String(Number(remainder + digit) % 97);
  }
  return Number(remainder) === 1;
}

// @desc    Get settings
// @route   GET /api/settings
export const getSettings = async (req, res, next) => {
  try {
    const userId = req.user?._id || null;
    const settings = await Settings.getSettings(userId);
    const settingsObj = settings.toObject ? settings.toObject() : { ...settings };

    // Strip secrets from response, add boolean indicators instead
    if (settingsObj.smtp) {
      settingsObj.smtp._hasPass = !!settingsObj.smtp.pass;
      delete settingsObj.smtp.pass;
    }
    if (settingsObj.abaninja) {
      settingsObj.abaninja._hasApiKey = !!settingsObj.abaninja.apiKey;
      delete settingsObj.abaninja.apiKey;
    }
    if (settingsObj.cmsIntegration) {
      settingsObj.cmsIntegration._hasServiceToken = !!settingsObj.cmsIntegration.serviceToken;
      delete settingsObj.cmsIntegration.serviceToken;
    }
    if (settingsObj.bankImap) {
      settingsObj.bankImap._hasPass = !!settingsObj.bankImap.pass;
      delete settingsObj.bankImap.pass;
    }
    // Strip heavy letterhead base64 — send boolean indicator instead
    if (settingsObj.invoiceDesign) {
      settingsObj.invoiceDesign._hasLetterhead = !!settingsObj.invoiceDesign.letterheadPdf;
      delete settingsObj.invoiceDesign.letterheadPdf;
    }

    res.json({ success: true, data: settingsObj });
  } catch (error) {
    next(error);
  }
};

// @desc    Update settings
// @route   PUT /api/settings
export const updateSettings = async (req, res, next) => {
  try {
    const { company, invoicing, personalization, emailTemplates, smtp, abaninja, reminders, cms, cmsIntegration, bankImap, invoiceDesign } = req.body;

    const userId = req.user?._id || null;
    const query = userId ? { userId } : { userId: { $exists: false } };

    let settings = await Settings.findOne(query);

    if (!settings) {
      settings = new Settings({ userId });
    }

    if (company) {
      if (company.iban !== undefined && !isValidIBAN(company.iban)) {
        return res.status(400).json({ success: false, error: 'IBAN invalide' });
      }
      // Validate IDE format (CHE-XXX.XXX.XXX [MWST|TVA|IVA])
      if (company.siret && company.siret.trim() !== '') {
        const ideRegex = /^CHE-?\d{3}\.?\d{3}\.?\d{3}(\s*(MWST|TVA|IVA))?$/i;
        if (!ideRegex.test(company.siret.trim())) {
          return res.status(400).json({ success: false, error: 'Format IDE invalide. Attendu : CHE-XXX.XXX.XXX (MWST|TVA|IVA)' });
        }
      }
      settings.company = { ...settings.company.toObject(), ...company };
    }

    if (invoicing) {
      settings.invoicing = { ...settings.invoicing.toObject(), ...invoicing };
    }

    if (personalization) {
      settings.personalization = { ...settings.personalization.toObject(), ...personalization };
    }

    if (emailTemplates) {
      settings.emailTemplates = { ...settings.emailTemplates.toObject(), ...emailTemplates };
    }

    if (smtp) {
      const smtpData = { ...(settings.smtp?.toObject ? settings.smtp.toObject() : {}), ...smtp };
      // Only encrypt if a NEW password was provided in the request body
      if (smtp.pass && smtp.pass !== '') {
        smtpData.pass = encrypt(smtp.pass);
      } else {
        smtpData.pass = settings.smtp?.pass || '';
      }
      settings.smtp = smtpData;
    }

    if (abaninja) {
      const abData = { ...(settings.abaninja?.toObject ? settings.abaninja.toObject() : {}), ...abaninja };
      // Only encrypt if a NEW apiKey was provided in the request body
      if (abaninja.apiKey && abaninja.apiKey !== '') {
        abData.apiKey = encrypt(abaninja.apiKey);
      } else {
        abData.apiKey = settings.abaninja?.apiKey || '';
      }
      settings.abaninja = abData;
    }

    if (reminders) {
      settings.reminders = { ...(settings.reminders?.toObject ? settings.reminders.toObject() : {}), ...reminders };
    }

    // Support both `cms` and `cmsIntegration` keys from frontend
    const cmsPayload = cmsIntegration || cms;
    if (cmsPayload) {
      // Validate apiUrl against SSRF blocklist before saving
      if (cmsPayload.apiUrl && !(await isUrlAllowed(cmsPayload.apiUrl))) {
        return res.status(400).json({ success: false, error: 'URL CMS invalide ou non autorisée' });
      }

      const cmsData = { ...(settings.cmsIntegration?.toObject ? settings.cmsIntegration.toObject() : {}), ...cmsPayload };
      // Only encrypt if a NEW serviceToken was provided in the request body
      if (cmsPayload.serviceToken && cmsPayload.serviceToken !== '') {
        cmsData.serviceToken = encrypt(cmsPayload.serviceToken);
      } else {
        cmsData.serviceToken = settings.cmsIntegration?.serviceToken || '';
      }
      settings.cmsIntegration = cmsData;
    }

    if (invoiceDesign) {
      settings.invoiceDesign = { ...(settings.invoiceDesign?.toObject ? settings.invoiceDesign.toObject() : {}), ...invoiceDesign };
    }

    if (bankImap) {
      const imapData = { ...(settings.bankImap?.toObject ? settings.bankImap.toObject() : {}), ...bankImap };
      // Only encrypt if a NEW password was provided in the request body
      if (bankImap.pass && bankImap.pass !== '') {
        imapData.pass = encrypt(bankImap.pass);
      } else {
        imapData.pass = settings.bankImap?.pass || '';
      }
      settings.bankImap = imapData;
    }

    await settings.save();

    // Strip secrets from response, add boolean indicators instead
    const settingsObj = settings.toObject ? settings.toObject() : { ...settings };
    if (settingsObj.smtp) {
      settingsObj.smtp._hasPass = !!settingsObj.smtp.pass;
      delete settingsObj.smtp.pass;
    }
    if (settingsObj.abaninja) {
      settingsObj.abaninja._hasApiKey = !!settingsObj.abaninja.apiKey;
      delete settingsObj.abaninja.apiKey;
    }
    if (settingsObj.cmsIntegration) {
      settingsObj.cmsIntegration._hasServiceToken = !!settingsObj.cmsIntegration.serviceToken;
      delete settingsObj.cmsIntegration.serviceToken;
    }
    if (settingsObj.bankImap) {
      settingsObj.bankImap._hasPass = !!settingsObj.bankImap.pass;
      delete settingsObj.bankImap.pass;
    }
    if (settingsObj.invoiceDesign) {
      settingsObj.invoiceDesign._hasLetterhead = !!settingsObj.invoiceDesign.letterheadPdf;
      delete settingsObj.invoiceDesign.letterheadPdf;
    }

    res.json({ success: true, data: settingsObj });
  } catch (error) {
    next(error);
  }
};

// @desc    Upload company logo
// @route   POST /api/settings/logo
export const uploadLogo = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Aucun fichier fourni' });
    }

    const base64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;

    const userId = req.user?._id || null;
    const settings = await Settings.getSettings(userId);
    settings.company.logo = base64;
    await settings.save();

    res.json({ success: true, data: { logo: base64 } });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete company logo
// @route   DELETE /api/settings/logo
export const deleteLogo = async (req, res, next) => {
  try {
    const userId = req.user?._id || null;
    const settings = await Settings.getSettings(userId);
    settings.company.logo = null;
    await settings.save();

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

// @desc    Upload letterhead PDF (papier à lettres)
// @route   POST /api/settings/letterhead
export const uploadLetterhead = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Aucun fichier fourni' });
    }

    // Validate it's a real PDF (check magic bytes)
    const header = req.file.buffer.slice(0, 5).toString('ascii');
    if (header !== '%PDF-') {
      return res.status(400).json({ success: false, error: 'Le fichier n\'est pas un PDF valide' });
    }

    const base64 = req.file.buffer.toString('base64');

    const userId = req.user?._id || null;
    const settings = await Settings.getSettings(userId);
    settings.invoiceDesign = {
      ...(settings.invoiceDesign?.toObject ? settings.invoiceDesign.toObject() : {}),
      letterheadPdf: base64,
      useLetterhead: true
    };
    await settings.save();

    res.json({ success: true, data: { useLetterhead: true, hasLetterhead: true } });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete letterhead PDF
// @route   DELETE /api/settings/letterhead
export const deleteLetterhead = async (req, res, next) => {
  try {
    const userId = req.user?._id || null;
    const settings = await Settings.getSettings(userId);
    settings.invoiceDesign = {
      ...(settings.invoiceDesign?.toObject ? settings.invoiceDesign.toObject() : {}),
      letterheadPdf: null,
      useLetterhead: false
    };
    await settings.save();

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

// @desc    Generate invoice preview PDF with fake data
// @route   GET /api/settings/invoice-preview
export const getInvoicePreview = async (req, res, next) => {
  try {
    const userId = req.user?._id || null;
    const settings = await Settings.getSettings(userId);

    // Use dynamic import to avoid circular deps
    const { generateInvoicePDF } = await import('../services/pdf.service.js');

    // Fake data for preview
    const fakeInvoice = {
      number: 'FAC-2026-001',
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: 'sent',
      subtotal: 3750,
      vatRate: settings.invoicing?.defaultVatRate || 8.1,
      vatAmount: 303.75,
      total: 4053.75,
      notes: settings.invoiceDesign?.notesTemplate || 'Merci pour votre confiance.',
      events: [
        { type: 'hours', description: 'Développement frontend', hours: 20, hourlyRate: 150, amount: 3000 },
        { type: 'expense', description: 'Licence logiciel annuelle', amount: 250 }
      ],
      quotes: [],
      customLines: [
        { description: 'Hébergement serveur (mensuel)', quantity: 1, unitPrice: 500, total: 500 }
      ]
    };

    const fakeProject = {
      name: 'Projet exemple',
      client: {
        name: 'Entreprise Exemple SA',
        email: 'contact@exemple.ch',
        phone: '+41 22 123 45 67',
        address: 'Rue de la Poste 1, 1200 Genève'
      }
    };

    const pdfBuffer = await generateInvoicePDF(fakeInvoice, fakeProject, settings);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="preview.pdf"',
      'Content-Length': pdfBuffer.length
    });
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
};

// @desc    Send test invoice email with current design settings
// @route   POST /api/settings/test-email
export const sendTestEmail = async (req, res, next) => {
  try {
    const { to } = req.body;

    if (!to) {
      return res.status(400).json({ success: false, error: 'Adresse email requise (champ "to")' });
    }

    const userId = req.user?._id || null;
    const settings = await Settings.getSettings(userId);

    // Validate SMTP config
    if (!settings.smtp || !settings.smtp.host || !settings.smtp.user || !settings.smtp.pass) {
      return res.status(400).json({
        success: false,
        error: 'Configuration SMTP manquante. Configurez votre serveur SMTP dans les paramètres.'
      });
    }

    const { generateInvoicePDF } = await import('../services/pdf.service.js');
    const { createTransporter } = await import('../services/email.service.js');

    // Fake invoice for testing
    const fakeInvoice = {
      number: 'FAC-2026-TEST',
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: 'sent',
      subtotal: 4250,
      vatRate: settings.invoicing?.defaultVatRate || 8.1,
      vatAmount: 344.25,
      total: 4594.25,
      notes: settings.invoiceDesign?.notesTemplate || 'Ceci est une facture test pour vérifier le design et l\'envoi.',
      events: [
        { type: 'hours', description: 'Développement frontend React', hours: 16, hourlyRate: 150, amount: 2400 },
        { type: 'hours', description: 'Intégration API backend', hours: 8, hourlyRate: 150, amount: 1200 },
        { type: 'expense', description: 'Licence Adobe Creative Suite', amount: 150 }
      ],
      quotes: [],
      customLines: [
        { description: 'Hébergement serveur (mensuel)', quantity: 1, unitPrice: 500, total: 500 }
      ]
    };

    const fakeProject = {
      name: 'Projet Test SWIGS',
      client: {
        name: 'Test Client SA',
        email: to,
        phone: '+41 79 123 45 67',
        address: 'Avenue de la Gare 10, 1003 Lausanne'
      }
    };

    // Generate PDF
    const pdfBuffer = await generateInvoicePDF(fakeInvoice, fakeProject, settings);

    // Send email
    const transporter = createTransporter(settings.smtp);
    const company = settings.company || {};

    await transporter.sendMail({
      from: `"${company.name || 'SWIGS'}" <${settings.smtp.user}>`,
      to,
      subject: `[TEST] Facture FAC-2026-TEST — ${company.name || 'SWIGS'}`,
      text: `Bonjour,\n\nCeci est un email test pour vérifier le design des factures et le bon fonctionnement de l'envoi.\n\nVeuillez trouver ci-joint une facture test (FAC-2026-TEST) d'un montant de 4'594.25 CHF.\n\nCordialement,\n${company.name || 'SWIGS'}\n\n`,
      attachments: [
        {
          filename: 'Facture-FAC-2026-TEST.pdf',
          content: pdfBuffer,
          contentType: 'application/pdf',
          contentDisposition: 'attachment'
        }
      ]
    });

    res.json({
      success: true,
      message: `Email test envoyé à ${to} avec la facture PDF en pièce jointe`
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Send test reminder email (with RAPPEL PDF attached)
// @route   POST /api/settings/test-reminder
export const sendTestReminder = async (req, res, next) => {
  try {
    const { to } = req.body;

    if (!to) {
      return res.status(400).json({ success: false, error: 'Adresse email requise (champ "to")' });
    }

    const userId = req.user?._id || null;
    const settings = await Settings.getSettings(userId);

    // Validate SMTP config
    if (!settings.smtp || !settings.smtp.host || !settings.smtp.user || !settings.smtp.pass) {
      return res.status(400).json({
        success: false,
        error: 'Configuration SMTP manquante.'
      });
    }

    const { createTransporter, textToHtml } = await import('../services/email.service.js');
    const { generateReminderPDF } = await import('../services/pdf.service.js');
    const company = settings.company || {};

    // Build fake variables for the first reminder template
    const schedule = settings.reminders?.schedule || [];
    const firstReminder = schedule[0] || {
      subject: 'Rappel : Facture {number} échue',
      body: 'Bonjour {clientName},\n\nNous vous rappelons que la facture {number} d\'un montant de {total} est échue depuis le {dueDate}.\n\nMerci de procéder au règlement dans un délai de 15 jours.\n\nCordialement,\n{companyName}'
    };

    const fmtCurrency = (n) => new Intl.NumberFormat('fr-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + ' CHF';

    const variables = {
      clientName: 'Test Client SA',
      number: 'FAC-2026-TEST',
      total: fmtCurrency(4594.25),
      dueDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toLocaleDateString('fr-CH'),
      daysOverdue: '10',
      companyName: company.name || 'SWIGS'
    };

    let subject = firstReminder.subject || '';
    let body = firstReminder.body || '';
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      subject = subject.replace(regex, value);
      body = body.replace(regex, value);
    }
    // Fix double currency suffix ("{total} CHF" where {total} already includes "CHF")
    subject = subject.replace(/CHF\s+CHF/g, 'CHF');
    body = body.replace(/CHF\s+CHF/g, 'CHF');

    subject = `[TEST] ${subject}`;

    // Generate fake overdue invoice for REMINDER PDF
    const fakeInvoice = {
      number: 'FAC-2026-TEST',
      issueDate: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
      dueDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      status: 'sent',
      subtotal: 4250,
      vatRate: settings.invoicing?.defaultVatRate || 8.1,
      vatAmount: 344.25,
      total: 4594.25,
      notes: '',
      events: [
        { type: 'hours', description: 'Développement frontend React', hours: 16, hourlyRate: 150, amount: 2400 },
        { type: 'hours', description: 'Intégration API backend', hours: 8, hourlyRate: 150, amount: 1200 },
        { type: 'expense', description: 'Licence Adobe Creative Suite', amount: 150 }
      ],
      quotes: [],
      customLines: [
        { description: 'Hébergement serveur (mensuel)', quantity: 1, unitPrice: 500, total: 500 }
      ]
    };

    const fakeProject = {
      name: 'Projet Test SWIGS',
      client: {
        name: 'Test Client SA',
        email: to,
        phone: '+41 79 123 45 67',
        address: 'Avenue de la Gare 10, 1003 Lausanne'
      }
    };

    const pdfBuffer = await generateReminderPDF(fakeInvoice, fakeProject, settings, {
      tier: 'reminder_1',
      daysOverdue: 10
    });

    const transporter = createTransporter(settings.smtp);

    await transporter.sendMail({
      from: `"${company.name || 'SWIGS'}" <${settings.smtp.user}>`,
      to,
      subject,
      text: body,
      html: textToHtml(body),
      attachments: [
        {
          filename: 'Rappel-FAC-2026-TEST.pdf',
          content: pdfBuffer,
          contentType: 'application/pdf',
          contentDisposition: 'attachment'
        }
      ]
    });

    res.json({
      success: true,
      message: `Rappel test envoyé à ${to} avec PDF "1er Rappel" en pièce jointe`
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get invoice preview as HTML (for live preview)
// @route   GET /api/settings/invoice-preview-html
export const getInvoicePreviewHTML = async (req, res, next) => {
  try {
    const userId = req.user?._id || null;
    const settings = await Settings.getSettings(userId);

    const { generatePreviewHTML } = await import('../services/pdf.service.js');
    const html = generatePreviewHTML(settings);

    res.set({ 'Content-Type': 'text/html; charset=utf-8' });
    res.send(html);
  } catch (error) {
    next(error);
  }
};

// @desc    Get project history
// @route   GET /api/projects/:projectId/history
export const getProjectHistory = async (req, res, next) => {
  try {
    // Verify project belongs to current user
    const Project = (await import('../models/Project.js')).default;
    const project = await Project.findOne({ _id: req.params.projectId, userId: req.user._id });
    if (!project) {
      return res.status(403).json({ success: false, error: 'Accès refusé' });
    }

    const query = { project: req.params.projectId };
    const history = await History.find(query).sort('-createdAt');

    res.json({ success: true, data: history });
  } catch (error) {
    next(error);
  }
};

// @desc    Get dashboard stats
// @route   GET /api/stats
export const getStats = async (req, res, next) => {
  try {
    const Project = (await import('../models/Project.js')).default;
    const Invoice = (await import('../models/Invoice.js')).default;
    const Event = (await import('../models/Event.js')).default;

    // Build user query
    const userQuery = {};
    if (req.user) {
      userQuery.userId = req.user._id;
    }

    // Fetch user project IDs once (not 3 times)
    let projectIds = null;
    if (req.user) {
      const userProjects = await Project.find(userQuery).select('_id');
      projectIds = userProjects.map(p => p._id);
    }

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const projectFilter = projectIds ? { project: { $in: projectIds } } : {};

    // Run all queries in parallel
    const [activeProjects, pendingInvoices, paidInvoices, unbilledEvents] = await Promise.all([
      Project.countDocuments({ ...userQuery, archivedAt: null }),
      Invoice.find({ ...projectFilter, status: { $in: ['draft', 'sent'] } }),
      Invoice.find({ ...projectFilter, status: 'paid', paidAt: { $gte: startOfMonth } }),
      Event.find({ ...projectFilter, billed: false })
    ]);

    const pendingAmount = pendingInvoices.reduce((sum, inv) => sum + inv.total, 0);
    const paidThisMonth = paidInvoices.reduce((sum, inv) => sum + inv.total, 0);
    const unbilledTotal = unbilledEvents.reduce((sum, event) => {
      if (event.type === 'hours') return sum + (event.hours * event.hourlyRate);
      if (event.type === 'expense') return sum + event.amount;
      return sum;
    }, 0);

    res.json({
      success: true,
      data: {
        activeProjects,
        pendingAmount,
        paidThisMonth,
        unbilledTotal
      }
    });
  } catch (error) {
    next(error);
  }
};
