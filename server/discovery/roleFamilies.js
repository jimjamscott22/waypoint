export const ROLE_FAMILIES = Object.freeze({
  'systems-administration': {
    label: 'Systems administration',
    synonyms: ['systems administrator', 'system administrator', 'sysadmin'],
  },
  'it-support': {
    label: 'IT support',
    synonyms: ['IT support', 'help desk', 'service desk', 'technical support'],
  },
  'network-administration': {
    label: 'Network administration',
    synonyms: ['network administrator', 'network engineer', 'network support'],
  },
  'cloud-support': {
    label: 'Cloud support',
    synonyms: ['cloud support', 'cloud operations'],
  },
  'it-operations': {
    label: 'IT operations',
    synonyms: ['IT operations', 'infrastructure operations'],
  },
  'desktop-support': {
    label: 'Desktop support',
    synonyms: ['desktop support', 'deskside support', 'endpoint support'],
  },
  'junior-systems-engineering': {
    label: 'Junior systems engineering',
    synonyms: ['junior systems engineer', 'systems engineer I', 'associate systems engineer'],
  },
  'internet-service-installation': {
    label: 'Internet service installation',
    synonyms: [
      'cable installer',
      'internet service installer',
      'broadband technician',
      'fiber technician',
      'cable technician',
      'telecommunications installer',
      'telecom installer',
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
