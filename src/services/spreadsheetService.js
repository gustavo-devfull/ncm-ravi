import * as XLSX from 'xlsx';
import { collection, addDoc, getDocs, query, orderBy, limit, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase/config';

// Campos esperados na planilha
export const EXPECTED_FIELDS = [
  'NCM',
  'ultima atualização',
  'CEST',
  'IVA',
  'II',
  'IPI',
  'PIS',
  'COFINS',
  'ICMS',
  'U$/KG considerado',
  'Santos',
  'Itajai'
];

// Mapeamento de campos originais para nomes válidos no Firebase
// Firebase não aceita: ~, *, /, [, ]
const FIELD_TO_FIREBASE = {
  'U$/KG considerado': 'U_por_KG_considerado',
  'ultima atualização': 'ultima_atualizacao'
};

// Mapeamento reverso: Firebase -> Original
const FIREBASE_TO_FIELD = Object.fromEntries(
  Object.entries(FIELD_TO_FIREBASE).map(([original, firebase]) => [firebase, original])
);

/**
 * Normaliza o nome do campo para ser válido no Firebase
 */
export const normalizeFieldForFirebase = (fieldName) => {
  if (!fieldName) return fieldName;
  return FIELD_TO_FIREBASE[fieldName] || fieldName;
};

/**
 * Converte o nome do campo do Firebase de volta para o original
 */
export const denormalizeFieldFromFirebase = (fieldName) => {
  if (!fieldName) return fieldName;
  return FIREBASE_TO_FIELD[fieldName] || fieldName;
};

/**
 * Normaliza um objeto de dados para salvar no Firebase
 */
export const normalizeDataForFirebase = (data) => {
  const normalized = {};
  Object.keys(data).forEach(key => {
    // Primeiro tenta o mapeamento específico
    let normalizedKey = normalizeFieldForFirebase(key);
    // Se não encontrou no mapeamento, sanitiza o nome
    if (normalizedKey === key && /[~*/[\]]/.test(key)) {
      normalizedKey = sanitizeFieldName(key);
    }
    normalized[normalizedKey] = data[key];
  });
  return normalized;
};

/**
 * Desnormaliza um objeto de dados do Firebase
 */
export const denormalizeDataFromFirebase = (data) => {
  const denormalized = {};
  Object.keys(data).forEach(key => {
    // Ignorar campos internos do Firebase
    if (key === 'uploadedAt' || key === 'updatedAt' || key === 'fileName' || key === 'fileSize') {
      denormalized[key] = data[key];
      return;
    }
    
    // Tentar desnormalizar usando o mapeamento
    let denormalizedKey = denormalizeFieldFromFirebase(key);
    
    // Se não encontrou no mapeamento, verificar se é um campo normalizado genérico
    if (denormalizedKey === key) {
      // Tentar reverter sanitização genérica (ex: U_por_KG_considerado -> U$/KG considerado)
      if (key === 'U_por_KG_considerado') {
        denormalizedKey = 'U$/KG considerado';
      } else if (key === 'ultima_atualizacao') {
        denormalizedKey = 'ultima atualização';
      }
      // Se ainda não encontrou, manter o nome original (pode ser campo antigo ou válido)
    }
    
    denormalized[denormalizedKey] = data[key];
  });
  return denormalized;
};

/**
 * Normaliza campo de forma genérica (substitui caracteres inválidos)
 * Usado como fallback para campos não mapeados
 */
const sanitizeFieldName = (fieldName) => {
  if (!fieldName) return fieldName;
  // Substituir caracteres inválidos do Firebase: ~, *, /, [, ]
  return String(fieldName)
    .replace(/\$/g, '_por_')
    .replace(/\//g, '_')
    .replace(/~/g, '_')
    .replace(/\*/g, '_')
    .replace(/\[/g, '_')
    .replace(/\]/g, '_')
    .replace(/\s+/g, '_');
};

// Mapeamento de variações de nomes de campos
const FIELD_MAPPING = {
  'NCM': ['NCM', 'ncm'],
  'ultima atualização': ['ultima atualização', 'última atualização', 'ultima atualizacao', 'Última Atualização'],
  'CEST': ['CEST', 'cest'],
  'IVA': ['IVA', 'iva'],
  'II': ['II', 'ii'],
  'IPI': ['IPI', 'ipi'],
  'PIS': ['PIS', 'pis', 'PIS '], // PIS com espaço no final
  'COFINS': ['COFINS', 'cofins'],
  'ICMS': ['ICMS', 'icms'],
  'U$/KG considerado': ['U$/KG considerado', 'U$/KG Considerado', 'u$/kg considerado', 'U$/KG  \nconsiderado', 'U$/KG considerado'],
  'Santos': ['Santos', 'santos'],
  'Itajai': ['Itajai', 'Itajaí', 'itajai', 'itajaí']
};

/**
 * Normaliza o nome do campo para o padrão esperado
 */
const normalizeFieldName = (fieldName) => {
  if (!fieldName) return null;
  
  // Normalizar: remover espaços extras, quebras de linha, e converter para string
  let normalized = String(fieldName)
    .replace(/\n/g, ' ')  // Substituir quebras de linha por espaço
    .replace(/\r/g, '')   // Remover carriage return
    .replace(/\s+/g, ' ') // Múltiplos espaços por um único espaço
    .trim();
  
  // Verificar se já está no formato correto
  if (EXPECTED_FIELDS.includes(normalized)) {
    return normalized;
  }
  
  // Buscar no mapeamento (comparação case-insensitive e ignorando espaços extras)
  for (const [standardName, variations] of Object.entries(FIELD_MAPPING)) {
    const normalizedLower = normalized.toLowerCase();
    if (variations.some(v => {
      const vNormalized = String(v).replace(/\s+/g, ' ').trim().toLowerCase();
      return vNormalized === normalizedLower || 
             normalizedLower.includes(vNormalized) ||
             vNormalized.includes(normalizedLower);
    })) {
      return standardName;
    }
  }
  
  // Tentar match parcial para campos conhecidos
  const normalizedLower = normalized.toLowerCase();
  if (normalizedLower.includes('ncm') && !normalizedLower.includes('considerado')) {
    return 'NCM';
  }
  if (normalizedLower.includes('cest')) {
    return 'CEST';
  }
  if (normalizedLower.includes('ultima') && normalizedLower.includes('atualizacao')) {
    return 'ultima atualização';
  }
  if (normalizedLower.includes('u$') && normalizedLower.includes('kg') && normalizedLower.includes('considerado')) {
    return 'U$/KG considerado';
  }
  
  return normalized;
};

/**
 * Lê um arquivo Excel/CSV e retorna os dados em formato JSON
 */
export const readSpreadsheet = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Pegar a primeira planilha
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Converter para JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
          header: 1,
          defval: null 
        });
        
        // Converter array de arrays para array de objetos
        if (jsonData.length === 0) {
          reject(new Error('A planilha está vazia'));
          return;
        }
        
        // Detectar onde estão os headers
        // Procurar por uma linha que contenha os nomes dos campos esperados
        let headerRowIndex = 0;
        
        for (let i = 0; i < Math.min(3, jsonData.length); i++) {
          const row = jsonData[i];
          if (!row || row.length === 0) continue;
          
          // Verificar se esta linha contém headers conhecidos
              const rowText = row.map(cell => String(cell || '').trim().toLowerCase()).join(' ');
              const hasKnownHeaders = EXPECTED_FIELDS.some(field => {
                const fieldLower = field.toLowerCase();
                return rowText.includes(fieldLower) ||
                       row.some(cell => {
                         const cellStr = String(cell || '').trim().toLowerCase();
                         return cellStr === fieldLower || 
                                (cellStr.includes('ncm') && fieldLower.includes('ncm')) ||
                                (cellStr.includes('cest') && fieldLower.includes('cest'));
                       });
              });
          
          if (hasKnownHeaders) {
            headerRowIndex = i;
            break;
          }
        }
        
        const rawHeaders = jsonData[headerRowIndex] || jsonData[0];
        const normalizedHeaders = rawHeaders.map(header => {
          const headerStr = String(header || '').trim();
          return normalizeFieldName(headerStr);
        });
        
        // Validar campos obrigatórios
        const missingFields = EXPECTED_FIELDS.filter(field => 
          !normalizedHeaders.includes(field)
        );
        
        if (missingFields.length > 0) {
          console.warn('Campos não encontrados:', missingFields);
        }
        
        // Pular a linha de headers e processar os dados
        const dataStartIndex = headerRowIndex + 1;
        const rows = jsonData.slice(dataStartIndex).map(row => {
          const obj = {};
          rawHeaders.forEach((rawHeader, index) => {
            const normalizedHeader = normalizeFieldName(String(rawHeader || '').trim());
            if (normalizedHeader) {
              obj[normalizedHeader] = row[index] !== null && row[index] !== undefined ? row[index] : '';
            }
          });
          
          // Garantir que todos os campos esperados existam
          EXPECTED_FIELDS.forEach(field => {
            if (!(field in obj)) {
              obj[field] = '';
            }
          });
          
          return obj;
        }).filter(row => {
          // Filtrar linhas completamente vazias
          return Object.values(row).some(value => value !== '' && value !== null && value !== undefined);
        });
        
        resolve({
          headers: normalizedHeaders,
          rawHeaders: rawHeaders,
          rows,
          sheetName: firstSheetName,
          missingFields
        });
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = (error) => {
      reject(error);
    };
    
    reader.readAsArrayBuffer(file);
  });
};

