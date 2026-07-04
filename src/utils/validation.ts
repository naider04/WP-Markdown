/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ValidationError {
  type: 'html' | 'latex';
  message: string;
  severity: 'warning' | 'error';
}

export function validateContent(code: string): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!code) return errors;

  // --- 1. HTML Validation ---
  // Void/self-closing elements that don't need a closing tag in HTML5
  const voidElements = new Set([
    'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
    'link', 'meta', 'param', 'source', 'track', 'wbr'
  ]);

  // Regexp to find tags: opening, closing, or self-closing
  // Group 1: slash (/) if closing
  // Group 2: tag name
  // Group 3: slash (/) if self-closing like <img />
  const tagRegex = /<(\/?)([a-zA-Z0-9:-]+)(?:\s+[^>]*?)?(\/?)>/g;
  let match;
  const stack: { name: string; index: number }[] = [];

  while ((match = tagRegex.exec(code)) !== null) {
    const isClosing = match[1] === '/';
    const tagName = match[2].toLowerCase();
    const isSelfClosing = match[3] === '/' || voidElements.has(tagName);

    if (isSelfClosing) {
      continue;
    }

    if (isClosing) {
      if (stack.length === 0) {
        errors.push({
          type: 'html',
          message: `Etiqueta de cierre </${tagName}> encontrada sin una etiqueta de apertura correspondiente.`,
          severity: 'error'
        });
      } else {
        const last = stack.pop();
        if (last && last.name !== tagName) {
          errors.push({
            type: 'html',
            message: `Etiqueta de cierre </${tagName}> no coincide con la etiqueta de apertura <${last.name}>.`,
            severity: 'error'
          });
        }
      }
    } else {
      stack.push({ name: tagName, index: match.index });
    }
  }

  // Any remaining tags in stack are unclosed
  while (stack.length > 0) {
    const unclosed = stack.pop();
    if (unclosed) {
      errors.push({
        type: 'html',
        message: `La etiqueta <${unclosed.name}> no está cerrada. Asegúrate de cerrarla con </${unclosed.name}>.`,
        severity: 'error'
      });
    }
  }

  // --- 2. LaTeX Validation ---
  // Count of block math delimiters $$
  const doubleDollarCount = (code.match(/\$\$/g) || []).length;
  if (doubleDollarCount % 2 !== 0) {
    errors.push({
      type: 'latex',
      message: 'Falta un delimitador de bloque matemático ($$). Tienes un número impar de $$ en tu texto.',
      severity: 'error'
    });
  }

  // Count of inline math delimiters $ (excluding double dollars)
  const inlineCodeCleaned = code.replace(/\$\$/g, '');
  const singleDollarCount = (inlineCodeCleaned.match(/\$/g) || []).length;
  if (singleDollarCount % 2 !== 0) {
    // Check if there are signs of LaTeX within the text to avoid warning on normal currency signs like $100
    const containsLatexSymbols = /\\begin|\\end|\\alpha|\\beta|\\frac|\\sum|\\int|\\times|\\neq|\\leq|\\geq|\\infty|\\sin|\\cos|\\tan|\\cdot|\\pi|\\theta/i.test(code);
    if (containsLatexSymbols) {
      errors.push({
        type: 'latex',
        message: 'Posible delimitador matemático de línea ($) incompleto o impar en el bloque.',
        severity: 'warning'
      });
    }
  }

  // Environments: \begin{env} and \end{env}
  const beginRegex = /\\begin\{([a-zA-Z0-9*]+)\}/g;
  const endRegex = /\\end\{([a-zA-Z0-9*]+)\}/g;
  
  const begins: string[] = [];
  let beginMatch;
  while ((beginMatch = beginRegex.exec(code)) !== null) {
    begins.push(beginMatch[1]);
  }

  const ends: string[] = [];
  let endMatch;
  while ((endMatch = endRegex.exec(code)) !== null) {
    ends.push(endMatch[1]);
  }

  // Simple pairing check
  if (begins.length !== ends.length) {
    errors.push({
      type: 'latex',
      message: `Número desigual de instrucciones LaTeX \\begin y \\end (${begins.length} \\begin frente a ${ends.length} \\end).`,
      severity: 'error'
    });
  } else {
    // Check order/names
    const envStack: string[] = [];
    const envRegex = /\\(begin|end)\{([a-zA-Z0-9*]+)\}/g;
    let envMatch;
    while ((envMatch = envRegex.exec(code)) !== null) {
      const command = envMatch[1];
      const envName = envMatch[2];
      if (command === 'begin') {
        envStack.push(envName);
      } else {
        if (envStack.length === 0) {
          errors.push({
            type: 'latex',
            message: `Estructura \\end{${envName}} encontrada sin un \\begin correspondiente.`,
            severity: 'error'
          });
        } else {
          const lastEnv = envStack.pop();
          if (lastEnv !== envName) {
            errors.push({
              type: 'latex',
              message: `Estructura \\end{${envName}} no coincide con \\begin{${lastEnv}}.`,
              severity: 'error'
            });
          }
        }
      }
    }
    while (envStack.length > 0) {
      const leftOver = envStack.pop();
      errors.push({
        type: 'latex',
        message: `Falta cerrar la estructura LaTeX \\begin{${leftOver}} con \\end{${leftOver}}.`,
        severity: 'error'
      });
    }
  }

  return errors;
}
