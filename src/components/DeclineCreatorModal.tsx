import React, { useState } from 'react';

// Reason codes (the source of truth — kept in sync with REASON_LABELS in
// Backend-V2/api/utils/emailTemplates.js). The label here is what the admin
// sees; the email template owns the copy sent to creators (intentionally
// kept slightly different — admin labels are tight, email labels are clearer
// for the recipient).
const DECLINE_REASONS: Array<{ code: string; label: string }> = [
    { code: 'low_followers',            label: 'Low followers' },
    { code: 'socials_not_found',        label: 'Socials not found / invalid' },
    { code: 'blurry_pictures',          label: 'Blurry profile / portfolio pictures' },
    { code: 'incomplete_portfolio',     label: 'Incomplete portfolio' },
    { code: 'incomplete_bio',           label: 'Incomplete bio' },
    { code: 'inappropriate_content',    label: 'Inappropriate content' },
    { code: 'low_engagement',           label: 'Low engagement rate' },
    { code: 'suspected_fake_followers', label: 'Suspected fake followers' },
    { code: 'niche_mismatch',           label: 'Niche not aligned' },
    { code: 'duplicate_account',        label: 'Duplicate account' },
    { code: 'stale_account',            label: 'Stale / inactive socials' },
    { code: 'region_not_supported',     label: 'Region not supported' },
];

interface DeclineCreatorModalProps {
    influencerName: string;
    onConfirm: (reasons: string[], customNote: string) => void;
    onCancel: () => void;
    isSubmitting?: boolean;
}

const WarningIcon = () => (
    <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
);

const DeclineCreatorModal: React.FC<DeclineCreatorModalProps> = ({
    influencerName,
    onConfirm,
    onCancel,
    isSubmitting = false,
}) => {
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [otherChecked, setOtherChecked] = useState(false);
    const [customNote, setCustomNote] = useState('');

    const toggle = (code: string) => {
        const next = new Set(selected);
        if (next.has(code)) next.delete(code);
        else next.add(code);
        setSelected(next);
    };

    const canSubmit = (selected.size > 0 || (otherChecked && customNote.trim().length > 0)) && !isSubmitting;

    const handleSubmit = () => {
        if (!canSubmit) return;
        const reasons = Array.from(selected);
        if (otherChecked && customNote.trim()) reasons.push('other');
        onConfirm(reasons, otherChecked ? customNote.trim() : '');
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-4"
            aria-labelledby="decline-modal-title"
            role="dialog"
            aria-modal="true"
        >
            <div className="relative transform overflow-hidden rounded-lg bg-white dark:bg-dark-800 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="bg-white dark:bg-dark-800 px-4 pb-4 pt-5 sm:p-6 sm:pb-4 border-b border-gray-200 dark:border-dark-700">
                    <div className="sm:flex sm:items-start">
                        <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/50 sm:mx-0 sm:h-10 sm:w-10">
                            <WarningIcon />
                        </div>
                        <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
                            <h3 className="text-base font-semibold leading-6 text-gray-900 dark:text-white" id="decline-modal-title">
                                Decline {influencerName}'s profile
                            </h3>
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                Select one or more reasons. The creator will receive an email with the reasons you choose.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Reason list */}
                <div className="px-6 py-4 overflow-y-auto flex-1">
                    <fieldset>
                        <legend className="sr-only">Decline reasons</legend>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2.5">
                            {DECLINE_REASONS.map(r => (
                                <label
                                    key={r.code}
                                    className="flex items-start gap-2.5 text-sm text-gray-700 dark:text-gray-300 cursor-pointer hover:text-gray-900 dark:hover:text-white py-1"
                                >
                                    <input
                                        type="checkbox"
                                        checked={selected.has(r.code)}
                                        onChange={() => toggle(r.code)}
                                        className="mt-0.5 h-4 w-4 rounded border-gray-300 dark:border-dark-600 text-red-600 focus:ring-red-500 focus:ring-offset-0"
                                    />
                                    <span>{r.label}</span>
                                </label>
                            ))}
                        </div>
                    </fieldset>

                    {/* Other / custom note */}
                    <div className="mt-5 pt-5 border-t border-gray-200 dark:border-dark-700">
                        <label className="flex items-start gap-2.5 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={otherChecked}
                                onChange={(e) => setOtherChecked(e.target.checked)}
                                className="mt-0.5 h-4 w-4 rounded border-gray-300 dark:border-dark-600 text-red-600 focus:ring-red-500 focus:ring-offset-0"
                            />
                            <span className="font-medium">Other (provide a note)</span>
                        </label>
                        {otherChecked && (
                            <textarea
                                value={customNote}
                                onChange={(e) => setCustomNote(e.target.value)}
                                rows={3}
                                maxLength={1000}
                                placeholder="Describe what the creator needs to fix..."
                                className="mt-2 block w-full rounded-md border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:border-red-500 focus:ring-1 focus:ring-red-500"
                            />
                        )}
                    </div>
                </div>

                {/* Footer actions */}
                <div className="bg-gray-50 dark:bg-dark-800/50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6 border-t border-gray-200 dark:border-dark-700">
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={!canSubmit}
                        className="inline-flex w-full justify-center rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 sm:ml-3 sm:w-auto disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? 'Declining…' : 'Decline & notify'}
                    </button>
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={isSubmitting}
                        className="mt-3 inline-flex w-full justify-center rounded-md bg-white dark:bg-dark-700 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-gray-300 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-dark-600 hover:bg-gray-50 dark:hover:bg-dark-600 sm:mt-0 sm:w-auto disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DeclineCreatorModal;
