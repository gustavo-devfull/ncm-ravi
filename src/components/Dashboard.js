import React, { useState, useEffect } from 'react';
import { Upload } from 'lucide-react';
import { getAllData } from '../services/spreadsheetService';
import DataTable from './DataTable';
import FileUpload from './FileUpload';
import Modal from './Modal';
import MainHeader from './MainHeader';

const Dashboard = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const allData = await getAllData();
      setData(allData);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleUploadSuccess = () => {
    loadData();
    setIsUploadModalOpen(false);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header Principal - Navegação */}
      <MainHeader />

      {/* Header Secundário - Gestor NCM */}
      <header className="shadow-sm" style={{ backgroundColor: 'rgb(1, 117, 166)' }}>
        <div className="w-full px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <img 
                src="/RAVI-LOGO-BRANCO.svg" 
                alt="RAVI Logo" 
                className="h-[50px] w-auto"
              />
              <h1 className="text-white" style={{ fontSize: '16px', letterSpacing: '-1px', fontWeight: 600 }}>Gestor NCM</h1>
            </div>
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-white hover:bg-gray-100 text-gray-800 rounded-lg transition-colors"
            >
              <Upload className="w-5 h-5" />
              <span>Upload Planilha</span>
            </button>
          </div>
        </div>
      </header>

      <main className="w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabela de dados */}
        <DataTable data={data} loading={loading} onDataChange={loadData} />
      </main>

      {/* Modal de Upload */}
      <Modal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        title="Upload de Planilha"
      >
        <FileUpload onUploadSuccess={handleUploadSuccess} />
      </Modal>
    </div>
  );
};

export default Dashboard;

