const MODEL_PATTERNS: Array<[string, RegExp]> = [
  ['Peugeot', /\b(108|206|207|208|2008|3008|408|301|308|4008|5008|partner|expert|boxer|rifter|landtrek)/i],
  ['Ford', /\b(ranger|territory|maverick|mustang|bronco|kuga|focus|fiesta|ka|ecosport|transit)/i],
  ['Volkswagen', /\b(amarok|taos|nivus|t-cross|t-?roc|virtus|polo|gol|saveiro|tiguan|passat|vento)/i],
  ['Toyota', /\b(hilux|corolla|yaris|rav4|sw4|etios|camry|land cruiser)/i],
  ['Chevrolet', /\b(tracker|onix|cruze|s10|montana|spin|equinox|trailblazer)/i],
  ['Fiat', /\b(cronos|toro|pulse|fastback|mobi|argo|strada|ducato|fiorino)/i],
  ['Renault', /\b(kwid|sandero|logan|duster|kangoo|alaskan|koleos)/i],
  ['Citroën', /\b(c3|c4|c5|berlingo|jumpy|jumper|basalt|aircross)/i],
  ['Jeep', /\b(renegade|compass|commander|gladiator|wrangler)/i],
];

/** Uses an explicit Marca first; only infers when the vehicle model is an unambiguous known model. */
export function resolveVehicleBrand(explicitBrand: string, model: string): { brand: string; resolution: 'explicit' | 'model' | 'unbranded' } {
  if (explicitBrand.trim()) return { brand: explicitBrand.trim(), resolution: 'explicit' };
  const match = MODEL_PATTERNS.find(([, pattern]) => pattern.test(model));
  return match ? { brand: match[0], resolution: 'model' } : { brand: '', resolution: 'unbranded' };
}
