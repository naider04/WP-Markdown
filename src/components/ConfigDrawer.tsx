/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { markdownParser } from '../utils/markdownParser';
import { CoverConfig, PageSettings, UploadedFile, HTMLBlock } from '../types';
import { formatFontSize } from '../utils/fontUtils';
import {
  FileText,
  FileCode,
  Layout,
  Printer,
  Plus,
  Sliders,
  User,
  Calendar,
  MapPin,
  Table,
  Quote,
  AlertCircle,
  HelpCircle,
  CheckCircle,
  Eye,
  EyeOff,
  Upload,
  Layers,
  Image,
  Trash2,
  Copy,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  List,
  X,
  Maximize2,
  Minimize2,
  Settings,
  Edit2,
  Check,
  Sparkles,
  RefreshCw
} from 'lucide-react';

interface ConfigDrawerProps {
  isOpen: boolean;
  activeType: 'cover' | 'settings' | 'uploads' | 'toc' | null;
  onClose: () => void;
  cover: CoverConfig;
  setCover: React.Dispatch<React.SetStateAction<CoverConfig>>;
  settings: PageSettings;
  setSettings: React.Dispatch<React.SetStateAction<PageSettings>>;
  uploadedFiles: UploadedFile[];
  setUploadedFiles: React.Dispatch<React.SetStateAction<UploadedFile[]>>;
  onInsertHTML: (snippet: string) => void;
  isEmbedded?: boolean;
  htmlBlocks?: HTMLBlock[];
  setHtmlBlocks?: React.Dispatch<React.SetStateAction<HTMLBlock[]>>;
  userApiKey?: string;
}

const DEFAULT_TABLE_CSS = `/* Academic Table Style */
table {
  width: 100%;
}
th {
  background-color: #004080;
  color: #ffffff;
}`;

const DEFAULT_BLOCK_TOC = `.toc-header {
  font-family: "Times New Roman", Times, serif;
  font-size: 16px;
  font-weight: bold;
  text-align: center;
  margin-bottom: 24px;
}
.toc-item {
  font-family: "Times New Roman", Times, serif;
  font-size: 16px;
  line-height: 2;
  margin-bottom: 12px;
}
.toc-level-1 {
  padding-left: 0px;
  font-weight: bold;
}
.toc-level-2 {
  padding-left: 24px;
}
.toc-level-3 {
  padding-left: 48px;
  font-style: italic;
}
.toc-dots {
  border-bottom: 1px dotted black;
  margin: 0 8px;
}
.toc-page {
  font-weight: bold;
  font-size: 16px;
}`;

