import { useState, useEffect } from "react"
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts"
import api from "../services/api"

const API = import.meta.env.VITE_API_URL

const fmtBRL = (v) => "R$ " + (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtPct = (v) => `${(Number(v) || 0) >= 0 ? "+" : ""}${(Number(v) || 0).toFixed(2)}%`

export default function Financeiro() {
  const [cdi, setCdi] = useState(null)
  const [historico, setHistorico] = useState([])
  const [posicoes, setPosicoes] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    Promise.all([
      api.get(`${API}/financeiro/cdi`).then(r => r.data).catch(() => ({ sucesso: false })),
      api.get(`${API}/historico`).then(r => r.data).catch(() => ({ sucesso: false })),
      api.get(`${API}/portfolio`).then(r => r.data).catch(() => ({ sucesso: false })),
    ]).then(([cdiRes, histRes, portRes]) => {
      if (cdiRes.sucesso) setCdi(cdiRes.dados)
      if (histRes.sucesso) setHistorico(histRes.dados || [])
      if (portRes.sucesso) setPosicoes(portRes.dados || [])
      if (!cdiRes.sucesso && !histRes.sucesso) setErro("Erro ao carregar dados financeiros")
    }).finally(() => setCarregando(false))
  }, [])

  if (carregando) {
    return <div style={{ textAlign: "center", padding: "60px", color: "#64748b" }}>Carregando desempenho financeiro...</div>
  }
  if (erro) {
    return <div style={{ textAlign: "center", padding: "60px", color: "#f87171" }}>{erro}</div>
  }

  // ── MÉTRICAS DE PERFORMANCE (calculadas do histórico) ──
  const fechados = (historico || []).filter(h => h.data_saida)
  const totalTrades = fechados.length
  const plVal = (h) => parseFloat(h.pl ?? h.resultado ?? 0)
  const plPct = (h) => parseFloat(h.pl_pct ?? h.resultado_pct ?? 0)
  const vencedores = fechados.filter(h => plVal(h) >= 0)
  const perdedores = fechados.filter(h => plVal(h) < 0)
  const taxaAcerto = totalTrades > 0 ? ((vencedores.length / totalTrades) * 100).toFixed(0) : "—"
  const ganhoMedio = vencedores.length > 0 ? (vencedores.reduce((a, h) => a + plPct(h), 0) / vencedores.length) : 0
  const perdaMedia = perdedores.length > 0 ? (perdedores.reduce((a, h) => a + plPct(h), 0) / perdedores.length) : 0
  const melhorTrade = fechados.length > 0 ? fechados.reduce((a, b) => plPct(a) > plPct(b) ? a : b) : null
  const piorTrade = fechados.length > 0 ? fechados.reduce((a, b) => plPct(a) < plPct(b) ? a : b) : null
  const tempoMedio = (() => {
    const comDias = fechados.filter(h => h.dias_duracao != null && h.dias_duracao > 0)
    if (comDias.length === 0) return "—"
    const m = comDias.reduce((a, h) => a + parseInt(h.dias_duracao), 0) / comDias.length
    return `${m.toFixed(0)} dias`
  })()
  const curva = (() => {
    const ord = [...fechados].sort((a, b) => new Date(a.data_saida) - new Date(b.data_saida))
    let soma = 0
    return ord.map(h => {
      soma += plVal(h)
      return { data: new Date(h.data_saida).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }), ticker: h.ticker, acumulado: parseFloat(soma.toFixed(2)) }
    })
  })()

  const di = cdi?.desde_inicio
  const temCDI = di && di.ok
  const bateu = temCDI && di.bateu_cdi

  // ── CAPITAL EM ABERTO (mesma lógica do Portfolio, só B3 por ora) ──
  const dolar = 5.7  // fallback; hoje só há posições B3, então não afeta
  const invB3 = posicoes.filter(p => p.mercado === "B3").reduce((a, p) => a + p.quantidade * p.preco_entrada, 0)
  const atuB3 = posicoes.filter(p => p.mercado === "B3").reduce((a, p) => a + p.quantidade * p.preco_atual, 0)
  const invIntl = posicoes.filter(p => p.mercado !== "B3").reduce((a, p) => a + p.quantidade * p.preco_entrada, 0)
  const atuIntl = posicoes.filter(p => p.mercado !== "B3").reduce((a, p) => a + p.quantidade * p.preco_atual, 0)
  const capitalAberto = invB3 + invIntl * dolar        // quanto investiu nas posições abertas
  const valorHoje = atuB3 + atuIntl * dolar            // quanto valem hoje
  const lucroAberto = valorHoje - capitalAberto        // lucro/prejuízo em aberto
  const pctAberto = capitalAberto > 0 ? (lucroAberto / capitalAberto * 100) : 0

  // Realizado (dos trades fechados)
  const lucroRealizado = temCDI ? di.ganho_real : fechados.reduce((a, h) => a + plVal(h), 0)
  const resultadoTotal = lucroRealizado + lucroAberto  // realizado + em aberto
  // Capital total = o que girou nos fechados + o que está investido nas abertas
  const capitalRealizado = temCDI ? di.capital_movimentado : 0
  const capitalTotal = capitalRealizado + capitalAberto
  const dadosGrafico = temCDI ? [
    { nome: "Desde início", real: di.pct_real, benchmark: di.pct_cdi },
    ...(cdi.moveis || []).map(m => ({ nome: m.label.replace("Últimos ", ""), real: m.pct_real, benchmark: m.pct_cdi })),
  ] : []
  const dadosMensais = temCDI ? (cdi.mensais || []).map(m => ({ nome: m.label.split("/")[0].slice(0, 3), real: m.pct_real, benchmark: m.pct_cdi })) : []

  // ── COMPRADO/VENDIDO em R$ por mês (do histórico, pela data de saída) ──
  const mensalReais = (() => {
    const meses = {}
    fechados.forEach(h => {
      const d = new Date(h.data_saida)
      if (isNaN(d.getTime())) return
      const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      if (!meses[chave]) meses[chave] = { comprado: 0, vendido: 0, trades: 0 }
      const qtd = parseFloat(h.quantidade) || 0
      meses[chave].comprado += (parseFloat(h.preco_entrada) || 0) * qtd
      meses[chave].vendido += (parseFloat(h.preco_saida) || 0) * qtd
      meses[chave].trades += 1
    })
    const nomesMes = ["", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
    return Object.entries(meses).sort(([a], [b]) => a.localeCompare(b)).map(([chave, v]) => {
      const [ano, mes] = chave.split("-")
      return { label: `${nomesMes[parseInt(mes)]}/${ano}`, ...v, resultado: v.vendido - v.comprado }
    })
  })()

  // ── Estilos padrão azul do dashboard ──
  const card = (extra = {}) => ({ background: "#0d1829", border: "1px solid #1e293b", borderRadius: "14px", padding: "20px", ...extra })
  const bigNum = (cor) => ({ fontSize: "28px", fontWeight: "800", color: cor, margin: 0 })
  const label = { fontSize: "12px", color: "#94a3b8", marginBottom: "8px", fontWeight: "500" }
  const sub = { fontSize: "11px", color: "#64748b", marginTop: "5px" }

  return (
    <div style={{ width: "100%" }}>
      {/* HEADER */}
      <div style={{ marginBottom: "24px" }}>
        <h2 style={{ color: "#38bdf8", margin: "0 0 4px 0", fontSize: "22px", fontWeight: "800" }}>💰 Financeiro</h2>
        <span style={{ fontSize: "12px", color: "#64748b" }}>
          Desempenho completo da sua operação{temCDI ? ` · CDI atual ${cdi.cdi_atual}% a.a.` : ""}
        </span>
      </div>

      {/* ── VISÃO GERAL: REALIZADO / EM ABERTO / TOTAL ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: "14px", marginBottom: "14px" }}>
        <div style={card({ background: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.2)" })}>
          <div style={label}>✅ Realizado (já vendido)</div>
          <p style={bigNum(lucroRealizado >= 0 ? "#4ade80" : "#f87171")}>{fmtBRL(lucroRealizado)} {temCDI && <span style={{ fontSize: "15px" }}>({fmtPct(di.pct_real)})</span>}</p>
          <div style={sub}>lucro/prejuízo dos trades fechados</div>
        </div>
        <div style={card({ background: lucroAberto >= 0 ? "rgba(74,222,128,0.06)" : "rgba(248,113,113,0.06)", border: `1px solid ${lucroAberto >= 0 ? "rgba(74,222,128,0.2)" : "rgba(248,113,113,0.2)"}` })}>
          <div style={label}>📊 Em aberto (posições atuais)</div>
          <p style={bigNum(lucroAberto >= 0 ? "#4ade80" : "#f87171")}>{fmtBRL(lucroAberto)} <span style={{ fontSize: "15px" }}>({lucroAberto >= 0 ? "+" : ""}{pctAberto.toFixed(1)}%)</span></p>
          <div style={sub}>{posicoes.length} posições · investido {fmtBRL(capitalAberto)} · vale {fmtBRL(valorHoje)} hoje · pode mudar</div>
        </div>
        <div style={card({ background: "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.2)" })}>
          <div style={label}>💜 Resultado total</div>
          <p style={bigNum(resultadoTotal >= 0 ? "#a78bfa" : "#f87171")}>{fmtBRL(resultadoTotal)} {capitalTotal > 0 && <span style={{ fontSize: "15px" }}>({resultadoTotal >= 0 ? "+" : ""}{(resultadoTotal / capitalTotal * 100).toFixed(1)}%)</span>}</p>
          <div style={sub}>realizado + em aberto, juntos</div>
        </div>
      </div>

      {/* CARDS PRINCIPAIS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px", marginBottom: "14px" }}>
        <div style={card()}>
          <div style={label}>🎯 Taxa de acerto</div>
          <p style={bigNum(parseFloat(taxaAcerto) >= 60 ? "#4ade80" : parseFloat(taxaAcerto) >= 40 ? "#f59e0b" : "#f87171")}>{taxaAcerto}{taxaAcerto !== "—" ? "%" : ""}</p>
          <div style={sub}>{vencedores.length} lucro / {perdedores.length} prejuízo · {totalTrades} trades</div>
        </div>
        <div style={card({ background: bateu ? "rgba(74,222,128,0.06)" : "#0d1829", border: `1px solid ${bateu ? "rgba(74,222,128,0.25)" : "#1e293b"}` })}>
          <div style={label}>📈 Rendeu do CDI</div>
          <p style={bigNum("#38bdf8")}>{temCDI && di.pct_do_cdi != null ? `${di.pct_do_cdi.toFixed(0)}%` : "—"}</p>
          <div style={sub}>{temCDI ? `${di.diferenca_pct >= 0 ? "+" : ""}${di.diferenca_pct.toFixed(2)} pp vs CDI` : ""}</div>
        </div>
        <div style={card()}>
          <div style={label}>⏱️ Tempo médio por trade</div>
          <p style={bigNum("#f1f5f9")}>{tempoMedio}</p>
          <div style={sub}>média até encerrar posição</div>
        </div>
      </div>

      {/* GANHO/PERDA MÉDIA + MELHOR/PIOR */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "14px", marginBottom: "20px" }}>
        <div style={card()}>
          <div style={label}>Ganho médio (vencedores)</div>
          <p style={{ ...bigNum("#4ade80"), fontSize: "22px" }}>{fmtPct(ganhoMedio)}</p>
        </div>
        <div style={card()}>
          <div style={label}>Perda média (perdedores)</div>
          <p style={{ ...bigNum("#f87171"), fontSize: "22px" }}>{fmtPct(perdaMedia)}</p>
        </div>
        <div style={card()}>
          <div style={label}>🏆 Melhor trade</div>
          <p style={{ ...bigNum("#4ade80"), fontSize: "22px" }}>{melhorTrade ? fmtPct(plPct(melhorTrade)) : "—"}</p>
          <div style={sub}>{melhorTrade ? melhorTrade.ticker : ""}</div>
        </div>
        <div style={card()}>
          <div style={label}>📉 Pior trade</div>
          <p style={{ ...bigNum("#f87171"), fontSize: "22px" }}>{piorTrade ? fmtPct(plPct(piorTrade)) : "—"}</p>
          <div style={sub}>{piorTrade ? piorTrade.ticker : ""}</div>
        </div>
      </div>

      {/* O CAMINHO DO DINHEIRO */}
      {temCDI && (
        <div style={card({ marginBottom: "20px" })}>
          <div style={{ fontSize: "15px", fontWeight: "700", color: "#f1f5f9", marginBottom: "18px" }}>O caminho do dinheiro</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-around", flexWrap: "wrap", gap: "20px" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "12px", color: "#94a3b8", marginBottom: "8px" }}>Comprei</div>
              <div style={{ fontSize: "26px", fontWeight: "800", color: "#f1f5f9" }}>{fmtBRL(di.capital_movimentado)}</div>
              <div style={sub}>{di.trades} trades</div>
            </div>
            <div style={{ fontSize: "22px", color: "#64748b" }}>→</div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "12px", color: "#94a3b8", marginBottom: "8px" }}>Recebi</div>
              <div style={{ fontSize: "26px", fontWeight: "800", color: "#f1f5f9" }}>{fmtBRL(di.capital_movimentado + di.ganho_real)}</div>
              <div style={sub}>tudo que voltou</div>
            </div>
            <div style={{ fontSize: "22px", color: "#64748b" }}>=</div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "12px", color: "#94a3b8", marginBottom: "8px" }}>Sobrou</div>
              <div style={{ fontSize: "26px", fontWeight: "800", color: di.ganho_real >= 0 ? "#4ade80" : "#f87171" }}>{fmtBRL(di.ganho_real)}</div>
              <div style={{ ...sub, color: di.ganho_real >= 0 ? "#4ade80" : "#f87171" }}>{fmtPct(di.pct_real)} sobre o comprado</div>
            </div>
          </div>
        </div>
      )}

      {/* CURVA DE LUCRO ACUMULADO */}
      {curva.length > 1 && (
        <div style={card({ marginBottom: "20px" })}>
          <div style={{ fontSize: "15px", fontWeight: "700", color: "#f1f5f9", marginBottom: "16px" }}>Lucro acumulado ao longo do tempo</div>
          <div style={{ height: "260px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={curva} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="data" tick={{ fontSize: 11, fill: "#64748b" }} minTickGap={30} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={(v) => `R$${v}`} width={54} />
                <Tooltip formatter={(v) => [fmtBRL(v), "Acumulado"]} labelFormatter={(l, p) => p && p[0] ? `${p[0].payload.ticker} · ${l}` : l} contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: "8px" }} />
                <Line type="monotone" dataKey="acumulado" stroke="#38bdf8" strokeWidth={2.5} dot={{ r: 3, fill: "#38bdf8" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* RENDIMENTO vs CDI POR PERÍODO */}
      {dadosGrafico.length > 0 && (
        <div style={card({ marginBottom: "20px" })}>
          <div style={{ fontSize: "15px", fontWeight: "700", color: "#f1f5f9", marginBottom: "16px" }}>Seu rendimento vs CDI por período</div>
          <div style={{ height: "300px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dadosGrafico} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="nome" tick={{ fontSize: 11, fill: "#64748b" }} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={(v) => `${v}%`} width={44} />
                <Tooltip formatter={(value, name) => [`${value.toFixed(2)}%`, name === "real" ? "Seu rendimento" : "CDI"]} contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: "8px" }} />
                <Legend formatter={(v) => v === "real" ? "Seu rendimento" : "CDI"} wrapperStyle={{ fontSize: "12px" }} />
                <Bar dataKey="real" fill="#4ade80" radius={[4, 4, 0, 0]} />
                <Bar dataKey="benchmark" fill="#38bdf8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* EVOLUÇÃO MENSAL */}
      {dadosMensais.length > 0 && (
        <div style={card({ marginBottom: "20px" })}>
          <div style={{ fontSize: "15px", fontWeight: "700", color: "#f1f5f9", marginBottom: "16px" }}>Evolução mês a mês</div>
          <div style={{ height: "280px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dadosMensais} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="nome" tick={{ fontSize: 11, fill: "#64748b" }} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={(v) => `${v}%`} width={44} />
                <Tooltip formatter={(value, name) => [`${value.toFixed(2)}%`, name === "real" ? "Seu rendimento" : "CDI"]} contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: "8px" }} />
                <Legend formatter={(v) => v === "real" ? "Seu rendimento" : "CDI"} wrapperStyle={{ fontSize: "12px" }} />
                <Bar dataKey="real" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="benchmark" fill="#64748b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* TABELA MENSAL EM R$ (comprado / vendido / resultado) */}
      {mensalReais.length > 0 && (
        <div style={card({ marginBottom: "20px" })}>
          <div style={{ fontSize: "15px", fontWeight: "700", color: "#f1f5f9", marginBottom: "16px" }}>Movimentação mês a mês (em reais)</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", minWidth: "480px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #1e293b" }}>
                  {["Mês", "Trades", "Comprado", "Vendido", "Resultado"].map(h => (
                    <th key={h} style={{ padding: "12px", textAlign: h === "Mês" ? "left" : "right", color: "#64748b", fontSize: "11px", fontWeight: "600", textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {mensalReais.map((m, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #1e293b" }}>
                    <td style={{ padding: "12px", color: "#e2e8f0" }}>{m.label}</td>
                    <td style={{ padding: "12px", textAlign: "right", color: "#94a3b8" }}>{m.trades}</td>
                    <td style={{ padding: "12px", textAlign: "right", color: "#94a3b8" }}>{fmtBRL(m.comprado)}</td>
                    <td style={{ padding: "12px", textAlign: "right", color: "#e2e8f0" }}>{fmtBRL(m.vendido)}</td>
                    <td style={{ padding: "12px", textAlign: "right", color: m.resultado >= 0 ? "#4ade80" : "#f87171", fontWeight: "600" }}>{m.resultado >= 0 ? "+" : ""}{fmtBRL(m.resultado)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TABELA DETALHADA */}
      {temCDI && (
        <div style={card()}>
          <div style={{ fontSize: "15px", fontWeight: "700", color: "#f1f5f9", marginBottom: "16px" }}>Detalhamento por período</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", minWidth: "560px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #1e293b" }}>
                  {["Período", "Trades", "Seu rendimento", "CDI", "% do CDI", "Diferença"].map(h => (
                    <th key={h} style={{ padding: "12px", textAlign: h === "Período" ? "left" : "right", color: "#64748b", fontSize: "11px", fontWeight: "600", textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[di, ...(cdi.moveis || []), ...(cdi.mensais || [])].filter(p => p && p.ok).map((p, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #1e293b" }}>
                    <td style={{ padding: "12px", color: "#e2e8f0" }}>{p.label}</td>
                    <td style={{ padding: "12px", textAlign: "right", color: "#94a3b8" }}>{p.trades}</td>
                    <td style={{ padding: "12px", textAlign: "right", color: p.pct_real >= 0 ? "#4ade80" : "#f87171", fontWeight: "600" }}>{fmtPct(p.pct_real)}</td>
                    <td style={{ padding: "12px", textAlign: "right", color: "#38bdf8" }}>{fmtPct(p.pct_cdi)}</td>
                    <td style={{ padding: "12px", textAlign: "right", color: p.pct_do_cdi != null && p.pct_do_cdi >= 100 ? "#4ade80" : "#94a3b8", fontWeight: "600" }}>
                      {p.pct_do_cdi != null ? `${p.pct_do_cdi.toFixed(0)}%` : "—"}
                    </td>
                    <td style={{ padding: "12px", textAlign: "right", color: p.diferenca_pct >= 0 ? "#4ade80" : "#f87171", fontWeight: "600" }}>
                      {p.diferenca_pct >= 0 ? "+" : ""}{p.diferenca_pct.toFixed(2)} pp
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={{ fontSize: "11px", color: "#475569", marginTop: "14px" }}>
        O CDI equivalente é calculado sobre o mesmo capital de cada trade, pelos dias exatos em que ficou investido. "Desde o início" conta a partir do seu primeiro trade, sem períodos vazios.
      </div>
    </div>
  )
}