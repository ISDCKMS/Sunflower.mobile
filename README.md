# Portal Visión

App de portal controlado por gestos de mano (MediaPipe Hands) con filtros visuales en tiempo real.

## Correr en local

Requiere Node.js 18+.

```bash
npm install
npm run dev
```

Abre la URL que te muestre la terminal (normalmente http://localhost:5173) en Chrome o Safari, y
permite el acceso a la cámara cuando te lo pida.

## Cómo usar

1. Junta el pulgar y el índice de cada mano (como una pinza).
2. Separa las manos formando un rectángulo/portal frente a la cámara.
3. Junta las manos y vuelve a separarlas para pasar al siguiente filtro.
4. Usa el botón "Ajustes" para mover la sensibilidad y el suavizado si el
   tracking se siente muy estricto o muy tembloroso.

## Desplegar (para tener un link con https, necesario para la cámara en el celular)

Recomendado: Vercel o Netlify (detectan Vite automáticamente).

```bash
npm run build
```

Esto genera la carpeta `dist/` lista para subir a cualquier hosting estático.
