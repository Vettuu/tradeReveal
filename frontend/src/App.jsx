import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { parseBrokerImport } from './lib/brokerImport'

const initialTradeForm = {
  brokerPositionId: '',
  contractName: '',
  tradeDate: '',
  timeIt: '',
  timeNy: '',
  lots: '',
  direction: 'long',
  setupName: '',
  entryPrice: '',
  exitPrice: '',
  stopLoss: '',
  riskAmount: '',
  notes: '',
  account: '',
  redNews: false,
  resultAmount: '',
}

const emptyDashboard = {
  summary: {
    total_trades: 0,
    total_contracts: 0,
    gross_pnl: 0,
    total_fees: 0,
    net_pnl: 0,
    avg_gross_pnl: 0,
    avg_net_pnl: 0,
    wins: 0,
    losses: 0,
    win_rate: 0,
    avg_winning_trade: 0,
    avg_losing_trade: 0,
    total_winnings: 0,
    total_losses: 0,
    current_month_gross_pnl: 0,
    current_month_fees: 0,
    current_month_net_pnl: 0,
  },
  monthly_performance: [],
  daily_performance: [],
  weekday_stats: [],
  recent_trades: [],
}

function monthLabel(monthKey) {
  const [year, month] = monthKey.split('-').map(Number)
  return new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1))
}

function buildCalendarDays(selectedMonth, dailyPerformance) {
  if (!selectedMonth) {
    return []
  }

  const [year, month] = selectedMonth.split('-').map(Number)
  const firstDay = new Date(year, month - 1, 1)
  const daysInMonth = new Date(year, month, 0).getDate()
  const firstWeekday = (firstDay.getDay() + 6) % 7
  const byDate = new Map(dailyPerformance.map((item) => [item.trade_date, item]))
  const cells = []

  for (let index = 0; index < firstWeekday; index += 1) {
    cells.push(null)
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateKey = `${selectedMonth}-${String(day).padStart(2, '0')}`
    cells.push({
      day,
      dateKey,
      data: byDate.get(dateKey) || null,
    })
  }

  return cells
}

function Icon({ name }) {
  const icons = {
    home: 'M4 10 12 4l8 6v9h-5v-6H9v6H4z',
    orders: 'M5 6h14M5 12h14M5 18h14',
    trade: 'M12 5v14M5 12h14',
    dollar: 'M12 4v16M16 7.5c0-1.7-1.8-3-4-3s-4 1.3-4 3 1.4 2.5 4 3 4 1.3 4 3-1.8 3-4 3-4-1.3-4-3',
    chart: 'M5 16l4-4 3 2 6-7',
    calendar: 'M7 4v4M17 4v4M5 9h14M5 6h14a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z',
    spark: 'M12 3l2.6 5.3L20 9l-4 3.9.9 5.6L12 16l-4.9 2.5.9-5.6L4 9l5.4-.7z',
  }

  return (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={icons[name] || icons.spark} />
    </svg>
  )
}

