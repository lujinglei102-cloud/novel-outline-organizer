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
  // 节流：rAF 句柄，同一帧内多次 prop 变更只触发一次 setOption
  const rafRef = useRef<number | null>(null)
  // 最新的 props 快照，rAF 回调里读取以拿到合并后的最新值
  const latestRef = useRef({ xLabels, values, conflictValues, idealCurve })
  latestRef.current = { xLabels, values, conflictValues, idealCurve }

  // 初始化 ECharts 实例（仅一次）
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
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      inst.dispose()
      chartRef.current = null
    }
  }, [onPointClick])

  // 节流更新：把多次连续 setOption 合并为一帧一次
  useEffect(() => {
    if (rafRef.current !== null) return // 已有 pending rAF，等待这一帧合并
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      const inst = chartRef.current
      if (!inst) return
      const {
        xLabels: xl,
        values: v,
        conflictValues: cv,
        idealCurve: ic,
      } = latestRef.current
      const hasConflict = cv && cv.length > 0

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
          data: v,
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
          data: cv,
        })
      }

      if (ic && ic.length) {
        series.push({
          name: '模板理想情绪',
          type: 'line',
          smooth: true,
          showSymbol: true,
          symbolSize: 6,
          itemStyle: { color: '#C48BDF' },
          lineStyle: { color: '#C48BDF', width: 2, type: 'dotted' },
          data: ic,
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
          data: xl,
          axisLabel: { hideOverlap: true, color: '#AAB2DA', fontSize: 11 },
          axisTick: { show: false },
          axisLine: { lineStyle: { color: 'rgba(140, 148, 200, 0.2)' } },
        },
        yAxis: yAxes,
        series,
      })
    })
  }, [xLabels, values, conflictValues, idealCurve])

  return <div ref={ref} style={{ width: '100%', height }} />
}
