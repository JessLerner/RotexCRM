export interface ParsedCsvResult {
  headers: string[];
  rows: Record<string, string>[];
  delimiter: string;
}

/** Decodes Fox exports that mix a `sep=,` ASCII prefix with Windows-1252 text padded by NUL bytes. */
export function decodeCsvFile(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const hasUtf16Bom = bytes.length > 1 && ((bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0xfe && bytes[1] === 0xff));
  if (hasUtf16Bom) return new TextDecoder(bytes[0] === 0xff ? 'utf-16le' : 'utf-16be').decode(bytes).replace(/^\uFEFF/, '');
  try {
    const utf8 = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    if (!utf8.includes('\u0000')) return utf8;
  } catch {
    // Legacy Fox export; handled below.
  }
  return new TextDecoder('windows-1252').decode(bytes).replace(/\u0000/g, '');
}

/**
 * Universal CSV parser supporting comma, semicolon, and tab delimiters,
 * multi-line quoted fields, escaped quotes, and trimmed values.
 */
export function parseCSV(content: string): ParsedCsvResult {
  if (!content || !content.trim()) {
    return { headers: [], rows: [], delimiter: ',' };
  }

  let normalizedContent = content.replace(/^\uFEFF/, '').replace(/\u0000/g, '');
  const separatorDirective = normalizedContent.match(/^\s*sep\s*=\s*([,;\t])\s*(?:\r\n|\n|\r)/i);
  const forcedDelimiter = separatorDirective?.[1];
  if (separatorDirective) normalizedContent = normalizedContent.slice(separatorDirective[0].length);
  // Detect delimiter by inspecting the header, after an optional Excel/Fox `sep=` directive.
  const firstLine = normalizedContent.split(/\r\n|\n|\r/)[0] || '';
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;

  let delimiter = forcedDelimiter || ',';
  if (!forcedDelimiter && semicolonCount > commaCount && semicolonCount > tabCount) {
    delimiter = ';';
  } else if (tabCount > commaCount && tabCount > semicolonCount) {
    delimiter = '\t';
  }

  const lines: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let insideQuotes = false;

  for (let i = 0; i < normalizedContent.length; i++) {
    const char = normalizedContent[i];
    const nextChar = normalizedContent[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        // Escaped quote
        currentField += '"';
        i++;
      } else {
        // Toggle quote mode
        insideQuotes = !insideQuotes;
      }
    } else if (char === delimiter && !insideQuotes) {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++; // Skip \n
      }
      currentRow.push(currentField.trim());
      currentField = '';
      if (currentRow.some((val) => val.length > 0)) {
        lines.push(currentRow);
      }
      currentRow = [];
    } else {
      currentField += char;
    }
  }

  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((val) => val.length > 0)) {
      lines.push(currentRow);
    }
  }

  if (lines.length === 0) {
    return { headers: [], rows: [], delimiter };
  }

  const headers = lines[0].map((h) => h.replace(/^["'\s]+|["'\s]+$/g, '').trim());
  const rows: Record<string, string>[] = [];

  for (let r = 1; r < lines.length; r++) {
    const line = lines[r];
    const rowObj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      rowObj[h] = line[idx] ? line[idx].trim() : '';
    });
    rows.push(rowObj);
  }

  return { headers, rows, delimiter };
}

/**
 * Normalizes text for header matching (lowercased, accents removed, non-alphanumeric removed)
 */
