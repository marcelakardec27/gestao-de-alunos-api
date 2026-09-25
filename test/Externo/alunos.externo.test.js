import 'dotenv/config';
import request from 'supertest';
import { expect } from 'chai';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { loginAdmin, loginAluno, credenciaisAdmin, credenciaisAluno } from '../helpers/auth.helpers.js';

const dadosTeste = JSON.parse(
    readFileSync(new URL('../data/alunos-fluxo.json', import.meta.url), 'utf8')
);
const URL_BASE = process.env.API_BASE_URL || 'http://localhost:3000';
const admin = credenciaisAdmin();

for (const cenario of dadosTeste.cenarios) {
    describe(`Fluxo de aluno: ${cenario.nomeCenario}`, () => {
        const aluno = {
            nome: cenario.aluno.nome,
            email: `${cenario.aluno.emailPrefix}.${Date.now()}@example.com`,
            matricula: `${cenario.aluno.matriculaPrefix}_${Date.now()}`,
            senha: cenario.aluno.senha
        };
        let tokenAdmin;
        let usuarioAdmin;
        let alunoId;
        let tokenAluno;
        let usuarioAluno;
        let entrega;

        it('deve realizar login como administrador', async () => {
            const loginResposta = await loginAdmin(URL_BASE, admin);

            expect(loginResposta.status).to.equal(200);
            expect(loginResposta.body.token).to.be.a('string');
            expect(loginResposta.body.usuario).to.include({
                email: admin.email,
                role: 'admin'
            });

            tokenAdmin = loginResposta.body.token;
            usuarioAdmin = loginResposta.body.usuario;
        });

        it('deve cadastrar um aluno com dados únicos', async () => {
            const cadastroAlunoResposta = await request(URL_BASE)
                .post('/api/admin/alunos')
                .set('Authorization', `Bearer ${tokenAdmin}`)
                .send(aluno);

            expect(cadastroAlunoResposta.status).to.equal(201);
            expect(cadastroAlunoResposta.body).to.include({
                nome: aluno.nome,
                email: aluno.email,
                matricula: aluno.matricula
            });
            expect(cadastroAlunoResposta.body).to.not.have.property('senha');

            alunoId = cadastroAlunoResposta.body.id;
            expect(alunoId).to.be.a('string');
        });

        it('deve matricular o aluno em uma disciplina', async () => {
            const matriculaResposta = await request(URL_BASE)
                .post(`/api/admin/disciplinas/${cenario.disciplinaId}/matriculas`)
                .set('Authorization', `Bearer ${tokenAdmin}`)
                .send({ alunoId });

            expect(matriculaResposta.status).to.equal(201);
            expect(matriculaResposta.body).to.include({
                alunoId,
                disciplinaId: cenario.disciplinaId
            });
        });

        it('deve realizar login como o aluno cadastrado', async () => {
            const loginAlunoResposta = await loginAluno(URL_BASE, {
                email: aluno.email,
                senha: aluno.senha
            });

            expect(loginAlunoResposta.status).to.equal(200);
            expect(loginAlunoResposta.body.usuario).to.include({
                id: alunoId,
                nome: aluno.nome,
                email: aluno.email,
                role: 'aluno'
            });
            expect(loginAlunoResposta.body.token).to.be.a('string');
            tokenAluno = loginAlunoResposta.body.token;
            usuarioAluno = loginAlunoResposta.body.usuario;
        });

        it('deve registrar a entrega do trabalho como aluno', async () => {
            const resposta = await request(URL_BASE)
                .post(`/api/alunos/${alunoId}/trabalhos`)
                .set('Authorization', `Bearer ${tokenAluno}`)
                .send({
                    disciplinaId: cenario.disciplinaId,
                    ...cenario.trabalho
                });

            expect(resposta.status).to.equal(201);
            expect(resposta.body).to.include({
                alunoId,
                disciplinaId: cenario.disciplinaId,
                ...cenario.trabalho,
                status: 'entregue'
            });
            expect(resposta.body.id).to.be.a('string');
            expect(resposta.body.nota).to.equal(null);
            expect(resposta.body.feedback).to.equal(null);
            expect(resposta.body.dataEntrega).to.be.a('string');

            entrega = resposta.body;
        });

        it('deve validar status, usuário, papel e dados da entrega', async () => {
            expect(usuarioAdmin).to.include({
                email: admin.email,
                role: 'admin'
            });
            expect(usuarioAluno).to.include({
                id: alunoId,
                nome: aluno.nome,
                email: aluno.email,
                role: 'aluno'
            });

            expect(entrega).to.include({
                alunoId,
                disciplinaId: cenario.disciplinaId,
                ...cenario.trabalho,
                status: 'entregue'
            });
            expect(entrega.id).to.be.a('string');
            expect(entrega.nota).to.equal(null);
            expect(entrega.feedback).to.equal(null);
            expect(entrega.dataEntrega).to.be.a('string');

            const listaTrabalhosResposta = await request(URL_BASE)
                .get(`/api/alunos/${alunoId}/trabalhos`)
                .set('Authorization', `Bearer ${tokenAluno}`);

            expect(listaTrabalhosResposta.status).to.equal(200);
            expect(listaTrabalhosResposta.body).to.be.an('array');

            const trabalhoNaLista = listaTrabalhosResposta.body.find((item) => item.id === entrega.id);
            expect(trabalhoNaLista).to.include({
                alunoId,
                disciplinaId: cenario.disciplinaId,
                ...cenario.trabalho,
                status: 'entregue'
            });
        });
    });
}

