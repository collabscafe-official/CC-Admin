import React from 'react';
import { FaqItem } from '../types';

// Shown fully open: admins read every answer while reviewing a profile.

interface FaqsSectionProps {
    faqs: FaqItem[];
}

const FaqsSection: React.FC<FaqsSectionProps> = ({ faqs }) => {
    if (!faqs || faqs.length === 0) {
        return null;
    }

    return (
        <div className="p-6 bg-white rounded-xl border border-gray-200 dark:bg-dark-800 dark:border-dark-700">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
                FAQs <span className="text-gray-400 font-normal">({faqs.length})</span>
            </h3>
            <dl className="divide-y divide-gray-100 dark:divide-dark-700">
                {faqs.map((item, i) => (
                    <div key={(item as any)._id || item.id || i} className="py-3 first:pt-0 last:pb-0">
                        <dt className="font-medium text-gray-900 dark:text-white">{item.question}</dt>
                        <dd className="mt-1 text-sm text-gray-600 dark:text-gray-400 whitespace-pre-line">{item.answer}</dd>
                    </div>
                ))}
            </dl>
        </div>
    );
};

export default FaqsSection;
