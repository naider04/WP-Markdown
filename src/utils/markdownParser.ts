import { Marked } from 'marked';
import Prism from 'prismjs';

// Import Prism language components
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-markup'; // HTML/XML/SVG
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-latex';

const highlightCode = (code: string, lang: string): string => {
  const cleanLang = (lang || '').trim().toLowerCase();
  
  // Map common aliases
  const langMap: Record<string, string> = {
    'js': 'javascript',
    'ts': 'typescript',
    'html': 'markup',
    'xml': 'markup',
    'svg': 'markup',
    'sh': 'bash',
    'shell': 'bash',
    'py': 'python',
    'md': 'markdown',
    'tex': 'latex'
  };

  const prismLang = langMap[cleanLang] || cleanLang;

  if (prismLang && Prism.languages[prismLang]) {
    try {
      return Prism.highlight(code, Prism.languages[prismLang], prismLang);
    } catch (e) {
      console.warn("Prism highlight error:", e);
    }
  }

  // Fallback to basic HTML escaping
  return code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
};

export const markdownParser = new Marked({
  gfm: true,
  breaks: true,
});

// Configure custom renderer for code syntax highlighting and APA headings
markdownParser.use({
  renderer: {
    code(token: any): string {
      const lang = (token.lang || '').trim();
      const text = token.text || '';
      const highlighted = highlightCode(text, lang);
      return `<pre class="language-${lang}"><code class="language-${lang}">${highlighted}</code></pre>`;
    },
    heading(token: any): string {
      const level = token.depth;
      let text = token.text || '';
      
      // Access current WP settings globally
      const settings = (typeof window !== 'undefined' && ((window as any).currentWpSettings || (window as any).currentUnemiSettings)) || {};
      const defaultLineBreak = level <= 3;
      const configKey = `h${level}LineBreak`;
      const lineBreak = settings[configKey] !== undefined ? !!settings[configKey] : defaultLineBreak;
      
      if (lineBreak) {
        return `<h${level} class="apa-heading apa-level${level}">${text}</h${level}>`;
      } else {
        // Run-in heading
        if (text && !/[.!?:]\s*$/.test(text)) {
          text += '.';
        }
        
        let innerHTML = text;
        if (level === 1) {
          innerHTML = `<strong>${text}</strong>`;
        } else if (level === 2) {
          innerHTML = `<strong>${text}</strong>`;
        } else if (level === 3) {
          innerHTML = `<strong><em>${text}</em></strong>`;
        } else if (level === 4) {
          innerHTML = `<strong>${text}</strong>`;
        } else if (level === 5) {
          innerHTML = `<strong><em>${text}</em></strong>`;
        } else {
          innerHTML = `<strong>${text}</strong>`;
        }
        
        return `<span class="apa-runin apa-level${level}">${innerHTML}</span>`;
      }
    }
  }
});

export function extractCoverCss(tmpl: string): string {
  if (!tmpl) return '';
  if (tmpl.includes('<div class="cv-page">') || tmpl.includes('<style>')) {
    const styleMatch = tmpl.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
    if (styleMatch) {
      return styleMatch[1].trim();
    }
  }
  return tmpl.trim();
}

export function compileCoverHtml(cssOrTemplate: string, markdown: string): string {
  const compiledMarkdown = String(markdownParser.parse(markdown || ''));
  const raw = (cssOrTemplate || '').trim();

  if (raw.includes('{{content}}')) {
    return raw.replace('{{content}}', compiledMarkdown);
  }

  let cleanCss = raw.replace(/^<style[^>]*>/i, '').replace(/<\/style>$/i, '').trim();

  return `<style>\n${cleanCss}\n</style>\n<div class="cv-page">\n    <div class="cv-content">\n        ${compiledMarkdown}\n    </div>\n</div>`;
}
