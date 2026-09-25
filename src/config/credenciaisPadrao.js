const PADRAO = {
  admin: { email: 'admin@escola.com', senha: 'admin123' },
  aluno: { email: 'ana.souza@example.com', senha: '123456' },
};

function valor(nome, padrao) {
  const definido = process.env[nome];
  return definido ? definido : padrao;
}

export function credenciaisAdminSeed() {
  return {
    email: valor('ADMIN_EMAIL', PADRAO.admin.email),
    senha: valor('ADMIN_SENHA', PADRAO.admin.senha),
  };
}

export function credenciaisAlunoSeed() {
  return {
    email: valor('ALUNO_EMAIL', PADRAO.aluno.email),
    senha: valor('ALUNO_SENHA', PADRAO.aluno.senha),
  };
}