function AutoGrowingTextArea({
  value,
  onChange,
  placeholder,
  className = 'text-slate-200',
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.max(150, textarea.scrollHeight)}px`;
    }
  };

  useEffect(() => {
    adjustHeight();
  }, [value]);

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
        adjustHeight();
      }}
      style={{ resize: 'none' }}
      className={`w-full p-2.5 bg-slate-950 border border-slate-800 rounded font-mono text-xs focus:ring-1 focus:ring-orange-500 focus:outline-none overflow-y-hidden ${className}`}
      placeholder={placeholder}
    />
  );
}

function readDescriptionFromPng(uint8: Uint8Array): string | null {
  try {
    const view = new DataView(uint8.buffer, uint8.byteOffset, uint8.byteLength);
    let pos = 8; // skip PNG signature
    while (pos + 8 <= uint8.length) {
      const len = view.getUint32(pos, false); // big-endian
      // chunk type at pos + 4
      const type = String.fromCharCode(
        uint8[pos + 4],
        uint8[pos + 5],
        uint8[pos + 6],
        uint8[pos + 7]
      );
      if (type === 'IEND') break;
      if (type === 'tEXt') {
        const dataStart = pos + 8;
        const dataEnd = dataStart + len;
        // find null byte
        let nullIdx = -1;
        for (let i = dataStart; i < dataEnd; i++) {
          if (uint8[i] === 0) {
            nullIdx = i;
            break;
          }
        }
        if (nullIdx !== -1) {
          // Keyword
          let keyword = '';
          for (let i = dataStart; i < nullIdx; i++) {
            keyword += String.fromCharCode(uint8[i]);
          }
          if (keyword === 'Description') {
            // Text is UTF-8 decoded
            const textBytes = uint8.subarray(nullIdx + 1, dataEnd);
            return new TextDecoder('utf-8').decode(textBytes);
          }
        }
      }
      pos += 12 + len;
    }
  } catch (err) {
    console.error('Error reading description from PNG:', err);
  }
  return null;
}

function readDescriptionFromJpeg(uint8: Uint8Array): string | null {
  try {
    let pos = 2; // skip SOI marker (FF D8)
    const view = new DataView(uint8.buffer, uint8.byteOffset, uint8.byteLength);
    while (pos + 4 <= uint8.length) {
      if (uint8[pos] !== 0xFF) break;
      const marker = uint8[pos + 1];
      if (marker === 0xD8 || marker === 0xD9) break; // SOI / EOI
      if (marker === 0xFE) { // COM marker (Comment)
        const len = view.getUint16(pos + 2, false); // big-endian, includes length field itself (2 bytes)
        const start = pos + 4;
        const end = pos + 2 + len;
        if (end <= uint8.length) {
          const textBytes = uint8.subarray(start, end);
          const comment = new TextDecoder('utf-8').decode(textBytes);
          if (comment.trim()) return comment.trim();
        }
        break;
      }
      if (marker === 0x00 || marker === 0xFF) {
        pos++;
        continue;
      }
      const segLen = view.getUint16(pos + 2, false);
      pos += 2 + segLen;
    }
  } catch (err) {
    console.error('Error reading description from JPEG:', err);
  }
  return null;
}

function readDescription(uint8: Uint8Array): string | null {
  if (uint8[0] === 0xFF && uint8[1] === 0xD8) {
    return readDescriptionFromJpeg(uint8);
  }
  if (uint8[0] === 0x89 && uint8[1] === 0x50 && uint8[2] === 0x4E && uint8[3] === 0x47) {
    return readDescriptionFromPng(uint8);
  }
  return null;
}

interface HeadingItem {
  blockId: string;
  blockName: string;
  lineIndex: number;
  type: 'markdown' | 'html';
  level: number;
  cleanText: string;
  originalLine: string;
}

export function ConfigDrawer({
  isOpen,
  activeType,
  onClose,
  cover,
  setCover,
  settings,
  setSettings,
  uploadedFiles,
  setUploadedFiles,
  onInsertHTML,
  isEmbedded = false,
  htmlBlocks = [],
  setHtmlBlocks,
  userApiKey,
}: ConfigDrawerProps) {
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [showFormats, setShowFormats] = useState<boolean>(false);
  const [isInsertingAI, setIsInsertingAI] = useState<string | null>(null);
  const [aiExplanations, setAiExplanations] = useState<Array<{ imageName: string; text: string }> | null>(null);
  const [selectedImagesForAI, setSelectedImagesForAI] = useState<UploadedFile[]>([]);

  const handleToggleAISingleSelection = (item: UploadedFile) => {
    if (!item.description || item.description.trim() === '') {
      alert("Por favor, ingresa una descripción para la imagen antes de intentar seleccionarla para insertar con IA. Esto le permite al modelo saber qué ilustra la figura y determinar su posición correcta en el documento.");
      setIsEditingDescId(item.id);
      setEditingDescText('');
      return;
    }

    setSelectedImagesForAI(prev => {
      const exists = prev.some(img => img.id === item.id);
      if (exists) {
        return prev.filter(img => img.id !== item.id);
      } else {
        return [...prev, item];
      }
    });
  };

  const handleInsertAllSelectedWithAI = async () => {
    if (!htmlBlocks || htmlBlocks.length === 0) {
      alert("No hay bloques de texto (Markdown) disponibles para insertar estas imágenes.");
      return;
    }

    if (selectedImagesForAI.length === 0) {
      alert("Por favor, selecciona al menos una imagen para insertar.");
      return;
    }

    // Verify all selected images have descriptions
    const missingDesc = selectedImagesForAI.find(item => !item.description || item.description.trim() === '');
    if (missingDesc) {
      alert(`La imagen "${missingDesc.name}" no tiene descripción. Por favor ingresa una descripción para todas las imágenes seleccionadas antes de insertar.`);
      setIsEditingDescId(missingDesc.id);
      setEditingDescText('');
      return;
    }

    setIsInsertingAI("all_selected");
    try {
      const response = await fetch("/api/gemini/insert-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-api-key": userApiKey || "",
        },
        body: JSON.stringify({
          htmlBlocks: htmlBlocks.map(b => ({ id: b.id, name: b.name, code: b.code })),
          images: selectedImagesForAI.map(img => ({
            name: img.name,
            description: img.description || ""
          }))
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Error al procesar con IA");
      }

      const result = await response.json();
      const { modifiedBlocks, explanations } = result;

      // Update the whole list of blocks in App state
      if (setHtmlBlocks && modifiedBlocks) {
        setHtmlBlocks(modifiedBlocks);
      }

      // Show explanation modal with all justifications (only if we have any, but we disabled it now)
      if (explanations && explanations.length > 0) {
        setAiExplanations(explanations);
      }
      
      // Clear the selection list
      setSelectedImagesForAI([]);
      triggerSuccessMsg("¡Imágenes insertadas con IA!");
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Ocurrió un error al procesar la inserción de las imágenes con IA.");
    } finally {
      setIsInsertingAI(null);
    }
  };

  const [localMarginTop, setLocalMarginTop] = useState<string>('');
  const [localMarginBottom, setLocalMarginBottom] = useState<string>('');
  const [localMarginLeft, setLocalMarginLeft] = useState<string>('');
  const [localMarginRight, setLocalMarginRight] = useState<string>('');

  useEffect(() => {
    if (settings.marginTop !== undefined) setLocalMarginTop(String(settings.marginTop));
    if (settings.marginBottom !== undefined) setLocalMarginBottom(String(settings.marginBottom));
    if (settings.marginLeft !== undefined) setLocalMarginLeft(String(settings.marginLeft));
    if (settings.marginRight !== undefined) setLocalMarginRight(String(settings.marginRight));
  }, [settings.marginTop, settings.marginBottom, settings.marginLeft, settings.marginRight]);

  const handleCommitMargin = (field: 'marginTop' | 'marginBottom' | 'marginLeft' | 'marginRight', valueStr: string) => {
    const val = parseInt(valueStr, 10);
    const finalVal = isNaN(val) ? 0 : val;
    handleSettingsChange(field, finalVal);
  };

  const handleMarginKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, field: 'marginTop' | 'marginBottom' | 'marginLeft' | 'marginRight', valueStr: string) => {
    if (e.key === 'Enter') {
      handleCommitMargin(field, valueStr);
      e.currentTarget.blur();
    }
  };

  const formats = [
    { label: 'Título H1', description: 'Sección Principal', snippet: '\n<h1>Título de Sección</h1>\n' },
    { label: 'Subtítulo H2', description: 'Sección Secundaria', snippet: '\n<h2>Subtítulo Secundario</h2>\n' },
    { label: 'Párrafo', description: 'Bloque Académico', snippet: '\n<p>Escriba aquí el bloque de texto académico formal...</p>\n' },
    { label: 'Lista', description: 'Lista de Viñetas', snippet: '\n<ul>\n  <li>Primer elemento de la lista académica</li>\n  <li>Segundo elemento de desarrollo</li>\n</ul>\n' },
    { label: 'Cita en Bloque', description: 'Cita Académica Profesional', snippet: `\n<blockquote>\n  "El desarrollo contemporáneo de aplicaciones de auto-paginación demanda balances estrictos entre rendimiento y adaptabilidad visual."\n  <cite>— Decanato de la Facultad (2026)</cite>\n</blockquote>\n` },
    { label: 'Fórmula Matemática', description: 'Fórmula MathJax auto-renderizada', snippet: `\n<div class="math-expr">\n  \\[ f(x) = \\sum_{n=0}^{\\infty} \\frac{f^{(n)}(a)}{n!} (x-a)^n \\]\n</div>\n` },
    { label: 'Salto de Página', description: 'Forzar Nueva Página en Impresión', snippet: '\n<div class="page-break"></div>\n' },
  ];
  
  // Accordion open/collapse states
  const [isMarginsOpen, setIsMarginsOpen] = useState<boolean>(false);
  const [isTextEditorOpen, setIsTextEditorOpen] = useState<boolean>(false);
  const [isTableStyleOpen, setIsTableStyleOpen] = useState<boolean>(false);
  const [isCustomCssStyleOpen, setIsCustomCssStyleOpen] = useState<boolean>(false);
  const [isTOCStyleOpen, setIsTOCStyleOpen] = useState<boolean>(false);
  const [isListsStyleOpen, setIsListsStyleOpen] = useState<boolean>(false);
  const [isCodeStyleOpen, setIsCodeStyleOpen] = useState<boolean>(false);

  // File renaming states
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [editingFileName, setEditingFileName] = useState<string>('');

  // Description editing states
  const [isEditingDescId, setIsEditingDescId] = useState<string | null>(null);
  const [editingDescText, setEditingDescText] = useState<string>('');

  const triggerSuccessMsg = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 2500);
  };

  const getHeadings = (): HeadingItem[] => {
    const list: HeadingItem[] = [];
    if (!htmlBlocks) return list;
    htmlBlocks.forEach((block) => {
      const lines = block.code.split('\n');
      lines.forEach((line, lineIndex) => {
        // 1. Check Markdown
        if (block.isMarkdown) {
          const mdMatch = line.match(/^\s*(#{1,6})\s+(.+)$/);
          if (mdMatch) {
            list.push({
              blockId: block.id,
              blockName: block.name,
              lineIndex,
              type: 'markdown',
              level: mdMatch[1].length,
              cleanText: mdMatch[2].replace(/<\/?[^>]+(>|$)/g, "").trim(),
              originalLine: line,
            });
            return;
          }
        }
        // 2. Check HTML
        const htmlMatch = line.match(/<h([1-6])(\s[^>]*)?>([\s\S]*?)<\/h\1>/i);
        if (htmlMatch) {
          list.push({
            blockId: block.id,
            blockName: block.name,
            lineIndex,
            type: 'html',
            level: parseInt(htmlMatch[1], 10),
            cleanText: htmlMatch[3].replace(/<\/?[^>]+(>|$)/g, "").trim(),
            originalLine: line,
          });
        }
      });
    });
    return list;
  };

  const handleUpdateHeadingLevel = (heading: HeadingItem, direction: 'left' | 'right') => {
    if (!setHtmlBlocks || !htmlBlocks) return;
    const newLevel = direction === 'left' ? heading.level - 1 : heading.level + 1;
    if (newLevel < 1 || newLevel > 6) return;

    const updatedBlocks = htmlBlocks.map((block) => {
      if (block.id !== heading.blockId) return block;

      const lines = block.code.split('\n');
      const targetLine = lines[heading.lineIndex];

      let newLine = targetLine;
      if (heading.type === 'markdown') {
        newLine = targetLine.replace(/^(\s*)(#{1,6})\s+(.+)$/, (m, leadingSpaces, hashes, inner) => {
          return `${leadingSpaces}${'#'.repeat(newLevel)} ${inner}`;
        });
      } else {
        newLine = targetLine.replace(/<h([1-6])(\s[^>]*)?>([\s\S]*?)<\/h\1>/i, (m, currentLvl, attrs, inner) => {
          const finalAttrs = attrs || '';
          return `<h${newLevel}${finalAttrs}>${inner}</h${newLevel}>`;
        });
      }

      lines[heading.lineIndex] = newLine;
      return {
        ...block,
        code: lines.join('\n'),
      };
    });

    setHtmlBlocks(updatedBlocks);
    triggerSuccessMsg(`Nivel de título actualizado a H${newLevel}`);
  };

  const handleCopyAllCSS = () => {
    const blockStyleTitles = settings.blockStyleTitles || '';
    const blockStyleHeader = settings.blockStyleHeader || '';
    const blockStyleFooter = settings.blockStyleFooter || '';
    const blockStylePageNum = settings.blockStylePageNum || '';
    const blockStyleTOC = settings.blockStyleTOC || '';
    const blockStyleLists = settings.blockStyleLists || '';
    const tableCustomCss = settings.tableCustomCss || '';
    const customAddedCss = settings.customAddedCss || '';

    const combinedCss = [
      '/* === ESTILOS CSS COMPLETOS PARA EL DOCUMENTO === */',
      blockStyleTitles && `/* --- TIPOGRAFÍA Y ESTILOS DE TEXTO --- */\n${blockStyleTitles}`,
      blockStyleHeader && `/* --- ENCABEZADO (HEADER) --- */\n${blockStyleHeader}`,
      blockStyleFooter && `/* --- PIE DE PÁGINA (FOOTER) --- */\n${blockStyleFooter}`,
      blockStylePageNum && `/* --- NUMERACIÓN DE PÁGINAS --- */\n${blockStylePageNum}`,
      blockStyleTOC && `/* --- TABLA DE CONTENIDOS (TOC) --- */\n${blockStyleTOC}`,
      blockStyleLists && `/* --- ESTILO DE LISTAS --- */\n${blockStyleLists}`,
      tableCustomCss && `/* --- FORMATO DE TABLAS --- */\n${tableCustomCss}`,
      customAddedCss && `/* --- OTROS ESTILOS PERSONALIZADOS --- */\n${customAddedCss}`,
    ].filter(Boolean).join('\n\n');

    navigator.clipboard.writeText(combinedCss).then(() => {
      triggerSuccessMsg('¡Estilos CSS copiados al portapapeles!');
    }).catch(() => {
      alert('Error al copiar al portapapeles.');
    });
  };

  const handleCopyDimensions = () => {
    const isLetter = settings.pageSize === 'letter';
    const isA4 = settings.pageSize === 'a4';
    const isPortrait = (settings.orientation || 'portrait') === 'portrait';

    const width = isPortrait
      ? (isLetter ? 816 : isA4 ? 794 : 630)
      : (isLetter ? 1056 : isA4 ? 1123 : 1120);

    const height = isPortrait
      ? (isLetter ? 1056 : isA4 ? 1123 : 1120)
      : (isLetter ? 816 : isA4 ? 794 : 630);

    const topMarg = settings.marginTop !== undefined ? settings.marginTop : 96;
    const bottomMarg = settings.marginBottom !== undefined ? settings.marginBottom : 96;
    const leftMarg = settings.marginLeft !== undefined ? settings.marginLeft : 96;
    const rightMarg = settings.marginRight !== undefined ? settings.marginRight : 96;

    const usableWidth = width - leftMarg - rightMarg;
    const usableHeight = height - topMarg - bottomMarg;

    const sizeName = isLetter ? 'Carta (Letter)' : isA4 ? 'A4' : 'Personalizado (16:9)';
    const orientName = isPortrait ? 'Vertical (Portrait)' : 'Horizontal (Landscape)';

    const textToCopy = `=== AJUSTES FÍSICOS Y DIMENSIONES DE PÁGINA ===
Tamaño de Papel: ${sizeName}
Orientación: ${orientName}
DPI de Renderizado: 96 DPI

Dimensiones Totales de Hoja:
- Píxeles: ${width}px × ${height}px
- Pulgadas: ${(width / 96).toFixed(2)}" × ${(height / 96).toFixed(2)}"
- Centímetros: ${((width / 96) * 2.54).toFixed(2)} cm × ${((height / 96) * 2.54).toFixed(2)} cm

Márgenes de Página (Bordes):
- Superior (Top): ${topMarg}px (${(topMarg / 96).toFixed(2)}" / ${((topMarg / 96) * 2.54).toFixed(2)} cm)
- Inferior (Bottom): ${bottomMarg}px (${(bottomMarg / 96).toFixed(2)}" / ${((bottomMarg / 96) * 2.54).toFixed(2)} cm)
- Izquierdo (Left): ${leftMarg}px (${(leftMarg / 96).toFixed(2)}" / ${((leftMarg / 96) * 2.54).toFixed(2)} cm)
- Derecho (Right): ${rightMarg}px (${(rightMarg / 96).toFixed(2)}" / ${((rightMarg / 96) * 2.54).toFixed(2)} cm)

Área Útil de Contenido (Restando los bordes):
- Píxeles: ${usableWidth}px × ${usableHeight}px
- Pulgadas: ${(usableWidth / 96).toFixed(2)}" × ${(usableHeight / 96).toFixed(2)}"
- Centímetros: ${((usableWidth / 96) * 2.54).toFixed(2)} cm × ${((usableHeight / 96) * 2.54).toFixed(2)} cm`;

    navigator.clipboard.writeText(textToCopy)
      .then(() => {
        triggerSuccessMsg('¡Ajustes y dimensiones copiados!');
      })
      .catch((err) => {
        console.error('Error al copiar las dimensiones:', err);
        alert('Error al copiar al portapapeles.');
      });
  };

  if (!isOpen || !activeType) return null;

  const handleCoverChange = (field: keyof CoverConfig, value: any) => {
    setCover((prev) => {
      const updated = { ...prev, [field]: value };
      if (field === 'overlayTemplate' || field === 'overlayMarkdown') {
        try {
          const md = updated.overlayMarkdown || '';
          const tmpl = updated.overlayTemplate || '';
          const compiledMarkdown = markdownParser.parse(md) as string;
          updated.overlayHtml = tmpl.replace('{{content}}', compiledMarkdown);
        } catch (e) {
          console.error('Error compiling markdown on cover change:', e);
        }
      }
      return updated;
    });
  };

  const handleSettingsChange = (field: keyof PageSettings, value: any) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  const handleMultipleFilesUpload = (files: FileList | File[] | null) => {
    if (!files || files.length === 0) return;
    let successCount = 0;
    Array.from(files).forEach((file, index) => {
      if (file.size > 5 * 1024 * 1024) {
        alert(`El archivo "${file.name}" supera el límite de 5MB.`);
        return;
      }

      // Read ArrayBuffer to extract PNG/JPEG metadata description
      const bufferReader = new FileReader();
      bufferReader.onload = (be) => {
        const arrayBuffer = be.target?.result as ArrayBuffer;
        let extractedDesc = '';
        if (arrayBuffer) {
          const uint8 = new Uint8Array(arrayBuffer);
          const metaDesc = readDescription(uint8);
          if (metaDesc) {
            extractedDesc = metaDesc;
          }
        }

        // Read DataURL for previews and document compilation
        const dataUrlReader = new FileReader();
        dataUrlReader.onload = (de) => {
          const dataUrl = de.target?.result as string;
          if (!dataUrl) return;

          const newFile: UploadedFile = {
            id: 'file_' + Date.now() + '_' + index + '_' + Math.random().toString(36).substring(2, 6),
            name: file.name,
            type: file.type,
            size: file.size,
            dataUrl: dataUrl,
            uploadedAt: new Date().toISOString(),
            description: extractedDesc || '',
          };
          setUploadedFiles((prev) => [...prev, newFile]);
          successCount++;
          if (successCount === files.length) {
            triggerSuccessMsg(`${files.length} imagen(es) cargada(s) con éxito`);
          }
        };
        dataUrlReader.readAsDataURL(file);
      };
      bufferReader.readAsArrayBuffer(file);
    });
  };

  const handleSaveDesc = (id: string) => {
    setUploadedFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, description: editingDescText } : f))
    );
    setIsEditingDescId(null);
    triggerSuccessMsg('¡Descripción guardada!');
  };

  const handleAddFileByUrl = (url: string, name: string) => {
    if (!url.trim()) return;
    const sanitizedUrl = url.trim();
    let sanitizedName = name.trim();
    if (!sanitizedName) {
      try {
        const parts = sanitizedUrl.split('/');
        const lastPart = parts[parts.length - 1];
        sanitizedName = lastPart.split('?')[0] || 'imagen_url.png';
      } catch {
        sanitizedName = 'imagen_url.png';
      }
    }
    if (!sanitizedName.includes('.')) {
      sanitizedName += '.png';
    }

    const newFile: UploadedFile = {
      id: 'file_url_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      name: sanitizedName,
      type: 'image/url',
      size: 0,
      dataUrl: sanitizedUrl,
      uploadedAt: new Date().toISOString(),
    };
    setUploadedFiles((prev) => [...prev, newFile]);
    triggerSuccessMsg('Imagen por URL agregada!');
  };

  const handleCopySnippet = (filename: string) => {
    const figureSnippet = `![Descripción de la figura](${filename}){width=60%}`;
    
    navigator.clipboard.writeText(figureSnippet).then(() => {
      triggerSuccessMsg('¡Formato de Figura copiado!');
    }).catch(() => {
      alert('Error de portapapeles.');
    });
  };

  const handleInsertImgTag = (filename: string) => {
    const figureSnippet = `\n![Descripción de la figura](${filename}){width=60%}\n`;
    
    onInsertHTML(figureSnippet);
    triggerSuccessMsg('¡Figura insertada en el editor!');
  };

  const handleDeleteFile = (id: string) => {
    setUploadedFiles((prev) => prev.filter((item) => item.id !== id));
    triggerSuccessMsg('Archivo eliminado');
  };

  const handleSaveRename = (id: string) => {
    const trimmed = editingFileName.trim();
    if (!trimmed) {
      alert("El nombre de archivo no puede estar vacío");
      return;
    }
    // Check for duplicate names (case insensitive) among other files
    const duplicate = uploadedFiles.some(f => f.id !== id && f.name.toLowerCase() === trimmed.toLowerCase());
    if (duplicate) {
      alert("Ya existe un archivo con este nombre");
      return;
    }
    setUploadedFiles(prev => prev.map(f => f.id === id ? { ...f, name: trimmed } : f));
    setEditingFileId(null);
    triggerSuccessMsg('Archivo renombrado con éxito');
  };

  return (
    <div className={isEmbedded 
      ? "w-full h-full bg-slate-900 flex flex-col font-sans select-none print:hidden relative"
      : "absolute top-14 right-0 bottom-0 w-[420px] bg-slate-900 border-l border-slate-800 shadow-2xl z-40 flex flex-col font-sans select-none print:hidden"}>
      
      {/* Header bar */}
      <div className="p-3.5 bg-slate-950 border-b border-slate-850 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {activeType === 'cover' && (
            <>
              <Layers className="w-4 h-4 text-orange-500 shrink-0" />
              <span className="text-[11px] font-extrabold text-slate-100 uppercase tracking-wider truncate">Configuración de Portada</span>
            </>
          )}
          {activeType === 'settings' && (
            <>
              <Sliders className="w-4 h-4 text-orange-500 shrink-0" />
              <span className="text-[11px] font-extrabold text-slate-100 uppercase tracking-wider truncate">Estilos de Hoja</span>
            </>
          )}
          {activeType === 'uploads' && (
            <>
              <Image className="w-4 h-4 text-orange-500 shrink-0" />
              <span className="text-[11px] font-extrabold text-slate-100 uppercase tracking-wider truncate">Archivos / Uploads</span>
            </>
          )}
          {activeType === 'toc' && (
            <>
              <List className="w-4 h-4 text-orange-500 shrink-0" />
              <span className="text-[11px] font-extrabold text-slate-100 uppercase tracking-wider truncate">Tabla de Contenidos</span>
            </>
          )}
        </div>
        <button 
          onClick={onClose}
          className="p-1.5 hover:bg-slate-850 rounded transition-all text-slate-400 hover:text-slate-200 cursor-pointer"
          title="Cerrar panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body content scroll section */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar flex flex-col gap-5 text-slate-200">
        
        {/* TAB 1: COVERPORTADA CONTROLS */}
        {activeType === 'cover' && (
          <div className="flex flex-col gap-4 text-xs">
            {/* Markdown content of cover */}
            <div className="flex flex-col gap-2 mt-2">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-orange-500" />
                Contenido Markdown de Portada
              </span>
              <p className="text-[9px] text-slate-400 leading-normal mb-0.5">
                Escribe o pega el contenido textual de tu portada utilizando formato Markdown. Este se inyectará automáticamente en la plantilla definida abajo.
              </p>
              <AutoGrowingTextArea
                value={cover.overlayMarkdown || ''}
                onChange={(val) => handleCoverChange('overlayMarkdown', val)}
                className="text-white"
                placeholder="Escribe el contenido en Markdown de la carátula..."
              />
            </div>

            {/* Custom html overlay (Template Styles/HTML) */}
            <div className="flex flex-col gap-2 mt-2">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <FileCode className="w-3.5 h-3.5 text-orange-500" />
                Estilos CSS y Estructura HTML de Portada
              </span>
              <p className="text-[9px] text-slate-400 leading-normal mb-0.5">
                Define las reglas CSS y la estructura HTML de la carátula. Usa el marcador de posición <code className="font-mono bg-slate-950 px-1 py-0.5 rounded text-orange-400 font-bold">{"{{content}}"}</code> donde desees que se renderice el contenido en Markdown.
              </p>
              <AutoGrowingTextArea
                value={cover.overlayTemplate || ''}
                onChange={(val) => handleCoverChange('overlayTemplate', val)}
                className="text-green-400"
                placeholder="Escribe la estructura HTML y estilos CSS con {{content}}..."
              />
            </div>

            {/* Plantilla academic banner code block mockup */}
            <div className="p-3 bg-slate-950/80 border border-slate-850 rounded flex flex-col gap-2">
              <div className="flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-orange-400 shrink-0" />
                <span className="text-[10px] font-bold text-slate-200 uppercase tracking-wider">🎓 Plantillas Académicas para Portada</span>
              </div>
              <p className="text-[9px] text-slate-400 leading-normal">
                Usa estas plantillas modulares para configurar tu portada académica en segundos. Copia el diseño contenedor (Estilos/HTML) y el contenido textual (Markdown).
              </p>
              
              <div className="flex flex-col gap-1.5 mt-1">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(`<style>
body{
    margin:0;
    background:transparent;
    font-family: Arial, sans-serif;
    color:#002E45;
}

/* hoja */
.cv-page{
    height:100%;
    display:flex;
    justify-content:center;
    align-items:center;
    padding-left:96px;
    padding-right:96px;
}

/* bloque real centrado */
.cv-content{
    display:flex;
    flex-direction:column;
    align-items:center;
    text-align:center;
    width: 100%;
}

/* Estilos de compatibilidad para Markdown compilado */
.cv-content h1 {
    font-size:24px;
    font-weight:bold;
    line-height:1.4;
    text-transform:uppercase;
    margin-top:0;
    margin-bottom:18px;
    color:#002E45;
}

.cv-content h2 {
    font-size:20px;
    font-weight:bold;
    margin-top:10px;
    margin-bottom:2px;
    color:#002E45;
    text-transform:uppercase;
}

.cv-content p {
    margin:1px 0 10px 0;
    font-size:18px;
    line-height:1.5;
    color:#002E45;
}

.cv-content ul {
    list-style: none;
    padding: 0;
    margin: 1px 0 10px 0;
}

.cv-content li {
    font-size: 18px;
    line-height: 1.5;
    color: #002E45;
}

</style>

<div class="cv-page">
    <div class="cv-content">
        {{content}}
    </div>
</div>`);
                    triggerSuccessMsg('¡Plantilla Estilos/HTML Copiada!');
                  }}
                  className="w-full py-1.5 px-3 rounded bg-slate-800 hover:bg-slate-700 hover:text-white transition-all text-[11px] font-bold text-orange-400 cursor-pointer text-center"
                >
                  Copiar Plantilla Estilos/HTML
                </button>

                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(`<img src="icon.png" style="max-width:40%; margin-bottom:40px; display:block; margin-left:auto; margin-right:auto;">

# FACULTAD DE CIENCIAS DE INGENIERÍA  
# CARRERA DE TECNOLOGÍAS DE LA INFORMACIÓN Y COMUNICACIÓN EN LINEA.

## TEMA:
APE 2

## GRUPO:
Wilmer Patiño
Maria Fernandez
Stefanía Rodriguez

## CURSO:
Arquitectura de Computador

## PROFESOR:
Ing. Bermeo Paucar Javier, Mgti

## FECHA:
Junio 18, 2026

## PERIODO:
Abril 2026 - Julio 2026

<br>
<br>

# MILAGRO-ECUADOR`);
                    triggerSuccessMsg('¡Contenido Markdown Copiado!');
                  }}
                  className="w-full py-1.5 px-3 rounded bg-slate-800 hover:bg-slate-700 hover:text-white transition-all text-[11px] font-bold text-orange-400 cursor-pointer text-center"
                >
                  Copiar Contenido (Markdown)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PAGE DESIGN AND STYLING STUFF */}
        {activeType === 'settings' && (
          <div className="flex flex-col gap-4 text-xs">
            {/* General CSS Copy Action */}
            <button
              type="button"
              onClick={handleCopyAllCSS}
              className="py-2 px-3 rounded bg-orange-600 hover:bg-orange-700 active:scale-[98%] text-white font-extrabold text-[11px] flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md border border-orange-500"
              title="Copiar al portapapeles todos los estilos CSS definidos de títulos, textos, párrafos, tablas, encabezados y pies de página"
            >
              <Copy className="w-3.5 h-3.5 text-white" />
              <span>Copiar todos los Estilos CSS</span>
            </button>

            {/* Page Dimensions selector */}
            <div className="flex flex-col gap-1.5 flex-1">
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Tamaño de Papel</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => handleSettingsChange('pageSize', 'letter')}
                  className={`p-2 rounded border text-center font-bold tracking-wide text-xs transition-all cursor-pointer ${
                    settings.pageSize === 'letter'
                      ? 'bg-[#004080] border-[#FF6600] text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                  title="Carta (8.5in x 11in)"
                >
                  Letter
                  <span className="block text-[8px] font-normal text-slate-400 mt-0.5">8.5" × 11"</span>
                </button>
                <button
                  onClick={() => handleSettingsChange('pageSize', 'a4')}
                  className={`p-2 rounded border text-center font-bold tracking-wide text-xs transition-all cursor-pointer ${
                    settings.pageSize === 'a4'
                      ? 'bg-[#004080] border-[#FF6600] text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                  title="A4 (21.0cm x 29.7cm)"
                >
                  A4
                  <span className="block text-[8px] font-normal text-slate-400 mt-0.5">21 × 29.7cm</span>
                </button>
                <button
                  onClick={() => handleSettingsChange('pageSize', '16:9')}
                  className={`p-2 rounded border text-center font-bold tracking-wide text-xs transition-all cursor-pointer ${
                    settings.pageSize === '16:9'
                      ? 'bg-[#004080] border-[#FF6600] text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                  title="Diapositiva / Widescreen (16:9)"
                >
                  16:9
                  <span className="block text-[8px] font-normal text-slate-400 mt-0.5">Pantalla</span>
                </button>
              </div>
            </div>

            {/* Page Orientation selector */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Orientación de Página</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleSettingsChange('orientation', 'portrait')}
                  className={`p-2.5 rounded border text-center font-bold tracking-wide transition-all cursor-pointer ${
                    (settings.orientation || 'portrait') === 'portrait'
                      ? 'bg-[#004080] border-[#FF6600] text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Vertical (Portrait)
                </button>
                <button
                  onClick={() => handleSettingsChange('orientation', 'landscape')}
                  className={`p-2.5 rounded border text-center font-bold tracking-wide transition-all cursor-pointer ${
                    settings.orientation === 'landscape'
                      ? 'bg-[#004080] border-[#FF6600] text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Horizontal (Landscape)
                </button>
              </div>
            </div>

            {/* Copy Page Details Action */}
            <button
              type="button"
              onClick={handleCopyDimensions}
              className="py-2.5 px-3 rounded bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-[#FF6600]/80 text-slate-300 hover:text-orange-450 font-bold text-[10.5px] flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-[98%]"
              title="Copiar dimensiones de página, orientación, DPI y área de contenido útil restando el ancho de los bordes"
            >
              <Copy className="w-3.5 h-3.5 text-orange-500" />
              <span>Copiar Ajustes de Página y Área Útil</span>
            </button>

            {/* Boundary guides toggler */}
            <div className="flex items-center justify-between p-2.5 bg-slate-950 rounded border border-slate-850">
              <div className="flex flex-col gap-0.5">
                <span className="font-bold text-[10px] uppercase tracking-wider text-slate-300">Guías de márgenes (1 in)</span>
                <span className="text-[9px] text-slate-500">Muestra líneas límite de impresión</span>
              </div>
              <button
                onClick={() => handleSettingsChange('showGuides', !settings.showGuides)}
                className={`p-1 flex items-center transition-all cursor-pointer ${
                  settings.showGuides ? 'text-orange-400' : 'text-slate-500'
                }`}
              >
                {settings.showGuides ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5 opacity-40" />}
              </button>
            </div>

            {/* Accordions */}
            <div className="flex flex-col gap-3">
              
              {/* Margins */}
              <div className="border border-slate-800 rounded bg-slate-950/25 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setIsMarginsOpen(!isMarginsOpen)}
                  className="w-full p-2.5 bg-slate-950 hover:bg-slate-900/80 flex justify-between items-center text-left transition-all"
                >
                  <span className="font-extrabold uppercase text-[10px] tracking-wider text-slate-350">
                    📐 Márgenes de Página (px)
                  </span>
                  <span>{isMarginsOpen ? '▲' : '▼'}</span>
                </button>
                {isMarginsOpen && (
                  <div className="p-3 border-t border-slate-850 bg-slate-900/10 flex flex-col gap-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Superior (Top)</label>
                        <input
                          type="number"
                          value={localMarginTop}
                          onChange={(e) => setLocalMarginTop(e.target.value)}
                          onBlur={() => handleCommitMargin('marginTop', localMarginTop)}
                          onKeyDown={(e) => handleMarginKeyDown(e, 'marginTop', localMarginTop)}
                          className="w-full p-1.5 bg-slate-950 border border-slate-800 rounded text-slate-200"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Inferior (Bottom)</label>
                        <input
                          type="number"
                          value={localMarginBottom}
                          onChange={(e) => setLocalMarginBottom(e.target.value)}
                          onBlur={() => handleCommitMargin('marginBottom', localMarginBottom)}
                          onKeyDown={(e) => handleMarginKeyDown(e, 'marginBottom', localMarginBottom)}
                          className="w-full p-1.5 bg-slate-950 border border-slate-800 rounded text-slate-200"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Izquierdo (Left)</label>
                        <input
                          type="number"
                          value={localMarginLeft}
                          onChange={(e) => setLocalMarginLeft(e.target.value)}
                          onBlur={() => handleCommitMargin('marginLeft', localMarginLeft)}
                          onKeyDown={(e) => handleMarginKeyDown(e, 'marginLeft', localMarginLeft)}
                          className="w-full p-1.5 bg-slate-950 border border-slate-800 rounded text-slate-200"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Derecho (Right)</label>
                        <input
                          type="number"
                          value={localMarginRight}
                          onChange={(e) => setLocalMarginRight(e.target.value)}
                          onBlur={() => handleCommitMargin('marginRight', localMarginRight)}
                          onKeyDown={(e) => handleMarginKeyDown(e, 'marginRight', localMarginRight)}
                          className="w-full p-1.5 bg-slate-950 border border-slate-800 rounded text-slate-200"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="border border-slate-800 rounded bg-slate-950/25 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setIsTextEditorOpen(!isTextEditorOpen)}
                  className="w-full p-2.5 bg-slate-950 hover:bg-slate-900/80 flex justify-between items-center text-left transition-all"
                >
                  <span className="font-extrabold uppercase text-[10px] tracking-wider text-slate-350">
                    📝 Configuración de Texto
                  </span>
                  <span>{isTextEditorOpen ? '▲' : '▼'}</span>
                </button>
                {isTextEditorOpen && (
                  <div className="p-3 border-t border-slate-850 bg-slate-900/10 flex flex-col gap-3">
                    <span className="text-[9px] text-slate-400 font-bold uppercase mb-1">Editor CSS de Títulos y Párrafos</span>
                    <textarea
                      value={settings.blockStyleTitles || ''}
                      onChange={(e) => handleSettingsChange('blockStyleTitles', e.target.value)}
                      rows={14}
                      className="w-full p-2 bg-slate-950 border border-slate-800 rounded text-slate-200 font-mono text-[10.5px]"
                      placeholder="/* .unemi-document-content h1 {} */"
                    />
                  </div>
                )}
              </div>

              {/* Table custom styles */}
              <div className="border border-slate-800 rounded bg-slate-950/25 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setIsTableStyleOpen(!isTableStyleOpen)}
                  className="w-full p-2.5 bg-slate-950 hover:bg-slate-900/80 flex justify-between items-center text-left transition-all"
                >
                  <span className="font-extrabold uppercase text-[10px] tracking-wider text-slate-350">
                    📊 Visualización de Tablas
                  </span>
                  <span>{isTableStyleOpen ? '▲' : '▼'}</span>
                </button>
                {isTableStyleOpen && (
                  <div className="p-3 border-t border-slate-850 bg-slate-900/10 flex flex-col gap-2">
                    <span className="text-[9px] text-slate-400 font-bold uppercase">Editor CSS de Tablas de Documento</span>
                    <textarea
                      value={settings.tableCustomCss !== undefined && settings.tableCustomCss !== null ? settings.tableCustomCss : DEFAULT_TABLE_CSS}
                      onChange={(e) => handleSettingsChange('tableCustomCss', e.target.value)}
                      rows={6}
                      className="w-full p-2 bg-slate-950 border border-slate-800 rounded text-slate-200 font-mono text-[10px]"
                    />
                    <div className="mt-1 p-2.5 bg-slate-950 border border-slate-850 rounded-lg flex flex-col gap-1.5 text-[10px]">
                      <span className="text-[10px] text-[#FF6600] font-extrabold flex items-center gap-1 uppercase tracking-wider">
                        <span>📊 ¿Cómo poner bordes a tus Tablas?</span>
                      </span>
                      <p className="text-slate-400 text-[10px] leading-relaxed">
                        Por defecto, el estilo UNEMI/APA 7 inserta tablas sin bordes verticales. Copia y pega el siguiente código arriba para activar una cuadrícula completa en tu previsualización de tablas:
                      </p>
                      <pre className="p-2 bg-slate-900 rounded font-mono text-[9px] text-[#FF6600]/90 select-all border border-slate-800/60 overflow-x-auto leading-normal">
{`.unemi-document-content table, 
.unemi-document-content table th, 
.unemi-document-content table td {
  border: 1px solid #000000 !important;
}`}
                      </pre>
                      <p className="text-slate-500 text-[9px] italic">
                        * Nota: Haz clic dentro del recuadro naranja de arriba para seleccionarlo y copiarlo fácilmente, luego pégalo en el editor de arriba.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Estilo de Listas */}
              <div className="border border-slate-800 rounded bg-slate-950/25 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setIsListsStyleOpen(!isListsStyleOpen)}
                  className="w-full p-2.5 bg-slate-950 hover:bg-slate-900/80 flex justify-between items-center text-left transition-all"
                >
                  <span className="font-extrabold uppercase text-[10px] tracking-wider text-slate-350 flex items-center gap-1.5">
                    <span>📌</span> Lista y Viñetas (ul, ol)
                  </span>
                  <span>{isListsStyleOpen ? '▲' : '▼'}</span>
                </button>
                {isListsStyleOpen && (
                  <div className="p-3 border-t border-slate-850 bg-slate-900/10 flex flex-col gap-3.5">
                    {/* CSS Editor for blockStyleLists */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[9.5px] text-slate-400 font-bold uppercase tracking-wider flex items-center justify-between">
                        <span>Editor CSS de Listas</span>
                        <span className="text-[7.5px] text-slate-500 font-mono normal-case">Estilos APA 7 activos</span>
                      </label>
                      <textarea
                        value={settings.blockStyleLists || ''}
                        onChange={(e) => handleSettingsChange('blockStyleLists', e.target.value)}
                        rows={10}
                        className="w-full p-2 bg-slate-950 border border-slate-800 rounded text-slate-200 font-mono text-[10px] leading-relaxed focus:border-[#FF6600]/80 focus:outline-none"
                        placeholder="/* Estilos CSS para listas académicas (ul, ol, li) */"
                      />
                    </div>

                    {/* Guías rápidas de Listas */}
                    <div className="p-2.5 bg-slate-950 border border-slate-850 rounded flex flex-col gap-1">
                      <span className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wide">💡 Consejos Rápidos para Listas</span>
                      <ul className="text-[10px] text-slate-400 list-disc list-inside space-y-1">
                        <li>Usa <code className="text-[#FF6600] font-mono text-[9px]">padding-left: 24px</code> para cambiar el espacio de la viñeta.</li>
                        <li>Las viñetas se alinean por defecto para eliminar separaciones excesivas.</li>
                        <li>Para listas con números, usa <code className="text-[#FF6600] font-mono text-[9px]">list-style-type: decimal</code>.</li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>

              {/* Código (Monospace) */}
              <div className="border border-slate-800 rounded bg-slate-950/25 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setIsCodeStyleOpen(!isCodeStyleOpen)}
                  className="w-full p-2.5 bg-slate-950 hover:bg-slate-900/80 flex justify-between items-center text-left transition-all"
                >
                  <span className="font-extrabold uppercase text-[10px] tracking-wider text-slate-350 flex items-center gap-1.5">
                    <span>💻</span> Código (Monospace)
                  </span>
                  <span>{isCodeStyleOpen ? '▲' : '▼'}</span>
                </button>
                {isCodeStyleOpen && (
                  <div className="p-3 border-t border-slate-850 bg-slate-900/10 flex flex-col gap-4">
                    {/* --- CÓDIGO EN BLOQUE --- */}
                    <div className="border-b border-slate-850 pb-3 flex flex-col gap-2.5">
                      <span className="text-[9.5px] text-orange-400 font-extrabold uppercase tracking-wide">📦 Código en Bloque (Multi-línea)</span>
                      
                      {/* Block Size */}
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] text-slate-400 font-bold uppercase">Tamaño de Fuente (ej. 13px, 0.85em)</label>
                        <input
                          type="text"
                          value={settings.blockCodeSize !== undefined ? settings.blockCodeSize : (settings.codeSize || '13px')}
                          onChange={(e) => handleSettingsChange('blockCodeSize', e.target.value)}
                          className="w-full p-1.5 bg-slate-950 border border-slate-800 rounded text-slate-200 font-mono text-xs focus:ring-1 focus:ring-orange-500 focus:outline-none"
                          placeholder="13px"
                        />
                      </div>

                      {/* Block Theme */}
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] text-slate-400 font-bold uppercase">Tema de Código</label>
                        <select
                          value={settings.blockCodeTheme || settings.codeTheme || 'academic'}
                          onChange={(e) => handleSettingsChange('blockCodeTheme', e.target.value)}
                          className="w-full p-1.5 bg-slate-950 border border-slate-800 rounded text-slate-200 text-xs focus:ring-1 focus:ring-orange-500 focus:outline-none"
                        >
                          <option value="academic">Academic (Default Light)</option>
                          <option value="dracula">Dracula (Dark)</option>
                          <option value="monokai">Monokai (Dark Retro)</option>
                          <option value="github-light">GitHub Light</option>
                          <option value="solarized-light">Solarized Light (Warm)</option>
                          <option value="nord">Nord (Nordic Dark)</option>
                        </select>
                      </div>

                      {/* Split Block Code Borders Toggle */}
                      <div className="flex flex-col gap-1 mt-1 bg-slate-950/20 p-2 rounded border border-slate-850">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[9px] text-slate-400 font-bold uppercase">Bordes continuos al dividir</span>
                          <label className="relative inline-flex items-center gap-1.5 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={!!settings.splitBlockCodeBorders}
                              onChange={(e) => handleSettingsChange('splitBlockCodeBorders', e.target.checked)}
                              className="absolute opacity-0 w-0 h-0 pointer-events-none peer"
                            />
                            <div className="w-7 h-4 bg-slate-950 rounded-full peer peer-checked:bg-orange-600 relative transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-3 peer-checked:after:bg-slate-100" />
                          </label>
                        </div>
                        <p className="text-[8.5px] text-slate-500 leading-normal">
                          Une visualmente los bloques de código que se dividen entre hojas (borde superior solo al inicio, sin bordes internos horizontales, borde inferior solo al final).
                        </p>
                      </div>

                      {/* Block Highlight Live Preview */}
                      <div className="mt-1">
                        <label className="text-[8px] text-slate-500 font-bold uppercase tracking-wider mb-1 block">Vista Previa del Bloque</label>
                        {(() => {
                          const previewTheme = settings.blockCodeTheme || settings.codeTheme || 'academic';
                          const rawSize = settings.blockCodeSize !== undefined ? settings.blockCodeSize : (settings.codeSize || '13px');
                          const previewSize = formatFontSize(rawSize, '13px');
                          let previewBg = '#f8fafc';
                          let previewFg = '#0f172a';
                          let previewBorder = '#cbd5e1';
                          let commentColor = '#64748b';
                          let keywordColor = '#0f172a';
                          let stringColor = '#0f172a';
                          let isBoldKeyword = true;
                          let isItalicString = true;

                          if (previewTheme === 'dracula') {
                            previewBg = '#282a36';
                            previewFg = '#f8f8f2';
                            previewBorder = '#44475a';
                            commentColor = '#6272a4';
                            keywordColor = '#ff79c6';
                            stringColor = '#f1fa8c';
                            isBoldKeyword = false;
                            isItalicString = false;
                          } else if (previewTheme === 'monokai') {
                            previewBg = '#272822';
                            previewFg = '#f8f8f2';
                            previewBorder = '#3e3d32';
                            commentColor = '#75715e';
                            keywordColor = '#f92672';
                            stringColor = '#e6db74';
                            isBoldKeyword = false;
                            isItalicString = false;
                          } else if (previewTheme === 'github-light') {
                            previewBg = '#f6f8fa';
                            previewFg = '#24292f';
                            previewBorder = '#d0d7de';
                            commentColor = '#6e7781';
                            keywordColor = '#cf222e';
                            stringColor = '#0a3069';
                            isBoldKeyword = true;
                            isItalicString = false;
                          } else if (previewTheme === 'solarized-light') {
                            previewBg = '#fdf6e3';
                            previewFg = '#657b83';
                            previewBorder = '#efe8d4';
                            commentColor = '#93a1a1';
                            keywordColor = '#859900';
                            stringColor = '#2aa198';
                            isBoldKeyword = false;
                            isItalicString = false;
                          } else if (previewTheme === 'nord') {
                            previewBg = '#2e3440';
                            previewFg = '#d8dee9';
                            previewBorder = '#3b4252';
                            commentColor = '#4c566a';
                            keywordColor = '#81a1c1';
                            stringColor = '#a3be8c';
                            isBoldKeyword = false;
                            isItalicString = false;
                          }

                          return (
                            <div 
                              className="rounded p-2.5 font-mono text-[10px] border leading-normal transition-all duration-200"
                              style={{ 
                                backgroundColor: previewBg, 
                                color: previewFg, 
                                borderColor: previewBorder,
                                fontSize: previewSize 
                              }}
                            >
                              <span style={{ color: commentColor, fontStyle: 'italic' }}>{"// Comentario de ejemplo"}</span>
                              <br />
                              <span style={{ color: keywordColor, fontWeight: isBoldKeyword ? 'bold' : 'normal' }}>{"const "}</span>
                              <span>{"mensaje = "}</span>
                              <span style={{ color: stringColor, fontStyle: isItalicString ? 'italic' : 'normal' }}>{`"Hola UNEMI"`}</span>
                              <span>{";"}</span>
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    {/* --- CÓDIGO EN LÍNEA --- */}
                    <div className="flex flex-col gap-2.5">
                      <span className="text-[9.5px] text-teal-400 font-extrabold uppercase tracking-wide">🏷️ Código en Línea (En-texto)</span>
                      
                      {/* Inline Size */}
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] text-slate-400 font-bold uppercase">Tamaño de Fuente (ej. 12px, 0.8em)</label>
                        <input
                          type="text"
                          value={settings.inlineCodeSize !== undefined ? settings.inlineCodeSize : '12px'}
                          onChange={(e) => handleSettingsChange('inlineCodeSize', e.target.value)}
                          className="w-full p-1.5 bg-slate-950 border border-slate-800 rounded text-slate-200 font-mono text-xs focus:ring-1 focus:ring-orange-500 focus:outline-none"
                          placeholder="12px"
                        />
                      </div>

                      {/* Inline Theme */}
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] text-slate-400 font-bold uppercase">Tema de Código en Línea</label>
                        <select
                          value={settings.inlineCodeTheme || settings.codeTheme || 'academic'}
                          onChange={(e) => handleSettingsChange('inlineCodeTheme', e.target.value)}
                          className="w-full p-1.5 bg-slate-950 border border-slate-800 rounded text-slate-200 text-xs focus:ring-1 focus:ring-orange-500 focus:outline-none"
                        >
                          <option value="academic">Academic (Default Light)</option>
                          <option value="dracula">Dracula (Dark)</option>
                          <option value="monokai">Monokai (Dark Retro)</option>
                          <option value="github-light">GitHub Light</option>
                          <option value="solarized-light">Solarized Light (Warm)</option>
                          <option value="nord">Nord (Nordic Dark)</option>
                        </select>
                      </div>

                      {/* Inline Highlight Live Preview */}
                      <div className="mt-1">
                        <label className="text-[8px] text-slate-500 font-bold uppercase tracking-wider mb-1 block">Vista Previa del Código en Línea</label>
                        {(() => {
                          const previewTheme = settings.inlineCodeTheme || settings.codeTheme || 'academic';
                          const rawSize = settings.inlineCodeSize !== undefined ? settings.inlineCodeSize : '12px';
                          const previewSize = formatFontSize(rawSize, '12px');
                          let inlineBg = '#f1f5f9';
                          let inlineColor = '#0f172a';
                          let inlineBorder = '#cbd5e1';

                          if (previewTheme === 'dracula') {
                            inlineBg = '#282a36';
                            inlineColor = '#f8f8f2';
                            inlineBorder = '#44475a';
                          } else if (previewTheme === 'monokai') {
                            inlineBg = '#272822';
                            inlineColor = '#f8f8f2';
                            inlineBorder = '#3e3d32';
                          } else if (previewTheme === 'github-light') {
                            inlineBg = '#f6f8fa';
                            inlineColor = '#24292f';
                            inlineBorder = '#d0d7de';
                          } else if (previewTheme === 'solarized-light') {
                            inlineBg = '#fdf6e3';
                            inlineColor = '#657b83';
                            inlineBorder = '#efe8d4';
                          } else if (previewTheme === 'nord') {
                            inlineBg = '#2e3440';
                            inlineColor = '#d8dee9';
                            inlineBorder = '#3b4252';
                          } else {
                            // academic / default light
                            inlineBg = '#f8fafc';
                            inlineColor = '#0f172a';
                            inlineBorder = '#cbd5e1';
                          }

                          return (
                            <div className="p-2 bg-slate-950/80 rounded border border-slate-850 text-slate-350 text-[11px] leading-relaxed">
                              <span>{"El método "}</span>
                              <span 
                                className="font-mono px-1 rounded transition-all duration-200"
                                style={{ 
                                  backgroundColor: inlineBg, 
                                  color: inlineColor, 
                                  border: `1px solid ${inlineBorder}`,
                                  fontSize: previewSize 
                                }}
                              >
                                {"console.log()"}
                              </span>
                              <span>{" sirve para depurar."}</span>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                )}
              </div>





            </div>
          </div>
        )}

        {/* TAB 4: TABLA DE CONTENIDOS (TOC) LEVEL EDITING & STYLE CONFIG */}
        {activeType === 'toc' && (
          <div className="flex flex-col gap-4 text-xs">
            {/* 1. Interactive TOC Schema & Level Editors */}
            <div className="flex flex-col gap-2 p-3 bg-slate-950 rounded border border-slate-850">
              {(() => {
                const headings = getHeadings();
                return (
                  <div className="flex flex-col gap-2">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                      <span>📋</span> Esquema y Niveles de Títulos ({headings.length})
                    </span>
                    <p className="text-[10px] text-slate-500 mb-1 leading-normal">
                      Usa las flechas para subir (izq) o bajar (der) el nivel jerárquico de tus títulos directamente en tu código.
                    </p>
                    
                    {headings.length === 0 ? (
                      <div className="p-4 bg-slate-950/40 rounded border border-slate-850 text-center text-slate-500 text-[11px]">
                        No se detectaron títulos en el documento. Añade etiquetas h1-h6 o marcas de Markdown #, ## en tus bloques de contenido.
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1.5 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar border border-slate-850 bg-slate-950/20 rounded p-2">
                        {headings.map((heading, i) => {
                          const indentPadding = (heading.level - 1) * 12;
                          return (
                            <div 
                              key={`${heading.blockId}-${heading.lineIndex}-${i}`}
                              className="flex items-center justify-between p-1.5 bg-slate-950/80 hover:bg-slate-900/40 border border-slate-900 rounded transition-all group gap-2"
                            >
                              <div className="flex items-center gap-1.5 min-w-0 flex-1" style={{ paddingLeft: `${indentPadding}px` }}>
                                <span className="text-[8px] font-extrabold px-1 py-0.5 rounded bg-slate-900 text-orange-400 border border-slate-800 shrink-0 uppercase tracking-tight font-mono">
                                  H{heading.level}
                                </span>
                                <span className="text-[11px] font-medium text-slate-250 truncate" title={heading.cleanText}>
                                  {heading.cleanText}
                                </span>
                                <span className="text-[8px] text-slate-500 italic shrink-0 hidden group-hover:inline truncate max-w-[80px]">
                                  ({heading.blockName})
                                </span>
                              </div>
                              
                              <div className="flex items-center gap-1 shrink-0">
                                {/* Left Arrow Button (Promote Level) */}
                                <button
                                  type="button"
                                  onClick={() => handleUpdateHeadingLevel(heading, 'left')}
                                  disabled={heading.level <= 1}
                                  className="p-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white disabled:opacity-20 disabled:hover:bg-slate-900 disabled:hover:text-slate-300 transition-all cursor-pointer"
                                  title="Subir nivel (ej. H2 a H1)"
                                >
                                  <ChevronLeft className="w-3.5 h-3.5" />
                                </button>
                                
                                {/* Right Arrow Button (Demote Level) */}
                                <button
                                  type="button"
                                  onClick={() => handleUpdateHeadingLevel(heading, 'right')}
                                  disabled={heading.level >= 6}
                                  className="p-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white disabled:opacity-20 disabled:hover:bg-slate-900 disabled:hover:text-slate-300 transition-all cursor-pointer"
                                  title="Bajar nivel (ej. H2 a H3)"
                                >
                                  <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* 2. TOC Visibility & Global Settings */}
            <div className="flex flex-col gap-3.5 p-3 bg-slate-950 rounded border border-slate-850">
              <span className="text-[10px] text-slate-450 font-bold uppercase tracking-wider">
                Ajustes Generales del Índice
              </span>

              {/* Table of contents indices toggle */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-[9.5px] font-bold text-slate-350 uppercase">Mostrar Tabla de Contenidos (TOC)</span>
                  <button
                    onClick={() => handleSettingsChange('showTOC', !settings.showTOC)}
                    className={`text-xs px-2.5 py-1 rounded border font-bold transition-all cursor-pointer ${
                      settings.showTOC 
                        ? 'bg-[#004080] border-[#FF6600] text-white' 
                        : 'bg-slate-900 border-slate-800 text-slate-500'
                    }`}
                  >
                    {settings.showTOC ? 'SÍ, MOSTRAR' : 'NO, OCULTAR'}
                  </button>
                </div>
                {settings.showTOC && (
                  <div className="flex flex-col gap-1 mt-2 border-t border-slate-900 pt-2">
                    <label className="text-[8px] text-slate-400 font-bold uppercase">Título del Índice</label>
                    <input
                      type="text"
                      value={settings.tocTitle || 'Tabla de Contenidos'}
                      onChange={(e) => handleSettingsChange('tocTitle', e.target.value)}
                      className="p-1.5 bg-slate-900 border border-slate-850 rounded text-slate-200 text-xs focus:ring-1 focus:ring-orange-500 focus:outline-none"
                    />
                  </div>
                )}
              </div>

              {/* Headings autonumbering toggle */}
              <div className="flex items-center justify-between border-t border-slate-900 pt-3">
                <span className="text-[9.5px] font-bold text-slate-350 uppercase">Auto-Numerar Títulos (H1, H2, H3)</span>
                <button
                  onClick={() => handleSettingsChange('autoNumberHeadings', !settings.autoNumberHeadings)}
                  className={`text-xs px-2.5 py-1 rounded border font-bold transition-all cursor-pointer ${
                    settings.autoNumberHeadings 
                      ? 'bg-[#004080] border-[#FF6600] text-white' 
                      : 'bg-slate-900 border-slate-800 text-slate-500'
                  }`}
                >
                  {settings.autoNumberHeadings ? 'SÍ (1. 2. 2.1)' : 'NO'}
                </button>
              </div>
            </div>

            {/* 3. CSS Customization Editor for blockStyleTOC */}
            <div className="flex flex-col gap-2 p-3 bg-slate-950 rounded border border-slate-850">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  Diseño de Tabla de Contenidos
                </span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      const cssToCopy = settings.blockStyleTOC || DEFAULT_BLOCK_TOC;
                      navigator.clipboard.writeText(cssToCopy)
                        .then(() => triggerSuccessMsg('¡Estilos CSS copiados!'))
                        .catch(() => alert('Error al copiar al portapapeles.'));
                    }}
                    className="px-1.5 py-0.5 bg-slate-900 hover:bg-slate-850 text-[8.5px] text-slate-300 rounded font-medium flex items-center gap-0.5 border border-slate-800"
                    title="Copiar los estilos CSS de la tabla de contenidos al portapapeles"
                  >
                    Copiar CSS
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('¿Restablecer los estilos del Índice a los predeterminados?')) {
                        handleSettingsChange('blockStyleTOC', DEFAULT_BLOCK_TOC);
                        triggerSuccessMsg('Estilos del Índice restablecidos.');
                      }
                    }}
                    className="px-1.5 py-0.5 bg-slate-900 hover:bg-slate-850 text-[8.5px] text-slate-400 hover:text-slate-300 rounded font-medium flex items-center gap-0.5 border border-slate-800"
                    title="Restablecer a los estilos predeterminados"
                  >
                    Restablecer
                  </button>
                </div>
              </div>
              
              <textarea
                value={settings.blockStyleTOC || ''}
                onChange={(e) => handleSettingsChange('blockStyleTOC', e.target.value)}
                rows={10}
                className="w-full p-2 bg-slate-900 border border-slate-800 rounded text-slate-200 font-mono text-[10px] leading-relaxed focus:border-orange-500 focus:outline-none"
                placeholder="/* Estilos CSS para el TOC de la hoja */"
              />
            </div>
          </div>
        )}

        {/* TAB 3: FILE BANK GESTION */}
        {activeType === 'uploads' && (
          <div className="flex flex-col gap-4 text-xs">
            <p className="text-[11px] text-slate-400 leading-normal">
              Sube imágenes locales (de hasta 5MB) para incrustarlas directamente en tu documento académico. Se codificarán en Base64 para máxima portabilidad de la hoja.
            </p>

            {/* Drag & Drop Upload Zone */}
            <div 
              className="border-2 border-dashed border-slate-700 hover:border-orange-500 bg-slate-950/50 hover:bg-slate-900/20 active:bg-slate-900/40 rounded-lg p-5 text-center transition-all cursor-pointer relative group flex flex-col items-center justify-center gap-2"
              onClick={() => document.getElementById('drawer-assets-uploader')?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const files = e.dataTransfer.files;
                if (files && files.length > 0) {
                  handleMultipleFilesUpload(files);
                }
              }}
            >
              <Upload className="w-8 h-8 text-slate-500 group-hover:text-orange-500 transition-colors" />
              <div className="flex flex-col gap-1">
                <span className="font-bold text-slate-350 text-[11px]">Subir una o varias imágenes</span>
                <span className="text-[9.5px] text-slate-500 font-normal">Soporta selección múltiple y arrastrar/soltar</span>
              </div>
              <input
                id="drawer-assets-uploader"
                type="file"
                multiple
                accept="image/*"
                onChange={(e) => {
                  const files = e.target.files;
                  if (files && files.length > 0) {
                    handleMultipleFilesUpload(files);
                  }
                  e.target.value = '';
                }}
                className="hidden"
              />
            </div>

            {/* Panel de Enlaces URL Externos */}
            <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg flex flex-col gap-2">
              <span className="font-extrabold uppercase text-[9.5px] tracking-wider text-slate-350">
                🌐 Añadir imagen por URL externa
              </span>
              <div className="flex flex-col gap-1.5">
                <input
                  type="text"
                  id="url-uploader-src"
                  placeholder="Pegue la URL de la imagen (ej: https://ejemplo.com/grafico.png)"
                  className="w-full p-2 bg-slate-950 border border-slate-800 rounded text-slate-200 text-[11px] focus:ring-1 focus:ring-orange-500 focus:outline-none focus:border-[#FF6600]/80 font-mono"
                />
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    id="url-uploader-name"
                    placeholder="Nombre opcional (ej: mi_grafico.png)"
                    className="flex-1 p-2 bg-slate-950 border border-slate-800 rounded text-slate-200 text-[11px] focus:ring-1 focus:ring-orange-500 focus:outline-none focus:border-[#FF6600]/80 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const urlEl = document.getElementById('url-uploader-src') as HTMLInputElement;
                      const nameEl = document.getElementById('url-uploader-name') as HTMLInputElement;
                      if (urlEl && urlEl.value.trim()) {
                        handleAddFileByUrl(urlEl.value, nameEl.value);
                        urlEl.value = '';
                        nameEl.value = '';
                      } else {
                        alert('Por favor ingrese una URL de imagen válida.');
                      }
                    }}
                    className="px-3 bg-[#004080] hover:bg-[#003060] border border-slate-800 rounded text-white font-bold text-[10.5px] cursor-pointer transition-all active:scale-95"
                  >
                    Agregar URL
                  </button>
                </div>
              </div>
            </div>

            {/* Uploaded assets list */}
            <div className="flex flex-col gap-2">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex justify-between items-center">
                <span>Imágenes Guardadas ({uploadedFiles.length})</span>
                {uploadedFiles.length > 0 && (
                  <button
                    onClick={() => {
                      if (confirm("¿Está seguro de eliminar TODAS las imágenes guardadas hoy?")) {
                        setUploadedFiles([]);
                      }
                    }}
                    className="text-[9px] lowercase font-bold text-red-500 hover:text-red-400 flex items-center gap-1 cursor-pointer"
                  >
                    Borrar todo
                  </button>
                )}
              </span>

              {uploadedFiles.length === 0 ? (
                <div className="p-6 text-center border border-slate-800 bg-slate-950/20 rounded-md text-slate-500 italic text-[11px]">
                  No hay imágenes agregadas. Use el cuadro superior para cargar su primer recurso.
                </div>
              ) : (
                <div className="flex flex-col gap-2 max-h-[380px] overflow-y-auto custom-scrollbar pr-0.5 select-text">
                  {uploadedFiles.map((item) => {
                    const isEditing = editingFileId === item.id;
                    const isSelectedForAI = selectedImagesForAI.some(f => f.id === item.id);
                    return (
                      <div 
                        key={item.id}
                        className="p-2 border border-slate-850 bg-slate-950/40 rounded flex items-start gap-2.5 hover:border-slate-800 transition-all text-xs"
                      >
                        {/* Thumbnail */}
                        <div className="w-10 h-10 rounded bg-slate-900 border border-slate-800 shrink-0 overflow-hidden flex items-center justify-center mt-0.5">
                          <img 
                            src={item.dataUrl} 
                            alt={item.name} 
                            className="max-w-full max-h-full object-contain"
                            referrerPolicy="no-referrer"
                          />
                        </div>

                        {/* File Details / Rename Input with Side-by-Side Name and Description */}
                        <div className="flex-1 min-w-0 grid grid-cols-2 gap-3 items-start">
                          {/* Column 1: Name and Size */}
                          <div className="min-w-0 flex flex-col gap-1">
                            {isEditing ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  value={editingFileName}
                                  onChange={(e) => setEditingFileName(e.target.value)}
                                  className="flex-1 bg-slate-900 border border-orange-500 rounded px-1.5 py-0.5 text-[11px] text-white font-mono focus:outline-none focus:ring-1 focus:ring-orange-500"
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveRename(item.id);
                                    if (e.key === 'Escape') setEditingFileId(null);
                                  }}
                                  autoFocus
                                />
                                <button
                                  onClick={() => handleSaveRename(item.id)}
                                  className="p-1 rounded bg-[#004080] text-white hover:bg-[#003060] border border-slate-800 transition-all cursor-pointer flex items-center justify-center shrink-0"
                                  title="Guardar nombre"
                                >
                                  <Check className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => setEditingFileId(null)}
                                  className="p-1 rounded bg-slate-950 text-slate-400 hover:text-white border border-slate-800 transition-all cursor-pointer flex items-center justify-center shrink-0"
                                  title="Cancelar"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 group/item">
                                <span className="font-bold text-[11px] text-slate-300 truncate block" title={item.name}>
                                  {item.name}
                                </span>
                                <button
                                  onClick={() => {
                                    setEditingFileId(item.id);
                                    setEditingFileName(item.name);
                                  }}
                                  className="p-0.5 rounded text-slate-500 hover:text-orange-400 hover:bg-slate-950/40 opacity-40 group-hover/item:opacity-100 transition-all cursor-pointer shrink-0"
                                  title="Renombrar imagen"
                                >
                                  <Edit2 className="w-2.5 h-2.5" />
                                </button>
                              </div>
                            )}

                            <div className="flex items-center gap-1.5 text-[9.5px] text-slate-500 font-mono mt-0.5">
                              <span>{(item.size / 1024).toFixed(1)} KB</span>
                            </div>
                          </div>

                          {/* Column 2: Editable Image Description Field (to the right of Name) */}
                          <div className="min-w-0 border-l border-slate-800 pl-2 flex flex-col gap-0.5">
                            <span className="text-[8px] text-orange-400 uppercase font-black tracking-wider block">Descripción:</span>
                            {isEditingDescId === item.id ? (
                              <div className="flex gap-1 items-start mt-0.5">
                                <textarea
                                  value={editingDescText}
                                  onChange={(e) => setEditingDescText(e.target.value)}
                                  placeholder="Escribe la descripción..."
                                  rows={2}
                                  className="flex-1 bg-slate-900 border border-orange-500 rounded px-1.5 py-1 text-[10px] text-slate-200 focus:outline-none focus:ring-1 focus:ring-orange-500 leading-normal"
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                      e.preventDefault();
                                      handleSaveDesc(item.id);
                                    }
                                    if (e.key === 'Escape') setIsEditingDescId(null);
                                  }}
                                  autoFocus
                                />
                                <div className="flex flex-col gap-1 shrink-0">
                                  <button
                                    onClick={() => handleSaveDesc(item.id)}
                                    className="p-1 rounded bg-[#004080] text-white hover:bg-[#003060] transition-all cursor-pointer flex items-center justify-center"
                                    title="Guardar descripción"
                                  >
                                    <Check className="w-2.5 h-2.5" />
                                  </button>
                                  <button
                                    onClick={() => setIsEditingDescId(null)}
                                    className="p-1 rounded bg-slate-950 text-slate-400 hover:text-white transition-all cursor-pointer flex items-center justify-center"
                                    title="Cancelar"
                                  >
                                    <X className="w-2.5 h-2.5" />
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-start gap-1 group/desc min-h-[16px] mt-0.5">
                                <span 
                                  onClick={() => {
                                    setIsEditingDescId(item.id);
                                    setEditingDescText(item.description || '');
                                  }}
                                  className="text-[10px] text-slate-400 hover:text-slate-200 cursor-pointer break-words line-clamp-3 leading-normal flex-1"
                                  title="Haz clic para editar la descripción"
                                >
                                  {item.description ? item.description : <span className="text-slate-600 italic">(Añadir desc.)</span>}
                                </span>
                                <button
                                  onClick={() => {
                                    setIsEditingDescId(item.id);
                                    setEditingDescText(item.description || '');
                                  }}
                                  className="p-0.5 rounded text-slate-500 hover:text-orange-400 opacity-0 group-hover/desc:opacity-100 transition-all cursor-pointer shrink-0"
                                  title="Editar descripción"
                                >
                                  <Edit2 className="w-2.5 h-2.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Quick actions buttons (2x2 Grid) */}
                        <div className="grid grid-cols-2 gap-1 shrink-0">
                          <button
                            onClick={() => handleCopySnippet(item.name)}
                            className="p-1 rounded bg-slate-950 hover:bg-[#004080] border border-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer flex items-center justify-center"
                            title="Copiar formato de figura"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleInsertImgTag(item.name)}
                            className="p-1 rounded bg-slate-950 hover:bg-[#004080] border border-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer flex items-center justify-center font-bold"
                            title="Insertar en último editor"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleToggleAISingleSelection(item)}
                            className={`p-1 rounded border transition-all cursor-pointer flex items-center justify-center ${
                              isSelectedForAI
                                ? 'bg-orange-500 text-slate-950 border-orange-400 hover:bg-orange-400'
                                : 'bg-slate-950 hover:bg-orange-900/50 hover:border-orange-500/50 border-slate-800 text-slate-400 hover:text-orange-400'
                            }`}
                            title="Añadir/quitar de la lista de inserción con IA"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedImagesForAI(prev => prev.filter(f => f.id !== item.id));
                              handleDeleteFile(item.id);
                            }}
                            className="p-1 rounded bg-slate-950 hover:bg-red-950/80 hover:border-red-500 border border-slate-800 text-slate-400 hover:text-red-400 transition-all cursor-pointer flex items-center justify-center"
                            title="Borrar imagen"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Instruction helper */}
            <div className="p-3 bg-slate-950 border border-slate-850 rounded text-slate-400 flex flex-col gap-2 text-[10.5px]">
              <span className="font-bold text-slate-300 uppercase text-[9.5px] tracking-wider">💡 Sintaxis y Variables de Imagen:</span>
              <p className="text-slate-400 leading-normal">
                Puedes personalizar las figuras usando atributos clave-valor entre llaves <code className="text-orange-400 font-mono text-[9.5px]">{"{...}"}</code> justo después del paréntesis:
              </p>
              <ul className="list-disc pl-4 space-y-1 text-slate-400 leading-normal">
                <li><strong className="text-slate-200">id</strong>: Identificador de la figura para citas (ej: <code className="text-orange-400 font-mono text-[9px]">id=fig-mi_grafico</code>).</li>
                <li><strong className="text-slate-200">width</strong>: Ancho de la imagen (ej: <code className="text-orange-400 font-mono text-[9px]">width=60%</code> o <code className="text-orange-400 font-mono text-[9px]">width=400px</code>).</li>
                <li><strong className="text-slate-200">align</strong>: Alineación horizontal (<code className="text-orange-400 font-mono text-[9px]">left</code>, <code className="text-orange-400 font-mono text-[9px]">center</code> o <code className="text-orange-400 font-mono text-[9px]">right</code>; solo si <code className="text-slate-300 font-mono text-[9px]">wrap=none</code>).</li>
                <li><strong className="text-slate-200">wrap</strong>: Ajuste y flotación del texto (<code className="text-orange-400 font-mono text-[9px]">left</code>, <code className="text-orange-400 font-mono text-[9px]">right</code>, <code className="text-orange-400 font-mono text-[9px]">square</code> o <code className="text-orange-400 font-mono text-[9px]">none</code>).</li>
                <li><strong className="text-slate-200">note</strong>: Nota explicativa al pie de la figura, adaptada al formato académico APA 7.</li>
              </ul>
              <div className="mt-1 pt-1.5 border-t border-slate-900">
                <span className="font-bold text-slate-300 text-[9px] uppercase block mb-1">Ejemplo de sintaxis:</span>
                <pre className="p-1.5 bg-slate-900 rounded font-mono text-[9px] text-[#FF6600]/90 select-all border border-slate-800/60 overflow-x-auto leading-normal">
{`![Título de la Figura](imagen.png){
  id=fig-ejemplo
  width=60%
  align=center
  wrap=none
  note="Datos recopilados del censo de software 2026."
}`}
                </pre>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Floating toast notifications local */}
      {successMsg && (
        <div className="fixed bottom-4 right-4 bg-orange-600 text-white px-3 py-1.5 rounded-md shadow-2xl text-xs font-bold z-50 flex items-center gap-1.5">
          <CheckCircle className="w-3.5 h-3.5" />
          {successMsg}
        </div>
      )}

      {/* Selected Images Floating Popup List */}
      {selectedImagesForAI.length > 0 && (
        <div className="fixed bottom-6 right-6 z-[9999] bg-slate-900 border-2 border-orange-500 rounded-xl shadow-2xl p-4 w-[280px] sm:w-[320px] flex flex-col gap-3 animate-slide-up text-slate-200">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-1.5 text-orange-500">
              <Sparkles className="w-4 h-4 animate-pulse" />
              <h4 className="font-extrabold text-[11px] uppercase tracking-wider text-slate-100">
                Insertar con IA ({selectedImagesForAI.length})
              </h4>
            </div>
            <button 
              onClick={() => setSelectedImagesForAI([])}
              className="text-slate-500 hover:text-white transition-colors cursor-pointer"
              title="Cancelar selección"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Selected files list */}
          <div className="flex flex-col gap-1.5 max-h-[150px] overflow-y-auto custom-scrollbar pr-0.5">
            {selectedImagesForAI.map((file) => (
              <div key={file.id} className="flex items-center justify-between gap-2 p-1.5 rounded bg-slate-950/60 border border-slate-850 text-xs">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <div className="w-6 h-6 rounded bg-slate-900 border border-slate-800 shrink-0 overflow-hidden flex items-center justify-center">
                    <img src={file.dataUrl} className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
                  </div>
                  <span className="truncate font-medium text-[10.5px] text-slate-300 block">{file.name}</span>
                </div>
                <button 
                  onClick={() => setSelectedImagesForAI(prev => prev.filter(f => f.id !== file.id))}
                  className="text-slate-500 hover:text-red-400 p-0.5 transition-colors cursor-pointer shrink-0"
                  title="Quitar de la lista"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>

          {/* Primary Insert Button */}
          <button
            onClick={handleInsertAllSelectedWithAI}
            disabled={isInsertingAI !== null}
            className="w-full py-2 bg-orange-600 hover:bg-orange-500 disabled:bg-orange-950/40 text-white font-extrabold text-xs rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg active:scale-95"
          >
            {isInsertingAI ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Insertando con IA...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Insertar {selectedImagesForAI.length} Imagen(es)</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* AI Explanation Modal */}
      {aiExplanations && aiExplanations.length > 0 && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-[9999] select-text">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 shadow-2xl flex flex-col gap-4 animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-orange-500">
                <Sparkles className="w-5 h-5 animate-pulse" />
                <h3 className="font-extrabold text-sm uppercase tracking-wider text-slate-100">
                  Inserción de Imágenes con IA
                </h3>
              </div>
              <button 
                onClick={() => setAiExplanations(null)}
                className="text-slate-500 hover:text-white cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="text-xs text-slate-350 leading-relaxed flex flex-col gap-3 max-h-[350px] overflow-y-auto custom-scrollbar pr-1">
              <p className="font-bold text-slate-200">
                Se han insertado las figuras de forma inteligente en el documento.
              </p>
              {aiExplanations.map((exp, idx) => (
                <div key={idx} className="bg-slate-950/60 p-3.5 border border-slate-850 rounded-lg font-normal text-slate-300 flex flex-col gap-1">
                  <span className="font-mono text-xs text-orange-400 font-bold bg-slate-900/80 px-2 py-1 rounded border border-slate-800 self-start">
                    {exp.imageName}
                  </span>
                  <div className="mt-2">
                    <span className="font-black text-[9px] text-[#FF6600] uppercase block mb-1 tracking-wider">Análisis y Justificación de la IA:</span>
                    <p className="whitespace-pre-line leading-relaxed">{exp.text}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end mt-1 border-t border-slate-800 pt-3">
              <button
                onClick={() => setAiExplanations(null)}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-500 active:scale-95 text-white font-bold text-xs rounded transition-all cursor-pointer shadow-md"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
