import { useState, useEffect } from "react"
import api from "../services/api"

const API = import.meta.env.VITE_API_URL

export default function Noticias() {
  const [noticias, setNoticias] = useState([])
  const [loading, setLoading] = useState(true)
  const [atualizando, setAtualizando] = useState(false) // Novo estado para controle de recarga limpa
  const [filtro, setFiltro] = useState("TODOS")
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState(null)

  const carregarNoticias = (isManual = false) => {
    if (isManual) setAtualizando(true)
    else setLoading(true)

    api.get(`${API}/noticias`)
      .then(r => {
        setNoticias(r.data.dados || [])
        setUltimaAtualizacao(new Date().toLocaleTimeString("pt-BR"))
      })
      .catch(() => setNoticias([]))
      .finally(() => {
        setLoading(false)
        setAtualizando(false)
      })
  }

  useEffect(() => { carregarNoticias() }, [])

  const corSentimento = (sentimento) => {
    if (sentimento === "POSITIVO") return "#4ade80"
    if (sentimento === "NEGATIVO") return "#f87171"
    return "#94a3b8"
  }

  const bgSentimento = (sentimento) => {
    if (sentimento === "POSITIVO") return "rgba(74,222,128,0.1)"
    if (sentimento === "NEGATIVO") return "rgba(248,113,113,0.1)"
    return "rgba(148,163,184,0.1)"
  }

  const emojiSentimento = (sentimento) => {
    if (sentimento === "POSITIVO") return "📈"
    if (sentimento === "NEGATIVO") return "📉"
    return "➡️"
  }

  const formatarData = (data) => {
    if (!data) return ""
    return new Date(data).toLocaleDateString("pt-BR", {
      day: "2-digit", month: "2-digit",
      hour: "2-digit", minute: "2-digit"
    })
  }

  const filtros = ["TODOS", "POSITIVO", "NEGATIVO", "NEUTRO"]
  const noticiasFiltradas = filtro === "TODOS"
    ? noticias
    : noticias.filter(n => n.sentimento === filtro)

  // 10/11/2026: visual "Future Intelligence"
  const pill = (cor, fundo, borda) => ({ display: "inline-flex", alignItems: "center", gap: "4px", padding: "3px 9px", borderRadius: "999px", fontSize: "11px", fontWeight: 600, whiteSpace: "nowrap", color: cor, background: fundo, border: `1px solid ${borda}` })
  const pillSent = (s) => s === "POSITIVO" ? pill("#22D3A0", "rgba(34,211,160,0.10)", "rgba(34,211,160,0.35)")
    : s === "NEGATIVO" ? pill("#FB6474", "rgba(251,100,116,0.10)", "rgba(251,100,116,0.35)") : pill("#9DB0CB", "#132238", "#1E3352")
  const cont = (s) => noticias.filter(n => n.sentimento === s).length
  const total = noticias.length || 1

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "18px" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 className="fi-titulo" style={{ margin: 0, fontSize: "24px", fontWeight: 700 }}>Notícias</h1>
          <span style={{ color: "var(--fi-texto-4)", fontSize: "12px" }}>
            Manchetes coletadas pelo scanner para os ativos analisados{ultimaAtualizacao && ` · atualizado às ${ultimaAtualizacao}`}
          </span>
        </div>
        <button type="button" onClick={() => carregarNoticias(true)} disabled={loading || atualizando} style={{
          height: "34px", padding: "0 16px", borderRadius: "999px", border: "1px solid var(--fi-borda-forte)",
          background: atualizando ? "#132238" : "rgba(56,189,248,0.08)", color: atualizando ? "var(--fi-texto-4)" : "var(--fi-texto)",
          fontSize: "12px", cursor: atualizando ? "default" : "pointer", display: "inline-flex", alignItems: "center", gap: "8px" }}>
          {atualizando && <span style={{ width: "12px", height: "12px", border: "2px solid #9DB0CB", borderTopColor: "transparent", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} />}
          {atualizando ? "Buscando…" : "Atualizar notícias"}
        </button>
      </div>

      {/* Termômetro do sentimento */}
      <div className="fi-painel" style={{ padding: "18px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "10px", alignItems: "baseline" }}>
          <span style={{ fontSize: "11px", color: "var(--fi-texto-4)", textTransform: "uppercase", letterSpacing: "1.2px" }}>Clima das notícias</span>
          <span style={{ fontSize: "12px", color: "var(--fi-texto-3)" }}>{noticias.length} manchetes</span>
        </div>
        <div style={{ display: "flex", height: "10px", borderRadius: "999px", overflow: "hidden", marginTop: "12px", background: "#132238" }}>
          <div style={{ width: `${cont("POSITIVO") / total * 100}%`, background: "#22D3A0", boxShadow: "0 0 10px rgba(34,211,160,0.6)" }} />
          <div style={{ width: `${cont("NEUTRO") / total * 100}%`, background: "#2A3B55" }} />
          <div style={{ width: `${cont("NEGATIVO") / total * 100}%`, background: "#FB6474", boxShadow: "0 0 10px rgba(251,100,116,0.6)" }} />
        </div>
        <div style={{ display: "flex", gap: "18px", marginTop: "10px", fontSize: "12px", flexWrap: "wrap" }}>
          <span style={{ color: "#22D3A0" }}>● {cont("POSITIVO")} positivas</span>
          <span style={{ color: "#9DB0CB" }}>● {cont("NEUTRO")} neutras</span>
          <span style={{ color: "#FB6474" }}>● {cont("NEGATIVO")} negativas</span>
        </div>
      </div>

      <div role="group" aria-label="Filtro de sentimento" style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
        {filtros.map(f => {
          const on = filtro === f
          return (
            <button key={f} type="button" onClick={() => setFiltro(f)} style={{
              height: "30px", padding: "0 14px", borderRadius: "999px", cursor: "pointer", fontSize: "11.5px",
              border: `1px solid ${on ? "rgba(56,189,248,0.6)" : "var(--fi-borda-forte)"}`, background: on ? "rgba(56,189,248,0.14)" : "transparent",
              color: on ? "var(--fi-texto)" : "var(--fi-texto-3)", boxShadow: on ? "0 0 14px rgba(56,189,248,0.25)" : "none" }}>
              {f === "TODOS" ? "Todas" : f.charAt(0) + f.slice(1).toLowerCase() + "s"}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "50px", color: "var(--fi-texto-4)" }}>Carregando notícias…</div>
      ) : noticiasFiltradas.length === 0 ? (
        <div style={{ textAlign: "center", padding: "50px", color: "var(--fi-texto-4)", fontSize: "13px" }}>
          Nenhuma notícia disponível. Elas são coletadas durante a rodada do scanner.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(420px, 100%), 1fr))", gap: "14px", opacity: atualizando ? 0.4 : 1, transition: "opacity 0.3s" }}>
          {noticiasFiltradas.map((n, i) => (
            <article key={i} className="fi-painel" style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <span className="fi-titulo" style={{ fontWeight: 700, fontSize: "15px" }}>{String(n.ticker || "").replace(".SA", "")}</span>
                <span style={pillSent(n.sentimento)}>{n.sentimento ? n.sentimento.charAt(0) + n.sentimento.slice(1).toLowerCase() : "—"}</span>
                {n.sinal && <span style={n.sinal === "COMPRAR" ? pill("#22D3A0", "transparent", "rgba(34,211,160,0.35)") : pill("#FBBF24", "transparent", "rgba(251,191,36,0.35)")}>{n.sinal}</span>}
                <span style={{ marginLeft: "auto", color: "#5F7391", fontSize: "11px" }}>{formatarData(n.criado_em)}</span>
              </div>
              <p style={{ color: "var(--fi-texto)", fontSize: "14px", margin: 0, fontWeight: 600, lineHeight: 1.45 }}>{n.titulo}</p>
              {n.resumo && n.resumo !== n.titulo && (
                <p style={{ color: "var(--fi-texto-3)", fontSize: "12.5px", margin: 0, lineHeight: 1.6 }}>{n.resumo}</p>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10.5px", color: "#5F7391", marginTop: "auto", paddingTop: "4px" }}>
                <span>{n.fonte ? n.fonte.toUpperCase() : ""}</span>
                <span>score {n.score > 0 ? "+" : ""}{parseFloat(n.score || 0).toFixed(2)}</span>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
