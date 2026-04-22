import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Package,
  MapPin,
  CreditCard,
  Truck,
  CheckCircle2,
  Clock,
  XCircle,
  ChevronLeft,
} from 'lucide-react';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import { ordersAPI, logisticsAPI } from '../../services/api';
import {
  formatBRL,
  formatDateTime,
  ORDER_STATUS_LABEL,
  ORDER_STATUS_COLOR,
} from '../../utils/format';

const PAYMENT_LABEL = {
  pix: 'Pix',
  credit_card: 'Cartão de crédito',
  debit_card: 'Cartão de débito',
  boleto: 'Boleto bancário',
};

export default function OrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [order, setOrder] = useState(null);
  const [shipment, setShipment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const { data } = await ordersAPI.getById(id);
      setOrder(data);
      logisticsAPI
        .getShipmentForOrder(id)
        .then(({ data }) => setShipment(data))
        .catch(() => setShipment(null));
    } catch (err) {
      setError(err.response?.data?.error || 'Pedido não encontrado.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const onCancel = async () => {
    if (!confirm('Tem certeza que deseja cancelar este pedido?')) return;
    setCancelling(true);
    try {
      await ordersAPI.cancel(id);
      await load();
    } catch (err) {
      alert(err.response?.data?.error || 'Não foi possível cancelar.');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <PageShell>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-100 rounded w-1/3" />
          <div className="h-40 bg-gray-100 rounded-xl" />
          <div className="h-64 bg-gray-100 rounded-xl" />
        </div>
      </PageShell>
    );
  }

  if (error || !order) {
    return (
      <PageShell>
        <div className="text-center py-20">
          <p className="text-gray-500 mb-4">{error}</p>
          <Link to="/pedidos" className="text-black underline">
            Ver meus pedidos
          </Link>
        </div>
      </PageShell>
    );
  }

  const canCancel = ['pending', 'paid'].includes(order.status);
  const statusColor = ORDER_STATUS_COLOR[order.status] || 'bg-gray-100 text-gray-700';

  return (
    <PageShell>
      <button
        onClick={() => navigate(-1)}
        className="text-sm text-gray-600 hover:text-black inline-flex items-center gap-1 mb-4"
      >
        <ChevronLeft size={16} /> Voltar
      </button>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Pedido {order.order_number}</h1>
          <p className="text-sm text-gray-500 mt-1">
            Feito em {formatDateTime(order.created_at)}
          </p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColor}`}>
          {ORDER_STATUS_LABEL[order.status] || order.status}
        </span>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Items */}
          <Card title="Itens do pedido" icon={<Package size={18} />}>
            <ul className="divide-y divide-gray-100">
              {(order.items || []).map((it) => (
                <li key={it.id} className="py-3 flex gap-4 items-center">
                  <div className="w-14 h-14 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                    {it.product_image ? (
                      <img
                        src={it.product_image}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xl opacity-40">
                        🛍️
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link
                      to={`/produto/${it.product_slug}`}
                      className="text-sm font-medium text-gray-900 hover:text-black line-clamp-2"
                    >
                      {it.product_name}
                    </Link>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {it.quantity} × {formatBRL(it.unit_price)}
                    </p>
                  </div>
                  <div className="text-sm font-semibold">
                    {formatBRL(it.unit_price * it.quantity)}
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          {/* Shipment timeline */}
          <Card
            title="Rastreamento"
            icon={<Truck size={18} />}
            action={
              shipment?.tracking_code && (
                <Link
                  to={`/rastreio/${shipment.tracking_code}`}
                  className="text-xs text-black underline"
                >
                  Página pública →
                </Link>
              )
            }
          >
            {shipment ? (
              <ShipmentTimeline shipment={shipment} />
            ) : (
              <p className="text-sm text-gray-500">
                Envio ainda não foi gerado. Atualizaremos aqui assim que o pedido sair para
                entrega.
              </p>
            )}
          </Card>

          {/* Address */}
          <Card title="Endereço de entrega" icon={<MapPin size={18} />}>
            {order.shipping_address ? (
              <div className="text-sm text-gray-700 leading-relaxed">
                <p className="font-medium text-gray-900">
                  {order.shipping_address.full_name}
                </p>
                {order.shipping_address.phone && (
                  <p className="text-gray-500">{order.shipping_address.phone}</p>
                )}
                <p className="mt-1">
                  {order.shipping_address.street}, {order.shipping_address.number}
                  {order.shipping_address.complement
                    ? ` — ${order.shipping_address.complement}`
                    : ''}
                </p>
                <p>
                  {order.shipping_address.neighborhood} —{' '}
                  {order.shipping_address.city}/{order.shipping_address.state}
                </p>
                <p className="text-gray-500">CEP {order.shipping_address.zip_code}</p>
              </div>
            ) : (
              <p className="text-sm text-gray-500">Sem endereço informado.</p>
            )}
          </Card>

          {/* Notes */}
          {order.notes && (
            <Card title="Observações">
              <p className="text-sm text-gray-700 whitespace-pre-line">{order.notes}</p>
            </Card>
          )}
        </div>

        {/* Summary */}
        <aside className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 p-6 sticky top-24">
            <h2 className="font-bold mb-4 flex items-center gap-2">
              <CreditCard size={16} /> Pagamento
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Método:{' '}
              <span className="font-medium text-gray-900">
                {PAYMENT_LABEL[order.payment_method] || order.payment_method}
              </span>
            </p>
            <div className="border-t border-gray-100 pt-3 space-y-2 text-sm">
              <Row label="Subtotal" value={formatBRL(order.subtotal)} />
              <Row
                label="Frete"
                value={
                  Number(order.shipping_cost) === 0
                    ? 'Grátis'
                    : formatBRL(order.shipping_cost)
                }
              />
              {Number(order.discount) > 0 && (
                <Row label="Desconto" value={`-${formatBRL(order.discount)}`} />
              )}
            </div>
            <div className="border-t border-gray-100 mt-3 pt-3 flex justify-between font-bold">
              <span>Total</span>
              <span>{formatBRL(order.total)}</span>
            </div>

            {canCancel && (
              <button
                onClick={onCancel}
                disabled={cancelling}
                className="mt-5 w-full border border-red-200 text-red-700 text-sm font-medium py-2.5 rounded-full hover:bg-red-50 disabled:opacity-60"
              >
                {cancelling ? 'Cancelando…' : 'Cancelar pedido'}
              </button>
            )}
            <Link
              to="/pedidos"
              className="block text-center text-sm text-gray-600 mt-3 hover:text-black"
            >
              Ver todos os pedidos
            </Link>
          </div>
        </aside>
      </div>
    </PageShell>
  );
}

function ShipmentTimeline({ shipment }) {
  const events = shipment.events || [];
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <span className="font-medium text-gray-900">
          {shipment.tracking_code || '—'}
        </span>
        {shipment.carrier && (
          <span className="text-gray-500">Transportadora: {shipment.carrier}</span>
        )}
        {shipment.estimated_delivery && (
          <span className="text-gray-500">
            Previsão: {formatDateTime(shipment.estimated_delivery)}
          </span>
        )}
      </div>
      {events.length === 0 ? (
        <p className="text-sm text-gray-500">
          Nenhum evento de rastreio registrado ainda.
        </p>
      ) : (
        <ol className="relative border-l border-gray-200 ml-3 space-y-4">
          {events.map((ev, idx) => (
            <li key={ev.id || idx} className="ml-4">
              <span className="absolute -left-1.5 mt-1 flex h-3 w-3 items-center justify-center rounded-full bg-black" />
              <p className="text-sm font-medium text-gray-900">
                {ev.description || ev.status}
              </p>
              {ev.location && (
                <p className="text-xs text-gray-500">{ev.location}</p>
              )}
              <p className="text-xs text-gray-400 mt-0.5">
                {formatDateTime(ev.occurred_at || ev.created_at)}
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function Card({ title, icon, action, children }) {
  return (
    <section className="bg-white rounded-xl border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold flex items-center gap-2 text-gray-900">
          {icon}
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-600">{label}</span>
      <span className="text-gray-900">{value}</span>
    </div>
  );
}

function PageShell({ children }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <div className="max-w-6xl mx-auto px-4 py-8 w-full flex-1">{children}</div>
      <Footer />
    </div>
  );
}
