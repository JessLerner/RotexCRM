const MODEL_PATTERNS: Array<[string, RegExp]> = [
  ['PEUGEOT', /\b(108|206|207|208|2008|3008|408|301|308|4008|5008|partner|expert|boxer|rifter|landtrek)\b/i],
  ['FIAT', /\b(cronos|toro|pulse|fastback|mobi|argo|strada|ducato|fiorino)\b/i],
  ['RENAULT', /\b(kwid|sandero|logan|duster|kangoo|alaskan|koleos)\b/i],
  ['CITROEN', /\b(c3|c4|c5|berlingo|jumpy|jumper|basalt|aircross)\b/i],
  ['JEEP', /\b(renegade|compass|commander|gladiator|wrangler)\b/i],
];

const EXPLICIT_BRANDS: Record<string, string> = {
  leap: 'LEAPMOTOR', leapmotor: 'LEAPMOTOR', leapmotors: 'LEAPMOTOR',
  renault: 'RENAULT', peugeot: 'PEUGEOT', 'peugeot 208': 'PEUGEOT',
  citroen: 'CITROEN', jeep: 'JEEP', fiat: 'FIAT', cronos: 'FIAT', mobi: 'FIAT', pulse: 'FIAT',
};

const key = (value: string) => value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/** Uses an explicit Marca first; only infers when the vehicle model is an unambiguous known model. */
export function resolveVehicleBrand(explicitBrand: string, model: string): { brand: string; resolution: 'explicit' | 'model' | 'unbranded' } {
  const explicit = EXPLICIT_BRANDS[key(explicitBrand)];
  if (explicit) return { brand: explicit, resolution: 'explicit' };
  const match = MODEL_PATTERNS.find(([, pattern]) => pattern.test(model));
  return match ? { brand: match[0], resolution: 'model' } : { brand: '', resolution: 'unbranded' };
}
