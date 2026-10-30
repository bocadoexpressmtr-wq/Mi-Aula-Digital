import { TeacherProfile } from '../types/schema';

export interface ExportDocumentOptions {
  title: string;
  subtitle?: string;
  filename: string;
  profile?: TeacherProfile | null;
  bodyHtml: string;
  orientation?: 'portrait' | 'landscape';
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildInstitutionalDocumentHtml(
  options: ExportDocumentOptions
): string {
  const institutionName =
    options.profile?.institutionName || 'Institución Educativa Oficial';
  const city = options.profile?.institutionCity || 'Colombia';
  const dane = options.profile?.institutionDane
    ? `DANE: ${escapeHtml(options.profile.institutionDane)}`
    : '';
  const nit = options.profile?.institutionNit
    ? `NIT: ${escapeHtml(options.profile.institutionNit)}`
    : '';
  const teacherName = options.profile?.fullName || 'Docente Titular';
  const logoHtml = options.profile?.institutionLogoUrl
    ? `<img src="${options.profile.institutionLogoUrl}" alt="Escudo" style="width:64px;height:64px;object-fit:contain;border:1px solid #cbd5e1;border-radius:8px;padding:4px;" />`
    : `<div style="width:56px;height:56px;border-radius:8px;background:#115e59;color:#ffffff;font-weight:bold;font-size:18px;display:flex;align-items:center;justify-content:center;text-align:center;line-height:56px;">IE</div>`;

  const pageSize =
    options.orientation === 'landscape' ? 'letter landscape' : 'letter portrait';

  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40"
      lang="es">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(options.title)}</title>
  <style>
    @page {
      size: ${pageSize};
      margin: 1.5cm;
    }
    body {
      font-family: Arial, Helvetica, sans-serif;
      color: #0f172a;
      font-size: 11pt;
      line-height: 1.4;
      margin: 0;
      padding: 0;
    }
    .header-table {
      width: 100%;
      border-collapse: collapse;
      border-bottom: 2px solid #115e59;
      margin-bottom: 14px;
      padding-bottom: 10px;
    }
    .header-table td {
      vertical-align: middle;
      border: none;
      padding: 4px;
    }
    .inst-title {
      font-size: 14pt;
      font-weight: bold;
      color: #0f172a;
      margin: 0;
      text-transform: uppercase;
    }
    .inst-meta {
      font-size: 9pt;
      color: #475569;
      margin: 2px 0 0 0;
    }
    .doc-title {
      font-size: 12pt;
      font-weight: bold;
      color: #115e59;
      margin: 4px 0 0 0;
    }
    table.data-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
      margin-bottom: 14px;
      font-size: 9.5pt;
    }
    table.data-table th {
      background-color: #f1f5f9;
      color: #0f172a;
      font-weight: bold;
      text-align: left;
      border: 1px solid #cbd5e1;
      padding: 6px 8px;
    }
    table.data-table td {
      border: 1px solid #cbd5e1;
      padding: 6px 8px;
      vertical-align: top;
    }
    .section-heading {
      font-size: 11pt;
      font-weight: bold;
      color: #115e59;
      margin: 14px 0 6px 0;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 3px;
    }
    .kpi-box {
      border: 1px solid #cbd5e1;
      background-color: #f8fafc;
      padding: 8px 10px;
      border-radius: 6px;
      margin-bottom: 10px;
      font-size: 9.5pt;
    }
    .signature-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 36px;
    }
    .signature-table td {
      width: 48%;
      text-align: center;
      border: none;
      padding-top: 28px;
      font-size: 9.5pt;
    }
    .sig-line {
      border-top: 1px solid #334155;
      width: 80%;
      margin: 0 auto 4px auto;
      padding-top: 4px;
      font-weight: bold;
    }
    .page-break {
      page-break-after: always;
      break-after: page;
    }
  </style>
</head>
<body>
  <table class="header-table">
    <tr>
      <td style="width:72px;">${logoHtml}</td>
      <td>
        <p class="inst-title">${escapeHtml(institutionName)}</p>
        <p class="inst-meta">
          ${escapeHtml(city)} ${dane ? `· ${dane}` : ''} ${nit ? `· ${nit}` : ''} · Docente: ${escapeHtml(teacherName)}
        </p>
        <p class="doc-title">${escapeHtml(options.title)}</p>
        ${
          options.subtitle
            ? `<p class="inst-meta">${escapeHtml(options.subtitle)}</p>`
            : ''
        }
      </td>
      <td style="text-align:right;font-size:8.5pt;color:#64748b;width:130px;">
        Fecha de emisión:<br/>
        <strong>${new Date().toISOString().slice(0, 10)}</strong>
      </td>
    </tr>
  </table>

  ${options.bodyHtml}
</body>
</html>`;
}

/**
 * Descarga un archivo compatible con Microsoft Word (.doc) con tablas, membrete y estilos.
 */
export function exportToWordDoc(options: ExportDocumentOptions): void {
  const fullHtml = buildInstitutionalDocumentHtml(options);
  const blob = new Blob(['\ufeff', fullHtml], {
    type: 'application/msword;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const cleanName = options.filename
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/gi, '_')
    .replace(/^_+|_+$/g, '');
  link.href = url;
  link.download = `${cleanName || 'reporte_mi_aula_digital'}.doc`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * Lanza el cuadro de impresión / Guardar como PDF usando un iframe oculto
 * (Funciona dentro de iframes sin usar window.open ni romper la vista actual).
 */
export function printOrSavePdf(options: ExportDocumentOptions): void {
  const fullHtml = buildInstitutionalDocumentHtml(options);
  const existingIframe = document.getElementById(
    'mi-aula-print-frame'
  ) as HTMLIFrameElement | null;
  if (existingIframe) {
    existingIframe.remove();
  }

  const iframe = document.createElement('iframe');
  iframe.id = 'mi-aula-print-frame';
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (doc) {
    doc.open();
    doc.write(fullHtml);
    doc.close();

    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch {
        window.print();
      }
    }, 350);
  }
}
