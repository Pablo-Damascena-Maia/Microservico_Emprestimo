/**
 * src/config/infisical.js
 *
 * Carrega os secrets do Infisical e injeta no process.env
 * antes do servidor e do Prisma subirem.
 *
 * Variáveis injetadas pelo Jenkins no docker run:
 *   INFISICAL_TOKEN      — Service Token (st.xxx) — cadastrado no Jenkins Credentials
 *   INFISICAL_PROJECT_ID — e2ce3300-d12b-471d-8954-364aa184c184
 *   INFISICAL_ENV        — prod (slug do ambiente Production no Infisical)
 */

const { InfisicalSDK } = require('@infisical/sdk');

async function loadSecrets() {
  const token     = process.env.INFISICAL_TOKEN;
  const projectId = process.env.INFISICAL_PROJECT_ID || 'e2ce3300-d12b-471d-8954-364aa184c184';
  const env       = process.env.INFISICAL_ENV || 'prod';

  // Sem token = desenvolvimento local, usa .env normalmente
  if (!token) {
    console.log('[Infisical] INFISICAL_TOKEN não encontrado — usando variáveis locais (.env)');
    return;
  }

  try {
    console.log(`[Infisical] Carregando secrets do projeto ${projectId}, ambiente: ${env}`);

    const client = new InfisicalSDK();

    await client.auth().universalAuth.login({
      clientId:     token,
      clientSecret: token,
    });

    const { secrets } = await client.secrets().listSecrets({
      projectId,
      environment: env,
      secretPath:  '/',
    });

    let count = 0;
    for (const secret of secrets) {
      if (!process.env[secret.secretKey]) {
        process.env[secret.secretKey] = secret.secretValue;
        count++;
      }
    }

    console.log(`[Infisical] ${count} secret(s) carregado(s) com sucesso.`);
  } catch (err) {
    console.error('[Infisical] Erro ao carregar secrets:', err.message);
    console.error('[Infisical] Verifique INFISICAL_TOKEN e INFISICAL_PROJECT_ID no Jenkins.');
    process.exit(1);
  }
}

module.exports = { loadSecrets };
