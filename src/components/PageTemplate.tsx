/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { PageSettings, PageSize, CoverConfig } from '../types';
import { shouldShowOnPage } from '../utils/pageSyntaxEvaluator';

interface PageTemplateProps {
  key?: any;
  pageNumber: number;
  totalPages: number;
  pageSize: PageSize;
  settings: PageSettings;
  showGuides: boolean;
  coverConfig: CoverConfig;
  children: React.ReactNode;
  uploadedFiles?: any[];
}

function formatCoordinate(val: string | undefined): string {
  if (val === undefined || val === null) return 'auto';
  const trimmed = String(val).trim();
  if (trimmed === '') return 'auto';
  if (/^\d+$/.test(trimmed)) {
    return `${trimmed}px`;
  }
  return trimmed;
}

export default function PageTemplate({
  pageNumber,
  totalPages,
  pageSize,
  settings,
  showGuides,
  coverConfig,
  children,
  uploadedFiles,
}: PageTemplateProps) {
  const isLetter = pageSize === 'letter';
  const isA4 = pageSize === 'a4';
  const isPortrait = (settings.orientation || 'portrait') === 'portrait';

  // Dimensions in Pixels at 96 DPI:
  // Letter: 8.5" x 11" => 816px x 1056px
  // A4: 8.27" x 11.69" => 794px x 1123px
  // 16:9 widescreen presentation: 1120px x 630px
  const width = isPortrait
    ? (isLetter ? 816 : isA4 ? 794 : 630)
    : (isLetter ? 1056 : isA4 ? 1123 : 1120);

  const height = isPortrait
    ? (isLetter ? 1056 : isA4 ? 1123 : 1120)
    : (isLetter ? 816 : isA4 ? 794 : 630);

  const topMargin = settings.marginTop !== undefined ? settings.marginTop : 96;
  const bottomMargin = settings.marginBottom !== undefined ? settings.marginBottom : 96;
  const leftMargin = settings.marginLeft !== undefined ? settings.marginLeft : 96;
  const rightMargin = settings.marginRight !== undefined ? settings.marginRight : 96;

  const resolveUploadedImages = (htmlStr: string): string => {
    let processed = htmlStr;
    if (uploadedFiles && uploadedFiles.length > 0) {
      uploadedFiles.forEach((file) => {
        const escapedName = file.name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regex = new RegExp(`src=["'](?:[^"']*/)?${escapedName}["']`, 'gi');
        processed = processed.replace(regex, `src="${file.dataUrl}"`);
      });
    }
    return processed;
  };

  const resolvePageVariables = (htmlStr: string, pageNum: number, totalPagesNum: number): string => {
    let processed = htmlStr;
    
    // Page with arithmetic (e.g. {page + 1}, {page - 2}, {page})
    processed = processed.replace(/\{\s*page\s*(?:([+-])\s*(\d+))?\s*\}/gi, (match, op, num) => {
      if (!op) return String(pageNum);
      const value = parseInt(num, 10);
      if (op === '+') return String(pageNum + value);
      if (op === '-') return String(pageNum - value);
      return String(pageNum);
    });

    // Hoja or sheet with arithmetic (e.g. {hoja + 1}, {sheet - 1}, etc.)
    processed = processed.replace(/\{\s*(?:hoja|sheet)\s*(?:([+-])\s*(\d+))?\s*\}/gi, (match, op, num) => {
      if (!op) return String(pageNum);
      const value = parseInt(num, 10);
      if (op === '+') return String(pageNum + value);
      if (op === '-') return String(pageNum - value);
      return String(pageNum);
    });

    // Total with arithmetic (e.g. {total - 1}, {total})
    processed = processed.replace(/\{\s*total\s*(?:([+-])\s*(\d+))?\s*\}/gi, (match, op, num) => {
      if (!op) return String(totalPagesNum);
      const value = parseInt(num, 10);
      if (op === '+') return String(totalPagesNum + value);
      if (op === '-') return String(totalPagesNum - value);
      return String(totalPagesNum);
    });

    return processed;
  };

  // Substitute tags like {page} and {total} and resolve uploaded image base64s on the fly
  const renderTemplateHTML = (htmlStr: string | undefined, defaultContent: React.ReactNode) => {
    if (htmlStr === undefined) return defaultContent;
    if (htmlStr.trim() === '') return null; // If empty, render nothing
    
    let processed = resolvePageVariables(htmlStr, pageNumber, totalPages);
    processed = resolveUploadedImages(processed);
    
    return <div dangerouslySetInnerHTML={{ __html: processed }} className="w-full h-full flex flex-col justify-end" />;
  };

  return (
    <div
      name={`document-page-${pageNumber}`}
      className="bg-white text-gray-800 shadow-xl relative flex flex-col select-none break-after-page overflow-hidden shrink-0"
      style={{
        boxSizing: 'border-box',
        width: `${width}px`,
        height: `${height}px`,
        paddingTop: `${topMargin}px`,
        paddingBottom: `${bottomMargin}px`,
        paddingLeft: `${leftMargin}px`,
        paddingRight: `${rightMargin}px`,
      }}
    >
      {/* Margin-bypassing Elements */}
      {settings.marginElements && settings.marginElements.map((el) => {
        if (!shouldShowOnPage(el.pagesPattern, pageNumber, totalPages)) return null;
        return (
          <div
            key={el.id}
            className="unemi-margin-element"
            style={{
              position: 'absolute',
              top: formatCoordinate(el.top),
              right: formatCoordinate(el.right),
              bottom: formatCoordinate(el.bottom),
              left: formatCoordinate(el.left),
              width: formatCoordinate(el.width),
              height: formatCoordinate(el.height),
              zIndex: 35,
              pointerEvents: 'auto',
            }}
            dangerouslySetInnerHTML={{ __html: resolveUploadedImages(resolvePageVariables(el.code, pageNumber, totalPages)) }}
          />
        );
      })}
      {/* Background Image applied to all pages if enabled */}
      {coverConfig.applyBgImageToAllPages && coverConfig.backgroundImage && (
        <div 
          className="absolute inset-0 z-0 pointer-events-none"
          style={{
            backgroundImage: `url(${coverConfig.backgroundImage})`,
            backgroundSize: coverConfig.bgImageObjectFit || 'cover',
            backgroundPosition: `${coverConfig.bgImagePositionX || 'center'} ${coverConfig.bgImagePositionY || 'center'}`,
            backgroundRepeat: 'no-repeat',
            width: '100%',
            height: '100%',
          }}
        />
      )}

      {/* 1. VISUAL GUIDES OVERLAY (Highly aesthetic margin guides for debugging/layout proofing) */}
      {showGuides && (
        <div className="absolute inset-0 pointer-events-none border-2 border-dashed border-red-200/40 z-50">
          {/* Top Margin Boundary Guide */}
          <div className="absolute left-0 right-0 border-t border-dashed border-red-300/60" style={{ top: `${topMargin}px` }} />
          {/* Bottom Margin Boundary Guide */}
          <div className="absolute left-0 right-0 border-t border-dashed border-red-300/60" style={{ bottom: `${bottomMargin}px` }} />
          {/* Left Margin Boundary Guide */}
          <div className="absolute top-0 bottom-0 border-l border-dashed border-red-300/60" style={{ left: `${leftMargin}px` }} />
          {/* Right Margin Boundary Guide */}
          <div className="absolute top-0 bottom-0 border-l border-dashed border-red-300/60" style={{ right: `${rightMargin}px` }} />
          {/* Margins label indicator */}
          <span className="absolute top-2 left-2 text-[9px] font-mono text-red-500 bg-red-50/90 px-1.5 py-0.5 rounded border border-red-100 z-50">
            Márgenes T:{topMargin}px | B:{bottomMargin}px | L:{leftMargin}px | R:{rightMargin}px
          </span>
        </div>
      )}

      {/* 2. HEADER: Running academic header, placed inside top margin (Hidden if applying bg image to all pages) */}
      {!coverConfig.applyBgImageToAllPages && (
        <div 
          className="absolute h-[50px] flex flex-col justify-end pointer-events-none select-none unemi-academic-header"
          style={{ 
            boxSizing: 'border-box',
            top: `${Math.max(10, topMargin - 60)}px`,
            left: `${leftMargin}px`,
            right: `${rightMargin}px`
          }}
        >
          {renderTemplateHTML(
            settings.headerHtml,
            <>
              <div className="flex justify-between items-end text-[10px] uppercase font-bold tracking-wider pb-1 px-0.5">
                <div className="flex flex-col text-left max-w-[320px]">
                  <span style={{ color: '#004080' }}>
                    {coverConfig.institution === 'Universidad Estatal de Milagro' ? 'UNEMI' : coverConfig.institution}
                  </span>
                  <span className="text-[8px] text-gray-400 normal-case font-medium truncate">
                    {coverConfig.facultad || ''}
                  </span>
                </div>
                <div className="text-right text-gray-500 max-w-[240px] truncate animate-fade-in normal-case font-semibold">
                  {settings.headerText || "Reporte Académico"}
                </div>
              </div>
              {/* UNEMI Split Header Line */}
              <div className="h-[2px] w-full flex">
                <div className="h-full w-[25%] header-bar-orange" style={{ backgroundColor: '#FF6600' }} />
                <div className="h-full w-[75%] header-bar-blue" style={{ backgroundColor: '#004080' }} />
              </div>
            </>
          )}
        </div>
      )}

      {/* 3. CONTENT CONTAINER: Bounded strictly within the padded area */}
      <div className="flex-1 w-full h-full flex flex-col overflow-hidden text-justify relative z-10">
        <div className="unemi-document-content w-full h-full select-text leading-relaxed text-[12px] text-black">
          {children}
        </div>
      </div>

      {/* 4. FOOTER: Running document footer, placed inside bottom margin (Hidden if applying bg image to all pages) */}
      {!coverConfig.applyBgImageToAllPages && (
        <div 
          className="absolute h-[40px] flex flex-col justify-start pointer-events-none select-none unemi-academic-footer"
          style={{ 
            boxSizing: 'border-box',
            bottom: `${Math.max(10, bottomMargin - 50)}px`,
            left: `${leftMargin}px`,
            right: `${rightMargin}px`
          }}
        >
          {renderTemplateHTML(
            settings.footerHtml,
            <>
              {/* Subtle top rule for footer */}
              <div className="h-[1px] w-full bg-gray-100 mb-2 footer-line" />
              <div className="flex justify-between items-center text-[10px] text-gray-400 px-0.5">
                <div className="flex items-center gap-1.5 font-medium truncate max-w-[350px]">
                  <span className="w-1.5 h-1.5 rounded-full footer-dot" style={{ backgroundColor: '#FF6600' }} />
                  <span>{settings.footerText || "Universidad Estatal de Milagro"}</span>
                </div>
                <div className="text-[10px] tabular-nums shrink-0 unemi-page-num-indicator" style={{ color: '#004080' }}>
                  {(settings.pageNumTemplate || 'Página {page} de {total}')
                    .replace('{page}', String(pageNumber))
                    .replace('{total}', String(totalPages))}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
