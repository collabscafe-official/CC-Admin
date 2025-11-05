// Fix: Created the full component to resolve module not found errors.
import React from 'react';
import { ContentHighlight } from '../types';

const PlayIcon = () => (
    <svg className="absolute w-12 h-12 text-white transition-transform duration-300 transform -translate-x-1/2 -translate-y-1/2 opacity-0 top-1/2 left-1/2 group-hover:opacity-100 group-hover:scale-110" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd"></path></svg>
);

const ViewsIcon = () => (<svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>);
const LikesIcon = () => (<svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg>);
const CommentsIcon = () => (<svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>);

const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num;
};

interface ContentHighlightsProps {
    highlights: ContentHighlight[];
}

const ContentHighlights: React.FC<ContentHighlightsProps> = ({ highlights }) => {
    if (!highlights || highlights.length === 0) {
        return null;
    }

    return (
        <div className="mt-8">
            <h3 className="text-2xl font-semibold text-gray-700 dark:text-gray-200 mb-6">Content Highlights</h3>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {highlights.map((item) => (
                    <a href={item.url} key={item._id} target="_blank" rel="noopener noreferrer" className="relative block overflow-hidden rounded-lg shadow-lg group">
                        <img src={item?.src} alt="Content highlight" className="object-cover w-full transition-transform duration-300 transform group-hover:scale-105" />
                        {item.type === 'video' && <PlayIcon />}
                        {/* <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent"></div>
                        <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                            <div className="flex items-center justify-between text-xs">
                                <span className="flex items-center"><ViewsIcon/> {formatNumber(item.views)}</span>
                                <span className="flex items-center"><LikesIcon/> {formatNumber(item.likes)}</span>
                                <span className="flex items-center"><CommentsIcon/> {formatNumber(item.comments)}</span>
                            </div>
                        </div> */}
                    </a>
                ))}
            </div>
        </div>
    );
};

export default ContentHighlights;
