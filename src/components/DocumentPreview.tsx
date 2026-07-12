/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useEffect } from 'react';
import { markdownParser } from '../utils/markdownParser';
import katex from 'katex';
import { CoverConfig, PageSettings, UploadedFile, HTMLBlock, BibliographyItem } from '../types';
import CoverPage from './CoverPage';
import PageTemplate from './PageTemplate';
import { getAPALastNames, formatAPABibliographyItem, extractAPAYear } from '../utils/apaFormatter';
import { formatFontSize } from '../utils/fontUtils';
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
  isCompiling?: boolean;
  compiledCover?: CoverConfig;
  compiledSettings?: PageSettings;
  compiledHtmlContent?: string;
  compiledUploadedFiles?: UploadedFile[];
  compiledHtmlBlocks?: HTMLBlock[];
  compiledBibliography?: BibliographyItem[];
}

interface HeadingItem {
  text: string;
  page: number;
  level: number;
  pageRelative?: number;
}

const BASE_TOC_CSS = `
/* Table of Contents base layout styles */
.toc-container {
  margin: 0;
  padding: 0;
}
.toc-header {
  margin-top: 0;
  margin-bottom: 24px;
  font-size: 16px;
  font-weight: bold;
  text-align: center;
}
.toc-list {
  list-style-type: none;
  padding-left: 0;
  margin: 0;
}
.toc-item {
  display: flex;
  align-items: flex-end;
  margin-bottom: 12px;
}
.toc-item::before {
  content: none;
}
.toc-title {
  white-space: nowrap;
  flex-shrink: 0;
}
.toc-dots {
  flex-grow: 1;
  border-bottom: 1px dotted black;
  margin: 0 8px;
}
.toc-page {
  font-weight: bold;
  flex-shrink: 0;
}
`;

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

function compileAndProcessMarkdown(
  text: string,
  isMarkdown: boolean,
  figureMap: Map<string, number>,
  tableMap: Map<string, number>,
  figureCounterRef: { val: number },
  tableCounterRef: { val: number }
): string {
  if (!isMarkdown) return text;

  let code = text;
  const generatedFigures = new Map<string, string>();
  const generatedTables = new Map<string, string>();

  // 1. Figures: ![Alt](img.png){...} (supports both simple {#fig-id} and multiline key-value pairs)
  const figRegex = /!\[([^\]]*)\]\(([^)]*)\)\s*\{([^}]+)\}/g;
  code = code.replace(figRegex, (match, altText, imgSrc, attrsText) => {
    let idVal = '';
    let widthVal = '';
    let alignVal = 'center';
    let wrapVal = 'none';
    let captionVal = altText || '';
    let noteVal = '';

    const trimmedAttrs = attrsText.trim();
    if (trimmedAttrs.startsWith('#')) {
      idVal = trimmedAttrs.substring(1);
    } else {
      // Parse key-value attributes
      const lines = trimmedAttrs.split('\n');
      lines.forEach(line => {
        const parts = line.split('=');
        if (parts.length >= 2) {
          const key = parts[0].trim().toLowerCase();
          let val = parts.slice(1).join('=').trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.substring(1, val.length - 1);
          }
          if (key === 'id') idVal = val;
          else if (key === 'width') widthVal = val;
          else if (key === 'align') alignVal = val;
          else if (key === 'wrap') wrapVal = val;
          else if (key === 'caption') captionVal = val;
          else if (key === 'note') noteVal = val;
        }
      });
    }

    if (!idVal) {
      idVal = 'fig-' + Math.random().toString(36).substring(2, 8);
    }

    const figNumber = figureCounterRef.val++;
    figureMap.set(idVal, figNumber);

    // Styling according to wrap and alignment values (APA 7 Compliant)
    let containerStyle = "font-family: 'Times New Roman', Times, serif; margin: 24px 0; clear: both; width: 100%; display: block;";
    let imgStyle = "height: auto; border-radius: 4px; display: block;";

    if (widthVal) {
      imgStyle += ` width: ${widthVal};`;
    } else {
      imgStyle += " max-width: 100%;";
    }

    if (wrapVal === 'left') {
      containerStyle = "font-family: 'Times New Roman', Times, serif; float: left; margin: 8px 24px 20px 0; width: auto; max-width: 50%; display: block;";
      imgStyle += " margin: 0;";
    } else if (wrapVal === 'right') {
      containerStyle = "font-family: 'Times New Roman', Times, serif; float: right; margin: 8px 0 20px 24px; width: auto; max-width: 50%; display: block;";
      imgStyle += " margin: 0;";
    } else if (wrapVal === 'square') {
      containerStyle = "font-family: 'Times New Roman', Times, serif; float: left; margin: 8px 24px 20px 0; width: auto; max-width: 45%; display: block;";
      imgStyle += " margin: 0;";
    } else {
      // 'none' or 'top-bottom'
      containerStyle = "font-family: 'Times New Roman', Times, serif; clear: both; display: block; width: 100%;";
    }

    // Set horizontal alignment inside image parent container
    let imgContainerStyle = "width: 100%; display: block; margin: 12px 0;";
    if (wrapVal === 'none' || !wrapVal) {
      if (alignVal === 'center') {
        imgContainerStyle += " text-align: center;";
        imgStyle += " margin: 0 auto;";
      } else if (alignVal === 'right') {
        imgContainerStyle += " text-align: right;";
        imgStyle += " margin: 0 0 0 auto;";
      } else {
        imgContainerStyle += " text-align: left;";
        imgStyle += " margin: 0;";
      }
    } else {
      imgStyle += " margin: 0;";
    }

    // APA 7 structure:
    // Line 1: Figura X in Bold (flush left of page/container, no indent)
    // Line 2: Title in Italics (flush left of page/container, no indent)
    // Line 3: Image
    // Line 4: Note underneath (flush left, no indent, with Nota. in italics)
    const figHtml = `
<div id="${idVal}" class="unemi-rendered-figure" style="${containerStyle}">
  <div style="text-align: left !important; margin-bottom: 8px; font-family: 'Times New Roman', Times, serif; width: 100% !important; display: block !important; text-indent: 0 !important; margin-left: 0 !important; padding-left: 0 !important;">
    <strong style="display: block !important; font-weight: bold !important; font-size: 16px !important; margin-bottom: 2px !important; color: #000 !important; text-align: left !important; text-indent: 0 !important; margin-left: 0 !important;">Figura ${figNumber}</strong>
    <em style="display: block !important; font-style: italic !important; font-size: 16px !important; margin-bottom: 8px !important; color: #000 !important; text-align: left !important; text-indent: 0 !important; margin-left: 0 !important;">${captionVal}</em>
  </div>
  <div style="${imgContainerStyle}">
    <img src="${imgSrc}" alt="${captionVal}" style="${imgStyle}" />
  </div>
  ${noteVal ? `<div style="font-size: 16px !important; color: #000 !important; text-align: left !important; margin-top: 6px !important; font-family: 'Times New Roman', Times, serif !important; line-height: 1.4 !important; width: 100% !important; display: block !important; text-indent: 0 !important; margin-left: 0 !important; padding-left: 0 !important;"><em style="font-style: italic !important;">Nota.</em> ${noteVal}</div>` : ''}
</div>
    `;
    generatedFigures.set(idVal, figHtml);
    return `FIGPLACEHOLDER-${idVal}`;
  });

  // 2. Tables with captions: table followed by : Caption {#tbl-id}
  const tableCaptionRegex = /((?:^|\n)(?:[ \t]*\|[^\n]*(?:\n|$))+)\s*:\s*([^\n]+?)\s*\{#(tbl-[a-zA-Z0-9_-]+)\}/g;
  code = code.replace(tableCaptionRegex, (match, tableMarkdown, captionText, tblId) => {
    const tblNumber = tableCounterRef.val++;
    tableMap.set(tblId, tblNumber);
    
    const tableHtml = String(markdownParser.parse(tableMarkdown)).trim();
    
    const captionHtml = `
  <caption style="caption-side: top; text-align: left; font-family: 'Times New Roman', Times, serif; font-size: 14px; color: #333; margin-bottom: 8px;">
    <strong style="display: block; font-weight: bold;">Tabla ${tblNumber}</strong>
    <span class="caption-text" style="display: block; font-style: italic; font-weight: normal; margin-top: 4px;">${captionText}</span>
  </caption>
    `;
    
    const modifiedTableHtml = tableHtml.replace(/<table([^>]*)>/i, `<table$1>${captionHtml}`);
    generatedTables.set(tblId, modifiedTableHtml);
    return `\nTBLPLACEHOLDER-${tblId}\n`;
  });

  // 3. Parse Markdown
  let resultHtml = String(markdownParser.parse(code));

  // 4. Restore placeholders
  generatedFigures.forEach((figHtml, figId) => {
    const wrappedRegex = new RegExp(`<p>\\s*FIGPLACEHOLDER-${figId}\\s*</p>`, 'g');
    if (wrappedRegex.test(resultHtml)) {
      resultHtml = resultHtml.replace(wrappedRegex, figHtml);
    } else {
      resultHtml = resultHtml.replace(`FIGPLACEHOLDER-${figId}`, figHtml);
    }
  });

  generatedTables.forEach((tableHtml, tblId) => {
    const wrappedRegex = new RegExp(`<p>\\s*TBLPLACEHOLDER-${tblId}\\s*</p>`, 'g');
    if (wrappedRegex.test(resultHtml)) {
      resultHtml = resultHtml.replace(wrappedRegex, tableHtml);
    } else {
      resultHtml = resultHtml.replace(`TBLPLACEHOLDER-${tblId}`, tableHtml);
    }
  });

  return resultHtml;
}

const toolbarHTML_Preview = `<!-- Floating Academic Toolbar (Omitted when printing) -->
  <div id="unemi-academic-toolbar" class="fixed top-4 right-4 z-50 print:hidden flex items-center gap-2 bg-slate-900/95 text-slate-300 px-2.5 py-1.5 border border-slate-800 rounded-lg shadow-xl backdrop-blur-sm select-none">
    <!-- Zoom Out -->
    <button id="unemi-zoom-out" title="Reducir" class="hover:bg-slate-800 hover:text-white p-1.5 rounded transition-all active:scale-95 cursor-pointer flex items-center justify-center">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
    </button>
    <!-- Zoom indicator/reset -->
    <span id="unemi-zoom-indicator" title="Restablecer zoom" class="text-[11px] font-mono font-medium min-w-[36px] text-center cursor-pointer hover:text-white">100%</span>
    <!-- Zoom In -->
    <button id="unemi-zoom-in" title="Aumentar" class="hover:bg-slate-800 hover:text-white p-1.5 rounded transition-all active:scale-95 cursor-pointer flex items-center justify-center">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
    </button>
    <div class="h-3 w-[1px] bg-slate-800"></div>
    <!-- Play presentation -->
    <button id="unemi-start-presentation" title="Iniciar Presentación" class="hover:bg-slate-800 hover:text-white p-1.5 rounded transition-all active:scale-95 cursor-pointer text-orange-400 flex items-center justify-center">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <polygon points="6 4 20 12 6 20 6 4" fill="currentColor"></polygon>
      </svg>
    </button>
    <div class="h-3 w-[1px] bg-slate-800"></div>
    <!-- Print -->
    <button onclick="window.print()" title="Imprimir" class="hover:bg-slate-800 hover:text-white p-1.5 rounded transition-all active:scale-95 cursor-pointer flex items-center justify-center">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2m-2-5H8v8h8v-8z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
      </svg>
    </button>
  </div>`;

