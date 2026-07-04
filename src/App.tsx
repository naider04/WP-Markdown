/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import JSZip from 'jszip';
import { CoverConfig, PageSettings, UploadedFile, HTMLBlock, BibliographyItem } from './types';
import SidebarEditor from './components/SidebarEditor';
import DocumentPreview from './components/DocumentPreview';
import { ConfigDrawer } from './components/ConfigDrawer';
import { BibliographyDrawer } from './components/BibliographyDrawer';
import { parseBibtex, generateBibtexFromItems } from './utils/bibParser';
import { Layers, Sliders, Image, Upload, Printer, Trash2, Code, ChevronDown, BookOpen } from 'lucide-react';

const DEFAULT_HEADER_HTML = `<div class="flex justify-between items-end text-[10px] uppercase font-bold tracking-wider pb-1 px-0.5 w-full">
  <div class="flex items-center gap-1.5 max-w-[320px]">
    <img src="icon.png" style="height: 18px; width: auto; display: inline-block; vertical-align: middle;" alt="UNEMI" />
    <span class="text-[8px] text-gray-400 normal-case font-medium truncate">Universidad Estatal de Milagro</span>
  </div>
  <div class="text-right text-gray-500 font-semibold">{page}</div>
</div>
<div class="h-[2px] w-full flex">
  <div class="h-full w-[25%]" style="background-color: #FF6600;"></div>
  <div class="h-full w-[75%]" style="background-color: #004080;"></div>
</div>`;

const DEFAULT_FOOTER_HTML = `<div class="h-[1px] w-full bg-gray-100 mb-2 footer-line"></div>
<div class="flex justify-between items-center text-[10px] text-gray-400 px-0.5 w-full">
  <div class="flex items-center gap-1.5 font-medium truncate max-w-[350px]">
    <span class="w-1.5 h-1.5 rounded-full footer-dot" style="background-color: #FF6600;"></span>
    <span>Universidad Estatal de Milagro</span>
  </div>
  <div class="text-[10px] tabular-nums shrink-0 unemi-page-num-indicator" style="color: #004080;">
    Página {page} de {total}
  </div>
</div>`;

const DEFAULT_BLOCK_TITLES = `/* Estilo de Títulos APA 7 (Level 1, 2, 3, etc.) */
.unemi-document-content h1 {
  font-family: "Times New Roman", Times, Georgia, serif;
  font-size: 16px;
  font-weight: bold;
  color: #000000;
  text-transform: none;
  text-align: center; /* APA 7 Level 1: Centered */
  margin-top: 24px;
  margin-bottom: 12px;
  border-bottom: none;
}
.unemi-document-content h1::after {
  display: none !important;
  content: none !important;
}
.unemi-document-content h2 {
  font-family: "Times New Roman", Times, Georgia, serif;
  font-size: 16px;
  font-weight: bold;
  color: #000000;
  text-align: left; /* APA 7 Level 2: Flush left */
  margin-top: 18px;
  margin-bottom: 8px;
}
.unemi-document-content h3 {
  font-family: "Times New Roman", Times, Georgia, serif;
  font-size: 16px;
  font-weight: bold;
  font-style: italic; /* APA 7 Level 3: Flush left, bold italic */
  color: #000000;
  text-align: left;
  margin-top: 14px;
  margin-bottom: 6px;
}
.unemi-document-content h4 {
  font-family: "Times New Roman", Times, Georgia, serif;
  font-size: 16px;
  font-weight: bold;
  color: #000000;
  text-align: left;
  text-indent: 0.5in; /* APA 7 Level 4: Indented, bold, run-in */
  margin-top: 10px;
  margin-bottom: 4px;
}
.unemi-document-content h5 {
  font-family: "Times New Roman", Times, Georgia, serif;
  font-size: 16px;
  font-weight: bold;
  font-style: italic; /* APA 7 Level 5: Indented, bold italic, run-in */
  color: #000000;
  text-align: left;
  text-indent: 0.5in;
  margin-top: 10px;
  margin-bottom: 4px;
}

/* Estilo de Párrafos y Contenido General */
.unemi-document-content p, .unemi-document-content {
  font-family: "Times New Roman", Times, Georgia, serif;
  font-size: 16px;
  line-height: 1.8;
  color: #000000;
  text-align: justify;
  text-indent: 0.5in; /* Indentación APA 7 */
  margin-top: 0;
  margin-bottom: 12px;
}`;

const DEFAULT_BLOCK_HEADER = `/* Estilo del Encabezado Académico APA 7 */
.unemi-academic-header {
  font-size: 10px;
  color: #555555;
  text-transform: none;
  letter-spacing: 0.02em;
  border-bottom: none !important;
}
.unemi-academic-header .header-bar-orange,
.unemi-academic-header .header-bar-blue {
  display: none !important; /* Remove colored header bars */
}`;

const DEFAULT_BLOCK_FOOTER = `/* Estilo del Pie de Página Académico APA 7 */
.unemi-academic-footer {
  font-size: 10px;
  color: #555555;
}
.unemi-academic-footer .footer-line {
  display: none !important; /* Remove colored footer lines */
}
.unemi-academic-footer .footer-dot {
  display: none !important;
}`;

const DEFAULT_BLOCK_PAGENUM = `/* Estilo de la Numeración de Página APA 7 */
.unemi-page-num-indicator {
  font-family: "Times New Roman", Times, serif;
  font-weight: normal;
  color: #000000 !important;
  font-size: 11px;
}`;

const DEFAULT_BLOCK_TOC = `/* Estilo de la Tabla de Contenidos (TOC) APA 7 */
.toc-container {
  margin: 0 !important;
  padding: 0 !important;
  border: none !important;
  background-color: transparent !important;
  box-shadow: none !important;
}
.toc-container h3 {
  font-family: "Times New Roman", Times, Georgia, serif !important;
  font-size: 16px !important;
  color: #000000 !important;
  border-bottom: none !important;
  font-weight: bold !important;
  text-transform: none !important;
  text-align: center !important;
  margin-top: 0 !important;
  margin-bottom: 24px !important;
}
.toc-list {
  list-style-type: none !important;
  padding-left: 0 !important;
  margin: 0 !important;
}
.toc-list li {
  display: flex !important;
  align-items: flex-end !important;
  margin-bottom: 12px !important;
  font-family: "Times New Roman", Times, Georgia, serif !important;
  font-size: 16px !important;
  color: #000000 !important;
  line-height: 2.0 !important;
}
.toc-title {
  font-family: "Times New Roman", Times, Georgia, serif !important;
  font-size: 16px !important;
  font-weight: normal !important;
  color: #000000 !important;
  white-space: nowrap !important;
}
.toc-dots {
  flex-grow: 1 !important;
  border-bottom: 1px dotted #000000 !important;
  margin: 0 8px !important;
  position: relative !important;
  top: -4px !important;
}
.toc-page {
  font-family: "Times New Roman", Times, Georgia, serif !important;
  font-size: 16px !important;
  font-weight: bold !important;
  color: #000000 !important;
}`;

const DEFAULT_BLOCK_TABLE = `/* Estilos de Tablas Académicas APA 7 */
.unemi-document-content table {
  width: 100% !important;
  border-collapse: collapse !important;
  margin-bottom: 24px !important;
  margin-top: 12px !important;
  box-sizing: border-box !important;
  font-family: "Times New Roman", Times, Georgia, serif !important;
}

.unemi-document-content table th {
  background-color: transparent !important;
  color: #000000 !important;
  font-family: "Times New Roman", Times, Georgia, serif !important;
  font-size: 12px !important;
  font-weight: bold !important;
  text-transform: none !important;
  padding: 8px 12px !important;
  text-align: left !important;
  border-top: 2px solid #000000 !important; /* APA 7: Top border */
  border-bottom: 1.5px solid #000000 !important; /* APA 7: Bottom border of header */
  border-left: none !important; /* No vertical borders */
  border-right: none !important;
}

.unemi-document-content table td {
  font-size: 12px !important;
  color: #000000 !important;
  padding: 8px 12px !important;
  border-top: none !important;
  border-left: none !important;
  border-right: none !important;
  line-height: 1.5 !important;
  text-align: left !important;
}

.unemi-document-content table tbody tr td {
  border-bottom: 1px solid rgba(0, 0, 0, 0.1) !important;
}

.unemi-document-content table tbody tr:last-child td {
  border-bottom: 2px solid #000000 !important; /* APA 7: Bottom border of the entire table */
}

/* Zebra alternating rows - disabled for pure APA 7 */
.unemi-document-content table tbody tr:nth-child(even) {
  background-color: transparent !important;
}

.unemi-document-content table tbody tr:hover {
  background-color: rgba(0, 0, 0, 0.02) !important;
}`;

