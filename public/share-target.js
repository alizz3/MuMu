// Recibe capturas desde el menú "Compartir" de Android (MuMu instalada) y abre Celular y redes para leerlas.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'POST' || url.pathname !== '/compartir') return
  e.respondWith((async () => {
    const form = await e.request.formData()
    const files = form.getAll('shots').filter((f) => f && f.type && f.type.startsWith('image/'))
    const cache = await caches.open('mumu-compartido')
    for (const k of await cache.keys()) await cache.delete(k)
    await Promise.all(files.map((f, i) => cache.put(`/compartido/${i}`, new Response(f, { headers: { 'content-type': f.type } }))))
    return Response.redirect(`/celular?compartido=${files.length}`, 303)
  })())
})
