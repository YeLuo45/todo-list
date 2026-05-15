// PDF 导出工具 - 使用 jsPDF 生成任务报告

/**
 * 导出任务到 PDF
 * @param {Array} tasks - 任务数组
 * @param {Object} options - 导出选项
 * @param {string} options.scope - 导出范围: 'all' | 'completed' | 'in-progress' | 'project'
 * @param {string} options.projectFilter - 当 scope 为 'project' 时，指定项目名称
 */
export async function exportTasksToPDF(tasks, options = {}) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF();
  
  const {
    scope = 'all',
    projectFilter = null,
  } = options;

  // 过滤任务
  let filteredTasks = tasks;
  if (scope === 'completed') {
    filteredTasks = tasks.filter(t => t.status === 'done');
  } else if (scope === 'in-progress') {
    filteredTasks = tasks.filter(t => t.status === 'in-progress');
  } else if (scope === 'project' && projectFilter) {
    filteredTasks = tasks.filter(t => t.project === projectFilter);
  }

  // 按项目分组
  const grouped = {};
  for (const task of filteredTasks) {
    const project = task.project || '默认项目';
    if (!grouped[project]) grouped[project] = [];
    grouped[project].push(task);
  }

  // 标题
  const exportDate = new Date().toLocaleDateString('zh-CN');
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('任务报告', 105, 20, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(128);
  doc.text(`导出日期: ${exportDate}`, 105, 28, { align: 'center' });
  doc.text(`共 ${filteredTasks.length} 个任务`, 105, 34, { align: 'center' });
  
  doc.setTextColor(0);
  doc.setDrawColor(200);
  doc.line(20, 38, 190, 38);

  let yPos = 44;
  const pageHeight = 280;
  const lineHeight = 6;
  const taskHeight = 18;

  // 状态标签
  const statusLabel = { 'todo': '待办', 'in-progress': '进行中', 'done': '已完成' };
  const priorityLabel = { 'P0': '紧急', 'P1': '高', 'P2': '中' };

  // 按项目输出
  for (const [projectName, projectTasks] of Object.entries(grouped)) {
    // 检查是否需要分页
    if (yPos > pageHeight - 30) {
      doc.addPage();
      yPos = 20;
    }

    // 项目标题
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(`📁 ${projectName}`, 20, yPos);
    doc.text(`(${projectTasks.length}个任务)`, 190, yPos, { align: 'right' });
    yPos += 8;

    // 进度统计
    const completed = projectTasks.filter(t => t.status === 'done').length;
    const inProgress = projectTasks.filter(t => t.status === 'in-progress').length;
    const todo = projectTasks.filter(t => t.status === 'todo').length;
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(`已完成: ${completed} | 进行中: ${inProgress} | 待办: ${todo}`, 25, yPos);
    yPos += 6;

    // 分隔线
    doc.setDrawColor(220);
    doc.line(20, yPos, 190, yPos);
    yPos += 4;

    // 任务列表
    for (const task of projectTasks) {
      if (yPos > pageHeight - taskHeight) {
        doc.addPage();
        yPos = 20;
      }

      // 优先级颜色
      const priorityColors = { 'P0': [239, 68, 68], 'P1': [245, 158, 11], 'P2': [156, 163, 175] };
      const pColor = priorityColors[task.priority] || [100, 100, 100];

      // 优先级标记
      doc.setFillColor(...pColor);
      doc.circle(23, yPos - 1.5, 2, 'F');

      // 任务标题
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      const title = task.title.length > 40 ? task.title.substring(0, 37) + '...' : task.title;
      doc.text(title, 28, yPos);

      // 状态
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      const statusColor = task.status === 'done' ? [34, 197, 94] : (task.status === 'in-progress' ? [59, 130, 246] : [148, 163, 184]);
      doc.setTextColor(...statusColor);
      doc.text(statusLabel[task.status] || task.status, 190, yPos, { align: 'right' });
      yPos += 5;

      // 元信息行
      doc.setFontSize(8);
      doc.setTextColor(100);
      
      const metas = [];
      if (task.dueDate) metas.push(`📅 ${task.dueDate}`);
      if (task.priority) metas.push(`优先级: ${priorityLabel[task.priority] || task.priority}`);
      if (task.tags && task.tags.length > 0) metas.push(`🏷️ ${task.tags.join(', ')}`);
      
      if (metas.length > 0) {
        doc.text(metas.join('  |  '), 28, yPos);
      }
      yPos += 5;

      // 子任务
      if (task.subtasks && task.subtasks.length > 0) {
        doc.setFontSize(7);
        doc.setTextColor(120);
        for (const subtask of task.subtasks.slice(0, 3)) {
          const subtaskText = `  ☐ ${subtask.title || subtask}`;
          const displayText = subtaskText.length > 50 ? subtaskText.substring(0, 47) + '...' : subtaskText;
          doc.text(displayText, 28, yPos);
          yPos += 4;
        }
        if (task.subtasks.length > 3) {
          doc.text(`  ... 还有 ${task.subtasks.length - 3} 项`, 28, yPos);
          yPos += 4;
        }
      }

      // 分隔线
      doc.setDrawColor(240);
      doc.line(25, yPos, 190, yPos);
      yPos += 4;
    }

    yPos += 6;
  }

  // 页脚
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(180);
    doc.text(`第 ${i} / ${pageCount} 页`, 105, 292, { align: 'center' });
  }

  // 下载
  const date = new Date().toISOString().split('T')[0];
  doc.save(`hermes-tasks-${date}.pdf`);
}

/**
 * 获取所有项目列表
 */
export function getProjectList(tasks) {
  const projects = new Set();
  for (const task of tasks) {
    if (task.project) projects.add(task.project);
  }
  return Array.from(projects).sort();
}
