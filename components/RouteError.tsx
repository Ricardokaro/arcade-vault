"use client";
export default function RouteError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div style={{ textAlign: "center", padding: "80px 20px" }}>
      <div className="pixel neon-magenta" style={{ fontSize: 16, marginBottom: 16 }}>
        FALLO DE CONEXIÓN
      </div>
      <p style={{ color: "var(--ink-dim)", marginBottom: 24 }}>
        No pudimos cargar los datos desde el servidor.
      </p>
      <button className="btn yellow" onClick={() => retry()}>
        REINTENTAR
      </button>
    </div>
  );
}