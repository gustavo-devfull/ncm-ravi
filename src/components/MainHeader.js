import React, { useState } from 'react';
import { ShoppingCart, ClipboardList, Package, ShoppingBag, ChevronUp, ChevronDown } from 'lucide-react';

const MainHeader = () => {
  const [isCollapsed, setIsCollapsed] = useState(true);

  const navigationLinks = [
    {
      label: 'Sistemas Cotações Online',
      url: 'https://prod-mori.vercel.app/',
      icon: ShoppingCart,
      colorClass: 'bg-blue-600 hover:bg-blue-700 text-white'
    },
    {
      label: 'Gerenciador de Cotações',
      url: 'https://cotacoes2025.vercel.app/',
      icon: ClipboardList,
      colorClass: 'bg-green-600 hover:bg-green-700 text-white'
    },
    {
      label: 'Base de Produtos',
      url: 'https://baseravi2025.vercel.app/',
      icon: Package,
      colorClass: 'bg-orange-600 hover:bg-orange-700 text-white'
    },
    {
      label: 'Controle Pedidos',
      url: 'https://controle-pedidos-ravi.vercel.app/',
      icon: ShoppingBag,
      colorClass: 'bg-purple-600 hover:bg-purple-700 text-white'
    }
  ];

  return (
    <header className={`bg-gray-800 shadow-md relative transition-all duration-300 ${isCollapsed ? 'pb-6' : ''}`}>
      {/* Botão de Colapsar/Expandir */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 z-10 bg-gray-800 hover:bg-gray-700 text-white p-2 rounded-full shadow-lg transition-all"
        aria-label={isCollapsed ? 'Expandir menu' : 'Colapsar menu'}
      >
        {isCollapsed ? (
          <ChevronDown className="w-5 h-5" />
        ) : (
          <ChevronUp className="w-5 h-5" />
        )}
      </button>

      {!isCollapsed && (
        <div className="w-full px-4 sm:px-6 lg:px-8 py-4">
          {/* Menu Desktop - Grid com Boxes */}
          <div className="hidden md:grid grid-cols-4 gap-4">
            {navigationLinks.map((link, index) => {
              const IconComponent = link.icon;
              return (
                <a
                  key={index}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${link.colorClass} rounded-lg p-4 transition-all hover:shadow-lg hover:scale-105 flex flex-col items-center justify-center space-y-3 min-h-[120px]`}
                >
                  <div className="bg-white/20 rounded-lg p-3">
                    <IconComponent className="w-8 h-8" />
                  </div>
                  <span className="text-sm font-medium text-center">{link.label}</span>
                </a>
              );
            })}
          </div>

          {/* Menu Mobile - Grid com Boxes - Mostra automaticamente quando expandido */}
          <div className="md:hidden grid grid-cols-2 gap-3">
            {navigationLinks.map((link, index) => {
              const IconComponent = link.icon;
              return (
                <a
                  key={index}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setIsCollapsed(true)}
                  className={`${link.colorClass} rounded-lg p-4 transition-all hover:shadow-lg flex flex-col items-center justify-center space-y-2 min-h-[100px]`}
                >
                  <div className="bg-white/20 rounded-lg p-2">
                    <IconComponent className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-medium text-center">{link.label}</span>
                </a>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
};

export default MainHeader;

