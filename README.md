# 🎓 Extrator, Gerador e Validador Moodle — Painel Unificado 📊🔍

O **Extrator, Gerador e Validador Moodle** é uma solução web integrada *client-side* (executada totalmente no navegador) desenvolvida para simplificar o cadastro, a estruturação e a validação de usuários para importação em lote no Moodle. 

Esta ferramenta unifica dois utilitários essenciais em um painel interativo moderno e responsivo, projetado com uma identidade visual elegante baseada em tons de verde esmeralda, tipografia premium (`Outfit` & `Inter`) e suporte nativo a temas **Claro** e **Escuro**.

---

## 🖥️ Painel Integrado e Recursos

O sistema é dividido em três seções principais acessíveis através do menu lateral:

### 1. Início / Painel (Dashboard)
Uma tela de boas-vindas contendo atalhos rápidos e descrições dos dois sistemas integrados, ideal para navegação rápida.

### 2. Extrator / Gerador de CSV
Permite montar a lista de alunos e servidores manualmente ou importando uma planilha base simples:
* **Nome Breve da Sala**: Campo dedicado a informar o curso destino no Moodle com ajuda visual integrada (`moodle_guide.png`).
* **Edição por Tabela Dinâmica**: Adicione, preencha e exclua linhas na tabela diretamente na tela.
* **Seleção e Ações em Lote**: Selecione múltiplos usuários (utilizando a tecla `Shift` para selecionar intervalos rapidamente) e defina seus papéis de uma só vez por meio de botões temáticos coloridos.
* **Destaque Visual por Papel**: As linhas da tabela assumem cores associadas aos papéis (ex: Alunos em azul, Professores em verde, Tutores em roxo/azul-petróleo).
* **Botão Limpar**: Apaga todos os dados e restaura a tabela para o estado inicial limpo (uma linha vazia, campo de sala limpo, erros removidos).

### 3. Validador de Planilhas
Valida regras estruturais e de dados de planilhas prontas nos formatos **CSV, ODS, XLSX ou XLS** antes de carregá-las definitivamente no Moodle:
* **Upload por Arrastar e Soltar (Drag & Drop)**: Arraste e solte o arquivo em qualquer área da aba de validação para carregá-lo.
* **Autodetecção de Separador**: Para arquivos CSV, detecta automaticamente se o delimitador é vírgula (`,`) ou ponto e vírgula (`;`).
* **Preservação de Zeros à Esquerda**: Garante que identificadores numéricos iniciados em zero (como CPFs e SIAPEs) não percam os dígitos iniciais durante a leitura.
* **Legenda e Destaque Dinâmico**: Células com erros de validação ou e-mails duplicados são realçadas em cores pastéis (vermelho e amarelo) com etiquetas indicativas do erro direto na tabela de pré-visualização.
* **Botão Limpar / Novo arquivo**: Apaga completamente os dados em cache e os resultados renderizados, retornando o usuário de forma limpa à tela de upload de arquivos.

---

## 📋 Regras de Validação de Dados

Para garantir que o Moodle aceite a importação sem rejeitar registros, o sistema valida:

### Validação de Colunas (Validador)
O Moodle espera as seguintes colunas estruturais:
`firstname`, `lastname`, `username`, `email`, `course1`, `group1`, `role1`, `idnumber` e `password`.
* *Nota:* A ausência de colunas opcionais ou a inclusão de colunas extras gera apenas **avisos** (*warnings*), sem bloquear a análise dos dados principais.

### Validação de Campos por Linha (Ambos os módulos)
* **`firstname` (Nome) / `lastname` (Sobrenome)**: Obrigatórios e não podem estar em branco.
* **`email`**: Deve possuir formato de e-mail válido e **não pode conter nenhum caractere acentuado ou cedilha (`ç`)**. Também verifica e-mails duplicados na própria planilha, informando as linhas em conflito.
* **`course1`**: Obrigatório (representa o nome breve da sala Moodle).
* **`role1` (Papel no Moodle)**: Mapeado automaticamente entre os nomes amigáveis (Gerador) e seus respectivos identificadores numéricos oficiais do Moodle (Validador):
  * `2` ➔ Editor Moodle
  * `3` ➔ Professor Formador
  * `4` ➔ Tutor à Distância
  * `5` ➔ Aluno
  * `9` ➔ Coordenador de Curso
  * `10` ➔ Tutor Presencial
  * `11` ➔ Coordenador de Polo
  * `28` ➔ Monitor
* **`password` (Senha)**: Obrigatório conter a senha temporária padrão definida como `Mud@r123` para a validação.
* **`username` (Login) e `idnumber`**:
  * Devem conter **exatamente o mesmo valor** e não podem possuir acentos ou caracteres especiais.
  * O tipo de identificador é detectado automaticamente:
    * **SIAPE**: Exatamente 7 dígitos numéricos.
    * **CPF**: 11 dígitos numéricos. Passa por validação matemática de dígitos verificadores (algoritmo de Módulo 11).
    * **Matrícula**: Se contiver letras, devem ser escritas **obrigatoriamente em minúsculas**.
    * **SIAPE Curto**: Menos de 7 caracteres numéricos acusam erro de preenchimento incompleto.

---

## 🛠️ Especificações Técnicas de Exportação

Ao baixar planilhas geradas ou sanitizadas do validador, o CSV exportado atende aos padrões exigidos pelo utilitário de upload em lote do Moodle (`/admin/tool/uploaduser/index.php`):
* **Formato**: Codificado em UTF-8 com assinatura BOM (`\uFEFF`), que garante compatibilidade de caracteres acentuados no Microsoft Excel e LibreOffice Calc.
* **Delimitador**: Ponto e vírgula (`;`).
* **CPFs**: Gravados apenas como números limpos (sem pontuação).
* **Logins/Matrículas**: Convertidos automaticamente para letras minúsculas.

---

## 📂 Estrutura do Projeto

Os arquivos principais estão localizados na raiz do repositório:
* 🖥️ **`index.html`**: A estrutura base em HTML5 de página única (SPA) contendo as abas do dashboard, gerador e validador.
* 🎨 **`styles.css`**: Folha de estilos vanilla contendo o design system, variáveis de tema (claro e escuro) e regras de responsividade.
* ⚙️ **`app.js`**: Toda a lógica client-side da aplicação (mecanismo de tabelas dinâmicas, validação matemática de CPF, leitura de planilhas e sanitização).
* 📁 **`assets/images/moodle_guide.png`**: Captura de tela integrada utilizada na documentação visual de ajuda.

---

## 🚀 Como Executar

Por ser uma aplicação totalmente client-side, **não há necessidade de instalar dependências locais ou configurar servidores backend**.

1. Baixe ou clone este repositório.
2. Abra o arquivo **`index.html`** diretamente em seu navegador (dando duplo clique no arquivo ou usando extensões como *Live Server* no VS Code).
3. Caso queira implantar na nuvem, você pode copiar os arquivos `index.html`, `styles.css`, `app.js` e a pasta `assets` para qualquer servidor de arquivos estáticos (GitHub Pages, Vercel, Netlify, Nginx, Apache, IIS, etc.).

---

## 👥 Autoria e Créditos

Este painel unificado foi idealizado e desenvolvido por:
* **Autor**: Jorgyan Ribeiro ([@jorgyan](https://github.com/jorgyan))
* **Cargo**: Técnico de TI do CEFOR/IFES
* **Contato**: [jorgyan.pinto@ifes.edu.br](mailto:jorgyan.pinto@ifes.edu.br)
* **LinkedIn**: [in/jorgyan](https://www.linkedin.com/in/jorgyan)
