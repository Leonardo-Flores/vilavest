import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Loader2,
  Package,
  Truck,
  User as UserIcon,
  MapPin,
} from 'lucide-react';
import { ordersAPI, logisticsAPI } from '../../services/api';
import {
  formatBRL,
  formatDateTime,
  ORDER_STATUS_LABEL,
  ORDER_STATUS_COLOR,
} from '../../utils/format';

const STATUSES = Object.keys(ORDER_STATUS_LABEL);

const SHIPMENT_STATUSES = [
  { value: 'processing', label: 'Em preparação' },
  { value: 'shipped', label: 'Enviado' },
  { value: 'in_transit', label: 'Em trânsito' },
  { value: 'out_for_delivery', label: 'Saiu para entrega' },
  { value: 'delivered', label: 'Entregue' },
  { value: 'returned', label: 'Devolvido' },
  { value: 'failed', label: 'Falhou' },
];

export default function AdminOrderDetail() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [shipment, setShipment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addingEvent, setAddingEvent] = useState(false);
  const [newEvent, setNewEvent] = useState({
    status: 'in_transit',
    description: '',
    location: '',
  });

  const load = () => {
    setLoading(true);
    ordersAPI
      .adminGet(id)
      .then(({ data }) => setOrder(data))
      .catch(() => setOrder(null))
      .finally(() => setLoading(false));
    logisticsAPI
      .getShipmentForOrder(id)
      .then(({ data }) => setShipment(data))
      .catch(() => setShipment(null));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const onStatus = async (status) => {
    setSaving(true);
    try {
      await ordersAPI.updateStatus(id, status);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Falha ao atualizar status.');
    } finally {
      setSaving(false);
    }
  };

  const onAddEvent = async (e) => {
    e.preventDefault();
    if (!shipment) return;
    setAddingEvent(true);
    try {
      await logisticsAPI.addEvent(shipment.id, {
        ...newEvent,
        occurred_at: new Date().toISOString(),
      });
      setNewEvent({ status: 'in_transit', description: '', location: '' });
      load();
    } catch {
      alert('Falha ao adicionar evento.');
    } finally {
      setAddingEvent(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center text-gray-500">
        <Loader2 size={18} className="animate-spin mr-2" /> Carregando pedido…
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <p className="text-gray-500">Pedido não encontrado.</p>
        <Link
          to="/admin/pedidos"
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-black mt-4"
        >
          <ArrowLeft size={14} /> Voltar
        </Link>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <Link
          to="/admin/pedidos"
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-black mb-3"
        >
          <ArrowLeft size={14} /> Voltar para pedidos
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Pedido {order.order_number}</h1>
            <p className="text-sm text-gray-500">
              Criado em {formatDateTime(order.created_at)}
            </p>
          </div>
          <span
            className={`text-sm px-3 py-1 rounded-full font-medium ${
              ORDER_STATUS_COLOR[order.status] || 'bg-gray-100 text-gray-700'
            }`}
          >
            {ORDER_STATUS_LABEL[order.status] || order.status}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Status changer */}
          <section className="bg-white rounded-xl border border-gray-100 p-5">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Package size={14} /> Alterar status do pedido
            </h2>
            <div className="flex flex-wrap gap-2">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  disabled={saving || s === order.status}
                  onClick={() => onStatus(s)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition ${
                    s === order.status
                      ? 'border-black bg-black text-white'
                      : 'border-gray-200 hover:border-black'
                  } disabled:opacity-60`}
                >
                  {ORDER_STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </section>

          {/* Items */}
          <section className="bg-white rounded-xl border border-gray-100 p-5">
            <h2 className="text-sm font-semibold mb-3">Itens do pedido</h2>
            <ul className="divide-y divide-gray-100">
              {(order.items || []).map((it) => (
                <li
                  key={it.id}
                  className="flex items-center justify-between py-3 text-sm"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {it.image_url ? (
                        <img
                          src={it.image_url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        '🛍️'
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{it.product_name}</p>
                      <p className="text-xs text-gray-500">
                        {it.quantity}× {formatBRL(it.unit_price)}
                      </p>
                    </div>
                  </div>
                  <span className="font-medium">
                    {formatBRL(it.unit_price * it.quantity)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="pt-3 border-t mt-2 space-y-1 text-sm">
              {order.subtotal != null && (
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span>{formatBRL(order.subtotal)}</span>
                </div>
              )}
              {order.shipping_cost != null && order.shipping_cost > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>Frete</span>
                  <span>{formatBRL(order.shipping_cost)}</span>
                </div>
              )}
              {order.discount != null && order.discount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Desconto</span>
                  <span>-{formatBRL(order.discount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold pt-1">
                <span>Total</span>
                <span>{formatBRL(order.total)}</span>
              </div>
            </div>
          </section>

          {/* Shipment */}
          <section className="bg-white rounded-xl border border-gray-100 p-5">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Truck size={14} /> Envio e rastreio
            </h2>
            {shipment ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-gray-500">Código de rastreio</p>
                    <p className="font-mono font-medium">
                      {shipment.tracking_code}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Transportadora</p>
                    <p className="font-medium">{shipment.carrier || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Status</p>
                    <p className="font-medium">{shipment.status}</p>
                  </div>
                  {shipment.estimated_delivery && (
                    <div>
                      <p className="text-xs text-gray-500">Previsão</p>
                      <p className="font-medium">
                        {formatDateTime(shipment.estimated_delivery)}
                      </p>
                    </div>
                  )}
                </div>

                {(shipment.events || []).length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-700 mb-2">
                      Histórico de eventos
                    </h3>
                    <ol className="border-l-2 border-gray-200 ml-2 space-y-3">
                      {shipment.events.map((ev) => (
                        <li key={ev.id} className="ml-4 relative">
                          <span className="absolute -left-[1.4rem] top-1 h-2.5 w-2.5 rounded-full bg-black" />
                          <p className="text-sm font-medium">
                            {ev.description || ev.status}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatDateTime(ev.occurred_at || ev.created_at)}
                            {ev.location ? ` · ${ev.location}` : ''}
                          </p>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                <form
                  onSubmit={onAddEvent}
                  className="pt-4 border-t border-gray-100 space-y-3"
                >
                  <h3 className="text-xs font-semibold text-gray-700">
                    Registrar novo evento
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="text-xs text-gray-600 mb-1 block">
                        Status
                      </span>
                      <select
                        value={newEvent.status}
                        onChange={(e) =>
                          setNewEvent({ ...newEvent, status: e.target.value })
                        }
                        className={INPUT}
                      >
                        {SHIPMENT_STATUSES.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-xs text-gray-600 mb-1 block">
                        Local
                      </span>
                      <input
                        value={newEvent.location}
                        onChange={(e) =>
                          setNewEvent({ ...newEvent, location: e.target.value })
                        }
                        placeholder="Ex: CD São Paulo"
                        className={INPUT}
                      />
                    </label>
                  </div>
                  <label className="block">
                    <span className="text-xs text-gray-600 mb-1 block">
                      Descrição
                    </span>
                    <input
                      value={newEvent.description}
                      onChange={(e) =>
                        setNewEvent({ ...newEvent, description: e.target.value })
                      }
                      placeholder="Ex: Pacote saiu do centro de distribuição"
                      className={INPUT}
                    />
                  </label>
                  <div className="text-right">
                    <button
                      type="submit"
                      disabled={addingEvent}
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-black text-white rounded-full hover:bg-gray-800 disabled:opacity-60"
                    >
                      {addingEvent ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : null}
                      {addingEvent ? 'Registrando…' : 'Registrar evento'}
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                Envio ainda não criado. Ele é gerado automaticamente quando o
                pedido é marcado como pago.
              </p>
            )}
          </section>
        </div>

        {/* Side column */}
        <div className="space-y-6">
          <section className="bg-white rounded-xl border border-gray-100 p-5">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <UserIcon size={14} /> Cliente
            </h2>
            <p className="font-medium">{order.customer_name || '—'}</p>
            <p className="text-sm text-gray-600">{order.customer_email}</p>
            {order.customer_phone && (
              <p className="text-sm text-gray-600">{order.customer_phone}</p>
            )}
          </section>

          {order.shipping_address && (
            <section className="bg-white rounded-xl border border-gray-100 p-5">
              <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <MapPin size={14} /> Endereço de entrega
              </h2>
              <div className="text-sm text-gray-700 space-y-0.5">
                <p>
                  {order.shipping_address.street},{' '}
                  {order.shipping_address.number}
                </p>
                {order.shipping_address.complement && (
                  <p>{order.shipping_address.complement}</p>
                )}
                <p>
                  {order.shipping_address.neighborhood} —{' '}
                  {order.shipping_address.city}/{order.shipping_address.state}
                </p>
                <p>CEP {order.shipping_address.zip_code}</p>
              </div>
            </section>
          )}

          <section className="bg-white rounded-xl border border-gray-100 p-5">
            <h2 className="text-sm font-semibold mb-3">Pagamento</h2>
            <p className="text-sm text-gray-700">
              {order.payment_method || 'Não informado'}
            </p>
            {order.payment_status && (
              <p className="text-xs text-gray-500 mt-1">
                Status: {order.payment_status}
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

const INPUT =
  'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black';
