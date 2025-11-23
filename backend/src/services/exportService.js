const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const analysisModel = require('../models/analysisModel');
const analysisService = require('./analysisService');

/**
 * Export Service - Handles data export to Excel and PDF
 */

/**
 * Generate Excel report without charts
 * @param {string} projectId - Project ID
 * @param {object} filters - Filter parameters
 * @returns {Promise<Buffer>} - Excel file buffer
 */
async function generateExcelReport(projectId, filters = {}) {
  try {
    // Get project data
    const { getDatabase } = require('../models/database');
    const db = getDatabase();
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    
    if (!project) {
      throw new Error('Project not found');
    }

    // Get analysis data
    const analysis = await analysisService.calculateProjectAnalysis(projectId, filters);
    const issues = await analysisModel.getIssues(projectId, { ...filters, limit: 10000 });
    const filterStatistics = await analysisModel.getFilterStatistics(projectId, filters, false);

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Issue Analyzer System';
    workbook.created = new Date();

    // ==================== Sheet 1: Summary ====================
    const summarySheet = workbook.addWorksheet('分析摘要', {
      pageSetup: { paperSize: 9, orientation: 'landscape' }
    });

    // Title
    summarySheet.mergeCells('A1:F1');
    summarySheet.getCell('A1').value = `${project.name} - Issue 分析报告`;
    summarySheet.getCell('A1').font = { size: 16, bold: true };
    summarySheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
    summarySheet.getRow(1).height = 30;

    // Project info
    summarySheet.getCell('A3').value = '项目名称:';
    summarySheet.getCell('B3').value = project.name;
    summarySheet.getCell('A4').value = '上传时间:';
    summarySheet.getCell('B4').value = new Date(project.upload_date).toLocaleString('zh-CN');
    summarySheet.getCell('A5').value = '导出时间:';
    summarySheet.getCell('B5').value = new Date().toLocaleString('zh-CN');
    
    // Apply filters info
    if (filters && Object.keys(filters).length > 0) {
      summarySheet.getCell('A6').value = '筛选条件:';
      let row = 6;
      for (const [key, value] of Object.entries(filters)) {
        if (['page', 'limit', 'sort_by', 'sort_order'].includes(key)) continue;
        summarySheet.getCell(`B${row}`).value = `${key}: ${value}`;
        row++;
      }
    }

    // Statistics summary
    const statsStartRow = 9;
    summarySheet.getCell(`A${statsStartRow}`).value = '统计概览';
    summarySheet.getCell(`A${statsStartRow}`).font = { size: 14, bold: true };
    
    const stats = [
      ['总 Issue 数', filterStatistics.totalCount || 0],
      ['Spec 问题数', filterStatistics.specCount || 0],
      ['Strife 问题数', filterStatistics.strifeCount || 0],
      ['独立 WF 数', filterStatistics.uniqueWFs || 0],
      ['独立 Config 数', filterStatistics.uniqueConfigs || 0],
      ['独立 Symptom 数', filterStatistics.uniqueSymptoms || 0],
      ['总样本量', filterStatistics.totalSamples || 0]
    ];

    stats.forEach((stat, idx) => {
      const row = statsStartRow + 2 + idx;
      summarySheet.getCell(`A${row}`).value = stat[0];
      summarySheet.getCell(`B${row}`).value = stat[1];
      summarySheet.getCell(`A${row}`).font = { bold: true };
    });

    // Set column widths
    summarySheet.getColumn(1).width = 20;
    summarySheet.getColumn(2).width = 30;

    // ==================== Sheet 2: Symptom Analysis ====================
    if (analysis.symptomStats && analysis.symptomStats.length > 0) {
      const symptomSheet = workbook.addWorksheet('Symptom 分析');
      
      symptomSheet.columns = [
        { header: 'Symptom', key: 'symptom', width: 40 },
        { header: 'Spec Issue 数量', key: 'specCount', width: 18 },
        { header: 'Strife Issue 数量', key: 'strifeCount', width: 18 },
        { header: '总 Issue 数量', key: 'count', width: 18 },
        { header: 'Spec 失败率 (PPM)', key: 'specFailureRate', width: 20 },
        { header: '总样本量', key: 'totalSamples', width: 15 },
        { header: '占比 (%)', key: 'percentage', width: 15 },
        { header: '影响的 WF 数', key: 'affectedWFs', width: 18 },
        { header: '影响的 Config 数', key: 'affectedConfigs', width: 18 }
      ];

      // Style header
      symptomSheet.getRow(1).font = { bold: true };
      symptomSheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };

      // Add data
      analysis.symptomStats.forEach(item => {
        symptomSheet.addRow({
          symptom: item.symptom,
          specCount: item.specCount || 0,
          strifeCount: item.strifeCount || 0,
          count: item.count,
          specFailureRate: item.specFailureRate ? (item.specFailureRate / 10000).toFixed(2) : 'N/A',
          totalSamples: item.totalSamples || 0,
          percentage: item.count && filterStatistics.totalCount ? ((item.count / filterStatistics.totalCount) * 100).toFixed(2) : 'N/A',
          affectedWFs: item.affectedWFs || 0,
          affectedConfigs: item.affectedConfigs || 0
        });
      });
    }

    // ==================== Sheet 3: WF Analysis ====================
    if (analysis.wfStats && analysis.wfStats.length > 0) {
      const wfSheet = workbook.addWorksheet('WF 分析');
      
      wfSheet.columns = [
        { header: 'WF', key: 'wf', width: 15 },
        { header: 'Test Name', key: 'testName', width: 35 },
        { header: 'Spec Issue 数量', key: 'specCount', width: 18 },
        { header: 'Strife Issue 数量', key: 'strifeCount', width: 18 },
        { header: '总 Issue 数量', key: 'count', width: 18 },
        { header: 'Spec 失败率 (PPM)', key: 'specFailureRate', width: 20 },
        { header: '总测试数', key: 'totalTests', width: 15 },
        { header: '占比 (%)', key: 'percentage', width: 15 }
      ];

      wfSheet.getRow(1).font = { bold: true };
      wfSheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };

      analysis.wfStats.forEach(item => {
        const count = item.failureCount || item.count;
        wfSheet.addRow({
          wf: item.wf,
          testName: item.testName || 'N/A',
          specCount: item.specCount || 0,
          strifeCount: item.strifeCount || 0,
          count: count,
          specFailureRate: item.specFailureRate ? (item.specFailureRate / 10000).toFixed(2) : 'N/A',
          totalTests: item.totalTests || 0,
          percentage: count && filterStatistics.totalCount ? ((count / filterStatistics.totalCount) * 100).toFixed(2) : 'N/A'
        });
      });
    }

    // ==================== Sheet 4: Config Analysis ====================
    if (analysis.configStats && analysis.configStats.length > 0) {
      const configSheet = workbook.addWorksheet('Config 分析');
      
      configSheet.columns = [
        { header: 'Config', key: 'config', width: 35 },
        { header: 'Spec Issue 数量', key: 'specCount', width: 18 },
        { header: 'Strife Issue 数量', key: 'strifeCount', width: 18 },
        { header: '总 Issue 数量', key: 'count', width: 18 },
        { header: 'Spec 失败率 (PPM)', key: 'specFailureRate', width: 20 },
        { header: '总样本量', key: 'totalSamples', width: 15 },
        { header: '占比 (%)', key: 'percentage', width: 15 },
        { header: '影响的 WF 数', key: 'affectedWFs', width: 18 }
      ];

      configSheet.getRow(1).font = { bold: true };
      configSheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };

      analysis.configStats.forEach(item => {
        const count = item.failureCount || item.count;
        configSheet.addRow({
          config: item.config,
          specCount: item.specCount || 0,
          strifeCount: item.strifeCount || 0,
          count: count,
          specFailureRate: item.specFailureRate ? (item.specFailureRate / 10000).toFixed(2) : 'N/A',
          totalSamples: item.totalSamples || 0,
          percentage: count && filterStatistics.totalCount ? ((count / filterStatistics.totalCount) * 100).toFixed(2) : 'N/A',
          affectedWFs: item.affectedWFs || 0
        });
      });
    }

    // ==================== Sheet 5: Test Analysis ====================
    if (analysis.testStats && analysis.testStats.length > 0) {
      const testSheet = workbook.addWorksheet('Test 分析');
      
      testSheet.columns = [
        { header: 'Test Name', key: 'test', width: 40 },
        { header: 'WF', key: 'wfs', width: 15 },
        { header: 'Spec Issue 数量', key: 'specCount', width: 18 },
        { header: 'Strife Issue 数量', key: 'strifeCount', width: 18 },
        { header: '总 Issue 数量', key: 'count', width: 18 },
        { header: 'Spec 失败率 (PPM)', key: 'specFailureRate', width: 20 },
        { header: '总样本量', key: 'totalSamples', width: 15 },
        { header: '占比 (%)', key: 'percentage', width: 15 }
      ];

      testSheet.getRow(1).font = { bold: true };
      testSheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };

      analysis.testStats.forEach(item => {
        testSheet.addRow({
          test: item.testName,
          wfs: item.wfs || 'N/A',
          specCount: item.specCount || 0,
          strifeCount: item.strifeCount || 0,
          count: item.count,
          specFailureRate: item.specFailureRate ? (item.specFailureRate / 10000).toFixed(2) : 'N/A',
          totalSamples: item.totalSamples || 0,
          percentage: item.count && filterStatistics.totalCount ? ((item.count / filterStatistics.totalCount) * 100).toFixed(2) : 'N/A'
        });
      });
    }

    // ==================== Sheet 6: Detailed Issues ====================
    const issuesSheet = workbook.addWorksheet('Issue 明细');
    
    issuesSheet.columns = [
      { header: 'FA#', key: 'fa_number', width: 15 },
      { header: 'Open Date', key: 'open_date', width: 12 },
      { header: 'Priority', key: 'priority', width: 10 },
      { header: 'WF', key: 'wf', width: 15 },
      { header: 'Config', key: 'config', width: 25 },
      { header: 'Failed Test', key: 'failed_test', width: 25 },
      { header: 'Symptom', key: 'symptom', width: 30 },
      { header: 'FA Status', key: 'fa_status', width: 15 },
      { header: 'Department', key: 'department', width: 15 }
    ];

    issuesSheet.getRow(1).font = { bold: true };
    issuesSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    issues.issues.forEach(issue => {
      issuesSheet.addRow({
        fa_number: issue.fa_number,
        open_date: issue.open_date,
        priority: issue.priority,
        wf: issue.wf,
        config: issue.config,
        failed_test: issue.failed_test,
        symptom: issue.symptom,
        fa_status: issue.fa_status,
        department: issue.department
      });
    });

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
  } catch (error) {
    console.error('Error generating Excel report:', error);
    throw error;
  }
}

