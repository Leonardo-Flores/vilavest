import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCard, Lock, MapPin } from 'lucide-react';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import { useCart } from '../../context/CartContext';
import { authAPI, ordersAPI } from '../../services/api';
import { formatBRL } from '../../utils/format';

const METHODS = [
  { key: 'pix', label: 'Pix (aprovação imediata)' },
  { key: 'credit_card', label: 'Cartão de crédito' },
  { key: 'debit_card', label: 'Cartão de débito' },
  { key: 'boleto', label: 'Boleto bancário' },
];

const emptyAddress = {
  full_name: '',
  phone: '',
  street: '',
  number: '',
  complement: '',
  neighborhood: '',
  city: '',
  state: '',
  zip_code: '',
};

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { items, subtotal, clearCart } = useCart();
  const shipping = subtotal >= 399 || subtotal === 0 ? 0 : 19.9;
  const total = subtotal + shipping;

  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [address, setAddress] = useState(emptyAddress);
  const [method, setMethod] = useState('pix');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    authAPI
      .addresses()
      .then(({ data }) => {
        setAddresses(data.data || []);
        const def = (data.data || []).find((a) => a.is_default) || data.data?.[0];
        if (def) applyAddress(def);
      })
      .catch(() => {});
  }, []);

  const applyAddress = (a) => {
    setSelectedAddressId(a.id);
    setAddress({
      full_name: address.full_name || '',
      phone: address.phone || '',
      street: a.street,
      number: a.number,
      complement: a.complement || '',
      neighborhood: a.neighborhood,
      city: a.city,
      state: a.state,
      zip_code: a.zip_code,
    });
  };

  const update = (k) => (e) => setAddress({ ...address, [k]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (items.length === 0) {
      navigate('/carrinho');
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await ordersAPI.create({
        shipping_address: address,
        payment_method: method,
        notes,
      });
      await clearCart();
      navigate(`/pedidos/${data.id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Não foi possível finalizar o pedido.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <form onSubmit={onSubmit} className="max-w-6xl mx-auto px-4 py-8 w-full flex-1">
        <h1 className="text-2xl font-bold mb-6">Finalizar compra</h1>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg">{error}</div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Section
              icon={<MapPin size={18} />}
              title="Endereço de entrega"
            >
              {addresses.length > 0 && (
                <div className="mb-4 space-y-2">
                  {addresses.map((a) => (
                    <label
                      key={a.id}
                      className={`block border rounded-lg p-3 cursor-pointer text-sm ${
                        selectedAddressId === a.id
                          ? 'border-black bg-gray-50'
                          : 'border-gray-200'
                      }`}
                    >
                      <input
                        type="radio"
                        className="mr-2"
                        checked={selectedAddressId === a.id}
                        onChange={() => applyAddress(a)}
                      />
                      <span className="font-medium">{a.label}</span> — {a.street}, {a.number}
                      {a.complement && ` — ${a.complement}`}, {a.neighborhood}, {a.city}/{a.state} — {a.zip_code}
                    </label>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="Destinatário" value={address.full_name} onChange={update('full_name')} required />
                <Input placeholder="Telefone" value={address.phone} onChange={update('phone')} />
                <Input placeholder="CEP" value={address.zip_code} onChange={update('zip_code')} required className="col-span-2 md:col-span-1" />
                <Input placeholder="Rua" value={address.street} onChange={update('street')} required className="col-span-2" />
                <Input placeholder="Número" value={address.number} onChange={update('number')} required />
                <Input placeholder="Complemento" value={address.complement} onChange={update('complement')} />
                <Input placeholder="Bairro" value={address.neighborhood} onChange={update('neighborhood')} required />
                <Input placeholder="Cidade" value={address.city} onChange={update('city')} required />
                <Input placeholder="UF" value={address.state} onChange={update('state')} maxLength={2} required />
              </div>
            </Section>

            <Section icon={<CreditCard size={18} />} title="Pagamento">
              <div className="space-y-2">
                {METHODS.map((m) => (
                  <label
                    key={m.key}
                    className={`block border rounded-lg p-3 cursor-pointer text-sm ${
                      method === m.key ? 'border-black bg-gray-50' : 'border-gray-200'
                    }`}
                  >
                    <input
                      type="radio"
                      name="method"
                      className="mr-2"
                      checked={method === m.key}
                      onChange={() => setMethod(m.key)}
                    />
                    {m.label}
                  </label>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-3">
                Este é um checkout de demonstração — nenhum cartão será cobrado.
              </p>
            </Section>

            <Section title="Observações (opcional)">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Horário preferencial, ponto de referência, etc."
                className="w-full border border-gray-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-black"
              />
            </Section>
          </div>

          <aside>
            <div className="bg-white rounded-xl border border-gray-100 p-6 sticky top-24">
              <h2 className="font-bold mb-4">Resumo</h2>
              <ul className="space-y-2 text-sm mb-4 max-h-56 overflow-auto pr-1">
                {items.map((i) => (
                  <li key={i.id} className="flex justify-between">
                    <span className="text-gray-700 truncate pr-2">
                      {i.quantity}× {i.product_name}
                    </span>
                    <span className="text-gray-900 whitespace-nowrap">
                      {formatBRL(i.unit_price * i.quantity)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="border-t border-gray-100 pt-3 space-y-1 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span><span>{formatBRL(subtotal)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Frete</span>
                  <span>{shipping === 0 ? 'Grátis' : formatBRL(shipping)}</span>
                </div>
              </div>
              <div className="border-t border-gray-100 mt-3 pt-3 flex justify-between font-bold">
                <span>Total</span><span>{formatBRL(total)}</span>
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-black text-white font-medium py-3 rounded-full mt-5 hover:bg-gray-800 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                <Lock size={16} /> {submitting ? 'Enviando…' : 'Pagar pedido'}
              </button>
            </div>
          </aside>
        </div>
      </form>
      <Footer />
    </div>
  );
}

function Section({ icon, title, children }) {
  return (
    <section className="bg-white rounded-xl border border-gray-100 p-6">
      <h2 className="font-bold mb-4 flex items-center gap-2 text-gray-900">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

function Input({ className = '', ...props }) {
  return (
    <input
      {...props}
      className={
        'px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black ' +
        className
      }
    />
  );
}
