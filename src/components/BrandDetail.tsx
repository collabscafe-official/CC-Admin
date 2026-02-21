import React from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { getBrands } from '../store/actions/brandAction';

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
);

const BrandDetail: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation() as any;
  const dispatch = useDispatch();
  const brands = useSelector((state: any) => state.brands);

  const brand = location.state?.brand || (brands?.profiles || brands?.brands || [])?.find((b: any) => b._id === id);

  const savedPage = location.state?.currentPage || 1;
  const savedItemsPerPage = location.state?.itemsPerPage || 10;

  const handleBack = () => {
    // @ts-ignore - getBrands from JS has callback as last param
    dispatch(getBrands(savedItemsPerPage, savedPage, '', '', '', '', '', '', '', '', () => {}) as unknown as any);
    navigate('/brands', { state: { currentPage: savedPage, itemsPerPage: savedItemsPerPage } });
  };

  if (!brand) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Brand not found.</div>
      </div>
    );
  }

  return (
    <>
      <div className="mb-10">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-3xl font-semibold text-gray-700 dark:text-gray-200">
            Brand Profile
          </h2>
          <button
            onClick={handleBack}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white transition-opacity duration-150 rounded-lg bg-gradient-to-r from-primary to-primary-accent hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary dark:focus:ring-offset-dark-800"
          >
            <BackIcon />
            Back to Brands
          </button>
        </div>

        <div className="p-8 bg-white rounded-lg shadow-md dark:bg-dark-800">
          <div className="flex flex-col items-center text-center">
            <img
              className="object-cover w-24 h-24 mb-4 rounded-full ring-4 ring-primary"
              src={brand.profile_image || brand.logo || `https://eu.ui-avatars.com/api/?name=${brand.name}&size=250&background=random`}
              alt={`${brand.name}'s profile`}
            />
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
              {brand.name}
            </h3>
            {brand.profile_title && (
              <p className="font-semibold text-gray-600 dark:text-gray-300">{brand.profile_title}</p>
            )}
            {brand.profile_description && (
              <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">{brand.profile_description}</p>
            )}
          </div>

          <div className="mt-8 text-sm text-left text-gray-600 dark:text-gray-400 border-t border-gray-200 dark:border-dark-700 pt-6">
            <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Contact Info</h4>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <p className="font-semibold text-gray-700 dark:text-gray-300">Email Address</p>
                <a
                  href={`mailto:${brand.email}`}
                  className="font-semibold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary-accent hover:underline"
                >
                  {brand.email}
                </a>
              </div>
              <div>
                <p className="font-semibold text-gray-700 dark:text-gray-300">Phone Number</p>
                <p>{brand.team_members?.[0]?.phone || '-'}</p>
              </div>
              <div>
                <p className="font-semibold text-gray-700 dark:text-gray-300">Address</p>
                <p>
                  {[brand.country, brand.city].filter(Boolean)
                    .map((part: string) => part.split(' ').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' '))
                    .join(', ') || '-'}
                </p>
              </div>
              {brand.created_date && (
                <div>
                  <p className="font-semibold text-gray-700 dark:text-gray-300">Join Date</p>
                  <p>
                    {brand.created_date.split('T')[0]}{' '}
                    {brand.created_date.split('T')[1]?.split(':').slice(0, 2).join(':') || ''}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default BrandDetail;
