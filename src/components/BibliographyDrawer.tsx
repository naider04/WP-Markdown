/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { parseBibtex } from '../utils/bibParser';
import { formatAPAAuthorList } from '../utils/apaFormatter';
import {
  BookOpen,
  Copy,
  Plus,
  X,
  Check,
  Info,
  Code,
  FileText
} from 'lucide-react';

interface BibliographyDrawerProps {
  bibtex: string;
  setBibtex: (bibtex: string) => void;
  onClose: () => void;
  onInsertHTML: (snippet: string) => void;
  showBibliography: boolean;
  onToggleShowBibliography: (show: boolean) => void;
  bibliographyTitle: string;
  onChangeBibliographyTitle: (title: string) => void;
}

export function BibliographyDrawer({
  bibtex,
  setBibtex,
  onClose,
  onInsertHTML,
  showBibliography,
  onToggleShowBibliography,
  bibliographyTitle,
  onChangeBibliographyTitle
}: BibliographyDrawerProps) {
  const [successMsg, setSuccessMsg] = useState('');

  const triggerSuccessMsg = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 2500);
  };

  // Real-time parsed bibliography items to list keys
  const parsedItems = useMemo(() => {
    return parseBibtex(bibtex);
  }, [bibtex]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    triggerSuccessMsg(`Copiado: ${text}`);
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100 select-none">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950 shrink-0">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-orange-500" />
          <span className="font-extrabold text-[12px] uppercase tracking-wider text-slate-200">
            Bibliografía
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-slate-800 rounded transition-all text-slate-400 hover:text-slate-200 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main content scrollable container */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 custom-scrollbar">
        {/* Quick info alert */}
        <div className="p-3 bg-slate-950/60 border border-slate-800 rounded flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <Info className="w-4 h-4 text-[#004080] shrink-0" />
            <span className="text-[10px] font-bold text-slate-200 uppercase tracking-wider">
              Soporte de Archivos .bib
            </span>
          </div>
          <p className="text-[9.5px] text-slate-400 leading-relaxed">
            Escribe o pega tus referencias en formato estándar BibTeX. El sistema las compilará dinámicamente y generará las citas APA de forma automática.
          </p>
        </div>

        {/* Global toggles */}
        <div className="p-3 bg-slate-950/40 border border-slate-850 rounded flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">
                Mostrar Hoja de Bibliografía
              </span>
              <span className="text-[8.5px] text-slate-500">
                Añade una hoja final con tus referencias
              </span>
            </div>
            <button
              onClick={() => onToggleShowBibliography(!showBibliography)}
              className={`text-xs px-2.5 py-1 rounded border font-bold transition-all cursor-pointer ${
                showBibliography
                  ? 'bg-[#004080] border-[#FF6600] text-white'
                  : 'bg-slate-900 border-slate-800 text-slate-500'
              }`}
            >
              {showBibliography ? 'SÍ (PÁGINA FINAL)' : 'NO'}
            </button>
          </div>

          {showBibliography && (
            <div className="flex flex-col gap-1 border-t border-slate-900 pt-2.5">
              <label className="text-[8.5px] text-slate-400 font-bold uppercase">
                Título de la Sección de Referencias
              </label>
              <input
                type="text"
                value={bibliographyTitle}
                onChange={(e) => onChangeBibliographyTitle(e.target.value)}
                className="p-1.5 bg-slate-950 border border-slate-800 rounded text-slate-200 text-xs focus:border-[#FF6600] focus:outline-none"
                placeholder="Ej: Referencias Bibliográficas"
              />
            </div>
          )}
        </div>

        {/* BibTeX Editor */}
        <div className="flex flex-col gap-1.5 flex-1 min-h-[300px]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Code className="w-3.5 h-3.5 text-orange-400" />
              Código BibTeX (.bib)
            </span>
            {successMsg && (
              <span className="text-[9px] font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-900/30 px-2 py-0.5 rounded flex items-center gap-1 animate-fade-in">
                <Check className="w-3 h-3" /> {successMsg}
              </span>
            )}
          </div>
          
          <textarea
            value={bibtex}
            onChange={(e) => setBibtex(e.target.value)}
            className="flex-1 w-full p-2.5 bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-[#FF6600]/80 focus:outline-none rounded-lg text-slate-200 font-mono text-[10.5px] leading-relaxed resize-none custom-scrollbar"
            placeholder={`@book{ejemplo2026,
  author    = {Gómez, J. and Pérez, M.},
  year      = {2026},
  title     = {Investigación Científica en Ingeniería},
  publisher = {Editorial Académica}
}`}
          />
        </div>

        {/* Parsed items explorer */}
        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Referencias Detectadas ({parsedItems.length})
          </span>

          <div className="flex flex-col gap-2 max-h-[250px] overflow-y-auto custom-scrollbar pr-0.5">
            {parsedItems.map((item) => (
              <div
                key={item.id}
                className="p-2.5 bg-slate-950/50 hover:bg-slate-950 border border-slate-850 hover:border-slate-800 rounded flex flex-col gap-1 transition-all group"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[9px] text-orange-400 font-bold truncate">
                    @{item.key}
                  </span>
                  <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => onInsertHTML(`[@${item.key}]`)}
                      className="py-0.5 px-1.5 rounded bg-slate-800 hover:bg-orange-600 hover:text-white transition-all text-[8px] font-black text-slate-300 cursor-pointer flex items-center gap-0.5"
                      title="Insertar cita [@key] en el editor HTML activo"
                    >
                      <Plus className="w-2.5 h-2.5" />
                      Insertar
                    </button>
                    <button
                      onClick={() => copyToClipboard(`[@${item.key}]`)}
                      className="p-0.5 rounded bg-slate-850 hover:bg-slate-750 text-slate-300 hover:text-white cursor-pointer"
                      title="Copiar llave de cita"
                    >
                      <Copy className="w-2.5 h-2.5" />
                    </button>
                  </div>
                </div>

                <div className="text-[9.5px] text-slate-400 leading-normal select-text pr-1.5">
                  <span className="text-slate-300">{formatAPAAuthorList(item.authors)} ({item.year}).</span>{' '}
                  <span className="italic">{item.title}</span>.
                  {item.publisher && ` ${item.publisher}.`}
                  {item.journal && ` ${item.journal}.`}
                </div>
              </div>
            ))}

            {parsedItems.length === 0 && (
              <div className="py-6 px-3 bg-slate-950/20 border border-slate-850 border-dashed rounded text-center text-slate-500 text-[10px] flex flex-col gap-1 items-center justify-center">
                <FileText className="w-5 h-5 text-slate-650 shrink-0" />
                <span>Ninguna referencia válida encontrada</span>
                <span className="text-[8.5px] text-slate-600">
                  Escribe un formato @book, @article, o @web para habilitar citas automáticas.
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