/**
 * Salva os dados da planilha no Firestore
 */
export const saveSpreadsheetData = async (data, metadata = {}) => {
  try {
    const batch = [];
    
    // Salvar cada linha como um documento
    for (const row of data.rows) {
      // Normalizar os nomes dos campos para o Firebase
      const normalizedRow = normalizeDataForFirebase(row);
      const docData = {
        ...normalizedRow,
        uploadedAt: new Date(),
        ...metadata
      };
      
      const docRef = await addDoc(collection(db, 'spreadsheetData'), docData);
      batch.push(docRef.id);
    }
    
    // Salvar metadados da importação
    const importMetadata = {
      totalRows: data.rows.length,
      headers: data.headers,
      sheetName: data.sheetName,
      uploadedAt: new Date(),
      ...metadata
    };
    
    await addDoc(collection(db, 'imports'), importMetadata);
    
    return {
      success: true,
      totalRows: data.rows.length,
      documentIds: batch
    };
  } catch (error) {
    console.error('Erro ao salvar dados:', error);
    throw error;
  }
};

/**
 * Busca todos os dados salvos no Firestore
 */
export const getAllData = async (limitCount = 1000) => {
  try {
    const q = query(
      collection(db, 'spreadsheetData'),
      orderBy('uploadedAt', 'desc'),
      limit(limitCount)
    );
    
    const querySnapshot = await getDocs(q);
    const data = [];
    
    querySnapshot.forEach((doc) => {
      const docData = doc.data();
      // Desnormalizar os nomes dos campos do Firebase
      const finalData = denormalizeDataFromFirebase(docData);
      
      data.push({
        id: doc.id,
        ...finalData
      });
    });
    
    return data;
  } catch (error) {
    console.error('Erro ao buscar dados:', error);
    throw error;
  }
};

