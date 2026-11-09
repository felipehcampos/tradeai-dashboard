import { useState } from "react"
import axios from "axios"
import { salvarToken } from "./services/api"

const API = import.meta.env.VITE_API_URL

// 09/11/2026: a senha é conferida no SERVIDOR (antes ficava escrita aqui, visível no site).
export default function Login({ onLogin }) {
  const [senha, setSenha] = useState("")
  const [erro, setErro] = useState(false)
  const [msg, setMsg] = useState("")
  const [enviando, setEnviando] = useState(false)

  const tentar = async () => {
    if (!senha || enviando) return
    setEnviando(true)
    try {
      const r = await axios.post(`${API}/login`, { senha })
      if (r.data?.token) {
        salvarToken(r.data.token)
        onLogin()
        return
      }
      setErro(true); setMsg("Senha incorreta. Tente novamente.")
    } catch (e) {
      const st = e?.response?.status
      setErro(true)
      setMsg(st === 401 ? "Senha incorreta. Tente novamente."
        : st === 429 ? "Muitas tentativas. Espere 15 minutos."
        : st === 503 ? "Senha ainda não configurada no servidor."
        : "Servidor indisponível. Tente de novo em instantes.")
    } finally {
      setSenha("")
      setEnviando(false)
    }
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center", background: "#060d1a" // ── Sincronizado com App.jsx ──
    }}>
      <div style={{
        background: "#0d1829", border: "1px solid rgba(56,189,248,0.1)", // ── Layout Terminal Dark ──
        padding: "48px", borderRadius: "16px",
        width: "100%", maxWidth: "400px", textAlign: "center",
        boxShadow: "0 4px 30px rgba(0, 0, 0, 0.7)"
      }}>
        <div style={{fontSize: "48px", marginBottom: "16px"}}>📈</div>
        <h1 style={{color: "#f1f5f9", fontWeight: "800", marginBottom: "8px", fontSize: "24px", letterSpacing: "-0.5px"}}>
          Trade<span style={{ color: "#38bdf8" }}>AI</span>
        </h1>
        <p style={{color: "#64748b", marginBottom: "32px", fontSize: "14px"}}>
          Sistema privado — acesso restrito
        </p>
        <input
          type="password"
          autoFocus // ── Cursor já nasce ativado aqui ──
          value={senha}
          onChange={e => { setSenha(e.target.value); setErro(false) }}
          onKeyDown={e => e.key === "Enter" && tentar()}
          placeholder="Digite a senha"
          style={{
            width: "100%", padding: "12px", borderRadius: "8px",
            border: erro ? "1px solid #ef4444" : "1px solid #334155",
            background: "#060d1a", color: "#f1f5f9", fontSize: "16px",
            marginBottom: "16px", boxSizing: "border-box", outline: "none"
          }}
        />
        {erro && (
          <p style={{color: "#ef4444", fontSize: "13px", marginBottom: "12px", fontWeight: "600"}}>
            ⚠️ {msg || "Senha incorreta. Tente novamente."}
          </p>
        )}
        <button onClick={tentar} style={{
          width: "100%", padding: "12px", borderRadius: "8px",
          border: "none", background: "linear-gradient(135deg,#38bdf8,#0284c7)", color: "#0f172a",
          fontWeight: "bold", fontSize: "16px", cursor: "pointer",
          boxShadow: "0 2px 8px rgba(56,189,248,0.3)"
        }}>
          {enviando ? "Conferindo…" : "Entrar no Terminal"}
        </button>
      </div>
    </div>
  )
}