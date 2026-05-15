// CSV 解析和生成工具

// 解析 CSV 文本 → tasks 数组
export function parseCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const tasks = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length < 1 || !values[0].trim()) continue;

    const task = {
      title: values[headers.indexOf('title')]?.trim() || '',
      content: values[headers.indexOf('content')]?.trim() || '',
      tags: (values[headers.indexOf('tags')] || '').split(';').map(t => t.trim()).filter(Boolean),
      priority: normalizePriority(values[headers.indexOf('priority')]?.trim() || 'P1'),
      status: normalizeStatus(values[headers.indexOf('status')]?.trim() || 'todo'),
      dueDate: normalizeDate(values[headers.indexOf('duedate')]?.trim() || ''),
      recurrence: null,
      recurrenceEndDate: null,
      generatedDate: new Date().toISOString(),
      parentId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      reminded: false,
    };

    if (task.title) tasks.push(task);
  }

  return tasks;
}

// 解析一行 CSV（处理引号包裹的字段）
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function normalizePriority(val) {
  const map = { high: 'P0', medium: 'P1', low: 'P2', p0: 'P0', p1: 'P1', p2: 'P2' };
  return map[val?.toLowerCase()] || 'P1';
}

function normalizeStatus(val) {
  const map = { todo: 'todo', 'in-progress': 'in-progress', done: 'done', 'in progress': 'in-progress', 'inprogress': 'in-progress' };
  return map[val?.toLowerCase()] || 'todo';
}

