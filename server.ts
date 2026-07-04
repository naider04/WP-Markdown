import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

// Transient in-memory storage for document previews
const previews = new Map<string, { html: string; createdAt: number }>();

// Cleanup stale previews every 30 minutes to manage memory footprints
setInterval(() => {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  for (const [id, value] of previews.entries()) {
    if (value.createdAt < oneHourAgo) {
      previews.delete(id);
    }
  }
}, 30 * 60 * 1000);

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || "3000", 10);

  // JSON limit 30mb to safely accommodate embedded high-resolution base64 images
  app.use(express.json({ limit: "30mb" }));
  app.use(express.urlencoded({ limit: "30mb", extended: true }));

  // API Route: Store the compiled full page HTML for the preview session
  app.post("/api/save-preview", (req, res) => {
    const { html } = req.body;
    if (!html) {
      return res.status(400).json({ error: "Falta el contenido HTML" });
    }

    const id = "preview_" + Math.random().toString(36).substring(2, 15) + "_" + Date.now();
    previews.set(id, {
      html,
      createdAt: Date.now(),
    });

    res.json({ id });
  });

  // Server-Rendered Route: Serves the completely isolated raw document preview
  app.get("/preview/:id", (req, res) => {
    const id = req.params.id;
    const previewData = previews.get(id);

    if (!previewData) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <title>Enlace Expirado o Inexistente</title>
          <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body class="bg-slate-50 flex items-center justify-center min-h-screen font-sans">
          <div class="max-w-md w-full bg-white p-8 rounded-xl shadow-lg border border-slate-100 text-center">
            <div class="h-12 w-12 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h1 class="text-lg font-bold text-slate-800">Vista previa expirada</h1>
            <p class="text-sm text-slate-500 mt-2">
              Las vistas previas independientes se almacenan de forma transitoria en el servidor por seguridad. Regresa a la aplicación principal y vuelve a pulsar en "Abrir Vista Previa" para regenerarla.
            </p>
          </div>
        </body>
        </html>
      `);
    }

    // Set header content type to text/html and send the raw document
    res.setHeader("Content-Type", "text/html");
    res.send(previewData.html);
  });

  // Vite development or production assets middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[UNEMI Server] Servidor backend ejecutándose en http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Error al iniciar el servidor UNEMI Express:", err);
});
