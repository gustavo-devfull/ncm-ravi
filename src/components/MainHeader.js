import React from 'react';

const MainHeader = () => {
  const navigationLinks = [
    {
      label: 'Sistema de Cotações Online',
      url: 'https://prod-mori.vercel.app/',
      colorClass: 'bg-blue-600 hover:bg-blue-700 text-white'
    },
    {
      label: 'Exportar Cotações Online',
      url: 'https://exporta-planilha-gamma.vercel.app/',
      colorClass: 'bg-blue-500 hover:bg-blue-600 text-white'
    },
    {
      label: 'Gerenciador de Cotações',
      url: 'https://cotacoes2025.vercel.app/',
      colorClass: 'bg-green-600 hover:bg-green-700 text-white'
    },
    {
      label: 'Importar Imagens Cotações',
      url: 'https://upload-imagens.onrender.com/',
      colorClass: 'bg-green-500 hover:bg-green-600 text-white'
    },
    {
      label: 'Base de Produtos',
      url: 'https://baseravi2025.vercel.app/',
      colorClass: 'bg-orange-600 hover:bg-orange-700 text-white'
    },
    {
      label: 'Importar Imagens Base',
      url: 'https://imagens-base.vercel.app/',
      colorClass: 'bg-orange-500 hover:bg-orange-600 text-white'
    },
    {
      label: 'Controle de Pedidos',
      url: 'https://controle-pedidos-ravi.vercel.app/',
      colorClass: 'bg-white hover:bg-gray-100 text-blue-600'
    }
  ];

  return (
    <header className="bg-gray-800 shadow-md">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {navigationLinks.map((link, index) => (
            <a
              key={index}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`px-3 py-1.5 text-sm rounded transition-colors flex-1 min-w-0 text-center ${link.colorClass}`}
            >
              {link.label}
            </a>
          ))}
        </div>
      </div>
    </header>
  );
};

export default MainHeader;

