import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Search, Truck, Package, MapPin, Clock } from 'lucide-react';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import { logisticsAPI } from '../../services/api';
import { formatDateTime } from '../../utils/format';

const SHIPMENT_STATUS_LABEL = {
  pending: 'Aguardando postagem',
  processing: 'Em preparação',
  shipped: 'Enviado',
  in_transit: 'Em trânsito',
  out_for_delivery: 'Saiu para entrega',
  delivered: 'Entregue',
  returned: 'Devolvido',
  failed: 'Falha na entrega',
};

export default function TrackingPage() {
  const { code: codeParam } = useParams();
  const navigate = useNavigate();
  const [code, setCode] = useState(codeParam || '');
  const [shipment, setShipment] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetch = async (c) => {
    if (!c) return;
    setLoading(true);
    setError('');
    try {
      const { data } = await logisticsAPI.trackByCode(c.trim());
      setShipment(data);
    } catch (err) {
      setShipment(null);
      setError(
        err.response?.status === 404
          ? 'Código de rastreio não encontrado.'
          : 'Não foi possível consultar o rastreio agora.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (codeParam) fetch(codeParam);
  }, [codeParam]);

  const onSubmit = (e) => {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;
    navigate(`/rastreio/${trimmed}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <div className="max-w-3xl mx-auto px-4 py-10 w-full flex-1">
        <h1 className="text-2xl font-bold mb-2">Rastrear pedido</h1>
        <p className="text-sm text-gray-500 mb-6">
          Digite o código de rastreio que você recebeu por e-mail para ver o status em tempo
          real.
        </p>

        <form onSubmit={onSubmit} className="flex gap-2 mb-8">
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Ex.: BR123456789BR"
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>
          <button
            type="submit"
            className="px-6 bg-black text-white text-sm font-medium rounded-full hover:bg-gray-800"
          >
            Rastrear
          </button>
        </form>

        {loading && (
          <div className="bg-white rounded-xl border border-gray-100 p-6 animate-pulse space-y-3">
            <div className="h-4 bg-gray-100 rounded w-1/3" />
            <div className="h-4 bg-gray-100 rounded w-1/2" />
            <div className="h-4 bg-gray-100 rounded w-2/3" />
          </div>
        )}

        {error && !loading && (
          <div className="bg-red-50 text-red-700 rounded-xl p-4 text-sm">{error}</div>
        )}

        {shipment && !loading && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-100 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">
                    Código
                  </p>
                  <p className="font-bold text-lg">{shipment.tracking_code}</p>
                </div>
                <span className="px-3 py-1 rounded-full bg-gray-900 text-white text-xs font-medium">
                  {SHIPMENT_STATUS_LABEL[shipment.status] || shipment.status}
                </span>
              </div>
              <div className="grid sm:grid-cols-2 gap-4 text-sm">
                <InfoBox
                  icon={<Truck size={16} />}
                  label="Transportadora"
                  value={shipment.carrier || '—'}
                />
                <InfoBox
                  icon={<Clock size={16} />}
                  label="Previsão de entrega"
                  value={
                    shipment.estimated_delivery
                      ? formatDateTime(shipment.estimated_delivery)
                      : '—'
                  }
                />
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-6">
              <h2 className="font-bold mb-4 flex items-center gap-2">
                <MapPin size={18} /> Histórico
              </h2>
              {(shipment.events || []).length === 0 ? (
                <p className="text-sm text-gray-500">
                  Nenhum evento registrado ainda. Volte em breve.
                </p>
              ) : (
                <ol className="relative border-l border-gray-200 ml-3 space-y-4">
                  {shipment.events.map((ev, idx) => (
                    <li key={ev.id || idx} className="ml-4">
                      <span
                        className={`absolute -left-1.5 mt-1 h-3 w-3 rounded-full ${
                          idx === 0 ? 'bg-black' : 'bg-gray-300'
                        }`}
                      />
                      <p className="text-sm font-medium text-gray-900">
                        {ev.description ||
                          SHIPMENT_STATUS_LABEL[ev.status] ||
                          ev.status}
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
          </div>
        )}

        {!shipment && !loading && !error && (
          <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
            <Package size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm text-gray-500">
              Informe o código acima para visualizar o status.
            </p>
            <Link
              to="/pedidos"
              className="text-sm text-black underline mt-3 inline-block"
            >
              Ver meus pedidos
            </Link>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}

function InfoBox({ icon, label, value }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
        {icon}
        {label}
      </p>
      <p className="font-medium text-gray-900 text-sm">{value}</p>
    </div>
  );
}
