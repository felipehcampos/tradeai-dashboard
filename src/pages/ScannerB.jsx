import { useEffect, useState } from "react"
import api from "../services/api"

const API = import.meta.env.VITE_API_URL

// Aba "🧪 Scanner B" (09/11/2026) — sombra do scanner oficial. Só observação:
// o dinheiro real segue o scanner oficial até a revisão de 29/01/2027.

const brl = (v) => (v == null || isNaN(v)) ? "—" : `R$ ${Number(v).toFixed(2).replace(".", ",")}`
const pct = (v, casas = 1) => (v == null || isNaN(v)) ? "—" : `${v >= 0 ? "+" : ""}${Number(v).toFixed(casas)}%`
const dia = (iso) => iso ? String(iso).slice(0, 10).split("-").reverse().join("/") : ""

// 10/11/2026: visual "Future Intelligence".
const card = { background: "var(--fi-painel)", border: "1px solid var(--fi-borda)", borderRadius: "16px", padding: "18px 20px" }
const th = { padding: "10px 8px", textAlign: "left", color: "#5F7391", fontSize: "10.5px", fontWeight: 500, textTransform: "uppercase", letterSpacing: "1.1px", whiteSpace: "nowrap" }
const td = { padding: "11px 8px", fontSize: "12.5px", color: "var(--fi-texto-2)", borderTop: "1px solid #101D31", whiteSpace: "nowrap" }
const rotulo = { fontSize: "11px", color: "var(--fi-texto-4)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "1.2px" }
const pill = (cor, fundo, borda) => ({ display: "inline-flex", alignItems: "center", padding: "3px 9px", borderRadius: "999px", fontSize: "11px", fontWeight: 600, whiteSpace: "nowrap", color: cor, background: fundo, border: `1px solid ${borda}` })
const P_OK = pill("#22D3A0", "rgba(34,211,160,0.10)", "rgba(34,211,160,0.35)")
const P_WARN = pill("#FBBF24", "rgba(251,191,36,0.10)", "rgba(251,191,36,0.35)")
const P_BAD = pill("#FB6474", "rgba(251,100,116,0.10)", "rgba(251,100,116,0.35)")
const P_NEU = pill("#9DB0CB", "#132238", "#1E3352")

function Selo({ desconto }) {
  const m = { REAL: ["Desconto real", P_OK], FALSO: ["Desconto falso", P_WARN], SEM: ["Sem desconto", P_NEU] }
  const [t, st] = m[desconto] || ["—", P_NEU]
  return <span style={st}>{t}</span>
}

function LinhaPlacar({ nome, b, destaque }) {
  if (!b) return null
  const taxa = b.fechados ? Math.round(b.alvo / b.fechados * 100) : null
  return (
    <tr style={{ background: destaque ? "linear-gradient(90deg, rgba(56,189,248,0.12), rgba(56,189,248,0))" : "transparent" }}>
      <td style={{ ...td, fontWeight: 600, color: destaque ? "#38BDF8" : "var(--fi-texto)" }}>{nome}</td>
      <td style={td}>{b.sinais}</td>
      <td style={td}>{b.fechados}</td>
      <td style={{ ...td, color: "#22D3A0" }}>{b.alvo}{taxa != null ? ` (${taxa}%)` : ""}</td>
      <td style={{ ...td, color: "#FB6474" }}>{b.stop}</td>
      <td style={{ ...td, fontWeight: 600, color: (b.media_fechados ?? 0) >= 0 ? "#22D3A0" : "#FB6474" }}>{pct(b.media_fechados, 2)}</td>
      <td style={td}>{pct(b.media_todos, 2)}</td>
    </tr>
  )
}

// Card grande do placar (oficial × B)
function CardLado({ titulo, b, cor, destaque }) {
  if (!b) return null
  const taxa = b.fechados ? b.alvo / b.fechados : 0
  const r = 40, C = 2 * Math.PI * r
  return (
    <div style={{ ...card, flex: "1 1 280px", display: "flex", alignItems: "center", gap: "18px",
      ...(destaque ? { borderColor: "rgba(56,189,248,0.45)", boxShadow: "0 0 26px rgba(56,189,248,0.12)" } : {}) }}>
      <svg width="100" height="100" viewBox="0 0 100 100" role="img" aria-label={`${Math.round(taxa * 100)}% bateram o alvo`} style={{ flex: "none" }}>
        <circle cx="50" cy="50" r={r} fill="none" stroke="#132238" strokeWidth="8" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={cor} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${(C * Math.max(0.02, taxa)).toFixed(1)} ${C.toFixed(1)}`}
          transform="rotate(-90 50 50)" style={{ filter: `drop-shadow(0 0 6px ${cor})` }} />
        <text x="50" y="50" textAnchor="middle" fill="#E6EDF7" fontFamily="Space Grotesk, Inter, sans-serif" fontSize="20" fontWeight="700">{Math.round(taxa * 100)}%</text>
        <text x="50" y="65" textAnchor="middle" fill="#7E93B2" fontFamily="Inter, sans-serif" fontSize="9">no alvo</text>
      </svg>
      <div>
        <div style={rotulo}>{titulo}</div>
        <div className="fi-titulo" style={{ fontSize: "30px", fontWeight: 600, color: cor, textShadow: destaque ? `0 0 18px ${cor}88` : "none", marginTop: "4px" }}>{pct(b.media_fechados, 2)}</div>
        <div style={{ fontSize: "11.5px", color: "var(--fi-texto-3)" }}>por trade fechado · {b.fechados} fechados ({b.alvo} alvos / {b.stop} stops)</div>
      </div>
    </div>
  )
}

export default function ScannerB() {
  const [dados, setDados] = useState(null)
  const [placar, setPlacar] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [filtro, setFiltro] = useState("COMPRAR")
  const [erro, setErro] = useState(null)  // revisão do ChatGPT: falha ≠ "sem dados"

  const carregar = (data) => {
    setCarregando(true)
    setErro(null)
    const falha = (onde) => (e) => ({ data: { sucesso: false, erro: `${onde}: ${e?.response?.status || ""} ${e?.message || "sem resposta"}` } })
    Promise.all([
      api.get(`${API}/scanner-b`, { params: data ? { data } : {} }).catch(falha("sinais")),
      api.get(`${API}/scanner-b/placar`).catch(falha("placar")),
    ]).then(([d, p]) => {
      setDados(d?.data?.sucesso ? d.data : null)
      setPlacar(p?.data?.sucesso ? p.data : null)
      const erros = [d, p].filter(x => !x?.data?.sucesso).map(x => x?.data?.erro || "erro desconhecido")
      if (erros.length) setErro(erros.join(" · "))
    }).finally(() => setCarregando(false))
  }
  useEffect(() => { carregar() }, [])

  const lista = (dados?.sinais || []).filter(s => filtro === "TODOS" || s.sinal_oficial === filtro)
  const falsos = (dados?.sinais || []).filter(s => s.sinal_oficial === "COMPRAR" && s.desconto === "FALSO").length

  // Plano travado (29/01/2027): ≥ 150 trades fechados e ≥ 30 em cada subgrupo
  const metaGeral = placar?.oficial_pareado?.fechados ?? placar?.oficial?.fechados ?? 0
  const metaFalso = placar?.desconto_falso?.fechados ?? 0
  const barraMeta = (v, meta) => (
    <div style={{ height: "8px", borderRadius: "999px", background: "#132238", overflow: "hidden", marginTop: "6px" }}>
      <div style={{ width: `${Math.min(100, v / meta * 100)}%`, height: "8px", borderRadius: "999px",
        background: v >= meta ? "linear-gradient(90deg,#2563EB,#22D3A0)" : "linear-gradient(90deg,#2563EB,#38BDF8)", boxShadow: "0 0 10px rgba(56,189,248,0.45)" }} />
    </div>
  )

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 className="fi-titulo" style={{ margin: 0, fontSize: "24px", fontWeight: 700 }}>Scanner B <span style={{ ...P_NEU, verticalAlign: "middle", marginLeft: "6px" }}>teste em paralelo</span></h1>
          <p style={{ color: "var(--fi-texto-3)", fontSize: "12.5px", margin: "6px 0 0 0", lineHeight: 1.6, maxWidth: "860px" }}>
            Lê os sinais do scanner oficial e mede o desconto também pela <b style={{ color: "var(--fi-texto)" }}>mediana</b> de 6 meses (que não se deixa levar por picos de alta).
            <b style={{ color: "#FBBF24" }}> Desconto falso</b> = só parece barato porque um pico inflou a média.
            <b style={{ color: "#38BDF8" }}> Alvo B</b> = com pico forte, o alvo vira o preço normal (mediana).
            Só observação: <b style={{ color: "var(--fi-texto)" }}>use o scanner oficial</b> até a revisão de 29/01/2027.
          </p>
        </div>
        {dados?.dias?.length > 1 && (
          <select aria-label="Dia da rodada" value={dados.data_ref || ""} onChange={e => carregar(e.target.value)}
            style={{ background: "#0A1424", color: "var(--fi-texto-2)", border: "1px solid var(--fi-borda-forte)", borderRadius: "999px", padding: "7px 14px", fontSize: "12px" }}>
            {dados.dias.map(d => <option key={d} value={d}>{dia(d)}</option>)}
          </select>
        )}
      </div>

      {erro && (
        <div style={{ ...card, borderColor: "rgba(251,100,116,0.5)", color: "#FB6474", fontSize: "13px" }}>
          Não consegui carregar o Scanner B ({erro}). Isso é FALHA de conexão, não ausência de sinais.
          <button type="button" onClick={() => carregar(dados?.data_ref)} style={{ marginLeft: "10px", height: "30px", padding: "0 12px", borderRadius: "999px", border: "1px solid var(--fi-borda-forte)", cursor: "pointer", background: "transparent", color: "#38BDF8", fontSize: "12px" }}>Tentar de novo</button>
        </div>
      )}

      {/* PLACAR EM DESTAQUE */}
      {placar && (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "14px" }}>
            <CardLado titulo="Oficial (mesmos trades)" b={placar.oficial_pareado || placar.oficial} cor="#9DB0CB" />
            <CardLado titulo="Scanner B (alvo B)" b={placar.b} cor="#38BDF8" destaque />
            <div style={{ ...card, flex: "1 1 280px" }}>
              <div style={rotulo}>Desconto real × falso (oficial)</div>
              {[["Real", placar.desconto_real, "#22D3A0"], ["Falso", placar.desconto_falso, "#FBBF24"]].map(([t, b, c]) => {
                const m = Math.max(Math.abs(placar.desconto_real?.media_fechados || 0), Math.abs(placar.desconto_falso?.media_fechados || 0), 1)
                return b ? (
                  <div key={t} style={{ marginTop: "10px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                      <span style={{ color: "var(--fi-texto-3)" }}>{t} · {b.fechados} fechados</span><b style={{ color: c }}>{pct(b.media_fechados, 2)}</b>
                    </div>
                    <div style={{ height: "8px", borderRadius: "999px", background: "#132238", marginTop: "5px", overflow: "hidden" }}>
                      <div style={{ width: `${Math.abs(b.media_fechados || 0) / m * 100}%`, height: "8px", borderRadius: "999px", background: c, boxShadow: `0 0 10px ${c}88` }} />
                    </div>
                  </div>
                ) : null
              })}
            </div>
          </div>

          <div style={{ ...card }}>
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
              <div style={rotulo}>Caminho até a decisão de 29/01/2027 (plano travado)</div>
              <span style={{ fontSize: "11px", color: "var(--fi-texto-4)" }}>abaixo da meta = inconclusivo → o B continua em sombra</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "18px", marginTop: "10px" }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px" }}><span style={{ color: "var(--fi-texto-3)" }}>Trades fechados no placar</span><b>{metaGeral} de 150</b></div>
                {barraMeta(metaGeral, 150)}
              </div>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px" }}><span style={{ color: "var(--fi-texto-3)" }}>Fechados com desconto falso (H1)</span><b>{metaFalso} de 30</b></div>
                {barraMeta(metaFalso, 30)}
              </div>
            </div>
          </div>
        </>
      )}

      {/* PLACAR DETALHADO */}
      <div style={card}>
        <div style={{ color: "var(--fi-texto-2)", fontWeight: 600, fontSize: "13px", marginBottom: "4px" }}>Placar detalhado: oficial × Scanner B</div>
        <div style={{ color: "var(--fi-texto-4)", fontSize: "11px", marginBottom: "10px" }}>
          COMPRAR da B3 desde {dia(placar?.desde)} · entra na abertura do dia do sinal, alvo pela máxima, stop pelo fechamento, prazo de 105 pregões.
          {placar?.b_nao_opera ? ` · O B deixou de operar ${placar.b_nao_opera} sinais (sem espaço até o preço normal).` : ""}
        </div>
        {carregando && !placar ? <div style={{ color: "var(--fi-texto-4)", fontSize: "13px" }}>Carregando…</div> : !placar ? (
          <div style={{ color: "var(--fi-texto-4)", fontSize: "13px" }}>Placar ainda vazio.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                {["", "Trades", "Fechados", "Bateram alvo", "Bateram stop", "Ganho médio (fechados)", "Ganho médio (todos)"].map(h => <th key={h} style={th}>{h}</th>)}
              </tr></thead>
              <tbody>
                <LinhaPlacar nome="Oficial" b={placar.oficial} />
                <LinhaPlacar nome="Oficial (só onde o B opera)" b={placar.oficial_pareado} />
                <LinhaPlacar nome="Scanner B (alvo B)" b={placar.b} destaque />
                <LinhaPlacar nome="Oficial nos descontos reais" b={placar.desconto_real} />
                <LinhaPlacar nome="Oficial nos descontos falsos" b={placar.desconto_falso} />
              </tbody>
            </table>
            {placar.b_completo?.trades > 0 && (
              <div style={{ marginTop: "12px", padding: "10px 14px", borderRadius: "12px", background: "rgba(56,189,248,0.06)", border: "1px solid rgba(56,189,248,0.2)", color: "var(--fi-texto-2)", fontSize: "12px", lineHeight: 1.6 }}>
                <b style={{ color: "#38BDF8" }}>B completo</b> (alvo B + meia posição no desconto falso + não opera), nos {placar.b_completo.trades} trades já fechados:
                {" "}oficial <b>{pct(placar.b_completo.por_posicao_oficial, 2)}</b> por posição ({placar.b_completo.soma_oficial} pontos em {placar.b_completo.capital_oficial} posições)
                {" "}× B <b>{pct(placar.b_completo.por_posicao_b, 2)}</b> por posição ({placar.b_completo.soma_b} pontos usando {placar.b_completo.capital_b} posições).
              </div>
            )}
            <div style={{ color: "#5F7391", fontSize: "11px", marginTop: "8px" }}>
              Os dois são medidos nos mesmos trades (1 por ativo de cada vez; 5 pregões sem reentrada depois de stop; se abrir já acima do alvo, o trade não acontece).
              "Todos" inclui os trades ainda abertos pelo preço de hoje. Período curto: números vão oscilar até janeiro. Referência de 10 anos: +1,4% por trade.
            </div>
          </div>
        )}
      </div>

      {/* SINAIS DO DIA */}
      <div style={{ ...card, padding: 0, overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px", padding: "16px 20px", borderBottom: "1px solid var(--fi-borda)" }}>
          <div className="fi-titulo" style={{ fontWeight: 600, fontSize: "17px" }}>
            Sinais de {dia(dados?.data_ref)} {falsos > 0 && <span style={{ ...P_WARN, marginLeft: "8px", fontFamily: "Inter, sans-serif" }}>{falsos} COMPRAR com desconto falso</span>}
          </div>
          <div style={{ display: "flex", gap: "6px" }}>
            {["COMPRAR", "MANTER", "TODOS"].map(f => {
              const on = filtro === f
              return (
                <button key={f} type="button" onClick={() => setFiltro(f)} style={{ height: "30px", padding: "0 12px", borderRadius: "999px", cursor: "pointer", fontSize: "11.5px",
                  border: `1px solid ${on ? "rgba(56,189,248,0.6)" : "var(--fi-borda-forte)"}`, background: on ? "rgba(56,189,248,0.14)" : "transparent",
                  color: on ? "var(--fi-texto)" : "var(--fi-texto-3)", boxShadow: on ? "0 0 14px rgba(56,189,248,0.25)" : "none" }}>
                  {f === "TODOS" ? "Todos" : f.charAt(0) + f.slice(1).toLowerCase()}
                </button>
              )
            })}
          </div>
        </div>
        {carregando && !dados ? <div style={{ color: "var(--fi-texto-4)", fontSize: "13px", padding: "20px" }}>Carregando…</div> : !lista.length ? (
          <div style={{ color: "var(--fi-texto-4)", fontSize: "13px", padding: "20px" }}>Nenhum sinal {filtro !== "TODOS" ? filtro : ""} da B3 nessa rodada.</div>
        ) : (
          <div style={{ overflowX: "auto", padding: "0 12px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                {["Ativo", "Sinal oficial", "Desconto B", "Pela média", "Pela mediana", "Pico 6m", "Preço", "Alvo oficial", "Alvo B", "Stop", "Sugestão B"].map(h => <th key={h} style={th}>{h}</th>)}
              </tr></thead>
              <tbody>
                {lista.map(s => {
                  const difAlvo = s.alvo_b != null && s.alvo_oficial != null && Math.abs(s.alvo_b - s.alvo_oficial) >= 0.01
                  const tam = { CHEIA: ["Posição cheia", P_OK], MEIA: ["Meia posição", P_WARN], NAO: ["Não operar", P_BAD] }[s.tamanho_b] || ["—", P_NEU]
                  return (
                    <tr key={s.ticker}>
                      <td style={{ ...td, color: "var(--fi-texto)", fontWeight: 600, fontSize: "13.5px" }} title={s.nome || ""}>{String(s.ticker).replace(".SA", "")}</td>
                      <td style={td}><span style={s.sinal_oficial === "COMPRAR" ? P_OK : P_WARN}>{s.sinal_oficial}</span></td>
                      <td style={td}><Selo desconto={s.desconto} /></td>
                      <td style={{ ...td, color: s.dist_media <= -2 ? "#22D3A0" : "var(--fi-texto-3)" }}>{pct(s.dist_media)}</td>
                      <td style={{ ...td, color: s.dist_mediana <= -2 ? "#22D3A0" : "#FB6474", fontWeight: 600 }}>{pct(s.dist_mediana)}</td>
                      <td style={{ ...td, color: s.pico_pct >= 40 ? "#FBBF24" : "var(--fi-texto-3)", fontWeight: s.pico_pct >= 40 ? 600 : 400 }}>
                        {s.pico_pct != null ? `+${Number(s.pico_pct).toFixed(0)}%` : "—"}{s.pico_pct >= 40 ? " ▲" : ""}
                      </td>
                      <td style={td}>{brl(s.preco_sinal)}</td>
                      <td style={{ ...td, color: "#22D3A0" }}>{brl(s.alvo_oficial)}</td>
                      <td style={{ ...td, color: difAlvo ? "#38BDF8" : "#5F7391", fontWeight: difAlvo ? 600 : 400 }}>
                        {s.tamanho_b === "NAO" ? "—" : difAlvo ? brl(s.alvo_b) : "igual"}
                      </td>
                      <td style={{ ...td, color: "#FB6474" }}>{brl(s.stop)}</td>
                      <td style={td}><span style={tam[1]}>{tam[0]}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div style={{ color: "#5F7391", fontSize: "11px", padding: "10px 8px 14px" }}>
              ▲ pico = o maior fechamento dos 6 meses ficou 40% ou mais acima do preço normal (mediana). Estudo de 10 anos: desconto falso rendeu ~1/3 do real; alvo B subiu o acerto de 37% para 48% nas ações com pico.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
