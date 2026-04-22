import { useEffect, useState } from 'react';
import { User, MapPin, Plus, Trash2, Check } from 'lucide-react';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import { authAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const emptyAddress = {
  label: 'Casa',
  full_name: '',
  phone: '',
  street: '',
  number: '',
  complement: '',
  neighborhood: '',
  city: '',
  state: '',
  zip_code: '',
  is_default: false,
};

export default function AccountPage() {
  const { user, refreshUser } = useAuth();
  const [profile, setProfile] = useState({ full_name: '', phone: '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileOk, setProfileOk] = useState(false);

  const [addresses, setAddresses] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [newAddr, setNewAddr] = useState(emptyAddress);
  const [savingAddr, setSavingAddr] = useState(false);

  useEffect(() => {
    if (user) {
      setProfile({ full_name: user.full_name || '', phone: user.phone || '' });
    }
    loadAddresses();
  }, [user]);

  const loadAddresses = () => {
    authAPI
      .addresses()
      .then(({ data }) => setAddresses(data.data || []))
      .catch(() => {});
  };

  const onSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileOk(false);
    try {
      await authAPI.updateProfile(profile);
      setProfileOk(true);
      if (refreshUser) await refreshUser();
      setTimeout(() => setProfileOk(false), 2500);
    } catch {
      alert('Não foi possível salvar.');
    } finally {
      setSavingProfile(false);
    }
  };

  const onAddAddress = async (e) => {
    e.preventDefault();
    setSavingAddr(true);
    try {
      await authAPI.addAddress(newAddr);
      setNewAddr(emptyAddress);
      setShowForm(false);
      loadAddresses();
    } catch {
      alert('Não foi possível cadastrar o endereço.');
    } finally {
      setSavingAddr(false);
    }
  };

  const onDeleteAddress = async (id) => {
    if (!confirm('Remover este endereço?')) return;
    try {
      await authAPI.deleteAddress(id);
      loadAddresses();
    } catch {
      alert('Não foi possível remover.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <div className="max-w-4xl mx-auto px-4 py-8 w-full flex-1">
        <h1 className="text-2xl font-bold mb-6">Minha conta</h1>

        <section className="bg-white rounded-xl border border-gray-100 p-6 mb-6">
          <h2 className="font-bold mb-4 flex items-center gap-2">
            <User size={18} /> Dados pessoais
          </h2>
          <form onSubmit={onSaveProfile} className="grid sm:grid-cols-2 gap-4 max-w-lg">
            <Field
              label="Nome completo"
              value={profile.full_name}
              onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
              required
            />
            <Field
              label="Telefone"
              value={profile.phone}
              onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
            />
            <div className="sm:col-span-2 text-xs text-gray-500">
              E-mail: <span className="text-gray-900">{user?.email}</span>
            </div>
            <div className="sm:col-span-2 flex items-center gap-3">
              <button
                type="submit"
                disabled={savingProfile}
                className="px-5 py-2.5 bg-black text-white rounded-full text-sm font-medium hover:bg-gray-800 disabled:opacity-60"
              >
                {savingProfile ? 'Salvando…' : 'Salvar'}
              </button>
              {profileOk && (
                <span className="text-sm text-green-600 inline-flex items-center gap-1">
                  <Check size={14} /> Dados atualizados
                </span>
              )}
            </div>
          </form>
        </section>

        <section className="bg-white rounded-xl border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold flex items-center gap-2">
              <MapPin size={18} /> Endereços
            </h2>
            <button
              onClick={() => setShowForm(!showForm)}
              className="text-sm px-3 py-1.5 rounded-full border border-gray-200 hover:border-black inline-flex items-center gap-1"
            >
              <Plus size={14} /> Novo endereço
            </button>
          </div>

          {addresses.length === 0 && !showForm && (
            <p className="text-sm text-gray-500">Nenhum endereço cadastrado ainda.</p>
          )}

          <ul className="space-y-3 mb-4">
            {addresses.map((a) => (
              <li
                key={a.id}
                className="border border-gray-100 rounded-lg p-4 flex items-start justify-between gap-3"
              >
                <div className="text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{a.label}</span>
                    {a.is_default && (
                      <span className="text-xs bg-gray-900 text-white px-2 py-0.5 rounded-full">
                        Padrão
                      </span>
                    )}
                  </div>
                  <p className="text-gray-700">
                    {a.street}, {a.number}
                    {a.complement && ` — ${a.complement}`}
                  </p>
                  <p className="text-gray-500">
                    {a.neighborhood} — {a.city}/{a.state} — CEP {a.zip_code}
                  </p>
                </div>
                <button
                  onClick={() => onDeleteAddress(a.id)}
                  className="text-red-600 hover:bg-red-50 p-2 rounded-lg"
                  title="Remover"
                >
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>

          {showForm && (
            <form
              onSubmit={onAddAddress}
              className="border-t border-gray-100 pt-4 grid sm:grid-cols-2 gap-3"
            >
              <Field
                label="Rótulo (Casa, Trabalho…)"
                value={newAddr.label}
                onChange={(e) => setNewAddr({ ...newAddr, label: e.target.value })}
                required
              />
              <Field
                label="Destinatário"
                value={newAddr.full_name}
                onChange={(e) => setNewAddr({ ...newAddr, full_name: e.target.value })}
                required
              />
              <Field
                label="CEP"
                value={newAddr.zip_code}
                onChange={(e) => setNewAddr({ ...newAddr, zip_code: e.target.value })}
                required
              />
              <Field
                label="Telefone"
                value={newAddr.phone}
                onChange={(e) => setNewAddr({ ...newAddr, phone: e.target.value })}
              />
              <Field
                label="Rua"
                value={newAddr.street}
                onChange={(e) => setNewAddr({ ...newAddr, street: e.target.value })}
                required
                className="sm:col-span-2"
              />
              <Field
                label="Número"
                value={newAddr.number}
                onChange={(e) => setNewAddr({ ...newAddr, number: e.target.value })}
                required
              />
              <Field
                label="Complemento"
                value={newAddr.complement}
                onChange={(e) => setNewAddr({ ...newAddr, complement: e.target.value })}
              />
              <Field
                label="Bairro"
                value={newAddr.neighborhood}
                onChange={(e) => setNewAddr({ ...newAddr, neighborhood: e.target.value })}
                required
              />
              <Field
                label="Cidade"
                value={newAddr.city}
                onChange={(e) => setNewAddr({ ...newAddr, city: e.target.value })}
                required
              />
              <Field
                label="UF"
                value={newAddr.state}
                onChange={(e) => setNewAddr({ ...newAddr, state: e.target.value })}
                maxLength={2}
                required
              />
              <label className="sm:col-span-2 text-sm flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={newAddr.is_default}
                  onChange={(e) =>
                    setNewAddr({ ...newAddr, is_default: e.target.checked })
                  }
                />
                Definir como endereço padrão
              </label>
              <div className="sm:col-span-2 flex gap-2">
                <button
                  type="submit"
                  disabled={savingAddr}
                  className="px-5 py-2.5 bg-black text-white rounded-full text-sm font-medium hover:bg-gray-800 disabled:opacity-60"
                >
                  {savingAddr ? 'Salvando…' : 'Salvar endereço'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-5 py-2.5 border border-gray-200 rounded-full text-sm hover:bg-gray-50"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </section>
      </div>
      <Footer />
    </div>
  );
}

function Field({ label, className = '', ...props }) {
  return (
    <label className={`block text-sm ${className}`}>
      <span className="text-xs text-gray-600 mb-1 block">{label}</span>
      <input
        {...props}
        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black"
      />
    </label>
  );
}
