import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Header from '../../components/Header';
import { useAuth } from '../../context/AuthContext';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const update = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password.length < 8) {
      setError('A senha precisa ter ao menos 8 caracteres.');
      return;
    }
    setLoading(true);
    try {
      await register(form);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Não foi possível criar sua conta.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <h1 className="text-2xl font-bold mb-1">Criar conta</h1>
          <p className="text-sm text-gray-500 mb-6">Leva menos de um minuto.</p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg">{error}</div>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            <Input placeholder="Nome completo" value={form.full_name} onChange={update('full_name')} required />
            <Input type="email" placeholder="E-mail" value={form.email} onChange={update('email')} required />
            <Input placeholder="Telefone (opcional)" value={form.phone} onChange={update('phone')} />
            <Input
              type="password"
              placeholder="Senha (mín. 8 caracteres)"
              value={form.password}
              onChange={update('password')}
              required
              minLength={8}
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-black text-white font-medium py-3 rounded-lg hover:bg-gray-800 disabled:opacity-60"
            >
              {loading ? 'Criando…' : 'Criar conta'}
            </button>
          </form>

          <p className="text-sm text-gray-600 mt-6 text-center">
            Já tem conta?{' '}
            <Link to="/login" className="text-black font-medium underline">
              Entrar
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function Input(props) {
  return (
    <input
      {...props}
      className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
    />
  );
}
