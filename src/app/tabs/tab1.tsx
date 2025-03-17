import Image from 'next/image';

export default function Tab1() {
    return (
        <div className="h-[80vh] overflow-y-auto p-6 border border-gray-300 rounded-md">

          <h2 className="text-xl font-semibold text-black">
            <a
              href="https://teacher.desmos.com/activitybuilder/custom/5d8d425acd6acb759685edff?intro-banner-expanded=true&collections=5f8a43dd06b0d9a8bd84c3d0%2C5f8a442106b0d9a8bd84c3d5"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              Lesson link (click here)
            </a>
          </h2>
          
          <p className="text-black">
            Students write rules based on input-output pairs represented in tables and are introduced to the concept of function through these rules. <br />
          </p>

          {/* Add a title above the image */}
          <div className="my-4 text-center">
            <h3 className="text-lg font-semibold text-black mb-2">Warm-up: Rule #1</h3>
            <Image src="/t19/rule1.png" alt="Description of the image" width={500} height={300} />
          </div>

          <div className="my-4 text-center">
            <h3 className="text-lg font-semibold text-black mb-2">Rule #2</h3>
            <Image src="/t19/rule2.png" alt="Description of the image" width={500} height={300} />
          </div>

          <div className="my-4 text-center">
            <h3 className="text-lg font-semibold text-black mb-2">Rule #3</h3>
            <Image src="/t19/rule3.png" alt="Description of the image" width={500} height={300} />
          </div>
        </div>
    );
}
