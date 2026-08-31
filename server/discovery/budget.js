// A single shared request counter lets whichever provider is searched first consume the
// whole run, silently starving the others on every run. Each provider therefore gets its
// own counter.
//
// The configured total is *split* rather than granted to each provider, so the run's
// overall request ceiling is unchanged: with one provider configured, the counter behaves
// exactly as the single shared counter did. Remainder requests go to the providers
// earliest in the list, which keeps the split deterministic.
export function createRequestBudget(total, providers) {
  const remaining = new Map();
  const count = providers.length;
  if (count > 0) {
    const base = Math.floor(total / count);
    let extra = total % count;
    for (const provider of providers) {
      remaining.set(provider.id, base + (extra > 0 ? 1 : 0));
      if (extra > 0) extra -= 1;
    }
  }

  return {
    // Claims one request for a provider. Returns false when that provider is spent, which
    // the caller reports as an unsearched request rather than treating as an error.
    take(providerId) {
      const left = remaining.get(providerId);
      if (left === undefined) {
        throw new Error(`No request budget allocated for provider '${providerId}'`);
      }
      if (left <= 0) return false;
      remaining.set(providerId, left - 1);
      return true;
    },
    remainingFor(providerId) {
      return remaining.get(providerId) ?? 0;
    },
    // True only when no provider has anything left, so a family is skipped outright only
    // when no provider could have searched it.
    exhausted() {
      for (const left of remaining.values()) {
        if (left > 0) return false;
      }
      return true;
    },
  };
}
