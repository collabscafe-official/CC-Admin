import React, { useState } from 'react';
import { FaqItem } from '../types';

const PlusIcon = () => (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
);

const MinusIcon = () => (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 12H6"></path></svg>
);

interface FaqItemProps {
    item: FaqItem;
    isOpen: boolean;
    onClick: () => void;
}

const AccordionItem: React.FC<FaqItemProps> = ({ item, isOpen, onClick }) => {
    return (
        <div className="border-b border-gray-200 dark:border-dark-700">
            <h2>
                <button
                    type="button"
                    className="flex items-center justify-between w-full py-5 font-medium text-left text-gray-700 dark:text-gray-300"
                    onClick={onClick}
                    aria-expanded={isOpen}
                >
                    <span>{item.question}</span>
                    {isOpen ? <MinusIcon /> : <PlusIcon />}
                </button>
            </h2>
            <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isOpen ? 'max-h-96' : 'max-h-0'}`}>
                <div className="pb-5">
                    <p className="text-gray-500 dark:text-gray-400">{item.answer}</p>
                </div>
            </div>
        </div>
    );
};

const FaqAccordion: React.FC<{ items: FaqItem[] }> = ({ items }) => {
    const [openId, setOpenId] = useState<number | null>(1);

    const handleToggle = (id: number) => {
        setOpenId(openId === id ? null : id);
    };

    return (
        <div className="p-6 bg-white rounded-lg shadow-md dark:bg-dark-800">
            {items.map((item, index) => (
                <div 
                  key={item.id}
                  className={`transition-colors duration-300 ${openId === item._id ? 'bg-primary/5 dark:bg-primary/10 rounded-lg -mx-4 px-4' : ''}`}
                >
                    <AccordionItem
                        item={item}
                        isOpen={openId === item._id}
                        onClick={() => handleToggle(item._id)}
                    />
                </div>
            ))}
        </div>
    );
};

interface FaqsSectionProps {
    faqs: FaqItem[];
}

const FaqsSection: React.FC<FaqsSectionProps> = ({ faqs }) => {
    if (!faqs || faqs.length === 0) {
        return null;
    }
    
    return (
        <div className="mt-8">
            <h3 className="text-2xl font-semibold text-gray-700 dark:text-gray-200 mb-6">FAQs</h3>
            <FaqAccordion items={faqs} />
        </div>
    );
};

export default FaqsSection;