describe(`Fluxo: aluno, lista e disciplina ${dadosTeste.metricas.disciplina.nome}`, () => {
    const metricas = dadosTeste.metricas;
    const aluno = {
        nome: metricas.aluno.nome,
        email: `${metricas.aluno.emailPrefix}.${Date.now()}@example.com`,
        matricula: `${metricas.aluno.matriculaPrefix}_${Date.now()}`,
        senha: metricas.aluno.senha
    };
    let tokenAdmin;
    let alunoCriado;
    let alunosCadastrados;
    let disciplina;

    it('deve realizar login como administrador', async () => {
        const loginResposta = await loginAdmin(URL_BASE, admin);

        expect(loginResposta.status).to.equal(200);
        expect(loginResposta.body.token).to.be.a('string');
        expect(loginResposta.body.usuario).to.include({
            email: admin.email,
            role: 'admin'
        });

        tokenAdmin = loginResposta.body.token;
    });

    it('deve criar um aluno e validar 201', async () => {
        const cadastroAlunoResposta = await request(URL_BASE)
            .post('/api/admin/alunos')
            .set('Authorization', `Bearer ${tokenAdmin}`)
            .send(aluno);

        expect(cadastroAlunoResposta.status).to.equal(201);
        expect(cadastroAlunoResposta.body).to.include({
            nome: aluno.nome,
            email: aluno.email,
            matricula: aluno.matricula
        });
        expect(cadastroAlunoResposta.body.id).to.be.a('string');
        expect(cadastroAlunoResposta.body).to.not.have.property('senha');

        alunoCriado = cadastroAlunoResposta.body;
    });

    it('deve listar os alunos cadastrados com 200', async () => {
        const listaAlunosResposta = await request(URL_BASE)
            .get('/api/admin/alunos')
            .set('Authorization', `Bearer ${tokenAdmin}`);

        expect(listaAlunosResposta.status).to.equal(200);
        expect(listaAlunosResposta.body).to.be.an('array');
        expect(listaAlunosResposta.body.length).to.be.at.least(1);

        const alunoNaLista = listaAlunosResposta.body.find((item) => item.id === alunoCriado.id);
        expect(alunoNaLista).to.include({
            nome: aluno.nome,
            email: aluno.email,
            matricula: aluno.matricula
        });

        alunosCadastrados = listaAlunosResposta.body;
    });

    it('deve cadastrar a disciplina Métricas da IA', async () => {
        const cadastroDisciplinaResposta = await request(URL_BASE)
            .post('/api/admin/disciplinas')
            .set('Authorization', `Bearer ${tokenAdmin}`)
            .send({
                nome: metricas.disciplina.nome,
                codigo: `${metricas.disciplina.codigoPrefix}_${Date.now()}`,
                cargaHoraria: metricas.disciplina.cargaHoraria
            });

        expect(cadastroDisciplinaResposta.status).to.equal(201);
        expect(cadastroDisciplinaResposta.body).to.include({ nome: metricas.disciplina.nome });
        expect(cadastroDisciplinaResposta.body.codigo).to.be.a('string');
        expect(cadastroDisciplinaResposta.body.id).to.be.a('string');

        disciplina = cadastroDisciplinaResposta.body;
    });

    it('deve matricular a lista de alunos na disciplina e validar o cadastro', async () => {
        for (const alunoLista of alunosCadastrados) {
            const matriculaResposta = await request(URL_BASE)
                .post(`/api/admin/disciplinas/${disciplina.id}/matriculas`)
                .set('Authorization', `Bearer ${tokenAdmin}`)
                .send({ alunoId: alunoLista.id });

            expect(matriculaResposta.status).to.equal(201);
            expect(matriculaResposta.body).to.include({
                alunoId: alunoLista.id,
                disciplinaId: disciplina.id
            });
        }

        const alunosDaDisciplinaResposta = await request(URL_BASE)
            .get(`/api/admin/disciplinas/${disciplina.id}/alunos`)
            .set('Authorization', `Bearer ${tokenAdmin}`);

        expect(alunosDaDisciplinaResposta.status).to.equal(200);
        expect(alunosDaDisciplinaResposta.body).to.be.an('array');
        expect(alunosDaDisciplinaResposta.body).to.have.lengthOf(alunosCadastrados.length);

        const idsMatriculados = alunosDaDisciplinaResposta.body.map((item) => item.id);
        for (const alunoLista of alunosCadastrados) {
            expect(idsMatriculados).to.include(alunoLista.id);
        }
    });
});

