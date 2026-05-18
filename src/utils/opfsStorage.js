/**
 * OPFS Storage Utility
 * 提供大于 localStorage 的存储能力
 */

const OPFS_DIR_NAME = 'hermes-todo';

/**
 * 获取 OPFS 根目录
 */
async function getOPFSDir() {
  const root = await navigator.storage.getDirectory();
  return await root.getDirectoryHandle(OPFS_DIR_NAME, { create: true });
}

/**
 * 保存数据到 OPFS
 */
export async function saveToOPFS(key, data) {
  try {
    const dir = await getOPFSDir();
    const fileHandle = await dir.getFileHandle(`${key}.json`, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(data, null, 2));
    await writable.close();
    console.log(`[OPFS] Saved ${key} (${JSON.stringify(data).length} bytes)`);
    return true;
  } catch (e) {
    // Detect quota exceeded or other storage errors
    if (e instanceof DOMException) {
      if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_FILE_QUOTA_EXCEEDED') {
        console.warn('[OPFS] Quota exceeded, fallback to localStorage needed');
      } else {
        console.error('[OPFS] DOMException:', e.name, e.message);
      }
    } else {
      console.error('[OPFS] Save error:', e);
    }
    return false;
  }
}

/**
 * 从 OPFS 加载数据
 * 读取失败时返回 null（调用方应降级到 localStorage）
 */
export async function loadFromOPFS(key) {
  try {
    const dir = await getOPFSDir();
    const fileHandle = await dir.getFileHandle(`${key}.json`);
    const file = await fileHandle.getFile();
    const text = await file.text();
    return JSON.parse(text);
  } catch (e) {
    // 文件不存在或读取失败
    if (e instanceof DOMException) {
      if (e.name === 'NotFoundError') {
        console.warn(`[OPFS] File ${key} not found`);
      } else {
        console.error('[OPFS] Load DOMException:', e.name, e.message);
      }
    } else {
      console.error('[OPFS] Load error:', e);
    }
    return null;
  }
}

/**
 * 删除 OPFS 数据
 */
export async function deleteFromOPFS(key) {
  try {
    const dir = await getOPFSDir();
    await dir.removeEntry(`${key}.json`);
    return true;
  } catch (e) {
    console.error('[OPFS] Delete error:', e);
    return false;
  }
}

/**
 * 列出 OPFS 中的所有 key
 */
export async function listOPFSKeys() {
  try {
    const dir = await getOPFSDir();
    const keys = [];
    for await (const [name] of dir.entries()) {
      if (name.endsWith('.json')) {
        keys.push(name.replace('.json', ''));
      }
    }
    return keys;
  } catch (e) {
    console.error('[OPFS] List error:', e);
    return [];
  }
}

/**
 * 检查浏览器是否支持 OPFS
 */
export function isOPFSSupported() {
  return 'storage' in navigator && 'getDirectory' in navigator.storage;
}