import { useState, useEffect } from "react"
import { BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts"
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
  const [proventos, setProventos] = useState(null)   // totais de /dividendos/recebidos
  const [resultadoGeral, setResultadoGeral] = useState(null)  // 09/11/2026: mesma conta do Portfolio (backend)

  useEffect(() => {
    Promise.all([
      api.get(`${API}/financeiro/cdi`).then(r => r.data).catch(() => ({ sucesso: false })),
      api.get(`${API}/historico`).then(r => r.data).catch(() => ({ sucesso: false })),
      api.get(`${API}/portfolio`).then(r => r.data).catch(() => ({ sucesso: false })),
      api.get(`${API}/dividendos/recebidos`).then(r => r.data).catch(() => ({ sucesso: false })),
      api.get(`${API}/resultado-geral`).then(r => r.data).catch(() => ({ sucesso: false })),
    ]).then(([cdiRes, histRes, portRes, divRes, rgRes]) => {
      if (rgRes.sucesso) setResultadoGeral(rgRes)
      if (divRes.sucesso) setProventos(divRes.totais)
      if (cdiRes.sucesso) setCdi(cdiRes.dados)
      if (histRes.sucesso) setHistorico(histRes.dados || [])
      if (portRes.sucesso) setPosicoes(portRes.dados || [])
      if (!cdiRes.sucesso && !histRes.sucesso) setErro("Erro ao carregar dados financeiros")
    }).finally(() => setCarregando(false))
  }, [])

  if (carregando) {
    return <div style={{ textAlign: "center", padding: "60px", color: "var(--fi-texto-4)" }}>Carregando desempenho financeiro…</div>
  }
  if (erro) {
    return <div style={{ textAlign: "center", padding: "60px", color: "#f87171" }}>{erro}</div>
  }

  // ── MÉTRICAS DE PERFORMANCE (calculadas do histórico) ──
  const fechados = (historico || []).filter(h => h.data_saida)
  const totalTrades = fechados.length
  const plVal = (h) => {
    const q = parseFloat(h.quantidade) || 0, e = parseFloat(h.preco_entrada), sai = parseFloat(h.preco_saida)
    if (isNaN(e) || isNaN(sai)) return 0
    return (sai - e) * q   // lucro em R$ do trade (14/10/2026)
  }
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
    // Um ponto por DIA de venda (antes era um por trade e a data se repetia no eixo).
    // Vendas do mesmo dia somam juntas; o tooltip lista os ativos.
    let soma = 0
    const pontos = []
    for (const h of ord) {
      soma += plVal(h)
      const d = new Date(h.data_saida)
      const chave = isNaN(d.getTime()) ? String(h.data_saida) : d.toDateString()
      const tk = String(h.ticker || "").replace(".SA", "")
      const ult = pontos[pontos.length - 1]
      if (ult && ult._chave === chave) {
        ult.acumulado = parseFloat(soma.toFixed(2))
        if (!ult.tickers.includes(tk)) ult.tickers.push(tk)
      } else {
        pontos.push({ _chave: chave, data: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }), tickers: [tk], acumulado: parseFloat(soma.toFixed(2)) })
      }
    }
    return pontos.map(p => ({ ...p, ticker: p.tickers.join(", ") }))
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
  const lucroRealizadoPreco = temCDI ? di.ganho_real : fechados.reduce((a, h) => a + plVal(h), 0)
  // Dividendos/JCP líquidos dos trades fechados entram no Realizado (23/10/2026)
  const divFechados = proventos ? (parseFloat(proventos.fechados_liquido) || 0) : 0
  // 09/11/2026: Realizado e Resultado total vêm do backend (/resultado-geral), iguais aos do Portfolio
  const lucroRealizado = resultadoGeral ? resultadoGeral.realizado : lucroRealizadoPreco + divFechados
  const pctRealizado = temCDI && di.capital_movimentado > 0 ? (lucroRealizado / di.capital_movimentado * 100) : null
  const resultadoTotal = resultadoGeral ? resultadoGeral.total : lucroRealizado + lucroAberto  // realizado + em aberto
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

  // ── Estilos Future Intelligence (10/11/2026) ──
  const card = (extra = {}) => ({ background: "var(--fi-painel)", border: "1px solid var(--fi-borda)", borderRadius: "16px", padding: "18px 20px", ...extra })
  const bigNum = (cor, brilho) => ({ fontFamily: "var(--fi-titulo)", fontSize: "26px", fontWeight: 600, color: cor, margin: 0, textShadow: brilho ? `0 0 18px ${brilho}` : "none" })
  const label = { fontSize: "11px", color: "var(--fi-texto-4)", marginBottom: "8px", fontWeight: 500, textTransform: "uppercase", letterSpacing: "1.2px" }
  const sub = { fontSize: "11px", color: "var(--fi-texto-4)", marginTop: "6px", lineHeight: 1.5 }
  const tituloSecao = { fontSize: "13px", fontWeight: 600, color: "var(--fi-texto-2)", marginBottom: "16px" }
  const tooltipEstilo = { background: "#0B1426", border: "1px solid #1E3352", borderRadius: "10px", color: "#E6EDF7" }
  const eixo = { fontSize: 11, fill: "#7E93B2" }
  const pctCdi = temCDI && di.pct_do_cdi != null ? di.pct_do_cdi : null
  const anelCdi = (() => {
    const r = 46, C = 2 * Math.PI * r, f = pctCdi != null ? Math.max(0.03, Math.min(1, pctCdi / 300)) : 0.03
    return { C, dash: `${(C * f).toFixed(1)} ${C.toFixed(1)}` }
  })()

  return (
    <div style={{ width: "100%" }}>
      {/* CABEÇALHO */}
      <div style={{ marginBottom: "18px" }}>
        <h1 className="fi-titulo" style={{ margin: 0, fontSize: "24px", fontWeight: 700 }}>Financeiro</h1>
        <span style={{ fontSize: "12px", color: "var(--fi-texto-4)" }}>
          Desempenho completo da operação{temCDI ? ` · CDI atual ${cdi.cdi_atual}% a.a.` : ""}
        </span>
      </div>

      {/* ── VISÃO GERAL ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: "14px", marginBottom: "14px" }}>
        <div style={card({ borderColor: "rgba(56,189,248,0.45)", boxShadow: "0 0 26px rgba(56,189,248,0.12)" })}>
          <div style={label}>Resultado total</div>
          <p style={bigNum(resultadoTotal >= 0 ? "#38BDF8" : "#FB6474", resultadoTotal >= 0 ? "rgba(56,189,248,0.45)" : null)}>
            {fmtBRL(resultadoTotal)} {capitalTotal > 0 && <span style={{ fontSize: "13px" }}>({resultadoTotal >= 0 ? "+" : ""}{(resultadoTotal / capitalTotal * 100).toFixed(1)}%)</span>}
          </p>
          <div style={sub}>realizado + em aberto, juntos (mesma conta do Portfólio)</div>
        </div>
        <div style={card()}>
          <div style={label}>Realizado (já vendido)</div>
          <p style={bigNum(lucroRealizado >= 0 ? "#22D3A0" : "#FB6474")}>{fmtBRL(lucroRealizado)} {pctRealizado != null && <span style={{ fontSize: "13px" }}>({fmtPct(pctRealizado)})</span>}</p>
          <div style={sub}>
            {divFechados > 0
              ? <>inclui {fmtBRL(divFechados)} de dividendos · só preço: {fmtBRL(lucroRealizadoPreco)}</>
              : "lucro/prejuízo dos trades fechados"}
          </div>
        </div>
        <div style={card()}>
          <div style={label}>Em aberto</div>
          <p style={bigNum(lucroAberto >= 0 ? "#22D3A0" : "#FB6474")}>{fmtBRL(lucroAberto)} <span style={{ fontSize: "13px" }}>({lucroAberto >= 0 ? "+" : ""}{pctAberto.toFixed(1)}%)</span></p>
          <div style={sub}>{posicoes.length} posições · investido {fmtBRL(capitalAberto)} · vale {fmtBRL(valorHoje)} · pode mudar</div>
        </div>
        <div style={card()}
             title={proventos ? `Dividendos e JCP a que seus trades B3 tiveram direito (data-com com você posicionado).\nJCP já com 15% de IR descontado.\nTrades fechados: ${fmtBRL(proventos.fechados_liquido)} · posições abertas: ${fmtBRL(proventos.abertas_liquido)}` : ""}>
          <div style={label}>Dividendos e JCP</div>
          <p style={bigNum("#FBBF24")}>{proventos ? fmtBRL(proventos.total_liquido) : "—"}</p>
          <div style={sub}>
            {proventos
              ? <>recebido {fmtBRL(proventos.recebido)} · a receber {fmtBRL(proventos.a_receber)} · {fmtBRL(proventos.fechados_liquido)} dos fechados já no Realizado</>
              : "proventos indisponíveis agora"}
          </div>
        </div>
      </div>

      {/* CDI + MÉTRICAS */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "14px", marginBottom: "18px" }}>
        <div style={card({ flex: "1 1 300px", display: "flex", alignItems: "center", gap: "18px", ...(bateu ? { borderColor: "rgba(34,211,160,0.4)" } : {}) })}>
          <svg width="112" height="112" viewBox="0 0 112 112" role="img" aria-label={`Rendeu ${pctCdi != null ? pctCdi.toFixed(0) : "—"}% do CDI`} style={{ flex: "none" }}>
            <defs><linearGradient id="fiCdi" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#2563EB" /><stop offset="1" stopColor="#22D3A0" /></linearGradient></defs>
            <circle cx="56" cy="56" r="46" fill="none" stroke="#132238" strokeWidth="9" />
            <circle cx="56" cy="56" r="46" fill="none" stroke="url(#fiCdi)" strokeWidth="9" strokeLinecap="round" strokeDasharray={anelCdi.dash}
              transform="rotate(-90 56 56)" style={{ filter: "drop-shadow(0 0 6px rgba(56,189,248,0.55))" }} />
            <text x="56" y="56" textAnchor="middle" fill="#E6EDF7" fontFamily="Space Grotesk, Inter, sans-serif" fontSize="22" fontWeight="700">{pctCdi != null ? `${pctCdi.toFixed(0)}%` : "—"}</text>
            <text x="56" y="73" textAnchor="middle" fill="#7E93B2" fontFamily="Inter, sans-serif" fontSize="10">do CDI</text>
          </svg>
          <div>
            <div style={label}>Rendeu do CDI</div>
            <div style={{ fontSize: "13px", color: bateu ? "#22D3A0" : "var(--fi-texto-2)", fontWeight: 600 }}>{temCDI ? (bateu ? "Bateu o CDI" : "Abaixo do CDI") : "—"}</div>
            <div style={sub}>{temCDI ? `${di.diferenca_pct >= 0 ? "+" : ""}${di.diferenca_pct.toFixed(2)} pp contra o CDI no mesmo capital e prazo` : ""}</div>
          </div>
        </div>
        <div style={{ flex: "999 1 520px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "14px" }}>
          {[
            { l: "Taxa de acerto", v: taxaAcerto !== "—" ? `${taxaAcerto}%` : "—", c: parseFloat(taxaAcerto) >= 60 ? "#22D3A0" : parseFloat(taxaAcerto) >= 40 ? "#FBBF24" : "#FB6474", s: `${vencedores.length} lucro / ${perdedores.length} prejuízo` },
            { l: "Tempo médio", v: tempoMedio, c: "var(--fi-texto)", s: "até encerrar a posição" },
            { l: "Ganho médio", v: fmtPct(ganhoMedio), c: "#22D3A0", s: "nos vencedores" },
            { l: "Perda média", v: fmtPct(perdaMedia), c: "#FB6474", s: "nos perdedores" },
            { l: "Melhor trade", v: melhorTrade ? fmtPct(plPct(melhorTrade)) : "—", c: "#22D3A0", s: melhorTrade ? String(melhorTrade.ticker).replace(".SA", "") : "" },
            { l: "Pior trade", v: piorTrade ? fmtPct(plPct(piorTrade)) : "—", c: "#FB6474", s: piorTrade ? String(piorTrade.ticker).replace(".SA", "") : "" },
          ].map((m, i) => (
            <div key={i} style={card({ padding: "14px 16px" })}>
              <div style={label}>{m.l}</div>
              <p style={{ ...bigNum(m.c), fontSize: "20px" }}>{m.v}</p>
              <div style={sub}>{m.s}</div>
            </div>
          ))}
        </div>
      </div>

      {/* O CAMINHO DO DINHEIRO */}
      {temCDI && (
        <div style={card({ marginBottom: "18px" })}>
          <div style={tituloSecao}>O caminho do dinheiro</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-around", flexWrap: "wrap", gap: "20px" }}>
            <div style={{ textAlign: "center" }}>
              <div style={label}>Comprei</div>
              <div style={bigNum("var(--fi-texto)")}>{fmtBRL(di.capital_movimentado)}</div>
              <div style={sub}>{di.trades} trades</div>
            </div>
            <div style={{ fontSize: "22px", color: "#38BDF8", textShadow: "0 0 10px rgba(56,189,248,0.6)" }}>→</div>
            <div style={{ textAlign: "center" }}>
              <div style={label}>Recebi</div>
              <div style={bigNum("var(--fi-texto)")}>{fmtBRL(di.capital_movimentado + di.ganho_real)}</div>
              <div style={sub}>tudo que voltou</div>
            </div>
            <div style={{ fontSize: "22px", color: "#38BDF8", textShadow: "0 0 10px rgba(56,189,248,0.6)" }}>=</div>
            <div style={{ textAlign: "center" }}>
              <div style={label}>Sobrou</div>
              <div style={bigNum(di.ganho_real >= 0 ? "#22D3A0" : "#FB6474", di.ganho_real >= 0 ? "rgba(34,211,160,0.45)" : null)}>{fmtBRL(di.ganho_real)}</div>
              <div style={{ ...sub, color: di.ganho_real >= 0 ? "#22D3A0" : "#FB6474" }}>{fmtPct(di.pct_real)} sobre o comprado</div>
            </div>
          </div>
        </div>
      )}

      {/* CURVA DE LUCRO ACUMULADO */}
      {curva.length > 1 && (
        <div style={card({ marginBottom: "18px" })}>
          <div style={tituloSecao}>Lucro acumulado ao longo do tempo</div>
          <div style={{ height: "260px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={curva} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="fiCurva" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#38BDF8" stopOpacity={0.35} />
                    <stop offset="1" stopColor="#38BDF8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#132238" vertical={false} />
                <XAxis dataKey="data" tick={eixo} minTickGap={30} axisLine={false} tickLine={false} />
                <YAxis tick={eixo} tickFormatter={(v) => `R$${v}`} width={54} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v) => [fmtBRL(v), "Acumulado"]} labelFormatter={(l, p) => p && p[0] ? `${p[0].payload.ticker} · ${l}` : l} contentStyle={tooltipEstilo} />
                <Area type="monotone" dataKey="acumulado" stroke="#38BDF8" strokeWidth={2.5} fill="url(#fiCurva)"
                  dot={{ r: 3, fill: "#38BDF8", strokeWidth: 0 }} style={{ filter: "drop-shadow(0 0 6px rgba(56,189,248,0.6))" }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* RENDIMENTO vs CDI POR PERÍODO + MÊS A MÊS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: "18px", marginBottom: "18px" }}>
        {[["Seu rendimento × CDI por período", dadosGrafico], ["Evolução mês a mês", dadosMensais]].filter(([, d]) => d.length > 0).map(([titulo, dados]) => (
          <div key={titulo} style={card()}>
            <div style={tituloSecao}>{titulo}</div>
            <div style={{ height: "260px" }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dados} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#132238" vertical={false} />
                  <XAxis dataKey="nome" tick={eixo} axisLine={false} tickLine={false} />
                  <YAxis tick={eixo} tickFormatter={(v) => `${v}%`} width={44} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(value, name) => [`${value.toFixed(2)}%`, name === "real" ? "Seu rendimento" : "CDI"]} contentStyle={tooltipEstilo} cursor={{ fill: "rgba(56,189,248,0.06)" }} />
                  <Legend formatter={(v) => v === "real" ? "Seu rendimento" : "CDI"} wrapperStyle={{ fontSize: "12px", color: "#9DB0CB" }} />
                  <Bar dataKey="real" fill="#38BDF8" radius={[6, 6, 0, 0]} style={{ filter: "drop-shadow(0 0 6px rgba(56,189,248,0.5))" }} />
                  <Bar dataKey="benchmark" fill="#2A3B55" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ))}
      </div>

      {/* TABELA MENSAL EM R$ */}
      {mensalReais.length > 0 && (
        <div style={card({ marginBottom: "18px" })}>
          <div style={tituloSecao}>Movimentação mês a mês (em reais)</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", minWidth: "480px" }}>
              <thead>
                <tr>
                  {["Mês", "Trades", "Comprado", "Vendido", "Resultado"].map(h => (
                    <th key={h} style={{ padding: "10px 12px", textAlign: h === "Mês" ? "left" : "right", color: "#5F7391", fontSize: "10.5px", fontWeight: 500, textTransform: "uppercase", letterSpacing: "1.1px" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {mensalReais.map((m, i) => (
                  <tr key={i} style={{ borderTop: "1px solid #101D31" }}>
                    <td style={{ padding: "12px", color: "var(--fi-texto)" }}>{m.label}</td>
                    <td style={{ padding: "12px", textAlign: "right", color: "var(--fi-texto-3)" }}>{m.trades}</td>
                    <td style={{ padding: "12px", textAlign: "right", color: "var(--fi-texto-3)" }}>{fmtBRL(m.comprado)}</td>
                    <td style={{ padding: "12px", textAlign: "right", color: "var(--fi-texto)" }}>{fmtBRL(m.vendido)}</td>
                    <td style={{ padding: "12px", textAlign: "right", color: m.resultado >= 0 ? "#22D3A0" : "#FB6474", fontWeight: 600 }}>{m.resultado >= 0 ? "+" : ""}{fmtBRL(m.resultado)}</td>
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
          <div style={tituloSecao}>Detalhamento por período</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", minWidth: "560px" }}>
              <thead>
                <tr>
                  {["Período", "Trades", "Seu rendimento", "CDI", "% do CDI", "Diferença"].map(h => (
                    <th key={h} style={{ padding: "10px 12px", textAlign: h === "Período" ? "left" : "right", color: "#5F7391", fontSize: "10.5px", fontWeight: 500, textTransform: "uppercase", letterSpacing: "1.1px" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[di, ...(cdi.moveis || []), ...(cdi.mensais || [])].filter(p => p && p.ok).map((p, i) => (
                  <tr key={i} style={{ borderTop: "1px solid #101D31" }}>
                    <td style={{ padding: "12px", color: "var(--fi-texto)" }}>{p.label}</td>
                    <td style={{ padding: "12px", textAlign: "right", color: "var(--fi-texto-3)" }}>{p.trades}</td>
                    <td style={{ padding: "12px", textAlign: "right", color: p.pct_real >= 0 ? "#22D3A0" : "#FB6474", fontWeight: 600 }}>{fmtPct(p.pct_real)}</td>
                    <td style={{ padding: "12px", textAlign: "right", color: "var(--fi-texto-3)" }}>{fmtPct(p.pct_cdi)}</td>
                    <td style={{ padding: "12px", textAlign: "right", color: p.pct_do_cdi != null && p.pct_do_cdi >= 100 ? "#22D3A0" : "var(--fi-texto-3)", fontWeight: 600 }}>
                      {p.pct_do_cdi != null ? `${p.pct_do_cdi.toFixed(0)}%` : "—"}
                    </td>
                    <td style={{ padding: "12px", textAlign: "right", color: p.diferenca_pct >= 0 ? "#22D3A0" : "#FB6474", fontWeight: 600 }}>
                      {p.diferenca_pct >= 0 ? "+" : ""}{p.diferenca_pct.toFixed(2)} pp
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={{ fontSize: "11px", color: "#5F7391", marginTop: "14px" }}>
        O CDI equivalente é calculado sobre o mesmo capital de cada trade, pelos dias exatos em que ficou investido. "Desde o início" conta a partir do primeiro trade, sem períodos vazios.
      </div>
    </div>
  )
}
