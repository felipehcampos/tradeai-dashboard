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
  const [periodo, setPeriodo] = useState("inicio")  // 10/11/2026: seletor de período do Financeiro v2

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

  // ══════════ Financeiro v2 — Future Intelligence (10/11/2026, protótipo aprovado) ══════════
  const card = (extra = {}) => ({ background: "var(--fi-painel)", border: "1px solid var(--fi-borda)", borderRadius: "16px", padding: "18px 20px", ...extra })
  const rotulo = { fontSize: "11px", color: "var(--fi-texto-4)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "1.2px" }
  const sub = { fontSize: "11px", color: "var(--fi-texto-4)", marginTop: "4px", lineHeight: 1.5 }
  const num = (cor, tam = 26, brilho) => ({ fontFamily: "var(--fi-titulo)", fontSize: `${tam}px`, fontWeight: 600, color: cor, margin: 0, lineHeight: 1.15, textShadow: brilho ? `0 0 20px ${brilho}` : "none" })
  const tituloCard = { margin: 0, fontSize: "13px", fontWeight: 600, color: "var(--fi-texto-2)" }
  const tooltipEstilo = { background: "#0B1426", border: "1px solid #1E3352", borderRadius: "10px", color: "#E6EDF7", fontSize: "12px" }
  const eixo = { fontSize: 11, fill: "#7E93B2" }
  const sinal = (v) => (v >= 0 ? "+" : "−")
  const brlS = (v) => `${sinal(v)}${fmtBRL(Math.abs(v))}`
  const Bloco = ({ n, txt }) => (
    <div style={{ display: "flex", alignItems: "baseline", gap: "10px", margin: "4px 0 10px" }}>
      <span className="fi-titulo" style={{ fontSize: "12px", color: "#38BDF8", letterSpacing: "2px" }}>{n}</span>
      <span style={{ fontSize: "11px", color: "var(--fi-texto-4)", letterSpacing: "2px", textTransform: "uppercase" }}>{txt}</span>
    </div>
  )

  // ── Períodos (o seletor filtra os blocos 02 a 05; o bloco 01 é sempre o retrato de hoje) ──
  const hojeISO = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" })
  const menosDias = (n) => { const d = new Date(hojeISO + "T12:00:00"); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10) }
  const periodos = temCDI ? [
    { id: "inicio", label: "Desde o início", ini: "0000-01-01", fim: "9999-12-31", comp: di },
    ...(cdi.moveis || []).filter(m => m.janela === "30d" || m.janela === "90d")
      .map(m => ({ id: m.janela, label: m.janela === "30d" ? "30 dias" : "90 dias", ini: menosDias(m.janela === "30d" ? 30 : 90), fim: "9999-12-31", comp: m })),
    ...(cdi.mensais || []).slice(-3).reverse().map(m => {
      const [a, mm] = m.mes.split("-")
      const fimMes = new Date(+a, +mm, 0).toISOString().slice(0, 10)
      return { id: m.mes, label: m.label.split("/")[0], ini: `${m.mes}-01`, fim: fimMes, comp: m }
    }),
  ] : []
  const per = periodos.find(p => p.id === periodo) || periodos[0] || null
  const naJanela = (iso) => !per || (iso >= per.ini && iso <= per.fim)
  const isoSaida = (h) => { const d = new Date(h.data_saida); return isNaN(d) ? "" : d.toISOString().slice(0, 10) }
  const fechP = fechados.filter(h => naJanela(isoSaida(h)))
  const venP = fechP.filter(h => plVal(h) >= 0), perP = fechP.filter(h => plVal(h) < 0)
  const acertoP = fechP.length ? venP.length / fechP.length * 100 : null
  const ganhoMedP = venP.length ? venP.reduce((a, h) => a + plPct(h), 0) / venP.length : 0
  const perdaMedP = perP.length ? perP.reduce((a, h) => a + plPct(h), 0) / perP.length : 0
  const melhorP = fechP.length ? fechP.reduce((a, b) => plPct(a) > plPct(b) ? a : b) : null
  const piorP = fechP.length ? fechP.reduce((a, b) => plPct(a) < plPct(b) ? a : b) : null
  const diasP = fechP.filter(h => h.dias_duracao > 0)
  const tempoMedP = diasP.length ? diasP.reduce((a, h) => a + parseInt(h.dias_duracao), 0) / diasP.length : null
  const porTradeP = fechP.length ? fechP.reduce((a, h) => a + plPct(h), 0) / fechP.length : null
  const porDiaP = diasP.length ? diasP.reduce((a, h) => a + plPct(h) / parseInt(h.dias_duracao), 0) / diasP.length : null
  const comp = per?.comp

  // Série acumulada (backend /financeiro/cdi → serie). Num período, recomeça do zero no início dele.
  const serieTudo = (cdi?.serie || [])
  const serieP = (() => {
    const antes = serieTudo.filter(p => p.data < (per?.ini || "0000")).slice(-1)[0]
    const r0 = antes ? antes.real : 0, c0 = antes ? antes.cdi : 0
    let topo = 0
    return serieTudo.filter(p => naJanela(p.data)).map(p => {
      const real = +(p.real - r0).toFixed(2), cdiv = +(p.cdi - c0).toFixed(2)
      topo = Math.max(topo, real)
      return { ...p, real, cdi: cdiv, drawdown: +(real - topo).toFixed(2), rot: p.data.split("-").reverse().slice(0, 2).join("/") }
    })
  })()
  const piorTombo = serieTudo.length ? Math.min(...serieTudo.map(p => p.drawdown)) : 0
  const tomboRecuperado = serieTudo.length ? serieTudo[serieTudo.length - 1].drawdown === 0 : true

  // Bloco 01: retrato de hoje (mesma conta do Portfólio)
  const rg = resultadoGeral
  const realPreco = rg ? rg.realizado_preco : lucroRealizadoPreco
  const divF = rg ? rg.dividendos_fechados : divFechados
  const aberto = rg ? rg.aberto : lucroAberto
  const positivo = Math.max(0, realPreco) + Math.max(0, divF)
  const escala = Math.max(positivo, Math.abs(Math.min(0, aberto)), 1) * 1.05
  const wReal = Math.max(0, realPreco) / escala * 100, wDiv = Math.max(0, divF) / escala * 100
  const wAberto = Math.abs(Math.min(0, aberto)) / escala * 100
  const posTotal = Math.max(0, Math.min(100, (Math.max(0, realPreco) + Math.max(0, divF) + Math.min(0, aberto)) / escala * 100))
  const vantagem = di ? di.ganho_real - di.ganho_cdi : null

  const mesesP = (cdi?.mensais || []).filter(m => naJanela(`${m.mes}-15`))
  const mensalP = mensalReais.filter(m => {
    const nomes = { Jan: "01", Fev: "02", Mar: "03", Abr: "04", Mai: "05", Jun: "06", Jul: "07", Ago: "08", Set: "09", Out: "10", Nov: "11", Dez: "12" }
    const [mn, a] = m.label.split("/")
    return naJanela(`${a}-${nomes[mn]}-15`)
  })
  const compradoP = fechP.reduce((a, h) => a + (parseFloat(h.preco_entrada) || 0) * (parseFloat(h.quantidade) || 0), 0)
  const vendidoP = fechP.reduce((a, h) => a + (parseFloat(h.preco_saida) || 0) * (parseFloat(h.quantidade) || 0), 0)
  const sobrouP = vendidoP - compradoP
  const nomeMesCurto = (label) => label.split("/")[0].slice(0, 3)

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* CABEÇALHO + PERÍODO */}
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: "12px" }}>
        <div>
          <h1 className="fi-titulo" style={{ margin: 0, fontSize: "24px", fontWeight: 700 }}>Financeiro</h1>
          <span style={{ fontSize: "12px", color: "var(--fi-texto-4)" }}>Performance da operação{temCDI ? ` · CDI atual ${String(cdi.cdi_atual).replace(".", ",")}% a.a.` : ""}</span>
        </div>
        {periodos.length > 0 && (
          <div role="group" aria-label="Período" style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {periodos.map(p => {
              const on = per && p.id === per.id
              return (
                <button key={p.id} type="button" onClick={() => setPeriodo(p.id)} aria-pressed={on} style={{
                  height: "32px", padding: "0 14px", borderRadius: "999px", fontSize: "12px", cursor: "pointer",
                  border: `1px solid ${on ? "rgba(56,189,248,0.6)" : "var(--fi-borda-forte)"}`, background: on ? "rgba(56,189,248,0.14)" : "transparent",
                  color: on ? "var(--fi-texto)" : "var(--fi-texto-3)", boxShadow: on ? "0 0 14px rgba(56,189,248,0.25)" : "none" }}>{p.label}</button>
              )
            })}
          </div>
        )}
      </div>

      {/* 01 · PERFORMANCE */}
      <section aria-label="Performance">
        <Bloco n="01" txt="Performance · estou ganhando dinheiro? (retrato de hoje)" />
        <div style={{ display: "flex", flexWrap: "wrap", gap: "18px" }}>
          <div style={{ flex: "999 1 560px", minWidth: 0, padding: "22px 24px", borderRadius: "18px",
            background: "linear-gradient(135deg, rgba(56,189,248,0.10), rgba(13,24,41,0.85) 55%)", border: "1px solid rgba(56,189,248,0.45)",
            boxShadow: "0 0 40px rgba(56,189,248,0.12), inset 0 1px 0 rgba(255,255,255,0.04)" }}>
            <div style={rotulo}>Resultado total</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: "14px", flexWrap: "wrap", marginTop: "6px" }}>
              <span style={num(resultadoTotal >= 0 ? "#38BDF8" : "#FB6474", 52, resultadoTotal >= 0 ? "rgba(56,189,248,0.55)" : null)}>{brlS(resultadoTotal)}</span>
              {capitalTotal > 0 && (
                <span style={{ padding: "4px 10px", borderRadius: "999px", fontSize: "12px", fontWeight: 600,
                  background: resultadoTotal >= 0 ? "rgba(34,211,160,0.12)" : "rgba(251,100,116,0.12)", border: `1px solid ${resultadoTotal >= 0 ? "rgba(34,211,160,0.4)" : "rgba(251,100,116,0.4)"}`,
                  color: resultadoTotal >= 0 ? "#22D3A0" : "#FB6474" }}>
                  {fmtPct(resultadoTotal / capitalTotal * 100)} sobre {fmtBRL(capitalTotal)} movimentados
                </span>
              )}
            </div>
            <div style={{ marginTop: "20px", fontSize: "11px", color: "var(--fi-texto-4)" }}>De onde vem o resultado</div>
            <div role="img" aria-label="Composição do resultado: realizado, dividendos e em aberto"
              style={{ position: "relative", height: "34px", marginTop: "8px", borderRadius: "10px", background: "#0A1424", border: "1px solid var(--fi-borda)", overflow: "hidden" }}>
              <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${wReal}%`, background: "linear-gradient(90deg, rgba(34,211,160,0.15), rgba(34,211,160,0.55))" }} />
              <div style={{ position: "absolute", left: `${wReal}%`, top: 0, bottom: 0, width: `${wDiv}%`, background: "rgba(251,191,36,0.65)" }} />
              {wAberto > 0 && <div style={{ position: "absolute", left: `${Math.max(0, wReal + wDiv - wAberto)}%`, top: 0, bottom: 0, width: `${Math.min(wAberto, wReal + wDiv)}%`,
                background: "repeating-linear-gradient(135deg, rgba(251,100,116,0.5) 0 6px, rgba(251,100,116,0.25) 6px 12px)", borderLeft: "2px solid #FB6474" }} />}
              <div style={{ position: "absolute", left: `${posTotal}%`, top: "-4px", bottom: "-4px", width: "2px", background: "#38BDF8", boxShadow: "0 0 10px #38BDF8" }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "14px", marginTop: "14px" }}>
              {[
                ["#22D3A0", "Realizado (vendido)", realPreco, `${totalTrades} trades fechados`],
                ["#FBBF24", "Dividendos e JCP", divF, "dos trades fechados"],
                ["#FB6474", "Em aberto (pode mudar)", aberto, `${posicoes.length} posições · ${fmtPct(pctAberto)}`],
              ].map(([cor, txt, v, s]) => (
                <div key={txt}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "var(--fi-texto-3)" }}><span style={{ width: 8, height: 8, borderRadius: 2, background: cor }} />{txt}</div>
                  <div style={{ fontSize: "20px", fontWeight: 600, color: v >= 0 ? (cor === "#FB6474" ? "#22D3A0" : cor) : "#FB6474", marginTop: "2px" }}>{brlS(v)}</div>
                  <div style={sub}>{s}</div>
                </div>
              ))}
            </div>
            {proventos && (proventos.a_receber > 0 || proventos.abertas_liquido > 0) && (
              <div style={{ ...sub, marginTop: "10px" }}>Proventos a receber {fmtBRL(proventos.a_receber)} · das posições abertas {fmtBRL(proventos.abertas_liquido)} (ainda fora do resultado).</div>
            )}
          </div>

          <div style={{ flex: "1 1 300px", display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={card({ flex: 1 })}>
              <div style={rotulo}>Vantagem sobre o CDI</div>
              {di ? (
                <>
                  <div style={{ ...num(vantagem >= 0 ? "#22D3A0" : "#FB6474", 30, vantagem >= 0 ? "rgba(34,211,160,0.45)" : null), marginTop: "6px" }}>{brlS(vantagem)}</div>
                  <div style={{ fontSize: "12px", color: "var(--fi-texto-3)", marginTop: "4px" }}>o CDI teria rendido {fmtBRL(di.ganho_cdi)} no mesmo dinheiro e prazo</div>
                  <div style={{ display: "flex", gap: "8px", marginTop: "12px", flexWrap: "wrap" }}>
                    <span style={{ padding: "3px 9px", borderRadius: "999px", background: "#132238", border: "1px solid #1E3352", color: "#C8D4E6", fontSize: "11px" }}>{di.diferenca_pct >= 0 ? "+" : ""}{di.diferenca_pct.toFixed(2).replace(".", ",")} pp</span>
                    {di.pct_do_cdi != null && <span style={{ padding: "3px 9px", borderRadius: "999px", background: "#132238", border: "1px solid #1E3352", color: "#C8D4E6", fontSize: "11px" }}>{(di.pct_do_cdi / 100).toFixed(1).replace(".", ",")}× o CDI</span>}
                  </div>
                </>
              ) : <div style={sub}>sem trades fechados ainda</div>}
            </div>
            <div style={card({ flex: 1 })}>
              <div style={rotulo}>Pior tombo (drawdown)</div>
              <div style={{ ...num(piorTombo < 0 ? "#FB6474" : "var(--fi-texto)", 30), marginTop: "6px" }}>{piorTombo < 0 ? brlS(piorTombo) : "R$ 0,00"}</div>
              <div style={{ fontSize: "12px", color: "var(--fi-texto-3)", marginTop: "4px" }}>maior queda do lucro realizado a partir de um topo{piorTombo < 0 ? (tomboRecuperado ? " · já recuperado" : " · ainda abaixo do topo") : ""}</div>
            </div>
          </div>
        </div>
      </section>

      {/* 02 · × CDI */}
      {serieP.length > 1 && (
        <section aria-label="Comparação com o CDI">
          <Bloco n="02" txt={`TradeAI × CDI · estou superando o CDI? · ${per?.label || ""}`} />
          <div style={card()}>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "10px", alignItems: "baseline", marginBottom: "10px" }}>
              <h2 style={tituloCard}>Lucro realizado acumulado × o que o CDI renderia no mesmo capital</h2>
              {comp && comp.ok && <span style={{ fontSize: "12px", color: comp.bateu_cdi ? "#22D3A0" : "#FB6474", fontWeight: 600 }}>
                {fmtBRL(comp.ganho_real)} × {fmtBRL(comp.ganho_cdi)} do CDI · {comp.diferenca_pct >= 0 ? "+" : ""}{comp.diferenca_pct.toFixed(2).replace(".", ",")} pp</span>}
            </div>
            <div style={{ height: "270px" }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={serieP} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="fiArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#38BDF8" stopOpacity={0.35} /><stop offset="1" stopColor="#38BDF8" stopOpacity={0} /></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#132238" vertical={false} />
                  <XAxis dataKey="rot" tick={eixo} minTickGap={36} axisLine={false} tickLine={false} />
                  <YAxis tick={eixo} tickFormatter={(v) => `R$${v}`} width={56} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipEstilo} cursor={{ stroke: "#1E3352" }}
                    formatter={(v, n) => [fmtBRL(v), n === "real" ? "TradeAI" : "CDI no mesmo capital"]}
                    labelFormatter={(l, p) => p && p[0] ? `${l} · ${(p[0].payload.tickers || []).join(", ")}` : l} />
                  <Legend formatter={(v) => v === "real" ? "TradeAI" : "CDI"} wrapperStyle={{ fontSize: "12px", color: "#9DB0CB" }} />
                  <Area type="monotone" dataKey="real" stroke="#38BDF8" strokeWidth={3} fill="url(#fiArea)" dot={false} style={{ filter: "drop-shadow(0 0 6px rgba(56,189,248,0.8))" }} />
                  <Area type="monotone" dataKey="cdi" stroke="#7E93B2" strokeWidth={2} strokeDasharray="6 5" fill="transparent" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>
      )}

      {/* 03 · EVOLUÇÃO */}
      <section aria-label="Evolução">
        <Bloco n="03" txt="Evolução · o resultado é consistente? qual foi o pior período?" />
        <div style={{ display: "flex", flexWrap: "wrap", gap: "18px" }}>
          {mesesP.length > 0 && (
            <div style={card({ flex: "1 1 520px", minWidth: 0 })}>
              <h2 style={{ ...tituloCard, marginBottom: "10px" }}>Mês a mês · lucro realizado × CDI (R$)</h2>
              <div style={{ height: "240px" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={mesesP.map(m => ({ nome: `${nomeMesCurto(m.label)} · ${m.trades} trades`, real: m.ganho_real, cdi: m.ganho_cdi }))} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#132238" vertical={false} />
                    <XAxis dataKey="nome" tick={eixo} axisLine={false} tickLine={false} />
                    <YAxis tick={eixo} tickFormatter={(v) => `R$${v}`} width={52} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v, n) => [fmtBRL(v), n === "real" ? "TradeAI" : "CDI"]} contentStyle={tooltipEstilo} cursor={{ fill: "rgba(56,189,248,0.06)" }} />
                    <Bar dataKey="real" fill="#38BDF8" radius={[6, 6, 0, 0]} style={{ filter: "drop-shadow(0 0 6px rgba(56,189,248,0.5))" }} />
                    <Bar dataKey="cdi" fill="#2A3B55" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
          {serieP.length > 1 && (
            <div style={card({ flex: "1 1 420px", minWidth: 0 })}>
              <h2 style={{ ...tituloCard, marginBottom: "10px" }}>Drawdown · quanto o lucro caiu desde o último topo</h2>
              <div style={{ height: "200px" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={serieP} margin={{ top: 6, right: 10, left: 0, bottom: 0 }}>
                    <defs><linearGradient id="fiDd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FB6474" stopOpacity={0.05} /><stop offset="1" stopColor="#FB6474" stopOpacity={0.45} /></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#132238" vertical={false} />
                    <XAxis dataKey="rot" tick={eixo} minTickGap={36} axisLine={false} tickLine={false} />
                    <YAxis tick={eixo} tickFormatter={(v) => `R$${v}`} width={52} axisLine={false} tickLine={false} domain={["dataMin", 0]} />
                    <Tooltip formatter={(v) => [fmtBRL(v), "Abaixo do topo"]} contentStyle={tooltipEstilo} />
                    <Area type="stepAfter" dataKey="drawdown" stroke="#FB6474" strokeWidth={2} fill="url(#fiDd)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div style={{ ...sub, marginTop: "8px" }}>Zero = no topo. Com {fechP.length} trades fechados é um retrato do passado recente, não uma estatística firme.</div>
            </div>
          )}
        </div>
      </section>

      {/* 04 · ESTATÍSTICAS */}
      <section aria-label="Estatísticas">
        <Bloco n="04" txt={`Estatísticas · as operações estão boas? · ${per?.label || ""}`} />
        <div style={{ display: "flex", flexWrap: "wrap", gap: "18px" }}>
          <div style={card({ flex: "1 1 300px", display: "flex", alignItems: "center", gap: "18px" })}>
            {(() => {
              const r = 50, C = 2 * Math.PI * r, f = acertoP != null ? Math.max(0.02, acertoP / 100) : 0.02
              return (
                <svg width="120" height="120" viewBox="0 0 120 120" role="img" aria-label={`Acerto de ${acertoP != null ? acertoP.toFixed(0) : "—"}%`} style={{ flex: "none" }}>
                  <defs><linearGradient id="fiAc" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#2563EB" /><stop offset="1" stopColor="#22D3A0" /></linearGradient></defs>
                  <circle cx="60" cy="60" r={r} fill="none" stroke="#132238" strokeWidth="9" />
                  <circle cx="60" cy="60" r={r} fill="none" stroke="url(#fiAc)" strokeWidth="9" strokeLinecap="round" strokeDasharray={`${(C * f).toFixed(1)} ${C.toFixed(1)}`}
                    transform="rotate(-90 60 60)" style={{ filter: "drop-shadow(0 0 6px rgba(34,211,160,0.6))" }} />
                  <text x="60" y="60" textAnchor="middle" fill="#E6EDF7" fontFamily="Space Grotesk, Inter, sans-serif" fontSize="26" fontWeight="700">{acertoP != null ? `${acertoP.toFixed(0)}%` : "—"}</text>
                  <text x="60" y="78" textAnchor="middle" fill="#7E93B2" fontFamily="Inter, sans-serif" fontSize="10">acerto</text>
                </svg>
              )
            })()}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12.5px", color: "var(--fi-texto-3)" }}>
              <span><b style={{ color: "#22D3A0" }}>{venP.length}</b> com lucro</span>
              <span><b style={{ color: "#FB6474" }}>{perP.length}</b> com prejuízo</span>
              <span>tempo médio <b style={{ color: "var(--fi-texto)" }}>{tempoMedP != null ? `${tempoMedP.toFixed(0)} dias` : "—"}</b></span>
            </div>
          </div>
          <div style={card({ flex: "1 1 360px" })}>
            <h2 style={{ ...tituloCard, marginBottom: "14px" }}>Quando acerta × quando erra</h2>
            {(() => {
              const m = Math.max(Math.abs(ganhoMedP), Math.abs(perdaMedP), 1)
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {[["Ganho médio", ganhoMedP, "linear-gradient(90deg, #2563EB, #22D3A0)", "#22D3A0"], ["Perda média", perdaMedP, "linear-gradient(90deg, #7F1D1D, #FB6474)", "#FB6474"]].map(([t, v, g, c]) => (
                    <div key={t}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}><span style={{ color: "var(--fi-texto-3)" }}>{t}</span><b style={{ color: c }}>{fmtPct(v)}</b></div>
                      <div style={{ height: "8px", borderRadius: "999px", background: "#132238", marginTop: "5px", overflow: "hidden" }}>
                        <div style={{ width: `${Math.abs(v) / m * 100}%`, height: "8px", borderRadius: "999px", background: g, boxShadow: `0 0 10px ${c}80` }} />
                      </div>
                    </div>
                  ))}
                  {perP.length > 0 && ganhoMedP > 0 && <div style={{ fontSize: "12px", color: "var(--fi-texto-3)" }}>Ganha <b style={{ color: "var(--fi-texto)" }}>{(ganhoMedP / Math.abs(perdaMedP)).toFixed(1).replace(".", ",")}×</b> mais quando acerta do que perde quando erra.</div>}
                </div>
              )
            })()}
          </div>
          <div style={{ flex: "1 1 300px", display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "14px" }}>
            {[
              ["Melhor trade", melhorP ? fmtPct(plPct(melhorP)) : "—", "#22D3A0", melhorP ? String(melhorP.ticker).replace(".SA", "") : ""],
              ["Pior trade", piorP ? fmtPct(plPct(piorP)) : "—", "#FB6474", piorP ? String(piorP.ticker).replace(".SA", "") : ""],
              ["Por trade", porTradeP != null ? fmtPct(porTradeP) : "—", "var(--fi-texto)", "média"],
              ["Por dia", porDiaP != null ? fmtPct(porDiaP) : "—", "var(--fi-texto)", "média por dia investido"],
            ].map(([t, v, c, s]) => (
              <div key={t} style={card({ padding: "14px 16px" })}>
                <div style={rotulo}>{t}</div>
                <div style={{ ...num(c, 21), marginTop: "4px" }}>{v}</div>
                <div style={sub}>{s}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 05 · MOVIMENTAÇÃO */}
      <section aria-label="Movimentação">
        <Bloco n="05" txt={`Movimentação · o caminho do dinheiro · ${per?.label || ""}`} />
        <div style={card()}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
            {[
              ["Comprei", fmtBRL(compradoP), vendidoP > 0 ? compradoP / Math.max(compradoP, vendidoP) * 100 : 0, "#7E93B2", `${fechP.length} trades fechados`, false],
              ["Recebi de volta", fmtBRL(vendidoP), vendidoP > 0 ? vendidoP / Math.max(compradoP, vendidoP) * 100 : 0, "linear-gradient(90deg, #2563EB, #38BDF8)", "vendas dos mesmos trades", false],
              ["Sobrou", brlS(sobrouP), compradoP > 0 ? Math.min(100, Math.abs(sobrouP) / compradoP * 100) : 0, sobrouP >= 0 ? "#22D3A0" : "#FB6474", compradoP > 0 ? `${fmtPct(sobrouP / compradoP * 100)} sobre o comprado` : "", true],
            ].map(([t, v, w, cor, s, destaque]) => (
              <div key={t} style={{ padding: "16px", borderRadius: "14px", background: destaque ? "linear-gradient(135deg, rgba(34,211,160,0.12), #0A1424 60%)" : "#0A1424",
                border: `1px solid ${destaque ? (sobrouP >= 0 ? "rgba(34,211,160,0.45)" : "rgba(251,100,116,0.45)") : "#1E3352"}` }}>
                <div style={rotulo}>{t}</div>
                <div style={{ ...num(destaque ? (sobrouP >= 0 ? "#22D3A0" : "#FB6474") : "var(--fi-texto)", 24, destaque && sobrouP >= 0 ? "rgba(34,211,160,0.5)" : null), marginTop: "4px" }}>{v}</div>
                <div style={{ height: "6px", borderRadius: "999px", background: "#132238", marginTop: "10px", overflow: "hidden" }}>
                  <div style={{ width: `${w}%`, height: "6px", borderRadius: "999px", background: cor }} />
                </div>
                <div style={{ ...sub, marginTop: "6px", color: destaque ? (sobrouP >= 0 ? "#22D3A0" : "#FB6474") : "var(--fi-texto-4)" }}>{s}</div>
              </div>
            ))}
          </div>

          {mensalP.length > 0 && (
            <div style={{ overflowX: "auto", marginTop: "18px" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", minWidth: "560px" }}>
                <thead>
                  <tr>{["Mês", "Trades", "Comprado", "Vendido", "Resultado", "% do CDI"].map(h => (
                    <th key={h} style={{ padding: "8px 10px", textAlign: h === "Mês" ? "left" : "right", color: "#5F7391", fontSize: "10.5px", fontWeight: 500, textTransform: "uppercase", letterSpacing: "1.1px" }}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {mensalP.map((m, i) => {
                    const c = (cdi?.mensais || []).find(x => x.label.slice(0, 3) === m.label.slice(0, 3) && x.label.endsWith(m.label.split("/")[1]))
                    return (
                      <tr key={i} style={{ borderTop: "1px solid #101D31" }}>
                        <td style={{ padding: "11px 10px" }}>{m.label}</td>
                        <td style={{ padding: "11px 10px", textAlign: "right", color: "var(--fi-texto-3)" }}>{m.trades}</td>
                        <td style={{ padding: "11px 10px", textAlign: "right", color: "var(--fi-texto-3)" }}>{fmtBRL(m.comprado)}</td>
                        <td style={{ padding: "11px 10px", textAlign: "right" }}>{fmtBRL(m.vendido)}</td>
                        <td style={{ padding: "11px 10px", textAlign: "right", fontWeight: 600, color: m.resultado >= 0 ? "#22D3A0" : "#FB6474" }}>{brlS(m.resultado)}</td>
                        <td style={{ padding: "11px 10px", textAlign: "right", color: "var(--fi-texto-2)" }}>{c && c.pct_do_cdi != null ? `${c.pct_do_cdi.toFixed(0)}%` : "—"}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <div style={{ fontSize: "11px", color: "#5F7391" }}>
        O CDI equivalente é calculado sobre o mesmo capital de cada trade, pelos dias exatos em que ficou investido. O bloco 01 é sempre o retrato de hoje; o seletor de período muda os blocos 02 a 05.
      </div>
    </div>
  )
}
