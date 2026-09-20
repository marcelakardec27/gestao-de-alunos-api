import request from 'supertest';
import app from '../../src/app.js';
import { expect } from 'chai';
import * as sinon from "sinon";
import authService from '../../src/services/auth.service.js';

describe('Login', () => {
    it('deve retornar 200 quando o usuário e senha forem corretos', async () => {
        const loginResposta = await request(app)
            .post('/api/auth/login')
            .set('Content-Type', 'application/json')
            .send({ 'email': 'admin@escola.com', 'senha': 'admin123' });
        
        expect(loginResposta.status).to.equal(200);
    });

    it('deve retornar 400 quando a requisição for inválida (dados ausentes)', async () => {
        const loginResposta = await request(app)
            .post('/api/auth/login')
            .set('Content-Type', 'application/json')
            .send({ 'email': 'admin@escola.com',
                    'senha': ''

             }); // 👈 Faltando preencher o campo 'senha'

        // Valida se o status HTTP é 400
        expect(loginResposta.status).to.equal(400);

        // Valida a presença da propriedade "error" no objeto JSON retornado
        expect(loginResposta.body).to.have.property('error');
        expect(loginResposta.body.error).to.be.a('string');
             
        //console.log(loginResposta.body.error);
        //expect(loginResposta.status.body.error).to.equal('Os campos "email" e "senha" são obrigatórios.');

        });


     it('deve retornar 401 quando o senha estiver inválida', async () => {
        const loginResposta = await request(app)
            .post('/api/auth/login')
            .set('Content-Type', 'application/json')
            .send({ 'email': 'admin@escola.com',
                    'senha': '8454'

             }); // 👈 Faltando preencher o campo 'senha' inválida

        // Valida se o status HTTP é 401
        expect(loginResposta.status).to.equal(401);

        // Valida se a mensagem de erro esperada foi retornada
        expect(loginResposta.body).to.have.property('error');
        expect(loginResposta.body.error).to.be.a('string');
    });

    it('deve retornar 500 Mock', async () => {
        const authServiceMock = sinon.stub(authService, 'login');
        authServiceMock.throws(new Error('ERRO CASTRATROFICO'));

        const loginResposta = await request(app)
            .post('/api/auth/login')
            .set('Content-Type', 'application/json')
            .send({ 'email': 'admin@escola.com',
                    'senha': '8454'

             }); // 👈 Faltando preencher o campo 'senha' inválida

        //console.log(loginResposta.body.error);
        // Valida se o status HTTP é 500
        expect(loginResposta.status).to.equal(500);
        expect(loginResposta.body.error).to.equal('Erro interno do servidor.');

        // Valida se a mensagem de erro esperada foi retornada
        expect(loginResposta.body).to.have.property('error');
        expect(loginResposta.body.error).to.be.a('string');

        sinon.restore();
        
    });
});