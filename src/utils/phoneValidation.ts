export type PhoneAssessment = { normalized: string; valid: boolean; reason?: string };

export function assessPhone(value: string): PhoneAssessment {
  const normalized = (value || '').replace(/\D/g, '');
  if (!normalized) return { normalized, valid: false, reason: 'Sin teléfono' };
  if (normalized.length < 8 || normalized.length > 15) return { normalized, valid: false, reason: 'Longitud fuera de 8 a 15 dígitos' };
  if (normalized.split('').every((digit) => digit === normalized[0])) return { normalized, valid: false, reason: 'Dígitos repetidos' };
  if ('0123456789012345'.includes(normalized) || '987654321098765'.includes(normalized)) return { normalized, valid: false, reason: 'Secuencia ficticia' };
  return { normalized, valid: true };
}
