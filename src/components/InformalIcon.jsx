/** Foglia: una pratica informale, nello stesso formato di TonoIcon. */
export default function InformalIcon({
  className = 'informale-segno',
  x,
  y,
  width,
  height,
  color = '#4B6B57'
}) {
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
      <path
        d="M16 26.2c0-8.4 4.2-14.6 10.4-16.6-1.2 7.4-5.6 12.6-10.4 14.2C11.2 22.2 6.8 17 5.6 9.6 11.8 11.6 16 17.8 16 26.2Z"
        fill="currentColor"
        fillOpacity="0.14"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M16 26.2V11.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}
