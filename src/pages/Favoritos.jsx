import { useState, useEffect } from "react"
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, ReferenceLine, Tooltip } from "recharts"
import api from "../services/api"

const API = import.meta.env.VITE_API_URL

const fmt = (valor) => (Number(valor) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const moeda = (mercado) => (mercado === "B3" ? "R$" : "US$")

// Cor e rótulo do selo do checklist essencial
const SELO_INFO = {
  VERDE:    { cor: "#22D3A0", bg: "rgba(34,211,160,0.10)",  borda: "rgba(34,211,160,0.35)", label: "No ponto" },
  AMARELO:  { cor: "#FBBF24", bg: "rgba(251,191,36,0.10)",  borda: "rgba(251,191,36,0.35)", label: "Aguardando" },
  VERMELHO: { cor: "#FB6474", bg: "rgba(251,100,116,0.10)", borda: "rgba(251,100,116,0.35)", label: "Desarmado" },
}

export default function Favoritos() {
  const [favoritos, setFavoritos] = useState([])   // [{ticker, nome, mercado, nota_pessoal, ...indicadores}]
  const [carregando, setCarregando] = useState(true)
  const [atualizando, setAtualizando] = useState(false)
  const [atualizandoUm, setAtualizandoUm] = useState(null)  // ticker em atualização individual
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState(null)

  // Form de adicionar
  const [novoTicker, setNovoTicker] = useState("")
  const [novoMercado, setNovoMercado] = useState("B3")
  const [novaNota, setNovaNota] = useState("")

  // Modal de histórico de preços
  const [modalHist, setModalHist] = useState(null)          // {ticker, mercado, media_6m}
  const [dadosHist, setDadosHist] = useState([])
  const [carregandoHist, setCarregandoHist] = useState(false)
  const [histPeriodo, setHistPeriodo] = useState("30d")

  // Mini-form "+ Portfólio"
  const [insiders, setInsiders] = useState({})  // { "PETR4": {sinal, tooltip, ...} } — insiders 👔 (27/10/2026)
  const [saude, setSaude] = useState({})  // { "DIRR3": {selo, tooltip, ...} } — selo de saúde financeira (23/10/2026)
  const [formPortfolio, setFormPortfolio] = useState(null)  // {ticker, nome, mercado, preco, alvo, stop, quantidade}

  // ── Carrega a lista de favoritos (sem indicadores ainda) ──
  const carregarFavoritos = async () => {
    try {
      const res = await api.get(`${API}/favoritos`)
      if (res.data.sucesso) {
        setFavoritos(res.data.dados || [])
        // Selo de saúde financeira (23/10/2026) — só B3; carrega depois, não atrasa a lista
        const b3 = (res.data.dados || []).filter(f => f.mercado === "B3").map(f => f.ticker)
        if (b3.length) {
          api.post(`${API}/fundamentos/saude`, { tickers: b3 })
            .then(p => { if (p.data.sucesso) setSaude(p.data.dados || {}) })
            .catch(() => {})
          api.post(`${API}/insiders`, { tickers: b3 })
            .then(p => { if (p.data.sucesso) setInsiders(p.data.dados || {}) })
            .catch(() => {})
        }
      }
    } catch {
      console.error("Erro ao carregar favoritos")
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregarFavoritos()
  }, [])

  // ── Atualizar TODOS (recalcula indicadores ao vivo) ──
  const atualizarTodos = async () => {
    if (favoritos.length === 0) return
    setAtualizando(true)
    try {
      const res = await api.post(`${API}/favoritos/analisar`)
      if (res.data.sucesso) {
        setFavoritos(res.data.dados || [])
        setUltimaAtualizacao(new Date().toLocaleTimeString("pt-BR"))
      }
    } catch {
      alert("Erro ao atualizar favoritos.")
    } finally {
      setAtualizando(false)
    }
  }

  // ── Atualizar UM ativo só ──
  const atualizarUm = async (ticker) => {
    setAtualizandoUm(ticker)
    try {
      const res = await api.post(`${API}/favoritos/${ticker}/analisar`)
      if (res.data.sucesso && res.data.dados) {
        setFavoritos(prev => prev.map(f => f.ticker === ticker ? { ...f, ...res.data.dados } : f))
        setUltimaAtualizacao(new Date().toLocaleTimeString("pt-BR"))
      }
    } catch {
      alert("Erro ao atualizar ativo.")
    } finally {
      setAtualizandoUm(null)
    }
  }

  // ── Adicionar favorito ──
  const adicionar = async () => {
    const ticker = novoTicker.trim().toUpperCase()
    if (!ticker) return
    try {
      const res = await api.post(`${API}/favoritos`, {
        ticker,
        mercado: novoMercado,
        nota_pessoal: novaNota.trim() || null,
      })
      if (res.data.sucesso) {
        setNovoTicker("")
        setNovaNota("")
        await carregarFavoritos()
      } else {
        alert(res.data.erro || "Erro ao adicionar.")
      }
    } catch {
      alert("Erro ao adicionar favorito.")
    }
  }

  // ── Remover favorito ──
  const remover = async (ticker) => {
    if (!window.confirm(`Remover ${ticker} dos favoritos?`)) return
    try {
      await api.delete(`${API}/favoritos/${ticker}`)
      setFavoritos(prev => prev.filter(f => f.ticker !== ticker))
    } catch {
      alert("Erro ao remover favorito.")
    }
  }

  // ── Abrir modal de histórico ──
  const abrirHistorico = async (fav, periodo = "30d") => {
    setModalHist(fav)
    setHistPeriodo(periodo)
    setCarregandoHist(true)
    setDadosHist([])
    try {
      const res = await api.get(`${API}/portfolio/historico/${fav.ticker}`, {
        params: { data_inicio: new Date().toISOString().slice(0, 10), periodo }
      })
      if (res.data.sucesso) setDadosHist(res.data.dados || [])
    } catch {
      console.error("Erro ao carregar histórico")
    } finally {
      setCarregandoHist(false)
    }
  }

  const trocarPeriodoHist = async (novoPeriodo) => {
    if (!modalHist) return
    await abrirHistorico(modalHist, novoPeriodo)
  }

  // ── Abrir mini-form "+ Portfólio" com alvo/stop sugeridos ──
  const abrirFormPortfolio = (fav) => {
    const preco = fav.preco_atual || 0
    // Sugestões a partir dos indicadores reais (editáveis):
    //   alvo  = média de 6 meses (onde a tese de reversão mira), com piso de +8%
    //   stop  = MMA200, ou -8% se a MMA200 não fizer sentido de stop
    let alvo = fav.media_6m && fav.media_6m > preco ? fav.media_6m : preco * 1.08
    let stop = fav.mma_200 && fav.mma_200 < preco ? fav.mma_200 : preco * 0.92
    setFormPortfolio({
      ticker: fav.ticker,
      nome: fav.nome || fav.ticker,
      mercado: fav.mercado || "B3",
      quantidade: "",
      preco: preco ? preco.toFixed(2) : "",
      alvo: alvo ? alvo.toFixed(2) : "",
      stop: stop ? stop.toFixed(2) : "",
    })
  }

  const confirmarPortfolio = async () => {
    const f = formPortfolio
    if (!f.quantidade || !f.preco) {
      alert("Preencha quantidade e preço.")
      return
    }
    try {
      const res = await api.post(`${API}/portfolio`, {
        ticker: f.ticker,
        nome: f.nome,
        mercado: f.mercado,
        quantidade: parseFloat(f.quantidade),
        preco_medio: parseFloat(f.preco),
        alvo_lucro: f.alvo ? parseFloat(f.alvo) : null,
        stop_loss: f.stop ? parseFloat(f.stop) : null,
        origem: "LONGO",
      })
      if (res.data.sucesso) {
        setFormPortfolio(null)
        alert(`${f.ticker} adicionado ao portfólio!`)
      } else {
        alert(res.data.erro || "Erro ao adicionar posição.")
      }
    } catch {
      alert("Erro ao adicionar posição.")
    }
  }

  const inputStyle = { padding: "10px", borderRadius: "10px", border: "1px solid #1E3352", background: "#0A1424", color: "#E6EDF7", fontSize: "13px" }
  const fiBotao = { height: "34px", padding: "0 16px", borderRadius: "999px", border: "1px solid var(--fi-borda-forte)", background: "rgba(56,189,248,0.08)", color: "var(--fi-texto)", fontSize: "12px", cursor: "pointer" }
  const icoBtn = (cor) => ({ width: "32px", height: "32px", borderRadius: "999px", border: "1px solid var(--fi-borda-forte)", background: "transparent", color: cor, cursor: "pointer", fontSize: "12px" })

  return (
    <div style={{ width: "100%" }}>

      {/* ── MODAL DE HISTÓRICO ── */}
      {modalHist && (
        <div onClick={() => setModalHist(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#0B1426", border: "1px solid #1E3352", borderRadius: "18px", boxShadow: "0 30px 80px rgba(0,0,0,0.6)", padding: "24px", maxWidth: "1000px", width: "95%", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <div style={{ fontSize: "17px", fontWeight: "bold", color: "#f1f5f9" }}>📈 Histórico — {modalHist.ticker}</div>
              <button onClick={() => setModalHist(null)} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: "16px" }}>✕</button>
            </div>
            {modalHist.media_6m && (
              <div style={{ fontSize: "13px", color: "#94a3b8", marginBottom: "12px" }}>
                Média de 6 meses: {moeda(modalHist.mercado)} {fmt(modalHist.media_6m)}
              </div>
            )}

            {/* Botões de período */}
            <div style={{ display: "flex", gap: "6px", marginBottom: "14px" }}>
              {[{ id: "30d", label: "30d" }, { id: "3m", label: "3m" }, { id: "6m", label: "6m" }, { id: "12m", label: "12m" }, { id: "2a", label: "2a" }, { id: "5a", label: "5a" }].map(per => (
                <button key={per.id} onClick={() => trocarPeriodoHist(per.id)} disabled={carregandoHist}
                  style={{ padding: "5px 14px", borderRadius: "20px", border: "none", cursor: carregandoHist ? "default" : "pointer", fontSize: "12px", fontWeight: histPeriodo === per.id ? "700" : "400", background: histPeriodo === per.id ? "#38bdf8" : "#1e293b", color: histPeriodo === per.id ? "#0f172a" : "#64748b" }}>
                  {per.label}
                </button>
              ))}
            </div>

            {carregandoHist ? (
              <div style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>Buscando histórico diário...</div>
            ) : dadosHist.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>Nenhum dado encontrado.</div>
            ) : (
              <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", flexShrink: 0 }}>
                <div style={{ height: "420px", flex: "1 1 60%", minWidth: "340px" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dadosHist} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="data" tick={{ fontSize: 11, fill: "#64748b" }} minTickGap={40} />
                      <YAxis tick={{ fontSize: 11, fill: "#64748b" }} domain={["auto", "auto"]} width={52} />
                      <Tooltip formatter={(value) => [`${moeda(modalHist.mercado)} ${fmt(value)}`, "Fechamento"]} />
                      {modalHist.media_6m && (
                        <ReferenceLine y={modalHist.media_6m} stroke="#a78bfa" strokeDasharray="5 4" strokeWidth={1.5}
                          label={{ value: `Média 6m ${fmt(modalHist.media_6m)}`, position: "right", fill: "#a78bfa", fontSize: 11 }} />
                      )}
                      <Line type="monotone" dataKey="fechamento" stroke="#38bdf8" strokeWidth={2.5} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ height: "420px", flex: "1 1 34%", minWidth: "260px", overflowY: "auto", border: "1px solid #1e293b", borderRadius: "10px" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
                    <thead>
                      <tr style={{ position: "sticky", top: 0, background: "#0d1829", zIndex: 1 }}>
                        <th style={{ padding: "10px 12px", textAlign: "left", color: "#64748b", borderBottom: "1px solid #1e293b" }}>DATA</th>
                        <th style={{ padding: "10px 12px", textAlign: "right", color: "#64748b", borderBottom: "1px solid #1e293b" }}>FECH.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dadosHist.map((dia, idx) => (
                        <tr key={idx} style={{ borderBottom: "1px solid #1e293b" }}>
                          <td style={{ padding: "9px 12px", color: "#94a3b8" }}>{dia.data}</td>
                          <td style={{ padding: "9px 12px", textAlign: "right", color: "#f1f5f9" }}>{moeda(modalHist.mercado)} {fmt(dia.fechamento)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <button onClick={() => setModalHist(null)} style={{ marginTop: "16px", padding: "12px", borderRadius: "8px", border: "1px solid #334155", background: "#1e293b", color: "#94a3b8", cursor: "pointer", fontWeight: "600", fontSize: "13px", flexShrink: 0 }}>Fechar</button>
          </div>
        </div>
      )}

      {/* ── MINI-FORM "+ PORTFÓLIO" ── */}
      {formPortfolio && (
        <div onClick={() => setFormPortfolio(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#0B1426", border: "1px solid #1E3352", borderRadius: "18px", boxShadow: "0 30px 80px rgba(0,0,0,0.6)", padding: "28px", maxWidth: "440px", width: "100%" }}>
            <div style={{ fontSize: "18px", fontWeight: "bold", color: "#f1f5f9", marginBottom: "6px" }}>➕ Adicionar {formPortfolio.ticker} ao Portfólio</div>
            <div style={{ fontSize: "12px", color: "#f59e0b", marginBottom: "18px" }}>Alvo e stop são sugestões (média 6m / MMA200). Confira e ajuste.</div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
              <div>
                <div style={{ fontSize: "12px", color: "#94a3b8", marginBottom: "5px" }}>Quantidade</div>
                <input type="number" value={formPortfolio.quantidade} onChange={e => setFormPortfolio({ ...formPortfolio, quantidade: e.target.value })} style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} />
              </div>
              <div>
                <div style={{ fontSize: "12px", color: "#94a3b8", marginBottom: "5px" }}>Preço de entrada</div>
                <input type="number" value={formPortfolio.preco} onChange={e => setFormPortfolio({ ...formPortfolio, preco: e.target.value })} style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} />
              </div>
              <div>
                <div style={{ fontSize: "12px", color: "#4ade80", marginBottom: "5px" }}>Alvo (sugerido)</div>
                <input type="number" value={formPortfolio.alvo} onChange={e => setFormPortfolio({ ...formPortfolio, alvo: e.target.value })} style={{ ...inputStyle, width: "100%", boxSizing: "border-box", borderColor: "#4ade80" }} />
              </div>
              <div>
                <div style={{ fontSize: "12px", color: "#f87171", marginBottom: "5px" }}>Stop (sugerido)</div>
                <input type="number" value={formPortfolio.stop} onChange={e => setFormPortfolio({ ...formPortfolio, stop: e.target.value })} style={{ ...inputStyle, width: "100%", boxSizing: "border-box", borderColor: "#f87171" }} />
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={confirmarPortfolio} style={{ flex: 1, padding: "12px 16px", borderRadius: "8px", border: "none", cursor: "pointer", background: "#16a34a", color: "white", fontSize: "13px", fontWeight: "700" }}>✅ Adicionar ao Portfólio</button>
              <button onClick={() => setFormPortfolio(null)} style={{ padding: "12px 16px", borderRadius: "8px", border: "1px solid #334155", cursor: "pointer", background: "#1e293b", color: "#94a3b8", fontSize: "13px" }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── CABEÇALHO (Future Intelligence, 10/11/2026) ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "18px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 className="fi-titulo" style={{ margin: 0, fontSize: "24px", fontWeight: 700 }}>Favoritos</h1>
          <div style={{ fontSize: "12px", color: "var(--fi-texto-4)", marginTop: "2px" }}>
            Ativos em observação · indicadores ao vivo (prévia do dia){ultimaAtualizacao && ` · atualizado às ${ultimaAtualizacao}`}
          </div>
        </div>
        {favoritos.length > 0 && (
          <button type="button" onClick={atualizarTodos} disabled={atualizando} style={{ ...fiBotao, cursor: atualizando ? "default" : "pointer" }}>
            {atualizando ? "Atualizando…" : "Atualizar todos"}
          </button>
        )}
      </div>

      {/* ── ADICIONAR ── */}
      <div className="fi-painel" style={{ display: "flex", gap: "8px", marginBottom: "18px", flexWrap: "wrap", padding: "14px 16px" }}>
        <input aria-label="Ticker" placeholder="Ticker (ex: VALE3.SA)" value={novoTicker} onChange={e => setNovoTicker(e.target.value)} onKeyDown={e => e.key === "Enter" && adicionar()} style={{ ...inputStyle, flex: 1, minWidth: "160px" }} />
        <select aria-label="Mercado" value={novoMercado} onChange={e => setNovoMercado(e.target.value)} style={inputStyle}>
          <option value="B3">B3</option>
          <option value="NASDAQ">NASDAQ</option>
          <option value="NYSE">NYSE</option>
        </select>
        <input aria-label="Nota" placeholder="Nota (opcional)" value={novaNota} onChange={e => setNovaNota(e.target.value)} onKeyDown={e => e.key === "Enter" && adicionar()} style={{ ...inputStyle, flex: 1, minWidth: "160px" }} />
        <button type="button" onClick={adicionar} style={{ ...fiBotao, height: "40px", background: "rgba(34,211,160,0.12)", borderColor: "rgba(34,211,160,0.45)", color: "#22D3A0", fontWeight: 600 }}>+ Adicionar</button>
      </div>

      {/* ── LISTA ── */}
      {carregando ? (
        <div style={{ textAlign: "center", padding: "40px", color: "var(--fi-texto-4)" }}>Carregando favoritos…</div>
      ) : favoritos.length === 0 ? (
        <div style={{ textAlign: "center", padding: "50px 20px", color: "var(--fi-texto-4)" }}>
          <div>Nenhum favorito ainda. Adicione um ticker acima.</div>
          <div style={{ fontSize: "12px", marginTop: "6px" }}>Depois clique em "Atualizar todos" para ver os indicadores ao vivo.</div>
        </div>
      ) : (
        <div className="fi-painel" style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", minWidth: "1000px" }}>
            <thead>
              <tr>
                {["Ativo", "Preço", "RSI", "Esticado", "MMA200", "Desconto 6m", "Selo", "Saúde", "ATR (21,3)", "Nota", ""].map(h => (
                  <th key={h || "acoes"} style={{ padding: "12px 10px", textAlign: "left", color: "#5F7391", fontSize: "10.5px", fontWeight: 500, textTransform: "uppercase", letterSpacing: "1.1px", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {favoritos.map((f) => {
                const selo = SELO_INFO[f.selo] || null
                const temInd = f.ok === true
                const tdS = { padding: "12px 10px", borderTop: "1px solid #101D31" }
                return (
                  <tr key={f.ticker}>
                    <td style={tdS}>
                      <div style={{ fontWeight: 600, fontSize: "14px" }}>{String(f.ticker).replace(".SA", "")}</div>
                      <div style={{ fontSize: "10.5px", color: "var(--fi-texto-4)" }}>{f.mercado}</div>
                    </td>
                    <td style={{ ...tdS, fontWeight: 600 }}>{temInd && f.preco_atual != null ? `${moeda(f.mercado)} ${fmt(f.preco_atual)}` : "—"}</td>
                    <td style={{ ...tdS, color: temInd && f.rsi != null && f.rsi < 46 ? "#22D3A0" : "var(--fi-texto-2)" }}>{temInd && f.rsi != null ? f.rsi.toFixed(1) : "—"}</td>
                    <td style={{ ...tdS, color: temInd && f.dist_mme20_pct != null && f.dist_mme20_pct <= 0 ? "#22D3A0" : "#FBBF24" }}>
                      {temInd && f.dist_mme20_pct != null ? `${f.dist_mme20_pct > 0 ? "+" : ""}${f.dist_mme20_pct.toFixed(2)}%` : "—"}
                    </td>
                    <td style={tdS}>
                      {temInd && f.acima_mma200 != null ? (
                        <span style={{ padding: "3px 9px", borderRadius: "999px", fontSize: "11px", fontWeight: 600, border: `1px solid ${f.acima_mma200 ? "rgba(251,100,116,0.35)" : "rgba(34,211,160,0.35)"}`,
                          background: f.acima_mma200 ? "rgba(251,100,116,0.10)" : "rgba(34,211,160,0.10)", color: f.acima_mma200 ? "#FB6474" : "#22D3A0" }}>
                          {f.acima_mma200 ? "Acima" : "Abaixo"}
                        </span>
                      ) : "—"}
                    </td>
                    <td style={{ ...tdS, fontWeight: 600, color: temInd && f.desconto_6m_pct != null && f.desconto_6m_pct <= -9 ? "#22D3A0" : "var(--fi-texto-2)" }}>
                      {temInd && f.desconto_6m_pct != null ? `${f.desconto_6m_pct > 0 ? "+" : ""}${f.desconto_6m_pct.toFixed(1)}%` : "—"}
                    </td>
                    <td style={tdS}>
                      {selo ? (
                        <span style={{ padding: "3px 10px", borderRadius: "999px", fontSize: "11px", fontWeight: 600, background: selo.bg, color: selo.cor, border: `1px solid ${selo.borda}`, whiteSpace: "nowrap",
                          boxShadow: f.selo === "VERDE" ? "0 0 12px rgba(34,211,160,0.3)" : "none" }}>{selo.label}</span>
                      ) : <span style={{ fontSize: "11px", color: "#5F7391" }}>sem dados</span>}
                    </td>
                    <td style={{ ...tdS, whiteSpace: "nowrap" }}>
                      {(() => {
                        const sd = saude[String(f.ticker || "").toUpperCase()]
                        const ins = insiders[String(f.ticker || "").toUpperCase()]
                        const corIns = ins?.sinal === "compra" ? "#22D3A0" : ins?.sinal === "venda" ? "#FB6474" : "#FBBF24"
                        const icoIns = ins?.sinal ? (
                          <span title={ins.tooltip} style={{ display: "block", marginTop: "3px", fontSize: "10px", fontWeight: 600, color: corIns, cursor: "help" }}>
                            👔 {ins.sinal === "compra" ? "compra" : ins.sinal === "venda" ? "venda" : "misto"}
                          </span>
                        ) : null
                        if (!sd) return <><span style={{ color: "#5F7391", fontSize: "12px" }}>—</span>{icoIns}</>
                        const cor = sd.selo === "🟢" ? "#22D3A0" : sd.selo === "🟡" ? "#FBBF24" : sd.selo === "🔴" ? "#FB6474" : "#5F7391"
                        const rot = sd.selo === "🟢" ? "OK" : sd.selo === "🟡" ? "Atenção" : sd.selo === "🔴" ? "Alerta" : "s/ dados"
                        const tri = sd.ultimo_trimestre ? `\nÚltimo balanço: ${sd.ultimo_trimestre.split("-").reverse().join("/")}` : ""
                        const fin = sd.financeira ? "\n(banco/seguradora: avaliado por lucro e ROE)" : ""
                        return (<><span title={`${sd.tooltip}${tri}${fin}`} style={{ cursor: "help", fontSize: "11px", fontWeight: 600, color: cor }}>{rot}</span>{icoIns}</>)
                      })()}
                    </td>
                    <td style={{ ...tdS, whiteSpace: "nowrap" }}>
                      {temInd && f.atr_cor ? (() => {
                        const verde = f.atr_cor === "VERDE"
                        const dist = verde ? f.atr_margem_pct : f.atr_falta_pct
                        const perto = dist != null && dist < 2
                        const desde = f.atr_desde ? f.atr_desde.split("-").reverse().slice(0, 2).join("/") : null
                        return (
                          <div title={`linha ${moeda(f.mercado)} ${fmt(f.atr_linha)}${desde ? ` · nessa cor desde ${desde}` : ""}`}>
                            <span style={{ padding: "3px 9px", borderRadius: "999px", fontSize: "11px", fontWeight: 600, border: `1px solid ${verde ? "rgba(34,211,160,0.35)" : "rgba(251,100,116,0.35)"}`,
                              background: verde ? "rgba(34,211,160,0.10)" : "rgba(251,100,116,0.10)", color: verde ? "#22D3A0" : "#FB6474" }}>
                              {verde ? "alta" : "queda"}{dist != null ? ` · ${verde ? "" : "falta "}${dist.toFixed(1).replace(".", ",")}%` : ""}
                            </span>
                            {perto && <div style={{ fontSize: "10.5px", color: "#FBBF24", marginTop: "4px" }}>confira na XP</div>}
                          </div>
                        )
                      })() : "—"}
                    </td>
                    <td style={{ ...tdS, color: "var(--fi-texto-3)", fontSize: "11.5px", maxWidth: "160px" }}>{f.nota_pessoal || ""}</td>
                    <td style={tdS}>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button type="button" onClick={() => atualizarUm(f.ticker)} disabled={atualizandoUm === f.ticker} title="Atualizar este ativo" aria-label={`Atualizar ${f.ticker}`} style={icoBtn("#38BDF8")}>{atualizandoUm === f.ticker ? "…" : "↻"}</button>
                        <button type="button" onClick={() => abrirHistorico(f)} title="Ver histórico" aria-label={`Histórico de ${f.ticker}`} style={icoBtn("#38BDF8")}>📈</button>
                        <button type="button" onClick={() => abrirFormPortfolio(f)} disabled={!temInd} title="Adicionar ao portfólio" aria-label={`Adicionar ${f.ticker} ao portfólio`} style={{ ...icoBtn(temInd ? "#22D3A0" : "#5F7391"), cursor: temInd ? "pointer" : "not-allowed" }}>+</button>
                        <button type="button" onClick={() => remover(f.ticker)} title="Remover" aria-label={`Remover ${f.ticker}`} style={icoBtn("#FB6474")}>✕</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ fontSize: "11px", color: "#5F7391", marginTop: "14px", lineHeight: 1.6 }}>
        Os indicadores são a prévia do candle de hoje — mudam conforme o preço do momento. Selo: No ponto = abaixo da MMA200, desconto ≤ −9%, RSI abaixo de 46 e esticado ≤ 0; Aguardando = tese existe, timing ainda não; Desarmado = acima da MMA200 ou sem desconto. Alvo/stop no "+ Portfólio" são sugestões editáveis. ATR = ATR Trailing Stop (21,3), a mesma linha da XP; a menos de 2% da linha, confira no gráfico. Saúde = fundamentos do último balanço (passe o mouse). 👔 = compras/vendas de controlador, conselho e diretoria nos últimos 3 meses.
      </div>
    </div>
  )
}