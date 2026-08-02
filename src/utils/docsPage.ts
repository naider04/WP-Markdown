/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BibliographyItem } from '../types';
import { BASE_TOC_CSS } from './markdownCompiler';
import { toolbarHTML_Preview } from '../components/DocumentPreview';

/**
 * Fuentes bibliográficas de respaldo para la documentación. Si el usuario
 * modifica su bibliografía, estas claves garantizan que las citas del
 * documento predeterminado sigan resolviéndose en formato APA 7.
 */
export const DOCS_FALLBACK_BIBLIOGRAPHY: BibliographyItem[] = [
  {
    id: 'bib_docs_wp2025',
    key: 'wp2025',
    type: 'book',
    authors: 'Universidad Estatal de Milagro',
    year: '2025',
    title: 'Guía Metodológica para la Redacción de Trabajos Científicos',
    publisher: 'Editorial WP',
    url: 'https://www.wp.edu.ec',
  },
  {
    id: 'bib_docs_patino2024',
    key: 'patino2024',
    type: 'article',
    authors: 'Patiño, W.',
    year: '2024',
    title: 'Arquitecturas de Software Orientadas a Servicios en la Educación Superior',
    journal: 'Revista de Tecnología WP',
    volume: '15',
    issue: '2',
    pages: '45-58',
    url: 'https://ojs.wp.edu.ec',
  },
];

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Markdown image syntax: ![alt](src) */
const MD_IMAGE_SRC_RE = /!\[[^\]]*\]\(([^)\s"'<>]+)\)/g;
/** HTML src attributes: src="..." or src='...' */
const HTML_SRC_RE = /src=["']([^"']+)["']/gi;

/**
 * Descarga las imágenes de rutas relativas referenciadas en el contenido y las
 * incrusta como data URLs, para que la página de documentación sea autónoma.
 */
export async function embedContentImages(markdownText: string): Promise<string> {
  const srcs = new Set<string>();
  const collect = (re: RegExp) => {
    const local = new RegExp(re.source, re.flags);
    let match: RegExpExecArray | null;
    while ((match = local.exec(markdownText)) !== null) {
      const src = match[1];
      if (!src) continue;
      if (/^(data:|https?:|mailto:|#|\/preview\/)/i.test(src)) continue;
      srcs.add(src);
    }
  };
  collect(MD_IMAGE_SRC_RE);
  collect(HTML_SRC_RE);

  if (srcs.size === 0) return markdownText;

  const dataUrls = new Map<string, string>();
  await Promise.all(
    Array.from(srcs).map(async (src) => {
      try {
        const response = await fetch(src.startsWith('/') ? src : '/' + src);
        if (!response.ok) return;
        const blob = await response.blob();
        dataUrls.set(src, await blobToDataUrl(blob));
      } catch (err) {
        console.warn(`No se pudo incrustar la imagen "${src}" en la documentación:`, err);
      }
    })
  );

  if (dataUrls.size === 0) return markdownText;

  const replaceAll = (re: RegExp) => {
    const local = new RegExp(re.source, re.flags);
    return markdownText.replace(local, (match: string, src: string) => {
      const dataUrl = dataUrls.get(src);
      return dataUrl ? match.replace(src, dataUrl) : match;
    });
  };

  markdownText = replaceAll(MD_IMAGE_SRC_RE);
  markdownText = replaceAll(HTML_SRC_RE);
  return markdownText;
}

/**
 * Construye la página HTML autónoma de documentación a partir del cuerpo ya
 * compilado. Reutiliza los estilos APA 7 del editor (los predeterminados no se
 * modifican) y la barra flotante de la vista previa.
 */
export function buildDocsHtml(bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="es" data-wp-preview="v1">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Documentación del Editor WP Markdown</title>

  <script src="https://cdn.tailwindcss.com"></script>

  <!-- KaTeX CSS for mathematical symbol styling -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">

  <!-- PrismJS tomorrow dark theme for code blocks -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/themes/prism-tomorrow.min.css">

  <style>
    * {
      box-sizing: border-box;
    }

    body, html {
      margin: 0;
      padding: 0;
      background-color: #fafafa !important;
      font-family: "Inter", system-ui, -apple-system, sans-serif;
      text-rendering: optimizeLegibility;
      -webkit-font-smoothing: antialiased;
    }

    .wp-docs-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 32px;
      padding: 48px 24px;
      background-color: #fafafa !important;
    }

    .wp-docs-content {
      width: 100%;
      max-width: 794px;
      background-color: #ffffff !important;
      padding: 96px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
      margin-bottom: 48px;
    }

    .katex .frac-line {
      border-bottom-style: solid !important;
      border-bottom-width: 0.04em !important;
      border-bottom-color: currentColor !important;
      display: inline-block !important;
    }

    /* APA 7 Run-in (inline) Headings */
    .wp-document-content .apa-runin {
      display: inline !important;
      font-family: "Times New Roman", Times, Georgia, serif !important;
      font-size: 16px !important;
      color: #000000 !important;
      line-height: 1.8 !important;
    }

    .wp-document-content .apa-runin.apa-level1,
    .wp-document-content .apa-runin.apa-level2 {
      font-weight: bold !important;
    }

    .wp-document-content .apa-runin.apa-level3,
    .wp-document-content .apa-runin.apa-level5 {
      font-weight: bold !important;
      font-style: italic !important;
    }

    .wp-document-content .apa-runin.apa-level4 {
      font-weight: bold !important;
      padding-left: 0px !important;
    }

    .wp-document-content {
      font-family: "Times New Roman", Times, Georgia, serif !important;
      font-size: 16px !important;
      line-height: 200% !important;
      color: #000000 !important;
      text-align: left !important;
    }

    .wp-document-content h1 {
      font-family: "Times New Roman", Times, Georgia, serif !important;
      font-size: 16px !important;
      font-weight: bold !important;
      color: #000000 !important;
      text-transform: none !important;
      text-align: center !important;
      text-indent: 0px !important;
      margin-top: 0px !important;
      margin-bottom: 0px !important;
      line-height: 200% !important;
      padding-bottom: 0 !important;
      border-bottom: 0px none transparent !important;
      border-width: 0px !important;
      border-style: none !important;
    }

    .wp-document-content h2 {
      font-family: "Times New Roman", Times, Georgia, serif !important;
      font-size: 16px !important;
      font-weight: bold !important;
      color: #000000 !important;
      text-align: left !important;
      text-indent: 0px !important;
      margin-top: 0px !important;
      margin-bottom: 0px !important;
      line-height: 200% !important;
    }

    .wp-document-content h3 {
      font-family: "Times New Roman", Times, Georgia, serif !important;
      font-size: 16px !important;
      font-weight: bold !important;
      font-style: italic !important;
      color: #000000 !important;
      text-align: left !important;
      text-indent: 0px !important;
      margin-top: 0px !important;
      margin-bottom: 0px !important;
      line-height: 200% !important;
    }

    .wp-document-content h4 {
      font-family: "Times New Roman", Times, Georgia, serif !important;
      font-size: 16px !important;
      font-weight: bold !important;
      color: #000000 !important;
      text-align: left !important;
      text-indent: 0.5in !important;
      margin-top: 0px !important;
      margin-bottom: 0px !important;
      line-height: 200% !important;
    }

    .wp-document-content h5 {
      font-family: "Times New Roman", Times, Georgia, serif !important;
      font-size: 16px !important;
      font-weight: bold !important;
      font-style: italic !important;
      color: #000000 !important;
      text-align: left !important;
      text-indent: 0.5in !important;
      margin-top: 0px !important;
      margin-bottom: 0px !important;
      line-height: 200% !important;
    }

    .wp-document-content p {
      margin-top: 0 !important;
      margin-bottom: 0px !important;
      line-height: 200% !important;
      text-indent: 0.5in !important;
      text-align: left !important;
      border: 0px none transparent !important;
      border-width: 0px !important;
      border-style: none !important;
      outline: none !important;
      box-shadow: none !important;
    }

    .wp-document-content p:has(.apa-runin) {
      text-indent: 0px !important;
    }

    .wp-document-content ul:not(.toc-list) {
      list-style-type: disc !important;
      padding-left: 0.5in !important;
      margin-bottom: 12px !important;
    }

    .wp-document-content ul:not(.toc-list) li:not(.toc-item) {
      position: relative !important;
      margin-bottom: 6px !important;
      line-height: 1.8 !important;
    }

    .wp-document-content ul:not(.toc-list) li:not(.toc-item)::before {
      display: none;
      content: none;
    }

    .wp-document-content ol {
      list-style-type: decimal !important;
      padding-left: 0.5in !important;
      margin-bottom: 12px !important;
    }

    .wp-document-content ol li {
      margin-bottom: 6px !important;
      line-height: 1.8 !important;
    }

    .wp-document-content .note {
      border-left: 3px solid #000000 !important;
      background-color: #f8fafc !important;
      padding: 12px 14px !important;
      margin: 16px 0 !important;
      border-radius: 0 4px 4px 0 !important;
      font-size: 12px !important;
      line-height: 1.6 !important;
      color: #000000 !important;
    }

    .wp-document-content blockquote {
      border-left: none !important;
      background-color: transparent !important;
      padding: 0 !important;
      margin: 12px 0 12px 0.5in !important;
      font-style: normal !important;
      line-height: 1.8 !important;
      color: #000000 !important;
    }

    .wp-document-content figure {
      display: block !important;
      margin: 16px auto !important;
      border: 1px solid #e2e8f0 !important;
      background-color: #f8fafc !important;
      padding: 8px !important;
      border-radius: 4px !important;
      max-width: 100% !important;
      box-sizing: border-box !important;
    }

    .wp-document-content figcaption {
      font-family: "Inter", sans-serif !important;
      font-size: 10.5px !important;
      color: #64748b !important;
      margin-top: 8px !important;
      line-height: 1.4 !important;
      text-align: center !important;
      font-style: italic !important;
    }

    .wp-document-content img {
      max-width: 100% !important;
      height: auto !important;
      display: block !important;
      margin: 0 auto !important;
      border-radius: 2px !important;
    }

    .wp-document-content table {
      border-collapse: collapse !important;
      width: 100% !important;
      margin: 16px 0 !important;
      font-size: 14px !important;
    }

    .wp-document-content table th,
    .wp-document-content table td {
      border: 1px solid #cbd5e1 !important;
      padding: 6px 8px !important;
    }

    .wp-document-content table th {
      background-color: #f8fafc !important;
      font-weight: bold !important;
    }

    .wp-document-content pre {
      background-color: #f8fafc !important;
      border: 1px solid #cbd5e1 !important;
      color: #0f172a !important;
      padding: 12px 16px !important;
      margin: 16px 0 !important;
      border-radius: 6px !important;
      overflow-x: auto !important;
      line-height: 1.5 !important;
      text-indent: 0px !important;
      font-family: "Fira Code", "Courier New", Courier, monospace !important;
      font-size: 13px !important;
    }

    .wp-document-content pre code {
      color: #0f172a !important;
      background-color: transparent !important;
      padding: 0 !important;
      font-family: "Fira Code", "Courier New", Courier, monospace !important;
      font-size: 13px !important;
      text-indent: 0px !important;
    }

    .wp-document-content code:not(pre code) {
      font-family: "Fira Code", "Courier New", Courier, monospace !important;
      font-size: 12px !important;
      background-color: #f8fafc !important;
      color: #0f172a !important;
      padding: 2px 5px !important;
      border-radius: 4px !important;
      border: 1px solid #cbd5e1 !important;
      display: inline !important;
      text-indent: 0 !important;
      word-break: break-word !important;
      box-decoration-break: clone !important;
      -webkit-box-decoration-break: clone !important;
    }

    /* Bibliography styling */
    .wp-bibliography-item {
      padding-left: 0.5in !important;
      text-indent: -0.5in !important;
      line-height: 2.0 !important;
      font-size: 16px !important;
      font-family: 'Times New Roman', Times, serif !important;
      text-align: left !important;
      display: block !important;
    }

    .wp-bibliography-title {
      font-family: 'Times New Roman', Times, serif !important;
      font-size: 16px !important;
      font-weight: bold !important;
      text-align: center !important;
      margin-top: 24px !important;
      margin-bottom: 24px !important;
      display: block !important;
    }

    .cross-reference-link {
      color: #004080 !important;
      text-decoration: none !important;
      font-weight: 500 !important;
      border-bottom: 1px dashed #004080 !important;
    }

    .page-break {
      page-break-after: always !important;
      break-after: page !important;
      height: 0 !important;
    }

    ${BASE_TOC_CSS}

    @media print {
      #wp-academic-toolbar, .print\\:hidden, .print-hidden {
        display: none !important;
        opacity: 0 !important;
        visibility: hidden !important;
        height: 0 !important;
        width: 0 !important;
        overflow: hidden !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      body, html {
        background-color: #ffffff !important;
      }
      .wp-docs-container {
        padding: 0 !important;
        gap: 0 !important;
        display: block !important;
      }
      .wp-docs-content {
        box-shadow: none !important;
        border: none !important;
        margin: 0 !important;
        padding: 96px !important;
        max-width: 100% !important;
      }
      .page-break {
        page-break-after: always !important;
        break-after: page !important;
      }
      @page {
        margin: 0 !important;
        size: 8.5in 11in portrait;
      }
    }
  </style>
</head>
<body>
  ${toolbarHTML_Preview}

  <div class="wp-docs-container">
    <div class="wp-docs-content wp-document-content">
      ${bodyHtml}
    </div>
  </div>

  <script>
    document.addEventListener("DOMContentLoaded", function() {
      window.addEventListener('beforeprint', function() {
        var toolbar = document.getElementById('wp-academic-toolbar');
        if (toolbar) {
          toolbar.style.setProperty('display', 'none', 'important');
        }
      });
      window.addEventListener('afterprint', function() {
        var toolbar = document.getElementById('wp-academic-toolbar');
        if (toolbar) {
          toolbar.style.setProperty('display', 'flex', 'important');
        }
      });
    });
  </script>
</body>
</html>`;
}
