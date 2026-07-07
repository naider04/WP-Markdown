/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

type Token =
  | { type: 'NUMBER'; value: number }
  | { type: 'RANGE_OP' } // '..'
  | { type: 'DOT' } // '.'
  | { type: 'NOT' } // '!'
  | { type: 'LPAREN' } // '('
  | { type: 'RPAREN' } // ')'
  | { type: 'IDENTIFIER'; value: string }
  | { type: 'COMMA' }; // ','

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const char = input[i];
    if (/\s/.test(char)) {
      i++;
      continue;
    }
    if (char === '.' && input[i + 1] === '.') {
      tokens.push({ type: 'RANGE_OP' });
      i += 2;
      continue;
    }
    if (char === '.') {
      tokens.push({ type: 'DOT' });
      i++;
      continue;
    }
    if (char === '!') {
      tokens.push({ type: 'NOT' });
      i++;
      continue;
    }
    if (char === '(') {
      tokens.push({ type: 'LPAREN' });
      i++;
      continue;
    }
    if (char === ')') {
      tokens.push({ type: 'RPAREN' });
      i++;
      continue;
    }
    if (char === ',') {
      tokens.push({ type: 'COMMA' });
      i++;
      continue;
    }
    if (char === '*') {
      tokens.push({ type: 'IDENTIFIER', value: '*' });
      i++;
      continue;
    }
    if (/\d/.test(char)) {
      let numStr = '';
      while (i < input.length && /\d/.test(input[i])) {
        numStr += input[i];
        i++;
      }
      tokens.push({ type: 'NUMBER', value: parseInt(numStr, 10) });
      continue;
    }
    if (/[a-zA-Z_]/.test(char)) {
      let ident = '';
      while (i < input.length && /[a-zA-Z0-9_]/.test(input[i])) {
        ident += input[i];
        i++;
      }
      tokens.push({ type: 'IDENTIFIER', value: ident });
      continue;
    }
    i++;
  }
  return tokens;
}

class PageSyntaxParser {
  private tokens: Token[];
  private pos = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token | null {
    return this.pos < this.tokens.length ? this.tokens[this.pos] : null;
  }

  private next(): Token | null {
    return this.pos < this.tokens.length ? this.tokens[this.pos++] : null;
  }

  private match(type: string): boolean {
    const token = this.peek();
    if (token && token.type === type) {
      this.pos++;
      return true;
    }
    return false;
  }

  public parseExpression(): (currentSet: number[]) => number[] {
    // Expression is one or more dot-chains separated by commas (Union)
    const chains: ((currentSet: number[]) => number[])[] = [this.parseDotChain()];

    while (this.match('COMMA')) {
      chains.push(this.parseDotChain());
    }

    return (currentSet: number[]) => {
      const results = chains.map((chain) => chain(currentSet));
      const combinedSet = new Set(results.flat());
      return currentSet.filter((p) => combinedSet.has(p));
    };
  }

  private parseDotChain(): (currentSet: number[]) => number[] {
    let fn = this.parsePrimary();

    while (this.match('DOT')) {
      const rightFn = this.parseChainElement();
      const prevFn = fn;
      fn = (currentSet: number[]) => {
        const leftResult = prevFn(currentSet);
        return rightFn(leftResult);
      };
    }

    return fn;
  }

