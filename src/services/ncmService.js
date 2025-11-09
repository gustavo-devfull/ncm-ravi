import * as XLSX from 'xlsx';

// Cache para armazenar a tabela NCM carregada
let ncmTableCache = null;
let ncmTableLoading = false;
let ncmTablePromise = null;

/**
 * Carrega a tabela NCM do arquivo Excel na pasta public
 */
const loadNCMTable = async () => {
  // Se já está carregando, retornar a promise existente
  if (ncmTableLoading && ncmTablePromise) {
    return ncmTablePromise;
  }

  // Se já está em cache, retornar
  if (ncmTableCache) {
    return ncmTableCache;
  }

  // Iniciar carregamento
  ncmTableLoading = true;
  ncmTablePromise = new Promise(async (resolve, reject) => {
    try {
      // Buscar o arquivo da pasta public
      const response = await fetch('/Tabela NCM 2022 com Utrib_Comércio Exterior_vigência 01.10.25.xlsx');
      
      if (!response.ok) {
        throw new Error('Erro ao carregar tabela NCM');
      }

      const arrayBuffer = await response.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });

      // Pegar a primeira planilha
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];

      // Converter para JSON (primeira linha como header)
      const jsonData = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: null
      });

      if (jsonData.length === 0) {
        throw new Error('Tabela NCM vazia');
      }

      // Criar um mapa para busca rápida
      // Assumindo que a primeira linha contém os headers
      const headers = jsonData[0];
      
      // Procurar colunas relevantes (pode variar, vamos tentar detectar)
      let ncmColumnIndex = -1;
      let descriptionColumnIndex = -1;
      let uTribColumnIndex = -1;

      headers.forEach((header, index) => {
        const headerStr = String(header || '').toLowerCase();
        if (headerStr.includes('ncm') || headerStr.includes('código')) {
          ncmColumnIndex = index;
        }
        if (headerStr.includes('descrição') || headerStr.includes('descricao') || headerStr.includes('desc')) {
          descriptionColumnIndex = index;
        }
        if (headerStr.includes('utrib') || headerStr.includes('u.trib') || headerStr.includes('unidade')) {
          uTribColumnIndex = index;
        }
      });

      // Se não encontrou, tentar padrões comuns
      if (ncmColumnIndex === -1) {
        ncmColumnIndex = 0; // Primeira coluna geralmente é o código
      }
      if (descriptionColumnIndex === -1) {
        descriptionColumnIndex = 1; // Segunda coluna geralmente é a descrição
      }

      // Criar mapa de NCM -> {description, uTrib}
      const ncmMap = new Map();

      // Processar linhas (pular header)
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || row.length === 0) continue;

        const ncmCode = row[ncmColumnIndex];
        if (!ncmCode) continue;

        // Limpar e formatar código NCM
        const cleanNCM = String(ncmCode).replace(/[.\s]/g, '').trim();
        
        if (cleanNCM.length >= 8) {
          const description = row[descriptionColumnIndex] ? String(row[descriptionColumnIndex]).trim() : '';
          const uTrib = uTribColumnIndex >= 0 && row[uTribColumnIndex] ? String(row[uTribColumnIndex]).trim() : '';

          // Armazenar no mapa (usar código limpo como chave)
          ncmMap.set(cleanNCM, {
            description: description || 'Descrição não disponível',
            uTrib: uTrib || null
          });
        }
      }

      ncmTableCache = ncmMap;
      ncmTableLoading = false;
      resolve(ncmMap);
    } catch (error) {
      console.error('Erro ao carregar tabela NCM:', error);
      ncmTableLoading = false;
      ncmTablePromise = null;
      reject(error);
    }
  });

  return ncmTablePromise;
};

/**
 * Busca a descrição da NCM
 * @param {string} ncm - Código NCM (formato: xxxx.xx.xx ou xxxxxxxx)
 * @returns {Promise<{description: string, uTrib?: string, source?: string}>}
 */
