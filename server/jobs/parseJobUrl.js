import dns from 'node:dns/promises';
import net from 'node:net';
import { AppError } from '../errors.js';
import { sanitizeError } from '../errors.js';

const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;
const DEFAULT_MAX_REDIRECTS = 5;
const DEFAULT_USER_AGENT = 'Waypoint/0.1 (job-url-parser)';

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata.google',
]);

const HTML_ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  '#39': "'",
  '#x27': "'",
};

function decodeHtmlEntities(value) {
  return String(value ?? '')
    .replace(/&(amp|lt|gt|quot|#39|#x27);/gi, (match, entity) => HTML_ENTITIES[entity.toLowerCase()] ?? match)
    .trim();
}

function readMetaContent(html, key, attribute = 'property') {
  const pattern = new RegExp(
    `<meta[^>]+${attribute}=["']${key}["'][^>]+content=["']([^"']*)["']|<meta[^>]+content=["']([^"']*)["'][^>]+${attribute}=["']${key}["']`,
    'i',
  );
  const match = html.match(pattern);
  const raw = match?.[1] ?? match?.[2] ?? '';
  return decodeHtmlEntities(raw);
}

function readDocumentTitle(html) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return decodeHtmlEntities(match?.[1]?.replace(/\s+/g, ' ') ?? '');
}

function findJobPostingNode(data) {
  if (!data || typeof data !== 'object') return null;
  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findJobPostingNode(item);
      if (found) return found;
    }
    return null;
  }
  const type = data['@type'];
  const types = Array.isArray(type) ? type : [type];
  if (types.some(entry => String(entry).toLowerCase() === 'jobposting')) return data;
  if (Array.isArray(data['@graph'])) return findJobPostingNode(data['@graph']);
  return null;
}

function readJsonLdJobPosting(html) {
  const pattern = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(pattern)) {
    const raw = match[1]?.trim();
    if (!raw) continue;
    try {
      const payload = JSON.parse(raw);
      const posting = findJobPostingNode(payload);
      if (posting) return posting;
    } catch {
      // Ignore malformed JSON-LD blocks.
    }
  }
  return null;
}

function stringFromUnknown(value) {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

function formatJobLocation(jobLocation) {
  if (!jobLocation) return '';
  if (typeof jobLocation === 'string') return jobLocation.trim();
  if (Array.isArray(jobLocation)) {
    return jobLocation.map(formatJobLocation).filter(Boolean).join('; ');
  }
  if (typeof jobLocation !== 'object') return '';

  const address = jobLocation.address;
  if (typeof address === 'string') return address.trim();
  if (address && typeof address === 'object') {
    const parts = [
      address.streetAddress,
      address.addressLocality,
      address.addressRegion,
      address.postalCode,
      address.addressCountry,
    ].map(stringFromUnknown).filter(Boolean);
    if (parts.length) return parts.join(', ');
  }

  return stringFromUnknown(jobLocation.name);
}

function formatSalary(baseSalary) {
  if (!baseSalary || typeof baseSalary !== 'object') return '';
  const value = baseSalary.value;
  if (value && typeof value === 'object') {
    const min = stringFromUnknown(value.minValue);
    const max = stringFromUnknown(value.maxValue);
    const unit = stringFromUnknown(value.unitText);
    if (min && max) return unit ? `${min}-${max} ${unit}` : `${min}-${max}`;
    const single = stringFromUnknown(value.value);
    if (single) return unit ? `${single} ${unit}` : single;
  }
  return stringFromUnknown(baseSalary);
}

export function extractJobDraftFromHtml(html, url) {
  const posting = readJsonLdJobPosting(html);
  const ogTitle = readMetaContent(html, 'og:title');
  const ogSiteName = readMetaContent(html, 'og:site_name');
  const siteNameByName = readMetaContent(html, 'og:site_name', 'name');
  const documentTitle = readDocumentTitle(html);

  let role = stringFromUnknown(posting?.title);
  let company = stringFromUnknown(posting?.hiringOrganization?.name);
  let location = formatJobLocation(posting?.jobLocation);
  const salary = formatSalary(posting?.baseSalary);

  if (!role) role = ogTitle || documentTitle;
  if (!company) company = ogSiteName || siteNameByName;
  if (!company) {
    try {
      company = new URL(url).hostname.replace(/^www\./i, '');
    } catch {
      company = '';
    }
  }

  return {
    role,
    company,
    location,
    salary,
    contact: '',
    url,
  };
}

function isPrivateIpv4(ip) {
  const parts = ip.split('.').map(part => Number.parseInt(part, 10));
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  if (parts[0] === 10) return true;
  if (parts[0] === 127) return true;
  if (parts[0] === 0) return true;
  if (parts[0] === 169 && parts[1] === 254) return true;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;
  if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true;
  return false;
}

function isPrivateIpv6(ip) {
  const normalized = ip.toLowerCase();
  if (normalized === '::1' || normalized === '::') return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
  if (normalized.startsWith('fe80')) return true;
  if (normalized.startsWith('::ffff:')) {
    const mapped = normalized.slice('::ffff:'.length);
    if (net.isIPv4(mapped)) return isPrivateIpv4(mapped);
  }
  return false;
}

export function isPrivateIp(address) {
  if (net.isIPv4(address)) return isPrivateIpv4(address);
  if (net.isIPv6(address)) return isPrivateIpv6(address);
  return true;
}

export async function assertPublicHttpUrl(urlString, lookup = dns.lookup) {
  let url;
  try {
    url = new URL(String(urlString ?? '').trim());
  } catch {
    throw new AppError(400, 'INVALID_JOB_URL', 'Enter a valid http or https job posting URL');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new AppError(400, 'INVALID_JOB_URL', 'Enter a valid http or https job posting URL');
  }

  const hostname = url.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith('.local') || hostname.endsWith('.localhost')) {
    throw new AppError(400, 'BLOCKED_JOB_URL', 'That job URL cannot be fetched');
  }

  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      throw new AppError(400, 'BLOCKED_JOB_URL', 'That job URL cannot be fetched');
    }
    return url;
  }

  let resolved;
  try {
    resolved = await lookup(hostname, { verbatim: true });
  } catch (error) {
    throw new AppError(400, 'INVALID_JOB_URL', sanitizeError(error));
  }

  if (isPrivateIp(resolved.address)) {
    throw new AppError(400, 'BLOCKED_JOB_URL', 'That job URL cannot be fetched');
  }

  return url;
}

