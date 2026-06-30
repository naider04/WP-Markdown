/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { CoverConfig, PageSize } from '../types';

interface CoverPageProps {
  config: CoverConfig;
  pageSize: PageSize;
  orientation?: 'portrait' | 'landscape';
}

export default function CoverPage({ config, pageSize, orientation = 'portrait' }: CoverPageProps) {
  const isLetter = pageSize === 'letter';
  const isA4 = pageSize === 'a4';
  const isPortrait = orientation === 'portrait';

  // Estado para forzar re-renderización
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [imageKey, setImageKey] = useState(Date.now()); // Fuerza recarga de imagen

  // Calcular dimensiones dinámicamente
  const width = isPortrait
    ? (isLetter ? 816 : isA4 ? 794 : 630)
    : (isLetter ? 1056 : isA4 ? 1123 : 1120);

  const height = isPortrait
    ? (isLetter ? 1056 : isA4 ? 1123 : 1120)
    : (isLetter ? 816 : isA4 ? 794 : 630);

  // Actualizar dimensiones cuando cambien las props
  useEffect(() => {
    setDimensions({ width, height });
    setImageKey(Date.now()); // FORZAR recarga de la imagen
    console.log(`📐 Portada redimensionada a: ${width}x${height} (${pageSize} - ${orientation})`);
  }, [pageSize, orientation, width, height]);

  // Renderizar únicamente el diseño de Fondo + Capa (Overlay)
  const currentWidth = dimensions.width || width;
  const currentHeight = dimensions.height || height;
  const bgImage = config.backgroundImage || '';

  // Plantilla de fallback por defecto para el overlay si está vacío
  const defaultOverlayHtml = '';

  const finalOverlayHtml = config.overlayHtml !== undefined ? config.overlayHtml : defaultOverlayHtml;

  return (
    <div
      id="unemi-cover-page"
      className="relative bg-white text-gray-800 shadow-xl border border-gray-100 overflow-hidden shrink-0 select-none break-after-page"
      style={{ 
        boxSizing: 'border-box', 
        width: `${currentWidth}px`, 
        height: `${currentHeight}px`,
        position: 'relative',
        containerType: 'size',
        '--cover-width': `${currentWidth}px`,
        '--cover-height': `${currentHeight}px`,
        '--cover-padding-y': `${Math.round(currentHeight * 0.075)}px`,
        '--cover-padding-x': `${Math.round(currentWidth * 0.08)}px`,
      } as React.CSSProperties}
    >
      {bgImage && (
        <img
          key={imageKey}
          src={bgImage}
          alt="Cover background"
          className="absolute inset-0"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'fill',
            objectPosition: 'center center',
            pointerEvents: 'none',
          }}
          onLoad={() => console.log(`✅ Imagen overlay de la carátula cargada correctamente`)}
          onError={() => console.error('❌ Error cargando imagen de fondo de carátula: ' + bgImage)}
        />
      )}
      <div 
        className="relative z-10 w-full h-full"
        dangerouslySetInnerHTML={{ __html: finalOverlayHtml }}
      />
    </div>
  );
}