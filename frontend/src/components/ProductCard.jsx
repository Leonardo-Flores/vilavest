import { Link } from 'react-router-dom';
import { ShoppingCart } from 'lucide-react';
import { formatBRL } from '../utils/format';

export default function ProductCard({ product, onAddToCart }) {
  const discount = product.compare_at_price
    ? Math.round((1 - product.price / product.compare_at_price) * 100)
    : null;
  const image = product.images?.[0]?.url;

  return (
    <div className="group relative bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-lg hover:shadow-black/5 transition-all duration-300 hover:-translate-y-1 flex flex-col">
      <Link to={`/produto/${product.slug}`} className="block">
        <div className="relative aspect-[4/5] bg-gray-50 overflow-hidden">
          {image ? (
            <img
              src={image}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
              <span className="text-5xl opacity-30">🛍️</span>
            </div>
          )}

          <div className="absolute top-3 left-3 flex flex-col gap-1.5">
            {product.is_featured && (
              <span className="bg-black text-white text-[10px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider">
                Destaque
              </span>
            )}
            {discount && (
              <span className="bg-red-500 text-white text-[10px] font-semibold px-2.5 py-1 rounded-full">
                -{discount}%
              </span>
            )}
            {product.stock_quantity === 0 && (
              <span className="bg-gray-900/80 text-white text-[10px] font-semibold px-2.5 py-1 rounded-full">
                Indisponível
              </span>
            )}
          </div>
        </div>
      </Link>

      <div className="p-4 flex flex-col flex-1">
        {product.brand && (
          <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-1">{product.brand}</p>
        )}
        <Link
          to={`/produto/${product.slug}`}
          className="font-medium text-sm text-gray-900 line-clamp-2 hover:text-black mb-2 min-h-[40px]"
        >
          {product.name}
        </Link>

        <div className="mt-auto">
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-lg font-bold text-gray-900">{formatBRL(product.price)}</span>
            {product.compare_at_price && (
              <span className="text-xs text-gray-400 line-through">
                {formatBRL(product.compare_at_price)}
              </span>
            )}
          </div>

          <button
            onClick={() => onAddToCart?.(product)}
            disabled={product.stock_quantity === 0}
            className="w-full bg-black text-white text-sm font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 hover:bg-gray-800 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            <ShoppingCart size={16} />
            {product.stock_quantity === 0 ? 'Indisponível' : 'Adicionar'}
          </button>
        </div>
      </div>
    </div>
  );
}