export default function DocumentPreview({
  cover: liveCover,
  settings: liveSettings,
  htmlContent,
  setPageCount,
  onExportZIP,
  isFullscreen,
  setIsFullscreen,
  uploadedFiles = [],
  htmlBlocks = [],
  bibliography = [],
  isCompiling = false,
  compiledCover,
  compiledSettings,
  compiledHtmlContent,
  compiledUploadedFiles = [],
  compiledHtmlBlocks = [],
  compiledBibliography = [],
}: DocumentPreviewProps) {
  const cover = liveCover;
  const settings = liveSettings;

  const hiddenMeasureRef = useRef<HTMLDivElement>(null);
  const savedScrollTopRef = useRef<number>(0);
  const lastWidthRef = useRef<number>(0);
  const lastHeightRef = useRef<number>(0);
  const lastSyncHtmlRef = useRef<string>('');
  const [isScrollSyncing, setIsScrollSyncing] = useState<boolean>(false);

  const handleIframeLoad = (e: React.SyntheticEvent<HTMLIFrameElement>) => {
    const iframe = e.currentTarget;
    if (!iframe || !iframe.contentWindow) return;

    setIsScrollSyncing(true);

    const targetScroll = savedScrollTopRef.current;
    if (targetScroll > 0) {
      iframe.contentWindow.scrollTo(0, targetScroll);
      
      // Retry in a few timeouts to allow dynamic elements to finish layout/painting
      setTimeout(() => {
        if (iframe.contentWindow) iframe.contentWindow.scrollTo(0, targetScroll);
      }, 50);
      setTimeout(() => {
        if (iframe.contentWindow) iframe.contentWindow.scrollTo(0, targetScroll);
      }, 150);
      setTimeout(() => {
        if (iframe.contentWindow) iframe.contentWindow.scrollTo(0, targetScroll);
        setIsScrollSyncing(false);
      }, 350);
    } else {
      setTimeout(() => {
        setIsScrollSyncing(false);
      }, 150);
    }

    // 2. Attach scroll listener to keep track of any scrolling the user does
    const handleScroll = () => {
      if (iframe.contentWindow) {
        savedScrollTopRef.current = iframe.contentWindow.scrollY || iframe.contentWindow.document.documentElement.scrollTop;
      }
    };

    iframe.contentWindow.addEventListener('scroll', handleScroll);
  };

  const [paginatedPages, setPaginatedPages] = useState<string[][]>([]);
  const [paginatedTOCPages, setPaginatedTOCPages] = useState<HeadingItem[][]>([]);
  const [zoom, setZoom] = useState<number>(100);
  const [recalculating, setRecalculating] = useState<boolean>(false);
  const [dynamicHeadings, setDynamicHeadings] = useState<HeadingItem[]>([]);

  const renderPageHTML = (html: string) => {
    if (!html.includes('data-heading-ref=')) return html;
    
    return html.replace(/<span[^>]*class="toc-page"[^>]*data-heading-ref="(\d+)"[^>]*>999<\/span>/g, (match, refStr) => {
      const idx = parseInt(refStr, 10);
      const heading = dynamicHeadings[idx];
      if (heading) {
        return `<span class="toc-page" data-heading-ref="${idx}">${heading.page}</span>`;
      }
      return `<span class="toc-page" data-heading-ref="${idx}">...</span>`;
    });
  };
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
          css += `\n.unemi-document-content, .unemi-document-content p, .unemi-document-content div:not(.unemi-academic-header):not(.unemi-academic-footer):not(.toc-container):not(.note):not(.math-expr):not(.unemi-bibliography-item):not(.unemi-bibliography-title) {`;
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

        // Código (Monospace) Graphical Styling
        const blockTheme = settings.blockCodeTheme || settings.codeTheme || 'academic';
        const rawBlockSize = settings.blockCodeSize !== undefined ? settings.blockCodeSize : (settings.codeSize || '13px');
        const blockSize = formatFontSize(rawBlockSize, '13px');
        const inlineTheme = settings.inlineCodeTheme || settings.codeTheme || 'academic';
        const rawInlineSize = settings.inlineCodeSize !== undefined ? settings.inlineCodeSize : '12px';
        const inlineSize = formatFontSize(rawInlineSize, '12px');

        css += `\n.unemi-document-content pre, .unemi-document-content pre * {`;
        css += ` font-family: "Fira Code", "Courier New", Courier, monospace !important;`;
        css += ` font-size: ${blockSize} !important;`;
        css += ` text-indent: 0px !important;`;
        css += ` }`;

        css += `\n.unemi-document-content code:not(pre code) {`;
        css += ` font-family: "Fira Code", "Courier New", Courier, monospace !important;`;
        css += ` font-size: ${inlineSize} !important;`;
        css += ` text-indent: 0px !important;`;
        css += ` }`;
        
        css += `\n.unemi-document-content pre {`;
        css += ` padding: 12px 16px !important;`;
        css += ` margin: 16px 0 !important;`;
        css += ` border-radius: 6px !important;`;
        css += ` overflow-x: auto !important;`;
        css += ` line-height: 1.5 !important;`;
        css += ` text-indent: 0px !important;`;
        css += ` }`;

        // Inline code styling
        let inlineBg = '#f1f5f9';
        let inlineColor = '#0f172a';
        let inlineBorder = '#cbd5e1';
        if (inlineTheme === 'dracula') {
          inlineBg = '#282a36';
          inlineColor = '#f8f8f2';
          inlineBorder = '#44475a';
        } else if (inlineTheme === 'monokai') {
          inlineBg = '#272822';
          inlineColor = '#f8f8f2';
          inlineBorder = '#3e3d32';
        } else if (inlineTheme === 'github-light') {
          inlineBg = '#f6f8fa';
          inlineColor = '#24292f';
          inlineBorder = '#d0d7de';
        } else if (inlineTheme === 'solarized-light') {
          inlineBg = '#fdf6e3';
          inlineColor = '#657b83';
          inlineBorder = '#efe8d4';
        } else if (inlineTheme === 'nord') {
          inlineBg = '#2e3440';
          inlineColor = '#d8dee9';
          inlineBorder = '#3b4252';
        } else {
          // academic / default light
          inlineBg = '#f8fafc';
          inlineColor = '#0f172a';
          inlineBorder = '#cbd5e1';
        }

        css += `\n.unemi-document-content code:not(pre code) {`;
        css += ` background-color: ${inlineBg} !important;`;
        css += ` color: ${inlineColor} !important;`;
        css += ` padding: 2px 5px !important;`;
        css += ` border-radius: 4px !important;`;
        css += ` border: 1px solid ${inlineBorder} !important;`;
        css += ` display: inline !important;`;
        css += ` text-indent: 0 !important;`;
        css += ` word-break: break-word !important;`;
        css += ` box-decoration-break: clone !important;`;
        css += ` -webkit-box-decoration-break: clone !important;`;
        css += ` }`;
        
        if (blockTheme === 'dracula') {
          css += `\n.unemi-document-content pre { background-color: #282a36 !important; border: 1px solid #44475a !important; color: #f8f8f2 !important; }`;
          css += `\n.unemi-document-content pre code { color: #f8f8f2 !important; background-color: transparent !important; padding: 0 !important; }`;
          css += `\n.unemi-document-content pre .token.comment, .unemi-document-content pre .token.prolog, .unemi-document-content pre .token.doctype, .unemi-document-content pre .token.cdata { color: #6272a4 !important; font-style: italic !important; }`;
          css += `\n.unemi-document-content pre .token.keyword, .unemi-document-content pre .token.operator, .unemi-document-content pre .token.atrule { color: #ff79c6 !important; }`;
          css += `\n.unemi-document-content pre .token.string, .unemi-document-content pre .token.char { color: #f1fa8c !important; }`;
          css += `\n.unemi-document-content pre .token.function, .unemi-document-content pre .token.class-name { color: #50fa7b !important; }`;
          css += `\n.unemi-document-content pre .token.number, .unemi-document-content pre .token.boolean, .unemi-document-content pre .token.constant { color: #bd93f9 !important; }`;
          css += `\n.unemi-document-content pre .token.punctuation, .unemi-document-content pre .token.property, .unemi-document-content pre .token.tag { color: #f8f8f2 !important; }`;
        } else if (blockTheme === 'monokai') {
          css += `\n.unemi-document-content pre { background-color: #272822 !important; border: 1px solid #3e3d32 !important; color: #f8f8f2 !important; }`;
          css += `\n.unemi-document-content pre code { color: #f8f8f2 !important; background-color: transparent !important; padding: 0 !important; }`;
          css += `\n.unemi-document-content pre .token.comment, .unemi-document-content pre .token.prolog, .unemi-document-content pre .token.doctype, .unemi-document-content pre .token.cdata { color: #75715e !important; font-style: italic !important; }`;
          css += `\n.unemi-document-content pre .token.keyword, .unemi-document-content pre .token.operator, .unemi-document-content pre .token.atrule { color: #f92672 !important; }`;
          css += `\n.unemi-document-content pre .token.string, .unemi-document-content pre .token.char { color: #e6db74 !important; }`;
          css += `\n.unemi-document-content pre .token.function, .unemi-document-content pre .token.class-name { color: #a6e22e !important; }`;
          css += `\n.unemi-document-content pre .token.number, .unemi-document-content pre .token.boolean, .unemi-document-content pre .token.constant { color: #ae81ff !important; }`;
          css += `\n.unemi-document-content pre .token.punctuation, .unemi-document-content pre .token.property, .unemi-document-content pre .token.tag { color: #f8f8f2 !important; }`;
        } else if (blockTheme === 'github-light') {
          css += `\n.unemi-document-content pre { background-color: #f6f8fa !important; border: 1px solid #d0d7de !important; color: #24292f !important; }`;
          css += `\n.unemi-document-content pre code { color: #24292f !important; background-color: transparent !important; padding: 0 !important; }`;
          css += `\n.unemi-document-content pre .token.comment, .unemi-document-content pre .token.prolog, .unemi-document-content pre .token.doctype, .unemi-document-content pre .token.cdata { color: #6e7781 !important; font-style: italic !important; }`;
          css += `\n.unemi-document-content pre .token.keyword, .unemi-document-content pre .token.operator, .unemi-document-content pre .token.atrule { color: #cf222e !important; font-weight: bold !important; }`;
          css += `\n.unemi-document-content pre .token.string, .unemi-document-content pre .token.char { color: #0a3069 !important; }`;
          css += `\n.unemi-document-content pre .token.function, .unemi-document-content pre .token.class-name { color: #8250df !important; }`;
          css += `\n.unemi-document-content pre .token.number, .unemi-document-content pre .token.boolean, .unemi-document-content pre .token.constant { color: #0550ae !important; }`;
          css += `\n.unemi-document-content pre .token.punctuation, .unemi-document-content pre .token.property, .unemi-document-content pre .token.tag { color: #24292f !important; }`;
        } else if (blockTheme === 'solarized-light') {
          css += `\n.unemi-document-content pre { background-color: #fdf6e3 !important; border: 1px solid #efe8d4 !important; color: #657b83 !important; }`;
          css += `\n.unemi-document-content pre code { color: #657b83 !important; background-color: transparent !important; padding: 0 !important; }`;
          css += `\n.unemi-document-content pre .token.comment, .unemi-document-content pre .token.prolog, .unemi-document-content pre .token.doctype, .unemi-document-content pre .token.cdata { color: #93a1a1 !important; font-style: italic !important; }`;
          css += `\n.unemi-document-content pre .token.keyword, .unemi-document-content pre .token.operator, .unemi-document-content pre .token.atrule { color: #859900 !important; }`;
          css += `\n.unemi-document-content pre .token.string, .unemi-document-content pre .token.char { color: #2aa198 !important; }`;
          css += `\n.unemi-document-content pre .token.function, .unemi-document-content pre .token.class-name { color: #268bd2 !important; }`;
          css += `\n.unemi-document-content pre .token.number, .unemi-document-content pre .token.boolean, .unemi-document-content pre .token.constant { color: #d33682 !important; }`;
          css += `\n.unemi-document-content pre .token.punctuation, .unemi-document-content pre .token.property, .unemi-document-content pre .token.tag { color: #586e75 !important; }`;
        } else if (blockTheme === 'nord') {
          css += `\n.unemi-document-content pre { background-color: #2e3440 !important; border: 1px solid #3b4252 !important; color: #d8dee9 !important; }`;
          css += `\n.unemi-document-content pre code { color: #d8dee9 !important; background-color: transparent !important; padding: 0 !important; }`;
          css += `\n.unemi-document-content pre .token.comment, .unemi-document-content pre .token.prolog, .unemi-document-content pre .token.doctype, .unemi-document-content pre .token.cdata { color: #4c566a !important; font-style: italic !important; }`;
          css += `\n.unemi-document-content pre .token.keyword, .unemi-document-content pre .token.operator, .unemi-document-content pre .token.atrule { color: #81a1c1 !important; }`;
          css += `\n.unemi-document-content pre .token.string, .unemi-document-content pre .token.char { color: #a3be8c !important; }`;
          css += `\n.unemi-document-content pre .token.function, .unemi-document-content pre .token.class-name { color: #88c0d0 !important; }`;
          css += `\n.unemi-document-content pre .token.number, .unemi-document-content pre .token.boolean, .unemi-document-content pre .token.constant { color: #b48ead !important; }`;
          css += `\n.unemi-document-content pre .token.punctuation, .unemi-document-content pre .token.property, .unemi-document-content pre .token.tag { color: #eceff4 !important; }`;
        } else {
          // academic / default
          css += `\n.unemi-document-content pre { background-color: #f8fafc !important; border: 1px solid #cbd5e1 !important; color: #0f172a !important; }`;
          css += `\n.unemi-document-content pre code { color: #0f172a !important; background-color: transparent !important; padding: 0 !important; }`;
          css += `\n.unemi-document-content pre .token.comment, .unemi-document-content pre .token.prolog, .unemi-document-content pre .token.doctype, .unemi-document-content pre .token.cdata { color: #64748b !important; font-style: italic !important; }`;
          css += `\n.unemi-document-content pre .token.keyword, .unemi-document-content pre .token.operator, .unemi-document-content pre .token.atrule { color: #0f172a !important; font-weight: bold !important; }`;
          css += `\n.unemi-document-content pre .token.string, .unemi-document-content pre .token.char { color: #0f172a !important; font-style: italic !important; }`;
          css += `\n.unemi-document-content pre .token.function, .unemi-document-content pre .token.class-name { color: #0f172a !important; }`;
          css += `\n.unemi-document-content pre .token.number, .unemi-document-content pre .token.boolean, .unemi-document-content pre .token.constant { color: #0f172a !important; }`;
          css += `\n.unemi-document-content pre .token.punctuation, .unemi-document-content pre .token.property, .unemi-document-content pre .token.tag { color: #0f172a !important; }`;
        }

        // Bibliography styling
        css += `
        .unemi-bibliography-item {
          padding-left: 0.5in !important;
          text-indent: -0.5in !important;
          line-height: 2.0 !important;
          font-size: 16px !important;
          font-family: 'Times New Roman', Times, serif !important;
          text-align: left !important;
          display: block !important;
        }
        .unemi-bibliography-title {
          font-family: 'Times New Roman', Times, serif !important;
          font-size: 16px !important;
          font-weight: bold !important;
          text-align: center !important;
          margin-top: 24px !important;
          margin-bottom: 24px !important;
          display: block !important;
        }
        .unemi-margin-element img {
          width: 100% !important;
          height: 100% !important;
          object-fit: fill !important;
        }
        `;

        return css;
      };

      const cleanHTML_PreviewMode = `<!DOCTYPE html>
<html lang="es" data-unemi-preview="v1">
<head>
  <!-- PREVIEW_MODE_V1 -->
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${cover.title || 'Plantilla de Documento UNEMI'}</title>
  
  <script src="https://cdn.tailwindcss.com"></script>
  
  <!-- KaTeX CSS for mathematical symbol styling -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">
  
  <!-- PrismJS tomorrow dark theme for code blocks -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/themes/prism-tomorrow.min.css">
 
  <style id="unemi-preview-style-v1">` + `
    /* UNIQUE_PREVIEW_V1 */
    /* PREVIEW_MODE_V1_STYLE_START */` + `
    /* PREVIEW_MODE_V1_CSS_BODY */
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Space+Grotesk:wght@400;500;600;700&family=Fira+Code:wght@400;500&display=swap');` + `
    /* PREVIEW_MODE_V1_BOX_SIZING */
    * {
      box-sizing: border-box;
    }` + `
    /* PREVIEW_MODE_V1_BODY_HTML */
    body, html {
      margin: 0;
      padding: 0;
      background-color: #fafafa !important;
      font-family: "Inter", system-ui, -apple-system, sans-serif;
      text-rendering: optimizeLegibility;
      -webkit-font-smoothing: antialiased;
    }` + `
    /* PREVIEW_MODE_V1_RENDERED_CONTAINER */
    .document-rendered-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 32px;
      padding: 48px 24px;
      background-color: #fafafa !important;
    }

    /* APA 7 Run-in (inline) Headings */
    .unemi-document-content .apa-runin {
      display: inline !important;
      font-family: "Times New Roman", Times, Georgia, serif !important;
      font-size: 16px !important;
      color: #000000 !important;
      line-height: 1.8 !important;
    }

    .unemi-document-content .apa-runin.apa-level1 {
      font-weight: bold !important;
    }

    .unemi-document-content .apa-runin.apa-level2 {
      font-weight: bold !important;
    }

    .unemi-document-content .apa-runin.apa-level3 {
      font-weight: bold !important;
      font-style: italic !important;
    }

    .unemi-document-content .apa-runin.apa-level4 {
      font-weight: bold !important;
      padding-left: 0px !important;
    }

    .unemi-document-content .apa-runin.apa-level5 {
      font-weight: bold !important;
      font-style: italic !important;
      padding-left: 0px !important;
    }

    div[name^="document-page-"] {
      position: relative !important;
      background-color: #ffffff !important;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1) !important;
      border: none !important;
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
      border: none !important;
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
      text-indent: 0px !important;
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
      text-indent: 0px !important;
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
      text-indent: 0px !important;
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

    .unemi-document-content ul:not(.toc-list) {
      list-style-type: disc !important;
      padding-left: 0.5in !important;
      margin-bottom: 12px !important;
    }

    .unemi-document-content ul:not(.toc-list) li:not(.toc-item) {
      position: relative !important;
      margin-bottom: 6px !important;
      line-height: 1.8 !important;
    }

    .unemi-document-content ul:not(.toc-list) li:not(.toc-item)::before {
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
      div[name^="document-page-"]:last-of-type {
        page-break-after: avoid !important;
        break-after: avoid !important;
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
      .print-page-boundary {
        margin: 0px !important;
        padding: 0px !important;
      }
      @page {
        margin: 0 !important;
        size: ${settings.pageSize === 'letter' ? '8.5in 11in' : settings.pageSize === 'a4' ? '210mm 297mm' : '297mm 167.06mm'} ${isPortrait ? 'portrait' : 'landscape'};
      }
    }
    
    /* BASE TOC STYLING PRE-INJECTED BEFORE USER'S CUSTOM TOC CSS */
    ${BASE_TOC_CSS}
    
    /* BLOQUES DE ESTILOS PERSONALIZADOS POR EL USUARIO */
    ${getGraphicalCSS()}
    ${sanitizeCSS(settings.blockStyleTitles || '')}
    ${sanitizeCSS(settings.blockStyleHeader || '')}
    ${sanitizeCSS(settings.blockStyleFooter || '')}
    ${sanitizeCSS(settings.blockStylePageNum || '')}
    ${sanitizeCSS(settings.blockStyleTOC || '')}
    ${sanitizeCSS(settings.blockStyleLists || '')}
    ${sanitizeCSS(settings.tableCustomCss || '')}
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
  ${toolbarHTML_Preview}

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

      let processedHTML = cleanHTML_PreviewMode
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
    // Set settings globally so the markdownParser can read it
    if (typeof window !== 'undefined') {
      (window as any).currentUnemiSettings = settings;
    }

    const figureMap = new Map<string, number>();
    const tableMap = new Map<string, number>();
    const figureCounterRef = { val: 1 };
    const tableCounterRef = { val: 1 };

    // 1. Compile blocks (HTML vs Markdown)
    let selectHtml = "";
    if (htmlBlocks && htmlBlocks.length > 0) {
      selectHtml = htmlBlocks.map(b => {
        return compileAndProcessMarkdown(
          b.code,
          !!b.isMarkdown,
          figureMap,
          tableMap,
          figureCounterRef,
          tableCounterRef
        );
      }).join('\n\n');
    } else {
      const isMarkdown = !htmlContent.trim().startsWith('<html');
      selectHtml = compileAndProcessMarkdown(
        htmlContent,
        isMarkdown,
        figureMap,
        tableMap,
        figureCounterRef,
        tableCounterRef
      );
    }

    // Merge run-in headings with the following paragraph
    selectHtml = selectHtml.replace(/<span class="apa-runin apa-level(\d+)">([\s\S]*?)<\/span>\s*<p>([\s\S]*?)<\/p>/gi, (match, level, title, paragraph) => {
      return `<p><span class="apa-runin apa-level${level}">${title}</span> ${paragraph}</p>`;
    });

    // 1b. Replace cross-references like @fig-id or @tbl-id
    const refRegex = /@(fig-[a-zA-Z0-9_-]+|tbl-[a-zA-Z0-9_-]+)/g;
    selectHtml = selectHtml.replace(refRegex, (match, id) => {
      if (id.startsWith('fig-')) {
        const num = figureMap.get(id);
        if (num !== undefined) {
          return `<a href="#${id}" class="cross-reference-link" style="color: #004080; text-decoration: none; font-weight: 500; border-bottom: 1px dashed #004080;">Figura ${num}</a>`;
        }
      } else if (id.startsWith('tbl-')) {
        const num = tableMap.get(id);
        if (num !== undefined) {
          return `<a href="#${id}" class="cross-reference-link" style="color: #004080; text-decoration: none; font-weight: 500; border-bottom: 1px dashed #004080;">Tabla ${num}</a>`;
        }
      }
      return match;
    });

    // 2. Resolve image uploads
    if (uploadedFiles && uploadedFiles.length > 0) {
      uploadedFiles.forEach((file) => {
        const escapedName = file.name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regex = new RegExp(`src=["'](?:[^"']*/)?${escapedName}["']`, 'gi');
        selectHtml = selectHtml.replace(regex, `src="${file.dataUrl}"`);
      });
    }

    // 3. Replace in-text citations like [@key] or [@key1; @key2]
    const citedKeys = new Set<string>();
    const citationRegex = /\[@([a-zA-Z0-9_;\s@]+)\]/g;
    let citeMatch;
    while ((citeMatch = citationRegex.exec(selectHtml)) !== null) {
      const keys = citeMatch[1].split(';').map((k: string) => k.replace(/@/g, '').trim().toLowerCase()).filter(Boolean);
      keys.forEach(k => citedKeys.add(k));
    }

    selectHtml = selectHtml.replace(citationRegex, (match, keysGroup) => {
      const keys = keysGroup.split(';').map((k: string) => k.replace(/@/g, '').trim()).filter(Boolean);
      const citations = keys.map((key: string) => {
        const item = bibliography.find(b => b.key.toLowerCase() === key.toLowerCase());
        if (item) {
          return `${getAPALastNames(item.authors)}, ${extractAPAYear(item.year)}`;
        }
        return key; // fallback
      });
      return citations.length > 0 ? `(${citations.join('; ')})` : match;
    });

    // 3b. Replace manual pagebreaks [PAGEBREAK]
    selectHtml = selectHtml.replace(/<p>\s*\[PAGEBREAK\]\s*<\/p>/gi, '<div class="page-break"></div>');
    selectHtml = selectHtml.replace(/\[PAGEBREAK\]/gi, '<div class="page-break"></div>');

    // 3c. Replace manual bibliography [BIBLIOGRAPHY]
    const hasManualBibliography = selectHtml.includes('[BIBLIOGRAPHY]');
    if (hasManualBibliography) {
      let bibItemsToShow = [...bibliography];
      if (settings.showOnlyCitedBibliography) {
        bibItemsToShow = bibItemsToShow.filter(b => citedKeys.has(b.key.toLowerCase()));
      }

      const sortedBib = bibItemsToShow.sort((a, b) => a.authors.localeCompare(b.authors));
      const bibTitle = settings.bibliographyTitle || 'Referencias Bibliográficas';
      
      let bibHtml = `
        <h1 class="unemi-bibliography-title" style="font-family: 'Times New Roman', Times, serif; font-size: 16px; font-weight: bold; text-align: center; margin-top: 24px; margin-bottom: 24px;">
          ${bibTitle}
        </h1>
      `;

      sortedBib.forEach(item => {
        bibHtml += `
          <div style="padding-left: 0.5in !important; text-indent: -0.5in !important; line-height: 2.0 !important; font-size: 16px !important; font-family: 'Times New Roman', Times, serif !important; text-align: left !important; display: block !important;" class="unemi-bibliography-item">
            ${formatAPABibliographyItem(item)}
          </div>
        `;
      });

      selectHtml = selectHtml.replace(/<p>\s*\[BIBLIOGRAPHY\]\s*<\/p>/gi, bibHtml);
      selectHtml = selectHtml.replace(/\[BIBLIOGRAPHY\]/gi, bibHtml);
    }

    // 3d. Replace manual Table of Contents [TOC]
    const hasManualTOC = selectHtml.includes('[TOC]');
    if (hasManualTOC) {
      // Extract all headings from the current HTML structure (including manual bibliography if inserted, but excluding the manual TOC itself since it's not yet inserted)
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = selectHtml;
      const headingsForManualTOC: { text: string; level: number }[] = [];
      const hElements = Array.from(tempDiv.querySelectorAll('h1, h2, h3, h4, h5, .apa-runin'));
      hElements.forEach((h) => {
        let text = h.textContent?.trim() || '';
        if (text) {
          let level = 1;
          if (h.tagName.startsWith('H') && h.tagName.length === 2) {
            level = parseInt(h.tagName.substring(1), 10);
          } else if (h.classList.contains('apa-runin')) {
            const levelClass = Array.from(h.classList).find(c => c.startsWith('apa-level'));
            if (levelClass) {
              level = parseInt(levelClass.replace('apa-level', ''), 10);
            }
          }

          // Strip trailing period for TOC
          if (h.classList.contains('apa-runin') && text.endsWith('.')) {
            text = text.slice(0, -1).trim();
          }

          headingsForManualTOC.push({
            text,
            level
          });
        }
      });

      const tocTitle = settings.tocTitle || 'Tabla de Contenidos';
      let manualTocHtml = `
        <div class="toc-container select-text manual-toc">
          <div class="toc-header">${tocTitle}</div>
          <ul class="toc-list">
      `;
      if (headingsForManualTOC.length > 0) {
        headingsForManualTOC.forEach((h, hIdx) => {
          const levelClass = `toc-level-${h.level}`;
          manualTocHtml += `
            <li class="toc-item ${levelClass}">
              <span class="toc-title">${h.text}</span>
              <span class="toc-dots"></span>
              <span class="toc-page" data-heading-ref="${hIdx}">999</span>
            </li>
          `;
        });
      } else {
        manualTocHtml += `
          <li class="text-gray-400 italic text-center w-full py-4 flex justify-center items-center">
            (Inserte títulos H1 o H2 en el editor de contenido para generar el índice automático)
          </li>
        `;
      }
      manualTocHtml += `
          </ul>
        </div>
      `;

      selectHtml = selectHtml.replace(/<p>\s*\[TOC\]\s*<\/p>/gi, manualTocHtml);
      selectHtml = selectHtml.replace(/\[TOC\]/gi, manualTocHtml);
    }

    // 4. Append automatic APA bibliography page at the very end (only if not manually inserted)
    if (!hasManualBibliography && settings.showBibliography && bibliography && bibliography.length > 0) {
      let bibItemsToShow = [...bibliography];
      if (settings.showOnlyCitedBibliography) {
        bibItemsToShow = bibItemsToShow.filter(b => citedKeys.has(b.key.toLowerCase()));
      }

      const sortedBib = bibItemsToShow.sort((a, b) => a.authors.localeCompare(b.authors));
      const bibTitle = settings.bibliographyTitle || 'Referencias Bibliográficas';
      
      // We append elements as flat sibling nodes so the paginator can cleanly slice them across pages!
      let bibHtml = `
        <div class="page-break"></div>
        <h1 class="unemi-bibliography-title" style="font-family: 'Times New Roman', Times, serif; font-size: 16px; font-weight: bold; text-align: center; margin-top: 24px; margin-bottom: 24px;">
          ${bibTitle}
        </h1>
      `;

      sortedBib.forEach(item => {
        bibHtml += `
          <div style="padding-left: 0.5in !important; text-indent: -0.5in !important; line-height: 2.0 !important; font-size: 16px !important; font-family: 'Times New Roman', Times, serif !important; text-align: left !important; display: block !important;" class="unemi-bibliography-item">
            ${formatAPABibliographyItem(item)}
          </div>
        `;
      });
      
      selectHtml += bibHtml;
    }

    return renderMathInHtml(selectHtml);
  }, [htmlContent, htmlBlocks, uploadedFiles, bibliography, settings.showBibliography, settings.bibliographyTitle, settings.showOnlyCitedBibliography, settings.tocTitle, settings.h1LineBreak, settings.h2LineBreak, settings.h3LineBreak, settings.h4LineBreak, settings.h5LineBreak]);

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

    const cover = compiledCover || liveCover;
    const settings = compiledSettings || liveSettings;

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
            css += `\n.unemi-document-content, .unemi-document-content p, .unemi-document-content div:not(.unemi-academic-header):not(.unemi-academic-footer):not(.toc-container):not(.note):not(.math-expr):not(.unemi-bibliography-item):not(.unemi-bibliography-title) {`;
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

          // Código (Monospace) Graphical Styling
          const blockTheme = settings.blockCodeTheme || settings.codeTheme || 'academic';
          const rawBlockSize = settings.blockCodeSize !== undefined ? settings.blockCodeSize : (settings.codeSize || '13px');
          const blockSize = formatFontSize(rawBlockSize, '13px');
          const inlineTheme = settings.inlineCodeTheme || settings.codeTheme || 'academic';
          const rawInlineSize = settings.inlineCodeSize !== undefined ? settings.inlineCodeSize : '12px';
          const inlineSize = formatFontSize(rawInlineSize, '12px');

          css += `\n.unemi-document-content pre, .unemi-document-content pre * {`;
          css += ` font-family: "Fira Code", "Courier New", Courier, monospace !important;`;
          css += ` font-size: ${blockSize} !important;`;
          css += ` text-indent: 0px !important;`;
          css += ` }`;

          css += `\n.unemi-document-content code:not(pre code) {`;
          css += ` font-family: "Fira Code", "Courier New", Courier, monospace !important;`;
          css += ` font-size: ${inlineSize} !important;`;
          css += ` text-indent: 0px !important;`;
          css += ` }`;
          
          css += `\n.unemi-document-content pre {`;
          css += ` padding: 12px 16px !important;`;
          css += ` margin: 16px 0 !important;`;
          css += ` border-radius: 6px !important;`;
          css += ` overflow-x: auto !important;`;
          css += ` line-height: 1.5 !important;`;
          css += ` text-indent: 0px !important;`;
          css += ` }`;

          // Inline code styling
          let inlineBg = '#f1f5f9';
          let inlineColor = '#0f172a';
          let inlineBorder = '#cbd5e1';
          if (inlineTheme === 'dracula') {
            inlineBg = '#282a36';
            inlineColor = '#f8f8f2';
            inlineBorder = '#44475a';
          } else if (inlineTheme === 'monokai') {
            inlineBg = '#272822';
            inlineColor = '#f8f8f2';
            inlineBorder = '#3e3d32';
          } else if (inlineTheme === 'github-light') {
            inlineBg = '#f6f8fa';
            inlineColor = '#24292f';
            inlineBorder = '#d0d7de';
          } else if (inlineTheme === 'solarized-light') {
            inlineBg = '#fdf6e3';
            inlineColor = '#657b83';
            inlineBorder = '#efe8d4';
          } else if (inlineTheme === 'nord') {
            inlineBg = '#2e3440';
            inlineColor = '#d8dee9';
            inlineBorder = '#3b4252';
          } else {
            // academic / default light
            inlineBg = '#f8fafc';
            inlineColor = '#0f172a';
            inlineBorder = '#cbd5e1';
          }

          css += `\n.unemi-document-content code:not(pre code) {`;
          css += ` background-color: ${inlineBg} !important;`;
          css += ` color: ${inlineColor} !important;`;
          css += ` padding: 2px 5px !important;`;
          css += ` border-radius: 4px !important;`;
          css += ` border: 1px solid ${inlineBorder} !important;`;
          css += ` display: inline !important;`;
          css += ` text-indent: 0 !important;`;
          css += ` word-break: break-word !important;`;
          css += ` box-decoration-break: clone !important;`;
          css += ` -webkit-box-decoration-break: clone !important;`;
          css += ` }`;
          
          if (blockTheme === 'dracula') {
            css += `\n.unemi-document-content pre { background-color: #282a36 !important; border: 1px solid #44475a !important; color: #f8f8f2 !important; }`;
            css += `\n.unemi-document-content pre code { color: #f8f8f2 !important; background-color: transparent !important; padding: 0 !important; }`;
            css += `\n.unemi-document-content pre .token.comment, .unemi-document-content pre .token.prolog, .unemi-document-content pre .token.doctype, .unemi-document-content pre .token.cdata { color: #6272a4 !important; font-style: italic !important; }`;
            css += `\n.unemi-document-content pre .token.keyword, .unemi-document-content pre .token.operator, .unemi-document-content pre .token.atrule { color: #ff79c6 !important; }`;
            css += `\n.unemi-document-content pre .token.string, .unemi-document-content pre .token.char { color: #f1fa8c !important; }`;
            css += `\n.unemi-document-content pre .token.function, .unemi-document-content pre .token.class-name { color: #50fa7b !important; }`;
            css += `\n.unemi-document-content pre .token.number, .unemi-document-content pre .token.boolean, .unemi-document-content pre .token.constant { color: #bd93f9 !important; }`;
            css += `\n.unemi-document-content pre .token.punctuation, .unemi-document-content pre .token.property, .unemi-document-content pre .token.tag { color: #f8f8f2 !important; }`;
          } else if (blockTheme === 'monokai') {
            css += `\n.unemi-document-content pre { background-color: #272822 !important; border: 1px solid #3e3d32 !important; color: #f8f8f2 !important; }`;
            css += `\n.unemi-document-content pre code { color: #f8f8f2 !important; background-color: transparent !important; padding: 0 !important; }`;
            css += `\n.unemi-document-content pre .token.comment, .unemi-document-content pre .token.prolog, .unemi-document-content pre .token.doctype, .unemi-document-content pre .token.cdata { color: #75715e !important; font-style: italic !important; }`;
            css += `\n.unemi-document-content pre .token.keyword, .unemi-document-content pre .token.operator, .unemi-document-content pre .token.atrule { color: #f92672 !important; }`;
            css += `\n.unemi-document-content pre .token.string, .unemi-document-content pre .token.char { color: #e6db74 !important; }`;
            css += `\n.unemi-document-content pre .token.function, .unemi-document-content pre .token.class-name { color: #a6e22e !important; }`;
            css += `\n.unemi-document-content pre .token.number, .unemi-document-content pre .token.boolean, .unemi-document-content pre .token.constant { color: #ae81ff !important; }`;
            css += `\n.unemi-document-content pre .token.punctuation, .unemi-document-content pre .token.property, .unemi-document-content pre .token.tag { color: #f8f8f2 !important; }`;
          } else if (blockTheme === 'github-light') {
            css += `\n.unemi-document-content pre { background-color: #f6f8fa !important; border: 1px solid #d0d7de !important; color: #24292f !important; }`;
            css += `\n.unemi-document-content pre code { color: #24292f !important; background-color: transparent !important; padding: 0 !important; }`;
            css += `\n.unemi-document-content pre .token.comment, .unemi-document-content pre .token.prolog, .unemi-document-content pre .token.doctype, .unemi-document-content pre .token.cdata { color: #6e7781 !important; font-style: italic !important; }`;
            css += `\n.unemi-document-content pre .token.keyword, .unemi-document-content pre .token.operator, .unemi-document-content pre .token.atrule { color: #cf222e !important; font-weight: bold !important; }`;
            css += `\n.unemi-document-content pre .token.string, .unemi-document-content pre .token.char { color: #0a3069 !important; }`;
            css += `\n.unemi-document-content pre .token.function, .unemi-document-content pre .token.class-name { color: #8250df !important; }`;
            css += `\n.unemi-document-content pre .token.number, .unemi-document-content pre .token.boolean, .unemi-document-content pre .token.constant { color: #0550ae !important; }`;
            css += `\n.unemi-document-content pre .token.punctuation, .unemi-document-content pre .token.property, .unemi-document-content pre .token.tag { color: #24292f !important; }`;
          } else if (blockTheme === 'solarized-light') {
            css += `\n.unemi-document-content pre { background-color: #fdf6e3 !important; border: 1px solid #efe8d4 !important; color: #657b83 !important; }`;
            css += `\n.unemi-document-content pre code { color: #657b83 !important; background-color: transparent !important; padding: 0 !important; }`;
            css += `\n.unemi-document-content pre .token.comment, .unemi-document-content pre .token.prolog, .unemi-document-content pre .token.doctype, .unemi-document-content pre .token.cdata { color: #93a1a1 !important; font-style: italic !important; }`;
            css += `\n.unemi-document-content pre .token.keyword, .unemi-document-content pre .token.operator, .unemi-document-content pre .token.atrule { color: #859900 !important; }`;
            css += `\n.unemi-document-content pre .token.string, .unemi-document-content pre .token.char { color: #2aa198 !important; }`;
            css += `\n.unemi-document-content pre .token.function, .unemi-document-content pre .token.class-name { color: #268bd2 !important; }`;
            css += `\n.unemi-document-content pre .token.number, .unemi-document-content pre .token.boolean, .unemi-document-content pre .token.constant { color: #d33682 !important; }`;
            css += `\n.unemi-document-content pre .token.punctuation, .unemi-document-content pre .token.property, .unemi-document-content pre .token.tag { color: #586e75 !important; }`;
          } else if (blockTheme === 'nord') {
            css += `\n.unemi-document-content pre { background-color: #2e3440 !important; border: 1px solid #3b4252 !important; color: #d8dee9 !important; }`;
            css += `\n.unemi-document-content pre code { color: #d8dee9 !important; background-color: transparent !important; padding: 0 !important; }`;
            css += `\n.unemi-document-content pre .token.comment, .unemi-document-content pre .token.prolog, .unemi-document-content pre .token.doctype, .unemi-document-content pre .token.cdata { color: #4c566a !important; font-style: italic !important; }`;
            css += `\n.unemi-document-content pre .token.keyword, .unemi-document-content pre .token.operator, .unemi-document-content pre .token.atrule { color: #81a1c1 !important; }`;
            css += `\n.unemi-document-content pre .token.string, .unemi-document-content pre .token.char { color: #a3be8c !important; }`;
            css += `\n.unemi-document-content pre .token.function, .unemi-document-content pre .token.class-name { color: #88c0d0 !important; }`;
            css += `\n.unemi-document-content pre .token.number, .unemi-document-content pre .token.boolean, .unemi-document-content pre .token.constant { color: #b48ead !important; }`;
            css += `\n.unemi-document-content pre .token.punctuation, .unemi-document-content pre .token.property, .unemi-document-content pre .token.tag { color: #eceff4 !important; }`;
          } else {
            // academic / default
            css += `\n.unemi-document-content pre { background-color: #f8fafc !important; border: 1px solid #cbd5e1 !important; color: #0f172a !important; }`;
            css += `\n.unemi-document-content pre code { color: #0f172a !important; background-color: transparent !important; padding: 0 !important; }`;
            css += `\n.unemi-document-content pre .token.comment, .unemi-document-content pre .token.prolog, .unemi-document-content pre .token.doctype, .unemi-document-content pre .token.cdata { color: #64748b !important; font-style: italic !important; }`;
            css += `\n.unemi-document-content pre .token.keyword, .unemi-document-content pre .token.operator, .unemi-document-content pre .token.atrule { color: #0f172a !important; font-weight: bold !important; }`;
            css += `\n.unemi-document-content pre .token.string, .unemi-document-content pre .token.char { color: #0f172a !important; font-style: italic !important; }`;
            css += `\n.unemi-document-content pre .token.function, .unemi-document-content pre .token.class-name { color: #0f172a !important; }`;
            css += `\n.unemi-document-content pre .token.number, .unemi-document-content pre .token.boolean, .unemi-document-content pre .token.constant { color: #0f172a !important; }`;
            css += `\n.unemi-document-content pre .token.punctuation, .unemi-document-content pre .token.property, .unemi-document-content pre .token.tag { color: #0f172a !important; }`;
          }

          css += `
          .unemi-margin-element img {
            width: 100% !important;
            height: 100% !important;
            object-fit: fill !important;
          }
          `;

          return css;
        };

        const cleanHTML_SyncedMode = `<!DOCTYPE html>
  <!-- SYNCED_MODE_V2 -->
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${cover.title || 'Plantilla de Documento UNEMI'}</title>
  
  <script src="https://cdn.tailwindcss.com"></script>
  
  <!-- KaTeX CSS for mathematical symbol styling -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">
  
  <!-- PrismJS tomorrow dark theme for code blocks -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/themes/prism-tomorrow.min.css">
 
  <style id="unemi-preview-style-v2">` + `
    /* UNIQUE_SYNCED_V2 */
    /* SYNCED_MODE_V2_STYLE_START */
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Space+Grotesk:wght@400;500;600;700&family=Fira+Code:wght@400;500&display=swap');
    
    * {
      box-sizing: border-box;
    }

    /* APA 7 Run-in (inline) Headings */
    .unemi-document-content .apa-runin {
      display: inline !important;
      font-family: "Times New Roman", Times, Georgia, serif !important;
      font-size: 16px !important;
      color: #000000 !important;
      line-height: 1.8 !important;
    }

    .unemi-document-content .apa-runin.apa-level1 {
      font-weight: bold !important;
    }

    .unemi-document-content .apa-runin.apa-level2 {
      font-weight: bold !important;
    }

    .unemi-document-content .apa-runin.apa-level3 {
      font-weight: bold !important;
      font-style: italic !important;
    }

    .unemi-document-content .apa-runin.apa-level4 {
      font-weight: bold !important;
      padding-left: 0px !important;
    }

    .unemi-document-content .apa-runin.apa-level5 {
      font-weight: bold !important;
      font-style: italic !important;
      padding-left: 0px !important;
    }
    
    body, html {
      margin: 0;
      padding: 0;
      background-color: #fafafa !important;
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
      background-color: #fafafa !important;
    }

    div[name^="document-page-"] {
      position: relative !important;
      background-color: #ffffff !important;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1) !important;
      border: none !important;
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
      border: none !important;
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

    .unemi-document-content ul:not(.toc-list) {
      list-style-type: disc !important;
      padding-left: 0.5in !important;
      margin-bottom: 12px !important;
    }

    .unemi-document-content ul:not(.toc-list) li:not(.toc-item) {
      position: relative !important;
      margin-bottom: 6px !important;
      line-height: 1.8 !important;
    }

    .unemi-document-content ul:not(.toc-list) li:not(.toc-item)::before {
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
      div[name^="document-page-"]:last-of-type {
        page-break-after: avoid !important;
        break-after: avoid !important;
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
      .print-page-boundary {
        margin: 0px !important;
        padding: 0px !important;
      }
      @page {
        margin: 0 !important;
        size: ${settings.pageSize === 'letter' ? '8.5in 11in' : settings.pageSize === 'a4' ? '210mm 297mm' : '297mm 167.06mm'} ${isPortrait ? 'portrait' : 'landscape'};
      }
    }
    
    /* BASE TOC STYLING PRE-INJECTED BEFORE USER'S CUSTOM TOC CSS */
    ${BASE_TOC_CSS}
    
    /* BLOQUES DE ESTILOS PERSONALIZADOS POR EL USUARIO */
    ${getGraphicalCSS()}
    ${sanitizeCSS(settings.blockStyleTitles || '')}
    ${sanitizeCSS(settings.blockStyleHeader || '')}
    ${sanitizeCSS(settings.blockStyleFooter || '')}
    ${sanitizeCSS(settings.blockStylePageNum || '')}
    ${sanitizeCSS(settings.blockStyleTOC || '')}
    ${sanitizeCSS(settings.blockStyleLists || '')}
    ${sanitizeCSS(settings.tableCustomCss || '')}
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
  ${toolbarHTML_Preview}

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

        let processedHTML = cleanHTML_SyncedMode
          .replace(/src="\/\//g, 'src="https://')
          .replace(/srcset="\/\//g, 'srcset="https://')
          .replace(/href="\/\//g, 'href="https://');

        // Avoid continuous reloads if the HTML is identical to the last synchronized HTML
        if (lastSyncHtmlRef.current === processedHTML) {
          setIsSyncingServer(false);
          return;
        }

        const response = await fetch('/api/save-preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ html: processedHTML }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.id) {
            lastSyncHtmlRef.current = processedHTML;
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
  }, [compiledCover, compiledSettings, compiledHtmlContent, compiledHtmlBlocks, compiledBibliography, compiledUploadedFiles, paginatedPages, previewMode]);

  useEffect(() => {
    if (serverPreviewId) {
      setIsScrollSyncing(true);
    }
  }, [serverPreviewId]);

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
      
      // Select raw rendered children in our hidden container
      const childNodes = Array.from(hiddenMeasureRef.current.children) as HTMLElement[];
      const pagesList: string[][] = [[]];
      let currentPageIndex = 0;
      let accumulatedPageHeight = 0;

      // Vertical threshold boundary in pixels, reserving safety margin:
      const totalHeight = pageHeight;
      const maxHeight = totalHeight - topMargin - bottomMargin - 5;

      let detectedHeadings: HeadingItem[] = [];

      // Create a temporary measurement container with the exact same styles
      const tempMeasureContainer = document.createElement('div');
      tempMeasureContainer.className = 'unemi-document-content';
      tempMeasureContainer.style.position = 'absolute';
      tempMeasureContainer.style.top = '-9999px';
      tempMeasureContainer.style.left = '-9999px';
      tempMeasureContainer.style.width = `${contentWidth}px`;
      tempMeasureContainer.style.boxSizing = 'border-box';
      tempMeasureContainer.style.visibility = 'hidden';
      document.body.appendChild(tempMeasureContainer);

      const measureHTMLHeight = (htmlContent: string): number => {
        tempMeasureContainer.innerHTML = htmlContent;
        return tempMeasureContainer.getBoundingClientRect().height;
      };

      // Helper to tokenize HTML string safely (preventing breaking tags)
      const tokenizeHTML = (html: string): string[] => {
        const tokens: string[] = [];
        let i = 0;
        while (i < html.length) {
          if (html[i] === '<') {
            const end = html.indexOf('>', i);
            if (end !== -1) {
              tokens.push(html.substring(i, end + 1));
              i = end + 1;
            } else {
              tokens.push(html[i]);
              i++;
            }
          } else {
            let nextSpace = html.indexOf(' ', i);
            let nextTag = html.indexOf('<', i);
            let endWord = html.length;
            if (nextSpace !== -1 && nextTag !== -1) {
              endWord = Math.min(nextSpace, nextTag);
            } else if (nextSpace !== -1) {
              endWord = nextSpace;
            } else if (nextTag !== -1) {
              endWord = nextTag;
            }
            
            if (endWord === i) {
              tokens.push(' ');
              i++;
            } else {
              tokens.push(html.substring(i, endWord));
              i = endWord;
            }
          }
        }
        return tokens;
      };

      // Helper to split tokens into balanced HTML parts (reclosing/reopening open tags)
      const getBalancedHTMLParts = (tokens: string[], splitIndex: number) => {
        const part1Tokens = tokens.slice(0, splitIndex);
        const part2Tokens = tokens.slice(splitIndex);
        
        const openTags: string[] = [];
        part1Tokens.forEach(t => {
          if (t.startsWith('<') && t.endsWith('>') && !t.startsWith('</') && !t.endsWith('/>')) {
            const tagNameMatch = t.match(/<([a-zA-Z0-9:-]+)/);
            if (tagNameMatch) {
              openTags.push(tagNameMatch[1]);
            }
          } else if (t.startsWith('</')) {
            const tagNameMatch = t.match(/<\/([a-zA-Z0-9:-]+)/);
            if (tagNameMatch) {
              const idx = openTags.lastIndexOf(tagNameMatch[1]);
              if (idx !== -1) {
                openTags.splice(idx, 1);
              }
            }
          }
        });
        
        const part1Closed = [...part1Tokens];
        for (let i = openTags.length - 1; i >= 0; i--) {
          part1Closed.push(`</${openTags[i]}>`);
        }
        
        const part2Reopened: string[] = [];
        openTags.forEach(tag => {
          part2Reopened.push(`<${tag}>`);
        });
        const part2Final = [...part2Reopened, ...part2Tokens];
        
        return {
          part1: part1Closed.join(''),
          part2: part2Final.join('')
        };
      };

      // Helper to build a table part with cloned caption/thead/tbody
      const buildTablePart = (originalTable: HTMLTableElement, rowsToInsert: HTMLElement[], isContinuation: boolean) => {
        const clone = originalTable.cloneNode(false) as HTMLTableElement;
        
        clone.style.width = '100%';
        clone.style.tableLayout = 'auto';

        const caption = originalTable.querySelector('caption');
        if (caption) {
          const captionClone = caption.cloneNode(true) as HTMLTableCaptionElement;
          if (isContinuation) {
            const textSpan = captionClone.querySelector('.caption-text') || captionClone;
            if (textSpan && textSpan.textContent && !textSpan.textContent.includes('(continuación)')) {
              textSpan.textContent += ' (continuación)';
            }
          }
          clone.appendChild(captionClone);
        }

        const thead = originalTable.querySelector('thead');
        if (thead) {
          clone.appendChild(thead.cloneNode(true));
        }
        
        const tbody = document.createElement('tbody');
        rowsToInsert.forEach(r => tbody.appendChild(r.cloneNode(true)));
        clone.appendChild(tbody);
        
        return clone.outerHTML;
      };

      const getCodeSplitStyles = (part: 'first' | 'middle' | 'last'): string => {
        if (part === 'first') {
          return 'border-bottom: none !important; border-bottom-left-radius: 0px !important; border-bottom-right-radius: 0px !important; margin-bottom: 0px !important; padding-bottom: 4px !important;';
        } else if (part === 'middle') {
          return 'border-top: none !important; border-bottom: none !important; border-radius: 0px !important; margin-top: 0px !important; margin-bottom: 0px !important; padding-top: 4px !important; padding-bottom: 4px !important;';
        } else { // 'last'
          return 'border-top: none !important; border-top-left-radius: 0px !important; border-top-right-radius: 0px !important; margin-top: 0px !important; padding-top: 4px !important;';
        }
      };

      // Create a copy of child nodes info into a processing queue
      const queue: {
        html: string;
        tagName: string;
        className: string;
        styleAttr: string;
        isPageBreak: boolean;
        isTable: boolean;
        isCodeSplit?: boolean;
        codeSplitPart?: 'first' | 'middle' | 'last';
      }[] = childNodes.map(node => ({
        html: node.outerHTML,
        tagName: node.tagName,
        className: node.className || '',
        styleAttr: node.getAttribute('style') || '',
        isPageBreak: node.classList.contains('page-break'),
        isTable: node.tagName === 'TABLE',
      }));

      let qIndex = 0;
      while (qIndex < queue.length) {
        const item = queue[qIndex];
        qIndex++;

        const isHeading = ['H1', 'H2', 'H3', 'H4', 'H5'].includes(item.tagName);
        const elementHeight = measureHTMLHeight(item.html);

        if (item.isPageBreak) {
          currentPageIndex++;
          pagesList.push([]);
          accumulatedPageHeight = 0;
          pagesList[currentPageIndex].push(item.html);
          continue;
        }

        // Check if fits entirely on the current page
        if (accumulatedPageHeight + elementHeight <= maxHeight) {
          pagesList[currentPageIndex].push(item.html);
          accumulatedPageHeight += elementHeight;
          
          // Scrape headings for TOC
          const parserDiv = document.createElement('div');
          parserDiv.innerHTML = item.html;
          const hElements = Array.from(parserDiv.querySelectorAll('h1, h2, h3'));
          if (isHeading) {
            const rootEl = parserDiv.firstElementChild as HTMLElement;
            if (rootEl && !hElements.includes(rootEl)) {
              hElements.unshift(rootEl);
            }
          }
          hElements.forEach((h) => {
            const text = h.textContent?.trim() || '';
            if (text) {
              detectedHeadings.push({
                text,
                level: parseInt(h.tagName.substring(1), 10),
                page: currentPageIndex + (settings.showTOC ? 3 : 2),
                pageRelative: currentPageIndex
              });
            }
          });
          continue;
        }

        // Does NOT fit on current page. Let's try to split if eligible!
        if (item.isTable) {
          tempMeasureContainer.innerHTML = item.html;
          const tableEl = tempMeasureContainer.firstElementChild as HTMLTableElement;
          const thead = tableEl.querySelector('thead');
          const theadHeight = thead ? thead.getBoundingClientRect().height : 0;
          const rows = Array.from(tableEl.querySelectorAll('tbody > tr')) as HTMLElement[];
          
          if (elementHeight <= maxHeight && accumulatedPageHeight > 0) {
            // Fits entirely on a single fresh page, so push the entire table to next page
            currentPageIndex++;
            pagesList.push([]);
            accumulatedPageHeight = 0;
            pagesList[currentPageIndex].push(item.html);
            accumulatedPageHeight += elementHeight;
          } else {
            // Table must be split!
            const remainingHeight = maxHeight - accumulatedPageHeight;
            const minStartHeight = theadHeight + (rows[0] ? rows[0].getBoundingClientRect().height : 30) * 2 + 15;
            
            if (remainingHeight < minStartHeight && accumulatedPageHeight > 0) {
              currentPageIndex++;
              pagesList.push([]);
              accumulatedPageHeight = 0;
            }
            
            let currentPartRows: HTMLElement[] = [];
            let currentPartHeight = theadHeight + 10;
            let splitIndex = 0;

            for (let i = 0; i < rows.length; i++) {
              const row = rows[i];
              const rowHeight = row.getBoundingClientRect().height;
              const curLimit = maxHeight - accumulatedPageHeight;
              
              if (currentPartHeight + rowHeight > curLimit && currentPartRows.length > 0) {
                const isCont = splitIndex > 0;
                const tableHtml = buildTablePart(tableEl, currentPartRows, isCont);
                pagesList[currentPageIndex].push(tableHtml);
                splitIndex++;

                currentPageIndex++;
                pagesList.push([]);
                accumulatedPageHeight = 0;
                currentPartRows = [row];
                currentPartHeight = theadHeight + 10 + rowHeight;
              } else {
                currentPartRows.push(row);
                currentPartHeight += rowHeight;
              }
            }
            
            if (currentPartRows.length > 0) {
              const isCont = splitIndex > 0;
              const tableHtml = buildTablePart(tableEl, currentPartRows, isCont);
              pagesList[currentPageIndex].push(tableHtml);
              accumulatedPageHeight = currentPartHeight;
            }
          }
        } else if (item.tagName === 'P') {
          // Paragraph splitting!
          tempMeasureContainer.innerHTML = item.html;
          const pEl = tempMeasureContainer.firstElementChild as HTMLElement;
          const tokens = tokenizeHTML(pEl.innerHTML);
          
          let low = 1;
          let high = tokens.length;
          let bestSplitIndex = 0;
          let bestPart1HTML = '';
          let bestPart2HTML = '';
          
          const isJustified = (item.styleAttr?.toLowerCase().includes('text-align: justify') || 
                               item.styleAttr?.toLowerCase().includes('text-align:justify') || 
                               settings.pAlign === 'justify');
          
          const part2Style = item.styleAttr
            ? `${item.styleAttr}; text-indent: 0px !important;`
            : `text-indent: 0px !important;`;
          
          while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            const { part1, part2 } = getBalancedHTMLParts(tokens, mid);
            const part1Style = isJustified
              ? (item.styleAttr ? `${item.styleAttr}; text-align-last: justify !important;` : `text-align-last: justify !important;`)
              : item.styleAttr;
            const testHTML = `<p class="${item.className}" style="${part1Style || ''}">${part1}</p>`;
            const h = measureHTMLHeight(testHTML);
            
            if (h <= maxHeight - accumulatedPageHeight) {
              bestSplitIndex = mid;
              bestPart1HTML = testHTML;
              bestPart2HTML = `<p class="${item.className}" style="${part2Style}">${part2}</p>`;
              low = mid + 1;
            } else {
              high = mid - 1;
            }
          }
          
          if (bestSplitIndex === 0 && accumulatedPageHeight === 0) {
            // Force at least 1 token if we are already on a fresh page to avoid infinite loops
            bestSplitIndex = 1;
            const { part1, part2 } = getBalancedHTMLParts(tokens, 1);
            const part1Style = isJustified
              ? (item.styleAttr ? `${item.styleAttr}; text-align-last: justify !important;` : `text-align-last: justify !important;`)
              : item.styleAttr;
            bestPart1HTML = `<p class="${item.className}" style="${part1Style || ''}">${part1}</p>`;
            bestPart2HTML = `<p class="${item.className}" style="${part2Style}">${part2}</p>`;
          }

          if (bestSplitIndex > 0) {
            pagesList[currentPageIndex].push(bestPart1HTML);
            accumulatedPageHeight += measureHTMLHeight(bestPart1HTML);
            
            if (bestSplitIndex < tokens.length) {
              // Push the remaining part back to the queue to be processed next
              queue.splice(qIndex, 0, {
                html: bestPart2HTML,
                tagName: item.tagName,
                className: item.className,
                styleAttr: part2Style,
                isPageBreak: false,
                isTable: false
              });
            }
          } else {
            // Cannot fit even 1 word on current page, move to next page and retry
            currentPageIndex++;
            pagesList.push([]);
            accumulatedPageHeight = 0;
            qIndex--; // retry current item on fresh page
          }
        } else if (item.tagName === 'PRE') {
          // Code Block splitting!
          tempMeasureContainer.innerHTML = item.html;
          const preEl = tempMeasureContainer.firstElementChild as HTMLElement;
          const codeEl = preEl.querySelector('code');
          const lines = codeEl ? codeEl.innerHTML.split('\n') : preEl.innerHTML.split('\n');
          
          const codeClass = codeEl ? codeEl.className || '' : '';
          const codeStyle = codeEl ? codeEl.getAttribute('style') || '' : '';
          
          let low = 1;
          let high = lines.length;
          let bestSplitLines = 0;
          let bestPart1HTML = '';
          let bestPart2HTML = '';
          
          const useSplitBorders = settings.splitBlockCodeBorders;
          
          while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            const part1Lines = lines.slice(0, mid).join('\n');
            const part2Lines = lines.slice(mid).join('\n');
            
            let part1StyleAttr = item.styleAttr;
            let part2StyleAttr = item.styleAttr;
            
            if (useSplitBorders) {
              const part1Type = item.isCodeSplit ? 'middle' : 'first';
              const part2Type = 'last';
              
              const part1StyleAppend = getCodeSplitStyles(part1Type);
              const part2StyleAppend = getCodeSplitStyles(part2Type);
              
              part1StyleAttr = item.styleAttr ? `${item.styleAttr}; ${part1StyleAppend}` : part1StyleAppend;
              part2StyleAttr = item.styleAttr ? `${item.styleAttr}; ${part2StyleAppend}` : part2StyleAppend;
            }
            
            const testHTML = `<pre class="${item.className}" style="${part1StyleAttr}"><code class="${codeClass}" style="${codeStyle}">${part1Lines}</code></pre>`;
            const h = measureHTMLHeight(testHTML);
            
            if (h <= maxHeight - accumulatedPageHeight) {
              bestSplitLines = mid;
              bestPart1HTML = testHTML;
              bestPart2HTML = `<pre class="${item.className}" style="${part2StyleAttr}"><code class="${codeClass}" style="${codeStyle}">${part2Lines}</code></pre>`;
              low = mid + 1;
            } else {
              high = mid - 1;
            }
          }
          
          if (bestSplitLines === 0 && accumulatedPageHeight === 0) {
            // Force at least 1 line if on fresh page to avoid infinite loops
            bestSplitLines = 1;
            const part1Lines = lines.slice(0, 1).join('\n');
            const part2Lines = lines.slice(1).join('\n');
            
            let part1StyleAttr = item.styleAttr;
            let part2StyleAttr = item.styleAttr;
            
            if (useSplitBorders) {
              const part1Type = item.isCodeSplit ? 'middle' : 'first';
              const part2Type = 'last';
              
              const part1StyleAppend = getCodeSplitStyles(part1Type);
              const part2StyleAppend = getCodeSplitStyles(part2Type);
              
              part1StyleAttr = item.styleAttr ? `${item.styleAttr}; ${part1StyleAppend}` : part1StyleAppend;
              part2StyleAttr = item.styleAttr ? `${item.styleAttr}; ${part2StyleAppend}` : part2StyleAppend;
            }
            
            bestPart1HTML = `<pre class="${item.className}" style="${part1StyleAttr}"><code class="${codeClass}" style="${codeStyle}">${part1Lines}</code></pre>`;
            bestPart2HTML = `<pre class="${item.className}" style="${part2StyleAttr}"><code class="${codeClass}" style="${codeStyle}">${part2Lines}</code></pre>`;
          }

          if (bestSplitLines > 0) {
            pagesList[currentPageIndex].push(bestPart1HTML);
            accumulatedPageHeight += measureHTMLHeight(bestPart1HTML);
            
            if (bestSplitLines < lines.length) {
              let part2StyleAttr = item.styleAttr;
              if (useSplitBorders) {
                const part2StyleAppend = getCodeSplitStyles('last');
                part2StyleAttr = item.styleAttr ? `${item.styleAttr}; ${part2StyleAppend}` : part2StyleAppend;
              }
              
              queue.splice(qIndex, 0, {
                html: bestPart2HTML,
                tagName: item.tagName,
                className: item.className,
                styleAttr: part2StyleAttr,
                isPageBreak: false,
                isTable: false,
                isCodeSplit: useSplitBorders ? true : undefined,
                codeSplitPart: useSplitBorders ? 'last' : undefined
              });
            }
          } else {
            // Cannot fit even 1 line, move to next page and retry
            currentPageIndex++;
            pagesList.push([]);
            accumulatedPageHeight = 0;
            qIndex--;
          }
        } else if (item.tagName === 'UL' || item.tagName === 'OL') {
          // List splitting!
          tempMeasureContainer.innerHTML = item.html;
          const listEl = tempMeasureContainer.firstElementChild as HTMLElement;
          const items = Array.from(listEl.children) as HTMLElement[];
          const listTag = item.tagName.toLowerCase();
          
          let low = 1;
          let high = items.length;
          let bestSplitItems = 0;
          let bestPart1HTML = '';
          let bestPart2HTML = '';
          
          while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            const part1ItemsHTML = items.slice(0, mid).map(it => it.outerHTML).join('');
            const part2ItemsHTML = items.slice(mid).map(it => it.outerHTML).join('');
            const testHTML = `<${listTag} class="${item.className}" style="${item.styleAttr}">${part1ItemsHTML}</${listTag}>`;
            const h = measureHTMLHeight(testHTML);
            
            if (h <= maxHeight - accumulatedPageHeight) {
              bestSplitItems = mid;
              bestPart1HTML = testHTML;
              const listStart = listTag === 'ol' ? ` start="${mid + 1}"` : '';
              bestPart2HTML = `<${listTag} class="${item.className}" style="${item.styleAttr}"${listStart}>${part2ItemsHTML}</${listTag}>`;
              low = mid + 1;
            } else {
              high = mid - 1;
            }
          }
          
          if (bestSplitItems === 0 && accumulatedPageHeight === 0) {
            bestSplitItems = 1;
            const part1ItemsHTML = items.slice(0, 1).map(it => it.outerHTML).join('');
            const part2ItemsHTML = items.slice(1).map(it => it.outerHTML).join('');
            bestPart1HTML = `<${listTag} class="${item.className}" style="${item.styleAttr}">${part1ItemsHTML}</${listTag}>`;
            const listStart = listTag === 'ol' ? ` start="2"` : '';
            bestPart2HTML = `<${listTag} class="${item.className}" style="${item.styleAttr}"${listStart}>${part2ItemsHTML}</${listTag}>`;
          }

          if (bestSplitItems > 0) {
            pagesList[currentPageIndex].push(bestPart1HTML);
            accumulatedPageHeight += measureHTMLHeight(bestPart1HTML);
            
            if (bestSplitItems < items.length) {
              queue.splice(qIndex, 0, {
                html: bestPart2HTML,
                tagName: item.tagName,
                className: item.className,
                styleAttr: item.styleAttr,
                isPageBreak: false,
                isTable: false
              });
            }
          } else {
            currentPageIndex++;
            pagesList.push([]);
            accumulatedPageHeight = 0;
            qIndex--;
          }
        } else {
          // Elements that we don't want to split (headings, blockquotes, images, figures etc.)
          if (accumulatedPageHeight > 0) {
            // Push to fresh page
            currentPageIndex++;
            pagesList.push([]);
            accumulatedPageHeight = 0;
            qIndex--; // retry on fresh page
          } else {
            // Already on fresh page, force draw
            pagesList[currentPageIndex].push(item.html);
            accumulatedPageHeight += elementHeight;
          }
        }
      }

      // Reconstruct detectedHeadings page-by-page from final paginated pages list
      detectedHeadings = [];
      pagesList.forEach((pageBlocks, pageRelativeIndex) => {
        pageBlocks.forEach((blockHtml) => {
          const parserDiv = document.createElement('div');
          parserDiv.innerHTML = blockHtml;
          const hElements = Array.from(parserDiv.querySelectorAll('h1, h2, h3, h4, h5, .apa-runin'));
          
          hElements.forEach((h) => {
            let text = h.textContent?.trim() || '';
            if (text) {
              let level = 1;
              if (h.tagName.startsWith('H') && h.tagName.length === 2) {
                level = parseInt(h.tagName.substring(1), 10);
              } else if (h.classList.contains('apa-runin')) {
                const levelClass = Array.from(h.classList).find(c => c.startsWith('apa-level'));
                if (levelClass) {
                  level = parseInt(levelClass.replace('apa-level', ''), 10);
                }
              }

              // Strip trailing period for TOC
              if (h.classList.contains('apa-runin') && text.endsWith('.')) {
                text = text.slice(0, -1).trim();
              }

              detectedHeadings.push({
                text,
                level,
                page: pageRelativeIndex + (settings.showTOC ? 3 : 2), // placeholder page number, will be adjusted when finalTOCPages.length is known
                pageRelative: pageRelativeIndex
              });
            }
          });
        });
      });

      // 3. Paginate Table of Contents (TOC) if enabled
      let finalTOCPages: HeadingItem[][] = [];
      if (settings.showTOC) {
        const measureTOCPart = (headerText: string, items: HeadingItem[]): number => {
          let html = `<div class="toc-container select-text">`;
          if (headerText) {
            html += `<div class="toc-header">${headerText}</div>`;
          }
          html += `<ul class="toc-list">`;
          items.forEach(h => {
            const levelClass = `toc-level-${h.level}`;
            html += `
              <li class="toc-item ${levelClass}">
                <span class="toc-title">${h.text}</span>
                <span class="toc-dots"></span>
                <span class="toc-page">999</span>
              </li>
            `;
          });
          html += `</ul></div>`;
          
          tempMeasureContainer.innerHTML = html;
          return tempMeasureContainer.getBoundingClientRect().height;
        };

        let currentPendingHeadings: HeadingItem[] = [];
        let currentTOCPageIdx = 0;

        for (let i = 0; i < detectedHeadings.length; i++) {
          const candidateList = [...currentPendingHeadings, detectedHeadings[i]];
          const headerText = currentTOCPageIdx === 0 
            ? (settings.tocTitle || "Tabla de Contenidos") 
            : "";
          
          const hHeight = measureTOCPart(headerText, candidateList);
          if (hHeight <= maxHeight) {
            currentPendingHeadings.push(detectedHeadings[i]);
          } else {
            if (currentPendingHeadings.length > 0) {
              finalTOCPages.push(currentPendingHeadings);
              currentPendingHeadings = [detectedHeadings[i]];
              currentTOCPageIdx++;
            } else {
              // Force at least one item per page to avoid infinite loops
              finalTOCPages.push([detectedHeadings[i]]);
              currentPendingHeadings = [];
              currentTOCPageIdx++;
            }
          }
        }
        if (currentPendingHeadings.length > 0 || detectedHeadings.length === 0) {
          finalTOCPages.push(currentPendingHeadings);
        }
      } else {
        finalTOCPages = [];
      }

      // Assign the absolute page numbers based on the final TOC pages count
      finalTOCPages.forEach((tocPage) => {
        tocPage.forEach((heading) => {
          const relPage = heading.pageRelative !== undefined ? heading.pageRelative : 0;
          heading.page = relPage + 2 + finalTOCPages.length;
        });
      });

      detectedHeadings.forEach((heading) => {
        const relPage = heading.pageRelative !== undefined ? heading.pageRelative : 0;
        heading.page = relPage + 2 + (settings.showTOC ? finalTOCPages.length : 0);
      });

      // Cleanup our temporary workspace
      document.body.removeChild(tempMeasureContainer);

      // Update states
      setPaginatedPages(pagesList);
      setPaginatedTOCPages(finalTOCPages);
      setDynamicHeadings(detectedHeadings);
      setPageCount(pagesList.length + 1 + (settings.showTOC ? finalTOCPages.length : 0)); // Content + Cover + TOC (if enabled)
      
      setRecalculating(false);
    };

    // Run pagination
    handlePagination();
  }, [resolvedHtmlContent, settings.pageSize, settings.orientation, settings.showTOC, settings.tocTitle, settings.blockStyleTOC, setPageCount, isLetter, leftMargin, rightMargin, topMargin, bottomMargin, pageHeight, settings.splitBlockCodeBorders, previewMode]);

  // Detector de Desbordes Gráfico: Encuentra elementos cuyo ancho o largo excede el espacio neto disponible de la página.
  useEffect(() => {
    if (previewMode === 'server') {
      setDetectedOverflows([]);
      return;
    }
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
        const parentH = pageHeight - topMargin - bottomMargin - 5;

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
          // We exclude boundingClientRect measurements (actualMeasuredW/H) to avoid subpixel/zoom scaling errors
          const finalW = Math.max(scrollW, offsetW, styleWidthVal);
          const finalH = Math.max(scrollH, offsetH, styleHeightVal);

          let isWOver = false;
          let isHOver = false;

          // Check if width exceeds
          if (finalW > parentW + 10) {
            isWOver = true;
          }

          // Check if height exceeds
          if (finalH > parentH + 10) {
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
  }, [paginatedPages, contentWidth, resolvedHtmlContent, zoom, pageHeight, topMargin, bottomMargin, previewMode]);

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
      css += `\n.unemi-document-content, .unemi-document-content p, .unemi-document-content div:not(.unemi-academic-header):not(.unemi-academic-footer):not(.toc-container):not(.note):not(.math-expr):not(.unemi-bibliography-item):not(.unemi-bibliography-title) {`;
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

    // Código (Monospace) Graphical Styling
    const blockTheme = settings.blockCodeTheme || settings.codeTheme || 'academic';
    const rawBlockSize = settings.blockCodeSize !== undefined ? settings.blockCodeSize : (settings.codeSize || '13px');
    const blockSize = formatFontSize(rawBlockSize, '13px');
    const inlineTheme = settings.inlineCodeTheme || settings.codeTheme || 'academic';
    const rawInlineSize = settings.inlineCodeSize !== undefined ? settings.inlineCodeSize : '12px';
    const inlineSize = formatFontSize(rawInlineSize, '12px');

    css += `\n.unemi-document-content pre, .unemi-document-content pre * {`;
    css += ` font-family: "Fira Code", "Courier New", Courier, monospace !important;`;
    css += ` font-size: ${blockSize} !important;`;
    css += ` text-indent: 0px !important;`;
    css += ` }`;

    css += `\n.unemi-document-content code:not(pre code) {`;
    css += ` font-family: "Fira Code", "Courier New", Courier, monospace !important;`;
    css += ` font-size: ${inlineSize} !important;`;
    css += ` text-indent: 0px !important;`;
    css += ` }`;
    
    css += `\n.unemi-document-content pre {`;
    css += ` padding: 12px 16px !important;`;
    css += ` margin: 16px 0 !important;`;
    css += ` border-radius: 6px !important;`;
    css += ` overflow-x: auto !important;`;
    css += ` line-height: 1.5 !important;`;
    css += ` text-indent: 0px !important;`;
    css += ` }`;

    // Inline code styling
    let inlineBg = '#f1f5f9';
    let inlineColor = '#0f172a';
    let inlineBorder = '#cbd5e1';
    if (inlineTheme === 'dracula') {
      inlineBg = '#282a36';
      inlineColor = '#f8f8f2';
      inlineBorder = '#44475a';
    } else if (inlineTheme === 'monokai') {
      inlineBg = '#272822';
      inlineColor = '#f8f8f2';
      inlineBorder = '#3e3d32';
    } else if (inlineTheme === 'github-light') {
      inlineBg = '#f6f8fa';
      inlineColor = '#24292f';
      inlineBorder = '#d0d7de';
    } else if (inlineTheme === 'solarized-light') {
      inlineBg = '#fdf6e3';
      inlineColor = '#657b83';
      inlineBorder = '#efe8d4';
    } else if (inlineTheme === 'nord') {
      inlineBg = '#2e3440';
      inlineColor = '#d8dee9';
      inlineBorder = '#3b4252';
    } else {
      // academic / default light
      inlineBg = '#f8fafc';
      inlineColor = '#0f172a';
      inlineBorder = '#cbd5e1';
    }

    css += `\n.unemi-document-content code:not(pre code) {`;
    css += ` background-color: ${inlineBg} !important;`;
    css += ` color: ${inlineColor} !important;`;
    css += ` padding: 2px 5px !important;`;
    css += ` border-radius: 4px !important;`;
    css += ` border: 1px solid ${inlineBorder} !important;`;
    css += ` display: inline !important;`;
    css += ` text-indent: 0 !important;`;
    css += ` word-break: break-word !important;`;
    css += ` box-decoration-break: clone !important;`;
    css += ` -webkit-box-decoration-break: clone !important;`;
    css += ` }`;
    
    if (blockTheme === 'dracula') {
      css += `\n.unemi-document-content pre { background-color: #282a36 !important; border: 1px solid #44475a !important; color: #f8f8f2 !important; }`;
      css += `\n.unemi-document-content pre code { color: #f8f8f2 !important; background-color: transparent !important; padding: 0 !important; }`;
      css += `\n.unemi-document-content pre .token.comment, .unemi-document-content pre .token.prolog, .unemi-document-content pre .token.doctype, .unemi-document-content pre .token.cdata { color: #6272a4 !important; font-style: italic !important; }`;
      css += `\n.unemi-document-content pre .token.keyword, .unemi-document-content pre .token.operator, .unemi-document-content pre .token.atrule { color: #ff79c6 !important; }`;
      css += `\n.unemi-document-content pre .token.string, .unemi-document-content pre .token.char { color: #f1fa8c !important; }`;
      css += `\n.unemi-document-content pre .token.function, .unemi-document-content pre .token.class-name { color: #50fa7b !important; }`;
      css += `\n.unemi-document-content pre .token.number, .unemi-document-content pre .token.boolean, .unemi-document-content pre .token.constant { color: #bd93f9 !important; }`;
      css += `\n.unemi-document-content pre .token.punctuation, .unemi-document-content pre .token.property, .unemi-document-content pre .token.tag { color: #f8f8f2 !important; }`;
    } else if (blockTheme === 'monokai') {
      css += `\n.unemi-document-content pre { background-color: #272822 !important; border: 1px solid #3e3d32 !important; color: #f8f8f2 !important; }`;
      css += `\n.unemi-document-content pre code { color: #f8f8f2 !important; background-color: transparent !important; padding: 0 !important; }`;
      css += `\n.unemi-document-content pre .token.comment, .unemi-document-content pre .token.prolog, .unemi-document-content pre .token.doctype, .unemi-document-content pre .token.cdata { color: #75715e !important; font-style: italic !important; }`;
      css += `\n.unemi-document-content pre .token.keyword, .unemi-document-content pre .token.operator, .unemi-document-content pre .token.atrule { color: #f92672 !important; }`;
      css += `\n.unemi-document-content pre .token.string, .unemi-document-content pre .token.char { color: #e6db74 !important; }`;
      css += `\n.unemi-document-content pre .token.function, .unemi-document-content pre .token.class-name { color: #a6e22e !important; }`;
      css += `\n.unemi-document-content pre .token.number, .unemi-document-content pre .token.boolean, .unemi-document-content pre .token.constant { color: #ae81ff !important; }`;
      css += `\n.unemi-document-content pre .token.punctuation, .unemi-document-content pre .token.property, .unemi-document-content pre .token.tag { color: #f8f8f2 !important; }`;
    } else if (blockTheme === 'github-light') {
      css += `\n.unemi-document-content pre { background-color: #f6f8fa !important; border: 1px solid #d0d7de !important; color: #24292f !important; }`;
      css += `\n.unemi-document-content pre code { color: #24292f !important; background-color: transparent !important; padding: 0 !important; }`;
      css += `\n.unemi-document-content pre .token.comment, .unemi-document-content pre .token.prolog, .unemi-document-content pre .token.doctype, .unemi-document-content pre .token.cdata { color: #6e7781 !important; font-style: italic !important; }`;
      css += `\n.unemi-document-content pre .token.keyword, .unemi-document-content pre .token.operator, .unemi-document-content pre .token.atrule { color: #cf222e !important; font-weight: bold !important; }`;
      css += `\n.unemi-document-content pre .token.string, .unemi-document-content pre .token.char { color: #0a3069 !important; }`;
      css += `\n.unemi-document-content pre .token.function, .unemi-document-content pre .token.class-name { color: #8250df !important; }`;
      css += `\n.unemi-document-content pre .token.number, .unemi-document-content pre .token.boolean, .unemi-document-content pre .token.constant { color: #0550ae !important; }`;
      css += `\n.unemi-document-content pre .token.punctuation, .unemi-document-content pre .token.property, .unemi-document-content pre .token.tag { color: #24292f !important; }`;
    } else if (blockTheme === 'solarized-light') {
      css += `\n.unemi-document-content pre { background-color: #fdf6e3 !important; border: 1px solid #efe8d4 !important; color: #657b83 !important; }`;
      css += `\n.unemi-document-content pre code { color: #657b83 !important; background-color: transparent !important; padding: 0 !important; }`;
      css += `\n.unemi-document-content pre .token.comment, .unemi-document-content pre .token.prolog, .unemi-document-content pre .token.doctype, .unemi-document-content pre .token.cdata { color: #93a1a1 !important; font-style: italic !important; }`;
      css += `\n.unemi-document-content pre .token.keyword, .unemi-document-content pre .token.operator, .unemi-document-content pre .token.atrule { color: #859900 !important; }`;
      css += `\n.unemi-document-content pre .token.string, .unemi-document-content pre .token.char { color: #2aa198 !important; }`;
      css += `\n.unemi-document-content pre .token.function, .unemi-document-content pre .token.class-name { color: #268bd2 !important; }`;
      css += `\n.unemi-document-content pre .token.number, .unemi-document-content pre .token.boolean, .unemi-document-content pre .token.constant { color: #d33682 !important; }`;
      css += `\n.unemi-document-content pre .token.punctuation, .unemi-document-content pre .token.property, .unemi-document-content pre .token.tag { color: #586e75 !important; }`;
    } else if (blockTheme === 'nord') {
      css += `\n.unemi-document-content pre { background-color: #2e3440 !important; border: 1px solid #3b4252 !important; color: #d8dee9 !important; }`;
      css += `\n.unemi-document-content pre code { color: #d8dee9 !important; background-color: transparent !important; padding: 0 !important; }`;
      css += `\n.unemi-document-content pre .token.comment, .unemi-document-content pre .token.prolog, .unemi-document-content pre .token.doctype, .unemi-document-content pre .token.cdata { color: #4c566a !important; font-style: italic !important; }`;
      css += `\n.unemi-document-content pre .token.keyword, .unemi-document-content pre .token.operator, .unemi-document-content pre .token.atrule { color: #81a1c1 !important; }`;
      css += `\n.unemi-document-content pre .token.string, .unemi-document-content pre .token.char { color: #a3be8c !important; }`;
      css += `\n.unemi-document-content pre .token.function, .unemi-document-content pre .token.class-name { color: #88c0d0 !important; }`;
      css += `\n.unemi-document-content pre .token.number, .unemi-document-content pre .token.boolean, .unemi-document-content pre .token.constant { color: #b48ead !important; }`;
      css += `\n.unemi-document-content pre .token.punctuation, .unemi-document-content pre .token.property, .unemi-document-content pre .token.tag { color: #eceff4 !important; }`;
    } else {
      // academic / default
      css += `\n.unemi-document-content pre { background-color: #f8fafc !important; border: 1px solid #cbd5e1 !important; color: #0f172a !important; }`;
      css += `\n.unemi-document-content pre code { color: #0f172a !important; background-color: transparent !important; padding: 0 !important; }`;
      css += `\n.unemi-document-content pre .token.comment, .unemi-document-content pre .token.prolog, .unemi-document-content pre .token.doctype, .unemi-document-content pre .token.cdata { color: #64748b !important; font-style: italic !important; }`;
      css += `\n.unemi-document-content pre .token.keyword, .unemi-document-content pre .token.operator, .unemi-document-content pre .token.atrule { color: #0f172a !important; font-weight: bold !important; }`;
      css += `\n.unemi-document-content pre .token.string, .unemi-document-content pre .token.char { color: #0f172a !important; font-style: italic !important; }`;
      css += `\n.unemi-document-content pre .token.function, .unemi-document-content pre .token.class-name { color: #0f172a !important; }`;
      css += `\n.unemi-document-content pre .token.number, .unemi-document-content pre .token.boolean, .unemi-document-content pre .token.constant { color: #0f172a !important; }`;
      css += `\n.unemi-document-content pre .token.punctuation, .unemi-document-content pre .token.property, .unemi-document-content pre .token.tag { color: #0f172a !important; }`;
    }

    // Custom CSS input by the user (avoiding selector namespace collisions)
    if (settings.customAddedCss) {
      // We append it cleanly
      css += `\n/* User Custom Additional CSS */\n${settings.customAddedCss}`;
    }

    // Bibliography styling
    css += `
    .unemi-bibliography-item {
      padding-left: 0.5in !important;
      text-indent: -0.5in !important;
      line-height: 2.0 !important;
      font-size: 16px !important;
      font-family: 'Times New Roman', Times, serif !important;
      text-align: left !important;
      display: block !important;
    }
    .unemi-bibliography-title {
      font-family: 'Times New Roman', Times, serif !important;
      font-size: 16px !important;
      font-weight: bold !important;
      text-align: center !important;
      margin-top: 24px !important;
      margin-bottom: 24px !important;
      display: block !important;
    }
    .unemi-margin-element img {
      width: 100% !important;
      height: 100% !important;
      object-fit: fill !important;
    }
    `;

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
          .print-page-boundary {
            margin: 0px !important;
            padding: 0px !important;
          }
        }
        ${BASE_TOC_CSS}
        ${getGraphicalAndCustomCSS()}
        ${settings.blockStyleTitles || ''}
        ${settings.blockStyleHeader || ''}
        ${settings.blockStyleFooter || ''}
        ${settings.blockStylePageNum || ''}
        ${settings.blockStyleTOC || ''}
        ${settings.blockStyleLists || ''}
        ${settings.tableCustomCss || ''}
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
        </div>
      </div>

      {/* 4. ACTUAL ENEMY PAGE SHEETS STAGE */}
      <div className={`flex-1 overflow-auto custom-scrollbar print:p-0 print:overflow-visible print:bg-white bg-neutral-100 flex flex-col items-center select-none min-h-0 w-full ${previewMode === 'server' ? 'p-0' : 'p-8'}`}>
         {previewMode === 'server' && (
          <div className="w-full h-full flex flex-col overflow-auto bg-white relative shrink-0">
            {/* Sync status indicator overlay */}
            <div className={`absolute top-3 right-3 px-3 py-1 rounded-full text-[10px] font-bold z-20 flex items-center gap-1.5 shadow-md border ${
              isSyncingServer 
                ? 'bg-amber-50 text-amber-700 border-amber-20 border-amber-200/50' 
                : 'bg-emerald-50 text-emerald-700 border-emerald-200/50'
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${isSyncingServer ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
              {isSyncingServer ? 'Sincronizando cambios...' : 'Sincronizado'}
            </div>
            
            {/* Overlay to block interaction until compiling, server sync, and scroll sync are done */}
            {(isScrollSyncing || isSyncingServer || isCompiling) && (
              <div 
                className="absolute inset-0 bg-transparent z-[1000] cursor-wait pointer-events-auto select-none"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onWheel={(e) => { if (e.cancelable) e.preventDefault(); e.stopPropagation(); }}
                onTouchStart={(e) => { if (e.cancelable) e.preventDefault(); e.stopPropagation(); }}
                onTouchMove={(e) => { if (e.cancelable) e.preventDefault(); e.stopPropagation(); }}
              />
            )}

            {/* Server preview iframe */}
            {serverPreviewId ? (
              <div
                className="w-full h-full origin-top transition-all duration-200"
                style={{
                  transform: `scale(${zoom / 100})`,
                  transformOrigin: 'top center',
                  width: zoom > 100 ? `${zoom}%` : '100%',
                  height: zoom > 100 ? `${zoom}%` : '100%',
                  minWidth: '100%',
                  minHeight: '100%',
                }}
              >
                <iframe
                  id="unemi-server-iframe"
                  src={`/preview/${serverPreviewId}`}
                  className="w-full h-full border-0 bg-neutral-50"
                  title="Servidor Interactivo de Previsualización"
                  onLoad={handleIframeLoad}
                />
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-500 gap-4 bg-neutral-50">
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
          className={`document-rendered-container ${previewMode === 'server' ? 'invisible absolute pointer-events-none h-0 w-0 overflow-hidden' : ''} flex flex-col gap-8 print:gap-0 transition-transform origin-top`}
          style={previewMode === 'server' ? {} : {
            transform: `scale(${zoom / 100})`,
            marginBottom: `${(zoom - 100) * 10}px`,
          }}
        >
          {/* PAGE 1: COVER PAGE (No headers/footers) */}
          <CoverPage 
            config={resolvedCover} 
            pageSize={settings.pageSize} 
            orientation={settings.orientation} 
            marginElements={settings.marginElements}
            totalPages={paginatedPages.length + 1 + (settings.showTOC ? paginatedTOCPages.length : 0)}
            uploadedFiles={uploadedFiles}
          />

          {/* PAGE 2+: TABLE OF CONTENTS (Optional academic pages, strictly out of content.html) */}
          {settings.showTOC && paginatedTOCPages.map((tocPageHeadings, tIdx) => {
            const pageNum = 2 + tIdx;
            const totalPages = paginatedPages.length + 1 + paginatedTOCPages.length;
            const isFirst = tIdx === 0;

            return (
              <PageTemplate
                key={`toc-page-${tIdx}`}
                pageNumber={pageNum}
                totalPages={totalPages}
                pageSize={settings.pageSize}
                settings={settings}
                showGuides={settings.showGuides}
                coverConfig={resolvedCover}
                uploadedFiles={uploadedFiles}
              >
                <div className="toc-container select-text">
                  {isFirst && (
                    <div className="toc-header">
                      {settings.tocTitle || "Tabla de Contenidos"}
                    </div>
                  )}
                  <ul className="toc-list">
                    {tocPageHeadings.map((heading, hIdx) => {
                      const levelClass = `toc-level-${heading.level}`;
                      // Absolute page calculations
                      const absolutePage = (heading.pageRelative !== undefined ? heading.pageRelative : 0) + 2 + paginatedTOCPages.length;

                      return (
                        <li 
                          key={hIdx} 
                          className={`toc-item ${levelClass}`}
                        >
                          <span className="toc-title">{heading.text}</span>
                          <span className="toc-dots" />
                          <span className="toc-page">{absolutePage}</span>
                        </li>
                      );
                    })}
                    {tocPageHeadings.length === 0 && (
                      <li className="text-gray-400 italic text-center w-full py-4 flex justify-center items-center">
                        (Inserte títulos H1 o H2 en el editor de contenido para generar el índice automático)
                      </li>
                    )}
                  </ul>
                </div>
              </PageTemplate>
            );
          })}

          {/* PAGES 3+ (or 2+): Dynamic pagination sheets */}
          {paginatedPages.length > 0 ? (
            paginatedPages.map((pageHTMLs, index) => {
              const pageHTMLJoined = pageHTMLs.join('');

              return (
                <PageTemplate
                  key={index}
                  pageNumber={index + 2 + (settings.showTOC ? paginatedTOCPages.length : 0)} // Content pages start at Page 2 or Page 2 + paginatedTOCPages.length
                  totalPages={paginatedPages.length + 1 + (settings.showTOC ? paginatedTOCPages.length : 0)}
                  pageSize={settings.pageSize}
                  settings={settings}
                  showGuides={settings.showGuides}
                  coverConfig={resolvedCover}
                  uploadedFiles={uploadedFiles}
                >
                  <div
                    className="unemi-document-body"
                    dangerouslySetInnerHTML={{ __html: renderPageHTML(pageHTMLJoined) }}
                  />
                </PageTemplate>
              );
            })
          ) : (
            /* Blank Fallback content page in case there is no body content */
            <PageTemplate
              pageNumber={settings.showTOC ? 2 + paginatedTOCPages.length : 2}
              totalPages={settings.showTOC ? 2 + paginatedTOCPages.length : 2}
              pageSize={settings.pageSize}
              settings={settings}
              showGuides={settings.showGuides}
              coverConfig={resolvedCover}
              uploadedFiles={uploadedFiles}
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
