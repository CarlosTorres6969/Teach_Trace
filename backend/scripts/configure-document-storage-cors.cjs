const { BlobServiceClient } = require('@azure/storage-blob');
const { resolve } = require('path');

require('dotenv').config({ path: resolve(__dirname, '../../.env'), quiet: true });

async function configureCors() {
  if (!process.env.AZURE_STORAGE_CONNECTION_STRING) {
    throw new Error('Falta AZURE_STORAGE_CONNECTION_STRING');
  }
  const origins = [...new Set([
    'https://teach-trace-frontend.vercel.app',
    ...(process.env.FRONTEND_ORIGIN || '').split(','),
  ].map((origin) => origin.trim()).filter(Boolean))];
  for (const origin of origins) {
    if (new URL(origin).origin !== origin) throw new Error('FRONTEND_ORIGIN debe contener orígenes sin rutas');
  }
  const client = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
  const properties = await client.getProperties();
  const current = properties.cors || [];
  const requiredHeaders = ['content-type', 'x-ms-blob-type'];
  const missingOrigins = origins.filter((origin) => !current.some((rule) => {
    const allowedOrigins = rule.allowedOrigins.split(',').map((item) => item.trim());
    const headers = rule.allowedHeaders.toLowerCase().split(',').map((item) => item.trim());
    return (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) &&
      rule.allowedMethods.split(',').map((item) => item.trim()).includes('PUT') &&
      requiredHeaders.every((header) => headers.some((allowed) =>
        allowed === '*' || allowed === header || (allowed.endsWith('*') && header.startsWith(allowed.slice(0, -1)))));
  }));
  if (!missingOrigins.length) {
    console.log('Azure ya permite la carga directa desde los orígenes de TeachTrace.');
    return;
  }
  if (current.length >= 5) throw new Error('Azure ya tiene cinco reglas CORS; revisa las reglas antes de agregar otra');
  const rule = {
    allowedOrigins: missingOrigins.join(','), allowedMethods: 'PUT',
    allowedHeaders: requiredHeaders.join(','), exposedHeaders: '', maxAgeInSeconds: 300,
  };
  console.log(JSON.stringify({ action: 'add_cors_rule', rule, preservedRules: current.length }));
  if (process.argv.includes('--apply')) {
    await client.setProperties({ cors: [...current, rule] });
    console.log('CORS de carga directa configurado; se conservaron las reglas existentes.');
  } else {
    console.log('Solo revisión. Usa --apply para aplicar esta regla.');
  }
}

configureCors().catch((error) => {
  // No imprimir errores del SDK que puedan incluir URLs firmadas o credenciales.
  console.error(error.code ? `No fue posible configurar CORS (${error.code})` : error.message);
  process.exitCode = 1;
});
