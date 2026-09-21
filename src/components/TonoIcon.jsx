export default function TonoIcon({
  id,
  className = 'tono-segno',
  x,
  y,
  width,
  height,
  color,
  pieno = false
}) {
  const volto = pieno ? '#FBFAF6' : 'currentColor'
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      x={x}
      y={y}
      width={width}
      height={height}
      color={color}
      aria-hidden="true"
    >
      <circle
        cx="16"
        cy="16"
        r="12.4"
        fill="currentColor"
        fillOpacity={pieno ? 1 : 0.1}
        stroke={pieno ? '#FBFAF6' : 'currentColor'}
        strokeWidth={pieno ? 1.4 : 1.9}
      />
      {id === 'spiacevole' && (
        <>
          <circle cx="11.5" cy="13.1" r="1.35" fill={volto} />
          <circle cx="20.5" cy="13.1" r="1.35" fill={volto} />
          <path d="M10.8 21.6c2.8-3.6 7.6-3.6 10.4 0" fill="none" stroke={volto} strokeWidth="2" strokeLinecap="round" />
        </>
      )}
      {id === 'neutro' && (
        <>
          <circle cx="11.5" cy="13.5" r="1.35" fill={volto} />
          <circle cx="20.5" cy="13.5" r="1.35" fill={volto} />
          <path d="M11 20.3h10" fill="none" stroke={volto} strokeWidth="2" strokeLinecap="round" />
        </>
      )}
      {id === 'piacevole' && (
        <>
          <circle cx="11.5" cy="13.7" r="1.35" fill={volto} />
          <circle cx="20.5" cy="13.7" r="1.35" fill={volto} />
          <path d="M10.8 18.2c2.8 3.8 7.6 3.8 10.4 0" fill="none" stroke={volto} strokeWidth="2" strokeLinecap="round" />
        </>
      )}
    </svg>
  )
}