/**
 * src/config/infisical.js
 *
 * Carrega os secrets do Infisical usando Service Token (st.xxx)
 * e injeta no process.env antes do servidor e do Prisma subirem.
 */

const { InfisicalSDK } = require('@infisical/sdk');

const INFISICAL_TOKEN      = process.env.INFISICAL_TOKEN      || 'st.78331314-da2c-40d7-829c-64e1baa1a4a8.ce97554862d25689b83e5730d93756e7.5a84652d45eb8c9411c301ab944e9012';
const INFISICAL_PROJECT_ID = process.env.INFISICAL_PROJECT_ID || 'e2ce3300-d12b-471d-8954-364aa184c184';
const INFISICAL_ENV        = process.env.INFISICAL_ENV        || 'prod';

async function loadSecrets() {
  // Pula Infisical em desenvolvimento local
  if (process.env.NODE_ENV !== 'production') {
    console.log('[Infisical] NODE_ENV !== production — usando variáveis locais (.env)');
    return;
  }

  try {
    console.log(`[Infisical] Conectando... projeto: ${INFISICAL_PROJECT_ID} | ambiente: ${INFISICAL_ENV}`);

    const client = new InfisicalSDK({ siteUrl: 'https://app.infisical.com' });

    // Service Token usa serviceTokenAuth, NÃO universalAuth
    await client.auth().serviceTokenAuth.login(INFISICAL_TOKEN);

    const { secrets } = await client.secrets().listSecrets({
      projectId:   INFISICAL_PROJECT_ID,
      environment: INFISICAL_ENV,
      secretPath:  '/',
    });

    let count = 0;
    for (const secret of secrets) {
      if (!process.env[secret.secretKey]) {
        process.env[secret.secretKey] = secret.secretValue;
        count++;
      }
    }

    console.log(`[Infisical] ✅ ${count} secret(s) carregado(s).`);
  } catch (err) {
    console.error('[Infisical] ❌ Erro ao carregar secrets:', err.message);
    process.exit(1);
  }
}

module.exports = { loadSecrets };
