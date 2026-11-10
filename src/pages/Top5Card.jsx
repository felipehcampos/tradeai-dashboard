import { useEffect, useRef, useState } from "react"
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

// 10/11/2026: visual "Future Intelligence" — mesmos dados, cards lado a lado com o teto em destaque.
function corVeredito(v = "") {
  if (v.includes("🟢")) return { cor: "#22D3A0", bg: "rgba(34,211,160,0.10)", borda: "rgba(34,211,160,0.35)", txt: "Compra pelo método" }
  if (v.includes("🟡")) return { cor: "#FBBF24", bg: "rgba(251,191,36,0.10)", borda: "rgba(251,191,36,0.35)", txt: "Só se…" }
  if (v.includes("👀")) return { cor: "#38BDF8", bg: "rgba(56,189,248,0.10)", borda: "rgba(56,189,248,0.35)", txt: "Observar" }
  return { cor: "#FB6474", bg: "rgba(251,100,116,0.10)", borda: "rgba(251,100,116,0.35)", txt: "Não comprar" }
}

function Chip({ children, cor = "#9DB0CB", fundo = "#132238", borda = "#1E3352" }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "3px 9px", borderRadius: "999px",
      fontSize: "11px", fontWeight: 600, background: fundo, color: cor, border: `1px solid ${borda}`, whiteSpace: "nowrap" }}>{children}</span>
  )
}

const pct = (a, b) => (a && b) ? `${(a / b - 1) * 100 > 0 ? "+" : ""}${((a / b - 1) * 100).toFixed(1).replace(".", ",")}%` : "—"

// Anel de risco/retorno (cheio = 3x). Ciano se ≥ 1,5x, amarelo abaixo.
function AnelRR({ rr }) {
  const r = 23, C = 2 * Math.PI * r
  const f = rr ? Math.max(0.03, Math.min(1, rr / 3)) : 0.03
  const cor = rr >= 1.5 ? "#38BDF8" : "#FBBF24"
  return (
    <svg width="58" height="58" viewBox="0 0 58 58" role="img" aria-label={`Risco/retorno ${rr ? rr.toFixed(1) : "—"}`}>
      <circle cx="29" cy="29" r={r} fill="none" stroke="#132238" strokeWidth="5" />
      <circle cx="29" cy="29" r={r} fill="none" stroke={cor} strokeWidth="5" strokeLinecap="round"
        strokeDasharray={`${(C * f).toFixed(1)} ${C.toFixed(1)}`} transform="rotate(-90 29 29)"
        style={{ filter: `drop-shadow(0 0 4px ${cor}88)` }} />
      <text x="29" y="31" textAnchor="middle" fill="#E6EDF7" fontFamily="Space Grotesk, Inter, sans-serif" fontSize="12" fontWeight="700">
        {rr ? rr.toFixed(1).replace(".", ",") : "—"}
      </text>
      <text x="29" y="42" textAnchor="middle" fill="#7E93B2" fontFamily="Inter, sans-serif" fontSize="7">R/R</text>
    </svg>
  )
}

