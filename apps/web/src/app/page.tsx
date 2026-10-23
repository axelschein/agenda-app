export default function HomePage() {
  return (
    <main className="page-shell">
      <section className="hero" aria-labelledby="page-title">
        <p className="eyebrow">AgendaApp · MVP</p>
        <h1 id="page-title">Turnos claros, agendas ordenadas.</h1>
        <p className="intro">
          Un espacio para que los clientes encuentren horarios disponibles y
          reserven, mientras el equipo administra servicios, disponibilidad y
          reservas.
        </p>
        <div className="role-grid" aria-label="Perfiles de uso">
          <article className="role-card">
            <span className="role-label">Para clientes</span>
            <h2>Encontrá un horario</h2>
            <p>Consultá disponibilidad y seguí el estado de tus reservas.</p>
          </article>
          <article className="role-card role-card-admin">
            <span className="role-label">Para administración</span>
            <h2>Organizá la agenda</h2>
            <p>Gestioná servicios, horarios disponibles y reservas.</p>
          </article>
        </div>
        <p className="status-note">La aplicación está en etapa de scaffolding.</p>
      </section>
    </main>
  );
}
