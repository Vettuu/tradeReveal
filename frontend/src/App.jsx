import './App.css'

function App() {
  const appName = import.meta.env.VITE_APP_NAME || 'TradeReveal'
  const features = [
    {
      title: 'Import multi-trade',
      description: 'Carica file Excel/CSV e valida automaticamente ogni riga prima del salvataggio.',
    },
    {
      title: 'Inserimento rapido',
      description: 'Registra il singolo trade in pochi campi quando fai solo un’operazione.',
    },
    {
      title: 'Analytics e journaling',
      description: 'Metriche mensili, statistiche cumulative, note operative e disciplina.',
    },
  ]

  return (
    <main className="landing">
      <div className="bg-glow bg-glow-left" />
      <div className="bg-glow bg-glow-right" />

      <section className="hero shell">
        <p className="eyebrow reveal">Trading Journal Platform</p>
        <h1 className="reveal reveal-1">
          {appName}
          <span>traccia, analizza e migliora ogni decisione di trading.</span>
        </h1>
        <p className="lead reveal reveal-2">
          Workspace personale per importare trade in batch, salvare operazioni singole e costruire una
          cronologia reale delle tue performance.
        </p>
        <div className="cta-row reveal reveal-3">
          <button type="button" className="btn btn-primary">
            Inizia con un trade
          </button>
          <button type="button" className="btn btn-ghost">
            Importa file Excel
          </button>
        </div>
      </section>

      <section className="shell cards">
        {features.map((feature, idx) => (
          <article key={feature.title} className={`card reveal reveal-${idx + 1}`}>
            <h2>{feature.title}</h2>
            <p>{feature.description}</p>
          </article>
        ))}
      </section>

      <section className="shell split">
        <div className="panel reveal reveal-1">
          <p className="panel-kicker">Cosa puoi fare qui</p>
          <ul>
            <li>Tenere uno storico pulito e consistente dei trade giornalieri.</li>
            <li>Confrontare setup, risk management e risultati mese su mese.</li>
            <li>Aggiungere journaling operativo per evitare errori ricorrenti.</li>
          </ul>
        </div>
        <div className="preview reveal reveal-2">
          <div className="preview-header">
            <span />
            <span />
            <span />
          </div>
          <div className="preview-content">
            <div className="metric">
              <p>Monthly P&L</p>
              <strong>+2,840.50</strong>
            </div>
            <div className="bars">
              <i style={{ '--size': '72%' }} />
              <i style={{ '--size': '46%' }} />
              <i style={{ '--size': '88%' }} />
              <i style={{ '--size': '61%' }} />
              <i style={{ '--size': '79%' }} />
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

export default App
