import { useState, useEffect, useRef } from "react"
import api from "../services/api"
import Top5Card from "./Top5Card"

const API = import.meta.env.VITE_API_URL

export default function Mercado() {
  const [sinais, setSinais] = useState([])
  const [loading, setLoading] = useState(true)
  const [rodando, setRodando] = useState(false)
  const [atualizandoPrecos, setAtualizandoPrecos] = useState(false)
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState(null)
  const [filtroMercado, setFiltroMercado] = useState("TODOS")
  const [precosAtuais, setPrecosAtuais] = useState({})
  const [totalAnalisados, setTotalAnalisados] = useState(0)
  const [bannerStatus, setBannerStatus] = useState(null) // null | "executando" | "concluido"
  const [sinaisAntesDoScan, setSinaisAntesDoScan] = useState(0)
  const [ordenacao, setOrdenacao] = useState({ campo: null, direcao: "desc" })
  const [favoritados, setFavoritados] = useState({})  // { ticker: "ok" | "erro" } feedback do botão ⭐
  const [dividendosSinais, setDividendosSinais] = useState({})  // { "VIVT3.SA": {data_com, valor_bruto, ...} } — próximas datas-com (22/10/2026)
  const [insiders, setInsiders] = useState({})  // { "PETR4.SA": {sinal, tooltip, ...} } — insiders 👔 (27/10/2026)
  const [saude, setSaude] = useState({})  // { "DIRR3.SA": {selo, tooltip, ...} } — selo de saúde financeira (23/10/2026)
  const [scannerB, setScannerB] = useState({})  // { "ASAI3.SA": {desconto, dist_mediana, pico_pct, alvo_b, tamanho_b} } — Scanner B (09/11/2026)
  const [atrAgora, setAtrAgora] = useState({})  // { "GOGL34.SA": {atr_cor, atr_margem_pct, ...} } — ATR com o preço do momento (BDRs)
  const [sel, setSel] = useState(null)  // ativo escolhido na lista (painel de análise + gráfico) — 10/11/2026
  const [grafico, setGrafico] = useState({ ticker: null, velas: [], carregando: false, erro: null })
  const pollingRef = useRef(null)
  // ── BDRs (06/10/2026) ──
  // Cada sinal americano com BDR na lista oficial vira TAMBÉM uma linha própria,
  // mercado "BDR", com preço/alvo/stop em reais e o ATR DO BDR. A análise da
  // empresa (sinal, desconto, sentimento) é a da ação original.
  const criarLinhasBdr = (dados) => {
    const vistos = new Set()
    const linhas = []
    for (const s of dados) {
      if (!s.bdr_ok || !s.bdr_codigo || vistos.has(s.bdr_codigo)) continue
      vistos.add(s.bdr_codigo)
      linhas.push({
        ...s,
        ticker: s.bdr_ticker,
        nome: `${s.nome || s.ticker} (BDR)`,
        mercado: "BDR",
        preco_atual: s.bdr_preco,
        alvo_lucro: s.bdr_alvo,
        stop_loss: s.bdr_stop,
        pct_alvo: null,
        pct_stop: null,
        mme_20: null,
        // 13/11/2026: "esticado" do BDR = o da ação original (MME20 em US$ não pode
        // ser comparada ao preço em R$; o percentual não depende da moeda).
        _esticado: (parseFloat(s.preco_atual) && parseFloat(s.mme_20))
          ? (parseFloat(s.preco_atual) - parseFloat(s.mme_20)) / parseFloat(s.mme_20) * 100 : null,
        volume: s.bdr_vol_30d,
        atr_cor: s.bdr_atr_cor,
        atr_linha: s.bdr_atr_linha,
        atr_falta_pct: s.bdr_atr_falta_pct,
        atr_margem_pct: s.bdr_atr_margem_pct,
        atr_desde: s.bdr_atr_desde,
        atr_data_ref: s.bdr_data_ref,
        _bdr: true,
        _original: s.ticker,
      })
    }
    return linhas
  }
  const fmtDiaMes = (iso) => iso ? String(iso).slice(0, 10).split("-").reverse().slice(0, 2).join("/") : ""
  // Pregão que o scanner deveria ter usado: antes das 18h, o dia útil anterior;
  // depois, o próprio dia. (Feriado americano pode gerar um aviso falso.)
  const fechamentoEsperado = (criado) => {
    const d = new Date(criado)
    if (isNaN(d.getTime())) return null
    if (d.getHours() < 18) d.setDate(d.getDate() - 1)
    while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  }
  const carregarSinais = () => {
    setLoading(true)
    api.get(`${API}/sinais`)
      .then(r => {
        const dados = r.data.dados || []
        setTotalAnalisados(dados.length)
        // Ordem padrao: COMPRAR antes de MANTER, sem criterio de qualidade
        // dentro de cada grupo. A confianca nao entra: a auditoria mostrou que
        // ela e anti-preditiva (sinais abaixo de 70 renderam mais).
        const filtrados = [...dados, ...criarLinhasBdr(dados)].filter(s => s.sinal !== "EVITAR")
        filtrados.sort((a, b) => {
          if (a.sinal === "COMPRAR" && b.sinal !== "COMPRAR") return -1
          if (a.sinal !== "COMPRAR" && b.sinal === "COMPRAR") return 1
          return 0
        })
                setSinais(filtrados)
        // Próximas datas-com dos sinais COMPRAR da B3 (22/10/2026) — carrega depois, não atrasa a tabela
        const compraB3 = [...new Set(filtrados.filter(x => x.sinal === "COMPRAR" && String(x.ticker || "").toUpperCase().endsWith(".SA")).map(x => x.ticker.toUpperCase()))].slice(0, 60)
        if (compraB3.length) {
          api.post(`${API}/dividendos/proximos`, { tickers: compraB3, dias: 30 })
            .then(p => { if (p.data.sucesso) setDividendosSinais(p.data.dados || {}) })
            .catch(() => {})
        }
        // Selo de saúde financeira (23/10/2026) — todos os sinais B3; carrega depois, não atrasa a tabela
        const todosB3 = [...new Set(filtrados.filter(x => String(x.ticker || "").toUpperCase().endsWith(".SA")).map(x => x.ticker.toUpperCase()))].slice(0, 150)
        if (todosB3.length) {
          api.post(`${API}/fundamentos/saude`, { tickers: todosB3 })
            .then(p => { if (p.data.sucesso) setSaude(p.data.dados || {}) })
            .catch(() => {})
          api.post(`${API}/insiders`, { tickers: todosB3 })
            .then(p => { if (p.data.sucesso) setInsiders(p.data.dados || {}) })
            .catch(() => {})
          // Scanner B (sombra, 09/11/2026): desconto pela mediana, pico e alvo B — só informa
          api.get(`${API}/scanner-b`)
            .then(p => {
              if (!p.data.sucesso) return
              const m = {}
              ;(p.data.sinais || []).forEach(x => { m[String(x.ticker || "").toUpperCase()] = x })
              setScannerB(m)
            })
            .catch(e => console.warn("Scanner B indisponível:", e?.message))
        }
        const bdrTickers = filtrados.filter(x => x._bdr).map(x => x.ticker)
        if (bdrTickers.length) {
          api.post(`${API}/precos`, { tickers: bdrTickers })
            .then(p => { if (p.data.sucesso) setPrecosAtuais(prev => ({ ...prev, ...p.data.precos })) })
            .catch(() => {})
          // ATR de agora dos BDRs (15/10/2026) — carrega depois, não atrasa a tabela
          api.post(`${API}/mercado/atr-agora`, { tickers: bdrTickers })
            .then(p => { if (p.data.sucesso) setAtrAgora(p.data.dados || {}) })
            .catch(() => {})
        }
      })
      .catch(() => { setSinais([]); setTotalAnalisados(0) })
      .finally(() => {
        setLoading(false)
        setUltimaAtualizacao(new Date().toLocaleTimeString("pt-BR"))
      })
  }

  const iniciarPolling = () => {
    if (pollingRef.current) return
    pollingRef.current = setInterval(async () => {
      try {
        const res = await api.get(`${API}/scanner/status`)
        if (res.data.mercado === "ocioso") {
          pararPolling()
          setRodando(false)
          setBannerStatus("concluido")
          carregarSinais()
          setTimeout(() => setBannerStatus(null), 5000)
        }
      } catch {
        // silencia erros de polling
      }
    }, 15000) // verifica a cada 15s
  }

  const pararPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }

  useEffect(() => {
    carregarSinais()
    // Verifica se o scanner já está rodando ao carregar a página
    api.get(`${API}/scanner/status`).then(res => {
      if (res.data.mercado === "executando") {
        setRodando(true)
        setBannerStatus("executando")
        iniciarPolling()
      }
    }).catch(() => {})
    return () => pararPolling()
  }, [])

  const rodarScanner = async () => {
    try {
      const res = await api.post(`${API}/rodar-scanner`)
      if (res.data.sucesso) {
        setSinaisAntesDoScan(sinais.length)
        setRodando(true)
        setBannerStatus("executando")
        setPrecosAtuais({})
        iniciarPolling()
      } else {
        alert(res.data.erro || "Erro ao rodar o scanner.")
      }
    } catch {
      alert("Erro ao rodar o scanner.")
    }
  }

  const atualizarPrecos = async () => {
    if (sinais.length === 0) return
    setAtualizandoPrecos(true)
    try {
      const tickers = [...new Set(sinais.map(s => s.ticker))]
      const res = await api.post(`${API}/precos`, { tickers })
      if (res.data.sucesso) {
        setPrecosAtuais(res.data.precos)
        setUltimaAtualizacao(new Date().toLocaleTimeString("pt-BR"))
      }
    } catch {
      console.error("Erro ao atualizar preços")
    } finally {
      setAtualizandoPrecos(false)
    }
  }

  const adicionarPortfolio = async (s) => {
    const precoAtual = precosAtuais[s.ticker] || parseFloat(s.preco_atual)
    try {
      const res = await api.post(`${API}/portfolio`, {
        ticker: s.ticker,
        nome: s.nome,
        mercado: s._bdr ? "B3" : s.mercado,
        quantidade: 1,
        preco_medio: precoAtual,
        alvo_lucro: parseFloat(s.alvo_lucro) || null,
        stop_loss: parseFloat(s.stop_loss) || null,
        pct_alvo: parseFloat(s.pct_alvo) || null,
        pct_stop: parseFloat(s.pct_stop) || null,
        origem: "longo"
      })
      if (res.data.sucesso) {
        alert(`${s.ticker} adicionado ao portfólio! Alvo: ${moeda(s)} ${parseFloat(s.alvo_lucro).toFixed(2)} | Stop: ${moeda(s)} ${parseFloat(s.stop_loss).toFixed(2)}`)
      } else {
        alert(res.data.erro || `Erro ao adicionar ${s.ticker} ao portfólio.`)
      }
    } catch {
      alert(`Erro ao adicionar ${s.ticker} ao portfólio.`)
    }
  }

    const moeda = (s) => (s.mercado === "B3" || s.mercado === "BDR") ? "R$" : "US$"

  // ── Envia um ativo do scanner direto para a aba Favoritos (observação) ──
  // Fica no Mercado após clicar (permite marcar vários) e dá feedback no botão.
  const adicionarFavorito = async (s) => {
    try {
      const res = await api.post(`${API}/favoritos`, {
        ticker: s.ticker,
        nome: s.nome,
        mercado: s._bdr ? "B3" : s.mercado,
      })
      const ok = res.data && res.data.sucesso !== false
      setFavoritados(prev => ({ ...prev, [s.ticker]: ok ? "ok" : "erro" }))
      setTimeout(() => {
        setFavoritados(prev => {
          const novo = { ...prev }
          delete novo[s.ticker]
          return novo
        })
      }, 2500)
    } catch {
      setFavoritados(prev => ({ ...prev, [s.ticker]: "erro" }))
      setTimeout(() => {
        setFavoritados(prev => {
          const novo = { ...prev }
          delete novo[s.ticker]
          return novo
        })
      }, 2500)
    }
  }

  const formatarData = (data) => {
    if (!data) return ""
    return new Date(data).toLocaleDateString("pt-BR", {
      day: "2-digit", month: "2-digit",
      hour: "2-digit", minute: "2-digit"
    })
  }

  const formatarPreco = (valor) => {
    if (!valor) return "—"
    return parseFloat(valor).toLocaleString("pt-BR", {
      minimumFractionDigits: 2, maximumFractionDigits: 2
    })
  }

  const getPrecoExibir = (s) => precosAtuais[s.ticker] || parseFloat(s.preco_atual)

  const calcularVariacao = (s) => {
    const precoNovo = precosAtuais[s.ticker]
    const precoAntigo = parseFloat(s.preco_atual)
    if (!precoNovo || precoNovo === precoAntigo) return null
    return parseFloat(((precoNovo - precoAntigo) / precoAntigo * 100).toFixed(2))
  }

  // ── ORDENACAO POR COLUNA ──
  // Extrai o valor comparavel de cada campo. Nulos vao sempre pro fim,
  // independente da direcao, pra nao poluir o topo da lista.
  const valorOrdenacao = (s, campo) => {
    const preco = parseFloat(s.preco_atual) || 0
    switch (campo) {
      case "ticker":    return s.ticker || ""
      case "nome":      return s.nome || ""
      case "sinal":     return s.sinal === "COMPRAR" ? 1 : 0
      case "saude": {
        const sl = saude[String(s.ticker || "").toUpperCase()]?.selo
        return sl === "🟢" ? 3 : sl === "🟡" ? 2 : sl === "🔴" ? 1 : null
      }
      case "atr":       return s.atr_cor === "VERDE" ? 1 : s.atr_cor === "VERMELHO" ? 0 : null
      case "desconto":  return s.dist_media_6m != null ? parseFloat(s.dist_media_6m) : null
      case "esticado":  if (s._bdr) return s._esticado ?? null
                        return (s.mme_20 != null && parseFloat(s.mme_20) > 0)
                          ? ((preco - parseFloat(s.mme_20)) / parseFloat(s.mme_20)) * 100 : null
      case "volume":    return s.volume != null ? parseFloat(s.volume) : null
      case "preco":     return preco
      case "alvo":      return parseFloat(s.alvo_lucro) || null
      case "stop":      return parseFloat(s.stop_loss) || null
      case "sentim":    return s.score_sentimento != null ? parseFloat(s.score_sentimento) : null
      case "data":      return s.criado_em ? new Date(s.criado_em).getTime() : null
      case "teto": {
        const al = parseFloat(s.alvo_lucro), st = parseFloat(s.stop_loss)
        return (al && st) ? (al + 1.5 * st) / 2.5 : null
      }
      case "rr": {
        const al = parseFloat(s.alvo_lucro), st = parseFloat(s.stop_loss)
        return (preco && al && st && preco > st) ? (al - preco) / (preco - st) : null
      }
      default:          return null
    }
  }

  const alternarOrdenacao = (campo) => {
    setOrdenacao(prev => prev.campo === campo
      ? { campo, direcao: prev.direcao === "asc" ? "desc" : "asc" }
      : { campo, direcao: "asc" })
  }

    const mercados = ["TODOS", "B3", "BDR", "NASDAQ", "NYSE", "CRYPTO", "COMMODITY"]
  const sinaisPorMercado = filtroMercado === "TODOS" ? sinais : sinais.filter(s => s.mercado === filtroMercado)
  const sinaisFiltrados = (() => {
    if (!ordenacao.campo) return sinaisPorMercado
    const copia = [...sinaisPorMercado]
    copia.sort((a, b) => {
      const va = valorOrdenacao(a, ordenacao.campo)
      const vb = valorOrdenacao(b, ordenacao.campo)
      if (va == null && vb == null) return 0
      if (va == null) return 1
      if (vb == null) return -1
      const cmp = typeof va === "string" ? va.localeCompare(vb) : va - vb
      return ordenacao.direcao === "asc" ? cmp : -cmp
    })
    return copia
  })()
    const totalComprar = sinais.filter(s => s.sinal === "COMPRAR" && !s._bdr).length
  const totalManter = sinais.filter(s => s.sinal === "MANTER" && !s._bdr).length
  const temPrecosAtuais = Object.keys(precosAtuais).length > 0

  // ── Future Intelligence (10/11/2026): cálculos para a tela nova (só exibição) ──
  const num = (v) => { const n = parseFloat(v); return isNaN(n) ? null : n }
  const tetoDe = (s) => { const a = num(s.alvo_lucro), st = num(s.stop_loss); return (a && st) ? (a + 1.5 * st) / 2.5 : null }
  const rrDe = (s) => { const p = num(s.preco_atual), a = num(s.alvo_lucro), st = num(s.stop_loss); return (p && a && st && p > st) ? (a - p) / (p - st) : null }
  const esticadoDe = (s) => { if (s._bdr) return s._esticado ?? null; const p = num(s.preco_atual), m = num(s.mme_20); return (p && m) ? (p - m) / m * 100 : null }
  const pctTxt = (v, casas = 1) => v == null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(casas).replace(".", ",")}%`
  const chave = (s) => String(s.ticker || "").toUpperCase()

  const selecionado = sinais.find(s => chave(s) === sel) || sinaisFiltrados.find(s => s.sinal === "COMPRAR") || sinaisFiltrados[0] || null
  const selKey = selecionado ? chave(selecionado) : null
  // Gráfico do ativo escolhido (velas + ATR) — rota /mercado/grafico (10/11/2026)
  useEffect(() => {
    if (!selKey) return
    let vivo = true
    setGrafico({ ticker: selKey, velas: [], carregando: true, erro: null })
    api.get(`${API}/mercado/grafico/${selKey}`, { params: { pregoes: 90 } })
      .then(r => { if (vivo) setGrafico({ ticker: selKey, velas: r.data.sucesso ? (r.data.velas || []) : [], carregando: false, erro: r.data.sucesso ? null : (r.data.erro || "erro") }) })
      .catch(e => { if (vivo) setGrafico({ ticker: selKey, velas: [], carregando: false, erro: e?.message || "sem resposta" }) })
    return () => { vivo = false }
  }, [selKey])

  const totalFalso = sinais.filter(s => s.sinal === "COMPRAR" && scannerB[chave(s)]?.desconto === "FALSO").length

  const pill = (cor, fundo, borda) => ({
    display: "inline-flex", alignItems: "center", gap: "4px", padding: "3px 9px", borderRadius: "999px",
    fontSize: "11px", fontWeight: 600, whiteSpace: "nowrap", color: cor, background: fundo, border: `1px solid ${borda}`,
  })
  const PILL_OK = pill("#22D3A0", "rgba(34,211,160,0.10)", "rgba(34,211,160,0.35)")
  const PILL_WARN = pill("#FBBF24", "rgba(251,191,36,0.10)", "rgba(251,191,36,0.35)")
  const PILL_BAD = pill("#FB6474", "rgba(251,100,116,0.10)", "rgba(251,100,116,0.35)")
  const PILL_NEU = pill("#9DB0CB", "#132238", "#1E3352")
  const tituloPainel = { margin: 0, fontSize: "13px", fontWeight: 600, color: "var(--fi-texto-2)" }
  const botaoSec = (ativo = true) => ({
    height: "34px", padding: "0 16px", borderRadius: "999px", border: "1px solid var(--fi-borda-forte)",
    background: ativo ? "rgba(56,189,248,0.08)" : "#132238", color: ativo ? "var(--fi-texto)" : "var(--fi-texto-4)",
    fontSize: "12px", cursor: ativo ? "pointer" : "default", display: "inline-flex", alignItems: "center", gap: "8px",
  })
  const girando = (cor) => (
    <span style={{ width: "12px", height: "12px", border: `2px solid ${cor}`, borderTopColor: "transparent", borderRadius: "50%",
      display: "inline-block", animation: "spin 0.8s linear infinite" }} />
  )

  // Anel com brilho (risco/retorno, radar)
  const Anel = ({ tam, r, esp, frac, cor, grad, children }) => {
    const C = 2 * Math.PI * r, f = Math.max(0.03, Math.min(1, frac || 0)), c = tam / 2
    return (
      <svg width={tam} height={tam} viewBox={`0 0 ${tam} ${tam}`} aria-hidden="true" style={{ flex: "none" }}>
        {grad && <defs><linearGradient id={grad} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#2563EB" /><stop offset="1" stopColor="#22D3A0" /></linearGradient></defs>}
        <circle cx={c} cy={c} r={r} fill="none" stroke="#132238" strokeWidth={esp} />
        <circle cx={c} cy={c} r={r} fill="none" stroke={grad ? `url(#${grad})` : cor} strokeWidth={esp} strokeLinecap="round"
          strokeDasharray={`${(C * f).toFixed(1)} ${C.toFixed(1)}`} transform={`rotate(-90 ${c} ${c})`}
          style={{ filter: "drop-shadow(0 0 6px rgba(56,189,248,0.55))" }} />
        {children}
      </svg>
    )
  }

  // ── Gráfico de velas com alvo, teto, stop e ATR (21,3) ──
  const Grafico = () => {
    if (!selecionado) return null
    if (grafico.carregando || grafico.ticker !== selKey) return <div style={{ height: "250px", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--fi-texto-4)", fontSize: "12px" }}>Carregando gráfico…</div>
    if (grafico.erro || !grafico.velas.length) return <div style={{ height: "250px", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--fi-texto-4)", fontSize: "12px" }}>Gráfico indisponível agora ({grafico.erro || "sem dados"}).</div>
    const v = grafico.velas, alvo = num(selecionado.alvo_lucro), stop = num(selecionado.stop_loss), teto = tetoDe(selecionado)
    const valores = v.flatMap(x => [x.h, x.l]).concat([alvo, stop].filter(Boolean))
    const lo = Math.min(...valores) * 0.995, hi = Math.max(...valores) * 1.005, H = 250
    const y = (p) => (1 - (p - lo) / (hi - lo)) * H
    const cw = 100 / v.length
    const linha = (p, cor, rotulo, abaixo) => p == null ? null : (
      <div style={{ position: "absolute", left: 0, right: 0, top: `${y(p)}px`, borderTop: `1px dashed ${cor}`, boxShadow: `0 0 8px ${cor}` }}>
        <span style={{ position: "absolute", right: "6px", top: abaixo ? "4px" : "-18px", fontSize: "10px", fontWeight: 600, color: cor,
          background: "rgba(4,7,13,0.7)", padding: "0 4px", borderRadius: "4px" }}>{rotulo} {moeda(selecionado)} {formatarPreco(p)}</span>
      </div>
    )
    return (
      <div role="img" aria-label={`Gráfico de velas de ${selecionado.ticker} com alvo, teto, stop e ATR`}
        style={{ position: "relative", height: `${H}px`, borderRadius: "10px", overflow: "hidden",
          backgroundImage: "linear-gradient(rgba(56,189,248,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.04) 1px, transparent 1px)",
          backgroundSize: "100% 50px, 60px 100%" }}>
        {v.map((x, i) => {
          const up = x.c >= x.o, cor = up ? "#22D3A0" : "#FB6474", left = (i + 0.5) * cw
          const bt = y(Math.max(x.o, x.c)), bb = y(Math.min(x.o, x.c))
          return (
            <div key={i} title={`${x.data.split("-").reverse().join("/")} · abertura ${formatarPreco(x.o)} · máx ${formatarPreco(x.h)} · mín ${formatarPreco(x.l)} · fech ${formatarPreco(x.c)}${x.atr ? ` · ATR ${formatarPreco(x.atr)}` : ""}`}>
              <div style={{ position: "absolute", left: `calc(${left}% - 0.5px)`, top: `${y(x.h)}px`, height: `${Math.max(1, y(x.l) - y(x.h))}px`, width: "1px", background: cor, opacity: 0.8 }} />
              <div style={{ position: "absolute", left: `calc(${left}% - ${Math.max(1.5, Math.min(4, cw * 3))}px)`, top: `${bt}px`, height: `${Math.max(1.5, bb - bt)}px`,
                width: `${Math.max(3, Math.min(8, cw * 6))}px`, borderRadius: "1.5px", background: cor, boxShadow: `0 0 6px ${up ? "rgba(34,211,160,0.45)" : "rgba(251,100,116,0.4)"}` }} />
              {x.atr != null && x.atr > lo && x.atr < hi && (
                <div style={{ position: "absolute", left: `calc(${left}% - 2px)`, top: `${y(x.atr) - 2}px`, width: "4px", height: "4px", borderRadius: "50%",
                  background: x.atr_cor === "VERDE" ? "#A3E635" : "#FB6474", opacity: 0.85 }} />
              )}
            </div>
          )
        })}
        {linha(alvo, "#22D3A0", "alvo")}
        {linha(teto, "#38BDF8", "teto")}
        {linha(stop, "#FB6474", "stop", true)}
      </div>
    )
  }

  // ── Painel de análise do ativo selecionado ──
  const PainelAnalise = () => {
    if (!selecionado) return (
      <div className="fi-painel" style={{ padding: "18px", color: "var(--fi-texto-4)", fontSize: "13px" }}>Clique num ativo da lista para ver a análise.</div>
    )
    const s = selecionado, k = chave(s)
    const teto = tetoDe(s), rr = rrDe(s), esticado = esticadoDe(s)
    const preco = num(s.preco_atual), agora = precosAtuais[s.ticker] ? num(precosAtuais[s.ticker]) : preco
    const alvo = num(s.alvo_lucro), stop = num(s.stop_loss)
    const b = scannerB[k], sd = saude[k], ins = insiders[k], dv = dividendosSinais[k]
    const mma = num(s.mma_200), rsi = num(s.rsi), fech = num(s.posicao_fechamento), vol = num(s.volume), desc = num(s.dist_media_6m)
    const checks = [
      ["Abaixo da MMA200", mma && preco ? (preco < mma ? "sim" : "não") : "—", mma && preco ? preco < mma : null],
      ["Desconto ≤ −9%", pctTxt(desc), desc != null ? desc <= -9 : null],
      ["RSI entre 36 e 46", rsi != null ? rsi.toFixed(0) : "—", rsi != null ? rsi >= 36 && rsi <= 46 : null],
      ["Esticado ≤ 0 (MME20)", pctTxt(esticado), esticado != null ? esticado <= 0 : null],
      ["Fechamento > 80%", fech != null ? `${fech.toFixed(0)}%` : "—", fech != null ? fech > 80 : null],
      ["Volume ≥ 5 mi", vol != null ? `${(vol / 1e6).toFixed(1).replace(".", ",")} mi` : "—", vol != null ? vol >= 5e6 : null],
      ["R/R ≥ 1,5", rr != null ? `${rr.toFixed(2).replace(".", ",")}x` : "—", rr != null ? rr >= 1.5 : null],
    ]
    const okCount = checks.filter(c => c[2] === true).length
    const folga = teto && agora ? (teto / agora - 1) * 100 : null
    const barra = (v, cor) => ({ width: "38px", height: `${Math.max(6, Math.min(90, Math.abs(v || 0) / 12 * 90))}px`, borderRadius: "6px 6px 0 0",
      background: `linear-gradient(180deg, ${cor}, rgba(37,99,235,0.25))`, boxShadow: `0 0 12px ${cor}` })
    return (
      <aside aria-label="Análise do ativo" style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
        <section className="fi-painel" style={{ padding: "18px", borderColor: "var(--fi-borda-forte)", boxShadow: "inset 0 0 40px rgba(56,189,248,0.05)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
            <h2 style={tituloPainel}>Plano da operação · {s.ticker}</h2>
            <span style={s.sinal === "COMPRAR" ? PILL_OK : PILL_WARN}>{s.sinal}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "18px", marginTop: "14px" }}>
            <Anel tam={120} r={50} esp={9} frac={rr ? rr / 3 : 0} cor={rr >= 1.5 ? "#38BDF8" : "#FBBF24"}>
              <text x="60" y="60" textAnchor="middle" fill="#E6EDF7" fontFamily="Space Grotesk, Inter, sans-serif" fontSize="24" fontWeight="700">{rr ? rr.toFixed(1).replace(".", ",") : "—"}</text>
              <text x="60" y="78" textAnchor="middle" fill="#7E93B2" fontFamily="Inter, sans-serif" fontSize="10">risco/retorno</text>
            </Anel>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: 0 }}>
              <span style={{ fontSize: "10px", color: "var(--fi-texto-4)", textTransform: "uppercase", letterSpacing: "1.2px" }}>Comprar até (teto)</span>
              <span className="fi-titulo" style={{ fontSize: "32px", fontWeight: 600, color: "#38BDF8", textShadow: "0 0 22px rgba(56,189,248,0.5)" }}>{moeda(s)} {formatarPreco(teto)}</span>
              <span style={{ fontSize: "11px", color: "var(--fi-texto-3)" }}>
                agora {moeda(s)} {formatarPreco(agora)} · {folga == null ? "" : folga >= 0 ? `cabe ${folga.toFixed(1).replace(".", ",")}% acima` : "preço já acima do teto"}
              </span>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "10px", marginTop: "16px" }}>
            <div style={{ padding: "12px", borderRadius: "12px", background: "rgba(34,211,160,0.06)", border: "1px solid rgba(34,211,160,0.2)" }}>
              <div style={{ fontSize: "11px", color: "var(--fi-texto-4)" }}>Alvo</div>
              <div style={{ fontSize: "17px", fontWeight: 600, color: "#22D3A0", marginTop: "2px" }}>{moeda(s)} {formatarPreco(alvo)} <span style={{ fontSize: "12px" }}>{alvo && preco ? pctTxt((alvo / preco - 1) * 100) : ""}</span></div>
              <div style={{ fontSize: "10.5px", color: "var(--fi-texto-3)", marginTop: "2px" }}>
                {b?.tamanho_b === "NAO" ? "Scanner B: não operaria" : b?.alvo_b != null && alvo && Math.abs(b.alvo_b - alvo) >= 0.01 ? `alvo B (mediana): ${moeda(s)} ${formatarPreco(b.alvo_b)}` : "alvo B igual ao oficial"}
              </div>
            </div>
            <div style={{ padding: "12px", borderRadius: "12px", background: "rgba(251,100,116,0.06)", border: "1px solid rgba(251,100,116,0.2)" }}>
              <div style={{ fontSize: "11px", color: "var(--fi-texto-4)" }}>Stop (fechamento)</div>
              <div style={{ fontSize: "17px", fontWeight: 600, color: "#FB6474", marginTop: "2px" }}>{moeda(s)} {formatarPreco(stop)} <span style={{ fontSize: "12px" }}>{stop && preco ? pctTxt((stop / preco - 1) * 100) : ""}</span></div>
              <div style={{ fontSize: "10.5px", color: "var(--fi-texto-3)", marginTop: "2px" }}>a tese morre abaixo da mínima recente</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px", marginTop: "14px", flexWrap: "wrap" }}>
            <button type="button" onClick={() => adicionarPortfolio(s)} style={{ ...botaoSec(), background: "rgba(34,211,160,0.12)", borderColor: "rgba(34,211,160,0.4)", color: "#22D3A0", fontWeight: 600 }}>+ Portfólio</button>
            <button type="button" onClick={() => adicionarFavorito(s)} style={botaoSec()}>
              {favoritados[s.ticker] === "ok" ? "✓ nos Favoritos" : favoritados[s.ticker] === "erro" ? "✕ erro" : "⭐ Favoritos"}
            </button>
          </div>
        </section>

        <section className="fi-painel" style={{ padding: "18px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <h2 style={tituloPainel}>Checklist do método</h2><span style={{ fontSize: "11px", color: "var(--fi-texto-3)" }}>{okCount} de 7</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {checks.map(([rot, val, ok]) => (
              <div key={rot} style={{ display: "flex", justifyContent: "space-between", gap: "12px", fontSize: "12.5px" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "10px", color: "var(--fi-texto-2)" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: ok == null ? "#5F7391" : ok ? "#22D3A0" : "#FBBF24",
                    boxShadow: ok == null ? "none" : `0 0 6px ${ok ? "rgba(34,211,160,0.7)" : "rgba(251,191,36,0.6)"}` }} />{rot}
                </span>
                <span style={{ fontWeight: 600 }}>{val}</span>
              </div>
            ))}
          </div>
        </section>

        {b && (
          <section className="fi-painel" style={{ padding: "18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={tituloPainel}>Desconto real ou falso</h2>
              <span style={b.desconto === "FALSO" ? PILL_WARN : b.desconto === "REAL" ? PILL_OK : PILL_NEU}>
                {b.desconto === "FALSO" ? "Desconto falso" : b.desconto === "REAL" ? "Desconto real" : "Sem desconto"}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-around", gap: "14px", height: "118px", marginTop: "14px", padding: "0 10px", borderBottom: "1px solid var(--fi-borda)" }}>
              {[[b.dist_media, "#38BDF8", pctTxt(b.dist_media)], [b.dist_mediana, b.desconto === "FALSO" ? "#FBBF24" : "#22D3A0", pctTxt(b.dist_mediana)],
                [b.pico_pct / 50 * 12, b.pico_pct >= 40 ? "#FB6474" : "#2563EB", `+${(b.pico_pct || 0).toFixed(0)}%`]].map(([v, cor, rot], i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", flex: 1 }}>
                  <span style={{ fontSize: "12px", fontWeight: 600 }}>{rot}</span><div style={barra(v, cor)} />
                </div>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-around", gap: "14px", marginTop: "6px", fontSize: "10.5px", color: "var(--fi-texto-4)", textAlign: "center" }}>
              <span style={{ flex: 1 }}>pela média</span><span style={{ flex: 1 }}>pela mediana</span><span style={{ flex: 1 }}>pico de 6m</span>
            </div>
            <div style={{ marginTop: "12px", fontSize: "12px", color: "var(--fi-texto-3)" }}>
              Scanner B (teste): {b.tamanho_b === "NAO" ? "não operaria — sem espaço até o preço normal." : b.tamanho_b === "MEIA" ? "meia posição — pela mediana o desconto quase some." : "posição cheia — barato pela média e pela mediana."}
            </div>
          </section>
        )}

        <section className="fi-painel" style={{ padding: "18px", background: "radial-gradient(400px 200px at 0% 0%, rgba(56,189,248,0.10), transparent 70%), var(--fi-painel)" }}>
          <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
            <svg width="56" height="56" viewBox="0 0 64 64" aria-hidden="true" style={{ flex: "none" }}>
              <defs><radialGradient id="fiOrb" cx="0.4" cy="0.35" r="0.7"><stop offset="0" stopColor="#7DD3FC" /><stop offset="0.55" stopColor="#2563EB" /><stop offset="1" stopColor="#0B1426" /></radialGradient></defs>
              <circle cx="32" cy="32" r="29" fill="none" stroke="#22D3A0" strokeWidth="1.5" strokeDasharray="120 62" style={{ filter: "drop-shadow(0 0 4px rgba(34,211,160,0.7))" }} />
              <circle cx="32" cy="32" r="22" fill="url(#fiOrb)" />
              <text x="32" y="36" textAnchor="middle" fill="#E6EDF7" fontFamily="Space Grotesk, Inter, sans-serif" fontSize="12" fontWeight="700">IA</text>
            </svg>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <h2 style={tituloPainel}>Leitura da IA</h2>
                <span style={{ fontSize: "10.5px", color: "#5F7391" }}>confiança {s.confianca ?? "—"} · não é critério</span>
              </div>
              <p style={{ margin: "8px 0 0", fontSize: "12.5px", lineHeight: 1.6, color: "var(--fi-texto-2)" }}>{s.justificativa || "Sem justificativa gravada."}</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "10px" }}>
                {sd && <span title={sd.tooltip} style={sd.selo === "🟢" ? PILL_OK : sd.selo === "🟡" ? PILL_WARN : sd.selo === "🔴" ? PILL_BAD : PILL_NEU}>Saúde {sd.selo === "🟢" ? "OK" : sd.selo === "🟡" ? "atenção" : sd.selo === "🔴" ? "alerta" : "s/ dados"}</span>}
                {ins?.sinal && <span title={ins.tooltip} style={ins.sinal === "compra" ? PILL_OK : ins.sinal === "venda" ? PILL_BAD : PILL_WARN}>👔 insiders {ins.sinal}</span>}
                {dv && <span style={PILL_WARN}>data-com {fmtDiaMes(dv.data_com)} · R$ {dv.valor_bruto.toFixed(2).replace(".", ",")}</span>}
                {s.score_sentimento != null && <span style={PILL_NEU}>sentimento {parseFloat(s.score_sentimento) > 0 ? "+" : ""}{parseFloat(s.score_sentimento).toFixed(2)}</span>}
                <span style={PILL_NEU}>sinal de {formatarData(s.criado_em)}</span>
              </div>
            </div>
          </div>
        </section>
      </aside>
    )
  }

  const colunas = [
    { label: "Ativo", campo: "ticker", w: "150px" },
    { label: "Sinal", campo: "sinal", w: "96px" },
    { label: "Preço", campo: "preco", w: "92px" },
    { label: "Teto", campo: "teto", w: "92px" },
    { label: "Alvo", campo: "alvo", w: "98px" },
    { label: "Stop", campo: "stop", w: "92px" },
    { label: "R/R", campo: "rr", w: "58px" },
    { label: "ATR (21,3)", campo: "atr", w: "112px" },
    { label: "Desconto", campo: "desconto", w: "88px" },
    { label: "Esticado", campo: "esticado", w: "76px" },
    { label: "Volume", campo: "volume", w: "68px" },
    { label: "Saúde", campo: "saude", w: "82px" },
    { label: "", campo: null, w: "44px" },
  ]
  const grade = colunas.map(c => c.w).join(" ")

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "18px" }}>
      {/* Cabeçalho da aba */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 className="fi-titulo" style={{ margin: 0, fontSize: "24px", fontWeight: 700 }}>Mercado</h1>
          <span style={{ color: "var(--fi-texto-4)", fontSize: "12px" }}>
            Sinais da última rodada{ultimaAtualizacao ? ` · ${temPrecosAtuais ? "preços atualizados às" : "carregado às"} ${ultimaAtualizacao}` : ""}
          </span>
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button type="button" onClick={atualizarPrecos} disabled={atualizandoPrecos || sinais.length === 0} style={botaoSec(!atualizandoPrecos && sinais.length > 0)}>
            {atualizandoPrecos ? <>{girando("#9DB0CB")} Atualizando…</> : "Atualizar preços"}
          </button>
          <button type="button" onClick={rodarScanner} disabled={rodando} title="O scanner já roda sozinho às 3h. Use só se precisar de uma rodada extra."
            style={botaoSec(!rodando)}>
            {rodando ? <>{girando("#9DB0CB")} Analisando…</> : "Rodar scanner"}
          </button>
        </div>
      </div>

      {bannerStatus === "executando" && (
        <div className="fi-painel" style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: "12px", borderColor: "rgba(251,191,36,0.4)" }}>
          {girando("#FBBF24")}
          <div>
            <p style={{ margin: 0, color: "#FBBF24", fontWeight: 600, fontSize: "13px" }}>Scanner em execução…</p>
            <p style={{ margin: "2px 0 0", color: "var(--fi-texto-3)", fontSize: "12px" }}>Leva de 15 a 20 minutos. A página atualiza sozinha quando terminar.</p>
          </div>
        </div>
      )}
      {bannerStatus === "concluido" && (
        <div className="fi-painel" style={{ padding: "14px 18px", borderColor: "rgba(34,211,160,0.4)" }}>
          <p style={{ margin: 0, color: "#22D3A0", fontWeight: 600, fontSize: "13px" }}>Scanner concluído — {totalComprar} COMPRAR encontrado(s).</p>
        </div>
      )}

      {/* Top 5 do dia (28/10/2026) — análise automática do backend — primeiro bloco da aba (10/11/2026) */}
      <Top5Card />

      {/* Radar + gráfico */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "18px", alignItems: "stretch" }}>
        <section aria-label="Radar do dia" className="fi-painel" style={{ flex: "1 1 300px", padding: "18px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <h2 style={tituloPainel}>Radar do dia</h2><span style={{ fontSize: "11px", color: "var(--fi-texto-4)" }}>{totalAnalisados} na rodada</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "18px", marginTop: "14px" }}>
            <Anel tam={140} r={58} esp={10} frac={(totalComprar + totalManter) ? totalComprar / (totalComprar + totalManter) : 0} grad="fiRadar">
              <text x="70" y="70" textAnchor="middle" fill="#E6EDF7" fontFamily="Space Grotesk, Inter, sans-serif" fontSize="34" fontWeight="700">{totalComprar}</text>
              <text x="70" y="90" textAnchor="middle" fill="#7E93B2" fontFamily="Inter, sans-serif" fontSize="11">COMPRAR</text>
            </Anel>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "12px", flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}><span style={{ color: "var(--fi-texto-3)" }}>Comprar</span><b style={{ color: "#22D3A0" }}>{totalComprar}</b></div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}><span style={{ color: "var(--fi-texto-3)" }}>Manter</span><b style={{ color: "#FBBF24" }}>{totalManter}</b></div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}><span style={{ color: "var(--fi-texto-3)" }}>Desconto falso</span><b style={{ color: "#FBBF24" }}>{totalFalso}</b></div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}><span style={{ color: "var(--fi-texto-3)" }}>Total na rodada</span><b>{totalAnalisados}</b></div>
            </div>
          </div>
        </section>

        <section aria-label="Gráfico do ativo" className="fi-painel" style={{ flex: "999 1 560px", minWidth: 0, padding: "18px" }}>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "baseline", gap: "8px", marginBottom: "12px" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: "10px", flexWrap: "wrap" }}>
              <h2 className="fi-titulo" style={{ margin: 0, fontSize: "22px", fontWeight: 700 }}>{selecionado ? selecionado.ticker.replace(".SA", "") : "—"}</h2>
              {selecionado && <span style={{ fontSize: "12px", color: "var(--fi-texto-3)" }}>{selecionado.nome} · últimos 90 pregões</span>}
            </div>
            <div style={{ display: "flex", gap: "14px", fontSize: "11px", color: "var(--fi-texto-3)", flexWrap: "wrap" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}><span style={{ width: 14, height: 2, background: "#22D3A0" }} />alvo</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}><span style={{ width: 14, height: 2, background: "#38BDF8" }} />teto</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}><span style={{ width: 14, height: 2, background: "#FB6474" }} />stop</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: "#A3E635" }} />ATR (21,3)</span>
            </div>
          </div>
          <Grafico />
        </section>
      </div>

      {/* Lista de sinais + análise */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "18px", alignItems: "flex-start" }}>
        <section aria-label="Sinais da rodada" className="fi-painel" style={{ flex: "999 1 640px", minWidth: 0, overflow: "hidden" }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "12px", padding: "16px 18px", borderBottom: "1px solid var(--fi-borda)" }}>
            <h2 className="fi-titulo" style={{ margin: 0, fontSize: "18px", fontWeight: 600 }}>Sinais da rodada</h2>
            <div role="group" aria-label="Filtro por mercado" style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {mercados.map(m => {
                const on = filtroMercado === m
                return (
                  <button key={m} type="button" onClick={() => setFiltroMercado(m)} style={{
                    height: "30px", padding: "0 12px", borderRadius: "999px", cursor: "pointer", fontSize: "11.5px",
                    border: `1px solid ${on ? "rgba(56,189,248,0.6)" : "var(--fi-borda-forte)"}`,
                    background: on ? "rgba(56,189,248,0.14)" : "transparent", color: on ? "var(--fi-texto)" : "var(--fi-texto-3)",
                    boxShadow: on ? "0 0 14px rgba(56,189,248,0.25)" : "none" }}>
                    {m === "TODOS" ? "Todos" : m}
                  </button>
                )
              })}
              {ordenacao.campo && (
                <button type="button" onClick={() => setOrdenacao({ campo: null, direcao: "desc" })}
                  style={{ height: "30px", padding: "0 12px", borderRadius: "999px", cursor: "pointer", fontSize: "11.5px", border: "1px solid var(--fi-borda-forte)", background: "transparent", color: "#38BDF8" }}>
                  Limpar ordenação
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: "50px", color: "var(--fi-texto-4)" }}>Carregando sinais…</div>
          ) : sinaisFiltrados.length === 0 ? (
            <div style={{ textAlign: "center", padding: "50px", color: "var(--fi-texto-4)", fontSize: "13px" }}>
              {totalAnalisados > 0 ? `${totalAnalisados} ativo(s) na rodada, nenhum COMPRAR ou MANTER neste filtro.` : "Nenhum sinal disponível. O scanner roda sozinho às 3h."}
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <div style={{ minWidth: "1150px", opacity: atualizandoPrecos ? 0.45 : 1, transition: "opacity 0.3s" }}>
                <div style={{ display: "grid", gridTemplateColumns: grade, gap: "8px", padding: "10px 18px", fontSize: "10.5px", color: "#5F7391", textTransform: "uppercase", letterSpacing: "1.1px" }}>
                  {colunas.map(c => {
                    const ativa = ordenacao.campo === c.campo && c.campo
                    return c.campo ? (
                      <button key={c.label} type="button" onClick={() => alternarOrdenacao(c.campo)}
                        style={{ all: "unset", cursor: "pointer", color: ativa ? "#38BDF8" : "#5F7391" }}>
                        {c.label} <span style={{ fontSize: "9px", opacity: ativa ? 1 : 0.35 }}>{ativa ? (ordenacao.direcao === "asc" ? "▲" : "▼") : "⇅"}</span>
                      </button>
                    ) : <span key={c.label || "acao"} />
                  })}
                </div>
                {sinaisFiltrados.map((s, i) => {
                  const k = chave(s), escolhido = k === selKey
                  const precoExibir = getPrecoExibir(s), variacao = calcularVariacao(s)
                  const teto = tetoDe(s), rr = rrDe(s), esticado = esticadoDe(s)
                  const preco = num(s.preco_atual), alvo = num(s.alvo_lucro), stop = num(s.stop_loss)
                  const desc = num(s.dist_media_6m), volMi = num(s.volume) != null ? num(s.volume) / 1e6 : null
                  const b = scannerB[k], sd = saude[k], dv = s.sinal === "COMPRAR" ? dividendosSinais[k] : null
                  const verde = s.atr_cor === "VERDE", distAtr = verde ? num(s.atr_margem_pct) : num(s.atr_falta_pct)
                  return (
                    <div key={k + i} role="button" tabIndex={0} onClick={() => setSel(k)}
                      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSel(k) } }}
                      aria-pressed={escolhido}
                      style={{ display: "grid", gridTemplateColumns: grade, gap: "8px", alignItems: "center", padding: "12px 18px", cursor: "pointer",
                        borderTop: "1px solid #101D31", fontSize: "12.5px",
                        background: escolhido ? "linear-gradient(90deg, rgba(56,189,248,0.14), rgba(56,189,248,0))" : "transparent",
                        boxShadow: escolhido ? "inset 3px 0 0 #38BDF8" : "none" }}>
                      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                        <span style={{ fontWeight: 600, fontSize: "14px" }}>{s.ticker.replace(".SA", "")}</span>
                        <span style={{ fontSize: "11px", color: "var(--fi-texto-4)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {s._bdr ? `BDR de ${s._original}` : s.mercado !== "B3" ? `${s.mercado} · ${s.nome}` : s.nome}
                        </span>
                        {dv && <span title={`Data-com ${fmtDiaMes(dv.data_com)} · ${dv.tipos.join(" + ")} de R$ ${dv.valor_bruto.toFixed(4)}/ação. No dia ex o preço abre mais baixo: é o provento, não stop.`}
                          style={{ fontSize: "10px", color: "#FBBF24", marginTop: "2px" }}>data-com {dv.dias_ate === 0 ? "hoje" : dv.dias_ate === 1 ? "amanhã" : fmtDiaMes(dv.data_com)}</span>}
                        {s.mercado !== "B3" && s.atr_data_ref && fechamentoEsperado(s.criado_em) && s.atr_data_ref < fechamentoEsperado(s.criado_em) && (
                          <span style={{ fontSize: "10px", color: "#FBBF24" }}>fech. {fmtDiaMes(s.atr_data_ref)} (atrasado)</span>
                        )}
                      </div>
                      <span><span style={s.sinal === "COMPRAR" ? PILL_OK : PILL_WARN}>{s.sinal}</span></span>
                      <span style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ color: "var(--fi-texto-2)" }}>{formatarPreco(precoExibir)}</span>
                        {variacao !== null && <span style={{ fontSize: "10px", color: variacao >= 0 ? "#22D3A0" : "#FB6474" }}>{variacao >= 0 ? "▲" : "▼"} {Math.abs(variacao)}%</span>}
                      </span>
                      <span style={{ color: "#38BDF8", fontWeight: 600 }}>{formatarPreco(teto)}</span>
                      <span style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ color: "#22D3A0" }}>{alvo && preco ? pctTxt((alvo / preco - 1) * 100) : "—"}</span>
                        {b?.tamanho_b === "NAO" ? <span style={{ fontSize: "10px", color: "#FBBF24" }}>B: não opera</span>
                          : b?.alvo_b != null && alvo && Math.abs(b.alvo_b - alvo) >= 0.01 ? <span style={{ fontSize: "10px", color: "#38BDF8" }}>B: {formatarPreco(b.alvo_b)}</span> : null}
                      </span>
                      <span style={{ color: "#FB6474" }}>{stop && preco ? pctTxt((stop / preco - 1) * 100) : "—"}</span>
                      <span style={{ color: rr != null && rr < 1.5 ? "#FBBF24" : "var(--fi-texto-2)" }}>{rr != null ? `${rr.toFixed(2).replace(".", ",")}x` : "—"}</span>
                      <span style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        {s.atr_cor ? (
                          <>
                            <span title={`ATR (21,3) no dia do sinal · linha ${formatarPreco(s.atr_linha)}`} style={verde ? PILL_OK : PILL_BAD}>
                              {verde ? "alta" : "queda"}{distAtr != null ? ` · ${verde ? "" : "falta "}${distAtr.toFixed(1).replace(".", ",")}%` : ""}
                            </span>
                            <span style={{ height: "3px", width: "90px", borderRadius: "2px", background: "#132238", overflow: "hidden" }}>
                              <span style={{ display: "block", height: "3px", width: `${Math.min(100, (distAtr || 0) / 8 * 100)}%`, background: verde ? "#22D3A0" : "#FB6474", boxShadow: `0 0 6px ${verde ? "#22D3A0" : "#FB6474"}` }} />
                            </span>
                            {s._bdr && atrAgora[s.ticker]?.atr_cor && (
                              <span style={{ fontSize: "10px", color: atrAgora[s.ticker].atr_cor === "VERDE" ? "#22D3A0" : "#FB6474" }}>agora {atrAgora[s.ticker].atr_cor === "VERDE" ? "alta" : "queda"}</span>
                            )}
                          </>
                        ) : <span style={{ color: "#5F7391" }}>—</span>}
                      </span>
                      <span style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontWeight: 600, color: desc == null ? "#5F7391" : desc <= -5 ? "#22D3A0" : desc < 0 ? "var(--fi-texto-3)" : "#FB6474" }}>{desc != null ? pctTxt(desc) : "—"}</span>
                        {b && b.desconto && b.desconto !== "SEM" && <span style={{ fontSize: "10px", fontWeight: 600, color: b.desconto === "FALSO" ? "#FBBF24" : "#22D3A0" }}>{b.desconto === "FALSO" ? "falso" : "real"}</span>}
                      </span>
                      <span style={{ color: esticado == null ? "#5F7391" : Math.abs(esticado) <= 2 ? "#22D3A0" : esticado <= 5 ? "#FBBF24" : "#FB6474" }}>{pctTxt(esticado)}</span>
                      <span style={{ color: volMi == null ? "#5F7391" : volMi >= 5 ? "#22D3A0" : volMi >= 2 ? "#FBBF24" : "#FB6474" }}>{volMi != null ? `${volMi.toFixed(1).replace(".", ",")}M` : "—"}</span>
                      <span title={sd?.tooltip} style={{ fontSize: "11px", fontWeight: 600, color: !sd ? "#5F7391" : sd.selo === "🟢" ? "#22D3A0" : sd.selo === "🟡" ? "#FBBF24" : sd.selo === "🔴" ? "#FB6474" : "#5F7391" }}>
                        {!sd ? "—" : sd.selo === "🟢" ? "OK" : sd.selo === "🟡" ? "Atenção" : sd.selo === "🔴" ? "Alerta" : "s/ dados"}
                        {insiders[k]?.sinal && <span style={{ display: "block", fontSize: "10px", color: insiders[k].sinal === "compra" ? "#22D3A0" : insiders[k].sinal === "venda" ? "#FB6474" : "#FBBF24" }}>👔 {insiders[k].sinal}</span>}
                      </span>
                      <button type="button" title="Enviar para Favoritos" aria-label={`Enviar ${s.ticker} para Favoritos`}
                        onClick={e => { e.stopPropagation(); adicionarFavorito(s) }}
                        style={{ width: "32px", height: "32px", borderRadius: "999px", border: "1px solid var(--fi-borda-forte)", cursor: "pointer",
                          background: favoritados[s.ticker] === "ok" ? "rgba(34,211,160,0.15)" : favoritados[s.ticker] === "erro" ? "rgba(251,100,116,0.15)" : "transparent",
                          color: favoritados[s.ticker] === "ok" ? "#22D3A0" : favoritados[s.ticker] === "erro" ? "#FB6474" : "#FBBF24", fontSize: "12px" }}>
                        {favoritados[s.ticker] === "ok" ? "✓" : favoritados[s.ticker] === "erro" ? "✕" : "⭐"}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          <div style={{ padding: "10px 18px", fontSize: "10.5px", color: "#5F7391", borderTop: "1px solid var(--fi-borda)" }}>
            Clique num ativo para ver o gráfico e o plano · clique no cabeçalho para ordenar · teto = (alvo + 1,5 × stop) ÷ 2,5
          </div>
        </section>

        <div style={{ flex: "1 1 400px", minWidth: 0 }}>
          <PainelAnalise />
        </div>
      </div>
    </div>
  )
}
