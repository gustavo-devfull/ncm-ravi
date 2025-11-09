import React, { useState, useMemo } from 'react';
import { Search, Download, RefreshCw, Edit2, Save, X, Trash2, Plus } from 'lucide-react';
import * as XLSX from 'xlsx';
import { EXPECTED_FIELDS, updateData, deleteData, deleteMultipleData, saveSpreadsheetData } from '../services/spreadsheetService';
import { getNCMDescription } from '../services/ncmService';
import Modal from './Modal';

const DataTable = ({ data, loading, onDataChange }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);
  const [sortConfig, setSortConfig] = useState({ key: 'NCM', direction: 'asc' });
  const [editingId, setEditingId] = useState(null);
  const [editingData, setEditingData] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [deletingMultiple, setDeletingMultiple] = useState(false);
  const [ncmModalOpen, setNcmModalOpen] = useState(false);
  const [selectedNCM, setSelectedNCM] = useState(null);
  const [selectedNCMItem, setSelectedNCMItem] = useState(null);
  const [ncmDescription, setNcmDescription] = useState(null);
  const [editableDescription, setEditableDescription] = useState('');
  const [loadingNCM, setLoadingNCM] = useState(false);
  const [savingDescription, setSavingDescription] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newNCMData, setNewNCMData] = useState({});
  const [creating, setCreating] = useState(false);

  // Usar os campos esperados na ordem definida
  const columns = useMemo(() => {
    if (!data || data.length === 0) return EXPECTED_FIELDS;
    
    // Verificar quais campos existem nos dados
    const availableFields = new Set();
    data.forEach(item => {
      EXPECTED_FIELDS.forEach(field => {
        if (field in item) {
          availableFields.add(field);
        }
      });
    });
    
    // Retornar campos na ordem esperada, apenas os que existem
    return EXPECTED_FIELDS.filter(field => availableFields.has(field));
  }, [data]);

  // Filtrar e ordenar dados
  const filteredAndSortedData = useMemo(() => {
    if (!data) return [];

    let filtered = data.filter(item => {
      if (!searchTerm) return true;
      
      const searchLower = searchTerm.toLowerCase();
      return Object.values(item).some(value => {
        if (value === null || value === undefined) return false;
        return String(value).toLowerCase().includes(searchLower);
      });
    });

    if (sortConfig.key) {
      filtered.sort((a, b) => {
        let aValue = a[sortConfig.key] || '';
        let bValue = b[sortConfig.key] || '';
        
        // Ordenação especial para NCM (como número)
        if (sortConfig.key === 'NCM') {
          const aNCM = String(aValue).replace(/\D/g, '');
          const bNCM = String(bValue).replace(/\D/g, '');
          aValue = parseInt(aNCM) || 0;
          bValue = parseInt(bNCM) || 0;
        }
        // Tentar converter para número se for campo numérico
        else {
          const numericFields = ['IVA', 'II', 'IPI', 'PIS', 'COFINS', 'ICMS', 'U$/KG considerado', 'Santos', 'Itajai'];
          if (numericFields.includes(sortConfig.key)) {
            aValue = parseFloat(aValue) || 0;
            bValue = parseFloat(bValue) || 0;
          }
        }
        
        if (sortConfig.direction === 'asc') {
          return aValue > bValue ? 1 : -1;
        } else {
          return aValue < bValue ? 1 : -1;
        }
      });
    }

    return filtered;
  }, [data, searchTerm, sortConfig]);

  // Paginação
  const totalPages = Math.ceil(filteredAndSortedData.length / itemsPerPage);
  const paginatedData = filteredAndSortedData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Função para formatar NCM (xxxx.xx.xx)
  const formatNCM = (ncm) => {
    if (!ncm) return '-';
    const ncmStr = String(ncm).replace(/\D/g, ''); // Remove não-números
    if (ncmStr.length < 8) return ncmStr; // Se não tiver 8 dígitos, retorna como está
    
    // Formata como xxxx.xx.xx
    return `${ncmStr.substring(0, 4)}.${ncmStr.substring(4, 6)}.${ncmStr.substring(6, 8)}`;
  };

  // Função para converter data do Excel para Date
  const excelDateToJSDate = (excelDate) => {
    if (!excelDate) return null;
    
    // Se já for uma data válida
    if (excelDate instanceof Date && !isNaN(excelDate.getTime())) {
      return excelDate;
    }
    
    // Se for timestamp do Firebase
    if (excelDate && excelDate.toDate) {
      return excelDate.toDate();
    }
    
    // Se for número (data do Excel)
    if (typeof excelDate === 'number') {
      // Excel conta dias desde 1/1/1900 (dia 1 = 1/1/1900)
      // Mas Excel considera 1900 como bissexto (bug), então para datas >= 60 (1/3/1900) subtrai 1
      let days = excelDate;
      if (days >= 60) {
        days = days - 1;
      }
      
      // Converter para milissegundos desde epoch Unix (1/1/1970)
      // 25569 = número de dias entre 1/1/1900 e 1/1/1970
      const msSinceEpoch = (days - 25569) * 86400 * 1000;
      
      // Criar data em UTC primeiro
      const utcDate = new Date(msSinceEpoch);
      
      // Extrair componentes UTC e criar data local
      // Isso evita problemas de timezone que podem fazer a data aparecer com um dia a menos
      const year = utcDate.getUTCFullYear();
      const month = utcDate.getUTCMonth();
      const day = utcDate.getUTCDate();
      
      // Criar data local usando Date.UTC e depois ajustar para local
      // Ou criar diretamente como data local
      const localDate = new Date(year, month, day, 12, 0, 0, 0); // Meio-dia para evitar problemas de timezone
      
      return localDate;
    }
    
    // Tentar parsear como string
    const parsed = new Date(excelDate);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
    
    return null;
  };

  // Função para formatar percentual
  const formatPercent = (value) => {
    if (value === null || value === undefined || value === '') return '-';
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return String(value);
    // Multiplicar por 100 e formatar com 2 casas decimais
    return `${(numValue * 100).toFixed(2).replace('.', ',')}%`;
  };

  const handleSort = (key) => {
    setSortConfig(prevConfig => ({
      key,
      direction: prevConfig.key === key && prevConfig.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleExport = () => {
    if (!data || data.length === 0) return;

    // Preparar dados para exportação
    const exportData = data.map(item => {
      const exportItem = { ...item };
      // Converter uploadedAt para string se existir
      if (exportItem.uploadedAt && exportItem.uploadedAt.toDate) {
        exportItem.uploadedAt = exportItem.uploadedAt.toDate().toLocaleString('pt-BR');
      }
      return exportItem;
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Dados');
    XLSX.writeFile(wb, `dados_exportados_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleEdit = (item) => {
    setEditingId(item.id);
    // Criar cópia limpa dos dados, removendo campos internos do Firebase
    const cleanData = { ...item };
    delete cleanData.id;
    delete cleanData.uploadedAt;
    delete cleanData.updatedAt;
    setEditingData(cleanData);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingData({});
  };

  // Função para converter data atual para formato Excel
  const getCurrentDateAsExcel = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const day = now.getDate();
    
    // Criar data UTC usando os componentes diretamente
    const utcDate = Date.UTC(year, month, day);
    
    // Converter para número de dias desde 1900
    // 25569 = número de dias entre 1/1/1900 e 1/1/1970
    let days = (utcDate / (86400 * 1000)) + 25569;
    
    // Ajuste: adicionar 1 dia se for >= 1/3/1900 (bug do Excel)
    if (days >= 60) {
      days = days + 1;
    }
    
    return days;
  };

  const handleSave = async (itemId) => {
    setSaving(true);
    try {
      // Preparar dados para salvar (remover campos internos)
      const dataToSave = { ...editingData };
      delete dataToSave.id;
      delete dataToSave.uploadedAt;
      delete dataToSave.updatedAt;

      // Atualizar automaticamente o campo "ultima atualização" com a data atual
      const currentDateExcel = getCurrentDateAsExcel();
      dataToSave['ultima atualização'] = currentDateExcel;

      await updateData(itemId, dataToSave);
      setEditingId(null);
      setEditingData({});
      
      // Recarregar a página após salvar
      window.location.reload();
    } catch (error) {
      console.error('Erro ao salvar:', error);
      alert('Erro ao salvar alterações. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const handleNCMClick = async (ncm, item) => {
    if (!ncm) return;
    
    setSelectedNCM(ncm);
    setSelectedNCMItem(item);
    setNcmModalOpen(true);
    setLoadingNCM(true);
    setNcmDescription(null);
    setEditableDescription(item?.descrição || item?.descricao || '');
    
    try {
      // Primeiro, usar a descrição salva no banco se existir
      if (item?.descrição || item?.descricao) {
        setEditableDescription(item.descrição || item.descricao);
        setLoadingNCM(false);
        return;
      }
      
      // Se não tiver descrição salva, buscar da tabela/externa
      const description = await getNCMDescription(ncm);
      setNcmDescription(description);
      // Preencher o campo editável com a descrição encontrada
      if (description) {
        // Priorizar descrição da tabela NCM se disponível
        if (description.ncmTable && description.ncmTable.length > 0) {
          const specificNCM = description.ncmTable.find(row => 
            row.ncm === formatNCM(ncm) || 
            row.ncm.replace(/\./g, '') === String(ncm).replace(/[.\s]/g, '')
          );
          if (specificNCM && specificNCM.description) {
            setEditableDescription(specificNCM.description);
          } else if (description.ncmTable[0] && description.ncmTable[0].description) {
            setEditableDescription(description.ncmTable[0].description);
          }
        } else if (description.description) {
          setEditableDescription(description.description);
        }
      }
    } catch (error) {
      console.error('Erro ao buscar descrição da NCM:', error);
      setNcmDescription({
        description: 'Erro ao buscar descrição da NCM. Tente novamente mais tarde.',
        error: error.message
      });
    } finally {
      setLoadingNCM(false);
    }
  };

  const handleSaveDescription = async () => {
    if (!selectedNCMItem || !selectedNCMItem.id) return;
    
    setSavingDescription(true);
    try {
      const dataToSave = {
        descrição: editableDescription.trim()
      };
      
      await updateData(selectedNCMItem.id, dataToSave);
      
      // Recarregar dados
      if (onDataChange) {
        onDataChange();
      }
      
      // Atualizar o item local
      setSelectedNCMItem({
        ...selectedNCMItem,
        descrição: editableDescription.trim()
      });
      
      alert('Descrição salva com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar descrição:', error);
      alert('Erro ao salvar descrição. Tente novamente.');
    } finally {
      setSavingDescription(false);
    }
  };

  const handleDelete = async (itemId) => {
    if (!window.confirm('Tem certeza que deseja excluir este registro?')) {
      return;
    }

    setDeleting(itemId);
    try {
      await deleteData(itemId);
      
      // Notificar componente pai para recarregar dados
      if (onDataChange) {
        onDataChange();
      }
    } catch (error) {
      console.error('Erro ao excluir:', error);
      alert('Erro ao excluir registro. Tente novamente.');
    } finally {
      setDeleting(null);
    }
  };

  const handleFieldChange = (field, value) => {
    setEditingData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      const allIds = new Set(paginatedData.map(item => item.id).filter(Boolean));
      // Adicionar aos já selecionados (não substituir)
      setSelectedIds(prev => {
        const newSet = new Set(prev);
        allIds.forEach(id => newSet.add(id));
        return newSet;
      });
    } else {
      // Remover apenas os da página atual
      const pageIds = new Set(paginatedData.map(item => item.id).filter(Boolean));
      setSelectedIds(prev => {
        const newSet = new Set(prev);
        pageIds.forEach(id => newSet.delete(id));
        return newSet;
      });
    }
  };

  const handleSelectOne = (id, checked) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
  };

  const handleDeleteMultiple = async () => {
    if (selectedIds.size === 0) return;
    
    if (!window.confirm(`Tem certeza que deseja excluir ${selectedIds.size} registro(s)?`)) {
      return;
    }

    setDeletingMultiple(true);
    try {
      await deleteMultipleData(Array.from(selectedIds));
      setSelectedIds(new Set());
      
      // Notificar componente pai para recarregar dados
      if (onDataChange) {
        onDataChange();
      }
    } catch (error) {
      console.error('Erro ao excluir registros:', error);
      alert('Erro ao excluir registros. Tente novamente.');
    } finally {
      setDeletingMultiple(false);
    }
  };

  // Verificar se todos os itens da página atual estão selecionados
  const pageItemsWithIds = paginatedData.filter(item => item.id);
  const isAllSelected = pageItemsWithIds.length > 0 && 
    pageItemsWithIds.every(item => selectedIds.has(item.id));
  const isIndeterminate = pageItemsWithIds.some(item => selectedIds.has(item.id)) && !isAllSelected;

  if (loading) {
    return (
      <div className="w-full bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 text-primary-500 animate-spin" />
          <span className="ml-3 text-gray-600">Carregando dados...</span>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="w-full bg-white rounded-lg shadow-md p-6">
        <p className="text-center text-gray-500 py-8">
          Nenhum dado encontrado. Faça upload de uma planilha para começar.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full bg-white rounded-lg shadow-md p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 space-y-4 sm:space-y-0">
        <div className="flex items-center space-x-4">
          <h2 className="text-2xl font-bold text-gray-800">
            Dados Salvos ({filteredAndSortedData.length} registros)
          </h2>
          {selectedIds.size > 0 && (
            <span className="px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm font-medium">
              {selectedIds.size} selecionado(s)
            </span>
          )}
        </div>
        
        <div className="flex space-x-2">
          {selectedIds.size > 0 && (
            <button
              onClick={handleDeleteMultiple}
              disabled={deletingMultiple}
              className="flex items-center space-x-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              <span>Excluir Selecionados ({selectedIds.size})</span>
            </button>
          )}
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Criar Novo NCM</span>
          </button>
          <button
            onClick={handleExport}
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Exportar Excel</span>
          </button>
        </div>
      </div>

      {/* Barra de busca */}
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar nos dados..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  ref={(input) => {
                    if (input) input.indeterminate = isIndeterminate;
                  }}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
              </th>
              {columns.map((column, index) => (
                <th
                  key={index}
                  onClick={() => handleSort(column)}
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center space-x-1">
                    <span>{column}</span>
                    <span className={sortConfig.key === column ? 'text-blue-600' : 'text-blue-300'}>
                      {sortConfig.key === column 
                        ? (sortConfig.direction === 'asc' ? '↑' : '↓')
                        : '↕'
                      }
                    </span>
                  </div>
                </th>
              ))}
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedData.map((item, rowIndex) => {
              const isEditing = editingId === item.id;
              const isDeleting = deleting === item.id;
              
              const isSelected = item.id && selectedIds.has(item.id);
              
              // Verificar se a linha tem CEST (e não está vazio)
              const hasCEST = item['CEST'] && String(item['CEST']).trim() !== '';
              
              return (
                <tr 
                  key={item.id || rowIndex} 
                  className={`hover:bg-gray-50 ${isEditing ? 'bg-blue-50' : ''} ${isDeleting ? 'opacity-50' : ''} ${isSelected ? 'bg-primary-50' : ''} ${hasCEST && !isEditing && !isSelected ? 'bg-blue-50' : ''}`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => handleSelectOne(item.id, e.target.checked)}
                      disabled={!item.id || editingId !== null}
                      className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500 disabled:opacity-50"
                    />
                  </td>
                  {columns.map((column, colIndex) => {
                    const isNumericField = ['IVA', 'II', 'IPI', 'PIS', 'COFINS', 'ICMS', 'U$/KG considerado', 'Santos', 'Itajai'].includes(column);
                    const isDateField = column === 'ultima atualização';
                    
                    return (
                      <td
                        key={colIndex}
                        className={`px-4 py-3 text-sm ${
                          isNumericField ? 'whitespace-normal' : 'whitespace-nowrap'
                        }`}
                      >
                        {isEditing ? (
                          <input
                            type={isDateField ? 'date' : isNumericField ? 'number' : 'text'}
                            step={isNumericField ? '0.0001' : undefined}
                            value={(() => {
                              const val = editingData[column];
                              if (isDateField && val) {
                                const date = excelDateToJSDate(val);
                                if (date && !isNaN(date.getTime())) {
                                  // Usar componentes locais para evitar problemas de timezone
                                  const year = date.getFullYear();
                                  const month = String(date.getMonth() + 1).padStart(2, '0');
                                  const day = String(date.getDate()).padStart(2, '0');
                                  return `${year}-${month}-${day}`;
                                }
                                return '';
                              }
                              // Para campos de percentual, converter de volta (dividir por 100)
                              const percentFields = ['IVA', 'II', 'IPI', 'PIS', 'COFINS', 'ICMS'];
                              if (percentFields.includes(column) && val) {
                                const numVal = parseFloat(val);
                                if (!isNaN(numVal)) {
                                  // Se o valor já está como decimal (0.93), manter
                                  // Se está como percentual (93), dividir por 100
                                  return numVal > 1 ? (numVal / 100).toString() : numVal.toString();
                                }
                              }
                              return val || '';
                            })()}
                            onChange={(e) => {
                              let value = e.target.value;
                              if (isNumericField) {
                                value = parseFloat(value) || 0;
                                // Para campos de percentual, manter como decimal (0.93, não 93)
                                const percentFields = ['IVA', 'II', 'IPI', 'PIS', 'COFINS', 'ICMS'];
                                if (percentFields.includes(column) && value > 1) {
                                  // Se o usuário digitar 93, converter para 0.93
                                  value = value / 100;
                                }
                              } else if (isDateField && value) {
                                // Converter data do input HTML (YYYY-MM-DD) para número do Excel
                                // Parsear diretamente a string para evitar problemas de timezone
                                const dateParts = value.split('-');
                                if (dateParts.length === 3) {
                                  const year = parseInt(dateParts[0], 10);
                                  const month = parseInt(dateParts[1], 10) - 1; // Mês é 0-indexed
                                  const day = parseInt(dateParts[2], 10);
                                  
                                  // Criar data UTC usando os componentes diretamente
                                  const utcDate = Date.UTC(year, month, day);
                                  
                                  // Converter para número de dias desde 1900
                                  // 25569 = número de dias entre 1/1/1900 e 1/1/1970
                                  let days = (utcDate / (86400 * 1000)) + 25569;
                                  
                                  // Ajuste: adicionar 1 dia se for >= 1/3/1900 (bug do Excel)
                                  if (days >= 60) {
                                    days = days + 1;
                                  }
                                  value = days;
                                }
                              }
                              handleFieldChange(column, value);
                            }}
                            className="w-full px-2 py-1 border border-primary-300 rounded focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-700"
                            placeholder="-"
                          />
                        ) : (
                          (() => {
                            const value = item[column];
                            if (value === null || value === undefined || value === '') {
                              return <span className="text-gray-400">-</span>;
                            }
                            
                            // Verificar se o valor é 0 (para campos numéricos)
                            const numValue = parseFloat(value);
                            if (!isNaN(numValue) && numValue === 0 && column !== 'NCM') {
                              return <span className="text-gray-400">-</span>;
                            }
                            
                            // Formatar NCM (clicável)
                            if (column === 'NCM') {
                              const formattedNCM = formatNCM(value);
                              return (
                                <button
                                  onClick={() => handleNCMClick(value, item)}
                                  className="text-blue-600 hover:text-blue-800 hover:underline font-medium cursor-pointer transition-colors"
                                  title="Clique para ver e editar a descrição da NCM"
                                >
                                  {formattedNCM}
                                </button>
                              );
                            }
                            
                            // Formatar campos de percentuais
                            const percentFields = ['IVA', 'II', 'IPI', 'PIS', 'COFINS', 'ICMS'];
                            if (percentFields.includes(column)) {
                              return <span className="text-gray-700">{formatPercent(value)}</span>;
                            }
                            
                            // Formatar datas
                            if (isDateField && value) {
                              const date = excelDateToJSDate(value);
                              if (date && !isNaN(date.getTime())) {
                                // Usar componentes da data para evitar problemas de timezone
                                const day = String(date.getDate()).padStart(2, '0');
                                const month = String(date.getMonth() + 1).padStart(2, '0');
                                const year = date.getFullYear();
                                return `${day}/${month}/${year}`;
                              }
                            }
                            
                            // Formatar outros campos numéricos (U$/KG considerado, Santos, Itajai)
                            if (isNumericField && !percentFields.includes(column)) {
                              const numValue = parseFloat(value);
                              if (!isNaN(numValue)) {
                                return numValue.toLocaleString('pt-BR', { 
                                  minimumFractionDigits: 2, 
                                  maximumFractionDigits: 4 
                                });
                              }
                            }
                            
                            return <span className="text-gray-700">{String(value)}</span>;
                          })()
                        )}
                      </td>
                    );
                  })}
                  <td className="px-4 py-3 text-sm whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => handleSave(item.id)}
                            disabled={saving}
                            className="p-1.5 text-green-600 hover:text-green-700 hover:bg-green-50 rounded transition-colors disabled:opacity-50"
                            title="Salvar"
                          >
                            <Save className="w-4 h-4" />
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            disabled={saving}
                            className="p-1.5 text-gray-600 hover:text-gray-700 hover:bg-gray-50 rounded transition-colors disabled:opacity-50"
                            title="Cancelar"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleEdit(item)}
                            disabled={deleting !== null || deletingMultiple}
                            className="p-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors disabled:opacity-50"
                            title="Editar"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            disabled={deleting !== null || editingId !== null || deletingMultiple}
                            className="p-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Mostrando {(currentPage - 1) * itemsPerPage + 1} a{' '}
            {Math.min(currentPage * itemsPerPage, filteredAndSortedData.length)} de{' '}
            {filteredAndSortedData.length} registros
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
            >
              Anterior
            </button>
            <span className="px-4 py-2 text-gray-700">
              Página {currentPage} de {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
            >
              Próxima
            </button>
          </div>
        </div>
      )}

      {/* Modal de Descrição da NCM */}
      <Modal
        isOpen={ncmModalOpen}
        onClose={() => {
          setNcmModalOpen(false);
          setSelectedNCM(null);
          setSelectedNCMItem(null);
          setNcmDescription(null);
          setEditableDescription('');
        }}
        title={`Descrição da NCM ${selectedNCM ? formatNCM(selectedNCM) : ''}`}
      >
        {loadingNCM ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 text-blue-600 animate-spin mr-3" />
            <span className="text-gray-600">Buscando descrição da NCM...</span>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Exibir informações do capítulo e descrição do NCM específico */}
            {ncmDescription && ncmDescription.chapterCode && (
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-3">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-1">
                    {ncmDescription.chapterCode}
                  </h3>
                  {ncmDescription.chapterDescription && (
                    <p className="text-gray-700 mb-3">
                      {ncmDescription.chapterDescription}
                    </p>
                  )}
                  
                  {/* Exibir NCM específico e sua descrição */}
                  {selectedNCM && ncmDescription.description && (
                    <div className="mt-3 pt-3 border-t border-gray-300">
                      <div className="flex items-start space-x-3">
                        <span className="text-sm font-mono text-gray-700 font-semibold">
                          {formatNCM(selectedNCM)}
                        </span>
                        <span className="text-sm text-gray-700 flex-1">
                          {ncmDescription.description}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Descrição da NCM:
              </label>
              <textarea
                value={editableDescription}
                onChange={(e) => setEditableDescription(e.target.value)}
                placeholder="Digite ou edite a descrição da NCM..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y min-h-[120px]"
                rows={4}
              />
              <p className="mt-2 text-sm text-gray-500">
                A descrição será salva junto com o registro do NCM no banco de dados.
              </p>
            </div>

            {ncmDescription && ncmDescription.uTrib && (
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Unidade Tributável (uTrib):</h3>
                <p className="text-gray-700 bg-gray-50 p-4 rounded-lg border border-gray-200">
                  {ncmDescription.uTrib}
                </p>
              </div>
            )}
            
            {ncmDescription && ncmDescription.source && (
              <div className="text-sm text-gray-500">
                <strong>Fonte:</strong> {ncmDescription.source}
              </div>
            )}
            
            {selectedNCM && (
              <div className="pt-4 border-t border-gray-200">
                <a
                  href={`https://www.systax.com.br/classificacaofiscal/ncm/${String(selectedNCM).replace(/[.\s]/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center"
                >
                  Consultar NCM no Systax
                  <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            )}

            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <button
                onClick={() => {
                  setNcmModalOpen(false);
                  setSelectedNCM(null);
                  setSelectedNCMItem(null);
                  setNcmDescription(null);
                  setEditableDescription('');
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveDescription}
                disabled={savingDescription || !selectedNCMItem?.id}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {savingDescription ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Salvar Descrição</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal de Criar Novo NCM */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setNewNCMData({});
        }}
        title="Criar Novo NCM"
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
              onClick={async () => {
                if (!newNCMData['NCM']) {
                  alert('Por favor, preencha o campo NCM.');
                  return;
                }

                setCreating(true);
                try {
                  // Adicionar data atual se não foi preenchida
                  if (!newNCMData['ultima atualização']) {
                    const now = new Date();
                    const year = now.getFullYear();
                    const month = now.getMonth();
                    const day = now.getDate();
                    const utcDate = Date.UTC(year, month, day);
                    let days = (utcDate / (86400 * 1000)) + 25569;
                    if (days >= 60) {
                      days = days + 1;
                    }
                    newNCMData['ultima atualização'] = days;
                  }

                  // Salvar como objeto no formato esperado pelo serviço
                  await saveSpreadsheetData({
                    rows: [newNCMData],
                    headers: EXPECTED_FIELDS,
                    sheetName: 'Manual'
                  });
                  
                  // Recarregar dados
                  if (onDataChange) {
                    onDataChange();
                  }
                  
                  setIsCreateModalOpen(false);
                  setNewNCMData({});
                  alert('NCM criado com sucesso!');
                } catch (error) {
                  console.error('Erro ao criar NCM:', error);
                  alert('Erro ao criar NCM. Tente novamente.');
                } finally {
                  setCreating(false);
                }
              }}
              disabled={creating || !newNCMData['NCM']}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {creating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Criando...</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Criar NCM</span>
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default DataTable;

