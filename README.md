# Firma de resguardos — PWA

App para **firmar resguardos en PDF** con el dedo o pluma táctil, directo en tablet o móvil.
Funciona **sin conexión** una vez instalada y guarda todo **en el dispositivo** (no sube nada a ningún servidor).

## Qué incluye

- **Cargar PDFs** desde el dispositivo, o **importar una carpeta completa** de golpe (en navegadores compatibles).
- Al abrir un PDF: **tira de miniaturas** de todas las hojas; tocas la hoja y se **agranda** para firmar encima.
- **Firma a mano** con eventos de puntero: la pluma usa **presión** (trazo más grueso al apretar); el dedo también funciona. Controles de grosor, **deshacer** y **limpiar hoja**.
- **Tablero** con conteos de **Pendientes**, **Firmados** y **Por exportar**; cada chip filtra la lista.
- **Buscador** por nombre para encontrar rápido entre muchos PDFs.
- **Estados con color**: Pendiente (amarillo), Firmado (verde), Por exportar (azul), Eliminado (rojo, en papelera con restaurar).
- **Exportar** el PDF ya firmado y **guardarlo en el dispositivo** (elige carpeta de destino donde el navegador lo permite). Exportación individual o **en lote** desde la cola.

## Archivos

```
firma-resguardos/
├─ index.html      ← la app (todo el código)
├─ manifest.json   ← datos de la PWA (nombre, íconos, color)
├─ sw.js           ← service worker (funcionamiento sin conexión)
└─ icons/
   ├─ icon-192.png
   ├─ icon-512.png
   └─ icon-maskable-512.png
```

Sube **toda la carpeta tal cual**. La PWA necesita **HTTPS** (todos los hosts de abajo lo dan gratis; `localhost` también sirve para pruebas).

---

## Opción gratis para hospedar (además de GitHub Pages)

Cualquiera sirve PDFs y archivos estáticos por HTTPS, requisito para que la PWA se instale y trabaje offline. De más fácil a más potente:

| Opción | Por qué elegirla | Cómo subir |
|---|---|---|
| **Netlify** | La más simple. **Arrastras la carpeta** a la web y queda publicada. | netlify.com → Add new site → *Deploy manually* (arrastrar carpeta). Tier gratis: ~100 GB/mes. |
| **Cloudflare Pages** | **Ancho de banda ilimitado** en el plan gratis y CDN muy rápido. Ideal si la usarán muchas personas. | pages.dev → conectas repo de GitHub/GitLab, o subes con la CLI *Wrangler*. |
| **Vercel** | Despliegue automático desde Git, muy pulido. | vercel.com → importas el repo. Tier *Hobby* gratis para uso personal. |
| **Firebase Hosting** | De Google, HTTPS sólido, buen tier gratis. | `npm i -g firebase-tools` → `firebase init hosting` → `firebase deploy`. |
| **GitHub Pages** | Lo que ya usas; perfecto si trabajas desde un repo. | Settings → Pages → rama y carpeta. |

**Recomendación rápida:** si quieres “arrastrar y listo”, usa **Netlify**. Si esperas mucho tráfico, **Cloudflare Pages**.
(Nota: Render y Railway siguen siendo gratis para estáticos, pero su enfoque es más para apps con backend; para esta app no hace falta.)

---

## Instalar como app en la tablet / móvil

1. Abre la URL pública en **Chrome** (Android) o **Safari** (iPhone/iPad).
2. **Android/Chrome:** menú ⋮ → *Instalar app* / *Agregar a pantalla de inicio*.
3. **iPad/iPhone (Safari):** botón Compartir → *Agregar a inicio*.
4. Se abre a pantalla completa, sin barra del navegador, y ya trabaja **sin conexión**.

---

## Compatibilidad de “elegir/guardar carpeta”

- **Android Chrome y Chrome/Edge de escritorio:** soportan elegir carpeta de origen y carpeta de destino al exportar (File System Access API).
- **iPhone/iPad (Safari):** no expone esa API; ahí la app usa el selector de archivos de iOS para cargar, y al exportar abre la hoja de **Compartir/Guardar en Archivos**. Funciona igual, solo con un paso más.

## Notas técnicas

- Render de PDF con **pdf.js**; la firma se incrusta con **pdf-lib**. Ambas se cargan desde cdnjs y el service worker las guarda para uso offline.
- Los resguardos se guardan en **IndexedDB** del dispositivo. No hay nube ni cuentas.
- La firma se coloca cubriendo la hoja seleccionada respetando la posición donde dibujaste. Pensado para hojas en orientación normal; si algún PDF trae páginas rotadas, revisa la posición tras exportar.
- Para publicar una **actualización**: cambia algo en `index.html` y sube el número de versión en `sw.js` (`const CACHE = "resguardos-v2"`), así los dispositivos toman la versión nueva.
