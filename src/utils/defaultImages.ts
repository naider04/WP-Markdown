/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { UploadedFile } from '../types';

/**
 * Imágenes predeterminadas del proyecto (carpeta /public) que se ofrecen a los
 * nuevos usuarios en el banco de imágenes (Gráficos), como si las hubieran subido.
 */
const DEFAULT_IMAGES: Array<{ name: string; path: string; description: string }> = [
  { name: 'cover.png', path: '/cover.png', description: 'Portada predeterminada del proyecto' },
  { name: 'footer-unemi.png', path: '/footer-unemi.png', description: 'Logo de pie de página UNEMI' },
  { name: 'icon.png', path: '/icon.png', description: 'Ícono del proyecto' },
  { name: 'favicon.svg', path: '/favicon.svg', description: 'Favicon del proyecto' },
];

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * Descarga las imágenes de la carpeta /public y las devuelve como archivos
 * base64 idénticos a los que genera la carga manual del usuario.
 */
export async function fetchDefaultImages(): Promise<UploadedFile[]> {
  const results = await Promise.all(
    DEFAULT_IMAGES.map(async (img, index): Promise<UploadedFile | null> => {
      try {
        const response = await fetch(img.path);
        if (!response.ok) {
          console.warn(`No se pudo cargar la imagen predeterminada ${img.name}: HTTP ${response.status}`);
          return null;
        }
        const blob = await response.blob();
        const dataUrl = await blobToDataUrl(blob);
        return {
          id: 'default_' + index + '_' + img.name.replace(/\.[^.]+$/, ''),
          name: img.name,
          type: blob.type || 'image/png',
          size: blob.size,
          dataUrl,
          uploadedAt: new Date().toISOString(),
          description: img.description,
        } satisfies UploadedFile;
      } catch (err) {
        console.error(`Error cargando la imagen predeterminada ${img.name}:`, err);
        return null;
      }
    })
  );
  return results.filter((file): file is UploadedFile => file !== null);
}
