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

// Configure custom renderer for code syntax highlighting
markdownParser.use({
  renderer: {
    code(token: any): string {
      const lang = (token.lang || '').trim();
      const text = token.text || '';
      const highlighted = highlightCode(text, lang);
      return `<pre class="language-${lang}"><code class="language-${lang}">${highlighted}</code></pre>`;
    }
  }
});