export default function Top5Card() {
  const [dados, setDados] = useState(null)       // resposta de GET /top5
  const [carregando, setCarregando] = useState(true)
  const [aberto, setAberto] = useState(() => {
    try { return localStorage.getItem("top5_aberto") !== "0" } catch { return true }
  })
  const [verFora, setVerFora] = useState(false)
  const [abertoMotivo, setAbertoMotivo] = useState(null)   // card com o motivo inteiro aberto
  const [gerando, setGerando] = useState(false)
  const [avisoGerar, setAvisoGerar] = useState(null)   // mensagem depois do "Gerar agora"
  const pollRef = useRef(null)
  useEffect(() => () => clearInterval(pollRef.current), [])

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

  // 09/11/2026 (revisão do Gemini): em vez de recarregar fixo aos 75 s (e mostrar o top 5 ANTIGO se a
  // análise demorasse mais), consulta a cada 10 s e só para quando o gerado_em MUDAR — até 4 minutos.
  const gerarAgora = async () => {
    const antes = dados?.gerado_em || null
    setGerando(true)
    setAvisoGerar(null)
    try {
      await api.post(`${API}/top5/gerar`)
    } catch (e) {
      setGerando(false)
      setAvisoGerar(`⚠️ Não consegui pedir a análise (${e?.message || "sem resposta"}).`)
      return
    }
    const inicio = Date.now()
    clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      try {
        const r = await api.get(`${API}/top5`)
        const novo = r.data?.sucesso ? r.data : null
        if (novo && novo.gerado_em && novo.gerado_em !== antes) {
          clearInterval(pollRef.current)
          setDados(novo)
          setGerando(false)
          setAvisoGerar("✅ Top 5 atualizado agora.")
          return
        }
      } catch { /* tenta de novo no próximo ciclo */ }
      if (Date.now() - inicio > 240000) {
        clearInterval(pollRef.current)
        setGerando(false)
        setAvisoGerar("⏱️ A análise está demorando mais de 4 min. Recarregue a página daqui a pouco — o que aparece agora ainda é o top 5 anterior.")
      }
    }, 10000)
  }

  const t5 = dados?.top5
  const ib = t5?.ibovespa
  const lista = t5?.top5 || []

  return (
    <section aria-label="Top 5 do dia" className="fi-painel" style={{ marginBottom: "20px", overflow: "hidden" }}>
      {/* Cabeçalho */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px",
        padding: "16px 18px", flexWrap: "wrap", borderBottom: aberto ? "1px solid var(--fi-borda)" : "none" }}>
        <button type="button" onClick={alternar} style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "baseline", gap: "12px", flexWrap: "wrap" }}>
          <span className="fi-titulo" style={{ color: "var(--fi-texto)", fontWeight: 600, fontSize: "18px" }}>Top 5 do dia</span>
          {dados?.data_ref && <span style={{ color: "var(--fi-texto-4)", fontSize: "12px" }}>{dia(dados.data_ref)} · ordem limitada até o teto</span>}
          {ib?.regime && (
            <Chip cor={ib.regime === "QUEDA FORTE" ? "#FB6474" : ib.regime === "CORREÇÃO" ? "#FBBF24" : "#22D3A0"}
                  fundo={ib.regime === "QUEDA FORTE" ? "rgba(251,100,116,0.10)" : ib.regime === "CORREÇÃO" ? "rgba(251,191,36,0.10)" : "rgba(34,211,160,0.10)"}
                  borda="transparent">
              Ibov {String(ib.abaixo_max_pct).replace(".", ",")}% da máx. 12m · {ib.regime}
            </Chip>
          )}
          <span style={{ color: "var(--fi-texto-4)", fontSize: "12px" }}>{aberto ? "▲ recolher" : "▼ abrir"}</span>
        </button>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {dados?.dias?.length > 1 && (
            <select aria-label="Dia do top 5" value={dados.data_ref || ""} onChange={e => carregar(e.target.value)}
              style={{ background: "#0A1424", color: "var(--fi-texto-2)", border: "1px solid var(--fi-borda-forte)", borderRadius: "999px",
                padding: "6px 12px", fontSize: "12px" }}>
              {dados.dias.map(d => <option key={d} value={d}>{dia(d)}</option>)}
            </select>
          )}
          <button type="button" onClick={gerarAgora} disabled={gerando} title="Gera a análise de novo com os sinais da última rodada (~1 min)"
            style={{ height: "32px", padding: "0 14px", borderRadius: "999px", border: "1px solid var(--fi-borda-forte)",
              cursor: gerando ? "default" : "pointer", background: gerando ? "#132238" : "rgba(56,189,248,0.08)",
              color: "var(--fi-texto)", fontSize: "12px" }}>
            {gerando ? "Gerando… (aguarde)" : "Gerar de novo"}
          </button>
        </div>
      </div>

      {avisoGerar && (
        <div style={{ padding: "8px 18px", fontSize: "12px", color: avisoGerar.startsWith("✅") ? "#22D3A0" : "#FBBF24",
          background: "rgba(56,189,248,0.04)" }}>{avisoGerar}</div>
      )}
      {aberto && (
        <div style={{ padding: "16px 18px 18px" }}>
          {carregando ? (
            <div style={{ color: "var(--fi-texto-4)", fontSize: "13px" }}>Carregando o top 5…</div>
          ) : !t5 ? (
            <div style={{ color: "var(--fi-texto-4)", fontSize: "13px" }}>
              Ainda não há top 5 gerado. Ele sai sozinho de segunda a sexta às 6h45, ou clique em "Gerar de novo".
            </div>
          ) : (
            <>
              {t5.contexto && <p style={{ color: "var(--fi-texto-2)", fontSize: "13px", margin: "0 0 14px 0", lineHeight: 1.6 }}>{t5.contexto}</p>}

              {lista.length === 0 && (
                <div style={{ color: "var(--fi-texto-3)", fontSize: "13px", marginBottom: "10px" }}>
                  {t5.aviso || "O scanner não deu nenhum COMPRAR na B3 nesta rodada."}
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "12px" }}>
                {lista.map((t, i) => {
                  const c = corVeredito(t.veredito)
                  const rr = (t.entrada && t.alvo && t.stop && t.entrada > t.stop) ? (t.alvo - t.entrada) / (t.entrada - t.stop) : null
                  const abertoM = abertoMotivo === i
                  return (
                    <article key={t.ticker + i} style={{ display: "flex", flexDirection: "column", padding: "16px", borderRadius: "14px",
                      background: i === 0 ? "linear-gradient(180deg, rgba(56,189,248,0.10), rgba(8,15,28,0.92))" : "rgba(8,15,28,0.92)",
                      border: `1px solid ${i === 0 ? "rgba(56,189,248,0.55)" : "var(--fi-borda)"}`,
                      boxShadow: i === 0 ? "0 0 26px rgba(56,189,248,0.18)" : "none" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                        <span className="fi-titulo" style={{ fontSize: "12px", color: "#5F7391" }}>{String(i + 1).padStart(2, "0")}</span>
                        <Chip cor={c.cor} fundo={c.bg} borda={c.borda}>{c.txt}</Chip>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "10px", gap: "8px" }}>
                        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                          <span className="fi-titulo" style={{ fontSize: "22px", fontWeight: 700 }}>{(t.ticker || "").replace(".SA", "")}</span>
                          <span style={{ fontSize: "11px", color: "var(--fi-texto-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {t.setor || t.nome}
                          </span>
                        </div>
                        <AnelRR rr={rr} />
                      </div>
                      <div style={{ marginTop: "10px" }}>
                        <div style={{ fontSize: "10px", color: "var(--fi-texto-4)", textTransform: "uppercase", letterSpacing: "1.2px" }}>Teto de compra</div>
                        <div className="fi-titulo" style={{ fontSize: "26px", fontWeight: 600, color: "#38BDF8", textShadow: "0 0 18px rgba(56,189,248,0.45)" }}>
                          {brl(t.teto_compra)}
                        </div>
                        <div style={{ fontSize: "11px", color: "var(--fi-texto-4)" }}>entrada de referência {brl(t.entrada)}</div>
                      </div>
                      <div style={{ display: "flex", gap: "14px", marginTop: "8px", fontSize: "12px", color: "var(--fi-texto-3)", flexWrap: "wrap" }}>
                        <span>Alvo <b style={{ color: "#22D3A0", fontWeight: 600 }}>{brl(t.alvo)} {pct(t.alvo, t.entrada)}</b></span>
                        <span>Stop <b style={{ color: "#FB6474", fontWeight: 600 }}>{brl(t.stop)} {pct(t.stop, t.entrada)}</b></span>
                      </div>
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "10px" }}>
                        <Chip cor={t.atr === "VERDE" ? "#22D3A0" : t.atr === "VERMELHO" ? "#FB6474" : "#9DB0CB"}
                              fundo={t.atr === "VERDE" ? "rgba(34,211,160,0.10)" : t.atr === "VERMELHO" ? "rgba(251,100,116,0.10)" : "#132238"}
                              borda="transparent">
                          ATR {t.atr === "VERDE" ? "alta" : t.atr === "VERMELHO" ? "queda" : "—"}
                        </Chip>
                        {t.saude && <Chip>Saúde {t.saude}</Chip>}
                        {t.insiders && <Chip cor={t.insiders === "compra" ? "#22D3A0" : t.insiders === "venda" ? "#FB6474" : "#FBBF24"}>👔 {t.insiders}</Chip>}
                        {t.selo_checklist && <Chip>{t.selo_checklist}</Chip>}
                        <Chip cor="#E6EDF7">{t.tamanho_rs ? brl(t.tamanho_rs) : "R$ 0"}</Chip>
                      </div>
                      {t.condicao && <div style={{ color: c.cor, fontSize: "12px", marginTop: "10px", lineHeight: 1.45 }}>{t.condicao}</div>}
                      {t.motivo && (
                        <>
                          <p style={{ color: "var(--fi-texto-3)", fontSize: "12px", margin: "8px 0 0 0", lineHeight: 1.5,
                            ...(abertoM ? {} : { display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }) }}>
                            {t.motivo}
                          </p>
                          <button type="button" onClick={() => setAbertoMotivo(abertoM ? null : i)}
                            style={{ all: "unset", cursor: "pointer", color: "#38BDF8", fontSize: "11px", marginTop: "6px" }}>
                            {abertoM ? "ver menos" : "ver motivo completo"}
                          </button>
                        </>
                      )}
                    </article>
                  )
                })}
              </div>

              {t5.fora?.length > 0 && (
                <div style={{ marginTop: "14px" }}>
                  <button type="button" onClick={() => setVerFora(!verFora)} style={{ all: "unset", cursor: "pointer", color: "#FBBF24", fontSize: "12px", fontWeight: 600 }}>
                    {t5.fora.length} ficaram de fora {verFora ? "▲" : "▼"}
                  </button>
                  {verFora && (
                    <ul style={{ margin: "6px 0 0 0", paddingLeft: "18px", color: "var(--fi-texto-3)", fontSize: "12px", lineHeight: 1.6 }}>
                      {t5.fora.map((f, i) => <li key={i}><b style={{ color: "var(--fi-texto-2)" }}>{(f.ticker || "").replace(".SA", "")}</b>: {f.motivo}</li>)}
                    </ul>
                  )}
                </div>
              )}

              {t5.aviso && lista.length > 0 && (
                <div style={{ marginTop: "12px", padding: "10px 14px", borderRadius: "12px", background: "rgba(56,189,248,0.06)",
                  border: "1px solid rgba(56,189,248,0.15)", color: "var(--fi-texto-2)", fontSize: "12px", lineHeight: 1.5 }}>{t5.aviso}</div>
              )}
              <div style={{ marginTop: "10px", color: "#5F7391", fontSize: "11px" }}>
                Gerado {dados.gerado_em ? `em ${horaSP(dados.gerado_em)}` : ""} a partir de {t5.total_compra_b3 ?? "—"} COMPRAR da B3{t5.total_candidatos > t5.total_compra_b3 ? ` (+ BDRs e MANTER para completar o ranking)` : ""}.
                Decisão é sua: ordem limitada até o teto e conferir o gráfico antes.
              </div>
            </>
          )}
        </div>
      )}
    </section>
  )
}
