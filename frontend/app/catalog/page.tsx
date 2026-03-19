'use client';

import { useState, useEffect, useCallback } from 'react';
import PlaneacionCard, { Planeacion } from '@/components/PlaneacionCard';

const API_URL = 'https://ceatmeuuhb.execute-api.us-east-1.amazonaws.com/dev';

const SUBJECTS = ['Todos', 'Matemáticas', 'Español', 'Ciencias', 'Historia', 'Geografía', 'Arte'];
const GRADES = ['Todos', '1°', '2°', '3°', '4°', '5°', '6°'];
const PRICES = ['Todos', 'Gratis', 'Hasta $50', 'Hasta $100', 'Más de $100'];
const PAGE_SIZE = 9;

// Map a raw DynamoDB item to the Planeacion interface
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapItem(raw: Record<string, any>): Planeacion {
  return {
    id: String(raw.planeacionId ?? raw.id ?? ''),
    title: String(raw.titulo ?? raw.title ?? 'Sin título'),
    description: String(raw.descripcion ?? raw.description ?? ''),
    subject: String(raw.tema ?? raw.subject ?? ''),
    grade: String(raw.grado ?? raw.grade ?? ''),
    price: Number(raw.precio ?? raw.price ?? 0),
    rating: Number(raw.rating ?? 0),
    reviewCount: Number(raw.reviewCount ?? raw.review_count ?? 0),
  };
}

export default function CatalogPage() {
  const [search, setSearch] = useState('');
  const [subject, setSubject] = useState('Todos');
  const [grade, setGrade] = useState('Todos');
  const [price, setPrice] = useState('Todos');
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [rawItems, setRawItems] = useState<Planeacion[]>([]);
  const [hasMore, setHasMore] = useState(false);

  const fetchPlaneaciones = useCallback(async (tema: string, grado: string, pg: number) => {
    setIsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(pg) });
      if (tema !== 'Todos') params.set('tema', tema);
      if (grado !== 'Todos') params.set('grado', grado);

      const res = await fetch(`${API_URL}/planeaciones?${params}`);
      if (!res.ok) throw new Error('Error al cargar planeaciones');
      const data = await res.json();

      setRawItems((data.planeaciones ?? []).map(mapItem));
      setHasMore(data.has_more ?? false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar planeaciones');
      setRawItems([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Reset to page 1 when server-side filters change
  useEffect(() => {
    setPage(1);
  }, [subject, grade]);

  useEffect(() => {
    fetchPlaneaciones(subject, grade, page);
  }, [subject, grade, page, fetchPlaneaciones]);

  // Client-side filters for search and price (applied on current page's results)
  const filtered = rawItems.filter((p) => {
    if (search && !p.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (price === 'Gratis') return p.price === 0;
    if (price === 'Hasta $50') return p.price > 0 && p.price <= 50;
    if (price === 'Hasta $100') return p.price > 0 && p.price <= 100;
    if (price === 'Más de $100') return p.price > 100;
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Catálogo de Planeaciones</h1>
        <p className="text-gray-500">Explora nuestras planeaciones educativas por asignatura y grado.</p>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="search"
          placeholder="Buscar planeaciones..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          aria-label="Buscar planeaciones"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-8">
        <div>
          <label htmlFor="subject-filter" className="block text-xs font-medium text-gray-500 mb-1">Asignatura</label>
          <select
            id="subject-filter"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="grade-filter" className="block text-xs font-medium text-gray-500 mb-1">Grado</label>
          <select
            id="grade-filter"
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {GRADES.map((g) => <option key={g}>{g}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="price-filter" className="block text-xs font-medium text-gray-500 mb-1">Precio</label>
          <select
            id="price-filter"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {PRICES.map((p) => <option key={p}>{p}</option>)}
          </select>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-sm text-red-700" role="alert">
          {error}
          <button
            onClick={() => fetchPlaneaciones(subject, grade, page)}
            className="ml-3 font-semibold underline hover:no-underline"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Results count */}
      {!isLoading && !error && (
        <p className="text-sm text-gray-500 mb-4">{filtered.length} planeaciones encontradas</p>
      )}

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: PAGE_SIZE }).map((_, i) => (
            <div key={i} className="bg-gray-100 rounded-xl h-72 animate-pulse" aria-hidden="true" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <svg className="w-12 h-12 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-lg font-medium">No se encontraron planeaciones</p>
          <p className="text-sm mt-1">Intenta con otros filtros</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((p) => (
            <PlaneacionCard key={p.id} planeacion={p} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {(page > 1 || hasMore) && !isLoading && (
        <div className="flex justify-center items-center gap-4 mt-10" role="navigation" aria-label="Paginación">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Página anterior"
          >
            Anterior
          </button>
          <span className="text-sm text-gray-600 font-medium">Página {page}</span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={!hasMore}
            className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Página siguiente"
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  );
}
