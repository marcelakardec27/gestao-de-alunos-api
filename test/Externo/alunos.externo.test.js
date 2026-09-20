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
        let alunoId;
        let tokenAluno;
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
                email: aluno.email,
                role: 'aluno'
            });
            expect(loginAlunoResposta.body.token).to.be.a('string');
            tokenAluno = loginAlunoResposta.body.token;
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
            entrega = resposta.body;
        });

        it('deve validar status, usuário, papel e dados da entrega', async () => {
            expect(entrega).to.include({
                alunoId,
                disciplinaId: cenario.disciplinaId,
                ...cenario.trabalho,
                status: 'entregue'
            });

            expect(tokenAdmin).to.be.a('string');
            expect(tokenAluno).to.be.a('string');
            expect(entrega.id).to.be.a('string');
        });
    });
}