function normalizeKey(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Matches Fox CRM CSV columns to Rotex Lead fields
 */
export function matchFoxCrmColumns(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {
    foxLeadId: '',
    clientName: '',
    phone: '',
    email: '',
    brand: '',
    modelInterest: '',
    foxOriginalCloseDate: '',
    foxOriginalCloseReason: '',
    foxBranch: '',
    foxNotes: '',
    lastName: '',
    sourceStatus: '',
    sourceOrigin: '',
    sourceTeam: '',
    sourceManager: '',
  };

  headers.forEach((header) => {
    const k = normalizeKey(header);

    // ID
    if (!mapping.foxLeadId && (k === 'id' || k.includes('leadid') || k.includes('idlead') || k.includes('codigo') || k.includes('idfox'))) {
      mapping.foxLeadId = header;
    }
    // Name
    if (!mapping.clientName && (k.includes('nombre') || k.includes('cliente') || k.includes('contacto') || k.includes('razonsocial'))) {
      mapping.clientName = header;
    }
    if (!mapping.lastName && (k === 'apellido' || k.includes('apellidos'))) mapping.lastName = header;
    // Phone
    if (!mapping.phone && (k.includes('telefono') || k.includes('celular') || k.includes('whatsapp') || k.includes('movil') || k === 'tel')) {
      mapping.phone = header;
    }
    // Email
    if (!mapping.email && (k.includes('email') || k.includes('correo') || k.includes('mail'))) {
      mapping.email = header;
    }
    // Brand (Marca)
    if (!mapping.brand && (k === 'marca' || k.includes('marcavehiculo') || k.includes('marcainteres') || k.includes('marca'))) {
      mapping.brand = header;
    }
    // Model (Modelo)
    if (!mapping.modelInterest && (k.includes('modelo') || k.includes('version') || k.includes('interes') || k.includes('vehiculo'))) {
      mapping.modelInterest = header;
    }
    // Close Date
    if (!mapping.foxOriginalCloseDate && (k.includes('fechacierre') || k.includes('cierrefecha') || k.includes('fechafox'))) {
      mapping.foxOriginalCloseDate = header;
    }
    // Close Reason
    if (!mapping.foxOriginalCloseReason && (k.includes('motivocierre') || k.includes('motivofox') || k.includes('razoncierre') || k.includes('estadoanterior') || k.includes('estadofox'))) {
      mapping.foxOriginalCloseReason = header;
    }
    // Branch / Sucursal
    if (!mapping.foxBranch && (k.includes('sucursal') || k.includes('concesionario') || k.includes('agencia') || k.includes('local'))) {
      mapping.foxBranch = header;
    }
    // Notes
    if (!mapping.foxNotes && (k.includes('nota') || k.includes('observacion') || k.includes('comentario') || k.includes('detalle'))) {
      mapping.foxNotes = header;
    }
    if (!mapping.sourceStatus && k === 'estado') mapping.sourceStatus = header;
    if (!mapping.sourceOrigin && (k === 'origen' || k.includes('sitiodeorigen'))) mapping.sourceOrigin = header;
    if (!mapping.sourceTeam && k.includes('equipodeventa')) mapping.sourceTeam = header;
    if (!mapping.sourceManager && (k.includes('usuariogestion') || k.includes('gestor'))) mapping.sourceManager = header;
  });

  return mapping;
}

/**
 * Matches Google Sheet "Parte Diario" columns for Vendors
 */
export function matchParteDiarioColumns(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {
    name: '',
    supervisor: '',
    brand: '',
    status: '',
    maxAssignments: '',
    phone: '',
    email: '',
  };

  headers.forEach((header) => {
    const k = normalizeKey(header);

    if (!mapping.name && (k.includes('vendedor') || k.includes('asesor') || k.includes('agente') || k.includes('nombre'))) {
      mapping.name = header;
    }
    if (!mapping.supervisor && (k.includes('supervisor') || k.includes('jefe') || k.includes('teamleader') || k.includes('lider'))) {
      mapping.supervisor = header;
    }
    if (!mapping.brand && (k.includes('marca') || k.includes('linea') || k.includes('division'))) {
      mapping.brand = header;
    }
    if (!mapping.status && (k.includes('estado') || k.includes('actividad') || k.includes('disponibilidad'))) {
      mapping.status = header;
    }
    if (!mapping.maxAssignments && (k.includes('max') || k.includes('cupo') || k.includes('capacidad') || k.includes('limite'))) {
      mapping.maxAssignments = header;
    }
    if (!mapping.phone && (k.includes('telefono') || k.includes('celular') || k.includes('whatsapp') || k === 'tel')) {
      mapping.phone = header;
    }
    if (!mapping.email && (k.includes('email') || k.includes('correo') || k.includes('mail'))) {
      mapping.email = header;
    }
  });

  return mapping;
}
