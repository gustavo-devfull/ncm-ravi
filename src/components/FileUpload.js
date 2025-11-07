import React, { useState } from 'react';
import { Upload, FileSpreadsheet, X, CheckCircle, AlertCircle } from 'lucide-react';
import { readSpreadsheet, saveSpreadsheetData, EXPECTED_FIELDS } from '../services/spreadsheetService';

const FileUpload = ({ onUploadSuccess }) => {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleFileChange = async (e) => {
    const selectedFile = e.target.files[0];
    
    if (!selectedFile) return;

    // Validar tipo de arquivo
    const validTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv'
    ];
    
    const validExtensions = ['.xls', '.xlsx', '.csv'];
    const fileExtension = selectedFile.name.substring(selectedFile.name.lastIndexOf('.'));
    
    if (!validTypes.includes(selectedFile.type) && !validExtensions.includes(fileExtension.toLowerCase())) {
      setError('Por favor, selecione um arquivo Excel (.xls, .xlsx) ou CSV');
      return;
    }

    setFile(selectedFile);
    setError(null);
    setSuccess(false);

    // Fazer preview dos dados
    try {
      const data = await readSpreadsheet(selectedFile);
      setPreview(data);
    } catch (err) {
      setError(`Erro ao ler arquivo: ${err.message}`);
      setPreview(null);
    }
  };

  const handleUpload = async () => {
    if (!file || !preview) return;

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const result = await saveSpreadsheetData(preview, {
        fileName: file.name,
        fileSize: file.size
      });

      setSuccess(true);
      setFile(null);
      setPreview(null);
      
      // Limpar input
      const fileInput = document.getElementById('file-input');
      if (fileInput) fileInput.value = '';

      if (onUploadSuccess) {
        onUploadSuccess(result);
      }

      // Limpar mensagem de sucesso após 3 segundos
      setTimeout(() => {
        setSuccess(false);
      }, 3000);
    } catch (err) {
      setError(`Erro ao salvar dados: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = () => {
    setFile(null);
    setPreview(null);
    setError(null);
    setSuccess(false);
    const fileInput = document.getElementById('file-input');
    if (fileInput) fileInput.value = '';
  };

  return (
    <div>
      
      <div className="space-y-4">
        {/* Área de upload */}
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-primary-500 transition-colors">
          <input
            id="file-input"
            type="file"
            accept=".xls,.xlsx,.csv"
            onChange={handleFileChange}
            className="hidden"
          />
          
          {!file ? (
            <label
              htmlFor="file-input"
              className="cursor-pointer flex flex-col items-center space-y-2"
            >
              <Upload className="w-12 h-12 text-gray-400" />
              <span className="text-gray-600 font-medium">
                Clique para selecionar ou arraste uma planilha aqui
              </span>
              <span className="text-sm text-gray-500">
                Formatos suportados: .xls, .xlsx, .csv
              </span>
            </label>
          ) : (
            <div className="flex flex-col items-center space-y-4">
              <FileSpreadsheet className="w-12 h-12 text-primary-500" />
              <div className="text-center">
                <p className="font-medium text-gray-800">{file.name}</p>
                <p className="text-sm text-gray-500">
                  {(file.size / 1024).toFixed(2)} KB
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Preview dos dados */}
        {preview && (
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-700">Preview dos Dados</h3>
              <button
                onClick={handleRemove}
                className="text-red-500 hover:text-red-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2 text-sm">
              <p><span className="font-medium">Planilha:</span> {preview.sheetName}</p>
              <p><span className="font-medium">Colunas:</span> {preview.headers.length}</p>
              <p><span className="font-medium">Linhas:</span> {preview.rows.length}</p>
              
              {/* Aviso sobre campos faltantes */}
              {preview.missingFields && preview.missingFields.length > 0 && (
                <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-start space-x-2">
                    <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-yellow-800 mb-1">Campos não encontrados:</p>
                      <div className="flex flex-wrap gap-2">
                        {preview.missingFields.map((field, index) => (
                          <span
                            key={index}
                            className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs"
                          >
                            {field}
                          </span>
                        ))}
                      </div>
                      <p className="text-yellow-700 text-xs mt-2">
                        Estes campos serão criados vazios no banco de dados.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="mt-3">
                <p className="font-medium mb-1">Colunas detectadas:</p>
                <div className="flex flex-wrap gap-2">
                  {EXPECTED_FIELDS.map((field, index) => {
                    const isFound = preview.headers.includes(field);
                    return (
                      <span
                        key={index}
                        className={`px-2 py-1 rounded text-xs ${
                          isFound
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-200 text-gray-500'
                        }`}
                        title={isFound ? 'Campo encontrado' : 'Campo não encontrado'}
                      >
                        {field} {isFound ? '✓' : '✗'}
                      </span>
                    );
                  })}
                </div>
              </div>
              
              {/* Preview das primeiras linhas */}
              {preview.rows.length > 0 && (
                <div className="mt-4">
                  <p className="font-medium mb-2">Preview das primeiras linhas:</p>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs border border-gray-300">
                      <thead className="bg-gray-200">
                        <tr>
                          {EXPECTED_FIELDS.filter(field => preview.headers.includes(field)).map((field, idx) => (
                            <th key={idx} className="px-2 py-1 border border-gray-300 text-left">
                              {field}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.rows.slice(0, 3).map((row, rowIdx) => (
                          <tr key={rowIdx}>
                            {EXPECTED_FIELDS.filter(field => preview.headers.includes(field)).map((field, colIdx) => (
                              <td key={colIdx} className="px-2 py-1 border border-gray-300">
                                {row[field] || '-'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Mensagens de erro e sucesso */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center space-x-2">
            <CheckCircle className="w-5 h-5" />
            <span>Dados salvos com sucesso!</span>
          </div>
        )}

        {/* Botão de upload */}
        {preview && !success && (
          <button
            onClick={handleUpload}
            disabled={loading}
            className="w-full bg-primary-600 hover:bg-primary-700 text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>Salvando...</span>
              </>
            ) : (
              <>
                <Upload className="w-5 h-5" />
                <span>Salvar no Banco de Dados</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};

export default FileUpload;

