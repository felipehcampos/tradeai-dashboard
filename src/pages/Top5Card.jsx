import { useEffect, useState } from "react"
import api from "../services/api"

const API = import.meta.env.VITE_API_URL

// Card "TOP 5 DO DIA" (28/10/2026) — mostra a análise automática do backend (top5.py),
// gerada às 6h45 depois do scanner da madrugada. Só informa: a decisão é do Felipe.

const brl = (v) => (v == null || isNaN(v)) ? "—" : `R$ ${Number(v).toFixed(2).replace(".", ",")}`
const dia = (iso) => iso ? iso.slice(0, 10).split("-").reverse().join("/") : ""
// gerado_em vem do banco em UTC ("2026-10-28 09:45:12.3") → hora de São Paulo
const horaSP = (s) => {
  const d = new Date(String(s).replace(" ", "T").slice(0, 19) + "Z")
  return isNaN(d) ? "" : d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })
}

function corVeredito(v = "") {
  if (v.includes("🟢")) return { cor: "#4ade80", bg: "rgba(74,222,128,0.12)", borda: "rgba(74,222,128,0.35)" }
  if (v.includes("🟡")) return { cor: "#fbbf24", bg: "rgba(251,191,36,0.12)", borda: "rgba(251,191,36,0.35)" }
  return { cor: "#f87171", bg: "rgba(248,113,113,0.10)", borda: "rgba(248,113,113,0.30)" }
}

function Chip({ children, cor = "#94a3b8" }) {
  return (
    <span style={{ padding: "2px 8px", borderRadius: "10px", fontSize: "11px", fontWeight: "600",
      background: "rgba(148,163,184,0.12)", color: cor, whiteSpace: "nowrap" }}>{children}</span>
  )
}

