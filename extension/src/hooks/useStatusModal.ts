import { useState, useCallback } from 'react';

export type StatusType = 'success' | 'danger' | 'info' | 'warning';

export interface StatusModalState {
    isOpen: boolean;
    title: string;
    message: string;
    type: StatusType;
}

export const useStatusModal = () => {
    const [statusModal, setStatusModal] = useState<StatusModalState>({
        isOpen: false,
        title: '',
        message: '',
        type: 'success'
    });

    const showStatus = useCallback((title: string, message: string, type: StatusType = 'success') => {
        setStatusModal({
            isOpen: true,
            title,
            message,
            type
        });
    }, []);

    const closeStatus = useCallback(() => {
        setStatusModal(prev => ({ ...prev, isOpen: false }));
    }, []);

    return {
        statusModal,
        showStatus,
        closeStatus
    };
};