async function readResponseText(response, maxBytes) {
  if (!response.body) {
    const text = await response.text();
    if (text.length > maxBytes) {
      throw new AppError(502, 'JOB_URL_FETCH_FAILED', 'Job posting page is too large to parse');
    }
    return text;
  }

  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      throw new AppError(502, 'JOB_URL_FETCH_FAILED', 'Job posting page is too large to parse');
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function fetchHtmlDocument(urlString, {
  fetchImpl,
  lookup,
  timeoutMs,
  maxBytes,
  maxRedirects,
  userAgent,
}) {
  let currentUrl = urlString;

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    await assertPublicHttpUrl(currentUrl, lookup);

    let response;
    try {
      response = await fetchImpl(currentUrl, {
        method: 'GET',
        redirect: 'manual',
        headers: {
          Accept: 'text/html,application/xhtml+xml',
          'User-Agent': userAgent,
        },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      throw new AppError(502, 'JOB_URL_FETCH_FAILED', sanitizeError(error));
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) {
        throw new AppError(502, 'JOB_URL_FETCH_FAILED', `Job posting request failed with HTTP ${response.status}`);
      }
      currentUrl = new URL(location, currentUrl).href;
      continue;
    }

    if (!response.ok) {
      throw new AppError(502, 'JOB_URL_FETCH_FAILED', `Job posting request failed with HTTP ${response.status}`);
    }

    return readResponseText(response, maxBytes);
  }

  throw new AppError(502, 'JOB_URL_FETCH_FAILED', 'Job posting URL redirected too many times');
}

export function createJobUrlParser({
  fetchImpl = fetch,
  lookup = dns.lookup,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxBytes = DEFAULT_MAX_BYTES,
  maxRedirects = DEFAULT_MAX_REDIRECTS,
  userAgent = DEFAULT_USER_AGENT,
} = {}) {
  return {
    async parse(urlString) {
      const url = await assertPublicHttpUrl(urlString, lookup);
      const html = await fetchHtmlDocument(url.href, {
        fetchImpl,
        lookup,
        timeoutMs,
        maxBytes,
        maxRedirects,
        userAgent,
      });
      return extractJobDraftFromHtml(html, url.href);
    },
  };
}
