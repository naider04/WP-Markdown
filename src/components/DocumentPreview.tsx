/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useEffect } from 'react';
import { marked } from 'marked';
import katex from 'katex';
import { CoverConfig, PageSettings, UploadedFile, HTMLBlock, BibliographyItem } from '../types';
import CoverPage from './CoverPage';
import PageTemplate from './PageTemplate';
import { FileText, Layers, RefreshCw, ZoomIn, ZoomOut, FolderArchive, Maximize2, Minimize2, Copy, Check, ExternalLink } from 'lucide-react';

interface DocumentPreviewProps {
  cover: CoverConfig;
  settings: PageSettings;
  htmlContent: string;
  setPageCount: (cnt: number) => void;
  onExportZIP: () => void;
  isFullscreen: boolean;
  setIsFullscreen: (v: boolean) => void;
  uploadedFiles?: UploadedFile[];
  htmlBlocks?: HTMLBlock[];
  bibliography?: BibliographyItem[];
}

interface HeadingItem {
  text: string;
  page: number;
  level: number;
}

// Functional Block IFrame component with standard sandboxing
function FunctionalIframe({ code, blockId }: { code: string; blockId: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html lang="es">
        <head>
          <meta charset="UTF-8">
          <style>
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              width: 100% !important;
              height: 100% !important;
              overflow: hidden !important;
              background-color: transparent !important;
            }
          </style>
        </head>
        <body>
          ${code}
        </body>
      </html>
    `);
    doc.close();
  }, [code]);

  return (
    <iframe
      ref={iframeRef}
      title={`functional-block-${blockId}`}
      sandbox="allow-scripts allow-modals allow-same-origin"
      style={{
        width: '100%',
        height: '100%',
        border: 'none',
        overflow: 'hidden',
        display: 'block',
        flex: 1
      }}
      scrolling="no"
    />
  );
}

function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function parseTextAndRenderMath(text: string): string {
  let result = "";
  let index = 0;
  
  while (index < text.length) {
    let nearestIdx = -1;
    let delimType: 'double_dollar' | 'bracket' | 'single_dollar' | 'paren' | null = null;
    
    const doubleDollarIdx = text.indexOf('$$', index);
    const bracketIdx = text.indexOf('\\[', index);
    const parenIdx = text.indexOf('\\(', index);
    const singleDollarIdx = text.indexOf('$', index);
    
    let minIdx = Infinity;
    
    if (doubleDollarIdx !== -1 && doubleDollarIdx < minIdx) {
      minIdx = doubleDollarIdx;
      delimType = 'double_dollar';
    }
    if (bracketIdx !== -1 && bracketIdx < minIdx) {
      minIdx = bracketIdx;
      delimType = 'bracket';
    }
    if (parenIdx !== -1 && parenIdx < minIdx) {
      minIdx = parenIdx;
      delimType = 'paren';
    }
    if (singleDollarIdx !== -1 && singleDollarIdx < minIdx) {
      if (singleDollarIdx === doubleDollarIdx) {
        // Handled by double_dollar
      } else {
        const isEscaped = singleDollarIdx > 0 && text[singleDollarIdx - 1] === '\\';
        if (!isEscaped) {
          minIdx = singleDollarIdx;
          delimType = 'single_dollar';
        }
      }
    }
    
    if (delimType === null || minIdx === Infinity) {
      result += escapeHtml(text.slice(index));
      break;
    }
    
    result += escapeHtml(text.slice(index, minIdx));
    
    let closeIdx = -1;
    let mathContent = "";
    let isDisplay = false;
    let nextIndex = minIdx;
    
    if (delimType === 'double_dollar') {
      closeIdx = text.indexOf('$$', minIdx + 2);
      if (closeIdx !== -1) {
        mathContent = text.slice(minIdx + 2, closeIdx);
        isDisplay = true;
        nextIndex = closeIdx + 2;
      }
    } else if (delimType === 'bracket') {
      closeIdx = text.indexOf('\\]', minIdx + 2);
      if (closeIdx !== -1) {
        mathContent = text.slice(minIdx + 2, closeIdx);
        isDisplay = true;
        nextIndex = closeIdx + 2;
      }
    } else if (delimType === 'paren') {
      closeIdx = text.indexOf('\\)', minIdx + 2);
      if (closeIdx !== -1) {
        mathContent = text.slice(minIdx + 2, closeIdx);
        isDisplay = false;
        nextIndex = closeIdx + 2;
      }
    } else if (delimType === 'single_dollar') {
      closeIdx = text.indexOf('$', minIdx + 1);
      if (closeIdx !== -1) {
        mathContent = text.slice(minIdx + 1, closeIdx);
        isDisplay = false;
        nextIndex = closeIdx + 1;
      }
    }
    
    if (closeIdx === -1) {
      const step = (delimType === 'double_dollar' || delimType === 'bracket' || delimType === 'paren') ? 2 : 1;
      result += escapeHtml(text.slice(minIdx, minIdx + step));
      index = minIdx + step;
    } else {
      try {
        const rendered = katex.renderToString(mathContent, {
          displayMode: isDisplay,
          throwOnError: false
        });
        result += rendered;
      } catch (err) {
        result += `<span class="text-red-500 font-mono text-[10px]" title="${escapeHtml(String(err))}">[Math Error: ${escapeHtml(mathContent)}]</span>`;
      }
      index = nextIndex;
    }
  }
  
  return result;
}

function renderMathInHtml(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const parent = node.parentElement;
      if (parent) {
        const tagName = parent.tagName.toUpperCase();
        if (['CODE', 'PRE', 'SCRIPT', 'STYLE', 'TEXTAREA'].includes(tagName)) {
          return;
        }
        
        const text = node.nodeValue || '';
        if (text.includes('$') || text.includes('\\(') || text.includes('\\[') || text.includes('\\\\(') || text.includes('\\\\[')) {
          const renderedHtml = parseTextAndRenderMath(text);
          if (renderedHtml !== escapeHtml(text)) {
            const template = document.createElement('template');
            template.innerHTML = renderedHtml;
            const fragment = template.content;
            parent.replaceChild(fragment, node);
          }
        }
      }
      return;
    }
    
    const children = Array.from(node.childNodes);
    for (const child of children) {
      walk(child);
    }
  };
  
  walk(doc.body);
  return doc.body.innerHTML;
}

export default function DocumentPreview({
  cover,
  settings,
  htmlContent,
  setPageCount,
  onExportZIP,
  isFullscreen,
  setIsFullscreen,
  uploadedFiles = [],
  htmlBlocks = [],
  bibliography = [],
}: DocumentPreviewProps) {
  const hiddenMeasureRef = useRef<HTMLDivElement>(null);
  const [paginatedPages, setPaginatedPages] = useState<string[][]>([]);
  const [zoom, setZoom] = useState<number>(100);
  const [recalculating, setRecalculating] = useState<boolean>(false);
  const [dynamicHeadings, setDynamicHeadings] = useState<HeadingItem[]>([]);
  const [detectedOverflows, setDetectedOverflows] = useState<{
    id: string;
    type: 'ancho' | 'alto';
    tagName: string;
    pageNumber: number;
    measured: number;
    allowed: number;
    outerHTML?: string;
  }[]>([]);
  const [showOverflowPopover, setShowOverflowPopover] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [exportingPDF, setExportingPDF] = useState<boolean>(false);
  const [generatingPreview, setGeneratingPreview] = useState<boolean>(false);
  const [serverPreviewId, setServerPreviewId] = useState<string | null>(null);
  const [isSyncingServer, setIsSyncingServer] = useState<boolean>(false);
  const [previewMode, setPreviewMode] = useState<'paged' | 'server'>('server');

  const handleOpenPreview = async () => {
    const coverPage = document.getElementById('unemi-cover-page');
    const docPages = document.querySelectorAll('[name^="document-page-"]');

    if (!coverPage || docPages.length === 0) {
      alert('Por favor, espere a que el documento se compile en el visor principal.');
      return;
    }

    setGeneratingPreview(true);

    try {
      let pagesHTML = '';
      
      const coverClone = coverPage.cloneNode(true) as HTMLElement;
      coverClone.style.boxShadow = 'none';
      coverClone.style.border = 'none';
      coverClone.style.margin = '0 auto';
      pagesHTML += `<div class="print-page-boundary mb-8">${coverClone.outerHTML}</div>\n`;

      docPages.forEach((page) => {
        const pageClone = page.cloneNode(true) as HTMLElement;
        pageClone.style.boxShadow = 'none';
        pageClone.style.border = 'none';
        pageClone.style.margin = '0 auto';

        const guideOverlay = pageClone.querySelector('.absolute.inset-0.pointer-events-none');
        if (guideOverlay && (guideOverlay.innerHTML.includes('Guía:') || guideOverlay.innerHTML.includes('Márgenes'))) {
          guideOverlay.remove();
        }

        pagesHTML += `<div class="print-page-boundary mb-8">${pageClone.outerHTML}</div>\n`;
      });

      const isLetterSize = settings.pageSize === 'letter';
      const isA4 = settings.pageSize === 'a4';
      const isPortrait = (settings.orientation || 'portrait') === 'portrait';
      
      const paperWidth = isPortrait 
        ? (isLetterSize ? '816px' : isA4 ? '794px' : '630px')
        : (isLetterSize ? '1056px' : isA4 ? '1123px' : '1120px');
        
      const paperHeight = isPortrait 
        ? (isLetterSize ? '1056px' : isA4 ? '1123px' : '1120px')
        : (isLetterSize ? '816px' : isA4 ? '794px' : '630px');

      const topMargin = settings.marginTop !== undefined ? settings.marginTop : 96;
      const bottomMargin = settings.marginBottom !== undefined ? settings.marginBottom : 96;
      const leftMargin = settings.marginLeft !== undefined ? settings.marginLeft : 96;
      const rightMargin = settings.marginRight !== undefined ? settings.marginRight : 96;

      const sanitizeCSS = (rawCss: string) => {
        if (!rawCss) return '';
        return rawCss
          .replace(/<\/?style[^>]*>/gi, '')
          .replace(/<\/script>/gi, '');
      };

      const getGraphicalCSS = () => {
        let css = '';
        
        if (settings.h1Size || settings.h1Font || settings.h1Align || settings.h1LineHeight || settings.h1Indent !== undefined || settings.h1Bold !== undefined || settings.h1Italic !== undefined || settings.h1Color) {
          css += `\n.unemi-document-content h1 {`;
          if (settings.h1Size) css += ` font-size: ${settings.h1Size} !important;`;
          if (settings.h1Font) css += ` font-family: "${settings.h1Font}", sans-serif !important;`;
          if (settings.h1Align) css += ` text-align: ${settings.h1Align} !important;`;
          if (settings.h1LineHeight) css += ` line-height: ${settings.h1LineHeight} !important;`;
          if (settings.h1Indent) css += ` text-indent: ${settings.h1Indent} !important;`;
          if (settings.h1Bold !== undefined) css += ` font-weight: ${settings.h1Bold ? 'bold' : 'normal'} !important;`;
          if (settings.h1Italic !== undefined) css += ` font-style: ${settings.h1Italic ? 'italic' : 'normal'} !important;`;
          if (settings.h1Color) css += ` color: ${settings.h1Color} !important;`;
          css += ` }`;
        }

        if (settings.h2Size || settings.h2Font || settings.h2Align || settings.h2LineHeight || settings.h2Indent !== undefined || settings.h2Bold !== undefined || settings.h2Italic !== undefined || settings.h2Color) {
          css += `\n.unemi-document-content h2 {`;
          if (settings.h2Size) css += ` font-size: ${settings.h2Size} !important;`;
          if (settings.h2Font) css += ` font-family: "${settings.h2Font}", sans-serif !important;`;
          if (settings.h2Align) css += ` text-align: ${settings.h2Align} !important;`;
          if (settings.h2LineHeight) css += ` line-height: ${settings.h2LineHeight} !important;`;
          if (settings.h2Indent) css += ` text-indent: ${settings.h2Indent} !important;`;
          if (settings.h2Bold !== undefined) css += ` font-weight: ${settings.h2Bold ? 'bold' : 'normal'} !important;`;
          if (settings.h2Italic !== undefined) css += ` font-style: ${settings.h2Italic ? 'italic' : 'normal'} !important;`;
          if (settings.h2Color) css += ` color: ${settings.h2Color} !important;`;
          css += ` }`;
        }

        if (settings.pSize || settings.pFont || settings.pAlign || settings.pLineHeight || settings.pIndent !== undefined || settings.pBold !== undefined || settings.pItalic !== undefined || settings.pColor) {
          css += `\n.unemi-document-content, .unemi-document-content p, .unemi-document-content div:not(.unemi-academic-header):not(.unemi-academic-footer):not(.toc-container):not(.note):not(.math-expr) {`;
          if (settings.pSize) css += ` font-size: ${settings.pSize} !important;`;
          if (settings.pFont) css += ` font-family: "${settings.pFont}", sans-serif !important;`;
          if (settings.pAlign) css += ` text-align: ${settings.pAlign} !important;`;
          if (settings.pLineHeight) css += ` line-height: ${settings.pLineHeight} !important;`;
          if (settings.pIndent) css += ` text-indent: ${settings.pIndent} !important;`;
          if (settings.pBold !== undefined) css += ` font-weight: ${settings.pBold ? 'bold' : 'normal'} !important;`;
          if (settings.pItalic !== undefined) css += ` font-style: ${settings.pItalic ? 'italic' : 'normal'} !important;`;
          if (settings.pColor) css += ` color: ${settings.pColor} !important;`;
          css += ` }`;
        }

        if (settings.tableFontSize || settings.tableHeaderBg || settings.tableHeaderColor || settings.tableBorderColor || settings.tableCellPadding || settings.tableStriped || settings.tableBorderWidth) {
          css += `\n/* Table Formatting Rules */`;
          css += `\n.unemi-document-content table {`;
          css += `  word-wrap: break-word !important;`;
          css += `  border-collapse: collapse !important;`;
          if (settings.tableFontSize) css += ` font-size: ${settings.tableFontSize} !important;`;
          if (settings.tableBorderColor) css += ` border-color: ${settings.tableBorderColor} !important;`;
          css += ` }`;

          css += `\n.unemi-document-content table th, .unemi-document-content table td {`;
          if (settings.tableCellPadding) {
            css += ` padding: ${settings.tableCellPadding} !important;`;
          }
          if (settings.tableBorderColor) {
            css += ` border-color: ${settings.tableBorderColor} !important;`;
          }
          if (settings.tableBorderWidth) {
            css += ` border-width: ${settings.tableBorderWidth} !important;`;
            css += ` border-style: solid !important;`;
          }
          css += ` }`;

          css += `\n.unemi-document-content table th, .unemi-document-content table thead tr, .unemi-document-content table tr[bgcolor] {`;
          if (settings.tableHeaderBg) css += ` background-color: ${settings.tableHeaderBg} !important;`;
          if (settings.tableHeaderColor) css += ` color: ${settings.tableHeaderColor} !important;`;
          css += ` }`;

          if (settings.tableStriped) {
            css += `\n.unemi-document-content table tbody tr:nth-child(even) {`;
            css += ` background-color: rgba(0, 0, 0, 0.03) !important;`;
            css += ` }`;
          }
        }

        return css;
      };

      const cleanHTML = `<!DOCTYPE html>
<html lang="es">
<head>
  <!-- PREVIEW_MODE_V1 -->
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${cover.title || 'Plantilla de Documento UNEMI'}</title>
  
  <script src="https://cdn.tailwindcss.com"></script>
  
  <!-- KaTeX CSS for mathematical symbol styling -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">
 
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Space+Grotesk:wght@400;500;600;700&family=Fira+Code:wght@400;500&display=swap');
    
    * {
      box-sizing: border-box;
    }
    
    body, html {
      margin: 0;
      padding: 0;
      background-color: #f1f5f9;
      font-family: "Inter", system-ui, -apple-system, sans-serif;
      text-rendering: optimizeLegibility;
      -webkit-font-smoothing: antialiased;
    }
    
    .document-rendered-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 32px;
      padding: 48px 24px;
    }

    div[name^="document-page-"] {
      position: relative !important;
      background-color: #ffffff !important;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1) !important;
      border: 1px solid #e2e8f0 !important;
      padding-top: ${topMargin}px !important;
      padding-bottom: ${bottomMargin}px !important;
      padding-left: ${leftMargin}px !important;
      padding-right: ${rightMargin}px !important;
      box-sizing: border-box !important;
      display: flex !important;
      flex-direction: column !important;
      justify-content: space-between !important;
      overflow: hidden !important;
      flex-shrink: 0 !important;
      width: ${paperWidth} !important;
      height: ${paperHeight} !important;
    }

    #unemi-cover-page {
      position: relative !important;
      background-color: #ffffff !important;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1) !important;
      border: 1px solid #e2e8f0 !important;
      padding: 0 !important;
      box-sizing: border-box !important;
      display: flex !important;
      flex-direction: column !important;
      justify-content: space-between !important;
      overflow: hidden !important;
      flex-shrink: 0 !important;
      width: ${paperWidth} !important;
      height: ${paperHeight} !important;
    }

    .absolute { position: absolute !important; }
    
    .unemi-document-content {
      font-family: "Times New Roman", Times, Georgia, serif !important;
      font-size: 16px !important;
      line-height: 1.8 !important;
      color: #000000 !important;
      text-align: left !important;
    }

    .unemi-document-content h1 {
      font-family: "Times New Roman", Times, Georgia, serif !important;
      font-size: 16px !important;
      font-weight: bold !important;
      color: #000000 !important;
      text-transform: none !important;
      text-align: center !important;
      margin-top: 24px !important;
      margin-bottom: 12px !important;
      padding-bottom: 0 !important;
      border-bottom: none !important;
      position: relative !important;
    }

    .unemi-document-content h1::after {
      display: none !important;
      content: none !important;
    }

    .unemi-document-content h2 {
      font-family: "Times New Roman", Times, Georgia, serif !important;
      font-size: 16px !important;
      font-weight: bold !important;
      color: #000000 !important;
      text-align: left !important;
      margin-top: 18px !important;
      margin-bottom: 8px !important;
    }

    .unemi-document-content h3 {
      font-family: "Times New Roman", Times, Georgia, serif !important;
      font-size: 16px !important;
      font-weight: bold !important;
      font-style: italic !important;
      color: #000000 !important;
      text-align: left !important;
      margin-top: 12px !important;
      margin-bottom: 6px !important;
    }

    .unemi-document-content h4 {
      font-family: "Times New Roman", Times, Georgia, serif !important;
      font-size: 16px !important;
      font-weight: bold !important;
      color: #000000 !important;
      text-align: left !important;
      text-indent: 0.5in !important;
      margin-top: 10px !important;
      margin-bottom: 4px !important;
    }

    .unemi-document-content h5 {
      font-family: "Times New Roman", Times, Georgia, serif !important;
      font-size: 16px !important;
      font-weight: bold !important;
      font-style: italic !important;
      color: #000000 !important;
      text-align: left !important;
      text-indent: 0.5in !important;
      margin-top: 10px !important;
      margin-bottom: 4px !important;
    }

    .unemi-document-content p {
      margin-top: 0 !important;
      margin-bottom: 12px !important;
      line-height: 1.8 !important;
    }

    .unemi-document-content ul {
      list-style-type: disc !important;
      padding-left: 0.5in !important;
      margin-bottom: 12px !important;
    }

    .unemi-document-content ul li {
      position: relative !important;
      margin-bottom: 6px !important;
      line-height: 1.8 !important;
    }

    .unemi-document-content ul li::before {
      display: none !important;
      content: none !important;
    }

    .unemi-document-content ol {
      list-style-type: decimal !important;
      padding-left: 0.5in !important;
      margin-bottom: 12px !important;
    }

    .unemi-document-content ol li {
      margin-bottom: 6px !important;
      line-height: 1.8 !important;
    }

    .unemi-document-content .note {
      border-left: 3px solid #000000 !important;
      background-color: #f8fafc !important;
      padding: 12px 14px !important;
      margin: 16px 0 !important;
      border-radius: 0 4px 4px 0 !important;
      font-size: 12px !important;
      line-height: 1.6 !important;
      color: #000000 !important;
    }

    .unemi-document-content blockquote {
      border-left: none !important;
      background-color: transparent !important;
      padding: 0 !important;
      margin: 12px 0 12px 0.5in !important;
      font-style: normal !important;
      line-height: 1.8 !important;
      color: #000000 !important;
    }

    .unemi-document-content figure {
      display: block !important;
      margin: 16px auto !important;
      border: 1px solid #e2e8f0 !important;
      background-color: #f8fafc !important;
      padding: 8px !important;
      border-radius: 4px !important;
      max-width: 100% !important;
      box-sizing: border-box !important;
    }

    .unemi-document-content figure.mw-default-size,
    .unemi-document-content figure[class*="thumb"] {
      float: right !important;
      margin-left: 18px !important;
      margin-top: 4px !important;
      margin-bottom: 12px !important;
      width: 220px !important;
    }

    .unemi-document-content figcaption {
      font-family: "Inter", sans-serif !important;
      font-size: 10.5px !important;
      color: #64748b !important;
      margin-top: 8px !important;
      line-height: 1.4 !important;
      text-align: center !important;
      font-style: italic !important;
    }

    .unemi-document-content img,
    .unemi-document-content .mw-file-element {
      max-width: 100% !important;
      height: auto !important;
      display: block !important;
      margin: 0 auto !important;
      border-radius: 2px !important;
    }

    .unemi-academic-header {
      position: absolute !important;
      top: ${Math.max(10, topMargin - 60)}px !important;
      left: ${leftMargin}px !important;
      right: ${rightMargin}px !important;
      height: 50px !important;
      display: flex !important;
      flex-direction: column !important;
      justify-content: flex-end !important;
      pointer-events: none !important;
      user-select: none !important;
      z-index: 10 !important;
    }
    
    .unemi-academic-footer {
      position: absolute !important;
      bottom: ${Math.max(10, bottomMargin - 50)}px !important;
      left: ${leftMargin}px !important;
      right: ${rightMargin}px !important;
      height: 40px !important;
      display: flex !important;
      flex-direction: column !important;
      justify-content: flex-start !important;
      pointer-events: none !important;
      user-select: none !important;
      z-index: 10 !important;
    }

    @media print {
      #unemi-academic-toolbar, .print\:hidden, .print-hidden {
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
      .document-rendered-container {
        padding: 0 !important;
        gap: 0 !important;
        display: block !important;
      }
      div[name^="document-page-"] {
        box-shadow: none !important;
        border: none !important;
        page-break-after: always !important;
        break-after: page !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        margin: 0 !important;
        padding-top: ${topMargin}px !important;
        padding-bottom: ${bottomMargin}px !important;
        padding-left: ${leftMargin}px !important;
        padding-right: ${rightMargin}px !important;
      }
      #unemi-cover-page {
        box-shadow: none !important;
        border: none !important;
        page-break-after: always !important;
        break-after: page !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      @page {
        margin: 0 !important;
        size: ${settings.pageSize === 'letter' ? '8.5in 11in' : settings.pageSize === 'a4' ? '210mm 297mm' : '297mm 167.06mm'} ${isPortrait ? 'portrait' : 'landscape'};
      }
    }
    
    ${sanitizeCSS(settings.blockStyleTitles || '')}
    ${sanitizeCSS(settings.blockStyleHeader || '')}
    ${sanitizeCSS(settings.blockStyleFooter || '')}
    ${sanitizeCSS(settings.blockStylePageNum || '')}
    ${sanitizeCSS(settings.blockStyleTOC || '')}
    ${sanitizeCSS(settings.tableCustomCss || '')}
    ${getGraphicalCSS()}
    ${sanitizeCSS(settings.customAddedCss || '')}
    
    ${settings.autoNumberHeadings ? `
    body, .document-rendered-container {
      counter-reset: unemi-h1-counter !important;
    }
    .unemi-document-content h1 {
      counter-reset: unemi-h2-counter !important;
      counter-increment: unemi-h1-counter !important;
    }
    .unemi-document-content h1::before {
      content: counter(unemi-h1-counter) ". " !important;
    }
    .unemi-document-content h2 {
      counter-reset: unemi-h3-counter !important;
      counter-increment: unemi-h2-counter !important;
    }
    .unemi-document-content h2::before {
      content: counter(unemi-h1-counter) "." counter(unemi-h2-counter) " " !important;
    }
    .unemi-document-content h3 {
      counter-increment: unemi-h3-counter !important;
    }
    .unemi-document-content h3::before {
      content: counter(unemi-h1-counter) "." counter(unemi-h2-counter) "." counter(unemi-h3-counter) " " !important;
    }
    ` : ''}
  </style>
