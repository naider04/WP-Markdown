/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import katex from 'katex';
import { mathmlToOmml } from '../lib/ommlConverter';
import { markdownParser } from './markdownParser';
import { PageSettings, UploadedFile, BibliographyItem } from '../types';
import { getAPALastNames, formatAPABibliographyItem, extractAPAYear } from './apaFormatter';

export const BASE_TOC_CSS = `
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

function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderKaTeXWithOMML(mathContent: string, isDisplay: boolean, isContinuous = false): string {
  let rendered = "";
  try {
    rendered = katex.renderToString(mathContent, {
      displayMode: isDisplay,
      throwOnError: false
    });
  } catch (err) {
    return `<span class="text-red-500 font-mono text-[10px]" title="${escapeHtml(String(err))}">[Math Error: ${escapeHtml(mathContent)}]</span>`;
  }

  if (isContinuous) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(rendered, 'text/html');
      const mathEl = doc.querySelector('math');
      if (mathEl) {
        const ommlXml = mathmlToOmml(mathEl.outerHTML, isDisplay);
        if (ommlXml) {
          const katexSpan = doc.querySelector('.katex');
          if (katexSpan) {
            const commentStr = `<!--[if gte msEquation 12]>${ommlXml}<![endif]-->`;
            katexSpan.insertAdjacentHTML('afterbegin', commentStr);
            rendered = doc.body.innerHTML;
          }
        }
      }
    } catch (e) {
      // Fallback
    }
  }

  return rendered;
}

function parseTextAndRenderMath(text: string, isContinuous = false): string {
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
      result += renderKaTeXWithOMML(mathContent, isDisplay, isContinuous);
      index = nextIndex;
    }
  }
  
  return result;
}

function renderMathInHtml(html: string, isContinuous = false): string {
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
          const renderedHtml = parseTextAndRenderMath(text, isContinuous);
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

  // Wrap any bare root-level inline elements or text nodes in a paragraph (<p>)
  const body = doc.body;
  const nodes = Array.from(body.childNodes);
  const blockTags = new Set([
    'P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 
    'UL', 'OL', 'LI', 'TABLE', 'PRE', 'BLOCKQUOTE', 
    'HR', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 
    'FIGURE', 'FORM'
  ]);
  
  let currentGroup: Node[] = [];
  const flushGroup = () => {
    if (currentGroup.length === 0) return;
    
    const hasContentOrElement = currentGroup.some(node => {
      if (node.nodeType === Node.ELEMENT_NODE) return true;
      if (node.nodeType === Node.TEXT_NODE && (node.nodeValue || '').trim() !== '') return true;
      return false;
    });
    
    if (hasContentOrElement) {
      const p = doc.createElement('p');
      const firstNode = currentGroup[0];
      body.insertBefore(p, firstNode);
      currentGroup.forEach(node => {
        p.appendChild(node);
      });
    }
    
    currentGroup = [];
  };
  
  for (const node of nodes) {
    const isBlock = node.nodeType === Node.ELEMENT_NODE && blockTags.has((node as HTMLElement).tagName.toUpperCase());
    if (isBlock) {
      flushGroup();
    } else {
      currentGroup.push(node);
    }
  }
  flushGroup();

  return doc.body.innerHTML;
}

function extractAndRenderMathPlaceholders(text: string, isContinuous = false): { cleanText: string; placeholders: Map<string, string> } {
  const placeholders = new Map<string, string>();
  let result = "";
  let index = 0;
  let placeholderCounter = 0;
  
  while (index < text.length) {
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
      result += text.slice(index);
      break;
    }
    
    result += text.slice(index, minIdx);
    
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
      result += text.slice(minIdx, minIdx + step);
      index = minIdx + step;
    } else {
      const placeholderKey = `MATHPLACEHOLDER_${placeholderCounter++}_` + Math.random().toString(36).substring(2, 8);
      const rendered = renderKaTeXWithOMML(mathContent, isDisplay, isContinuous);
      placeholders.set(placeholderKey, rendered);
      result += placeholderKey;
      index = nextIndex;
    }
  }
  
  return { cleanText: result, placeholders };
}

export function compileAndProcessMarkdown(
  text: string,
  isMarkdown: boolean,
  figureMap: Map<string, number>,
  tableMap: Map<string, number>,
  figureCounterRef: { val: number },
  tableCounterRef: { val: number },
  isContinuous = false
): string {
  if (!isMarkdown) return text;

  // Pre-extract and render all math expressions to shield them from markdown parser
  const { cleanText, placeholders } = extractAndRenderMathPlaceholders(text, isContinuous);
  let code = cleanText;
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
<div id="${idVal}" class="wp-rendered-figure" style="${containerStyle}">
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

  // 5. Restore math placeholders
  placeholders.forEach((renderedHtml, placeholderKey) => {
    const wrappedRegex = new RegExp(`<p>\\s*${placeholderKey}\\s*</p>`, 'g');
    if (wrappedRegex.test(resultHtml)) {
      resultHtml = resultHtml.replace(wrappedRegex, renderedHtml);
    } else {
      resultHtml = resultHtml.replace(new RegExp(placeholderKey, 'g'), renderedHtml);
    }
  });

  return resultHtml;
}

export interface PostProcessCompiledMarkdownOptions {
  uploadedFiles?: UploadedFile[];
  bibliography?: BibliographyItem[];
  settings: PageSettings;
  isContinuous?: boolean;
  figureMap?: Map<string, number>;
  tableMap?: Map<string, number>;
}

/**
 * Post-processes compiled markdown/HTML: merges APA run-in headings, resolves
 * cross-references (@fig-* / @tbl-*), replaces uploaded images, in-text citations
 * ([@key]), manual [PAGEBREAK], [BIBLIOGRAPHY], [TOC] markers, appends the
 * automatic APA bibliography and renders remaining inline math.
 */
export function postProcessCompiledMarkdown(
  html: string,
  opts: PostProcessCompiledMarkdownOptions
): string {
  const { uploadedFiles = [], bibliography = [], settings, isContinuous = false, figureMap, tableMap } = opts;
  let selectHtml = html;

  // Merge run-in headings with the following paragraph
  selectHtml = selectHtml.replace(/<span class="apa-runin apa-level(\d+)">([\s\S]*?)<\/span>\s*<p>([\s\S]*?)<\/p>/gi, (match, level, title, paragraph) => {
    return `<p><span class="apa-runin apa-level${level}">${title}</span> ${paragraph}</p>`;
  });

  // Replace cross-references like @fig-id or @tbl-id
  const refRegex = /@(fig-[a-zA-Z0-9_-]+|tbl-[a-zA-Z0-9_-]+)/g;
  selectHtml = selectHtml.replace(refRegex, (match, id) => {
    if (id.startsWith('fig-')) {
      const num = figureMap?.get(id);
      if (num !== undefined) {
        return `<a href="#${id}" class="cross-reference-link" style="color: #004080; text-decoration: none; font-weight: 500; border-bottom: 1px dashed #004080;">Figura ${num}</a>`;
      }
    } else if (id.startsWith('tbl-')) {
      const num = tableMap?.get(id);
      if (num !== undefined) {
        return `<a href="#${id}" class="cross-reference-link" style="color: #004080; text-decoration: none; font-weight: 500; border-bottom: 1px dashed #004080;">Tabla ${num}</a>`;
      }
    }
    return match;
  });

  // Resolve image uploads
  if (uploadedFiles && uploadedFiles.length > 0) {
    uploadedFiles.forEach((file) => {
      const escapedName = file.name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(`src=["'](?:[^"']*/)?${escapedName}["']`, 'gi');
      selectHtml = selectHtml.replace(regex, `src="${file.dataUrl}"`);
    });
  }

  // Replace in-text citations like [@key] or [@key1; @key2]
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

  // Replace manual pagebreaks [PAGEBREAK]
  selectHtml = selectHtml.replace(/<p>\s*\[PAGEBREAK\]\s*<\/p>/gi, '<div class="page-break"></div>');
  selectHtml = selectHtml.replace(/\[PAGEBREAK\]/gi, '<div class="page-break"></div>');

  // Replace manual bibliography [BIBLIOGRAPHY]
  const hasManualBibliography = selectHtml.includes('[BIBLIOGRAPHY]');
  if (hasManualBibliography) {
    let bibItemsToShow = [...bibliography];
    if (settings.showOnlyCitedBibliography) {
      bibItemsToShow = bibItemsToShow.filter(b => citedKeys.has(b.key.toLowerCase()));
    }

    const sortedBib = bibItemsToShow.sort((a, b) => a.authors.localeCompare(b.authors));
    const bibTitle = settings.bibliographyTitle || 'Referencias Bibliográficas';
    
    let bibHtml = `
      <h1 class="wp-bibliography-title" style="font-family: 'Times New Roman', Times, serif; font-size: 16px; font-weight: bold; text-align: center; margin-top: 24px; margin-bottom: 24px;">
        ${bibTitle}
      </h1>
    `;

    sortedBib.forEach(item => {
      bibHtml += `
        <div style="padding-left: 0.5in !important; text-indent: -0.5in !important; line-height: 2.0 !important; font-size: 16px !important; font-family: 'Times New Roman', Times, serif !important; text-align: left !important; display: block !important;" class="wp-bibliography-item">
          ${formatAPABibliographyItem(item)}
        </div>
      `;
    });

    selectHtml = selectHtml.replace(/<p>\s*\[BIBLIOGRAPHY\]\s*<\/p>/gi, bibHtml);
    selectHtml = selectHtml.replace(/\[BIBLIOGRAPHY\]/gi, bibHtml);
  }

  // Replace manual Table of Contents [TOC]
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

  // Append automatic APA bibliography page at the very end (only if not manually inserted)
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
      <h1 class="wp-bibliography-title" style="font-family: 'Times New Roman', Times, serif; font-size: 16px; font-weight: bold; text-align: center; margin-top: 24px; margin-bottom: 24px;">
        ${bibTitle}
      </h1>
    `;

    sortedBib.forEach(item => {
      bibHtml += `
        <div style="padding-left: 0.5in !important; text-indent: -0.5in !important; line-height: 2.0 !important; font-size: 16px !important; font-family: 'Times New Roman', Times, serif !important; text-align: left !important; display: block !important;" class="wp-bibliography-item">
          ${formatAPABibliographyItem(item)}
        </div>
      `;
    });
    
    selectHtml += bibHtml;
  }

  return renderMathInHtml(selectHtml, isContinuous);
}
