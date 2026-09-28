import { api } from './apiClient.js';

export function emptyJobDraft(url) {
  return {
    role: '',
    company: '',
    location: '',
    salary: '',
    contact: '',
    url: String(url ?? '').trim(),
  };
}

export async function parseJobUrl(url) {
  const { draft } = await api.parseJobUrl(url);
  return draft;
}

export async function parseJobUrlWithFallback(url) {
  try {
    const draft = await parseJobUrl(url);
    return { draft, error: null };
  } catch (error) {
    return {
      draft: emptyJobDraft(url),
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}
