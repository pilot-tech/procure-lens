import OpenAI from 'openai';
import fs from 'node:fs';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default defineEventHandler(async (event) => {
  const assistantId = getHeader(event, 'x-assistant-id');
  if (!assistantId)
    throw createError({
      statusCode: 400,
      message: 'Header x-assistant-id missing',
    });

  const vectorStoreId = getHeader(event, 'x-vector-id');
  if (!vectorStoreId)
    throw createError({
      statusCode: 400,
      message: 'Header x-vector-id missing',
    });

  const reqBody = await readBody<{
    fileIds: string[];
  }>(event);

  if (reqBody.fileIds.length > 0) {
    // Download files
    await Promise.all(reqBody.fileIds.map(
      async (fileId) => {
        const b = await blobStorage.getItemRaw(`${fileId}.pdf`) as ArrayBuffer | null;
        return b ? downloadFileFromArrayBuffer(fileId, b) : Promise.resolve();
      }
    ));

    const filePaths = reqBody.fileIds.map((fileId) => `${baseDir}/${fileId}.pdf`);
    const fileStreams = filePaths.map((filePath) => fs.createReadStream(filePath));
    await openai.beta.vectorStores.fileBatches.uploadAndPoll(vectorStoreId, { files: fileStreams });
  }
});

function downloadFileFromArrayBuffer(fileId: string, chunk: ArrayBuffer) {
  return new Promise<void>((resolve, reject) => {
    fs.appendFile(`${baseDir}/${fileId}.pdf`, Buffer.from(chunk), function (err) {
      if (err) {
        reject(err);
      } else {
        console.log("Saved", `${baseDir}/${fileId}.pdf`);
        resolve();
      }
    });
  });
}
