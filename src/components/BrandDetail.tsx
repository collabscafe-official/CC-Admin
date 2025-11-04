import React from "react"

const BackIcon = () => (
  <svg
    className="w-5 h-5 mr-2"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      d="M10 19l-7-7m0 0l7-7m-7 7h18"
    ></path>
  </svg>
)

const BrandDetail = ({ brand, onBack }) => {
  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-3xl font-semibold text-gray-700 dark:text-gray-200">
          Brand Profile
        </h2>
        <button
          onClick={onBack}
          className="inline-flex items-center px-4 py-2 text-sm font-medium text-white transition-opacity duration-150 bg-gradient-to-r from-primary to-primary-accent rounded-lg hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary dark:focus:ring-offset-dark-800"
        >
          <BackIcon />
          Back to Brands
        </button>
      </div>
      <div className="p-8 bg-white rounded-lg shadow-md dark:bg-dark-800">
        <div className="flex flex-col items-center text-center">
          <img
            className="object-cover w-24 h-24 mb-4 rounded-full ring-4 ring-primary"
            src={`https://i.pravatar.cc/150?u=${brand.email}`}
            alt={`${brand.name}'s profile`}
          />
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
            {brand.name}
          </h3>
        </div>

        <div className="mt-8 text-sm text-left text-gray-600 dark:text-gray-400 border-t border-gray-200 dark:border-dark-700 pt-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <p className="font-semibold text-gray-700 dark:text-gray-300">
                Email Address
              </p>
              <a
                href={`mailto:${brand.email}`}
                className="font-semibold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary-accent hover:underline"
              >
                {brand.email}
              </a>
            </div>
            <div>
              <p className="font-semibold text-gray-700 dark:text-gray-300">
                Phone Number
              </p>
              <p>{brand.phone}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="font-semibold text-gray-700 dark:text-gray-300">
                Address
              </p>
              <p>{brand.address}</p>
            </div>
            <div>
              <p className="font-semibold text-gray-700 dark:text-gray-300">
                Join Date
              </p>
              <p>{brand.date}</p>
            </div>
            <div>
              <p className="font-semibold text-gray-700 dark:text-gray-300">
                Last Active Time
              </p>
              <p>{brand.time}</p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default BrandDetail
