with tab_matriz:
            st.markdown(f"### 📋 Matriz Detallada Segmentada (Desde {fecha_corte.strftime('%d/%m/%Y')})")
            
            # 1. Buscamos los índices de corte
            idx_ingresos_list = df_procesado.index[df_procesado['concepto_norm'].str.contains("totalingresos", na=False)].tolist()
            idx_egresos_list = df_procesado.index[df_procesado['concepto_norm'].str.contains("totalegresos", na=False)].tolist()
            
            if idx_ingresos_list and idx_egresos_list:
                idx_ing = idx_ingresos_list[0]
                idx_egr = idx_egresos_list[0]
                
                # 2. Rebanamos (Slicing) la tabla en 3 bloques lógicos
                df_ing = df_procesado.iloc[:idx_ing + 1].copy()
                df_egr = df_procesado.iloc[idx_ing + 1:idx_egr + 1].copy()
                df_saldos = df_procesado.iloc[idx_egr + 1:].copy()
                
                columnas_a_mostrar = [col_concepto] + cols_fechas
                
                # --- BLOQUE A: INGRESOS ---
                st.markdown("<h5 style='color: #4ADE80; margin-top: 20px;'>Flujo de Ingresos</h5>", unsafe_allow_html=True)
                df_ing_display = df_ing[columnas_a_mostrar].copy()
                for col in cols_fechas:
                    df_ing_display[col] = df_ing_display[col].apply(formato_moneda_texto)
                st.dataframe(df_ing_display.style.map(pintar_negativos, subset=cols_fechas), use_container_width=True, hide_index=True)
                
                # --- BLOQUE B: EGRESOS ---
                st.markdown("<h5 style='color: #F87171; margin-top: 20px;'>Estructura de Egresos</h5>", unsafe_allow_html=True)
                df_egr_display = df_egr[columnas_a_mostrar].copy()
                for col in cols_fechas:
                    df_egr_display[col] = df_egr_display[col].apply(formato_moneda_texto)
                st.dataframe(df_egr_display.style.map(pintar_negativos, subset=cols_fechas), use_container_width=True, hide_index=True)
                
                # --- BLOQUE C: SALDOS ---
                st.markdown("<h5 style='color: #3b82f6; margin-top: 20px;'>Resumen de Saldos</h5>", unsafe_allow_html=True)
                df_saldos_display = df_saldos[columnas_a_mostrar].copy()
                for col in cols_fechas:
                    df_saldos_display[col] = df_saldos_display[col].apply(formato_moneda_texto)
                st.dataframe(df_saldos_display.style.map(pintar_negativos, subset=cols_fechas), use_container_width=True, hide_index=True)
                
            else:
                # Fallback de seguridad por si no encuentra las palabras exactas
                st.warning("Mostrando tabla completa: Asegúrate de que existan las filas 'Total ingresos' y 'Total Egresos'.")
                columnas_a_mostrar = [col_concepto] + cols_fechas
                df_display = df_procesado[columnas_a_mostrar].copy()
                for col in cols_fechas:
                    df_display[col] = df_display[col].apply(formato_moneda_texto)
                st.dataframe(df_display.style.map(pintar_negativos, subset=cols_fechas), use_container_width=True, hide_index=True)