describe('Casos negativos: cadastro, autenticação e entrega', () => {
    const negativos = dadosTeste.negativos;
    const aluno = {
        nome: negativos.aluno.nome,
        email: `${negativos.aluno.emailPrefix}.${Date.now()}@example.com`,
        matricula: `${negativos.aluno.matriculaPrefix}_${Date.now()}`,
        senha: negativos.aluno.senha
    };
    let tokenAdmin;
    let alunoId;
    let tokenAluno;

    it('deve realizar login como administrador', async () => {
        const loginResposta = await loginAdmin(URL_BASE, admin);

        expect(loginResposta.status).to.equal(200);
        expect(loginResposta.body.token).to.be.a('string');

        tokenAdmin = loginResposta.body.token;
    });

    it('deve cadastrar um aluno para os casos negativos', async () => {
        const cadastroAlunoResposta = await request(URL_BASE)
            .post('/api/admin/alunos')
            .set('Authorization', `Bearer ${tokenAdmin}`)
            .send(aluno);

        expect(cadastroAlunoResposta.status).to.equal(201);
        alunoId = cadastroAlunoResposta.body.id;
        expect(alunoId).to.be.a('string');
    });

    it('deve realizar login como o aluno cadastrado', async () => {
        const loginAlunoResposta = await loginAluno(URL_BASE, {
            email: aluno.email,
            senha: aluno.senha
        });

        expect(loginAlunoResposta.status).to.equal(200);
        tokenAluno = loginAlunoResposta.body.token;
        expect(tokenAluno).to.be.a('string');
    });

    it('deve retornar 400 ao cadastrar aluno sem campos obrigatórios', async () => {
        const resposta = await request(URL_BASE)
            .post('/api/admin/alunos')
            .set('Authorization', `Bearer ${tokenAdmin}`)
            .send({ nome: aluno.nome });

        expect(resposta.status).to.equal(400);
        expect(resposta.body).to.have.property('error');
        expect(resposta.body.error).to.equal(
            'Os campos "nome", "email", "matricula" e "senha" são obrigatórios.'
        );
    });

    it('deve retornar 400 ao matricular sem alunoId', async () => {
        const resposta = await request(URL_BASE)
            .post(`/api/admin/disciplinas/${negativos.disciplinaId}/matriculas`)
            .set('Authorization', `Bearer ${tokenAdmin}`)
            .send({});

        expect(resposta.status).to.equal(400);
        expect(resposta.body).to.have.property('error');
        expect(resposta.body.error).to.equal('O campo "alunoId" é obrigatório.');
    });

    it('deve retornar 400 ao registrar trabalho sem disciplinaId e titulo', async () => {
        const resposta = await request(URL_BASE)
            .post(`/api/alunos/${alunoId}/trabalhos`)
            .set('Authorization', `Bearer ${tokenAluno}`)
            .send({});

        expect(resposta.status).to.equal(400);
        expect(resposta.body).to.have.property('error');
        expect(resposta.body.error).to.equal(
            'Os campos "disciplinaId" e "titulo" são obrigatórios.'
        );
    });

    it('deve retornar 400 ao autenticar sem senha', async () => {
        const loginResposta = await loginAdmin(URL_BASE, { email: admin.email });

        expect(loginResposta.status).to.equal(400);
        expect(loginResposta.body).to.have.property('error');
        expect(loginResposta.body.error).to.equal(
            'Os campos "email" e "senha" são obrigatórios.'
        );
    });

    it('deve retornar 401 ao cadastrar aluno sem token', async () => {
        const resposta = await request(URL_BASE)
            .post('/api/admin/alunos')
            .send(aluno);

        expect(resposta.status).to.equal(401);
        expect(resposta.body).to.have.property('error');
        expect(resposta.body.error).to.equal('Token de autenticação não informado.');
    });

    it('deve retornar 401 ao registrar trabalho com token inválido', async () => {
        const resposta = await request(URL_BASE)
            .post(`/api/alunos/${alunoId}/trabalhos`)
            .set('Authorization', `Bearer ${negativos.tokenInvalido}`)
            .send({
                disciplinaId: negativos.disciplinaId,
                ...negativos.trabalho
            });

        expect(resposta.status).to.equal(401);
        expect(resposta.body).to.have.property('error');
        expect(resposta.body.error).to.equal('Token de autenticação inválido ou expirado.');
    });

    it('deve retornar 401 ao autenticar com senha inválida', async () => {
        const loginResposta = await loginAluno(URL_BASE, {
            email: aluno.email,
            senha: negativos.senhaInvalida
        });

        expect(loginResposta.status).to.equal(401);
        expect(loginResposta.body).to.have.property('error');
        expect(loginResposta.body.error).to.equal('E-mail ou senha inválidos.');
    });

    it('deve retornar 403 quando o aluno tenta cadastrar outro aluno', async () => {
        const resposta = await request(URL_BASE)
            .post('/api/admin/alunos')
            .set('Authorization', `Bearer ${tokenAluno}`)
            .send({
                nome: negativos.alunoSemPermissao.nome,
                email: `${negativos.alunoSemPermissao.emailPrefix}.${Date.now()}@example.com`,
                matricula: `${negativos.alunoSemPermissao.matriculaPrefix}_${Date.now()}`,
                senha: aluno.senha
            });

        expect(resposta.status).to.equal(403);
        expect(resposta.body).to.have.property('error');
        expect(resposta.body.error).to.equal(
            'Você não tem permissão para acessar este recurso.'
        );
    });

    it('deve retornar 403 quando o aluno registra entrega de outro aluno', async () => {
        const resposta = await request(URL_BASE)
            .post(`/api/alunos/${negativos.alunoAlheioId}/trabalhos`)
            .set('Authorization', `Bearer ${tokenAluno}`)
            .send({
                disciplinaId: negativos.disciplinaId,
                ...negativos.trabalho
            });

        expect(resposta.status).to.equal(403);
        expect(resposta.body).to.have.property('error');
        expect(resposta.body.error).to.equal('Você só pode acessar os seus próprios dados.');
    });

    it('deve retornar 409 ao cadastrar aluno com e-mail duplicado', async () => {
        const resposta = await request(URL_BASE)
            .post('/api/admin/alunos')
            .set('Authorization', `Bearer ${tokenAdmin}`)
            .send({
                nome: negativos.alunoDuplicado.nome,
                matricula: negativos.alunoDuplicado.matricula,
                ...credenciaisAluno()
            });

        expect(resposta.status).to.equal(409);
        expect(resposta.body).to.have.property('error');
        expect(resposta.body.error).to.equal(
            'Já existe um aluno cadastrado com essa matrícula ou e-mail.'
        );
    });

    it('deve retornar 409 ao matricular aluno já matriculado', async () => {
        const primeiraMatricula = await request(URL_BASE)
            .post(`/api/admin/disciplinas/${negativos.disciplinaId}/matriculas`)
            .set('Authorization', `Bearer ${tokenAdmin}`)
            .send({ alunoId });

        expect(primeiraMatricula.status).to.equal(201);

        const resposta = await request(URL_BASE)
            .post(`/api/admin/disciplinas/${negativos.disciplinaId}/matriculas`)
            .set('Authorization', `Bearer ${tokenAdmin}`)
            .send({ alunoId });

        expect(resposta.status).to.equal(409);
        expect(resposta.body).to.have.property('error');
        expect(resposta.body.error).to.equal('Aluno já está matriculado nesta disciplina.');
    });

    it('deve retornar 409 ao registrar trabalho sem matrícula na disciplina', async () => {
        const resposta = await request(URL_BASE)
            .post(`/api/alunos/${alunoId}/trabalhos`)
            .set('Authorization', `Bearer ${tokenAluno}`)
            .send({
                disciplinaId: negativos.disciplinaSemMatricula,
                ...negativos.trabalho
            });

        expect(resposta.status).to.equal(409);
        expect(resposta.body).to.have.property('error');
        expect(resposta.body.error).to.equal('O aluno não está matriculado nesta disciplina.');
    });
});

