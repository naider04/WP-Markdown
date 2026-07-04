/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BibliographyItem } from '../types';

export function cleanBraces(str: string | undefined): string {
  if (!str) return '';
  return str.replace(/[\{\}]/g, '').trim();
}

export function formatPages(pagesStr: string | undefined): string {
  if (!pagesStr) return '';
  return pagesStr.replace(/\-{2,}/g, '–').replace(/\-/g, '–').trim();
}

export function isInstitutional(authorStr: string): boolean {
  const clean = authorStr.trim().toLowerCase().replace(/[\{\}]/g, '');
  
  const institutionalKeywords = [
    'universidad', 'university', 'asociación', 'association', 'instituto', 'institute',
    'organización', 'organization', 'editorial', 'unemi', 'gobierno', 'government',
    'ministerio', 'ministry', 'corporación', 'corporation', 'sociedad', 'society',
    'grupo', 'group', 'fundación', 'foundation', 'banco', 'bank', 'comisión', 'commission',
    'consejo', 'council', 'centre', 'centro', 'laboratory', 'laboratorio', 'academy', 'academia',
    'college', 'colegio', 'research', 'investigación', 'department', 'departamento', 'facultad', 'faculty',
    'school', 'escuela', 'inst.', 'univ.', 'assoc.', 'org.'
  ];
  
  const hasKeyword = institutionalKeywords.some(keyword => clean.includes(keyword));
  if (hasKeyword) return true;

  if (clean.includes(',')) {
    return false; // Structured as Lastname, Firstname
  }
  
  const wordCount = clean.split(/\s+/).length;
  // If it has no comma and more than 3 words, it's likely an institution
  return wordCount > 3;
}

export function extractAPAYear(yearStr: string): string {
  const clean = yearStr.trim();
  if (!clean) return 's.f.';
  // Look for 4-digit year like 2024
  const match = clean.match(/\b(19|20)\d{2}\b/);
  if (match) {
    return match[0];
  }
  return clean;
}

export function parseAuthors(authorsStr: string): string[] {
  let clean = authorsStr.trim();
  if (!clean) return [];

  // Strip outermost curly braces of the entire author field if present
  while (clean.startsWith('{') && clean.endsWith('}')) {
    clean = clean.substring(1, clean.length - 1).trim();
  }

  let authors: string[] = [];

  // Check if separated by " and " (standard BibTeX)
  if (/\s+and\s+/i.test(clean)) {
    authors = clean.split(/\s+and\s+/i).map(s => s.trim()).filter(Boolean);
  } else if (clean.includes(';')) {
    // Check if separated by semicolons
    authors = clean.split(/;\s*/).map(s => s.trim()).filter(Boolean);
  } else if (clean.includes(' & ')) {
    // Check if separated by " & "
    authors = clean.split(/\s*&\s*/).map(s => s.trim()).filter(Boolean);
  } else if (clean.includes(',')) {
    // If there are commas, determine if commas are separating authors or LastName/FirstName
    const parts = clean.split(/,\s*/).map(s => s.trim()).filter(Boolean);
    if (parts.length === 2) {
      authors = [clean];
    } else if (parts.length > 2) {
      const paired: string[] = [];
      for (let i = 0; i < parts.length; i += 2) {
        if (i + 1 < parts.length) {
          paired.push(`${parts[i]}, ${parts[i+1]}`);
        } else {
          paired.push(parts[i]);
        }
      }
      authors = paired;
    } else {
      authors = [clean];
    }
  } else {
    // Otherwise, treat as a single author
    authors = [clean];
  }

  // Clean individual author tokens of ANY internal braces completely!
  authors = authors.map(a => a.replace(/[\{\}]/g, '').trim()).filter(Boolean);

  // Filter out institutional authors (affiliations wrongly placed in author field) if we have at least one individual author
  const hasRealPerson = authors.some(a => !isInstitutional(a));
  if (hasRealPerson) {
    authors = authors.filter(a => !isInstitutional(a));
  }

  return authors;
}

