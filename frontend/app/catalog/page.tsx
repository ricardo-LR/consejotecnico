'use client';

import { useState, useEffect, useCallback } from 'react';
import PlaneacionCard, { Planeacion } from '@/components/PlaneacionCard';

const SUBJECTS = ['Todos', 'Matemáticas', 'Español', 'Ciencias', 'Historia', 'Geografía', 'Arte'];
const GRADES = ['Todos', '1°', '2°', '3°', '4°', '5°', '6°'];
const PRICES = ['Todos', 'Gratis', 'Hasta $50', 'Hasta $100', 'Más de $100'];
const PAGE_SIZE = 9;

const MOCK_PLANEACIONES: Planeacion[] = Array.from({ length: 24 }, (_, i) => ({
  id: String(i + 1),
  title: `Planeación de ${SUBJECTS[(i % (SUBJECTS.length - 1)) + 1]} – Unidad ${i + 1}`,
  description: 'Planeación detallada con actividades, materiales, evaluación y competencias alineadas al plan de estudios.',
  subject: SUBJECTS[(i % (SUBJECTS.length - 1)) + 1],
  grade: GRADES[(i % (GRADES.length - 1)) + 1],
  price: i % 4 === 0 ? 0 : [49, 79, 99, 149][i % 4],
  rating: 3.5 + (i % 3) * 0.5,
  reviewCount: 5 + i * 3,
}));

export default function CatalogPage() {
  const [search, setSearch] = useState('');
  const [subject, setSubject] = useState('Todos');
  const [grade, setGrade] = useState('Todos');
  const [price, setPrice] = useState('Todos');
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [items, setItems] = useState<Planeacion[]>([]);

  const filter = useCallback(() => {
    setIsLoading(true);
    setTimeout(() => {
      let result = MOCK_PLANEACIONES;
      if (search) result = result.filter((p) => p.title.toLowerCase().includes(search.toLowerCase()));
      if (subject !== 'Todos') result = result.filter((p) => p.subject === subject);
      if (grade !== 'Todos') result = result.filter((p) => p.grade === grade);
      if (price === 'Gratis') result = result.filter((p) => p.price === 0);
      else if (price === 'Hasta $50') result = result.filter((p) => p.price > 0 && p.price <= 50);
      else if (price === 'Hasta $100') result = result.filter((p) => p.price > 0 && p.price <= 100);
      else if (price === 'Más de $100') result = result.filter((p) => p.price > 100);
      setItems(result);
      setPage(1);
      setIsLoading(false);
    }, 400);
  }, [search, subject, grade, price]);

  useEffect(() => { filter(); }, [filter]);

  const totalPages = Math.ceil(items.length / PAGE_SIZE);
  const paged = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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

      {/* Results count */}
      <p className="text-sm text-gray-500 mb-4">{items.length} planeaciones encontradas</p>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: PAGE_SIZE }).map((_, i) => (
            <div key={i} className="bg-gray-100 rounded-xl h-72 animate-pulse" aria-hidden="true" />
          ))}
        </div>
      ) : paged.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <svg className="w-12 h-12 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-lg font-medium">No se encontraron planeaciones</p>
          <p className="text-sm mt-1">Intenta con otros filtros</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {paged.map((p) => (
            <PlaneacionCard key={p.id} planeacion={p} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-10" role="navigation" aria-label="Paginación">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Página anterior"
          >
            Anterior
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              onClick={() => setPage(n)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                n === page ? 'bg-blue-600 text-white' : 'border border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
              aria-label={`Página ${n}`}
              aria-current={n === page ? 'page' : undefined}
            >
              {n}
            </button>
          ))}
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
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
