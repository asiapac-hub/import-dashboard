# Dashboard Importaciones Ecuador, Asiapac

Versión estática lista para GitHub Pages.

## Publicación

1. Crear o abrir el repositorio en GitHub.
2. Subir estos archivos en la raíz del repositorio:
   - `index.html`
   - `styles.css`
   - `app.js`
   - carpeta `data/`
   - carpeta `assets/`
3. En GitHub ir a **Settings > Pages**.
4. En **Build and deployment**, seleccionar:
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/root`
5. Guardar y esperar la publicación.

## Filtros incluidos

- MES
- EMPRESA ECUADOR
- EMPRESA EXTERIOR
- PUERTO ECUADOR
- PUERTO ORIGEN
- PAIS ORIGEN
- COMMODITY
- EMPRESA DE TRANSPORTE
- FREIGHT FORWARDER ORIGEN
- FREIGHT FORWARDER DESTINO
- TIPO DESPACHO
- INCOTERM
- CARGA REFRIGERADA

## Regla de carga refrigerada

- Sí: `40_FT_TEMP_CONT > 0`
- No: `40_FT_TEMP_CONT = 0`

## Métricas principales

- 20GP: columna `20`
- 40RF: columna `40_FT_TEMP_CONT`
- 40HC: columna `40 - 40_FT_TEMP_CONT`
- TEUS: columna `TEUS_FCL`
