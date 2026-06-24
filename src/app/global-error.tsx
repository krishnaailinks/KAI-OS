"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body className="flex items-center justify-center min-h-screen bg-slate-950 text-white">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-4xl font-bold">System Error</h1>
          <p className="text-slate-400">
            KAI-OS encountered a critical error. Our team has been notified.
          </p>
          <button
            onClick={reset}
            className="px-6 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </body>
    </html>
  );
}
