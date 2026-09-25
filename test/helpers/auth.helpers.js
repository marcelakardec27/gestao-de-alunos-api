import 'dotenv/config';
import request from 'supertest';

export function credenciaisAdmin() {
    const email = process.env.ADMIN_EMAIL;
    const senha = process.env.ADMIN_SENHA;

    if (!email || !senha) {
        throw new Error(
            'Oculte as informações sensíveis no .env: defina ADMIN_EMAIL e ADMIN_SENHA. Consulte .env.example.'
        );
    }

    return { email, senha };
}

export function credenciaisAluno() {
    const email = process.env.ALUNO_EMAIL;
    const senha = process.env.ALUNO_SENHA;

    if (!email || !senha) {
        throw new Error(
            'Oculte as informações sensíveis no .env: defina ALUNO_EMAIL e ALUNO_SENHA. Consulte .env.example.'
        );
    }

    return { email, senha };
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
