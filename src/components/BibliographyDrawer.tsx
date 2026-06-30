/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { BibliographyItem } from '../types';
import {
  BookOpen,
  Plus,
  Trash2,
  Copy,
  Edit2,
  X,
  Check,
  Search,
  Book,
  FileText,
  Globe,
  Info
} from 'lucide-react';

interface BibliographyDrawerProps {
  bibliography: BibliographyItem[];
  setBibliography: React.Dispatch<React.SetStateAction<BibliographyItem[]>>;
  onClose: () => void;
  onInsertHTML: (snippet: string) => void;
  showBibliography: boolean;
  onToggleShowBibliography: (show: boolean) => void;
  bibliographyTitle: string;
  onChangeBibliographyTitle: (title: string) => void;
}

export function BibliographyDrawer({
  bibliography,
  setBibliography,
  onClose,
  onInsertHTML,
  showBibliography,
  onToggleShowBibliography,
  bibliographyTitle,
  onChangeBibliographyTitle
}: BibliographyDrawerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  // Form states
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formType, setFormType] = useState<'book' | 'article' | 'web'>('book');
  const [formKey, setFormKey] = useState('');
  const [formAuthors, setFormAuthors] = useState('');
  const [formYear, setFormYear] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formPublisher, setFormPublisher] = useState('');
  const [formJournal, setFormJournal] = useState('');
  const [formVolume, setFormVolume] = useState('');
  const [formIssue, setFormIssue] = useState('');
  const [formPages, setFormPages] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formRetrievedDate, setFormRetrievedDate] = useState('');

  const triggerSuccessMsg = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 2500);
  };

  const resetForm = () => {
    setFormType('book');
    setFormKey('');
    setFormAuthors('');
    setFormYear('');
    setFormTitle('');
    setFormPublisher('');
    setFormJournal('');
    setFormVolume('');
    setFormIssue('');
    setFormPages('');
    setFormUrl('');
    setFormRetrievedDate('');
    setIsAdding(false);
    setEditingId(null);
  };

  const handleEdit = (item: BibliographyItem) => {
    setEditingId(item.id);
    setIsAdding(true);
    setFormType(item.type);
    setFormKey(item.key);
    setFormAuthors(item.authors);
    setFormYear(item.year);
    setFormTitle(item.title);
    setFormPublisher(item.publisher || '');
    setFormJournal(item.journal || '');
    setFormVolume(item.volume || '');
    setFormIssue(item.issue || '');
    setFormPages(item.pages || '');
    setFormUrl(item.url || '');
    setFormRetrievedDate(item.retrievedDate || '');
  };

  const generateKeyFromAuthorsAndYear = (authors: string, year: string): string => {
    // Take first author's last name or first word of author field
    const cleanAuthors = authors.trim();
    if (!cleanAuthors) return 'citation_' + Date.now().toString().slice(-4);
    
    // Get first word of author, strip non-alphanumeric
    const firstWord = cleanAuthors.split(',')[0].split(' ')[0]
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove accents
      .replace(/[^a-z0-9]/g, '');
      
    const cleanYear = year.trim().replace(/[^0-9]/g, '') || '2026';
    const keyCandidate = `${firstWord}${cleanYear}`;
    
    // Check uniqueness
    let finalKey = keyCandidate;
    let count = 1;
    while (bibliography.some(b => b.key === finalKey && b.id !== editingId)) {
      finalKey = `${keyCandidate}_${count}`;
      count++;
    }
    return finalKey;
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formAuthors.trim() || !formTitle.trim()) {
      alert('Por favor complete al menos los campos obligatorios: Autores y Título.');
      return;
    }

    const finalKey = formKey.trim() || generateKeyFromAuthorsAndYear(formAuthors, formYear);
    
    // Validate uniqueness of key
    if (bibliography.some(b => b.key === finalKey && b.id !== editingId)) {
      alert(`La clave de cita "${finalKey}" ya está en uso. Por favor use otra.`);
      return;
    }

    const newItem: BibliographyItem = {
      id: editingId || `bib_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      key: finalKey,
      type: formType,
      authors: formAuthors.trim(),
      year: formYear.trim() || 's.f.', // sin fecha
      title: formTitle.trim(),
      publisher: formType === 'book' ? formPublisher.trim() : undefined,
      journal: formType === 'article' ? formJournal.trim() : undefined,
      volume: formType === 'article' ? formVolume.trim() : undefined,
      issue: formType === 'article' ? formIssue.trim() : undefined,
      pages: formType === 'article' ? formPages.trim() : undefined,
      url: (formType === 'web' || formType === 'article') && formUrl.trim() ? formUrl.trim() : undefined,
      retrievedDate: formType === 'web' ? formRetrievedDate.trim() : undefined
    };

    if (editingId) {
      setBibliography(prev => prev.map(b => b.id === editingId ? newItem : b));
      triggerSuccessMsg('Referencia actualizada con éxito.');
    } else {
      setBibliography(prev => [...prev, newItem]);
      triggerSuccessMsg('Referencia agregada con éxito.');
    }
    resetForm();
  };

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`¿Está seguro de que desea eliminar la referencia de "${name}"?`)) {
      setBibliography(prev => prev.filter(b => b.id !== id));
      triggerSuccessMsg('Referencia eliminada.');
    }
  };

  const handleCopyCitation = (key: string) => {
    const citation = `[@${key}]`;
    navigator.clipboard.writeText(citation).then(() => {
      triggerSuccessMsg(`Copia en portapapeles: ${citation}`);
    });
  };

  const handleInsertCitation = (key: string) => {
    const citation = `[@${key}]`;
    onInsertHTML(citation);
    triggerSuccessMsg(`Insertado: ${citation}`);
  };

  const filteredBibliography = bibliography.filter(item => {
    const searchLower = searchQuery.toLowerCase();
    return (
      item.authors.toLowerCase().includes(searchLower) ||
      item.title.toLowerCase().includes(searchLower) ||
      item.key.toLowerCase().includes(searchLower) ||
      (item.publisher && item.publisher.toLowerCase().includes(searchLower)) ||
      (item.journal && item.journal.toLowerCase().includes(searchLower))
    );
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 border-r border-slate-850 select-none text-slate-300">
      {/* Title Header */}
      <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-1.5 min-w-0">
          <BookOpen className="w-4 h-4 text-[#FF6600]" />
          <span className="font-extrabold uppercase tracking-wider text-[11px] text-slate-100 truncate">
            Gestor Bibliográfico APA
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 cursor-pointer"
          title="Cerrar Gestor"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar flex flex-col gap-5">
        {/* Status Toast */}
        {successMsg && (
          <div className="p-2.5 bg-emerald-950/80 border border-emerald-800 text-emerald-400 font-bold rounded-lg text-[10px] text-center flex items-center justify-center gap-1.5 animate-in fade-in zoom-in-95 duration-200">
            <Check className="w-3.5 h-3.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Global Toggle to include bibliography page */}
        <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/50 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-[10px] font-bold text-slate-200">Bibliografía APA Automática</div>
              <div className="text-[9px] text-slate-400">Genera una página de Referencias al final del documento</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={showBibliography}
                onChange={(e) => onToggleShowBibliography(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-7 h-4 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-[#FF6600] peer-checked:after:bg-white"></div>
            </label>
          </div>

          {showBibliography && (
            <div className="space-y-1">
              <label className="block text-[9px] font-bold text-slate-400 uppercase">Título de Sección</label>
              <input
                type="text"
                value={bibliographyTitle}
                onChange={(e) => onChangeBibliographyTitle(e.target.value)}
                placeholder="Referencias Bibliográficas"
                className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-[10.5px] text-slate-100 focus:outline-none focus:border-orange-500"
              />
            </div>
          )}
        </div>

        {/* Form Container (Adding/Editing) */}
        {isAdding ? (
          <form onSubmit={handleSave} className="p-3.5 rounded-lg border-2 border-orange-500/30 bg-slate-900/40 flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h4 className="text-[10.5px] font-black text-orange-400 uppercase">
                {editingId ? 'Editar Referencia' : 'Nueva Referencia APA'}
              </h4>
              <button
                type="button"
                onClick={resetForm}
                className="text-slate-500 hover:text-slate-350 text-[10px] font-semibold"
              >
                Cancelar
              </button>
            </div>

            {/* Type selector */}
            <div>
              <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Tipo de Fuente</label>
              <div className="grid grid-cols-3 gap-1 bg-slate-950 p-0.5 rounded border border-slate-800">
                <button
                  type="button"
                  onClick={() => setFormType('book')}
                  className={`py-1 text-[9px] font-bold rounded flex items-center justify-center gap-1 ${
                    formType === 'book' ? 'bg-[#004080] text-white shadow' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Book className="w-3 h-3" />
                  <span>Libro</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormType('article')}
                  className={`py-1 text-[9px] font-bold rounded flex items-center justify-center gap-1 ${
                    formType === 'article' ? 'bg-[#004080] text-white shadow' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <FileText className="w-3 h-3" />
                  <span>Artículo</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormType('web')}
                  className={`py-1 text-[9px] font-bold rounded flex items-center justify-center gap-1 ${
                    formType === 'web' ? 'bg-[#004080] text-white shadow' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Globe className="w-3 h-3" />
                  <span>Web</span>
                </button>
              </div>
            </div>

            {/* Authors */}
            <div>
              <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">
                Autores <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formAuthors}
                onChange={(e) => setFormAuthors(e.target.value)}
                placeholder="Patiño, W. A., & Gómez, M. E."
                className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-100 focus:outline-none focus:border-orange-500 font-sans"
              />
              <span className="text-[8px] text-slate-500">Formato: Apellido, N. I., & SegundoApellido, O. P.</span>
            </div>

            {/* Year & Custom Key row */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Año</label>
                <input
                  type="text"
                  value={formYear}
                  onChange={(e) => setFormYear(e.target.value)}
                  placeholder="2026"
                  className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-100 focus:outline-none focus:border-orange-500 font-sans"
                />
              </div>
              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5" title="Clave de cita corta usada en Markdown como [@clave]">
                  Clave de Cita
                </label>
                <input
                  type="text"
                  value={formKey}
                  onChange={(e) => setFormKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  placeholder="patino2026 (auto)"
                  className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-100 focus:outline-none focus:border-orange-500 font-mono"
                />
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">
                Título del Trabajo <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Análisis y Modelado de Arquitecturas de TI"
                className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-100 focus:outline-none focus:border-orange-500 font-sans"
              />
            </div>

            {/* BOOK fields */}
            {formType === 'book' && (
              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Editorial</label>
                <input
                  type="text"
                  value={formPublisher}
                  onChange={(e) => setFormPublisher(e.target.value)}
                  placeholder="Editorial UNEMI"
                  className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-100 focus:outline-none focus:border-orange-500"
                />
              </div>
            )}

            {/* ARTICLE fields */}
            {formType === 'article' && (
              <>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Nombre de Revista (Journal)</label>
                  <input
                    type="text"
                    value={formJournal}
                    onChange={(e) => setFormJournal(e.target.value)}
                    placeholder="Revista de Ciencias UNEMI"
                    className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-100 focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Volumen</label>
                    <input
                      type="text"
                      value={formVolume}
                      onChange={(e) => setFormVolume(e.target.value)}
                      placeholder="14"
                      className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-100 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Número</label>
                    <input
                      type="text"
                      value={formIssue}
                      onChange={(e) => setFormIssue(e.target.value)}
                      placeholder="2"
                      className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-100 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Páginas</label>
                    <input
                      type="text"
                      value={formPages}
                      onChange={(e) => setFormPages(e.target.value)}
                      placeholder="89-104"
                      className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-100 focus:outline-none"
                    />
                  </div>
                </div>
              </>
            )}

            {/* WEB / URL fields */}
            {(formType === 'web' || formType === 'article') && (
              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">URL / Enlace</label>
                <input
                  type="url"
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  placeholder="https://ojs.unemi.edu.ec/index.php/rc"
                  className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-100 focus:outline-none focus:border-orange-500"
                />
              </div>
            )}

            {formType === 'web' && (
              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Fecha de Recuperación</label>
                <input
                  type="text"
                  value={formRetrievedDate}
                  onChange={(e) => setFormRetrievedDate(e.target.value)}
                  placeholder="29 de junio de 2026"
                  className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-100 focus:outline-none focus:border-orange-500"
                />
              </div>
            )}

            {/* Save Button */}
            <button
              type="submit"
              className="w-full mt-2 h-8 border border-[#FF6600] bg-[#004080] hover:bg-[#003060] text-white text-xs font-bold rounded transition-all flex items-center justify-center gap-1 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Guardar Referencia</span>
            </button>
          </form>
        ) : (
          /* "Agregar Nueva" button when form is closed */
          <button
            onClick={() => setIsAdding(true)}
            className="w-full py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-orange-400 hover:text-orange-300 font-bold rounded flex items-center justify-center gap-1.5 transition-all cursor-pointer text-xs active:scale-95 shadow"
          >
            <Plus className="w-4 h-4" />
            <span>Agregar Referencia Bibliográfica</span>
          </button>
        )}

        {/* Informative Help Box */}
        <div className="p-3 bg-slate-900/30 border border-slate-850 rounded-lg text-[9.5px] leading-relaxed text-slate-400 flex gap-2">
          <Info className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-slate-300">¿Cómo citar en Markdown?</p>
            <p>
              Escribe <code className="bg-slate-950 px-1 py-0.5 rounded font-mono text-orange-400 text-[9px]">[@clave]</code> en tu bloque de contenido. El parser lo convertirá automáticamente en formato de cita APA <code className="text-slate-200 font-medium">(Autor, Año)</code>.
            </p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por autor, título o clave..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-2 text-[11px] text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Bibliography List */}
        <div className="space-y-3">
          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Referencias Registradas ({filteredBibliography.length})
          </h4>

          {filteredBibliography.length === 0 ? (
            <div className="text-center p-6 text-slate-600 bg-slate-950/25 border border-dashed border-slate-850 rounded-lg">
              <BookOpen className="w-6 h-6 text-slate-700 mx-auto mb-2" />
              <p className="text-[10px] font-medium">No se encontraron referencias</p>
            </div>
          ) : (
            filteredBibliography.map(item => (
              <div key={item.id} className="p-3 bg-slate-950 border border-slate-850 hover:border-slate-800 rounded-lg flex flex-col gap-2 relative group transition-all">
                <div className="flex items-start justify-between gap-1.5 pr-14">
                  <div className="flex items-center gap-1.5">
                    {item.type === 'book' && <Book className="w-3.5 h-3.5 text-blue-400 shrink-0" title="Libro" />}
                    {item.type === 'article' && <FileText className="w-3.5 h-3.5 text-emerald-400 shrink-0" title="Artículo de Revista" />}
                    {item.type === 'web' && <Globe className="w-3.5 h-3.5 text-indigo-400 shrink-0" title="Página Web" />}
                    
                    <span className="font-mono text-[9px] bg-slate-900 border border-slate-800 text-orange-400 px-1 rounded">
                      @{item.key}
                    </span>
                  </div>
                </div>

                <div className="text-[10.5px] leading-relaxed text-slate-300 font-sans">
                  <span className="font-bold text-slate-200">{item.authors} ({item.year}).</span>{' '}
                  <span className="italic text-slate-100">{item.title}.</span>{' '}
                  {item.type === 'book' && item.publisher && <span>{item.publisher}.</span>}
                  {item.type === 'article' && item.journal && (
                    <span>
                      <span className="italic">{item.journal}</span>
                      {item.volume && `, ${item.volume}`}
                      {item.issue && `(${item.issue})`}
                      {item.pages && `, ${item.pages}`}.
                    </span>
                  )}
                  {item.url && (
                    <span className="text-blue-400 break-all hover:underline block text-[9.5px] mt-0.5">
                      {item.url}
                    </span>
                  )}
                </div>

                {/* Insertion & Clipboard toolbar */}
                <div className="flex items-center gap-2 border-t border-slate-900 pt-2 mt-1">
                  <button
                    onClick={() => handleInsertCitation(item.key)}
                    className="flex-1 bg-slate-900 hover:bg-slate-850 hover:text-white py-1 rounded text-[9.5px] font-bold text-slate-300 border border-slate-800 cursor-pointer flex items-center justify-center gap-1 active:scale-95 transition-all"
                    title="Insertar cita [@clave] en el bloque de código actual"
                  >
                    <Plus className="w-3 h-3 text-[#FF6600]" />
                    <span>Insertar Cita</span>
                  </button>
                  <button
                    onClick={() => handleCopyCitation(item.key)}
                    className="bg-slate-900 hover:bg-slate-850 p-1 rounded border border-slate-800 text-slate-400 hover:text-slate-200 cursor-pointer active:scale-95 transition-all"
                    title="Copiar [@clave] al portapapeles"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleEdit(item)}
                    className="bg-slate-900 hover:bg-slate-850 p-1 rounded border border-slate-800 text-slate-400 hover:text-slate-200 cursor-pointer active:scale-95 transition-all"
                    title="Editar datos de referencia"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(item.id, item.authors)}
                    className="bg-slate-900/40 hover:bg-red-950/40 border border-slate-800 hover:border-red-900/60 text-slate-500 hover:text-red-400 p-1 rounded cursor-pointer active:scale-95 transition-all"
                    title="Eliminar referencia"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
