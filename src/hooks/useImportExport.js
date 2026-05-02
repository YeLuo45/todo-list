import { useCallback } from 'react';
import { parseCSV, generateCSV, generateJSON, downloadFile, downloadBlob, generateEPUB } from '../utils/csv';

export function useImportExport(tasks) {
  // 导出 JSON
  const exportJSON = useCallback(() => {
    const json = generateJSON(tasks);
    const date = new Date().toISOString().split('T')[0];
    downloadFile(json, `hermes-todos-${date}.json`, 'application/json');
  }, [tasks]);

  // 导出 CSV
  const exportCSV = useCallback(() => {
    const csv = generateCSV(tasks);
    const date = new Date().toISOString().split('T')[0];
    downloadFile(csv, `hermes-todos-${date}.csv`, 'text/csv');
  }, [tasks]);

  // 导出 EPUB
  const exportEPUB = useCallback(async () => {
    const blob = await generateEPUB(tasks);
    const date = new Date().toISOString().split('T')[0];
    downloadBlob(blob, `hermes-todos-${date}.epub`);
  }, [tasks]);

  // 解析文件
  const parseFile = useCallback((file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target.result;
          const ext = file.name.split('.').pop().toLowerCase();
          if (ext === 'csv') {
            resolve({ type: 'csv', tasks: parseCSV(text) });
          } else if (ext === 'json') {
            const data = JSON.parse(text);
            const arr = Array.isArray(data) ? data : (data.tasks || []);
            resolve({ type: 'json', tasks: arr });
          } else {
            reject(new Error('不支持的文件格式，请使用 CSV 或 JSON'));
          }
        } catch (err) {
          reject(new Error(`解析失败: ${err.message}`));
        }
      };
      reader.onerror = () => reject(new Error('读取文件失败'));
      reader.readAsText(file);
    });
  }, []);

  // 合并导入
  const mergeImport = useCallback((targetTasks, importedTasks) => {
    return [...targetTasks, ...importedTasks];
  }, []);

  // 覆盖导入
  const replaceImport = useCallback((importedTasks) => {
    return importedTasks;
  }, []);

  return {
    exportJSON,
    exportCSV,
    exportEPUB,
    parseFile,
    mergeImport,
    replaceImport,
  };
}
