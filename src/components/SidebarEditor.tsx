/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { HTMLBlock } from '../types';
import {
  Plus,
  ChevronDown,
  ChevronUp,
  Code,
  Trash2,
  AlertTriangle,
  AlertCircle
} from 'lucide-react';
import { validateContent } from '../utils/validation';

interface AutoGrowingTextAreaProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

function AutoGrowingTextArea({ id, value, onChange, placeholder }: AutoGrowingTextAreaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      // Use scrollHeight to auto-grow the textarea naturally, minimum height 130px
      textarea.style.height = `${Math.max(130, textarea.scrollHeight)}px`;
    }
  };

  useEffect(() => {
    adjustHeight();
  }, [value]);

  return (
    <textarea
      id={id}
      ref={textareaRef}
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
        adjustHeight();
      }}
      style={{ resize: 'none' }}
      className="w-full p-2 bg-slate-950 text-slate-300 font-mono text-xs focus:outline-none border-0 focus:ring-0 leading-relaxed custom-scrollbar overflow-y-hidden"
      placeholder={placeholder}
    />
  );
}

interface SidebarEditorProps {
  htmlBlocks: HTMLBlock[];
  setHtmlBlocks: React.Dispatch<React.SetStateAction<HTMLBlock[]>>;
  lastFocusedBlockId: string | null;
  setLastFocusedBlockId: (id: string | null) => void;
  onRefreshFile: () => void;
  isSyncing: boolean;
  pageCount: number;
  isLocallyEdited: boolean;
  onResetToOriginal: () => void;
  syncStatusMsg: string;
}