function App() {
  const appName = import.meta.env.VITE_APP_NAME || 'TradeReveal'
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'
  const [view, setView] = useState('landing')
  const [tradeForm, setTradeForm] = useState(initialTradeForm)
  const [saveState, setSaveState] = useState({ type: '', message: '' })
  const [isSaving, setIsSaving] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [importState, setImportState] = useState({ message: '', fileType: '', rows: [] })
  const [isImportSaving, setIsImportSaving] = useState(false)
  const [dashboardState, setDashboardState] = useState({
    loading: false,
    error: '',
    data: emptyDashboard,
  })
  const [ordersState, setOrdersState] = useState({
    loading: false,
    error: '',
    trades: [],
  })
  const [selectedMonth, setSelectedMonth] = useState('')

  const pnlPreview = useMemo(() => {
    const entry = Number(tradeForm.entryPrice)
    const exit = Number(tradeForm.exitPrice)
    const lots = Number(tradeForm.lots || 0)

    if (!entry || !exit || !lots) {
      return null
    }

    const sign = tradeForm.direction === 'long' ? 1 : -1
    return ((exit - entry) * sign * lots).toFixed(2)
  }, [tradeForm])

  const features = [
    {
      title: 'Import multi-trade',
      description: 'Carica file broker e precompila i trade da un export gia esistente.',
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

  useEffect(() => {
    if (view !== 'dashboard') {
      return
    }

    let active = true

    async function loadDashboard() {
      setDashboardState((prev) => ({ ...prev, loading: true, error: '' }))

      try {
        const response = await fetch(`${apiBaseUrl}/dashboard`, {
          headers: { Accept: 'application/json' },
        })
        const data = await response.json().catch(() => ({}))

        if (!response.ok) {
          throw new Error(data.message || 'Caricamento dashboard fallito.')
        }

        if (!active) {
          return
        }

        setDashboardState({
          loading: false,
          error: '',
          data: {
            summary: data.summary || emptyDashboard.summary,
            monthly_performance: data.monthly_performance || [],
            daily_performance: data.daily_performance || [],
            weekday_stats: data.weekday_stats || [],
            recent_trades: data.recent_trades || [],
          },
        })

        const latestMonth = data.monthly_performance?.[data.monthly_performance.length - 1]?.month || ''
        setSelectedMonth((prev) => prev || latestMonth)
      } catch (error) {
        if (!active) {
          return
        }

        setDashboardState((prev) => ({
          ...prev,
          loading: false,
          error: error.message || 'Errore inatteso nel caricamento dashboard.',
        }))
      }
    }

    loadDashboard()

    return () => {
      active = false
    }
  }, [view, apiBaseUrl])

  useEffect(() => {
    if (view !== 'orders') {
      return
    }

    let active = true

    async function loadOrders() {
      setOrdersState((prev) => ({ ...prev, loading: true, error: '' }))

      try {
        const response = await fetch(`${apiBaseUrl}/trades`, {
          headers: { Accept: 'application/json' },
        })
        const data = await response.json().catch(() => ({}))

        if (!response.ok) {
          throw new Error(data.message || 'Caricamento orders fallito.')
        }

        if (!active) {
          return
        }

        setOrdersState({
          loading: false,
          error: '',
          trades: data.trades || [],
        })
      } catch (error) {
        if (!active) {
          return
        }

        setOrdersState({
          loading: false,
          error: error.message || 'Errore inatteso nel caricamento ordini.',
          trades: [],
        })
      }
    }

    loadOrders()

    return () => {
      active = false
    }
  }, [view, apiBaseUrl])

  function formatCurrency(value) {
    const amount = Number(value || 0)
    return new Intl.NumberFormat('it-IT', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  }

  function valueClass(value) {
    return Number(value) >= 0 ? 'positive' : 'negative'
  }

  function isQuarterTick(value) {
    if (value === '' || value === null || value === undefined) {
      return true
    }

    return Math.round(Number(value) * 100) % 25 === 0
  }

  function firstInvalidQuarterTick(form) {
    const fields = [
      { key: 'entryPrice', label: 'Prezzo entrata' },
      { key: 'exitPrice', label: 'Prezzo uscita' },
      { key: 'stopLoss', label: 'Stop loss' },
    ]

    return fields.find((field) => !isQuarterTick(form[field.key]))
  }

  function updateField(field, value) {
    setTradeForm((prev) => ({ ...prev, [field]: value }))
  }

  function resetForm() {
    setTradeForm(initialTradeForm)
  }

  async function refreshDashboardIfOpen() {
    if (view !== 'dashboard' && view !== 'orders') {
      return
    }

    setView((prev) => prev)
  }

  async function submitSingleTrade(event) {
    event.preventDefault()
    setIsSaving(true)
    setSaveState({ type: '', message: '' })

    try {
      const invalidField = firstInvalidQuarterTick(tradeForm)
      if (invalidField) {
        throw new Error(`${invalidField.label} deve rispettare tick da 0.25.`)
      }

      const resultAmount = pnlPreview !== null ? Number(pnlPreview) : null
      const payload = {
        broker_position_id: tradeForm.brokerPositionId || null,
        contract_name: tradeForm.contractName,
        trade_date: tradeForm.tradeDate,
        time_it: tradeForm.timeIt || null,
        time_ny: tradeForm.timeNy || null,
        lots: tradeForm.lots,
        direction: tradeForm.direction,
        setup_name: tradeForm.setupName || null,
        entry_price: tradeForm.entryPrice || null,
        exit_price: tradeForm.exitPrice || null,
        stop_loss: tradeForm.stopLoss || null,
        risk_amount: tradeForm.riskAmount || null,
        notes: tradeForm.notes || null,
        account: tradeForm.account || null,
        red_news: tradeForm.redNews,
        result_amount: tradeForm.resultAmount || resultAmount,
      }

      const response = await fetch(`${apiBaseUrl}/trades`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        if (data.errors) {
          const firstFieldError = Object.values(data.errors)[0]?.[0]
          throw new Error(firstFieldError || 'Errore di validazione.')
        }

        throw new Error(data.message || 'Salvataggio fallito.')
      }

      setSaveState({
        type: 'success',
        message: `Trade salvato correttamente${data.id ? ` (#${data.id})` : ''}.`,
      })
      resetForm()
      refreshDashboardIfOpen()
    } catch (error) {
      setSaveState({
        type: 'error',
        message: error.message || 'Errore inatteso durante il salvataggio.',
      })
    } finally {
      setIsSaving(false)
    }
  }

  function handleImportSelection(event) {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    const reader = new FileReader()

    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : ''
      const parsed = parseBrokerImport(text)
      setImportState(parsed)
    }

    reader.readAsText(file)
  }

  function applyImportedRow(row) {
    setTradeForm({
      brokerPositionId: row.brokerPositionId || '',
      contractName: row.contractName || '',
      tradeDate: row.tradeDate || '',
      timeIt: row.timeIt || '',
      timeNy: row.timeNy || '',
      lots: row.lots || '',
      direction: row.direction || 'long',
      setupName: row.setupName || '',
      entryPrice: row.entryPrice || '',
      exitPrice: row.exitPrice || '',
      stopLoss: row.stopLoss || '',
      riskAmount: row.riskAmount || '',
      notes: row.notes || '',
      account: row.account || '',
      redNews: row.redNews || false,
      resultAmount: row.resultAmount ?? '',
    })
    setSaveState({
      type: 'info',
      message: `Form precompilato da ${row.sourceLabel || 'import broker'}.`,
    })
  }

  async function saveImportedTrades() {
    if (!importState.rows.length) {
      return
    }

    setIsImportSaving(true)
    setSaveState({ type: '', message: '' })

    try {
      const trades = importState.rows.map((row) => ({
        broker_position_id: row.brokerPositionId || null,
        contract_name: row.contractName,
        trade_date: row.tradeDate,
        time_it: row.timeIt || null,
        time_ny: row.timeNy || null,
        lots: row.lots,
        direction: row.direction,
        setup_name: row.setupName || null,
        entry_price: row.entryPrice || null,
        exit_price: row.exitPrice || null,
        stop_loss: row.stopLoss || null,
        risk_amount: row.riskAmount || null,
        notes: row.notes || null,
        account: row.account || null,
        red_news: row.redNews,
        result_amount: row.resultAmount ?? null,
      }))

      const response = await fetch(`${apiBaseUrl}/trades/import`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ trades }),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.message || 'Import massivo fallito.')
      }

      setSaveState({
        type: 'success',
        message: `Import salvato: ${data.count || importState.rows.length} trade inseriti${data.skipped ? `, ${data.skipped} gia presenti` : ''}.`,
      })
      setImportState({ message: '', fileType: '', rows: [] })
      setShowImport(false)
      refreshDashboardIfOpen()
    } catch (error) {
      setSaveState({
        type: 'error',
        message: error.message || 'Errore inatteso durante l’import massivo.',
      })
    } finally {
      setIsImportSaving(false)
    }
  }

  const navItems = [
    { id: 'dashboard', label: 'Home', icon: 'home' },
    { id: 'orders', label: 'Orders', icon: 'orders' },
    { id: 'trade', label: 'Insert Trade', icon: 'trade' },
  ]

  function renderSidebar() {
    return (
      <aside className="workspace-sidebar">
        <div className="workspace-brand">
          <span className="workspace-brand-mark">TR</span>
          <div>
            <strong>{appName}</strong>
            <small>Personal journal</small>
          </div>
        </div>
        <nav className="workspace-nav">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`workspace-nav-item ${view === item.id ? 'workspace-nav-item-active' : ''}`}
              onClick={() => setView(item.id)}
            >
              <Icon name={item.icon} />
              {item.label}
            </button>
          ))}
        </nav>
      </aside>
    )
  }

  if (view === 'dashboard') {
    const {
      summary,
      monthly_performance: monthlyPerformance,
      daily_performance: dailyPerformance,
      weekday_stats: weekdayStats,
      recent_trades: recentTrades,
    } = dashboardState.data
    const maxAbsPnl = Math.max(...monthlyPerformance.map((item) => Math.abs(Number(item.net_pnl || 0))), 1)
    const calendarDays = buildCalendarDays(selectedMonth, dailyPerformance)

    return (
      <main className="workspace-shell">
        {renderSidebar()}
        <section className="workspace-main">
          <header className="dashboard-header">
            <div>
              <p className="eyebrow">Dashboard</p>
              <h1>Panoramica trading</h1>
              <p className="lead">Vista rapida su andamento, ritmo operativo e ultimi trade salvati.</p>
            </div>
            <div className="dashboard-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setView('landing')}>
                Torna alla home
              </button>
              <button type="button" className="btn btn-primary" onClick={() => setView('trade')}>
                Inserisci trade
              </button>
            </div>
          </header>

          {dashboardState.error ? <div className="notice notice-error">{dashboardState.error}</div> : null}

          <section className="dashboard-grid dashboard-grid-compact">
            <article className="dashboard-kpi"><div className="kpi-head"><Icon name="spark" /><span>Trade totali</span></div><strong>{summary.total_trades}</strong></article>
            <article className="dashboard-kpi"><div className="kpi-head"><Icon name="orders" /><span>Contratti</span></div><strong>{summary.total_contracts}</strong></article>
            <article className="dashboard-kpi"><div className="kpi-head"><Icon name="dollar" /><span>Gross</span></div><strong className={valueClass(summary.gross_pnl)}>{formatCurrency(summary.gross_pnl)}</strong></article>
            <article className="dashboard-kpi"><div className="kpi-head"><Icon name="dollar" /><span>Fee</span></div><strong className="negative">{formatCurrency(-Math.abs(summary.total_fees))}</strong></article>
            <article className="dashboard-kpi"><div className="kpi-head"><Icon name="chart" /><span>Net</span></div><strong className={valueClass(summary.net_pnl)}>{formatCurrency(summary.net_pnl)}</strong></article>
            <article className="dashboard-kpi"><div className="kpi-head"><Icon name="spark" /><span>Win rate</span></div><strong>{summary.win_rate}%</strong></article>
            <article className="dashboard-kpi"><div className="kpi-head"><Icon name="chart" /><span>Profit factor</span></div><strong>{summary.profit_factor}</strong></article>
            <article className="dashboard-kpi"><div className="kpi-head"><Icon name="dollar" /><span>Expectancy</span></div><strong className={valueClass(summary.expectancy)}>{formatCurrency(summary.expectancy)}</strong></article>
            <article className="dashboard-kpi"><div className="kpi-head"><Icon name="calendar" /><span>Net mese</span></div><strong className={valueClass(summary.current_month_net_pnl)}>{formatCurrency(summary.current_month_net_pnl)}</strong></article>
            <article className="dashboard-kpi"><div className="kpi-head"><Icon name="spark" /><span>Avg win</span></div><strong className="positive">{formatCurrency(summary.avg_winning_trade)}</strong></article>
          </section>

          <section className="dashboard-layout dashboard-layout-balanced">
            <article className="panel">
              <div className="panel-head">
                <div>
                  <p className="panel-kicker">Calendar</p>
                  <h2>Vista mensile</h2>
                </div>
                <select className="month-select" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
                  {monthlyPerformance.map((item) => (
                    <option key={item.month} value={item.month}>
                      {monthLabel(item.month)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="calendar-head">
                <span>Lun</span><span>Mar</span><span>Mer</span><span>Gio</span><span>Ven</span><span>Sab</span><span>Dom</span>
              </div>
              <div className="calendar-grid">
                {calendarDays.map((cell, index) =>
                  cell ? (
                    <div className={`calendar-cell ${cell.data ? valueClass(cell.data.net_pnl) : ''}`} key={cell.dateKey}>
                      <em>{cell.day}</em>
                      {cell.data ? (
                        <>
                          <strong>{formatCurrency(cell.data.net_pnl)}</strong>
                          <span>{cell.data.trades} trade</span>
                        </>
                      ) : (
                        <span className="muted">-</span>
                      )}
                    </div>
                  ) : (
                    <div className="calendar-cell calendar-cell-empty" key={`empty-${index}`} />
                  ),
                )}
              </div>
            </article>

            <article className="panel">
              <div className="panel-head">
                <div>
                  <p className="panel-kicker">Statistiche</p>
                  <h2>Overview tecnica</h2>
                </div>
                <span className="muted">Win {summary.wins} / Loss {summary.losses}</span>
              </div>
              <div className="stats-stack">
                <div className="stats-line"><span>Total winnings</span><strong className="positive">{formatCurrency(summary.total_winnings)}</strong></div>
                <div className="stats-line"><span>Total losses</span><strong className="negative">{formatCurrency(summary.total_losses)}</strong></div>
                <div className="stats-line"><span>Avg net trade</span><strong className={valueClass(summary.avg_net_pnl)}>{formatCurrency(summary.avg_net_pnl)}</strong></div>
                <div className="stats-line"><span>Profit factor / Expectancy</span><strong>{summary.profit_factor} / {formatCurrency(summary.expectancy)}</strong></div>
                <div className="stats-line"><span>Avg losing trade</span><strong className="negative">{formatCurrency(summary.avg_losing_trade)}</strong></div>
                <div className="stats-line"><span>Mese corrente gross / fees</span><strong>{formatCurrency(summary.current_month_gross_pnl)} / {formatCurrency(-Math.abs(summary.current_month_fees))}</strong></div>
              </div>
              <div className="weekday-grid">
                {weekdayStats.length ? (
                  weekdayStats.map((item) => (
                    <div className="weekday-card" key={item.weekday_index}>
                      <strong>{item.label}</strong>
                      <span>{item.trades} trade</span>
                      <b className={valueClass(item.net_pnl)}>{formatCurrency(item.net_pnl)}</b>
                    </div>
                  ))
                ) : (
                  <p className="muted">Nessun dato disponibile.</p>
                )}
              </div>
            </article>
          </section>

          <section className="panel dashboard-table-panel">
          <div className="panel-head">
            <div>
              <p className="panel-kicker">Monthly breakdown</p>
              <h2>Vista per mese</h2>
            </div>
            <span className="muted">Gross, fee, net e conteggi</span>
          </div>
          <div className="month-table">
            <div className="month-head">
              <span>Mese</span>
              <span>Trade</span>
              <span>Contratti</span>
              <span>Gross</span>
              <span>Fee</span>
              <span>Net</span>
            </div>
            {monthlyPerformance.length ? (
              monthlyPerformance.map((item) => (
                <div className="month-row" key={item.month}>
                  <span>{item.month}</span>
                  <span>{item.trades}</span>
                  <span>{item.total_contracts}</span>
                  <span className={valueClass(item.gross_pnl)}>{formatCurrency(item.gross_pnl)}</span>
                  <span className="negative">{formatCurrency(-Math.abs(item.fees))}</span>
                  <span className={valueClass(item.net_pnl)}>{formatCurrency(item.net_pnl)}</span>
                </div>
              ))
            ) : (
              <p className="muted">Ancora nessun mese disponibile.</p>
            )}
          </div>
          </section>

          <section className="panel dashboard-table-panel">
          <div className="panel-head">
            <div>
              <p className="panel-kicker">Ultimi trade</p>
              <h2>Storico recente</h2>
            </div>
            <span className="muted">Gross / fee / net</span>
          </div>
          <div className="recent-table">
            <div className="recent-head recent-head-wide">
              <span>Data</span>
              <span>Contratto</span>
              <span>Dir</span>
              <span>Gross</span>
              <span>Fee</span>
              <span>Net</span>
            </div>
            {recentTrades.length ? (
              recentTrades.map((trade) => (
                <div className="recent-row recent-row-wide" key={trade.id}>
                  <span>{trade.trade_date}</span>
                  <span>{trade.contract_name}</span>
                  <span>{trade.direction}</span>
                  <span className={valueClass(trade.gross_pnl)}>{formatCurrency(trade.gross_pnl)}</span>
                  <span className="negative">{formatCurrency(-Math.abs(trade.fees))}</span>
                  <span className={valueClass(trade.net_pnl)}>{formatCurrency(trade.net_pnl)}</span>
                </div>
              ))
            ) : (
              <p className="muted">Ancora nessun trade nello storico.</p>
            )}
          </div>
          </section>
        </section>
      </main>
    )
  }

  if (view === 'orders') {
    return (
      <main className="workspace-shell">
        {renderSidebar()}
        <section className="workspace-main">
          <header className="dashboard-header">
            <div>
              <p className="eyebrow">Orders</p>
              <h1>Trade log</h1>
              <p className="lead">Lista completa dei trade con metriche principali e dettagli operativi.</p>
            </div>
            <div className="dashboard-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setView('dashboard')}>
                Vai alla dashboard
              </button>
              <button type="button" className="btn btn-primary" onClick={() => setView('trade')}>
                Inserisci trade
              </button>
            </div>
          </header>

          {ordersState.error ? <div className="notice notice-error">{ordersState.error}</div> : null}

          <section className="orders-list">
            {ordersState.trades.map((trade) => (
              <article className="order-card" key={trade.id}>
                <div className="order-card-main">
                  <strong>{trade.contract_name}</strong>
                  <span>{trade.trade_date} · IT {trade.time_it || '-'} · NY {trade.time_ny || '-'}</span>
                  <span>{trade.direction} · {trade.lots} lots · {trade.account || 'No account'}</span>
                </div>
                <div className="order-card-metrics">
                  <span>Entry {trade.entry_price ?? '-'}</span>
                  <span>Exit {trade.exit_price ?? '-'}</span>
                  <span>Gross <b className={valueClass(trade.gross_pnl)}>{formatCurrency(trade.gross_pnl)}</b></span>
                  <span>Fee <b className="negative">{formatCurrency(-Math.abs(trade.fees))}</b></span>
                  <span>Net <b className={valueClass(trade.net_pnl)}>{formatCurrency(trade.net_pnl)}</b></span>
                </div>
                <div className="order-card-notes">
                  <span>Setup: {trade.setup_name || '-'}</span>
                  <span>Risk: {trade.risk_amount ?? '-'}</span>
                  <span>Stop: {trade.stop_loss ?? '-'}</span>
                  <span>Red news: {trade.red_news ? 'Yes' : 'No'}</span>
                  <span>Broker ID: {trade.broker_position_id || '-'}</span>
                  <p>{trade.notes || 'Nessuna nota'}</p>
                </div>
              </article>
            ))}
            {!ordersState.loading && !ordersState.trades.length ? <p className="muted">Nessun trade disponibile.</p> : null}
          </section>
        </section>
      </main>
    )
  }

  if (view === 'trade') {
    return (
      <main className="workspace-shell">
        {renderSidebar()}
        <section className="workspace-main trade-page">
          <header className="trade-header">
            <div>
              <p className="eyebrow">Inserimento Trade</p>
              <h1>Nuovo trade</h1>
              <p className="lead">Compila il trade singolo. L’import da broker precompila il form dai file utili.</p>
            </div>
            <div className="dashboard-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setView('landing')}>
                Torna alla home
              </button>
              <button type="button" className="btn btn-primary" onClick={() => setView('dashboard')}>
                Vai alla dashboard
              </button>
            </div>
          </header>

          <section className="panel">
          <form className="trade-form" onSubmit={submitSingleTrade}>
            <label>
              Broker position ID
              <input value={tradeForm.brokerPositionId} onChange={(e) => updateField('brokerPositionId', e.target.value)} />
            </label>
            <label>
              Contratto
              <input required value={tradeForm.contractName} onChange={(e) => updateField('contractName', e.target.value)} />
            </label>
            <label>
              Data
              <input required type="date" value={tradeForm.tradeDate} onChange={(e) => updateField('tradeDate', e.target.value)} />
            </label>
            <label>
              Ora IT
              <input type="time" value={tradeForm.timeIt} onChange={(e) => updateField('timeIt', e.target.value)} />
            </label>
            <label>
              Ora NY
              <input type="time" value={tradeForm.timeNy} onChange={(e) => updateField('timeNy', e.target.value)} />
            </label>
            <label>
              Lotti
              <input required type="number" step="0.01" value={tradeForm.lots} onChange={(e) => updateField('lots', e.target.value)} />
            </label>
            <label>
              Direzione
              <select value={tradeForm.direction} onChange={(e) => updateField('direction', e.target.value)}>
                <option value="long">Long</option>
                <option value="short">Short</option>
              </select>
            </label>
            <label>
              Setup
              <input value={tradeForm.setupName} onChange={(e) => updateField('setupName', e.target.value)} />
            </label>
            <label>
              Prezzo entrata
              <input type="number" step="0.25" value={tradeForm.entryPrice} onChange={(e) => updateField('entryPrice', e.target.value)} />
            </label>
            <label>
              Prezzo uscita
              <input type="number" step="0.25" value={tradeForm.exitPrice} onChange={(e) => updateField('exitPrice', e.target.value)} />
            </label>
            <label>
              Stop loss
              <input type="number" step="0.25" value={tradeForm.stopLoss} onChange={(e) => updateField('stopLoss', e.target.value)} />
            </label>
            <label>
              Rischio
              <input type="number" step="0.01" value={tradeForm.riskAmount} onChange={(e) => updateField('riskAmount', e.target.value)} />
            </label>
            <label>
              Account
              <input value={tradeForm.account} onChange={(e) => updateField('account', e.target.value)} />
            </label>

            <label className="trade-form-span">
              Note
              <textarea rows="4" value={tradeForm.notes} onChange={(e) => updateField('notes', e.target.value)} />
            </label>

            <label className="check">
              <input type="checkbox" checked={tradeForm.redNews} onChange={(e) => updateField('redNews', e.target.checked)} />
              Red news
            </label>

            <div className="trade-form-span actions">
              <button type="submit" className="btn btn-primary" disabled={isSaving}>
                {isSaving ? 'Salvataggio...' : 'Salva trade'}
              </button>
              <button type="button" className="btn btn-ghost" onClick={resetForm}>
                Pulisci form
              </button>
              <p>{pnlPreview !== null ? `Anteprima risultato: ${pnlPreview}` : 'Inserisci entrata, uscita e lotti per preview.'}</p>
            </div>

            {saveState.message ? (
              <div className={`notice notice-${saveState.type || 'info'} trade-form-span`}>
                {saveState.message}
              </div>
            ) : null}
          </form>
          </section>

          <section className="import-strip">
          <p>Hai piu trade? Usa l’import da broker per precompilare il form dai file export.</p>
          <button type="button" className="btn btn-ghost" onClick={() => setShowImport((prev) => !prev)}>
            {showImport ? 'Chiudi import' : 'Apri import'}
          </button>
          </section>

          {showImport ? (
            <section className="panel import-panel">
            <div className="import-panel-head">
              <div>
                <p className="panel-kicker">Import broker</p>
                <h2>Preview da CSV</h2>
              </div>
              <div className="import-panel-actions">
                <label className="btn btn-ghost import-upload">
                  Seleziona CSV
                  <input type="file" accept=".csv,text/csv" onChange={handleImportSelection} />
                </label>
                <button type="button" className="btn btn-primary" onClick={saveImportedTrades} disabled={isImportSaving || !importState.rows.length}>
                  {isImportSaving ? 'Salvataggio...' : 'Salva tutti'}
                </button>
              </div>
            </div>

            {importState.message ? (
              <div className={`notice notice-${importState.rows.length ? 'info' : 'warning'}`}>{importState.message}</div>
            ) : null}

            {importState.rows.length ? (
              <div className="import-list">
                <div className="import-summary">
                  <strong>{importState.rows.length} trade rilevati</strong>
                  <span>Position History viene aggregato per Position ID, cosi i partial della stessa posizione restano un solo trade logico.</span>
                </div>
                {importState.rows.map((row) => (
                  <article className="import-card" key={`${row.sourceLabel}-${row.tradeDate}-${row.timeIt}`}>
                    <div>
                      <strong>{row.contractName}</strong>
                      <p>{row.tradeDate} · {row.direction} · qty {row.lots}</p>
                    </div>
                    <div className="import-meta">
                      <span>IT {row.timeIt || '-'}</span>
                      <span>NY {row.timeNy || '-'}</span>
                      <span>P/L {row.resultAmount ?? '-'}</span>
                    </div>
                    <button type="button" className="btn btn-primary" onClick={() => applyImportedRow(row)}>
                      Carica nel form
                    </button>
                  </article>
                ))}
              </div>
            ) : null}
            </section>
          ) : null}
        </section>
      </main>
    )
  }

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
          Workspace personale per importare trade in batch, salvare operazioni singole e costruire una cronologia reale delle tue performance.
        </p>
        <div className="cta-row reveal reveal-3">
          <button type="button" className="btn btn-primary" onClick={() => setView('dashboard')}>
            Vai alla dashboard
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setView('trade')}>
            Inserisci trade
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
            <li>Importare export broker senza ricopiare tutto a mano.</li>
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
