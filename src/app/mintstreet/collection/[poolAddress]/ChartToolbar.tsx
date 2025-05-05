import React from 'react';
import styles from './CollectionChart.module.scss';

// Define chart type options
type ChartType = 'candlestick' | 'line' | 'area' | 'bar';

// Define timeframe options
type Timeframe = 'raw' | '1h' | '1d';

// Define SMA period options
type SMAPeriod = 5 | 10 | 20 | 50 | 100;

// Define props interface
interface ChartToolbarProps {
  onResetZoom: () => void;
  chartType: ChartType;
  setChartType: (type: ChartType) => void;
  showSMA: boolean;
  setShowSMA: (show: boolean) => void;
  smaPeriod: SMAPeriod;
  setSmaPeriod: (period: SMAPeriod) => void;
  timeframe: Timeframe;
  setTimeframe: (timeframe: Timeframe) => void;
}

const ChartToolbar: React.FC<ChartToolbarProps> = ({
  onResetZoom,
  chartType,
  setChartType,
  showSMA,
  setShowSMA,
  smaPeriod,
  setSmaPeriod,
  timeframe,
  setTimeframe
}) => {
  return (
    <div className={styles.toolbar}>
      <div className={styles.toolGroup}>
        <button
          className={chartType === 'candlestick' ? styles.active : ''}
          onClick={() => setChartType('candlestick')}
        >
          Candles
        </button>
        <button
          className={chartType === 'line' ? styles.active : ''}
          onClick={() => setChartType('line')}
        >
          Line
        </button>
        <button
          className={chartType === 'area' ? styles.active : ''}
          onClick={() => setChartType('area')}
        >
          Area
        </button>
        <button
          className={chartType === 'bar' ? styles.active : ''}
          onClick={() => setChartType('bar')}
        >
          Bar
        </button>
      </div>
      <div className={styles.toolGroup}>
        <button
          className={showSMA ? styles.active : ''}
          onClick={() => setShowSMA(!showSMA)}
        >
          SMA ({smaPeriod})
        </button>
        <select
          value={smaPeriod}
          onChange={(e) => setSmaPeriod(Number(e.target.value) as SMAPeriod)}
          disabled={!showSMA}
        >
          <option value={5}>5</option>
          <option value={10}>10</option>
          <option value={20}>20</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>
      </div>
      <div className={styles.toolGroup}>
        <select 
          value={timeframe} 
          onChange={(e) => setTimeframe(e.target.value as Timeframe)}
        >
          <option value="raw">Raw</option>
          <option value="1h">1H</option>
          <option value="1d">1D</option>
        </select>
      </div>
      <div className={styles.toolGroup}>
        <button onClick={onResetZoom}>
          Reset Zoom
        </button>
      </div>
    </div>
  );
};

export default ChartToolbar;
