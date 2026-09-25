import 'dotenv/config';
import request from 'supertest';
import { credenciaisAdminSeed, credenciaisAlunoSeed } from '../../src/config/credenciaisPadrao.js';

export function credenciaisAdmin() {
    return credenciaisAdminSeed();
}

export function credenciaisAluno() {
    return credenciaisAlunoSeed();
}

export async function loginAdmin(urlBase, credenciais = credenciaisAdmin()) {
    const resposta = await request(urlBase)
        .post('/api/auth/login')
        .send(credenciais);

    return resposta;
}

export async function loginAluno(urlBase, credenciais) {
    const resposta = await request(urlBase)
        .post('/api/auth/login')
        .send(credenciais);

    return resposta;
}
