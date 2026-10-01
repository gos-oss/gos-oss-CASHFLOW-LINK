import React, { useState } from "react";
import { usePWAInstall } from "./usePWAInstall";
import { Smartphone, Download, Share2, X, CheckCircle2 } from "lucide-react";
import { tokens } from "./tokens";

export function PWAInstallButton({ compact = false }) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSModal, setShowIOSModal] = useState(false);

  // If already installed, don't show
  if (isInstalled) return null;

  if (isInstallable) {
    return (
      <button
        onClick={install}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          background: tokens.gold,
          color: tokens.ink,
          border: "none",
          borderRadius: 6,
          padding: compact ? "6px 10px" : "8px 14px",
          fontSize: compact ? 11 : 12.5,
          fontWeight: 700,
          cursor: "pointer",
          boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
          transition: "transform 0.15s ease",
        }}
        title="Instalar como app en tu celular o escritorio"
      >
        <Download size={compact ? 13 : 15} />
        <span>Instalar App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSModal(true)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "rgba(255,255,255,0.12)",
            color: "#FFFFFF",
            border: "1px solid rgba(255,255,255,0.25)",
            borderRadius: 6,
            padding: compact ? "6px 10px" : "8px 14px",
            fontSize: compact ? 11 : 12.5,
            fontWeight: 600,
            cursor: "pointer"
          }}
          title="Ver cómo instalar en iPhone / iPad"
        >
          <Smartphone size={compact ? 13 : 15} color={tokens.gold} />
          <span>App en iPhone</span>
        </button>

        {showIOSModal && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 9999,
              background: "rgba(15, 23, 42, 0.75)",
              backdropFilter: "blur(4px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 16
            }}
            onClick={() => setShowIOSModal(false)}
          >
            <div
              style={{
                background: "#FFFFFF",
                borderRadius: 14,
                maxWidth: 360,
                width: "100%",
                padding: 22,
                boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.3)",
                color: tokens.ink,
                position: "relative"
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setShowIOSModal(false)}
                style={{
                  position: "absolute",
                  top: 14,
                  right: 14,
                  background: "#F1F5F9",
                  border: "none",
                  borderRadius: "50%",
                  width: 28,
                  height: 28,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: tokens.textMuted
                }}
              >
                <X size={16} />
              </button>

              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <div style={{ background: "#FEF3C7", padding: 8, borderRadius: 10 }}>
                  <Smartphone size={24} color="#B45309" />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Instalar en iPhone</h4>
                  <p style={{ margin: 0, fontSize: 12, color: tokens.textMuted }}>Acceso directo como app nativa</p>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12, margin: "16px 0", fontSize: 13, lineHeight: 1.45 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <span style={{ background: "#EEF2F6", color: tokens.ink, fontWeight: 700, borderRadius: "50%", width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 11 }}>1</span>
                  <span>En Safari, toca el botón <strong>Compartir</strong> <Share2 size={13} style={{ display: "inline", verticalAlign: "middle" }} /> en la barra inferior.</span>
                </div>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <span style={{ background: "#EEF2F6", color: tokens.ink, fontWeight: 700, borderRadius: "50%", width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 11 }}>2</span>
                  <span>Desplaza hacia abajo y selecciona <strong>"Agregar a pantalla de inicio"</strong>.</span>
                </div>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <span style={{ background: "#EEF2F6", color: tokens.ink, fontWeight: 700, borderRadius: "50%", width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 11 }}>3</span>
                  <span>Toca <strong>"Agregar"</strong> arriba a la derecha. ¡Listo!</span>
                </div>
              </div>

              <button
                onClick={() => setShowIOSModal(false)}
                style={{
                  width: "100%",
                  background: tokens.ink,
                  color: "#FFFFFF",
                  border: "none",
                  borderRadius: 8,
                  padding: "10px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer"
                }}
              >
                Entendido
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
}
