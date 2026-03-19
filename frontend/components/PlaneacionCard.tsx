import Link from 'next/link';

export interface Planeacion {
  id: string;
  title: string;
  description: string;
  subject: string;
  grade: string;
  price: number;
  rating: number;
  reviewCount: number;
  coverImage?: string;
  isPurchased?: boolean;
}

interface PlaneacionCardProps {
  planeacion: Planeacion;
}

export default function PlaneacionCard({ planeacion }: PlaneacionCardProps) {
  const { id, title, description, subject, grade, price, rating, reviewCount, coverImage, isPurchased } = planeacion;

  return (
    <article className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col">
      {/* Cover image */}
      <div className="w-full h-44 bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center overflow-hidden">
        {coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverImage} alt={`Portada de ${title}`} className="w-full h-full object-cover" />
        ) : (
          <svg className="w-16 h-16 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        )}
      </div>

      {/* Content */}
      <div className="p-5 flex flex-col flex-1">
        {/* Badges */}
        <div className="flex gap-2 mb-3 flex-wrap">
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">{subject}</span>
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full font-medium">{grade}</span>
        </div>

        <h3 className="text-base font-semibold text-gray-900 mb-1 line-clamp-2">{title}</h3>
        <p className="text-sm text-gray-500 line-clamp-2 flex-1">{description}</p>

        {/* Rating */}
        <div className="flex items-center gap-1 mt-3" aria-label={`Calificación: ${rating} de 5`}>
          {[1, 2, 3, 4, 5].map((star) => (
            <svg
              key={star}
              className={`w-4 h-4 ${star <= Math.round(rating) ? 'text-yellow-400' : 'text-gray-300'}`}
              fill="currentColor"
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          ))}
          <span className="text-xs text-gray-500 ml-1">({reviewCount})</span>
        </div>

        {/* Price + CTA */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
          <span className="text-lg font-bold text-gray-900">
            {price === 0 ? 'Gratis' : `$${price.toFixed(2)}`}
          </span>
          <Link
            href={`/catalog/${id}`}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              isPurchased
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isPurchased ? 'Ver descarga' : price === 0 ? 'Ver detalles' : 'Comprar'}
          </Link>
        </div>
      </div>
    </article>
  );
}
