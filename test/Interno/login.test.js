import request from 'supertest';
import { expect } from 'chai';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import * as sinon from 'sinon';
import app from '../../src/app.js';
import authService from '../../src/services/auth.service.js';

const dadosLogin = JSON.parse(
    readFileSync(new URL('../data/login.json', import.meta.url), 'utf8')
);

describe('Login', () => {
    afterEach(() => {
        sinon.restore();
    });

    for (const caso of dadosLogin.casos) {
        it(`deve retornar ${caso.statusEsperado} ${caso.nome}`, async () => {
            const loginResposta = await request(app)
                .post('/api/auth/login')
                .set('Content-Type', 'application/json')
                .send(caso.payload);

            expect(loginResposta.status).to.equal(caso.statusEsperado);

            if (caso.esperaError) {
                expect(loginResposta.body).to.have.property('error');
                expect(loginResposta.body.error).to.be.a('string');
            }
        });
    }

    it('deve retornar 500 Mock', async () => {
        const authServiceMock = sinon.stub(authService, 'login');
        authServiceMock.throws(new Error('ERRO CASTRATROFICO'));

        const loginResposta = await request(app)
            .post('/api/auth/login')
            .set('Content-Type', 'application/json')
            .send(dadosLogin.mock500.payload);

        expect(loginResposta.status).to.equal(dadosLogin.mock500.statusEsperado);
        expect(loginResposta.body).to.have.property('error');
        expect(loginResposta.body.error).to.be.a('string');
        expect(loginResposta.body.error).to.equal(dadosLogin.mock500.error);
    });
});
