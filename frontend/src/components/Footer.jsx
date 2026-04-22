import { Link } from 'react-router-dom';
import { Truck, Shield, CreditCard, Headphones } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-gray-50 border-t border-gray-100 mt-16">
      <div className="max-w-7xl mx-auto px-4 py-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pb-10 border-b border-gray-200">
          <Benefit icon={<Truck size={20} />} title="Frete grátis" desc="Pedidos acima de R$399" />
          <Benefit icon={<Shield size={20} />} title="Compra segura" desc="Dados protegidos" />
          <Benefit icon={<CreditCard size={20} />} title="Parcelamento" desc="Até 10x sem juros" />
          <Benefit icon={<Headphones size={20} />} title="Suporte 24h" desc="Atendimento dedicado" />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 py-10">
          <div>
            <h3 className="font-semibold mb-3">VilaVest</h3>
            <p className="text-sm text-gray-600">
              Curadoria de moda casual premium. Qualidade e design em cada peça.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-3 text-sm">Compre</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li><Link to="/" className="hover:text-black">Catálogo</Link></li>
              <li><Link to="/?featured=true" className="hover:text-black">Destaques</Link></li>
              <li><Link to="/?sort=newest" className="hover:text-black">Novidades</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-3 text-sm">Minha conta</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li><Link to="/login" className="hover:text-black">Entrar</Link></li>
              <li><Link to="/pedidos" className="hover:text-black">Pedidos</Link></li>
              <li><Link to="/rastreio" className="hover:text-black">Rastrear</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-3 text-sm">Ajuda</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li><a href="mailto:suporte@vilavest.com.br" className="hover:text-black">Contato</a></li>
              <li><a href="#" className="hover:text-black">Trocas e devoluções</a></li>
              <li><a href="#" className="hover:text-black">Política de privacidade</a></li>
            </ul>
          </div>
        </div>

        <div className="text-xs text-gray-500 text-center">
          © {new Date().getFullYear()} VilaVest. Todos os direitos reservados.
        </div>
      </div>
    </footer>
  );
}

function Benefit({ icon, title, desc }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 bg-white border border-gray-200 rounded-full flex items-center justify-center text-gray-700">
        {icon}
      </div>
      <div>
        <p className="font-medium text-sm">{title}</p>
        <p className="text-xs text-gray-500">{desc}</p>
      </div>
    </div>
  );
}
