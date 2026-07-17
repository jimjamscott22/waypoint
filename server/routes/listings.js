export async function listingRoutes(app, { listings }) {
  app.post('/api/listings/:id/save', async request => listings.save(request.params.id));
  app.post('/api/listings/:id/dismiss', async request => listings.dismiss(request.params.id));
}