/**
 * Generate PDF report with charts
 * @param {string} projectId - Project ID
 * @param {object} filters - Filter parameters
 * @param {object} chartsData - Charts image data (base64)
 * @returns {Promise<Buffer>} - PDF file buffer
 */
async function generatePDFReport(projectId, filters = {}, chartsData = {}) {
  try {
    const { getDatabase } = require('../models/database');
    const db = getDatabase();
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    
    if (!project) {
      throw new Error('Project not found');
    }

    const analysis = await analysisService.calculateProjectAnalysis(projectId, filters);
    const filterStatistics = await analysisModel.getFilterStatistics(projectId, filters, false);

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 50,
          info: {
            Title: `${project.name} - Issue Analysis Report`,
            Author: 'Issue Analyzer System',
            Subject: 'Issue Analysis Report',
            CreationDate: new Date()
          }
        });

        const chunks = [];
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // ==================== Page 1: Cover & Summary ====================
        // Title
        doc.fontSize(24).font('Helvetica-Bold').text(project.name, { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(18).text('Issue Analysis Report', { align: 'center' });
        doc.moveDown(2);

        // Project Info
        doc.fontSize(12).font('Helvetica');
        doc.text(`Project Name: ${project.name}`);
        doc.text(`Upload Date: ${new Date(project.upload_date).toLocaleString('zh-CN')}`);
        doc.text(`Export Date: ${new Date().toLocaleString('zh-CN')}`);
        doc.moveDown();

        // Filters (if any)
        if (filters && Object.keys(filters).length > 0) {
          doc.fontSize(14).font('Helvetica-Bold').text('Applied Filters:', { underline: true });
          doc.fontSize(11).font('Helvetica');
          for (const [key, value] of Object.entries(filters)) {
            if (['page', 'limit', 'sort_by', 'sort_order'].includes(key)) continue;
            doc.text(`  • ${key}: ${value}`);
          }
          doc.moveDown();
        }

        // Statistics Summary
        doc.fontSize(16).font('Helvetica-Bold').text('Statistics Summary', { underline: true });
        doc.moveDown(0.5);
        
        doc.fontSize(11).font('Helvetica');
        const stats = [
          ['Total Issues', filterStatistics.totalCount || 0],
          ['Spec Issues', filterStatistics.specCount || 0],
          ['Strife Issues', filterStatistics.strifeCount || 0],
          ['Unique WFs', filterStatistics.uniqueWFs || 0],
          ['Unique Configs', filterStatistics.uniqueConfigs || 0],
          ['Unique Symptoms', filterStatistics.uniqueSymptoms || 0],
          ['Total Sample Size', filterStatistics.totalSamples || 0]
        ];

        stats.forEach(([label, value]) => {
          doc.text(`${label}: ${value}`, { continued: false });
        });

        // ==================== Page 2: Charts ====================
        doc.addPage();
        doc.fontSize(18).font('Helvetica-Bold').text('Analysis Charts', { align: 'center' });
        doc.moveDown();

        let hasCharts = false;

        // Symptom Chart
        if (chartsData.symptomChart) {
          try {
            doc.fontSize(14).font('Helvetica-Bold').text('Symptom Distribution');
            doc.moveDown(0.5);
            const symptomImg = Buffer.from(chartsData.symptomChart.split(',')[1], 'base64');
            doc.image(symptomImg, {
              fit: [480, 200],
              align: 'center'
            });
            doc.moveDown();
            hasCharts = true;
          } catch (err) {
            console.error('Error adding symptom chart:', err);
          }
        }

        // WF Chart
        if (chartsData.wfChart) {
          try {
            doc.fontSize(14).font('Helvetica-Bold').text('WF Distribution');
            doc.moveDown(0.5);
            const wfImg = Buffer.from(chartsData.wfChart.split(',')[1], 'base64');
            doc.image(wfImg, {
              fit: [480, 200],
              align: 'center'
            });
            doc.moveDown();
            hasCharts = true;
          } catch (err) {
            console.error('Error adding WF chart:', err);
          }
        }

        // Test Chart
        if (chartsData.testChart) {
          try {
            if (doc.y > 600) doc.addPage();
            doc.fontSize(14).font('Helvetica-Bold').text('Test Distribution');
            doc.moveDown(0.5);
            const testImg = Buffer.from(chartsData.testChart.split(',')[1], 'base64');
            doc.image(testImg, {
              fit: [480, 200],
              align: 'center'
            });
            doc.moveDown();
            hasCharts = true;
          } catch (err) {
            console.error('Error adding test chart:', err);
          }
        }

        if (!hasCharts) {
          doc.fontSize(11).font('Helvetica').text(
            'Charts are not available in this export. Please export from the Dashboard page to include charts.',
            { align: 'center', width: 500 }
          );
        }

        // ==================== Page 3: Top Analysis ====================
        doc.addPage();
        doc.fontSize(18).font('Helvetica-Bold').text('Top Analysis', { align: 'center' });
        doc.moveDown();

        // Top Symptoms
        if (analysis.symptomStats && analysis.symptomStats.length > 0) {
          doc.fontSize(14).font('Helvetica-Bold').text('Top 10 Symptoms');
          doc.moveDown(0.3);
          doc.fontSize(10).font('Helvetica');
          
          const topSymptoms = analysis.symptomStats.slice(0, 10);
          topSymptoms.forEach((item, idx) => {
            const percentage = item.count && filterStatistics.totalCount ? ((item.count / filterStatistics.totalCount) * 100).toFixed(1) : 'N/A';
            doc.text(
              `${idx + 1}. ${item.symptom}: ${item.count} issues (${percentage}%)`,
              { indent: 20 }
            );
          });
          doc.moveDown();
        }

        // Top WFs
        if (analysis.wfStats && analysis.wfStats.length > 0) {
          doc.fontSize(14).font('Helvetica-Bold').text('Top 10 WFs');
          doc.moveDown(0.3);
          doc.fontSize(10).font('Helvetica');
          
          const topWFs = analysis.wfStats.slice(0, 10);
          topWFs.forEach((item, idx) => {
            const count = item.failureCount || item.count;
            const percentage = count && filterStatistics.totalCount ? ((count / filterStatistics.totalCount) * 100).toFixed(1) : 'N/A';
            doc.text(
              `${idx + 1}. ${item.wf}: ${count} issues (${percentage}%)`,
              { indent: 20 }
            );
          });
          doc.moveDown();
        }

        // Top Configs
        if (analysis.configStats && analysis.configStats.length > 0) {
          doc.fontSize(14).font('Helvetica-Bold').text('Top 10 Configs');
          doc.moveDown(0.3);
          doc.fontSize(10).font('Helvetica');
          
          const topConfigs = analysis.configStats.slice(0, 10);
          topConfigs.forEach((item, idx) => {
            const count = item.failureCount || item.count;
            const percentage = count && filterStatistics.totalCount ? ((count / filterStatistics.totalCount) * 100).toFixed(1) : 'N/A';
            doc.text(
              `${idx + 1}. ${item.config}: ${count} issues (${percentage}%)`,
              { indent: 20 }
            );
          });
          doc.moveDown();
        }

        // ==================== Page 4: Detailed Statistics Tables ====================
        doc.addPage();
        doc.fontSize(18).font('Helvetica-Bold').text('Detailed Statistics Tables', { align: 'center' });
        doc.moveDown();

        // Symptom Statistics Table
        if (analysis.symptomStats && analysis.symptomStats.length > 0) {
          doc.fontSize(14).font('Helvetica-Bold').text(`Symptom Statistics (Total: ${analysis.symptomStats.length})`);
          doc.moveDown(0.3);
          doc.fontSize(8).font('Helvetica');
          
          // Table header
          const tableTop = doc.y;
          doc.font('Helvetica-Bold');
          doc.text('Symptom', 50, tableTop, { width: 150, continued: true });
          doc.text('Spec', { width: 40, continued: true });
          doc.text('Strife', { width: 40, continued: true });
          doc.text('Total', { width: 40, continued: true });
          doc.text('Spec FR(ppm)', { width: 70, continued: true });
          doc.text('%', { width: 40, continued: false });
          
          doc.moveDown(0.3);
          doc.font('Helvetica');
          
          // Table rows (show top 20)
          analysis.symptomStats.slice(0, 20).forEach((item, idx) => {
            if (doc.y > 700) doc.addPage();
            const y = doc.y;
            const percentage = item.count && filterStatistics.totalCount ? ((item.count / filterStatistics.totalCount) * 100).toFixed(1) : 'N/A';
            const failureRate = item.specFailureRate ? (item.specFailureRate / 10000).toFixed(2) : 'N/A';
            
            doc.text(item.symptom.substring(0, 30), 50, y, { width: 150, continued: true });
            doc.text(String(item.specCount || 0), { width: 40, continued: true });
            doc.text(String(item.strifeCount || 0), { width: 40, continued: true });
            doc.text(String(item.count), { width: 40, continued: true });
            doc.text(failureRate, { width: 70, continued: true });
            doc.text(percentage, { width: 40, continued: false });
            doc.moveDown(0.2);
          });
          
          if (analysis.symptomStats.length > 20) {
            doc.fontSize(8).text(`... and ${analysis.symptomStats.length - 20} more symptoms`, { indent: 50 });
          }
          doc.moveDown();
        }

        // WF Statistics Table
        if (analysis.wfStats && analysis.wfStats.length > 0) {
          if (doc.y > 600) doc.addPage();
          doc.fontSize(14).font('Helvetica-Bold').text(`WF Statistics (Total: ${analysis.wfStats.length})`);
          doc.moveDown(0.3);
          doc.fontSize(8).font('Helvetica');
          
          // Table header
          const tableTop = doc.y;
          doc.font('Helvetica-Bold');
          doc.text('WF', 50, tableTop, { width: 30, continued: true });
          doc.text('Test', { width: 120, continued: true });
          doc.text('Spec', { width: 40, continued: true });
          doc.text('Total', { width: 40, continued: true });
          doc.text('Spec FR(ppm)', { width: 70, continued: true });
          doc.text('%', { width: 40, continued: false });
          
          doc.moveDown(0.3);
          doc.font('Helvetica');
          
          // Table rows (show top 25)
          analysis.wfStats.slice(0, 25).forEach((item, idx) => {
            if (doc.y > 700) doc.addPage();
            const y = doc.y;
            const count = item.failureCount || item.count;
            const percentage = count && filterStatistics.totalCount ? ((count / filterStatistics.totalCount) * 100).toFixed(1) : 'N/A';
            const failureRate = item.specFailureRate ? (item.specFailureRate / 10000).toFixed(2) : 'N/A';
            const testName = item.testName ? item.testName.substring(0, 25) : 'N/A';
            
            doc.text(String(item.wf), 50, y, { width: 30, continued: true });
            doc.text(testName, { width: 120, continued: true });
            doc.text(String(item.specCount || 0), { width: 40, continued: true });
            doc.text(String(count), { width: 40, continued: true });
            doc.text(failureRate, { width: 70, continued: true });
            doc.text(percentage, { width: 40, continued: false });
            doc.moveDown(0.2);
          });
          
          if (analysis.wfStats.length > 25) {
            doc.fontSize(8).text(`... and ${analysis.wfStats.length - 25} more WFs`, { indent: 50 });
          }
          doc.moveDown();
        }

        // All Configs
        if (analysis.configStats && analysis.configStats.length > 0) {
          if (doc.y > 600) doc.addPage();
          doc.fontSize(14).font('Helvetica-Bold').text(`Config Statistics (Total: ${analysis.configStats.length})`);
          doc.moveDown(0.3);
          doc.fontSize(8).font('Helvetica');
          
          // Table header
          const tableTop = doc.y;
          doc.font('Helvetica-Bold');
          doc.text('Config', 50, tableTop, { width: 120, continued: true });
          doc.text('Spec', { width: 40, continued: true });
          doc.text('Strife', { width: 40, continued: true });
          doc.text('Total', { width: 40, continued: true });
          doc.text('Spec FR(ppm)', { width: 70, continued: true });
          doc.text('%', { width: 40, continued: false });
          
          doc.moveDown(0.3);
          doc.font('Helvetica');
          
          // Table rows
          analysis.configStats.forEach((item, idx) => {
            if (doc.y > 700) doc.addPage();
            const y = doc.y;
            const count = item.failureCount || item.count;
            const percentage = count && filterStatistics.totalCount ? ((count / filterStatistics.totalCount) * 100).toFixed(1) : 'N/A';
            const failureRate = item.specFailureRate ? (item.specFailureRate / 10000).toFixed(2) : 'N/A';
            
            doc.text(item.config.substring(0, 25), 50, y, { width: 120, continued: true });
            doc.text(String(item.specCount || 0), { width: 40, continued: true });
            doc.text(String(item.strifeCount || 0), { width: 40, continued: true });
            doc.text(String(count), { width: 40, continued: true });
            doc.text(failureRate, { width: 70, continued: true });
            doc.text(percentage, { width: 40, continued: false });
            doc.moveDown(0.2);
          });
          doc.moveDown();
        }

        // ==================== Page 5: Test Statistics ====================
        if (analysis.testStats && analysis.testStats.length > 0) {
          if (doc.y > 600) doc.addPage();
          doc.fontSize(14).font('Helvetica-Bold').text(`Test Statistics (Total: ${analysis.testStats.length})`);
          doc.moveDown(0.3);
          doc.fontSize(8).font('Helvetica');
          
          // Table header
          const tableTop = doc.y;
          doc.font('Helvetica-Bold');
          doc.text('Test Name', 50, tableTop, { width: 150, continued: true });
          doc.text('WF', { width: 40, continued: true });
          doc.text('Spec', { width: 40, continued: true });
          doc.text('Total', { width: 40, continued: true });
          doc.text('FR(ppm)', { width: 70, continued: true });
          doc.text('%', { width: 40, continued: false });
          
          doc.moveDown(0.3);
          doc.font('Helvetica');
          
          // Table rows (show top 30)
          analysis.testStats.slice(0, 30).forEach((item, idx) => {
            if (doc.y > 700) doc.addPage();
            const y = doc.y;
            const percentage = item.count && filterStatistics.totalCount ? ((item.count / filterStatistics.totalCount) * 100).toFixed(1) : 'N/A';
            const failureRate = item.specFailureRate ? (item.specFailureRate / 10000).toFixed(2) : 'N/A';
            
            doc.text(item.testName.substring(0, 30), 50, y, { width: 150, continued: true });
            doc.text(String(item.wfs || 'N/A'), { width: 40, continued: true });
            doc.text(String(item.specCount || 0), { width: 40, continued: true });
            doc.text(String(item.count), { width: 40, continued: true });
            doc.text(failureRate, { width: 70, continued: true });
            doc.text(percentage, { width: 40, continued: false });
            doc.moveDown(0.2);
          });
          
          if (analysis.testStats.length > 30) {
            doc.fontSize(8).text(`... and ${analysis.testStats.length - 30} more tests`, { indent: 50 });
          }
        }

        // Footer
        doc.fontSize(8).font('Helvetica').text(
          `Generated by Issue Analyzer System © 2025`,
          50,
          doc.page.height - 50,
          { align: 'center' }
        );

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  } catch (error) {
    console.error('Error generating PDF report:', error);
    throw error;
  }
}

