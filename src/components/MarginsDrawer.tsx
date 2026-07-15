/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { PageSettings, MarginElement } from '../types';
import {
  X,
  Layout,
  Trash2,
  Plus,
  Code,
  Layers,
  ChevronDown,
  ChevronUp,
  Info,
  HelpCircle
} from 'lucide-react';

interface MarginsDrawerProps {
  settings: PageSettings;
  setSettings: React.Dispatch<React.SetStateAction<PageSettings>>;
  onClose: () => void;
}

export function MarginsDrawer({
  settings,
  setSettings,
  onClose
}: MarginsDrawerProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const elements = settings.marginElements || [];

  const handleAddElement = () => {
    const nextNum = elements.length + 1;
    const newId = 'margin_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    const newElement: MarginElement = {
      id: newId,
      name: `Elemento de Margen ${nextNum}`,
      code: `<div style="font-family: sans-serif; font-size: 11px; font-weight: bold; color: #ffffff; background-color: #004080; border: 1.5px solid #FF6600; padding: 6px 12px; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.15); text-align: center;">\n  Elemento fuera de margen\n</div>`,
      top: '20px',
      right: '20px',
      bottom: '',
      left: '',
      width: '180px',
      height: 'auto',
      pagesPattern: '!first()'
    };

    setSettings((prev) => ({
      ...prev,
      marginElements: [...(prev.marginElements || []), newElement]
    }));
    setExpandedId(newId);
  };

  const handleUpdateElement = (id: string, field: keyof MarginElement, value: string) => {
    setSettings((prev) => ({
      ...prev,
      marginElements: (prev.marginElements || []).map((el) =>
        el.id === id ? { ...el, [field]: value } : el
      )
    }));
  };

  const handleDeleteElement = (id: string) => {
    setSettings((prev) => ({
      ...prev,
      marginElements: (prev.marginElements || []).filter((el) => el.id !== id)
    }));
  };

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100 select-none animate-fade-in">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950 shrink-0">
        <div className="flex items-center gap-2">
          <Layout className="w-4 h-4 text-orange-500" />
          <span className="font-extrabold text-[12px] uppercase tracking-wider text-slate-200">
            Elementos del Margen
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-slate-800 rounded transition-all text-slate-400 hover:text-slate-200 cursor-pointer"
          title="Cerrar panel de Elementos del Margen"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 custom-scrollbar">
        {/* Info panel */}
        <div className="p-3 bg-slate-950/60 border border-slate-850 rounded flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <Info className="w-4 h-4 text-[#004080] shrink-0" />
            <span className="text-[10px] font-bold text-slate-200 uppercase tracking-wider">
              Edición Libre en Hoja
            </span>
          </div>
          <p className="text-[9.5px] text-slate-400 leading-normal">
            Esta sección permite añadir componentes HTML que <strong>ignoran los márgenes de la página</strong>. Son ideales para marcas de agua, logotipos laterales, cintillos personalizados, fondos de portada o notas al pie personalizadas.
          </p>
        </div>

        {/* Action Bar */}
        <div className="flex items-center justify-between pb-1 border-b border-slate-800">
          <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">
            Elementos del Margen ({elements.length})
          </span>
          <button
            onClick={handleAddElement}
            className="px-2.5 py-1 text-[10px] font-bold bg-[#004080] text-white border border-[#FF6600]/80 rounded hover:bg-[#003060] transition-all flex items-center gap-1 active:scale-95 cursor-pointer shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            Añadir Elemento
          </button>
        </div>

        {/* Editors List */}
        <div className="flex flex-col gap-3.5">
          {elements.length === 0 ? (
            <div className="p-8 border-2 border-dashed border-slate-800 rounded bg-slate-950/20 text-center flex flex-col items-center gap-2">
              <Layers className="w-8 h-8 text-slate-700" />
              <span className="text-slate-400 text-xs font-bold">No hay elementos de margen</span>
              <p className="text-slate-500 text-[10px] max-w-[200px] leading-relaxed">
                Haz clic en "Añadir Elemento" para crear tu primer elemento flotante.
              </p>
            </div>
          ) : (
            elements.map((el, index) => {
              const isExpanded = expandedId === el.id;

              return (
                <div
                  key={el.id}
                  className={`border rounded-lg bg-slate-950/60 overflow-hidden transition-all duration-150 ${
                    isExpanded ? 'border-orange-500 shadow-lg' : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {/* Collapsible header */}
                  <div
                    className="p-3 bg-slate-950 flex justify-between items-center gap-2 cursor-pointer select-none"
                    onClick={() => toggleExpand(el.id)}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <Code className="w-4 h-4 text-orange-500 shrink-0" />
                      <input
                        type="text"
                        value={el.name}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => handleUpdateElement(el.id, 'name', e.target.value)}
                        className="bg-transparent border-b border-transparent hover:border-slate-700 focus:border-orange-500 text-[11px] font-bold text-slate-200 focus:outline-none focus:ring-0 py-0.5 px-1 rounded-sm w-full truncate"
                        title="Haz clic para renombrar"
                      />
                    </div>
                    
                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleDeleteElement(el.id)}
                        className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-slate-900 transition-all cursor-pointer"
                        title="Eliminar elemento"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => toggleExpand(el.id)}
                        className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-900 transition-all cursor-pointer"
                        title={isExpanded ? 'Colapsar' : 'Expandir'}
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Body (only visible when expanded) */}
                  {isExpanded && (
                    <div className="p-3.5 border-t border-slate-900 bg-slate-900/40 flex flex-col gap-3.5 select-text">
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-stretch">
                        
                        {/* HTML code textarea - spans left */}
                        <div className="md:col-span-7 flex flex-col gap-1.5 h-full">
                          <label className="text-[9.5px] text-slate-400 font-bold uppercase tracking-wider block">
                            Código HTML / CSS
                          </label>
                          <textarea
                            value={el.code}
                            onChange={(e) => handleUpdateElement(el.id, 'code', e.target.value)}
                            className="flex-1 w-full p-2.5 bg-slate-950 border border-slate-850 focus:border-orange-500 rounded text-green-400 font-mono text-xs focus:outline-none focus:ring-0 leading-relaxed custom-scrollbar min-h-[300px]"
                            placeholder="<div>Código HTML del elemento...</div>"
                          />
                        </div>

                        {/* Positioning / dimensions / pages panel - spans right */}
                        <div className="md:col-span-5 flex flex-col justify-between gap-3 bg-slate-950/70 p-3 rounded-md border border-slate-850">
                          
                          {/* Top/Right/Bottom/Left positional inputs */}
                          <div>
                            <span className="text-[9.5px] text-slate-350 font-bold uppercase tracking-wider block mb-1.5">
                              Posición en Hoja
                            </span>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[8.5px] text-slate-500 font-bold uppercase">Arriba</label>
                                <input
                                  type="text"
                                  value={el.top || ''}
                                  onChange={(e) => handleUpdateElement(el.id, 'top', e.target.value)}
                                  className="w-full p-1.5 bg-slate-900 border border-slate-800 rounded text-slate-200 text-xs font-mono focus:border-orange-500 focus:outline-none"
                                  placeholder="ej. 20px"
                                />
                              </div>
                              <div>
                                <label className="text-[8.5px] text-slate-500 font-bold uppercase">Derecha</label>
                                <input
                                  type="text"
                                  value={el.right || ''}
                                  onChange={(e) => handleUpdateElement(el.id, 'right', e.target.value)}
                                  className="w-full p-1.5 bg-slate-900 border border-slate-800 rounded text-slate-200 text-xs font-mono focus:border-orange-500 focus:outline-none"
                                  placeholder="ej. 20px"
                                />
                              </div>
                              <div>
                                <label className="text-[8.5px] text-slate-500 font-bold uppercase">Abajo</label>
                                <input
                                  type="text"
                                  value={el.bottom || ''}
                                  onChange={(e) => handleUpdateElement(el.id, 'bottom', e.target.value)}
                                  className="w-full p-1.5 bg-slate-900 border border-slate-800 rounded text-slate-200 text-xs font-mono focus:border-orange-500 focus:outline-none"
                                  placeholder="ej. 0"
                                />
                              </div>
                              <div>
                                <label className="text-[8.5px] text-slate-500 font-bold uppercase">Izquierda</label>
                                <input
                                  type="text"
                                  value={el.left || ''}
                                  onChange={(e) => handleUpdateElement(el.id, 'left', e.target.value)}
                                  className="w-full p-1.5 bg-slate-900 border border-slate-800 rounded text-slate-200 text-xs font-mono focus:border-orange-500 focus:outline-none"
                                  placeholder="ej. 10px"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Width / Height inputs */}
                          <div>
                            <span className="text-[9.5px] text-slate-350 font-bold uppercase tracking-wider block mb-1.5">
                              Dimensiones
                            </span>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[8.5px] text-slate-500 font-bold uppercase font-sans">Ancho</label>
                                <input
                                  type="text"
                                  value={el.width || ''}
                                  onChange={(e) => handleUpdateElement(el.id, 'width', e.target.value)}
                                  className="w-full p-1.5 bg-slate-900 border border-slate-800 rounded text-slate-200 text-xs font-mono focus:border-orange-500 focus:outline-none"
                                  placeholder="ej. 100% o 180px"
                                />
                              </div>
                              <div>
                                <label className="text-[8.5px] text-slate-500 font-bold uppercase font-sans">Alto</label>
                                <input
                                  type="text"
                                  value={el.height || ''}
                                  onChange={(e) => handleUpdateElement(el.id, 'height', e.target.value)}
                                  className="w-full p-1.5 bg-slate-900 border border-slate-800 rounded text-slate-200 text-xs font-mono focus:border-orange-500 focus:outline-none"
                                  placeholder="ej. auto o 120px"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Pages patterns input placed within the same right-hand panel */}
                          <div className="pt-2 border-t border-slate-800">
                            <label className="text-[9.5px] text-slate-350 font-bold uppercase tracking-wider block mb-1">
                              Páginas
                            </label>
                            {settings.pageSize === 'continuous' ? (
                              <div className="text-[10px] text-slate-400 italic bg-slate-950 p-2 rounded border border-slate-850">
                                Deshabilitado en Tira Continua (se aplica a la única página)
                              </div>
                            ) : (
                              <input
                                type="text"
                                value={el.pagesPattern}
                                onChange={(e) => handleUpdateElement(el.id, 'pagesPattern', e.target.value)}
                                className="w-full p-1.5 bg-slate-900 border border-slate-800 rounded text-orange-400 text-xs font-mono font-bold focus:border-orange-500 focus:outline-none"
                                placeholder="ej. !first()"
                              />
                            )}
                          </div>

                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Unified Selector Syntax Help Section, rendered once BELOW all editors */}
        <div className="mt-4 p-4 bg-slate-950 border border-slate-850 rounded-lg flex flex-col gap-3 select-text">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-850">
            <HelpCircle className="w-4 h-4 text-orange-500 shrink-0" />
            <span className="text-[11px] font-extrabold text-slate-200 uppercase tracking-widest">
              Selector Syntax
            </span>
          </div>

          <div className="text-[10px] text-slate-300 space-y-3 leading-relaxed font-sans">
            <p>
              Selectors define which elements an operation applies to. Every selector returns a <strong className="text-slate-100 font-semibold">set of elements</strong>, and selectors can be chained to progressively filter that set.
            </p>

          <details className="group border border-slate-800 rounded bg-slate-900/40 overflow-hidden">
            <summary className="list-none flex items-center justify-between p-2.5 cursor-pointer hover:bg-slate-800/40 select-none transition-colors">
              <span className="text-[10.5px] font-extrabold text-slate-200 uppercase tracking-widest">
                Ver Ejemplos de Sintaxis
              </span>
              <span className="text-slate-400 group-open:rotate-180 transition-transform duration-200 text-xs">
                ▼
              </span>
            </summary>
            
            <div className="p-3 border-t border-slate-850 space-y-4 text-[10px] text-slate-300 leading-relaxed font-sans max-h-[350px] overflow-y-auto custom-scrollbar">
              <p>
                La sintaxis permite seleccionar páginas de forma dinámica usando conjuntos, filtros, rangos y uniones (con comas):
              </p>

              <div>
                <span className="font-bold text-slate-200 text-[10px] block mb-1 uppercase tracking-wider text-orange-400">Casos Básicos y Selectores</span>
                <div className="bg-slate-950/80 p-2 rounded border border-slate-850 font-mono text-[9px] text-slate-300 space-y-1.5 leading-normal">
                  <div><span className="text-blue-400 font-bold">all</span><span className="text-slate-500"> → 1, 2, 3, ..., n</span></div>
                  <div><span className="text-blue-400 font-bold">*</span><span className="text-slate-500"> → 1, 2, 3, ..., n</span></div>
                  <div><span className="text-blue-400 font-bold">first</span><span className="text-slate-500"> → 1</span></div>
                  <div><span className="text-blue-400 font-bold">first(3)</span><span className="text-slate-500"> → 1, 2, 3</span></div>
                  <div><span className="text-blue-400 font-bold">last</span><span className="text-slate-500"> → n</span></div>
                  <div><span className="text-blue-400 font-bold">last(3)</span><span className="text-slate-500"> → n-2, n-1, n</span></div>
                  <div><span className="text-blue-400 font-bold">even</span><span className="text-slate-500"> → 2, 4, 6, 8, ..., n</span></div>
                  <div><span className="text-blue-400 font-bold">odd</span><span className="text-slate-500"> → 1, 3, 5, 7, ..., n</span></div>
                  <div><span className="text-blue-400 font-bold">every(3)</span><span className="text-slate-500"> → 1, 4, 7, 10, ...</span></div>
                </div>
              </div>

              <div>
                <span className="font-bold text-slate-200 text-[10px] block mb-1 uppercase tracking-wider text-orange-400">Rangos y Uniones</span>
                <div className="bg-slate-950/80 p-2 rounded border border-slate-850 font-mono text-[9px] text-slate-300 space-y-1.5 leading-normal">
                  <div><span className="text-blue-400 font-bold">3..8</span><span className="text-slate-500"> → 3, 4, 5, 6, 7, 8</span></div>
                  <div><span className="text-blue-400 font-bold">4,7,10</span><span className="text-slate-500"> → 4, 7, 10</span></div>
                  <div><span className="text-blue-400 font-bold">3,5,8,20..40</span><span className="text-slate-500"> → 3, 5, 8, 20..40</span></div>
                </div>
              </div>

              <div>
                <span className="font-bold text-slate-200 text-[10px] block mb-1 uppercase tracking-wider text-orange-400">Filtrado y Composición (.)</span>
                <div className="bg-slate-950/80 p-2 rounded border border-slate-850 font-mono text-[9px] text-slate-300 space-y-1.5 leading-normal">
                  <div><span className="text-blue-400 font-bold">3..20.even</span><span className="text-slate-500"> → 4, 6, 8, ..., 20</span></div>
                  <div><span className="text-blue-400 font-bold">3..20.odd</span><span className="text-slate-500"> → 3, 5, 7, ..., 19</span></div>
                  <div><span className="text-blue-400 font-bold">all.even</span><span className="text-slate-500"> → 2, 4, 6, 8, ..., n</span></div>
                  <div><span className="text-blue-400 font-bold">all.last(3)</span><span className="text-slate-500"> → n-2, n-1, n</span></div>
                </div>
              </div>

              <div>
                <span className="font-bold text-slate-200 text-[10px] block mb-1 uppercase tracking-wider text-orange-400">Relative indexing: every(n)</span>
                <p className="text-[9px] text-slate-400 mb-1 leading-normal">
                  A diferencia de <code className="text-blue-400">even</code> y <code className="text-blue-400">odd</code> que usan los índices originales, <code className="text-blue-400">every(n)</code> evalúa las posiciones del conjunto actual:
                </p>
                <div className="bg-slate-950/80 p-2 rounded border border-slate-850 font-mono text-[9px] text-slate-300 space-y-1.5 leading-normal">
                  <div><span className="text-blue-400 font-bold">3..20.every(3)</span><span className="text-slate-500"> → 3, 6, 9, 12, 15, 18</span></div>
                  <div><span className="text-blue-400 font-bold">3..20.every(2)</span><span className="text-slate-500"> → 3, 5, 7, 9, 11, ..., 19</span></div>
                </div>
              </div>

              <div>
                <span className="font-bold text-slate-200 text-[10px] block mb-1 uppercase tracking-wider text-orange-400">Negación (!) y Grupos</span>
                <div className="bg-slate-950/80 p-2 rounded border border-slate-850 font-mono text-[9px] text-slate-300 space-y-1.5 leading-normal">
                  <div><span className="text-blue-400 font-bold">!first</span><span className="text-slate-500"> → 2, 3, 4, ..., n</span></div>
                  <div><span className="text-blue-400 font-bold">all.!first</span><span className="text-slate-500"> → 2, 3, 4, ..., n</span></div>
                  <div><span className="text-blue-400 font-bold">!last(3)</span><span className="text-slate-500"> → 1, 2, ..., n-3</span></div>
                  <div><span className="text-blue-400 font-bold">!(3..6)</span><span className="text-slate-500"> → 1, 2, 7, 8, ..., n</span></div>
                  <div><span className="text-blue-400 font-bold">!(4,7,10)</span><span className="text-slate-500"> → todos excepto 4, 7 y 10</span></div>
                  <div><span className="text-blue-400 font-bold">(4,7,10..20)</span><span className="text-slate-500"> → 4, 7, 10, 11, ..., 20</span></div>
                  <div><span className="text-blue-400 font-bold">(4,7,10..20).even</span><span className="text-slate-500"> → 4, 10, 12, 14, 16, 18, 20</span></div>
                  <div><span className="text-blue-400 font-bold">(3,5,8,20..40).even.last(3)</span><span className="text-slate-500"> → últimos 3 pares del conjunto</span></div>
                  <div><span className="text-blue-400 font-bold">3,5,8,20..40.even</span><span className="text-slate-500"> → 3, 5, 8, 20, 22, 24, ..., 40</span></div>
                </div>
              </div>
            </div>
          </details>

          <details className="group border border-slate-800 rounded bg-slate-900/40 overflow-hidden">
            <summary className="list-none flex items-center justify-between p-2.5 cursor-pointer hover:bg-slate-800/40 select-none transition-colors">
              <span className="text-[10.5px] font-extrabold text-slate-200 uppercase tracking-widest">
                Variables de Página ({'{page}'}, {'{hoja}'})
              </span>
              <span className="text-slate-400 group-open:rotate-180 transition-transform duration-200 text-xs">
                ▼
              </span>
            </summary>
            
            <div className="p-3 border-t border-slate-850 space-y-4 text-[10px] text-slate-300 leading-relaxed font-sans max-h-[350px] overflow-y-auto custom-scrollbar">
              <p>
                Puedes usar variables en el HTML de tus elementos de margen para mostrar información de la página actual y total. El sistema reemplazará estas variables de forma dinámica en cada página:
              </p>

              <div>
                <span className="font-bold text-slate-200 text-[10px] block mb-1 uppercase tracking-wider text-orange-400">Variables Disponibles</span>
                <div className="bg-slate-950/80 p-2 rounded border border-slate-850 font-mono text-[9px] text-slate-300 space-y-1.5 leading-normal">
                  <div><span className="text-blue-400 font-bold">{'{page}'}</span> o <span className="text-blue-400 font-bold">{'{hoja}'}</span> o <span className="text-blue-400 font-bold">{'{sheet}'}</span><span className="text-slate-500"> → Número de página actual</span></div>
                  <div><span className="text-blue-400 font-bold">{'{total}'}</span><span className="text-slate-500"> → Total de páginas en el documento</span></div>
                </div>
              </div>

              <div>
                <span className="font-bold text-slate-200 text-[10px] block mb-1 uppercase tracking-wider text-orange-400">Cálculos y Aritmética</span>
                <p className="text-[9px] text-slate-400 mb-1 leading-normal">
                  Puedes sumar o restar números enteros directamente dentro de las llaves. Esto es extremadamente útil si quieres crear desfases de numeración o flujos especiales:
                </p>
                <div className="bg-slate-950/80 p-2 rounded border border-slate-850 font-mono text-[9px] text-slate-300 space-y-1.5 leading-normal">
                  <div><span className="text-blue-400 font-bold">{'{page + 1}'}</span> o <span className="text-blue-400 font-bold">{'{hoja + 1}'}</span><span className="text-slate-500"> → Muestra el número de la siguiente página</span></div>
                  <div><span className="text-blue-400 font-bold">{'{page - 1}'}</span> o <span className="text-blue-400 font-bold">{'{hoja - 1}'}</span><span className="text-slate-500"> → Muestra el número de la página anterior</span></div>
                  <div><span className="text-blue-400 font-bold">{'{total - 1}'}</span><span className="text-slate-500"> → El total de páginas menos 1</span></div>
                </div>
              </div>

              <div className="text-[9px] text-slate-400 italic">
                Nota: Puedes incluir espacios alrededor del operador, por ejemplo <code className="text-blue-400">{'{page + 2}'}</code> o <code className="text-blue-400">{'{hoja-1}'}</code>, el sistema los resolverá correctamente de manera automática.
              </div>
            </div>
          </details>
          </div>
        </div>
      </div>
    </div>
  );
}