export function SidebarEditor({
  htmlBlocks,
  setHtmlBlocks,
  lastFocusedBlockId,
  setLastFocusedBlockId,
  onRefreshFile,
  isSyncing,
  pageCount,
  isLocallyEdited,
  onResetToOriginal,
  syncStatusMsg,
}: SidebarEditorProps) {
  // Drag and drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // State to handle block delete confirmation modal
  const [blockToDelete, setBlockToDelete] = useState<HTMLBlock | null>(null);

  // State for showing the "Nuevo Bloque" dropdown menu
  const [showAddMenu, setShowAddMenu] = useState<boolean>(false);
  const addMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (addMenuRef.current && !addMenuRef.current.contains(event.target as Node)) {
        setShowAddMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Add a new block
  const handleAddBlock = () => {
    const nextNum = htmlBlocks.length + 1;
    const blockId = 'block_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    const name = `Bloque ${nextNum}: Sección Nueva`;
    const code = `## Sección Nueva ${nextNum}\n\nEscribe el contenido de esta sección en Markdown o HTML. Puedes usar los Formatos Rápidos de la barra superior para insertar estructuras.\n`;

    const newBlock: HTMLBlock = {
      id: blockId,
      name,
      code,
      collapsed: false,
      isFunctional: false,
      isMarkdown: true,
    };
    setHtmlBlocks((prev) => [...prev, newBlock]);
    setLastFocusedBlockId(newBlock.id);
    setShowAddMenu(false);
  };

  // Toggle state of block collapse
  const toggleCollapseBlock = (id: string) => {
    setHtmlBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, collapsed: !b.collapsed } : b))
    );
  };

  // Update name inside a block
  const handleNameChange = (id: string, newName: string) => {
    setHtmlBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, name: newName } : b))
    );
  };

  // Toggle markdown mode inside a block
  const handleToggleMarkdown = (id: string, isMarkdown: boolean) => {
    setHtmlBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, isMarkdown } : b))
    );
  };

  // Update code content inside a block
  const handleCodeChange = (id: string, newCode: string) => {
    setHtmlBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, code: newCode } : b))
    );
  };

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    const sourceIdxStr = e.dataTransfer.getData('text/plain');
    const sourceIndex = sourceIdxStr !== '' ? parseInt(sourceIdxStr, 10) : draggedIndex;

    if (sourceIndex !== null && !isNaN(sourceIndex) && sourceIndex !== targetIndex) {
      setHtmlBlocks((prev) => {
        const list = [...prev];
        const [removed] = list.splice(sourceIndex, 1);
        list.splice(targetIndex, 0, removed);
        return list;
      });
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const selectedBlock = htmlBlocks.find((b) => b.id === lastFocusedBlockId);

  const handleToggleCollapseSelected = () => {
    if (lastFocusedBlockId) {
      toggleCollapseBlock(lastFocusedBlockId);
    }
  };

  const handleDeleteSelected = () => {
    if (!lastFocusedBlockId) return;
    const selectedBlock = htmlBlocks.find((b) => b.id === lastFocusedBlockId);
    if (!selectedBlock) return;
    setBlockToDelete(selectedBlock);
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border-r border-slate-880 text-xs text-slate-300 font-sans select-none">
      
      {/* Workspace Header */}
      <div className="p-3 bg-slate-950 border-b border-slate-850 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Code className="w-4 h-4 text-orange-500 shrink-0" />
          <span className="font-extrabold uppercase tracking-widest text-[11px] text-slate-100 truncate">
            Editores ({htmlBlocks.length})
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Colapsar / Expandir button */}
          <button
            onClick={handleToggleCollapseSelected}
            disabled={!selectedBlock}
            className={`h-7 px-2 border transition-all flex items-center gap-1 text-[10px] font-bold rounded ${
              selectedBlock
                ? 'bg-slate-800 hover:bg-slate-700 hover:text-orange-400 border-slate-700 text-slate-200 cursor-pointer active:scale-95'
                : 'bg-slate-900/40 text-slate-600 border-slate-850 cursor-not-allowed opacity-35'
            }`}
            title={selectedBlock ? (selectedBlock.collapsed ? "Expandir bloque seleccionado" : "Colapsar bloque seleccionado") : "Seleccione un bloque para expandir/colapsar"}
          >
            {selectedBlock?.collapsed ? (
              <>
                <ChevronDown className="w-3.5 h-3.5 text-orange-500" />
                <span>Expandir</span>
              </>
            ) : (
              <>
                <ChevronUp className="w-3.5 h-3.5 text-orange-500" />
                <span>Colapsar</span>
              </>
            )}
          </button>

          {/* Eliminar button */}
          <button
            onClick={handleDeleteSelected}
            disabled={!selectedBlock}
            className={`h-7 px-2 border transition-all flex items-center gap-1 text-[10px] font-bold rounded ${
              selectedBlock
                ? 'bg-red-950/40 hover:bg-red-900/40 border-red-900/60 hover:border-red-500 text-red-400 cursor-pointer active:scale-95'
                : 'bg-slate-900/40 text-slate-600 border-slate-850 cursor-not-allowed opacity-35'
            }`}
            title={selectedBlock ? "Eliminar bloque seleccionado" : "Seleccione un bloque para eliminar"}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Eliminar</span>
          </button>

          {/* Nuevo Bloque button */}
          <button
            onClick={() => handleAddBlock()}
            className="h-7 px-2 border border-[#FF6600] bg-[#004080] hover:bg-[#003060] text-white font-bold transition-all flex items-center gap-1 cursor-pointer rounded text-[10px] active:scale-95 shadow-md"
            title="Agregar un nuevo fragmento de contenido"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nuevo Bloque</span>
          </button>
        </div>
      </div>

      {/* Editor scroll blocks list */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar flex flex-col gap-5 bg-slate-900/40">
        
        {htmlBlocks.length === 0 && (
          <div className="p-6 rounded-lg border-2 border-dashed border-slate-850 bg-slate-950/40 text-center text-slate-500 py-10 flex flex-col items-center gap-2">
            <Code className="w-8 h-8 text-slate-600 mb-1" />
            <span className="text-[12px] font-bold text-slate-400">No hay bloques de edición</span>
            <p className="text-[10px] text-slate-500 max-w-[200px] leading-relaxed">
              Haz clic en "Nuevo Bloque" en la esquina superior derecha para empezar a escribir contenido HTML.
            </p>
          </div>
        )}

        {htmlBlocks.map((block, index) => {
          const isFocused = lastFocusedBlockId === block.id;

          return (
            <div
              key={block.id}
              className={`relative border rounded-lg transition-all duration-150 flex flex-col shrink-0 bg-slate-950 ${
                isFocused
                  ? 'border-orange-500 shadow-md ring-1 ring-orange-500/25'
                  : 'border-slate-800 hover:border-slate-700'
              } ${
                dragOverIndex === index ? 'border-orange-500 ring-2 ring-orange-500/30 bg-orange-950/10' : ''
              } ${
                draggedIndex === index ? 'opacity-30' : ''
              }`}
              onFocus={() => setLastFocusedBlockId(block.id)}
              onClick={() => {
                if (lastFocusedBlockId !== block.id) setLastFocusedBlockId(block.id);
              }}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index)}
            >
              {/* Top border toggle button - positioned perfectly absolute overlaying upper border, shifted to the left */}
              {!block.collapsed && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleCollapseBlock(block.id);
                  }}
                  className="absolute -top-2.5 left-1/4 transform -translate-x-1/2 z-20 w-5 h-5 flex items-center justify-center rounded-full bg-slate-900 border border-slate-700 text-slate-400 hover:text-orange-500 hover:border-orange-500 shadow-md transition-all cursor-pointer hover:scale-110 active:scale-95"
                  title="Contraer"
                >
                  <ChevronUp className="w-3.5 h-3.5 text-slate-350" />
                </button>
              )}

              {/* Bottom border toggle button - positioned perfectly absolute overlaying lower border, shifted to the right */}
              {!block.collapsed && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleCollapseBlock(block.id);
                  }}
                  className="absolute -bottom-2.5 left-3/4 transform -translate-x-1/2 z-20 w-5 h-5 flex items-center justify-center rounded-full bg-slate-900 border border-slate-700 text-slate-400 hover:text-orange-500 hover:border-orange-500 shadow-md transition-all cursor-pointer hover:scale-110 active:scale-95"
                  title="Contraer"
                >
                  <ChevronUp className="w-3.5 h-3.5 text-slate-350" />
                </button>
              )}

              {/* Center Column: Code Editor content / Collapsed preview (with padding right to clear the floating number badge) */}
              <div className="flex-1 flex flex-col min-w-0 pr-14">
                {(() => {
                  const validationErrors = validateContent(block.code);
                  const hasErrors = validationErrors.some(e => e.severity === 'error');

                  return !block.collapsed ? (
                    <div className="flex-1 flex flex-col relative bg-slate-950 select-text p-1.5 py-3">
                      {/* Block Header Toolbar */}
                      <div className="flex items-center justify-between gap-2 px-2 pb-2 mb-2 border-b border-slate-900/60">
                        {/* Status indicators */}
                        <div className="flex items-center gap-1 shrink-0 text-[10px] font-semibold select-none">
                          {validationErrors.length === 0 ? (
                            <span className="text-emerald-400 flex items-center gap-1 font-mono text-[9px]" title="La sintaxis de HTML y LaTeX es correcta">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                              ✓ Código OK
                            </span>
                          ) : (
                            <span className={`flex items-center gap-1 font-mono text-[9px] ${hasErrors ? 'text-red-400' : 'text-amber-400'}`}>
                              <AlertTriangle className="w-3 h-3 shrink-0" />
                              {validationErrors.length} {validationErrors.length === 1 ? 'aviso' : 'avisos'}
                            </span>
                          )}
                        </div>
                      </div>

                      <AutoGrowingTextArea
                        id={`editor-textarea-${block.id}`}
                        value={block.code}
                        onChange={(val) => handleCodeChange(block.id, val)}
                        placeholder="Escribe aquí en Markdown (puedes incluir fórmulas LaTeX y etiquetas HTML)..."
                      />
                      {block.code.length === 0 && (
                        <span className="absolute left-4 top-12 text-slate-600 italic pointer-events-none font-mono text-[10px]">
                          Escribe contenido en Markdown, LaTeX (ej: $$x^2$$) o HTML (ej: &lt;p&gt;...&lt;/p&gt;)
                        </span>
                      )}

                      {/* Display of real-time validation feedback */}
                      {validationErrors.length > 0 && (
                        <div className="mt-2.5 p-2 bg-slate-950 border border-slate-850 rounded-lg flex flex-col gap-1.5 text-[10px] select-text">
                          <div className="flex items-center gap-1 text-[9.5px] font-bold text-slate-400 border-b border-slate-900/50 pb-1 mb-0.5 select-none">
                            <AlertCircle className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                            <span>ANÁLISIS DE SINTAXIS EN TIEMPO REAL:</span>
                          </div>
                          {validationErrors.map((err, errIdx) => (
                            <div key={errIdx} className="flex gap-1.5 leading-relaxed">
                              <span className={`shrink-0 font-bold text-[9px] uppercase px-1 rounded select-none ${
                                err.severity === 'error' ? 'bg-red-950/40 text-red-400 border border-red-900/50' : 'bg-amber-950/40 text-amber-400 border border-amber-900/50'
                              }`}>
                                {err.type}
                              </span>
                              <span className="text-slate-350">{err.message}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleCollapseBlock(block.id);
                      }}
                      className="flex-1 p-3 py-3.5 bg-[#002e45]/5 hover:bg-[#002e45]/10 cursor-pointer flex flex-col justify-center min-w-0 select-none"
                      title="Haga clic para expandir y editar"
                    >
                      <div className="flex items-center justify-between gap-1.5 min-w-0">
                        <span className="font-mono text-xs text-slate-300 truncate flex-1">
                          {block.code.trim().split('\n')[0] || <span className="italic text-slate-600">&lt;vacío&gt;</span>}
                        </span>
                        {validationErrors.length > 0 && (
                          <span 
                            className={`shrink-0 flex items-center justify-center p-0.5 rounded-full ${
                              hasErrors ? 'bg-red-950 text-red-500 border border-red-900/40' : 'bg-amber-950 text-amber-500 border border-amber-900/40'
                            }`}
                            title={`Este bloque contiene ${validationErrors.length} advertencia(s) de sintaxis`}
                          >
                            <AlertTriangle className="w-2.5 h-2.5" />
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Floating Absolute Block Number & Drag Handle on the Right side */}
              <div
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragEnd={() => {
                  setDraggedIndex(null);
                  setDragOverIndex(null);
                }}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing shadow-md hover:scale-105 active:scale-95 transition-all select-none border bg-slate-900 hover:bg-slate-800 border-slate-800 hover:border-orange-500 text-slate-300 hover:text-orange-400"
                title="Arrastra para reordenar este bloque"
              >
                <span className="text-xs font-extrabold font-mono tracking-tighter">
                  {index + 1}
                </span>
              </div>
            </div>
          );
        })}

      </div>

      {/* Confirmation Modal to avoid native blocked window.confirm inside iframe sandbox */}
      {blockToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-slate-900 border-2 border-red-500/80 rounded-xl p-5 shadow-2xl text-slate-200">
            <h3 className="text-sm font-bold text-red-400 flex items-center gap-2 mb-3">
              <Trash2 className="w-4 h-4 text-red-500" />
              ¿Confirmar eliminación?
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed mb-5">
              ¿Está seguro de que desea eliminar el bloque <span className="font-extrabold text-orange-400">"{blockToDelete.name}"</span>? Esta acción no se puede deshacer.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setBlockToDelete(null)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 text-xs font-semibold text-slate-300 transition-all cursor-pointer active:scale-95"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setHtmlBlocks((prev) => prev.filter((b) => b.id !== blockToDelete.id));
                  if (lastFocusedBlockId === blockToDelete.id) {
                    setLastFocusedBlockId(null);
                  }
                  setBlockToDelete(null);
                }}
                className="px-4 py-1.5 rounded-lg bg-red-650 hover:bg-red-550 border border-red-650 text-white text-xs font-bold transition-all cursor-pointer shadow-lg active:scale-95"
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SidebarEditor;