/**
 * Generate Failure Rate Matrix Excel report
 * @param {string} projectId - Project ID
 * @param {object} filters - Filter parameters
 * @returns {Promise<Buffer>} - Excel file buffer
 */
async function generateMatrixReport(projectId, filters = {}) {
  try {
    // Get project data
    const { getDatabase } = require('../models/database');
    const db = getDatabase();
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    
    if (!project) {
      throw new Error('Project not found');
    }

    // Get matrix data
    const matrixData = await analysisModel.getFailureRateMatrix(projectId, filters);
    const { wfs, configs, matrix, testsByWf } = matrixData;

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Issue Analyzer System';
    workbook.created = new Date();

    // ==================== Sheet: Failure Rate Matrix ====================
    const matrixSheet = workbook.addWorksheet('失败率矩阵');

    // Build header row: WF | Test1 | Config1 | Config2 | Config3 | Config4 | Test2 | Config1 | ...
    const headerRow = ['WF'];
    const testGroups = ['Test1', 'Test2', 'Test3']; // Fixed 3 test groups
    
    testGroups.forEach(testGroup => {
      headerRow.push(testGroup);
      configs.forEach(config => {
        headerRow.push(config);
      });
    });

    const headerRowObj = matrixSheet.addRow(headerRow);
    headerRowObj.font = { bold: true };
    headerRowObj.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD3D3D3' }
    };
    headerRowObj.alignment = { horizontal: 'center', vertical: 'middle' };

    // Data rows: For each WF
    wfs.forEach(wf => {
      const wfTests = testsByWf[wf] || [];
      const rowData = [wf];

      // For each test group (Test1, Test2, Test3)
      for (let testIdx = 0; testIdx < 3; testIdx++) {
        const testObj = wfTests[testIdx];
        
        if (testObj) {
          // Test name
          rowData.push(testObj.testName);
          
          // Configs for this test
          const matrixKey = `${wf}-${testIdx}`;
          const matrixRow = matrix[matrixKey];
          
          configs.forEach(config => {
            const cellData = matrixRow?.configs?.[config];
            rowData.push(cellData?.text || '');
          });
        } else {
          // No test for this group - add empty cells
          rowData.push(''); // Test name
          configs.forEach(() => {
            rowData.push(''); // Empty config cells
          });
        }
      }

      const dataRow = matrixSheet.addRow(rowData);
      dataRow.alignment = { horizontal: 'center', vertical: 'middle' };

      // Apply cell colors based on type
      let colIdx = 2; // Start after WF column
      for (let testIdx = 0; testIdx < 3; testIdx++) {
        colIdx++; // Skip test name column
        
        const testObj = wfTests[testIdx];
        if (testObj) {
          const matrixKey = `${wf}-${testIdx}`;
          const matrixRow = matrix[matrixKey];
          
          configs.forEach(config => {
            const cellData = matrixRow?.configs?.[config];
            const cell = dataRow.getCell(colIdx);
            
            if (cellData?.type === 'spec') {
              // Red for Spec failures
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFFFC7CE' }
              };
              cell.font = { color: { argb: 'FF9C0006' } };
            } else if (cellData?.type === 'strife') {
              // Yellow for Strife
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFFFEB9C' }
              };
              cell.font = { color: { argb: 'FF9C6500' } };
            }
            
            colIdx++;
          });
        } else {
          // No test - skip empty cells
          colIdx += configs.length;
        }
      }
    });

    // Set column widths
    matrixSheet.getColumn(1).width = 8; // WF
    let currentCol = 2;
    for (let i = 0; i < 3; i++) {
      matrixSheet.getColumn(currentCol).width = 40; // Test name
      currentCol++;
      for (let j = 0; j < configs.length; j++) {
        matrixSheet.getColumn(currentCol).width = 12; // Config columns
        currentCol++;
      }
    }

    // Add borders to all cells
    const totalRows = matrixSheet.rowCount;
    const totalCols = headerRow.length;
    for (let row = 1; row <= totalRows; row++) {
      for (let col = 1; col <= totalCols; col++) {
        const cell = matrixSheet.getCell(row, col);
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      }
    }

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
  } catch (error) {
    console.error('Error generating matrix report:', error);
    throw error;
  }
}

module.exports = {
  generateExcelReport,
  generateMatrixReport
};
