export const ROLE_FAMILIES = Object.freeze({
  'systems-administration': {
    label: 'Systems administration',
    synonyms: [
      'systems administrator',
      'sysadmin',
      'IT administrator',
      'system administrator',
      'infrastructure administrator',
    ],
  },
  'it-support': {
    label: 'IT support',
    synonyms: [
      'IT support',
      'help desk',
      'IT technician',
      'service desk',
      'technical support',
      'support technician',
      'computer technician',
      'client support',
      'IT specialist',
    ],
  },
  'network-administration': {
    label: 'Network administration',
    synonyms: [
      'network administrator',
      'network engineer',
      'network technician',
      'network support',
      'network analyst',
      'network specialist',
    ],
  },
  'cloud-support': {
    label: 'Cloud support',
    synonyms: [
      'cloud support',
      'cloud engineer',
      'cloud administrator',
      'cloud operations',
      'Azure administrator',
      'AWS administrator',
    ],
  },
  'it-operations': {
    label: 'IT operations',
    synonyms: [
      'IT operations',
      'data center technician',
      'NOC technician',
      'infrastructure operations',
      'operations technician',
      'systems operations',
    ],
  },
  'desktop-support': {
    label: 'Desktop support',
    synonyms: [
      'desktop support',
      'desktop technician',
      'field service technician',
      'deskside support',
      'endpoint support',
      'PC technician',
    ],
  },
  'junior-systems-engineering': {
    label: 'Junior systems engineering',
    synonyms: [
      'systems engineer',
      'IT engineer',
      'infrastructure engineer',
      'junior systems engineer',
      'associate systems engineer',
      'systems engineer I',
    ],
  },
  'internet-service-installation': {
    label: 'Internet service installation',
    synonyms: [
      'cable installer',
      'broadband technician',
      'fiber technician',
      'internet service installer',
      'cable technician',
      'telecommunications installer',
      'telecom installer',
      'installation technician',
      'line technician',
      'field technician',
    ],
  },
});

export const ROLE_FAMILY_IDS = Object.freeze(Object.keys(ROLE_FAMILIES));

export function normalizeTerms(values = []) {
  const seen = new Set();
  return values.flatMap(value => {
    const term = String(value).trim().replace(/\s+/g, ' ');
    const key = term.toLocaleLowerCase('en-US');
    if (!term || seen.has(key)) return [];
    seen.add(key);
    return [term];
  });
}

export function normalizeRoleFamilies(values = []) {
  const seen = new Set();
  return values.flatMap(value => {
    const id = String(value);
    if (!Object.hasOwn(ROLE_FAMILIES, id) || seen.has(id)) return [];
    seen.add(id);
    return [id];
  });
}