describe('Fluxo: 20 alunos, Matemática, notas e trabalhos', () => {
    const lote = dadosTeste.loteMatematica;
    const marcaUnica = Date.now();
    const alunosLote = lote.nomes.map((nome, indice) => ({
        nome,
        email: `${lote.aluno.emailPrefix}.${indice + 1}.${marcaUnica}@example.com`,
        matricula: `${lote.aluno.matriculaPrefix}_${indice + 1}_${marcaUnica}`,
        senha: lote.aluno.senha
    }));
    let tokenAdmin;
    let tokenAluno;
    let alunosCriados = [];
    let disciplina;
    let notasLancadas = [];
    let notaAlvo;
    let alunoAlvo;
    let trabalhoEntregue;

    it('deve realizar login como administrador', async () => {
        const loginResposta = await loginAdmin(URL_BASE, admin);

        expect(loginResposta.status).to.equal(200);
        expect(loginResposta.body.token).to.be.a('string');
        expect(loginResposta.body.usuario).to.include({
            email: admin.email,
            role: 'admin'
        });

        tokenAdmin = loginResposta.body.token;
    });

    it('deve cadastrar 20 alunos', async () => {
        for (const aluno of alunosLote) {
            const cadastroAlunoResposta = await request(URL_BASE)
                .post('/api/admin/alunos')
                .set('Authorization', `Bearer ${tokenAdmin}`)
                .send(aluno);

            expect(cadastroAlunoResposta.status).to.equal(201);
            expect(cadastroAlunoResposta.body).to.include({
                nome: aluno.nome,
                email: aluno.email,
                matricula: aluno.matricula
            });
            expect(cadastroAlunoResposta.body.id).to.be.a('string');
            expect(cadastroAlunoResposta.body).to.not.have.property('senha');

            alunosCriados.push(cadastroAlunoResposta.body);
        }

        expect(alunosCriados).to.have.lengthOf(20);
    }).timeout(30000);

    it('deve realizar login como um dos alunos cadastrados', async () => {
        const alunoLogin = alunosLote[0];
        const loginAlunoResposta = await loginAluno(URL_BASE, {
            email: alunoLogin.email,
            senha: alunoLogin.senha
        });

        expect(loginAlunoResposta.status).to.equal(200);
        expect(loginAlunoResposta.body.token).to.be.a('string');
        expect(loginAlunoResposta.body.usuario).to.include({
            id: alunosCriados[0].id,
            nome: alunoLogin.nome,
            email: alunoLogin.email,
            role: 'aluno'
        });

        tokenAluno = loginAlunoResposta.body.token;
    });

    it('deve cadastrar a disciplina Matemática', async () => {
        const cadastroDisciplinaResposta = await request(URL_BASE)
            .post('/api/admin/disciplinas')
            .set('Authorization', `Bearer ${tokenAdmin}`)
            .send({
                nome: lote.disciplina.nome,
                codigo: `${lote.disciplina.codigoPrefix}_${marcaUnica}`,
                cargaHoraria: lote.disciplina.cargaHoraria
            });

        expect(cadastroDisciplinaResposta.status).to.equal(201);
        expect(cadastroDisciplinaResposta.body).to.include({
            nome: lote.disciplina.nome,
            cargaHoraria: lote.disciplina.cargaHoraria
        });
        expect(cadastroDisciplinaResposta.body.codigo).to.be.a('string');
        expect(cadastroDisciplinaResposta.body.id).to.be.a('string');

        disciplina = cadastroDisciplinaResposta.body;
    });

    it('deve matricular os 20 alunos na disciplina Matemática', async () => {
        for (const alunoCriado of alunosCriados) {
            const matriculaResposta = await request(URL_BASE)
                .post(`/api/admin/disciplinas/${disciplina.id}/matriculas`)
                .set('Authorization', `Bearer ${tokenAdmin}`)
                .send({ alunoId: alunoCriado.id });

            expect(matriculaResposta.status).to.equal(201);
            expect(matriculaResposta.body).to.include({
                alunoId: alunoCriado.id,
                disciplinaId: disciplina.id
            });
        }

        const alunosDaDisciplinaResposta = await request(URL_BASE)
            .get(`/api/admin/disciplinas/${disciplina.id}/alunos`)
            .set('Authorization', `Bearer ${tokenAdmin}`);

        expect(alunosDaDisciplinaResposta.status).to.equal(200);
        expect(alunosDaDisciplinaResposta.body).to.be.an('array');
        expect(alunosDaDisciplinaResposta.body).to.have.lengthOf(20);

        const idsMatriculados = alunosDaDisciplinaResposta.body.map((item) => item.id);
        for (const alunoCriado of alunosCriados) {
            expect(idsMatriculados).to.include(alunoCriado.id);
        }
    }).timeout(30000);

    it('deve lançar a lista de notas dos alunos matriculados', async () => {
        for (const alunoCriado of alunosCriados) {
            const lancamentoResposta = await request(URL_BASE)
                .post('/api/admin/notas')
                .set('Authorization', `Bearer ${tokenAdmin}`)
                .send({
                    alunoId: alunoCriado.id,
                    disciplinaId: disciplina.id,
                    valor: lote.nota.valorInicial,
                    tipo: lote.nota.tipo,
                    descricao: lote.nota.descricao
                });

            expect(lancamentoResposta.status).to.equal(201);
            expect(lancamentoResposta.body).to.include({
                alunoId: alunoCriado.id,
                disciplinaId: disciplina.id,
                valor: lote.nota.valorInicial,
                tipo: lote.nota.tipo,
                descricao: lote.nota.descricao
            });
            expect(lancamentoResposta.body.id).to.be.a('string');
            expect(lancamentoResposta.body.createdAt).to.be.a('string');
            expect(lancamentoResposta.body.updatedAt).to.be.a('string');

            notasLancadas.push(lancamentoResposta.body);
        }

        expect(notasLancadas).to.have.lengthOf(20);
        notaAlvo = notasLancadas[0];
        alunoAlvo = alunosCriados[0];
    }).timeout(30000);

    it('deve listar as notas lançadas da disciplina', async () => {
        const listaNotasResposta = await request(URL_BASE)
            .get('/api/admin/notas')
            .query({ disciplinaId: disciplina.id })
            .set('Authorization', `Bearer ${tokenAdmin}`);

        expect(listaNotasResposta.status).to.equal(200);
        expect(listaNotasResposta.body).to.be.an('array');
        expect(listaNotasResposta.body).to.have.lengthOf(20);

        for (const notaLancada of notasLancadas) {
            const notaNaLista = listaNotasResposta.body.find((item) => item.id === notaLancada.id);
            expect(notaNaLista).to.include({
                alunoId: notaLancada.alunoId,
                disciplinaId: disciplina.id,
                valor: lote.nota.valorInicial,
                tipo: lote.nota.tipo,
                descricao: lote.nota.descricao
            });
        }
    });

    it('deve buscar a nota seed de um aluno específico pelo ID e validar a nota e o nome', async () => {
        const notaSeedResposta = await request(URL_BASE)
            .get(`/api/admin/notas/${lote.notaSeed.id}`)
            .set('Authorization', `Bearer ${tokenAdmin}`);

        expect(notaSeedResposta.status).to.equal(200);
        expect(notaSeedResposta.body).to.include({
            id: lote.notaSeed.id,
            alunoId: lote.notaSeed.alunoId,
            disciplinaId: lote.notaSeed.disciplinaId,
            valor: lote.notaSeed.valor,
            tipo: lote.notaSeed.tipo,
            descricao: lote.notaSeed.descricao
        });
        expect(notaSeedResposta.body.createdAt).to.be.a('string');
        expect(notaSeedResposta.body.updatedAt).to.be.a('string');

        const alunoSeedResposta = await request(URL_BASE)
            .get(`/api/admin/alunos/${lote.notaSeed.alunoId}`)
            .set('Authorization', `Bearer ${tokenAdmin}`);

        expect(alunoSeedResposta.status).to.equal(200);
        expect(alunoSeedResposta.body).to.include({
            id: lote.notaSeed.alunoId,
            nome: lote.notaSeed.nomeAluno
        });
        expect(notaSeedResposta.body.alunoId).to.equal(alunoSeedResposta.body.id);
    });

    it('deve buscar a nota de um aluno do lote pelo ID e validar a nota e o nome', async () => {
        const notaResposta = await request(URL_BASE)
            .get(`/api/admin/notas/${notaAlvo.id}`)
            .set('Authorization', `Bearer ${tokenAdmin}`);

        expect(notaResposta.status).to.equal(200);
        expect(notaResposta.body).to.include({
            id: notaAlvo.id,
            alunoId: alunoAlvo.id,
            disciplinaId: disciplina.id,
            valor: lote.nota.valorInicial,
            tipo: lote.nota.tipo,
            descricao: lote.nota.descricao
        });

        const alunoResposta = await request(URL_BASE)
            .get(`/api/admin/alunos/${alunoAlvo.id}`)
            .set('Authorization', `Bearer ${tokenAdmin}`);

        expect(alunoResposta.status).to.equal(200);
        expect(alunoResposta.body).to.include({
            id: alunoAlvo.id,
            nome: alunoAlvo.nome
        });
        expect(notaResposta.body.alunoId).to.equal(alunoResposta.body.id);
    });

    it('deve atualizar a nota para 8.5', async () => {
        const atualizacaoResposta = await request(URL_BASE)
            .put(`/api/admin/notas/${notaAlvo.id}`)
            .set('Authorization', `Bearer ${tokenAdmin}`)
            .send({ valor: lote.nota.valorAtualizado });

        expect(atualizacaoResposta.status).to.equal(200);
        expect(atualizacaoResposta.body).to.include({
            id: notaAlvo.id,
            alunoId: alunoAlvo.id,
            disciplinaId: disciplina.id,
            valor: lote.nota.valorAtualizado,
            tipo: lote.nota.tipo,
            descricao: lote.nota.descricao
        });

        const notaAtualizadaResposta = await request(URL_BASE)
            .get(`/api/admin/notas/${notaAlvo.id}`)
            .set('Authorization', `Bearer ${tokenAdmin}`);

        expect(notaAtualizadaResposta.status).to.equal(200);
        expect(notaAtualizadaResposta.body.valor).to.equal(lote.nota.valorAtualizado);
    });

    it('deve listar os trabalhos entregues pelos alunos com filtro opcional', async () => {
        const entregaResposta = await request(URL_BASE)
            .post(`/api/alunos/${alunoAlvo.id}/trabalhos`)
            .set('Authorization', `Bearer ${tokenAdmin}`)
            .send({
                disciplinaId: disciplina.id,
                ...lote.trabalho
            });

        expect(entregaResposta.status).to.equal(201);
        expect(entregaResposta.body).to.include({
            alunoId: alunoAlvo.id,
            disciplinaId: disciplina.id,
            ...lote.trabalho,
            status: 'entregue'
        });
        expect(entregaResposta.body.id).to.be.a('string');
        trabalhoEntregue = entregaResposta.body;

        const listaSemFiltroResposta = await request(URL_BASE)
            .get('/api/admin/trabalhos')
            .set('Authorization', `Bearer ${tokenAdmin}`);

        expect(listaSemFiltroResposta.status).to.equal(200);
        expect(listaSemFiltroResposta.body).to.be.an('array');
        expect(listaSemFiltroResposta.body.length).to.be.at.least(1);
        expect(listaSemFiltroResposta.body.find((item) => item.id === trabalhoEntregue.id)).to.include({
            alunoId: alunoAlvo.id,
            disciplinaId: disciplina.id,
            status: 'entregue'
        });

        const listaPorStatusResposta = await request(URL_BASE)
            .get('/api/admin/trabalhos')
            .query({ status: lote.filtroTrabalho.status })
            .set('Authorization', `Bearer ${tokenAdmin}`);

        expect(listaPorStatusResposta.status).to.equal(200);
        expect(listaPorStatusResposta.body).to.be.an('array');
        expect(listaPorStatusResposta.body.length).to.be.at.least(1);
        for (const trabalho of listaPorStatusResposta.body) {
            expect(trabalho.status).to.equal(lote.filtroTrabalho.status);
        }

        const listaPorAlunoResposta = await request(URL_BASE)
            .get('/api/admin/trabalhos')
            .query({ alunoId: alunoAlvo.id })
            .set('Authorization', `Bearer ${tokenAdmin}`);

        expect(listaPorAlunoResposta.status).to.equal(200);
        expect(listaPorAlunoResposta.body).to.be.an('array');
        expect(listaPorAlunoResposta.body).to.have.lengthOf(1);
        expect(listaPorAlunoResposta.body[0]).to.include({
            id: trabalhoEntregue.id,
            alunoId: alunoAlvo.id,
            disciplinaId: disciplina.id
        });

        const listaPorDisciplinaResposta = await request(URL_BASE)
            .get('/api/admin/trabalhos')
            .query({ disciplinaId: disciplina.id })
            .set('Authorization', `Bearer ${tokenAdmin}`);

        expect(listaPorDisciplinaResposta.status).to.equal(200);
        expect(listaPorDisciplinaResposta.body).to.be.an('array');
        expect(listaPorDisciplinaResposta.body).to.have.lengthOf(1);
        expect(listaPorDisciplinaResposta.body[0].id).to.equal(trabalhoEntregue.id);
    });

    it('deve retornar 401 ao consultar notas sem token', async () => {
        const resposta = await request(URL_BASE).get('/api/admin/notas');

        expect(resposta.status).to.equal(401);
        expect(resposta.body).to.have.property('error');
        expect(resposta.body.error).to.equal('Token de autenticação não informado.');
    });

    it('deve retornar 401 ao lançar nota sem token', async () => {
        const resposta = await request(URL_BASE)
            .post('/api/admin/notas')
            .send({
                alunoId: alunoAlvo.id,
                disciplinaId: disciplina.id,
                valor: lote.nota.valorInicial,
                tipo: lote.nota.tipo,
                descricao: lote.nota.descricao
            });

        expect(resposta.status).to.equal(401);
        expect(resposta.body).to.have.property('error');
        expect(resposta.body.error).to.equal('Token de autenticação não informado.');
    });

    it('deve retornar 401 ao atualizar nota sem token', async () => {
        const resposta = await request(URL_BASE)
            .put(`/api/admin/notas/${notaAlvo.id}`)
            .send({ valor: lote.nota.valorAtualizado });

        expect(resposta.status).to.equal(401);
        expect(resposta.body).to.have.property('error');
        expect(resposta.body.error).to.equal('Token de autenticação não informado.');
    });

    it('deve retornar 403 quando o aluno consulta notas de administrador', async () => {
        const resposta = await request(URL_BASE)
            .get('/api/admin/notas')
            .set('Authorization', `Bearer ${tokenAluno}`);

        expect(resposta.status).to.equal(403);
        expect(resposta.body).to.have.property('error');
        expect(resposta.body.error).to.equal(
            'Você não tem permissão para acessar este recurso.'
        );
    });

    it('deve retornar 403 quando o aluno lança uma nota', async () => {
        const resposta = await request(URL_BASE)
            .post('/api/admin/notas')
            .set('Authorization', `Bearer ${tokenAluno}`)
            .send({
                alunoId: alunoAlvo.id,
                disciplinaId: disciplina.id,
                valor: lote.nota.valorInicial,
                tipo: lote.nota.tipo,
                descricao: lote.nota.descricao
            });

        expect(resposta.status).to.equal(403);
        expect(resposta.body).to.have.property('error');
        expect(resposta.body.error).to.equal(
            'Você não tem permissão para acessar este recurso.'
        );
    });

    it('deve retornar 403 quando o aluno atualiza uma nota', async () => {
        const resposta = await request(URL_BASE)
            .put(`/api/admin/notas/${notaAlvo.id}`)
            .set('Authorization', `Bearer ${tokenAluno}`)
            .send({ valor: lote.nota.valorAtualizado });

        expect(resposta.status).to.equal(403);
        expect(resposta.body).to.have.property('error');
        expect(resposta.body.error).to.equal(
            'Você não tem permissão para acessar este recurso.'
        );
    });

    it('deve retornar 401 ao listar trabalhos sem token', async () => {
        const resposta = await request(URL_BASE).get('/api/admin/trabalhos');

        expect(resposta.status).to.equal(401);
        expect(resposta.body).to.have.property('error');
        expect(resposta.body.error).to.equal('Token de autenticação não informado.');
    });

    it('deve retornar 401 ao corrigir trabalho sem token', async () => {
        const resposta = await request(URL_BASE)
            .put(`/api/admin/trabalhos/${trabalhoEntregue.id}`)
            .send({ status: 'corrigido', nota: lote.nota.valorAtualizado });

        expect(resposta.status).to.equal(401);
        expect(resposta.body).to.have.property('error');
        expect(resposta.body.error).to.equal('Token de autenticação não informado.');
    });

    it('deve retornar 403 quando o aluno lista trabalhos de administrador', async () => {
        const resposta = await request(URL_BASE)
            .get('/api/admin/trabalhos')
            .set('Authorization', `Bearer ${tokenAluno}`);

        expect(resposta.status).to.equal(403);
        expect(resposta.body).to.have.property('error');
        expect(resposta.body.error).to.equal(
            'Você não tem permissão para acessar este recurso.'
        );
    });

    it('deve retornar 403 quando o aluno corrige um trabalho', async () => {
        const resposta = await request(URL_BASE)
            .put(`/api/admin/trabalhos/${trabalhoEntregue.id}`)
            .set('Authorization', `Bearer ${tokenAluno}`)
            .send({ status: 'corrigido', nota: lote.nota.valorAtualizado });

        expect(resposta.status).to.equal(403);
        expect(resposta.body).to.have.property('error');
        expect(resposta.body.error).to.equal(
            'Você não tem permissão para acessar este recurso.'
        );
    });
});