export const getNCMDescription = async (ncm) => {
  try {
    // Limpar o NCM (remover pontos e espaços)
    const cleanNCM = String(ncm).replace(/[.\s]/g, '');
    
    if (!cleanNCM || cleanNCM.length < 8) {
      throw new Error('NCM inválido');
    }

    // Carregar tabela NCM (usa cache se já carregada)
    const ncmTable = await loadNCMTable();

    // Buscar no mapa
    const ncmData = ncmTable.get(cleanNCM);

    if (ncmData) {
      return {
        description: ncmData.description,
        uTrib: ncmData.uTrib,
        source: 'Tabela NCM 2022 - Receita Federal do Brasil'
      };
    }

    // Se não encontrou, tentar buscar com código formatado
    const formattedNCM = `${cleanNCM.substring(0, 4)}.${cleanNCM.substring(4, 6)}.${cleanNCM.substring(6, 8)}`;
    
    // Tentar buscar novamente (às vezes o código pode estar formatado na tabela)
    for (const [key, value] of ncmTable.entries()) {
      if (key.includes(cleanNCM) || cleanNCM.includes(key)) {
        return {
          description: value.description,
          uTrib: value.uTrib,
          source: 'Tabela NCM 2022 - Receita Federal do Brasil'
        };
      }
    }

    // Se não encontrou na tabela local, tentar buscar no site systax.com.br
    const systaxData = await getNCMFromSystax(cleanNCM, formattedNCM);
    if (systaxData) {
      return systaxData;
    }

    // Se não encontrou, retornar mensagem
    return {
      description: `NCM ${formattedNCM} não encontrado na tabela. Verifique se o código está correto.`,
      source: 'Tabela NCM 2022 - Receita Federal do Brasil',
      note: 'Este código NCM não foi encontrado na tabela oficial.'
    };
  } catch (error) {
    console.error('Erro ao buscar descrição da NCM:', error);
    return {
      description: 'Erro ao buscar descrição da NCM. Tente novamente mais tarde.',
      error: error.message,
      source: 'Sistema'
    };
  }
};

/**
 * Formata o código NCM para exibição
 */
export const formatNCM = (ncm) => {
  if (!ncm) return '';
  const ncmStr = String(ncm).replace(/\D/g, '');
  if (ncmStr.length < 8) return ncmStr;
  return `${ncmStr.substring(0, 4)}.${ncmStr.substring(4, 6)}.${ncmStr.substring(6, 8)}`;
};

/**
 * Busca NCM no site systax.com.br
 * Lê a página, identifica a tabela NCM/Descrição e extrai a descrição
 */
