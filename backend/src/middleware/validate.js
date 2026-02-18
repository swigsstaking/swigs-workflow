/**
 * Simple validation middleware (no external dependencies)
 * Usage: validate({ body: { name: 'required|string', email: 'email', amount: 'number|min:0' } })
 */
export function validate(schema) {
  return (req, res, next) => {
    const errors = [];

    if (schema.body) {
      for (const [field, rules] of Object.entries(schema.body)) {
        const value = req.body[field];
        const ruleList = rules.split('|');

        for (const rule of ruleList) {
          if (rule === 'required' && (value === undefined || value === null || value === '')) {
            errors.push(`${field} est requis`);
          }
          if (rule === 'string' && value !== undefined && value !== null && typeof value !== 'string') {
            errors.push(`${field} doit être une chaîne`);
          }
          if (rule === 'number' && value !== undefined && value !== null && typeof value !== 'number') {
            errors.push(`${field} doit être un nombre`);
          }
          if (rule === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            errors.push(`${field} doit être un email valide`);
          }
          if (rule.startsWith('min:') && typeof value === 'number') {
            const min = parseFloat(rule.split(':')[1]);
            if (value < min) errors.push(`${field} doit être >= ${min}`);
          }
          if (rule.startsWith('max:') && typeof value === 'number') {
            const max = parseFloat(rule.split(':')[1]);
            if (value > max) errors.push(`${field} doit être <= ${max}`);
          }
          if (rule.startsWith('in:') && value !== undefined && value !== null) {
            const allowed = rule.split(':')[1].split(',');
            if (!allowed.includes(String(value))) {
              errors.push(`${field} doit être parmi: ${allowed.join(', ')}`);
            }
          }
        }
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation échouée', details: errors });
    }

    next();
  };
}

/**
 * Sanitize: only keep allowed fields from req.body
 */
export function sanitizeBody(...allowedFields) {
  return (req, res, next) => {
    const sanitized = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        sanitized[field] = req.body[field];
      }
    }
    req.body = sanitized;
    next();
  };
}
