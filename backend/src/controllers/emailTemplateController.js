import EmailTemplate from '../models/EmailTemplate.js';
import Handlebars from 'handlebars';

// Sanitize Handlebars templates to prevent prototype pollution and code injection
function sanitizeTemplate(template) {
  if (!template) return template;
  const forbidden = [
    /\{\{#?with\b/gi,          // {{#with}} can access prototype
    /\{\{#?each\s+\.\./gi,     // parent context traversal
    /\{\{.*constructor/gi,      // prototype pollution
    /\{\{.*__proto__/gi,        // prototype access
    /\{\{.*process\./gi,        // Node.js process access
    /\{\{.*require\(/gi,        // Module loading
    /\{\{.*eval\(/gi,           // Code execution
  ];

  for (const pattern of forbidden) {
    if (pattern.test(template)) {
      throw new Error('Le template contient des expressions non autorisées');
    }
  }

  return template;
}

// @desc    Get all email templates
// @route   GET /api/email-templates
export const getEmailTemplates = async (req, res, next) => {
  try {
    const query = req.user?._id ? { userId: req.user._id } : {};
    const { category, isActive } = req.query;

    if (category) query.category = category;
    if (isActive !== undefined) query.isActive = isActive === 'true';

    const templates = await EmailTemplate.find(query).sort('category name');

    res.json({ success: true, data: templates });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single email template
// @route   GET /api/email-templates/:id
export const getEmailTemplate = async (req, res, next) => {
  try {
    const template = await EmailTemplate.findById(req.params.id);

    if (!template) {
      return res.status(404).json({ success: false, error: 'Template non trouvé' });
    }

    // Check ownership
    if (req.user && template.userId && template.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: 'Accès refusé' });
    }

    res.json({ success: true, data: template });
  } catch (error) {
    next(error);
  }
};

// @desc    Create email template
// @route   POST /api/email-templates
export const createEmailTemplate = async (req, res, next) => {
  try {
    const { name, subject, body, bodyText, category, design } = req.body;

    // Sanitize templates before saving
    sanitizeTemplate(subject);
    sanitizeTemplate(body);

    // Get available variables for category
    const availableVariables = EmailTemplate.getVariablesByCategory(category || 'general');

    const template = await EmailTemplate.create({
      userId: req.user?._id,
      name,
      subject,
      body,
      bodyText,
      category: category || 'general',
      design,
      availableVariables
    });

    res.status(201).json({ success: true, data: template });
  } catch (error) {
    next(error);
  }
};

// @desc    Update email template
// @route   PUT /api/email-templates/:id
export const updateEmailTemplate = async (req, res, next) => {
  try {
    const template = await EmailTemplate.findById(req.params.id);

    if (!template) {
      return res.status(404).json({ success: false, error: 'Template non trouvé' });
    }

    // Check ownership
    if (req.user && template.userId && template.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: 'Accès refusé' });
    }

    const { name, subject, body, bodyText, category, design, isActive } = req.body;

    // Sanitize templates before saving
    if (subject !== undefined) sanitizeTemplate(subject);
    if (body !== undefined) sanitizeTemplate(body);

    if (name !== undefined) template.name = name;
    if (subject !== undefined) template.subject = subject;
    if (body !== undefined) template.body = body;
    if (bodyText !== undefined) template.bodyText = bodyText;
    if (design !== undefined) template.design = { ...template.design, ...design };
    if (isActive !== undefined) template.isActive = isActive;

    // Update available variables if category changed
    if (category !== undefined && category !== template.category) {
      template.category = category;
      template.availableVariables = EmailTemplate.getVariablesByCategory(category);
    }

    await template.save();

    res.json({ success: true, data: template });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete email template
// @route   DELETE /api/email-templates/:id
export const deleteEmailTemplate = async (req, res, next) => {
  try {
    const template = await EmailTemplate.findById(req.params.id);

    if (!template) {
      return res.status(404).json({ success: false, error: 'Template non trouvé' });
    }

    // Check ownership
    if (req.user && template.userId && template.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: 'Accès refusé' });
    }

    await EmailTemplate.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: 'Template supprimé' });
  } catch (error) {
    next(error);
  }
};

// @desc    Preview email template with sample data
// @route   POST /api/email-templates/:id/preview
export const previewEmailTemplate = async (req, res, next) => {
  try {
    const template = await EmailTemplate.findById(req.params.id);

    if (!template) {
      return res.status(404).json({ success: false, error: 'Template non trouvé' });
    }

    const { data = {} } = req.body;

    // Sanitize before compiling
    sanitizeTemplate(template.subject);
    sanitizeTemplate(template.body);

    // Compile templates
    const subjectTemplate = Handlebars.compile(template.subject);
    const bodyTemplate = Handlebars.compile(template.body);

    // Sample data for preview
    const sampleData = {
      company: {
        name: 'SWIGS',
        email: 'contact@swigs.online',
        phone: '+41 79 123 45 67'
      },
      today: new Date().toLocaleDateString('fr-CH'),
      customer: {
        firstName: 'Jean',
        lastName: 'Dupont',
        email: 'jean.dupont@example.com',
        phone: '+41 79 987 65 43'
      },
      order: {
        number: 'ORD-2026-0001',
        total: '150.00 CHF',
        status: 'Payée',
        items: '2x T-Shirt, 1x Casquette',
        trackingNumber: 'CH123456789',
        trackingUrl: 'https://track.example.com/CH123456789'
      },
      invoice: {
        number: 'FAC-2026-001',
        total: '1\'620.00 CHF',
        subtotal: '1\'500.00 CHF',
        dueDate: '05.03.2026',
        status: 'Envoyée'
      },
      quote: {
        number: 'DEV-2026-001',
        total: '5\'400.00 CHF',
        validUntil: '05.03.2026'
      },
      project: {
        name: 'Site Web E-commerce',
        status: 'En cours'
      },
      client: {
        name: 'Dupont SA',
        email: 'contact@dupont.ch'
      },
      ...data
    };

    const renderedSubject = subjectTemplate(sampleData);
    const renderedBody = bodyTemplate(sampleData);

    res.json({
      success: true,
      data: {
        subject: renderedSubject,
        body: renderedBody,
        sampleData
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Send test email
// @route   POST /api/email-templates/:id/send-test
export const sendTestEmail = async (req, res, next) => {
  try {
    const template = await EmailTemplate.findById(req.params.id);

    if (!template) {
      return res.status(404).json({ success: false, error: 'Template non trouvé' });
    }

    const { to, data = {} } = req.body;

    if (!to) {
      return res.status(400).json({ success: false, error: 'Email destinataire requis' });
    }

    // Import email service
    const { sendTemplateEmail } = await import('../services/automation/emailService.js');

    await sendTemplateEmail(template._id, to, data);

    res.json({ success: true, message: 'Email de test envoyé' });
  } catch (error) {
    next(error);
  }
};

// @desc    Get available variables for a category
// @route   GET /api/email-templates/variables/:category
export const getVariables = async (req, res, next) => {
  try {
    const { category } = req.params;
    const variables = EmailTemplate.getVariablesByCategory(category);

    res.json({ success: true, data: variables });
  } catch (error) {
    next(error);
  }
};

// @desc    Create default templates for user
// @route   POST /api/email-templates/create-defaults
export const createDefaults = async (req, res, next) => {
  try {
    const userId = req.user?._id;

    // Check if user already has templates
    const existingCount = await EmailTemplate.countDocuments({ userId });

    if (existingCount > 0) {
      return res.status(400).json({
        success: false,
        error: 'Des templates existent déjà'
      });
    }

    const templates = await EmailTemplate.createDefaults(userId);

    res.status(201).json({ success: true, data: templates });
  } catch (error) {
    next(error);
  }
};
