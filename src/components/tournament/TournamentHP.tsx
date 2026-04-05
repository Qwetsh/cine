interface Props {
  hpP1: number
  hpP2: number
  maxHp: number
  nameP1: string
  nameP2: string
}

export function TournamentHP({ hpP1, hpP2, maxHp, nameP1, nameP2 }: Props) {
  return (
    <div
      className="flex items-center justify-between px-3 py-2 rounded-xl"
      style={{
        background: 'rgba(20, 10, 15, 0.7)',
        border: '1px solid rgba(234, 179, 8, 0.2)',
      }}
    >
      {/* P1 side */}
      <div className="flex items-center gap-2">
        <div
          className="w-5 h-5 rounded-full text-[8px] text-white flex items-center justify-center font-bold flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #3b82f6, #60a5fa)', boxShadow: '0 0 4px rgba(59,130,246,0.4)' }}
        >
          1
        </div>
        <div className="flex flex-col items-start">
          <span className="text-[10px] text-blue-300 font-medium leading-none">{nameP1}</span>
          <div className="flex gap-0.5 mt-0.5">
            <Hearts count={hpP1} max={maxHp} />
          </div>
        </div>
      </div>

      {/* Center divider */}
      <div
        className="w-px h-6 mx-2 flex-shrink-0"
        style={{ background: 'rgba(234, 179, 8, 0.2)' }}
      />

      {/* P2 side */}
      <div className="flex items-center gap-2">
        <div className="flex flex-col items-end">
          <span className="text-[10px] text-red-300 font-medium leading-none">{nameP2}</span>
          <div className="flex gap-0.5 mt-0.5">
            <Hearts count={hpP2} max={maxHp} />
          </div>
        </div>
        <div
          className="w-5 h-5 rounded-full text-[8px] text-white flex items-center justify-center font-bold flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #ef4444, #f87171)', boxShadow: '0 0 4px rgba(239,68,68,0.4)' }}
        >
          2
        </div>
      </div>
    </div>
  )
}

function Hearts({ count, max }: { count: number; max: number }) {
  return (
    <>
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          className={`text-xs transition-all duration-300 ${
            i < count ? '' : 'opacity-20 grayscale'
          }`}
        >
          {i < count ? '❤️' : '🖤'}
        </span>
      ))}
    </>
  )
}
