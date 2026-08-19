const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  console.log('Iniciando Puppeteer para impresión de documento 16:9...');

  const browser = await puppeteer.launch({
    // Utilizar el navegador Chrome local (o remover esta línea si se usa el Chromium por defecto de Puppeteer)
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true
  });

  const page = await browser.newPage();

  // Ruta absoluta del documento a imprimir
  const filePath = 'file:///C:/Users/hp%20core%20i3/AppData/Local/Temp/Rar$EXa2344.20404/documento_formateado_imprimible.html';

  console.log(`Cargando archivo: ${filePath}`);
  await page.goto(filePath, {
    waitUntil: 'networkidle0'
  });

  console.log('Generando PDF en formato personalizado 16:9 (Landscape)...');
  
  // SOLUCIÓN DEFINITIVA:
  // Forzamos las dimensiones exactas de papel de una pantalla 16:9 estándar en milímetros.
  // 16:9 (a escala de ancho A4 de 297mm) equivale a un ancho de 297mm por un alto de 167.06mm.
  // Al pasar explícitamente "width" y "height" a Puppeteer, se anula la necesidad de que el
  // driver de impresión del sistema operativo tenga pre-instalado un tamaño de página "16:9",
  // resolviendo el error de orientación vertical no deseada (portrait).
  await page.pdf({
    path: 'documento_16x9.pdf',
    printBackground: true,
    
    // 1. Desactivamos preferCSSPageSize si el CSS tiene problemas de compatibilidad o sintaxis
    preferCSSPageSize: false, 
    
    // 2. Definimos las dimensiones de página 16:9 exactas en milímetros
    width: '297mm',
    height: '167.06mm',
    
    // 3. Forzamos la orientación horizontal
    landscape: true,
    
    // 4. Margen cero para que el layout de la app controle las dimensiones internas
    margin: {
      top: '0px',
      bottom: '0px',
      left: '0px',
      right: '0px'
    }
  });

  await browser.close();

  console.log('¡Éxito! El PDF "documento_16x9.pdf" se ha generado correctamente con dimensiones reales 16:9 horizontal.');
})();
