"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function Home() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-white">
        <h1 className="text-3xl font-bold mb-8 text-black">Transcript Viewer</h1>
        <div className="flex flex-col space-y-4">
          <div className="px-8 py-3 bg-gray-300 text-gray-500 font-semibold rounded-md w-64 text-center">
            Loading...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white">
      <h1 className="text-3xl font-bold mb-8 text-black">Transcript Viewer</h1>
      <div className="flex flex-col space-y-4">
        <button 
          onClick={() => router.push("/transcript/001")}
          className="px-8 py-3 bg-blue-500 text-white font-semibold rounded-md hover:bg-blue-700 transition w-64"
        >
          Transcript 001 (available)
        </button>

        <button 
          onClick={() => router.push("/transcript/044")}
          className="px-8 py-3 bg-blue-500 text-white font-semibold rounded-md hover:bg-blue-700 transition w-64"
        >
          Transcript 044 (available)
        </button>

        <button 
          onClick={() => router.push("/transcript/053")}
          className="px-8 py-3 bg-blue-500 text-white font-semibold rounded-md hover:bg-blue-700 transition w-64"
        >
          Transcript 053 (available)
        </button>
      </div>
    </div>
  );
}