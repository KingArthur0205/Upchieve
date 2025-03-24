import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white">
      <h1 className="text-3xl font-bold mb-8 text-black">Transcript Viewer</h1>
      <div className="flex flex-col space-y-4">
        <Link href="/transcript/19">
          <button className="px-8 py-3 bg-blue-500 text-white font-semibold rounded-md hover:bg-blue-700 transition w-64">
            Transcript 19 (available)
          </button>
        </Link>
      </div>
    </div>
  );
}