import React, { useState, useEffect } from 'react';
import { Upload, Plus, RefreshCw } from 'lucide-react';
import { getAllData, EXPECTED_FIELDS, saveSpreadsheetData } from '../services/spreadsheetService';
import DataTable from './DataTable';
import FileUpload from './FileUpload';
import Modal from './Modal';
import MainHeader from './MainHeader';

const Dashboard = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newNCMData, setNewNCMData] = useState({});
  const [creating, setCreating] = useState(false);

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

  const handleCreateNCM = async () => {
    if (!newNCMData['NCM']) {
      alert('Por favor, preencha o campo NCM.');
      return;
    }

    setCreating(true);
    try {
      // Criar cópia dos dados para não modificar o estado diretamente
      const dataToSave = { ...newNCMData };
      
      // Adicionar data atual se não foi preenchida
      if (!dataToSave['ultima atualização']) {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        const day = now.getDate();
        const utcDate = Date.UTC(year, month, day);
        let days = (utcDate / (86400 * 1000)) + 25569;
        if (days >= 60) {
          days = days + 1;
        }
        dataToSave['ultima atualização'] = days;
      }

      // Salvar como objeto no formato esperado pelo serviço
      await saveSpreadsheetData({
        rows: [dataToSave],
        headers: EXPECTED_FIELDS,
        sheetName: 'Manual'
      });
      
      // Recarregar dados
      loadData();
      
      setIsCreateModalOpen(false);
      setNewNCMData({});
      alert('NCM criado com sucesso!');
    } catch (error) {
      console.error('Erro ao criar NCM:', error);
      alert('Erro ao criar NCM. Tente novamente.');
    } finally {
      setCreating(false);
    }
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
            <div className="hidden md:flex items-center space-x-2">
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-white hover:bg-gray-100 text-gray-800 rounded-lg transition-colors"
              >
                <Plus className="w-5 h-5" />
                <span>Cadastrar NCM</span>
              </button>
              <button
                onClick={() => setIsUploadModalOpen(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-white hover:bg-gray-100 text-gray-800 rounded-lg transition-colors"
              >
                <Upload className="w-5 h-5" />
                <span>Upload Planilha</span>
              </button>
            </div>
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

      {/* Modal de Criar Novo NCM */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setNewNCMData({});
        }}
        title="Cadastrar Novo NCM"
      >
        <div className="space-y-4">
          {EXPECTED_FIELDS.map((field) => {
            const isNumericField = ['IVA', 'II', 'IPI', 'PIS', 'COFINS', 'ICMS', 'U$/KG considerado', 'Santos', 'Itajai'].includes(field);
            const isDateField = field === 'ultima atualização';
            
            return (
              <div key={field}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {field}:
                </label>
                {isDateField ? (
                  <input
                    type="date"
                    value={newNCMData[field] || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value) {
                        const date = new Date(value);
                        const year = date.getFullYear();
                        const month = date.getMonth();
                        const day = date.getDate();
                        const utcDate = Date.UTC(year, month, day);
                        let days = (utcDate / (86400 * 1000)) + 25569;
                        if (days >= 60) {
                          days = days + 1;
                        }
                        setNewNCMData({ ...newNCMData, [field]: days });
                      } else {
                        setNewNCMData({ ...newNCMData, [field]: '' });
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                ) : isNumericField ? (
                  <input
                    type="number"
                    step="0.0001"
                    value={newNCMData[field] || ''}
                    onChange={(e) => {
                      let value = parseFloat(e.target.value) || '';
                      const percentFields = ['IVA', 'II', 'IPI', 'PIS', 'COFINS', 'ICMS'];
                      if (percentFields.includes(field) && value > 1) {
                        value = value / 100;
                      }
                      setNewNCMData({ ...newNCMData, [field]: value });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="0"
                  />
                ) : (
                  <input
                    type="text"
                    value={newNCMData[field] || ''}
                    onChange={(e) => setNewNCMData({ ...newNCMData, [field]: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder={field === 'NCM' ? 'Ex: 39191010' : ''}
                  />
                )}
              </div>
            );
          })}

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              onClick={() => {
                setIsCreateModalOpen(false);
                setNewNCMData({});
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleCreateNCM}
              disabled={creating || !newNCMData['NCM']}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {creating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Cadastrando...</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Cadastrar NCM</span>
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Dashboard;