export function formatSingleAuthorAPA(author: string): string {
  const cleanAuthor = author.replace(/[\{\}]/g, '').trim();
  if (isInstitutional(cleanAuthor)) {
    return cleanAuthor;
  }
  
  const commaIdx = cleanAuthor.indexOf(',');
  
  if (commaIdx !== -1) {
    const lastName = cleanAuthor.substring(0, commaIdx).trim();
    const firstName = cleanAuthor.substring(commaIdx + 1).trim();
    
    const names = firstName.split(/[\s\.\-]+/).filter(Boolean);
    const initials = names.map(n => `${n[0].toUpperCase()}.`).join(' ');
    return `${lastName}, ${initials}`;
  } else {
    const words = cleanAuthor.split(/\s+/).filter(Boolean);
    if (words.length === 0) return '';
    if (words.length === 1) return words[0];
    
    const lastName = words[words.length - 1];
    const firstNames = words.slice(0, words.length - 1).join(' ');
    const names = firstNames.split(/[\s\.\-]+/).filter(Boolean);
    const initials = names.map(n => `${n[0].toUpperCase()}.`).join(' ');
    return `${lastName}, ${initials}`;
  }
}

export function formatAPAAuthorList(authorsStr: string): string {
  const authors = parseAuthors(authorsStr);
  if (authors.length === 0) return 'Sin autor';
  
  const formattedAuthors = authors.map(author => formatSingleAuthorAPA(author)).filter(Boolean);
  if (formattedAuthors.length === 0) return 'Sin autor';

  if (formattedAuthors.length === 1) {
    return formattedAuthors[0];
  }
  
  if (formattedAuthors.length === 2) {
    return `${formattedAuthors[0]} & ${formattedAuthors[1]}`;
  }
  
  if (formattedAuthors.length <= 20) {
    const allButLast = formattedAuthors.slice(0, -1).join(', ');
    return `${allButLast}, & ${formattedAuthors[formattedAuthors.length - 1]}`;
  } else {
    // APA 7th rule for more than 20 authors: first 19, then ellipsis, then last
    const first19 = formattedAuthors.slice(0, 19).join(', ');
    const lastAuthor = formattedAuthors[formattedAuthors.length - 1];
    return `${first19}, ... ${lastAuthor}`;
  }
}

export function formatSingleEditorAPA(editor: string): string {
  const cleanEditor = editor.replace(/[\{\}]/g, '').trim();
  if (isInstitutional(cleanEditor)) {
    return cleanEditor;
  }
  
  const commaIdx = cleanEditor.indexOf(',');
  
  if (commaIdx !== -1) {
    const lastName = cleanEditor.substring(0, commaIdx).trim();
    const firstName = cleanEditor.substring(commaIdx + 1).trim();
    
    const names = firstName.split(/[\s\.\-]+/).filter(Boolean);
    const initials = names.map(n => `${n[0].toUpperCase()}.`).join(' ');
    return `${initials} ${lastName}`;
  } else {
    const words = cleanEditor.split(/\s+/).filter(Boolean);
    if (words.length === 0) return '';
    if (words.length === 1) return words[0];
    
    const lastName = words[words.length - 1];
    const firstNames = words.slice(0, words.length - 1).join(' ');
    const names = firstNames.split(/[\s\.\-]+/).filter(Boolean);
    const initials = names.map(n => `${n[0].toUpperCase()}.`).join(' ');
    return `${initials} ${lastName}`;
  }
}

export function formatAPAEditorList(editorsStr: string): string {
  const editors = parseAuthors(editorsStr);
  if (editors.length === 0) return '';
  
  const formatted = editors.map(e => formatSingleEditorAPA(e)).filter(Boolean);
  if (formatted.length === 0) return '';
  
  if (formatted.length === 1) {
    return `${formatted[0]} (Ed.),`;
  }
  if (formatted.length === 2) {
    return `${formatted[0]} & ${formatted[1]} (Eds.),`;
  }
  const allButLast = formatted.slice(0, -1).join(', ');
  return `${allButLast}, & ${formatted[formatted.length - 1]} (Eds.),`;
}

