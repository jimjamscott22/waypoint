export async function followUpRoutes(app, { followUps }) {
  app.get('/api/follow-ups', async () => ({
    followUps: await followUps.listDue(),
  }));
}