export default function Top5Card() {
  const [dados, setDados] = useState(null)       // resposta de GET /top5
  const [carregando, setCarregando] = useState(true)
  const [aberto, setAberto] = useState(() => {
    try { return localStorage.getItem("top5_aberto") !== "0" } catch { return true }
  })
  const [verFora, setVerFora] = useState(false)
  const [gerando, setGerando] = useState(false)

  const carregar = (data) => {
    setCarregando(true)
    api.get(`${API}/top5`, { params: data ? { data } : {} })
      .then(r => setDados(r.data.sucesso ? r.data : null))
      .catch(() => setDados(null))
      .finally(() => setCarregando(false))
  }
  useEffect(() => { carregar() }, [])

  const alternar = () => {
    const novo = !aberto
    setAberto(novo)
    try { localStorage.setItem("top5_aberto", novo ? "1" : "0") } catch { /* sem storage */ }
  }

  const gerarAgora = () => {
    setGerando(true)
    api.post(`${API}/top5/gerar`).catch(() => {})
    // a análise leva ~1 min: recarrega depois
    setTimeout(() => { carregar(); setGerando(false) }, 75000)
  }

  const t5 = dados?.top5
  const ib = t5?.ibovespa
  const lista = t5?.top5 || []

  return (
    <div style={{ background: "#0d1829", border: "1px solid rgba(56,189,248,0.35)", borderRadius: "12px",
      marginBottom: "20px", overflow: "hidden" }}>
      {/* Cabeçalho */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px",
        padding: "14px 18px", background: "rgba(56,189,248,0.08)", flexWrap: "wrap" }}>
        <div onClick={alternar} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <span style={{ color: "#38bdf8", fontWeight: "800", fontSize: "16px" }}>🏆 TOP 5 DO DIA</span>
          {dados?.data_ref && <span style={{ color: "#94a3b8", fontSize: "12px" }}>{dia(dados.data_ref)}</span>}
          {ib?.regime && (
            <Chip cor={ib.regime === "QUEDA FORTE" ? "#f87171" : ib.regime === "CORREÇÃO" ? "#fbbf24" : "#4ade80"}>
              Ibov {ib.abaixo_max_pct}% da máx. 12m · {ib.regime}
            </Chip>
          )}
          <span style={{ color: "#64748b", fontSize: "12px" }}>{aberto ? "▲ recolher" : "▼ abrir"}</span>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {dados?.dias?.length > 1 && (
            <select value={dados.data_ref || ""} onChange={e => carregar(e.target.value)}
              style={{ background: "#0a1520", color: "#cbd5e1", border: "1px solid #1e293b", borderRadius: "6px",
                padding: "5px 8px", fontSize: "12px" }}>
              {dados.dias.map(d => <option key={d} value={d}>{dia(d)}</option>)}
            </select>
          )}
          <button onClick={gerarAgora} disabled={gerando} title="Gera a análise de novo com os sinais da última rodada (~1 min)"
            style={{ padding: "6px 12px", borderRadius: "6px", border: "none", cursor: gerando ? "default" : "pointer",
              background: gerando ? "#334155" : "#1e293b", color: "#38bdf8", fontSize: "12px", fontWeight: "600" }}>
            {gerando ? "⏳ gerando (~1 min)…" : "🔄 Gerar agora"}
          </button>
        </div>
      </div>

      {aberto && (
        <div style={{ padding: "14px 18px" }}>
          {carregando ? (
            <div style={{ color: "#64748b", fontSize: "13px" }}>Carregando o top 5…</div>
          ) : !t5 ? (
            <div style={{ color: "#64748b", fontSize: "13px" }}>
              Ainda não há top 5 gerado. Ele sai sozinho de segunda a sexta às 6h45, ou clique em "🔄 Gerar agora".
            </div>
          ) : (
            <>
              {t5.contexto && <p style={{ color: "#cbd5e1", fontSize: "13px", margin: "0 0 12px 0", lineHeight: 1.5 }}>{t5.contexto}</p>}

              {lista.length === 0 && (
                <div style={{ color: "#94a3b8", fontSize: "13px", marginBottom: "10px" }}>
                  {t5.aviso || "O scanner não deu nenhum COMPRAR na B3 nesta rodada."}
                </div>
              )}

              <div style={{ display: "grid", gap: "10px" }}>
                {lista.map((t, i) => {
                  const c = corVeredito(t.veredito)
                  const veredito = (t.veredito || "").replace(" ...", "").replace("...", "")
                  return (
                    <div key={t.ticker + i} style={{ border: `1px solid ${c.borda}`, background: c.bg, borderRadius: "10px", padding: "12px 14px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
                        <div style={{ display: "flex", gap: "10px", alignItems: "baseline", flexWrap: "wrap" }}>
                          <span style={{ color: "#64748b", fontWeight: "800" }}>{i + 1}.</span>
                          <span style={{ color: "#38bdf8", fontWeight: "800", fontSize: "15px" }}>{(t.ticker || "").replace(".SA", "")}</span>
                          <span style={{ color: "#e2e8f0", fontSize: "13px" }}>{t.nome}</span>
                          {t.setor && <span style={{ color: "#64748b", fontSize: "12px" }}>· {t.setor}</span>}
                        </div>
                        <span style={{ color: c.cor, fontWeight: "800", fontSize: "12px" }}>{veredito}</span>
                      </div>
                      {t.condicao && <div style={{ color: c.cor, fontSize: "12px", marginTop: "4px" }}>{t.condicao}</div>}
                      <div style={{ display: "flex", gap: "14px", flexWrap: "wrap", marginTop: "8px", fontSize: "12px", color: "#cbd5e1" }}>
                        <span>Entrada <b>{brl(t.entrada)}</b></span>
                        <span>Teto <b>{brl(t.teto_compra)}</b></span>
                        <span style={{ color: "#4ade80" }}>Alvo <b>{brl(t.alvo)}</b></span>
                        <span style={{ color: "#f87171" }}>Stop <b>{brl(t.stop)}</b></span>
                        <span>Tamanho <b>{t.tamanho_rs ? brl(t.tamanho_rs) : "—"}</b></span>
                      </div>
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "8px" }}>
                        <Chip cor={t.atr === "VERDE" ? "#4ade80" : t.atr === "VERMELHO" ? "#f87171" : "#94a3b8"}>
                          ATR {t.atr === "VERDE" ? "🟢" : t.atr === "VERMELHO" ? "🔴" : "—"}
                        </Chip>
                        {t.saude && <Chip>Saúde {t.saude}</Chip>}
                        {t.insiders && <Chip cor={t.insiders === "compra" ? "#4ade80" : t.insiders === "venda" ? "#f87171" : "#fbbf24"}>👔 {t.insiders}</Chip>}
                        {t.selo_checklist && <Chip>{t.selo_checklist}</Chip>}
                      </div>
                      {t.motivo && <p style={{ color: "#94a3b8", fontSize: "12px", margin: "8px 0 0 0", lineHeight: 1.5 }}>{t.motivo}</p>}
                    </div>
                  )
                })}
              </div>

              {t5.fora?.length > 0 && (
                <div style={{ marginTop: "12px" }}>
                  <span onClick={() => setVerFora(!verFora)} style={{ cursor: "pointer", color: "#fbbf24", fontSize: "12px", fontWeight: "600" }}>
                    ⚠️ {t5.fora.length} ficaram de fora {verFora ? "▲" : "▼"}
                  </span>
                  {verFora && (
                    <ul style={{ margin: "6px 0 0 0", paddingLeft: "18px", color: "#94a3b8", fontSize: "12px", lineHeight: 1.6 }}>
                      {t5.fora.map((f, i) => <li key={i}><b style={{ color: "#cbd5e1" }}>{(f.ticker || "").replace(".SA", "")}</b>: {f.motivo}</li>)}
                    </ul>
                  )}
                </div>
              )}

              {t5.aviso && lista.length > 0 && (
                <div style={{ marginTop: "12px", padding: "10px 12px", borderRadius: "8px", background: "rgba(56,189,248,0.06)",
                  color: "#cbd5e1", fontSize: "12px", lineHeight: 1.5 }}>ℹ️ {t5.aviso}</div>
              )}
              <div style={{ marginTop: "10px", color: "#475569", fontSize: "11px" }}>
                Gerado {dados.gerado_em ? `em ${horaSP(dados.gerado_em)}` : ""} a partir de {t5.total_compra_b3 ?? "—"} COMPRAR da B3.
                Decisão é sua: ordem limitada até o teto e conferir o gráfico antes.
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
