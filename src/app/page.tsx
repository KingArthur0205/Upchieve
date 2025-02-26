"use client";

import Image from 'next/image';
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function Home() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  const valid_rater_codes = [
    "tester",
    "RATERTEST",
    "RATER0",
    "RATER1",
    "RATER2",
    "RATER3",
    "RATER4",
    "RATER5",
    "RATER6",
    "RATER7",
    "RATER8",
    "RATER9",
    "RATER10",
    "RATER11",
    "RATER12",
    "RATER13",
    "RATER14",
  ]

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log(code);
    if (valid_rater_codes.includes(code)) {
      router.push(`/data/${code}`);
    } else {
      setError(
        'Invalid code. Please enter the code given in your welcome email. Or, email mxtan@stanford.edu for a new one.'
      );
    }
  };

  return (
    
    <div className="flex flex-col items-center justify-center min-h-screen bg-white font-sans font-light text-sm">
      <div className='grid grid-col w-2/5'>
        <div className="flex justify-center mb-4"> {/* Center the image */}
          <div className="w-full max-w-xs"> {/* Adjust max-width as needed */}
            <Image
              src={"/stanford-gse.png"}
              layout="responsive"
              width={4}
              height={3}
              className="max-w-full h-auto"
              alt="Stanford Graduate School of Education Logo"
            />
          </div>
        </div>
        <h1 className='text-3xl mb-4 p-4 text-gray-900 text-center'>Feedback Research Study</h1>
        <p className="mb-4 text-gray-700 text-lg text-center">Thank you for your interest in our study! We are researching how ELA teachers give feedback on students&apos; essays, and we&apos;re grateful for your support. :)</p>
        <p className="text-lg text-gray-700 mb-4 text-center">
          Please enter your rater code to get started:
        </p>
      </div>
      <form onSubmit={handleSubmit} className="w-full max-w-md">
        <div className="flex flex-col gap-4">
          <input
            type="text"
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setError(""); // Clear error when user types
            }}
            placeholder="Enter code (e.g., rater1)"
            className="mb-4 p-2 border rounded text-gray-900 focus:border-[#006B81] outline-none"
          />

          {error && <div className="text-red-600 text-sm">{error}</div>}

          <button
            type="submit"
            className="mt-2 bg-[#006B81] text-white p-2 rounded text-base"
          >
            Get Started
          </button>
        </div>
      </form>
    </div>
  );
}
