import { useState, useEffect } from "react"
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, ReferenceLine, Tooltip } from "recharts"
import api from "../services/api"

const API = import.meta.env.VITE_API_URL

const fmt = (valor) => (Number(valor) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const moeda = (mercado) => (mercado === "B3" ? "R$" : "US$")

// Cor e rótulo do selo do checklist essencial
const SELO_INFO = {
  VERDE:    { cor: "#4ade80", bg: "rgba(74,222,128,0.15)",  label: "🟢 No ponto" },
  AMARELO:  { cor: "#f59e0b", bg: "rgba(245,158,11,0.15)",  label: "🟡 Aguardando" },
  VERMELHO: { cor: "#f87171", bg: "rgba(248,113,113,0.15)", label: "🔴 Desarmado" },
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
  const [formPortfolio, setFormPortfolio] = useState(null)  // {ticker, nome, mercado, preco, alvo, stop, quantidade}

  // ── Carrega a lista de favoritos (sem indicadores ainda) ──
  const carregarFavoritos = async () => {
    try {
      const res = await api.get(`${API}/favoritos`)
      if (res.data.sucesso) {
        setFavoritos(res.data.dados || [])
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

  const inputStyle = { padding: "10px", borderRadius: "6px", border: "1px solid #334155", background: "#0f172a", color: "#f1f5f9", fontSize: "13px" }

  return (
    <div style={{ width: "100%" }}>

      {/* ── MODAL DE HISTÓRICO ── */}
      {modalHist && (
        <div onClick={() => setModalHist(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#0d1829", border: "1px solid #1e293b", borderRadius: "16px", padding: "24px", maxWidth: "1000px", width: "95%", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
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
              {[{ id: "30d", label: "30d" }, { id: "3m", label: "3m" }, { id: "6m", label: "6m" }].map(per => (
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
          <div onClick={e => e.stopPropagation()} style={{ background: "#0d1829", border: "1px solid #1e293b", borderRadius: "16px", padding: "28px", maxWidth: "440px", width: "100%" }}>
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

      {/* ── HEADER ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <div style={{ fontSize: "22px", fontWeight: "bold", color: "#f1f5f9" }}>⭐ Favoritos / Observação</div>
          <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>
            Indicadores recalculados ao vivo (prévia do dia). {ultimaAtualizacao && `Atualizado às ${ultimaAtualizacao}`}
          </div>
        </div>
        {favoritos.length > 0 && (
          <button onClick={atualizarTodos} disabled={atualizando} style={{ padding: "10px 18px", borderRadius: "8px", cursor: atualizando ? "default" : "pointer", background: "#1e293b", color: "#38bdf8", fontWeight: "bold", fontSize: "13px", border: "1px solid #334155" }}>
            {atualizando ? "Atualizando..." : "🔄 Atualizar Todos"}
          </button>
        )}
      </div>

      {/* ── ADICIONAR ── */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "20px", flexWrap: "wrap", padding: "16px", background: "#0d1829", borderRadius: "12px", border: "1px solid #1e293b" }}>
        <input placeholder="Ticker (ex: VALE3.SA)" value={novoTicker} onChange={e => setNovoTicker(e.target.value)} onKeyDown={e => e.key === "Enter" && adicionar()} style={{ ...inputStyle, flex: 1, minWidth: "160px" }} />
        <select value={novoMercado} onChange={e => setNovoMercado(e.target.value)} style={inputStyle}>
          <option value="B3">B3</option>
          <option value="NASDAQ">NASDAQ</option>
          <option value="NYSE">NYSE</option>
        </select>
        <input placeholder="Nota (opcional)" value={novaNota} onChange={e => setNovaNota(e.target.value)} onKeyDown={e => e.key === "Enter" && adicionar()} style={{ ...inputStyle, flex: 1, minWidth: "160px" }} />
        <button onClick={adicionar} style={{ padding: "10px 20px", borderRadius: "6px", border: "none", cursor: "pointer", background: "#16a34a", color: "white", fontWeight: "bold", fontSize: "13px" }}>+ Adicionar</button>
      </div>

      {/* ── TABELA ── */}
      {carregando ? (
        <div style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>Carregando favoritos...</div>
      ) : favoritos.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "#64748b" }}>
          <div style={{ fontSize: "40px", marginBottom: "12px" }}>⭐</div>
          <div>Nenhum favorito ainda. Adicione um ticker acima.</div>
          <div style={{ fontSize: "12px", marginTop: "6px" }}>Depois clique em "Atualizar Todos" para ver os indicadores ao vivo.</div>
        </div>
      ) : (
        <div style={{ overflowX: "auto", background: "#0d1829", borderRadius: "12px", border: "1px solid #1e293b" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", minWidth: "1000px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #1e293b" }}>
                {["Ticker", "Preço", "RSI", "Esticado", "MMA200", "Desconto 6m", "Selo", "Nota", "Ações"].map(h => (
                  <th key={h} style={{ padding: "12px 10px", textAlign: "left", color: "#64748b", fontSize: "11px", fontWeight: "600", textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {favoritos.map((f, i) => {
                const selo = SELO_INFO[f.selo] || null
                const temInd = f.ok === true
                return (
                  <tr key={f.ticker} style={{ borderBottom: "1px solid #1e293b", background: i % 2 === 0 ? "#0d1829" : "#0a1520" }}>
                    <td style={{ padding: "12px 10px" }}>
                      <div style={{ fontWeight: "700", color: "#38bdf8" }}>{f.ticker}</div>
                      <div style={{ fontSize: "10px", color: "#64748b" }}>{f.mercado}</div>
                    </td>
                    <td style={{ padding: "12px 10px", color: "#f1f5f9", fontWeight: "600" }}>
                      {temInd && f.preco_atual != null ? `${moeda(f.mercado)} ${fmt(f.preco_atual)}` : "—"}
                    </td>
                    <td style={{ padding: "12px 10px", color: temInd && f.rsi != null && f.rsi < 46 ? "#4ade80" : "#cbd5e1" }}>
                      {temInd && f.rsi != null ? f.rsi.toFixed(1) : "—"}
                    </td>
                    <td style={{ padding: "12px 10px", color: temInd && f.dist_mme20_pct != null && f.dist_mme20_pct <= 0 ? "#4ade80" : "#f59e0b" }}>
                      {temInd && f.dist_mme20_pct != null ? `${f.dist_mme20_pct > 0 ? "+" : ""}${f.dist_mme20_pct.toFixed(2)}%` : "—"}
                    </td>
                    <td style={{ padding: "12px 10px" }}>
                      {temInd && f.acima_mma200 != null ? (
                        <span style={{ padding: "2px 8px", borderRadius: "6px", fontSize: "11px", background: f.acima_mma200 ? "rgba(248,113,113,0.12)" : "rgba(74,222,128,0.12)", color: f.acima_mma200 ? "#f87171" : "#4ade80" }}>
                          {f.acima_mma200 ? "Acima" : "Abaixo"}
                        </span>
                      ) : "—"}
                    </td>
                    <td style={{ padding: "12px 10px", color: temInd && f.desconto_6m_pct != null && f.desconto_6m_pct <= -9 ? "#4ade80" : "#cbd5e1" }}>
                      {temInd && f.desconto_6m_pct != null ? `${f.desconto_6m_pct > 0 ? "+" : ""}${f.desconto_6m_pct.toFixed(1)}%` : "—"}
                    </td>
                    <td style={{ padding: "12px 10px" }}>
                      {selo ? (
                        <span style={{ padding: "3px 10px", borderRadius: "10px", fontSize: "11px", fontWeight: "600", background: selo.bg, color: selo.cor, whiteSpace: "nowrap" }}>{selo.label}</span>
                      ) : (
                        <span style={{ fontSize: "11px", color: "#64748b" }}>sem dados</span>
                      )}
                    </td>
                    <td style={{ padding: "12px 10px", color: "#94a3b8", fontSize: "11px", maxWidth: "140px" }}>{f.nota_pessoal || ""}</td>
                    <td style={{ padding: "12px 10px" }}>
                      <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                        <button onClick={() => atualizarUm(f.ticker)} disabled={atualizandoUm === f.ticker} title="Atualizar este ativo" style={{ padding: "4px 8px", borderRadius: "4px", border: "none", cursor: "pointer", background: "#1e293b", color: "#38bdf8", fontSize: "11px", fontWeight: "600" }}>
                          {atualizandoUm === f.ticker ? "..." : "🔄"}
                        </button>
                        <button onClick={() => abrirHistorico(f)} title="Ver histórico" style={{ padding: "4px 8px", borderRadius: "4px", border: "none", cursor: "pointer", background: "#0ea5e9", color: "white", fontSize: "11px", fontWeight: "600" }}>📈</button>
                        <button onClick={() => abrirFormPortfolio(f)} disabled={!temInd} title="Adicionar ao portfólio" style={{ padding: "4px 8px", borderRadius: "4px", border: "none", cursor: temInd ? "pointer" : "not-allowed", background: temInd ? "#16a34a" : "#334155", color: "white", fontSize: "11px", fontWeight: "600" }}>➕</button>
                        <button onClick={() => remover(f.ticker)} title="Remover" style={{ padding: "4px 8px", borderRadius: "4px", border: "none", cursor: "pointer", background: "#dc2626", color: "white", fontSize: "11px" }}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ fontSize: "11px", color: "#475569", marginTop: "14px" }}>
        Os indicadores são a prévia do candle de hoje — mudam conforme o preço do momento. O selo usa os cortes do checklist essencial (RSI, esticado, MMA200, desconto 6m). Alvo/stop no "+ Portfólio" são sugestões editáveis, não vêm do scanner.
      </div>
    </div>
  )
}