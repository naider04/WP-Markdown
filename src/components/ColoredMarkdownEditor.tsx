/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  highlightMarkdownCode,
  EditorTheme
} from '../utils/markdownHighlighter';
import { findSyntaxIssues } from '../utils/validation';
import {
  Bold,
  Italic,
  Heading,
  Code,
  Sigma,
  Quote,
  List,
  AlertCircle
} from 'lucide-react';

interface ColoredMarkdownEditorProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  debounceDelay?: number;
  autoFocus?: boolean;
}

const SHARED_EDITOR_STYLE: React.CSSProperties = {
  tabSize: 2,
  fontFamily: '"Fira Code", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  fontVariantLigatures: 'none',
  fontFeatureSettings: '"liga" 0, "calt" 0',
  letterSpacing: '0px',
  fontSize: '12px',
  lineHeight: '1.6',
  boxSizing: 'border-box',
  padding: '12px',
  margin: 0,
  border: 'none',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  overflowWrap: 'break-word',
};

export function ColoredMarkdownEditor({
  id,
  value,
  onChange,
  placeholder = "Escribe aquí en Markdown (puedes incluir fórmulas LaTeX y HTML)...",
  debounceDelay = 150,
  autoFocus = false
}: ColoredMarkdownEditorProps) {
  const [localValue, setLocalValue] = useState(value);
  const editorTheme: EditorTheme = 'dark-modern';

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const lastPropagatedRef = useRef(value);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync external changes
  useEffect(() => {
    if (value !== lastPropagatedRef.current) {
      setLocalValue(value);
      lastPropagatedRef.current = value;
    }
  }, [value]);

  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus({ preventScroll: true });
    }
  }, [autoFocus]);

  const rafRef = useRef<number | null>(null);

  const adjustHeight = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
    }

    rafRef.current = requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      // Save scroll position of all scrollable parent containers before height recalculation
      const scrollParents: { el: HTMLElement; scrollTop: number }[] = [];
      let parent = textarea.parentElement;
      while (parent && parent !== document.body) {
        const style = window.getComputedStyle(parent);
        if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
          scrollParents.push({ el: parent, scrollTop: parent.scrollTop });
        }
        parent = parent.parentElement;
      }

      const currentHeight = textarea.offsetHeight;
      const scrollHeight = textarea.scrollHeight;

      const targetHeight = scrollHeight > currentHeight
        ? Math.max(140, scrollHeight)
        : Math.max(140, (() => {
            textarea.style.height = 'auto';
            const h = textarea.scrollHeight;
            return h;
          })());

      const targetPx = `${targetHeight}px`;
      if (textarea.style.height !== targetPx) {
        textarea.style.height = targetPx;
      }

      for (const sp of scrollParents) {
        sp.el.scrollTop = sp.scrollTop;
      }

      // Keep backdrop height matching
      if (backdropRef.current && backdropRef.current.style.height !== targetPx) {
        backdropRef.current.style.height = targetPx;
      }
    });
  }, []);

  useEffect(() => {
    adjustHeight();
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [localValue, adjustHeight]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const resizeObserver = new ResizeObserver(() => {
      adjustHeight();
    });

    resizeObserver.observe(textarea);
    return () => {
      resizeObserver.disconnect();
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [adjustHeight]);

  // Solution 2: Debounced propagation to parent to prevent preview KaTeX re-parsing on every keystroke
  const handleTextChange = (newVal: string, immediate = false) => {
    setLocalValue(newVal);
    adjustHeight();

    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (immediate || debounceDelay <= 0) {
      lastPropagatedRef.current = newVal;
      onChange(newVal);
    } else {
      timerRef.current = setTimeout(() => {
        lastPropagatedRef.current = newVal;
        onChange(newVal);
      }, debounceDelay);
    }
  };

  // Flush any pending debounced change on blur
  const handleBlur = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
      lastPropagatedRef.current = localValue;
      onChange(localValue);
    }
  };

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  // Sync scroll position between textarea and backdrop
  const handleScroll = () => {
    if (textareaRef.current && backdropRef.current) {
      backdropRef.current.scrollTop = textareaRef.current.scrollTop;
      backdropRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

  // Helper to insert or wrap text at the current cursor selection
  const insertFormatting = (prefix: string, suffix: string, defaultText = "texto") => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;

    const selectedText = text.substring(start, end);
    const replacement = selectedText || defaultText;
    const newText = text.substring(0, start) + prefix + replacement + suffix + text.substring(end);

    handleTextChange(newText, true);

    setTimeout(() => {
      textarea.focus();
      if (selectedText) {
        textarea.setSelectionRange(start + prefix.length, start + prefix.length + replacement.length);
      } else {
        textarea.setSelectionRange(start + prefix.length, start + prefix.length + defaultText.length);
      }
      adjustHeight();
    }, 10);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Tab key support (inserts 2 spaces)
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newText = localValue.substring(0, start) + '  ' + localValue.substring(end);
      handleTextChange(newText);
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      }, 0);
      return;
    }

    // Ctrl+B / Cmd+B for Bold
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      insertFormatting('**', '**', 'negrita');
      return;
    }

    // Ctrl+I / Cmd+I for Italic
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
      e.preventDefault();
      insertFormatting('*', '*', 'cursiva');
      return;
    }
  };

  // Find syntax issues for the mini status indicator
  const syntaxIssues = useMemo(() => {
    return findSyntaxIssues(localValue);
  }, [localValue]);

  // Render highlighted HTML with inline error squiggles (synchronized with every keystroke)
  const highlightedHtml = useMemo(() => {
    return highlightMarkdownCode(localValue, editorTheme);
  }, [localValue, editorTheme]);

  return (
    <div ref={containerRef} className="flex flex-col w-full rounded-lg border border-slate-800 bg-slate-950 overflow-hidden shadow-inner">
      {/* Interactive Quick Markdown Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 p-1.5 bg-slate-900 border-b border-slate-800/80 text-slate-300 select-none">
        
        {/* Left Toolbar: Quick Format Actions */}
        <div className="flex items-center flex-wrap gap-0.5">
          {/* Bold */}
          <button
            type="button"
            onClick={() => insertFormatting('**', '**', 'negrita')}
            className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded transition-colors active:scale-95 cursor-pointer"
            title="Negrita (**texto**) [Ctrl+B]"
          >
            <Bold className="w-3.5 h-3.5" />
          </button>

          {/* Italic */}
          <button
            type="button"
            onClick={() => insertFormatting('*', '*', 'cursiva')}
            className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded transition-colors active:scale-95 cursor-pointer"
            title="Cursiva (*texto*) [Ctrl+I]"
          >
            <Italic className="w-3.5 h-3.5" />
          </button>

          {/* Heading H2 */}
          <button
            type="button"
            onClick={() => insertFormatting('## ', '\n', 'Título de Sección')}
            className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-amber-400 rounded transition-colors active:scale-95 cursor-pointer font-bold text-xs flex items-center gap-0.5"
            title="Encabezado H2 (## Título)"
          >
            <Heading className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-[10px] font-mono font-black">H2</span>
          </button>

          {/* Math LaTeX ($...$) */}
          <button
            type="button"
            onClick={() => insertFormatting('$', '$', 'x^2 + y^2 = z^2')}
            className="p-1.5 hover:bg-slate-800 text-emerald-400 hover:text-emerald-300 rounded transition-colors active:scale-95 cursor-pointer text-xs flex items-center gap-0.5"
            title="Fórmula Matemática LaTeX ($f(x)$)"
          >
            <Sigma className="w-3.5 h-3.5 text-emerald-400" />
          </button>

          {/* Inline Code */}
          <button
            type="button"
            onClick={() => insertFormatting('`', '`', 'código')}
            className="p-1.5 hover:bg-slate-800 text-cyan-400 hover:text-cyan-300 rounded transition-colors active:scale-95 cursor-pointer"
            title="Código en línea (`código`)"
          >
            <Code className="w-3.5 h-3.5 text-cyan-400" />
          </button>

          {/* Blockquote */}
          <button
            type="button"
            onClick={() => insertFormatting('> ', '\n', 'Cita o referencia')}
            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition-colors active:scale-95 cursor-pointer"
            title="Cita textual (> Cita)"
          >
            <Quote className="w-3.5 h-3.5" />
          </button>

          {/* Bullet List */}
          <button
            type="button"
            onClick={() => insertFormatting('- ', '\n', 'Elemento de lista')}
            className="p-1.5 hover:bg-slate-800 text-orange-400 hover:text-orange-300 rounded transition-colors active:scale-95 cursor-pointer"
            title="Lista con viñetas (- Item)"
          >
            <List className="w-3.5 h-3.5 text-orange-400" />
          </button>
        </div>

        {/* Right Toolbar: Inline Error Summary Status Pill */}
        <div className="flex items-center gap-2">
          {syntaxIssues.length > 0 ? (
            <div
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-red-950/70 text-red-400 border border-red-800/60 text-[10px] font-mono font-bold shadow-sm"
              title={syntaxIssues.map((i, idx) => `${idx + 1}. [${i.type.toUpperCase()}] ${i.message}`).join('\n')}
            >
              <AlertCircle className="w-3 h-3 text-red-400 shrink-0" />
              <span>{syntaxIssues.length} {syntaxIssues.length === 1 ? 'error (subrayado en rojo)' : 'errores'}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-[9.5px] font-mono text-emerald-400/80 select-none" title="Sintaxis HTML y LaTeX correcta">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/80"></span>
              <span>Sintaxis OK</span>
            </div>
          )}
        </div>
      </div>

      {/* Editor Content Area: Dual Layer Synchronized Syntax Highlighter & Textarea */}
      <div className="relative w-full bg-slate-950 min-h-[140px] overflow-hidden">
        {/* Layer 1: Synchronized Syntax Highlight Backdrop (Always active) */}
        <div
          ref={backdropRef}
          aria-hidden="true"
          className="colored-markdown-backdrop absolute inset-0 pointer-events-none overflow-hidden text-slate-300 select-none z-0"
          style={{
            ...SHARED_EDITOR_STYLE,
          }}
          dangerouslySetInnerHTML={{ __html: highlightedHtml + '<br/>' }}
        />

        {/* Layer 2: Interactive Foreground Textarea */}
        <textarea
          id={id}
          ref={textareaRef}
          value={localValue}
          onChange={(e) => handleTextChange(e.target.value)}
          onBlur={handleBlur}
          onScroll={handleScroll}
          onKeyDown={handleKeyDown}
          style={{
            ...SHARED_EDITOR_STYLE,
            resize: 'none',
            caretColor: '#FF6600',
            color: 'transparent',
          }}
          className="colored-markdown-textarea relative z-10 w-full bg-transparent focus:outline-none border-0 focus:ring-0 custom-scrollbar overflow-y-hidden selection:bg-orange-500/30 caret-orange-500"
          placeholder={placeholder}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
        />
      </div>
    </div>
  );
}

export default ColoredMarkdownEditor;