function normalizeDate(val) {
  if (!val) return null;
  // 接受 YYYY-MM-DD 或 YYYY/MM/DD
  const normalized = val.replace(/\//g, '-');
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;
  return null;
}

// 生成 CSV 文本
export function generateCSV(tasks) {
  const headers = ['title', 'content', 'tags', 'priority', 'status', 'dueDate'];
  const headerLine = headers.join(',');
  const lines = tasks.map(task => {
    const row = [
      escapeCSV(task.title),
      escapeCSV(task.content),
      escapeCSV((task.tags || []).join(';')),
      task.priority || 'P1',
      task.status || 'todo',
      task.dueDate || '',
    ];
    return row.join(',');
  });
  return [headerLine, ...lines].join('\n');
}

function escapeCSV(val) {
  if (!val) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// 生成 JSON 导出
export function generateJSON(tasks) {
  return JSON.stringify(tasks, null, 2);
}

// 下载文件
export function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// 下载 Blob 文件（用于 EPUB）
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// 生成 iCal 格式
export function generateICal(tasks) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Hermes TodoList//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  for (const task of tasks) {
    if (!task.dueDate) continue; // iCal events need a date

    const uid = task.id.includes('@') ? task.id : `${task.id}@hermes-todolist`;
    const summary = escapeICal(task.title);
    const description = escapeICal(task.content || '');
    const categories = (task.tags || []).map(escapeICal).join(',');

    // 处理循环任务 - 生成未来12周的实例
    if (task.recurrence && task.isRecurring) {
      const instances = generateRecurringInstances(task, 12);
      for (const instance of instances) {
        lines.push('BEGIN:VEVENT');
        lines.push(`UID:${instance.uid}`);
        lines.push(`DTSTAMP:${formatICalDate(new Date())}`);
        lines.push(`DTSTART;VALUE=DATE:${instance.dueDate.replace(/-/g, '')}`);
        lines.push(`SUMMARY:${summary}`);
        if (description) lines.push(`DESCRIPTION:${description}`);
        if (categories) lines.push(`CATEGORIES:${categories}`);
        if (task.priority) {
          const MAP = { P0: '1', P1: '5', P2: '9' };
          lines.push(`PRIORITY:${MAP[task.priority] || '5'}`);
        }
        // 添加 RRULE
        if (instance.rrule) {
          lines.push(`RRULE:${instance.rrule}`);
        }
        lines.push('END:VEVENT');
      }
    } else {
      // 普通任务
      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${uid}`);
      lines.push(`DTSTAMP:${formatICalDate(new Date())}`);
      lines.push(`DTSTART;VALUE=DATE:${task.dueDate.replace(/-/g, '')}`);
      lines.push(`SUMMARY:${summary}`);
      if (description) lines.push(`DESCRIPTION:${description}`);
      if (categories) lines.push(`CATEGORIES:${categories}`);
      if (task.priority) {
        const MAP = { P0: '1', P1: '5', P2: '9' };
        lines.push(`PRIORITY:${MAP[task.priority] || '5'}`);
      }
      lines.push('END:VEVENT');
    }
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

/**
 * 生成循环任务的多个实例（未来12周）
 */
function generateRecurringInstances(task, weeks = 12) {
  const instances = [];
  const recurrence = task.recurrence || 'weekly';
  const baseDate = new Date(task.dueDate);
  
  // 计算每种循环的间隔
  let interval = 1;
  let freq = 'WEEKLY';
  
  switch (recurrence) {
    case 'daily':
      freq = 'DAILY';
      interval = 1;
      break;
    case 'weekly':
      freq = 'WEEKLY';
      interval = 1;
      break;
    case 'biweekly':
      freq = 'WEEKLY';
      interval = 2;
      break;
    case 'monthly':
      freq = 'MONTHLY';
      interval = 1;
      break;
    case 'weekdays':
      // 工作日：生成每天但标记为工作日（周一到周五）
      freq = 'DAILY';
      interval = 1;
      break;
    default:
      freq = 'WEEKLY';
      interval = 1;
  }

  // 生成未来 weeks 周的实例
  const startDate = new Date(baseDate);
  
  if (recurrence === 'weekdays') {
    // 工作日：生成周一到周五的实例
    for (let w = 0; w < weeks; w++) {
      for (let day = 1; day <= 5; day++) {
        const instanceDate = new Date(startDate);
        instanceDate.setDate(startDate.getDate() + (w * 7) + (day - startDate.getDay() + 7) % 7);
        
        // 只添加未来的日期
        if (instanceDate >= new Date()) {
          instances.push({
            uid: `${task.id}-${instanceDate.toISOString().split('T')[0]}@hermes-todolist`,
            dueDate: instanceDate.toISOString().split('T')[0],
            rrule: null // 已展开，不需要 RRULE
          });
        }
      }
    }
  } else {
    // 其他循环规则：每 interval 周/天/月 生成一个实例
    for (let i = 0; i < weeks; i++) {
      const instanceDate = new Date(baseDate);
      
      if (freq === 'DAILY') {
        instanceDate.setDate(baseDate.getDate() + (i * interval));
      } else if (freq === 'WEEKLY') {
        instanceDate.setDate(baseDate.getDate() + (i * 7 * interval));
      } else if (freq === 'MONTHLY') {
        instanceDate.setMonth(baseDate.getMonth() + (i * interval));
      }
      
      // 只添加未来的日期
      if (instanceDate >= new Date()) {
        instances.push({
          uid: `${task.id}-${instanceDate.toISOString().split('T')[0]}@hermes-todolist`,
          dueDate: instanceDate.toISOString().split('T')[0],
          rrule: `FREQ=${freq};INTERVAL=${interval};COUNT=${weeks}`
        });
      }
    }
  }
  
  return instances;
}

function escapeICal(str) {
  if (!str) return '';
  return str.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function formatICalDate(date) {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

// 生成 EPUB 文件
export function generateEPUB(tasks) {
  const date = new Date().toISOString().split('T')[0];
  const title = `Hermes TodoList - ${date}`;

  // 1. mimetype（必须不压缩）
  const mimetype = 'application/epub+zip';

  // 2. META-INF/container.xml
  const container = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;

  // 3. OEBPS/content.opf
  const contentOpf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>${escapeXml(title)}</dc:title>
    <dc:creator>Hermes TodoList</dc:creator>
    <dc:date>${date}</dc:date>
    <dc:language>zh-CN</dc:language>
    <dc:identifier id="uid">urn:uuid:${uuidv4()}</dc:identifier>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="style" href="style.css" media-type="text/css"/>
    <item id="ch1" href="ch1.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine toc="ncx">
    <itemref idref="ch1"/>
  </spine>
</package>`;

  // 4. OEBPS/toc.ncx
  const tocNcx = `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="urn:uuid:${uuidv4()}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle><text>${escapeXml(title)}</text></docTitle>
  <navMap>
    <navPoint id="np1" playOrder="1">
      <navLabel><text>任务列表</text></navLabel>
      <content src="ch1.xhtml"/>
    </navPoint>
  </navMap>
</ncx>`;

  // 5. OEBPS/nav.xhtml
  const navXhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>目录</title>
  <link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
  <nav epub:type="toc">
    <h1>任务列表</h1>
    <ol>
      <li><a href="ch1.xhtml">全部任务</a></li>
    </ol>
  </nav>
</body>
</html>`;

  // 6. OEBPS/style.css
  const styleCss = `body { font-family: sans-serif; padding: 1em; }
h1 { color: #333; border-bottom: 1px solid #ccc; padding-bottom: 0.3em; }
.task { margin-bottom: 1em; padding-bottom: 0.5em; border-bottom: 1px solid #eee; }
.task-title { font-weight: bold; font-size: 1.1em; margin-bottom: 0.3em; }
.task-meta { font-size: 0.85em; color: #666; }
.tag { display: inline-block; background: #e0e7ff; color: #3730a3; border-radius: 3px; padding: 1px 5px; font-size: 0.8em; margin-right: 4px; }
.priority-p0 { color: #dc2626; font-weight: bold; }
.priority-p1 { color: #d97706; font-weight: bold; }
.priority-p2 { color: #6b7280; }
.done { text-decoration: line-through; color: #9ca3af; }
`;

  // 7. OEBPS/ch1.xhtml - 任务内容
  const taskItems = tasks.map((task, i) => {
    const statusClass = task.status === 'done' ? ' done' : '';
    const priorityClass = ` priority-${(task.priority || 'P1').toLowerCase()}`;
    const tagsHtml = (task.tags || []).map(tag => `<span class="tag">${escapeXml(tag)}</span>`).join('');
    const dueDateHtml = task.dueDate ? `<div class="task-meta">📅 截止: ${task.dueDate}</div>` : '';
    const recurrenceHtml = task.recurrence ? `<div class="task-meta">🔁 重复: ${recurrenceLabel(task.recurrence)}</div>` : '';
    const contentHtml = task.content ? `<div class="task-content" style="margin-top:0.3em;color:#444;">${escapeXml(task.content)}</div>` : '';

    return `    <div class="task${statusClass}">
      <div class="task-title${priorityClass}">[${task.priority || 'P1'}] ${escapeXml(task.title)}</div>
      ${tagsHtml ? `<div class="task-tags">${tagsHtml}</div>` : ''}
      <div class="task-meta">状态: ${statusLabel(task.status)} | 创建: ${formatDate(task.createdAt)}</div>
      ${dueDateHtml}
      ${recurrenceHtml}
      ${contentHtml}
    </div>`;
  }).join('\n');

  const ch1Xhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>${escapeXml(title)}</title>
  <link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
  <h1>📋 ${escapeXml(title)}</h1>
  <p style="color:#666;font-size:0.9em;">共 ${tasks.length} 个任务</p>
  <hr/>
${taskItems}
</body>
</html>`;

  // 组装 ZIP
  const jszip = new (window.JSZip || (function() {
    // 简单内联实现，不依赖 JSZip
    // 使用 browser 内置的压缩（如果可用），否则使用 uncompressed
    return null;
  })());

  if (typeof JSZip !== 'undefined') {
    const zip = new JSZip();
    zip.file('mimetype', mimetype, { compression: 'STORE' });
    zip.file('META-INF/container.xml', container);
    zip.file('OEBPS/content.opf', contentOpf);
    zip.file('OEBPS/toc.ncx', tocNcx);
    zip.file('OEBPS/nav.xhtml', navXhtml);
    zip.file('OEBPS/style.css', styleCss);
    zip.file('OEBPS/ch1.xhtml', ch1Xhtml);
    return zip.generateAsync({ type: 'blob', mimeType: 'application/epub+zip', compression: 'DEFLATE' });
  } else {
    // Fallback: 不压缩的 ZIP（手动构建）
    return buildUncompressedEpub(mimetype, container, contentOpf, tocNcx, navXhtml, styleCss, ch1Xhtml, date);
  }
}

function buildUncompressedEpub(mimetype, container, contentOpf, tocNcx, navXhtml, styleCss, ch1Xhtml, date) {
  // 手动构建 ZIP 文件（无压缩）
  // ZIP 格式: [local file header] + filename + content + [data descriptor]
  // 使用 Store 压缩（compression = 0）
  const files = [
    { name: 'mimetype', content: mimetype, compression: 0 },
    { name: 'META-INF/container.xml', content: container, compression: 0 },
    { name: 'OEBPS/content.opf', content: contentOpf, compression: 0 },
    { name: 'OEBPS/toc.ncx', content: tocNcx, compression: 0 },
    { name: 'OEBPS/nav.xhtml', content: navXhtml, compression: 0 },
    { name: 'OEBPS/style.css', content: styleCss, compression: 0 },
    { name: 'OEBPS/ch1.xhtml', content: ch1Xhtml, compression: 0 },
  ];

  const parts = [];
  const centralDirectory = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = stringToBytes(file.name);
    const contentBytes = stringToBytes(file.content);

    // Local file header (30 bytes + filename)
    const headerSize = 30 + nameBytes.length;
    const localHeader = new Uint8Array(headerSize);
    // Signature
    localHeader[0] = 0x50; localHeader[1] = 0x4b; localHeader[2] = 0x03; localHeader[3] = 0x04;
    // Version needed
    localHeader[4] = 0x14; localHeader[5] = 0x00;
    // General purpose bit flag
    localHeader[6] = 0x00; localHeader[7] = 0x00;
    // Compression method (0 = stored)
    localHeader[8] = file.compression; localHeader[9] = 0x00;
    // Last mod time / date
    localHeader[10] = 0x00; localHeader[11] = 0x00; localHeader[12] = 0x00; localHeader[13] = 0x00;
    // CRC-32 (placeholder, will fix later)
    // Compressed / uncompressed size
    const crc32 = crc32Calc(contentBytes);
    writeUint32LE(localHeader, 14, crc32);
    writeUint32LE(localHeader, 18, contentBytes.length);
    writeUint32LE(localHeader, 22, contentBytes.length);
    // Filename length
    writeUint16LE(localHeader, 26, nameBytes.length);
    // Extra field length
    writeUint16LE(localHeader, 28, 0);

    // Copy filename after header
    for (let i = 0; i < nameBytes.length; i++) {
      localHeader[30 + i] = nameBytes[i];
    }

    parts.push({ header: localHeader, content: contentBytes, offset: offset });
    offset += headerSize + contentBytes.length;

    // Central directory entry
    const cdEntry = new Uint8Array(46 + nameBytes.length);
    cdEntry[0] = 0x50; cdEntry[1] = 0x4b; cdEntry[2] = 0x01; cdEntry[3] = 0x02;
    cdEntry[4] = 0x1e; cdEntry[5] = 0x03;
    cdEntry[6] = 0x14; cdEntry[7] = 0x00;
    cdEntry[8] = file.compression; cdEntry[9] = 0x00;
    writeUint32LE(cdEntry, 10, crc32);
    writeUint32LE(cdEntry, 14, contentBytes.length);
    writeUint32LE(cdEntry, 18, contentBytes.length);
    writeUint16LE(cdEntry, 22, nameBytes.length);
    writeUint16LE(cdEntry, 24, 0);
    writeUint16LE(cdEntry, 26, 0);
    writeUint16LE(cdEntry, 28, 0);
    writeUint16LE(cdEntry, 30, 0);
    writeUint32LE(cdEntry, 32, 0);
    writeUint32LE(cdEntry, 36, headerSize);
    for (let i = 0; i < nameBytes.length; i++) {
      cdEntry[46 + i] = nameBytes[i];
    }
    centralDirectory.push(cdEntry);
  }

  // End of central directory
  const cdOffset = offset;
  let cdSize = 0;
  for (const cd of centralDirectory) {
    parts.push({ data: cd });
    cdSize += cd.length;
  }

  const eocd = new Uint8Array(22);
  eocd[0] = 0x50; eocd[1] = 0x4b; eocd[2] = 0x05; eocd[3] = 0x06;
  writeUint16LE(eocd, 4, 0); // disk number
  writeUint16LE(eocd, 6, 0); // cd disk
  writeUint16LE(eocd, 8, centralDirectory.length);
  writeUint16LE(eocd, 10, centralDirectory.length);
  writeUint32LE(eocd, 12, cdSize);
  writeUint32LE(eocd, 16, cdOffset);
  writeUint16LE(eocd, 20, 0);

  // Assemble
  const result = [];
  for (const part of parts) {
    if (part.header) result.push(part.header);
    if (part.content) result.push(part.content);
    if (part.data) result.push(part.data);
  }
  result.push(eocd);

  return new Blob(result, { type: 'application/epub+zip' });
}

function writeUint16LE(buf, offset, val) {
  buf[offset] = val & 0xff;
  buf[offset + 1] = (val >> 8) & 0xff;
}

function writeUint32LE(buf, offset, val) {
  buf[offset] = val & 0xff;
  buf[offset + 1] = (val >> 8) & 0xff;
  buf[offset + 2] = (val >> 16) & 0xff;
  buf[offset + 3] = (val >> 24) & 0xff;
}

function stringToBytes(str) {
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    bytes[i] = str.charCodeAt(i) & 0xff;
  }
  return bytes;
}

// CRC-32 lookup table
const crc32Table = (function() {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  return table;
})();

function crc32Calc(data) {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = crc32Table[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function escapeXml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function statusLabel(status) {
  const map = { 'todo': '待办', 'in-progress': '进行中', 'done': '已完成' };
  return map[status] || status;
}

function recurrenceLabel(recurrence) {
  const map = { 'daily': '每日', 'weekly': '每周', 'monthly': '每月' };
  return map[recurrence] || recurrence;
}

function formatDate(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
