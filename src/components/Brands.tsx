import React, { useState, useMemo, useEffect, useRef } from 'react';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import { getBrands, deleteBrand } from '../store/actions/brandAction';
import { getCountries, getStates, getCities } from '../store/actions/globalActions';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';

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

const DeleteIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
);

const SearchIcon = () => (
    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
);

const FilterIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"></path>
    </svg>
);

// Debounce hook
const useDebounce = (value: string, delay: number) => {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
};

const Brands: React.FC = () => {
    const dispatch = useDispatch();
    const brands = useSelector((state: any) => state.brands);
    const locations = useSelector((state: any) => state.locationsRed);
    const navigate = useNavigate();
    const location = useLocation() as any;
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(location.state?.currentPage || 1);
    const [itemsPerPage, setItemsPerPage] = useState(location.state?.itemsPerPage || 10);
    const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
    const [brandToDelete, setBrandToDelete] = useState<any | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const isRestoringFromNavigation = useRef(false);

    const [showFilters, setShowFilters] = useState(false);

    // Filter states
    const [filters, setFilters] = useState({
        is_active: '',
        is_email_verified: '',
        is_profile_completed: '',
        is_approved_by_admin: '',
        is_featured: '',
        country: '',
        state: '',
        city: '',
        gender: '',
        status: 'All'
    });

    // Location filter states (for dropdowns)
    const [countryId, setCountryId] = useState('');
    const [stateId, setStateId] = useState('');
    const [cityId, setCityId] = useState('');

    // Debounced location filters for API calls
    const debouncedCountry = useDebounce(filters.country, 500);
    const debouncedState = useDebounce(filters.state, 500);
    const debouncedCity = useDebounce(filters.city, 500);

    const handleFilterChange = (key: string, value: string) => {
        setFilters(prev => ({ ...prev, [key]: value }));
        setCurrentPage(1);
    };

    const handleCountryChange = (selectedCountryId: string) => {
        setCountryId(selectedCountryId);
        const country = locations?.countries?.countries?.find((c: any) => c._id === selectedCountryId);
        handleFilterChange('country', country?.name || '');
        setStateId('');
        handleFilterChange('state', '');
        handleFilterChange('city', '');
    };

    const handleStateChange = (selectedStateId: string) => {
        setStateId(selectedStateId);
        const state = locations?.states?.country?.states?.find((s: any) => s._id === selectedStateId);
        handleFilterChange('state', state?.name || '');
        handleFilterChange('city', '');
    };

    const handleCityChange = (selectedCityId: string) => {
        setCityId(selectedCityId);
        const city = locations?.cities?.country?.state?.cities?.find((c: any) => c._id === selectedCityId);
        handleFilterChange('city', city?.name || '');
    };

    // Load countries on mount
    useEffect(() => {
        dispatch(getCountries(1, true, () => {}) as unknown as any);
    }, [dispatch]);

    useEffect(() => {
        if (countryId) {
            dispatch(getStates(countryId, 1, true, () => {}) as unknown as any);
        } else {
            dispatch({ type: 'GET_STATES', payload: null });
        }
    }, [countryId, dispatch]);

    useEffect(() => {
        if (stateId && countryId) {
            dispatch(getCities(countryId, stateId, 1, true, () => {}) as unknown as any);
        } else {
            dispatch({ type: 'GET_CITIES', payload: null });
        }
    }, [stateId, countryId, dispatch]);

    const clearFilters = () => {
        setFilters({
            is_active: '',
            is_email_verified: '',
            is_profile_completed: '',
            is_approved_by_admin: '',
            is_featured: '',
            country: '',
            state: '',
            city: '',
            gender: '',
            status: 'All'
        });
        setCountryId('');
        setStateId('');
        setCityId('');
        setSearchQuery('');
        setCurrentPage(1);
    };

    const brandsList = brands?.profiles || brands?.brands || [];

    const filteredBrands = useMemo(() => {
        if (!brandsList || !Array.isArray(brandsList)) {
            return [];
        }
        return brandsList.filter((brand: any) => {
            if (searchQuery && !brand.name?.toLowerCase().includes(searchQuery.toLowerCase())) {
                return false;
            }
            if (filters.status !== 'All' && brand.status !== filters.status) {
                return false;
            }
            if (filters.is_active !== '' && brand.is_active !== parseInt(filters.is_active)) return false;
            if (filters.is_email_verified !== '' && brand.is_email_verified !== parseInt(filters.is_email_verified)) return false;
            if (filters.is_profile_completed !== '' && brand.is_profile_completed !== parseInt(filters.is_profile_completed)) return false;
            if (filters.is_approved_by_admin !== '' && brand.is_approved_by_admin !== parseInt(filters.is_approved_by_admin)) return false;
            if (filters.is_featured !== '' && brand.is_featured !== parseInt(filters.is_featured)) return false;
            if (filters.country && brand.country && !brand.country.toLowerCase().includes(filters.country.toLowerCase())) return false;
            if (filters.state && brand.state && !brand.state.toLowerCase().includes(filters.state.toLowerCase())) return false;
            if (filters.city && brand.city && !brand.city.toLowerCase().includes(filters.city.toLowerCase())) return false;
            if (filters.gender !== '' && brand.gender !== filters.gender) return false;
            return true;
        });
    }, [brandsList, searchQuery, filters]);

    // Update page state when location state changes (e.g., when navigating back)
    useEffect(() => {
        if (location.state) {
            const savedPage = location.state.currentPage;
            const savedItemsPerPage = location.state.itemsPerPage;

            if (savedPage !== undefined || savedItemsPerPage !== undefined) {
                isRestoringFromNavigation.current = true;

                if (savedPage !== undefined) {
                    setCurrentPage(savedPage);
                }
                if (savedItemsPerPage !== undefined) {
                    setItemsPerPage(savedItemsPerPage);
                }

                setTimeout(() => {
                    isRestoringFromNavigation.current = false;
                }, 100);
            }
        }
    }, [location.key]);

    useEffect(() => {
        setIsLoading(true);
        dispatch(getBrands(
            itemsPerPage,
            currentPage,
            filters.is_active,
            filters.is_email_verified,
            filters.is_profile_completed,
            filters.is_approved_by_admin,
            filters.is_featured,
            debouncedCountry,
            debouncedState,
            debouncedCity,
            filters.gender,
            (success: boolean) => {
                setIsLoading(false);
            }
        ) as unknown as any);
    }, [
        dispatch,
        itemsPerPage,
        currentPage,
        filters.is_active,
        filters.is_email_verified,
        filters.is_profile_completed,
        filters.is_approved_by_admin,
        filters.is_featured,
        debouncedCountry,
        debouncedState,
        debouncedCity,
        filters.gender
    ]);

    useEffect(() => {
        if (!isRestoringFromNavigation.current) {
            setCurrentPage(1);
        }
    }, [searchQuery]);

    const totalPages = brands?.pagination?.total_count
        ? Math.ceil(brands.pagination.total_count / itemsPerPage)
        : 1;

    const handlePrevPage = () => {
        setCurrentPage((prev) => Math.max(prev - 1, 1));
    };

    const handleNextPage = () => {
        setCurrentPage((prev) => Math.min(prev + 1, totalPages));
    };

    const handleViewProfile = (brand: any) => {
        navigate(`/brands/${brand._id}`, {
            state: {
                brand,
                currentPage,
                itemsPerPage
            }
        });
    };

    const handleOpenDeleteModal = (brand: any) => {
        setBrandToDelete(brand);
        setDeleteModalOpen(true);
    };

    const handleCloseDeleteModal = () => {
        setBrandToDelete(null);
        setDeleteModalOpen(false);
    };

    const handleConfirmDelete = () => {
        if (brandToDelete) {
            dispatch(deleteBrand(brandToDelete._id, (success: boolean) => {
                if (success) {
                    dispatch(getBrands(itemsPerPage, currentPage,
                        filters.is_active, filters.is_email_verified, filters.is_profile_completed,
                        filters.is_approved_by_admin, filters.is_featured,
                        debouncedCountry, debouncedState, debouncedCity, filters.gender,
                        () => {}) as unknown as any);
                }
                handleCloseDeleteModal();
            }) as unknown as any);
        }
    };

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
                Brands Management
            </h2>

            <div className="p-4 bg-white rounded-lg shadow-md dark:bg-dark-800">
                <div className="flex flex-col md:flex-row items-center justify-between mb-4 space-y-4 md:space-y-0 md:space-x-4">
                    <div className="relative w-full md:w-1/2">
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
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`flex items-center px-4 py-2 text-sm font-medium border rounded-lg transition-colors ${showFilters ? 'bg-primary text-white border-primary' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 dark:bg-dark-700 dark:text-gray-300 dark:border-dark-600 dark:hover:bg-dark-600'}`}
                    >
                        <FilterIcon />
                        <span className="ml-2">Filters</span>
                    </button>
                </div>

                {showFilters && (
                    <div className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50 dark:bg-dark-700/50 dark:border-dark-600">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div>
                                <label className="block mb-1 text-xs font-medium text-gray-700 dark:text-gray-300">Status</label>
                                <select
                                    value={filters.status}
                                    onChange={(e) => handleFilterChange('status', e.target.value)}
                                    className="w-full p-2 text-sm border rounded-md dark:bg-dark-700 dark:border-gray-600 dark:text-white"
                                >
                                    <option value="All">All</option>
                                    <option value="Active">Active</option>
                                    <option value="Pending">Pending</option>
                                    <option value="Inactive">Inactive</option>
                                </select>
                            </div>

                            <div>
                                <label className="block mb-1 text-xs font-medium text-gray-700 dark:text-gray-300">Gender</label>
                                <select
                                    value={filters.gender}
                                    onChange={(e) => handleFilterChange('gender', e.target.value)}
                                    className="w-full p-2 text-sm border rounded-md dark:bg-dark-700 dark:border-gray-600 dark:text-white"
                                >
                                    <option value="">All</option>
                                    <option value="Male">Male</option>
                                    <option value="Female">Female</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>

                            {[
                                { key: 'is_active', label: 'Is Active' },
                                { key: 'is_email_verified', label: 'Email Verified' },
                                { key: 'is_profile_completed', label: 'Profile Completed' },
                                { key: 'is_approved_by_admin', label: 'Admin Approved' },
                                { key: 'is_featured', label: 'Featured' }
                            ].map((f) => (
                                <div key={f.key}>
                                    <label className="block mb-1 text-xs font-medium text-gray-700 dark:text-gray-300">{f.label}</label>
                                    <select
                                        value={filters[f.key as keyof typeof filters]}
                                        onChange={(e) => handleFilterChange(f.key, e.target.value)}
                                        className="w-full p-2 text-sm border rounded-md dark:bg-dark-700 dark:border-gray-600 dark:text-white"
                                    >
                                        <option value="">All</option>
                                        <option value="1">Yes</option>
                                        <option value="0">No</option>
                                    </select>
                                </div>
                            ))}

                            <div>
                                <label className="block mb-1 text-xs font-medium text-gray-700 dark:text-gray-300">Country</label>
                                <select
                                    value={countryId}
                                    onChange={(e) => handleCountryChange(e.target.value)}
                                    className="w-full p-2 text-sm border rounded-md dark:bg-dark-700 dark:border-gray-600 dark:text-white"
                                >
                                    <option value="">All Countries</option>
                                    {locations?.countries?.countries?.map((country: any) => (
                                        <option key={country._id} value={country._id}>{country.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block mb-1 text-xs font-medium text-gray-700 dark:text-gray-300">State</label>
                                <select
                                    value={stateId}
                                    onChange={(e) => handleStateChange(e.target.value)}
                                    disabled={!countryId}
                                    className="w-full p-2 text-sm border rounded-md dark:bg-dark-700 dark:border-gray-600 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <option value="">All States</option>
                                    {locations?.states?.country?.states?.map((state: any) => (
                                        <option key={state._id} value={state._id}>{state.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block mb-1 text-xs font-medium text-gray-700 dark:text-gray-300">City</label>
                                <select
                                    value={cityId}
                                    onChange={(e) => handleCityChange(e.target.value)}
                                    disabled={!stateId}
                                    className="w-full p-2 text-sm border rounded-md dark:bg-dark-700 dark:border-gray-600 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <option value="">All Cities</option>
                                    {locations?.cities?.country?.state?.cities?.map((city: any) => (
                                        <option key={city._id} value={city._id}>{city.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="flex justify-end mt-4">
                            <button
                                onClick={clearFilters}
                                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white"
                            >
                                Clear Filters
                            </button>
                        </div>
                    </div>
                )}

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
                            {brandsList && Array.isArray(brandsList) && brandsList.length > 0 ? (
                                brandsList.map((brand: any) => (
                                    <tr key={brand._id} className="bg-white border-b dark:bg-dark-800 dark:border-dark-700 hover:bg-gray-50 dark:hover:bg-dark-700/50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {brand.created_date ? `${brand.created_date.split('T')[0]} ${brand.created_date.split('T')[1]?.split(':').slice(0, 2).join(':') || ''}` : '-'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <img className="w-10 h-10 rounded-full" src={brand.profile_image || brand.logo || `https://eu.ui-avatars.com/api/?name=${brand.name}&size=250&background=random`} alt={`${brand.name} avatar`} />
                                        </td>
                                        <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white">{brand.brand_name}</td>
                                        <td className="px-6 py-4">{brand.email}</td>
                                        <td className="px-6 py-4">{brand.team_members?.[0]?.phone || '-'}</td>
                                        <td className="px-6 py-4">
                                            {brand.country ? (brand.country + (brand.city ? ', ' + brand.city : '')).split(' ').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ') : '-'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <StatusBadge status={brand.is_profile_completed ? 'Complete' : 'Incomplete'} />
                                        </td>
                                        <td className="px-6 py-4">
                                            <StatusBadge status={brand.is_approved_by_admin ? 'Approved' : 'Not Approved'} />
                                        </td>
                                        <td className="px-6 py-4 flex items-center space-x-3 justify-center">
                                            <button onClick={() => handleViewProfile(brand)} className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-300" aria-label="View profile">
                                                <ViewIcon />
                                            </button>
                                            <button onClick={() => handleOpenDeleteModal(brand)} className="text-red-600 hover:text-red-800 dark:hover:text-red-400" aria-label="Delete brand">
                                                <DeleteIcon />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={9} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                                        No brands found matching your filters.
                                    </td>
                                </tr>
                            )}
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
                        Page <span className="font-semibold text-gray-900 dark:text-white">{currentPage}</span> of{' '}
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
