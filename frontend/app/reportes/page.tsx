'use client';
import { FaFileExcel, FaFilePdf } from 'react-icons/fa';

export default function ReportesPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-800">Reportes y Exportación</h1>
                <p className="text-gray-500 text-sm mt-1">Genera y descarga reportes actualizados del inventario en formatos corporativos.</p>
            </div>

            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 flex flex-col sm:flex-row gap-6">
                <a
                    href="http://localhost:8000/api/exportar/excel"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white p-5 rounded-xl font-semibold flex items-center justify-center gap-3 shadow-sm transition">
                    <FaFileExcel className="text-2xl" />
                    <div className="text-left">
                        <div className="text-base">Exportar a Excel</div>
                        <div className="text-xs text-emerald-100 font-normal">Descarga masiva en formato .xlsx</div>
                    </div>
                </a>

                <a
                    href="http://localhost:8000/api/exportar/pdf"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 bg-rose-600 hover:bg-rose-700 text-white p-5 rounded-xl font-semibold flex items-center justify-center gap-3 shadow-sm transition">
                    <FaFilePdf className="text-2xl" />
                    <div className="text-left">
                        <div className="text-base">Exportar a PDF</div>
                        <div className="text-xs text-rose-100 font-normal">Reporte ejecutivo listo para impresión</div>
                    </div>
                </a>
            </div>
        </div>
    );
}