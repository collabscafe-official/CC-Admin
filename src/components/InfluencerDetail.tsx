import React from 'react';
import { Influencer } from '../types';
import { useDispatch } from 'react-redux';
import { approveCreator } from '../store/actions/creatorAction';
import PackagesSection from './PackagesSection';
import ContentHighlights from './ContentHighlights';
import FaqsSection from './FaqsSection';

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

const InstagramIcon = () => (
  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.85s-.011 3.584-.069 4.85c-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07s-3.584-.012-4.85-.07c-3.252-.148-4.771-1.691-4.919-4.919-.058-1.265-.069-1.645-.069-4.85s.011-3.584.069-4.85c.149-3.225 1.664-4.771 4.919-4.919 1.266-.058 1.644-.07 4.85-.07zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948s.014 3.667.072 4.947c.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072s3.667-.014 4.947-.072c4.358-.2 6.78-2.618 6.98-6.98.059-1.281.073-1.689.073-4.948s-.014-3.667-.072-4.947c-.2-4.358-2.618-6.78-6.98-6.98-1.281-.059-1.689-.073-4.948-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.162 6.162 6.162 6.162-2.759 6.162-6.162-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4s1.791-4 4-4 4 1.79 4 4-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44 1.441-.645 1.441-1.44-.645-1.44-1.441-1.44z"/>
  </svg>
);

const TwitterIcon = () => (
  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.119 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616v.064c0 2.298 1.634 4.212 3.793 4.649-.65.177-1.354.238-2.08.087.625 1.905 2.441 3.291 4.597 3.33-1.623 1.274-3.666 2.031-5.893 2.031-.383 0-.76-.022-1.13-.066 2.099 1.353 4.596 2.144 7.29 2.144 8.746 0 13.528-7.248 13.528-13.528 0-.206-.005-.412-.013-.617.929-.672 1.73-1.511 2.37-2.459z"/>
  </svg>
);

const YouTubeIcon = () => (
  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
);

const XIcon = () => (
  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932L18.901 1.153zm-1.613 19.59h2.546L4.109 2.507H1.513z"/>
  </svg>
);

const TikTokIcon = () => (
  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.74-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
  </svg>
);


interface InfluencerDetailProps {
  influencer: Influencer;
  onBack: () => void;
}

const InfluencerDetail: React.FC<InfluencerDetailProps> = ({ influencer, onBack }) => {
  const dispatch = useDispatch();

  const handleApproveCreator = (id: string) => {
    dispatch(approveCreator(id) as any);
  };
  return (
    <>
    <div className="mb-10">
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
          {/* <div className="mt-2">
                <StatusBadge status={influencer.is_active ? 'Active' : 'Inactive'} />
            </div> */}
          {influencer.social_handles && influencer.social_handles.length > 0 && (
            <div className="flex justify-center mt-4 space-x-4 text-gray-500 dark:text-gray-400">
              {influencer.social_handles.map((socialHandle: any) => {
                if (!socialHandle.is_active || socialHandle.is_deleted) return null;

                switch (socialHandle.platform?.toLowerCase()) {
                  case 'instagram':
                    return (
                      <a
                        key={socialHandle._id}
                        href={socialHandle.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex flex-col items-center transition-colors hover:text-primary"
                      >
                        <InstagramIcon />
                        <span className="text-xs mt-1">{socialHandle.follower_range}</span>
                      </a>
                    );
                  case 'twitter':
                    return (
                      <a
                        key={socialHandle._id}
                        href={socialHandle.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex flex-col items-center transition-colors hover:text-primary"
                      >
                        <XIcon />
                        <span className="text-xs mt-1">{socialHandle.follower_range}</span>
                      </a>
                    );
                  case 'youtube':
                    return (
                      <a
                        key={socialHandle._id}
                        href={socialHandle.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex flex-col items-center transition-colors hover:text-primary"
                      >
                        <YouTubeIcon />
                        <span className="text-xs mt-1">{socialHandle.follower_range}</span>
                      </a>
                    );
                    case 'tiktok':
                      return (
                        <a
                          key={socialHandle._id}
                          href={socialHandle.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex flex-col items-center transition-colors hover:text-primary"
                        >
                          <TikTokIcon />
                          <span className="text-xs mt-1">{socialHandle.follower_range}</span>
                        </a>
                      );
                  default:
                    return null;
                }
              })}
            </div>
          )}
          {influencer.profile_description && (
            <p className="max-w-lg mx-auto mt-4 text-sm text-gray-600 dark:text-gray-400">
              {influencer.profile_description}
            </p>
          )}
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
                    <p>{influencer.created_date.split('T')[0]} {influencer.created_date.split('T')[1].split(':').slice(0, 2).join(':')}</p>
                </div>
                <div>
                    <p className="font-semibold text-gray-700 dark:text-gray-300">Time</p>
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
      {influencer?.pricings && influencer?.pricings?.length > 0 && (
        <div className="mt-8">
            <PackagesSection packages={influencer.pricings} />
        </div>
      )}
      {influencer?.portfolio && influencer?.portfolio?.length > 0 && (
        <div className="mt-8">
            <ContentHighlights highlights={influencer.portfolio} />
        </div>
      )}
      {influencer?.faq && influencer?.faq?.length > 0 && (
        <div className="mt-8">
            <FaqsSection faqs={influencer.faq} />
        </div>
      )}
      </div>
    </>
  );
};

export default InfluencerDetail;