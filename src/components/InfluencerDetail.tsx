import React from 'react';
import { Influencer } from '../types';
import { useDispatch } from 'react-redux';
import { approveCreator } from '../store/actions/creatorAction';

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const baseClasses = "px-2 py-1 text-xs font-medium rounded-full inline-block";
  let colorClasses = "";
  switch (status) {
    case 'Active':
      colorClasses = "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      break;
    case 'Pending':
      colorClasses = "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
      break;
    case 'Inactive':
      colorClasses = "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
      break;
  }
  return <span className={`${baseClasses} ${colorClasses}`}>{status}</span>;
};

const BackIcon = () => (
    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
);


interface InfluencerDetailProps {
  influencer: Influencer;
  onBack: () => void;
}

const InfluencerDetail: React.FC<InfluencerDetailProps> = ({ influencer, onBack }) => {
  const dispatch = useDispatch();

  const handleApproveCreator = (id: string) => {
    console.log(id, '=====> id');
    dispatch(approveCreator(id) as any);
  };
  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-3xl font-semibold text-gray-700 dark:text-gray-200">
          Influencer Profile
        </h2>
        <button
            onClick={onBack}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white transition-opacity duration-150 bg-gradient-to-r from-primary to-primary-accent rounded-lg hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary dark:focus:ring-offset-dark-800"
        >
           <BackIcon />
           Back to Influencers
        </button>
      </div>
      <div className="p-8 bg-white rounded-lg shadow-md dark:bg-dark-800">
        <div className="flex flex-col items-center text-center">
            <img
                className="object-cover w-24 h-24 mb-4 rounded-full ring-4 ring-primary"
                src={influencer.profile_image || `https://eu.ui-avatars.com/api/?name=${influencer.name}&size=250&background=random`}
                alt={`${influencer.name}'s profile`}
            />
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                {influencer.name}
            </h3>
            <div className="mt-2">
                <StatusBadge status={influencer.is_active ? 'Active' : 'Inactive'} />
            </div>
        </div>
        

        <div className="mt-8 text-sm text-left text-gray-600 dark:text-gray-400 border-t border-gray-200 dark:border-dark-700 pt-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                    <p className="font-semibold text-gray-700 dark:text-gray-300">Email Address</p>
                    <a href={`mailto:${influencer.email}`} className="font-semibold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary-accent hover:underline">{influencer.email}</a>
                </div>
                 <div>
                    <p className="font-semibold text-gray-700 dark:text-gray-300">Phone Number</p>
                    <p>{influencer.phone}</p>
                </div>
                 <div className="sm:col-span-2">
                    <p className="font-semibold text-gray-700 dark:text-gray-300">Address</p>
                    <p>{influencer.country ? influencer.country.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ') : ''}{influencer.city ? ', ' + influencer.city.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ') : ''}</p>
                </div>
                <div>
                    <p className="font-semibold text-gray-700 dark:text-gray-300">Join Date</p>
                    <p>{influencer.created_date.split('T')[0]}</p>
                </div>
                <div>
                    <p className="font-semibold text-gray-700 dark:text-gray-300">Last Active Time</p>
                    <p>{influencer.created_date.split('T')[1].split(':').slice(0, 2).join(':')}</p>
                </div>
            </div>
        </div>
        {!influencer?.is_approved_by_admin && (
            <div className="mt-8 text-sm text-left text-gray-600 dark:text-gray-400 border-t border-gray-200 dark:border-dark-700 pt-6">
                <button
                    onClick={() => handleApproveCreator(influencer._id)}
                    className="inline-flex items-center px-4 py-2 text-sm font-medium text-white transition-opacity duration-150 bg-gradient-to-r from-primary to-primary-accent rounded-lg hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary dark:focus:ring-offset-dark-800"
                >
                    Approve Creator
                </button>
            </div>
        )}
      </div>
    </>
  );
};

export default InfluencerDetail;