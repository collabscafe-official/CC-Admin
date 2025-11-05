import React, { useState } from 'react';
import { Package } from '../types';

const MegaphoneIcon = () => (
    <svg className="w-6 h-6 text-gray-500 dark:text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 100 15h8.05a1.5 1.5 0 001.44-1.936l-1.02-4.596a3 3 0 00-2.92-2.464H12a7.5 7.5 0 00-1.5-15z" />
    </svg>
);

const DeliverableIcon = () => (
    <svg className="w-6 h-6 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
    </svg>
);

const DeliveryTimeIcon = () => (
    <svg className="w-6 h-6 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
    </svg>
);

interface PackageCardProps {
    packageData: Package;
    isSelected: boolean;
    onSelect: () => void;
}

const PackageCard: React.FC<PackageCardProps> = ({ packageData, isSelected, onSelect }) => {
    const baseCardClass = "p-6 bg-white dark:bg-dark-800 rounded-2xl cursor-pointer transition-all duration-300";

    return (
      <div 
        className={`rounded-2xl shadow-md transition-all duration-300 ${isSelected ? 'p-[2px] bg-gradient-to-r from-primary to-primary-accent' : 'hover:shadow-lg hover:-translate-y-1'}`}
        onClick={onSelect}
      >
        <div className={baseCardClass}>
            <div className="flex justify-between items-start">
                <div className="pr-4">
                    <h4 className="text-lg font-bold text-gray-900 dark:text-white">{packageData?.title}</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{packageData?.description}</p>
                </div>
                <p className="text-xl font-bold text-gray-900 dark:text-white ml-4 whitespace-nowrap">
                    {packageData?.currency} {packageData?.amount ? packageData?.amount.toLocaleString() : 'N/A'}
                </p>
            </div>
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-dark-700 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <div className="flex items-center space-x-2">
                    <MegaphoneIcon />
                    <div>
                        <p className="font-semibold text-gray-700 dark:text-gray-300">Platform</p>
                        <p className="text-gray-500 dark:text-gray-400">{packageData?.platform}</p>
                    </div>
                </div>
                 <div className="flex items-center space-x-2">
                    <DeliverableIcon />
                    <div>
                        <p className="font-semibold text-gray-700 dark:text-gray-300">Deliverable</p>
                        <p className="text-gray-500 dark:text-gray-400">{packageData?.content_deliverable?.label}</p>
                    </div>
                </div>
                 <div className="flex items-center space-x-2">
                    <DeliveryTimeIcon />
                    <div>
                        <p className="font-semibold text-gray-700 dark:text-gray-300">Delivery Time</p>
                        <p className="text-gray-500 dark:text-gray-400">{packageData?.deadline} Days</p>
                    </div>
                </div>
            </div>
        </div>
      </div>
    );
};

interface SelectedPackagePanelProps {
    packageData: Package;
}

const SelectedPackagePanel: React.FC<SelectedPackagePanelProps> = ({ packageData }) => {
    return (    
        <div className="sticky top-8">
            <div className="p-6 bg-white dark:bg-dark-800 rounded-2xl shadow-md">
                <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Selected Package</h4>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                    {packageData?.currency} {packageData?.amount ? packageData?.amount.toLocaleString() : 'N/A'}
                </p>
                <div className="mb-4 flex items-center flex-wrap gap-x-4 gap-y-2 text-sm text-gray-500 dark:text-gray-400">
                    <div className="flex items-center space-x-1">
                        <MegaphoneIcon /> <span>{packageData?.platform}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                        <DeliverableIcon /> <span>{packageData?.content_deliverable?.label}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                        <DeliveryTimeIcon /> <span>{packageData?.deadline} Days</span>
                    </div>
                </div>
                <div className="pt-4 border-t border-gray-200 dark:border-dark-700">
                    <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">Package Brief</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{packageData?.description}</p>
                    {/* <button
                        className="w-full px-4 py-3 text-sm font-medium text-white border border-transparent rounded-lg bg-gradient-to-r from-primary to-primary-accent group hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all duration-300"
                    >
                        Login to select
                    </button>
                    <div className="flex items-center my-4">
                        <div className="flex-grow border-t border-gray-300 dark:border-dark-700"></div>
                        <span className="flex-shrink mx-4 text-gray-400 text-sm">or</span>
                        <div className="flex-grow border-t border-gray-300 dark:border-dark-700"></div>
                    </div>
                    <button
                        className="w-full px-4 py-3 text-sm font-medium text-primary dark:text-gray-200 border border-primary dark:border-gray-600 rounded-lg hover:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all duration-300"
                    >
                        Send a custom offer
                    </button> */}
                </div>
            </div>
        </div>
    );
};

interface PackagesSectionProps {
    packages: Package[];
}

const PackagesSection: React.FC<PackagesSectionProps> = ({ packages }) => {
    const [selectedPackage, setSelectedPackage] = useState<Package | null>(packages?.[0] || null);

    console.log(packages, 'packages');

    if (!packages || packages.length === 0) {
        return null;
    }

    return (
        <div className="mt-8">
            <h3 className="text-2xl font-semibold text-gray-700 dark:text-gray-200 mb-6">Packages</h3>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                <div className="lg:col-span-2 space-y-6">
                    {packages.map(pkg => (
                       <PackageCard 
                           key={pkg.id} 
                           packageData={pkg}
                           isSelected={selectedPackage?._id === pkg._id}
                           onSelect={() => setSelectedPackage(pkg)}
                       />
                    ))}
                </div>

                <div className="lg:col-span-1">
                   {selectedPackage && <SelectedPackagePanel packageData={selectedPackage} />}
                </div>
            </div>
        </div>
    );
};

export default PackagesSection;
