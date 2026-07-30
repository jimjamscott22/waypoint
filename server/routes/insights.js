export async function insightRoutes(app, { insights }) {
  app.get('/api/insights', {
    schema: {
      querystring: {
        type: 'object',
        additionalProperties: false,
        properties: {
          range: { type: 'string', enum: ['30d', '90d', 'all'], default: '90d' },
        },
      },
    },
  }, async request => insights.get(request.query.range));
}
