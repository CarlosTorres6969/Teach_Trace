const { BlobServiceClient } = require('@azure/storage-blob');
const { randomUUID } = require('crypto');
const { readFileSync } = require('fs');
const { resolve } = require('path');

function loadProjectEnvironment() {
  const content = readFileSync(resolve(__dirname, '../../.env'), 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value;
  }
}

async function verifyAzureStorage() {
  loadProjectEnvironment();
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const containerName = process.env.AZURE_STORAGE_CONTAINER;
  if (!connectionString || !containerName) {
    throw new Error('Faltan AZURE_STORAGE_CONNECTION_STRING o AZURE_STORAGE_CONTAINER en .env');
  }

  const container = BlobServiceClient.fromConnectionString(connectionString)
    .getContainerClient(containerName);
  await container.createIfNotExists();
  const blob = container.getBlockBlobClient(`connectivity-check/${randomUUID()}.txt`);
  try {
    await blob.uploadData(Buffer.from('teachtrace-storage-check'), {
      blobHTTPHeaders: { blobContentType: 'text/plain' },
    });
    const downloaded = await blob.downloadToBuffer();
    if (downloaded.toString() !== 'teachtrace-storage-check') {
      throw new Error('El contenido descargado desde Azure no coincide');
    }
  } finally {
    await blob.deleteIfExists();
  }
}

verifyAzureStorage()
  .then(() => console.log('Azure Blob Storage: conexión, carga y descarga correctas.'))
  .catch((error) => {
    console.error(`Azure Blob Storage: verificación fallida (${error.code ?? error.name ?? 'Error'}).`);
    process.exitCode = 1;
  });
