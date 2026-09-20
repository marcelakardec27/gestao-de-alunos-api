import request from 'supertest';

export async function loginAdmin(urlBase, credenciais) {
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