</head>
<body>
  <!-- Floating Academic Toolbar (Omitted when printing) -->
  <div id="unemi-academic-toolbar" class="fixed top-4 right-4 z-50 print:hidden flex items-center gap-3 bg-[#004080] text-white px-4 py-2 border-2 border-[#FF6600]/80 rounded-xl shadow-2xl">
    <span class="font-bold text-xs uppercase tracking-wider text-slate-100 flex items-center gap-1.5">
      <span class="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
      Vista Previa
    </span>
    <div class="h-4 w-[1px] bg-white/20"></div>
    <button id="unemi-start-presentation" class="bg-[#FF6600] hover:bg-[#ff8533] text-white font-bold text-xs px-3 py-1.5 rounded-lg border border-[#FF6600] cursor-pointer active:scale-95 transition-all flex items-center gap-1">
      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <polygon points="5 3 19 12 5 21 5 3" fill="currentColor"></polygon>
      </svg>
      Iniciar Presentación
    </button>
    <button onclick="window.print()" class="bg-slate-800 text-white font-semibold text-xs px-2.5 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-700 active:scale-95 transition-all flex items-center gap-1 cursor-pointer">
      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="width: 14px; height: 14px;">
        <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2m-2-5H8v8h8v-8z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
      </svg>
      Imprimir
    </button>
  </div>

  <div class="document-rendered-container">
    ${pagesHTML}
  </div>

  <!-- Presentation Mode Logic -->
  <script>
    document.addEventListener("DOMContentLoaded", function() {
      var inPresentationMode = false;
      var currentPageIndex = 0;
      var pages = Array.from(document.querySelectorAll('#unemi-cover-page, div[name^="document-page-"]'));
      var container = document.querySelector('.document-rendered-container');
      var hudTimeout = null;
      var presentationScale = 1.0;

      function updatePageVisibility() {
        if (!inPresentationMode) return;
        var viewportWidth = window.innerWidth;
        var viewportHeight = window.innerHeight;

        pages.forEach(function(page, idx) {
          if (idx === currentPageIndex) {
            page.style.setProperty('display', 'flex', 'important');
            var pageWidth = page.offsetWidth || 816;
            var pageHeight = page.offsetHeight || 1056;

            var maxWidth = viewportWidth * 0.94;
            var maxHeight = viewportHeight * 0.94;

            var scaleX = maxWidth / pageWidth;
            var scaleY = maxHeight / pageHeight;

            var fitScale = Math.min(scaleX, scaleY);

            page.style.setProperty('transform', 'scale(' + (fitScale * presentationScale) + ')', 'important');
            page.style.setProperty('transform-origin', 'center center', 'important');
            page.style.setProperty('margin', '0 auto', 'important');
          } else {
            page.style.setProperty('display', 'none', 'important');
          }
        });
        window.scrollTo({ top: 0, left: 0 });
        if (container) {
          container.scrollTop = 0;
          container.scrollLeft = 0;
        }
      }

      function startPresentation() {
        inPresentationMode = true;
        currentPageIndex = 0;
        presentationScale = 1.0;
        
        var toolbar = document.getElementById('unemi-academic-toolbar');
        if (toolbar) toolbar.style.setProperty('display', 'none', 'important');
        
        container.classList.add('bg-slate-950', 'w-screen', 'h-screen', 'fixed', 'inset-0', 'z-40', 'overflow-hidden', 'flex', 'justify-center', 'items-center', 'p-4');
        
        container.style.setProperty('gap', '0px', 'important');
        container.style.setProperty('padding', '0px', 'important');
        container.style.setProperty('display', 'flex', 'important');
        container.style.setProperty('align-items', 'center', 'important');
        container.style.setProperty('justify-content', 'center', 'important');
        
        try {
          var de = document.documentElement;
          if (de.requestFullscreen) {
            de.requestFullscreen();
          } else if (de.webkitRequestFullscreen) {
            de.webkitRequestFullscreen();
          } else if (de.msRequestFullscreen) {
            de.msRequestFullscreen();
          }
        } catch (err) {
          console.error("Fullscreen request failed:", err);
        }
        
        var hud = document.getElementById('unemi-presentation-hud');
        if (!hud) {
          hud = document.createElement('div');
          hud.id = 'unemi-presentation-hud';
          hud.style.cssText = 'position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%); background: rgba(15, 23, 42, 0.95); border: 1.5px solid #FF6600; padding: 12px 24px; border-radius: 12px; color: #ffffff; font-family: "Inter", system-ui, sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.75px; text-transform: uppercase; display: flex; align-items: center; gap: 18px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); z-index: 10000; transition: opacity 0.5s ease; pointer-events: none;';
          hud.innerHTML = \`
            <span style="display: flex; align-items: center; gap: 6px;"><span style="color: #FF6600; font-family: monospace;">[CLICK / ESPACIO / &rarr;]</span> Siguiente</span>
            <span style="opacity: 0.3;">|</span>
            <span style="display: flex; align-items: center; gap: 6px;"><span style="color: #FF6600; font-family: monospace;">[&larr;]</span> Anterior</span>
            <span style="opacity: 0.3;">|</span>
            <span style="display: flex; align-items: center; gap: 6px;"><span style="color: #FF6600; font-family: monospace;">[RUEDA / PINCH]</span> Zoom</span>
            <span style="opacity: 0.3;">|</span>
            <span style="display: flex; align-items: center; gap: 6px;"><span style="color: #FF6600; font-family: monospace;">[ESC]</span> Salir</span>
          \`;
          document.body.appendChild(hud);
        }
        hud.style.opacity = '1';
        
        if (hudTimeout) clearTimeout(hudTimeout);
        hudTimeout = setTimeout(function() {
          hud.style.opacity = '0';
        }, 3000);

        updatePageVisibility();
      }

      function stopPresentation() {
        inPresentationMode = false;
        presentationScale = 1.0;
        
        try {
          if (document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement) {
            if (document.exitFullscreen) {
              document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
              document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) {
              document.msExitFullscreen();
            }
          }
        } catch (err) {
          console.error("Fullscreen exit failed:", err);
        }
        
        var toolbar = document.getElementById('unemi-academic-toolbar');
        if (toolbar) toolbar.style.setProperty('display', 'flex', 'important');
        
        var hud = document.getElementById('unemi-presentation-hud');
        if (hud) hud.style.opacity = '0';
        
        pages.forEach(function(page) {
          page.style.removeProperty('display');
          page.style.removeProperty('transform');
          page.style.removeProperty('transform-origin');
          page.style.removeProperty('margin');
        });
        
        container.style.removeProperty('gap');
        container.style.removeProperty('padding');
        container.style.removeProperty('display');
        container.style.removeProperty('align-items');
        container.style.removeProperty('justify-content');
        
        container.classList.remove('bg-slate-950', 'w-screen', 'h-screen', 'fixed', 'inset-0', 'z-40', 'overflow-hidden', 'flex', 'justify-center', 'items-center', 'p-4');
      }

      function nextPage() {
        if (currentPageIndex < pages.length - 1) {
          currentPageIndex++;
          updatePageVisibility();
        }
      }

      function prevPage() {
        if (currentPageIndex > 0) {
          currentPageIndex--;
          updatePageVisibility();
        }
      }

      var startBtn = document.getElementById('unemi-start-presentation');
      if (startBtn) startBtn.addEventListener('click', startPresentation);

      window.addEventListener('click', function(e) {
        if (!inPresentationMode) return;
        if (e.target === container || e.target === document.documentElement || e.target === document.body) {
          nextPage();
        }
      });

      window.addEventListener('beforeprint', function() {
        var toolbar = document.getElementById('unemi-academic-toolbar');
        if (toolbar) {
          toolbar.style.setProperty('display', 'none', 'important');
        }
      });
      window.addEventListener('afterprint', function() {
        var toolbar = document.getElementById('unemi-academic-toolbar');
        if (toolbar && !inPresentationMode) {
          toolbar.style.setProperty('display', 'flex', 'important');
        }
      });

      window.addEventListener('wheel', function(e) {
        if (!inPresentationMode) return;
        e.preventDefault();
        var delta = -e.deltaY;
        var baseFactor = e.ctrlKey ? 0.0008 : 0.0003;
        var scaleChange = delta * baseFactor;
        scaleChange = Math.min(Math.max(scaleChange, -0.05), 0.05);
        presentationScale = Math.min(Math.max(presentationScale + scaleChange, 0.3), 4.0);
        updatePageVisibility();
      }, { passive: false });

      var initialTouchDist = null;
      var startPinchScale = 1.0;

      function getTouchDistance(touches) {
        var dx = touches[0].clientX - touches[1].clientX;
        var dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
      }

      window.addEventListener('touchstart', function(e) {
        if (!inPresentationMode) return;
        if (e.touches.length === 2) {
          initialTouchDist = getTouchDistance(e.touches);
          startPinchScale = presentationScale;
          e.preventDefault();
        }
      }, { passive: false });

      window.addEventListener('touchmove', function(e) {
        if (!inPresentationMode) return;
        if (e.touches.length === 2 && initialTouchDist !== null) {
          e.preventDefault();
          var dist = getTouchDistance(e.touches);
          var ratio = dist / initialTouchDist;
          var smoothRatio = 1.0 + (ratio - 1.0) * 0.15;
          presentationScale = Math.min(Math.max(startPinchScale * smoothRatio, 0.3), 4.0);
          updatePageVisibility();
        }
      }, { passive: false });

      window.addEventListener('touchend', function(e) {
        if (!inPresentationMode) return;
        if (e.touches.length < 2) {
          initialTouchDist = null;
        }
      });

      window.addEventListener('keydown', function(e) {
        if (!inPresentationMode) return;
        if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') {
          nextPage();
          e.preventDefault();
        } else if (e.key === 'ArrowLeft' || e.key === 'Backspace') {
          prevPage();
          e.preventDefault();
        } else if (e.key === 'Escape') {
          stopPresentation();
          e.preventDefault();
        }
      });

      function onFullscreenChange() {
        var isFS = document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement;
        if (!isFS && inPresentationMode) {
          stopPresentation();
        }
      }
      document.addEventListener('fullscreenchange', onFullscreenChange);
      document.addEventListener('webkitfullscreenchange', onFullscreenChange);
      document.addEventListener('msfullscreenchange', onFullscreenChange);

      window.addEventListener('resize', function() {
        if (inPresentationMode) {
          updatePageVisibility();
        }
      });

      function syncIframes() {
        pages.forEach(function(page, idx) {
          var blocks = page.querySelectorAll('.unemi-functional-block');
          blocks.forEach(function(block) {
            var template = block.querySelector('.unemi-functional-template');
            if (!template) return;
            
            var isPageActive = !inPresentationMode || (idx === currentPageIndex);
            var existingIframe = block.querySelector('iframe');
            
            if (isPageActive) {
              var srcDocContent = '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>html, body { margin: 0 !important; padding: 0 !important; width: 100% !important; height: 100% !important; overflow: hidden !important; background-color: transparent !important; }</style></head><body>' + template.innerHTML + '</body></html>';
              
              if (!existingIframe) {
                var iframe = document.createElement('iframe');
                iframe.title = 'functional-block-' + block.getAttribute('data-block-id');
                iframe.setAttribute('sandbox', 'allow-scripts allow-modals allow-same-origin');
                iframe.style.cssText = 'width: 100%; height: 100%; border: none; overflow: hidden; display: block; flex: 1;';
                iframe.setAttribute('scrolling', 'no');
                iframe.srcdoc = srcDocContent;
                block.appendChild(iframe);
              } else {
                if (existingIframe.srcdoc !== srcDocContent) {
                  existingIframe.srcdoc = srcDocContent;
                }
              }
            } else {
              if (existingIframe) {
                existingIframe.remove();
              }
            }
          });
        });
      }

      var originalUpdatePageVisibility = updatePageVisibility;
      updatePageVisibility = function() {
        originalUpdatePageVisibility();
        syncIframes();
      };

      var originalStopPresentation = stopPresentation;
      stopPresentation = function() {
        originalStopPresentation();
        syncIframes();
      };

      syncIframes();
    });
  </script>
</body>
</html>`;

      let processedHTML = cleanHTML
        .replace(/src="\/\//g, 'src="https://')
        .replace(/srcset="\/\//g, 'srcset="https://')
        .replace(/href="\/\//g, 'href="https://');

      const response = await fetch('/api/save-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: processedHTML }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.id) {
          window.open(`/preview/${data.id}`, '_blank');
        } else {
          alert('Error de servidor al compilar la vista previa.');
        }
      } else {
        alert('Hubo un error al establecer la conexión con el servidor de vistas previas.');
      }

    } catch (err) {
      console.error(err);
      alert('Error de red al establecer conexión con el servidor.');
    } finally {
      setGeneratingPreview(false);
    }
  };

  const handleDownloadPDF = async () => {
    setExportingPDF(true);
    try {
      // 1. Cargar la librería html2pdf.js desde una CDN segura de forma asíncrona
      const html2pdf = await new Promise<any>((resolve, reject) => {
        if ((window as any).html2pdf) {
          resolve((window as any).html2pdf);
          return;
        }
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
        script.integrity = 'sha512-GsLlZN/3F2ErC5IfS5QtgpiJtWd63O9aKPz6DGIq5vVvgh93cegnzZ6cnZ3ZSXYaluaFTo6ffW6F9pOOALy66w==';
        script.crossOrigin = 'anonymous';
        script.onload = () => resolve((window as any).html2pdf);
        script.onerror = (e) => reject(new Error('No se pudo cargar la librería de compilación PDF'));
        document.head.appendChild(script);
      });

      // 2. Obtener los elementos de portada y páginas del DOM actual
      const coverPage = document.getElementById('unemi-cover-page');
      const docPages = document.querySelectorAll('[name^="document-page-"]');

      if (!coverPage || docPages.length === 0) {
        alert('Por favor, espere a que el documento se compile en el visor.');
        return;
      }

      // Creación del contenedor temporal para el renderizado del PDF fuera de la vista general
      const tempWrapper = document.createElement('div');
      tempWrapper.style.position = 'absolute';
      tempWrapper.style.left = '-9999px';
      tempWrapper.style.top = '-9999px';
      tempWrapper.style.width = 'auto';
      tempWrapper.style.height = 'auto';
      tempWrapper.style.display = 'flex';
      tempWrapper.style.flexDirection = 'column';
      tempWrapper.style.gap = '0px';

      // Clonamos y saneamos la portada para el PDF
      const coverClone = coverPage.cloneNode(true) as HTMLElement;
      coverClone.style.boxShadow = 'none';
      coverClone.style.border = 'none';
      coverClone.style.margin = '0 auto';
      coverClone.style.setProperty('page-break-after', 'always', 'important');
      coverClone.style.setProperty('break-after', 'page', 'important');
      tempWrapper.appendChild(coverClone);

      // Clonamos y saneamos cada una de las páginas individuales
      docPages.forEach((page, idx) => {
        const pageClone = page.cloneNode(true) as HTMLElement;
        pageClone.style.boxShadow = 'none';
        pageClone.style.border = 'none';
        pageClone.style.margin = '0 auto';

        // Si existen guías dashed de márgenes activas en el clon, las removemos
        const guideOverlay = pageClone.querySelector('.absolute.inset-0.pointer-events-none');
        if (guideOverlay && guideOverlay.innerHTML.includes('Márgenes T:')) {
          guideOverlay.remove();
        }

        if (idx < docPages.length - 1) {
          pageClone.style.setProperty('page-break-after', 'always', 'important');
          pageClone.style.setProperty('break-after', 'page', 'important');
        }
        tempWrapper.appendChild(pageClone);
      });

      document.body.appendChild(tempWrapper);

      // 3. Configuración de dimensiones y formato según el tipo de papel
      let formatSize: any = 'letter';
      if (settings.pageSize === 'a4') {
        formatSize = 'a4';
      } else if (settings.pageSize === '16:9') {
        // En una escala de milímetros con relación de aspecto 16:9 estándar (Landscape 16:9)
        formatSize = isPortrait ? [167.06, 297] : [297, 167.06];
      }

      const cleanTitle = (cover.title || 'documento_unemi')
        .slice(0, 30)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_');

      const options = {
        margin: 0,
        filename: `${cleanTitle}_perfecto.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2, // Escala de rendering en alta densidad (2x) para nitidez excepcional
          useCORS: true,
          logging: false
        },
        jsPDF: {
          unit: 'mm',
          format: formatSize,
          orientation: isPortrait ? 'portrait' : 'landscape'
        }
      };

      // 4. Compilar a PDF y ejecutar descarga nativa
      await html2pdf().from(tempWrapper).set(options).save();

      // Limpieza del DOM
      document.body.removeChild(tempWrapper);

    } catch (err) {
      console.error('Error durante la exportación directa a PDF:', err);
      alert('Hubo un error al compilar el PDF de forma directa. Pruebe descargando el archivo ZIP.');
    } finally {
      setExportingPDF(false);
    }
  };

  const resolvedHtmlContent = React.useMemo(() => {
    // 1. Compile blocks (HTML vs Markdown)
    let selectHtml = "";
    if (htmlBlocks && htmlBlocks.length > 0) {
      selectHtml = htmlBlocks.map(b => {
        if (b.isMarkdown) {
          return String(marked.parse(b.code));
        }
        return b.code;
      }).join('\n\n');
    } else {
      selectHtml = htmlContent;
    }

    // 2. Resolve image uploads
    if (uploadedFiles && uploadedFiles.length > 0) {
      uploadedFiles.forEach((file) => {
        const escapedName = file.name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regex = new RegExp(`src=["'](?:[^"']*/)?${escapedName}["']`, 'gi');
        selectHtml = selectHtml.replace(regex, `src="${file.dataUrl}"`);
      });
    }

    // Helper to get APA in-text authors' last names
    function getAPALastNames(authorsStr: string): string {
      const clean = authorsStr.trim();
      if (!clean) return 'Anon.';
      
      // If it's institutional (no commas, and more than 3 words)
      if (!clean.includes(',') && clean.split(' ').length > 3) {
        return clean;
      }
      
      const individualAuthors = clean.split(/\s+&\s+|\s+y\s+|;\s*/);
      const lastNames: string[] = [];
      
      for (const author of individualAuthors) {
        const commaIdx = author.indexOf(',');
        if (commaIdx !== -1) {
          lastNames.push(author.substring(0, commaIdx).trim());
        } else {
          const words = author.trim().split(/\s+/);
          if (words.length > 0) {
            lastNames.push(words[words.length - 1]); // fallback to last word
          }
        }
      }
      
      if (lastNames.length === 0) return clean;
      if (lastNames.length === 1) return lastNames[0];
      if (lastNames.length === 2) return `${lastNames[0]} & ${lastNames[1]}`;
      return `${lastNames[0]} et al.`;
    }

    // Helper to format APA bibliography entries in full
    function formatAPABibliographyItem(item: BibliographyItem): string {
      const authors = item.authors.trim();
      const year = item.year.trim() || 's.f.';
      const title = item.title.trim();
      
      let formatted = `<strong>${authors}</strong> (${year}). `;
      
      if (item.type === 'book') {
        formatted += `<em>${title}</em>.`;
        if (item.publisher) {
          formatted += ` ${item.publisher}.`;
        }
      } else if (item.type === 'article') {
        formatted += `${title}. `;
        if (item.journal) {
          formatted += `<em>${item.journal}</em>`;
          if (item.volume) {
            formatted += `, <em>${item.volume}</em>`;
          }
          if (item.issue) {
            formatted += `(${item.issue})`;
          }
          if (item.pages) {
            formatted += `, ${item.pages}`;
          }
          formatted += `.`;
        } else {
          formatted += `<em>${title}</em>.`;
        }
      } else { // web
        formatted += `<em>${title}</em>. `;
        if (item.retrievedDate) {
          formatted += `Recuperado el ${item.retrievedDate}`;
          if (item.url) {
            formatted += ` de <a href="${item.url}" target="_blank" class="text-[#004080] underline break-all">${item.url}</a>`;
          }
          formatted += `.`;
        } else if (item.url) {
          formatted += `Recuperado de <a href="${item.url}" target="_blank" class="text-[#004080] underline break-all">${item.url}</a>.`;
        } else {
          formatted += `Recuperado de internet.`;
        }
      }
      return formatted;
    }

    // 3. Replace in-text citations like [@key] or [@key1; @key2]
    const citationRegex = /\[@([a-zA-Z0-9_;\s@]+)\]/g;
    selectHtml = selectHtml.replace(citationRegex, (match, keysGroup) => {
      const keys = keysGroup.split(';').map((k: string) => k.replace(/@/g, '').trim()).filter(Boolean);
      const citations = keys.map((key: string) => {
        const item = bibliography.find(b => b.key.toLowerCase() === key.toLowerCase());
        if (item) {
          return `${getAPALastNames(item.authors)}, ${item.year}`;
        }
        return key; // fallback
      });
      return citations.length > 0 ? `(${citations.join('; ')})` : match;
    });

    // 4. Append automatic APA bibliography page at the very end
    if (settings.showBibliography && bibliography && bibliography.length > 0) {
      const sortedBib = [...bibliography].sort((a, b) => a.authors.localeCompare(b.authors));
      const bibTitle = settings.bibliographyTitle || 'Referencias Bibliográficas';
      
      const formattedItems = sortedBib.map(item => {
        return `<div style="padding-left: 2em; text-indent: -2em; margin-bottom: 1em; line-height: 1.6; font-size: 11px; font-family: 'Inter', sans-serif; text-align: justify;" class="unemi-bibliography-item">
          ${formatAPABibliographyItem(item)}
        </div>`;
      }).join('\n');

      selectHtml += `
        <div class="page-break"></div>
        <section class="unemi-bibliography-section" style="page-break-before: always; break-before: page;">
          <h1 style="font-family: 'Space Grotesk', sans-serif; font-size: 18px; font-weight: 700; color: #004080; text-transform: uppercase; margin-top: 24px; margin-bottom: 20px; border-bottom: 2px solid rgba(0, 64, 128, 0.15); padding-bottom: 6px;">
            ${bibTitle}
          </h1>
          <div style="margin-top: 16px;">
            ${formattedItems}
          </div>
        </section>
      `;
    }

    return renderMathInHtml(selectHtml);
  }, [htmlContent, htmlBlocks, uploadedFiles, bibliography, settings.showBibliography, settings.bibliographyTitle]);

  const resolvedCover = React.useMemo(() => {
    let selectCover = { ...cover };
    if (uploadedFiles && uploadedFiles.length > 0) {
      uploadedFiles.forEach((file) => {
        const escapedName = file.name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regexSrc = new RegExp(`src=["'](?:[^"']*/)?${escapedName}["']`, 'gi');
        
        if (selectCover.customHtml) {
          selectCover.customHtml = selectCover.customHtml.replace(regexSrc, `src="${file.dataUrl}"`);
        }
        if (selectCover.overlayHtml) {
          selectCover.overlayHtml = selectCover.overlayHtml.replace(regexSrc, `src="${file.dataUrl}"`);
        }
        if (selectCover.backgroundImage && (selectCover.backgroundImage === file.name || selectCover.backgroundImage.endsWith('/' + file.name))) {
          selectCover.backgroundImage = file.dataUrl;
        }
      });
    }
    return selectCover;
  }, [cover, uploadedFiles]);

  // Synchronize with the express server-rendered preview endpoint on document changes
  useEffect(() => {
    if (paginatedPages.length === 0) return;

    const timer = setTimeout(async () => {
      setIsSyncingServer(true);
      try {
        const coverPage = document.getElementById('unemi-cover-page');
        const docPages = document.querySelectorAll('[name^="document-page-"]');
        if (!coverPage || docPages.length === 0) return;

        let pagesHTML = '';
        
        const coverClone = coverPage.cloneNode(true) as HTMLElement;
        coverClone.style.boxShadow = 'none';
        coverClone.style.border = 'none';
        coverClone.style.margin = '0 auto';
        
        // Remove toolbar from coverClone if any
        const coverToolbar = coverClone.querySelector('#unemi-academic-toolbar');
        if (coverToolbar) coverToolbar.remove();

        pagesHTML += `<div class="print-page-boundary mb-8">${coverClone.outerHTML}</div>\n`;

        docPages.forEach((page) => {
          const pageClone = page.cloneNode(true) as HTMLElement;
          pageClone.style.boxShadow = 'none';
          pageClone.style.border = 'none';
          pageClone.style.margin = '0 auto';

          const guideOverlay = pageClone.querySelector('.absolute.inset-0.pointer-events-none');
          if (guideOverlay && (guideOverlay.innerHTML.includes('Guía:') || guideOverlay.innerHTML.includes('Márgenes'))) {
            guideOverlay.remove();
          }

          pagesHTML += `<div class="print-page-boundary mb-8">${pageClone.outerHTML}</div>\n`;
        });

        const isLetterSize = settings.pageSize === 'letter';
        const isA4 = settings.pageSize === 'a4';
        const isPortrait = (settings.orientation || 'portrait') === 'portrait';
        
        const paperWidth = isPortrait 
          ? (isLetterSize ? '816px' : isA4 ? '794px' : '630px')
          : (isLetterSize ? '1056px' : isA4 ? '1123px' : '1120px');
          
        const paperHeight = isPortrait 
          ? (isLetterSize ? '1056px' : isA4 ? '1123px' : '1120px')
          : (isLetterSize ? '816px' : isA4 ? '794px' : '630px');

        const topMargin = settings.marginTop !== undefined ? settings.marginTop : 96;
        const bottomMargin = settings.marginBottom !== undefined ? settings.marginBottom : 96;
        const leftMargin = settings.marginLeft !== undefined ? settings.marginLeft : 96;
        const rightMargin = settings.marginRight !== undefined ? settings.marginRight : 96;

        const sanitizeCSS = (rawCss: string) => {
          if (!rawCss) return '';
          return rawCss
            .replace(/<\/?style[^>]*>/gi, '')
            .replace(/<\/script>/gi, '');
        };

        const getGraphicalCSS = () => {
          let css = '';
          
          if (settings.h1Size || settings.h1Font || settings.h1Align || settings.h1LineHeight || settings.h1Indent !== undefined || settings.h1Bold !== undefined || settings.h1Italic !== undefined || settings.h1Color) {
            css += `\n.unemi-document-content h1 {`;
            if (settings.h1Size) css += ` font-size: ${settings.h1Size} !important;`;
            if (settings.h1Font) css += ` font-family: "${settings.h1Font}", sans-serif !important;`;
            if (settings.h1Align) css += ` text-align: ${settings.h1Align} !important;`;
            if (settings.h1LineHeight) css += ` line-height: ${settings.h1LineHeight} !important;`;
            if (settings.h1Indent) css += ` text-indent: ${settings.h1Indent} !important;`;
            if (settings.h1Bold !== undefined) css += ` font-weight: ${settings.h1Bold ? 'bold' : 'normal'} !important;`;
            if (settings.h1Italic !== undefined) css += ` font-style: ${settings.h1Italic ? 'italic' : 'normal'} !important;`;
            if (settings.h1Color) css += ` color: ${settings.h1Color} !important;`;
            css += ` }`;
          }

          if (settings.h2Size || settings.h2Font || settings.h2Align || settings.h2LineHeight || settings.h2Indent !== undefined || settings.h2Bold !== undefined || settings.h2Italic !== undefined || settings.h2Color) {
            css += `\n.unemi-document-content h2 {`;
            if (settings.h2Size) css += ` font-size: ${settings.h2Size} !important;`;
            if (settings.h2Font) css += ` font-family: "${settings.h2Font}", sans-serif !important;`;
            if (settings.h2Align) css += ` text-align: ${settings.h2Align} !important;`;
            if (settings.h2LineHeight) css += ` line-height: ${settings.h2LineHeight} !important;`;
            if (settings.h2Indent) css += ` text-indent: ${settings.h2Indent} !important;`;
            if (settings.h2Bold !== undefined) css += ` font-weight: ${settings.h2Bold ? 'bold' : 'normal'} !important;`;
            if (settings.h2Italic !== undefined) css += ` font-style: ${settings.h2Italic ? 'italic' : 'normal'} !important;`;
            if (settings.h2Color) css += ` color: ${settings.h2Color} !important;`;
            css += ` }`;
          }

          if (settings.pSize || settings.pFont || settings.pAlign || settings.pLineHeight || settings.pIndent !== undefined || settings.pBold !== undefined || settings.pItalic !== undefined || settings.pColor) {
            css += `\n.unemi-document-content, .unemi-document-content p, .unemi-document-content div:not(.unemi-academic-header):not(.unemi-academic-footer):not(.toc-container):not(.note):not(.math-expr) {`;
            if (settings.pSize) css += ` font-size: ${settings.pSize} !important;`;
            if (settings.pFont) css += ` font-family: "${settings.pFont}", sans-serif !important;`;
            if (settings.pAlign) css += ` text-align: ${settings.pAlign} !important;`;
            if (settings.pLineHeight) css += ` line-height: ${settings.pLineHeight} !important;`;
            if (settings.pIndent) css += ` text-indent: ${settings.pIndent} !important;`;
            if (settings.pBold !== undefined) css += ` font-weight: ${settings.pBold ? 'bold' : 'normal'} !important;`;
            if (settings.pItalic !== undefined) css += ` font-style: ${settings.pItalic ? 'italic' : 'normal'} !important;`;
            if (settings.pColor) css += ` color: ${settings.pColor} !important;`;
            css += ` }`;
          }

          if (settings.tableFontSize || settings.tableHeaderBg || settings.tableHeaderColor || settings.tableBorderColor || settings.tableCellPadding || settings.tableStriped || settings.tableBorderWidth) {
            css += `\n/* Table Formatting Rules */`;
            css += `\n.unemi-document-content table {`;
            css += `  word-wrap: break-word !important;`;
            css += `  border-collapse: collapse !important;`;
            if (settings.tableFontSize) css += ` font-size: ${settings.tableFontSize} !important;`;
            if (settings.tableBorderColor) css += ` border-color: ${settings.tableBorderColor} !important;`;
            css += ` }`;

            css += `\n.unemi-document-content table th, .unemi-document-content table td {`;
            if (settings.tableCellPadding) {
              css += ` padding: ${settings.tableCellPadding} !important;`;
            }
            if (settings.tableBorderColor) {
              css += ` border-color: ${settings.tableBorderColor} !important;`;
            }
            if (settings.tableBorderWidth) {
              css += ` border-width: ${settings.tableBorderWidth} !important;`;
              css += ` border-style: solid !important;`;
            }
            css += ` }`;

            css += `\n.unemi-document-content table th, .unemi-document-content table thead tr, .unemi-document-content table tr[bgcolor] {`;
            if (settings.tableHeaderBg) css += ` background-color: ${settings.tableHeaderBg} !important;`;
            if (settings.tableHeaderColor) css += ` color: ${settings.tableHeaderColor} !important;`;
            css += ` }`;

            if (settings.tableStriped) {
              css += `\n.unemi-document-content table tbody tr:nth-child(even) {`;
              css += ` background-color: rgba(0, 0, 0, 0.03) !important;`;
              css += ` }`;
            }
          }

          return css;
        };

        const cleanHTML = `<!DOCTYPE html>
  <!-- SYNCED_MODE_V2 -->
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${cover.title || 'Plantilla de Documento UNEMI'}</title>
  
  <script src="https://cdn.tailwindcss.com"></script>
  
  <!-- KaTeX CSS for mathematical symbol styling -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">
 
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Space+Grotesk:wght@400;500;600;700&family=Fira+Code:wght@400;500&display=swap');
    
    * {
      box-sizing: border-box;
    }
    
    body, html {
      margin: 0;
      padding: 0;
      background-color: #f1f5f9;
      font-family: "Inter", system-ui, -apple-system, sans-serif;
      text-rendering: optimizeLegibility;
      -webkit-font-smoothing: antialiased;
    }
    
    .document-rendered-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 32px;
      padding: 48px 24px;
    }

    div[name^="document-page-"] {
      position: relative !important;
      background-color: #ffffff !important;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1) !important;
      border: 1px solid #e2e8f0 !important;
      padding-top: ${topMargin}px !important;
      padding-bottom: ${bottomMargin}px !important;
      padding-left: ${leftMargin}px !important;
      padding-right: ${rightMargin}px !important;
      box-sizing: border-box !important;
      display: flex !important;
      flex-direction: column !important;
      justify-content: space-between !important;
      overflow: hidden !important;
      flex-shrink: 0 !important;
      width: ${paperWidth} !important;
      height: ${paperHeight} !important;
    }

    #unemi-cover-page {
      position: relative !important;
      background-color: #ffffff !important;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1) !important;
      border: 1px solid #e2e8f0 !important;
      padding: 0 !important;
      box-sizing: border-box !important;
      display: flex !important;
      flex-direction: column !important;
      justify-content: space-between !important;
      overflow: hidden !important;
      flex-shrink: 0 !important;
      width: ${paperWidth} !important;
      height: ${paperHeight} !important;
    }

    .absolute { position: absolute !important; }
    
    .unemi-document-content {
      font-family: "Times New Roman", Times, Georgia, serif !important;
      font-size: 16px !important;
      line-height: 1.8 !important;
      color: #000000 !important;
      text-align: left !important;
    }

    .unemi-document-content h1 {
      font-family: "Times New Roman", Times, Georgia, serif !important;
      font-size: 16px !important;
      font-weight: bold !important;
      color: #000000 !important;
      text-transform: none !important;
      text-align: center !important;
      margin-top: 24px !important;
      margin-bottom: 12px !important;
      padding-bottom: 0 !important;
      border-bottom: none !important;
      position: relative !important;
    }

    .unemi-document-content h1::after {
      display: none !important;
      content: none !important;
    }

    .unemi-document-content h2 {
      font-family: "Times New Roman", Times, Georgia, serif !important;
      font-size: 16px !important;
      font-weight: bold !important;
      color: #000000 !important;
      text-align: left !important;
      margin-top: 18px !important;
      margin-bottom: 8px !important;
    }

    .unemi-document-content h3 {
      font-family: "Times New Roman", Times, Georgia, serif !important;
      font-size: 16px !important;
      font-weight: bold !important;
      font-style: italic !important;
      color: #000000 !important;
      text-align: left !important;
      margin-top: 12px !important;
      margin-bottom: 6px !important;
    }

    .unemi-document-content h4 {
      font-family: "Times New Roman", Times, Georgia, serif !important;
      font-size: 16px !important;
      font-weight: bold !important;
      color: #000000 !important;
      text-align: left !important;
      text-indent: 0.5in !important;
      margin-top: 10px !important;
      margin-bottom: 4px !important;
    }

    .unemi-document-content h5 {
      font-family: "Times New Roman", Times, Georgia, serif !important;
      font-size: 16px !important;
      font-weight: bold !important;
      font-style: italic !important;
      color: #000000 !important;
      text-align: left !important;
      text-indent: 0.5in !important;
      margin-top: 10px !important;
      margin-bottom: 4px !important;
    }

    .unemi-document-content p {
      margin-top: 0 !important;
      margin-bottom: 12px !important;
      line-height: 1.8 !important;
    }

    .unemi-document-content ul {
      list-style-type: disc !important;
      padding-left: 0.5in !important;
      margin-bottom: 12px !important;
    }

    .unemi-document-content ul li {
      position: relative !important;
      margin-bottom: 6px !important;
      line-height: 1.8 !important;
    }

    .unemi-document-content ul li::before {
      display: none !important;
      content: none !important;
    }

    .unemi-document-content ol {
      list-style-type: decimal !important;
      padding-left: 0.5in !important;
      margin-bottom: 12px !important;
    }

    .unemi-document-content ol li {
      margin-bottom: 6px !important;
      line-height: 1.8 !important;
    }

    .unemi-document-content .note {
      border-left: 3px solid #000000 !important;
      background-color: #f8fafc !important;
      padding: 12px 14px !important;
      margin: 16px 0 !important;
      border-radius: 0 4px 4px 0 !important;
      font-size: 12px !important;
      line-height: 1.6 !important;
      color: #000000 !important;
    }

    .unemi-document-content blockquote {
      border-left: none !important;
      background-color: transparent !important;
      padding: 0 !important;
      margin: 12px 0 12px 0.5in !important;
      font-style: normal !important;
      line-height: 1.8 !important;
      color: #000000 !important;
    }

    .unemi-document-content figure {
      display: block !important;
      margin: 16px auto !important;
      border: 1px solid #e2e8f0 !important;
      background-color: #f8fafc !important;
      padding: 8px !important;
      border-radius: 4px !important;
      max-width: 100% !important;
      box-sizing: border-box !important;
    }

    .unemi-document-content figure.mw-default-size,
    .unemi-document-content figure[class*="thumb"] {
      float: right !important;
      margin-left: 18px !important;
      margin-top: 4px !important;
      margin-bottom: 12px !important;
      width: 220px !important;
    }

    .unemi-document-content figcaption {
      font-family: "Inter", sans-serif !important;
      font-size: 10.5px !important;
      color: #64748b !important;
      margin-top: 8px !important;
      line-height: 1.4 !important;
      text-align: center !important;
      font-style: italic !important;
    }

    .unemi-document-content img,
    .unemi-document-content .mw-file-element {
      max-width: 100% !important;
      height: auto !important;
      display: block !important;
      margin: 0 auto !important;
      border-radius: 2px !important;
    }

    .unemi-academic-header {
      position: absolute !important;
      top: ${Math.max(10, topMargin - 60)}px !important;
      left: ${leftMargin}px !important;
      right: ${rightMargin}px !important;
      height: 50px !important;
      display: flex !important;
      flex-direction: column !important;
      justify-content: flex-end !important;
      pointer-events: none !important;
      user-select: none !important;
      z-index: 10 !important;
    }
    
    .unemi-academic-footer {
      position: absolute !important;
      text-align: center !important;
      bottom: ${Math.max(10, bottomMargin - 50)}px !important;
      left: ${leftMargin}px !important;
      right: ${rightMargin}px !important;
      height: 40px !important;
      display: flex !important;
      flex-direction: column !important;
      justify-content: flex-start !important;
      pointer-events: none !important;
      user-select: none !important;
      z-index: 10 !important;
    }

    @media print {
      #unemi-academic-toolbar, .print\:hidden, .print-hidden {
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
      .document-rendered-container {
        padding: 0 !important;
        gap: 0 !important;
        display: block !important;
      }
      div[name^="document-page-"] {
        box-shadow: none !important;
        border: none !important;
        page-break-after: always !important;
        break-after: page !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        margin: 0 !important;
        padding-top: ${topMargin}px !important;
        padding-bottom: ${bottomMargin}px !important;
        padding-left: ${leftMargin}px !important;
        padding-right: ${rightMargin}px !important;
      }
      #unemi-cover-page {
        box-shadow: none !important;
        border: none !important;
        page-break-after: always !important;
        break-after: page !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      @page {
        margin: 0 !important;
        size: ${settings.pageSize === 'letter' ? '8.5in 11in' : settings.pageSize === 'a4' ? '210mm 297mm' : '297mm 167.06mm'} ${isPortrait ? 'portrait' : 'landscape'};
      }
    }
    
    ${sanitizeCSS(settings.blockStyleTitles || '')}
    ${sanitizeCSS(settings.blockStyleHeader || '')}
    ${sanitizeCSS(settings.blockStyleFooter || '')}
    ${sanitizeCSS(settings.blockStylePageNum || '')}
    ${sanitizeCSS(settings.blockStyleTOC || '')}
    ${sanitizeCSS(settings.tableCustomCss || '')}
    ${getGraphicalCSS()}
    ${sanitizeCSS(settings.customAddedCss || '')}
    
    ${settings.autoNumberHeadings ? `
    body, .document-rendered-container {
      counter-reset: unemi-h1-counter !important;
    }
    .unemi-document-content h1 {
      counter-reset: unemi-h2-counter !important;
      counter-increment: unemi-h1-counter !important;
    }
    .unemi-document-content h1::before {
      content: counter(unemi-h1-counter) ". " !important;
    }
    .unemi-document-content h2 {
      counter-reset: unemi-h3-counter !important;
      counter-increment: unemi-h2-counter !important;
    }
    .unemi-document-content h2::before {
      content: counter(unemi-h1-counter) "." counter(unemi-h2-counter) " " !important;
    }
    .unemi-document-content h3 {
      counter-increment: unemi-h3-counter !important;
    }
    .unemi-document-content h3::before {
      content: counter(unemi-h1-counter) "." counter(unemi-h2-counter) "." counter(unemi-h3-counter) " " !important;
    }
    ` : ''}
  </style>
</head>
<body>
  <!-- Floating Academic Toolbar (Omitted when printing) -->
  <div id="unemi-academic-toolbar" class="fixed top-4 right-4 z-50 print:hidden flex items-center gap-3 bg-[#004080] text-white px-4 py-2 border-2 border-[#FF6600]/80 rounded-xl shadow-2xl">
    <span class="font-bold text-xs uppercase tracking-wider text-slate-100 flex items-center gap-1.5">
      <span class="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
      Vista Previa
    </span>
    <div class="h-4 w-[1px] bg-white/20"></div>
    <button id="unemi-start-presentation" class="bg-[#FF6600] hover:bg-[#ff8533] text-white font-bold text-xs px-3 py-1.5 rounded-lg border border-[#FF6600] cursor-pointer active:scale-95 transition-all flex items-center gap-1">
      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <polygon points="5 3 19 12 5 21 5 3" fill="currentColor"></polygon>
      </svg>
      Iniciar Presentación
    </button>
    <button onclick="window.print()" class="bg-slate-800 text-white font-semibold text-xs px-2.5 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-700 active:scale-95 transition-all flex items-center gap-1 cursor-pointer">
      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="width: 14px; height: 14px;">
        <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2m-2-5H8v8h8v-8z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
      </svg>
      Imprimir
    </button>
  </div>

  <div class="document-rendered-container">
    ${pagesHTML}
  </div>

  <!-- Presentation Mode Logic -->
  <script>
    document.addEventListener("DOMContentLoaded", function() {
      var inPresentationMode = false;
      var currentPageIndex = 0;
      var pages = Array.from(document.querySelectorAll('#unemi-cover-page, div[name^="document-page-"]'));
      var container = document.querySelector('.document-rendered-container');
      var hudTimeout = null;
      var presentationScale = 1.0;

      function updatePageVisibility() {
        if (!inPresentationMode) return;
        var viewportWidth = window.innerWidth;
        var viewportHeight = window.innerHeight;

        pages.forEach(function(page, idx) {
          if (idx === currentPageIndex) {
            page.style.setProperty('display', 'flex', 'important');
            var pageWidth = page.offsetWidth || 816;
            var pageHeight = page.offsetHeight || 1056;

            var maxWidth = viewportWidth * 0.94;
            var maxHeight = viewportHeight * 0.94;

            var scaleX = maxWidth / pageWidth;
            var scaleY = maxHeight / pageHeight;

            var fitScale = Math.min(scaleX, scaleY);

            page.style.setProperty('transform', 'scale(' + (fitScale * presentationScale) + ')', 'important');
            page.style.setProperty('transform-origin', 'center center', 'important');
            page.style.setProperty('margin', '0 auto', 'important');
          } else {
            page.style.setProperty('display', 'none', 'important');
          }
        });
        window.scrollTo({ top: 0, left: 0 });
        if (container) {
          container.scrollTop = 0;
          container.scrollLeft = 0;
        }
      }

      function startPresentation() {
        inPresentationMode = true;
        currentPageIndex = 0;
        presentationScale = 1.0;
        
        var toolbar = document.getElementById('unemi-academic-toolbar');
        if (toolbar) toolbar.style.setProperty('display', 'none', 'important');
        
        container.classList.add('bg-slate-950', 'w-screen', 'h-screen', 'fixed', 'inset-0', 'z-40', 'overflow-hidden', 'flex', 'justify-center', 'items-center', 'p-4');
        
        container.style.setProperty('gap', '0px', 'important');
        container.style.setProperty('padding', '0px', 'important');
        container.style.setProperty('display', 'flex', 'important');
        container.style.setProperty('align-items', 'center', 'important');
        container.style.setProperty('justify-content', 'center', 'important');
        
        try {
          var de = document.documentElement;
          if (de.requestFullscreen) {
            de.requestFullscreen();
          } else if (de.webkitRequestFullscreen) {
            de.webkitRequestFullscreen();
          } else if (de.msRequestFullscreen) {
            de.msRequestFullscreen();
          }
        } catch (err) {
          console.error("Fullscreen request failed:", err);
        }
        
        var hud = document.getElementById('unemi-presentation-hud');
        if (!hud) {
          hud = document.createElement('div');
          hud.id = 'unemi-presentation-hud';
          hud.style.cssText = 'position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%); background: rgba(15, 23, 42, 0.95); border: 1.5px solid #FF6600; padding: 12px 24px; border-radius: 12px; color: #ffffff; font-family: "Inter", system-ui, sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.75px; text-transform: uppercase; display: flex; align-items: center; gap: 18px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); z-index: 10000; transition: opacity 0.5s ease; pointer-events: none;';
          hud.innerHTML = \`
            <span style="display: flex; align-items: center; gap: 6px;"><span style="color: #FF6600; font-family: monospace;">[CLICK / ESPACIO / &rarr;]</span> Siguiente</span>
            <span style="opacity: 0.3;">|</span>
            <span style="display: flex; align-items: center; gap: 6px;"><span style="color: #FF6600; font-family: monospace;">[&larr;]</span> Anterior</span>
            <span style="opacity: 0.3;">|</span>
            <span style="display: flex; align-items: center; gap: 6px;"><span style="color: #FF6600; font-family: monospace;">[RUEDA / PINCH]</span> Zoom</span>
            <span style="opacity: 0.3;">|</span>
            <span style="display: flex; align-items: center; gap: 6px;"><span style="color: #FF6600; font-family: monospace;">[ESC]</span> Salir</span>
          \`;
          document.body.appendChild(hud);
        }
        hud.style.opacity = '1';
        
        if (hudTimeout) clearTimeout(hudTimeout);
        hudTimeout = setTimeout(function() {
          hud.style.opacity = '0';
        }, 3000);

        updatePageVisibility();
      }

      function stopPresentation() {
        inPresentationMode = false;
        presentationScale = 1.0;
        
        try {
          if (document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement) {
            if (document.exitFullscreen) {
              document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
              document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) {
              document.msExitFullscreen();
            }
          }
        } catch (err) {
          console.error("Fullscreen exit failed:", err);
        }
        
        var toolbar = document.getElementById('unemi-academic-toolbar');
        if (toolbar) toolbar.style.setProperty('display', 'flex', 'important');
        
        var hud = document.getElementById('unemi-presentation-hud');
        if (hud) hud.style.opacity = '0';
        
        pages.forEach(function(page) {
          page.style.removeProperty('display');
          page.style.removeProperty('transform');
          page.style.removeProperty('transform-origin');
          page.style.removeProperty('margin');
        });
        
        container.style.removeProperty('gap');
        container.style.removeProperty('padding');
        container.style.removeProperty('display');
        container.style.removeProperty('align-items');
        container.style.removeProperty('justify-content');
        
        container.classList.remove('bg-slate-950', 'w-screen', 'h-screen', 'fixed', 'inset-0', 'z-40', 'overflow-hidden', 'flex', 'justify-center', 'items-center', 'p-4');
      }

      function nextPage() {
        if (currentPageIndex < pages.length - 1) {
          currentPageIndex++;
          updatePageVisibility();
        }
      }

      function prevPage() {
        if (currentPageIndex > 0) {
          currentPageIndex--;
          updatePageVisibility();
        }
      }

      var startBtn = document.getElementById('unemi-start-presentation');
      if (startBtn) startBtn.addEventListener('click', startPresentation);

      window.addEventListener('click', function(e) {
        if (!inPresentationMode) return;
        if (e.target === container || e.target === document.documentElement || e.target === document.body) {
          nextPage();
        }
      });

      window.addEventListener('beforeprint', function() {
        var toolbar = document.getElementById('unemi-academic-toolbar');
        if (toolbar) {
          toolbar.style.setProperty('display', 'none', 'important');
        }
      });
      window.addEventListener('afterprint', function() {
        var toolbar = document.getElementById('unemi-academic-toolbar');
        if (toolbar && !inPresentationMode) {
          toolbar.style.setProperty('display', 'flex', 'important');
        }
      });

      window.addEventListener('wheel', function(e) {
        if (!inPresentationMode) return;
        e.preventDefault();
        var delta = -e.deltaY;
        var baseFactor = e.ctrlKey ? 0.0008 : 0.0003;
        var scaleChange = delta * baseFactor;
        scaleChange = Math.min(Math.max(scaleChange, -0.05), 0.05);
        presentationScale = Math.min(Math.max(presentationScale + scaleChange, 0.3), 4.0);
        updatePageVisibility();
      }, { passive: false });

      var initialTouchDist = null;
      var startPinchScale = 1.0;

      function getTouchDistance(touches) {
        var dx = touches[0].clientX - touches[1].clientX;
        var dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
      }

      window.addEventListener('touchstart', function(e) {
        if (!inPresentationMode) return;
        if (e.touches.length === 2) {
          initialTouchDist = getTouchDistance(e.touches);
          startPinchScale = presentationScale;
          e.preventDefault();
        }
      }, { passive: false });

      window.addEventListener('touchmove', function(e) {
        if (!inPresentationMode) return;
        if (e.touches.length === 2 && initialTouchDist !== null) {
          e.preventDefault();
          var dist = getTouchDistance(e.touches);
          var ratio = dist / initialTouchDist;
          var smoothRatio = 1.0 + (ratio - 1.0) * 0.15;
          presentationScale = Math.min(Math.max(startPinchScale * smoothRatio, 0.3), 4.0);
          updatePageVisibility();
        }
      }, { passive: false });

      window.addEventListener('touchend', function(e) {
        if (!inPresentationMode) return;
        if (e.touches.length < 2) {
          initialTouchDist = null;
        }
      });

      window.addEventListener('keydown', function(e) {
        if (!inPresentationMode) return;
        if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') {
          nextPage();
          e.preventDefault();
        } else if (e.key === 'ArrowLeft' || e.key === 'Backspace') {
          prevPage();
          e.preventDefault();
        } else if (e.key === 'Escape') {
          stopPresentation();
          e.preventDefault();
        }
      });

      function onFullscreenChange() {
        var isFS = document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement;
        if (!isFS && inPresentationMode) {
          stopPresentation();
        }
      }
      document.addEventListener('fullscreenchange', onFullscreenChange);
      document.addEventListener('webkitfullscreenchange', onFullscreenChange);
      document.addEventListener('msfullscreenchange', onFullscreenChange);

      window.addEventListener('resize', function() {
        if (inPresentationMode) {
          updatePageVisibility();
        }
      });

      function syncIframes() {
        pages.forEach(function(page, idx) {
          var blocks = page.querySelectorAll('.unemi-functional-block');
          blocks.forEach(function(block) {
            var template = block.querySelector('.unemi-functional-template');
            if (!template) return;
            
            var isPageActive = !inPresentationMode || (idx === currentPageIndex);
            var existingIframe = block.querySelector('iframe');
            
            if (isPageActive) {
              var srcDocContent = '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>html, body { margin: 0 !important; padding: 0 !important; width: 100% !important; height: 100% !important; overflow: hidden !important; background-color: transparent !important; }</style></head><body>' + template.innerHTML + '</body></html>';
              
              if (!existingIframe) {
                var iframe = document.createElement('iframe');
                iframe.title = 'functional-block-' + block.getAttribute('data-block-id');
                iframe.setAttribute('sandbox', 'allow-scripts allow-modals allow-same-origin');
                iframe.style.cssText = 'width: 100%; height: 100%; border: none; overflow: hidden; display: block; flex: 1;';
                iframe.setAttribute('scrolling', 'no');
                iframe.srcdoc = srcDocContent;
                block.appendChild(iframe);
              } else {
                if (existingIframe.srcdoc !== srcDocContent) {
                  existingIframe.srcdoc = srcDocContent;
                }
              }
            } else {
              if (existingIframe) {
                existingIframe.remove();
              }
            }
          });
        });
      }

      var originalUpdatePageVisibility = updatePageVisibility;
      updatePageVisibility = function() {
        originalUpdatePageVisibility();
        syncIframes();
      };

      var originalStopPresentation = stopPresentation;
      stopPresentation = function() {
        originalStopPresentation();
        syncIframes();
      };

      syncIframes();
    });
  </script>
</body>
</html>`;

        let processedHTML = cleanHTML
          .replace(/src="\/\//g, 'src="https://')
          .replace(/srcset="\/\//g, 'srcset="https://')
          .replace(/href="\/\//g, 'href="https://');

        const response = await fetch('/api/save-preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ html: processedHTML }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.id) {
            setServerPreviewId(data.id);
          }
        }
      } catch (err) {
        console.error("Error at background preview sync:", err);
      } finally {
        setIsSyncingServer(false);
      }
    }, 700);

    return () => clearTimeout(timer);
  }, [paginatedPages, settings, cover, resolvedHtmlContent]);

  // Local React preview iframe sync for functional blocks
  useEffect(() => {
    if (previewMode === 'server' || recalculating) return;

    const pageContainers = document.querySelectorAll('.unemi-document-body');
    pageContainers.forEach((container) => {
      const blocks = container.querySelectorAll('.unemi-functional-block');
      blocks.forEach((block) => {
        const blockId = block.getAttribute('data-block-id');
        if (!blockId) return;

        const template = block.querySelector('.unemi-functional-template') as HTMLTemplateElement;
        if (!template) return;

        let iframe = block.querySelector('iframe') as HTMLIFrameElement;
        if (!iframe) {
          iframe = document.createElement('iframe');
          iframe.title = `functional-block-${blockId}`;
          iframe.setAttribute('sandbox', 'allow-scripts allow-modals allow-same-origin');
          iframe.style.cssText = 'width: 100%; height: 100%; border: none; overflow: hidden; display: block; flex: 1;';
          iframe.setAttribute('scrolling', 'no');
          block.appendChild(iframe);
        }

        const srcDocContent = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>html, body { margin: 0 !important; padding: 0 !important; width: 100% !important; height: 100% !important; overflow: hidden !important; background-color: transparent !important; }</style></head><body>${template.innerHTML}</body></html>`;
        if (iframe.srcdoc !== srcDocContent) {
          iframe.srcdoc = srcDocContent;
        }
      });
    });
  }, [paginatedPages, previewMode, recalculating, htmlBlocks]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, setIsFullscreen]);

  // Execute custom JS script in the preview environment safely
  useEffect(() => {
    if (!settings.customAddedJs) return;
    
    // Remove previous dynamic user scripts to prevent duplication
    const oldScripts = document.querySelectorAll('.dynamic-user-script');
    oldScripts.forEach((s) => s.remove());

    try {
      const script = document.createElement('script');
      script.className = 'dynamic-user-script';
      script.text = `
        (function() {
          try {
            ${settings.customAddedJs}
          } catch (e) {
            console.error("Error en script de usuario:", e);
          }
        })();
      `;
      document.body.appendChild(script);
    } catch (err) {
      console.error('Error executing custom script:', err);
    }
  }, [settings.customAddedJs, paginatedPages]);

  // Execute inline <script> tags present inside the paginated content pages
  useEffect(() => {
    if (paginatedPages.length === 0) return;

    const timer = setTimeout(() => {
      // Find all rendered bodies in our preview DOM
      const bodies = document.querySelectorAll('.unemi-document-body');
      
      // Clean up previously created inline dynamic scripts to prevent duplicates
      const existingDynamicScripts = document.querySelectorAll('.dynamic-inline-user-script');
      existingDynamicScripts.forEach((s) => s.remove());

      const executedScripts = new Set<string>();

      bodies.forEach((body) => {
        const scripts = body.querySelectorAll('script');
        scripts.forEach((originalScript) => {
          try {
            const scriptText = (originalScript.textContent || originalScript.innerText || '').trim();
            if (scriptText && !executedScripts.has(scriptText)) {
              executedScripts.add(scriptText);
              
              const newScript = document.createElement('script');
              newScript.className = 'dynamic-inline-user-script';
              newScript.text = `
                (function() {
                  try {
                    ${scriptText}
                  } catch (e) {
                    console.error("Error en script inline:", e);
                  }
                })();
              `;
              document.body.appendChild(newScript);
            }
          } catch (e) {
            console.error('Error al ejecutar script incrustado en el bloque de contenido:', e);
          }
        });
      });
    }, 300); // Small delay to guarantee elements are fully mounted in the DOM

    return () => clearTimeout(timer);
  }, [paginatedPages, resolvedHtmlContent]);

  const isLetter = settings.pageSize === 'letter';
  const isA4 = settings.pageSize === 'a4';
  const isPortrait = (settings.orientation || 'portrait') === 'portrait';

  // Letter size at 96 DPI: 816px x 1056px, A4 size: 794px x 1123px (at 96 DPI), 16:9 size: 1120px x 630px
  // Horizontal (Landscape) swap sizes
  const pageWidth = isPortrait 
    ? (isLetter ? 816 : isA4 ? 794 : 630)
    : (isLetter ? 1056 : isA4 ? 1123 : 1120);

  const pageHeight = isPortrait
    ? (isLetter ? 1056 : isA4 ? 1123 : 1120)
    : (isLetter ? 816 : isA4 ? 794 : 630);
  
  const leftMargin = settings.marginLeft !== undefined ? settings.marginLeft : 96;
  const rightMargin = settings.marginRight !== undefined ? settings.marginRight : 96;
  const topMargin = settings.marginTop !== undefined ? settings.marginTop : 96;
  const bottomMargin = settings.marginBottom !== undefined ? settings.marginBottom : 96;

  // Standard content widths at 96 DPI:
  const contentWidth = pageWidth - leftMargin - rightMargin;

  // Paginar el contenido HTML
  useEffect(() => {
    const handlePagination = () => {
      if (!hiddenMeasureRef.current) return;
      
      setRecalculating(true);
      
      // Select raw rendered children in our hidden container
      const childNodes = Array.from(hiddenMeasureRef.current.children) as HTMLElement[];
      const pagesList: string[][] = [[]];
      let currentPageIndex = 0;
      let accumulatedPageHeight = 0;

      // Vertical threshold boundary in pixels, reserving safety margin:
      const totalHeight = pageHeight;
      const maxHeight = totalHeight - topMargin - bottomMargin - 54;

      const detectedHeadings: HeadingItem[] = [];

      childNodes.forEach((node) => {
        // Measure element height including vertical margin collapse approximation
        const style = window.getComputedStyle(node);
        const marginTopVal = parseFloat(style.marginTop) || 0;
        const marginBottomVal = parseFloat(style.marginBottom) || 0;
        
        // Element height in layout
        const elementHeight = node.getBoundingClientRect().height + marginTopVal + marginBottomVal;

        const isPageBreak = node.classList.contains('page-break');

        // Safety cutoff check: If elements exceed max height or a manual page-break exists, break onto a new page.
        // We only break if the current page already contains elements to avoid zero-item endless paging loop.
        if ((accumulatedPageHeight + elementHeight > maxHeight || isPageBreak) && accumulatedPageHeight > 0) {
          currentPageIndex++;
          pagesList.push([]);
          accumulatedPageHeight = 0;
        }

        pagesList[currentPageIndex].push(node.outerHTML);

        // Scan for headings (H1, H2, H3) inside our page nodes
        const isHeading = ['H1', 'H2', 'H3'].includes(node.tagName || '');
        const headingEls = node.querySelectorAll ? Array.from(node.querySelectorAll('h1, h2, h3')) : [];
        if (isHeading) {
          headingEls.unshift(node);
        }

        headingEls.forEach((h) => {
          const text = h.textContent?.trim() || '';
          if (text) {
            detectedHeadings.push({
              text,
              level: parseInt(h.tagName.substring(1), 10),
              // Page 1 is Cover. If showTOC toggled on, style index starts on page 3.
              page: currentPageIndex + (settings.showTOC ? 3 : 2)
            });
          }
        });

        accumulatedPageHeight += elementHeight;
      });

      // Update states
      setPaginatedPages(pagesList);
      setDynamicHeadings(detectedHeadings);
      setPageCount(pagesList.length + 1 + (settings.showTOC ? 1 : 0)); // Content + Cover + TOC (if enabled)
      
      // Short delay for visual indication
      setTimeout(() => setRecalculating(false), 200);
    };

    // Run pagination
    handlePagination();

    // Re-run on layout layout shifts
    const resizeObserver = new ResizeObserver(() => {
      handlePagination();
    });

    if (hiddenMeasureRef.current) {
      resizeObserver.observe(hiddenMeasureRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [resolvedHtmlContent, settings.pageSize, settings.orientation, settings.showTOC, setPageCount, isLetter, leftMargin, rightMargin, topMargin, bottomMargin, pageHeight]);

  // Detector de Desbordes Gráfico: Encuentra elementos cuyo ancho o largo excede el espacio neto disponible de la página.
  useEffect(() => {
    const timer = setTimeout(() => {
      const bodies = document.querySelectorAll('.unemi-document-body');
      const scale = zoom / 100;
      const overflowsList: {
        id: string;
        type: 'ancho' | 'alto';
        tagName: string;
        pageNumber: number;
        measured: number;
        allowed: number;
        outerHTML?: string;
      }[] = [];

      bodies.forEach((body) => {
        const pageEl = body.closest('[name^="document-page-"]');
        const pageNumberAttr = pageEl?.getAttribute('name');
        const pageNum = pageNumberAttr ? parseInt(pageNumberAttr.replace('document-page-', ''), 10) : 1;

        // Get parent visible width & height strictly from physical page margins
        const parentW = contentWidth;
        // height of page body (printable Height)
        const parentH = pageHeight - topMargin - bottomMargin - 54;

        // 1. Check page cumulative height overflow
        const bodyScrollH = body.scrollHeight;
        if (bodyScrollH > parentH + 10) {
          overflowsList.push({
            id: `page-height-${pageNum}`,
            type: 'alto',
            tagName: 'página (contenido acumulado)',
            pageNumber: pageNum,
            measured: Math.round(bodyScrollH),
            allowed: Math.round(parentH),
            outerHTML: body.innerHTML,
          });
        }

        // 2. Check individual children elements
        const candidates = body.querySelectorAll('table, img, div, p, pre, blockquote, figure, ul, ol');
        candidates.forEach((el, index) => {
          const htmlEl = el as HTMLElement;
          
          // Reset attributes and classes
          htmlEl.classList.remove('overflowing-element-width', 'overflowing-element-height');
          htmlEl.removeAttribute('data-width-label');
          htmlEl.removeAttribute('data-allowed-width');
          htmlEl.removeAttribute('data-height-label');
          htmlEl.removeAttribute('data-allowed-height');

          const rect = htmlEl.getBoundingClientRect();
          // Scale measurement because boundingClientRect scales with zoom!
          const actualMeasuredW = Math.round(rect.width / scale);
          const actualMeasuredH = Math.round(rect.height / scale);

          // Rendered size properties (which are layout model based, unscaled)
          const scrollW = htmlEl.scrollWidth;
          const scrollH = htmlEl.scrollHeight;
          const offsetW = htmlEl.offsetWidth;
          const offsetH = htmlEl.offsetHeight;

          // Inline style checks
          const styleAttr = htmlEl.getAttribute('style') || '';
          const inlineWidthMatch = styleAttr.match(/width\s*:\s*(\d+)px/i);
          const inlineHeightMatch = styleAttr.match(/height\s*:\s*(\d+)px/i);

          const styleWidthVal = inlineWidthMatch ? parseInt(inlineWidthMatch[1], 10) : 0;
          const styleHeightVal = inlineHeightMatch ? parseInt(inlineHeightMatch[1], 10) : 0;

          // Compute max dimension seen
          const finalW = Math.max(actualMeasuredW, scrollW, offsetW, styleWidthVal);
          const finalH = Math.max(actualMeasuredH, scrollH, offsetH, styleHeightVal);

          let isWOver = false;
          let isHOver = false;

          // Check if width exceeds
          if (finalW > parentW + 4) {
            isWOver = true;
          }

          // Check if height exceeds
          if (finalH > parentH + 4) {
            // Avoid flagging the main container itself or root layout utilities
            if (!htmlEl.classList.contains('unemi-document-body')) {
              isHOver = true;
            }
          }

          if (isWOver) {
            htmlEl.classList.add('overflowing-element-width');
            htmlEl.setAttribute('data-width-label', `${Math.round(finalW)}`);
            htmlEl.setAttribute('data-allowed-width', `${Math.round(parentW)}`);

            overflowsList.push({
              id: `w-over-${pageNum}-${index}-${htmlEl.tagName}`,
              type: 'ancho',
              tagName: htmlEl.tagName.toLowerCase(),
              pageNumber: pageNum,
              measured: Math.round(finalW),
              allowed: Math.round(parentW),
              outerHTML: htmlEl.outerHTML,
            });
          }

          if (isHOver) {
            htmlEl.classList.add('overflowing-element-height');
            htmlEl.setAttribute('data-height-label', `${Math.round(finalH)}`);
            htmlEl.setAttribute('data-allowed-height', `${Math.round(parentH)}`);

            overflowsList.push({
              id: `h-over-${pageNum}-${index}-${htmlEl.tagName}`,
              type: 'alto',
              tagName: htmlEl.tagName.toLowerCase(),
              pageNumber: pageNum,
              measured: Math.round(finalH),
              allowed: Math.round(parentH),
              outerHTML: htmlEl.outerHTML,
            });
          }
        });
      });

      setDetectedOverflows(overflowsList);
    }, 400);

    return () => clearTimeout(timer);
  }, [paginatedPages, contentWidth, resolvedHtmlContent, zoom, pageHeight, topMargin, bottomMargin]);

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 10, 150));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 10, 60));
  const handleResetZoom = () => setZoom(100);

  // Generador de estilos graficos y CSS adicional del usuario para inyectar limpia y preventivamente
  const getGraphicalAndCustomCSS = () => {
    let css = '';
    
    // H1
    if (settings.h1Size || settings.h1Font || settings.h1Align || settings.h1LineHeight || settings.h1Indent !== undefined || settings.h1Bold !== undefined || settings.h1Italic !== undefined || settings.h1Color) {
      css += `\n.unemi-document-content h1 {`;
      if (settings.h1Size) css += ` font-size: ${settings.h1Size} !important;`;
      if (settings.h1Font) css += ` font-family: "${settings.h1Font}", sans-serif !important;`;
      if (settings.h1Align) css += ` text-align: ${settings.h1Align} !important;`;
      if (settings.h1LineHeight) css += ` line-height: ${settings.h1LineHeight} !important;`;
      if (settings.h1Indent) css += ` text-indent: ${settings.h1Indent} !important;`;
      if (settings.h1Bold !== undefined) css += ` font-weight: ${settings.h1Bold ? 'bold' : 'normal'} !important;`;
      if (settings.h1Italic !== undefined) css += ` font-style: ${settings.h1Italic ? 'italic' : 'normal'} !important;`;
      if (settings.h1Color) css += ` color: ${settings.h1Color} !important;`;
      css += ` }`;
    }

    // H2
    if (settings.h2Size || settings.h2Font || settings.h2Align || settings.h2LineHeight || settings.h2Indent !== undefined || settings.h2Bold !== undefined || settings.h2Italic !== undefined || settings.h2Color) {
      css += `\n.unemi-document-content h2 {`;
      if (settings.h2Size) css += ` font-size: ${settings.h2Size} !important;`;
      if (settings.h2Font) css += ` font-family: "${settings.h2Font}", sans-serif !important;`;
      if (settings.h2Align) css += ` text-align: ${settings.h2Align} !important;`;
      if (settings.h2LineHeight) css += ` line-height: ${settings.h2LineHeight} !important;`;
      if (settings.h2Indent) css += ` text-indent: ${settings.h2Indent} !important;`;
      if (settings.h2Bold !== undefined) css += ` font-weight: ${settings.h2Bold ? 'bold' : 'normal'} !important;`;
      if (settings.h2Italic !== undefined) css += ` font-style: ${settings.h2Italic ? 'italic' : 'normal'} !important;`;
      if (settings.h2Color) css += ` color: ${settings.h2Color} !important;`;
      css += ` }`;
    }

    // P (Cuerpo de texto)
    if (settings.pSize || settings.pFont || settings.pAlign || settings.pLineHeight || settings.pIndent !== undefined || settings.pBold !== undefined || settings.pItalic !== undefined || settings.pColor) {
      css += `\n.unemi-document-content, .unemi-document-content p, .unemi-document-content div:not(.unemi-academic-header):not(.unemi-academic-footer):not(.toc-container):not(.note):not(.math-expr) {`;
      if (settings.pSize) css += ` font-size: ${settings.pSize} !important;`;
      if (settings.pFont) css += ` font-family: "${settings.pFont}", sans-serif !important;`;
      if (settings.pAlign) css += ` text-align: ${settings.pAlign} !important;`;
      if (settings.pLineHeight) css += ` line-height: ${settings.pLineHeight} !important;`;
      if (settings.pIndent) css += ` text-indent: ${settings.pIndent} !important;`;
      if (settings.pBold !== undefined) css += ` font-weight: ${settings.pBold ? 'bold' : 'normal'} !important;`;
      if (settings.pItalic !== undefined) css += ` font-style: ${settings.pItalic ? 'italic' : 'normal'} !important;`;
      if (settings.pColor) css += ` color: ${settings.pColor} !important;`;
      css += ` }`;
    }
    
    // TABLAS (Custom table graphic formatting styles)
    if (settings.tableFontSize || settings.tableHeaderBg || settings.tableHeaderColor || settings.tableBorderColor || settings.tableCellPadding || settings.tableStriped || settings.tableBorderWidth) {
      css += `\n/* Table Formatting Rules */`;
      css += `\n.unemi-document-content table {`;
      css += `  word-wrap: break-word !important;`;
      css += `  border-collapse: collapse !important;`;
      if (settings.tableFontSize) css += ` font-size: ${settings.tableFontSize} !important;`;
      if (settings.tableBorderColor) css += ` border-color: ${settings.tableBorderColor} !important;`;
      css += ` }`;

      css += `\n.unemi-document-content table th, .unemi-document-content table td {`;
      if (settings.tableCellPadding) {
        css += ` padding: ${settings.tableCellPadding} !important;`;
      }
      if (settings.tableBorderColor) {
        css += ` border-color: ${settings.tableBorderColor} !important;`;
      }
      if (settings.tableBorderWidth) {
        css += ` border-width: ${settings.tableBorderWidth} !important;`;
        css += ` border-style: solid !important;`;
      }
      css += ` }`;

      css += `\n.unemi-document-content table th, .unemi-document-content table thead tr, .unemi-document-content table tr[bgcolor] {`;
      if (settings.tableHeaderBg) css += ` background-color: ${settings.tableHeaderBg} !important;`;
      if (settings.tableHeaderColor) css += ` color: ${settings.tableHeaderColor} !important;`;
      css += ` }`;

      if (settings.tableStriped) {
        css += `\n.unemi-document-content table tbody tr:nth-child(even) {`;
        css += ` background-color: rgba(0, 0, 0, 0.03) !important;`;
        css += ` }`;
      }
    }

    // Custom CSS input by the user (avoiding selector namespace collisions)
    if (settings.customAddedCss) {
      // We append it cleanly
      css += `\n/* User Custom Additional CSS */\n${settings.customAddedCss}`;
    }

    return css;
  };

  return (
    <div className="flex-1 bg-slate-100 flex flex-col h-full min-w-0 font-sans print:bg-white select-none relative">
      
      {/* Dynamic CSS Code Blocks compilation injected visually right here */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: ${settings.pageSize === 'letter' 
              ? `letter ${isPortrait ? 'portrait' : 'landscape'}` 
              : settings.pageSize === 'a4' 
                ? `a4 ${isPortrait ? 'portrait' : 'landscape'}` 
                : isPortrait ? '167.06mm 297mm' : '297mm 167.06mm'};
            margin: 0 !important;
          }
        }
        ${settings.blockStyleTitles || ''}
        ${settings.blockStyleHeader || ''}
        ${settings.blockStyleFooter || ''}
        ${settings.blockStylePageNum || ''}
        ${settings.blockStyleTOC || ''}
        ${settings.tableCustomCss || ''}
        ${getGraphicalAndCustomCSS()}
        ${settings.autoNumberHeadings ? `
        /* Numeración automática de títulos */
        body, .document-rendered-container {
          counter-reset: unemi-h1-counter !important;
        }
        .unemi-document-content h1 {
          counter-reset: unemi-h2-counter !important;
          counter-increment: unemi-h1-counter !important;
        }
        .unemi-document-content h1::before {
          content: counter(unemi-h1-counter) ". " !important;
        }
        .unemi-document-content h2 {
          counter-reset: unemi-h3-counter !important;
          counter-increment: unemi-h2-counter !important;
        }
        .unemi-document-content h2::before {
          content: counter(unemi-h1-counter) "." counter(unemi-h2-counter) " " !important;
        }
        .unemi-document-content h3 {
          counter-increment: unemi-h3-counter !important;
        }
        .unemi-document-content h3::before {
          content: counter(unemi-h1-counter) "." counter(unemi-h2-counter) "." counter(unemi-h3-counter) " " !important;
        }
        ` : ''}

        /* Detector de Desbordes Gráfico Visual */
        @media screen {
          .overflowing-element-width {
            outline: 2.5px dashed #f97316 !important;
            outline-offset: -2.5px !important;
            position: relative !important;
          }
          .overflowing-element-width::after {
            content: "⚠️ EXCEDE ANCHO (" attr(data-width-label) "px > MÁX " attr(data-allowed-width) "px)" !important;
            position: absolute !important;
            top: 2px !important;
            right: 2px !important;
            background-color: #f97316 !important;
            color: #ffffff !important;
            font-family: var(--font-sans), system-ui, sans-serif !important;
            font-size: 8px !important;
            font-weight: 800 !important;
            padding: 1.5px 5px !important;
            border-radius: 3px !important;
            z-index: 9999 !important;
            white-space: nowrap !important;
            pointer-events: none !important;
            box-shadow: 0 1px 4px rgba(0,0,0,0.2) !important;
          }

          .overflowing-element-height {
            outline: 2.5px dashed #ef4444 !important;
            outline-offset: -3.5px !important;
            position: relative !important;
          }
          .overflowing-element-height::after {
            content: "⚠️ EXCEDE LARGO (" attr(data-height-label) "px > MÁX " attr(data-allowed-height) "px)" !important;
            position: absolute !important;
            bottom: 2px !important;
            right: 2px !important;
            background-color: #ef4444 !important;
            color: #ffffff !important;
            font-family: var(--font-sans), system-ui, sans-serif !important;
            font-size: 8px !important;
            font-weight: 800 !important;
            padding: 1.5px 5px !important;
            border-radius: 3px !important;
            z-index: 9999 !important;
            white-space: nowrap !important;
            pointer-events: none !important;
            box-shadow: 0 1px 4px rgba(0,0,0,0.2) !important;
          }
        }
      ` }} />

      {/* 1. HIDDEN MEASUREMENT WORKSPACE (Maintained off-screen, matches the actual page widths to calculate wraps) */}
      <div className="absolute top-0 left-0 w-0 h-0 overflow-hidden pointer-events-none opacity-0 select-none">
        <div
          ref={hiddenMeasureRef}
          className="unemi-document-content select-none shrink-0"
          style={{
            width: `${contentWidth}px`,
            boxSizing: 'border-box',
          }}
          dangerouslySetInnerHTML={{ __html: resolvedHtmlContent }}
        />
      </div>

      {/* 2. TOP PREVIEW FUNCTIONALITIES HEADER */}
      <div className="p-3 bg-white border-b border-gray-200 flex items-center justify-between shadow-sm select-none shrink-0 print:hidden z-10">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-[#004080]" />
          <span className="font-bold text-xs text-gray-800 uppercase tracking-tight">Previsualizador</span>
          
          {/* Segmented Control Selector for previewMode */}
          <div className="flex items-center bg-gray-100 p-0.5 rounded-lg border border-gray-200 ml-2">
            <button
              type="button"
              onClick={() => setPreviewMode('paged')}
              className={`px-2.5 py-0.5 text-[10.5px] font-bold rounded transition-all cursor-pointer ${
                previewMode === 'paged'
                  ? 'bg-white text-[#004080] shadow-xs border border-gray-200/50'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              Hojas Estáticas
            </button>
            <button
              type="button"
              onClick={() => setPreviewMode('server')}
              className={`px-2.5 py-0.5 text-[10.5px] font-bold rounded transition-all cursor-pointer flex items-center gap-1 ${
                previewMode === 'server'
                  ? 'bg-[#004080] text-white shadow-xs'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${isSyncingServer ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
              Vista Interactiva (Servidor)
            </button>
          </div>

          {recalculating && (
            <div className="flex items-center gap-1 text-[10px] text-orange-500 font-bold bg-orange-50 px-2 py-0.5 rounded border border-orange-100">
              <RefreshCw className="w-2.5 h-2.5 animate-spin" />
              Paginando...
            </div>
          )}

          {/* Detector de Desbordes Integrado en Header */}
          <div className="relative flex items-center ml-2">
            {detectedOverflows.length > 0 ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowOverflowPopover(!showOverflowPopover)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 text-[11px] font-bold transition-all cursor-pointer shadow-xs active:scale-95 text-left"
                  title="Haga clic para ver el desglose de elementos que exceden los límites de la hoja"
                >
                  <span className="flex h-2 w-2 relative shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                  </span>
                  <span>⚠️ {detectedOverflows.length} {detectedOverflows.length === 1 ? 'desborde' : 'desbordes'} detectados</span>
                </button>

                {showOverflowPopover && (
                  <div className="absolute left-0 top-full mt-2 w-80 bg-slate-900 border border-slate-800 rounded-lg shadow-2xl p-3 z-[100] text-left max-h-[340px] overflow-y-auto select-text">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
                      <span className="text-[10.5px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5 font-sans">
                        ⚠️ Desglose de Desbordes
                        <span className="font-mono text-[9px] px-1.5 py-0.2 rounded bg-slate-950 text-amber-400 border border-amber-500/25">
                          DOC SECURE
                        </span>
                      </span>
                      <button 
                        type="button" 
                        onClick={() => setShowOverflowPopover(false)} 
                        className="text-slate-500 hover:text-white font-bold font-sans text-xs shrink-0 cursor-pointer p-0.5 hover:bg-slate-800 rounded transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="flex flex-col gap-2 max-h-[250px] overflow-y-auto custom-scrollbar">
                      {detectedOverflows.map((over, index) => (
                        <div key={over.id || index} className="p-2 rounded bg-slate-950/75 border border-slate-800 flex flex-col gap-1.5">
                          <div className="flex items-center justify-between text-[9.5px] font-bold">
                            <span className={over.type === 'ancho' ? 'text-orange-400' : 'text-rose-400'}>
                              {over.type === 'ancho' ? '↔️ Exceso de Ancho' : '↕️ Excede Altura / Largo'}
                            </span>
                            <span className="bg-slate-900 text-slate-350 border border-slate-800 px-1.5 py-0.2 rounded text-[8.5px] font-mono font-semibold">
                              PÁGINA {over.pageNumber}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-1.5 min-w-0">
                            <p className="flex-1 text-slate-300 font-mono text-[10px] bg-slate-900 px-1.5 py-1 rounded border border-slate-800/50 break-all select-all truncate">
                              Elemento: <span className="font-bold text-[#FF6600] font-mono">&lt;{over.tagName}&gt;</span>
                            </p>
                            {over.outerHTML && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (over.outerHTML) {
                                    navigator.clipboard.writeText(over.outerHTML);
                                    setCopiedId(over.id);
                                    setTimeout(() => setCopiedId(null), 2000);
                                  }
                                }}
                                className="px-2 py-1 shrink-0 rounded bg-slate-800 hover:bg-slate-700 active:scale-95 text-[9px] text-slate-200 font-bold flex items-center gap-1 transition-all cursor-pointer border border-slate-700/60"
                                title="Copiar código HTML completo de este elemento para solucionarlo"
                              >
                                {copiedId === over.id ? (
                                  <>
                                    <Check className="w-2.5 h-2.5 text-emerald-400" />
                                    <span className="text-emerald-400">Copiado</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-2.5 h-2.5 text-slate-400" />
                                    <span>Copiar</span>
                                  </>
                                )}
                              </button>
                            )}
                          </div>

                          <div className="text-[9px] text-slate-500 flex justify-between items-center bg-slate-950/40 px-1.5 py-0.5 rounded">
                            <span>Medido: <strong className="text-slate-300 font-mono">{over.measured}px</strong></span>
                            <span>Límite Neto: <strong className="text-slate-400 font-mono">{over.allowed}px</strong></span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-950/30 border border-emerald-900/30 text-emerald-400 text-[10.5px] font-bold select-none whitespace-nowrap">
                🛡️ Sin desbordes: Ajuste ideal
              </span>
            )}
          </div>
        </div>

        {/* Dynamic sheet guidelines and dimensions */}
        <div className="flex items-center gap-4">
          <button
            onClick={handleOpenPreview}
            disabled={generatingPreview}
            className="py-1.5 px-3 rounded bg-emerald-600 hover:bg-emerald-700 active:scale-[95%] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm border border-emerald-600/25 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Abrir el documento académico renderizado en una pestaña separada para que los scripts interactivos funcionen de forma limpia y fluida"
          >
            {generatingPreview ? (
              <>
                <RefreshCw className="w-4 h-4 text-white animate-spin" />
                Cargando...
              </>
            ) : (
              <>
                <ExternalLink className="w-4 h-4 text-white" />
                Open preview
              </>
            )}
          </button>

          <button
            onClick={onExportZIP}
            className="py-1.5 px-3 rounded bg-[#FF6600] text-white hover:bg-[#ff8533] active:scale-[95%] font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm border border-[#FF6600]/25"
            title="Exportar archivo compactado .zip del proyecto"
          >
            <FolderArchive className="w-4 h-4 text-white" />
            Exportar ZIP
          </button>

          <div className="h-4 w-[1px] bg-gray-200" />

          {/* Zoom controllers */}
          <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 p-0.5 rounded text-xs select-none">
            <button
              onClick={handleZoomOut}
              className="p-1 rounded text-gray-500 hover:text-gray-880 hover:bg-white active:scale-90 transition-all cursor-pointer"
              title="Reducir tamaño"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleResetZoom}
              className="px-2 font-bold tracking-tight text-gray-600 hover:text-gray-800 cursor-pointer"
              title="Restaurar zoom"
            >
              {zoom}%
            </button>
            <button
              onClick={handleZoomIn}
              className="p-1 rounded text-gray-500 hover:text-gray-880 hover:bg-white active:scale-90 transition-all cursor-pointer"
              title="Aumentar tamaño"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-4 w-[1px] bg-gray-200" />

          {/* Fullscreen Mode Icon Button */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded text-gray-500 hover:text-gray-850 hover:bg-gray-100 active:scale-95 transition-all cursor-pointer bg-gray-50 border border-gray-200 flex items-center justify-center"
            title={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4 text-gray-600" />
            ) : (
              <Maximize2 className="w-4 h-4 text-gray-600" />
            )}
          </button>
        </div>
      </div>

      {/* 4. ACTUAL ENEMY PAGE SHEETS STAGE */}
      <div className={`flex-1 overflow-auto custom-scrollbar print:p-0 print:overflow-visible print:bg-white bg-slate-150 flex flex-col items-center select-none min-h-0 w-full ${previewMode === 'server' ? 'p-0' : 'p-8'}`}>
        {previewMode === 'server' && (
          <div className="w-full h-full flex flex-col overflow-hidden bg-white relative shrink-0">
            {/* Sync status indicator overlay */}
            <div className={`absolute top-3 right-3 px-3 py-1 rounded-full text-[10px] font-bold z-20 flex items-center gap-1.5 shadow-md border ${
              isSyncingServer 
                ? 'bg-amber-50 text-amber-700 border-amber-20 border-amber-200/50' 
                : 'bg-emerald-50 text-emerald-700 border-emerald-200/50'
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${isSyncingServer ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
              {isSyncingServer ? 'Sincronizando cambios cambiados...' : 'Sincronizado'}
            </div>
            
            {/* Server preview iframe */}
            {serverPreviewId ? (
              <iframe
                id="unemi-server-iframe"
                src={`/preview/${serverPreviewId}`}
                className="w-full h-full border-0 bg-slate-50"
                title="Servidor Interactivo de Previsualización"
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-500 gap-4 bg-slate-50">
                <RefreshCw className="w-10 h-10 text-[#004080] animate-spin" />
                <div>
                  <h3 className="font-bold text-sm text-gray-700">Compilando documento en servidor...</h3>
                  <p className="text-xs text-gray-400 mt-1">Generando la vista interactiva con soporte completo para eventos y script tags.</p>
                </div>
              </div>
            )}
          </div>
        )}

        <div
          className={`${previewMode === 'server' ? 'invisible absolute pointer-events-none h-0 w-0 overflow-hidden' : ''} flex flex-col gap-8 print:gap-0 transition-transform origin-top`}
          style={previewMode === 'server' ? {} : {
            transform: `scale(${zoom / 100})`,
            marginBottom: `${(zoom - 100) * 10}px`,
          }}
        >
          {/* PAGE 1: COVER PAGE (No headers/footers) */}
          <CoverPage config={resolvedCover} pageSize={settings.pageSize} orientation={settings.orientation} />

          {/* PAGE 2: TABLE OF CONTENTS (Optional academic page, strictly out of content.html) */}
          {settings.showTOC && (
            <PageTemplate
              pageNumber={2}
              totalPages={paginatedPages.length + 2}
              pageSize={settings.pageSize}
              settings={settings}
              showGuides={settings.showGuides}
              coverConfig={resolvedCover}
            >
              <div className="toc-container select-text">
                <h3>{settings.tocTitle || "Tabla de Contenidos"}</h3>
                <ul className="toc-list">
                  {dynamicHeadings.map((heading, hIdx) => (
                    <li 
                      key={hIdx} 
                      className="flex items-end mb-2.5 text-[12.5px] text-gray-700" 
                      style={{ paddingLeft: `${Math.max(0, (heading.level - 1) * 16)}px` }}
                    >
                      <span className="toc-title shrink-0 font-medium">{heading.text}</span>
                      <span className="toc-dots flex-1" />
                      <span className="toc-page font-bold text-[#004080] tabular-nums">{heading.page}</span>
                    </li>
                  ))}
                  {dynamicHeadings.length === 0 && (
                    <li className="text-gray-400 italic text-center w-full py-4 flex justify-center items-center">
                      (Inserte títulos H1 o H2 en el editor de contenido para generar el índice automático)
                    </li>
                  )}
                </ul>
              </div>
            </PageTemplate>
          )}

          {/* PAGES 3+ (or 2+): Dynamic pagination sheets */}
          {paginatedPages.length > 0 ? (
            paginatedPages.map((pageHTMLs, index) => {
              const pageHTMLJoined = pageHTMLs.join('');

              return (
                <PageTemplate
                  key={index}
                  pageNumber={index + 2 + (settings.showTOC ? 1 : 0)} // Content pages start at Page 2 or Page 3
                  totalPages={paginatedPages.length + 1 + (settings.showTOC ? 1 : 0)}
                  pageSize={settings.pageSize}
                  settings={settings}
                  showGuides={settings.showGuides}
                  coverConfig={resolvedCover}
                >
                  <div
                    className="unemi-document-body"
                    dangerouslySetInnerHTML={{ __html: pageHTMLJoined }}
                  />
                </PageTemplate>
              );
            })
          ) : (
            /* Blank Fallback content page in case there is no body content */
            <PageTemplate
              pageNumber={settings.showTOC ? 3 : 2}
              totalPages={settings.showTOC ? 3 : 2}
              pageSize={settings.pageSize}
              settings={settings}
              showGuides={settings.showGuides}
              coverConfig={resolvedCover}
            >
              <div className="flex flex-col items-center justify-center text-center h-full text-gray-300 gap-2 select-none border-2 border-dashed border-gray-100 rounded-lg p-6">
                <FileText className="w-12 h-12 text-gray-200" />
                <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Sin contenido cargado</span>
                <p className="text-[11px] text-gray-400 max-w-[320px] leading-relaxed">
                  Utilice el panel editor en la columna izquierda para añadir párrafos, listas o tablas académicas en HTML. Su contenido aparecerá en esta página.
                </p>
              </div>
            </PageTemplate>
          )}
        </div>
      </div>
    </div>
  );
}
