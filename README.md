# Gestão de Alunos API

API REST para gestão de alunos, disciplinas, notas e trabalhos, com banco de dados em memória.

## Descrição

A API modela um cenário simples de gestão escolar com dois tipos de uso:

- **Administrador**: cadastra alunos, cadastra disciplinas, matricula alunos em disciplinas e
  lança notas.
- **Aluno**: consulta as disciplinas em que está matriculado, consulta suas próprias notas e
  registra trabalhos (entregas) para as disciplinas cursadas.

Essas duas perspectivas são refletidas diretamente na organização das rotas:

- `/api/admin/*` — operações do administrador (CRUD de alunos, disciplinas, matrículas, notas e
  correção de trabalhos). **Restrito a usuários com papel `admin`.**
- `/api/alunos/*` — autoatendimento do aluno (consulta de disciplinas, consulta de notas e
  registro de trabalhos). **Restrito ao próprio aluno autenticado (dono do `alunoId`) ou a um
  administrador.**

Toda a API é protegida por autenticação **JWT**, exceto o endpoint de login. Não existe endpoint
de cadastro de administrador — ele já vem pré-cadastrado no banco em memória (veja
[Autenticação](#autenticação) abaixo).

O banco de dados é **em memória** (um objeto JavaScript mantido no processo Node) — os dados são
reiniciados sempre que o servidor é reiniciado, voltando ao conjunto de dados fake descrito abaixo.

## Stack utilizada

- **Node.js** com módulos ES (`"type": "module"` no `package.json`)
- **Express** — framework web e roteamento
- **jsonwebtoken** — emissão e verificação dos tokens JWT usados na autenticação
- **bcryptjs** — hash das senhas armazenadas no banco em memória
- **js-yaml** — carregamento do arquivo de documentação OpenAPI em YAML
- **swagger-ui-express** — renderização do Swagger UI a partir do YAML
- **cors** — liberação de CORS para consumo por outros clientes/origens
- **morgan** — log de requisições HTTP no console
- **nodemon** (dependência de desenvolvimento) — reinício automático do servidor durante o
  desenvolvimento

Sem banco de dados externo nem ORM — persistência é 100% em memória, propositalmente simples para
fins de estudo/demonstração. A autenticação, porém, é real: senhas com hash (bcrypt) e sessões
via JWT assinado.

## Arquitetura do código

```
src/
  app.js                 # configuração do Express: middlewares, Swagger, rotas, erros
  server.js              # ponto de entrada: sobe o servidor HTTP (separado do app)
  config/
    jwt.js                # segredo e tempo de expiração do JWT
  routes/                # definição das rotas (Express Router), sem lógica de negócio
    index.js
    auth.routes.js         # login -> /api/auth (público)
    aluno.routes.js       # rotas de autoatendimento do aluno -> /api/alunos (protegidas)
    admin/                # rotas do administrador -> /api/admin (protegidas, papel admin)
  controllers/            # lida com req/res, delega para os services
  services/               # regras de negócio e validações
  models/                 # formato/criação das entidades (factories), incluindo hash de senha
  database/
    db.js                 # banco de dados em memória (coleções + operações CRUD genéricas)
    seed.js                # dados fake carregados na inicialização (inclui o admin)
  middlewares/
    authenticate.js        # valida o JWT e popula req.user
    authorize.js            # restringe uma rota a um ou mais papéis (ex.: "admin")
    authorizeSelfOrAdmin.js # em /api/alunos/:alunoId, exige ser o próprio aluno ou um admin
    notFound.js
    errorHandler.js
  utils/
    ApiError.js
    asyncHandler.js
docs/
  openapi.yaml            # especificação Swagger/OpenAPI (fonte da documentação)
```

## Instalação e execução

Pré-requisito: Node.js 18+ (usa `crypto.randomUUID`, disponível nativamente).

```bash
# instalar dependências
npm install

# subir em modo produção
npm start

# subir em modo desenvolvimento (reinício automático com nodemon)
npm run dev
```

O servidor sobe por padrão em `http://localhost:3000` (pode ser alterado com a variável de
ambiente `PORT`).

## Documentação da API (Swagger)

A documentação completa de todas as rotas, parâmetros, corpos de requisição e respostas está
disponível em:

- **Swagger UI (interface interativa):** `http://localhost:3000/api-docs`
- **Arquivo YAML bruto servido pela API:** `http://localhost:3000/api-docs.yaml`
- **Fonte do arquivo no repositório:** [`docs/openapi.yaml`](docs/openapi.yaml)

A raiz da API (`GET /`) também retorna um JSON simples com o nome, descrição e o link para a
documentação.

## Autenticação

A API usa **JWT** (`Authorization: Bearer <token>`). Todas as rotas exigem um token válido,
exceto `POST /api/auth/login`.

1. Faça login informando `email` e `senha` de um administrador ou de um aluno já cadastrado:

   ```bash
   curl -X POST http://localhost:3000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@escola.com","senha":"admin123"}'
   ```

   A resposta traz o `token` e os dados básicos do usuário autenticado (`id`, `nome`, `email`,
   `role`).

2. Envie o token nas próximas requisições:

   ```bash
   curl http://localhost:3000/api/admin/alunos \
     -H "Authorization: Bearer <token>"
   ```

No Swagger UI (`/api-docs`), clique em **Authorize** e informe `Bearer <token>` para testar as
rotas protegidas diretamente pela interface.

### Regras de autorização

- **`/api/admin/*`** — exige token com papel `admin`. É aqui que alunos, disciplinas e notas são
  cadastrados; apenas o administrador tem acesso.
- **`/api/alunos/{alunoId}/*`** — exige token válido (admin ou aluno). Um aluno só acessa quando
  `alunoId` é o seu próprio id; um administrador pode acessar os dados de qualquer aluno.
- Não existe endpoint para cadastrar administradores: o único admin do sistema já vem
  pré-cadastrado no banco em memória (credenciais na seção de dados fake abaixo).
- Quando um administrador cadastra um aluno (`POST /api/admin/alunos`), ele também define a senha
  inicial de acesso desse aluno (campo `senha`, obrigatório no cadastro).
- Senhas nunca são retornadas pela API — são armazenadas apenas como hash (bcrypt).

## Dados fake pré-carregados

Ao iniciar, o banco em memória já vem populado com os dados abaixo (ids legíveis, para facilitar
testes manuais via Swagger UI ou curl). Todas as senhas abaixo são apenas para demonstração.

### Administrador (`/api/auth/login`)

| id               | nome                       | email             | senha    |
|------------------|-----------------------------|-------------------|----------|
| `admin-principal`| Administrador do Sistema   | admin@escola.com  | admin123 |

### Alunos (`/api/admin/alunos`)

| id                   | nome          | email                       | matrícula | senha  |
|----------------------|---------------|------------------------------|-----------|--------|
| `aluno-ana-souza`    | Ana Souza     | ana.souza@example.com       | 2024001   | 123456 |
| `aluno-bruno-lima`   | Bruno Lima    | bruno.lima@example.com      | 2024002   | 123456 |
| `aluno-carla-mendes` | Carla Mendes  | carla.mendes@example.com    | 2024003   | 123456 |

### Disciplinas (`/api/admin/disciplinas`)

| id                            | nome              | código  | carga horária |
|--------------------------------|-------------------|---------|----------------|
| `disciplina-matematica`        | Matemática        | MAT101  | 60h            |
| `disciplina-historia`          | História          | HIS101  | 40h            |
| `disciplina-programacao-web`   | Programação Web   | PRW201  | 80h            |

### Matrículas

| aluno         | disciplina         |
|---------------|---------------------|
| Ana Souza     | Matemática          |
| Ana Souza     | Programação Web     |
| Bruno Lima    | Matemática          |
| Bruno Lima    | História            |
| Carla Mendes  | Programação Web     |

### Notas (`/api/admin/notas`)

| aluno         | disciplina         | tipo         | valor |
|---------------|---------------------|--------------|-------|
| Ana Souza     | Matemática          | prova        | 8.5   |
| Ana Souza     | Programação Web     | prova        | 9.2   |
| Bruno Lima    | Matemática          | prova        | 6.0   |
| Bruno Lima    | História            | participação | 7.5   |
| Carla Mendes  | Programação Web     | prova        | 10    |

### Trabalhos (`/api/admin/trabalhos`)

| aluno         | disciplina    | título                                  | status      |
|---------------|---------------|-------------------------------------------|-------------|
| Ana Souza     | Matemática    | Lista de Exercícios 1                     | entregue    |
| Bruno Lima    | História      | Linha do Tempo - Revolução Industrial     | corrigido (nota 8.0) |
| Carla Mendes  | Programação Web | Landing Page Responsiva                 | entregue    |

### Exemplos rápidos de uso

```bash
# Login como admin
ADMIN_TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@escola.com","senha":"admin123"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).token')

# Admin: listar alunos
curl http://localhost:3000/api/admin/alunos -H "Authorization: Bearer $ADMIN_TOKEN"

# Admin: matricular a Carla em História
curl -X POST http://localhost:3000/api/admin/disciplinas/disciplina-historia/matriculas \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"alunoId":"aluno-carla-mendes"}'

# Admin: lançar uma nota
curl -X POST http://localhost:3000/api/admin/notas \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"alunoId":"aluno-ana-souza","disciplinaId":"disciplina-matematica","valor":7.8,"tipo":"trabalho"}'

# Login como aluno (Ana)
ALUNO_TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ana.souza@example.com","senha":"123456"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).token')

# Aluno: ver minhas disciplinas
curl http://localhost:3000/api/alunos/aluno-ana-souza/disciplinas -H "Authorization: Bearer $ALUNO_TOKEN"

# Aluno: ver minhas notas
curl http://localhost:3000/api/alunos/aluno-ana-souza/notas -H "Authorization: Bearer $ALUNO_TOKEN"

# Aluno: registrar um trabalho
curl -X POST http://localhost:3000/api/alunos/aluno-ana-souza/trabalhos \
  -H "Authorization: Bearer $ALUNO_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"disciplinaId":"disciplina-matematica","titulo":"Lista de Exercícios 2"}'
```

> Novos registros criados via API recebem ids no formato UUID (gerados com
> `crypto.randomUUID()`), diferente dos ids legíveis usados nos dados fake acima.

## Testes automatizados

A suíte usa **Mocha**, **SuperTest** e **Chai** (`expect`). Os ficheiros seguem o padrão
`test/**/*.test.js`.

```
test/
  Interno/     # request(app) — a app Express em memória, sem servidor HTTP
  Externo/     # request(URL_BASE) — HTTP contra a API a correr
  helpers/     # loginAdmin, loginAluno
  data/        # JSON de cenários (massa de teste, sem hardcode nos ficheiros)
```

- **Interno** — importa `src/app.js`. Mocks apenas aqui, com **Sinon** (`sinon.restore()` no
  `afterEach`). Fonte: [`test/Interno/login.test.js`](test/Interno/login.test.js) e
  [`test/data/login.json`](test/data/login.json).
- **Externo** — chama `http://localhost:3000` (ou `API_BASE_URL`). O servidor tem de estar
  a correr (`npm start` / `npm run dev`). Fonte:
  [`test/Externo/alunos.externo.test.js`](test/Externo/alunos.externo.test.js) e
  [`test/data/alunos-fluxo.json`](test/data/alunos-fluxo.json).

```bash
# todos os testes (a API precisa de estar up para os Externo)
npm test

# só interno (não precisa de servidor HTTP)
npx mocha "test/Interno/login.test.js"

# só externo
npx mocha "test/Externo/alunos.externo.test.js"
```

Os blocos Gherkin abaixo espelham cada `describe` / `it` da suíte. E-mail e matrícula de
alunos novos são gerados com `Date.now()` para permanecerem únicos enquanto o processo da
API (banco em memória) estiver ativo.

Features documentadas:

1. Login (Interno)
2. Fluxo de aluno — cadastro, matrícula e entrega (Externo, 2 cenários)
3. Fluxo — aluno, lista e disciplina Métricas da IA (Externo)
4. Casos negativos — cadastro, autenticação e entrega (Externo)
5. Fluxo — 20 alunos, Matemática, notas e trabalhos (Externo)

## Casos de teste (Gherkin)

### Feature: Login (testes internos)

```gherkin
Feature: Login
  Como utilizador da API
  Quero autenticar-me em POST /api/auth/login
  Para obter um token JWT ou uma mensagem de erro adequada

  Scenario: deve retornar 200 quando o usuário e senha forem corretos
    Given que a app Express está disponível em memória
    When envio POST /api/auth/login com:
      | email            | senha    |
      | admin@escola.com | admin123 |
    Then o status HTTP deve ser 200

  Scenario: deve retornar 400 quando a requisição for inválida (dados ausentes)
    Given que a app Express está disponível em memória
    When envio POST /api/auth/login com:
      | email            | senha |
      | admin@escola.com |       |
    Then o status HTTP deve ser 400
    And o corpo deve conter a propriedade "error" em string

  Scenario: deve retornar 401 quando a senha estiver inválida
    Given que a app Express está disponível em memória
    When envio POST /api/auth/login com:
      | email            | senha |
      | admin@escola.com | 8454  |
    Then o status HTTP deve ser 401
    And o corpo deve conter a propriedade "error" em string

  Scenario: deve retornar 500 Mock
    Given que o serviço de autenticação está simulado com Sinon
    And que authService.login lança o erro "ERRO CASTRATROFICO"
    When envio POST /api/auth/login com:
      | email            | senha |
      | admin@escola.com | 8454  |
    Then o status HTTP deve ser 500
    And o corpo deve conter error "Erro interno do servidor."
```

### Feature: Fluxo de aluno — cadastro, matrícula e entrega (testes externos)

Este feature corre **duas vezes**, uma por linha de `cenarios` em
[`test/data/alunos-fluxo.json`](test/data/alunos-fluxo.json). Os `it` são encadeados: cada
passo reutiliza o token e o `alunoId` do passo anterior.

```gherkin
Feature: Fluxo de aluno
  Como administrador e depois como o aluno cadastrado
  Quero criar o aluno, matriculá-lo, autenticá-lo e registar um trabalho
  Para validar o fluxo de ponta a ponta

  Examples:
    | nomeCenario  | nome                  | emailPrefix     | matriculaPrefix | senha  | disciplinaId               | titulo                 | descricao                               |
    | aluna Joana  | Joana Novaes Kardec   | novaes.kardec   | 2027            | 123456 | disciplina-matematica      | Lista de Exercicios 2  | Resolucao dos exercicios propostos.     |
    | aluno Marcos | Marcos Oliveira Lima  | marcos.oliveira | 2028            | 654321 | disciplina-programacao-web | Projeto Web Responsivo | Implementacao de uma pagina responsiva. |

  Scenario Outline: deve realizar login como administrador
    Given que a API está em execução
    When envio POST /api/auth/login com email "admin@escola.com" e senha "admin123"
    Then o status HTTP deve ser 200
    And o corpo deve conter um token JWT em string
    And o usuário autenticado deve ter email "admin@escola.com" e role "admin"

  Scenario Outline: deve cadastrar um aluno com dados únicos
    Given que o administrador está autenticado
    When envio POST /api/admin/alunos com nome "<nome>", e-mail único a partir de "<emailPrefix>", matrícula única a partir de "<matriculaPrefix>" e senha "<senha>"
    Then o status HTTP deve ser 201
    And o corpo deve incluir nome, email e matricula enviados
    And o corpo não deve conter o campo senha
    And o id do aluno deve ser uma string

  Scenario Outline: deve matricular o aluno em uma disciplina
    Given que o administrador está autenticado
    And que o aluno acabou de ser cadastrado
    When envio POST /api/admin/disciplinas/<disciplinaId>/matriculas com o alunoId criado
    Then o status HTTP deve ser 201
    And o corpo deve incluir alunoId e disciplinaId "<disciplinaId>"

  Scenario Outline: deve realizar login como o aluno cadastrado
    Given que o aluno foi cadastrado com e-mail único e senha "<senha>"
    When envio POST /api/auth/login com o e-mail e a senha desse aluno
    Then o status HTTP deve ser 200
    And o usuário autenticado deve incluir id, nome "<nome>", email e role "aluno"
    And o corpo deve conter um token JWT em string

  Scenario Outline: deve registrar a entrega do trabalho como aluno
    Given que o aluno está autenticado e matriculado na disciplina "<disciplinaId>"
    When envio POST /api/alunos/{alunoId}/trabalhos com disciplinaId, titulo "<titulo>" e descricao "<descricao>"
    Then o status HTTP deve ser 201
    And o corpo deve incluir alunoId, disciplinaId, titulo, descricao e status "entregue"
    And o id da entrega deve ser uma string
    And nota e feedback devem ser null
    And dataEntrega deve ser uma string

  Scenario Outline: deve validar status, usuário, papel e dados da entrega
    Given que o administrador autenticou-se com role "admin"
    And que o aluno autenticou-se com o seu próprio id e role "aluno"
    And que a entrega foi registada com status "entregue"
    When envio GET /api/alunos/{alunoId}/trabalhos com o token do aluno
    Then o status HTTP deve ser 200
    And o corpo deve ser um array
    And o array deve conter a entrega com alunoId, disciplinaId, titulo, descricao e status "entregue"
```

### Feature: Fluxo — aluno, lista e disciplina Métricas da IA (testes externos)

```gherkin
Feature: Fluxo aluno, lista e disciplina Métricas da IA
  Como administrador
  Quero criar um aluno, listar os alunos e matricular todos numa disciplina nova
  Para validar cadastro, listagem e matrícula em lote

  Scenario: deve realizar login como administrador
    Given que a API está em execução
    When envio POST /api/auth/login com email "admin@escola.com" e senha "admin123"
    Then o status HTTP deve ser 200
    And o corpo deve conter um token JWT em string
    And o usuário autenticado deve ter email "admin@escola.com" e role "admin"

  Scenario: deve criar um aluno e validar 201
    Given que o administrador está autenticado
    When envio POST /api/admin/alunos com nome "Ana Souza", e-mail único a partir de "ana.souza", matrícula única a partir de "2024001" e senha "123456"
    Then o status HTTP deve ser 201
    And o corpo deve incluir nome, email e matricula enviados
    And o id do aluno deve ser uma string
    And o corpo não deve conter o campo senha

  Scenario: deve listar os alunos cadastrados com 200
    Given que o administrador está autenticado
    And que o aluno acabou de ser criado
    When envio GET /api/admin/alunos
    Then o status HTTP deve ser 200
    And o corpo deve ser um array com pelo menos 1 elemento
    And o array deve conter o aluno criado com nome, email e matricula

  Scenario: deve cadastrar a disciplina Métricas da IA
    Given que o administrador está autenticado
    When envio POST /api/admin/disciplinas com nome "Métricas da IA", código único a partir de "MIA" e cargaHoraria 40
    Then o status HTTP deve ser 201
    And o corpo deve incluir nome "Métricas da IA"
    And codigo e id devem ser strings

  Scenario: deve matricular a lista de alunos na disciplina e validar o cadastro
    Given que o administrador está autenticado
    And que a disciplina "Métricas da IA" foi criada
    And que a listagem de alunos cadastrados está disponível
    When envio POST /api/admin/disciplinas/{disciplinaId}/matriculas para cada aluno da lista
    Then cada matrícula deve devolver status HTTP 201 com alunoId e disciplinaId
    When envio GET /api/admin/disciplinas/{disciplinaId}/alunos
    Then o status HTTP deve ser 200
    And o corpo deve ser um array com o mesmo comprimento da lista de alunos
    And todos os ids da lista devem estar matriculados na disciplina
```

### Feature: Casos negativos — cadastro, autenticação e entrega (testes externos)

Os três primeiros cenários preparam o aluno usado nos erros. Os restantes validam 400, 401,
403 e 409.

```gherkin
Feature: Casos negativos de cadastro, autenticação e entrega
  Como consumidor da API
  Quero receber erros explícitos quando o pedido é inválido, não autenticado, sem permissão ou em conflito
  Para não persistir dados inconsistentes

  Background:
    Given que a API está em execução
    And que as credenciais do administrador seed são email "admin@escola.com" e senha "admin123"

  Scenario: deve realizar login como administrador
    When envio POST /api/auth/login com as credenciais do administrador
    Then o status HTTP deve ser 200
    And o corpo deve conter um token JWT em string

  Scenario: deve cadastrar um aluno para os casos negativos
    Given que o administrador está autenticado
    When envio POST /api/admin/alunos com nome "Aluno Casos Negativos", e-mail único a partir de "aluno.negativo", matrícula única a partir de "NEG" e senha "123456"
    Then o status HTTP deve ser 201
    And o id do aluno deve ser uma string

  Scenario: deve realizar login como o aluno cadastrado
    Given que o aluno dos casos negativos foi cadastrado
    When envio POST /api/auth/login com o e-mail e a senha "123456" desse aluno
    Then o status HTTP deve ser 200
    And o corpo deve conter um token JWT em string

  Scenario: deve retornar 400 ao cadastrar aluno sem campos obrigatórios
    Given que o administrador está autenticado
    When envio POST /api/admin/alunos apenas com o campo nome
    Then o status HTTP deve ser 400
    And o error deve ser 'Os campos "nome", "email", "matricula" e "senha" são obrigatórios.'

  Scenario: deve retornar 400 ao matricular sem alunoId
    Given que o administrador está autenticado
    When envio POST /api/admin/disciplinas/disciplina-matematica/matriculas com o corpo vazio
    Then o status HTTP deve ser 400
    And o error deve ser 'O campo "alunoId" é obrigatório.'

  Scenario: deve retornar 400 ao registrar trabalho sem disciplinaId e titulo
    Given que o aluno dos casos negativos está autenticado
    When envio POST /api/alunos/{alunoId}/trabalhos com o corpo vazio
    Then o status HTTP deve ser 400
    And o error deve ser 'Os campos "disciplinaId" e "titulo" são obrigatórios.'

  Scenario: deve retornar 400 ao autenticar sem senha
    When envio POST /api/auth/login apenas com email "admin@escola.com"
    Then o status HTTP deve ser 400
    And o error deve ser 'Os campos "email" e "senha" são obrigatórios.'

  Scenario: deve retornar 401 ao cadastrar aluno sem token
    When envio POST /api/admin/alunos sem o header Authorization
    Then o status HTTP deve ser 401
    And o error deve ser "Token de autenticação não informado."

  Scenario: deve retornar 401 ao registrar trabalho com token inválido
    When envio POST /api/alunos/{alunoId}/trabalhos com Authorization "Bearer token-invalido"
    And o corpo contém disciplinaId "disciplina-matematica", titulo "Entrega invalida" e descricao "Nao deve ser aceita."
    Then o status HTTP deve ser 401
    And o error deve ser "Token de autenticação inválido ou expirado."

  Scenario: deve retornar 401 ao autenticar com senha inválida
    Given que o aluno dos casos negativos está cadastrado
    When envio POST /api/auth/login com o e-mail desse aluno e senha "senha-invalida"
    Then o status HTTP deve ser 401
    And o error deve ser "E-mail ou senha inválidos."

  Scenario: deve retornar 403 quando o aluno tenta cadastrar outro aluno
    Given que o aluno dos casos negativos está autenticado
    When envio POST /api/admin/alunos com o token desse aluno e dados de "Aluno Sem Permissao"
    Then o status HTTP deve ser 403
    And o error deve ser "Você não tem permissão para acessar este recurso."

  Scenario: deve retornar 403 quando o aluno registra entrega de outro aluno
    Given que o aluno dos casos negativos está autenticado
    When envio POST /api/alunos/aluno-ana-souza/trabalhos com o token desse aluno
    Then o status HTTP deve ser 403
    And o error deve ser "Você só pode acessar os seus próprios dados."

  Scenario: deve retornar 409 ao cadastrar aluno com e-mail duplicado
    Given que o administrador está autenticado
    And que já existe o aluno seed Ana Souza com email "ana.souza@example.com" e matrícula "2024001"
    When envio POST /api/admin/alunos com nome "Ana Souza", email "ana.souza@example.com", matricula "2024001" e senha "123456"
    Then o status HTTP deve ser 409
    And o error deve ser "Já existe um aluno cadastrado com essa matrícula ou e-mail."

  Scenario: deve retornar 409 ao matricular aluno já matriculado
    Given que o administrador está autenticado
    And que o aluno dos casos negativos já foi matriculado em "disciplina-matematica"
    When envio novamente POST /api/admin/disciplinas/disciplina-matematica/matriculas com o mesmo alunoId
    Then o status HTTP deve ser 409
    And o error deve ser "Aluno já está matriculado nesta disciplina."

  Scenario: deve retornar 409 ao registrar trabalho sem matrícula na disciplina
    Given que o aluno dos casos negativos está autenticado
    And que esse aluno não está matriculado em "disciplina-historia"
    When envio POST /api/alunos/{alunoId}/trabalhos com disciplinaId "disciplina-historia"
    Then o status HTTP deve ser 409
    And o error deve ser "O aluno não está matriculado nesta disciplina."
```

### Feature: Fluxo — 20 alunos, Matemática, notas e trabalhos (testes externos)

Massa em `loteMatematica` de [`test/data/alunos-fluxo.json`](test/data/alunos-fluxo.json).
E-mail e matrícula de cada aluno usam `Date.now()` para permanecer únicos. Os `it` são
encadeados: token, ids, notas e trabalho do passo anterior alimentam o seguinte.

```gherkin
Feature: Fluxo de 20 alunos, Matemática, notas e trabalhos
  Como administrador e como um dos alunos cadastrados
  Quero cadastrar um lote, matricular, lançar e consultar notas e trabalhos
  Para validar o fluxo em escala e os erros de autorização

  Background:
    Given que a API está em execução
    And que as credenciais do administrador seed são email "admin@escola.com" e senha "admin123"
    And que o lote tem 20 nomes e senha "123456"
    And que a disciplina do lote se chama "Matemática" com cargaHoraria 60
    And que a nota inicial tem valor 7, tipo "prova" e descricao "Prova 1 - Álgebra"
    And que a nota atualizada tem valor 8.5
    And que a nota seed é "nota-ana-matematica-prova1" do aluno "Ana Souza"

  Scenario: deve realizar login como administrador
    When envio POST /api/auth/login com as credenciais do administrador
    Then o status HTTP deve ser 200
    And o corpo deve conter um token JWT em string
    And o usuário autenticado deve ter email "admin@escola.com" e role "admin"

  Scenario: deve cadastrar 20 alunos
    Given que o administrador está autenticado
    When envio POST /api/admin/alunos para cada um dos 20 alunos do lote com e-mail e matrícula únicos
    Then cada cadastro deve devolver status HTTP 201
    And cada corpo deve incluir nome, email e matricula enviados
    And cada id deve ser uma string
    And nenhum corpo deve conter o campo senha
    And a lista de alunos criados deve ter comprimento 20

  Scenario: deve realizar login como um dos alunos cadastrados
    Given que o primeiro aluno do lote foi cadastrado
    When envio POST /api/auth/login com o e-mail e a senha "123456" desse aluno
    Then o status HTTP deve ser 200
    And o corpo deve conter um token JWT em string
    And o usuário autenticado deve incluir id, nome, email e role "aluno"

  Scenario: deve cadastrar a disciplina Matemática
    Given que o administrador está autenticado
    When envio POST /api/admin/disciplinas com nome "Matemática", código único a partir de "MATLOT" e cargaHoraria 60
    Then o status HTTP deve ser 201
    And o corpo deve incluir nome "Matemática" e cargaHoraria 60
    And codigo e id devem ser strings

  Scenario: deve matricular os 20 alunos na disciplina Matemática
    Given que o administrador está autenticado
    And que a disciplina "Matemática" foi criada
    And que os 20 alunos do lote foram cadastrados
    When envio POST /api/admin/disciplinas/{disciplinaId}/matriculas para cada aluno do lote
    Then cada matrícula deve devolver status HTTP 201 com alunoId e disciplinaId
    When envio GET /api/admin/disciplinas/{disciplinaId}/alunos
    Then o status HTTP deve ser 200
    And o corpo deve ser um array com comprimento 20
    And todos os ids do lote devem estar matriculados na disciplina

  Scenario: deve lançar a lista de notas dos alunos matriculados
    Given que o administrador está autenticado
    And que os 20 alunos estão matriculados na disciplina
    When envio POST /api/admin/notas para cada aluno com valor 7, tipo "prova" e descricao "Prova 1 - Álgebra"
    Then cada lançamento deve devolver status HTTP 201
    And cada corpo deve incluir alunoId, disciplinaId, valor 7, tipo e descricao
    And id, createdAt e updatedAt devem ser strings
    And a lista de notas lançadas deve ter comprimento 20

  Scenario: deve listar as notas lançadas da disciplina
    Given que o administrador está autenticado
    And que as 20 notas do lote foram lançadas
    When envio GET /api/admin/notas com query disciplinaId da disciplina do lote
    Then o status HTTP deve ser 200
    And o corpo deve ser um array com comprimento 20
    And cada nota lançada deve aparecer com alunoId, disciplinaId, valor 7, tipo e descricao

  Scenario: deve buscar a nota seed de um aluno específico pelo ID e validar a nota e o nome
    Given que o administrador está autenticado
    And que existe a nota seed "nota-ana-matematica-prova1"
    When envio GET /api/admin/notas/nota-ana-matematica-prova1
    Then o status HTTP deve ser 200
    And o corpo deve incluir id, alunoId "aluno-ana-souza", disciplinaId "disciplina-matematica", valor 8.5, tipo "prova" e descricao "Prova 1 - Álgebra"
    And createdAt e updatedAt devem ser strings
    When envio GET /api/admin/alunos/aluno-ana-souza
    Then o status HTTP deve ser 200
    And o corpo deve incluir id "aluno-ana-souza" e nome "Ana Souza"
    And o alunoId da nota deve coincidir com o id do aluno

  Scenario: deve buscar a nota de um aluno do lote pelo ID e validar a nota e o nome
    Given que o administrador está autenticado
    And que a primeira nota do lote foi lançada
    When envio GET /api/admin/notas/{notaId}
    Then o status HTTP deve ser 200
    And o corpo deve incluir id, alunoId, disciplinaId, valor 7, tipo e descricao
    When envio GET /api/admin/alunos/{alunoId}
    Then o status HTTP deve ser 200
    And o corpo deve incluir id e nome do aluno do lote
    And o alunoId da nota deve coincidir com o id do aluno

  Scenario: deve atualizar a nota para 8.5
    Given que o administrador está autenticado
    And que a primeira nota do lote foi lançada
    When envio PUT /api/admin/notas/{notaId} com valor 8.5
    Then o status HTTP deve ser 200
    And o corpo deve incluir id, alunoId, disciplinaId, valor 8.5, tipo e descricao
    When envio GET /api/admin/notas/{notaId}
    Then o status HTTP deve ser 200
    And o valor deve ser 8.5

  Scenario: deve listar os trabalhos entregues pelos alunos com filtro opcional
    Given que o administrador está autenticado
    And que o primeiro aluno do lote está matriculado na disciplina
    When envio POST /api/alunos/{alunoId}/trabalhos com disciplinaId, titulo "Lista de Exercícios 1" e descricao "Resolução dos exercícios de álgebra."
    Then o status HTTP deve ser 201
    And o corpo deve incluir alunoId, disciplinaId, titulo, descricao e status "entregue"
    And o id da entrega deve ser uma string
    When envio GET /api/admin/trabalhos
    Then o status HTTP deve ser 200
    And o corpo deve ser um array com pelo menos 1 elemento
    And o array deve conter a entrega com alunoId, disciplinaId e status "entregue"
    When envio GET /api/admin/trabalhos com query status "entregue"
    Then o status HTTP deve ser 200
    And todos os itens do array devem ter status "entregue"
    When envio GET /api/admin/trabalhos com query alunoId do aluno do lote
    Then o status HTTP deve ser 200
    And o array deve ter comprimento 1 com o id da entrega
    When envio GET /api/admin/trabalhos com query disciplinaId da disciplina do lote
    Then o status HTTP deve ser 200
    And o array deve ter comprimento 1 com o id da entrega

  Scenario: deve retornar 401 ao consultar notas sem token
    When envio GET /api/admin/notas sem o header Authorization
    Then o status HTTP deve ser 401
    And o error deve ser "Token de autenticação não informado."

  Scenario: deve retornar 401 ao lançar nota sem token
    When envio POST /api/admin/notas sem o header Authorization
    Then o status HTTP deve ser 401
    And o error deve ser "Token de autenticação não informado."

  Scenario: deve retornar 401 ao atualizar nota sem token
    When envio PUT /api/admin/notas/{notaId} sem o header Authorization
    Then o status HTTP deve ser 401
    And o error deve ser "Token de autenticação não informado."

  Scenario: deve retornar 403 quando o aluno consulta notas de administrador
    Given que um aluno do lote está autenticado
    When envio GET /api/admin/notas com o token desse aluno
    Then o status HTTP deve ser 403
    And o error deve ser "Você não tem permissão para acessar este recurso."

  Scenario: deve retornar 403 quando o aluno lança uma nota
    Given que um aluno do lote está autenticado
    When envio POST /api/admin/notas com o token desse aluno
    Then o status HTTP deve ser 403
    And o error deve ser "Você não tem permissão para acessar este recurso."

  Scenario: deve retornar 403 quando o aluno atualiza uma nota
    Given que um aluno do lote está autenticado
    When envio PUT /api/admin/notas/{notaId} com o token desse aluno
    Then o status HTTP deve ser 403
    And o error deve ser "Você não tem permissão para acessar este recurso."

  Scenario: deve retornar 401 ao listar trabalhos sem token
    When envio GET /api/admin/trabalhos sem o header Authorization
    Then o status HTTP deve ser 401
    And o error deve ser "Token de autenticação não informado."

  Scenario: deve retornar 401 ao corrigir trabalho sem token
    When envio PUT /api/admin/trabalhos/{trabalhoId} sem o header Authorization
    Then o status HTTP deve ser 401
    And o error deve ser "Token de autenticação não informado."

  Scenario: deve retornar 403 quando o aluno lista trabalhos de administrador
    Given que um aluno do lote está autenticado
    When envio GET /api/admin/trabalhos com o token desse aluno
    Then o status HTTP deve ser 403
    And o error deve ser "Você não tem permissão para acessar este recurso."

  Scenario: deve retornar 403 quando o aluno corrige um trabalho
    Given que um aluno do lote está autenticado
    When envio PUT /api/admin/trabalhos/{trabalhoId} com o token desse aluno e status "corrigido"
    Then o status HTTP deve ser 403
    And o error deve ser "Você não tem permissão para acessar este recurso."
```

