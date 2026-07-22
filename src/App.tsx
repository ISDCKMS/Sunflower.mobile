import PortalOptimizado from '@/components/PortalOptimizado';

export default function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <span className="text-white font-mono font-bold text-lg">◇</span>
            </div>
            <div>
              <h1 className="text-2xl font-mono font-bold text-primary">Portal Visión</h1>
              <p className="text-xs text-gray-600 font-mono">Visión Artificial en Tiempo Real</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container py-12">
        <section className="mb-12 text-center">
          <h2 className="text-4xl md:text-5xl font-mono font-bold text-primary mb-4">
            Tu mano, tu portal
          </h2>
          <p className="text-lg text-gray-600 font-mono max-w-2xl mx-auto mb-8">
            Controla un portal dinámico con tus manos usando visión artificial. Junta pulgar e índice
            de cada mano, separa las manos para abrir el portal, y vuelve a juntarlas y separarlas para
            cambiar de filtro.
          </p>
        </section>

        <section className="mb-12">
          <PortalOptimizado />
        </section>
      </main>

      <footer className="border-t border-gray-200 bg-white/50 backdrop-blur-sm mt-16">
        <div className="container py-8">
          <div className="text-center text-sm text-gray-600 font-mono">
            <p>Portal de Visión Artificial © 2026</p>
            <p className="mt-2 text-xs text-gray-500">Construido con React, MediaPipe y Canvas API</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
