'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

const API_URL = 'https://ceatmeuuhb.execute-api.us-east-1.amazonaws.com/dev';

const FILE_LABELS: Record<string, string> = {
  presentacion:        '📊 Presentación PowerPoint',
  orden_dia:           '📋 Orden del Día',
  guia_facilitador:    '📖 Guía de Facilitador',
  minuta_template:     '📝 Template de Minuta',
  material_referencia: '📚 Material de Referencia',
};

const ESTADO_COLOR: Record<string, string> = {
  borrador:   'bg-gray-100 text-gray-800',
  revision:   'bg-yellow-100 text-yellow-800',
  produccion: 'bg-green-100 text-green-800',
};

function EditarCTEContent() {
  const router       = useRouter();
  const params       = useSearchParams();
  const cte_id       = params.get('id') ?? '';

  const [cte, setCte]           = useState<Record<string, unknown> | null>(null);
  const [editData, setEditData] = useState<Record<string, string>>({});
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [uploadingFile, setUploadingFile] = useState<string | null>(null);

  useEffect(() => {
    if (!cte_id) { router.push('/admin/cte'); return; }
    const token = localStorage.getItem('admin_token');
    if (!token) { router.push('/admin/login'); return; }
    fetchCTE();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cte_id]);

  async function fetchCTE() {
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token') ?? '';
      const res = await fetch(`${API_URL}/admin/cte/${cte_id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCte(data);
        setEditData({
          titulo:          String(data.titulo ?? ''),
          descripcion:     String(data.descripcion ?? ''),
          notas_revision:  String(data.notas_revision ?? ''),
        });
      } else {
        alert('CTE no encontrado');
        router.push('/admin/cte');
      }
    } catch { alert('Error de red'); } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const token = localStorage.getItem('admin_token') ?? '';
      const res = await fetch(`${API_URL}/admin/cte/${cte_id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(editData),
      });
      if (res.ok) {
        fetchCTE();
      } else {
        const data = await res.json();
        alert(data.error ?? 'Error al guardar');
      }
    } catch { alert('Error de red'); } finally {
      setSaving(false);
    }
  }

  async function handleFileUpload(tipo: string, file: File) {
    setUploadingFile(tipo);
    try {
      const token = localStorage.getItem('admin_token') ?? '';

      const presignRes = await fetch(`${API_URL}/admin/cte/${cte_id}/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo_archivo: tipo }),
      });
      if (!presignRes.ok) { alert('Error obteniendo URL de subida'); return; }

      const { upload_url, fields } = await presignRes.json();

      const formData = new FormData();
      Object.entries(fields as Record<string, string>).forEach(([k, v]) => formData.append(k, v));
      formData.append('file', file);

      const uploadRes = await fetch(upload_url, { method: 'POST', body: formData });
      if (uploadRes.ok || uploadRes.status === 204) {
        fetchCTE();
      } else {
        alert('Error al subir el archivo');
      }
    } catch { alert('Error al subir'); } finally {
      setUploadingFile(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }
  if (!cte) return null;

  const archivos = (cte.archivos as Record<string, unknown>) ?? {};
  const estado   = String(cte.estado ?? 'borrador');

  return (
    <div className="p-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <Link href="/admin/cte" className="text-sm text-blue-600 hover:underline mb-2 inline-block">
            ← Volver a CTEs
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{String(cte.titulo ?? '')}</h1>
          <p className="text-gray-500 text-sm">{String(cte.mes ?? '')} {String(cte.año ?? '')}</p>
        </div>
        <span className={`px-3 py-1 rounded text-sm font-semibold capitalize ${ESTADO_COLOR[estado] ?? 'bg-gray-100 text-gray-800'}`}>
          {estado}
        </span>
      </div>

      {/* Edit form */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-bold mb-5">Información</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Título</label>
            <input
              type="text"
              value={editData.titulo}
              onChange={(e) => setEditData({ ...editData, titulo: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Descripción</label>
            <textarea
              value={editData.descripcion}
              onChange={(e) => setEditData({ ...editData, descripcion: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Notas de revisión</label>
            <textarea
              value={editData.notas_revision}
              onChange={(e) => setEditData({ ...editData, notas_revision: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition disabled:bg-gray-300"
          >
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>

      {/* Files */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-bold mb-5">Archivos</h2>
        <div className="space-y-4">
          {Object.keys(FILE_LABELS).map((tipo) => (
            <FileSection
              key={tipo}
              titulo={FILE_LABELS[tipo]}
              tipo={tipo}
              archivo={archivos[tipo] as Record<string, unknown> | null | undefined}
              onUpload={(file) => handleFileUpload(tipo, file)}
              uploading={uploadingFile === tipo}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function FileSection({
  titulo, tipo, archivo, onUpload, uploading,
}: {
  titulo: string;
  tipo: string;
  archivo: Record<string, unknown> | null | undefined;
  onUpload: (f: File) => void;
  uploading: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <h3 className="text-sm font-semibold mb-3">{titulo}</h3>

      {archivo ? (
        <div className="mb-3 px-3 py-2 bg-green-50 border border-green-200 rounded text-xs">
          <p className="font-semibold text-green-700">{String(archivo.nombre ?? tipo)}</p>
          {typeof archivo.ultima_actualizacion === 'string' && (
            <p className="text-gray-500 mt-0.5">
              v{String(archivo.version ?? 1)} · {new Date(archivo.ultima_actualizacion).toLocaleDateString('es-MX')}
            </p>
          )}
        </div>
      ) : (
        <div className="mb-3 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-700">
          Sin archivo
        </div>
      )}

      <div
        onClick={() => !uploading && inputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-4 text-center text-sm cursor-pointer transition
          ${uploading ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed' : 'border-gray-300 hover:border-blue-400 text-gray-500'}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pptx,.pdf,.docx"
          className="hidden"
          disabled={uploading}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); }}
        />
        {uploading ? '⏳ Subiendo...' : '📁 Click para subir archivo'}
      </div>
    </div>
  );
}

export default function EditarCTEPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    }>
      <EditarCTEContent />
    </Suspense>
  );
}