/**
 * Busca histórico de importações
 */
export const getImportHistory = async () => {
  try {
    const q = query(
      collection(db, 'imports'),
      orderBy('uploadedAt', 'desc'),
      limit(50)
    );
    
    const querySnapshot = await getDocs(q);
    const history = [];
    
    querySnapshot.forEach((doc) => {
      history.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return history;
  } catch (error) {
    console.error('Erro ao buscar histórico:', error);
    throw error;
  }
};

/**
 * Atualiza um documento no Firestore
 */
export const updateData = async (documentId, updatedData) => {
  try {
    const docRef = doc(db, 'spreadsheetData', documentId);
    // Normalizar os nomes dos campos para o Firebase
    const normalizedData = normalizeDataForFirebase(updatedData);
    await updateDoc(docRef, {
      ...normalizedData,
      updatedAt: new Date()
    });
    return { success: true };
  } catch (error) {
    console.error('Erro ao atualizar dados:', error);
    throw error;
  }
};

/**
 * Exclui um documento do Firestore
 */
export const deleteData = async (documentId) => {
  try {
    const docRef = doc(db, 'spreadsheetData', documentId);
    await deleteDoc(docRef);
    return { success: true };
  } catch (error) {
    console.error('Erro ao excluir dados:', error);
    throw error;
  }
};

/**
 * Exclui múltiplos documentos do Firestore
 */
export const deleteMultipleData = async (documentIds) => {
  try {
    const deletePromises = documentIds.map(id => {
      const docRef = doc(db, 'spreadsheetData', id);
      return deleteDoc(docRef);
    });
    
    await Promise.all(deletePromises);
    return { success: true, deletedCount: documentIds.length };
  } catch (error) {
    console.error('Erro ao excluir dados:', error);
    throw error;
  }
};

