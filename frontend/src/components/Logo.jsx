import React from 'react';

/**
 * Logo 组件 - 现代简约设计
 * @param {Object} props
 * @param {boolean} props.light - 是否使用浅色版本（用于深色背景）
 * @param {number} props.size - Logo 尺寸（默认40）
 * @param {boolean} props.showText - 是否显示文字（默认 true）
 * @param {string} props.className - 自定义类名
 */
function Logo({ light = false, size = 40, showText = true, className = '' }) {
  const iconSize = size;
  const fontSize = size * 0.5;

  return (
    <div 
      className={`logo-container ${className}`}
      style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: `${size * 0.3}px`,
        userSelect: 'none'
      }}
    >
      {/* Logo 图标 */}
      <div 
        className="logo-icon"
        style={{
          width: `${iconSize}px`,
          height: `${iconSize}px`,
          background: light 
            ? 'linear-gradient(135deg, #40a9ff 0%, #1890ff 100%)'
            : 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
          borderRadius: `${iconSize * 0.25}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: light 
            ? '0 4px 12px rgba(64, 169, 255, 0.3)'
            : '0 4px 12px rgba(24, 144, 255, 0.3)',
          position: 'relative',
          overflow: 'hidden',
          transition: 'all 0.3s ease'
        }}
      >
        {/* 主图形 - 抽象的图表/bug 组合 */}
        <svg 
          width={iconSize * 0.65} 
          height={iconSize * 0.65} 
          viewBox="0 0 24 24" 
          fill="none"
          style={{ position: 'relative', zIndex: 2 }}
        >
          {/* 柱状图元素 */}
          <rect x="2" y="14" width="4" height="8" rx="1" fill="white" opacity="0.9" />
          <rect x="7" y="10" width="4" height="12" rx="1" fill="white" opacity="0.95" />
          <rect x="12" y="6" width="4" height="16" rx="1" fill="white" />
          
          {/* Bug 天线 */}
          <path 
            d="M18 2 L20 4 M22 2 L20 4" 
            stroke="white" 
            strokeWidth="1.5" 
            strokeLinecap="round"
            opacity="0.8"
          />
          
          {/* Bug 身体 */}
          <circle cx="20" cy="8" r="2.5" fill="white" opacity="0.9" />
        </svg>
        
        {/* 背景装饰光晕 */}
        <div 
          style={{
            position: 'absolute',
            top: '-50%',
            left: '-50%',
            width: '200%',
            height: '200%',
            background: 'radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%)',
            pointerEvents: 'none'
          }}
        />
      </div>

      {/* Logo 文字 */}
      {showText && (
        <div 
          className="logo-text"
          style={{
            display: 'flex',
            flexDirection: 'column',
            lineHeight: 1.2
          }}
        >
          <span 
            style={{
              fontSize: `${fontSize}px`,
              fontWeight: '700',
              color: light ? '#fff' : '#262626',
              letterSpacing: '-0.5px'
            }}
          >
            Issue Analyzer
          </span>
          <span 
            style={{
              fontSize: `${fontSize * 0.55}px`,
              fontWeight: '500',
              color: light ? 'rgba(255, 255, 255, 0.75)' : '#8c8c8c',
              marginTop: '2px',
              letterSpacing: '0.5px'
            }}
          >
            故障分析系统
          </span>
        </div>
      )}

      <style jsx>{`
        .logo-icon:hover {
          transform: translateY(-2px);
          box-shadow: ${light 
            ? '0 6px 16px rgba(64, 169, 255, 0.4) !important'
            : '0 6px 16px rgba(24, 144, 255, 0.4) !important'
          };
        }
      `}</style>
    </div>
  );
}

export default Logo;