const getNCMFromSystax = async (cleanNCM, formattedNCM) => {
  try {
    // URL do site systax para consulta de NCM (sem pontos)
    // O código NCM deve ser enviado sem pontos (ex: 39191010, não 3919.10.10)
    const systaxUrl = `https://www.systax.com.br/classificacaofiscal/ncm/${cleanNCM}`;
    
    // Tentar fazer requisição usando proxy CORS para contornar bloqueio
    // Usar um proxy público ou criar um backend próprio
    try {
      // Opção 1: Tentar com proxy CORS público (pode não estar disponível)
      const proxyUrls = [
        `https://api.allorigins.win/raw?url=${encodeURIComponent(systaxUrl)}`,
        `https://cors-anywhere.herokuapp.com/${systaxUrl}`,
        systaxUrl // Tentar direto como fallback
      ];
      
      let response = null;
      let lastError = null;
      
      // Tentar cada proxy até um funcionar
      for (const proxyUrl of proxyUrls) {
        try {
          response = await fetch(proxyUrl, {
            method: 'GET',
            headers: {
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
            mode: 'cors'
          });
          
          if (response && response.ok) {
            break; // Sucesso, sair do loop
          }
        } catch (proxyError) {
          lastError = proxyError;
          continue; // Tentar próximo proxy
        }
      }
      
      if (!response || !response.ok) {
        throw lastError || new Error('Nenhum proxy funcionou');
      }

      if (response.ok) {
        const html = await response.text();
        
        // Extrair informações estruturadas do Systax
        let chapterCode = null;
        let chapterDescription = null;
        let ncmTable = [];
        
        // Extrair código do capítulo (primeiros 4 dígitos)
        chapterCode = cleanNCM.substring(0, 4);
        
        // Procurar descrição do capítulo - padrão: heading com código seguido de descrição
        // Exemplo: <h4>3919</h4> seguido de descrição
        const chapterPatterns = [
          new RegExp(`<h[1-6][^>]*>\\s*${chapterCode}\\s*<\\/h[1-6]>[\\s\\S]{0,500}?([A-ZÁÊÔÇ][^<]{30,300}?)(?:<\\/p>|<\\/div>|<h[1-6]|NCM:|###)`, 'i'),
          new RegExp(`<strong[^>]*>\\s*${chapterCode}\\s*<\\/strong>[\\s\\S]{0,500}?([A-ZÁÊÔÇ][^<]{30,300}?)(?:<\\/p>|<\\/div>|<h[1-6]|NCM:)`, 'i'),
          new RegExp(`(?:^|>)\\s*${chapterCode}\\s*(?:<|$)[\\s\\S]{0,500}?([A-ZÁÊÔÇ][^<]{30,300}?)(?:<\\/p>|<\\/div>|<h[1-6]|NCM:)`, 'i')
        ];
        
        for (const pattern of chapterPatterns) {
          const chapterMatch = html.match(pattern);
          if (chapterMatch && chapterMatch[1]) {
            // Decodificar entidades HTML para corrigir acentuação
            chapterDescription = chapterMatch[1]
              .replace(/<[^>]*>/g, '')
              .replace(/&nbsp;/g, ' ')
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&quot;/g, '"')
              .replace(/&#39;/g, "'")
              .replace(/&aacute;/g, 'á')
              .replace(/&eacute;/g, 'é')
              .replace(/&iacute;/g, 'í')
              .replace(/&oacute;/g, 'ó')
              .replace(/&uacute;/g, 'ú')
              .replace(/&agrave;/g, 'à')
              .replace(/&egrave;/g, 'è')
              .replace(/&igrave;/g, 'ì')
              .replace(/&ograve;/g, 'ò')
              .replace(/&ugrave;/g, 'ù')
              .replace(/&acirc;/g, 'â')
              .replace(/&ecirc;/g, 'ê')
              .replace(/&icirc;/g, 'î')
              .replace(/&ocirc;/g, 'ô')
              .replace(/&ucirc;/g, 'û')
              .replace(/&atilde;/g, 'ã')
              .replace(/&otilde;/g, 'õ')
              .replace(/&ccedil;/g, 'ç')
              .replace(/&Aacute;/g, 'Á')
              .replace(/&Eacute;/g, 'É')
              .replace(/&Iacute;/g, 'Í')
              .replace(/&Oacute;/g, 'Ó')
              .replace(/&Uacute;/g, 'Ú')
              .replace(/&Agrave;/g, 'À')
              .replace(/&Egrave;/g, 'È')
              .replace(/&Igrave;/g, 'Ì')
              .replace(/&Ograve;/g, 'Ò')
              .replace(/&Ugrave;/g, 'Ù')
              .replace(/&Acirc;/g, 'Â')
              .replace(/&Ecirc;/g, 'Ê')
              .replace(/&Icirc;/g, 'Î')
              .replace(/&Ocirc;/g, 'Ô')
              .replace(/&Ucirc;/g, 'Û')
              .replace(/&Atilde;/g, 'Ã')
              .replace(/&Otilde;/g, 'Õ')
              .replace(/&Ccedil;/g, 'Ç')
              .replace(/\s+/g, ' ')
              .trim();
            
            // Limitar tamanho da descrição
            if (chapterDescription.length > 300) {
              chapterDescription = chapterDescription.substring(0, 300) + '...';
            }
            
            if (chapterDescription.length > 20) {
              break; // Encontrou uma descrição válida
            }
          }
        }
        
        // Criar um parser de HTML simples usando regex (ou DOM se disponível)
        // Procurar por tabela que contenha NCM e Descrição
        
        // Padrão 1: Procurar por tabela HTML e extrair todas as linhas
        const tableMatch = html.match(/<table[^>]*>[\s\S]*?<\/table>/i);
        if (tableMatch) {
          const tableHtml = tableMatch[0];
          
          // Extrair todas as linhas da tabela (tr)
          const rows = tableHtml.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi);
          
          if (rows && rows.length > 0) {
            // Processar cada linha da tabela
            for (const rowHtml of rows) {
              // Extrair células da linha (td)
              const cells = rowHtml.match(/<td[^>]*>([\s\S]*?)<\/td>/gi);
              
              if (cells && cells.length >= 2) {
                let ncmCell = null;
                let descCell = null;
                
                // Procurar célula com NCM e célula com descrição
                for (let i = 0; i < cells.length; i++) {
                  const cellContent = cells[i].replace(/<[^>]*>/g, '').trim();
                  
                  // Verificar se é um código NCM (contém números e pode ter pontos)
                  if (cellContent.match(/^\d{8}(?:\.\d{2}){0,2}$|^\d{4}\.\d{2}\.\d{2}$/)) {
                    ncmCell = cellContent;
                    // Próxima célula provavelmente é a descrição
                    if (i + 1 < cells.length) {
                      descCell = cells[i + 1].replace(/<[^>]*>/g, '').trim();
                    }
                    break;
                  }
                  
                  // Se encontrou o NCM específico que estamos procurando
                  if (cellContent.includes(cleanNCM) || cellContent.includes(formattedNCM)) {
                    ncmCell = formattedNCM;
                    if (i + 1 < cells.length) {
                      descCell = cells[i + 1].replace(/<[^>]*>/g, '').trim();
                    }
                    break;
                  }
                }
                
                // Se encontrou NCM e descrição, adicionar à tabela
                if (ncmCell && descCell && descCell.length > 5) {
                  // Formatar NCM se necessário
                  let formattedNcmCell = ncmCell;
                  if (!ncmCell.includes('.')) {
                    formattedNcmCell = `${ncmCell.substring(0, 4)}.${ncmCell.substring(4, 6)}.${ncmCell.substring(6, 8)}`;
                  }
                  
                  // Decodificar entidades HTML para corrigir acentuação
                  let cleanDesc = descCell
                    .replace(/<[^>]*>/g, '')
                    .replace(/&nbsp;/g, ' ')
                    .replace(/&amp;/g, '&')
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .replace(/&quot;/g, '"')
                    .replace(/&#39;/g, "'")
                    .replace(/&aacute;/g, 'á')
                    .replace(/&eacute;/g, 'é')
                    .replace(/&iacute;/g, 'í')
                    .replace(/&oacute;/g, 'ó')
                    .replace(/&uacute;/g, 'ú')
                    .replace(/&agrave;/g, 'à')
                    .replace(/&egrave;/g, 'è')
                    .replace(/&igrave;/g, 'ì')
                    .replace(/&ograve;/g, 'ò')
                    .replace(/&ugrave;/g, 'ù')
                    .replace(/&acirc;/g, 'â')
                    .replace(/&ecirc;/g, 'ê')
                    .replace(/&icirc;/g, 'î')
                    .replace(/&ocirc;/g, 'ô')
                    .replace(/&ucirc;/g, 'û')
                    .replace(/&atilde;/g, 'ã')
                    .replace(/&otilde;/g, 'õ')
                    .replace(/&ccedil;/g, 'ç')
                    .replace(/&Aacute;/g, 'Á')
                    .replace(/&Eacute;/g, 'É')
                    .replace(/&Iacute;/g, 'Í')
                    .replace(/&Oacute;/g, 'Ó')
                    .replace(/&Uacute;/g, 'Ú')
                    .replace(/&Agrave;/g, 'À')
                    .replace(/&Egrave;/g, 'È')
                    .replace(/&Igrave;/g, 'Ì')
                    .replace(/&Ograve;/g, 'Ò')
                    .replace(/&Ugrave;/g, 'Ù')
                    .replace(/&Acirc;/g, 'Â')
                    .replace(/&Ecirc;/g, 'Ê')
                    .replace(/&Icirc;/g, 'Î')
                    .replace(/&Ocirc;/g, 'Ô')
                    .replace(/&Ucirc;/g, 'Û')
                    .replace(/&Atilde;/g, 'Ã')
                    .replace(/&Otilde;/g, 'Õ')
                    .replace(/&Ccedil;/g, 'Ç')
                    .replace(/\s+/g, ' ')
                    .trim();
                  
                  ncmTable.push({
                    ncm: formattedNcmCell,
                    description: cleanDesc
                  });
                }
              }
            }
            
            // Se encontrou a tabela e tem dados, retornar
            if (ncmTable.length > 0) {
              // Encontrar a descrição específica do NCM consultado
              const specificNCM = ncmTable.find(row => 
                row.ncm === formattedNCM || 
                row.ncm.replace(/\./g, '') === cleanNCM
              );
              
              return {
                chapterCode: chapterCode,
                chapterDescription: chapterDescription,
                ncmTable: ncmTable,
                description: specificNCM ? specificNCM.description : (ncmTable[0]?.description || ''),
                source: 'Systax - Classificação Fiscal',
                link: systaxUrl
              };
            }
          }
        }
        
        // Padrão 2: Procurar por divs ou outros elementos que contenham NCM e descrição
        // Procurar por padrão: NCM seguido de descrição
        const ncmDescPattern = new RegExp(
          `(?:${formattedNCM.replace(/\./g, '\\.')}|${cleanNCM})[\\s\\S]{0,200}?([A-ZÁÊÔÇ][^<]{20,200})`,
          'i'
        );
        const descMatch = html.match(ncmDescPattern);
        
        if (descMatch && descMatch[1]) {
          let description = descMatch[1].replace(/<[^>]*>/g, '').trim();
          description = description.replace(/\s+/g, ' ').trim();
          
          // Limpar caracteres especiais e tags HTML restantes
          description = description.replace(/&nbsp;/g, ' ')
                                  .replace(/&amp;/g, '&')
                                  .replace(/&lt;/g, '<')
                                  .replace(/&gt;/g, '>')
                                  .replace(/&quot;/g, '"')
                                  .trim();
          
          if (description && description.length > 10) {
            // Decodificar entidades HTML para corrigir acentuação
            let cleanDesc = description
              .replace(/<[^>]*>/g, '')
              .replace(/&nbsp;/g, ' ')
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&quot;/g, '"')
              .replace(/&#39;/g, "'")
              .replace(/&aacute;/g, 'á')
              .replace(/&eacute;/g, 'é')
              .replace(/&iacute;/g, 'í')
              .replace(/&oacute;/g, 'ó')
              .replace(/&uacute;/g, 'ú')
              .replace(/&agrave;/g, 'à')
              .replace(/&egrave;/g, 'è')
              .replace(/&igrave;/g, 'ì')
              .replace(/&ograve;/g, 'ò')
              .replace(/&ugrave;/g, 'ù')
              .replace(/&acirc;/g, 'â')
              .replace(/&ecirc;/g, 'ê')
              .replace(/&icirc;/g, 'î')
              .replace(/&ocirc;/g, 'ô')
              .replace(/&ucirc;/g, 'û')
              .replace(/&atilde;/g, 'ã')
              .replace(/&otilde;/g, 'õ')
              .replace(/&ccedil;/g, 'ç')
              .replace(/&Aacute;/g, 'Á')
              .replace(/&Eacute;/g, 'É')
              .replace(/&Iacute;/g, 'Í')
              .replace(/&Oacute;/g, 'Ó')
              .replace(/&Uacute;/g, 'Ú')
              .replace(/&Agrave;/g, 'À')
              .replace(/&Egrave;/g, 'È')
              .replace(/&Igrave;/g, 'Ì')
              .replace(/&Ograve;/g, 'Ò')
              .replace(/&Ugrave;/g, 'Ù')
              .replace(/&Acirc;/g, 'Â')
              .replace(/&Ecirc;/g, 'Ê')
              .replace(/&Icirc;/g, 'Î')
              .replace(/&Ocirc;/g, 'Ô')
              .replace(/&Ucirc;/g, 'Û')
              .replace(/&Atilde;/g, 'Ã')
              .replace(/&Otilde;/g, 'Õ')
              .replace(/&Ccedil;/g, 'Ç')
              .replace(/\s+/g, ' ')
              .trim();
            
            // Tentar extrair NCM da descrição ou usar o código formatado
            ncmTable.push({
              ncm: formattedNCM,
              description: cleanDesc
            });
            
            return {
              chapterCode: chapterCode,
              chapterDescription: chapterDescription,
              ncmTable: ncmTable,
              description: cleanDesc,
              source: 'Systax - Classificação Fiscal',
              link: systaxUrl
            };
          }
        }
        
        // Padrão 3: Procurar por elementos com classes específicas que possam conter descrição
        const descClassPatterns = [
          /<div[^>]*class="[^"]*desc[^"]*"[^>]*>([^<]+)<\/div>/i,
          /<span[^>]*class="[^"]*desc[^"]*"[^>]*>([^<]+)<\/span>/i,
          /<p[^>]*class="[^"]*desc[^"]*"[^>]*>([^<]+)<\/p>/i,
        ];
        
        for (const pattern of descClassPatterns) {
          const match = html.match(pattern);
          if (match && match[1]) {
            let description = match[1].trim();
            if (description && description.length > 10) {
              // Decodificar entidades HTML para corrigir acentuação
              let cleanDesc = description
                .replace(/<[^>]*>/g, '')
                .replace(/&nbsp;/g, ' ')
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'")
                .replace(/&aacute;/g, 'á')
                .replace(/&eacute;/g, 'é')
                .replace(/&iacute;/g, 'í')
                .replace(/&oacute;/g, 'ó')
                .replace(/&uacute;/g, 'ú')
                .replace(/&agrave;/g, 'à')
                .replace(/&egrave;/g, 'è')
                .replace(/&igrave;/g, 'ì')
                .replace(/&ograve;/g, 'ò')
                .replace(/&ugrave;/g, 'ù')
                .replace(/&acirc;/g, 'â')
                .replace(/&ecirc;/g, 'ê')
                .replace(/&icirc;/g, 'î')
                .replace(/&ocirc;/g, 'ô')
                .replace(/&ucirc;/g, 'û')
                .replace(/&atilde;/g, 'ã')
                .replace(/&otilde;/g, 'õ')
                .replace(/&ccedil;/g, 'ç')
                .replace(/&Aacute;/g, 'Á')
                .replace(/&Eacute;/g, 'É')
                .replace(/&Iacute;/g, 'Í')
                .replace(/&Oacute;/g, 'Ó')
                .replace(/&Uacute;/g, 'Ú')
                .replace(/&Agrave;/g, 'À')
                .replace(/&Egrave;/g, 'È')
                .replace(/&Igrave;/g, 'Ì')
                .replace(/&Ograve;/g, 'Ò')
                .replace(/&Ugrave;/g, 'Ù')
                .replace(/&Acirc;/g, 'Â')
                .replace(/&Ecirc;/g, 'Ê')
                .replace(/&Icirc;/g, 'Î')
                .replace(/&Ocirc;/g, 'Ô')
                .replace(/&Ucirc;/g, 'Û')
                .replace(/&Atilde;/g, 'Ã')
                .replace(/&Otilde;/g, 'Õ')
                .replace(/&Ccedil;/g, 'Ç')
                .replace(/\s+/g, ' ')
                .trim();
              
              // Se não encontrou tabela mas encontrou descrição, criar entrada na tabela
              if (ncmTable.length === 0) {
                ncmTable.push({
                  ncm: formattedNCM,
                  description: cleanDesc
                });
              }
              
              return {
                chapterCode: chapterCode,
                chapterDescription: chapterDescription,
                ncmTable: ncmTable,
                description: cleanDesc,
                source: 'Systax - Classificação Fiscal',
                link: systaxUrl
              };
            }
          }
        }
      }
    } catch (fetchError) {
      // CORS ou outro erro de fetch - usar abordagem alternativa
      console.log('Não foi possível buscar diretamente no systax (CORS):', fetchError);
      
      // Retornar link para consulta manual quando CORS bloquear
      return {
        chapterCode: cleanNCM.substring(0, 4),
        chapterDescription: null,
        ncmTable: [],
        description: `NCM ${formattedNCM} - Não foi possível buscar automaticamente devido a restrições de segurança do navegador (CORS).`,
        source: 'Systax - Classificação Fiscal',
        link: systaxUrl,
        note: 'Clique no link abaixo para consultar a descrição completa no site Systax. Para buscar automaticamente, seria necessário um servidor proxy ou backend.'
      };
    }

    // Se não conseguiu buscar diretamente, retornar link para consulta manual
    return {
      chapterCode: cleanNCM.substring(0, 4),
      chapterDescription: null,
      ncmTable: [],
      description: `NCM ${formattedNCM} - Consulte a descrição completa no site Systax.`,
      source: 'Systax - Classificação Fiscal',
      link: systaxUrl,
      note: 'Clique no link abaixo para consultar a descrição completa no site Systax.'
    };
  } catch (error) {
    console.error('Erro ao buscar NCM no Systax:', error);
    return null;
  }
};

/**
 * Limpa o cache da tabela NCM (útil para recarregar após atualização)
 */
export const clearNCMTableCache = () => {
  ncmTableCache = null;
  ncmTableLoading = false;
  ncmTablePromise = null;
};
