export const ROLE_FAMILIES = Object.freeze({
  'systems-administration': {
    label: 'Systems administration',
    synonyms: [
      'systems administrator',
      'system administrator',
      'IT administrator',
      'sysadmin',
      'infrastructure administrator',
      'applications administrator',
      'Linux administrator',
      'Windows administrator',
      'server administrator',
      'Active Directory administrator',
    ],
  },
  'it-support': {
    label: 'IT support',
    synonyms: [
      'IT support',
      'help desk',
      'technical support',
      'service desk',
      'IT technician',
      'support technician',
      'computer technician',
      'IT specialist',
      // Observed in real Syracuse postings and previously dropped: the city posts its
      // service-desk roles as "Computer Consultant", and "IS" is still common locally
      // for what everyone else calls IT. Kept after the third entry so the phrases sent
      // to the provider are unchanged — these widen the filter, not the search.
      'IT analyst',
      'computer consultant',
      'IS support',
      'support services',
      'helpdesk',
      'computer support',
      'information technology specialist',
      'information technology technician',
      'technology support',
      'IT coordinator',
      'End User Support',
      'user support',
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
      'network operations',
      'Cisco administrator',
      'NOC engineer',
      'NOC analyst',
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
      'cloud technician',
      'cloud specialist',
      'cloud analyst',
      'Azure engineer',
      'AWS engineer',
      'Microsoft 365 administrator',
      'M365 administrator',
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
      'technical operations',
      'datacenter technician',
      'data center engineer',
      'data center operations',
      'IT infrastructure',
    ],
  },
  'desktop-support': {
    label: 'Desktop support',
    synonyms: [
      'desktop support',
      'desktop technician',
      'deskside support',
      'endpoint support',
      'PC technician',
      'workstation technician',
      'workstation support',
      'endpoint technician',
      'desktop analyst',
      'desktop administrator',
      'PC support',
    ],
  },
  'junior-systems-engineering': {
    label: 'Junior systems engineering',
    synonyms: [
      'junior systems engineer',
      'associate systems engineer',
      'IT engineer',
      'systems engineer I',
      'infrastructure engineer',
      'junior system engineer',
      'associate system engineer',
      'entry level systems engineer',
      'IT systems engineer',
      'Windows systems engineer',
      'Linux systems engineer',
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
      'fiber optic technician',
      'fiber splicer',
      'telecom technician',
      'telecommunications technician',
      'OSP technician',
      'premise technician',
      'broadband installer',
      'network installer',
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
