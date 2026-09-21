import 'dotenv/config';
import request from 'supertest';
import { expect } from 'chai';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { loginAdmin, loginAluno } from '../helpers/auth.helpers.js';

const dadosTeste = JSON.parse(
    readFileSync(new URL('../data/alunos-fluxo.json', import.meta.url), 'utf8')
);
const URL_BASE = process.env.API_BASE_URL || 'http://localhost:3000';

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
            const loginResposta = await loginAdmin(URL_BASE, dadosTeste.admin);

            expect(loginResposta.status).to.equal(200);
            expect(loginResposta.body.token).to.be.a('string');
            expect(loginResposta.body.usuario).to.include({
                email: dadosTeste.admin.email,
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
                email: dadosTeste.admin.email,
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
        const loginResposta = await loginAdmin(URL_BASE, dadosTeste.admin);

        expect(loginResposta.status).to.equal(200);
        expect(loginResposta.body.token).to.be.a('string');
        expect(loginResposta.body.usuario).to.include({
            email: dadosTeste.admin.email,
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
        const loginResposta = await loginAdmin(URL_BASE, dadosTeste.admin);

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
        const loginResposta = await loginAdmin(URL_BASE, { email: dadosTeste.admin.email });

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
            .send(negativos.alunoDuplicado);

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