# NCM Dashboard

Sistema de gerenciamento de planilhas com dashboard desenvolvido em React, Tailwind CSS e Firebase.

## Funcionalidades

- 📤 **Upload de Planilhas**: Suporte para arquivos Excel (.xls, .xlsx) e CSV
- 💾 **Armazenamento no Firebase**: Dados salvos no Firestore
- 📊 **Dashboard Interativo**: Visualização de estatísticas e dados
- 🔍 **Busca e Filtros**: Busca em tempo real nos dados
- 📥 **Exportação**: Exportar dados para Excel
- 📱 **Responsivo**: Interface adaptável para diferentes tamanhos de tela
- 🎯 **Campos Específicos**: Sistema configurado para trabalhar com campos NCM específicos

## Campos da Planilha

O sistema está configurado para trabalhar com os seguintes campos:

1. **NCM** - Código NCM
2. **ultima atualização** - Data da última atualização
3. **CEST** - Código CEST
4. **IVA** - Imposto sobre Valor Agregado
5. **II** - Imposto de Importação
6. **IPI** - Imposto sobre Produtos Industrializados
7. **PIS** - Programa de Integração Social
8. **COFINS** - Contribuição para o Financiamento da Seguridade Social
9. **ICMS** - Imposto sobre Circulação de Mercadorias e Serviços
10. **U$/KG considerado** - Valor unitário por quilograma
11. **Santos** - Valor/Porto de Santos
12. **Itajai** - Valor/Porto de Itajaí

O sistema normaliza automaticamente os nomes dos campos, aceitando variações como maiúsculas/minúsculas e acentuação.

## Pré-requisitos

- Node.js (versão 14 ou superior)
- npm ou yarn
- Conta no Firebase com projeto criado

## Instalação

1. Clone o repositório ou navegue até a pasta do projeto:
```bash
cd NCM
```

2. Instale as dependências:
```bash
npm install
```

3. Configure o Firebase:
   - Acesse o [Console do Firebase](https://console.firebase.google.com/)
   - Crie um novo projeto ou use um existente
   - Vá em "Configurações do Projeto" > "Seus apps" > "Web"
   - Copie as credenciais de configuração
   - Copie o arquivo `.env.example` para `.env.local`:
     ```bash
     cp .env.example .env.local
     ```
   - Abra o arquivo `.env.local` e preencha com suas credenciais do Firebase:
     ```
     REACT_APP_FIREBASE_API_KEY=sua-api-key
     REACT_APP_FIREBASE_AUTH_DOMAIN=seu-projeto.firebaseapp.com
     REACT_APP_FIREBASE_PROJECT_ID=seu-projeto-id
     REACT_APP_FIREBASE_STORAGE_BUCKET=seu-projeto.appspot.com
     REACT_APP_FIREBASE_MESSAGING_SENDER_ID=seu-sender-id
     REACT_APP_FIREBASE_APP_ID=seu-app-id
     ```
   - ⚠️ **Importante**: O arquivo `.env.local` não é commitado no Git por questões de segurança

4. Configure as regras do Firestore:
   - No Console do Firebase, vá em "Firestore Database"
   - Clique em "Regras"
   - Use as seguintes regras (ajuste conforme necessário para produção):

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true; // Ajuste para produção com autenticação
    }
  }
}
```

## Executando o Projeto

Para iniciar o servidor de desenvolvimento:

```bash
npm start
```

O aplicativo estará disponível em [http://localhost:3000](http://localhost:3000)

## Estrutura do Projeto

```
NCM/
├── public/
│   └── index.html
├── src/
│   ├── components/
│   │   ├── Dashboard.js       # Componente principal do dashboard
│   │   ├── DataTable.js       # Tabela de visualização dos dados
│   │   └── FileUpload.js      # Componente de upload de arquivos
│   ├── firebase/
│   │   └── config.js          # Configuração do Firebase
│   ├── services/
│   │   └── spreadsheetService.js  # Serviços para manipulação de planilhas
│   ├── App.js
│   ├── index.js
│   └── index.css
├── package.json
├── tailwind.config.js
└── postcss.config.js
```

## Uso

1. **Upload de Planilha**:
   - Clique na área de upload ou arraste um arquivo
   - Selecione um arquivo Excel ou CSV
   - Visualize o preview dos dados
   - Clique em "Salvar no Banco de Dados"

2. **Visualização de Dados**:
   - Os dados salvos aparecem automaticamente na tabela
   - Use a barra de busca para filtrar registros
   - Clique nos cabeçalhos das colunas para ordenar
   - Use a paginação para navegar entre os registros

3. **Exportação**:
   - Clique no botão "Exportar Excel" para baixar os dados

## Tecnologias Utilizadas

- **React**: Biblioteca JavaScript para construção de interfaces
- **Tailwind CSS**: Framework CSS utilitário
- **Firebase Firestore**: Banco de dados NoSQL
- **XLSX**: Biblioteca para leitura e escrita de arquivos Excel
- **Lucide React**: Ícones modernos

## Notas Importantes

⚠️ **Segurança**: As regras do Firestore fornecidas permitem leitura e escrita sem autenticação. Para produção, implemente autenticação e regras de segurança adequadas.

## Suporte

Para problemas ou dúvidas, verifique:
- Se as credenciais do Firebase estão corretas
- Se as regras do Firestore estão configuradas
- Se todas as dependências foram instaladas corretamente