export default function App() {
  // 1. Initial Cover Page Metadata with localStorage fallback
  const [cover, setCover] = useState<CoverConfig>(() => {
    const cached = localStorage.getItem('unemi_cover_config');
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        console.error('Error parsing cover config cache:', e);
      }
    }
    return {
      institution: 'Nombre de la Institución',
      facultad: 'Nombre de la Facultad',
      carrera: 'Carrera Académica / Especialidad',
      title: 'DISEÑO E IMPLEMENTACIÓN DE UN MOTOR WEB DE AUTOPAGINACIÓN DINÁMICA DE ALTA FIDELIDAD CON BORDES REGLAMENTARIOS',
      subtitle: 'Proyecto Integrador o Informe de Investigación',
      authors: 'Nombre del Autor',
      tutor: 'Nombre del Docente / Tutor',
      city: 'Ciudad, País',
      date: 'Junio, 2026',
      logoType: 'standard',
    };
  });

  // 1.5. Fullscreen indicator state
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // 2. Page configuration settings with localStorage fallback
  const [settings, setSettings] = useState<PageSettings>(() => {
    const cached = localStorage.getItem('unemi_page_settings');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        
        // Force-migrate titles, header, and footer from any old non-APA7 styles remaining in the browser cache
        if (parsed.blockStyleTitles && (parsed.blockStyleTitles.includes('#004080') || parsed.blockStyleTitles.includes('Space Grotesk') || parsed.blockStyleTitles.includes('18px') || parsed.blockStyleTitles.includes('12px') || !parsed.blockStyleTitles.includes('.unemi-document-content p'))) {
          parsed.blockStyleTitles = DEFAULT_BLOCK_TITLES;
        }
        if (parsed.blockStyleHeader && parsed.blockStyleHeader.includes('#004080')) {
          parsed.blockStyleHeader = DEFAULT_BLOCK_HEADER;
        }
        if (parsed.blockStyleFooter && parsed.blockStyleFooter.includes('#FF6600') || parsed.blockStyleFooter && parsed.blockStyleFooter.includes('#004080')) {
          parsed.blockStyleFooter = DEFAULT_BLOCK_FOOTER;
        }
        if (parsed.blockStylePageNum && parsed.blockStylePageNum.includes('#004080')) {
          parsed.blockStylePageNum = DEFAULT_BLOCK_PAGENUM;
        }
        if (parsed.blockStyleTOC && (parsed.blockStyleTOC.includes('#f8fafc') || parsed.blockStyleTOC.includes('border-radius') || parsed.blockStyleTOC.includes('18px 0') || parsed.blockStyleTOC.includes('#666666') || parsed.blockStyleTOC.includes('border-bottom: 1px dotted'))) {
          parsed.blockStyleTOC = DEFAULT_BLOCK_TOC;
        }
        
        // Fill defaults if block styles are missing from cache
        return {
          pageSize: 'letter',
          showGuides: false,
          headerText: '',
          footerText: '',
          autoRefreshFile: true,
          showTOC: false,
          tocTitle: 'Tabla de Contenidos',
          blockStyleTitles: DEFAULT_BLOCK_TITLES,
          blockStyleHeader: DEFAULT_BLOCK_HEADER,
          blockStyleFooter: DEFAULT_BLOCK_FOOTER,
          blockStylePageNum: DEFAULT_BLOCK_PAGENUM,
          blockStyleTOC: DEFAULT_BLOCK_TOC,
          tableCustomCss: DEFAULT_BLOCK_TABLE,
          pageNumTemplate: 'Página {page} de {total}',
          autoNumberHeadings: true,
          marginTop: 96,
          marginBottom: 96,
          marginLeft: 96,
          marginRight: 96,
          customAddedCss: '',
          customAddedJs: '',
          showBibliography: false,
          bibliographyTitle: 'Referencias Bibliográficas',
          headerHtml: DEFAULT_HEADER_HTML,
          footerHtml: DEFAULT_FOOTER_HTML,
          ...parsed
        };
      } catch (e) {
        console.error('Error parsing settings cache:', e);
      }
    }
    return {
      pageSize: 'letter',
      showGuides: false, // Display the dashed margin line by default (now false by user request)
      headerText: '',
      footerText: '',
      autoRefreshFile: true, // Auto polls /content.html unless locally edited
      showTOC: false,
      tocTitle: 'Tabla de Contenidos',
      blockStyleTitles: DEFAULT_BLOCK_TITLES,
      blockStyleHeader: DEFAULT_BLOCK_HEADER,
      blockStyleFooter: DEFAULT_BLOCK_FOOTER,
      blockStylePageNum: DEFAULT_BLOCK_PAGENUM,
      blockStyleTOC: DEFAULT_BLOCK_TOC,
      tableCustomCss: DEFAULT_BLOCK_TABLE,
      pageNumTemplate: 'Página {page} de {total}',
      autoNumberHeadings: true,
      marginTop: 96,
      marginBottom: 96,
      marginLeft: 96,
      marginRight: 96,
      customAddedCss: '',
      customAddedJs: '',
      showBibliography: false,
      bibliographyTitle: 'Referencias Bibliográficas',
      headerHtml: DEFAULT_HEADER_HTML,
      footerHtml: DEFAULT_FOOTER_HTML,
    };
  });

  // 2b. BibTeX references string state
  const [bibtex, setBibtex] = useState<string>(() => {
    const savedBib = localStorage.getItem('unemi_bibtex');
    if (savedBib) return savedBib;
    
    // Fallback migration: if there is an existing 'unemi_bibliography' array in localStorage, convert it to BibTeX
    const savedItems = localStorage.getItem('unemi_bibliography');
    if (savedItems) {
      try {
        const parsed = JSON.parse(savedItems);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return generateBibtexFromItems(parsed);
        }
      } catch (e) {
        console.error('Error migrating old bibliography to BibTeX:', e);
      }
    }
    
    return `@book{unemi2025,
  author    = {Universidad Estatal de Milagro},
  year      = {2025},
  title     = {Guía Metodológica para la Redacción de Trabajos Científicos},
  publisher = {Editorial UNEMI},
  url       = {https://www.unemi.edu.ec}
}

@article{patino2024,
  author    = {Patiño, W.},
  year      = {2024},
  title     = {Arquitecturas de Software Orientadas a Servicios en la Educación Superior},
  journal   = {Revista de Tecnología UNEMI},
  volume    = {15},
  number    = {2},
  pages     = {45-58},
  url       = {https://ojs.unemi.edu.ec}
}`;
  });

  useEffect(() => {
    localStorage.setItem('unemi_bibtex', bibtex);
  }, [bibtex]);

  // Derived bibliography array
  const bibliography = useMemo(() => {
    return parseBibtex(bibtex);
  }, [bibtex]);

  const setBibliography = (itemsOrFn: any) => {
    const items = typeof itemsOrFn === 'function' ? itemsOrFn(bibliography) : itemsOrFn;
    setBibtex(generateBibtexFromItems(items));
  };

  // 3. Document HTML Content with localStorage fallback
  const [htmlContent, setHtmlContent] = useState<string>(() => {
    return localStorage.getItem('unemi_html_content') || '';
  });

  // 3b. HTML blocks (for multiple stacked renamable editors)
  const [htmlBlocks, setHtmlBlocks] = useState<HTMLBlock[]>(() => {
    const cached = localStorage.getItem('unemi_html_blocks');
    if (cached) {
      try {
        const blocks = JSON.parse(cached);
        if (Array.isArray(blocks) && blocks.length > 0) {
          return blocks;
        }
      } catch (e) {
        console.error('Error parsing cached html blocks:', e);
      }
    }
    
    // Fallback: If there are no blocks but there is single htmlContent in localStorage from previous session, convert it to a block!
    const singleContent = localStorage.getItem('unemi_html_content') || '';
    return [{
      id: 'block_default',
      name: 'Bloque Principal',
      code: singleContent || `<!-- === INICIO DEL DOCUMENTO === -->\n<h1>Tema del Reporte Académico</h1>\n<p>Escriba aquí la introducción de su tarea académica...</p>\n`,
      collapsed: false,
      isMarkdown: false
    }];
  });

  const [lastFocusedBlockId, setLastFocusedBlockId] = useState<string | null>(null);
  const [activeDrawerType, setActiveDrawerType] = useState<'cover' | 'settings' | 'uploads' | 'bibliography' | null>(null);
  const [showTopBarFormats, setShowTopBarFormats] = useState<boolean>(false);

  // Helper to split any flat content back into blocks (used for initial or backup parses)
  const updateBlocksFromHTML = (htmlText: string) => {
    const blocks: HTMLBlock[] = [];
    // Search for block comment structures
    const blockRegex = /<!--\s*===BLOCK_START===\s*name="([^"]+)"\s*collapsed="([^"]+)"\s*(?:isMarkdown="([^"]+)"\s*)?-->([\s\S]*?)<!--\s*===BLOCK_END===\s*-->/g;
    
    let match;
    let index = 0;
    while ((match = blockRegex.exec(htmlText)) !== null) {
      const name = match[1];
      const isCollapsed = match[2] === 'true';
      const isMarkdown = match[3] === 'true';
      const code = match[4];
      blocks.push({
        id: `block_${Date.now()}_${index++}_${Math.random().toString(36).substr(2, 5)}`,
        name,
        code,
        collapsed: isCollapsed,
        isMarkdown
      });
    }
    
    if (blocks.length > 0) {
      setHtmlBlocks(blocks);
    } else {
      // Create a single default block
      setHtmlBlocks([{
        id: 'block_default',
        name: 'Bloque Principal',
        code: htmlText,
        collapsed: false
      }]);
    }
  };

  // 4. Tracking if user has customized the document locally to protect their changes
  const [isLocallyEdited, setIsLocallyEdited] = useState<boolean>(() => {
    return localStorage.getItem('unemi_is_locally_edited') === 'true';
  });

  // 5. Sidebar width custom size state
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    const cachedWidth = localStorage.getItem('unemi_sidebar_width');
    return cachedWidth ? parseInt(cachedWidth, 10) : 430;
  });

  // 6. Custom download file name state (without extension)
  const [exportFileName, setExportFileName] = useState<string>(() => {
    return localStorage.getItem('unemi_export_filename') || '';
  });

  // 7. List of uploaded files
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>(() => {
    const cached = localStorage.getItem('unemi_uploaded_files');
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        console.error('Error parsing cached uploaded files:', e);
      }
    }
    return [];
  });

  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [pageCount, setPageCount] = useState<number>(1);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string>('');
  
  const lastFetchedContentRef = useRef<string>('');
  const isResizingRef = useRef<boolean>(false);
  const [isResizing, setIsResizing] = useState<boolean>(false);

  // Sync state changes back to localStorage
  useEffect(() => {
    localStorage.setItem('unemi_cover_config', JSON.stringify(cover));
  }, [cover]);

  useEffect(() => {
    localStorage.setItem('unemi_page_settings', JSON.stringify(settings));
  }, [settings]);

  // Synchronize htmlBlocks changes and serialize them inside computed htmlContent
  useEffect(() => {
    localStorage.setItem('unemi_html_blocks', JSON.stringify(htmlBlocks));
    const merged = htmlBlocks.map(b => {
      return `<!-- ===BLOCK_START=== name="${b.name}" collapsed="${b.collapsed}"${b.isMarkdown ? ' isMarkdown="true"' : ''} -->\n${b.code}\n<!-- ===BLOCK_END=== -->`;
    }).join('\n\n');
    setHtmlContent(merged);
    localStorage.setItem('unemi_html_content', merged);
  }, [htmlBlocks]);

  useEffect(() => {
    localStorage.setItem('unemi_is_locally_edited', String(isLocallyEdited));
  }, [isLocallyEdited]);

  useEffect(() => {
    localStorage.setItem('unemi_sidebar_width', String(sidebarWidth));
  }, [sidebarWidth]);

  useEffect(() => {
    localStorage.setItem('unemi_export_filename', exportFileName);
  }, [exportFileName]);

  useEffect(() => {
    localStorage.setItem('unemi_uploaded_files', JSON.stringify(uploadedFiles));
  }, [uploadedFiles]);

  // Core Function to Fetch /content.html content
  const fetchContentFile = async (silent = false) => {
    // CRITICAL BUG FIX: If user has edited local values, do NOT poll/overwrite unless they explicitly chose to
    if (isLocallyEdited && silent) return;

    if (!silent) setIsSyncing(true);
    try {
      const timestamp = Date.now();
      const response = await fetch(`/content.html?t=${timestamp}`);
      if (response.ok) {
        const text = await response.text();
        if (text) {
          // If the user hasn't edited anything on the UI, pull the file safely
          if (!isLocallyEdited) {
            lastFetchedContentRef.current = text;
            updateBlocksFromHTML(text);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching content.html file:', err);
    } finally {
      if (!silent) setIsSyncing(false);
    }
  };

  // Initial fetch on mount if local cache is empty
  useEffect(() => {
    if (!htmlContent) {
      fetchContentFile();
    }
  }, []);

  // Interval for Live Auto-Refresher polling
  useEffect(() => {
    let intervalId: any = null;
    if (settings.autoRefreshFile && !isLocallyEdited) {
      intervalId = setInterval(() => {
        fetchContentFile(true);
      }, 2000); // Polls every 2 seconds for server edits
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [settings.autoRefreshFile, isLocallyEdited]);

  // Handle local textbox edits safely
  const handleHtmlContentChange = (newVal: string) => {
    updateBlocksFromHTML(newVal);
    setIsLocallyEdited(true); // Flag as customized so live polling doesn't wipe changes
  };

  // Re-sync with server file (reverting manual edits)
  const handleResetToOriginal = async () => {
    setIsSyncing(true);
    setSyncStatusMsg('Reincorporando...');
    try {
      const timestamp = Date.now();
      const response = await fetch(`/content.html?t=${timestamp}`);
      if (response.ok) {
        const text = await response.text();
        updateBlocksFromHTML(text);
        setIsLocallyEdited(false);
        setSyncStatusMsg('Sincronizado');
        setTimeout(() => setSyncStatusMsg(''), 2500);
      } else {
        setSyncStatusMsg('Error de servidor');
        setTimeout(() => setSyncStatusMsg(''), 3000);
      }
    } catch (err) {
      console.error('Error restoring original content:', err);
      setSyncStatusMsg('Fallo conexión');
      setTimeout(() => setSyncStatusMsg(''), 3000);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleInsertHTML = (snippet: string) => {
    const targetBlockId = lastFocusedBlockId || (htmlBlocks[0] && htmlBlocks[0].id);
    if (!targetBlockId) {
      alert("Por favor haga clic o enfoque algún bloque primero.");
      return;
    }
    setHtmlBlocks(prev => prev.map(b => {
      if (b.id !== targetBlockId) return b;
      
      const textarea = document.getElementById(`editor-textarea-${targetBlockId}`) as HTMLTextAreaElement;
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const currentVal = b.code;
        const newVal = currentVal.substring(0, start) + snippet + currentVal.substring(end);
        
        setTimeout(() => {
          textarea.focus();
          textarea.selectionStart = textarea.selectionEnd = start + snippet.length;
        }, 50);
        return { ...b, code: newVal };
      }
      return { ...b, code: b.code + snippet };
    }));
  };

  // Complete Reset of all settings and contents to start from 0
  const handleResetAllToZero = () => {
    if (window.confirm('¿Está seguro de que desea eliminar TODOS los cambios (portada, margen, estilos, imágenes y contenido html) y empezar desde cero? Esta acción no se puede deshacer.')) {
      localStorage.removeItem('unemi_cover_config');
      localStorage.removeItem('unemi_page_settings');
      localStorage.removeItem('unemi_html_content');
      localStorage.removeItem('unemi_html_blocks');
      localStorage.removeItem('unemi_is_locally_edited');
      localStorage.removeItem('unemi_sidebar_width');
      localStorage.removeItem('unemi_export_filename');
      localStorage.removeItem('unemi_uploaded_files');
      
      window.location.reload();
    }
  };

  // ZIP FILE PROJECT IMPORT SYSTEM
  const handleImportZIP = async (file: File) => {
    try {
      const zip = await JSZip.loadAsync(file);
      const metaFile = zip.file("configuracion_metadatos.json");
      const sourceFile = zip.file("contenido_fuente.html");

      if (!metaFile) {
        alert("El archivo ZIP no contiene la configuración del proyecto (configuracion_metadatos.json). Asegúrese de importar un ZIP válido exportado por esta aplicación.");
        return;
      }

      const metaText = await metaFile.async("string");
      const metaData = JSON.parse(metaText);

      if (metaData.cover) {
        setCover(metaData.cover);
      }
      if (metaData.settings) {
        // Enforce autoRefreshFile stays true as per instructions, but load everything else
        const parsedSettings = { ...metaData.settings };
        parsedSettings.autoRefreshFile = true;
        setSettings(parsedSettings);
      }
      if (metaData.uploadedFiles) {
        setUploadedFiles(metaData.uploadedFiles);
      }

      if (metaData.htmlBlocks) {
        setHtmlBlocks(metaData.htmlBlocks);
      } else if (sourceFile) {
        const sourceText = await sourceFile.async("string");
        updateBlocksFromHTML(sourceText);
      }

      if (metaData.bibliography) {
        setBibliography(metaData.bibliography);
      }

      setIsLocallyEdited(true);

      // Extract original file name (excluding extension) to pre-fill the name picker
      const baseName = file.name.replace(/\.zip$/i, '').replace(/_proyecto_academico$/i, '');
      setExportFileName(baseName);

      alert("¡Proyecto importado y restaurado con éxito! Ahora puede continuar editándolo de forma local.");
    } catch (err) {
      console.error("Error al importar el archivo ZIP:", err);
      alert("Error al procesar el archivo ZIP. Asegúrese de que no esté dañado.");
    }
  };

  // RESIZING DRAG ALGORITHM
  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    setIsResizing(true);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', stopResizing);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizingRef.current) return;
    const newWidth = Math.max(290, Math.min(e.clientX, 1000));
    setSidebarWidth(newWidth);
  };

  const stopResizing = () => {
    isResizingRef.current = false;
    setIsResizing(false);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', stopResizing);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  };

  // HIGH-FIDELITY SELF-CONTAINED ZIP EXPORTER
  const handleExportZIP = () => {
    const coverElement = document.getElementById('unemi-cover-page');
    const pageElements = document.querySelectorAll('[name^="document-page-"]');

    if (!coverElement || pageElements.length === 0) {
      alert('Error: Por favor, asegúrese de que el previsualizador haya cargado las páginas antes de exportar.');
      return;
    }

    // Capture pages markup
    let pagesHTML = '';
    // Append cover
    pagesHTML += `<div class="print-page-boundary">${coverElement.outerHTML}</div>\n`;
    // Append each page structure
    pageElements.forEach((el) => {
      const clone = el.cloneNode(true) as HTMLElement;
      // Strip dashboard specific dashed guide lines overlay
      const guide = clone.querySelector('.absolute.inset-0.pointer-events-none');
      if (guide && guide.innerHTML.includes('Guía:')) {
        guide.remove();
      }
      pagesHTML += `<div class="print-page-boundary">${clone.outerHTML}</div>\n`;
    });

    const isLetterSize = settings.pageSize === 'letter';
    const isA4 = settings.pageSize === 'a4';
    const isPortrait = (settings.orientation || 'portrait') === 'portrait';
    
    // Base physical dimensions for layout (swapped if Landscape orientation is selected)
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

    // Helper to sanitize any CSS input by removing manual <style> tags and avoiding stylesheet breakages
    const sanitizeCSS = (rawCss: string) => {
      if (!rawCss) return '';
      return rawCss
        .replace(/<\/?style[^>]*>/gi, '') // Strips <style> and </style> case insensitive
        .replace(/<\/script>/gi, '');     // Strips </script>
    };

    // Compile dynamic styles matching DocumentPreview.tsx layout parameters
    const getGraphicalCSS = () => {
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

      // P
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

      // Tablas
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
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${cover.title || 'Plantilla de Documento Académico'}</title>
  
  <!-- Tailwind CSS Play CDN compiler to guarantee precise styling of layout positions & borders -->
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
    
    /* Screen staging preview classes (centered stacked sheets) */
    .document-rendered-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 32px;
      padding: 48px 24px;
    }

    /* Core Pages layout constraints matching original previews */
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
      padding: 0 !important; /* Cover is full bleed */
      box-sizing: border-box !important;
      display: flex !important;
      flex-direction: column !important;
      justify-content: space-between !important;
      overflow: hidden !important;
      flex-shrink: 0 !important;
      width: ${paperWidth} !important;
      height: ${paperHeight} !important;
    }

    /* Position wrappers */
    .absolute { position: absolute !important; }
    
    /* UNEMI Typography core blocks rules */
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
      font-size: 12px !important;
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
      font-size: 12px !important;
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
      font-size: 12px !important;
    }

    /* Figure and academic Thumbnail/Image formatting */
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

    /* Absolute running elements styling */
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

    /* Print styling rules */
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
        padding: 0 !important; /* Full bleed cover */
      }
      @page {
        margin: 0 !important;
        size: ${settings.pageSize === 'letter' ? '8.5in 11in' : settings.pageSize === 'a4' ? '210mm 297mm' : '297mm 167.06mm'} ${isPortrait ? 'portrait' : 'landscape'};
      }
    }
    
    /* BLOQUES DE ESTILOS PERSONALIZADOS POR EL USUARIO (SANEADOS CONTRA ETIQUETAS ANIDADAS) */
    ${sanitizeCSS(settings.blockStyleTitles || '')}
    ${sanitizeCSS(settings.blockStyleHeader || '')}
    ${sanitizeCSS(settings.blockStyleFooter || '')}
    ${sanitizeCSS(settings.blockStylePageNum || '')}
    ${sanitizeCSS(settings.blockStyleTOC || '')}
    ${sanitizeCSS(settings.tableCustomCss || '')}
    ${getGraphicalCSS()}
    ${sanitizeCSS(settings.customAddedCss || '')}
    
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
  </style>
</head>
<body>
  <!-- Floating Academic Toolbar (Omitted when printing) -->
  <div id="unemi-academic-toolbar" class="fixed top-4 right-4 z-50 print:hidden flex items-center gap-3 bg-[#004080] text-white px-4 py-2 border-2 border-[#FF6600]/80 rounded-xl shadow-2xl">
    <span class="font-bold text-xs uppercase tracking-wider text-slate-100 flex items-center gap-1.5">
      <span class="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
      EDITOR DOC VIEW
    </span>
    <div class="h-4 w-[1px] bg-white/20"></div>
    <button id="unemi-start-presentation" class="bg-[#FF6600] hover:bg-[#ff8533] text-white font-bold text-xs px-3 py-1.5 rounded-lg border border-[#FF6600] cursor-pointer active:scale-95 transition-all flex items-center gap-1">
      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <polygon points="5 3 19 12 5 21 5 3" fill="currentColor"></polygon>
      </svg>
      Iniciar Presentación
    </button>
    <button onclick="window.print()" class="bg-slate-800 text-white font-semibold text-xs px-2.5 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-700 active:scale-95 transition-all flex items-center gap-1 cursor-pointer">
      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2m-2-5H8v8h8v-8z"></path>
      </svg>
      Imprimir
    </button>
  </div>

  <div class="document-rendered-container">
    ${pagesHTML}
  </div>
  
  <script>
    document.addEventListener("DOMContentLoaded", function() {
      if (window.location.protocol === 'file:') {
        var iframes = document.querySelectorAll('iframe[src*="youtube.com"], iframe[src*="youtu.be"]');
        iframes.forEach(function(iframe) {
          var src = iframe.src;
          var videoId = "";
          var match = src.match(/(?:embed\/|v=)([a-zA-Z0-9_-]{11})/);
          if (match && match[1]) {
            videoId = match[1];
          }
          
          var wrapper = document.createElement('div');
          wrapper.style.position = 'relative';
          wrapper.style.display = 'block';
          var iframeW = iframe.getAttribute('width');
          var iframeH = iframe.getAttribute('height');
          
          wrapper.style.width = iframeW ? (iframeW.indexOf('%') !== -1 ? iframeW : iframeW + 'px') : '100%';
          wrapper.style.maxWidth = '100%';
          wrapper.style.height = iframeH ? (iframeH.indexOf('%') !== -1 ? iframeH : iframeH + 'px') : '315px';
          wrapper.style.minHeight = '240px';
          wrapper.style.backgroundColor = '#0f172a';
          wrapper.style.borderRadius = '6px';
          wrapper.style.border = '1px solid #ea580c';
          wrapper.style.fontFamily = '"Inter", system-ui, -apple-system, sans-serif';
          wrapper.style.boxSizing = 'border-box';
          wrapper.style.margin = '16px auto';
          wrapper.style.overflow = 'hidden';
          
          var overlay = document.createElement('div');
          overlay.style.position = 'absolute';
          overlay.style.inset = '0';
          overlay.style.display = 'flex';
          overlay.style.flexDirection = 'column';
          overlay.style.alignItems = 'center';
          overlay.style.justifyContent = 'center';
          overlay.style.padding = '16px';
          overlay.style.textAlign = 'center';
          overlay.style.color = '#ffffff';
          overlay.style.zIndex = '5';
          overlay.style.boxSizing = 'border-box';
          
          var title = document.createElement('h4');
          title.textContent = '🔒 Reproductor Local Restringido (YouTube)';
          title.style.margin = '0 0 6px 0';
          title.style.fontSize = '13px';
          title.style.fontWeight = '750';
          title.style.color = '#f97316';
          
          var desc = document.createElement('p');
          desc.textContent = 'YouTube prohíbe reproducir vídeos en páginas abiertas localmente mediante doble clic (protocolo file:///).';
          desc.style.margin = '0 0 14px 0';
          desc.style.fontSize = '11px';
          desc.style.lineHeight = '1.4';
          desc.style.color = '#cbd5e1';
          desc.style.maxWidth = '390px';
          
          var btnContainer = document.createElement('div');
          btnContainer.style.display = 'flex';
          btnContainer.style.gap = '10px';
          btnContainer.style.justifyContent = 'center';
          btnContainer.style.flexWrap = 'wrap';
          
          var watchBtn = document.createElement('a');
          watchBtn.href = videoId ? 'https://www.youtube.com/watch?v=' + videoId : src;
          watchBtn.target = '_blank';
          watchBtn.textContent = '🌐 Ver Vídeo en YouTube';
          watchBtn.style.padding = '8px 14px';
          watchBtn.style.backgroundColor = '#e11d48';
          watchBtn.style.color = '#ffffff';
          watchBtn.style.borderRadius = '4px';
          watchBtn.style.fontSize = '11.5px';
          watchBtn.style.fontWeight = 'bold';
          watchBtn.style.textDecoration = 'none';
          watchBtn.style.display = 'inline-block';
          watchBtn.style.boxShadow = '0 2px 4px rgba(0,0,0,0.15)';
          
          var serverText = document.createElement('span');
          serverText.innerHTML = 'Para habilitar el reproductor aquí directamente, levante un servidor local ejecutando <code style="background:#1e293b; padding:2px 4px; border-radius:3px; font-family: monospace;">npx serve .</code> o cargue el proyecto en la web.';
          serverText.style.display = 'block';
          serverText.style.marginTop = '10px';
          serverText.style.fontSize = '9.5px';
          serverText.style.color = '#94a3b8';
          serverText.style.maxWidth = '380px';
          
          overlay.appendChild(title);
          overlay.appendChild(desc);
          btnContainer.appendChild(watchBtn);
          overlay.appendChild(btnContainer);
          overlay.appendChild(serverText);
          
          iframe.parentNode.insertBefore(wrapper, iframe);
          wrapper.appendChild(overlay);
          iframe.style.display = 'none';
        });
      }
    });
  </script>

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
            
            // Medir las dimensiones de maquetación nativas de la hoja (p. ej. 816x1056 o similar)
            var pageWidth = page.offsetWidth || 816;
            var pageHeight = page.offsetHeight || 1056;

            // Dejamos un margen del 6% (94% de la pantalla) para conservar aire estético elegante a los lados
            var maxWidth = viewportWidth * 0.94;
            var maxHeight = viewportHeight * 0.94;

            var scaleX = maxWidth / pageWidth;
            var scaleY = maxHeight / pageHeight;

            // Se toma el factor mínimo para asegurar que entre completa en la pantalla (Ajuste/Fit)
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
        
        // Hide the floating academic toolbar
        var toolbar = document.getElementById('unemi-academic-toolbar');
        if (toolbar) toolbar.style.setProperty('display', 'none', 'important');
        
        container.classList.remove('gap-12', 'p-12', 'gap-8', 'p-8', 'gap-32', 'p-24');
        container.classList.add('bg-slate-950', 'w-screen', 'h-screen', 'fixed', 'inset-0', 'z-40', 'overflow-hidden', 'flex', 'justify-center', 'items-center', 'p-4');
        
        container.style.setProperty('gap', '0px', 'important');
        container.style.setProperty('padding', '0px', 'important');
        container.style.setProperty('display', 'flex', 'important');
        container.style.setProperty('align-items', 'center', 'important');
        container.style.setProperty('justify-content', 'center', 'important');
        
        // Request fullscreen on document
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
        
        // Create or show the temporary info HUD banner
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
        
        // Fade out indicator automatically after 2.5 seconds
        if (hudTimeout) clearTimeout(hudTimeout);
        hudTimeout = setTimeout(function() {
          hud.style.opacity = '0';
        }, 3000);

        updatePageVisibility();
      }

      function stopPresentation() {
        inPresentationMode = false;
        presentationScale = 1.0;
        
        // Exit fullscreen if active
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
        
        // Show the hovering academic toolbar again
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
        container.classList.add('p-12', 'gap-8');
      }

      function nextPage() {
        if (currentPageIndex < pages.length - 1) {
          currentPageIndex++;
          // Persist exact zoom factor across page navigation
          updatePageVisibility();
        }
      }

      function prevPage() {
        if (currentPageIndex > 0) {
          currentPageIndex--;
          // Persist exact zoom factor across page navigation
          updatePageVisibility();
        }
      }

      var startBtn = document.getElementById('unemi-start-presentation');
      if (startBtn) startBtn.addEventListener('click', startPresentation);

      // Force-hide academic floating toolbar during program-triggered and OS/browser-triggered printing
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

      // Handle custom zooming actions: Mouse wheel & trackpad scroll gestures
      window.addEventListener('wheel', function(e) {
        if (!inPresentationMode) return;
        
        e.preventDefault();
        
        // Damp the input directly based on e.deltaY to dynamically support trackpads
        // and traditional wheel mice safely without sudden jumps
        var delta = -e.deltaY;
        var baseFactor = e.ctrlKey ? 0.0008 : 0.0003;
        var scaleChange = delta * baseFactor;
        
        // Clamp the instantaneous step change to prevent sudden visual jumps
        scaleChange = Math.min(Math.max(scaleChange, -0.05), 0.05);
        
        presentationScale = Math.min(Math.max(presentationScale + scaleChange, 0.3), 4.0);
        updatePageVisibility();
      }, { passive: false });

      // Handle multi-touch pinch to zoom gesture calculation (for mobile and touchscreens)
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
          
          // Applying a light softening damping filter of 0.15 to keep scaling natural, smooth and precise
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

      // Handle standard keys
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

      // Synchronize with external fullscreen gestures (such as ESC or browser tools)
      function onFullscreenChange() {
        var isFS = document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement;
        if (!isFS && inPresentationMode) {
          stopPresentation();
        }
      }
      document.addEventListener('fullscreenchange', onFullscreenChange);
      document.addEventListener('webkitfullscreenchange', onFullscreenChange);
      document.addEventListener('msfullscreenchange', onFullscreenChange);

      // Recalcular la escala del documento para ajustarse a las proporciones de pantalla al redimensionar
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
              if (!existingIframe) {
                var iframe = document.createElement('iframe');
                iframe.title = 'functional-block-' + block.getAttribute('data-block-id');
                iframe.sandbox = 'allow-scripts allow-modals allow-same-origin';
                iframe.style.cssText = 'width: 100%; height: 100%; border: none; overflow: hidden; display: block; flex: 1;';
                iframe.scrolling = 'no';
                
                block.appendChild(iframe);
                
                var doc = iframe.contentDocument || iframe.contentWindow.document;
                if (doc) {
                  doc.open();
                  doc.write('<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>html, body { margin: 0 !important; padding: 0 !important; width: 100% !important; height: 100% !important; overflow: hidden !important; background-color: transparent !important; }</style></head><body>' + template.innerHTML + '</body></html>');
                  doc.close();
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
  ${settings.customAddedJs ? `
  <script>
    // Código script personalizado inyectado
    (function() {
      try {
        ${settings.customAddedJs}
      } catch (err) {
        console.error("Script de usuario falló:", err);
      }
    })();
  </script>
  ` : ''}
</body>
</html>`;

    // Rewrite protocol relative schema links like //upload.wikimedia... to use explicit https:// protocols.
    // This allows browser security managers to fetch the resources correctly offline when double-clicked.
    const sanitizedHTML = cleanHTML
      .replace(/src="\/\//g, 'src="https://')
      .replace(/srcset="\/\//g, 'srcset="https://')
      .replace(/href="\/\//g, 'href="https://');

    // Package the documents asynchronously into high-fidelity academic ZIP
    const zip = new JSZip();

    const isWindows = /windows/i.test(navigator.userAgent || '');
    const docSizeText = isLetterSize ? 'Carta / Letter' : isA4 ? 'A4' : 'Pantalla Ancha (Widescreen 16:9)';
    const docOrientationText = isPortrait ? 'Vertical (Portrait)' : 'Horizontal (Landscape)';

    let pdfWidthMM = '297mm';
    let pdfHeightMM = '167.06mm';

    if (isLetterSize) {
      pdfWidthMM = isPortrait ? '215.9mm' : '279.4mm';
      pdfHeightMM = isPortrait ? '279.4mm' : '215.9mm';
    } else if (isA4) {
      pdfWidthMM = isPortrait ? '210mm' : '297mm';
      pdfHeightMM = isPortrait ? '297mm' : '210mm';
    } else {
      // Default: 16:9
      pdfWidthMM = isPortrait ? '167.06mm' : '297mm';
      pdfHeightMM = isPortrait ? '297mm' : '167.06mm';
    }

    let readmeText = `=== PAQUETE DE ENTREGA DE DOCUMENTO ACADÉMICO ===
Generado el: ${new Date().toLocaleDateString('es-EC')}
Institución: ${cover.institution}
Facultad/Carrera: ${cover.facultad} / ${cover.carrera}
Tema: ${cover.title}
Tamaño Definido: ${docSizeText} (${docOrientationText})

Este archivo comprimido (.zip) estructurado contiene sus componentes académicos de entrega listos para presentación:

========================================================================
1. [DOCUMENTO DIGITAL] "documento_formateado_imprimible.html"
========================================================================
El documento definitivo de alta resolución formateado con la carátula reglamentaria,
márgenes de diseño de 1 pulgada, paginación real automática, y bandas institucionales.

¿Cómo visualizarlo correctamente?
- Puede abrir este archivo directamente haciendo Doble Clic.
- NOTA IMPORTANTÍSIMA SOBRE IMÁGENES: Todas las imágenes que subió y utilizó en el documento han sido
  guardadas como archivos reales individuales en esta misma carpeta (ej: "icon.png", "cover.png").
  El archivo HTML las enlaza directamente usando sus nombres simples para evitar códigos kilométricos base64,
  permitiéndole editarlos y manejarlos de forma extremadamente sencilla.

========================================================================
2. [CONVERSOR DIRECTO A PDF PERFECTO] (AUTOMATIZADO)
========================================================================
¿Tiene problemas con el tamaño de papel de la presentación/documento?
¡Hemos incluido scripts automáticos de conversión local con Puppeteer!
Estos scripts buscarán automáticamente Google Chrome o Microsoft Edge en su computadora,
instalarán las dependencias necesarias en segundos y crearán un PDF impecable en el tamaño exacto definido (${docSizeText} ${docOrientationText}).

¿Cómo usarlo?
- En Windows:
  Simplemente haga Doble Clic en el archivo "generar_pdf_windows.bat".`;

    if (!isWindows) {
      readmeText += `
- En macOS / Linux:
  Abra una terminal en esta carpeta y ejecute: sh generar_pdf_mac_linux.sh
  (O haga doble clic al archivo shell script).`;
    }

    readmeText += `

Requerimiento mínimo: Tener Node.js instalado en su sistema.
El script se encargará del resto de manera silenciosa y exportará "documento_final_perfecto.pdf".

========================================================================
3. [CÓDIGO FUENTE] "contenido_fuente.html"
========================================================================
Su contenido de texto crudo en HTML limpio para que pueda copiarlo o editarlo en el futuro de ser necesario.

========================================================================
4. [METADATOS DE RESPALDO] "configuracion_metadatos.json"
========================================================================
Archivo JSON que contiene toda su configuración (carátula, autores, tutores, páginas). Sirve para que el sistema retenga de forma permanente la base de datos de su trabajo.
`;

    zip.file("README_ENTREGA.txt", readmeText);

    // Replace all base64 dataUrls in final HTML and source code with their plain filenames for local linking,
    // and write each uploaded visual asset as a clean binary file in the root of the ZIP
    let processedHTML = sanitizedHTML;
    let processedContent = htmlContent;

    if (uploadedFiles && uploadedFiles.length > 0) {
      uploadedFiles.forEach((file) => {
        if (file.dataUrl) {
          // Replace exactly matching dataUrl with its file.name for local folder file references
          processedHTML = processedHTML.replaceAll(file.dataUrl, file.name);
          processedContent = processedContent.replaceAll(file.dataUrl, file.name);
          
          // Add binary image file to zip folder natively using JSZip base64 mode
          try {
            if (file.dataUrl.includes(';base64,')) {
              const base64Parts = file.dataUrl.split(';base64,');
              const base64Data = base64Parts[1];
              zip.file(file.name, base64Data, { base64: true });
            }
          } catch (err) {
            console.error(`Error adding custom file '${file.name}' to ZIP:`, err);
          }
        }
      });
    }

    // 4. GENERADORES AUTOMATIZADOS DE PDF POR PUPPETEER LOCAL (Incluidos en el ZIP)
    const scriptPuppeteerText = `const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('========================================================================');
console.log('   GENERADOR DE PDF CORPORATIVO - PROTOCOLO AUTOMÁTICO ACADÉMICO        ');
console.log('========================================================================\\n');

// 1. Instalar puppeteer-core dinámicamente si no está presente (tarda 5 segundos, súper liviano)
try {
  require.resolve('puppeteer-core');
} catch (e) {
  console.log('Se detecta que "puppeteer-core" no está instalado localmente.');
  console.log('Instalando dependencias mínimas de manera automática y silenciosa...');
  try {
    execSync('npm install puppeteer-core', { stdio: 'inherit' });
    console.log('\\n✔ Dependencias de PDF instaladas correctamente.\\n');
  } catch (error) {
    console.error('❌ Error de conexión o de permisos al iniciar "npm install".');
    console.error('Asegúrese de tener Node.js instalado en su sistema y conexión a internet.');
    process.exit(1);
  }
}

const puppeteer = require('puppeteer-core');

// 2. Buscador automatizado inteligente de navegadores instalados (Google Chrome o MS Edge)
function searchBrowserExecutable() {
  const paths = {
    win32: [
      'C:\\\\Program Files\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe',
      'C:\\\\Program Files (x86)\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe',
      path.join(process.env.LOCALAPPDATA || '', 'Google\\\\Chrome\\\\Application\\\\chrome.exe'),
      'C:\\\\Program Files (x86)\\\\Microsoft\\\\Edge\\\\Application\\\\msedge.exe',
      'C:\\\\Program Files\\\\Microsoft\\\\Edge\\\\Application\\\\msedge.exe'
    ],
    darwin: [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
    ],
    linux: [
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser',
      '/usr/bin/chrome',
      '/usr/bin/microsoft-edge'
    ]
  };

  const possiblePaths = paths[process.platform] || [];
  for (const executablePath of possiblePaths) {
    if (executablePath && fs.existsSync(executablePath)) {
      console.log(\`✔ Navegador apto y compatible localizado en: \${executablePath}\`);
      return executablePath;
    }
  }
  return null;
}

(async () => {
  const chromePath = searchBrowserExecutable();
  if (!chromePath) {
    console.error('❌ ERROR: No se encontró Google Chrome ni Microsoft Edge en sus ubicaciones de sistema estándar.');
    console.error('Por favor, instale Google Chrome para permitir la conversión del documento.');
    return;
  }

  console.log('Iniciando entorno sandbox de Puppeteer...');
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    
    // Obtenemos el archivo html del proyecto extraído
    const htmlFile = path.resolve(__dirname, 'documento_formateado_imprimible.html');
    if (!fs.existsSync(htmlFile)) {
      throw new Error(\`No se pudo encontrar el archivo HTML: \${htmlFile}\`);
    }
    
    const fileUrl = 'file:///' + htmlFile.replace(/\\\\/g, '/');
    console.log(\`Abriendo archivo local extraído: \${fileUrl}\`);

    await page.goto(fileUrl, {
      waitUntil: 'networkidle0'
    });

    console.log('Diseñando documento final y compilando a PDF...');

    const pdfPath = path.resolve(__dirname, 'documento_final_perfecto.pdf');
    
    // Convertir el documento a PDF real respetando las dimensiones inyectadas por el CSS
    await page.pdf({
      path: pdfPath,
      printBackground: true,
      width: '${pdfWidthMM}',
      height: '${pdfHeightMM}',
      margin: {
      top: '0',
      right: '0',
      bottom: '0',
      left: '0'
      }
    });

    console.log(\`\\n🎉 ¡PROCESO COMPLETADO! PDF generado perfectamente en la misma carpeta.\`);
    console.log(\`Ruta del archivo: \${pdfPath}\\n\`);
  } catch (error) {
    console.error('\\n❌ El proceso de compilación falló:\\n');
    console.error(error);
  } finally {
    await browser.close();
  }
})();`;

    const scriptBatText = `@echo off
title Generador de PDF Academico
echo ==========================================================
echo    PREPARANDO EL CONVERTIDOR DE PDF PARA SU TRABAJO
echo ==========================================================
echo.

if not exist "generar_pdf.js" (
    echo.
    echo [ERROR] No se encontraron todos los archivos necesarios.
    echo.
    echo Es posible que este programa se este ejecutando directamente
    echo desde un archivo ZIP.
    echo.
    echo Por favor extraiga todo el contenido del ZIP antes de ejecutar.
    echo.
    pause
    exit /b 1
)

node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] No se pudo detectar Node.js en su sistema.
    echo Node.js es requerido para poder automatizar el proceso de Puppeteer localmente.
    echo Por favor, descargue e instale Node.js desde: https://nodejs.org
    echo.
    pause
    exit /b 1
)

echo Detectado Node.js correctamente en su sistema.
echo Ejecutando script de conversion de alta fidelidad...
echo.
node generar_pdf.js
echo.
if exist "documento_final_perfecto.pdf" (
    echo.
    echo Abriendo "documento_final_perfecto.pdf" automaticamente...
    start "" "documento_final_perfecto.pdf"
)
echo.
echo Presione cualquier tecla para cerrar este asistente.
pause`;

    const scriptShText = `#!/bin/bash
echo "=========================================================="
echo "   PREPARANDO EL CONVERTIDOR DE PDF PARA SU TRABAJO"
echo "=========================================================="
echo ""

if ! command -v node &> /dev/null
then
    echo "[ERROR] No se pudo detectar Node.js en su sistema."
    echo "Node.js es requerido para poder automatizar el proceso de Puppeteer localmente."
    echo "Por favor, descargue e instale Node.js desde: https://nodejs.org"
    echo ""
    read -p "Presione [Enter] para salir..."
    exit 1
fi

echo "Detectado Node.js correctamente en su sistema."
echo "Ejecutando script de conversión de alta fidelidad..."
echo ""
node generar_pdf.js
echo ""
if [ -f "documento_final_perfecto.pdf" ]; then
    echo "Abriendo PDF generado de forma automática..."
    open "documento_final_perfecto.pdf" 2>/dev/null || xdg-open "documento_final_perfecto.pdf" 2>/dev/null &
fi
echo ""
read -p "Presione [Enter] para salir..."`;

    zip.file("generar_pdf.js", scriptPuppeteerText);
    zip.file("generar_pdf_windows.bat", scriptBatText);
    if (!isWindows) {
      zip.file("generar_pdf_mac_linux.sh", scriptShText);
    }

    zip.file("documento_formateado_imprimible.html", processedHTML);
    zip.file("contenido_fuente.html", processedContent);
    zip.file("configuracion_metadatos.json", JSON.stringify({ cover, settings, uploadedFiles, htmlBlocks, bibliography }, null, 2));

    // Compile & download
    zip.generateAsync({ type: 'blob' }).then((blob) => {
      const fileUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = fileUrl;
      
      let customName = (exportFileName || '').trim();
      if (!customName) {
        customName = cover.title.slice(0, 30).trim().toLowerCase().replace(/[^a-z0-9]+/g, '_') || 'proyecto_academico';
      }
      
      link.setAttribute('download', `${customName}.zip`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }).catch((err) => {
      console.error('Error compiling ZIP package:', err);
      alert('Error al compilar el archivo ZIP.');
    });
  };

  const insertHTMLSnippetAtFocusedBlock = (type: string) => {
    let snippet = '';
    switch (type) {
      case 'h1':
        snippet = '\n<h1>Título de Sección</h1>\n';
        break;
      case 'h2':
        snippet = '\n<h2>Subtítulo Secundario</h2>\n';
        break;
      case 'p':
        snippet = '\n<p>Escriba aquí el bloque de texto académico formal...</p>\n';
        break;
      case 'list':
        snippet = '\n<ul>\n  <li>Primer elemento de la lista académica</li>\n  <li>Segundo elemento de desarrollo</li>\n</ul>\n';
        break;
      case 'table':
        snippet = `\n<table class="academic-table">
  <thead>
    <tr>
      <th>Componente</th>
      <th>Descripción del Proceso</th>
      <th>Porcentaje</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Investigación Teórica</td>
      <td>Recopilación de normativas y referencias indexadas.</td>
      <td>35%</td>
    </tr>
    <tr>
      <td>Propuesta Tecnológica</td>
      <td>Diseño de un compilador de hojas académicas autogestionadas.</td>
      <td>65%</td>
    </tr>
  </tbody>
</table>\n`;
        break;
      case 'note':
        snippet = `\n<div class="note">
  <strong>NOTA RECOMENDADA:</strong>
  <p>Este informe cuenta con validación técnica del equipo de investigación internacional.</p>
</div>\n`;
        break;
      case 'blockquote':
        snippet = `\n<blockquote>
  "El desarrollo contemporáneo de aplicaciones de auto-paginación demanda balances estrictos entre rendimiento y adaptabilidad visual."
  <cite>— Decanato de la Facultad (2026)</cite>
</blockquote>\n`;
        break;
      case 'math':
        snippet = `\n<div class="math-expr">
  \\[ f(x) = \\sum_{n=0}^{\\infty} \\frac{f^{(n)}(a)}{n!} (x-a)^n \\]
</div>\n`;
        break;
      case 'pagebreak':
        snippet = '\n<div class="page-break"></div>\n';
        break;
      default:
        break;
    }

    if (!snippet) return;

    // Use our state updating callback
    const targetBlockId = lastFocusedBlockId || (htmlBlocks[0] && htmlBlocks[0].id);
    if (!targetBlockId) {
      alert("Por favor haga clic o enfoque algún bloque de código HTML primero.");
      return;
    }

    setHtmlBlocks(prev => prev.map(b => {
      if (b.id !== targetBlockId) return b;
      
      const textarea = document.getElementById(`editor-textarea-${targetBlockId}`) as HTMLTextAreaElement;
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const currentVal = b.code;
        const newVal = currentVal.substring(0, start) + snippet + currentVal.substring(end);
        
        setTimeout(() => {
          textarea.focus();
          textarea.selectionStart = textarea.selectionEnd = start + snippet.length;
        }, 50);
        
        return { ...b, code: newVal };
      } else {
        return { ...b, code: b.code + snippet };
      }
    }));
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 font-sans antialiased text-slate-100 select-none">
      
      {/* 1. Global Top Bar */}
      {!isFullscreen && (
        <div className="h-14 bg-slate-950 border-b border-slate-800 shrink-0 flex items-center justify-between px-4 z-40 select-none print:hidden gap-3">
          {/* Left part: Title & branding & Filename input */}
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[12.5px] font-black tracking-widest text-white leading-none">EDITOR ACADÉMICO</span>
            </div>
            
            {/* Custom File Name Input */}
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded px-2.5 py-1 min-w-[210px] max-w-[260px]">
              <span className="text-[9px] text-[#FF6600] font-bold uppercase tracking-wider shrink-0">Archivo:</span>
              <input
                type="text"
                value={exportFileName}
                onChange={(e) => setExportFileName(e.target.value.replace(/[^a-zA-Z0-9_\-\s]/g, ''))}
                className="bg-transparent text-xs text-slate-100 font-bold focus:outline-none w-full pr-1 shrink"
                placeholder={cover.title ? cover.title.slice(0, 30).trim().toLowerCase().replace(/[^a-z0-9]+/g, '_') : 'proyecto_academico'}
                title="Nombre con el que se generará y exportará el archivo ZIP"
              />
            </div>
          </div>

          {/* Middle part: FORMATOS RÁPIDOS DROPDOWN */}
          <div className="relative">
            <button
              onClick={() => setShowTopBarFormats(!showTopBarFormats)}
              className="px-3.5 py-1.5 bg-[#FF6600]/10 hover:bg-[#FF6600]/25 border border-orange-500/40 hover:border-[#FF6600] rounded text-orange-400 text-[11px] font-extrabold tracking-wider uppercase transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
              title="Inyectar bloques de HTML pre-diseñados en tu editor de código enfocado"
            >
              <span>Formatos Rápidos</span>
              <ChevronDown className={`w-3.5 h-3.5 transform transition-transform duration-150 ${showTopBarFormats ? 'rotate-180' : ''}`} />
            </button>

            {showTopBarFormats && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setShowTopBarFormats(false)} 
                />
                <div className="absolute right-1/2 translate-x-1/2 mt-2 w-64 bg-slate-950 border border-slate-800 rounded-lg shadow-2xl z-50 overflow-hidden divide-y divide-slate-850">
                  {[
                    { label: 'Título H1', description: 'Sección Principal', tag: 'h1' },
                    { label: 'Subtítulo H2', description: 'Sección Secundaria', tag: 'h2' },
                    { label: 'Párrafo', description: 'Bloque Académico', tag: 'p' },
                    { label: 'Lista', description: 'Lista de Viñetas', tag: 'list' },
                    { label: 'Cita en Bloque', description: 'Cita Académica Profesional', tag: 'blockquote' },
                    { label: 'Fórmula Matemática', description: 'Fórmula MathJax auto-renderizada', tag: 'math' },
                    { label: 'Salto de Página', description: 'Forzar Nueva Página en Impresión', tag: 'pagebreak' },
                  ].map((fmt, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        insertHTMLSnippetAtFocusedBlock(fmt.tag);
                        setShowTopBarFormats(false);
                      }}
                      className="w-full text-left px-3.5 py-2.5 hover:bg-[#004080]/20 transition-colors flex flex-col gap-0.5 group cursor-pointer"
                    >
                      <span className="text-[11.5px] font-bold text-slate-200 group-hover:text-orange-400">{fmt.label}</span>
                      <span className="text-[9.5px] text-slate-500 group-hover:text-slate-400">{fmt.description}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Right part: Settings Drawers Trigger, ZIP import/export and resets */}
          <div className="flex items-center gap-1.5 shrink-0">
            
            {/* Drawers toggler controls */}
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-md p-0.5 shrink-0">
              <button
                onClick={() => setActiveDrawerType(null)}
                className={`px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  activeDrawerType === null
                    ? 'bg-[#004080] text-white border border-[#FF6600]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Volver a los Editores de Contenido HTML"
              >
                <Code className="w-3.5 h-3.5" />
                <span>Editores</span>
              </button>
              <button
                onClick={() => {
                  if (activeDrawerType === 'cover') {
                    setActiveDrawerType(null);
                  } else {
                    setActiveDrawerType('cover');
                  }
                }}
                className={`px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  activeDrawerType === 'cover'
                    ? 'bg-[#004080] text-white border border-[#FF6600]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Configurar Portada"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Portada (Cover)</span>
              </button>
              <button
                onClick={() => {
                  if (activeDrawerType === 'settings') {
                    setActiveDrawerType(null);
                  } else {
                    setActiveDrawerType('settings');
                  }
                }}
                className={`px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  activeDrawerType === 'settings'
                    ? 'bg-[#004080] text-white border border-[#FF6600]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Personalizar Estilo de Hojas"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Estilos</span>
              </button>
              <button
                onClick={() => {
                  if (activeDrawerType === 'uploads') {
                    setActiveDrawerType(null);
                  } else {
                    setActiveDrawerType('uploads');
                  }
                }}
                className={`px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  activeDrawerType === 'uploads'
                    ? 'bg-[#004080] text-white border border-[#FF6600]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Ver Banco de Imágenes y Recursos"
              >
                <Image className="w-3.5 h-3.5" />
                <span>Archivos</span>
              </button>
              <button
                onClick={() => {
                  if (activeDrawerType === 'bibliography') {
                    setActiveDrawerType(null);
                  } else {
                    setActiveDrawerType('bibliography');
                  }
                }}
                className={`px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  activeDrawerType === 'bibliography'
                    ? 'bg-[#004080] text-white border border-[#FF6600]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Gestionar Referencias Bibliográficas BibTeX (.bib)"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Bibliografía</span>
              </button>
            </div>



            {/* Reset All */}
            <button
              onClick={handleResetAllToZero}
              className="p-1.5 text-slate-400 hover:text-red-500 rounded bg-transparent hover:bg-slate-900 transition-all cursor-pointer border border-transparent hover:border-red-500/20"
              title="Reiniciar y borrar todos los cambios para volver al formato UNEMI oficial"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 2. Main Workspace Row (contains Left Sidebar and Right Preview Panel) */}
      <div className="flex-1 flex overflow-hidden w-full relative">
        {/* Dynamic Sized Container Wrap */}
        {!isFullscreen && (
          <>
            <div 
              style={{ width: `${sidebarWidth}px` }} 
              className="shrink-0 flex flex-col h-full print:hidden select-none border-r border-slate-800 bg-slate-900"
            >
              {activeDrawerType === null ? (
                <SidebarEditor
                  htmlBlocks={htmlBlocks}
                  setHtmlBlocks={setHtmlBlocks}
                  lastFocusedBlockId={lastFocusedBlockId}
                  setLastFocusedBlockId={setLastFocusedBlockId}
                  onRefreshFile={() => fetchContentFile(false)}
                  isSyncing={isSyncing}
                  pageCount={pageCount}
                  isLocallyEdited={isLocallyEdited}
                  onResetToOriginal={handleResetToOriginal}
                  syncStatusMsg={syncStatusMsg}
                />
              ) : activeDrawerType === 'bibliography' ? (
                <BibliographyDrawer
                  bibtex={bibtex}
                  setBibtex={setBibtex}
                  onClose={() => setActiveDrawerType(null)}
                  showBibliography={!!settings.showBibliography}
                  onToggleShowBibliography={(show) => setSettings(prev => ({ ...prev, showBibliography: show }))}
                  bibliographyTitle={settings.bibliographyTitle || 'Referencias Bibliográficas'}
                  onChangeBibliographyTitle={(title) => setSettings(prev => ({ ...prev, bibliographyTitle: title }))}
                  onInsertHTML={handleInsertHTML}
                />
              ) : (
                <ConfigDrawer
                  isOpen={activeDrawerType !== null}
                  activeType={activeDrawerType}
                  onClose={() => setActiveDrawerType(null)}
                  cover={cover}
                  setCover={setCover}
                  settings={settings}
                  setSettings={setSettings}
                  uploadedFiles={uploadedFiles}
                  setUploadedFiles={setUploadedFiles}
                  onInsertHTML={handleInsertHTML}
                  isEmbedded={true}
                />
              )}
            </div>

            {/* Resize handle divider bar */}
            <div
              onMouseDown={startResizing}
              className="w-[5px] hover:w-[8px] bg-slate-800 hover:bg-orange-500 cursor-col-resize h-full transition-all duration-150 select-none print:hidden z-20 shrink-0 flex items-center justify-center relative group"
              title="Arrastra para ajustar el ancho de la barra editora"
            >
              <div className="w-[1.5px] h-10 bg-slate-600 group-hover:bg-white rounded transition-colors" />
            </div>
          </>
        )}

        {/* RIGHT COLUMN: Real page preview layout Stage */}
        <div className="flex-1 h-full flex flex-col relative overflow-hidden min-w-0">
          {isResizing && (
            <div className="absolute inset-0 z-50 bg-transparent cursor-col-resize pointer-events-auto" />
          )}
          <DocumentPreview
            cover={cover}
            settings={settings}
            htmlContent={htmlContent}
            setPageCount={setPageCount}
            onExportZIP={handleExportZIP}
            isFullscreen={isFullscreen}
            setIsFullscreen={setIsFullscreen}
            uploadedFiles={uploadedFiles}
            htmlBlocks={htmlBlocks}
            bibliography={bibliography}
          />
        </div>
      </div>
    </div>
  );
}

