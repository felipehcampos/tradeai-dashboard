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

  return (
    <div style={{ width: "100%" }}>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* Header */}
      <div style={{
        display: "flex", alignItems: "flex-start", justifyContent: "space-between",
        marginBottom: "20px", flexWrap: "wrap", gap: "12px"
      }}>
        <div>
          <h2 style={{ color: "#38bdf8", margin: "0 0 4px 0", fontSize: "22px", fontWeight: "800" }}>
            📰 Notícias do Mercado
          </h2>
          <span style={{ color: "#64748b", fontSize: "12px" }}>
            Mapeamento de imprensa com impacto nos ativos monitorados pelo scanner
            {ultimaAtualizacao && ` • Atualizado às ${ultimaAtualizacao}`}
          </span>
        </div>
        
        {/* BOTÃO PADRONIZADO COM O DESIGN EM ANEL GIRATÓRIO CORPORATIVO */}
        <button onClick={() => carregarNoticias(true)} disabled={loading || atualizando} style={{
          padding: "9px 18px", borderRadius: "8px", border: "none", cursor: "pointer",
          background: atualizando ? "#334155" : "linear-gradient(135deg,#0ea5e9,#0284c7)",
          color: atualizando ? "#94a3b8" : "white",
          fontSize: "13px", fontWeight: "600", minWidth: "160px",
          boxShadow: atualizando ? "none" : "0 2px 8px rgba(14,165,233,0.3)",
          transition: "all 0.2s"
        }}>
          {atualizando ? (
            <span style={{ display: "flex", alignItems: "center", gap: "8px", justifyContent: "center" }}>
              <span style={{
                width: "12px", height: "12px", border: "2px solid #94a3b8",
                borderTopColor: "transparent", borderRadius: "50%",
                display: "inline-block", animation: "spin 0.8s linear infinite"
              }} />
              Buscando feed...
            </span>
          ) : "🔄 Atualizar Notícias"}
        </button>
      </div>

      {/* Cards resumo */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "20px", flexWrap: "wrap" }}>
        {[
          { label: "📰 Total Coletadas", valor: noticias.length, cor: "#38bdf8", bg: "rgba(56,189,248,0.06)", border: "rgba(56,189,248,0.15)" },
          { label: "📈 Positivas", valor: noticias.filter(n => n.sentimento === "POSITIVO").length, cor: "#4ade80", bg: "rgba(74,222,128,0.06)", border: "rgba(74,222,128,0.15)" },
          { label: "📉 Negativas", valor: noticias.filter(n => n.sentimento === "NEGATIVO").length, cor: "#f87171", bg: "rgba(248,113,113,0.06)", border: "rgba(248,113,113,0.15)" },
          { label: "➡️ Neutras", valor: noticias.filter(n => n.sentimento === "NEUTRO").length, cor: "#94a3b8", bg: "rgba(148,163,184,0.06)", border: "rgba(148,163,184,0.15)" },
        ].map((card, i) => (
          <div key={i} style={{
            background: card.bg, border: `1px solid ${card.border}`,
            padding: "16px 24px", borderRadius: "12px", flex: 1, minWidth: "130px", textAlign: "center"
          }}>
            <p style={{ color: "#64748b", fontSize: "12px", margin: "0 0 6px 0" }}>{card.label}</p>
            <p style={{ color: card.cor, fontSize: "28px", fontWeight: "800", margin: 0 }}>{card.valor}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
        {filtros.map(f => (
          <button key={f} onClick={() => setFiltro(f)} style={{
            padding: "6px 16px", borderRadius: "20px", border: "none", cursor: "pointer",
            fontSize: "12px", fontWeight: filtro === f ? "700" : "400",
            background: filtro === f ? "#38bdf8" : "#1e293b",
            color: filtro === f ? "#0f172a" : "#64748b",
            transition: "all 0.2s"
          }}>
            {f}
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "60px", color: "#64748b" }}>
          <p style={{ fontSize: "32px", marginBottom: "12px" }}>⏳</p>
          <p>Carregando repositório de imprensa...</p>
        </div>
      ) : noticiasFiltradas.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px", color: "#64748b" }}>
          <p style={{ fontSize: "48px", marginBottom: "12px" }}>📭</p>
          <p style={{ fontSize: "16px", marginBottom: "8px" }}>Nenhuma notícia disponível</p>
          <p style={{ fontSize: "13px" }}>As notícias são geradas dinamicamente durante as varreduras do robô.</p>
        </div>
      ) : (
        /* INJETADA A OPACIDADE DINÂMICA DE FLUXO PARA ELIMINAR O EFEITO PISCA-PISCA */
        <div style={{ 
          display: "flex", 
          flexDirection: "column", 
          gap: "12px",
          opacity: atualizando ? 0.4 : 1,
          transition: "opacity 0.3s ease-in-out"
        }}>
          {noticiasFiltradas.map((n, i) => (
            <div key={i} style={{
              background: "#0d1829", border: "1px solid #1e293b",
              borderRadius: "12px", padding: "16px 24px",
              borderLeft: `4px solid ${corSentimento(n.sentimento)}`
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px", flexWrap: "wrap" }}>
                    <span style={{ color: "#38bdf8", fontWeight: "800", fontSize: "14px" }}>
                      {n.ticker}
                    </span>
                    <span style={{
                      padding: "2px 10px", borderRadius: "12px", fontSize: "11px",
                      fontWeight: "700", background: bgSentimento(n.sentimento),
                      color: corSentimento(n.sentimento)
                    }}>
                      {emojiSentimento(n.sentimento)} {n.sentimento}
                    </span>
                    {n.sinal && (
                      <span style={{
                        padding: "2px 10px", borderRadius: "12px", fontSize: "11px",
                        fontWeight: "700",
                        background: n.sinal === "COMPRAR" ? "rgba(74,222,128,0.1)" : "rgba(251,191,36,0.1)",
                        color: n.sinal === "COMPRAR" ? "#4ade80" : "#fbbf24"
                      }}>
                        {n.sinal === "COMPRAR" ? "▲" : "◆"} {n.sinal}
                      </span>
                    )}
                    <span style={{ color: "#475569", fontSize: "11px" }}>
                      Score: {n.score > 0 ? "+" : ""}{parseFloat(n.score || 0).toFixed(2)}
                    </span>
                  </div>
                  <p style={{ color: "#f1f5f9", fontSize: "14px", margin: "0 0 6px 0", fontWeight: "600", letterSpacing: "-0.2px" }}>
                    {n.titulo}
                  </p>
                  {n.resumo && n.resumo !== n.titulo && (
                    <p style={{ color: "#94a3b8", fontSize: "12px", margin: 0, lineHeight: "1.6" }}>
                      {n.resumo}
                    </p>
                  )}
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <p style={{ color: "#475569", fontSize: "11px", margin: 0 }}>
                    {formatarData(n.criado_em)}
                  </p>
                  {n.fonte && (
                    <p style={{ color: "#334155", fontSize: "10px", margin: "4px 0 0 0", fontWeight: "600" }}>
                      {n.fonte.toUpperCase()}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}