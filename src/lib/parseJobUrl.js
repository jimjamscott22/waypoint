// Stub for a future real scraper. Resolves immediately with an empty
// draft so the UI can let the user fill in details by hand.
export function parseJobUrl(url) {
  return Promise.resolve({
    role: '',
    company: '',
    location: '',
    salary: '',
    contact: '',
    url,
  });
}
