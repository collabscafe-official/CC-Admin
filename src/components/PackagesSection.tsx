import React from 'react';

// The creator's packages, as brands see them on the public profile's Pricing
// tab (a brand picks one and adds it to the cart). Amount = what the creator
// charges and keeps; the brand pays it plus the platform fee at checkout.
//
// Deleted / inactive packages are hidden: the admin list query doesn't filter
// them, and brands never see them.

interface PackagesSectionProps {
    packages: any[];
}

function formatAmount(pkg: any): string | null {
    const n = Number(String(pkg?.amount ?? '').replace(/,/g, '').trim());
    if (!Number.isFinite(n) || n <= 0) return null;
    return `${pkg?.currency || 'PKR'} ${n.toLocaleString('en-US')}`;
}

function deliverableLabel(pkg: any): string {
    const d = pkg?.content_deliverable;
    if (d && typeof d === 'object') return d.label || d.value || '—';
    return d || '—';
}

function deliveryLabel(pkg: any): string {
    const days = String(pkg?.deadline ?? '').trim();
    if (!days) return '—';
    return /^\d+$/.test(days) ? `${days} day${days === '1' ? '' : 's'}` : days;
}

const PackagesSection: React.FC<PackagesSectionProps> = ({ packages }) => {
    const visible = (packages || []).filter((p) => !p?.is_deleted && p?.is_active !== false);

    return (
        <div className="p-6 bg-white rounded-xl border border-gray-200 dark:bg-dark-800 dark:border-dark-700">
            <div className="flex items-baseline justify-between gap-3 flex-wrap mb-4">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                    Packages <span className="text-gray-400 font-normal">({visible.length})</span>
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">Price set by the creator. Brands add these to their cart.</p>
            </div>

            {visible.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">No packages yet.</p>
            ) : (
                <ul className="divide-y divide-gray-100 dark:divide-dark-700">
                    {visible.map((pkg) => {
                        const price = formatAmount(pkg);
                        return (
                            <li key={pkg._id} className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-6">
                                <div className="min-w-0 flex-1">
                                    <p className="font-medium text-gray-900 dark:text-white">{pkg.title || 'Untitled package'}</p>
                                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                        {[pkg.platform && pkg.platform !== 'all' ? pkg.platform : 'Any platform', deliverableLabel(pkg), deliveryLabel(pkg)].join(' · ')}
                                    </p>
                                    {pkg.description && (
                                        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 whitespace-pre-line">{pkg.description}</p>
                                    )}
                                </div>
                                <div className="sm:text-right flex-shrink-0">
                                    {price ? (
                                        <p className="text-lg font-semibold text-gray-900 dark:text-white whitespace-nowrap">{price}</p>
                                    ) : (
                                        <span className="inline-block px-2 py-1 text-xs font-semibold rounded bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                                            Check price
                                        </span>
                                    )}
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
};

export default PackagesSection;
