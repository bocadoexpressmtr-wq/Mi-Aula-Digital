import React, { useState } from 'react';
import { Printer, FileText, FileDown } from 'lucide-react';
import { TeacherProfile } from '../../types/schema';
import {
  exportToWordDoc,
  printOrSavePdf,
  ExportDocumentOptions,
} from '../../utils/documentExporter';
import { ModalDialog, Button } from './DesignSystem';

interface ExportActionControlProps {
  label?: string;
  title: string;
  subtitle?: string;
  filename: string;
  profile?: TeacherProfile | null;
  orientation?: 'portrait' | 'landscape';
  getBodyHtml: () => string;
  onNotify?: (
    title: string,
    detail?: string,
    type?: 'success' | 'error' | 'info'
  ) => void;
  compact?: boolean;
}

export const ExportActionControl: React.FC<ExportActionControlProps> = ({
  label = 'Exportar o imprimir',
  title,
  subtitle,
  filename,
  profile,
  orientation = 'portrait',
  getBodyHtml,
  onNotify,
  compact = false,
}) => {
  const [modalOpen, setModalOpen] = useState(false);

  const buildOpts = (): ExportDocumentOptions => ({
    title,
    subtitle,
    filename,
    profile,
    orientation,
    bodyHtml: getBodyHtml(),
  });

  const handlePrintPdf = () => {
    const opts = buildOpts();
    printOrSavePdf(opts);
    onNotify?.(
      'Preparando impresión / PDF',
      `Se abrió el diálogo de impresión o guardado en PDF para "${title}".`,
      'info'
    );
    setModalOpen(false);
  };

  const handleDownloadWord = () => {
    const opts = buildOpts();
    exportToWordDoc(opts);
    onNotify?.(
      'Archivo Word descargado',
      `Se descargó "${filename}.doc" listo para abrir y editar en Microsoft Word.`,
      'success'
    );
    setModalOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className={`${
          compact ? 'min-h-[36px] px-3 py-1.5' : 'min-h-[42px] px-3.5 py-2'
        } rounded-xl border border-slate-200 bg-slate-50 hover:bg-teal-50 hover:border-teal-700 text-xs font-semibold text-teal-900 inline-flex items-center gap-1.5 cursor-pointer transition-colors shrink-0`}
      >
        <Printer className="w-3.5 h-3.5 text-teal-800" />
        <span>{label}</span>
      </button>

      <ModalDialog
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={`Exportar o Imprimir · ${title}`}
        subtitle={
          subtitle ||
          'Elige si deseas imprimir / guardar como PDF o descargar el documento editable en Word (.doc).'
        }
        maxWidth="xl"
      >
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <button
              type="button"
              onClick={handlePrintPdf}
              className="rounded-2xl border-2 border-teal-800 bg-teal-50/50 hover:bg-teal-100/60 p-5 text-left transition-all cursor-pointer flex flex-col justify-between gap-3"
            >
              <div className="h-11 w-11 rounded-xl bg-teal-800 text-white flex items-center justify-center">
                <Printer className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 font-display">
                  Imprimir o Guardar en PDF
                </p>
                <p className="text-xs text-slate-600 mt-1">
                  Abre la hoja oficial con membrete de tu institución lista para impresora o «Guardar como PDF».
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={handleDownloadWord}
              className="rounded-2xl border-2 border-slate-300 bg-white hover:border-teal-700 hover:bg-slate-50 p-5 text-left transition-all cursor-pointer flex flex-col justify-between gap-3"
            >
              <div className="h-11 w-11 rounded-xl bg-slate-900 text-white flex items-center justify-center">
                <FileDown className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 font-display">
                  Descargar en Word (.doc)
                </p>
                <p className="text-xs text-slate-600 mt-1">
                  Descarga el documento editable con tablas y formato para abrir en Microsoft Word o Google Docs.
                </p>
              </div>
            </button>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
            <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-teal-800" />
              <span>Vista previa rápida del contenido a exportar:</span>
            </p>
            <div
              className="rounded-lg border border-slate-200 bg-white p-4 max-h-[260px] overflow-y-auto text-xs text-slate-800"
              dangerouslySetInnerHTML={{
                __html: modalOpen ? getBodyHtml() : '',
              }}
            />
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalOpen(false)}
            >
              Cerrar
            </Button>
          </div>
        </div>
      </ModalDialog>
    </>
  );
};
