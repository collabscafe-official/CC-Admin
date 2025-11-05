import React, { useState, useMemo, useEffect } from 'react';
import { Influencer } from '../types';
import InfluencerDetail from './InfluencerDetail';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import { getCreators } from '../store/actions/creatorAction';
import { useDispatch, useSelector } from 'react-redux';
import collabs from '../config/collabs';

const initialInfluencersData: Influencer[] = Array.from({ length: 25 }, (_, i) => {
  const statuses: ('Active' | 'Pending' | 'Inactive')[] = ['Active', 'Pending', 'Inactive'];
  const firstNames = ['Elena', 'John', 'Aisha', 'Kenji', 'Chloe', 'Liam', 'Olivia', 'Noah', 'Emma', 'Oliver'];
  const lastNames = ['Rodriguez', 'Smith', 'Khan', 'Tanaka', 'Dubois', 'Garcia', 'Jones', 'Miller', 'Davis', 'Wilson'];
  const name = `${firstNames[i % firstNames.length]} ${lastNames[i % lastNames.length]}`;
  const email = `${name.toLowerCase().replace(' ', '.').replace(/[0-9]/g, '')}${i+1}@example.com`;
  const date = new Date(Date.now() - i * 1000 * 60 * 60 * 24);
  
  return {
    id: i + 1,
    date: date.toISOString().split('T')[0],
    time: `${(i % 12) + 1}:${String(i * 5 % 60).padStart(2, '0')} ${i % 2 === 0 ? 'AM' : 'PM'}`,
    name: `${name} ${i+1}`,
    email: email,
    phone: `555-01${String(i).padStart(2, '0')}`,
    address: `${100 + i} Main St, USA`,
    status: statuses[i % statuses.length],
  };
});


const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const baseClasses = "px-2 py-1 text-xs font-medium rounded-full inline-block";
  let colorClasses = "";
  switch (status) {
    case 'Complete':
    case 'Approved':
      colorClasses = "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      break;
    case 'Pending':
    case 'Not Approved':
      colorClasses = "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
      break;
    case 'Incomplete':
    case 'Inactive':
      colorClasses = "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
      break;
  }
  return <span className={`${baseClasses} ${colorClasses}`}>{status}</span>;
};

const ViewIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
);

const EditIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L15.232 5.232z"></path></svg>
);

const DeleteIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
);

const SearchIcon = () => (
    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
);

