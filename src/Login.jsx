import { useState } from "react"

export default function Login({ onLogin }) {
  const [senha, setSenha] = useState("")
  const [erro, setErro] = useState(false)

  const tentar = () => {
    if (senha === "TradeAI@2026") {
      onLogin()
    } else {
      setErro(true)
      setSenha("")
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
          placeholder="Digite a senha padrão"
          style={{
            width: "100%", padding: "12px", borderRadius: "8px",
            border: erro ? "1px solid #ef4444" : "1px solid #334155",
            background: "#060d1a", color: "#f1f5f9", fontSize: "16px",
            marginBottom: "16px", boxSizing: "border-box", outline: "none"
          }}
        />
        {erro && (
          <p style={{color: "#ef4444", fontSize: "13px", marginBottom: "12px", fontWeight: "600"}}>
            ⚠️ Senha incorreta. Tente novamente.
          </p>
        )}
        <button onClick={tentar} style={{
          width: "100%", padding: "12px", borderRadius: "8px",
          border: "none", background: "linear-gradient(135deg,#38bdf8,#0284c7)", color: "#0f172a",
          fontWeight: "bold", fontSize: "16px", cursor: "pointer",
          boxShadow: "0 2px 8px rgba(56,189,248,0.3)"
        }}>
          Entrar no Terminal
        </button>
      </div>
    </div>
  )
}