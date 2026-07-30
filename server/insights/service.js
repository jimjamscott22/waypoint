import { buildInsights, parseInsightsRange } from './buildInsights.js';

export function createInsightsService({ repository, now = () => new Date() }) {
  return {
    async get(range = '90d') {
      const currentTime = now();
      const parsed = parseInsightsRange(range, currentTime);
      const snapshot = await repository.snapshot();
      return buildInsights(snapshot, { ...parsed, now: currentTime });
    },
  };
}
