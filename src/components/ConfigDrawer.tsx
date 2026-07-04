/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { CoverConfig, PageSettings, UploadedFile } from '../types';
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
  X,
  Maximize2,
  Minimize2,
  Settings,
  Edit2,
  Check
} from 'lucide-react';

interface ConfigDrawerProps {
  isOpen: boolean;
  activeType: 'cover' | 'settings' | 'uploads' | null;
  onClose: () => void;
  cover: CoverConfig;
  setCover: React.Dispatch<React.SetStateAction<CoverConfig>>;
  settings: PageSettings;
  setSettings: React.Dispatch<React.SetStateAction<PageSettings>>;
  uploadedFiles: UploadedFile[];
  setUploadedFiles: React.Dispatch<React.SetStateAction<UploadedFile[]>>;
  onInsertHTML: (snippet: string) => void;
  isEmbedded?: boolean;
}

const DEFAULT_TABLE_CSS = `/* Academic Table Style */
table {
  width: 100%;
}
th {
  background-color: #004080;
  color: #ffffff;
}`;

function AutoGrowingTextArea({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
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
      className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded text-slate-200 font-mono text-xs focus:ring-1 focus:ring-orange-500 focus:outline-none overflow-y-hidden"
      placeholder={placeholder}
    />
  );
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
}: ConfigDrawerProps) {
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [showFormats, setShowFormats] = useState<boolean>(false);

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
  const [isHeaderFooterStyleOpen, setIsHeaderFooterStyleOpen] = useState<boolean>(false);
  const [isTOCStyleOpen, setIsTOCStyleOpen] = useState<boolean>(false);

  // File renaming states
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [editingFileName, setEditingFileName] = useState<string>('');

  const triggerSuccessMsg = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 2500);
  };

  const handleCopyAllCSS = () => {
    const blockStyleTitles = settings.blockStyleTitles || '';
    const blockStyleHeader = settings.blockStyleHeader || '';
    const blockStyleFooter = settings.blockStyleFooter || '';
    const blockStylePageNum = settings.blockStylePageNum || '';
    const blockStyleTOC = settings.blockStyleTOC || '';
    const tableCustomCss = settings.tableCustomCss || '';
    const customAddedCss = settings.customAddedCss || '';

    const combinedCss = [
      '/* === ESTILOS CSS COMPLETOS PARA EL DOCUMENTO === */',
      blockStyleTitles && `/* --- TIPOGRAFÍA Y ESTILOS DE TEXTO --- */\n${blockStyleTitles}`,
      blockStyleHeader && `/* --- ENCABEZADO (HEADER) --- */\n${blockStyleHeader}`,
      blockStyleFooter && `/* --- PIE DE PÁGINA (FOOTER) --- */\n${blockStyleFooter}`,
      blockStylePageNum && `/* --- NUMERACIÓN DE PÁGINAS --- */\n${blockStylePageNum}`,
      blockStyleTOC && `/* --- TABLA DE CONTENIDOS (TOC) --- */\n${blockStyleTOC}`,
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

  const handleCoverChange = (field: keyof CoverConfig, value: string) => {
    setCover((prev) => ({ ...prev, [field]: value }));
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
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        if (!dataUrl) return;
        const newFile: UploadedFile = {
          id: 'file_' + Date.now() + '_' + index + '_' + Math.random().toString(36).substring(2, 6),
          name: file.name,
          type: file.type,
          size: file.size,
          dataUrl: dataUrl,
          uploadedAt: new Date().toISOString(),
        };
        setUploadedFiles((prev) => [...prev, newFile]);
        successCount++;
        if (successCount === files.length) {
          triggerSuccessMsg(`${files.length} archivo(s) cargado(s) con éxito`);
        }
      };
      reader.readAsDataURL(file);
    });
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
    const nameWithoutExt = filename.split('.')[0] || 'imagen';
    const cleanId = nameWithoutExt.toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const figId = `fig-${cleanId || 'img'}-${Math.random().toString(36).substring(2, 6)}`;
    const figureSnippet = `![Descripción de la figura](${filename}){#${figId}}`;
    
    navigator.clipboard.writeText(figureSnippet).then(() => {
      triggerSuccessMsg('¡Formato de Figura copiado!');
    }).catch(() => {
      alert('Error de portapapeles.');
    });
  };

  const handleInsertImgTag = (filename: string) => {
    const nameWithoutExt = filename.split('.')[0] || 'imagen';
    const cleanId = nameWithoutExt.toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const figId = `fig-${cleanId || 'img'}-${Math.random().toString(36).substring(2, 6)}`;
    const figureSnippet = `\n![Descripción de la figura](${filename}){#${figId}}\n`;
    
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
        </div>
        <button 
          onClick={onClose}
          className="p-1 px-2.5 rounded bg-slate-850 hover:bg-[#004080] hover:border-[#FF6600] border border-slate-800 text-slate-200 text-[10px] font-bold tracking-wide transition-all flex items-center gap-1 cursor-pointer shrink-0"
          title="Regresar a la vista con la lista de editores de contenido"
        >
          <X className="w-3.5 h-3.5" />
          <span>Volver a Editores</span>
        </button>
      </div>

      {/* Body content scroll section */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar flex flex-col gap-5 text-slate-200">
        
        {/* TAB 1: COVERPORTADA CONTROLS */}
        {activeType === 'cover' && (
          <div className="flex flex-col gap-4 text-xs">
            <span className="font-bold uppercase tracking-wider text-slate-400 pb-1 border-b border-slate-800 flex items-center gap-1.5">
              <Image className="w-4 h-4 text-orange-500" />
              Imagen de Fondo de Portada
            </span>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">URL / Nombre de la Imagen de Fondo</label>
                {/* Switch checkbox */}
                <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={!!cover.applyBgImageToAllPages}
                    onChange={(e) => handleCoverChange('applyBgImageToAllPages', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-7 h-4 bg-slate-950 rounded-full peer peer-checked:bg-orange-600 relative transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-3 peer-checked:after:bg-slate-100" />
                  <span className="text-[10px] font-bold text-slate-350 uppercase tracking-wide hover:text-orange-400 transition-colors">En todas las hojas</span>
                </label>
              </div>
              <input
                type="text"
                value={cover.backgroundImage || ''}
                onChange={(e) => handleCoverChange('backgroundImage', e.target.value)}
                className="p-2 bg-slate-950 border border-slate-800 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 text-slate-200 font-mono text-xs"
                placeholder="Ej: /cover.png"
              />
              {cover.applyBgImageToAllPages && cover.backgroundImage && (
                <span className="text-[9.5px] text-orange-400/90 leading-normal bg-orange-950/20 p-1.5 rounded border border-orange-900/30">
                  💡 <strong>Información:</strong> La imagen de fondo se repetirá en todas las hojas. Se han ocultado automáticamente los encabezados y pies de página.
                </span>
              )}
            </div>

            {/* Custom html overlay */}
            <div className="flex flex-col gap-2 mt-2">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Editor HTML Overlay Portada</span>
              <AutoGrowingTextArea
                value={cover.overlayHtml || ''}
                onChange={(val) => handleCoverChange('overlayHtml', val)}
                placeholder="Escribe tu HTML para la capa de la portada (Overlay)..."
              />
            </div>

            {/* Plantilla academic banner code block mockup */}
            <div className="p-3 bg-slate-950/80 border border-slate-850 rounded flex flex-col gap-2">
              <div className="flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-orange-400 shrink-0" />
                <span className="text-[10px] font-bold text-slate-200 uppercase tracking-wider">🎓 Copiar Borrador de Portada Académica</span>
              </div>
              <p className="text-[9px] text-slate-400 leading-normal">
                Esta plantilla contiene la estructura académica requerida para las portadas formales. Cópiala al portapapeles y pégala en el editor de arriba de Portada.
              </p>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(`<style>
.cv-page {
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: var(--cover-padding-y, 7.5cqh) var(--cover-padding-x, 8cqw);
    font-family: 'Arial', sans-serif;
    color: #002E45;
}
.cv-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    text-align: center;
    width: 100%;
    height: 100%;
}
.cv-logo {
    max-height: 12cqh;
    object-fit: contain;
    margin-bottom: 2cqh;
}
.cv-header {
    font-size: 3cqw;
    font-weight: 800;
    line-height: 1.3;
    text-transform: uppercase;
    color: #004080;
    margin-bottom: 3cqh;
}
.cv-label {
    font-size: 2cqw;
    font-weight: 800;
    color: #FF6600;
    margin-top: 1.5cqh;
    text-transform: uppercase;
    letter-spacing: 0.05em;
}
.cv-value {
    font-size: 2.2cqw;
    font-weight: 600;
    margin-top: 0.2cqh;
    line-height: 1.3;
}
.cv-list {
    line-height: 1.4;
}
.cv-footer {
    font-size: 2cqw;
    font-weight: 800;
    margin-top: auto;
    letter-spacing: 0.1em;
    color: #004080;
}
</style>

<div class="cv-page">
    <div class="cv-content">
        <img src="icon.png" class="cv-logo" onError="this.src='https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=120'; this.onerror=null;" referrerpolicy="no-referrer">
        
        <div class="cv-header">
            FACULTAD DE CIENCIAS E INGENIERÍA<br>
            CARRERA DE INGENIERÍA DE SOFTWARE
        </div>

        <div>
            <div class="cv-label">TEMA:</div>
            <div class="cv-value">Análisis del Impacto del Aprendizaje Autónomo en Estudiantes Universitarios</div>
        </div>

        <div>
            <div class="cv-label">AUTORES:</div>
            <div class="cv-value cv-list">
                Joel Agustín Párraga<br>
                Wilmer Sandro Patiño Cuastuza
            </div>
        </div>

        <div>
            <div class="cv-label">ASIGNATURA:</div>
            <div class="cv-value">Metodología y Técnicas de la Investigación</div>
        </div>

        <div>
            <div class="cv-label">DOCENTE:</div>
            <div class="cv-value font-bold">Mtr. Mendoza Cabrera</div>
        </div>

        <div class="cv-footer">
            MILAGRO - ECUADOR<br>
            <span style="color: #FF6600; font-size: 0.8em;">JUNIO, 2026</span>
        </div>
    </div>
</div>`);
                  triggerSuccessMsg('¡Plantilla Copiada!');
                }}
                className="w-full py-1.5 px-3 rounded bg-slate-800 hover:bg-slate-700 hover:text-white transition-all text-[11px] font-bold text-orange-400 cursor-pointer text-center"
              >
                Copiar Plantilla Académica
              </button>
            </div>

            {/* Plantilla de Marco de Márgenes SVG */}
            <div className="p-3 bg-slate-950/80 border border-slate-850 rounded flex flex-col gap-2">
              <div className="flex items-center gap-1.5">
                <FileCode className="w-4 h-4 text-orange-400 shrink-0" />
                <span className="text-[10px] font-bold text-slate-200 uppercase tracking-wider">📐 Plantilla de Marco de Márgenes SVG</span>
              </div>
              <p className="text-[9px] text-slate-400 leading-normal">
                Esta plantilla genera un marco vectorial decorativo con doble borde institucional (azul estricto y naranja punteado) y esquinas ornamentales. Copia y pégalo al inicio de tu Overlay en Portada.
              </p>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(`<div style="position: absolute; inset: 0; pointer-events: none; width: 100%; height: 100%; box-sizing: border-box; padding: 20px; z-index: 1;">
  <svg width="100%" height="100%" viewBox="0 0 816 1056" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: block; width: 100%; height: 100%;">
    <!-- Borde Principal Institucional Azul -->
    <rect x="15" y="15" width="786" height="1026" stroke="#004080" stroke-width="3" rx="4"/>
    <!-- Borde Interno Naranja Punteado Académico -->
    <rect x="22" y="22" width="772" height="1012" stroke="#FF6600" stroke-width="1.5" rx="2" stroke-dasharray="6 3"/>
    
    <!-- Esquineras de Esquinas de Refuerzo Visual (Top Left, Top Right, Bottom Left, Bottom Right) -->
    <path d="M 12 40 L 12 12 L 40 12" stroke="#004080" stroke-width="5" fill="none"/>
    <path d="M 804 40 L 804 12 L 776 12" stroke="#004080" stroke-width="5" fill="none"/>
    <path d="M 12 1016 L 12 1044 L 40 1044" stroke="#004080" stroke-width="5" fill="none"/>
    <path d="M 804 1016 L 804 1044 L 776 1044" stroke="#004080" stroke-width="5" fill="none"/>
  </svg>
</div>`);
                  triggerSuccessMsg('¡Marco SVG Copiado!');
                }}
                className="w-full py-1.5 px-3 rounded bg-slate-800 hover:bg-slate-700 hover:text-white transition-all text-[11px] font-bold text-orange-400 cursor-pointer text-center"
              >
                Copiar Marco SVG (Márgenes)
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: PAGE DESIGN AND STYLING STUFF */}
        {activeType === 'settings' && (
          <div className="flex flex-col gap-4 text-xs">
            <span className="font-bold uppercase tracking-wider text-slate-400 pb-1 border-b border-slate-800 flex items-center gap-1.5">
              <Layout className="w-4 h-4 text-orange-500" />
              Ajustes Físicos de Hoja
            </span>

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
                          value={settings.marginTop !== undefined ? settings.marginTop : 96}
                          onChange={(e) => handleSettingsChange('marginTop', parseInt(e.target.value) || 0)}
                          className="w-full p-1.5 bg-slate-950 border border-slate-800 rounded text-slate-200"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Inferior (Bottom)</label>
                        <input
                          type="number"
                          value={settings.marginBottom !== undefined ? settings.marginBottom : 96}
                          onChange={(e) => handleSettingsChange('marginBottom', parseInt(e.target.value) || 0)}
                          className="w-full p-1.5 bg-slate-950 border border-slate-800 rounded text-slate-200"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Izquierdo (Left)</label>
                        <input
                          type="number"
                          value={settings.marginLeft !== undefined ? settings.marginLeft : 96}
                          onChange={(e) => handleSettingsChange('marginLeft', parseInt(e.target.value) || 0)}
                          className="w-full p-1.5 bg-slate-950 border border-slate-800 rounded text-slate-200"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Derecho (Right)</label>
                        <input
                          type="number"
                          value={settings.marginRight !== undefined ? settings.marginRight : 96}
                          onChange={(e) => handleSettingsChange('marginRight', parseInt(e.target.value) || 0)}
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

                    {/* Headings autonumbering toggle */}
                    <div className="flex items-center justify-between p-2 bg-slate-950 rounded border border-slate-800 mt-1">
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

              {/* Academic headers and footers */}
              <div className="border border-slate-800 rounded bg-slate-950/25 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setIsHeaderFooterStyleOpen(!isHeaderFooterStyleOpen)}
                  className="w-full p-2.5 bg-slate-950 hover:bg-slate-900/80 flex justify-between items-center text-left transition-all"
                >
                  <span className="font-extrabold uppercase text-[10px] tracking-wider text-slate-350">
                    📝 Encabezados & Pie de Página
                  </span>
                  <span>{isHeaderFooterStyleOpen ? '▲' : '▼'}</span>
                </button>
                {isHeaderFooterStyleOpen && (
                  <div className="p-3 border-t border-slate-850 bg-slate-900/10 flex flex-col gap-3.5">
                    
                    {/* Header HTML Editor */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider flex items-center justify-between">
                        <span>Contenido HTML de Encabezado (Header)</span>
                        <span className="text-[7.5px] text-slate-500 font-mono normal-case">Soporta HTML, &#123;page&#125;</span>
                      </label>
                      <textarea
                        value={settings.headerHtml !== undefined ? settings.headerHtml : ''}
                        onChange={(e) => handleSettingsChange('headerHtml', e.target.value)}
                        rows={10}
                        className="w-full p-2 bg-slate-950 border border-slate-800 rounded text-slate-200 font-mono text-[10px] leading-relaxed focus:border-[#FF6600]/80 focus:outline-none"
                        placeholder="Ej: <div class='flex justify-between'>...</div>"
                      />
                    </div>

                    {/* Footer HTML Editor */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider flex items-center justify-between">
                        <span>Contenido HTML de Pie de Página (Footer)</span>
                        <span className="text-[7.5px] text-slate-500 font-mono normal-case">Soporta HTML, &#123;page&#125;, &#123;total&#125;</span>
                      </label>
                      <textarea
                        value={settings.footerHtml !== undefined ? settings.footerHtml : ''}
                        onChange={(e) => handleSettingsChange('footerHtml', e.target.value)}
                        rows={10}
                        className="w-full p-2 bg-slate-950 border border-slate-800 rounded text-slate-200 font-mono text-[10px] leading-relaxed focus:border-[#FF6600]/80 focus:outline-none"
                        placeholder="Ej: <div class='footer'>...</div>"
                      />
                      <p className="text-[8px] text-slate-500 leading-normal">
                        * Si borras todo el contenido de este editor, el pie de página de las hojas quedará completamente vacío.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Table of Contents (TOC) style */}
              <div className="border border-slate-800 rounded bg-slate-950/25 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setIsTOCStyleOpen(!isTOCStyleOpen)}
                  className="w-full p-2.5 bg-slate-950 hover:bg-slate-900/80 flex justify-between items-center text-left transition-all"
                >
                  <span className="font-extrabold uppercase text-[10px] tracking-wider text-slate-350">
                    📋 Tabla de Contenidos (TOC)
                  </span>
                  <span>{isTOCStyleOpen ? '▲' : '▼'}</span>
                </button>
                {isTOCStyleOpen && (
                  <div className="p-3 border-t border-slate-850 bg-slate-900/10 flex flex-col gap-3.5">
                    {/* Table of contents indices toggle */}
                    <div className="flex flex-col gap-1 p-2 bg-slate-950 rounded border border-slate-800">
                      <div className="flex items-center justify-between">
                        <span className="text-[9.5px] font-bold text-slate-350 uppercase">Índice Tabla de Contenidos (TOC)</span>
                        <button
                          onClick={() => handleSettingsChange('showTOC', !settings.showTOC)}
                          className={`text-xs px-2.5 py-1 rounded border font-bold transition-all cursor-pointer ${
                            settings.showTOC 
                              ? 'bg-[#004080] border-[#FF6600] text-white' 
                              : 'bg-slate-900 border-slate-800 text-slate-500'
                          }`}
                        >
                          {settings.showTOC ? 'MOSTRAR ÍNDICE' : 'OCULTAR ÍNDICE'}
                        </button>
                      </div>
                      {settings.showTOC && (
                        <div className="flex flex-col gap-1 mt-2 border-t border-slate-900 pt-2">
                          <label className="text-[8px] text-slate-400 font-bold uppercase">Título del Índice</label>
                          <input
                            type="text"
                            value={settings.tocTitle || 'Tabla de Contenidos'}
                            onChange={(e) => handleSettingsChange('tocTitle', e.target.value)}
                            className="p-1 bg-slate-900 border border-slate-850 rounded text-slate-200 text-xs focus:ring-1 focus:ring-orange-500 focus:outline-none"
                          />
                        </div>
                      )}
                    </div>

                    {/* CSS Editor for blockStyleTOC */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[9.5px] text-slate-400 font-bold uppercase tracking-wider flex items-center justify-between">
                        <span>Editor CSS del Índice (TOC)</span>
                        <span className="text-[7.5px] text-slate-500 font-mono normal-case">Estilos APA 7 activos</span>
                      </label>
                      <textarea
                        value={settings.blockStyleTOC || ''}
                        onChange={(e) => handleSettingsChange('blockStyleTOC', e.target.value)}
                        rows={10}
                        className="w-full p-2 bg-slate-950 border border-slate-800 rounded text-slate-200 font-mono text-[10px] leading-relaxed focus:border-[#FF6600]/80 focus:outline-none"
                        placeholder="/* Estilos CSS para el TOC de la hoja */"
                      />
                    </div>
                  </div>
                )}
              </div>





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
                <span className="font-bold text-slate-350 text-[11px]">Subir uno o varios archivos</span>
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
                <span>Archivos Guardados ({uploadedFiles.length})</span>
                {uploadedFiles.length > 0 && (
                  <button
                    onClick={() => {
                      if (confirm("¿Está seguro de eliminar TODOS los archivos guardados hoy?")) {
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
                  No hay archivos locales agregados. Use el cuadro superior para cargar su primer recurso.
                </div>
              ) : (
                <div className="flex flex-col gap-2 max-h-[380px] overflow-y-auto custom-scrollbar pr-0.5 select-text">
                  {uploadedFiles.map((item) => {
                    const isEditing = editingFileId === item.id;
                    return (
                      <div 
                        key={item.id}
                        className="p-2 border border-slate-850 bg-slate-950/40 rounded flex items-center gap-2.5 hover:border-slate-800 transition-all text-xs"
                      >
                        {/* Thumbnail */}
                        <div className="w-10 h-10 rounded bg-slate-900 border border-slate-800 shrink-0 overflow-hidden flex items-center justify-center">
                          <img 
                            src={item.dataUrl} 
                            alt={item.name} 
                            className="max-w-full max-h-full object-contain"
                            referrerPolicy="no-referrer"
                          />
                        </div>

                        {/* File Details / Rename Input */}
                        {isEditing ? (
                          <div className="flex-1 min-w-0 flex items-center gap-1">
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
                          <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                            <div className="flex items-center gap-1 group/item">
                              <span className="font-bold text-[11px] text-slate-300 truncate" title={item.name}>
                                {item.name}
                              </span>
                              <button
                                onClick={() => {
                                  setEditingFileId(item.id);
                                  setEditingFileName(item.name);
                                }}
                                className="p-0.5 rounded text-slate-500 hover:text-orange-400 hover:bg-slate-950/40 opacity-40 group-hover/item:opacity-100 transition-all cursor-pointer shrink-0"
                                title="Renombrar archivo"
                              >
                                <Edit2 className="w-2.5 h-2.5" />
                              </button>
                            </div>
                            <div className="flex items-center gap-1.5 text-[9.5px] text-slate-500 font-mono">
                              <span>{(item.size / 1024).toFixed(1)} KB</span>
                            </div>
                          </div>
                        )}

                        {/* Quick actions buttons (disabled in editing mode) */}
                        {!isEditing && (
                          <div className="flex gap-1 shrink-0">
                            <button
                              onClick={() => handleCopySnippet(item.name)}
                              className="p-1 px-1.5 rounded bg-slate-950 hover:bg-[#004080] border border-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer"
                              title="Copiar etiqueta HTML del recurso"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleInsertImgTag(item.name)}
                              className="p-1 px-1.5 rounded bg-slate-950 hover:bg-[#004080] border border-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer text-xs font-bold"
                              title="Insertar en último editor con foco"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleDeleteFile(item.id)}
                              className="p-1 px-1.5 rounded bg-slate-950 hover:bg-red-950/80 hover:border-red-500 border border-slate-800 text-slate-400 hover:text-red-400 transition-all cursor-pointer"
                              title="Borrar archivo"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Instruction helper */}
            <div className="p-3 bg-slate-950 border border-slate-850 rounded text-slate-400 flex flex-col gap-1.5 text-[10.5px]">
              <span className="font-bold text-slate-300 uppercase text-[9.5px] tracking-wider">💡 Tip rápido de Imágenes:</span>
              <ul className="list-disc pl-4 space-y-1 text-slate-400 leading-normal">
                <li>Haz clic en <span className="font-bold text-orange-400">Insertar (+)</span> para inyectar la etiqueta del recurso directo en el último editor de código que estuviste editando.</li>
                <li>Si prefieres, copia el HTML y pégalo manualmente en cualquier sección de tus editores.</li>
              </ul>
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
    </div>
  );
}