  private parsePrimary(): (currentSet: number[]) => number[] {
    if (this.match('NOT')) {
      const innerFn = this.parsePrimary();
      return (currentSet: number[]) => {
        const innerResult = innerFn(currentSet);
        const innerSet = new Set(innerResult);
        return currentSet.filter((p) => !innerSet.has(p));
      };
    }

    if (this.match('LPAREN')) {
      const fn = this.parseExpression();
      if (!this.match('RPAREN')) {
        console.warn('Mismatched parentheses in page syntax');
      }
      return fn;
    }

    const token = this.peek();
    if (token && token.type === 'NUMBER') {
      const numToken = this.next() as { type: 'NUMBER'; value: number };
      if (this.match('RANGE_OP')) {
        const nextToken = this.peek();
        if (nextToken && nextToken.type === 'NUMBER') {
          const endToken = this.next() as { type: 'NUMBER'; value: number };
          const start = numToken.value;
          const end = endToken.value;
          return (currentSet: number[]) => {
            const range: number[] = [];
            for (let p = start; p <= end; p++) {
              range.push(p);
            }
            const rangeSet = new Set(range);
            return currentSet.filter((p) => rangeSet.has(p));
          };
        } else {
          return (currentSet: number[]) => currentSet.filter((p) => p === numToken.value);
        }
      }
      return (currentSet: number[]) => currentSet.filter((p) => p === numToken.value);
    }

    if (token && token.type === 'IDENTIFIER') {
      return this.parseSelectorCall();
    }

    return (currentSet: number[]) => currentSet;
  }

  private parseChainElement(): (currentSet: number[]) => number[] {
    if (this.match('NOT')) {
      const innerFn = this.parseChainElement();
      return (currentSet: number[]) => {
        const innerResult = innerFn(currentSet);
        const innerSet = new Set(innerResult);
        return currentSet.filter((p) => !innerSet.has(p));
      };
    }

    if (this.peek()?.type === 'IDENTIFIER') {
      return this.parseSelectorCall();
    }

    return (currentSet: number[]) => currentSet;
  }

  private parseSelectorCall(): (currentSet: number[]) => number[] {
    const identToken = this.next() as { type: 'IDENTIFIER'; value: string };
    const name = identToken.value.toLowerCase();

    let args: number[] = [];
    if (name !== 'even' && name !== 'odd' && name !== '*' && name !== 'all' && name !== 'todas' && this.match('LPAREN')) {
      const nextToken = this.peek();
      if (nextToken && nextToken.type === 'NUMBER') {
        const argToken = this.next() as { type: 'NUMBER'; value: number };
        args.push(argToken.value);
      }
      if (!this.match('RPAREN')) {
        console.warn(`Expected closing parenthesis for selector: ${name}`);
      }
    }

    return (currentSet: number[]) => {
      if (name === 'first') {
        const n = args[0] !== undefined ? args[0] : 1;
        return currentSet.slice(0, n);
      }
      if (name === 'last') {
        const n = args[0] !== undefined ? args[0] : 1;
        return currentSet.slice(Math.max(0, currentSet.length - n));
      }
      if (name === 'even') {
        return currentSet.filter((p) => p % 2 === 0);
      }
      if (name === 'odd') {
        return currentSet.filter((p) => p % 2 !== 0);
      }
      if (name === '*' || name === 'all' || name === 'todas') {
        return currentSet;
      }
      if (name === 'every') {
        const n = args[0] !== undefined ? args[0] : 1;
        if (n <= 0) return currentSet;
        return currentSet.filter((_, idx) => idx % n === 0);
      }
      return currentSet;
    };
  }
}

/**
 * Evaluates whether a MarginElement should render on a specific page number
 * based on its target pages pattern.
 */
export function shouldShowOnPage(
  pattern: string | undefined,
  pageNumber: number,
  totalPages: number
): boolean {
  if (!pattern) return true;

  const trimmed = pattern.trim();
  const normalized = trimmed.toLowerCase();

  // Handle defaults immediately
  if (
    normalized === '' ||
    normalized === 'all' ||
    normalized === 'todas' ||
    normalized === '*'
  ) {
    return true;
  }

  try {
    const tokens = tokenize(trimmed);
    if (tokens.length === 0) return true;

    const parser = new PageSyntaxParser(tokens);
    const evaluateFn = parser.parseExpression();

    const universe = Array.from({ length: totalPages }, (_, i) => i + 1);
    const selectedPages = evaluateFn(universe);

    return selectedPages.includes(pageNumber);
  } catch (error) {
    console.error(`Error parsing selector syntax pattern: "${pattern}"`, error);
    // Graceful fallback to show on all pages
    return true;
  }
}
