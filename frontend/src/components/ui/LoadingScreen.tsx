export default function LoadingScreen() {
  return (
    <div className="loading-screen" role="status" aria-label="Loading">
      <img
        src="/logo.png"
        alt="Loading"
        className="logo-img-large logo-loader"
        style={{ height: '120px', marginBottom: '20px' }}
      />
    </div>
  );
}
