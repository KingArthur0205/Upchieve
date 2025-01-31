import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Welcome!</h1>
      <p className="text-lg text-gray-700 mb-6">
        Select a rater to view their essays:
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5].map((rater) => (
          <Link key={rater} href={`/essays/${rater}`}>
            <button className="px-6 py-3 bg-blue-600 text-white text-lg font-semibold rounded-lg shadow-md hover:bg-blue-700 transition">
              Rater {rater}
            </button>
          </Link>
        ))}
      </div>
    </div>
  );
}
