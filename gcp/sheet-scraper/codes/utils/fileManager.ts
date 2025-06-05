import crypto from 'node:crypto';
import { Storage } from '@google-cloud/storage';

/**
 * 古いファイルの削除とメタデータ更新
 * @param storage GCS storage instance
 * @param bucketName バケット名
 * @param baseName ベースファイル名（拡張子なし）
 * @param extension 拡張子
 * @param content ファイル内容
 * @returns 生成されたファイル名
 */
export async function updateFileWithCleanup(
  storage: Storage, 
  bucketName: string, 
  baseName: string, 
  extension: string,
  content: string
): Promise<string> {
  const bucket = storage.bucket(bucketName);
  
  // ランダムID付きファイル名を生成
  const randomId = crypto.randomBytes(4).toString('hex');
  const newFileName = `${baseName}-${randomId}.${extension}`;
  
  // 古いファイル削除
  const [files] = await bucket.getFiles({ prefix: baseName });
  for (const file of files) {
    if (file.name.startsWith(baseName) && file.name !== newFileName && !file.name.endsWith('-latest.json')) {
      await file.delete();
    }
  }
  
  // 新しいファイル作成
  const file = bucket.file(newFileName);
  await file.save(content, { contentType: 'text/csv' });
  
  // メタデータファイル更新
  const metadataFile = bucket.file(`${baseName}-latest.json`);
  await metadataFile.save(JSON.stringify({
    latestFileName: newFileName,
    updatedAt: new Date().toISOString()
  }), { contentType: 'application/json' });
  
  return newFileName;
} 