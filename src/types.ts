/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface CoverConfig {
  institution: string;
  facultad: string;
  carrera: string;
  title: string;
  subtitle: string;
  authors: string;
  tutor: string;
  city: string;
  date: string;
  logoType: 'standard' | 'minimal' | 'modern';
  mode?: 'standard' | 'code' | 'image-overlay';
  customHtml?: string;
  backgroundImage?: string;
  overlayHtml?: string;
  bgImageWidth?: string;
  bgImageHeight?: string;
  bgImageObjectFit?: 'cover' | 'fill' | 'contain' | 'none';
  bgImagePositionX?: string;
  bgImagePositionY?: string;
  applyBgImageToAllPages?: boolean;
}

export type PageSize = 'letter' | 'a4' | '16:9';
export type PageOrientation = 'portrait' | 'landscape';

export interface PageSettings {
  pageSize: PageSize;
  orientation?: PageOrientation;
  showGuides: boolean;
  headerText: string;
  footerText: string;
  autoRefreshFile: boolean;
  showTOC?: boolean;
  tocTitle?: string;
  blockStyleTitles?: string;
  blockStyleHeader?: string;
  blockStyleFooter?: string;
  blockStylePageNum?: string;
  blockStyleTOC?: string;
  pageNumTemplate?: string;
  autoNumberHeadings?: boolean;
  
  // Margenes editables (en pixeles)
  marginTop?: number;
  marginBottom?: number;
  marginLeft?: number;
  marginRight?: number;

  // Personalización Gráfica H1
  h1Size?: string;
  h1Font?: string;
  h1Align?: string;
  h1LineHeight?: string;
  h1Indent?: string;
  h1Bold?: boolean;
  h1Italic?: boolean;
  h1Color?: string;

  // Personalización Gráfica H2
  h2Size?: string;
  h2Font?: string;
  h2Align?: string;
  h2LineHeight?: string;
  h2Indent?: string;
  h2Bold?: boolean;
  h2Italic?: boolean;
  h2Color?: string;

  // Personalización Gráfica P (Párrafos)
  pSize?: string;
  pFont?: string;
  pAlign?: string;
  pLineHeight?: string;
  pIndent?: string;
  pBold?: boolean;
  pItalic?: boolean;
  pColor?: string;

  // Personalización Gráfica de Tablas
  tableFontSize?: string;
  tableHeaderBg?: string;
  tableHeaderColor?: string;
  tableBorderColor?: string;
  tableCellPadding?: string;
  tableStriped?: boolean;
  tableBorderWidth?: string;
  tableCustomCss?: string;

  // Campo de código CSS personalizado para añadir nuevos estilos
  customAddedCss?: string;

  // Campo de código JS personalizado para añadir nuevos scripts interactivos
  customAddedJs?: string;

  // Bibliografía APA automática
  showBibliography?: boolean;
  showOnlyCitedBibliography?: boolean;
  bibliographyTitle?: string;
  headerHtml?: string;
  footerHtml?: string;
}

export interface BibliographyItem {
  id: string;
  key: string;       // Unique citation key, e.g., "patino2026"
  type: 'book' | 'article' | 'web' | 'thesis' | 'inproceedings';
  authors: string;    // Authors list, e.g., "Patiño, W., & Gómez, E."
  year: string;       // Publication year, e.g., "2026"
  title: string;      // Title of the work, e.g., "Tecnologías de la Información en el Ecuador"
  publisher?: string; // Publisher (for books)
  journal?: string;   // Journal name (for articles)
  volume?: string;    // Journal volume
  issue?: string;     // Journal issue
  pages?: string;     // Journal pages
  url?: string;       // URL (for web/articles)
  retrievedDate?: string; // Retrieved date (for web)
  school?: string;       // School/institution for thesis
  thesisType?: string;   // Type of thesis (e.g. Doctoral dissertation, Master's thesis)
  address?: string;      // Location/address for thesis or publisher
  booktitle?: string;    // Book/proceedings title for inproceedings
  editor?: string;       // Editor for inproceedings or book chapters
  doi?: string;          // DOI for articles, books, chapters
}

export interface UploadedFile {
  id: string;
  name: string;
  type: string;
  size: number;
  dataUrl: string; // Base64 data string
  uploadedAt: string;
}

export interface HTMLBlock {
  id: string;
  name: string;
  code: string;
  collapsed: boolean;
  isFunctional?: boolean;
  isMarkdown?: boolean;
}

export interface DocumentState {
  cover: CoverConfig;
  settings: PageSettings;
  htmlContent: string;
  uploadedFiles?: UploadedFile[];
  htmlBlocks?: HTMLBlock[];
  bibliography?: BibliographyItem[];
}
