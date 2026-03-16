export default function StepIndicator({ current, total = 4 }) {
  return (
    <div className="t-step-indicator">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`t-step-dot${i + 1 === current ? ' active' : ''}${i + 1 < current ? ' done' : ''}`}
        />
      ))}
    </div>
  )
}
