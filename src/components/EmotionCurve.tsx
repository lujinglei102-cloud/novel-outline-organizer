import { useEffect, useRef } from 'react'
import * as echarts from 'echarts'

interface Props {
  xLabels: string[] // x 轴显示，如卡片标题或序号
  values: number[] // 情绪值 -5..5（左 Y 轴）
  conflictValues?: number[] // 冲突强度 1..5（右 Y 轴，第二条曲线）
  idealCurve?: number[] // 模板理想情绪曲线
  onPointClick?: (idx: number) => void
  height?: number
}

export function EmotionCurve({
  xLabels,
  values,
  conflictValues,
  idealCurve,
  onPointClick,
  height = 320,
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    if (!ref.current) return
    const inst = echarts.init(ref.current)
    chartRef.current = inst
    inst.on('click', (p: any) => {
      if (typeof p.dataIndex === 'number' && onPointClick) onPointClick(p.dataIndex)
    })
    const handleResize = () => inst.resize()
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      inst.dispose()
      chartRef.current = null
    }
  }, [onPointClick])

  useEffect(() => {
    const inst = chartRef.current
    if (!inst) return
    const hasConflict = conflictValues && conflictValues.length > 0

    const series: any[] = [
      {
        name: '情绪值',
        type: 'line',
        smooth: true,
        symbolSize: 8,
        showSymbol: true,
        itemStyle: { color: '#8FA5E8' },
        lineStyle: { color: '#8FA5E8', width: 2 },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(143, 165, 232, 0.35)' },
            { offset: 1, color: 'rgba(143, 165, 232, 0.02)' },
          ]),
        },
        data: values,
      },
    ]

    if (hasConflict) {
      series.push({
        name: '冲突强度',
        type: 'line',
        smooth: true,
        symbolSize: 7,
        showSymbol: true,
        itemStyle: { color: '#ef4444' },
        lineStyle: { color: '#ef4444', width: 2, type: 'dashed' },
        yAxisIndex: 1,
        data: conflictValues,
      })
    }

    if (idealCurve && idealCurve.length) {
      series.push({
        name: '模板理想情绪',
        type: 'line',
        smooth: true,
        showSymbol: true,
        symbolSize: 6,
        itemStyle: { color: '#C48BDF' },
        lineStyle: { color: '#C48BDF', width: 2, type: 'dotted' },
        data: idealCurve,
      })
    }

    const yAxes: any[] = [
      {
        type: 'value',
        min: -5,
        max: 5,
        interval: 1,
        splitLine: { lineStyle: { color: 'rgba(140, 148, 200, 0.15)' } },
        axisLabel: { color: '#AAB2DA' },
        name: '情绪值',
        nameTextStyle: { color: '#8C94C8', fontSize: 11 },
      },
    ]
    if (hasConflict) {
      yAxes.push({
        type: 'value',
        min: 0,
        max: 5,
        interval: 1,
        splitLine: { show: false },
        axisLabel: { color: '#E8A0A0' },
        name: '冲突强度',
        nameTextStyle: { color: '#E8A0A0', fontSize: 11 },
      })
    }

    inst.setOption({
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(22, 22, 52, 0.95)',
        borderColor: 'rgba(143, 165, 232, 0.4)',
        textStyle: { color: '#F0F2FC' },
      },
      grid: { left: 45, right: hasConflict ? 50 : 20, top: 30, bottom: 40 },
      legend: {
        top: 0,
        right: 0,
        icon: 'line',
        textStyle: { fontSize: 11, color: '#AAB2DA' },
      },
      xAxis: {
        type: 'category',
        data: xLabels,
        axisLabel: { hideOverlap: true, color: '#AAB2DA', fontSize: 11 },
        axisTick: { show: false },
        axisLine: { lineStyle: { color: 'rgba(140, 148, 200, 0.2)' } },
      },
      yAxis: yAxes,
      series,
    })
  }, [xLabels, values, conflictValues, idealCurve])

  return <div ref={ref} style={{ width: '100%', height }} />
}