export function getAPALastNames(authorsStr: string): string {
  const parsed = parseAuthors(authorsStr);
  if (parsed.length === 0) return 'Sin autor';
  
  const getLastName = (author: string) => {
    if (isInstitutional(author)) return author.trim();
    
    const cleanAuthor = author.replace(/[\{\}]/g, '').trim();
    const commaIdx = cleanAuthor.indexOf(',');
    if (commaIdx !== -1) {
      return cleanAuthor.substring(0, commaIdx).trim();
    } else {
      const words = cleanAuthor.split(/\s+/).filter(Boolean);
      return words[words.length - 1] || cleanAuthor;
    }
  };

  if (parsed.length === 1) {
    return getLastName(parsed[0]);
  }
  if (parsed.length === 2) {
    return `${getLastName(parsed[0])} & ${getLastName(parsed[1])}`;
  }
  // 3 or more authors
  return `${getLastName(parsed[0])} et al.`;
}

export function formatAPABibliographyItem(item: BibliographyItem): string {
  const authorsFormatted = formatAPAAuthorList(item.authors);
  const year = extractAPAYear(item.year);
  const title = cleanBraces(item.title);
  
  let formatted = `${authorsFormatted} (${year}). `;
  
  if (item.type === 'book') {
    formatted += `<em>${title}</em>.`;
    if (item.publisher) {
      formatted += ` ${cleanBraces(item.publisher)}.`;
    }
  } else if (item.type === 'article') {
    formatted += `${title}. `;
    if (item.journal) {
      let journalPart = `<em>${cleanBraces(item.journal)}`;
      if (item.volume) {
        journalPart += `, ${cleanBraces(item.volume)}`;
      }
      journalPart += `</em>`;
      if (item.issue) {
        journalPart += `(${cleanBraces(item.issue)})`;
      }
      if (item.pages) {
        journalPart += `, ${formatPages(item.pages)}`;
      }
      formatted += journalPart + `.`;
    } else {
      formatted += `<em>${title}</em>.`;
    }
  } else if (item.type === 'thesis') {
    formatted += `<em>${title}</em>`;
    const details: string[] = [];
    if (item.thesisType) details.push(cleanBraces(item.thesisType));
    if (item.school) details.push(cleanBraces(item.school));
    
    if (details.length > 0) {
      formatted += ` [${details.join(', ')}]`;
    }
    formatted += `.`;
    
    if (item.address) {
      formatted += ` ${cleanBraces(item.address)}.`;
    }
  } else if (item.type === 'inproceedings') {
    formatted += `${title}. `;
    let inPart = '';
    const editorFormatted = item.editor ? formatAPAEditorList(item.editor) : '';
    if (editorFormatted) {
      inPart += `In ${editorFormatted} `;
    } else {
      inPart += `In `;
    }
    
    if (item.booktitle) {
      inPart += `<em>${cleanBraces(item.booktitle)}</em>`;
    }
    
    if (item.pages) {
      inPart += ` (pp. ${formatPages(item.pages)})`;
    }
    
    if (inPart !== 'In ') {
      formatted += inPart + `.`;
    }
    
    if (item.publisher) {
      formatted += ` ${cleanBraces(item.publisher)}.`;
    }
  } else { // web
    formatted += `<em>${title}</em>.`;
    if (item.publisher) {
      formatted += ` ${cleanBraces(item.publisher)}.`;
    }
  }

  // Uniform DOI or URL handling at the end of reference (no trailing dot for URLs/DOIs in APA 7)
  let doiOrUrl = '';
  if (item.doi) {
    const cleanDoi = cleanBraces(item.doi);
    const doiUrl = cleanDoi.startsWith('http') ? cleanDoi : `https://doi.org/${cleanDoi}`;
    doiOrUrl = `<a href="${doiUrl}" target="_blank" class="text-[#004080] underline break-all">${doiUrl}</a>`;
  } else if (item.url) {
    const cleanUrl = cleanBraces(item.url);
    doiOrUrl = `<a href="${cleanUrl}" target="_blank" class="text-[#004080] underline break-all">${cleanUrl}</a>`;
  }

  if (doiOrUrl) {
    formatted += ` ${doiOrUrl}`;
  }

  return formatted;
}
