# Dashboard Importaciones Ecuador

Dashboard estático para publicar en GitHub Pages.

## Estructura

```text
index.html
styles.css
app.js
data/importaciones_data.csv
data/importaciones_summary.json
assets/asiapac-logo-completo.png
```

## Publicación en GitHub Pages

1. Crear un repositorio nuevo, por ejemplo `dashboard-importaciones-ecuador`.
2. Subir todos los archivos de esta carpeta a la raíz del repositorio.
3. Ir a `Settings > Pages`.
4. En `Build and deployment`, seleccionar:
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/root`
5. Guardar.

La URL quedará similar a:

```text
https://TU-USUARIO.github.io/dashboard-importaciones-ecuador/
```

## Nota técnica

El dashboard carga la data desde `data/importaciones_data.csv` usando PapaParse y renderiza gráficos con Chart.js desde CDN. GitHub Pages soporta esta estructura sin backend.
