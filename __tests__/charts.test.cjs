/**
 * Charts Tests - CommonJS module test
 * Tests for drawBarChart, drawLineChart, drawPieChart
 */

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');

// Mock window object
global.window = {
  devicePixelRatio: 1
};

const { drawBarChart, drawLineChart, drawPieChart } = require('../src/utils/charts.js');

describe('Charts Module', () => {
  let mockCanvas;
  let mockCtx;

  beforeEach(() => {
    mockCtx = {
      clearRect: () => {},
      fillStyle: '',
      beginPath: () => {},
      roundRect: () => {},
      fill: () => {},
      font: '',
      textAlign: '',
      fillText: () => {},
      moveTo: () => {},
      lineTo: () => {},
      stroke: () => {},
      arc: () => {},
      scale: () => {},
      closePath: () => {},
      fillRect: () => {}
    };

    mockCanvas = {
      getContext: () => mockCtx,
      offsetWidth: 300,
      offsetHeight: 200,
      width: 300,
      height: 200
    };
  });

  describe('drawBarChart', () => {
    it('should be a function', () => {
      assert.strictEqual(typeof drawBarChart, 'function');
    });

    it('should clear canvas before drawing', () => {
      let cleared = false;
      mockCtx.clearRect = () => { cleared = true; };
      
      drawBarChart(mockCanvas, { labels: ['A'], values: [10] });
      
      assert.ok(cleared);
    });

    it('should draw bars for each data point', () => {
      let roundRectCalls = 0;
      mockCtx.roundRect = () => { roundRectCalls++; };
      
      drawBarChart(mockCanvas, { 
        labels: ['A', 'B', 'C'], 
        values: [10, 20, 30] 
      });
      
      assert.strictEqual(roundRectCalls, 3);
    });

    it('should use custom bar color', () => {
      drawBarChart(mockCanvas, { labels: ['A'], values: [10] }, { barColor: '#FF0000' });
      assert.strictEqual(mockCtx.fillStyle, '#FF0000');
    });

    it('should handle empty values array', () => {
      drawBarChart(mockCanvas, { labels: [], values: [] });
    });

    it('should draw proportional bar heights', () => {
      drawBarChart(mockCanvas, { labels: ['A', 'B'], values: [10, 50] });
    });
  });

  describe('drawLineChart', () => {
    it('should be a function', () => {
      assert.strictEqual(typeof drawLineChart, 'function');
    });

    it('should clear canvas before drawing', () => {
      let cleared = false;
      mockCtx.clearRect = () => { cleared = true; };
      
      drawLineChart(mockCanvas, { labels: ['A'], values: [10] });
      
      assert.ok(cleared);
    });

    it('should draw line connecting all points', () => {
      let lineToCalls = 0;
      mockCtx.lineTo = () => { lineToCalls++; };
      
      drawLineChart(mockCanvas, { 
        labels: ['A', 'B', 'C'], 
        values: [10, 20, 30] 
      });
      
      assert.strictEqual(lineToCalls, 2);
    });

    it('should fill area under line', () => {
      let closePathCalled = false;
      mockCtx.closePath = () => { closePathCalled = true; };
      
      drawLineChart(mockCanvas, { labels: ['A', 'B'], values: [10, 20] });
      
      assert.ok(closePathCalled);
    });

    it('should draw dots at data points', () => {
      let arcCalls = 0;
      mockCtx.arc = () => { arcCalls++; };
      
      drawLineChart(mockCanvas, { labels: ['A', 'B'], values: [10, 20] });
      
      assert.strictEqual(arcCalls, 2);
    });

    it('should handle single data point', () => {
      drawLineChart(mockCanvas, { labels: ['A'], values: [10] });
    });
  });

  describe('drawPieChart', () => {
    it('should be a function', () => {
      assert.strictEqual(typeof drawPieChart, 'function');
    });

    it('should clear canvas before drawing', () => {
      let cleared = false;
      mockCtx.clearRect = () => { cleared = true; };
      
      drawPieChart(mockCanvas, { labels: ['A'], values: [10] });
      
      assert.ok(cleared);
    });

    it('should draw slices for each value', () => {
      let arcCalls = 0;
      mockCtx.arc = () => { arcCalls++; };
      
      drawPieChart(mockCanvas, { 
        labels: ['A', 'B', 'C'], 
        values: [10, 20, 30] 
      });
      
      assert.strictEqual(arcCalls, 3);
    });

    it('should show "暂无数据" for zero total', () => {
      let textContent = '';
      mockCtx.fillText = (text) => { textContent = text; };
      
      drawPieChart(mockCanvas, { labels: ['A'], values: [0] });
      
      assert.strictEqual(textContent, '暂无数据');
    });

    it('should draw legend', () => {
      let fillRectCalls = 0;
      mockCtx.fillRect = () => { fillRectCalls++; };
      
      drawPieChart(mockCanvas, { labels: ['A', 'B'], values: [10, 20] });
      
      assert.strictEqual(fillRectCalls, 2);
    });

    it('should use custom colors', () => {
      const customColors = ['#FF0000', '#00FF00'];
      
      drawPieChart(mockCanvas, { labels: ['A', 'B'], values: [10, 20] }, { colors: customColors });
      
      assert.strictEqual(mockCtx.fillStyle, '#FF0000');
    });

    it('should cycle colors when more slices than colors', () => {
      let arcCalls = 0;
      mockCtx.arc = () => { arcCalls++; };
      
      const limitedColors = ['#FF0000'];
      
      drawPieChart(mockCanvas, { 
        labels: ['A', 'B', 'C'], 
        values: [10, 20, 30] 
      }, { colors: limitedColors });
      
      assert.strictEqual(arcCalls, 3);
    });

    it('should draw both slices for equal values', () => {
      let arcCalls = 0;
      mockCtx.arc = () => { arcCalls++; };
      
      drawPieChart(mockCanvas, { labels: ['A', 'B'], values: [50, 50] });
      
      assert.strictEqual(arcCalls, 2);
    });
  });
});