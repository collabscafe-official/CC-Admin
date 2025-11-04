import React, { useState, useMemo, useEffect } from 'react';
import { Brand } from '../types';
import BrandDetail from './BrandDetail';
import DeleteConfirmationModal from './DeleteConfirmationModal';

const initialBrandsData: Brand[] = Array.from({ length: 15 }, (_, i) => {
  const brandNames = ['Nexus Corp', 'Quantum Innovations', 'Stellar Goods', 'Apex Industries', 'Momentum Co', 'Odyssey Inc', 'Pioneer Brands', 'Horizon Group', 'Synergy Ltd', 'Zenith Co.'];
  const name = brandNames[i % brandNames.length];
  const email = `${name.toLowerCase().replace(/[\s.]/g, '')}${i+1}@example.com`;
  const date = new Date(Date.now() - i * 1000 * 60 * 60 * 24 * 3);
  
  return {
    id: i + 1,
    date: date.toISOString().split('T')[0],
    time: `${(i % 12) + 1}:${String(i * 7 % 60).padStart(2, '0')} ${i % 2 === 0 ? 'AM' : 'PM'}`,
    name: `${name}`,
    email: email,
    phone: `555-02${String(i).padStart(2, '0')}`,
    address: `${200 + i} Commerce Rd, USA`,
  };
});

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

const Brands: React.FC = () => {
    const [brandsList, setBrandsList] = useState(initialBrandsData);
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);
    const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
    const [brandToDelete, setBrandToDelete] = useState<Brand | null>(null);

    const filteredBrands = useMemo(() => {
        return brandsList
            .filter(brand =>
                brand.name.toLowerCase().includes(searchQuery.toLowerCase())
            );
    }, [brandsList, searchQuery]);
    
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, itemsPerPage]);

    const totalPages = Math.ceil(filteredBrands.length / itemsPerPage);

    const paginatedBrands = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return filteredBrands.slice(startIndex, startIndex + itemsPerPage);
    }, [filteredBrands, currentPage, itemsPerPage]);

    const handlePrevPage = () => {
        setCurrentPage((prev) => Math.max(prev - 1, 1));
    };

    const handleNextPage = () => {
        setCurrentPage((prev) => Math.min(prev + 1, totalPages));
    };

    const handleViewProfile = (brand: Brand) => {
        setSelectedBrand(brand);
    };

    const handleOpenDeleteModal = (brand: Brand) => {
        setBrandToDelete(brand);
        setDeleteModalOpen(true);
    };

    const handleCloseDeleteModal = () => {
        setBrandToDelete(null);
        setDeleteModalOpen(false);
    };

    const handleConfirmDelete = () => {
        if (brandToDelete) {
            setBrandsList(prevList => prevList.filter(inf => inf.id !== brandToDelete.id));
            handleCloseDeleteModal();
        }
    };
    
    if (selectedBrand) {
        return <BrandDetail brand={selectedBrand} onBack={() => setSelectedBrand(null)} />;
    }

  return (
    <>
      <h2 className="mb-6 text-3xl font-semibold text-gray-700 dark:text-gray-200">
        Brands Management
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
        </div>
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-dark-700 dark:text-gray-400">
                    <tr>
                        <th scope="col" className="px-6 py-3">Date</th>
                        <th scope="col" className="px-6 py-3">Time</th>
                        <th scope="col" className="px-6 py-3">Profile</th>
                        <th scope="col" className="px-6 py-3">Name</th>
                        <th scope="col" className="px-6 py-3">Email</th>
                        <th scope="col" className="px-6 py-3">Phone</th>
                        <th scope="col" className="px-6 py-3">Address</th>
                        <th scope="col" className="px-6 py-3">Action</th>
                    </tr>
                </thead>
                <tbody>
                    {paginatedBrands.map((brand) => (
                        <tr key={brand.id} className="bg-white border-b dark:bg-dark-800 dark:border-dark-700 hover:bg-gray-50 dark:hover:bg-dark-700/50">
                            <td className="px-6 py-4 whitespace-nowrap">{brand.date}</td>
                            <td className="px-6 py-4 whitespace-nowrap">{brand.time}</td>
                            <td className="px-6 py-4">
                                <img className="w-10 h-10 rounded-full" src={`https://i.pravatar.cc/150?u=${brand.email}`} alt={`${brand.name} avatar`} />
                            </td>
                            <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white">{brand.name}</td>
                            <td className="px-6 py-4">{brand.email}</td>
                            <td className="px-6 py-4">{brand.phone}</td>
                            <td className="px-6 py-4">{brand.address}</td>
                            <td className="px-6 py-4 flex items-center space-x-3">
                                <button onClick={() => handleViewProfile(brand)} className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-300" aria-label="View profile">
                                    <ViewIcon/>
                                </button>
                                <button className="text-primary hover:text-indigo-800 dark:hover:text-indigo-400" aria-label="Edit brand">
                                    <EditIcon/>
                                </button>
                                <button onClick={() => handleOpenDeleteModal(brand)} className="text-red-600 hover:text-red-800 dark:hover:text-red-400" aria-label="Delete brand">
                                    <DeleteIcon/>
                                </button>
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
      {isDeleteModalOpen && brandToDelete && (
        <DeleteConfirmationModal
            influencerName={brandToDelete.name}
            onConfirm={handleConfirmDelete}
            onCancel={handleCloseDeleteModal}
        />
      )}
    </>
  );
};

export default Brands;