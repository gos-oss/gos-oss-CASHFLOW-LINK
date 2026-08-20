import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

export default function TablaMovimientos({ semanas, baseIncome, baseExpense }) {
  const [verIngresos, setVerIngresos] = useState(true);
  const [verEgresos, setVerEgresos] = useState(true);

  if (!semanas || semanas.length === 0) return null;

  return (
    <div style={{ background: "#fff", border: "1px solid #DEDAD0", borderRadius: 8, padding: 20, marginTop: 20 }}>
      <h3>Desglose de Flujos</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
        <tbody>
          {/* --- CABECERA INGRESOS --- */}
          <tr 
            onClick={() => setVerIngresos(!verIngresos)} 
            style={{ cursor: 'pointer', background: '#F0FDF4', color: '#166534' }}
          >
            <td style={{ padding: '10px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {verIngresos ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
              INGRESOS (Conceptos)
            </td>
          </tr>

          {/* --- DETALLE INGRESOS --- */}
          {verIngresos && baseIncome.map((concepto) => (
            <tr key={concepto.key} style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '10px 10px 10px 40px', color: '#64748B' }}>
                {concepto.label}
              </td>
            </tr>
          ))}

          {/* --- CABECERA EGRESOS --- */}
          <tr 
            onClick={() => setVerEgresos(!verEgresos)} 
            style={{ cursor: 'pointer', background: '#FEF2F2', color: '#991B1B' }}
          >
            <td style={{ padding: '10px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
              {verEgresos ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
              EGRESOS (Conceptos)
            </td>
          </tr>

          {/* --- DETALLE EGRESOS --- */}
          {verEgresos && baseExpense.map((concepto) => (
            <tr key={concepto.key} style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '10px 10px 10px 40px', color: '#64748B' }}>
                {concepto.label}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
