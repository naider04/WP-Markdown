import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

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

  // API Route: Insert an image into the appropriate Markdown block using Gemini AI
  app.post("/api/gemini/insert-image", async (req, res) => {
    try {
      const { htmlBlocks, imageName, imageDescription, images } = req.body;
      const clientApiKey = req.headers["x-user-api-key"] as string | undefined;
      const apiKey = clientApiKey || process.env.GEMINI_API_KEY;

      if (!apiKey) {
        return res.status(400).json({ 
          error: "No se encontró la API Key de Gemini. Por favor, ingresa tu API Key usando el botón en la parte superior de la aplicación para activar esta función." 
        });
      }

      if (!htmlBlocks || !Array.isArray(htmlBlocks) || htmlBlocks.length === 0) {
        return res.status(400).json({ error: "No hay bloques de texto (Markdown) disponibles para insertar la imagen." });
      }

      // Support both array 'images' and single 'imageName'
      let imagesList: Array<{ name: string; description: string }> = [];
      if (images && Array.isArray(images)) {
        imagesList = images;
      } else if (imageName) {
        imagesList = [{ name: imageName, description: imageDescription || "" }];
      }

      if (imagesList.length === 0) {
        return res.status(400).json({ error: "Falta el nombre o lista de archivos de imagen." });
      }

      // Initialize the Gemini client server-side
      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          }
        }
      });

      // Construct a textual representation of the available blocks for Gemini to inspect
      const blocksText = htmlBlocks.map((b) => {
        return `--- INICIO DE BLOQUE (ID: "${b.id}", NOMBRE: "${b.name}") ---\n${b.code}\n--- FIN DE BLOQUE (ID: "${b.id}") ---`;
      }).join("\n\n");

      const prompt = `
Mira este Markdown y determina de forma inteligente cuál es el mejor bloque y el punto idóneo (ancla) para insertar cada una de las siguientes imágenes:

IMÁGENES A INSERTAR:
${imagesList.map((img, i) => `${i + 1}. Nombre de archivo: "${img.name}"\n   Descripción inicial: "${img.description || "Sin descripción específica disponible"}"`).join("\n\n")}

Para cada imagen:
1. Elige el block ID más idóneo.
2. Encuentra una frase o párrafo textual y exacto dentro de ese bloque para usarlo como 'anchorText' (ancla de texto), de modo que podamos insertar la imagen antes o después de esa frase de manera segura. Debe ser un fragmento único e idéntico para que la búsqueda sea exacta.
3. Determina si colocar la imagen 'after' (después) o 'before' (antes) del 'anchorText', o bien usa 'append' (al final del bloque) o 'prepend' (al inicio del bloque).
4. Genera la etiqueta Markdown de la imagen exacta en 'imageTag'. Escribe un título o leyenda adecuada para la imagen, no inventes datos, limítate a lo que puedas deducir de la descripción proporcionada. Ejemplo: "![Esquema conceptual del proyecto](nombre_de_archivo.png){width=70%}"

BLOQUES DISPONIBLES EN EL DOCUMENTO:
${blocksText}
`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              insertions: {
                type: Type.ARRAY,
                description: "Lista de inserciones para cada una de las imágenes solicitadas en el mismo orden o asociadas por imageName.",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    imageName: {
                      type: Type.STRING,
                      description: "El nombre del archivo de la imagen."
                    },
                    selectedBlockId: {
                      type: Type.STRING,
                      description: "El ID del bloque seleccionado donde se insertará la imagen."
                    },
                    anchorText: {
                      type: Type.STRING,
                      description: "Una frase exacta y única que ya exista en el bloque para servir de anclaje de inserción. Deja vacío si se usa 'append' o 'prepend'."
                    },
                    relation: {
                      type: Type.STRING,
                      description: "Relación de la posición: 'after', 'before', 'append' o 'prepend'."
                    },
                    imageTag: {
                      type: Type.STRING,
                      description: "La etiqueta markdown completa de la imagen generada. Ejemplo: '![Flujo de datos del sistema](nombre.png){width=70%}'"
                    }
                  },
                  required: ["imageName", "selectedBlockId", "anchorText", "relation", "imageTag"]
                }
              }
            },
            required: ["insertions"]
          }
        }
      });

      const resultText = response.text;
      if (!resultText) {
        throw new Error("No se obtuvo respuesta de texto por parte de Gemini AI.");
      }

      const parsedResult = JSON.parse(resultText);
      const insertions = parsedResult.insertions || [];

      // Copy htmlBlocks so we can modify them incrementally
      let currentBlocks = JSON.parse(JSON.stringify(htmlBlocks));

      for (const insertion of insertions) {
        const { imageName: instImageName, selectedBlockId, anchorText, relation, imageTag } = insertion;
        
        const blockIndex = currentBlocks.findIndex((b: any) => b.id === selectedBlockId);
        if (blockIndex === -1) {
          // Fallback if AI picked an invalid block ID
          continue;
        }

        const originalCode = currentBlocks[blockIndex].code || "";
        let modifiedCode = "";

        if (relation === "prepend") {
          modifiedCode = `${imageTag}\n\n${originalCode}`;
        } else if (relation === "append" || !anchorText) {
          modifiedCode = `${originalCode}\n\n${imageTag}`;
        } else {
          const index = originalCode.indexOf(anchorText);
          if (index !== -1) {
            if (relation === "before") {
              modifiedCode = originalCode.slice(0, index) + `${imageTag}\n\n` + originalCode.slice(index);
            } else {
              // relation === "after"
              const insertAt = index + anchorText.length;
              modifiedCode = originalCode.slice(0, insertAt) + `\n\n${imageTag}` + originalCode.slice(insertAt);
            }
          } else {
            // Fallback if anchorText is not found exactly: append to end
            modifiedCode = `${originalCode}\n\n${imageTag}`;
          }
        }

        // Save modification to our local blocks
        currentBlocks[blockIndex].code = modifiedCode;
      }

      // If insertions is empty or some error, ensure we fallback nicely
      if (insertions.length === 0 && imagesList.length > 0) {
        throw new Error("La IA no devolvió ninguna instrucción de inserción válida.");
      }

      res.json({
        modifiedBlocks: currentBlocks,
        explanations: []
      });

    } catch (error: any) {
      console.error("Error en /api/gemini/insert-image:", error);
      res.status(500).json({ error: error?.message || "Error interno al procesar la inserción con IA." });
    }
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
