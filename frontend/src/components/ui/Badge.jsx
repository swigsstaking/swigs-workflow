export default function Badge({
  children,
  color = '#6B7280',
  variant = 'solid',
  size = 'md',
  className = ''
}) {
  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs',
    lg: 'px-3 py-1 text-sm'
  };

  if (variant === 'solid') {
    return (
      <span
        className={`
          inline-flex items-center font-medium rounded-full
          ${sizes[size]}
          ${className}
        `}
        style={{
          backgroundColor: `${color}20`,
          color: color
        }}
      >
        {children}
      </span>
    );
  }

  // Outline variant
  return (
    <span
      className={`
        inline-flex items-center font-medium rounded-full
        border
        ${sizes[size]}
        ${className}
      `}
      style={{
        borderColor: color,
        color: color
      }}
    >
      {children}
    </span>
  );
}

// Status specific badges
export const StatusBadge = {
  Draft: () => <Badge color="#6B7280">Brouillon</Badge>,
  Sent: () => <Badge color="#3B82F6">Envoyé</Badge>,
  Signed: () => <Badge color="#10B981">Signé</Badge>,
  Refused: () => <Badge color="#EF4444">Refusé</Badge>,
  Expired: () => <Badge color="#F59E0B">Expiré</Badge>,
  Paid: () => <Badge color="#10B981">Payé</Badge>,
  Cancelled: () => <Badge color="#EF4444">Annulé</Badge>
};

export const InvoiceStatusBadge = ({ status }) => {
  const statusConfig = {
    draft: { color: '#6B7280', label: 'Brouillon' },
    sent: { color: '#3B82F6', label: 'Envoyée' },
    paid: { color: '#10B981', label: 'Payée' },
    cancelled: { color: '#EF4444', label: 'Annulée' }
  };

  const config = statusConfig[status] || statusConfig.draft;

  return <Badge color={config.color}>{config.label}</Badge>;
};

export const QuoteStatusBadge = ({ status }) => {
  const statusConfig = {
    draft: { color: '#6B7280', label: 'Brouillon' },
    sent: { color: '#3B82F6', label: 'Envoyé' },
    signed: { color: '#10B981', label: 'Signé' },
    refused: { color: '#EF4444', label: 'Refusé' },
    expired: { color: '#F59E0B', label: 'Expiré' },
    partial: { color: '#F59E0B', label: 'Partiel' },
    invoiced: { color: '#8B5CF6', label: 'Facturé' }
  };

  const config = statusConfig[status] || statusConfig.draft;

  return <Badge color={config.color}>{config.label}</Badge>;
};
