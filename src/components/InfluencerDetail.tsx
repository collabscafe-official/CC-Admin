import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import { approveCreator, declineCreator } from '../store/actions/creatorAction';
import PackagesSection from './PackagesSection';
import ContentHighlights from './ContentHighlights';
import FaqsSection from './FaqsSection';
import TrustLensAdminPanel from './TrustLensAdminPanel';
import DeclineCreatorModal from './DeclineCreatorModal';

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

const FacebookIcon = () => (
  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

const LinkedInIcon = () => (
  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.063 2.063 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
  </svg>
);

const LocationIcon = () => (
  <svg className="w-6 h-6 mr-1 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
);

const VerifiedIcon = () => (
  <svg className="w-6 h-6 text-green-500" viewBox="0 0 24 24" fill="currentColor">
    <path fillRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm3.414 7.914a1 1 0 00-1.414-1.414L11 11.586l-1.293-1.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
  </svg>
);

// Admin always sees the exact follower count when it exists (e.g. "12.4K").
// Falls back to the range bucket ("10k-50k" → "10K-50K") only for manual rows
// added before the verify flow shipped — `follower_count` is null on those.
function formatFollowerCount(n: number): string {
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) return '';
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`;
  }
  if (n >= 1_000) {
    const k = n / 1_000;
    return `${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}K`;
  }
  return String(n);
}
function followerLabel(socialHandle: any): string {
  if (typeof socialHandle?.follower_count === 'number') {
    return formatFollowerCount(socialHandle.follower_count);
  }
  const r = socialHandle?.follower_range;
  if (!r) return '';
  // legacy "1k-10k" → "1K-10K" / "10m+" → "10M+"
  return r.replace(/k/g, 'K').replace(/m/g, 'M');
}

const InfluencerDetail: React.FC = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation() as any;
  const creators = useSelector((state: any) => state.creators);
  const [isApproving, setIsApproving] = useState(false);
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);

  const influencer = location.state?.influencer || creators?.profiles?.find((p: any) => p._id === id);
  const savedPage = location.state?.currentPage || 1;
  const savedItemsPerPage = location.state?.itemsPerPage || 10;

  const handleApproveCreator = (id: string) => {
    setIsApproving(true);
    dispatch(approveCreator(id, (success: boolean) => {
      setIsApproving(false);
      if (success) {
        // Don't dispatch getCreators here — it was being called with only
        // (limit, page) and no callback, which threw TypeError inside the
        // action's success branch and dispatched GET_CREATORS: null, wiping
        // the list from redux. Result was the "No influencers found" screen
        // that only came back after a full refresh. The list page's own
        // mount-time useEffect refetches with the correct filters, so this
        // extra call was both wrong AND unnecessary.
        navigate('/influencers', { state: { currentPage: savedPage, itemsPerPage: savedItemsPerPage } });
      }
    }) as unknown as any);
  };

  const handleDeclineConfirm = (reasons: string[], customNote: string) => {
    if (!influencer?._id) return;
    setIsDeclining(true);
    dispatch(declineCreator(influencer._id, reasons, customNote, (success: boolean) => {
      setIsDeclining(false);
      if (success) {
        setShowDeclineModal(false);
        // See handleApproveCreator — the extra getCreators dispatch was
        // wiping redux state. Removed for the same reason.
        navigate('/influencers', { state: { currentPage: savedPage, itemsPerPage: savedItemsPerPage } });
      }
    }) as unknown as any);
  };

  const handleBack = () => {
    // See handleApproveCreator — the extra getCreators dispatch was wiping
    // redux state on return. Removed for the same reason.
    navigate('/influencers', { state: { currentPage: savedPage, itemsPerPage: savedItemsPerPage } });
  };

  if (!influencer) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Influencer not found.</div>
      </div>
    );
  }

  return (
    <>
    <div className="mb-10">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-3xl font-semibold text-gray-700 dark:text-gray-200">
          Influencer Profile
        </h2>
        <div className="flex items-center space-x-4">
            {!influencer.is_approved_by_admin && (
                <>
                    <button
                        onClick={() => setShowDeclineModal(true)}
                        disabled={isApproving || isDeclining}
                        className="inline-flex items-center px-4 py-2 text-sm font-medium text-white transition-opacity duration-150 bg-red-600 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 dark:focus:ring-offset-dark-800 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Decline
                    </button>
                    <button
                        onClick={() => handleApproveCreator(influencer._id)}
                        disabled={isApproving || isDeclining}
                        className="inline-flex items-center px-4 py-2 text-sm font-medium text-white transition-opacity duration-150 bg-green-600 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 dark:focus:ring-offset-dark-800 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                       {isApproving ? (
                         <>
                           <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                             <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                             <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                           </svg>
                           Approving...
                         </>
                       ) : (
                         'Approve Profile'
                       )}
                    </button>
                </>
            )}
            <button
                onClick={handleBack}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-white transition-opacity duration-150 rounded-lg bg-gradient-to-r from-primary to-primary-accent hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary dark:focus:ring-offset-dark-800"
            >
               <BackIcon />
               Back to Influencers
            </button>
        </div>
      </div>

        <div className="p-8 bg-white rounded-lg shadow-md dark:bg-dark-800">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-2 flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left">
              <img
                className="object-cover w-32 h-32 mb-4 rounded-full sm:mb-0 sm:mr-8 flex-shrink-0"
                src={influencer?.profile_image || `https://eu.ui-avatars.com/api/?name=${influencer?.name}&size=250&background=random`}
                alt={`${influencer?.name}'s profile`}
              />
              <div className="flex-grow">
              <div className="flex items-center justify-center sm:justify-start mb-1 flex-wrap gap-x-4 gap-y-2">
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {influencer?.name}
                  </h3>
                  {influencer?.is_email_verified && <span className="ml-0"><VerifiedIcon /></span>}
                  <span className={`px-3 py-1 text-xs font-semibold rounded-full ${influencer?.is_approved_by_admin
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'
                      : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300'
                    }`}>
                    {influencer?.is_approved_by_admin ? 'Approved' : 'Pending Approval'}
                  </span>
                </div>
                <p className="font-semibold text-gray-600 dark:text-gray-300">{influencer?.profile_title}</p>
                <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                  {influencer?.profile_description}
                </p>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-4">
                  {influencer.social_handles && influencer.social_handles.length > 0 && (
                    <div className="flex justify-center space-x-4 text-gray-500 dark:text-gray-400">
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
                                className="flex flex-row items-center gap-2 transition-colors hover:text-primary"
                              >
                                <InstagramIcon />
                                <span className="text-xs mt-1">{followerLabel(socialHandle)}</span>
                              </a>
                            );
                          case 'twitter':
                            return (
                              <a
                                key={socialHandle._id}
                                href={socialHandle.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex flex-row items-center gap-2 transition-colors hover:text-primary"
                              >
                                <XIcon />
                                <span className="text-xs mt-1">{followerLabel(socialHandle)}</span>
                              </a>
                            );
                          case 'youtube':
                            return (
                              <a
                                key={socialHandle._id}
                                href={socialHandle.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex flex-row items-center gap-2 transition-colors hover:text-primary"
                              >
                                <YouTubeIcon />
                                <span className="text-xs mt-1">{followerLabel(socialHandle)}</span>
                              </a>
                            );
                          case 'tiktok':
                            return (
                              <a
                                key={socialHandle._id}
                                href={socialHandle.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex flex-row items-center gap-2 transition-colors hover:text-primary"
                              >
                                <TikTokIcon />
                                <span className="text-xs mt-1">{followerLabel(socialHandle)}</span>
                              </a>
                            );
                          case 'facebook':
                            return (
                              <a
                                key={socialHandle._id}
                                href={socialHandle.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex flex-row items-center gap-2 transition-colors hover:text-primary"
                              >
                                <FacebookIcon />
                                <span className="text-xs mt-1">{followerLabel(socialHandle)}</span>
                              </a>
                            );
                          case 'linkedin':
                            return (
                              <a
                                key={socialHandle._id}
                                href={socialHandle.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex flex-row items-center gap-2 transition-colors hover:text-primary"
                              >
                                <LinkedInIcon />
                                <span className="text-xs mt-1">{followerLabel(socialHandle)}</span>
                              </a>
                            );
                          case 'x':
                            // Alias used by some brand-side records — same as twitter.
                            return (
                              <a
                                key={socialHandle._id}
                                href={socialHandle.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex flex-row items-center gap-2 transition-colors hover:text-primary"
                              >
                                <XIcon />
                                <span className="text-xs mt-1">{followerLabel(socialHandle)}</span>
                              </a>
                            );
                          default:
                            // Render unknown platforms as a labeled text chip so admins
                            // never see "no handles" when a row exists. Surfaces typos
                            // and new platforms (e.g. snap, threads) for triage.
                            return (
                              <a
                                key={socialHandle._id}
                                href={socialHandle.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex flex-row items-center gap-2 px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 text-xs transition-colors hover:text-primary"
                                title={socialHandle.url}
                              >
                                <span className="capitalize font-semibold">{socialHandle.platform || 'Unknown'}</span>
                                {followerLabel(socialHandle) && (
                                  <span className="text-gray-500 dark:text-gray-400">{followerLabel(socialHandle)}</span>
                                )}
                              </a>
                            );
                        }
                      })}
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-center sm:justify-start mt-4">
                  {influencer?.city && influencer?.country && (
                    <>
                      <LocationIcon />
                      <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{influencer?.city}, {influencer?.country}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="md:col-span-1 md:border-l md:pl-8 border-gray-200 dark:border-dark-700">
              <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4">My Content Niches</h4>
              <div className="flex flex-wrap gap-2">
                {influencer?.niches?.map((niche: any) => (
                  <span key={niche._id} className="px-3 py-1 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-200 rounded-full dark:bg-dark-700 dark:text-gray-300 dark:border-dark-600">{niche?.name}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 p-8 bg-white rounded-lg shadow-md dark:bg-dark-800">
          <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Contact Info</h4>
          <div className="mt-8 text-sm text-left text-gray-600 dark:text-gray-400 border-t border-gray-200 dark:border-dark-700 pt-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <p className="font-semibold text-gray-700 dark:text-gray-300">Email Address</p>
                <a href={`mailto:${influencer?.email}`} className="flex flex-row items-center gap-2 font-semibold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary-accent hover:underline">{influencer?.email} {influencer?.is_email_verified && <VerifiedIcon />}</a>
              </div>
              <div>
                <p className="font-semibold text-gray-700 dark:text-gray-300">Phone Number</p>
                <p>{influencer?.phone}</p>
              </div>
              <div>
                <p className="font-semibold text-gray-700 dark:text-gray-300">Address</p>
                <p>{influencer?.country ? influencer?.country?.split(' ').map(word => word.charAt(0).toUpperCase() + word?.slice(1).toLowerCase()).join(' ') : ''}{influencer?.city ? ', ' + influencer?.city?.split(' ').map(word => word.charAt(0).toUpperCase() + word?.slice(1).toLowerCase()).join(' ') : ''}</p>
              </div>
              <div>
                <p className="font-semibold text-gray-700 dark:text-gray-300">Join Date</p>
                {(() => {
                  // Some legacy creators pre-date the manual `created_date`
                  // field. Fall back through: created_date → created_at (auto
                  // timestamps) → the ObjectId's embedded timestamp (always
                  // present since Mongo generates it). Without the guard the
                  // page crashed with "Cannot read properties of undefined
                  // (reading 'split')" and rendered blank for those creators.
                  const stamp =
                    influencer?.created_date ||
                    influencer?.created_at ||
                    (influencer?._id
                      ? new Date(parseInt(String(influencer._id).substring(0, 8), 16) * 1000).toISOString()
                      : null);
                  if (!stamp) return <p>—</p>;
                  const iso = String(stamp);
                  const [date, timePart] = iso.split('T');
                  const time = timePart ? timePart.split(':').slice(0, 2).join(':') : '';
                  return <p>{date}{time ? ` ${time}` : ''}</p>;
                })()}
              </div>
            </div>
          </div>
        </div>

      {influencer?.pricings && influencer?.pricings?.length > 0 && (
        <div className="mt-8">
            <PackagesSection packages={influencer.pricings} />
        </div>
      )}
      {/* TrustLens AI inline diagnostic — shown for every reviewed creator */}
      {influencer?._id && (
        <div className="mt-8">
          <TrustLensAdminPanel identifier={influencer._id} />
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

      {showDeclineModal && (
        <DeclineCreatorModal
          influencerName={influencer.name || influencer.username || 'this creator'}
          onConfirm={handleDeclineConfirm}
          onCancel={() => setShowDeclineModal(false)}
          isSubmitting={isDeclining}
        />
      )}
    </>
  );
};

export default InfluencerDetail;