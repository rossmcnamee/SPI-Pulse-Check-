import { Line, LineChart, ResponsiveContainer, YAxis } from 'recharts'

// Tiny inline trend line for the channel pulse cards.
export function Sparkline({ data, color = '#14365C', height = 36 }: { data: number[]; color?: string; height?: number }) {
  const points = data.map((v, i) => ({ i, v }))
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={points} margin={{ top: 2, bottom: 2, left: 0, right: 0 }}>
        <YAxis hide domain={['dataMin', 'dataMax']} />
        <Line type="monotone" dataKey="v" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}
