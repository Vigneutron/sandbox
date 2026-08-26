"use client";

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="py-16 text-center">
      <h1 className="text-2xl font-bold">Something broke 🔧</h1>
      <p className="mx-auto mt-3 max-w-md text-gray-300">
        The gadget hit a snag. Your goals are safe — this was just a display
        error.
      </p>
      <button
        onClick={reset}
        className="mt-6 rounded-lg bg-gold-500 px-5 py-2.5 font-medium text-ongold hover:bg-gold-400"
      >
        Reload the page
      </button>
    </div>
  );
}
