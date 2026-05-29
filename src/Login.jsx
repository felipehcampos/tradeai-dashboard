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
      justifyContent: "center", background: "#0f172a"
    }}>
      <div style={{
        background: "#1e293b", padding: "48px", borderRadius: "16px",
        width: "100%", maxWidth: "400px", textAlign: "center",
        border: "1px solid #334155"
      }}>
        <div style={{fontSize: "48px", marginBottom: "16px"}}>📊</div>
        <h1 style={{color: "#38bdf8", marginBottom: "8px", fontSize: "24px"}}>TradeAI</h1>
        <p style={{color: "#94a3b8", marginBottom: "32px", fontSize: "14px"}}>
          Sistema privado — acesso restrito
        </p>
        <input
          type="password"
          value={senha}
          onChange={e => { setSenha(e.target.value); setErro(false) }}
          onKeyDown={e => e.key === "Enter" && tentar()}
          placeholder="Digite a senha"
          style={{
            width: "100%", padding: "12px", borderRadius: "8px",
            border: erro ? "1px solid #ef4444" : "1px solid #334155",
            background: "#0f172a", color: "#f1f5f9", fontSize: "16px",
            marginBottom: "16px", boxSizing: "border-box"
          }}
        />
        {erro && (
          <p style={{color: "#ef4444", fontSize: "13px", marginBottom: "12px"}}>
            Senha incorreta. Tente novamente.
          </p>
        )}
        <button onClick={tentar} style={{
          width: "100%", padding: "12px", borderRadius: "8px",
          border: "none", background: "#38bdf8", color: "#0f172a",
          fontWeight: "bold", fontSize: "16px", cursor: "pointer"
        }}>
          Entrar
        </button>
      </div>
    </div>
  )
}