const Influencers: React.FC = () => {
    const dispatch = useDispatch();
    const creators = useSelector((state: any) => state.creators);
    const [influencersList, setInfluencersList] = useState(initialInfluencersData);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [selectedInfluencer, setSelectedInfluencer] = useState<Influencer | null>(null);
    const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
    const [influencerToDelete, setInfluencerToDelete] = useState<Influencer | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const filteredInfluencers = useMemo(() => {
        return influencersList
            .filter(influencer =>
                influencer.name.toLowerCase().includes(searchQuery.toLowerCase())
            )
            .filter(influencer =>
                statusFilter === 'All' || influencer.status === statusFilter
            );
    }, [influencersList, searchQuery, statusFilter]);

    useEffect(() => {
        dispatch(getCreators(itemsPerPage, currentPage, () => setIsLoading(false)) as unknown as any);
    }, [dispatch, itemsPerPage, currentPage]);
    
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, statusFilter, itemsPerPage]);

    // const totalPages = Math.ceil(filteredInfluencers.length / itemsPerPage);
    const totalPages = Math.ceil(creators?.pagination?.total_count / itemsPerPage);

    const paginatedInfluencers = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return filteredInfluencers.slice(startIndex, startIndex + itemsPerPage);
    }, [filteredInfluencers, currentPage, itemsPerPage]);

    const handlePrevPage = () => {
        setCurrentPage((prev) => Math.max(prev - 1, 1));
    };

    const handleNextPage = () => {
        setCurrentPage((prev) => Math.min(prev + 1, totalPages));
    };

    const handleViewProfile = (influencer: Influencer) => {
        setSelectedInfluencer(influencer);
    };

    const handleOpenDeleteModal = (influencer: Influencer) => {
        setInfluencerToDelete(influencer);
        setDeleteModalOpen(true);
    };

    const handleCloseDeleteModal = () => {
        setInfluencerToDelete(null);
        setDeleteModalOpen(false);
    };

    const handleConfirmDelete = () => {
        if (influencerToDelete) {
            setInfluencersList(prevList => prevList.filter(inf => inf.id !== influencerToDelete.id));
            handleCloseDeleteModal();
        }
    };
    
    if (selectedInfluencer) {
        return <InfluencerDetail influencer={selectedInfluencer} onBack={() => setSelectedInfluencer(null)} />;
    }

    if (isLoading) {
        return (
          <div className="flex items-center justify-center h-screen bg-dark-900">
            <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-primary"></div>
          </div>
        );
    }

  return (
    <>
      <h2 className="mb-6 text-3xl font-semibold text-gray-700 dark:text-gray-200">
        Influencers Management
      </h2>

      <div className="p-4 bg-white rounded-lg shadow-md dark:bg-dark-800">
        <div className="flex flex-col md:flex-row items-center justify-between mb-4 space-y-4 md:space-y-0 md:space-x-4">
            <div className="relative w-full md:w-1/3">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <SearchIcon />
                </div>
                <input
                    type="text"
                    placeholder="Search by name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="block w-full p-2 pl-10 text-sm text-gray-900 border border-gray-300 rounded-lg bg-gray-50 focus:ring-primary focus:border-primary dark:bg-dark-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-primary dark:focus:border-primary"
                />
            </div>
            <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full md:w-auto p-2 text-sm text-gray-900 border border-gray-300 rounded-lg bg-gray-50 focus:ring-primary focus:border-primary dark:bg-dark-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-primary dark:focus:border-primary"
            >
                <option value="All">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Pending">Pending</option>
                <option value="Inactive">Inactive</option>
            </select>
        </div>
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-dark-700 dark:text-gray-400">
                    <tr>
                        <th scope="col" className="px-6 py-3">Date</th>
                        <th scope="col" className="px-6 py-3">Profile</th>
                        <th scope="col" className="px-6 py-3">Name</th>
                        <th scope="col" className="px-6 py-3">Email</th>
                        <th scope="col" className="px-6 py-3">Phone</th>
                        <th scope="col" className="px-6 py-3">Address</th>
                        <th scope="col" className="px-6 py-3">Profile</th>
                        <th scope="col" className="px-6 py-3">Approval</th>
                        <th scope="col" className="px-6 py-3">Action</th>
                    </tr>
                </thead>
                <tbody>
                    {creators?.profiles.map((influencer) => (
                        <tr key={influencer._id} className="bg-white border-b dark:bg-dark-800 dark:border-dark-700 hover:bg-gray-50 dark:hover:bg-dark-700/50">
                            <td className="px-6 py-4 whitespace-nowrap">{influencer.created_date.split('T')[0]} {influencer.created_date.split('T')[1].split(':').slice(0, 2).join(':')}</td>
                            <td className="px-6 py-4">
                                <img className="w-10 h-10 rounded-full" src={influencer.profile_image || `https://eu.ui-avatars.com/api/?name=${influencer.name}&size=250&background=random`} alt={`${influencer.name} avatar`} />
                            </td>
                            <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white">{influencer.name}</td>
                            <td className="px-6 py-4">{influencer.email}</td>
                            <td className="px-6 py-4">{influencer.phone}</td>
                            <td className="px-6 py-4">
                                {influencer.country ? influencer.country.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ') : ''}{influencer.city ? ', ' + influencer.city.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ') : ''}
                            </td>
                            <td className="px-6 py-4">
                                <StatusBadge status={influencer.is_profile_completed ? 'Complete' : 'Incomplete'} />
                            </td>
                            <td className="px-6 py-4">
                                <StatusBadge status={influencer.is_approved_by_admin ? 'Approved' : 'Not Approved'} />
                            </td>
                            <td className="px-6 py-4 flex items-center space-x-3 justify-center">
                                <button onClick={() => handleViewProfile(influencer)} className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-300" aria-label="View profile">
                                    <ViewIcon/>
                                </button>
                                {/* <button className="text-primary hover:text-indigo-800 dark:hover:text-indigo-400" aria-label="Edit influencer">
                                    <EditIcon/>
                                </button> */}
                                {/* <button onClick={() => handleOpenDeleteModal(influencer)} className="text-red-600 hover:text-red-800 dark:hover:text-red-400" aria-label="Delete influencer">
                                    <DeleteIcon/>
                                </button> */}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
        <div className="flex flex-col items-center justify-between px-4 py-3 sm:flex-row space-y-4 sm:space-y-0">
            <div className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-400">
                <span>Show</span>
                <select
                    value={itemsPerPage}
                    onChange={(e) => setItemsPerPage(Number(e.target.value))}
                    className="p-1 text-sm text-gray-900 border border-gray-300 rounded-lg bg-gray-50 focus:ring-primary focus:border-primary dark:bg-dark-700 dark:border-gray-600 dark:text-white"
                >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                </select>
                <span>entries</span>
            </div>
            <span className="text-sm text-gray-700 dark:text-gray-400">
                Page{' '}
                <span className="font-semibold text-gray-900 dark:text-white">{currentPage}</span> of{' '}
                <span className="font-semibold text-gray-900 dark:text-white">{totalPages}</span>
            </span>
          <div className="inline-flex mt-2 xs:mt-0">
            <button
              onClick={handlePrevPage}
              disabled={currentPage === 1}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-white transition-opacity duration-150 bg-gradient-to-r from-primary to-primary-accent rounded-l-md hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Prev
            </button>
            <button
              onClick={handleNextPage}
              disabled={currentPage === totalPages || totalPages === 0}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-white transition-opacity duration-150 bg-gradient-to-r from-primary to-primary-accent rounded-r-md hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      </div>
      {isDeleteModalOpen && influencerToDelete && (
        <DeleteConfirmationModal
            influencerName={influencerToDelete.name}
            onConfirm={handleConfirmDelete}
            onCancel={handleCloseDeleteModal}
        />
      )}
    </>
  );
};

export default Influencers;