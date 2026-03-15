export default function LoadingScreen({ title = 'Loading...', subtitle = 'Getting everything ready' }) {
  return (
    <div className="ll-auth-screen">
      <div className="ll-auth-card" style={{ textAlign: 'center' }}>
        <span className="auth-icon">&#128153;</span>
        <h1>{title}</h1>
        <p className="auth-subtitle">{subtitle}</p>
        <div className="ll-spinner" />
      </div>
    </div>
  )
}
